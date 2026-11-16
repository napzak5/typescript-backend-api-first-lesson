import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the history of points that is not text, as its type. */
const pointTransactionSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodePointTransactionSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    pointTransactionSearchQuerySchema,
    query,
    'Invalid point transaction search',
  )

/** The parameter of the expiring points, as its type. */
const expiringPointsQuerySchema = z.looseObject({
  days: numberParameter.exactOptional(),
})

export const decodeExpiringPointsQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(expiringPointsQuerySchema, query, 'Invalid expiring points search')
