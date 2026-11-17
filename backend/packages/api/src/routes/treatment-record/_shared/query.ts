import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { numberParameter } from '../../../shared/query-parameters'

/** The parameter of the list of treatment records that is not text, as its type. */
const treatmentRecordSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
})

export const decodeTreatmentRecordSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    treatmentRecordSearchQuerySchema,
    query,
    'Invalid treatment record search',
  )
