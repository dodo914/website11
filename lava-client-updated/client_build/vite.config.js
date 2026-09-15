import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // Backend (Express) confirmed running on port 5001 on this machine
      // (PORT=5001 is set outside server_build/.env — as an OS-level
      // environment variable — since the .env file itself has no PORT key
      // and server.js's own fallback is 5000). Keep this in sync with
      // whatever port the terminal running "node server.js" actually prints
      // ("🚀 Server running on port ...") if that ever changes.
      '/api': 'http://localhost:5001'
    }
  }
})