import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody, SalonParams } from '../../../shared/operation-types'

/** The salon and the product of the request. */
export type ProductParams = SalonParams & { id: string }

export type ListProductsResponse = JsonBody<
  operations['ProductCrud_list']['responses'][200]['content']
>
export type CreateProductResponse = JsonBody<
  operations['ProductCrud_create']['responses'][201]['content']
>
export type GetProductResponse = JsonBody<
  operations['ProductCrud_get']['responses'][200]['content']
>
export type UpdateProductResponse = JsonBody<
  operations['ProductCrud_update']['responses'][200]['content']
>
