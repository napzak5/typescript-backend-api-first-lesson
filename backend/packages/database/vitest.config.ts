import { backendTests } from '@beauty-salon-shared/config/vitest'

export default backendTests({
  unit: {},
  integration: {},
  // What `pnpm db:introspect` generates from the database
  unmeasured: ['src/schema.ts', 'src/relations.ts'],
})
