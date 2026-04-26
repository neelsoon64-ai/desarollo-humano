import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 1. Agregamos esta importación

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    tailwindcss() // 2. Agregamos el plugin aquí
  ],
  base: '/',
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    hmr: {
      overlay: false
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})