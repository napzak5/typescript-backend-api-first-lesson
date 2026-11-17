import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type ListInventoryAlertsResponse = JsonBody<
  operations['InventoryAlertCrud_list']['responses'][200]['content']
>
export type AcknowledgeInventoryAlertResponse = JsonBody<
  operations['InventoryAlertCrud_acknowledge']['responses'][200]['content']
>
export type GetInventoryAlertSummaryResponse = JsonBody<
  operations['InventoryAlertCrud_getSummary']['responses'][200]['content']
>
