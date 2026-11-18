import {
  bookings,
  customerPoints,
  customers,
  sales,
} from '@beauty-salon-backend/database'
import {
  type CustomerId,
  type DbPointTransaction,
  type DomainError,
  type IPointRepository,
  type LedgerReach,
  type PointExpiryOutcome,
  type PointListCriteria,
  type PointListing,
  type PointMovement,
  type PointRecording,
  type PointReference,
  planExpiry,
  planPoints,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, count, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import type { PgTransactionConfig } from 'drizzle-orm/pg-core'
import { match } from 'ts-pattern'
import { attempt } from '../database/attempt'
import { CLOCK } from '../database/clock'
import type { Database, DatabaseExecutor } from '../database/index'
import { within as withinSales } from './held-sale'
import { transactionsInOrder } from './point-transactions'

/**
 * A read of the history of a customer in one snapshot: the customer, the
 * cursor, the page and the count of what matches are of one moment.
 */
const AT_ONE_MOMENT: PgTransactionConfig = {
  isolationLevel: 'repeatable read',
  accessMode: 'read only',
}

/** The condition that keeps a query to the bookings a writer reaches. */
const withinBookings = (reach: LedgerReach) =>
  match(reach)
    .with({ type: 'everySalon' }, () => undefined)
    .with({ type: 'salon' }, ({ salonId }) => eq(bookings.salonId, salonId))
    .exhaustive()

/**
 * The record a movement names, within the reach, held `FOR SHARE` until the
 * movement is written: a void of the sale or a change of the status of the
 * booking that is under way has been made when the row is returned, and
 * the next one waits. Null when the movement names none, or none is found.
 *
 * The record is the first row a movement holds and the customer the second,
 * the order in which the sales and the bookings hold theirs.
 */
const heldReferenceOf = async (
  tx: DatabaseExecutor,
  reach: LedgerReach,
  movement: PointMovement,
): Promise<PointReference | null> => {
  const { referenceType, referenceId } = movement.request
  if (referenceType === null || referenceId === null) {
    return null
  }

  return match(referenceType)
    .with('sale', async (): Promise<PointReference | null> => {
      const [sale] = await tx
        .select({ customerId: sales.customerId, isVoid: sales.isVoid })
        .from(sales)
        .where(and(eq(sales.id, referenceId), withinSales(reach)))
        .for('share')
      return sale === undefined ? null : { type: 'sale', ...sale }
    })
    .with('booking', async (): Promise<PointReference | null> => {
      const [booking] = await tx
        .select({ customerId: bookings.customerId, status: bookings.status })
        .from(bookings)
        .where(and(eq(bookings.id, referenceId), withinBookings(reach)))
        .for('share')
      return booking === undefined ? null : { type: 'booking', ...booking }
    })
    .exhaustive()
}

/**
 * Whether a point transaction of the type of the movement refers to the
 * record already. Read after the customer is held: a movement of the same
 * customer that named the record has been written by then. The partial
 * unique index `customer_points_reference_unique` says the same of the
 * table, for a record whose customer changed in between.
 */
const isTaken = async (
  tx: DatabaseExecutor,
  movement: PointMovement,
): Promise<boolean> => {
  const { referenceType, referenceId } = movement.request
  if (referenceType === null || referenceId === null) {
    return false
  }
  const [taken] = await tx
    .select({ id: customerPoints.id })
    .from(customerPoints)
    .where(
      and(
        eq(customerPoints.referenceType, referenceType),
        eq(customerPoints.referenceId, referenceId),
        eq(customerPoints.transactionType, movement.type),
      ),
    )
    .limit(1)
  return taken !== undefined
}

/**
 * The time of a point transaction as a response shows it, to the
 * millisecond: a filter by the time a client was shown matches the
 * transaction it was shown.
 */
const transactedAt = sql`date_trunc('milliseconds', ${customerPoints.createdAt})`

/** The condition that keeps a query to a customer who is not deleted. */
const liveCustomer = (customerId: string) =>
  and(eq(customers.id, customerId), isNull(customers.deletedAt))

/** What the expiry of one customer did. */
type ExpiryOfOne =
  | { type: 'expired'; points: number }
  | { type: 'nothingLapsed' }
  | { type: 'customerNotFound' }

/**
 * Each statement of a movement or an expiry sees what was committed before
 * it: one that waited for the customer sees the balance and the point
 * transactions it waited for.
 */
const WRITE: PgTransactionConfig = { isolationLevel: 'read committed' }

export class PointRepository implements IPointRepository {
  constructor(private readonly db: Database) {}

  async balanceOf(
    customerId: CustomerId,
  ): Promise<Result<number | null, DomainError>> {
    return attempt('Failed to read the balance of points', async () => {
      const [customer] = await this.db
        .select({ loyaltyPoints: customers.loyaltyPoints })
        .from(customers)
        .where(liveCustomer(customerId))
      return customer?.loyaltyPoints ?? null
    })
  }

  async list({
    customerId,
    limit,
    after,
    startDate,
    endDate,
  }: PointListCriteria): Promise<Result<PointListing, DomainError>> {
    const filters = and(
      eq(customerPoints.customerId, customerId),
      startDate === null
        ? undefined
        : sql`${transactedAt} >= ${startDate}::timestamptz`,
      endDate === null
        ? undefined
        : sql`${transactedAt} <= ${endDate}::timestamptz`,
    )

    return attempt('Failed to list point transactions', () =>
      this.db.transaction(async (tx): Promise<PointListing> => {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(liveCustomer(customerId))
        if (customer === undefined) {
          return { type: 'customerNotFound' }
        }

        // Keyset pagination on (createdAt, id), downwards: the page starts
        // after the transaction the cursor names, which has to be one of
        // the customer.
        const [cursor] =
          after === null
            ? []
            : await tx
                .select({ createdAt: customerPoints.createdAt })
                .from(customerPoints)
                .where(
                  and(
                    eq(customerPoints.id, after),
                    eq(customerPoints.customerId, customerId),
                  ),
                )
        if (after !== null && cursor === undefined) {
          return { type: 'cursorNotFound' }
        }
        const afterCursor =
          after === null || cursor === undefined
            ? undefined
            : sql`(${customerPoints.createdAt}, ${customerPoints.id}) < (${cursor.createdAt}::timestamptz, ${after}::uuid)`

        const found = await tx
          .select()
          .from(customerPoints)
          .where(and(filters, afterCursor))
          .orderBy(desc(customerPoints.createdAt), desc(customerPoints.id))
          // One extra row tells whether another page follows.
          .limit(limit + 1)
        const [matching] = await tx
          .select({ total: count() })
          .from(customerPoints)
          .where(filters)

        return {
          type: 'listed',
          transactions: found.slice(0, limit),
          total: matching?.total ?? 0,
          hasMore: found.length > limit,
        }
      }, AT_ONE_MOMENT),
    )
  }

  async record(
    reach: LedgerReach,
    movement: PointMovement,
  ): Promise<Result<PointRecording, DomainError>> {
    const { customerId } = movement.request

    return attempt('Failed to record points', () =>
      this.db.transaction(async (tx): Promise<PointRecording> => {
        const reference = await heldReferenceOf(tx, reach, movement)

        // FOR NO KEY UPDATE: the movements of one customer, a change of
        // the customer and their deletion wait for each other, while a
        // sale or a booking of the customer is written past it.
        const [customer] = await tx
          .select({ loyaltyPoints: customers.loyaltyPoints })
          .from(customers)
          .where(liveCustomer(customerId))
          .for('no key update')
        if (customer === undefined) {
          return { type: 'customerNotFound' }
        }

        const plan = planPoints(customerId, movement, {
          balance: customer.loyaltyPoints,
          reference,
          referenceTaken: await isTaken(tx, movement),
        })
        if (plan.type !== 'planned') {
          return plan
        }

        // The time is read when the row is written, not when the
        // transaction began: a movement that waited for the customer is
        // later than the one it waited for, and the latest transaction of
        // a customer is the one whose balance the customer has.
        const [transaction] = await tx
          .insert(customerPoints)
          .values({ ...plan.write, createdAt: CLOCK })
          .onConflictDoNothing()
          .returning()
        if (transaction === undefined) {
          return { type: 'referenceTaken' }
        }
        await tx
          .update(customers)
          .set({ loyaltyPoints: plan.write.balance, updatedAt: CLOCK })
          .where(eq(customers.id, customerId))

        return { type: 'recorded', transaction }
      }, WRITE),
    )
  }

  async transactionsOf(
    customerId: CustomerId,
  ): Promise<Result<DbPointTransaction[] | null, DomainError>> {
    return attempt('Failed to read point transactions', () =>
      this.db.transaction(async (tx): Promise<DbPointTransaction[] | null> => {
        const [customer] = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(liveCustomer(customerId))
        return customer === undefined
          ? null
          : transactionsInOrder(tx, customerId)
      }, AT_ONE_MOMENT),
    )
  }

  async expire(
    customerId: CustomerId | null,
    processBefore: string,
  ): Promise<Result<PointExpiryOutcome, DomainError>> {
    return attempt('Failed to expire points', async () => {
      const targets =
        customerId === null
          ? await this.customersWithLapsedPoints(processBefore)
          : [customerId]
      let processedCount = 0
      let totalPoints = 0
      // One customer after the other, each in a transaction of their own:
      // no expiry holds more than one customer.
      for (const target of targets) {
        const expiry = await this.expireOne(target, processBefore)
        if (expiry.type === 'customerNotFound' && customerId !== null) {
          return { type: 'customerNotFound' }
        }
        if (expiry.type === 'expired') {
          processedCount += 1
          totalPoints += expiry.points
        }
      }
      return { type: 'expired', processedCount, totalPoints }
    })
  }

  /**
   * The customers who are not deleted, have points and have an increase
   * whose expiry date is before `processBefore`, by ID: an earning, or a
   * transfer of what was left of one, which keeps its expiry date. What is
   * left of them is counted for each of them under their lock.
   */
  private async customersWithLapsedPoints(
    processBefore: string,
  ): Promise<string[]> {
    const found = await this.db
      .selectDistinct({ customerId: customerPoints.customerId })
      .from(customerPoints)
      .innerJoin(customers, eq(customers.id, customerPoints.customerId))
      .where(
        and(
          lt(customerPoints.expiryDate, processBefore),
          isNull(customers.deletedAt),
          gt(customers.loyaltyPoints, 0),
        ),
      )
      .orderBy(asc(customerPoints.customerId))
    return found.map(({ customerId }) => customerId)
  }

  /**
   * Holds the customer as a movement does, reads their point transactions
   * after that, and writes the expiry `planExpiry` plans, with the balance
   * after it, at the time the row is written.
   */
  private expireOne(
    customerId: string,
    processBefore: string,
  ): Promise<ExpiryOfOne> {
    return this.db.transaction(async (tx): Promise<ExpiryOfOne> => {
      const [customer] = await tx
        .select({ loyaltyPoints: customers.loyaltyPoints })
        .from(customers)
        .where(liveCustomer(customerId))
        .for('no key update')
      if (customer === undefined) {
        return { type: 'customerNotFound' }
      }

      const plan = planExpiry(
        customerId,
        customer.loyaltyPoints,
        await transactionsInOrder(tx, customerId),
        processBefore,
      )
      if (plan.type === 'nothingLapsed') {
        return plan
      }
      await tx
        .insert(customerPoints)
        .values({ ...plan.write, createdAt: CLOCK })
      await tx
        .update(customers)
        .set({ loyaltyPoints: plan.write.balance, updatedAt: CLOCK })
        .where(eq(customers.id, customerId))
      return { type: 'expired', points: -plan.write.points }
    }, WRITE)
  }
}
