import type { Result } from '@beauty-salon-backend/utility'
import type {
  PointMovement,
  PointPlan,
} from '../business-logic/point/_shared/plan'
import type { LedgerReach } from '../models/booking'
import type { CustomerId } from '../models/customer'
import type { DbPointTransaction, PointTransactionId } from '../models/point'
import type { DomainError } from '../shared'

/**
 * What became of the movement of points a request asked for:
 * - `recorded`: the point transaction as it is stored
 * - `customerNotFound`: no customer with the ID, or a deleted one
 * - otherwise why the movement was not planned (`planPoints`)
 */
export type PointRecording =
  | { type: 'recorded'; transaction: DbPointTransaction }
  | { type: 'customerNotFound' }
  | Exclude<PointPlan, { type: 'planned' }>

/** Which point transactions of a customer are listed. */
export type PointListCriteria = {
  customerId: CustomerId
  limit: number
  /** The point transaction the page starts after; null for the first page. */
  after: PointTransactionId | null
  /** The earliest time of a transaction listed (ISO 8601), or null. */
  startDate: string | null
  /** The latest time of a transaction listed (ISO 8601), or null. */
  endDate: string | null
}

/**
 * What a list found:
 * - `listed`: a page, latest first, how many transactions match, and
 *   whether another page follows
 * - `customerNotFound`: no customer with the ID, or a deleted one
 * - `cursorNotFound`: the cursor names no point transaction of the customer
 */
export type PointListing =
  | {
      type: 'listed'
      transactions: DbPointTransaction[]
      total: number
      hasMore: boolean
    }
  | { type: 'customerNotFound' }
  | { type: 'cursorNotFound' }

/**
 * What an expiry did:
 * - `expired`: how many point transactions of the type `expired` it wrote,
 *   one a customer, and how many points they took together
 * - `customerNotFound`: the customer it was asked for is not there, or
 *   deleted
 */
export type PointExpiryOutcome =
  | { type: 'expired'; processedCount: number; totalPoints: number }
  | { type: 'customerNotFound' }

/**
 * Persistence of the points of the customers. Every movement writes a
 * point transaction and the balance after it to the customer
 * (`loyaltyPoints`) in one transaction, with the customer held, so the
 * movements of one customer are written one after the other.
 */
export interface IPointRepository {
  /** The balance of a customer; null for no customer or a deleted one. */
  balanceOf(customerId: CustomerId): Promise<Result<number | null, DomainError>>

  list(criteria: PointListCriteria): Promise<Result<PointListing, DomainError>>

  /**
   * All the point transactions of a customer, in the order they were
   * written (`createdAt`, then `id`), read at one moment; null for no
   * customer or a deleted one.
   */
  transactionsOf(
    customerId: CustomerId,
  ): Promise<Result<DbPointTransaction[] | null, DomainError>>

  /**
   * Expires the points of the customer, or of every customer who is not
   * deleted when it is null, whose expiry date is before `processBefore`
   * and that are left (`planExpiry`). Each customer is held as a movement
   * holds them, in a transaction of their own, and their transactions are
   * read after that, so an expiry and the movements of a customer are
   * written one after the other. A customer whose expiry is written stays
   * expired when a later one fails.
   */
  expire(
    customerId: CustomerId | null,
    processBefore: string,
  ): Promise<Result<PointExpiryOutcome, DomainError>>

  /**
   * Holds the record the request names, if it is within the reach, then
   * the customer, plans the movement from the balance and from that record
   * (`planPoints`) and writes it. Of the movements that are recorded for
   * one customer at the same moment, each meets the balance the one before
   * it left.
   */
  record(
    reach: LedgerReach,
    movement: PointMovement,
  ): Promise<Result<PointRecording, DomainError>>
}
