import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { PurchaseOrderReadMapper } from '../../mappers/read/purchase-order.mapper'
import type { Actor } from '../../models/auth'
import type { ApiReorderSuggestionResponse } from '../../models/purchase-order'
import type { ApiPaginationMeta } from '../../models/salon'
import { reorderSuggestionSearchRequestSchema } from '../../schemas/purchase-order.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { salonNotFound } from '../inventory/_shared/refusals'
import { purchaseOrderReachOf } from './_shared/authorization'
import type { PurchaseOrderUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid reorder suggestion search'

const DEFAULT_LIMIT = 20

export type ReorderSuggestionPage = {
  data: ApiReorderSuggestionResponse[]
  meta: ApiPaginationMeta
}

export class ListReorderSuggestionsUseCase {
  constructor(
    private readonly dependencies: PurchaseOrderUseCaseDependencies,
  ) {}

  /**
   * Lists what a salon has to order, product by product: those whose stock
   * and what the open orders of the salon bring of them are at or below
   * their reorder point, with the quantity that brings them up to their
   * maximum stock. By the codes of the products; the cursor of a page is
   * the ID of its last product, and one that names no product of the salon
   * is refused.
   *
   * Whether the actor orders at all is decided before the query is looked
   * at, which is why it arrives as the caller decoded it, and whether for
   * the salon of the query before the salon is looked up.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ReorderSuggestionPage, DomainError>> {
    const reach = purchaseOrderReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      reorderSuggestionSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { cursor, salonId } = request.data
    if (!isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const { purchaseOrderRepository, salonRepository } = this.dependencies
    const salonExists = await salonRepository.exists(salonId)
    if (salonExists.type === 'error') {
      return salonExists
    }
    if (!salonExists.data) {
      return Result.error(salonNotFound(MESSAGE))
    }

    const listed = await purchaseOrderRepository.listReorderSuggestions({
      salonId,
      limit,
      after: cursor ?? null,
    })

    return Result.flatMap(listed, (listing) =>
      match(listing)
        .returnType<Result<ReorderSuggestionPage, DomainError>>()
        .with({ type: 'cursorNotFound' }, () =>
          Result.error(
            DomainErrors.validation(MESSAGE, [
              {
                field: 'cursor',
                rule: 'not_found',
                message: 'Must name a product of the salon',
              },
            ]),
          ),
        )
        .with({ type: 'listed' }, ({ suggestions, total, hasMore }) =>
          Result.map(
            PurchaseOrderReadMapper.toApiReorderSuggestions(suggestions),
            (data) => ({
              data,
              meta: {
                total,
                limit,
                hasMore,
                cursor: cursor ?? null,
                nextCursor: hasMore ? (data.at(-1)?.productId ?? null) : null,
                prevCursor: null,
              },
            }),
          ),
        )
        .exhaustive(),
    )
  }
}
