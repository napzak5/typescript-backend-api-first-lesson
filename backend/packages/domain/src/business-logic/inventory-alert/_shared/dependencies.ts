import type { IInventoryAlertRepository } from '../../../repositories/inventory-alert.repository'
import type { ISalonRepository } from '../../../repositories/salon.repository'

/** Everything the use cases of the alerts of the stock need from the outside. */
export interface InventoryAlertUseCaseDependencies {
  inventoryAlertRepository: IInventoryAlertRepository
  /**
   * Tells whether the salon of a query exists, and in which time zone it
   * counts its days.
   */
  salonRepository: ISalonRepository
  /** Now, for what has expired and what expires soon. */
  clock: () => Date
}
