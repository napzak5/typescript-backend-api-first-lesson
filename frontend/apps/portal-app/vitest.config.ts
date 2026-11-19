import { defaultClientConditions, defaultServerConditions } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// Workspace packages are tested from source, not from their last build
const SOURCE = '@beauty-salon-frontend/source'

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
    setupFiles: ['@beauty-salon-frontend/testing/setup', './vitest.setup.ts'],
    // The tests that need the API are run by `test:integration`
    exclude: [...configDefaults.exclude, '**/*.integration.test.*'],
    css: {
      // The class names of the CSS Modules, as they are written
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
})
