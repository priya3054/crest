import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The React dev server runs on :5173 and the Express API on :4000.
// Proxy /api so the browser can call the backend same-origin (no CORS fuss).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      // WebSocket for live price ticks (Socket.IO)
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})
