import type { ApiProductSearchRequest } from '@beauty-salon-backend/domain'
import { productMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the product list that are not text, as their types. */
export const decodeProductSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    isActive: booleanParameter.exactOptional(),
    isForSale: booleanParameter.exactOptional(),
    isForTreatment: booleanParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<
      ApiProductSearchRequest,
      'limit' | 'isActive' | 'isForSale' | 'isForTreatment'
    >
  >,
  productMessages.invalidProductSearch,
)
