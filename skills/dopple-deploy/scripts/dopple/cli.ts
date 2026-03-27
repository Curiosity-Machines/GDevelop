#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { init } from './init.js';
import { login, whoami, resolveAuth } from './auth.js';
import { loadConfig } from './config.js';
import { runBuild } from './build.js';
import { runSmokeTest } from './smoke.js';
import { deploy, type DeployResult } from './deploy.js';

// Configure global fetch proxy if HTTPS_PROXY is set (e.g. in containers).
// Must run before any Supabase client calls.
async function setupProxy(): Promise<void> {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
                   process.env.HTTP_PROXY || process.env.http_proxy;
  if (proxyUrl) {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }
}

const HELP = `
dopple - Deploy activities to Dopple Studio

Usage:
  dopple <command> [options]

Commands:
  init        Initialize dopple.toml in the current directory
  login       Authenticate via browser OAuth
  whoami      Show the currently authenticated user
  deploy      Build, test, and deploy the activity
  update      Update the CLI and Claude Code skill

Options:
  --as <name>      Override the activity name for this deploy
  --token <token>  Use an explicit auth token
  --no-smoke       Skip the Playwright smoke test
  -h, --help       Show this help message
`.trim();

async function main(): Promise<void> {
  await setupProxy();

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      as: { type: 'string' },
      token: { type: 'string' },
      'no-smoke': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const command = positionals[0];
  const projectRoot = resolve('.');

  switch (command) {
    case 'init': {
      await init(projectRoot);
      break;
    }

    case 'login': {
      await login();
      break;
    }

    case 'whoami': {
      const email = await whoami(values.token);
      console.log(email);
      break;
    }

    case 'deploy': {
      const config = await loadConfig(projectRoot);

      // Build
      await runBuild(config, projectRoot);

      // Smoke test (unless --no-smoke)
      if (!values['no-smoke']) {
        try {
          await runSmokeTest(config, projectRoot);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Playwright is not installed')) {
            console.log(`Skipping smoke test: ${msg}`);
          } else {
            throw err;
          }
        }
      } else {
        console.log('Skipping smoke test (--no-smoke).');
      }

      // Authenticate
      const accessToken = await resolveAuth(values.token);

      // Deploy
      const result: DeployResult = await deploy(config, projectRoot, accessToken, values.as);

      // Human-readable output
      console.log('');
      console.log('Deploy successful!');
      console.log(`  Activity: ${result.name}`);
      console.log(`  Version:  ${result.version}`);
      console.log(`  Manifest: ${result.manifest_url}`);
      if (result.qr_url) {
        console.log(`  QR Page:  ${result.qr_url}`);
      }
      if (result.qr_image_url) {
        console.log(`  QR Image: ${result.qr_image_url}`);
      }
      console.log('');

      // Machine-readable output
      console.log(`__DEPLOY_RESULT__${JSON.stringify(result)}`);
      break;
    }

    case 'update': {
      const { homedir } = await import('node:os');
      const { writeFile: writeFileAsync, mkdir: mkdirAsync, rename, unlink } = await import('node:fs/promises');
      const { createClient } = await import('@supabase/supabase-js');
      const { tmpdir } = await import('node:os');
      const { randomUUID } = await import('node:crypto');

      const accessToken = await resolveAuth(values.token);
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://onljswkegixyjjhpcldn.supabase.co';
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k';

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      // Fetch version info
      let remoteVersions: { cli: string; skill: string; published_at?: string } | null = null;
      try {
        const { data: vData } = await supabase.storage
          .from('sdk-assets')
          .download('versions.json');
        if (vData) {
          remoteVersions = JSON.parse(await vData.text());
        }
      } catch { /* versions.json may not exist yet */ }

      if (remoteVersions) {
        console.log(`Latest:  CLI ${remoteVersions.cli}  |  Skill ${remoteVersions.skill}`);
      }

      // Download CLI bundle
      console.log('Downloading CLI...');
      const { data: cliData, error: cliErr } = await supabase.storage
        .from('sdk-assets')
        .download('dopple-cli.cjs');

      if (cliErr || !cliData) {
        throw new Error(`Failed to download CLI: ${cliErr?.message || 'no data'}`);
      }

      // Write CLI to temp file, then atomic rename over self
      const cliBytes = Buffer.from(await cliData.arrayBuffer());
      const selfPath = typeof __filename !== 'undefined'
        ? __filename
        : new URL(import.meta.url).pathname;
      const tmpPath = join(tmpdir(), `dopple-update-${randomUUID()}.cjs`);
      await writeFileAsync(tmpPath, cliBytes, { mode: 0o755 });

      try {
        await rename(tmpPath, selfPath);
        console.log(`CLI updated (${(cliBytes.length / 1024).toFixed(0)} KB)`);
      } catch {
        // rename fails across filesystems — fall back to copy
        await writeFileAsync(selfPath, cliBytes, { mode: 0o755 });
        await unlink(tmpPath).catch(() => {});
        console.log(`CLI updated (${(cliBytes.length / 1024).toFixed(0)} KB)`);
      }

      // Download skill
      console.log('Downloading skill...');
      const { data: skillData, error: skillErr } = await supabase.storage
        .from('sdk-assets')
        .download('dopple-deploy.md');

      if (skillErr || !skillData) {
        throw new Error(`Failed to download skill: ${skillErr?.message || 'no data'}`);
      }

      const skillBytes = Buffer.from(await skillData.arrayBuffer());
      const skillDir = join(homedir(), '.claude', 'commands');
      await mkdirAsync(skillDir, { recursive: true });
      await writeFileAsync(join(skillDir, 'dopple-deploy.md'), skillBytes);
      console.log(`Skill updated (${(skillBytes.length / 1024).toFixed(0)} KB)`);

      console.log('');
      if (remoteVersions) {
        console.log(`Updated to CLI ${remoteVersions.cli}, Skill ${remoteVersions.skill}`);
      } else {
        console.log('Done!');
      }
      break;
    }

    default: {
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
