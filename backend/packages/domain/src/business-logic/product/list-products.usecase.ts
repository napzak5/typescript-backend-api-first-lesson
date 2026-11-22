import { Result } from '@beauty-salon-backend/utility'
import { ProductReadMapper } from '../../mappers/read/product.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPaginationMeta } from '../../models/page'
import type { ApiProductResponse } from '../../models/product'
import { parseSalonIdOfPath } from '../../models/salon'
import { productSearchRequestSchema } from '../../schemas/product.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { requireSalon } from '../_shared/existing-salon'
import { mayReadProducts } from './_shared/authorization'
import type { ProductUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid product search'

export type ProductPage = {
  data: ApiProductResponse[]
  meta: ApiPaginationMeta
}

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
  ): Promise<Result<ProductPage, DomainError>> {
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
    const {
      cursor,
      keyword,
      category,
      barcode,
      isActive,
      isForSale,
      isForTreatment,
    } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const { productRepository, salonRepository } = this.dependencies
    const salonExists = await requireSalon(salonRepository, salonId.data)
    if (salonExists.type === 'error') {
      return salonExists
    }

    const listed = await productRepository.list({
      salonId: salonId.data,
      limit,
      after: cursor ?? null,
      keyword: keyword ?? null,
      category: category ?? null,
      barcode: barcode ?? null,
      isActive: isActive ?? null,
      isForSale: isForSale ?? null,
      isForTreatment: isForTreatment ?? null,
    })
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

    const { products, total, hasMore } = listed.data
    const lastProductId = products.at(-1)?.id ?? null

    return Result.map(ProductReadMapper.toApiProducts(products), (data) => ({
      data,
      meta: {
        total,
        limit,
        hasMore,
        cursor: cursor ?? null,
        nextCursor: hasMore ? lastProductId : null,
        // Pages are only walked forwards.
        prevCursor: null,
      },
    }))
  }
}
