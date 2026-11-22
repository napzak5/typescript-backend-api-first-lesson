import { customerPoints } from '@beauty-salon-backend/database'
import type { DbPointTransaction } from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import type { DatabaseExecutor } from '../../database/index'

/**
 * Every point transaction of a customer in the order they were written,
 * which is the order in which `lotsOf` counts what is left of each earning.
 */
export const transactionsInOrder = (
  tx: DatabaseExecutor,
  customerId: string,
): Promise<DbPointTransaction[]> =>
  tx
    .select()
    .from(customerPoints)
    .where(eq(customerPoints.customerId, customerId))
    .orderBy(asc(customerPoints.createdAt), asc(customerPoints.id))
