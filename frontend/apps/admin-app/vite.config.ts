import { resolve } from 'node:path'
import { brand } from '@beauty-salon-frontend/brand/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defaultClientConditions, defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  return {
    // The name of the application, its icons and what a link to it shows
    plugins: [react(), brand('admin')],
    resolve: {
      alias: [
        { find: '@', replacement: resolve(import.meta.dirname, './src') },
      ],
      // The dev server reads the workspace packages from source: a change
      // shows at once, and no page waits for a package to be rebuilt. A build
      // reads what the packages built.
      conditions: [
        ...(command === 'serve' ? ['@beauty-salon-frontend/source'] : []),
        ...defaultClientConditions,
      ],
    },
    server: {
      port: 3002,
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
