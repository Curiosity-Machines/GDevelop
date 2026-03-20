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

The CLI is bundled with this skill at `scripts/dopple`. No separate installation needed — the skill invokes it directly:

```bash
node <skill-path>/scripts/dopple <command>
```

On first use in a project, run `dopple init` to create `dopple.toml`.

## Deploy Flow

1. **Check for `dopple.toml`** in the project root. If missing, tell the user and offer to run `dopple init` to create one.

2. **Check auth** — run `dopple whoami`. If not authenticated, run `dopple login` which opens a browser for Supabase OAuth. Credentials are cached at `~/.dopple/auth.json`.

3. **Run the deploy**:
   ```bash
   dopple deploy                        # Deploy as configured name
   dopple deploy --as "variant-name"    # Deploy under a different activity name
   ```
   The CLI will:
   - Run the build command from `dopple.toml`
   - Serve the build output locally and smoke-test with headless Chromium
   - ZIP the output directory
   - POST to the deploy edge function (auth + bundle + metadata)
   - Return the manifest URL and QR code URL

4. **Report results** to the user: activity name, manifest URL, QR page URL, version number.

5. **Post to Slack** (if available):
   - If Slack MCP is connected in the session, post a message with the QR page URL and manifest link to the configured channel
   - If Slack MCP is not available, give the user the URLs to paste wherever they want

## Slack Message Format

When posting to Slack, include:

- Activity name (and variant name if `--as` was used)
- QR code page URL (the `/qr/:id` public page — scannable directly from Slack on mobile)
- Manifest API URL (for programmatic access)
- Who deployed (from auth)
- Version number

Example message:
```
🎮 Activity Deployed: my-game
QR: https://studio.dopple.dev/qr/abc-123
API: https://xxx.supabase.co/functions/v1/get-manifest?id=abc-123
By: mike@team.com | v3
```

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
  "supabase_url": "https://xxx.supabase.co",
  "refresh_token": "...",
  "user_email": "mike@team.com"
}
```

### Slack

No configuration needed. The skill detects Slack MCP in the Claude Code/Codex session automatically. If connected, it posts to the channel specified in `dopple.toml` (or asks the user which channel). If not connected, it returns the URLs for the user to share manually.
