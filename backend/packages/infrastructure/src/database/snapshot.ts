import type { PgTransactionConfig } from 'drizzle-orm/pg-core'

/**
 * Reads that are of one moment: every statement of the transaction sees
 * what was committed before its first one, and nothing is written.
 */
export const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}
