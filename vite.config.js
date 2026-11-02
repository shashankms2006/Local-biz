import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // The browser only talks to Vite; /api goes to the local Express server that holds the Google key.
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
})