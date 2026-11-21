import type {
  ApiCustomerAllergySearchRequest,
  ApiMedicalChartSearchRequest,
} from '@beauty-salon-backend/domain'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the list of medical charts that are not text, as their types. */
export const decodeMedicalChartSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    hasAllergies: booleanParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiMedicalChartSearchRequest, 'limit' | 'hasAllergies'>
  >,
  'Invalid medical chart search',
)

/** The parameter of the list of the allergies of a customer that is no text, as its type. */
export const decodeCustomerAllergySearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiCustomerAllergySearchRequest, 'limit'>>,
  'Invalid customer allergy search',
)
