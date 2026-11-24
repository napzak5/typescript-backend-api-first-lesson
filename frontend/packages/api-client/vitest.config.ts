import { frontendTests } from '@beauty-salon-shared/config/vitest'

export default frontendTests({
  unit: { environment: 'jsdom' },
  // The client that orval generates from the contract
  unmeasured: ['src/generated/**'],
})
