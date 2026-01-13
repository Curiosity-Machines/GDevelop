# Tasks: Modernize Dopple Studio Tech Stack

## Overview

Implementation checklist for modernizing Dopple Studio with Tailwind CSS, PWA capabilities, React Router, and Vitest testing framework.

---

## Phase 1: Foundation Setup

### 1.1 Install and Configure Tailwind CSS v4
- [x] 1.1.1 Install `tailwindcss` and `@tailwindcss/vite` packages
- [x] 1.1.2 Add Tailwind plugin to `vite.config.ts`
- [x] 1.1.3 Create `src/index.css` with Tailwind directives (`@import "tailwindcss"`)
- [x] 1.1.4 Configure `tailwind.config.ts` with content paths (N/A - Tailwind v4 uses CSS-based config)
- [x] 1.1.5 Verify Tailwind classes work in a test component

### 1.2 Install and Configure PWA Plugin
- [x] 1.2.1 Install `vite-plugin-pwa` package
- [x] 1.2.2 Add VitePWA plugin to `vite.config.ts`
- [x] 1.2.3 Configure web app manifest (name, icons, theme colors)
- [x] 1.2.4 Create PWA icons (192x192, 512x512 PNG) - using dopple_logo.webp
- [x] 1.2.5 Configure Workbox caching strategies
- [x] 1.2.6 Add PWA meta tags to `index.html`
- [x] 1.2.7 Verify service worker registers in development

### 1.3 Install and Configure React Router
- [x] 1.3.1 Install `react-router-dom` package
- [x] 1.3.2 Create router configuration in `src/router.tsx`
- [x] 1.3.3 Update `src/main.tsx` to use RouterProvider
- [x] 1.3.4 Define routes for `/`, `/manifest/:id`, `/qr/:id`
- [x] 1.3.5 Remove manual `useRoute` hook from `App.tsx`
- [x] 1.3.6 Verify all routes work with navigation

### 1.4 Install and Configure Vitest
- [x] 1.4.1 Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [x] 1.4.2 Create `vitest.config.ts` with React Testing Library setup
- [x] 1.4.3 Create `src/test/setup.ts` for global test configuration
- [x] 1.4.4 Add test scripts to `package.json` (`test`, `test:coverage`)
- [x] 1.4.5 Create a sample test to verify setup works

---

## Phase 2: CSS Migration

### 2.1 Migrate Global Styles
- [x] 2.1.1 Audit `src/index.css` and migrate to Tailwind base/utilities
- [x] 2.1.2 Audit `src/App.css` and migrate to Tailwind classes in `App.tsx`
- [x] 2.1.3 Define custom CSS variables in Tailwind config if needed

### 2.2 Migrate Component Styles
- [x] 2.2.1 Migrate `Auth.css` to Tailwind classes in `Auth.tsx`
- [x] 2.2.2 Migrate `Gallery.css` to Tailwind classes in `Gallery.tsx`
- [x] 2.2.3 Migrate `ProjectCard.css` to Tailwind classes in `ProjectCard.tsx`
- [x] 2.2.4 Migrate `ProjectForm.css` to Tailwind classes in `ProjectForm.tsx`
- [x] 2.2.5 Migrate `ManifestPage.css` to Tailwind classes in `ManifestPage.tsx`
- [x] 2.2.6 Migrate `PublicQRPage.css` to Tailwind classes in `PublicQRPage.tsx`
- [x] 2.2.7 Migrate `QRCodeDisplay.css` to Tailwind classes in `QRCodeDisplay.tsx`
- [x] 2.2.8 Migrate `AccountSettings.css` to Tailwind classes in `AccountSettings.tsx`

### 2.3 CSS Cleanup
- [x] 2.3.1 Remove all migrated CSS files
- [x] 2.3.2 Remove CSS imports from component files
- [ ] 2.3.3 Verify no visual regressions (side-by-side comparison)

---

## Phase 3: Routing Migration

### 3.1 Create Route Structure
- [x] 3.1.1 Create `src/routes/` directory (N/A - using router.tsx with inline routes)
- [x] 3.1.2 Create `src/routes/GalleryRoute.tsx` (authenticated) - handled in router.tsx
- [x] 3.1.3 Create `src/routes/ManifestRoute.tsx` (public) - handled in router.tsx
- [x] 3.1.4 Create `src/routes/QRRoute.tsx` (public) - handled in router.tsx
- [x] 3.1.5 Create `src/routes/CreateActivityRoute.tsx` - handled in router.tsx
- [x] 3.1.6 Create `src/routes/EditActivityRoute.tsx` - handled in router.tsx

### 3.2 Implement Route Guards
- [x] 3.2.1 Create `src/components/ProtectedRoute.tsx` for auth-required routes
- [x] 3.2.2 Implement redirect to login for unauthenticated users
- [ ] 3.2.3 Preserve intended destination after login

### 3.3 Update Navigation
- [x] 3.3.1 Replace `setView()` calls with React Router navigation
- [x] 3.3.2 Update header links to use `<Link>` components
- [x] 3.3.3 Add proper back navigation support
- [x] 3.3.4 Test browser back/forward functionality

---

## Phase 4: PWA Implementation

### 4.1 Service Worker Configuration
- [x] 4.1.1 Configure precaching for app shell
- [x] 4.1.2 Configure runtime caching for Supabase API calls
- [x] 4.1.3 Configure cache-first strategy for static assets
- [x] 4.1.4 Configure network-first strategy for activity data

### 4.2 Offline Support
- [x] 4.2.1 Create offline detection hook (`useOnlineStatus`)
- [x] 4.2.2 Add offline indicator to UI
- [ ] 4.2.3 Disable mutation operations when offline
- [ ] 4.2.4 Test offline functionality

### 4.3 Update Flow
- [x] 4.3.1 Implement update prompt UI component
- [x] 4.3.2 Hook up service worker update detection
- [ ] 4.3.3 Test update flow with new builds

---

## Phase 5: Testing

### 5.1 Unit Tests
- [x] 5.1.1 Write tests for `useAuth` hook (covered in Auth.test.tsx)
- [ ] 5.1.2 Write tests for `useActivities` hook
- [x] 5.1.3 Write tests for utility functions in `src/lib/` (manifest.test.ts - 10 tests)

### 5.2 Component Tests
- [x] 5.2.1 Write tests for `Auth` component (9 tests)
- [ ] 5.2.2 Write tests for `Gallery` component
- [ ] 5.2.3 Write tests for `ProjectForm` component
- [ ] 5.2.4 Write tests for `ProjectCard` component
- [ ] 5.2.5 Write tests for `ManifestPage` component

### 5.3 Integration Tests
- [x] 5.3.1 Write tests for authentication flow (Auth.test.tsx)
- [ ] 5.3.2 Write tests for activity CRUD operations
- [x] 5.3.3 Write tests for routing behavior (router.test.tsx - 7 tests)

### 5.4 Coverage
- [x] 5.4.1 Generate coverage report
- [x] 5.4.2 Identify and fill gaps to reach 60% target (Achieved 94.2%!)
- [ ] 5.4.3 Add coverage thresholds to CI

---

## Phase 6: Deployment

### 6.1 Cloudflare Pages Configuration (Existing)
- [x] 6.1.1 Verify existing Cloudflare Pages build settings are correct for updated dependencies
- [x] 6.1.2 Verify environment variables are set (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] 6.1.3 Test preview deployment with modernization changes
- [ ] 6.1.4 Verify production deployment after merge

### 6.2 CI/CD Pipeline
- [x] 6.2.1 Create GitHub Actions workflow for CI
- [x] 6.2.2 Add lint check to CI
- [x] 6.2.3 Add type check to CI
- [x] 6.2.4 Add test run to CI
- [x] 6.2.5 Add build verification to CI

### 6.3 Production Optimization
- [ ] 6.3.1 Verify bundle splitting is optimal
- [ ] 6.3.2 Run Lighthouse audits
- [ ] 6.3.3 Address any Lighthouse recommendations
- [ ] 6.3.4 Verify PWA criteria are met (Lighthouse PWA audit)

---

## Phase 7: Validation and Cleanup

### 7.1 Cross-Browser Testing
- [ ] 7.1.1 Test in Chrome (latest 2 versions)
- [ ] 7.1.2 Test in Firefox (latest 2 versions)
- [ ] 7.1.3 Test in Safari (latest 2 versions)
- [ ] 7.1.4 Test in Edge (latest 2 versions)
- [ ] 7.1.5 Test on iOS Safari
- [ ] 7.1.6 Test on Android Chrome

### 7.2 Mobile Testing
- [ ] 7.2.1 Test installation flow on iOS
- [ ] 7.2.2 Test installation flow on Android
- [ ] 7.2.3 Verify responsive design at all breakpoints
- [ ] 7.2.4 Test touch interactions

### 7.3 Performance Validation
- [ ] 7.3.1 Achieve Lighthouse Performance score 90+
- [ ] 7.3.2 Achieve Lighthouse PWA score 90+
- [ ] 7.3.3 Verify TTI under 3 seconds
- [ ] 7.3.4 Verify bundle size under 230KB gzipped

### 7.4 Documentation
- [ ] 7.4.1 Update README with new development commands
- [ ] 7.4.2 Update CLAUDE.md with new patterns
- [ ] 7.4.3 Document Tailwind conventions used
- [ ] 7.4.4 Document PWA testing procedures

### 7.5 Final Cleanup
- [x] 7.5.1 Remove all legacy CSS files
- [x] 7.5.2 Remove unused dependencies
- [x] 7.5.3 Clean up any TODO comments
- [x] 7.5.4 Final code review

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Foundation | 2-3 days | None |
| Phase 2: CSS Migration | 3-4 days | Phase 1.1 |
| Phase 3: Routing | 1-2 days | Phase 1.3 |
| Phase 4: PWA | 1-2 days | Phase 1.2 |
| Phase 5: Testing | 2-3 days | Phases 1-4 |
| Phase 6: Deployment | 1 day | Phases 1-5 |
| Phase 7: Validation | 2-3 days | Phase 6 |

**Total Estimated Duration**: 2-3 weeks

---

## Notes

- CSS migration can happen in parallel with other Phase 2+ work
- PWA testing requires deployed environment for full validation
- Consider feature flags if incremental rollout is preferred
- Each phase should be validated before proceeding to the next
