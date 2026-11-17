import type { IInventoryRepository } from '../../../repositories/inventory.repository'
import type { ISalonRepository } from '../../../repositories/salon.repository'

/** Everything the use cases of the stock rows need from the outside. */
export interface InventoryUseCaseDependencies {
  inventoryRepository: IInventoryRepository
  /**
   * Tells whether the salon of a request exists, and in which time zone it
   * counts its days.
   */
  salonRepository: ISalonRepository
  /** Today, for what expires within some days of it. */
  clock: () => Date
}
