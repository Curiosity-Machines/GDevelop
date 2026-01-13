# Change: Modernize Dopple Studio Tech Stack

## Status
Approved

## Why

Dopple Studio is a functioning React 19 + Vite 7 application that needs to evolve from a development prototype into a production-ready, scalable product. The current architecture lacks PWA capabilities, uses plain CSS that doesn't scale well, and has no formal testing or deployment infrastructure. Modernizing the stack will enable better developer experience, improved user experience across devices, and a foundation for long-term maintenance.

## What Changes

### Platform and Framework
- **DECISION**: Retain Vite + React SPA architecture (no framework switch)
- Add `vite-plugin-pwa` for Progressive Web App capabilities
- Add React Router for improved client-side routing
- Add Vitest + React Testing Library for testing

### Styling
- Migrate from plain CSS (~2,695 lines across 10 files) to Tailwind CSS v4
- Preserve existing design system aesthetics during migration

### PWA Capabilities
- Service worker for offline support and caching
- Web app manifest for installability
- Background sync for activity data

### Build and Deployment
- Leverage existing Cloudflare Pages deployment infrastructure
- Add environment-specific configurations
- Optimize bundle splitting and caching strategies

## Impact

- **Affected code**: All CSS files (migration to Tailwind), App.tsx (routing), vite.config.ts (PWA plugin)
- **New dependencies**: `tailwindcss`, `@tailwindcss/vite`, `vite-plugin-pwa`, `react-router-dom`, `vitest`, `@testing-library/react`
- **No breaking changes**: Internal refactor preserving all existing functionality
- **Learning curve**: Team needs to learn Tailwind utility classes

---

## Problem Statement

Dopple Studio currently operates as a development-focused prototype with several gaps that prevent it from being deployed as a production-ready, scalable application:

1. **No PWA support**: Users cannot install the app or use it offline
2. **Plain CSS doesn't scale**: 2,695 lines of CSS across 10 files with no design system, making maintenance difficult
3. **Primitive routing**: Manual URL parsing in App.tsx lacks proper navigation guards, lazy loading, and nested routes
4. **No testing infrastructure**: Zero test coverage with no framework configured
5. **No deployment pipeline**: No defined path from development to production

### Concrete Example
When a user loses network connectivity while managing activities, the entire application becomes unusable. With PWA capabilities, cached activity data could remain accessible, and changes could sync when connectivity returns.

## Motivation

1. **Production readiness**: Enable confident deployment to production environments
2. **Mobile experience**: Modern mobile users expect installable, offline-capable applications
3. **Developer velocity**: Tailwind CSS and proper testing reduce development friction
4. **Maintainability**: Established patterns and tooling make onboarding easier
5. **Future-proofing**: React 19 + Vite 7 + Tailwind 4 represent current best practices with strong community support

---

## Platform Evaluation

### Option 1: Enhanced Vite + React SPA (RECOMMENDED)

**Keep**: Vite 7 + React 19 + TypeScript 5.9
**Add**: PWA plugin, Tailwind CSS, React Router, Vitest

| Criteria | Score | Notes |
|----------|-------|-------|
| Development speed | 10/10 | Already familiar, minimal migration |
| PWA support | 9/10 | vite-plugin-pwa is mature and well-documented |
| Production readiness | 8/10 | Vite builds are highly optimized |
| Mobile support | 9/10 | PWA + responsive Tailwind achieves parity |
| Future-proofing | 9/10 | Vite is the de facto standard for React |
| Migration effort | Low | Incremental adoption possible |

**Pros**:
- Zero framework migration risk
- Preserves existing codebase investment
- Team already proficient with Vite
- Fastest path to production

**Cons**:
- No SSR (acceptable for this app)
- Manual code splitting decisions

### Option 2: Next.js App Router Migration

**Replace**: Vite with Next.js 15

| Criteria | Score | Notes |
|----------|-------|-------|
| Development speed | 7/10 | Learning curve for App Router |
| PWA support | 7/10 | Requires next-pwa or manual setup |
| Production readiness | 10/10 | Battle-tested at scale |
| Mobile support | 9/10 | Excellent with proper configuration |
| Future-proofing | 9/10 | Strong corporate backing (Vercel) |
| Migration effort | High | Complete restructure required |

**Pros**:
- SSR/SSG capabilities (not currently needed)
- Built-in API routes could replace Edge Functions
- Strong ecosystem and documentation
- Automatic code splitting

**Cons**:
- Significant migration effort for minimal benefit
- Adds complexity not justified by requirements
- App Router has a learning curve
- Overkill for an SPA with public JSON endpoints

### Option 3: Remix Migration

**Replace**: Vite with Remix 2

| Criteria | Score | Notes |
|----------|-------|-------|
| Development speed | 6/10 | Different mental model (loaders/actions) |
| PWA support | 6/10 | Less mature PWA story |
| Production readiness | 8/10 | Proven in production |
| Mobile support | 8/10 | Good with configuration |
| Future-proofing | 8/10 | Now Shopify-backed |
| Migration effort | High | Complete restructure required |

**Pros**:
- Excellent data loading patterns
- Progressive enhancement by default
- Web standards focused

**Cons**:
- Migration cost not justified
- Smaller ecosystem than Next.js
- PWA support less mature

### Option 4: SvelteKit Migration

**Replace**: React + Vite with SvelteKit

| Criteria | Score | Notes |
|----------|-------|-------|
| Development speed | 5/10 | Complete paradigm shift |
| PWA support | 8/10 | Good adapter support |
| Production readiness | 8/10 | Mature and stable |
| Mobile support | 9/10 | Excellent bundle sizes |
| Future-proofing | 8/10 | Growing but smaller ecosystem |
| Migration effort | Very High | Complete rewrite |

**Pros**:
- Smaller bundle sizes
- Simpler reactive model
- Growing popularity

**Cons**:
- Complete rewrite required
- Team must learn Svelte
- Abandons React ecosystem investment
- Risk of Svelte 5 migration issues

### Recommendation Summary

**Enhanced Vite + React SPA** is the clear winner because:

1. The application is fundamentally an SPA - it doesn't need SSR
2. Migration cost of other options provides minimal benefit for this use case
3. Vite's PWA plugin is mature and well-maintained
4. Team productivity is maximized by staying with familiar tools
5. All stated goals (PWA, mobile, cross-browser) are achievable without a framework switch

---

## Styling Evaluation

### Current State
- 10 CSS files totaling ~2,695 lines
- No design tokens or CSS variables for theming
- Manual media queries for responsiveness
- Some inconsistent patterns across files

### Option A: Tailwind CSS v4 (RECOMMENDED)

**Pros**:
- Utility-first approach reduces CSS file count dramatically
- Built-in responsive design system
- Dark mode support out of the box
- Excellent DX with IntelliSense
- v4 uses native CSS layers and modern features
- Co-located styles improve maintainability

**Cons**:
- Learning curve for utility classes
- HTML can become verbose
- Migration requires touching all components

**Migration Strategy**:
1. Install Tailwind v4 with Vite plugin
2. Migrate component by component, starting with smallest
3. Extract repeated patterns to `@apply` or component classes
4. Remove old CSS files as components are migrated
5. Estimated effort: 2-3 days for full migration

### Option B: CSS Modules + Design Tokens

**Pros**:
- Type-safe class names
- Scoped by default
- No new syntax to learn

**Cons**:
- Doesn't solve the maintainability issue
- Still requires manual responsive design
- More boilerplate

### Option C: Styled Components / Emotion

**Pros**:
- CSS-in-JS colocation
- Dynamic styling capabilities

**Cons**:
- Runtime overhead
- Diverges from CSS standards
- Bundle size impact

### Recommendation: Tailwind CSS v4

Tailwind provides the best balance of DX, performance, and maintainability. The v4 release uses native CSS features, making it more future-proof. The utility-first approach aligns with modern React development patterns.

---

## PWA Implementation Strategy

### Core Requirements

1. **Service Worker**: Cache shell and API responses
2. **Web Manifest**: Enable installation on mobile/desktop
3. **Offline Support**: Show cached activities when offline
4. **Update Flow**: Notify users of new versions

### Implementation Plan

**Tool**: `vite-plugin-pwa` with Workbox

```typescript
// vite.config.ts additions
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Ask user before updating
      includeAssets: ['favicon.ico', 'dopple_logo.webp'],
      manifest: {
        name: 'Dopple Studio',
        short_name: 'Dopple',
        description: 'Create and manage Dopple activity configurations',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
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
          }
        ]
      }
    })
  ]
})
```

### Offline Strategy

| Resource Type | Strategy | Rationale |
|---------------|----------|-----------|
| App shell (HTML/JS/CSS) | Cache First | Fast load, update in background |
| Activity data | Network First | Fresh data preferred, fallback to cache |
| Activity icons | Cache First | Rarely changes |
| Bundle uploads | Network Only | Too large to cache efficiently |

### Background Sync (Future Enhancement)

For offline activity creation/editing, implement background sync:
1. Queue mutations in IndexedDB
2. Sync when connection returns
3. Conflict resolution with server data

*Note: Background sync is a v2 enhancement, not required for initial PWA implementation.*

---

## Deployment Evaluation

### Current: Cloudflare Pages (KEEP)

**Pros**:
- Already configured and running
- Excellent performance (global edge network)
- Generous free tier (unlimited bandwidth)
- Workers available for future edge compute needs
- No migration overhead

**Cons**:
- None significant for this use case

**Future portability**:
- Standard Vite build output is platform-agnostic
- No Cloudflare-specific features used
- Migration to Vercel/Netlify trivial if needed later

### Alternative: Vercel

**Pros**:
- Zero-config Vite deployment
- Automatic preview deployments
- Polished DX

**Cons**:
- Migration overhead from existing Cloudflare setup
- No significant benefit over current setup

### Alternative: Netlify

**Pros**:
- Good Vite support
- Form handling built-in

**Cons**:
- Slower builds than competitors
- No benefit over current Cloudflare setup

### Recommendation: Keep Cloudflare Pages

Cloudflare Pages is already deployed and running. The modernization changes (Tailwind, PWA, Router, Vitest) are all client-side and deploy identically to any static host. No deployment migration needed.

---

## Requirements

### Functional Requirements

- **FR1**: Application SHALL function as a Progressive Web App installable on desktop and mobile devices
  - Acceptance Criteria: App can be installed via browser prompt and launches in standalone mode

- **FR2**: Application SHALL provide offline access to previously loaded activity data
  - Acceptance Criteria: With airplane mode enabled, users can view (read-only) their cached activities

- **FR3**: Application SHALL use Tailwind CSS for all styling
  - Acceptance Criteria: All 10 existing CSS files are removed and replaced with Tailwind classes

- **FR4**: Application SHALL use React Router for client-side navigation
  - Acceptance Criteria: All routes (/, /manifest/:id, /qr/:id) work with proper history management

- **FR5**: Application SHALL have automated test coverage
  - Acceptance Criteria: Minimum 60% code coverage with Vitest and React Testing Library

### Non-Functional Requirements

- **NFR1**: Lighthouse PWA score SHALL be 90+ on mobile
- **NFR2**: Time to Interactive (TTI) SHALL be under 3 seconds on 4G connection
- **NFR3**: Bundle size increase from PWA additions SHALL not exceed 50KB gzipped
- **NFR4**: Build time SHALL remain under 30 seconds
- **NFR5**: All modern browsers (Chrome, Firefox, Safari, Edge - last 2 versions) SHALL be supported

---

## User Stories

### US1: Mobile Installation
As a mobile user, I want to install Dopple Studio on my home screen so that I can access it like a native app without opening a browser.

Acceptance Criteria:
- [ ] "Add to Home Screen" prompt appears on supported browsers
- [ ] App launches in standalone mode (no browser chrome)
- [ ] App icon and splash screen display correctly

### US2: Offline Activity Viewing
As a user with intermittent connectivity, I want to view my activities offline so that I can reference configurations without network access.

Acceptance Criteria:
- [ ] Previously loaded activities are visible when offline
- [ ] Clear indication that app is in offline mode
- [ ] Edit/create operations are disabled or queued when offline

### US3: Responsive Design
As a mobile user, I want the application to be fully functional on my phone so that I can manage activities on the go.

Acceptance Criteria:
- [ ] All forms are usable on mobile viewports
- [ ] Touch targets meet accessibility guidelines (44x44px minimum)
- [ ] No horizontal scrolling required on mobile

### US4: Fast Loading
As a user on a slow connection, I want the app to load quickly so that I don't abandon it waiting.

Acceptance Criteria:
- [ ] First Contentful Paint under 1.5 seconds
- [ ] Time to Interactive under 3 seconds
- [ ] Loading states shown for async operations

---

## Technical Considerations

### Dependencies to Add

```json
{
  "dependencies": {
    "react-router-dom": "^7.x"
  },
  "devDependencies": {
    "tailwindcss": "^4.x",
    "@tailwindcss/vite": "^4.x",
    "vite-plugin-pwa": "^1.x",
    "vitest": "^3.x",
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "jsdom": "^26.x"
  }
}
```

### Files to Modify

1. `vite.config.ts` - Add PWA plugin and Tailwind plugin
2. `src/App.tsx` - Replace manual routing with React Router
3. `src/index.css` - Replace with Tailwind directives
4. All component CSS files - Remove after migration
5. `index.html` - Add PWA meta tags
6. New: `public/manifest.json` - Web app manifest (if not using plugin generation)

### Migration Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CSS migration introduces visual regressions | Medium | Medium | Side-by-side comparison, component-by-component migration |
| Service worker caches stale data | Low | High | Implement version-aware cache invalidation |
| PWA update notification UX confusion | Low | Low | Clear UI for update prompt |
| React Router migration breaks deep links | Low | Medium | Thorough testing of all routes |

### Constraints

- Supabase backend remains unchanged
- No SSR required (SPA is sufficient)
- Must maintain public manifest/QR endpoints without authentication

---

## Out of Scope

The following items are explicitly NOT included in this modernization effort:

1. **SSR/SSG implementation** - Application doesn't require server rendering
2. **Framework migration** (Next.js, Remix, SvelteKit) - Evaluated and rejected
3. **Backend changes** - Supabase infrastructure unchanged
4. **New features** - This is infrastructure modernization only
5. **Database schema changes** - Data layer untouched
6. **Authentication changes** - OAuth providers and auth flow unchanged
7. **Background sync for offline mutations** - Deferred to future enhancement
8. **Native mobile app** - PWA approach is sufficient for requirements
9. **Internationalization (i18n)** - Not requested, can be added later
10. **Analytics/monitoring integration** - Can be added post-deployment

---

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Lighthouse PWA Score | 0 | 90+ | Chrome DevTools Lighthouse |
| Lighthouse Performance Score | ~75 | 90+ | Chrome DevTools Lighthouse |
| Time to Interactive | ~2.5s | <3s | WebPageTest.org |
| Bundle Size (gzipped) | ~180KB | <230KB | Vite build output |
| CSS Lines of Code | ~2,695 | <500 | Line count of remaining CSS |
| Test Coverage | 0% | 60%+ | Vitest coverage report |
| Build Time | ~15s | <30s | CI/CD metrics |
| Cross-browser Compatibility | Untested | 100% last 2 versions | BrowserStack testing |

---

## Open Questions

All questions resolved through evaluation:

- [x] **Framework decision**: Retain Vite + React SPA (evaluated alternatives)
- [x] **Styling approach**: Tailwind CSS v4 (evaluated alternatives)
- [x] **PWA strategy**: vite-plugin-pwa with Workbox
- [x] **Deployment platform**: Vercel (evaluated alternatives)
- [x] **Router choice**: React Router v7

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- Add Tailwind CSS v4
- Configure vite-plugin-pwa
- Add React Router
- Set up Vitest

### Phase 2: Migration (Week 2)
- Migrate CSS to Tailwind (component by component)
- Update routing to React Router
- Add PWA manifest and service worker configuration

### Phase 3: Quality (Week 3)
- Write tests for critical paths
- Lighthouse optimization
- Cross-browser testing
- Deploy to Vercel

### Phase 4: Polish (Week 4)
- Remove legacy CSS files
- Documentation updates
- Performance fine-tuning
- Production deployment

---

## References

- [Vite PWA Plugin Documentation](https://vite-pwa-org.netlify.app/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [React Router v7 Documentation](https://reactrouter.com/)
- [Vercel Vite Deployment](https://vercel.com/docs/frameworks/vite)
- [Workbox Strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies/)
