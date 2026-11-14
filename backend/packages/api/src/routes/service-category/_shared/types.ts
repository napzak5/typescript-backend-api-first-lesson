import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/** The salon and the category of the request. */
export type ServiceCategoryParams = SalonParams & { id: string }

export type ListServiceCategoriesResponse = JsonBody<
  operations['ServiceCategoryCrud_list']['responses'][200]['content']
>
export type CreateServiceCategoryResponse = JsonBody<
  operations['ServiceCategoryCrud_create']['responses'][201]['content']
>
export type GetServiceCategoryResponse = JsonBody<
  operations['ServiceCategoryCrud_get']['responses'][200]['content']
>
export type UpdateServiceCategoryResponse = JsonBody<
  operations['ServiceCategoryCrud_update']['responses'][200]['content']
>
