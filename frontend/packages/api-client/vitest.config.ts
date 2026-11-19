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
    // The client runs in a browser: the function it calls reads the session
    // from `localStorage`
    environment: 'jsdom',
    // The origin that the generated client sends its requests to.
    env: {
      VITE_BACKEND_BASE_URL: 'http://localhost:3000',
    },
  },
})
