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
export type RestoreCustomerResponse = JsonBody<
  operations['CustomerCrud_restore']['responses'][200]['content']
>
export type MergeCustomersResponse = JsonBody<
  operations['CustomerCrud_merge']['responses'][200]['content']
>
export type BatchGetCustomersResponse = JsonBody<
  operations['CustomerCrud_batchGet']['responses'][200]['content']
>
export type BulkCreateCustomersResponse = JsonBody<
  operations['CustomerCrud_bulkCreate']['responses'][201]['content']
>
export type BulkUpdateCustomersResponse = JsonBody<
  operations['CustomerCrud_bulkUpdate']['responses'][200]['content']
>
export type BulkDeleteCustomersResponse = JsonBody<
  operations['CustomerCrud_bulkDelete']['responses'][200]['content']
>

export type GetCustomerProfileResponse = JsonBody<
  operations['CustomerProfile_get']['responses'][200]['content']
>
export type CreateCustomerProfileResponse = JsonBody<
  operations['CustomerProfile_create']['responses'][201]['content']
>
export type UpdateCustomerProfileResponse = JsonBody<
  operations['CustomerProfile_update']['responses'][200]['content']
>
