import {
  bookings,
  customerAllergies,
  customerDeletionRequests,
  customerPoints,
  customerPreferences,
  customers,
  medicalCharts,
  reviewHelpfulVotes,
  reviews,
  sales,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import {
  allergyMergeOf,
  type CustomerMerge,
  type CustomerMergeInstruction,
  chartMergeOf,
  type DomainError,
  type MergedCustomerField,
  type MergeSide,
  mergedLedgerOf,
  planTransfer,
  preferencesMergeOf,
  sideOf,
  type UserId,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { match } from 'ts-pattern'
import { CLOCK } from '../database/clock'
import type { DatabaseExecutor } from '../database/index'
import { countBookingsOf } from './customer-counters'
import { recordVersions } from './customer-version-record'
import { transactionsInOrder } from './point-transactions'
import { countMarksOf } from './review-marks'

/**
 * Holds what names either customer before the customers are held, in the
 * order the writers of those rows hold them before a customer: the
 * bookings first, which a change of status, a sale, a treatment record, a
 * review and a movement of points hold first; then the sales, the treatment
 * records, and the reviews of either and those either marked as helpful.
 * Each in the order of their IDs. FOR NO KEY UPDATE, as the merge changes
 * no key of them: a row that comes to refer to one of them is written past
 * it.
 */
const holdWhatNames = async (
  tx: DatabaseExecutor,
  both: string[],
): Promise<void> => {
  await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(inArray(bookings.customerId, both))
    .orderBy(asc(bookings.id))
    .for('no key update')
  await tx
    .select({ id: sales.id })
    .from(sales)
    .where(inArray(sales.customerId, both))
    .orderBy(asc(sales.id))
    .for('no key update')
  await tx
    .select({ id: treatmentRecords.id })
    .from(treatmentRecords)
    .where(inArray(treatmentRecords.customerId, both))
    .orderBy(asc(treatmentRecords.id))
    .for('no key update')
  await tx
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      or(
        inArray(reviews.customerId, both),
        inArray(
          reviews.id,
          tx
            .select({ id: reviewHelpfulVotes.reviewId })
            .from(reviewHelpfulVotes)
            .where(inArray(reviewHelpfulVotes.customerId, both)),
        ),
      ),
    )
    .orderBy(asc(reviews.id))
    .for('no key update')
}

/** Which of the two customers was written last: the primary at the same moment. */
const newerCustomerOf = async (
  tx: DatabaseExecutor,
  primaryId: string,
  secondaryId: string,
): Promise<MergeSide> => {
  const [newest] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(inArray(customers.id, [primaryId, secondaryId]))
    .orderBy(desc(customers.updatedAt), desc(eq(customers.id, primaryId)))
    .limit(1)
  return newest?.id === secondaryId ? 'secondary' : 'primary'
}

/** Whose preferences were written last: the primary's at the same moment. */
const newerPreferencesOf = async (
  tx: DatabaseExecutor,
  primaryId: string,
  secondaryId: string,
): Promise<MergeSide> => {
  const [newest] = await tx
    .select({ customerId: customerPreferences.customerId })
    .from(customerPreferences)
    .where(inArray(customerPreferences.customerId, [primaryId, secondaryId]))
    .orderBy(
      desc(customerPreferences.updatedAt),
      desc(eq(customerPreferences.customerId, primaryId)),
    )
    .limit(1)
  return newest?.customerId === secondaryId ? 'secondary' : 'primary'
}

/**
 * Merges the secondary into the primary in the transaction given, which
 * reads what is committed at each statement. Every refusal is decided
 * before the first write. The time of every write is read when it is
 * written, after the locks it waited for.
 */
export const mergeCustomers = async (
  tx: DatabaseExecutor,
  {
    primaryCustomerId,
    secondaryCustomerId,
    conflictResolution,
  }: CustomerMergeInstruction,
  changedBy: UserId,
): Promise<Result<CustomerMerge, DomainError>> => {
  const both = [primaryCustomerId, secondaryCustomerId]
  await holdWhatNames(tx, both)

  // FOR UPDATE: a row that is to name a customer takes a key share of the
  // customer, so nothing comes to name either until the merge is
  // committed, and then the secondary is deleted.
  const held = await tx
    .select()
    .from(customers)
    .where(and(inArray(customers.id, both), isNull(customers.deletedAt)))
    .orderBy(asc(customers.id))
    .for('update')
  const primary = held.find(({ id }) => id === primaryCustomerId)
  const secondary = held.find(({ id }) => id === secondaryCustomerId)
  if (primary === undefined || secondary === undefined) {
    const missing: MergedCustomerField[] = []
    if (primary === undefined) {
      missing.push('primaryCustomerId')
    }
    if (secondary === undefined) {
      missing.push('secondaryCustomerId')
    }
    return Result.success({ type: 'customersNotFound', missing })
  }
  if (primary.userId !== null && secondary.userId !== null) {
    return Result.success({ type: 'accountsDiffer' })
  }
  // A request is taken under a lock of its customer, which the merge holds.
  const requested = await tx
    .select({ customerId: customerDeletionRequests.customerId })
    .from(customerDeletionRequests)
    .where(
      and(
        inArray(customerDeletionRequests.customerId, both),
        eq(customerDeletionRequests.status, 'pending'),
      ),
    )
  if (requested.length > 0) {
    return Result.success({
      type: 'deletionRequested',
      customers: both.filter((id) =>
        requested.some(({ customerId }) => customerId === id),
      ),
    })
  }

  const transfer = planTransfer(
    {
      from: { customerId: secondary.id, balance: secondary.loyaltyPoints },
      to: { customerId: primary.id, balance: primary.loyaltyPoints },
    },
    await transactionsInOrder(tx, secondary.id),
  )
  if (transfer.type === 'beyondLimit') {
    return Result.success({ type: 'pointsBeyondLimit' })
  }

  // The charts and the allergies are held as they are read: a change of
  // one, which holds no customer, that is under way is in what is read, and
  // the next one waits for the merge instead of being written over.
  const charts = await tx
    .select()
    .from(medicalCharts)
    .where(inArray(medicalCharts.customerId, both))
    .orderBy(asc(medicalCharts.id))
    .for('update')
  const chartMerge = chartMergeOf(
    charts.find(({ customerId }) => customerId === primary.id) ?? null,
    charts.find(({ customerId }) => customerId === secondary.id) ?? null,
  )
  if (chartMerge.type === 'error') {
    return chartMerge
  }
  const chart = chartMerge.data
  if (chart.type === 'tooLong') {
    return Result.success({ type: 'chartTooLong', list: chart.list })
  }

  // The preferences are written only under a lock of their customer, which
  // the merge holds.
  const preferenceRows = await tx
    .select()
    .from(customerPreferences)
    .where(inArray(customerPreferences.customerId, both))
  const primaryPreferences = preferenceRows.find(
    ({ customerId }) => customerId === primary.id,
  )
  const secondaryPreferences = preferenceRows.find(
    ({ customerId }) => customerId === secondary.id,
  )
  const preferences = preferencesMergeOf(
    primaryPreferences,
    secondaryPreferences,
    sideOf(
      conflictResolution,
      await newerPreferencesOf(tx, primary.id, secondary.id),
    ),
  )

  const allergies = await tx
    .select()
    .from(customerAllergies)
    .where(inArray(customerAllergies.customerId, both))
    .orderBy(asc(customerAllergies.id))
    .for('update')
  const allergyMerge = allergyMergeOf(
    allergies.filter(({ customerId }) => customerId === primary.id),
    allergies.filter(({ customerId }) => customerId === secondary.id),
  )

  const ledger = mergedLedgerOf(
    primary,
    secondary,
    sideOf(
      conflictResolution,
      await newerCustomerOf(tx, primary.id, secondary.id),
    ),
  )

  // The secondary is deleted first: the email and the account of a
  // customer who is not deleted are unique, and the referral code of any
  // customer, so the primary can take them only from a deleted customer
  // whose referral code is cleared.
  await tx
    .update(customers)
    .set({
      deletedAt: CLOCK,
      referralCode:
        ledger.referralCode === secondary.referralCode
          ? null
          : secondary.referralCode,
      updatedAt: CLOCK,
    })
    .where(eq(customers.id, secondary.id))
  // The deleted secondary keeps naming the account it was the profile of,
  // as a deleted customer does.
  await tx
    .update(customers)
    .set({
      ...ledger,
      userId: primary.userId ?? secondary.userId,
      updatedAt: CLOCK,
    })
    .where(eq(customers.id, primary.id))
  if (primary.userId === null && secondary.userId !== null) {
    await tx
      .update(users)
      .set({ customerId: primary.id, updatedAt: CLOCK })
      .where(eq(users.customerId, secondary.id))
  }

  const ofThePrimary = { customerId: primary.id, updatedAt: CLOCK }
  await tx
    .update(bookings)
    .set(ofThePrimary)
    .where(eq(bookings.customerId, secondary.id))
  await tx
    .update(sales)
    .set(ofThePrimary)
    .where(eq(sales.customerId, secondary.id))
  await tx
    .update(treatmentRecords)
    .set(ofThePrimary)
    .where(eq(treatmentRecords.customerId, secondary.id))
  await tx
    .update(reviews)
    .set(ofThePrimary)
    .where(eq(reviews.customerId, secondary.id))

  // The customers the secondary referred are referred by the primary. A
  // deleted one keeps the referrer it had.
  const referred = await tx
    .update(customers)
    .set({ referredBy: primary.id, updatedAt: CLOCK })
    .where(
      and(
        eq(customers.referredBy, secondary.id),
        ne(customers.id, primary.id),
        isNull(customers.deletedAt),
      ),
    )
    .returning()

  // A mark of either on a review of either is a mark of the primary on
  // their own review, and a mark of the secondary on a review the primary
  // marked is a second mark: both go, and the counts of those reviews are
  // counted again.
  const ownMarks = await tx
    .delete(reviewHelpfulVotes)
    .where(
      and(
        inArray(reviewHelpfulVotes.customerId, both),
        inArray(
          reviewHelpfulVotes.reviewId,
          tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.customerId, primary.id)),
        ),
      ),
    )
    .returning({ reviewId: reviewHelpfulVotes.reviewId })
  const secondMarks = await tx
    .delete(reviewHelpfulVotes)
    .where(
      and(
        eq(reviewHelpfulVotes.customerId, secondary.id),
        inArray(
          reviewHelpfulVotes.reviewId,
          tx
            .select({ id: reviewHelpfulVotes.reviewId })
            .from(reviewHelpfulVotes)
            .where(eq(reviewHelpfulVotes.customerId, primary.id)),
        ),
      ),
    )
    .returning({ reviewId: reviewHelpfulVotes.reviewId })
  await tx
    .update(reviewHelpfulVotes)
    .set({ customerId: primary.id })
    .where(eq(reviewHelpfulVotes.customerId, secondary.id))
  for (const reviewId of new Set(
    [...ownMarks, ...secondMarks].map(({ reviewId }) => reviewId),
  )) {
    await countMarksOf(tx, reviewId)
  }

  if (transfer.from !== null) {
    await tx
      .insert(customerPoints)
      .values({ ...transfer.from, createdAt: CLOCK })
    // One moment after the other, in the order of the plan: the latest
    // transfer is the one whose balance the primary has.
    await tx.insert(customerPoints).values(
      transfer.to.map((write, index) => ({
        ...write,
        createdAt: sql`${CLOCK} + (${index}::integer * interval '1 microsecond')`,
      })),
    )
    await tx
      .update(customers)
      .set({ loyaltyPoints: transfer.from.balance, updatedAt: CLOCK })
      .where(eq(customers.id, secondary.id))
    await tx
      .update(customers)
      .set({
        loyaltyPoints: transfer.to.at(-1)?.balance ?? primary.loyaltyPoints,
        updatedAt: CLOCK,
      })
      .where(eq(customers.id, primary.id))
  }

  await match(preferences)
    .with({ type: 'keep' }, async () => {})
    .with({ type: 'move' }, async () => {
      await tx
        .update(customerPreferences)
        .set({ customerId: primary.id, updatedAt: CLOCK })
        .where(eq(customerPreferences.customerId, secondary.id))
    })
    .with({ type: 'copy' }, async ({ row }) => {
      await tx
        .update(customerPreferences)
        .set({
          preferredStaffId: row.preferredStaffId,
          preferredTimeSlots: row.preferredTimeSlots,
          avoidStaffIds: row.avoidStaffIds,
          stylePreferences: row.stylePreferences,
          communicationStyle: row.communicationStyle,
          specialRequests: row.specialRequests,
          updatedAt: CLOCK,
        })
        .where(eq(customerPreferences.customerId, primary.id))
    })
    .exhaustive()

  await match(chart)
    .with({ type: 'keep' }, async () => {})
    .with({ type: 'move' }, async () => {
      await tx
        .update(medicalCharts)
        .set({ customerId: primary.id, updatedAt: CLOCK })
        .where(eq(medicalCharts.customerId, secondary.id))
    })
    .with({ type: 'combine' }, async ({ values }) => {
      await tx
        .update(medicalCharts)
        .set({ ...values, updatedAt: CLOCK })
        .where(eq(medicalCharts.customerId, primary.id))
    })
    .exhaustive()

  if (allergyMerge.moved.length > 0) {
    await tx
      .update(customerAllergies)
      .set({ customerId: primary.id, updatedAt: CLOCK })
      .where(inArray(customerAllergies.id, allergyMerge.moved))
  }
  for (const { id, values } of allergyMerge.replaced) {
    await tx
      .update(customerAllergies)
      .set({ ...values, updatedAt: CLOCK })
      .where(eq(customerAllergies.id, id))
  }

  // The bookings of the secondary are the primary's: the visits are
  // counted again for both, the secondary's to none.
  await countBookingsOf(tx, primary.id)
  await countBookingsOf(tx, secondary.id)

  const merged = await tx
    .select()
    .from(customers)
    .where(inArray(customers.id, both))
  await recordVersions(tx, [...merged, ...referred], 'merge', changedBy)

  const kept = merged.find(({ id }) => id === primary.id)
  // The primary is held from the start, so it is there.
  return Result.success(
    kept === undefined
      ? { type: 'customersNotFound', missing: ['primaryCustomerId'] }
      : { type: 'merged', customer: kept },
  )
}
