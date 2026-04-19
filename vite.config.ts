import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false, // Permitir que use 3001, 3002, etc. si es necesario
    host: true,       // Esto ayuda a que la red local lo vea mejor
    hmr: {
      overlay: false  // Evita que los errores tapen la pantalla
    }
  }
})