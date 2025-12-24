import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React and React DOM into their own chunk
          'react-vendor': ['react', 'react-dom'],
          // Split Supabase into its own chunk (it's quite large)
          'supabase': ['@supabase/supabase-js'],
          // Split utility libraries
          'utils': ['jszip', 'qrcode.react', 'uuid'],
        },
      },
    },
    // Increase chunk size warning limit to 600kb (optional, but helps reduce noise)
    chunkSizeWarningLimit: 600,
  },
})
