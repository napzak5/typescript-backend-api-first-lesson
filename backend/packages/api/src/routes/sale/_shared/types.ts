import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The sale of a request to `/sales/:id`. */
export type SaleParams = { id: string }

export type ListSalesResponse = JsonBody<
  operations['SaleCrud_list']['responses'][200]['content']
>
export type CreateSaleResponse = JsonBody<
  operations['SaleCrud_create']['responses'][201]['content']
>
export type GetSaleResponse = JsonBody<
  operations['SaleCrud_get']['responses'][200]['content']
>
export type UpdateSaleResponse = JsonBody<
  operations['SaleCrud_update']['responses'][200]['content']
>
export type VoidSaleResponse = JsonBody<
  operations['SaleCrud_voidSale']['responses'][200]['content']
>
export type ProcessSaleResponse = JsonBody<
  operations['SaleCrud_process']['responses'][200]['content']
>
