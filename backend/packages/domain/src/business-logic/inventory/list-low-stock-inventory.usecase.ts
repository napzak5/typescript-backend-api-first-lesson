import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { inventoryLowStockSearchRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { DEFAULT_LIMIT, type InventoryPage, pageOf } from './_shared/page'
import { salonNotFound } from './_shared/refusals'

const MESSAGE = 'Invalid low-stock search'

export class ListLowStockInventoryUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Lists the stock rows of the products a salon has to replenish: those it
   * still handles whose stock, summed over the rows of the salon, is at or
   * below the threshold of the query or else the minimum stock of the
   * product. One lot that runs low does not make a product low while its
   * other lots make up for it. A product without a stock row is not listed:
   * what is listed are rows. In the order of the stock list.
   *
   * Whether the actor reads stock is decided before the query is looked at,
   * and whether they read that of the salon of the query before the salon is
   * looked up.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<InventoryPage, DomainError>> {
    const reach = inventoryReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }

    const request = parseWith(
      inventoryLowStockSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const { cursor, salonId, threshold } = request.data
    if (!isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const { inventoryRepository, salonRepository } = this.dependencies
    const salonExists = await salonRepository.exists(salonId)
    if (salonExists.type === 'error') {
      return salonExists
    }
    if (!salonExists.data) {
      return Result.error(salonNotFound(MESSAGE))
    }

    const listed = await inventoryRepository.listLowStock({
      salonId,
      limit,
      after: cursor ?? null,
      threshold: threshold ?? null,
    })

    return Result.flatMap(listed, (rows) =>
      pageOf(rows, { limit, cursor: cursor ?? null }, MESSAGE),
    )
  }
}
