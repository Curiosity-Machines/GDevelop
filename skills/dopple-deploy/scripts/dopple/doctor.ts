import { access, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
  fixable: boolean;
  fix?: () => Promise<string>;  // returns message after fix
  instruction?: string;         // HITL instructions when not auto-fixable
}

const SKILL_DIR = join(homedir(), '.claude', 'commands');
const DOPPLE_DIR = join(homedir(), '.dopple');
const AUTH_FILE = join(DOPPLE_DIR, 'auth.json');
const TYPES_DIR = join(DOPPLE_DIR, 'types');

// ── Environment checks ─────────────────────────────────────────────

async function checkNodeVersion(): Promise<CheckResult> {
  try {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);
    if (major < 18) {
      return {
        name: 'Node.js version',
        ok: false,
        message: `Node.js ${version} found, 18+ required`,
        fixable: false,
        instruction: 'Install Node.js 18+ from https://nodejs.org',
      };
    }
    return { name: 'Node.js version', ok: true, message: `${version}`, fixable: false };
  } catch {
    return {
      name: 'Node.js version',
      ok: false,
      message: 'Could not determine Node.js version',
      fixable: false,
      instruction: 'Install Node.js 18+ from https://nodejs.org',
    };
  }
}

async function checkClaudeCli(): Promise<CheckResult> {
  try {
    execFileSync('claude', ['--version'], { stdio: 'pipe' });
    return { name: 'Claude Code CLI', ok: true, message: 'installed', fixable: false };
  } catch {
    return {
      name: 'Claude Code CLI',
      ok: false,
      message: 'claude not found on PATH',
      fixable: false,
      instruction: 'Install Claude Code: https://docs.anthropic.com/en/docs/claude-code/overview',
    };
  }
}

// ── Auth checks ─────────────────────────────────────────────────────

async function checkAuthFile(): Promise<CheckResult> {
  try {
    const raw = await readFile(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (typeof data.refresh_token === 'string' && data.refresh_token.length > 0) {
      return { name: 'Auth file', ok: true, message: AUTH_FILE, fixable: false };
    }
    return {
      name: 'Auth file',
      ok: false,
      message: 'auth.json exists but missing refresh_token',
      fixable: false,
      instruction: 'Run: dopple login',
    };
  } catch {
    return {
      name: 'Auth file',
      ok: false,
      message: 'Not authenticated',
      fixable: false,
      instruction: 'Run: dopple login',
    };
  }
}

async function checkAuthValid(): Promise<CheckResult> {
  try {
    const raw = await readFile(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.refresh_token) {
      return { name: 'Auth token valid', ok: false, message: 'No refresh token', fixable: false, instruction: 'Run: dopple login' };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://onljswkegixyjjhpcldn.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k';
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data: session, error } = await sb.auth.refreshSession({ refresh_token: data.refresh_token });
    if (error || !session.session) {
      return {
        name: 'Auth token valid',
        ok: false,
        message: `Session expired: ${error?.message || 'no session'}`,
        fixable: false,
        instruction: 'Run: dopple login',
      };
    }
    const { data: userData } = await sb.auth.getUser(session.session.access_token);
    const email = userData?.user?.email || 'authenticated';
    return { name: 'Auth token valid', ok: true, message: email, fixable: false };
  } catch {
    return { name: 'Auth token valid', ok: false, message: 'Could not validate token', fixable: false, instruction: 'Run: dopple login' };
  }
}

// ── Skill checks ────────────────────────────────────────────────────

async function checkSkillInstalled(name: string, filename: string): Promise<CheckResult> {
  const path = join(SKILL_DIR, filename);
  try {
    await access(path);
    return { name: `${name} skill`, ok: true, message: path, fixable: false };
  } catch {
    return {
      name: `${name} skill`,
      ok: false,
      message: `${filename} not found`,
      fixable: true,
      fix: async () => {
        // dopple update installs all skills
        console.log('    Running dopple update to install skills...');
        execFileSync('dopple', ['update'], { stdio: 'inherit' });
        return 'Installed via dopple update';
      },
      instruction: 'Run: dopple update',
    };
  }
}

async function checkLoopDevTypes(): Promise<CheckResult> {
  const path = join(TYPES_DIR, 'loop-sdk-dx.d.ts');
  try {
    await access(path);
    return { name: 'Loop Dev types', ok: true, message: path, fixable: false };
  } catch {
    return {
      name: 'Loop Dev types',
      ok: false,
      message: 'loop-sdk-dx.d.ts not found',
      fixable: true,
      fix: async () => {
        console.log('    Running dopple update to install types...');
        execFileSync('dopple', ['update'], { stdio: 'inherit' });
        return 'Installed via dopple update';
      },
      instruction: 'Run: dopple update',
    };
  }
}

// ── CLI + version checks ────────────────────────────────────────────

async function checkCliOnPath(): Promise<CheckResult> {
  try {
    const output = execFileSync('which', ['dopple'], { stdio: 'pipe' }).toString().trim();
    return { name: 'CLI on PATH', ok: true, message: output, fixable: false };
  } catch {
    return {
      name: 'CLI on PATH',
      ok: false,
      message: 'dopple not found on PATH',
      fixable: false,
      instruction: 'Ensure ~/bin or ~/.dopple/bin is in your PATH, or reinstall with the install script',
    };
  }
}

async function checkVersionsCurrent(cliVersion: string): Promise<CheckResult> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://onljswkegixyjjhpcldn.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k';
    const sb = createClient(supabaseUrl, supabaseAnonKey);
    const { data: vData } = await sb.storage.from('sdk-assets').download('versions.json');
    if (!vData) {
      return { name: 'CLI version', ok: true, message: `v${cliVersion} (could not check remote)`, fixable: false };
    }
    const remote = JSON.parse(await vData.text()) as { cli: string; skill: string };

    if (remote.cli === cliVersion) {
      return { name: 'CLI version', ok: true, message: `v${cliVersion} (latest)`, fixable: false };
    }
    return {
      name: 'CLI version',
      ok: false,
      message: `v${cliVersion} installed, v${remote.cli} available`,
      fixable: true,
      fix: async () => {
        console.log('    Running dopple update...');
        execFileSync('dopple', ['update'], { stdio: 'inherit' });
        return `Updated to v${remote.cli}`;
      },
      instruction: 'Run: dopple update',
    };
  } catch {
    return { name: 'CLI version', ok: true, message: `v${cliVersion} (version check failed)`, fixable: false };
  }
}

async function checkSkillVersionsCurrent(): Promise<CheckResult> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://onljswkegixyjjhpcldn.supabase.co';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTIyNTMxfQ.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k';
    const sb = createClient(supabaseUrl, supabaseAnonKey);

    const stale: string[] = [];

    // Check dopple-deploy skill version
    const { data: vData } = await sb.storage.from('sdk-assets').download('versions.json');
    if (vData) {
      const remote = JSON.parse(await vData.text()) as { skill: string };
      try {
        const content = await readFile(join(SKILL_DIR, 'dopple-deploy.md'), 'utf-8');
        const match = content.match(/^version:\s*(.+)$/m);
        if (match && match[1].trim() !== remote.skill) {
          stale.push(`dopple-deploy: ${match[1].trim()} -> ${remote.skill}`);
        }
      } catch { /* not installed — caught by skill install check */ }
    }

    // Check loop-dev skill version
    const { data: lvData } = await sb.storage.from('sdk-assets').download('loop-dev-versions.json');
    if (lvData) {
      const remote = JSON.parse(await lvData.text()) as { skill: string };
      try {
        const content = await readFile(join(SKILL_DIR, 'loop-dev.md'), 'utf-8');
        const match = content.match(/^version:\s*(.+)$/m);
        if (match && match[1].trim() !== remote.skill) {
          stale.push(`loop-dev: ${match[1].trim()} -> ${remote.skill}`);
        }
      } catch { /* not installed */ }
    }

    if (stale.length === 0) {
      return { name: 'Skill versions', ok: true, message: 'up to date', fixable: false };
    }
    return {
      name: 'Skill versions',
      ok: false,
      message: stale.join(', '),
      fixable: true,
      fix: async () => {
        console.log('    Running dopple update...');
        execFileSync('dopple', ['update'], { stdio: 'inherit' });
        return 'Updated via dopple update';
      },
      instruction: 'Run: dopple update',
    };
  } catch {
    return { name: 'Skill versions', ok: true, message: 'could not check remote', fixable: false };
  }
}

// ── Connectivity checks ─────────────────────────────────────────────

async function checkSupabaseReachable(): Promise<CheckResult> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://onljswkegixyjjhpcldn.supabase.co';
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k' },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok || response.status === 401) {
      // 401 is fine — means we reached Supabase, just no auth header
      return { name: 'Supabase reachable', ok: true, message: supabaseUrl, fixable: false };
    }
    return {
      name: 'Supabase reachable',
      ok: false,
      message: `HTTP ${response.status}`,
      fixable: false,
      instruction: 'Check your network connection and proxy settings (HTTPS_PROXY)',
    };
  } catch (err) {
    return {
      name: 'Supabase reachable',
      ok: false,
      message: err instanceof Error ? err.message : 'unreachable',
      fixable: false,
      instruction: 'Check your network connection and proxy settings (HTTPS_PROXY)',
    };
  }
}

// ── Runner ──────────────────────────────────────────────────────────

export async function doctor(cliVersion: string, fix: boolean): Promise<void> {
  console.log('Dopple Doctor\n');

  const checks: { category: string; checks: (() => Promise<CheckResult>)[] }[] = [
    {
      category: 'Environment',
      checks: [checkNodeVersion, checkClaudeCli],
    },
    {
      category: 'Authentication',
      checks: [checkAuthFile, checkAuthValid],
    },
    {
      category: 'Skills',
      checks: [
        () => checkSkillInstalled('dopple-deploy', 'dopple-deploy.md'),
        () => checkSkillInstalled('loop-dev', 'loop-dev.md'),
        checkLoopDevTypes,
        checkSkillVersionsCurrent,
      ],
    },
    {
      category: 'CLI',
      checks: [checkCliOnPath, () => checkVersionsCurrent(cliVersion)],
    },
    {
      category: 'Connectivity',
      checks: [checkSupabaseReachable],
    },
  ];

  let totalPass = 0;
  let totalFail = 0;
  let totalFixed = 0;

  for (const group of checks) {
    console.log(`  ${group.category}`);
    for (const check of group.checks) {
      const result = await check();

      if (result.ok) {
        console.log(`    ok  ${result.name} — ${result.message}`);
        totalPass++;
      } else if (fix && result.fixable && result.fix) {
        try {
          const fixMsg = await result.fix();
          console.log(`    fix ${result.name} — ${fixMsg}`);
          totalFixed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.log(`    FAIL ${result.name} — ${result.message}`);
          console.log(`         Fix failed: ${msg}`);
          if (result.instruction) {
            console.log(`         Manual fix: ${result.instruction}`);
          }
          totalFail++;
        }
      } else {
        console.log(`    FAIL ${result.name} — ${result.message}`);
        if (result.fixable && !fix) {
          console.log(`         Fixable: run with --fix`);
        }
        if (result.instruction) {
          console.log(`         ${result.instruction}`);
        }
        totalFail++;
      }
    }
    console.log('');
  }

  // Summary
  const parts: string[] = [`${totalPass} passed`];
  if (totalFixed > 0) parts.push(`${totalFixed} fixed`);
  if (totalFail > 0) parts.push(`${totalFail} failed`);
  console.log(parts.join(', '));

  if (totalFail > 0) {
    process.exit(1);
  }
}
