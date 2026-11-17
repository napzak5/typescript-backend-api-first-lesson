import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The purchase order of the request. */
export type PurchaseOrderParams = { id: string }

export type ListPurchaseOrdersResponse = JsonBody<
  operations['PurchaseOrderCrud_list']['responses'][200]['content']
>
export type CreatePurchaseOrderResponse = JsonBody<
  operations['PurchaseOrderCrud_create']['responses'][201]['content']
>
export type GetPurchaseOrderResponse = JsonBody<
  operations['PurchaseOrderCrud_get']['responses'][200]['content']
>
export type UpdatePurchaseOrderResponse = JsonBody<
  operations['PurchaseOrderCrud_update']['responses'][200]['content']
>
export type ApprovePurchaseOrderResponse = JsonBody<
  operations['PurchaseOrderCrud_approve']['responses'][200]['content']
>
export type CancelPurchaseOrderResponse = JsonBody<
  operations['PurchaseOrderCrud_cancel']['responses'][200]['content']
>
export type ReceivePurchaseOrderResponse = JsonBody<
  operations['PurchaseOrderCrud_receive']['responses'][200]['content']
>
export type ListReorderSuggestionsResponse = JsonBody<
  operations['PurchaseOrderCrud_listReorderSuggestions']['responses'][200]['content']
>
