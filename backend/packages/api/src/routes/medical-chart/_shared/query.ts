import { type DomainError, parseWith } from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
} from '../../../shared/query-parameters'

/** The parameters of the list of medical charts that are not text, as their types. */
const medicalChartSearchQuerySchema = z.looseObject({
  limit: numberParameter.exactOptional(),
  hasAllergies: booleanParameter.exactOptional(),
})

export const decodeMedicalChartSearchQuery = (
  query: unknown,
): Result<unknown, DomainError> =>
  parseWith(
    medicalChartSearchQuerySchema,
    query,
    'Invalid medical chart search',
  )
