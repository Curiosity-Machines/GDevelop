#!/usr/bin/env bash
(
set -euo pipefail

INSTALL_DIR="$HOME/.dopple/cli"
REPO="Curiosity-Machines/claude-skills"

echo "Installing dopple CLI..."

# Check prerequisites
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

if ! command -v gh &>/dev/null; then
  echo "Error: GitHub CLI (gh) is required. Install it from https://cli.github.com" >&2
  exit 1
fi
if ! gh auth status &>/dev/null; then
  echo "Error: Not authenticated with GitHub. Run 'gh auth login' first." >&2
  exit 1
fi
echo "  GitHub CLI ✓"

# Fetch source
echo "  Downloading from $REPO..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

gh api "repos/$REPO/tarball/main" > /tmp/dopple-cli.tar.gz
if [ ! -s /tmp/dopple-cli.tar.gz ]; then
  echo "Error: Download failed — empty file" >&2
  exit 1
fi
echo "  Downloaded $(wc -c < /tmp/dopple-cli.tar.gz | tr -d ' ') bytes ✓"

echo "  Extracting..."
cd "$INSTALL_DIR"
tar xzf /tmp/dopple-cli.tar.gz --strip-components=3 --include='*/dopple-deploy/scripts/dopple/*'
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

echo ""
echo "Done! Run 'dopple login' to authenticate."
)

# PATH update runs outside subshell so it persists in the user's session
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
