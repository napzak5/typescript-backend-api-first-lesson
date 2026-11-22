import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { InventoryTransactionReadMapper } from '../../mappers/read/inventory-transaction.mapper'
import { InventoryTransactionWriteMapper } from '../../mappers/write/inventory-transaction.mapper'
import type { Actor } from '../../models/auth'
import type { ApiInventoryTransactionResponse } from '../../models/inventory'
import { inventoryMovementRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import {
  inventoryReachOf,
  movementReachOf,
  performerOf,
} from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid stock movement'

export class RecordInventoryMovementUseCase {
  constructor(private readonly dependencies: InventoryUseCaseDependencies) {}

  /**
   * Records a movement of the stock of a row, and moves the stock by it.
   * The stock stays at or above what is reserved of it and at or below what
   * a row holds; a movement that would take it out of that is refused and
   * nothing is written.
   *
   * Whether the actor reads stock is decided before the request is looked
   * at, and whether the actor records the kind of movement it names once
   * the request is known to be one. A row the actor does not reach is a
   * property of the request that names no row (400), as one that is not
   * there is.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiInventoryTransactionResponse, DomainError>> {
    if (inventoryReachOf(actor) === null) {
      return Result.error(DomainErrors.forbidden())
    }
    const request = parseWith(inventoryMovementRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { inventoryId, movement } =
      InventoryTransactionWriteMapper.fromMovementRequest(
        request.data,
        performerOf(actor),
      )
    const reach = movementReachOf(actor, movement.transactionType)
    if (reach === null) {
      return Result.error(DomainErrors.forbidden())
    }

    const recorded = await this.dependencies.inventoryRepository.recordMovement(
      reach,
      inventoryId,
      movement,
    )
    if (recorded.type === 'error') {
      return recorded
    }

    return match(recorded.data)
      .returnType<Result<ApiInventoryTransactionResponse, DomainError>>()
      .with({ type: 'recorded' }, ({ transaction }) =>
        InventoryTransactionReadMapper.toApiInventoryTransaction(transaction),
      )
      .with({ type: 'notFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            notFound('inventoryId', 'a stock row'),
          ]),
        ),
      )
      .with({ type: 'belowReserved' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The stock of the row would fall below its reserved stock',
          ),
        ),
      )
      .with({ type: 'overLimit' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The stock of the row would go above 99999999.99',
          ),
        ),
      )
      .exhaustive()
  }
}
