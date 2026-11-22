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
    // Functions of the answers of the API: no document is needed
    environment: 'node',
  },
})
