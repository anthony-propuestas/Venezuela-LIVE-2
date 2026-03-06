import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Solo rutas /api/... van al worker; /api.js es el módulo del frontend y lo sirve Vite
      '/api/': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
})
