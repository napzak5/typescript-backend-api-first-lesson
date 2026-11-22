import { Result } from '@beauty-salon-backend/utility'
import { productMessages } from '@beauty-salon-shared/i18n/messages/api'
import { ProductReadMapper } from '../../mappers/read/product.mapper'
import { ProductWriteMapper } from '../../mappers/write/product.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import type { ApiProductResponse } from '../../models/product'
import { parseSalonIdOfPath } from '../../models/salon'
import { productSearchRequestSchema } from '../../schemas/product.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayReadProducts } from './_shared/authorization'
import type { ProductUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = productMessages.invalidProductSearch

export class ListProductsUseCase {
  constructor(private readonly dependencies: ProductUseCaseDependencies) {}

  /**
   * Lists the products of a salon in the order of their codes, those it no
   * longer stocks among them unless the request filters. The cursor of a
   * page is the ID of its last product. One that was deleted since is gone,
   * and a cursor that names it is refused: the list has to be read from the
   * start again.
   *
   * Whether the actor may is decided from the salon in the path alone,
   * before the query is looked at. That is why the query arrives as the
   * caller decoded it: a query that could not be decoded is an error of the
   * request, and an actor who may not read the products is told that and
   * nothing about the request.
   */
  async execute(
    actor: Actor,
    salon: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiProductResponse>, DomainError>> {
    const salonId = parseSalonIdOfPath(salon)
    if (salonId.type === 'error') {
      return salonId
    }
    if (!mayReadProducts(actor, salonId.data)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(productSearchRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const criteria = ProductWriteMapper.fromSearchRequest(
      request.data,
      salonId.data,
    )

    const { productRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await productRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a product of the salon',
          },
        ]),
      )
    }

    return ProductReadMapper.toApiProductPage(listed.data, criteria)
  }
}
