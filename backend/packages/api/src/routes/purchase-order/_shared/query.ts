import type {
  ApiPurchaseOrderSearchRequest,
  ApiReorderSuggestionSearchRequest,
} from '@beauty-salon-backend/domain'
import { purchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the list of purchase orders that is not text, as its type. */
export const decodePurchaseOrderSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiPurchaseOrderSearchRequest, 'limit'>>,
  purchaseOrderMessages.invalidPurchaseOrderSearch,
)

/** The parameter of the suggestions that is not text, as its type. */
export const decodeReorderSuggestionSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiReorderSuggestionSearchRequest, 'limit'>>,
  purchaseOrderMessages.invalidReorderSuggestionSearch,
)
