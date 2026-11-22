import { EXPIRING_SOON_DAYS } from '../../business-logic/inventory/_shared/expiry'
import type { LedgerReach } from '../../models/booking'
import type {
  ApiInventoryUpdateRequest,
  DbInventoryChanges,
  InventoryId,
  RequestedInventory,
} from '../../models/inventory'
import type { Paging } from '../../models/page'
import type { SalonId } from '../../models/salon'
import type {
  InventoryListCriteria,
  InventoryLowStockCriteria,
} from '../../repositories/inventory.repository'
import type {
  InventoryCreateRequest,
  InventoryExpiringSearchRequest,
  InventoryLowStockSearchRequest,
  InventorySearchRequest,
} from '../../schemas/inventory.schema'
import { toPaging } from './page'

/**
 * API request → database row, or the criteria of a list. Property names
 * are the column names and no value changes its representation: a request
 * states only text and a date, which the columns hold as they are. The
 * stock figures are not stated: a new row has no stock.
 */
export const InventoryWriteMapper = {
  fromCreateRequest(request: InventoryCreateRequest): RequestedInventory {
    return {
      salonId: request.salonId,
      productId: request.productId,
      lotNumber: request.lotNumber,
      expiryDate: request.expiryDate,
      location: request.location,
      shelf: request.shelf,
      notes: request.notes,
    }
  },

  /** Only the properties present in the request become changes. */
  fromUpdateRequest(request: ApiInventoryUpdateRequest): DbInventoryChanges {
    return { ...request }
  },

  /**
   * The criteria of the list of the stock rows within a reach: a filter
   * the request does not name is none.
   */
  fromSearchRequest(
    request: InventorySearchRequest,
    reach: LedgerReach,
  ): InventoryListCriteria {
    return {
      reach,
      ...toPaging(request),
      salonId: request.salonId ?? null,
      productId: request.productId ?? null,
      lotNumber: request.lotNumber ?? null,
    }
  },

  /**
   * The criteria of the list of the rows of a salon that run low: by the
   * threshold of the request, or by the levels of their products when it
   * names none.
   */
  fromLowStockSearchRequest(
    request: InventoryLowStockSearchRequest,
  ): InventoryLowStockCriteria {
    return {
      salonId: request.salonId,
      ...toPaging(request),
      threshold: request.threshold ?? null,
    }
  },

  /**
   * Where the list of the rows of a salon that expire soon begins, and how
   * many days from today count as soon: `EXPIRING_SOON_DAYS` unless the
   * request says. The day that comes to is told by the clocks of the salon,
   * so the use case works it out.
   */
  fromExpiringSearchRequest(
    request: InventoryExpiringSearchRequest,
  ): Paging<InventoryId> & { salonId: SalonId; days: number } {
    return {
      salonId: request.salonId,
      ...toPaging(request),
      days: request.days ?? EXPIRING_SOON_DAYS,
    }
  },
}
