import { Result } from '@beauty-salon-backend/utility'
import { inventoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { InventoryReadMapper } from '../../mappers/read/inventory.mapper'
import { InventoryWriteMapper } from '../../mappers/write/inventory.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiInventoryResponse,
  parseInventoryId,
} from '../../models/inventory'
import { inventoryUpdateRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { inventoryKeeperReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = inventoryMessages.invalidStockRow

export class UpdateInventoryUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Changes what a request names of a stock row: its lot, its expiry date,
   * where it is kept and its notes. The stock figures change only through
   * stock movements and stock counts. A lot number that is written has to
   * fit the product as it is now.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiInventoryResponse, DomainError>> {
    const reach = inventoryKeeperReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const inventoryId = parseInventoryId(id)
    if (inventoryId.type === 'error') {
      return inventoryId
    }
    const request = parseWith(inventoryUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const updated = await this.dependencies.inventoryRepository.update(
      reach,
      inventoryId.data,
      InventoryWriteMapper.fromUpdateRequest(request.data),
    )
    if (updated.type === 'error') {
      return updated
    }

    return match(updated.data)
      .returnType<Result<ApiInventoryResponse, DomainError>>()
      .with({ type: 'updated' }, ({ row }) =>
        InventoryReadMapper.toApiInventory(row),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(DomainErrors.notFound('Inventory', inventoryId.data)),
      )
      .with({ type: 'lotNumberRefused' }, ({ message }) =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            { field: 'lotNumber', rule: 'custom', message },
          ]),
        ),
      )
      .exhaustive()
  }
}
