import { Result } from '@beauty-salon-backend/utility'
import { InventoryReadMapper } from '../../../mappers/read/inventory.mapper'
import type {
  ApiInventoryResponse,
  InventoryId,
} from '../../../models/inventory'
import type { ApiPaginationMeta } from '../../../models/page'
import type { InventoryList } from '../../../repositories/inventory.repository'
import { type DomainError, DomainErrors } from '../../../shared'

export type InventoryPage = {
  data: ApiInventoryResponse[]
  meta: ApiPaginationMeta
}

export const DEFAULT_LIMIT = 20

/**
 * A page of stock rows as the API returns it. The cursor of the next page
 * is the ID of the last row; pages are only walked forwards. A list that
 * could not tell where the page begins (`null`) is an error of the request:
 * its cursor names a row the list does not reach.
 */
export const pageOf = (
  listed: InventoryList | null,
  page: { limit: number; cursor: InventoryId | null },
  message: string,
): Result<InventoryPage, DomainError> => {
  if (listed === null) {
    return Result.error(
      DomainErrors.validation(message, [
        {
          field: 'cursor',
          rule: 'not_found',
          message: 'Must name a stock row of the list',
        },
      ]),
    )
  }

  const { rows, total, hasMore } = listed
  const lastRowId = rows.at(-1)?.id ?? null

  return Result.map(InventoryReadMapper.toApiInventories(rows), (data) => ({
    data,
    meta: {
      total,
      limit: page.limit,
      hasMore,
      cursor: page.cursor,
      nextCursor: hasMore ? lastRowId : null,
      prevCursor: null,
    },
  }))
}
