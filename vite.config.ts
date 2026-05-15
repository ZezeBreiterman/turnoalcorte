import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: true,
    // Vendor chunk splitting via rolldown function form
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion'))     return 'vendor-motion'
            if (id.includes('@supabase'))          return 'vendor-supabase'
            if (id.includes('@tanstack'))          return 'vendor-query'
            if (id.includes('@radix-ui'))          return 'vendor-radix'
            if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react'
            if (id.includes('react'))              return 'vendor-react'
            return 'vendor-misc'
          }
        },
      },
    },
  },
})
