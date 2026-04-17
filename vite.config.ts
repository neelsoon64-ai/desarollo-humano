import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true, // Esto evita que salte al 3001 si el 3000 está ocupado
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
  },
})