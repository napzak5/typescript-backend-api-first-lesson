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
})
