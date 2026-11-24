import { frontendTests } from '@beauty-salon-shared/config/vitest'

export default frontendTests({
  unit: { environment: 'jsdom', stories: true },
  integration: {},
  full: true,
})
