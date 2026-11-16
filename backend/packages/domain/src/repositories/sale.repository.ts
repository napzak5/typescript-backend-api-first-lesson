import type { Result } from '@beauty-salon-backend/utility'
import type { SaleOrigin, SalePlan } from '../business-logic/sale/_shared/plan'
import type { BookingId, LedgerReach } from '../models/booking'
import type { CustomerId } from '../models/customer'
import type { DbSale, SaleId, SaleWithDetails } from '../models/sale'
import type { SalonId } from '../models/salon'
import type { SaleCreateRequest } from '../schemas/sale.schema'
import type { DomainError } from '../shared'

/**
 * What became of the sale a request asked for:
 * - `created`: the sale as it is stored
 * - `saleNumberTaken`: another sale has the number
 * - otherwise why it was not planned (`planSale`)
 */
export type SaleCreation =
  | { type: 'created'; sale: SaleWithDetails }
  | { type: 'saleNumberTaken' }
  | Exclude<SalePlan, { type: 'planned' }>

export type SaleListCriteria = {
  /** The sales the list is taken from. */
  reach: LedgerReach
  limit: number
  /** The sale after which the page starts; null for the first page. */
  after: SaleId | null
  salonId: SalonId | null
  customerId: CustomerId | null
  bookingId: BookingId | null
  paymentStatus: DbSale['paymentStatus'] | null
  /** The first day of the sales that are listed, `YYYY-MM-DD`. */
  startDate: string | null
  /** The last day of the sales that are listed, `YYYY-MM-DD`. */
  endDate: string | null
}

export type SaleList = {
  sales: SaleWithDetails[]
  /** How many sales match the criteria, on every page together. */
  total: number
  hasMore: boolean
}

/**
 * Persistence of the sales. A sale is read with its lines, in their order,
 * and with the payments made for it, in the order they were made. A reader
 * names the sales it reaches, and a sale outside of them is one that does
 * not exist.
 */
export interface ISaleRepository {
  /**
   * Plans the sale from what the request refers to (`planSale`) and writes
   * it with its lines. The booking of the request is held until the sale
   * is written, so of the requests that bill one booking at the same
   * moment the second meets the sale of the first.
   */
  create(
    request: SaleCreateRequest,
    origin: SaleOrigin,
  ): Promise<Result<SaleCreation, DomainError>>

  findById(
    id: SaleId,
    reach: LedgerReach,
  ): Promise<Result<SaleWithDetails | null, DomainError>>

  /**
   * The sales that match the criteria, the latest first; of sales at the
   * same moment, by their IDs, downwards. Null when the sale the page is
   * to start after is not one within the reach.
   */
  list(
    criteria: SaleListCriteria,
  ): Promise<Result<SaleList | null, DomainError>>
}
