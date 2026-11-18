import { bookings, customers } from '@beauty-salon-backend/database'
import { eq, sql } from 'drizzle-orm'
import { CLOCK } from '../database/clock'
import type { DatabaseExecutor } from '../database/index'

/**
 * Sets what a customer has of visits, no-shows and cancellations to what
 * their bookings say: the numbers of the completed, the no_show and the
 * cancelled ones, and the first and the last day of a completed one.
 *
 * The customer is locked before the bookings are counted. Without it, of
 * two changes to bookings of one customer that run at the same time, each
 * would count without what the other is about to commit, and the one that
 * writes last would leave the other out.
 */
export const countBookingsOf = async (
  tx: DatabaseExecutor,
  customerId: string,
): Promise<void> => {
  await tx
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.id, customerId))
    .for('update')

  const counted = tx
    .select({
      visits:
        sql<number>`count(*) filter (where ${bookings.status} = 'completed')`.as(
          'visits',
        ),
      noShows:
        sql<number>`count(*) filter (where ${bookings.status} = 'no_show')`.as(
          'no_shows',
        ),
      cancellations:
        sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`.as(
          'cancellations',
        ),
      firstVisit: sql<
        string | null
      >`min(${bookings.bookingDate}) filter (where ${bookings.status} = 'completed')`.as(
        'first_visit',
      ),
      lastVisit: sql<
        string | null
      >`max(${bookings.bookingDate}) filter (where ${bookings.status} = 'completed')`.as(
        'last_visit',
      ),
    })
    .from(bookings)
    .where(eq(bookings.customerId, customerId))
    .as('counted')

  await tx
    .update(customers)
    .set({
      visitCount: sql`${counted.visits}`,
      noShowCount: sql`${counted.noShows}`,
      cancellationCount: sql`${counted.cancellations}`,
      firstVisitDate: sql`${counted.firstVisit}`,
      lastVisitDate: sql`${counted.lastVisit}`,
      updatedAt: CLOCK,
    })
    .from(counted)
    .where(eq(customers.id, customerId))
}
