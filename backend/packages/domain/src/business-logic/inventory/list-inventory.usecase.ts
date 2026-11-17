import { Result } from '@beauty-salon-backend/utility'
import type { Actor } from '../../models/auth'
import { inventorySearchRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { DEFAULT_LIMIT, type InventoryPage, pageOf } from './_shared/page'

const MESSAGE = 'Invalid inventory search'

export class ListInventoryUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Lists the stock rows the actor reaches in the order of the product
   * codes, the rows of a product by their lot numbers. The cursor of a page
   * is the ID of its last row, and one that names no row the actor reaches
   * is refused.
   *
   * Whether the actor reads stock is decided before the request is looked
   * at, which is why the query arrives as the caller decoded it. A member of
   * a salon is listed the stock of that salon and is refused when the query
   * names another; an administrator is listed that of every salon, or of the
   * one the query names.
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

    const request = parseWith(inventorySearchRequestSchema, query.data, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { cursor, salonId, productId, lotNumber } = request.data
    if (salonId !== undefined && !isWithin(reach, salonId)) {
      return Result.error(DomainErrors.forbidden())
    }
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.inventoryRepository.list({
      reach,
      limit,
      after: cursor ?? null,
      salonId: salonId ?? null,
      productId: productId ?? null,
      lotNumber: lotNumber ?? null,
    })

    return Result.flatMap(listed, (rows) =>
      pageOf(rows, { limit, cursor: cursor ?? null }, MESSAGE),
    )
  }
}
