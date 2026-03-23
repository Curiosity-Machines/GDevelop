---
name: dopple-deploy
description: Deploy activities to Dopple Studio and notify the team. Use this skill when the user says "deploy", "publish", "push to studio", "deploy to dopple", "share QR code", or wants to make an activity available to teammates on Dopple devices. Also trigger when you see a dopple.toml file in the project and the user asks to ship, release, or share their work.
---

# Dopple Deploy

Deploy activities to Dopple Studio from the command line and optionally notify the team via Slack.

## How It Works

The developer's project has a `dopple.toml` at the root that defines the activity:

```toml
name = "my-game"
build_command = "npm run build"
build_output = "dist"
entry_point = "index.html"
icon = "./icon.png"
```

The `dopple` CLI handles the full deploy pipeline: build, smoke-test (headless Chromium validates the bundle loads), ZIP, upload to Supabase via a deploy edge function. The skill wraps this CLI and adds team notification.

## Setup

The `dopple` CLI is installed globally via `install.sh`. If `dopple` is not found, tell the user to install it:

```bash
curl -fsSL https://raw.githubusercontent.com/Curiosity-Machines/claude-skills/main/dopple-deploy/install.sh | bash
```

On first use in a project, run `dopple init` to create `dopple.toml`.

## Deploy Flow

1. **Check for `dopple.toml`** in the project root. If missing, tell the user and offer to run `dopple init` to create one.

2. **Verify the activity name** — read the `name` from `dopple.toml` and sanity-check it:
   - Compare against the git branch name (`git branch --show-current`) and the directory name
   - If the name looks auto-generated, branch-derived (e.g. `feature-xyz`, `main`, `dev`), or clearly wrong, flag it and ask the user to confirm or correct it before continuing
   - If the user specified `--as`, use that instead and skip this check
   - A good name is short, descriptive, and stable across deploys (e.g. `orbital-clock`, `physics-demo`)

3. **Gather version context** — collect recent commits to describe what's in this deploy:
   ```bash
   git log --oneline -5
   ```
   Summarize in one line what changed (e.g. "fixed collision, added sfx"). This becomes the version description in the Slack message.

4. **Check auth** — run `dopple whoami`. If not authenticated, run `dopple login`. It prints a URL — open it in any browser, sign in, then paste the code it shows back into the terminal. Credentials are cached at `~/.dopple/auth.json`.

5. **Run the deploy**:
   ```bash
   dopple deploy --no-smoke                        # Deploy as configured name
   dopple deploy --as "variant-name" --no-smoke    # Deploy under a different activity name
   ```
   Always use `--no-smoke` — Claude Code environments don't have Playwright.
   The CLI will:
   - Run the build command from `dopple.toml`
   - ZIP the output directory
   - POST to the deploy edge function (auth + bundle + metadata)
   - Return the manifest URL, QR code URL, and version number

6. **Report results** to the user: activity name, manifest URL, QR page URL, version number.

7. **Review and post to Slack** (if Slack MCP is available):
   - Compose the Slack message (see format below) including the version description from step 3
   - **Show the draft message to the user and ask for confirmation before posting**
   - Post only after the user approves — they may want to tweak the description
   - If Slack MCP is not available, give the user the URLs to paste wherever they want

## Slack Message Format

When posting to Slack, include:

- Activity name (and variant name if `--as` was used)
- Version number and a one-line description of what changed
- QR code page URL (the `/qr/:id` public page — scannable directly from Slack on mobile)
- Manifest API URL (for programmatic access)
- Who deployed (from `dopple whoami`)

Example message:
```
🎮 Activity Deployed: orbital-clock v4
What's new: fixed collision detection, added countdown sfx
QR: https://studio.dopple.dev/qr/abc-123
API: https://xxx.supabase.co/functions/v1/get-manifest?id=abc-123
By: mike@team.com
```

Always show this draft to the user before posting — they may want to edit the "What's new" line.

## The `--as` Flag

When the user wants to publish the same build under a different name (for side-by-side comparison of branches, experiments, etc.), use `--as`:

```bash
dopple deploy --as "my-game-experimental"
```

This creates a separate activity in Studio with its own QR code. The original activity is untouched. Useful for:
- Testing a feature branch alongside production
- Sharing an experimental build without overwriting the main one
- A/B testing different versions on devices

## Error Handling

- **Build fails**: Show the build error output. Don't proceed to deploy.
- **Smoke test fails**: Show what went wrong (console errors, page didn't load). Don't proceed.
- **Auth expired**: Run `dopple login` to re-authenticate.
- **Deploy API error**: Show the server error. Common issues: name conflict, bundle too large.
- **Slack fails**: Deploy still succeeded — report success and note Slack notification failed separately.

## Configuration

### dopple.toml (per-project)
```toml
name = "my-game"              # Activity name (required)
build_command = "npm run build" # Build command (optional — skip if pre-built)
build_output = "dist"          # Output directory (required)
entry_point = "index.html"     # Entry point in output (required)
icon = "./icon.png"            # Icon path or URL (optional)
[slack]
channel = "#qr-f3st-26"    # Slack channel for deploy notifications (optional)
```

### ~/.dopple/auth.json (global, managed by `dopple login`)
```json
{
  "refresh_token": "..."
}
```

### Slack

No configuration needed. The skill detects Slack MCP in the Claude Code/Codex session automatically. If connected, it posts to the channel specified in `dopple.toml` (or asks the user which channel). If not connected, it returns the URLs for the user to share manually.

## Skill Invocation

Use the globally installed `dopple` command:

```bash
# Check auth
dopple whoami

# Deploy (skip smoke test — Claude Code environments lack Playwright)
dopple deploy --no-smoke

# Deploy as variant
dopple deploy --as "variant-name" --no-smoke

# Initialize a new project
dopple init
```

Auth is resolved automatically from `~/.dopple/auth.json` (written by `dopple login`). No env vars needed.

## Parsing Deploy Results

The CLI outputs a machine-readable line after human-readable output:

```
__DEPLOY_RESULT__{"id":"uuid","name":"my-game","version":3,"manifest_url":"https://...","qr_url":"https://...","qr_image_url":"https://...supabase.co/storage/v1/object/public/activity-bundles/.../qr.png"}
```

Parse this line from the Bash output to extract deploy results for Slack posting.

`qr_image_url` is a public 512px PNG hosted in Supabase storage, encoding the manifest URL. Post this URL directly in Slack — Slack renders `.png` URLs inline so the QR is visible without clicking.

## Slack Notification Logic

1. Check if `slack_send_message` tool is available (Slack MCP connected)
2. If available:
   - Read `dopple.toml` for `[slack] channel` (default: `#qr-f3st-26`)
   - Compose the message using the format above
   - **Show the draft to the user and wait for approval**
   - Post once approved
3. If not available:
   - Present the URLs to the user for manual sharing
