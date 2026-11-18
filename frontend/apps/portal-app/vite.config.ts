import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@', replacement: resolve(import.meta.dirname, './src') },
      ],
    },
    server: {
      port: 3001,
      strictPort: true,
      // This machine only, like the backend and the services of docker compose.
      // `--host` opens it to the network for one run
      host: '127.0.0.1',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react')) {
              return 'react-vendor'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'react-query'
            }
            if (id.includes('@beauty-salon-frontend/')) {
              return 'workspace-packages'
            }
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          },
        },
        plugins: [
          mode === 'analyze' &&
            visualizer({
              open: true,
              filename: 'dist/stats.html',
              gzipSize: true,
              brotliSize: true,
            }),
        ].filter(Boolean),
      },
    },
  }
})
