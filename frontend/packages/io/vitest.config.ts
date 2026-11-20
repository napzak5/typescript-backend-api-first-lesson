import { defaultClientConditions, defaultServerConditions } from 'vite'
import { defineConfig } from 'vitest/config'

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
    // The package runs in a browser: it keeps the session in `localStorage`,
    // and saves the files a page made
    environment: 'jsdom',
    setupFiles: ['@beauty-salon-frontend/testing/setup'],
  },
})
