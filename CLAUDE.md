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
