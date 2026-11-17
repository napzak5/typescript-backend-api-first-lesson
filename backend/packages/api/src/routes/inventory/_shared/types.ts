import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

/** The stock row of the request. */
export type InventoryParams = { id: string }

export type ListInventoryResponse = JsonBody<
  operations['InventoryCrud_list']['responses'][200]['content']
>
export type CreateInventoryResponse = JsonBody<
  operations['InventoryCrud_create']['responses'][201]['content']
>
export type GetInventoryResponse = JsonBody<
  operations['InventoryCrud_get']['responses'][200]['content']
>
export type UpdateInventoryResponse = JsonBody<
  operations['InventoryCrud_update']['responses'][200]['content']
>
export type ListLowStockInventoryResponse = JsonBody<
  operations['InventoryCrud_listLowStock']['responses'][200]['content']
>
export type ListExpiringInventoryResponse = JsonBody<
  operations['InventoryCrud_listExpiring']['responses'][200]['content']
>
export type RecordInventoryMovementResponse = JsonBody<
  operations['InventoryCrud_recordMovement']['responses'][200]['content']
>
export type ListInventoryMovementsResponse = JsonBody<
  operations['InventoryCrud_listMovements']['responses'][200]['content']
>
