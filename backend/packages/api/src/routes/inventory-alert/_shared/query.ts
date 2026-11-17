import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the list of alerts that are not text, as their types. */
const inventoryAlertSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  acknowledged: booleanParameter.exactOptional(),
})

export const decodeInventoryAlertSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    inventoryAlertSearchQuerySchema,
    query,
    'Invalid inventory alert search',
  )
