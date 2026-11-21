import type {
  ApiInventoryExpiringSearchRequest,
  ApiInventoryLowStockSearchRequest,
  ApiInventorySearchRequest,
  ApiInventoryTransactionSearchRequest,
} from '@beauty-salon-backend/domain'
import { z } from 'zod'
import { numberParameter, queryDecoder } from '../../../shared/query-parameters'

/** The parameters of the stock list that are not text, as their types. */
export const decodeInventorySearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiInventorySearchRequest, 'limit'>>,
  'Invalid inventory search',
)

/** The parameters of the low-stock list that are not text, as their types. */
export const decodeLowStockSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    threshold: numberParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiInventoryLowStockSearchRequest, 'limit' | 'threshold'>
  >,
  'Invalid low-stock search',
)

/** The parameters of the expiring list that are not text, as their types. */
export const decodeExpiringSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    days: numberParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiInventoryExpiringSearchRequest, 'limit' | 'days'>
  >,
  'Invalid expiring search',
)

/** The parameter of the history of a stock row that is not text, as its type. */
export const decodeMovementSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
  }) satisfies z.ZodType<Pick<ApiInventoryTransactionSearchRequest, 'limit'>>,
  'Invalid stock movement search',
)
