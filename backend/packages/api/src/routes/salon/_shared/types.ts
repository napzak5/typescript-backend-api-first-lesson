import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type ListSalonsResponse = JsonBody<
  operations['SalonCrud_list']['responses'][200]['content']
>
export type CreateSalonResponse = JsonBody<
  operations['SalonCrud_create']['responses'][201]['content']
>
export type GetSalonResponse = JsonBody<
  operations['SalonCrud_get']['responses'][200]['content']
>
export type UpdateSalonResponse = JsonBody<
  operations['SalonCrud_update']['responses'][200]['content']
>
