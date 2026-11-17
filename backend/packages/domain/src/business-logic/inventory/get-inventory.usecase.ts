import { Result } from '@beauty-salon-backend/utility'
import { InventoryReadMapper } from '../../mappers/read/inventory.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiInventoryResponse,
  parseInventoryId,
} from '../../models/inventory'
import { type DomainError, DomainErrors } from '../../shared'
import { inventoryReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'

export class GetInventoryUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Finds a stock row the actor reaches. A row of another salon is, to a
   * member of a salon, one that does not exist.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiInventoryResponse, DomainError>> {
    const reach = inventoryReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const inventoryId = parseInventoryId(id)
    if (inventoryId.type === 'error') {
      return inventoryId
    }

    const found = await this.dependencies.inventoryRepository.findById(
      reach,
      inventoryId.data,
    )
    if (found.type === 'error') {
      return found
    }

    return found.data === null
      ? Result.error(DomainErrors.notFound('Inventory', inventoryId.data))
      : InventoryReadMapper.toApiInventory(found.data)
  }
}
