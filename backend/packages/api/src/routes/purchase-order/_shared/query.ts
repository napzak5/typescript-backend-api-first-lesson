import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the list of purchase orders that is not text, as its type. */
const purchaseOrderSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodePurchaseOrderSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    purchaseOrderSearchQuerySchema,
    query,
    'Invalid purchase order search',
  )
