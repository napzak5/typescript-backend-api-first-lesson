import type {
  AlertAcknowledgement,
  InventoryAlertFilter,
} from '../../business-logic/inventory-alert/_shared/alerts'
import type { ApiInventoryAlertAcknowledgeRequest } from '../../models/inventory-alert'
import type { Paging } from '../../models/page'
import type { SalonId } from '../../models/salon'
import type {
  InventoryAlertSearchRequest,
  InventoryAlertSummaryRequest,
} from '../../schemas/inventory-alert.schema'
import { toPaging } from './page'

/**
 * API request → what the alerts of the stock are asked with. Nothing is
 * converted and no row is made: the alerts are worked out whenever they
 * are read, and the row of an acknowledgement holds what the stock is at
 * that moment, which the repository reads. This mapper is where the
 * compiler checks that a request holds what the rules read.
 */
export const InventoryAlertWriteMapper = {
  /**
   * The salon whose alerts are listed, where the page begins and what the
   * alerts are narrowed to: a filter the request does not name is none. The
   * cursor is the ID of what the last alert of the page before is about, its
   * stock row or its product.
   */
  fromSearchRequest(
    request: InventoryAlertSearchRequest,
  ): Paging<string> & { salonId: SalonId; filter: InventoryAlertFilter } {
    return {
      salonId: request.salonId,
      ...toPaging(request),
      filter: {
        alert: request.alert ?? null,
        severity: request.severity ?? null,
        acknowledged: request.acknowledged ?? null,
      },
    }
  },

  /** The salon whose alerts are counted. */
  fromSummaryRequest(request: InventoryAlertSummaryRequest): {
    salonId: SalonId
  } {
    return request
  },

  /** The alert that is acknowledged, by the staff member who does, null for none. */
  fromAcknowledgeRequest(
    request: ApiInventoryAlertAcknowledgeRequest,
    acknowledgedBy: string | null,
  ): AlertAcknowledgement {
    return { ...request, acknowledgedBy }
  },
}
