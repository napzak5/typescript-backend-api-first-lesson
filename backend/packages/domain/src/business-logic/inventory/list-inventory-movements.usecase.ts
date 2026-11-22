import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { InventoryTransactionReadMapper } from '../../mappers/read/inventory-transaction.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiInventoryTransactionResponse,
  parseInventoryId,
} from '../../models/inventory'
import type { ApiPaginationMeta } from '../../models/page'
import { inventoryTransactionSearchRequestSchema } from '../../schemas/inventory.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { inventoryReachOf } from './_shared/authorization'
import type { InventoryUseCaseDependencies } from './_shared/dependencies'
import { DEFAULT_LIMIT } from './_shared/page'

const MESSAGE = 'Invalid stock movement search'

export type InventoryTransactionPage = {
  data: ApiInventoryTransactionResponse[]
  meta: ApiPaginationMeta
}

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
  ): Promise<Result<InventoryTransactionPage, DomainError>> {
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
    const { cursor, transactionType, startDate, endDate } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const listed = await this.dependencies.inventoryRepository.listMovements(
      reach,
      {
        inventoryId: inventoryId.data,
        limit,
        after: cursor ?? null,
        transactionType: transactionType ?? null,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
      },
    )
    if (listed.type === 'error') {
      return listed
    }

    return match(listed.data)
      .returnType<Result<InventoryTransactionPage, DomainError>>()
      .with({ type: 'inventoryNotFound' }, () =>
        Result.error(DomainErrors.notFound('Inventory', inventoryId.data)),
      )
      .with({ type: 'cursorNotFound' }, () =>
        Result.error(
          DomainErrors.validation(MESSAGE, [
            {
              field: 'cursor',
              rule: 'not_found',
              message: 'Must name a stock movement of the stock row',
            },
          ]),
        ),
      )
      .with({ type: 'listed' }, ({ transactions, total, hasMore }) =>
        Result.map(
          InventoryTransactionReadMapper.toApiInventoryTransactions(
            transactions,
          ),
          (data) => ({
            data,
            meta: {
              total,
              limit,
              hasMore,
              cursor: cursor ?? null,
              nextCursor: hasMore ? (transactions.at(-1)?.id ?? null) : null,
              // Pages are only walked forwards.
              prevCursor: null,
            },
          }),
        ),
      )
      .exhaustive()
  }
}
