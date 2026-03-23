#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="$HOME/.dopple/cli"
REPO_URL="https://github.com/Curiosity-Machines/claude-skills/archive/refs/heads/main.tar.gz"

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

# Fetch source
echo "  Downloading from GitHub..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

curl -fSL "$REPO_URL" -o /tmp/dopple-cli.tar.gz
if [ ! -s /tmp/dopple-cli.tar.gz ]; then
  echo "Error: Download failed — empty file" >&2
  exit 1
fi
echo "  Downloaded $(wc -c < /tmp/dopple-cli.tar.gz | tr -d ' ') bytes ✓"

echo "  Extracting..."
tar xzf /tmp/dopple-cli.tar.gz --strip-components=3 claude-skills-main/dopple-deploy/scripts/dopple
rm /tmp/dopple-cli.tar.gz

if [ ! -f package.json ]; then
  echo "Error: Extraction failed — package.json not found in $INSTALL_DIR" >&2
  echo "  Contents: $(ls -A)" >&2
  exit 1
fi
echo "  Extracted ✓"

# Build
echo "  Installing dependencies..."
npm install --silent
echo "  Building..."
npm run build --silent

if [ ! -f dist/cli.js ]; then
  echo "Error: Build failed — dist/cli.js not found" >&2
  exit 1
fi
echo "  Built ✓"

# Link
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/dist/cli.js" "$HOME/.local/bin/dopple"
echo "  Linked to ~/.local/bin/dopple ✓"

if ! echo "$PATH" | tr ':' '\n' | grep -qE "\.local/bin"; then
  LINE='export PATH="$HOME/.local/bin:$PATH"'
  for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
    if [ -f "$rc" ] && ! grep -qF '.local/bin' "$rc"; then
      echo "$LINE" >> "$rc"
      echo "  Added ~/.local/bin to PATH in $(basename "$rc") ✓"
    fi
  done
  export PATH="$HOME/.local/bin:$PATH"
fi

echo ""
echo "Done! Run 'dopple login' to authenticate."
