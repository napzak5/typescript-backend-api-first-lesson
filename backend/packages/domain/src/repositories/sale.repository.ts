import type { Result } from '@beauty-salon-backend/utility'
import type { CalculationReferences } from '../business-logic/sale/_shared/calculation'
import type {
  SaleChangePlan,
  SaleChangeRefusal,
  SaleVoidRefusal,
} from '../business-logic/sale/_shared/change'
import type { SaleOrigin, SalePlan } from '../business-logic/sale/_shared/plan'
import type { BookingId, LedgerReach } from '../models/booking'
import type { CustomerId } from '../models/customer'
import type {
  DbSale,
  RequestedCalculation,
  RequestedSale,
  RequestedSaleChange,
  RequestedSaleVoid,
  SaleId,
  SaleWithDetails,
} from '../models/sale'
import type { SalonId } from '../models/salon'
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

/**
 * What became of a correction:
 * - `updated`: the sale as it is stored now
 * - `notFound`: no sale with the ID is within the reach
 * - otherwise why the sale is not corrected (`refusalOfChange`) or why
 *   the correction was not planned (`planSaleChange`)
 */
export type SaleUpdate =
  | { type: 'updated'; sale: SaleWithDetails }
  | { type: 'notFound' }
  | SaleChangeRefusal
  | Exclude<SaleChangePlan, { type: 'planned' }>

/**
 * What became of the request to void a sale:
 * - `voided`: the sale as it is stored now
 * - `notFound`: no sale with the ID is within the reach
 * - otherwise why the sale is not voided (`refusalOfVoid`)
 */
export type SaleVoiding =
  | { type: 'voided'; sale: SaleWithDetails }
  | { type: 'notFound' }
  | SaleVoidRefusal

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
    request: RequestedSale,
    origin: SaleOrigin,
  ): Promise<Result<SaleCreation, DomainError>>

  findById(
    id: SaleId,
    reach: LedgerReach,
  ): Promise<Result<SaleWithDetails | null, DomainError>>

  /**
   * Holds the sale, plans the correction from what the request names
   * (`planSaleChange`) and writes it; lines that are named take the place
   * of every line of the sale. Of the requests that change one sale at
   * the same moment, each meets the sale the one before it left.
   */
  update(
    id: SaleId,
    reach: LedgerReach,
    request: RequestedSaleChange,
  ): Promise<Result<SaleUpdate, DomainError>>

  /**
   * Holds the sale and makes it void, unless it is void or a payment of
   * it holds money (`refusalOfVoid`).
   */
  voidSale(
    id: SaleId,
    reach: LedgerReach,
    request: RequestedSaleVoid,
  ): Promise<Result<SaleVoiding, DomainError>>

  /**
   * The sales that match the criteria, the latest first; of sales at the
   * same moment, by their IDs, downwards. Null when the sale the page is
   * to start after is not one within the reach.
   */
  list(
    criteria: SaleListCriteria,
  ): Promise<Result<SaleList | null, DomainError>>

  /**
   * What a calculation refers to (`planCalculation`), read at one moment:
   * the salon, the service lines of the booking, the services and the
   * payment methods of the salon. Nothing is held and nothing is written.
   */
  findCalculationReferences(
    request: RequestedCalculation,
  ): Promise<Result<CalculationReferences, DomainError>>
}
