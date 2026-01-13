# Dopple Studio

A React 19 + TypeScript web application for creating and managing Activity configurations for Dopple devices. Activities store minimal configuration (name, URL, icon) that the Dopple device uses to launch web content.

## Features

- Create and manage activity configurations with QR code generation
- Upload ZIP bundles for offline/local activity content
- PWA support with offline capabilities and installability
- OAuth authentication with GitHub and Google
- Real-time activity synchronization with Supabase

## Tech Stack

- **React 19** with TypeScript
- **Tailwind CSS v4** for styling
- **React Router v7** for client-side routing
- **Vite** for development and building
- **Vitest** for testing (94.2% coverage)
- **Supabase** for backend (database, auth, storage)
- **vite-plugin-pwa** for PWA capabilities

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- A Supabase project with the required schema

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dopple-studio

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file with:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
npm run dev       # Start development server with HMR
npm run build     # TypeScript compile + Vite production build
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

### Testing

```bash
npm test              # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

Tests are located in `src/test/` and use Vitest with React Testing Library. The test suite includes:

- 90 tests across components, hooks, and utilities
- 94.2% code coverage
- Mocked Supabase client for isolation

## Project Structure

```
src/
  components/     # React components
  contexts/       # React contexts (AuthContext)
  hooks/          # Custom hooks (useActivities, useOnlineStatus)
  lib/            # Utilities (supabase client, manifest helpers)
  test/           # Test files mirroring src structure
  types/          # TypeScript type definitions
  router.tsx      # React Router configuration
  App.tsx         # Main application component
  main.tsx        # Application entry point
  index.css       # Tailwind CSS entry point
```

## Tailwind CSS Conventions

This project uses Tailwind CSS v4 with the following patterns:

### Theme Customization

Custom theme values are defined in `src/index.css` using the `@theme` directive:

```css
@theme {
  --color-dopple-bg: #f9fafb;
  --color-dopple-surface: #ffffff;
  --color-dopple-accent: #6366f1;
  --color-dopple-text: #111827;
  --color-dopple-muted: #6b7280;
}
```

### Common Patterns

- **Responsive modifiers**: `max-md:` for mobile-first breakpoints
- **Gradients**: `bg-gradient-to-br from-indigo-500 to-violet-500`
- **Transitions**: `transition-all duration-200`
- **Hover states**: `hover:-translate-y-0.5 hover:shadow-lg`

## PWA Features

Dopple Studio is a Progressive Web App with:

- **Installability**: Can be installed on desktop and mobile devices
- **Offline support**: Cached assets and API responses
- **Auto-update**: Automatic service worker updates with user prompt

### Caching Strategy

- **Static assets**: Precached during service worker installation
- **Supabase API**: NetworkFirst with 24-hour cache fallback
- **Storage assets**: CacheFirst with 7-day cache

### Testing PWA Locally

1. Build the production version: `npm run build`
2. Preview locally: `npm run preview`
3. Open Chrome DevTools > Application > Service Workers
4. Test offline by toggling "Offline" in Network tab

## Deployment

The project is configured for Cloudflare Pages deployment.

- **Build command**: `npm run build`
- **Output directory**: `dist/`
- **Environment variables**: Set in Cloudflare dashboard

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## CI/CD

GitHub Actions runs on every push and pull request to main:

1. Linting with ESLint
2. TypeScript type checking
3. Running test suite
4. Production build

Build artifacts are uploaded and retained for 7 days.

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Local development setup and practices
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment procedures
- [Architecture](docs/ARCHITECTURE.md) - Technical architecture overview

## Database Schema

The application uses a single `activities` table in Supabase:

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
```

Row Level Security policies ensure users can only access their own activities.

## License

Private - Dopple Inc.
