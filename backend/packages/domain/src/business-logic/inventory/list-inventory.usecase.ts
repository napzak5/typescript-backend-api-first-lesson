import { Result } from '@beauty-salon-backend/utility'
import { inventoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { InventoryReadMapper } from '../../mappers/read/inventory.mapper'
import { InventoryWriteMapper } from '../../mappers/write/inventory.mapper'
import type { Actor } from '../../models/auth'
import type { ApiInventoryResponse } from '../../models/inventory'
import type { ApiPage } from '../../models/page'
import { inventorySearchRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { isWithin } from '../booking/_shared/authorization'
import { inventoryReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { cursorNotFound } from './_shared/refusals'

const MESSAGE = inventoryMessages.invalidInventorySearch

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
  ): Promise<Result<ApiPage<ApiInventoryResponse>, DomainError>> {
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
    const criteria = InventoryWriteMapper.fromSearchRequest(request.data, reach)
    if (criteria.salonId !== null && !isWithin(reach, criteria.salonId)) {
      return Result.error(DomainErrors.forbidden())
    }

    const listed = await this.dependencies.inventoryRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(cursorNotFound(MESSAGE))
    }

    return InventoryReadMapper.toApiInventoryPage(listed.data, criteria)
  }
}
