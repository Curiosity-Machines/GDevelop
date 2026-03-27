# Bundle Readiness: Versioned Paths + CLI Verification

**Date:** 2026-03-27
**Status:** Approved

## Problem

After the CLI deploys an activity, devices scanning the QR immediately get 404s from the public bundle URL. The bundle is uploaded and finalized successfully, but the Supabase Storage CDN hasn't propagated the file to its public endpoint yet.

On the Nano (free) tier, Smart CDN is not available, so overwrites to the same storage path can serve stale/missing content for up to 1 hour (the default `cacheControl` TTL).

## Solution

Two changes:

1. **Versioned storage paths** — each deploy writes to a unique path using a timestamp discriminator, so every deploy is a CDN cache miss (instant availability from origin).
2. **CLI readiness polling** — after finalize, the CLI polls the public bundle URL with HEAD requests before printing the QR.

## Storage Path Change

| Asset | Current Path | New Path |
|-------|-------------|----------|
| Bundle | `{userId}/{activityId}/bundle.zip` | `{userId}/{activityId}/{deployTag}/bundle.zip` |
| Icon | `{userId}/{activityId}/icon.{ext}` | `{userId}/{activityId}/{deployTag}/icon.{ext}` |
| QR | `{userId}/{activityId}/qr.png` | `{userId}/{activityId}/qr.png` (unchanged) |

`deployTag` = `Date.now()` generated during the initiate phase.

## Edge Function Changes (`deploy-activity/index.ts`)

### `handleInitiate`

- Generate `deployTag = Date.now().toString()`
- Use `{userId}/{activityId}/{deployTag}` as the base path for signed upload URLs
- Return `deploy_tag` in the response so the CLI can construct the public URL for polling

### `handleFinalize`

- Accept `deploy_tag` in the request body
- Download and validate bundle from `{userId}/{activityId}/{deployTag}/bundle.zip`
- Store `bundle_path = {userId}/{activityId}/{deployTag}` in the DB
- Delete the previous version's files from storage (read old `bundle_path` before update, delete after)

## CLI Changes (`deploy.ts`)

After finalize returns successfully, before returning the result:

1. Construct the public bundle URL from the response data
2. Poll with HEAD requests:
   - Interval: 2 seconds
   - Max attempts: 5 (10 seconds total)
   - Accept: HTTP 200
3. On success: return result (caller prints QR)
4. On timeout: log warning, return result anyway (device-side retry handles it)

Console output:
```
Verifying bundle availability...
Bundle ready.
```

## get-manifest

No changes needed. Already constructs bundle URL from `bundle_path` field:
```typescript
`${supabaseUrl}/storage/v1/object/public/activity-bundles/${bundlePath}/bundle.zip`
```

## Old Version Cleanup

During finalize, after successfully updating the activity record:
1. Read the previous `bundle_path` from the activity row (before the update)
2. If it differs from the new path, delete all files under the old path
3. Non-fatal — if cleanup fails, log and continue

This prevents storage accumulation on the 1GB Nano tier.
