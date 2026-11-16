import type { components, operations } from '@beauty-salon-backend/generated'

// API types, generated from TypeSpec. A report is counted from the sales
// and their payments whenever it is asked for; no table holds it.
export type ApiSalesReportResponse =
  components['schemas']['Models.SalesReportResponse']
export type ApiDailySalesResponse =
  components['schemas']['Models.DailySalesResponse']
export type ApiSalesByMethodResponse =
  components['schemas']['Models.SalesByMethodResponse']
export type ApiSalesByCategoryResponse =
  components['schemas']['Models.SalesByCategoryResponse']
export type ApiSalesByStaffResponse =
  components['schemas']['Models.SalesByStaffResponse']
export type ApiSalesTrendsResponse =
  components['schemas']['Models.SalesTrendsResponse']
export type ApiSalesReportGetRequest =
  operations['SalesReportCrud_get']['parameters']['query']
export type ApiDailySalesGetRequest =
  operations['SalesReportCrud_getDaily']['parameters']['query']
export type ApiSalesTrendsGetRequest =
  operations['SalesReportCrud_getTrends']['parameters']['query']
