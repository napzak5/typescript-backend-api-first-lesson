import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  listParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the customer list that are not text, as their types. */
const customerSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  tags: listParameter.exactOptional(),
})

export const decodeCustomerSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(customerSearchQuerySchema, query, 'Invalid customer search')
