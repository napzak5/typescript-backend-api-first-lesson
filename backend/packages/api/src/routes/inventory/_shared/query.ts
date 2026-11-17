import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameters of the stock list that are not text, as their types. */
const inventorySearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeInventorySearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(inventorySearchQuerySchema, query, 'Invalid inventory search')

/** The parameters of the low-stock list that are not text, as their types. */
const lowStockSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  threshold: numberParameter.exactOptional(),
})

export const decodeLowStockSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(lowStockSearchQuerySchema, query, 'Invalid low-stock search')

/** The parameters of the expiring list that are not text, as their types. */
const expiringSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  days: numberParameter.exactOptional(),
})

export const decodeExpiringSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(expiringSearchQuerySchema, query, 'Invalid expiring search')

/** The parameter of the history of a stock row that is not text, as its type. */
const movementSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeMovementSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(movementSearchQuerySchema, query, 'Invalid stock movement search')
