# Dopple Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Wrangler-style CLI (`dopple`) bundled in a Claude Code/Codex skill that deploys activities to Dopple Studio via a two-phase edge function, with optional Slack notification via MCP.

**Architecture:** CLI reads `dopple.toml`, authenticates via token or OAuth, builds the project, optionally smoke-tests with Playwright, ZIPs the output, and deploys via a two-phase edge function (initiate → signed-URL upload → finalize). The skill wraps the CLI and adds Slack MCP notification.

**Tech Stack:** Node/TypeScript (CLI), Deno/TypeScript (edge function), Supabase (auth, DB, storage), Playwright (smoke test), TOML parsing.

**Spec:** `docs/superpowers/specs/2026-03-20-dopple-deploy-design.md`

---

## File Structure

### New Files

```
supabase/
├── migrations/
│   └── 20260320_add_unique_activity_name.sql    # Uniqueness constraint
├── functions/
│   └── deploy-activity/
│       └── index.ts                              # Two-phase deploy edge function
└── config.toml                                   # Updated: add deploy-activity config

skills/
└── dopple-deploy/
    ├── SKILL.md                                  # Already drafted, will be updated
    ├── scripts/
    │   └── dopple/
    │       ├── package.json                      # CLI dependencies
    │       ├── tsconfig.json                     # TypeScript config
    │       ├── cli.ts                            # Entry point, command routing
    │       ├── config.ts                         # dopple.toml parsing
    │       ├── auth.ts                           # OAuth + token auth
    │       ├── build.ts                          # Build command execution
    │       ├── smoke.ts                          # Playwright smoke test
    │       ├── deploy.ts                         # Two-phase deploy (initiate + upload + finalize)
    │       └── init.ts                           # dopple init command
    └── evals/
        └── evals.json                            # Already exists
```

### Modified Files

```
supabase/config.toml                              # Add deploy-activity function config
```

---

## Task 1: Database Migration — Unique Activity Name Constraint

**Files:**
- Create: `supabase/migrations/20260320_add_unique_activity_name.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add unique constraint on (user_id, name) to support upsert-by-name
-- This ensures each user has uniquely named activities
CREATE UNIQUE INDEX IF NOT EXISTS activities_user_id_name_idx ON activities(user_id, name);
```

- [ ] **Step 2: Verify migration is valid SQL**

Run: `cat supabase/migrations/20260320_add_unique_activity_name.sql`
Expected: Valid SQL with the CREATE UNIQUE INDEX statement.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260320_add_unique_activity_name.sql
git commit -m "feat: add unique constraint on (user_id, name) for deploy upsert"
```

---

## Task 2: Deploy Edge Function — Phase 1 (Initiate)

**Files:**
- Create: `supabase/functions/deploy-activity/index.ts`
- Modify: `supabase/config.toml`

The edge function handles two routes:
- `POST /deploy-activity` (phase 1: initiate — upsert activity, return signed upload URLs)
- `POST /deploy-activity` with `action=finalize` (phase 2: validate uploaded bundle, update record)

Both phases are in the same function since Supabase edge functions are single-file. We route by the `action` field in the request body.

- [ ] **Step 1: Update config.toml to register the new function**

Add to `supabase/config.toml`:
```toml
[functions.deploy-activity]
verify_jwt = true
```

This function requires authentication (unlike get-manifest which is public).

- [ ] **Step 2: Write the edge function with Phase 1 (initiate)**

Create `supabase/functions/deploy-activity/index.ts`:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a user-scoped Supabase client from the Authorization header
function createUserClient(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization')!;

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

// Create a service-role client for storage operations (signed URLs)
function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey);
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Phase 1: Initiate deploy — upsert activity, return signed upload URLs
async function handleInitiate(req: Request) {
  const userClient = createUserClient(req);
  const serviceClient = createServiceClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse(401, 'Invalid or expired auth token');
  }

  const body = await req.json();
  const { name, entry_point, has_icon, icon_extension } = body;

  if (!name || !entry_point) {
    return errorResponse(400, 'Missing required fields: name, entry_point');
  }

  // Upsert: check if activity with this name exists for this user
  const { data: existing } = await userClient
    .from('activities')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name)
    .maybeSingle();

  let activityId: string;

  if (existing) {
    activityId = existing.id;
  } else {
    // Insert new activity
    const { data: newActivity, error: insertError } = await userClient
      .from('activities')
      .insert({ user_id: user.id, name, entry_point })
      .select('id')
      .single();

    if (insertError || !newActivity) {
      return errorResponse(500, `Failed to create activity: ${insertError?.message}`);
    }
    activityId = newActivity.id;
  }

  // Generate signed upload URLs using service client
  const bundlePath = `${user.id}/${activityId}/bundle.zip`;
  const { data: bundleUrl, error: bundleUrlError } = await serviceClient.storage
    .from('activity-bundles')
    .createSignedUploadUrl(bundlePath, { upsert: true });

  if (bundleUrlError || !bundleUrl) {
    return errorResponse(500, `Failed to generate upload URL: ${bundleUrlError?.message}`);
  }

  const result: Record<string, unknown> = {
    activity_id: activityId,
    bundle_upload_url: bundleUrl.signedUrl,
    bundle_upload_token: bundleUrl.token,
    bundle_path: `${user.id}/${activityId}`,
  };

  // Generate icon upload URL if needed
  if (has_icon && icon_extension) {
    const iconPath = `${user.id}/${activityId}/icon.${icon_extension}`;
    const { data: iconUrl, error: iconUrlError } = await serviceClient.storage
      .from('activity-bundles')
      .createSignedUploadUrl(iconPath, { upsert: true });

    if (!iconUrlError && iconUrl) {
      result.icon_upload_url = iconUrl.signedUrl;
      result.icon_upload_token = iconUrl.token;
    }
  }

  return jsonResponse(result);
}

// Phase 2: Finalize — placeholder, implemented in Task 3
async function handleFinalize(_req: Request): Promise<Response> {
  return errorResponse(501, 'Finalize not yet implemented');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // Clone request so we can read body twice if needed
    const cloned = req.clone();
    const body = await cloned.json();

    if (body.action === 'finalize') {
      return await handleFinalize(req);
    }
    return await handleInitiate(req);
  } catch (error) {
    console.error('Deploy error:', error);
    return errorResponse(500, 'Internal server error');
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/deploy-activity/index.ts supabase/config.toml
git commit -m "feat: add deploy-activity edge function with Phase 1 (initiate)"
```

---

## Task 3: Deploy Edge Function — Phase 2 (Finalize)

**Files:**
- Modify: `supabase/functions/deploy-activity/index.ts`

Replace the `handleFinalize` placeholder with the real implementation.

- [ ] **Step 1: Implement handleFinalize**

Replace the placeholder `handleFinalize` function with:

```typescript
// Valid image extensions for icons (Unity-supported formats)
const VALID_ICON_EXTENSIONS = new Set([
  'bmp', 'jpg', 'jpeg', 'png', 'psd', 'tga', 'tiff', 'tif',
]);

const MAX_BUNDLE_SIZE = 50 * 1024 * 1024; // 50MB

// Phase 2: Finalize deploy — validate uploaded bundle, update activity record
async function handleFinalize(req: Request) {
  const userClient = createUserClient(req);
  const serviceClient = createServiceClient();

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return errorResponse(401, 'Invalid or expired auth token');
  }

  const body = await req.json();
  const { activity_id, entry_point, icon_extension } = body;

  if (!activity_id || !entry_point) {
    return errorResponse(400, 'Missing required fields: activity_id, entry_point');
  }

  // Verify activity belongs to this user
  const { data: activity, error: activityError } = await userClient
    .from('activities')
    .select('id, name')
    .eq('id', activity_id)
    .eq('user_id', user.id)
    .single();

  if (activityError || !activity) {
    return errorResponse(404, 'Activity not found');
  }

  const bundlePath = `${user.id}/${activity_id}`;
  const bundleFilePath = `${bundlePath}/bundle.zip`;

  // Download and validate the uploaded bundle
  const { data: bundleData, error: downloadError } = await serviceClient.storage
    .from('activity-bundles')
    .download(bundleFilePath);

  if (downloadError || !bundleData) {
    return errorResponse(400, 'Bundle not found in storage. Upload may have failed.');
  }

  // Check size
  if (bundleData.size > MAX_BUNDLE_SIZE) {
    await serviceClient.storage.from('activity-bundles').remove([bundleFilePath]);
    return errorResponse(413, `Bundle exceeds ${MAX_BUNDLE_SIZE / 1024 / 1024}MB limit`);
  }

  // Validate ZIP structure
  try {
    const arrayBuffer = await bundleData.arrayBuffer();
    const zipView = new Uint8Array(arrayBuffer);

    // Check ZIP magic number (PK\x03\x04)
    if (zipView.length < 4 || zipView[0] !== 0x50 || zipView[1] !== 0x4B) {
      await serviceClient.storage.from('activity-bundles').remove([bundleFilePath]);
      return errorResponse(400, 'Invalid ZIP file');
    }

    // Check entry_point has .html extension
    if (!entry_point.endsWith('.html')) {
      await serviceClient.storage.from('activity-bundles').remove([bundleFilePath]);
      return errorResponse(400, 'Entry point must be an .html file');
    }
  } catch {
    await serviceClient.storage.from('activity-bundles').remove([bundleFilePath]);
    return errorResponse(400, 'Failed to validate bundle');
  }

  // Check for uploaded icon and build icon URL
  let iconUrl: string | null = null;
  if (icon_extension && VALID_ICON_EXTENSIONS.has(icon_extension)) {
    const iconPath = `${bundlePath}/icon.${icon_extension}`;
    const { data: iconExists } = await serviceClient.storage
      .from('activity-bundles')
      .download(iconPath);
    if (iconExists) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      iconUrl = `${supabaseUrl}/storage/v1/object/public/activity-bundles/${iconPath}`;
    }
  }

  // Update the activity record
  const updateData: Record<string, unknown> = {
    bundle_path: bundlePath,
    entry_point,
  };
  if (iconUrl) {
    updateData.icon_url = iconUrl;
  }

  const { data: updatedActivity, error: updateError } = await userClient
    .from('activities')
    .update(updateData)
    .eq('id', activity_id)
    .select('id, name, version')
    .single();

  if (updateError || !updatedActivity) {
    return errorResponse(500, `Failed to update activity: ${updateError?.message}`);
  }

  // Build response URLs
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const siteUrl = Deno.env.get('SITE_URL') || 'https://dopple-studio.pages.dev';

  return jsonResponse({
    id: updatedActivity.id,
    name: updatedActivity.name,
    version: updatedActivity.version,
    manifest_url: `${supabaseUrl}/functions/v1/get-manifest?id=${updatedActivity.id}`,
    qr_url: `${siteUrl}/qr/${updatedActivity.id}`,
  });
}
```

- [ ] **Step 2: Remove the placeholder handleFinalize**

Delete the placeholder function that was added in Task 2.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/deploy-activity/index.ts
git commit -m "feat: add Phase 2 (finalize) to deploy-activity edge function"
```

---

## Task 4: CLI Scaffold — Package Setup and Config Parser

**Files:**
- Create: `skills/dopple-deploy/scripts/dopple/package.json`
- Create: `skills/dopple-deploy/scripts/dopple/tsconfig.json`
- Create: `skills/dopple-deploy/scripts/dopple/config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@dopple/cli",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/cli.js",
  "bin": {
    "dopple": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.87.1",
    "smol-toml": "^1.3.1",
    "archiver": "^7.0.1"
  },
  "devDependencies": {
    "@types/archiver": "^6.0.3",
    "@types/node": "^24.10.1",
    "typescript": "~5.9.3"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create config.ts — dopple.toml parser**

```typescript
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';

export interface DoppleConfig {
  name: string;
  build_command?: string;
  build_output: string;
  entry_point: string;
  icon?: string;
  slack?: {
    channel?: string;
  };
}

export async function loadConfig(cwd: string = process.cwd()): Promise<DoppleConfig> {
  const configPath = resolve(cwd, 'dopple.toml');
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    throw new Error(`No dopple.toml found in ${cwd}. Run "dopple init" to create one.`);
  }

  const parsed = parseToml(raw) as Record<string, unknown>;

  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('dopple.toml: "name" is required');
  }
  if (!parsed.build_output || typeof parsed.build_output !== 'string') {
    throw new Error('dopple.toml: "build_output" is required');
  }
  if (!parsed.entry_point || typeof parsed.entry_point !== 'string') {
    throw new Error('dopple.toml: "entry_point" is required');
  }

  return {
    name: parsed.name as string,
    build_command: parsed.build_command as string | undefined,
    build_output: parsed.build_output as string,
    entry_point: parsed.entry_point as string,
    icon: parsed.icon as string | undefined,
    slack: parsed.slack as { channel?: string } | undefined,
  };
}
```

- [ ] **Step 4: Install dependencies**

```bash
cd skills/dopple-deploy/scripts/dopple && npm install
```

- [ ] **Step 5: Commit**

```bash
git add skills/dopple-deploy/scripts/dopple/package.json \
       skills/dopple-deploy/scripts/dopple/tsconfig.json \
       skills/dopple-deploy/scripts/dopple/config.ts \
       skills/dopple-deploy/scripts/dopple/package-lock.json
git commit -m "feat: scaffold dopple CLI with package setup and config parser"
```

---

## Task 5: CLI Auth Module

**Files:**
- Create: `skills/dopple-deploy/scripts/dopple/auth.ts`

- [ ] **Step 1: Write auth.ts**

Handles three auth strategies: `--token` flag, `DOPPLE_TOKEN` env var, `~/.dopple/auth.json` file with OAuth refresh.

```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:http';
import { createClient } from '@supabase/supabase-js';

const DOPPLE_DIR = join(homedir(), '.dopple');
const AUTH_FILE = join(DOPPLE_DIR, 'auth.json');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const CALLBACK_PORT = 8976;

interface AuthData {
  supabase_url: string;
  refresh_token: string;
  user_email: string;
}

// Priority: --token flag > DOPPLE_TOKEN env > ~/.dopple/auth.json
export async function resolveAuth(tokenFlag?: string): Promise<string> {
  if (tokenFlag) return tokenFlag;

  const envToken = process.env.DOPPLE_TOKEN;
  if (envToken) return envToken;

  return await refreshFromFile();
}

async function refreshFromFile(): Promise<string> {
  let authData: AuthData;
  try {
    const raw = await readFile(AUTH_FILE, 'utf-8');
    authData = JSON.parse(raw);
  } catch {
    throw new Error('Not authenticated. Run "dopple login" or set DOPPLE_TOKEN.');
  }

  const supabase = createClient(
    authData.supabase_url || SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: authData.refresh_token,
  });

  if (error || !data.session) {
    throw new Error('Session expired. Run "dopple login" to re-authenticate.');
  }

  authData.refresh_token = data.session.refresh_token;
  authData.user_email = data.session.user.email || authData.user_email;
  await saveAuth(authData);

  return data.session.access_token;
}

async function saveAuth(data: AuthData): Promise<void> {
  await mkdir(DOPPLE_DIR, { recursive: true, mode: 0o700 });
  await writeFile(AUTH_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export async function whoami(tokenFlag?: string): Promise<string> {
  const token = await resolveAuth(tokenFlag);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Invalid token');
  return user.email || user.id;
}

// OAuth browser login flow
export async function login(): Promise<void> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  return new Promise((resolvePromise, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${CALLBACK_PORT}`);

      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400);
          res.end('Missing code parameter');
          server.close();
          reject(new Error('OAuth callback missing code'));
          return;
        }

        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.session) throw error || new Error('No session');

          await saveAuth({
            supabase_url: SUPABASE_URL,
            refresh_token: data.session.refresh_token,
            user_email: data.session.user.email || '',
          });

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h1>Authenticated!</h1><p>You can close this tab.</p></body></html>');
          server.close();
          console.log(`Logged in as ${data.session.user.email}`);
          resolvePromise();
        } catch (err) {
          res.writeHead(500);
          res.end('Authentication failed');
          server.close();
          reject(err);
        }
      }
    });

    server.listen(CALLBACK_PORT, async () => {
      const redirectUrl = `http://localhost:${CALLBACK_PORT}/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });

      if (error || !data.url) {
        server.close();
        reject(new Error(`Failed to start OAuth: ${error?.message}`));
        return;
      }

      console.log(`\nOpen this URL to authenticate:\n${data.url}\n`);
      // Open browser using child_process.execFile (safe, no shell injection)
      const { execFile } = await import('node:child_process');
      const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      execFile(openCmd, [data.url], (err) => {
        if (err) console.log('Could not open browser automatically. Please open the URL above.');
      });
    });

    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 2 minutes'));
    }, 120_000);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/dopple-deploy/scripts/dopple/auth.ts
git commit -m "feat: add auth module with OAuth + token support"
```

---

## Task 6: CLI Build and Smoke Test Modules

**Files:**
- Create: `skills/dopple-deploy/scripts/dopple/build.ts`
- Create: `skills/dopple-deploy/scripts/dopple/smoke.ts`

- [ ] **Step 1: Write build.ts**

```typescript
import { execFileSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DoppleConfig } from './config.js';

export async function runBuild(config: DoppleConfig, cwd: string): Promise<void> {
  if (!config.build_command) {
    console.log('No build_command configured, skipping build.');
    return;
  }

  console.log(`Running: ${config.build_command}`);
  try {
    // Split command into program and args for execFileSync (no shell injection)
    const parts = config.build_command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    execFileSync(cmd, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch {
    throw new Error(`Build failed: ${config.build_command}`);
  }

  // Verify build output exists
  const outputPath = resolve(cwd, config.build_output);
  try {
    await access(outputPath);
  } catch {
    throw new Error(`Build output not found: ${outputPath}`);
  }
}
```

- [ ] **Step 2: Write smoke.ts**

```typescript
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import type { DoppleConfig } from './config.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

function startStaticServer(dir: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer(async (req, res) => {
      const urlPath = req.url === '/' ? '/index.html' : req.url || '/index.html';
      const filePath = join(dir, urlPath);
      try {
        const content = await readFile(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) {
        resolvePromise({ server, port: addr.port });
      } else {
        reject(new Error('Failed to start server'));
      }
    });
  });
}

export async function smokeTest(config: DoppleConfig, cwd: string): Promise<void> {
  const outputDir = resolve(cwd, config.build_output);
  const { server, port } = await startStaticServer(outputDir);

  try {
    // Dynamic import so Playwright is only needed when smoke test runs
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();

    const errors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.failure()?.errorText}: ${req.url()}`);
    });

    const url = `http://localhost:${port}/${config.entry_point}`;
    console.log(`Smoke testing: ${url}`);

    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 10_000,
    });

    await browser.close();

    if (!response || response.status() >= 400) {
      throw new Error(`Page returned status ${response?.status() || 'unknown'}`);
    }

    if (errors.length > 0) {
      throw new Error(`Console errors:\n${errors.map(e => `  - ${e}`).join('\n')}`);
    }

    if (failedRequests.length > 0) {
      throw new Error(`Failed requests:\n${failedRequests.map(r => `  - ${r}`).join('\n')}`);
    }

    console.log('Smoke test passed');
  } catch (err) {
    if ((err as Error).message?.includes("Cannot find module 'playwright'") ||
        (err as Error).message?.includes('Cannot find package')) {
      throw new Error(
        'Playwright not installed. Install it with "npm install -g playwright" ' +
        'or use --no-smoke to skip the smoke test.'
      );
    }
    throw err;
  } finally {
    server.close();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add skills/dopple-deploy/scripts/dopple/build.ts \
       skills/dopple-deploy/scripts/dopple/smoke.ts
git commit -m "feat: add build and smoke test modules"
```

---

## Task 7: CLI Deploy Module (Two-Phase Upload)

**Files:**
- Create: `skills/dopple-deploy/scripts/dopple/deploy.ts`

- [ ] **Step 1: Write deploy.ts**

```typescript
import { readFile, stat, unlink } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import archiver from 'archiver';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DoppleConfig } from './config.js';

export interface DeployResult {
  id: string;
  name: string;
  version: number;
  manifest_url: string;
  qr_url: string;
}

async function zipDirectory(dir: string): Promise<string> {
  const zipPath = join(tmpdir(), `dopple-${randomUUID()}.zip`);
  const output = createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = pipeline(archive, output);
  archive.directory(dir, false);
  await archive.finalize();
  await done;

  return zipPath;
}

export async function deploy(
  config: DoppleConfig,
  cwd: string,
  accessToken: string,
  supabaseUrl: string,
  nameOverride?: string,
): Promise<DeployResult> {
  const activityName = nameOverride || config.name;
  const outputDir = resolve(cwd, config.build_output);

  // ZIP the build output
  console.log('Packaging bundle...');
  const zipPath = await zipDirectory(outputDir);
  const zipData = await readFile(zipPath);
  const zipSize = (await stat(zipPath)).size;
  console.log(`Bundle size: ${(zipSize / 1024 / 1024).toFixed(1)}MB`);

  // Check for icon
  let hasIcon = false;
  let iconExtension = '';
  let iconData: Buffer | null = null;
  if (config.icon) {
    const iconPath = resolve(cwd, config.icon);
    try {
      iconData = await readFile(iconPath) as Buffer;
      hasIcon = true;
      iconExtension = extname(iconPath).slice(1).toLowerCase();
    } catch {
      console.warn(`Warning: icon file not found: ${config.icon}`);
    }
  }

  const endpoint = `${supabaseUrl}/functions/v1/deploy-activity`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // Phase 1: Initiate
  console.log(`Deploying "${activityName}"...`);
  const initResponse = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: activityName,
      entry_point: config.entry_point,
      has_icon: hasIcon,
      icon_extension: iconExtension,
    }),
  });

  if (!initResponse.ok) {
    const err = await initResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Deploy initiate failed: ${(err as { error: string }).error}`);
  }

  const initData = await initResponse.json();

  // Phase 2: Upload bundle to signed URL
  console.log('Uploading bundle...');
  const uploadResponse = await fetch(initData.bundle_upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip' },
    body: zipData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Bundle upload failed: ${uploadResponse.statusText}`);
  }

  // Upload icon if present
  if (hasIcon && iconData && initData.icon_upload_url) {
    console.log('Uploading icon...');
    const iconResponse = await fetch(initData.icon_upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': `image/${iconExtension}` },
      body: iconData,
    });

    if (!iconResponse.ok) {
      console.warn('Icon upload failed, continuing without icon.');
    }
  }

  // Phase 3: Finalize
  console.log('Finalizing...');
  const finalizeResponse = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'finalize',
      activity_id: initData.activity_id,
      entry_point: config.entry_point,
      icon_extension: hasIcon ? iconExtension : undefined,
    }),
  });

  if (!finalizeResponse.ok) {
    const err = await finalizeResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Deploy finalize failed: ${(err as { error: string }).error}`);
  }

  // Clean up temp zip
  await unlink(zipPath).catch(() => {});

  return await finalizeResponse.json() as DeployResult;
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/dopple-deploy/scripts/dopple/deploy.ts
git commit -m "feat: add two-phase deploy module with signed URL upload"
```

---

## Task 8: CLI Init Command

**Files:**
- Create: `skills/dopple-deploy/scripts/dopple/init.ts`

- [ ] **Step 1: Write init.ts**

```typescript
import { writeFile, access, readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';

export async function init(cwd: string): Promise<void> {
  const configPath = resolve(cwd, 'dopple.toml');

  // Check if already exists
  try {
    await access(configPath);
    console.error('dopple.toml already exists in this directory.');
    process.exit(1);
  } catch {
    // Expected — file doesn't exist yet
  }

  // Auto-detect project name from directory
  const projectName = basename(cwd).toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Auto-detect build system
  let buildCommand = '';
  let buildOutput = 'dist';

  try {
    const pkgRaw = await readFile(resolve(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw);
    if (pkg.scripts?.build) {
      buildCommand = 'npm run build';
    }
  } catch {
    // No package.json
  }

  // Check for index.html in root (static site)
  try {
    await access(resolve(cwd, 'index.html'));
    if (!buildCommand) {
      buildOutput = '.';
    }
  } catch {
    // No root index.html
  }

  const lines = [
    `name = "${projectName}"`,
  ];

  if (buildCommand) {
    lines.push(`build_command = "${buildCommand}"`);
  }

  lines.push(
    `build_output = "${buildOutput}"`,
    `entry_point = "index.html"`,
    `# icon = "./icon.png"`,
    '',
    '[slack]',
    'channel = "#qr-f3st-26"',
    '',
  );

  await writeFile(configPath, lines.join('\n'));
  console.log(`Created dopple.toml`);
  console.log(`  name: ${projectName}`);
  if (buildCommand) console.log(`  build: ${buildCommand}`);
  console.log(`  output: ${buildOutput}`);
  console.log(`  entry: index.html`);
  console.log(`\nEdit dopple.toml to customize, then run "dopple deploy".`);
}
```

- [ ] **Step 2: Commit**

```bash
git add skills/dopple-deploy/scripts/dopple/init.ts
git commit -m "feat: add dopple init command with build system auto-detection"
```

---

## Task 9: CLI Entry Point (Command Router)

**Files:**
- Create: `skills/dopple-deploy/scripts/dopple/cli.ts`

- [ ] **Step 1: Write cli.ts — the main entry point**

```typescript
#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { resolveAuth, login, whoami } from './auth.js';
import { runBuild } from './build.js';
import { smokeTest } from './smoke.js';
import { deploy } from './deploy.js';
import { init } from './init.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      as: { type: 'string' },
      token: { type: 'string' },
      'no-smoke': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  const command = positionals[0];

  if (values.help || !command) {
    console.log(`
dopple - Deploy activities to Dopple Studio

Commands:
  init              Create dopple.toml in the current directory
  login             Authenticate via browser OAuth
  whoami            Show current auth status
  deploy            Build, test, and deploy the activity

Deploy options:
  --as <name>       Deploy under a different activity name
  --token <token>   Use explicit auth token
  --no-smoke        Skip the Playwright smoke test
`);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'init':
        await init(process.cwd());
        break;

      case 'login':
        await login();
        break;

      case 'whoami': {
        const email = await whoami(values.token);
        console.log(`Authenticated as: ${email}`);
        break;
      }

      case 'deploy': {
        if (!SUPABASE_URL) {
          throw new Error(
            'SUPABASE_URL not set. Set VITE_SUPABASE_URL or SUPABASE_URL environment variable.'
          );
        }

        const config = await loadConfig(process.cwd());
        const accessToken = await resolveAuth(values.token);

        // Build
        await runBuild(config, process.cwd());

        // Smoke test
        if (!values['no-smoke']) {
          await smokeTest(config, process.cwd());
        } else {
          console.log('Skipping smoke test (--no-smoke)');
        }

        // Deploy
        const result = await deploy(
          config,
          process.cwd(),
          accessToken,
          SUPABASE_URL,
          values.as,
        );

        console.log('\nDeployed successfully!');
        console.log(`  Activity: ${result.name}`);
        console.log(`  Version:  ${result.version}`);
        console.log(`  Manifest: ${result.manifest_url}`);
        console.log(`  QR Page:  ${result.qr_url}`);

        // Machine-readable output for skill consumption
        console.log(`\n__DEPLOY_RESULT__${JSON.stringify(result)}`);
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Build the CLI**

```bash
cd skills/dopple-deploy/scripts/dopple && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add skills/dopple-deploy/scripts/dopple/cli.ts
git commit -m "feat: add CLI entry point with command routing"
```

---

## Task 10: Update SKILL.md with Final Invocation Details

**Files:**
- Modify: `skills/dopple-deploy/SKILL.md`

- [ ] **Step 1: Update SKILL.md**

Update the Skill Invocation section to include:
- Exact Bash invocation paths using `<skill-path>` variable
- The `__DEPLOY_RESULT__` JSON parsing pattern for extracting results
- Slack MCP detection (check for `slack_send_message` tool availability)
- Slack channel resolution from dopple.toml config

Key additions:

```markdown
## Skill Invocation

The CLI is at `scripts/dopple/dist/cli.js` relative to this skill's directory. Invoke via:

\`\`\`bash
export SUPABASE_URL="https://xxx.supabase.co"

# Check auth
node <skill-path>/scripts/dopple/dist/cli.js whoami --token "$DOPPLE_TOKEN"

# Deploy
node <skill-path>/scripts/dopple/dist/cli.js deploy --no-smoke --token "$DOPPLE_TOKEN"

# Deploy as variant
node <skill-path>/scripts/dopple/dist/cli.js deploy --as "variant-name" --no-smoke --token "$DOPPLE_TOKEN"
\`\`\`

## Parsing Results

The CLI outputs a machine-readable line:
`__DEPLOY_RESULT__{"id":"...","name":"...","version":3,"manifest_url":"...","qr_url":"..."}`

Parse this line to extract the deploy result for Slack posting.

## Slack Notification

Check if Slack MCP tools are available (look for `slack_send_message` in your tool list).

If available, read `dopple.toml` for the `[slack] channel` value (default: `#qr-f3st-26`), then post:
- Activity name, QR page URL, manifest API URL, deployer, version

If not available, present the URLs to the user for manual sharing.
```

- [ ] **Step 2: Commit**

```bash
git add skills/dopple-deploy/SKILL.md
git commit -m "feat: update SKILL.md with invocation details and Slack integration"
```

---

## Task 11: Integration Test — Config and Init

**Files:**
- Create: `skills/dopple-deploy/scripts/dopple/test-deploy.ts`

- [ ] **Step 1: Create a manual integration test script**

```typescript
#!/usr/bin/env node
// Manual integration test: creates a temp project and tests dopple init + config parsing

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from './config.js';
import { init } from './init.js';

async function test() {
  const testDir = await mkdtemp(join(tmpdir(), 'dopple-test-'));
  console.log(`Test directory: ${testDir}`);

  try {
    // Create a minimal project
    await writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'test-game',
      scripts: { build: 'echo built' },
    }));
    await writeFile(join(testDir, 'index.html'), '<html><body>test</body></html>');

    // Test init
    console.log('\n--- Testing dopple init ---');
    const origCwd = process.cwd();
    process.chdir(testDir);
    await init(testDir);

    // Test config loading
    console.log('\n--- Testing config loading ---');
    const config = await loadConfig(testDir);
    console.log('Loaded config:', config);

    // Validate
    if (!config.name) throw new Error('name missing');
    if (!config.build_output) throw new Error('build_output missing');
    if (!config.entry_point) throw new Error('entry_point missing');
    if (config.build_command !== 'npm run build') throw new Error('build_command wrong');

    process.chdir(origCwd);
    console.log('\nAll tests passed!');
  } finally {
    await rm(testDir, { recursive: true, force: true });
  }
}

test().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Build and run the test**

```bash
cd skills/dopple-deploy/scripts/dopple && npm run build && node dist/test-deploy.js
```
Expected: "All tests passed!"

- [ ] **Step 3: Commit**

```bash
git add skills/dopple-deploy/scripts/dopple/test-deploy.ts
git commit -m "test: add integration test for dopple init and config parsing"
```

---

## Summary

| Task | Component | Description |
|------|-----------|-------------|
| 1 | DB | Unique constraint migration |
| 2 | Edge Function | Phase 1 — initiate (upsert + signed URLs) |
| 3 | Edge Function | Phase 2 — finalize (validate + update) |
| 4 | CLI | Package scaffold + config parser |
| 5 | CLI | Auth module (OAuth + token) |
| 6 | CLI | Build + smoke test modules |
| 7 | CLI | Two-phase deploy module |
| 8 | CLI | Init command |
| 9 | CLI | Entry point / command router |
| 10 | Skill | Update SKILL.md with final details |
| 11 | Test | Integration test |

**Dependencies:**
- Tasks 1-3 (edge function + migration) are independent of Tasks 4-9 (CLI)
- Tasks 4-9 are sequential (each builds on previous)
- Task 10 depends on Task 9 (needs final CLI interface)
- Task 11 depends on Tasks 4, 8, 9
- Tasks 1-3 and 4-9 can be parallelized
