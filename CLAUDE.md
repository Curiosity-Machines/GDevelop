# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # TypeScript compile + Vite production build
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

## Architecture Overview

Dopple Studio is a React 19 + TypeScript web app for creating and managing "Activity" configurations for the Dopple device. Activities store minimal configuration (name, URL, icon) that the Dopple device uses to launch web content.

### Data Flow

1. **Supabase Backend**: Single `activities` table with Row Level Security
2. **AuthContext** (`src/contexts/AuthContext.tsx`): Manages Supabase auth state, provides `useAuth()` hook
3. **useActivities hook** (`src/hooks/useActivities.ts`): CRUD operations that convert between DB schema and `SerializableActivityData` format
4. **Components**: Gallery view, ProjectForm for editing, ManifestPage for public JSON export

### Key Data Types

- `SerializableActivityData` (`src/types.ts`): The canonical activity configuration format with three fields:
  - `activityName` (required): Unique name identifier
  - `url` (optional): URL for the WebView activity
  - `iconPath` (optional): URL to the activity icon image
- `Database` types (`src/types/database.ts`): Supabase-generated types mirroring the SQL schema

### Routing

Simple URL-based routing in `App.tsx`:
- `/` - Gallery view (auth required)
- `/manifest/:id` - Public JSON manifest page (no auth required)

### Supabase Edge Functions

The `get-manifest` Edge Function provides programmatic API access to activity manifests:
- **Endpoint**: `{SUPABASE_URL}/functions/v1/get-manifest?id={activity-uuid}`
- **Method**: GET
- **Returns**: Raw JSON manifest (same format as `SerializableActivityData`)
- **Browser behavior**: Automatically redirects to `/manifest/:id` web UI page
- **Programmatic usage**: `curl "https://<project>.supabase.co/functions/v1/get-manifest?id=<uuid>"`
- **Force JSON from browser**: Add `?format=json` to bypass redirect

Deploy the function with:
```bash
supabase functions deploy get-manifest
```

The function requires `SITE_URL` environment variable set in Supabase to know where to redirect browsers.

### Environment Variables

Required in `.env`:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Database Schema

See `supabase/schema.sql` for the full schema. The schema includes:

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,        -- activityName (required)
  url TEXT,                  -- url (optional, for web URL source)
  icon_url TEXT,             -- iconPath (optional)
  bundle_path TEXT,          -- Path to zip bundle in storage (optional)
  entry_point TEXT,          -- Entry point HTML file within bundle (optional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Row Level Security policies allow:
- Users to CRUD their own activities
- Public read access for manifest endpoint

## Activity Bundle Support

Activities support two source types:
1. **Web URL**: Traditional URL pointing to hosted content
2. **Bundle Upload**: ZIP file containing a local copy of the activity

### Bundle Upload Flow
1. User selects "Upload Bundle" in the form
2. ZIP file is uploaded and parsed with JSZip
3. HTML files are extracted and presented as entry point options
4. Selected ZIP is stored in Supabase Storage (`activity-bundles` bucket)
5. The manifest URL is constructed as: `{SUPABASE_URL}/storage/v1/object/public/activity-bundles/{bundle_path}/{entry_point}`

### Storage Structure
Bundles are stored at: `activity-bundles/{user_id}/{activity_id}/bundle.zip`

### Migration
To add bundle support to an existing database, run the migration:
```bash
# Via Supabase CLI
supabase db push

# Or manually in SQL editor
# Run: supabase/migrations/20241216_add_bundle_support.sql
```

## OpenSpec

This project uses OpenSpec for spec-driven development. The openspec directory is at the project root (`/openspec/`).

### OpenSpec CLI Limitation

The `openspec` CLI only works when run from the **project root directory**. It does not find the openspec directory when run from `.claude/` or subdirectories, even though it's supposed to search upward.

**For agents running from `.claude/`:**
- Read openspec files using relative paths: `../openspec/AGENTS.md`, `../openspec/project.md`
- Run CLI commands from project root: `cd /Users/michaelfinkler/Dev/Dopple/dopple-studio && openspec list`

### Key Commands

```bash
openspec list              # List active changes (run from project root)
openspec list --specs      # List specifications
openspec show [item]       # Display change or spec
openspec validate --strict # Validate changes
```
