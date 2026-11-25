import { backendTests } from '@beauty-salon-shared/config/vitest'

export default backendTests({
  full: true,
  unit: {},
  integration: {},
  // What `pnpm db:introspect` generates from the database
  unmeasured: ['src/schema.ts', 'src/relations.ts'],
})
