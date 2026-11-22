import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setup/setup.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.*'],
  },
})
