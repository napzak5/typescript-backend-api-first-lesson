import { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
import { PurchaseOrderReadMapper } from '../../mappers/read/purchase-order.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiPurchaseOrderResponse,
  parsePurchaseOrderId,
} from '../../models/purchase-order'
import { type DomainError, DomainErrors } from '../../shared'
import { purchaseOrderReachOf } from './_shared/authorization'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'

export class GetPurchaseOrderUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Finds an order the actor reaches, with its items. An order of another
   * salon is, to a member of a salon, one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiPurchaseOrderResponse, DomainError>> {
    const reach = purchaseOrderReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const orderId = parsePurchaseOrderId(id)
    if (orderId.type === 'error') {
      return orderId
    }

    const found = await this.dependencies.purchaseOrderRepository.findById(
      reach,
      orderId.data,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(
          DomainErrors.notFound(entityMessages.purchaseOrder, orderId.data),
        )
      : PurchaseOrderReadMapper.toApiPurchaseOrder(found.data)
  }
}
