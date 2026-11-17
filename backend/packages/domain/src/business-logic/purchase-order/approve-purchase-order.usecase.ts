import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import {
  type ApiPurchaseOrderResponse,
  parsePurchaseOrderId,
} from '../../models/purchase-order'
import { type DomainError, DomainErrors } from '../../shared'
import {
  actingStaffOf,
  purchaseOrderApproverReachOf,
} from './_shared/authorization'
import { resultOfChange } from './_shared/change'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'

export class ApprovePurchaseOrderUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Approves a pending order: the money is to be spent. The staff member
   * who approves it and when are recorded, no staff member for an
   * administrator. The request has no body: who approves is the actor.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiPurchaseOrderResponse, DomainError>> {
    const reach = purchaseOrderApproverReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const orderId = parsePurchaseOrderId(id)
    if (orderId.type === 'error') {
      return orderId
    }

    return resultOfChange(
      orderId.data,
      await this.dependencies.purchaseOrderRepository.approve(
        reach,
        orderId.data,
        actingStaffOf(actor),
      ),
      'only a pending order is approved',
    )
  }
}
