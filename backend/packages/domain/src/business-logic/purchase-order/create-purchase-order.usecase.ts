import { Result } from '@beauty-salon-backend/utility'
import { purchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PurchaseOrderReadMapper } from '../../mappers/read/purchase-order.mapper'
import { PurchaseOrderWriteMapper } from '../../mappers/write/purchase-order.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPurchaseOrderResponse } from '../../models/purchase-order'
import { purchaseOrderCreateRequestSchema } from '../../schemas/purchase-order.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { underFreeNumber } from '../_shared/numbered'
import { isWithin } from '../booking/_shared/authorization'
import { notFound } from '../booking/_shared/plan'
import { salonNotFound } from '../inventory/_shared/refusals'
import { actingStaffOf, purchaseOrderReachOf } from './_shared/authorization'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = purchaseOrderMessages.invalidPurchaseOrder

export class CreatePurchaseOrderUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Drafts an order of a salon to a supplier. The server numbers it, dates
   * it, copies the code, the name and the unit of the product of each stock
   * row it orders, and works out its amounts; the staff member who drafts
   * it is recorded, none for an administrator.
   *
   * Whether the actor orders at all is decided before the request is read,
   * and whether for the salon it names before the salon is looked up. A
   * stock row that is not of the salon is a row the order names wrongly
   * (400), as one that is not there is; every such row is reported.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiPurchaseOrderResponse, DomainError>> {
    const reach = purchaseOrderReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(purchaseOrderCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { order, items } = PurchaseOrderWriteMapper.fromCreateRequest(
      request.data,
      actingStaffOf(actor),
    )
    if (!isWithin(reach, order.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const {
      purchaseOrderRepository,
      salonRepository,
      purchaseOrderNumberIssuer,
    } = this.dependencies
    const salonExists = await salonRepository.exists(order.salonId)
    if (salonExists.type === 'error') {
      return salonExists
    }
    if (!salonExists.data) {
      return Result.error(salonNotFound(MESSAGE))
    }

    return underFreeNumber(
      'purchase order',
      purchaseOrderNumberIssuer,
      async (orderNumber) => {
        const created = await purchaseOrderRepository.create({
          order,
          items,
          orderNumber,
        })
        if (created.type === 'error') {
          return created
        }

        return match(created.data)
          .returnType<Result<ApiPurchaseOrderResponse, DomainError> | null>()
          .with({ type: 'created' }, ({ order }) =>
            PurchaseOrderReadMapper.toApiPurchaseOrder(order),
          )
          .with({ type: 'orderNumberTaken' }, () => null)
          .with({ type: 'rowsNotFound' }, ({ indexes }) =>
            Result.error(
              DomainErrors.validation(
                MESSAGE,
                indexes.map((index) =>
                  notFound(
                    `items.${index}.inventoryId`,
                    'a stock row of the salon',
                  ),
                ),
              ),
            ),
          )
          .exhaustive()
      },
    )
  }
}
