import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  server: {
    host: '0.0.0.0', // Permitir conexiones desde cualquier IP de la red local
    port: 5173,
    strictPort: false,
  },
})
