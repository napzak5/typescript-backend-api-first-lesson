import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The customer of a request below `/customers/:id`. */
export type CustomerVersionsParams = { id: string }

/** The customer and the number of the version of `/customers/:id/versions/:version`. */
export type CustomerVersionParams = { id: string; version: string }

export type GetCustomerHistoryResponse = JsonBody<
  operations['CustomerCrud_getHistory']['responses'][200]['content']
>
export type GetCustomerVersionResponse = JsonBody<
  operations['CustomerCrud_getVersion']['responses'][200]['content']
>
