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

Dopple Studio is a React 19 + TypeScript web app for creating and managing "Activity" configurations for the Dopple device. Activities define how the Dopple device maps physical inputs (buttons, gyro gestures) to keyboard keys when interacting with web content.

### Data Flow

1. **Supabase Backend**: Three normalized tables (`activities`, `activity_bubbles`, `activity_input_mappings`) with Row Level Security
2. **AuthContext** (`src/contexts/AuthContext.tsx`): Manages Supabase auth state, provides `useAuth()` hook
3. **useActivities hook** (`src/hooks/useActivities.ts`): CRUD operations that convert between DB schema and `SerializableActivityData` format
4. **Components**: Gallery view, ProjectForm for editing, ManifestPage for public JSON export

### Key Data Types

- `SerializableActivityData` (`src/types.ts`): The canonical activity configuration format, matching what the Dopple device consumes
- `Database` types (`src/types/database.ts`): Supabase-generated types mirroring the SQL schema
- The hook converts between these formats using `dbToActivityConfig()`

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

See `supabase/schema.sql` for the full schema. Key points:
- `activities` is the main table with all activity settings
- `activity_bubbles` stores unlock recipe requirements (linked by `activity_id`)
- `activity_input_mappings` stores device-to-keyboard mappings (linked by `activity_id`)
- Cascading deletes clean up child records automatically

## Type Constants

Use const objects instead of enums for TypeScript's `erasableSyntaxOnly`:
- `BubbleType`: Color (0), Item (1), Empty (2)
- `DeviceInput`: None (0), BackBtn (2), FrontBtn (3), RollRight (4), etc.
- `KeyAction`: Press (0), Hold (1), Toggle (2), Continuous (3)
