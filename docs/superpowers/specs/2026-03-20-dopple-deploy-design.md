# Dopple Deploy: CLI + Skill for Activity Publishing

**Date**: 2026-03-20
**Status**: Draft
**Author**: studio/crew/resnick

## Problem

Developers building activities for Dopple devices must currently use the Studio web UI to publish — fill out a form, upload a ZIP, copy the QR code URL, and manually share it with the team. This friction slows rapid iteration, especially when testing multiple variants or branches.

## Solution

A Wrangler-style CLI (`dopple`) bundled inside a Claude Code/Codex skill that lets developers deploy activities from the command line. Deploy posts a QR code to Slack (via MCP) so teammates can immediately load the latest version on a device.

## Architecture

```
Developer's Project           Skill (published to claude-skills)      Supabase
┌─────────────┐              ┌───────────────────────┐               ┌────────────────┐
│ dopple.toml  │              │ SKILL.md               │               │ deploy-activity │
│ src/         │──dopple────→│ scripts/dopple/         │──────────────→│ edge function   │
│ dist/        │  deploy     │   ├── cli.ts            │               │                │
└─────────────┘              │   ├── auth.ts           │  1. POST meta │  ├── upsert    │
                             │   ├── build.ts          │  ←── signed URL│  ├── validate  │
                             │   ├── smoke.ts          │  2. PUT bundle │  │             │
                             │   └── upload.ts         │  ──→ Storage   │  └── finalize  │
                             └───────────────────────┘  3. POST finalize│               │
                                     │                  ←── URLs+version└────────────────┘
                                     │
                                     │ Slack MCP (if available)
                                     ▼
                               ┌──────────┐
                               │ #channel │
                               └──────────┘
```

### Components

| Component | Location | Language | Responsibility |
|-----------|----------|----------|----------------|
| CLI (`dopple`) | `skills/dopple-deploy/scripts/` | Node/TypeScript | Auth, build, smoke-test, ZIP, upload to Storage via signed URL |
| Deploy edge function | `supabase/functions/deploy-activity/` | Deno/TypeScript | Upsert activity, issue signed upload URLs, validate uploaded bundle, return manifest URLs |
| Skill | `skills/dopple-deploy/SKILL.md` + published to `Curiosity-Machines/claude-skills` | Markdown | Orchestrate CLI + Slack notification from Claude Code/Codex |

### Boundary Responsibilities

| Concern | Owner | Rationale |
|---------|-------|-----------|
| Auth (OAuth + token) | CLI | Developer's local credential |
| Build execution | CLI | Runs in developer's environment with their toolchain |
| Smoke test (headless Chromium) | CLI | Needs local filesystem; optional via `--no-smoke` |
| Bundle upload (large file) | CLI → Supabase Storage | Direct upload via signed URL avoids edge function size limits |
| Bundle validation (structure) | Edge function | Authoritative gate, validates after upload to Storage |
| Activity upsert + metadata | Edge function | Server-side, user-scoped Supabase client (not service role) |
| Slack notification | Skill | Uses session's Slack MCP; graceful fallback to URLs if unavailable |

## Database Migration

A uniqueness constraint is required for the upsert-by-name pattern:

```sql
-- Migration: add_unique_user_activity_name.sql
CREATE UNIQUE INDEX activities_user_id_name_idx ON activities(user_id, name);
```

This ensures `(user_id, name)` is unique, preventing duplicate activities and making upsert unambiguous. The existing web UI does not enforce this — any pre-existing duplicates must be resolved before applying the migration.

## CLI Design

### Prerequisites

- **Node.js** 18+ (for the CLI itself)
- **Playwright + Chromium** (for smoke tests — optional, skip with `--no-smoke`)

### Commands

```bash
dopple init                      # Create dopple.toml (auto-detects build system)
dopple login                     # Browser OAuth → ~/.dopple/auth.json
dopple whoami                    # Show auth status
dopple deploy                    # Build → smoke-test → ZIP → upload
dopple deploy --as "name"        # Deploy under a different activity name
dopple deploy --no-smoke         # Skip smoke test (for headless environments)
```

### Configuration: `dopple.toml`

One file per project, one activity per file. Lives at the project root.

```toml
name = "my-game"                  # Activity name (required)
build_command = "npm run build"   # Build step (optional — omit if pre-built)
build_output = "dist"             # Output directory (required)
entry_point = "index.html"        # HTML entry point within output (required)
icon = "./icon.png"               # Local path or URL (optional)

[slack]
channel = "#qr-f3st-26"          # Slack channel for deploy notifications (optional)
```

### `dopple init`

Creates `dopple.toml` interactively. Auto-detects the build system:
- Looks for `package.json` → suggests `npm run build` and `dist`
- Looks for `vite.config.*` → suggests `npm run build` and `dist`
- Looks for `index.html` in root → suggests no build command, `.` as output
- Prompts for: name, entry point, icon path
- Defaults Slack channel to `#qr-f3st-26`

### Auth

Two authentication paths:

**1. Browser OAuth (interactive CLI use)**
1. `dopple login` starts a local HTTP server on `localhost:8976`
2. Opens the browser to Studio's Supabase OAuth page with a redirect to the local server
3. User authenticates (GitHub, Google, or email)
4. Supabase redirects back with session tokens
5. CLI captures the session, stores refresh token in `~/.dopple/auth.json` (mode 0600)
6. Subsequent commands refresh the access token automatically

**2. Token auth (headless / Claude Code / Codex / CI)**
- Set `DOPPLE_TOKEN` env var with a Supabase access token
- Or pass `--token <token>` flag
- Token can be generated in Studio web UI (future: add a "Generate API Token" page)
- This is the primary path for the Claude Code/Codex skill

Priority: `--token` flag > `DOPPLE_TOKEN` env var > `~/.dopple/auth.json`

### Auth file: `~/.dopple/auth.json`

Global, one login works across all projects. Created with mode 0600.

```json
{
  "supabase_url": "https://xxx.supabase.co",
  "refresh_token": "...",
  "user_email": "mike@team.com"
}
```

### Deploy Pipeline

```
dopple deploy [--as "variant-name"] [--no-smoke]
       │
       ▼
  Read dopple.toml
       │
       ▼
  Resolve auth (token > env > auth.json, refresh if needed)
       │
       ▼
  Run build_command (if configured)
       │
       ▼
  Smoke test ─── FAIL → show errors, abort
       │           (skipped if --no-smoke)
      PASS
       │
       ▼
  ZIP build_output directory
       │
       ▼
  Step 1: POST metadata to deploy-activity edge function
          → receives: activity ID, signed upload URLs (bundle + icon)
       │
       ▼
  Step 2: PUT ZIP directly to Supabase Storage via signed URL
          PUT icon to Storage via signed URL (if icon provided)
       │
       ▼
  Step 3: POST to deploy-activity/finalize
          → edge function validates uploaded bundle, updates activity record
          → returns: manifest URL, QR page URL, version
       │
       ▼
  Print results:
    - Activity name (+ variant if --as)
    - Manifest URL
    - QR page URL
    - Version number
```

### Smoke Test

Validates the bundle actually loads in a browser before deploying. Skippable with `--no-smoke` for environments without Playwright/Chromium (headless servers, CI, Claude Code sandbox).

1. Start a local static file server on a random port serving `build_output/`
2. Launch headless Chromium via Playwright
3. Navigate to `http://localhost:{port}/{entry_point}`
4. Wait for network idle (no pending requests for 500ms), timeout after 10 seconds
5. Collect console output — check for uncaught exceptions and 404s on scripts/stylesheets
6. **Pass**: page loaded, no fatal errors → proceed to ZIP and deploy
7. **Fail**: show console errors and failed network requests → abort with clear message

### The `--as` Flag

Publishes the same build under a different activity name, creating a separate activity in Studio with its own QR code. The original activity is untouched.

Use cases:
- Side-by-side comparison of feature branches on devices
- Sharing an experimental build without overwriting the main version
- A/B testing different builds

```bash
# On main branch
dopple deploy                          # publishes "my-game"

# On feature branch
dopple deploy --as "my-game-particles" # publishes separate activity
```

## Deploy Edge Function

### Overview

Two-phase deploy avoids funneling large bundles through the edge function (which has body size limits). The edge function handles metadata and validation; the CLI uploads files directly to Storage.

### Phase 1: Initiate — `POST /deploy-activity`

**Request** (JSON):
```json
{
  "name": "my-game",
  "entry_point": "index.html",
  "has_icon": true,
  "icon_extension": "png"
}
```

**Server logic**:
1. Create a user-scoped Supabase client using the `Authorization` header JWT (not service role key)
2. Upsert: query for existing activity with matching `name` for `auth.uid()`
   - If exists: use existing activity ID
   - If not exists: insert new activity row, get generated ID
3. Generate signed upload URLs for:
   - `activity-bundles/{user_id}/{activity_id}/bundle.zip`
   - `activity-bundles/{user_id}/{activity_id}/icon.{ext}` (if `has_icon`)
4. Return activity ID + signed URLs

**Response**:
```json
{
  "activity_id": "uuid",
  "bundle_upload_url": "https://xxx.supabase.co/storage/v1/upload/sign/...",
  "icon_upload_url": "https://xxx.supabase.co/storage/v1/upload/sign/..."
}
```

### Phase 2: Finalize — `POST /deploy-activity/finalize`

Called after the CLI has uploaded the bundle (and icon) to Storage.

**Request** (JSON):
```json
{
  "activity_id": "uuid",
  "entry_point": "index.html"
}
```

**Server logic**:
1. Create a user-scoped Supabase client (same as Phase 1)
2. Download the uploaded ZIP from Storage
3. Validate:
   - ZIP is well-formed and extractable
   - `entry_point` exists within the ZIP
   - Entry point has `.html` extension
   - Total bundle size within limit (50MB)
   - Icon is a valid image format if uploaded (BMP, JPG, JPEG, PNG, PSD, TGA, TIFF, TIF)
4. If validation fails: delete the uploaded files from Storage, return 400 with error
5. If validation passes: update activity record with `bundle_path`, `entry_point`, `icon_url`, bump `updated_at` (version auto-increments via existing DB trigger)
6. Construct response URLs using `SITE_URL` env var (same as `get-manifest` function)

**Response**:
```json
{
  "id": "activity-uuid",
  "name": "my-game",
  "version": 3,
  "manifest_url": "https://xxx.supabase.co/functions/v1/get-manifest?id=...",
  "qr_url": "{SITE_URL}/qr/{activity-uuid}"
}
```

### Partial Failure Handling

| Failure point | Recovery |
|---------------|----------|
| Phase 1 fails (upsert) | Nothing uploaded yet, no cleanup needed |
| Upload to Storage fails | Activity row exists but has stale/no bundle. CLI reports error. Next deploy overwrites. |
| Phase 2 validation fails | Edge function deletes the uploaded files. Activity row is unchanged (if update) or has no bundle_path (if new). |
| Phase 2 DB update fails | Uploaded files exist in Storage but activity record not updated. Next deploy overwrites. |

The system is eventually consistent — a failed deploy leaves the activity in its previous state (for updates) or in an incomplete state (for new activities). The next successful deploy fixes everything.

### Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Validation failed (missing entry point, bad ZIP, invalid icon) |
| 401 | Invalid or expired auth token |
| 404 | Activity not found (finalize with bad ID) |
| 413 | Bundle exceeds 50MB size limit |
| 500 | Server error during upsert or storage |

All errors return `{ "error": "description" }`.

## Skill Design

### Trigger

The skill activates when the user says: "deploy", "publish", "push to studio", "deploy to dopple", "ship it", "share QR code", or similar.

### Flow

1. Check for `dopple.toml` in the project root — if missing, offer to run `dopple init`
2. Check auth via `dopple whoami` — if not authenticated, guide user through `dopple login` or `DOPPLE_TOKEN` setup
3. Run `dopple deploy --no-smoke` (with `--as` if the user specified a variant name)
   - Skill defaults to `--no-smoke` since Claude Code/Codex environments typically lack Playwright
4. Report results to the user (name, URLs, version)
5. If Slack MCP is available in the session:
   - Post to the channel from `dopple.toml [slack]` or ask the user which channel
   - Message includes: activity name, QR page URL, manifest URL, deployer, version
6. If Slack MCP is not available:
   - Give the user the URLs to share manually

### Skill Invocation

The skill invokes the CLI via Bash:

```bash
# Check auth
node <skill-path>/scripts/dopple/cli.js whoami

# Deploy
node <skill-path>/scripts/dopple/cli.js deploy --no-smoke

# Deploy as variant
node <skill-path>/scripts/dopple/cli.js deploy --as "physics-test" --no-smoke
```

### Slack Message Format

```
🎮 Activity Deployed: my-game
QR: https://studio.dopple.dev/qr/abc-123
API: https://xxx.supabase.co/functions/v1/get-manifest?id=abc-123
By: mike@team.com | v3
```

### Error Handling

| Error | Skill behavior |
|-------|---------------|
| No `dopple.toml` | Offer to create one via `dopple init` |
| Not authenticated | Guide through `dopple login` or `DOPPLE_TOKEN` |
| Build fails | Show build errors, don't deploy |
| Smoke test fails | Show console errors, don't deploy |
| Deploy API error | Show server error message |
| Slack MCP unavailable | Return URLs for manual sharing |
| Slack post fails | Report deploy succeeded, note Slack failed separately |

## Publishing

- **CLI + Skill**: Published to `Curiosity-Machines/claude-skills` repo
- **Edge function**: Deployed via `supabase functions deploy deploy-activity` from this repo
- **Skill structure**:
  ```
  dopple-deploy/
  ├── SKILL.md
  ├── scripts/
  │   └── dopple/        # Bundled CLI
  │       ├── cli.ts     # Entry point, command routing
  │       ├── auth.ts    # OAuth flow, token management
  │       ├── build.ts   # Build execution
  │       ├── smoke.ts   # Playwright smoke test
  │       ├── upload.ts  # Signed URL upload to Storage
  │       └── package.json
  └── evals/
      └── evals.json
  ```

## Migration Summary

| Change | Type | File |
|--------|------|------|
| Unique constraint on `(user_id, name)` | SQL migration | `supabase/migrations/YYYYMMDD_add_unique_activity_name.sql` |
| Deploy edge function | New edge function | `supabase/functions/deploy-activity/index.ts` |
| CLI tool | New | `skills/dopple-deploy/scripts/dopple/` |
| Skill definition | New | `skills/dopple-deploy/SKILL.md` |

No changes to existing tables, RLS policies, storage buckets, or edge functions. The existing `version` auto-increment trigger handles versioning automatically.

## Open Questions

1. **Bundle size limit**: 50MB reasonable? The existing web UI has no enforced limit.
2. **Smoke test timeout**: 10 seconds — is that enough for heavier activities?
3. **`dopple dev`**: Local preview mode (serve + QR pointing at local server) is a natural extension but out of scope for v1.
4. **API token generation**: Studio web UI currently has no "Generate API Token" page. Needed for headless auth. Could also use Supabase's built-in token refresh as a workaround initially.
