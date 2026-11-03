import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served by GitHub Pages at https://academiccat16.github.io/venture-3d-studio/
export default defineConfig({
  base: '/venture-3d-studio/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2000 },
})
