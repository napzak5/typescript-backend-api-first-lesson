import { Result } from '@beauty-salon-backend/utility'
import { purchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PurchaseOrderReadMapper } from '../../mappers/read/purchase-order.mapper'
import { PurchaseOrderWriteMapper } from '../../mappers/write/purchase-order.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiPurchaseOrderResponse,
  parsePurchaseOrderId,
} from '../../models/purchase-order'
import { purchaseOrderReceiveRequestSchema } from '../../schemas/purchase-order.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import { actingStaffOf, purchaseOrderReachOf } from './_shared/authorization'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'
import { toStatusConflict } from './_shared/refusals'

const MESSAGE = purchaseOrderMessages.invalidPurchaseOrderReceipt

export class ReceivePurchaseOrderUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Receives the goods of an order placed with the supplier: what arrived
   * of each item is recorded as a purchase into its stock row, at the unit
   * price of the item, by the staff member who receives it (none for an
   * administrator), and the order is delivered. Every member of the salon
   * receives the goods, as every member records a purchase.
   *
   * An item the order does not have, and more than an item orders, are
   * errors of the request (400), every one of them reported; a stock row
   * that would hold more than it can is a conflict with what it holds
   * (409), and nothing is written.
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
    const request = parseWith(purchaseOrderReceiveRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const received = await this.dependencies.purchaseOrderRepository.receive(
      reach,
      orderId.data,
      PurchaseOrderWriteMapper.fromReceiveRequest(
        request.data,
        actingStaffOf(actor),
      ),
    )

    return Result.flatMap(received, (receipt) =>
      match(receipt)
        .returnType<Result<ApiPurchaseOrderResponse, DomainError>>()
        .with({ type: 'received' }, ({ order }) =>
          PurchaseOrderReadMapper.toApiPurchaseOrder(order),
        )
        .with({ type: 'notFound' }, () =>
          Result.error(DomainErrors.notFound('PurchaseOrder', orderId.data)),
        )
        .with({ type: 'closed' }, { type: 'notFromStatus' }, (refusal) =>
          Result.error(
            toStatusConflict(
              orderId.data,
              refusal,
              'the goods of an ordered or shipped order are received',
            ),
          ),
        )
        .with({ type: 'itemsRefused' }, ({ refusals }) =>
          Result.error(
            DomainErrors.validation(
              MESSAGE,
              refusals.map((refusal) =>
                match(refusal)
                  .with({ type: 'notOrdered' }, ({ index }) =>
                    notFound(
                      `items.${index}.inventoryId`,
                      purchaseOrderMessages.aStockRowOfItemOfOrder,
                    ),
                  )
                  .with({ type: 'moreThanOrdered' }, ({ index, ordered }) => ({
                    field: `items.${index}.quantity`,
                    rule: 'too_big',
                    message: purchaseOrderMessages.atMostOrdered(ordered),
                  }))
                  .exhaustive(),
              ),
            ),
          ),
        )
        .with({ type: 'overLimit' }, ({ inventoryId }) =>
          Result.error(
            DomainErrors.conflict(
              `The stock of row ${inventoryId} would go above 99999999.99`,
            ),
          ),
        )
        .exhaustive(),
    )
  }
}
