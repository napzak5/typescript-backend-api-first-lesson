import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['**/src'],
      exclude: ['**/index.{ts,tsx}'],
    },
    exclude: ['node_modules'],
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
})
