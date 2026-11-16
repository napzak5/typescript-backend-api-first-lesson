import { sales, salons } from '@beauty-salon-backend/database'
import type {
  DbSale,
  LedgerReach,
  SalonOfSale,
} from '@beauty-salon-backend/domain'
import { and, eq, type SQL } from 'drizzle-orm'
import { match } from 'ts-pattern'
import type { DatabaseExecutor } from '../database/index'

/**
 * What the writers of a sale and of its payments share: the sales a reader
 * reaches, and the lock every one of them takes first.
 */

/** The condition that keeps a query to the sales a reader reaches. */
export const within = (reach: LedgerReach): SQL | undefined =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(sales.salonId, salonId))
    .exhaustive()

/** A sale that is held, with what it takes from its salon. */
export type HeldSale = { sale: DbSale; salon: SalonOfSale }

/**
 * The sale a change is of, held `FOR UPDATE` until the change is written.
 * Of the changes of one sale each waits here for the one before it, and
 * what it reads afterwards is what that one left. The lock is the one that
 * the foreign key of a payment does not get past: no payment of the sale
 * is written while it is held, and one that is being written is waited
 * for.
 *
 * The sale is the first row a change holds; nothing that holds a booking,
 * a customer, a staff member or a payment method goes on to hold a sale, so
 * the changes of sales wait for nothing that waits for them. A payment of
 * the sale is written and refunded with the sale held in the same way.
 */
export const heldSaleOf = async (
  tx: DatabaseExecutor,
  id: string,
  reach: LedgerReach,
): Promise<HeldSale | null> => {
  const [held] = await tx
    .select({ sale: sales, salon: { timezone: salons.timezone } })
    .from(sales)
    .innerJoin(salons, eq(salons.id, sales.salonId))
    .where(and(eq(sales.id, id), within(reach)))
    .for('update', { of: sales })

  return held ?? null
}
