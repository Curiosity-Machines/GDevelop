# Development Guide

This guide covers local development setup, testing practices, and coding conventions for Dopple Studio.

## Local Development Setup

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm 9+**
- A Supabase project with the required schema (see `supabase/schema.sql`)

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd dopple-studio

# Install dependencies
npm install

# Create environment file from example
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR (http://localhost:5173) |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run lint` | Run ESLint on all files |
| `npm run preview` | Preview production build locally |
| `npm test` | Run Vitest in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

### Development Server

The development server runs on `http://localhost:5173` with:

- Hot Module Replacement (HMR) for instant updates
- TypeScript error overlay
- Tailwind CSS JIT compilation
- PWA disabled in development (use production build to test PWA)

## Testing

### Test Framework

The project uses **Vitest** with **React Testing Library**:

- **Vitest**: Fast unit test runner compatible with Vite
- **React Testing Library**: Component testing with user-centric queries
- **jsdom**: Browser environment simulation

### Test Structure

Tests mirror the source directory structure:

```
src/
  components/
    Gallery.tsx
  test/
    components/
      Gallery.test.tsx
    hooks/
      useActivities.test.ts
    contexts/
      AuthContext.test.tsx
    setup.ts
```

### Running Tests

```bash
# Watch mode (re-runs on file changes)
npm test

# Single run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/test/components/Gallery.test.tsx

# Run tests matching a pattern
npm test -- --grep "Gallery"
```

### Test Configuration

Located in `vitest.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,              // Use global describe, it, expect
    environment: 'jsdom',       // Browser-like environment
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts'],
    },
  },
})
```

### Writing Tests

#### Component Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Gallery } from '../../components/Gallery'

// Mock child components for isolation
vi.mock('../../components/ProjectCard', () => ({
  ProjectCard: ({ project, onEdit }: Props) => (
    <div data-testid={`card-${project.id}`}>
      <button onClick={() => onEdit(project)}>Edit</button>
    </div>
  ),
}))

describe('Gallery', () => {
  const mockOnEdit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no projects', () => {
    render(<Gallery projects={[]} onEdit={mockOnEdit} />)
    expect(screen.getByText('No Activities Yet')).toBeInTheDocument()
  })

  it('calls onEdit when edit is clicked', () => {
    const project = { id: '1', name: 'Test' }
    render(<Gallery projects={[project]} onEdit={mockOnEdit} />)

    fireEvent.click(screen.getByText('Edit'))
    expect(mockOnEdit).toHaveBeenCalledWith(project)
  })
})
```

#### Hook Test Example

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

describe('useOnlineStatus', () => {
  it('returns initial online status', () => {
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(navigator.onLine)
  })

  it('updates when going offline', () => {
    const { result } = renderHook(() => useOnlineStatus())

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })
})
```

### Test Setup File

`src/test/setup.ts` contains global mocks:

```typescript
import '@testing-library/jest-dom'

// Mock browser APIs not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
```

### Coverage Reports

After running `npm run test:coverage`:

- **Console**: Summary printed to terminal
- **HTML**: Detailed report in `coverage/index.html`
- **JSON**: Machine-readable data in `coverage/coverage-final.json`

Current coverage: **94.2%**

## Tailwind CSS Patterns

### Theme Configuration

Custom theme values in `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-dopple-bg: #f9fafb;
  --color-dopple-surface: #ffffff;
  --color-dopple-accent: #6366f1;
  --color-dopple-text: #111827;
  --color-dopple-muted: #6b7280;
  --font-family-sans: 'Inter', system-ui, sans-serif;
}
```

Use custom values with: `bg-dopple-bg`, `text-dopple-accent`, etc.

### Base Styles

Base styles are defined in the `@layer base` section:

- Box-sizing border-box on all elements
- Custom scrollbar styling
- Link hover colors
- Selection styling

### Common Utility Patterns

#### Buttons

Primary button:
```jsx
<button className="px-6 py-3 bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-medium rounded-[10px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)]">
  Create Activity
</button>
```

Secondary button:
```jsx
<button className="px-5 py-2.5 bg-transparent text-gray-600 border border-gray-200 rounded-lg transition-all duration-200 hover:bg-gray-100 hover:text-gray-900">
  Cancel
</button>
```

#### Cards

```jsx
<div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-5 transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] hover:-translate-y-0.5">
  Card content
</div>
```

#### Responsive Design

Use `max-md:` for mobile overrides:
```jsx
<header className="px-10 py-[30px] max-md:px-5 max-md:py-4 max-md:flex-wrap">
```

#### Loading Spinner

```jsx
<div className="w-10 h-10 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin-slow" />
```

### Animations

Custom animations defined in `src/index.css`:

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.animate-spin-slow {
  animation: spin 1s linear infinite;
}
```

Use with: `animate-[fadeIn_0.2s_ease-out]`, `animate-[scaleIn_0.3s_cubic-bezier(0.16,1,0.3,1)]`

## Component Structure

### Component Organization

Components are organized by feature:

```
src/components/
  Auth.tsx              # Authentication forms (login/signup)
  Gallery.tsx           # Activity grid display
  ProjectCard.tsx       # Individual activity card
  ProjectForm.tsx       # Create/edit activity form
  QRCodeDisplay.tsx     # QR code generation
  ManifestPage.tsx      # Public manifest viewer
  PublicQRPage.tsx      # Shareable QR code page
  AccountSettings.tsx   # User account management
  ProtectedRoute.tsx    # Auth-required route wrapper
  OfflineIndicator.tsx  # Offline status banner
  PWAUpdatePrompt.tsx   # Service worker update prompt
  index.ts              # Barrel export file
```

### Component Conventions

1. **Named exports**: Use named exports, not default exports
   ```typescript
   export function Gallery() { ... }
   ```

2. **Props interfaces**: Define inline or separately for complex props
   ```typescript
   interface GalleryProps {
     projects: ProjectManifest[];
     onEdit: (project: ProjectManifest) => void;
   }
   ```

3. **Hooks at top**: All hooks called at the top of the function
4. **Event handlers**: Prefix with `handle` (e.g., `handleSubmit`)
5. **Barrel exports**: Re-export all components from `index.ts`

## Routing

### Route Configuration

Routes are defined in `src/router.tsx`:

```typescript
import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <Auth /> },
  { path: '/manifest/:id', element: <ManifestPage /> },
  { path: '/qr/:id', element: <PublicQRPage /> },

  // Protected routes (require authentication)
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

### Navigation

Use React Router hooks for navigation:

```typescript
import { useNavigate, useParams } from 'react-router-dom'

function MyComponent() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const handleEdit = () => {
    navigate(`/edit/${id}`)
  }
}
```

## PWA Development

### Development vs Production

PWA features (service worker, caching) are **only active in production builds**.

To test PWA locally:

```bash
# Build production version
npm run build

# Serve with Vite preview
npm run preview
```

### Testing Service Worker

1. Open Chrome DevTools > Application tab
2. Check Service Workers section for registration
3. Check Cache Storage for cached assets
4. Use Network tab "Offline" checkbox to test offline mode

### PWA Update Flow

When a new version is deployed:

1. Service worker detects new assets
2. `PWAUpdatePrompt` component displays "Update available" banner
3. User clicks "Update" to reload with new version

## Common Development Tasks

### Adding a New Component

1. Create component file: `src/components/NewComponent.tsx`
2. Add to barrel export: `src/components/index.ts`
3. Create test file: `src/test/components/NewComponent.test.tsx`
4. Update routing if needed: `src/router.tsx`

### Adding a New Route

1. Add route to `src/router.tsx`
2. If protected, nest under `ProtectedRoute` element
3. Update navigation in relevant components

### Modifying the Database Schema

1. Create migration in `supabase/migrations/`
2. Update TypeScript types in `src/types/database.ts`
3. Update hooks in `src/hooks/useActivities.ts`
4. Deploy migration: `supabase db push`

## Troubleshooting

### Common Issues

**Vite HMR not working**
- Check for syntax errors in edited file
- Restart dev server: `npm run dev`

**Tests failing with "not wrapped in act"**
- Wrap state updates in `act()` from testing-library
- Use `waitFor` for async state changes

**TypeScript errors not showing**
- Run `npx tsc --noEmit` to check types
- Restart TypeScript language server in IDE

**PWA not caching correctly**
- Clear browser cache and service worker
- Rebuild: `npm run build`
- Check workbox configuration in `vite.config.ts`
