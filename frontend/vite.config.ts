import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections
    port: 5173,
    // Enable HTTPS for development (required for getUserMedia on mobile)
    // Set VITE_HTTPS=true to enable. Vite will auto-generate a self-signed certificate
    https: process.env.VITE_HTTPS === 'true',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})


