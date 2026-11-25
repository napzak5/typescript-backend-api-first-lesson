import { backendTests } from '@beauty-salon-shared/config/vitest'

export default backendTests({
  full: true,
  unit: { isolate: false },
  integration: {
    setupFiles: ['./src/__tests__/_shared/setup.ts'],
    // Every test has a database of its own; files run one at a time to keep
    // the number of open connections bounded
    fileParallelism: false,
  },
})
