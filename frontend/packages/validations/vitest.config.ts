import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Workspace packages are tested from source, not from their last build.
  ssr: {
    resolve: {
      conditions: [
        '@beauty-salon-frontend/source',
        'module',
        'node',
        'development|production',
      ],
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: ['**/src'],
      exclude: ['**/index.{ts,tsx}'],
    },
    exclude: ['node_modules'],
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
})
