import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Cambiamos el puerto aquí
    strictPort: true, 
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
})