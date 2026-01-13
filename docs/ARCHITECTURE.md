# Architecture Overview

This document describes the technical architecture of Dopple Studio, including component hierarchy, routing, state management, and PWA implementation.

## System Architecture

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|   Dopple Studio  | --> |    Supabase      | --> |   Dopple Device  |
|   (React PWA)    |     |  (Backend/DB)    |     |  (Reads Manifest)|
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
        |                        |
        v                        v
+------------------+     +------------------+
|  Cloudflare      |     |  Supabase        |
|  Pages (CDN)     |     |  Storage         |
+------------------+     +------------------+
```

### Data Flow

1. **User creates activity** in Dopple Studio
2. **Activity saved** to Supabase `activities` table
3. **Bundle uploaded** to Supabase Storage (if applicable)
4. **Manifest generated** with activity configuration
5. **Dopple device** fetches manifest via QR code URL
6. **Device launches** web content based on manifest

## Application Structure

```
src/
  main.tsx              # Application entry point
  router.tsx            # React Router configuration
  App.tsx               # Main authenticated view
  index.css             # Tailwind CSS + custom styles

  components/
    index.ts            # Barrel exports
    Auth.tsx            # Login/signup forms
    Gallery.tsx         # Activity grid with focus modal
    ProjectCard.tsx     # Activity card with actions
    ProjectForm.tsx     # Create/edit activity form
    QRCodeDisplay.tsx   # QR code generator
    ManifestPage.tsx    # Public manifest viewer
    PublicQRPage.tsx    # Shareable QR code page
    AccountSettings.tsx # User account management
    ProtectedRoute.tsx  # Authentication wrapper
    OfflineIndicator.tsx # Offline status banner
    PWAUpdatePrompt.tsx # Service worker update UI

  contexts/
    AuthContext.tsx     # Authentication state

  hooks/
    useActivities.ts    # Activity CRUD operations
    useOnlineStatus.ts  # Network status detection

  lib/
    supabase.ts         # Supabase client instance
    manifest.ts         # Manifest URL helpers

  types/
    database.ts         # Supabase generated types
    index.ts            # Application types
```

## React Router v7 Configuration

### Route Structure

```typescript
// src/router.tsx
export const router = createBrowserRouter([
  // Public routes (no authentication required)
  { path: '/login', element: <Auth /> },
  { path: '/manifest/:id', element: <ManifestPage /> },
  { path: '/qr/:id', element: <PublicQRPage /> },

  // Protected routes (authentication required)
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/', element: <App /> },
      { path: '/create', element: <App initialView="create" /> },
      { path: '/edit/:id', element: <App initialView="edit" /> },
    ],
  },

  // Catch-all redirect
  { path: '*', element: <Navigate to="/" replace /> },
])
```

### Route Diagram

```
                    +-------------+
                    |   Router    |
                    +-------------+
                          |
         +----------------+----------------+
         |                |                |
    Public Routes    Protected Routes   Catch-all
         |                |                |
    +----+----+     +-----+-----+    +-----+-----+
    |    |    |     |           |    |           |
/login /manifest /qr  ProtectedRoute  /*->Redirect
                          |
                    +-----+-----+
                    |     |     |
                   /    /create /edit/:id
                    \     |     /
                     \    |    /
                      +---+---+
                      |  App  |
                      +-------+
```

## Authentication Flow

### ProtectedRoute Component

```typescript
// src/components/ProtectedRoute.tsx
export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
```

### Authentication State Machine

```
                    +--------+
                    | Start  |
                    +--------+
                        |
                        v
                +---------------+
                | Check Session |
                +---------------+
                   |         |
          (no session)   (has session)
                   |         |
                   v         v
             +---------+ +--------+
             | /login  | |   /    |
             +---------+ +--------+
                   |         |
               (success)     |
                   |         |
                   +---------+
                        |
                        v
                  +----------+
                  | Redirect |
                  +----------+
```

### AuthContext

The `AuthContext` provides:

```typescript
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>
  linkIdentity: (provider: OAuthProvider) => Promise<{ error: Error | null }>
  getUserIdentities: () => Promise<{ identities: UserIdentity[]; error: Error | null }>
  unlinkIdentity: (identity: UserIdentity) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}
```

## State Management

### Hook-Based Architecture

State is managed through custom hooks rather than a global state library:

```
+----------------+     +------------------+
|  AuthContext   |     |  useActivities   |
| (Global Auth)  |     | (User Activities)|
+----------------+     +------------------+
        |                      |
        v                      v
+----------------+     +------------------+
|   useAuth()    |     | activities[]     |
| user, session  |     | loading, error   |
|   loading      |     | addActivity()    |
+----------------+     | updateActivity() |
                       | deleteActivity() |
                       +------------------+
```

### useActivities Hook

```typescript
// Returned from useActivities()
interface UseActivitiesReturn {
  activities: ActivityWithRelations[]
  loading: boolean
  error: string | null
  uploadProgress: UploadProgress | null
  addActivity: (data: ActivityFormData, bundleFile?: File) => Promise<ActivityWithRelations | null>
  updateActivity: (id: string, data: Partial<ActivityFormData>, bundleFile?: File, clearBundle?: boolean) => Promise<void>
  deleteActivity: (id: string) => Promise<void>
  getActivity: (id: string) => ActivityWithRelations | undefined
  refetch: () => Promise<void>
}
```

### Data Flow Diagram

```
+----------+     +-----------+     +----------+
|  Gallery |     | useActivities   | Supabase |
+----------+     +-----------+     +----------+
     |                 |                |
     |  onEdit(act)    |                |
     +---------------->|                |
     |                 | updateActivity |
     |                 +--------------->|
     |                 |                |
     |                 |<---------------+
     |                 | (success)      |
     |                 |                |
     |<----------------+                |
     | (re-render)     |                |
     +                 +                +
```

## Component Hierarchy

### Main Application Tree

```
<StrictMode>
  <AuthProvider>
    <RouterProvider router={router}>
      <!-- Route Components -->
    </RouterProvider>
    <OfflineIndicator />
    <PWAUpdatePrompt />
  </AuthProvider>
</StrictMode>
```

### App Component Tree

```
App
  +-- Header
  |     +-- Logo
  |     +-- "New Activity" Button
  |     +-- "Account" Button
  |     +-- "Sign Out" Button
  |
  +-- Main
  |     +-- Gallery (view === 'gallery')
  |     |     +-- ProjectCard[] (for each activity)
  |     |     +-- FocusModal (when activity selected)
  |     |           +-- ProjectCard (focused)
  |     |           +-- QRCodeDisplay
  |     |
  |     +-- ProjectForm (view === 'create' | 'edit')
  |           +-- Form Fields
  |           +-- Bundle Upload
  |           +-- Entry Point Selector
  |
  +-- Footer
  |
  +-- AccountSettings (modal, when shown)
```

### Public Route Components

```
ManifestPage
  +-- Manifest JSON Display
  +-- Activity Details
  +-- QR Code Link

PublicQRPage
  +-- QR Code Display
  +-- Activity Name
  +-- Manifest Link
```

## PWA Architecture

### Service Worker Configuration

```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.webp', 'dopple_logo.webp'],
  manifest: {
    name: 'Dopple Studio',
    short_name: 'Dopple',
    theme_color: '#6366f1',
    display: 'standalone',
    icons: [...],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'supabase-api-cache', ... },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
        handler: 'CacheFirst',
        options: { cacheName: 'supabase-storage-cache', ... },
      },
    ],
  },
})
```

### Caching Strategy Diagram

```
                    +-------------+
                    |   Request   |
                    +-------------+
                          |
              +-----------+-----------+
              |                       |
         Static Asset            API/Storage
              |                       |
              v                       v
        +----------+          +---------------+
        | Precache |          | Runtime Cache |
        | (Build)  |          | (On Demand)   |
        +----------+          +---------------+
              |                   |       |
              |            NetworkFirst CacheFirst
              |               (API)    (Storage)
              |                   |       |
              v                   v       v
        +------------------------------------------+
        |               Cache Storage              |
        +------------------------------------------+
```

### PWA Components

**OfflineIndicator**
- Displays when `navigator.onLine` is false
- Uses `useOnlineStatus` hook for reactivity

**PWAUpdatePrompt**
- Shows when service worker detects new version
- Uses `useRegisterSW` from vite-plugin-pwa
- Provides "Update" button to reload with new version

### Online Status Hook

```typescript
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

## Data Models

### Activity Types

```typescript
// Minimal activity data for Dopple device
interface SerializableActivityData {
  activityName: string
  url?: string
  iconPath?: string
  bundleUrl?: string
  webViewResolution?: number
}

// Full activity with metadata
interface ActivityWithRelations {
  id: string
  name: string
  url?: string
  icon?: string
  bundlePath?: string
  entryPoint?: string
  activityConfig: SerializableActivityData
  createdAt: number
  updatedAt: number
}

// Form data for create/update
type ActivityFormData = Omit<ActivityWithRelations, 'id' | 'createdAt' | 'updatedAt'> & {
  iconBundlePath?: string
}
```

### Database Schema

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  bundle_path TEXT,
  entry_point TEXT,
  webview_resolution REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activities"
  ON activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own activities"
  ON activities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activities"
  ON activities FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own activities"
  ON activities FOR DELETE
  USING (auth.uid() = user_id);

-- Public read for manifest endpoint
CREATE POLICY "Public can read activities"
  ON activities FOR SELECT
  USING (true);
```

## Bundle Upload Flow

### Upload Sequence

```
User                ProjectForm           useActivities          Supabase
  |                      |                      |                    |
  |  Select ZIP file     |                      |                    |
  +--------------------->|                      |                    |
  |                      |                      |                    |
  |  Select entry point  |                      |                    |
  +--------------------->|                      |                    |
  |                      |                      |                    |
  |      Submit          |                      |                    |
  +--------------------->|                      |                    |
  |                      |   addActivity(data, file)                 |
  |                      +--------------------->|                    |
  |                      |                      |                    |
  |                      |                      | INSERT activity    |
  |                      |                      +------------------>|
  |                      |                      |<------------------+
  |                      |                      | activity.id       |
  |                      |                      |                    |
  |                      |                      | uploadBundle(id, file)
  |                      |                      +------------------>|
  |                      |                      |<------------------+
  |                      |                      | bundlePath        |
  |                      |                      |                    |
  |                      |                      | UPDATE activity   |
  |                      |                      +------------------>|
  |                      |                      |                    |
  |                      |<---------------------+                    |
  |                      | (success)            |                    |
  |<---------------------+                      |                    |
  | (redirect to /)      |                      |                    |
```

### Storage Structure

```
activity-bundles/
  {user_id}/
    {activity_id}/
      bundle.zip        # The ZIP file
      icon.png          # Extracted icon (if from bundle)
```

## Build Configuration

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({ ... }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
          'utils': ['jszip', 'qrcode.react', 'uuid'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
```

### Chunk Strategy

| Chunk | Contents | Caching Benefit |
|-------|----------|-----------------|
| react-vendor | React runtime | Rarely changes |
| supabase | Supabase client | Rarely changes |
| utils | JSZip, QRCode, UUID | Rarely changes |
| index | Application code | Changes frequently |

## Error Handling

### API Error Flow

```
+----------+     +---------+     +----------+
|  Hook    |     |  State  |     |    UI    |
+----------+     +---------+     +----------+
     |                |               |
     | error occurs   |               |
     +--------------->|               |
     | setError(msg)  |               |
     |                |               |
     |                +-------------->|
     |                | error prop    |
     |                |               |
     |                |         +-----+-----+
     |                |         | Toast/    |
     |                |         | Banner    |
     |                |         +-----------+
```

### Error States

- **Loading**: Show spinner while fetching
- **Error**: Show error message with retry option
- **Empty**: Show empty state with CTA
- **Offline**: Show offline indicator banner

## Security Considerations

### Client-Side Security

- Environment variables prefixed with `VITE_` only
- Supabase anon key is safe to expose (RLS enforces security)
- No secrets in client code

### Server-Side Security

- Row Level Security on all tables
- User-scoped queries in hooks
- Storage policies restrict bucket access

### Authentication Security

- OAuth with secure redirect handling
- Session management via Supabase
- No password stored in application
