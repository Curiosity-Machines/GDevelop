#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { init } from './init.js';
import { login, whoami, resolveAuth } from './auth.js';
import { loadConfig } from './config.js';
import { runBuild } from './build.js';
import { runSmokeTest } from './smoke.js';
import { deploy } from './deploy.js';
import { doctor } from './doctor.js';
const CLI_VERSION = typeof DOPPLE_CLI_VERSION !== 'undefined'
    ? DOPPLE_CLI_VERSION
    : await (async () => {
        try {
            const { createRequire } = await import('node:module');
            return createRequire(import.meta.url)('./package.json').version;
        }
        catch {
            return 'unknown';
        }
    })();
// Configure global fetch proxy if HTTPS_PROXY is set (e.g. in containers).
// Must run before any Supabase client calls.
async function setupProxy() {
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
  doctor      Check environment, skills, and auth health
  update      Update the CLI and Claude Code skill
  version     Show the installed CLI version

Options:
  --as <name>      Override the activity name for this deploy
  --token <token>  Use an explicit auth token
  --no-smoke       Skip the Playwright smoke test
  --fix            Auto-fix issues found by doctor
  -h, --help       Show this help message
`.trim();
async function main() {
    await setupProxy();
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            as: { type: 'string' },
            token: { type: 'string' },
            'no-smoke': { type: 'boolean', default: false },
            fix: { type: 'boolean', default: false },
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
        case 'version':
        case '--version':
        case '-v': {
            console.log(`dopple ${CLI_VERSION}`);
            process.exit(0);
            break;
        }
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
        case 'doctor': {
            await doctor(CLI_VERSION, !!values.fix);
            break;
        }
        case 'deploy': {
            // Authenticate first — required for deploy and version check
            const accessToken = await resolveAuth(values.token);
            // Check for CLI updates (uses auth token for authenticated storage access)
            try {
                const { createClient } = await import('@supabase/supabase-js');
                const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://onljswkegixyjjhpcldn.supabase.co';
                const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k';
                const sb = createClient(supabaseUrl, supabaseAnonKey, {
                    global: { headers: { Authorization: `Bearer ${accessToken}` } },
                });
                const { data: vData } = await sb.storage.from('sdk-assets').download('versions.json');
                if (vData) {
                    const remote = JSON.parse(await vData.text());
                    if (remote.cli !== CLI_VERSION) {
                        console.log(`\n⚠  Update available: v${remote.cli} (current: v${CLI_VERSION})`);
                        console.log(`   Run 'dopple update' to get the latest.\n`);
                    }
                }
            }
            catch { /* version check is best-effort */ }
            const config = await loadConfig(projectRoot);
            // Build
            await runBuild(config, projectRoot);
            // Smoke test (unless --no-smoke)
            if (!values['no-smoke']) {
                try {
                    await runSmokeTest(config, projectRoot);
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    if (msg.includes('Playwright is not installed')) {
                        console.log(`Skipping smoke test: ${msg}`);
                    }
                    else {
                        throw err;
                    }
                }
            }
            else {
                console.log('Skipping smoke test (--no-smoke).');
            }
            // Deploy
            const result = await deploy(config, projectRoot, accessToken, values.as);
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
            // Fetch version info + versioned filenames
            let remoteVersions = null;
            try {
                const { data: vData } = await supabase.storage
                    .from('sdk-assets')
                    .download('versions.json');
                if (vData) {
                    remoteVersions = JSON.parse(await vData.text());
                }
            }
            catch { /* versions.json may not exist yet */ }
            if (remoteVersions) {
                console.log(`Current: CLI ${CLI_VERSION}`);
                console.log(`Latest:  CLI ${remoteVersions.cli}  |  Skill ${remoteVersions.skill}`);
            }
            const { readFile: readFileAsync } = await import('node:fs/promises');
            const skillDir = join(homedir(), '.claude', 'commands');
            await mkdirAsync(skillDir, { recursive: true });
            // Check if CLI + skill need updating
            const cliUpToDate = remoteVersions != null && CLI_VERSION === remoteVersions.cli;
            if (cliUpToDate) {
                console.log('CLI and skill already up to date.');
            }
            else {
                // Download CLI bundle (versioned filename for CDN cache-busting)
                const cliFile = remoteVersions?.files?.cli || 'dopple-cli.cjs';
                console.log(`Downloading ${cliFile}...`);
                const { data: cliData, error: cliErr } = await supabase.storage
                    .from('sdk-assets')
                    .download(cliFile);
                if (cliErr || !cliData) {
                    throw new Error(`Failed to download CLI: ${cliErr?.message || 'no data'}`);
                }
                // Write CLI to ~/.dopple/cli.cjs (canonical location)
                const cliBytes = Buffer.from(await cliData.arrayBuffer());
                const selfPath = join(homedir(), '.dopple', 'cli.cjs');
                await mkdirAsync(join(homedir(), '.dopple'), { recursive: true });
                const tmpPath = join(tmpdir(), `dopple-update-${randomUUID()}.cjs`);
                await writeFileAsync(tmpPath, cliBytes, { mode: 0o755 });
                try {
                    await rename(tmpPath, selfPath);
                    console.log(`CLI updated (${(cliBytes.length / 1024).toFixed(0)} KB)`);
                }
                catch {
                    // rename fails across filesystems — fall back to copy
                    await writeFileAsync(selfPath, cliBytes, { mode: 0o755 });
                    await unlink(tmpPath).catch(() => { });
                    console.log(`CLI updated (${(cliBytes.length / 1024).toFixed(0)} KB)`);
                }
                // Download skill (versioned filename for CDN cache-busting)
                const skillFile = remoteVersions?.files?.skill || 'dopple-deploy.md';
                console.log(`Downloading ${skillFile}...`);
                const { data: skillData, error: skillErr } = await supabase.storage
                    .from('sdk-assets')
                    .download(skillFile);
                if (skillErr || !skillData) {
                    throw new Error(`Failed to download skill: ${skillErr?.message || 'no data'}`);
                }
                const skillBytes = Buffer.from(await skillData.arrayBuffer());
                await writeFileAsync(join(skillDir, 'dopple-deploy.md'), skillBytes);
                console.log(`Skill updated (${(skillBytes.length / 1024).toFixed(0)} KB)`);
                // Ensure bin wrapper exists so `dopple` is on PATH via ~/.dopple/bin
                const binDir = join(homedir(), '.dopple', 'bin');
                const binWrapper = join(binDir, 'dopple');
                try {
                    await import('node:fs/promises').then(fs => fs.access(binWrapper));
                }
                catch {
                    await mkdirAsync(binDir, { recursive: true });
                    await writeFileAsync(binWrapper, `#!/usr/bin/env node\nrequire(require('path').join(require('os').homedir(), '.dopple', 'cli.cjs'));\n`, { mode: 0o755 });
                    console.log(`Created ${binWrapper}`);
                }
            }
            // Update loop-dev skill + types if available
            let loopVersions = null;
            try {
                const { data: lvData } = await supabase.storage
                    .from('sdk-assets')
                    .download('loop-dev-versions.json');
                if (lvData) {
                    loopVersions = JSON.parse(await lvData.text());
                }
            }
            catch { /* loop-dev versions may not exist yet */ }
            let loopUpToDate = true;
            if (loopVersions?.files) {
                // Check installed loop-dev version from skill frontmatter
                let installedLoopVersion = null;
                try {
                    const loopSkillContent = await readFileAsync(join(skillDir, 'loop-dev.md'), 'utf-8');
                    const vMatch = loopSkillContent.match(/^version:\s*(.+)$/m);
                    if (vMatch)
                        installedLoopVersion = vMatch[1].trim();
                }
                catch { /* not installed yet */ }
                loopUpToDate = installedLoopVersion === loopVersions.skill;
                if (loopUpToDate) {
                    console.log(`\nLoop Dev already up to date (v${loopVersions.skill}).`);
                }
                else {
                    console.log('');
                    console.log(`Updating loop-dev (v${loopVersions.skill})...`);
                    const loopSkillFile = loopVersions.files.skill;
                    const { data: loopSkillData } = await supabase.storage
                        .from('sdk-assets')
                        .download(loopSkillFile);
                    if (loopSkillData) {
                        const loopSkillBytes = Buffer.from(await loopSkillData.arrayBuffer());
                        await writeFileAsync(join(skillDir, 'loop-dev.md'), loopSkillBytes);
                        console.log(`  Skill updated (${(loopSkillBytes.length / 1024).toFixed(0)} KB)`);
                    }
                    const loopTypesFile = loopVersions.files.types;
                    const { data: loopTypesData } = await supabase.storage
                        .from('sdk-assets')
                        .download(loopTypesFile);
                    if (loopTypesData) {
                        const typesDir = join(homedir(), '.dopple', 'types');
                        await mkdirAsync(typesDir, { recursive: true });
                        const loopTypesBytes = Buffer.from(await loopTypesData.arrayBuffer());
                        await writeFileAsync(join(typesDir, 'loop-sdk-dx.d.ts'), loopTypesBytes);
                        console.log(`  Types updated (${(loopTypesBytes.length / 1024).toFixed(0)} KB)`);
                    }
                }
            }
            console.log('');
            if (cliUpToDate && loopUpToDate) {
                console.log('Everything is up to date!');
            }
            else {
                const parts = [];
                if (!cliUpToDate && remoteVersions)
                    parts.push(`CLI ${remoteVersions.cli}, Skill ${remoteVersions.skill}`);
                if (!loopUpToDate && loopVersions)
                    parts.push(`Loop Dev ${loopVersions.skill}`);
                if (parts.length > 0) {
                    console.log(`Updated: ${parts.join(' | ')}`);
                }
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
