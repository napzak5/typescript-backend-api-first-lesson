import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the history of a customer that is not text, as its type. */
const customerHistoryQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeCustomerHistoryQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    customerHistoryQuerySchema,
    query,
    'Invalid customer history search',
  )
