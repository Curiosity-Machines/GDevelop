# Design: Modernize Dopple Studio Tech Stack

## Architecture Overview

This modernization retains the existing Vite + React SPA architecture while adding four foundational capabilities: PWA support, Tailwind CSS styling, React Router navigation, and Vitest testing infrastructure. The changes are additive and do not alter the core data flow or Supabase integration.

### High-Level System Architecture

```
                                    +------------------+
                                    | Cloudflare Pages |
                                    |   (CDN + Deploy) |
                                    +--------+---------+
                                             |
                                             v
+----------------+              +------------------------+
|   PWA Layer    |              |     Vite Build         |
| - Service      |<------------>| - React 19             |
|   Worker       |              | - TypeScript 5.9       |
| - Web Manifest |              | - Tailwind CSS v4      |
| - Offline      |              | - React Router v7      |
|   Cache        |              +------------------------+
+----------------+                         |
                                           v
                              +------------------------+
                              |   React Application    |
                              | - Components (Tailwind)|
                              | - Contexts             |
                              | - Hooks                |
                              | - Router               |
                              +------------------------+
                                           |
                                           v
                              +------------------------+
                              |   Supabase Backend     |
                              | - Auth (unchanged)     |
                              | - Database (unchanged) |
                              | - Storage (unchanged)  |
                              +------------------------+
```

### Data Flow (Service Worker Integration)

```
User Request
    |
    v
Service Worker --[Cache Hit]--> Return Cached Response
    |
    [Cache Miss]
    v
Network Request --> Supabase API --> Response
    |                                   |
    v                                   v
Store in Cache <----- Return to User ---+
```

---

## Context

Dopple Studio is a React 19 + Vite 7 SPA that needs to be production-ready with PWA capabilities, improved styling, and deployment infrastructure. The application manages activity configurations for the Dopple device with authenticated CRUD operations and public manifest endpoints.

**Stakeholders**:
- End users: Need installable, offline-capable, mobile-friendly experience
- Developers: Need maintainable codebase with proper testing

**Constraints**:
- Supabase backend must remain unchanged
- No SSR requirements (SPA is sufficient)
- Team familiar with React/Vite ecosystem
- Limited migration budget/timeline

---

## Goals / Non-Goals

### Goals
- Enable PWA installation and offline viewing of cached activities
- Migrate to Tailwind CSS for maintainable, scalable styling
- Add proper client-side routing with React Router
- Establish testing foundation with 60%+ coverage
- Deploy to production with CI/CD pipeline

### Non-Goals
- SSR/SSG implementation
- Framework migration (Next.js, Remix, SvelteKit)
- Backend infrastructure changes
- Native mobile application
- Offline mutation support (background sync)

---

## Decisions

### Decision 1: Retain Vite + React SPA Architecture

**What**: Keep the current Vite 7 + React 19 stack instead of migrating to a meta-framework.

**Why**:
- Application is fundamentally an SPA - no SEO requirements, no SSR needs
- Migration cost to Next.js/Remix/SvelteKit provides minimal benefit
- Team is already proficient with Vite
- All goals (PWA, mobile, cross-browser) achievable without framework change

**Alternatives considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Next.js 15 | SSR, built-in API routes | Migration effort, overkill for SPA | Rejected |
| Remix 2 | Good data loading patterns | Migration effort, less mature PWA | Rejected |
| SvelteKit | Small bundles, reactive | Complete rewrite required | Rejected |

### Decision 2: Tailwind CSS v4 for Styling

**What**: Replace all plain CSS files with Tailwind utility classes.

**Why**:
- Reduces CSS maintenance burden from ~2,695 lines to <500
- Built-in responsive design system
- Excellent DX with IntelliSense and JIT compilation
- v4 uses native CSS features (layers, custom properties)
- Industry standard with strong community support

**Alternatives considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| CSS Modules | Type-safe, scoped | Still manual responsive, more boilerplate | Rejected |
| Styled Components | CSS-in-JS colocation | Runtime overhead, bundle size | Rejected |
| Keep plain CSS | No migration needed | Maintenance nightmare at scale | Rejected |

### Decision 3: vite-plugin-pwa with Workbox

**What**: Use vite-plugin-pwa for PWA capabilities, Workbox for service worker.

**Why**:
- Most mature PWA solution for Vite ecosystem
- Workbox provides battle-tested caching strategies
- Automatic manifest generation
- Supports prompt-based update flow

**Configuration approach**:
```typescript
// Caching strategies
{
  // App shell: Cache First (fast loads, background update)
  precaching: ['**/*.{js,css,html,ico,png,svg,webp}'],

  // Supabase API: Network First (fresh data, cache fallback)
  runtimeCaching: [{
    urlPattern: /supabase\.co\/rest\/v1/,
    handler: 'NetworkFirst',
    options: { cacheName: 'api-cache', expiration: { maxAgeSeconds: 86400 } }
  }]
}
```

### Decision 4: React Router v7

**What**: Replace manual URL parsing with React Router for client-side routing.

**Why**:
- Industry standard for React routing
- Proper history management and navigation guards
- Support for lazy loading routes
- Better code organization with route-based splitting

**Route structure**:
```
/                    -> GalleryRoute (protected)
/create              -> CreateActivityRoute (protected)
/edit/:id            -> EditActivityRoute (protected)
/manifest/:id        -> ManifestRoute (public)
/qr/:id              -> QRRoute (public)
```

### Decision 5: Cloudflare Pages for Deployment (Existing)

**What**: Continue using existing Cloudflare Pages deployment infrastructure.

**Why**:
- Already configured and running
- Excellent global edge network performance
- Generous free tier (unlimited bandwidth)
- Cloudflare Workers available if needed later
- No migration overhead

**Future portability**:
- Standard Vite build output is platform-agnostic
- No Cloudflare-specific features used (Workers, KV, D1)
- Migration to Vercel/Netlify would be trivial if needed

**Alternatives considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Vercel | Zero-config, polished DX | Migration overhead, already have CF | Deferred |
| Netlify | Good Vite support | Slower builds, no benefit over CF | Rejected |
| GitHub Pages | Free | No preview deploys, single origin | Rejected |

### Decision 6: Vitest for Testing

**What**: Use Vitest with React Testing Library for unit and integration tests.

**Why**:
- Native Vite integration (same config, transforms)
- API compatible with Jest (easy migration)
- Fast execution with watch mode
- Built-in coverage reporting

---

## Technical Architecture

### Updated Project Structure

```
src/
├── components/           # UI components (Tailwind styled)
│   ├── Auth.tsx
│   ├── Gallery.tsx
│   ├── ProjectCard.tsx
│   ├── ProjectForm.tsx
│   ├── ManifestPage.tsx
│   ├── PublicQRPage.tsx
│   ├── QRCodeDisplay.tsx
│   ├── AccountSettings.tsx
│   ├── ProtectedRoute.tsx    # NEW: Auth guard
│   └── OfflineIndicator.tsx  # NEW: PWA offline UI
├── routes/               # NEW: Route components
│   ├── GalleryRoute.tsx
│   ├── CreateRoute.tsx
│   ├── EditRoute.tsx
│   ├── ManifestRoute.tsx
│   └── QRRoute.tsx
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useActivities.ts
│   └── useOnlineStatus.ts    # NEW: PWA hook
├── lib/
│   └── supabase.ts
├── test/                 # NEW: Test utilities
│   └── setup.ts
├── types/
│   └── ...
├── router.tsx            # NEW: React Router config
├── App.tsx               # Simplified (routing moved out)
├── main.tsx              # Router provider setup
└── index.css             # Tailwind directives only

public/
├── dopple_logo.webp
├── icon-192.png          # NEW: PWA icon
├── icon-512.png          # NEW: PWA icon
└── favicon.ico
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'dopple_logo.webp'],
      manifest: {
        name: 'Dopple Studio',
        short_name: 'Dopple',
        description: 'Create and manage Dopple activity configurations',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'utils': ['jszip', 'qrcode.react', 'uuid'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
```

### Router Configuration

```typescript
// src/router.tsx
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GalleryRoute } from './routes/GalleryRoute'
import { CreateRoute } from './routes/CreateRoute'
import { EditRoute } from './routes/EditRoute'
import { ManifestRoute } from './routes/ManifestRoute'
import { QRRoute } from './routes/QRRoute'
import { Auth } from './components'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <GalleryRoute /> },
      { path: 'create', element: <CreateRoute /> },
      { path: 'edit/:id', element: <EditRoute /> },
    ],
  },
  { path: '/manifest/:id', element: <ManifestRoute /> },
  { path: '/qr/:id', element: <QRRoute /> },
  { path: '/login', element: <Auth /> },
])
```

### Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Preserve existing color scheme
        dopple: {
          bg: '#1a1a1a',
          surface: '#2a2a2a',
          accent: '#646cff',
          text: '#ffffffde',
          muted: '#888',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

---

## Risks / Trade-offs

### Risk 1: CSS Migration Visual Regressions
**Risk**: Tailwind migration introduces visual inconsistencies
**Likelihood**: Medium
**Impact**: Medium
**Mitigation**:
- Migrate component by component
- Use browser DevTools to compare before/after
- Screenshot testing for critical pages

### Risk 2: Service Worker Caching Issues
**Risk**: Stale cached data causes confusion
**Likelihood**: Low
**Impact**: High
**Mitigation**:
- Implement version-aware cache invalidation
- Clear UI for update availability
- "Prompt" registration (user controls update timing)

### Risk 3: Bundle Size Increase
**Risk**: PWA additions increase bundle significantly
**Likelihood**: Low
**Impact**: Low
**Mitigation**:
- PWA assets are loaded lazily
- Service worker runs in separate thread
- Tailwind purges unused utilities

### Trade-off 1: Tailwind Verbosity
**Trade-off**: HTML becomes more verbose with utility classes
**Accepted because**:
- Co-located styles improve maintainability
- IDE IntelliSense makes authoring fast
- Can extract repeated patterns to components

### Trade-off 2: No Offline Mutations
**Trade-off**: Users cannot create/edit activities offline
**Accepted because**:
- Significantly increases complexity (conflict resolution)
- Clear offline indicator sets expectations
- Can be added in future iteration

---

## Migration Plan

### Phase 1: Foundation (Non-Breaking)
1. Add Tailwind, PWA plugin, React Router, Vitest to dependencies
2. Configure all new tooling
3. Verify nothing breaks with existing code

### Phase 2: Incremental Migration
1. Migrate CSS file by file (can be parallelized)
2. Replace routing in single commit
3. Service worker tested locally before deploy

### Phase 3: Validation
1. Full cross-browser testing
2. Lighthouse audits
3. PWA installation testing

### Rollback Strategy
- Each phase can be rolled back independently
- CSS migration: Revert Tailwind classes, restore CSS files
- Routing: Restore useRoute hook
- PWA: Disable plugin in vite config

---

## Open Questions

All resolved during proposal phase:
- [x] Framework decision - Retain Vite + React
- [x] CSS approach - Tailwind v4
- [x] PWA library - vite-plugin-pwa
- [x] Router - React Router v7
- [x] Deployment - Cloudflare Pages (existing)

---

## References

- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [React Router v7](https://reactrouter.com/)
- [Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies/)
- [Cloudflare Pages Vite Guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)
- [Vitest Documentation](https://vitest.dev/)
