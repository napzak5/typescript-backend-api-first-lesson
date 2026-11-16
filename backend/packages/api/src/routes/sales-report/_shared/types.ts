import type { operations } from '@beauty-salon-backend/generated'
import type { JsonBody } from '../../../shared/operation-types'

export type GetSalesReportResponse = JsonBody<
  operations['SalesReportCrud_get']['responses'][200]['content']
>
export type GetDailySalesResponse = JsonBody<
  operations['SalesReportCrud_getDaily']['responses'][200]['content']
>
export type GetSalesByStaffResponse = JsonBody<
  operations['SalesReportCrud_getByStaff']['responses'][200]['content']
>
export type GetSalesByCategoryResponse = JsonBody<
  operations['SalesReportCrud_getByCategory']['responses'][200]['content']
>
export type GetSalesTrendsResponse = JsonBody<
  operations['SalesReportCrud_getTrends']['responses'][200]['content']
>
