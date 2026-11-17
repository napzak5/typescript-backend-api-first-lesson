import { bookingServices, bookings } from '@beauty-salon-backend/database'
import { UNFINISHED_STATUSES } from '@beauty-salon-backend/domain'
import { and, eq, inArray, type SQL } from 'drizzle-orm'
import type { DatabaseExecutor } from '../database/index'

/*
 * What a booking that is not finished refers to is not deleted. A delete
 * of a salon, a customer, a staff member or a service therefore
 *
 * 1. locks the row it deletes `FOR UPDATE`, in a statement of its own, and
 * 2. looks here for a booking that refers to the row, in the next one.
 *
 * Whatever makes a booking refer to a row (an entry, a reschedule) holds
 * that row, shared or not, until it has written. The delete waits for it,
 * and the statement after the wait reads what was committed meanwhile; a
 * single statement that locked and looked would look with the snapshot it
 * had before it waited. An entry or a reschedule that comes later waits
 * for the delete and finds the row deleted.
 *
 * The bookings are read and never locked. Whoever writes a booking locks
 * the booking first and what it refers to after it; a delete that locked
 * bookings would take the same rows in the other order.
 */

const unfinished = inArray(bookings.status, [...UNFINISHED_STATUSES])

/** Whether one of the bookings a condition picks is not finished. */
export const hasUnfinishedBooking = async (
  executor: DatabaseExecutor,
  referring: SQL,
): Promise<boolean> => {
  const [found] = await executor
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(referring, unfinished))
    .limit(1)

  return found !== undefined
}

/** The customers among `ids` that a booking which is not finished refers to. */
export const customersOfUnfinishedBookings = async (
  executor: DatabaseExecutor,
  ids: readonly string[],
): Promise<string[]> => {
  const referring = await executor
    .selectDistinct({ customerId: bookings.customerId })
    .from(bookings)
    .where(and(inArray(bookings.customerId, [...ids]), unfinished))

  return referring.map(({ customerId }) => customerId)
}

/** Whether one of the service lines a condition picks is of a booking that is not finished. */
export const hasLineOfUnfinishedBooking = async (
  executor: DatabaseExecutor,
  referring: SQL,
): Promise<boolean> => {
  const [found] = await executor
    .select({ id: bookingServices.id })
    .from(bookingServices)
    .innerJoin(bookings, eq(bookings.id, bookingServices.bookingId))
    .where(and(referring, unfinished))
    .limit(1)

  return found !== undefined
}
