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
