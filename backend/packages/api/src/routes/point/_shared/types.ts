import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The customer of a request to `/points/customer/:customerId/...`. */
export type CustomerPointsParams = { customerId: string }

export type GetPointBalanceResponse = JsonBody<
  operations['PointCrud_getBalance']['responses'][200]['content']
>
export type ListPointTransactionsResponse = JsonBody<
  operations['PointCrud_listTransactions']['responses'][200]['content']
>
export type EarnPointsResponse = JsonBody<
  operations['PointCrud_earn']['responses'][200]['content']
>
export type UsePointsResponse = JsonBody<
  operations['PointCrud_use']['responses'][200]['content']
>
export type AdjustPointsResponse = JsonBody<
  operations['PointCrud_adjust']['responses'][200]['content']
>
