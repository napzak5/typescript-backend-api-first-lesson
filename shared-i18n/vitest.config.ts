import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Functions of languages and of texts: no document is needed
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
