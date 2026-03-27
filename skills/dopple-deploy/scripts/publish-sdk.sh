#!/usr/bin/env bash
# Publish dopple-deploy SDK assets to Supabase Storage.
# Builds the CJS bundle, then uploads CLI + skill via the publish-sdk-asset edge function.
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
echo "Building CJS bundle..."
BUNDLE_PATH=$(mktemp /tmp/dopple-cli-XXXXXX.cjs)
npx esbuild "$DOPPLE_DIR/dist/cli.js" \
  --bundle --platform=node --format=cjs \
  --outfile="$BUNDLE_PATH" \
  --external:playwright --external:@playwright/test \
  --log-level=warning

BUNDLE_SIZE=$(wc -c < "$BUNDLE_PATH" | tr -d ' ')
echo "Bundle: ${BUNDLE_SIZE} bytes"

# --- Get signed upload URLs ---
echo "Requesting upload URLs..."
RESPONSE=$(curl $CURL_PROXY -sf "$PUBLISH_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"files":["dopple-cli.cjs","dopple-deploy.md","versions.json"]}')

if [ $? -ne 0 ] || echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "Error: $(echo "$RESPONSE" | jq -r '.error // "request failed"')"
  rm -f "$BUNDLE_PATH"
  exit 1
fi

CLI_URL=$(echo "$RESPONSE" | jq -r '.uploads[] | select(.file=="dopple-cli.cjs") | .signed_url')
SKILL_URL=$(echo "$RESPONSE" | jq -r '.uploads[] | select(.file=="dopple-deploy.md") | .signed_url')
VERSIONS_URL=$(echo "$RESPONSE" | jq -r '.uploads[] | select(.file=="versions.json") | .signed_url')

# --- Upload CLI ---
echo "Uploading dopple-cli.cjs..."
curl $CURL_PROXY -sf "$CLI_URL" \
  -X PUT \
  -H "Content-Type: application/javascript" \
  --data-binary "@$BUNDLE_PATH" > /dev/null

echo "Uploaded dopple-cli.cjs ($(( BUNDLE_SIZE / 1024 )) KB)"

# --- Upload skill ---
SKILL_SIZE=$(wc -c < "$SKILL_FILE" | tr -d ' ')
echo "Uploading dopple-deploy.md..."
curl $CURL_PROXY -sf "$SKILL_URL" \
  -X PUT \
  -H "Content-Type: text/markdown" \
  --data-binary "@$SKILL_FILE" > /dev/null

echo "Uploaded dopple-deploy.md ($(( SKILL_SIZE / 1024 )) KB)"

# --- Build and upload versions.json ---
CLI_VERSION=$(jq -r '.version' "$DOPPLE_DIR/package.json")
PUBLISHED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
VERSIONS_PATH=$(mktemp /tmp/dopple-versions-XXXXXX.json)
cat > "$VERSIONS_PATH" <<VJSON
{"cli":"${CLI_VERSION}","skill":"${CLI_VERSION}","published_at":"${PUBLISHED_AT}"}
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
echo "  dopple-cli.cjs:    $(( BUNDLE_SIZE / 1024 )) KB"
echo "  dopple-deploy.md:  $(( SKILL_SIZE / 1024 )) KB"
echo "  versions.json:     CLI ${CLI_VERSION}"
