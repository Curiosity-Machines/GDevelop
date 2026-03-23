#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/.dopple/cli"

echo "Installing dopple CLI..."

if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required. Install it from https://nodejs.org" >&2
  exit 1
fi

NODE_VERSION=$(node -v | cut -d. -f1 | tr -d v)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Error: Node.js 18+ required (found $(node -v))" >&2
  exit 1
fi

# Fetch source
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
curl -sL https://github.com/Curiosity-Machines/claude-skills/archive/refs/heads/main.tar.gz \
  | tar xz --strip-components=3 claude-skills-main/dopple-deploy/scripts/dopple

# Build
npm install --silent
npm run build --silent

# Link
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/dist/cli.js" "$HOME/.local/bin/dopple"

if echo "$PATH" | tr ':' '\n' | grep -qE "(\.local/bin|\.dopple)"; then
  echo "Done! Run 'dopple login' to authenticate."
else
  echo "Done! Add ~/.local/bin to your PATH:"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi
