import type { ApiInventoryAlertSearchRequest } from '@beauty-salon-backend/domain'
import { z } from 'zod'
import {
  booleanParameter,
  numberParameter,
  queryDecoder,
} from '../../../shared/query-parameters'

/** The parameters of the list of alerts that are not text, as their types. */
export const decodeInventoryAlertSearchQuery = queryDecoder(
  z.looseObject({
    limit: numberParameter.exactOptional(),
    acknowledged: booleanParameter.exactOptional(),
  }) satisfies z.ZodType<
    Pick<ApiInventoryAlertSearchRequest, 'limit' | 'acknowledged'>
  >,
  'Invalid inventory alert search',
)
