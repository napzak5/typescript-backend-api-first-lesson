import type { LedgerReach } from '../../models/booking'
import type {
  ApiSaleVoidRequest,
  RequestedCalculation,
  RequestedSale,
  RequestedSaleChange,
  RequestedSaleVoid,
} from '../../models/sale'
import type { SaleListCriteria } from '../../repositories/sale.repository'
import type {
  SaleCalculateRequest,
  SaleCreateRequest,
  SaleSearchRequest,
  SaleUpdateRequest,
} from '../../schemas/sale.schema'
import { toPaging } from './page'

/**
 * API request → what the sales ledger is asked with. Nothing is converted
 * and no row is made. A sale is what the till charged, so a request states
 * its lines with their amounts; what the sale says of them taken together,
 * its day and its number come from the lines and from the rows the request
 * refers to, so a pure function plans the rows (`planSale`,
 * `planSaleChange`, `planCalculation`), and this mapper returns what such
 * a plan is made from. It is where the compiler checks that a request
 * holds what the plan reads.
 */
export const SaleWriteMapper = {
  /** The sale a till asks to enter. */
  fromCreateRequest(request: SaleCreateRequest): RequestedSale {
    return request
  },

  /** The correction of a sale: the properties the request names, and no others. */
  fromUpdateRequest(request: SaleUpdateRequest): RequestedSaleChange {
    return request
  },

  /** The void of a sale, with the reason the request gives. */
  fromVoidRequest(request: ApiSaleVoidRequest): RequestedSaleVoid {
    return request
  },

  /** What a sale is calculated from before it is entered. */
  fromCalculateRequest(request: SaleCalculateRequest): RequestedCalculation {
    return request
  },

  /**
   * The criteria of the list within the reach of the reader: a filter the
   * request does not name is none.
   */
  fromSearchRequest(
    request: SaleSearchRequest,
    reach: LedgerReach,
  ): SaleListCriteria {
    return {
      reach,
      ...toPaging(request),
      salonId: request.salonId ?? null,
      customerId: request.customerId ?? null,
      bookingId: request.bookingId ?? null,
      paymentStatus: request.paymentStatus ?? null,
      startDate: request.startDate ?? null,
      endDate: request.endDate ?? null,
    }
  },
}
