import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run dev -- --mode livedata` reads the public catalog and the exchange
// rate from the live site, so a local preview shows real products and IQD
// prices without the local API running. Everything else still goes to it.
const LIVE_SITE = { target: 'https://itlandforcomputer.com', changeOrigin: true }

export default defineConfig(({ isSsrBuild, mode }) => ({
  plugins: [react()],
  // Vercel traces API files before this generated renderer exists. Bundle its
  // package dependencies so the deployed function does not omit React Router.
  ssr: { noExternal: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: isSsrBuild ? undefined : {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      ...(mode === 'livedata' ? { '/api/currency': LIVE_SITE, '/api/products': LIVE_SITE } : {}),
      '/api': 'http://127.0.0.1:3001',
    },
  },
}))
