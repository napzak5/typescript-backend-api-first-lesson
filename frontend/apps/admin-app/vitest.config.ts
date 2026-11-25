import { frontendTests } from '@beauty-salon-shared/config/vitest'

export default frontendTests({
  full: true,
  unit: { environment: 'jsdom', stories: true, pool: 'vmThreads' },
  integration: {},
})
