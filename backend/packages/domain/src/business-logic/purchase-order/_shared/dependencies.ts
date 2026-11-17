import type { IPurchaseOrderRepository } from '../../../repositories/purchase-order.repository'
import type { ISalonRepository } from '../../../repositories/salon.repository'
import type { IPurchaseOrderNumberIssuer } from '../../../services/purchase-order-number-issuer'

/** Everything the use cases of the purchase orders need from the outside. */
export interface PurchaseOrderUseCaseDependencies {
  purchaseOrderRepository: IPurchaseOrderRepository
  /** Tells whether the salon of a new order exists. */
  salonRepository: ISalonRepository
  purchaseOrderNumberIssuer: IPurchaseOrderNumberIssuer
}
