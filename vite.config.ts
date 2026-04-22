import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Asegura que las rutas partan desde la raíz
  server: {
    port: 3000,
    strictPort: false,
    host: true,
    hmr: {
      overlay: false
    }
  },
  build: {
    outDir: 'dist', // Directorio que Vercel busca por defecto
    sourcemap: false
  }
})