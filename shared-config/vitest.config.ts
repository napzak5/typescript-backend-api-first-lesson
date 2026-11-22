import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['vite/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'vite/__fixtures__/**'],
  },
})
