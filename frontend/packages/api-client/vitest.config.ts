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
    // from `localStorage`, and the language of the page from there and from
    // the languages of the browser, which the setup sets to Japanese
    environment: 'jsdom',
    setupFiles: ['@beauty-salon-frontend/testing/setup'],
    // The origin that the generated client sends its requests to.
    env: {
      VITE_BACKEND_BASE_URL: 'http://localhost:3000',
    },
  },
})
