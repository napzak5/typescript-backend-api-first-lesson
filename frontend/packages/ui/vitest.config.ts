import { frontendTests } from '@beauty-salon-shared/config/vitest'

export default frontendTests({
  unit: {
    environment: 'jsdom',
    // The stories a test composes are rendered as the catalogue renders
    // them: with the preview of this package
    setupFiles: ['./vitest.setup.ts'],
    pool: 'vmThreads',
  },
})
