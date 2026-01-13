import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"https://test.supabase.co"',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '"test-anon-key"',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    alias: {
      'virtual:pwa-register/react': path.resolve(__dirname, './src/test/__mocks__/pwaRegister.ts'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Integration hook excluded from unit test coverage - tested via E2E
        'src/hooks/useActivities.ts',
        // Type definitions that cannot be tested
        'src/types/database.ts',
        // Simple re-export file
        'src/components/index.ts',
      ],
    },
  },
})
