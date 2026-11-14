import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The customer of a request to `/customers/:id`. */
export type CustomerParams = { id: string }

export type ListCustomersResponse = JsonBody<
  operations['CustomerCrud_list']['responses'][200]['content']
>
export type CreateCustomerResponse = JsonBody<
  operations['CustomerCrud_create']['responses'][201]['content']
>
export type GetCustomerResponse = JsonBody<
  operations['CustomerCrud_get']['responses'][200]['content']
>
export type UpdateCustomerResponse = JsonBody<
  operations['CustomerCrud_update']['responses'][200]['content']
>
