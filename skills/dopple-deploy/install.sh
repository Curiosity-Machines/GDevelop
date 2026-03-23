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

# Configure GitHub Packages auth
if ! command -v gh &>/dev/null; then
  echo "Error: GitHub CLI (gh) is required. Install it from https://cli.github.com" >&2
  exit 1
fi
if ! gh auth status &>/dev/null; then
  echo "Error: Not authenticated with GitHub. Run 'gh auth login' first." >&2
  exit 1
fi
echo "  GitHub CLI ✓"

echo "  Configuring npm for GitHub Packages..."
GH_TOKEN=$(gh auth token)
npm config set "$SCOPE:registry" "$REGISTRY"
npm config set "$REGISTRY/:_authToken" "$GH_TOKEN"
echo "  Registry configured ✓"

# Install
echo "  Installing $PACKAGE..."
npm install -g "$PACKAGE"
echo "  Installed ✓"

echo ""
echo "Done! Run 'dopple login' to authenticate."
)
