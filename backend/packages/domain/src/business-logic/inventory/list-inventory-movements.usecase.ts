import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  inventoryMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { InventoryTransactionReadMapper } from '../../mappers/read/inventory-transaction.mapper'
import { InventoryTransactionWriteMapper } from '../../mappers/write/inventory-transaction.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiInventoryTransactionResponse,
  parseInventoryId,
} from '../../models/inventory'
import type { ApiPage } from '../../models/page'
import { inventoryTransactionSearchRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { inventoryReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = inventoryMessages.invalidStockMovementSearch

export class ListInventoryMovementsUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Lists the stock movements of a row, latest first. The cursor of a page
   * is the ID of its last movement, and one that names no movement of the
   * row is refused. A row the actor does not reach is not there.
   *
   * Whether the actor reads stock is decided before the request is looked
   * at, which is why the query arrives as the caller decoded it.
   */
  async execute(
    actor: Actor,
    id: unknown,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiInventoryTransactionResponse>, DomainError>> {
    const reach = inventoryReachOf(actor)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const inventoryId = parseInventoryId(id)
    if (inventoryId.type === 'error') {
      return inventoryId
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      inventoryTransactionSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = InventoryTransactionWriteMapper.fromSearchRequest(
      request.data,
      inventoryId.data,
    )

    const listed = await this.dependencies.inventoryRepository.listMovements(
      reach,
      criteria,
    )
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<
        Result<ApiPage<ApiInventoryTransactionResponse>, DomainError>
      >()
      .with({ type: 'inventoryNotFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.inventory, inventoryId.data),
        ),
      )
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: inventoryMessages.aStockMovementOfStockRow,
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, (list) =>
        InventoryTransactionReadMapper.toApiInventoryTransactionPage(
          list,
          criteria,
        ),
      )
      .exhaustive()
  }
}
