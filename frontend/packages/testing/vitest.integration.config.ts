import { defaultClientConditions, defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

// Workspace packages are tested from source, not from their last build
const SOURCE = '@beauty-salon-frontend/source'

/**
 * The tests that call the API run against the test server of the backend,
 * which needs a PostgreSQL: the one at TEST_DATABASE_URL when it is set,
 * otherwise a container (and so a running Docker daemon).
 */
export default defineConfig({
  resolve: {
    conditions: [SOURCE, ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: [SOURCE, ...defaultServerConditions],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.integration.test.{ts,tsx}'],
    globalSetup: ['./src/api/global-setup.ts'],
    setupFiles: ['./src/setup.ts', './src/api/setup.ts'],
  },
})
