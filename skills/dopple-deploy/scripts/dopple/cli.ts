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

      // Generate local QR code image
      const qrTarget = result.qr_url || result.manifest_url;
      if (qrTarget) {
        const QRCode = await import('qrcode');
        const qrPath = join(projectRoot, '.dopple-qr.png');
        await QRCode.toFile(qrPath, qrTarget, { width: 512, margin: 2 });
        result.qr_image_path = qrPath;
      }

      // Human-readable output
      console.log('');
      console.log('Deploy successful!');
      console.log(`  Activity: ${result.name}`);
      console.log(`  Version:  ${result.version}`);
      console.log(`  Manifest: ${result.manifest_url}`);
      if (result.qr_url) {
        console.log(`  QR Code:  ${result.qr_url}`);
      }
      if (result.qr_image_path) {
        console.log(`  QR Image: ${result.qr_image_path}`);
      }
      console.log('');

      // Machine-readable output
      console.log(`__DEPLOY_RESULT__${JSON.stringify(result)}`);
      break;
    }

    case 'update': {
      const { execFileSync } = await import('node:child_process');
      const { homedir } = await import('node:os');
      const { mkdirSync, writeFileSync } = await import('node:fs');

      // Update CLI via npm
      console.log('Updating CLI...');
      execFileSync('npm', ['install', '-g', '@curiosity-machines/dopple-cli@latest'], { stdio: 'inherit' });

      // Update skill
      console.log('Updating skill...');
      const skillDir = join(homedir(), '.claude', 'commands');
      mkdirSync(skillDir, { recursive: true });
      const skillContent = execFileSync('gh', [
        'api', 'repos/Curiosity-Machines/claude-skills/contents/dopple-deploy/SKILL.md',
        '--jq', '.content',
      ], { encoding: 'utf-8' });
      const decoded = Buffer.from(skillContent.trim(), 'base64').toString();
      writeFileSync(join(skillDir, 'dopple-deploy.md'), decoded);

      console.log('Done!');
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
