import type {
  ApiInventoryCreateRequest,
  ApiInventoryUpdateRequest,
  DbInventoryChanges,
  DbNewInventory,
} from '../../models/inventory'

/**
 * API request → database row. Property names are the column names and no
 * value changes its representation: a request states only text and a date,
 * which the columns hold as they are. The stock figures are not stated: a
 * new row has no stock.
 */
export const InventoryWriteMapper = {
  fromCreateRequest(request: ApiInventoryCreateRequest): DbNewInventory {
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
}
