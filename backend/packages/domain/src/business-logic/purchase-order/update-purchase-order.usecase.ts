import { Result } from '@beauty-salon-backend/utility'
import { PurchaseOrderWriteMapper } from '../../mappers/write/purchase-order.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiPurchaseOrderResponse,
  parsePurchaseOrderId,
} from '../../models/purchase-order'
import { purchaseOrderUpdateRequestSchema } from '../../schemas/purchase-order.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { purchaseOrderReachOf } from './_shared/authorization'
import { resultOfChange } from './_shared/change'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid purchase order'

export class UpdatePurchaseOrderUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Changes what a request names of an open order: its status, by one of
   * the steps the staff take (`refusalOfUpdate`), the expected delivery
   * and the notes. What is ordered, from whom and for how much does not
   * change: an order that is wrong is cancelled and drafted again.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiPurchaseOrderResponse, DomainError>> {
    const reach = purchaseOrderReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const orderId = parsePurchaseOrderId(id)
    if (orderId.type === 'error') {
      return orderId
    }
    const request = parseWith(purchaseOrderUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    return resultOfChange(
      orderId.data,
      await this.dependencies.purchaseOrderRepository.update(
        reach,
        orderId.data,
        PurchaseOrderWriteMapper.fromUpdateRequest(request.data),
      ),
      'an update moves a draft to pending, an approved order to ordered and an ordered one to shipped',
    )
  }
}
