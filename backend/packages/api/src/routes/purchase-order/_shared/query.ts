import type {
  ApiPurchaseOrderSearchRequest,
  ApiReorderSuggestionSearchRequest,
} from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the list of purchase orders that is not text, as its type. */
export const decodePurchaseOrderSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiPurchaseOrderSearchRequest, 'limit'>>,
  'Invalid purchase order search',
)

/** The parameter of the suggestions that is not text, as its type. */
export const decodeReorderSuggestionSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiReorderSuggestionSearchRequest, 'limit'>>,
  'Invalid reorder suggestion search',
)
