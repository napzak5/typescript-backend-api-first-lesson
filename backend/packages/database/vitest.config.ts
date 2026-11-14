import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Workspace packages are tested from source, not from their last build.
  ssr: {
    resolve: {
      conditions: [
        '@beauty-salon-backend/source',
        'module',
        'node',
        'development|production',
      ],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
  },
})
