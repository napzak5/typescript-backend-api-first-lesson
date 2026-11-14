import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/** The salon and the service of the request. */
export type ServiceParams = SalonParams & { id: string }

export type ListServicesResponse = JsonBody<
  operations['ServiceCrud_list']['responses'][200]['content']
>
export type CreateServiceResponse = JsonBody<
  operations['ServiceCrud_create']['responses'][201]['content']
>
export type GetServiceResponse = JsonBody<
  operations['ServiceCrud_get']['responses'][200]['content']
>
export type UpdateServiceResponse = JsonBody<
  operations['ServiceCrud_update']['responses'][200]['content']
>
export type BulkUpdateServicesResponse = JsonBody<
  operations['ServiceCrud_bulkUpdate']['responses'][200]['content']
>
