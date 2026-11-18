import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customerAllergies,
  customerDeletionRequests,
  customerPoints,
  customerPreferences,
  customers,
  customerVersions,
  medicalCharts,
  reviewHelpfulVotes,
  reviews,
  sessions,
  treatmentPhotos,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import {
  type CustomerErasure,
  ERASED_BOOKING,
  ERASED_BOOKING_LINE,
  ERASED_TREATMENT_RECORD,
  erasedAccountOf,
  erasedLedgerOf,
  forfeitOf,
  type UserId,
} from '@beauty-salon-backend/domain'
import { and, asc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { CLOCK } from '../database/clock'
import type { DatabaseExecutor } from '../database/index'
import { recordVersions } from './customer-version-record'
import { countMarksOf } from './review-marks'
import { countReviewsOf } from './salon-review-counts'

/**
 * Holds what names the customer before the customer is held, in the order
 * the writers of those rows hold them before a customer, as a merge does:
 * the bookings first, then the treatment records, and the reviews of the
 * customer and those the customer marked as helpful. Each in the order of
 * their IDs. The sales are not written, so they are not held.
 */
const holdWhatNames = async (
  tx: DatabaseExecutor,
  customerId: string,
): Promise<void> => {
  await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.customerId, customerId))
    .orderBy(asc(bookings.id))
    .for('no key update')
  await tx
    .select({ id: treatmentRecords.id })
    .from(treatmentRecords)
    .where(eq(treatmentRecords.customerId, customerId))
    .orderBy(asc(treatmentRecords.id))
    .for('no key update')
  await tx
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      or(
        eq(reviews.customerId, customerId),
        inArray(
          reviews.id,
          tx
            .select({ id: reviewHelpfulVotes.reviewId })
            .from(reviewHelpfulVotes)
            .where(eq(reviewHelpfulVotes.customerId, customerId)),
        ),
      ),
    )
    .orderBy(asc(reviews.id))
    .for('no key update')
}

/**
 * Erases the data of the customer of a request in the transaction given,
 * which reads what is committed at each statement, if the request is still
 * pending and due once the customer is held; otherwise changes nothing.
 * What is erased and what stays is what `erasure.ts` of the domain says.
 * The time of every write is read when it is written, after the locks it
 * waited for.
 */
export const eraseCustomerOf = async (
  tx: DatabaseExecutor,
  requestId: string,
  completedBy: UserId,
): Promise<CustomerErasure> => {
  const [named] = await tx
    .select({ customerId: customerDeletionRequests.customerId })
    .from(customerDeletionRequests)
    .where(eq(customerDeletionRequests.id, requestId))
  if (named === undefined) {
    return { type: 'notDue' }
  }
  const { customerId } = named
  await holdWhatNames(tx, customerId)

  // A request is taken and cancelled under a lock of its customer, so
  // whether it is pending is decided once the customer is held.
  const [customer] = await tx
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .for('update')
  const [request] = await tx
    .select({ id: customerDeletionRequests.id })
    .from(customerDeletionRequests)
    .where(
      and(
        eq(customerDeletionRequests.id, requestId),
        eq(customerDeletionRequests.status, 'pending'),
        lte(customerDeletionRequests.scheduledAt, CLOCK),
      ),
    )
    .for('update')
  if (customer === undefined || request === undefined) {
    return { type: 'notDue' }
  }

  // The accounts: one that names the customer, and the one a customer
  // deleted before still names, unless that account has a profile again:
  // it made that profile after the customer was deleted, and keeps it.
  // An account is held before it is read, so a profile that it is making
  // is seen.
  const accounts = await tx
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        eq(users.customerId, customerId),
        customer.userId === null
          ? undefined
          : and(eq(users.id, customer.userId), isNull(users.customerId)),
      ),
    )
    .orderBy(asc(users.id))
    .for('update')
  for (const account of accounts) {
    await tx
      .update(users)
      .set({
        ...erasedAccountOf(account),
        deletedAt: sql`coalesce(${users.deletedAt}, ${CLOCK})`,
        updatedAt: CLOCK,
      })
      .where(eq(users.id, account.id))
  }
  if (accounts.length > 0) {
    await tx.delete(sessions).where(
      inArray(
        sessions.userId,
        accounts.map(({ id }) => id),
      ),
    )
  }

  await tx
    .delete(customerPreferences)
    .where(eq(customerPreferences.customerId, customerId))
  await tx.delete(medicalCharts).where(eq(medicalCharts.customerId, customerId))
  await tx
    .delete(customerAllergies)
    .where(eq(customerAllergies.customerId, customerId))

  const ofTheCustomer = tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.customerId, customerId))
  await tx
    .update(bookings)
    .set({ ...ERASED_BOOKING, updatedAt: CLOCK })
    .where(eq(bookings.customerId, customerId))
  await tx
    .update(bookingServices)
    .set({ ...ERASED_BOOKING_LINE, updatedAt: CLOCK })
    .where(inArray(bookingServices.bookingId, ofTheCustomer))
  await tx
    .update(bookingStatusHistories)
    .set({ reason: null })
    .where(inArray(bookingStatusHistories.bookingId, ofTheCustomer))

  await tx
    .update(treatmentRecords)
    .set({ ...ERASED_TREATMENT_RECORD, updatedAt: CLOCK })
    .where(eq(treatmentRecords.customerId, customerId))
  await tx
    .delete(treatmentPhotos)
    .where(
      inArray(
        treatmentPhotos.treatmentRecordId,
        tx
          .select({ id: treatmentRecords.id })
          .from(treatmentRecords)
          .where(eq(treatmentRecords.customerId, customerId)),
      ),
    )

  // The marks of the customer go, and the reviews they marked are counted
  // again; their reviews go, with the marks and reports on them, and the
  // salons of those reviews are counted again.
  const marks = await tx
    .delete(reviewHelpfulVotes)
    .where(eq(reviewHelpfulVotes.customerId, customerId))
    .returning({ reviewId: reviewHelpfulVotes.reviewId })
  for (const reviewId of new Set(marks.map(({ reviewId }) => reviewId))) {
    await countMarksOf(tx, reviewId)
  }
  const removed = await tx
    .delete(reviews)
    .where(eq(reviews.customerId, customerId))
    .returning({ salonId: reviews.salonId })
  for (const salonId of new Set(removed.map(({ salonId }) => salonId))) {
    await countReviewsOf(tx, salonId)
  }

  // The amounts of the points stay, what was written of them does not, and
  // what is left is forfeit.
  await tx
    .update(customerPoints)
    .set({ description: null })
    .where(eq(customerPoints.customerId, customerId))
  const forfeit = forfeitOf(customer)
  if (forfeit !== null) {
    await tx.insert(customerPoints).values({ ...forfeit, createdAt: CLOCK })
  }

  // A customer deleted before keeps the time of the deletion.
  const [erased] = await tx
    .update(customers)
    .set({
      ...erasedLedgerOf(customer),
      deletedAt: sql`coalesce(${customers.deletedAt}, ${CLOCK})`,
      updatedAt: CLOCK,
    })
    .where(eq(customers.id, customerId))
    .returning()
  if (erased === undefined) {
    return { type: 'notDue' }
  }
  // The versions hold what the ledger held of the customer: they go, and
  // the erasure is the one version left.
  await tx
    .delete(customerVersions)
    .where(eq(customerVersions.customerId, customerId))
  await recordVersions(tx, [erased], 'erase', completedBy)

  const [done] = await tx
    .update(customerDeletionRequests)
    .set({ status: 'completed', completedBy, completedAt: CLOCK })
    .where(eq(customerDeletionRequests.id, requestId))
    .returning()
  return done === undefined
    ? { type: 'notDue' }
    : { type: 'erased', request: done }
}
