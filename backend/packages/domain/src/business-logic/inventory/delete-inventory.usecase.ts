import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  inventoryMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import type { Actor } from '../../models/auth'
import { type InventoryId, parseInventoryId } from '../../models/inventory'
import { type DomainError, DomainErrors } from '../../shared'
import { inventoryKeeperReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'

export class DeleteInventoryUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Deletes a stock row that counts no stock. Its stock movements stay, as
   * the record of what came and went. A row that still counts stock stays:
   * a stock movement brings it to zero first, so that no stock disappears
   * with its row. Resolves to the ID of the deleted row.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<InventoryId, DomainError>> {
    const reach = inventoryKeeperReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const inventoryId = parseInventoryId(id)
    if (inventoryId.type === 'error') {
      return inventoryId
    }

    const removed = await this.dependencies.inventoryRepository.delete(
      reach,
      inventoryId.data,
    )
    if (removed.type === 'error') {
      return removed
    }

    return match(removed.data)
      .returnType<Result<InventoryId, DomainError>>()
      .with({ type: 'deleted' }, () => inventoryId)
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.inventory, inventoryId.data),
        ),
      )
      .with({ type: 'inStock' }, () =>
        Result.error(DomainErrors.conflict(inventoryMessages.rowCountsStock)),
      )
      .exhaustive()
  }
}
