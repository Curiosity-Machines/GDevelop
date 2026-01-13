# Project Context

## Purpose
Dopple Studio is a web application for creating and managing "Activity" configurations for the Dopple device. Activities are minimal configuration objects (name, URL, icon) that the Dopple device uses to launch web content. The app supports both hosted web URLs and uploaded ZIP bundles containing local web content.

## Tech Stack
- **React 19** with TypeScript 5.9 (strict mode)
- **Vite 7** for build tooling and dev server
- **Supabase** for authentication, PostgreSQL database, and file storage
- **ESLint 9** with React Hooks and React Refresh plugins
- **JSZip** for client-side ZIP file handling
- **qrcode.react** for QR code generation

## Project Conventions

### Code Style
- TypeScript strict mode with all linting rules enabled (`noUnusedLocals`, `noUnusedParameters`, etc.)
- ES2022 target with ESNext modules
- Functional React components with hooks
- Colocated CSS files (e.g., `Component.tsx` + `Component.css`)
- PascalCase for components, camelCase for functions/variables
- Types defined in `src/types.ts` and `src/types/*.ts`

### Architecture Patterns
- **Simple URL-based routing** in `App.tsx` (no router library)
- **Context pattern** for global state (e.g., `AuthContext`)
- **Custom hooks** for data fetching and mutations (e.g., `useActivities`)
- **Supabase client** initialized in `src/lib/supabase.ts`
- **Row Level Security (RLS)** for database access control
- Data flows: Supabase → Custom Hook → Components

### File Organization
```
src/
├── components/     # React components with colocated CSS
├── contexts/       # React contexts (AuthContext)
├── hooks/          # Custom hooks (useActivities)
├── lib/            # Utilities and Supabase client
├── types/          # TypeScript type definitions
├── App.tsx         # Main app with routing logic
└── main.tsx        # Entry point
```

### Testing Strategy
No formal testing framework is currently configured. Manual testing via `npm run dev`.

### Git Workflow
- Main branch: `main`
- Direct commits to main for this project
- Conventional commit messages recommended

## Domain Context

### Key Concepts
- **Activity**: A configuration that tells the Dopple device what web content to display
- **SerializableActivityData**: The canonical activity format with `activityName`, `url`, `iconPath`, `bundleUrl`, and `webViewResolution`
- **Bundle**: A ZIP file containing local web content (HTML, CSS, JS, assets)
- **Entry Point**: The HTML file within a bundle to load (e.g., `index.html`)
- **Manifest**: Public JSON endpoint for activities at `/manifest/:id`

### Activity Source Types
1. **Web URL**: External hosted URL
2. **Bundle Upload**: ZIP file stored in Supabase Storage with `file://` URL format

### Key Routes
- `/` - Gallery view (authenticated)
- `/manifest/:id` - Public JSON manifest page
- `/qr/:id` - Public QR code page for sharing

## Important Constraints
- Activities are user-scoped via Supabase RLS
- Bundles stored at `activity-bundles/{user_id}/{activity_id}/bundle.zip`
- Public read access required for manifests and bundles (device needs to fetch them)
- No SSR - client-side only

## External Dependencies

### Supabase
- **Auth**: Email/password and OAuth (GitHub, Google, GitLab, Bitbucket)
- **Database**: PostgreSQL with single `activities` table
- **Storage**: `activity-bundles` bucket for ZIP uploads
- **Edge Functions**: `get-manifest` for API access to manifests

### Environment Variables
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### Supabase Edge Functions
Deploy with: `supabase functions deploy get-manifest`
Requires `SITE_URL` environment variable in Supabase.
