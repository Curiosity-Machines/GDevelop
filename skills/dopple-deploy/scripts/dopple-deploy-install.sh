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

# Create bin wrapper
BIN_DIR="$HOME/.dopple/bin"
mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/dopple" << 'WRAPPER'
#!/usr/bin/env node
require(require('path').join(require('os').homedir(), '.dopple', 'cli.cjs'));
WRAPPER
chmod +x "$BIN_DIR/dopple"
echo "  ~/.dopple/bin/dopple ✓"

# Add ~/.dopple/bin to PATH if not already present
SHELL_RC=""
if [ -n "${ZSH_VERSION:-}" ] || [ "$(basename "$SHELL" 2>/dev/null)" = "zsh" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -n "${BASH_VERSION:-}" ] || [ "$(basename "$SHELL" 2>/dev/null)" = "bash" ]; then
  SHELL_RC="$HOME/.bashrc"
fi

if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
  # Remove old alias if present
  if grep -q 'alias dopple=' "$SHELL_RC" 2>/dev/null; then
    sed -i.bak '/# Dopple CLI/d; /alias dopple=/d' "$SHELL_RC"
    rm -f "${SHELL_RC}.bak"
  fi
  # Add PATH entry if not present
  if ! grep -q '\.dopple/bin' "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo '# Dopple CLI' >> "$SHELL_RC"
    echo 'export PATH="$HOME/.dopple/bin:$PATH"' >> "$SHELL_RC"
  fi
fi

# Install loop-dev skill + types from Supabase
SUPABASE_URL="https://onljswkegixyjjhpcldn.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k"
STORAGE_BASE="$SUPABASE_URL/storage/v1/object/public/sdk-assets"

LOOP_VERSIONS=$(curl -sL "$STORAGE_BASE/loop-dev-versions.json" 2>/dev/null || echo "")
if [ -n "$LOOP_VERSIONS" ] && echo "$LOOP_VERSIONS" | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))" 2>/dev/null; then
  LOOP_SKILL_FILE=$(echo "$LOOP_VERSIONS" | node -e "const v=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(v.files?.skill||'')")
  LOOP_TYPES_FILE=$(echo "$LOOP_VERSIONS" | node -e "const v=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(v.files?.types||'')")
  LOOP_VERSION=$(echo "$LOOP_VERSIONS" | node -e "const v=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(v.skill||'')")

  if [ -n "$LOOP_SKILL_FILE" ]; then
    curl -sL "$STORAGE_BASE/$LOOP_SKILL_FILE" -o "$SKILL_DIR/loop-dev.md"
    echo "  ~/.claude/commands/loop-dev.md ✓"
  fi

  if [ -n "$LOOP_TYPES_FILE" ]; then
    TYPES_DIR="$HOME/.dopple/types"
    mkdir -p "$TYPES_DIR"
    curl -sL "$STORAGE_BASE/$LOOP_TYPES_FILE" -o "$TYPES_DIR/loop-sdk-dx.d.ts"
    echo "  ~/.dopple/types/loop-sdk-dx.d.ts ✓"
  fi

  if [ -n "$LOOP_VERSION" ]; then
    echo "  Loop Dev v${LOOP_VERSION} ✓"
  fi
else
  echo "  (loop-dev not available — install later with 'dopple update')"
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
  echo "Open a new terminal or run: export PATH=\"\$HOME/.dopple/bin:\$PATH\""
fi
)
