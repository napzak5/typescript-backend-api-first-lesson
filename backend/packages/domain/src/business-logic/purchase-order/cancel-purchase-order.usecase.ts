import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import {
  type ApiPurchaseOrderResponse,
  parsePurchaseOrderId,
} from '../../models/purchase-order'
import { purchaseOrderCancelRequestSchema } from '../../schemas/purchase-order.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { purchaseOrderApproverReachOf } from './_shared/authorization'
import { resultOfChange } from './_shared/change'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid purchase order cancellation'

export class CancelPurchaseOrderUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Calls off an order that is not delivered, for the reason the request
   * gives, and records when. A cancelled order stays, as what was ordered
   * and why it was called off.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiPurchaseOrderResponse, DomainError>> {
    const reach = purchaseOrderApproverReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const orderId = parsePurchaseOrderId(id)
    if (orderId.type === 'error') {
      return orderId
    }
    const request = parseWith(purchaseOrderCancelRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    return resultOfChange(
      orderId.data,
      await this.dependencies.purchaseOrderRepository.cancel(
        reach,
        orderId.data,
        request.data.cancellationReason,
      ),
      'an order is cancelled until it is delivered',
    )
  }
}
