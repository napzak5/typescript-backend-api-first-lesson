import type { Result } from '@beauty-salon-backend/utility'
import type {
  AlertAcknowledgement,
  InventoryAlert,
} from '../business-logic/inventory-alert/_shared/alerts'
import type { LedgerReach } from '../models/booking'
import type {
  DbInventoryAlertFacts,
  InventoryAlertPosition,
} from '../models/inventory-alert'
import type { SalonId } from '../models/salon'
import type { DomainError } from '../shared'

/** What the alerts of a salon are read from. */
export type InventoryAlertFactsCriteria = {
  salonId: SalonId
  /** The last day on which a stock row counts as expiring soon. */
  lastExpiringDay: string
}

export type InventoryAlertFactsAfter =
  /** The cursor names no product and no stock row of the salon. */
  | { type: 'cursorNotFound' }
  | {
      type: 'listed'
      facts: DbInventoryAlertFacts
      /** Where the alert of the cursor stands, whether it is there or not. */
      after: InventoryAlertPosition
    }

/**
 * What became of an acknowledgement. The alert is decided on its product,
 * or on its stock row, as they are once held.
 */
export type InventoryAlertAcknowledging =
  /**
   * The product is not of a salon the actor reaches, or the stock row is
   * not of the product.
   */
  | { type: 'notFound' }
  /** The runtime does not know the time zone of the salon of the product. */
  | { type: 'unknownTimeZone'; salonId: string; timezone: string }
  /** The product or the stock row does not have the alert now. */
  | { type: 'notActive' }
  /** An acknowledgement of the alert still holds. */
  | { type: 'alreadyAcknowledged' }
  | { type: 'acknowledged'; alert: InventoryAlert }

export interface IInventoryAlertRepository {
  /** What the alerts of a salon come from, read in one snapshot. */
  listFacts(
    criteria: InventoryAlertFactsCriteria,
  ): Promise<Result<DbInventoryAlertFacts, DomainError>>

  /**
   * What the alerts of a salon come from, and where the alert about the
   * product or stock row `after` stands among them, read in one snapshot:
   * the places of the products are those of the snapshot.
   */
  listFactsAfter(
    criteria: InventoryAlertFactsCriteria,
    after: string,
  ): Promise<Result<InventoryAlertFactsAfter, DomainError>>

  /**
   * Acknowledges the alert the request names, if its product or stock row
   * has it now and no acknowledgement of it still holds. The days of the
   * alerts are those of the salon of the product at `now`.
   */
  acknowledge(
    reach: LedgerReach,
    request: AlertAcknowledgement,
    now: Date,
  ): Promise<Result<InventoryAlertAcknowledging, DomainError>>
}
