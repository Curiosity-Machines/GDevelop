#!/usr/bin/env bash
# Dopple Deploy installer — downloads CLI + skill from signed URLs.
# Called via: bash <(curl -sL "<installer-url>") --skill-url="..." --cli-url="..."
(
set -euo pipefail

SKILL_URL=""
CLI_URL=""

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --skill-url=*) SKILL_URL="${arg#--skill-url=}" ;;
    --cli-url=*)   CLI_URL="${arg#--cli-url=}" ;;
  esac
done

if [ -z "$SKILL_URL" ] || [ -z "$CLI_URL" ]; then
  echo "Error: --skill-url and --cli-url are required" >&2
  exit 1
fi

echo "Installing dopple-deploy..."

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required. Install it from https://nodejs.org" >&2
  exit 1
fi
NODE_VERSION=$(node -v | cut -d. -f1 | tr -d v)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Error: Node.js 18+ required (found $(node -v))" >&2
  exit 1
fi

# Download skill
SKILL_DIR="$HOME/.claude/commands"
mkdir -p "$SKILL_DIR"
curl -sL "$SKILL_URL" -o "$SKILL_DIR/dopple-deploy.md"
echo "  ~/.claude/commands/dopple-deploy.md ✓"

# Download CLI
CLI_DIR="$HOME/.dopple"
mkdir -p "$CLI_DIR"
curl -sL "$CLI_URL" -o "$CLI_DIR/cli.cjs"
chmod +x "$CLI_DIR/cli.cjs"
echo "  ~/.dopple/cli.cjs ✓"

# Set up shell alias if not already present
SHELL_RC=""
if [ -n "${ZSH_VERSION:-}" ] || [ "$(basename "$SHELL" 2>/dev/null)" = "zsh" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -n "${BASH_VERSION:-}" ] || [ "$(basename "$SHELL" 2>/dev/null)" = "bash" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
  if ! grep -q 'alias dopple=' "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo '# Dopple CLI' >> "$SHELL_RC"
    echo 'alias dopple="node ~/.dopple/cli.cjs"' >> "$SHELL_RC"
  fi
fi

# Show version
CLI_VERSION=$(node "$CLI_DIR/cli.cjs" version 2>/dev/null | sed 's/dopple //' || echo "unknown")
echo ""
echo "Done! Dopple Deploy $CLI_VERSION installed."

# Check auth status
if [ -f "$HOME/.dopple/auth.json" ]; then
  HAS_TOKEN=$(node -e "try{const j=require('$HOME/.dopple/auth.json');console.log(j.refresh_token?'yes':'no')}catch{console.log('no')}" 2>/dev/null || echo "no")
  if [ "$HAS_TOKEN" = "yes" ]; then
    echo "Auth tokens found — you're ready to deploy."
  else
    echo "Run 'dopple login' to authenticate with Dopple Studio."
  fi
else
  echo "Run 'dopple login' to authenticate with Dopple Studio."
fi

echo "In Claude Code, type /dopple-deploy to use the skill."
if [ -n "$SHELL_RC" ]; then
  echo "Open a new terminal for the dopple alias to take effect."
fi
)
