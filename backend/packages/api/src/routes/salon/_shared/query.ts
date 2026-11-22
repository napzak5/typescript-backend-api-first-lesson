import type { ApiSalonSearchRequest } from '@beauty-salon-backend/domain'
import { salonMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import {
  booleanParameter,
  listParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the salon list that are not text, as their types. */
export const decodeSalonSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    minRating: numberParameter.exactOptional(),
    isActive: booleanParameter.exactOptional(),
    features: listParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiSalonSearchRequest, 'limit' | 'minRating' | 'isActive' | 'features'>
  >,
  salonMessages.invalidSalonSearch,
)
