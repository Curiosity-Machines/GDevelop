#!/usr/bin/env bash
(
set -euo pipefail

SCOPE="@curiosity-machines"
PACKAGE="$SCOPE/dopple-cli"
REGISTRY="https://npm.pkg.github.com"

echo "Installing dopple CLI..."

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
echo "  Node.js $(node -v) ✓"

# Check GitHub CLI
if ! command -v gh &>/dev/null; then
  echo "Error: GitHub CLI (gh) is required. Install it from https://cli.github.com" >&2
  exit 1
fi
if ! gh auth status &>/dev/null; then
  echo "Error: Not authenticated with GitHub. Run 'gh auth login' first." >&2
  exit 1
fi
echo "  GitHub CLI ✓"

# Check token has read:packages scope
echo "  Checking GitHub token scopes..."
TOKEN_SCOPES=$(gh auth status 2>&1 | grep "Token scopes" || true)
if ! echo "$TOKEN_SCOPES" | grep -q "read:packages"; then
  echo "  Token missing read:packages scope. Requesting..."
  gh auth refresh -s read:packages
  echo "  Scope added ✓"
fi
echo "  Token scopes ✓"

# Configure npm for GitHub Packages
echo "  Configuring npm registry..."
GH_TOKEN=$(gh auth token)
npm config set "$SCOPE:registry" "$REGISTRY"
npm config set "${REGISTRY#https:}/:_authToken" "$GH_TOKEN"
echo "  Registry configured ✓"

# Install CLI
echo "  Installing $PACKAGE..."
npm install -g "$PACKAGE"
echo "  CLI installed ✓"

# Install skill for Claude Code
REPO="Curiosity-Machines/claude-skills"
SKILL_DIR="$HOME/.claude/commands"
mkdir -p "$SKILL_DIR"
gh api "repos/$REPO/contents/dopple-deploy/SKILL.md" --jq .content | base64 -d > "$SKILL_DIR/dopple-deploy.md"
echo "  Skill installed to ~/.claude/commands/dopple-deploy.md ✓"

echo ""
echo "Done! Run 'dopple login' to authenticate with Dopple Studio."
echo "In Claude Code, type /dopple-deploy to use the skill."
)
