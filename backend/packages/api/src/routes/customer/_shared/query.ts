import type {
  ApiCustomerExportRequest,
  ApiCustomerSearchRequest,
} from '@beauty-salon-backend/domain'
import { z } from 'zod'
import {
  listParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the customer list that are not text, as their types. */
export const decodeCustomerSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    tags: listParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiCustomerSearchRequest, 'limit' | 'tags'>>,
  'Invalid customer search',
)

/** The parameters of the CSV export that are not text, as their types. */
export const decodeCustomerExportQuery = queryDecoder(
  z.looseObject({
    tags: listParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiCustomerExportRequest, 'tags'>>,
  'Invalid customer export',
)
