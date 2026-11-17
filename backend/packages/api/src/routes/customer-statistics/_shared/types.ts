import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The customer of a request to `/customers/:id/statistics`. */
export type CustomerStatisticsParams = { id: string }

export type GetCustomerStatisticsResponse = JsonBody<
  operations['CustomerCrud_getStatistics']['responses'][200]['content']
>
