import { Result } from '@beauty-salon-backend/utility'
import { purchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { PurchaseOrderReadMapper } from '../../mappers/read/purchase-order.mapper'
import { PurchaseOrderWriteMapper } from '../../mappers/write/purchase-order.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import type { ApiPurchaseOrderResponse } from '../../models/purchase-order'
import { purchaseOrderSearchRequestSchema } from '../../schemas/purchase-order.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { purchaseOrderReachOf } from './_shared/authorization'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = purchaseOrderMessages.invalidPurchaseOrderSearch

export class ListPurchaseOrdersUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Lists the orders the actor reaches, latest first by the dates of the
   * orders. The cursor of a page is the ID of its last order, and one that
   * names no order the actor reaches is refused.
   *
   * Whether the actor reads orders is decided before the request is looked
   * at, which is why the query arrives as the caller decoded it. A member
   * of a salon is listed the orders of that salon and is refused when the
   * query names another; an administrator is listed those of every salon,
   * or of the one the query names.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiPurchaseOrderResponse>, DomainError>> {
    const reach = purchaseOrderReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      purchaseOrderSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = PurchaseOrderWriteMapper.fromSearchRequest(
      request.data,
      reach,
    )
    if (criteria.salonId !== null && !isWithin(reach, criteria.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const listed =
      await this.dependencies.purchaseOrderRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<ApiPage<ApiPurchaseOrderResponse>, DomainError>>()
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name a purchase order of the list',
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, (list) =>
        PurchaseOrderReadMapper.toApiPurchaseOrderPage(list, criteria),
      )
      .exhaustive()
  }
}
