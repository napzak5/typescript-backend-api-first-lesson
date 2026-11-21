import type { ApiServiceCategorySearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the category list that are not text, as their types. */
export const decodeServiceCategorySearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    isActive: booleanParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiServiceCategorySearchRequest, 'limit' | 'isActive'>
  >,
  'Invalid service category search',
)
