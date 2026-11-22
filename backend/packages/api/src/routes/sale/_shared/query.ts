import type { ApiSaleSearchRequest } from '@beauty-salon-backend/domain'
import { saleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameter of the sale list that is not text, as its type. */
export const decodeSaleSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiSaleSearchRequest, 'limit'>>,
  saleMessages.invalidSaleSearch,
)
