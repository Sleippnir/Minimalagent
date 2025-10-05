import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'dashboards/hr/index': './dashboards/hr/index.html'
      }
    }
  },
  server: {
    fs: {
      // Allow serving files from all directories
      allow: ['.']
    }
  }
})