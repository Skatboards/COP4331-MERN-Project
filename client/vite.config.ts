import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Vite rejects requests for hostnames other than localhost; allow the
    // deployed domain (DOMAIN in the droplet's .env, passed in by Compose)
    allowedHosts: process.env.DOMAIN ? [process.env.DOMAIN] : [],
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://backend:3000',
        changeOrigin: true,
      },
    },
  },
})
