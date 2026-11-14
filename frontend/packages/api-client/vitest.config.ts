import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The origin that the generated client sends its requests to.
    env: {
      VITE_BACKEND_BASE_URL: 'http://localhost:3000',
    },
  },
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
