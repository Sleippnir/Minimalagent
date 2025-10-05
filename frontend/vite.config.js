import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        'dashboards/hr/index': './dashboards/hr/index.html',
        'candidate/index': './candidate/index.html'
      }
    }
  },
  server: {
    fs: {
      // Allow serving files from all directories
      allow: ['.']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})