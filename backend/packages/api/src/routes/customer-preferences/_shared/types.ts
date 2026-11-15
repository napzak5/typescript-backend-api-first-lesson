import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The customer of a request to `/customers/:id/preferences`. */
export type CustomerPreferencesParams = { id: string }

export type GetCustomerPreferencesResponse = JsonBody<
  operations['CustomerCrud_getPreferences']['responses'][200]['content']
>
export type UpdateCustomerPreferencesResponse = JsonBody<
  operations['CustomerCrud_updatePreferences']['responses'][200]['content']
>

export type GetOwnCustomerPreferencesResponse = JsonBody<
  operations['CustomerProfile_getPreferences']['responses'][200]['content']
>
export type UpdateOwnCustomerPreferencesResponse = JsonBody<
  operations['CustomerProfile_updatePreferences']['responses'][200]['content']
>
