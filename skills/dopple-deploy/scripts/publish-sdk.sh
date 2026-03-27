#!/usr/bin/env bash
# Publish dopple-deploy SDK assets to Supabase Storage.
# Builds the CJS bundle, then uploads CLI + skill via the publish-sdk-asset edge function.
#
# Cache-busting strategy: assets are uploaded to versioned paths (e.g. dopple-cli-0.3.1.cjs)
# so each release gets a fresh CDN path (cache miss = instant availability).
# versions.json stores the versioned filenames for the SDK page to reference.
#
# Usage:
#   ./publish-sdk.sh                    # Uses dopple auth from ~/.dopple/auth.json
#   DOPPLE_TOKEN=<token> ./publish-sdk.sh  # Explicit token
#
# Requires: node, npx (esbuild), curl, jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOPPLE_DIR="$SCRIPT_DIR/dopple"
SKILL_FILE="$SCRIPT_DIR/../SKILL.md"
INSTALL_SCRIPT="$SCRIPT_DIR/dopple-deploy-install.sh"
SUPABASE_URL="${SUPABASE_URL:-https://onljswkegixyjjhpcldn.supabase.co}"
PUBLISH_URL="$SUPABASE_URL/functions/v1/publish-sdk-asset"

# Resolve proxy for curl (agent environments)
CURL_PROXY=""
if [ -n "${HTTPS_PROXY:-}" ]; then
  CURL_PROXY="--proxy $HTTPS_PROXY"
elif [ -n "${HTTP_PROXY:-}" ]; then
  CURL_PROXY="--proxy $HTTP_PROXY"
fi

# --- Auth ---
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ubGpzd2tlZ2l4eWpqaHBjbGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NDY1MzEsImV4cCI6MjA4MTEyMjUzMX0.MtOk_dTmjvSduX2AW4YzmSwxaACua3B5z3O8gBRPG7k"

if [ -n "${DOPPLE_TOKEN:-}" ]; then
  TOKEN="$DOPPLE_TOKEN"
else
  echo "Resolving auth..."
  REFRESH_TOKEN=$(jq -r '.refresh_token' ~/.dopple/auth.json 2>/dev/null)
  if [ -z "$REFRESH_TOKEN" ] || [ "$REFRESH_TOKEN" = "null" ]; then
    echo "Error: Not authenticated. Run 'dopple login' first."
    exit 1
  fi

  # Refresh session via Supabase REST API (works through proxy, unlike Node fetch)
  AUTH_RESPONSE=$(curl $CURL_PROXY -sf "$SUPABASE_URL/auth/v1/token?grant_type=refresh_token" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")

  TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.access_token // empty')
  if [ -z "$TOKEN" ]; then
    echo "Error: Auth refresh failed. Run 'dopple login' again."
    exit 1
  fi

  # Save updated refresh token
  NEW_REFRESH=$(echo "$AUTH_RESPONSE" | jq -r '.refresh_token // empty')
  if [ -n "$NEW_REFRESH" ]; then
    echo "{\"refresh_token\":\"$NEW_REFRESH\"}" > ~/.dopple/auth.json
  fi
fi

echo "Authenticated."

# --- Build CJS bundle ---
CLI_VERSION=$(jq -r '.version' "$DOPPLE_DIR/package.json")
echo "Building CJS bundle (v${CLI_VERSION})..."
BUNDLE_PATH=$(mktemp /tmp/dopple-cli-XXXXXX.cjs)
npx esbuild "$DOPPLE_DIR/dist/cli.js" \
  --bundle --platform=node --format=cjs \
  --outfile="$BUNDLE_PATH" \
  --external:playwright --external:@playwright/test \
  --define:DOPPLE_CLI_VERSION="'${CLI_VERSION}'" \
  --log-level=warning

BUNDLE_SIZE=$(wc -c < "$BUNDLE_PATH" | tr -d ' ')
echo "Bundle: ${BUNDLE_SIZE} bytes"

# --- Versioned filenames (cache-busting) ---
VERSIONED_CLI="dopple-cli-${CLI_VERSION}.cjs"
VERSIONED_SKILL="dopple-deploy-${CLI_VERSION}.md"
VERSIONED_INSTALLER="dopple-deploy-install-${CLI_VERSION}.sh"

# --- Get signed upload URLs ---
# Upload to versioned paths (cache miss = instant availability) + installer + versions.json
echo "Requesting upload URLs..."
FILES_JSON=$(jq -n --arg cli "$VERSIONED_CLI" --arg skill "$VERSIONED_SKILL" --arg inst "$VERSIONED_INSTALLER" \
  '{files: [$cli, $skill, $inst, "versions.json"]}')

RESPONSE=$(curl $CURL_PROXY -sf "$PUBLISH_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$FILES_JSON")

if [ $? -ne 0 ] || echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "Error: $(echo "$RESPONSE" | jq -r '.error // "request failed"')"
  rm -f "$BUNDLE_PATH"
  exit 1
fi

get_url() {
  echo "$RESPONSE" | jq -r --arg f "$1" '.uploads[] | select(.file==$f) | .signed_url'
}

CLI_URL=$(get_url "$VERSIONED_CLI")
SKILL_URL=$(get_url "$VERSIONED_SKILL")
INSTALLER_URL=$(get_url "$VERSIONED_INSTALLER")
VERSIONS_URL=$(get_url "versions.json")

# --- Upload CLI ---
echo "Uploading ${VERSIONED_CLI}..."
curl $CURL_PROXY -sf "$CLI_URL" \
  -X PUT \
  -H "Content-Type: application/javascript" \
  --data-binary "@$BUNDLE_PATH" > /dev/null

echo "Uploaded ${VERSIONED_CLI} ($(( BUNDLE_SIZE / 1024 )) KB)"

# --- Upload skill ---
SKILL_SIZE=$(wc -c < "$SKILL_FILE" | tr -d ' ')
echo "Uploading ${VERSIONED_SKILL}..."
curl $CURL_PROXY -sf "$SKILL_URL" \
  -X PUT \
  -H "Content-Type: text/markdown" \
  --data-binary "@$SKILL_FILE" > /dev/null

echo "Uploaded ${VERSIONED_SKILL} ($(( SKILL_SIZE / 1024 )) KB)"

# --- Upload install script ---
INSTALLER_SIZE=$(wc -c < "$INSTALL_SCRIPT" | tr -d ' ')
echo "Uploading ${VERSIONED_INSTALLER}..."
curl $CURL_PROXY -sf "$INSTALLER_URL" \
  -X PUT \
  -H "Content-Type: text/x-shellscript" \
  --data-binary "@$INSTALL_SCRIPT" > /dev/null

echo "Uploaded ${VERSIONED_INSTALLER} ($(( INSTALLER_SIZE / 1024 )) KB)"

# --- Build and upload versions.json ---
PUBLISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSIONS_PATH=$(mktemp /tmp/dopple-versions-XXXXXX.json)
cat > "$VERSIONS_PATH" <<VJSON
{"cli":"${CLI_VERSION}","skill":"${CLI_VERSION}","published_at":"${PUBLISHED_AT}","files":{"cli":"${VERSIONED_CLI}","skill":"${VERSIONED_SKILL}","installer":"${VERSIONED_INSTALLER}"}}
VJSON

echo "Uploading versions.json..."
curl $CURL_PROXY -sf "$VERSIONS_URL" \
  -X PUT \
  -H "Content-Type: application/json" \
  --data-binary "@$VERSIONS_PATH" > /dev/null

echo "Uploaded versions.json (CLI ${CLI_VERSION})"

# --- Cleanup ---
rm -f "$BUNDLE_PATH" "$VERSIONS_PATH"

echo ""
echo "Published successfully."
echo "  ${VERSIONED_CLI}:  $(( BUNDLE_SIZE / 1024 )) KB"
echo "  ${VERSIONED_SKILL}:  $(( SKILL_SIZE / 1024 )) KB"
echo "  ${VERSIONED_INSTALLER}: $(( INSTALLER_SIZE / 1024 )) KB"
echo "  versions.json:     CLI ${CLI_VERSION}"
