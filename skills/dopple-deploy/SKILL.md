---
name: dopple-deploy
description: Deploy activities to Dopple Studio and notify the team. Use this skill when the user says "deploy", "publish", "push to studio", "deploy to dopple", "share QR code", or wants to make an activity available to teammates on Dopple devices. Also trigger when you see a dopple.toml file in the project and the user asks to ship, release, or share their work.
---

# Dopple Deploy

Deploy activities to Dopple Studio from the command line and optionally notify the team via Slack.

## How It Works

The developer's project has a `dopple.toml` at the root that defines the activity:

```toml
name = "Orbital Clock"
description = "A real-time clock with orbital planet rings and a countdown timer."
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

2. **Verify the activity name and description** — read `dopple.toml` and check both fields:
   - **Name**: compare against git branch and directory name. If it looks auto-generated, branch-derived (`feature-xyz`, `main`, `dev`), or like a slug, flag it. A good name is human-readable and title-cased: `Orbital Clock`, `Physics Demo`. If `--as` was specified, use that instead.
   - **Description**: if missing from `dopple.toml`, suggest one based on the README first line, `package.json` description field, or recent git history — and ask the user to confirm or edit it. Keep it to 1–2 sentences. This gets stored in Studio and shown in Slack.

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
   **Always pass `--no-smoke`** — Claude Code environments don't have Playwright installed. Omitting it will hang waiting for a headless browser that isn't there.
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

Compose the message as a single string with `\n` between lines. **Do not wrap URLs in `<>` angle brackets** — Slack auto-links bare URLs and angle brackets cause line-break parsing bugs. Use plain text for the email/name to avoid `mailto:` auto-linking.

```
🎮 Orbital Clock v4
A real-time clock with orbital planet rings and a countdown timer.
What's new: fixed collision detection, added countdown sfx
QR: {qr_url from __DEPLOY_RESULT__}
API: {manifest_url from __DEPLOY_RESULT__}
By: mike (michael@dopple.com)
```

Use the URLs verbatim from the `__DEPLOY_RESULT__` JSON — never construct them manually. The backend returns the correct studio domain.

If `qr_image_url` is present in the deploy result, post it as a second message immediately after — Slack renders `.png` URLs inline:
```
{qr_image_url from __DEPLOY_RESULT__}
```

Always show both the message draft and the image URL to the user for approval before posting.

## The `--as` Flag

When the user wants to publish the same build under a different name (for side-by-side comparison of branches, experiments, etc.), use `--as`:

```bash
dopple deploy --as "my-game-experimental" --no-smoke
```

> The flag is `--as`, not `--name`. Using `--name` will error.

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
name = "Orbital Clock"        # Human-readable display name (required)
description = "A real-time clock with orbital rings."  # Shown in Studio + Slack (optional but encouraged)
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
