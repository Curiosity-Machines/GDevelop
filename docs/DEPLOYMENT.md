# Deployment Guide

This guide covers building, deploying, and managing Dopple Studio in production environments.

## Overview

Dopple Studio is deployed to **Cloudflare Pages** with the following configuration:

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Output directory | `dist/` |
| Node.js version | 20 |
| Framework preset | Vite |

## Prerequisites

- Access to the Cloudflare dashboard
- GitHub repository connected to Cloudflare Pages
- Supabase project credentials

## Environment Variables

The following environment variables must be set in Cloudflare Pages:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://abc123.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1...` |

### Setting Environment Variables

1. Go to Cloudflare Pages dashboard
2. Select the `dopple-studio` project
3. Navigate to **Settings** > **Environment variables**
4. Add variables for both **Production** and **Preview** environments

> **Note**: Preview environments allow testing with different configurations before production.

## Build Process

### Local Build

Test the production build locally before deployment:

```bash
# Clean any previous builds
rm -rf dist/

# Run production build
npm run build

# Preview the build
npm run preview
```

The build process:

1. **TypeScript compilation**: `tsc -b` checks types across all projects
2. **Vite build**: Bundles and optimizes assets
3. **PWA generation**: Creates service worker and manifest
4. **Code splitting**: Separates vendor chunks for caching

### Build Output

The `dist/` directory contains:

```
dist/
  index.html              # Entry HTML with asset references
  manifest.webmanifest    # PWA manifest
  sw.js                   # Service worker
  registerSW.js           # SW registration script
  assets/
    index-[hash].js       # Main application bundle
    index-[hash].css      # Compiled Tailwind CSS
    react-vendor-[hash].js    # React runtime
    supabase-[hash].js    # Supabase client
    utils-[hash].js       # Utilities (jszip, qrcode, uuid)
  dopple_logo.webp        # Static assets
  favicon.webp
```

### Build Size

Target bundle sizes (gzipped):

| Chunk | Target | Current |
|-------|--------|---------|
| Main bundle | < 100 KB | ~80 KB |
| React vendor | < 50 KB | ~45 KB |
| Supabase | < 100 KB | ~90 KB |
| Utilities | < 50 KB | ~40 KB |

## CI/CD Pipeline

### GitHub Actions

The CI pipeline runs on every push and PR to `main`:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm test -- --run
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7
```

### Pipeline Steps

1. **Lint**: ESLint checks code quality
2. **Type Check**: TypeScript validates types
3. **Test**: Vitest runs all unit tests
4. **Build**: Vite creates production bundle
5. **Upload**: Build artifacts stored for 7 days

### Required Secrets

Set these in GitHub repository settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Cloudflare Pages Deployment

### Automatic Deployments

Cloudflare Pages automatically deploys when:

- **Production**: Push to `main` branch
- **Preview**: Push to any other branch or PR

### Manual Deployment

To deploy manually via CLI:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build the project
npm run build

# Deploy to production
wrangler pages deploy dist --project-name=dopple-studio
```

### Deployment Workflow

1. Developer pushes to `main` or opens PR
2. GitHub Actions runs CI pipeline
3. On success, Cloudflare Pages triggers deployment
4. New version deployed to edge network
5. Service worker updates cached assets

## Preview Deployments

Every PR and non-main branch gets a preview deployment:

- URL format: `https://<commit-hash>.dopple-studio.pages.dev`
- Separate environment variables can be set for previews
- Preview URLs are listed in GitHub PR comments

### Testing Preview Deployments

1. Open the preview URL from PR comments
2. Verify new features work correctly
3. Test PWA functionality (install, offline mode)
4. Check mobile responsiveness

## Production Deployment Checklist

Before deploying to production:

### Pre-Deployment

- [ ] All tests passing (`npm test -- --run`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Preview deployment tested
- [ ] Database migrations applied (if any)

### Post-Deployment

- [ ] Production site loads correctly
- [ ] Authentication flow works
- [ ] Activity CRUD operations work
- [ ] QR codes generate correctly
- [ ] PWA installs and works offline
- [ ] No console errors in browser

### Monitoring

After deployment, monitor:

- Cloudflare Analytics for traffic and errors
- Supabase dashboard for database activity
- Browser console for JavaScript errors

## Rollback Procedures

### Quick Rollback

Cloudflare Pages maintains previous deployments:

1. Go to Cloudflare Pages dashboard
2. Select `dopple-studio` project
3. Navigate to **Deployments**
4. Find the previous working deployment
5. Click the three dots menu > **Rollback to this deployment**

### Git-Based Rollback

For code-based rollback:

```bash
# Find the last working commit
git log --oneline

# Revert to previous commit
git revert HEAD

# Or reset to specific commit (use with caution)
git reset --hard <commit-hash>
git push --force-with-lease origin main
```

> **Warning**: Force pushing to main requires careful coordination with the team.

## Domain Configuration

### Custom Domain Setup

1. Go to Cloudflare Pages > `dopple-studio` > Custom domains
2. Add your domain (e.g., `studio.dopple.com`)
3. Update DNS records as instructed
4. SSL certificate is automatically provisioned

### DNS Records

Required DNS configuration:

| Type | Name | Content |
|------|------|---------|
| CNAME | studio | dopple-studio.pages.dev |

## Performance Optimization

### Edge Caching

Cloudflare automatically caches static assets at edge locations. Cache behavior:

| Asset Type | Cache Duration |
|------------|----------------|
| HTML | No cache (dynamic) |
| JS/CSS with hash | 1 year |
| Images | 1 week |
| Service Worker | No cache |

### Compression

Cloudflare automatically applies:

- Brotli compression for text assets
- WebP conversion for images (if Auto Minify enabled)

### PWA Caching

The service worker implements additional caching:

- **Static assets**: Precached during installation
- **API calls**: NetworkFirst with 24-hour fallback
- **Storage**: CacheFirst with 7-day expiration

## Troubleshooting

### Build Failures

**TypeScript errors**
- Run `npx tsc --noEmit` locally to see errors
- Fix type issues before pushing

**Missing environment variables**
- Ensure all `VITE_*` variables are set in Cloudflare
- Check for typos in variable names

**Out of memory**
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`

### Deployment Issues

**Deployment stuck**
- Check Cloudflare status page
- Cancel and retry the deployment

**Assets not updating**
- Clear browser cache
- Force service worker update
- Check if new assets have different hashes

**404 on routes**
- Verify `_redirects` file for SPA routing
- Cloudflare Pages handles SPA routing automatically

### Runtime Issues

**Authentication not working**
- Verify Supabase URL and key in environment variables
- Check Supabase dashboard for auth configuration
- Ensure redirect URLs are allowed in Supabase

**PWA not installing**
- Serve over HTTPS (automatic on Cloudflare)
- Check manifest.webmanifest is accessible
- Verify service worker registration

## Supabase Edge Functions

The project includes a Supabase Edge Function for manifest retrieval:

### Deploying Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy the get-manifest function
supabase functions deploy get-manifest
```

### Edge Function Configuration

Set the `SITE_URL` secret for the function:

```bash
supabase secrets set SITE_URL=https://studio.dopple.com
```

## Security Considerations

### Environment Variable Security

- Never commit `.env` files to version control
- Use Cloudflare's encrypted environment variables
- Rotate Supabase keys if compromised

### Content Security Policy

Cloudflare Pages supports custom headers. Add to `_headers` file:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co
```

### Access Control

- Supabase RLS policies restrict data access per user
- Authentication required for protected routes
- Public routes limited to manifest and QR viewing
