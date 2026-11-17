import type { components, operations } from '@beauty-salon-backend/generated'

// API types, generated from TypeSpec. The statistics of a customer are
// counted from the bookings and the sales whenever they are asked for; no
// table holds them.
export type ApiCustomerStatisticsResponse =
  components['schemas']['Models.CustomerStatisticsResponse']
export type ApiCustomerStatisticsServiceResponse =
  components['schemas']['Models.CustomerStatisticsServiceResponse']
export type ApiCustomerStatisticsStaffResponse =
  components['schemas']['Models.CustomerStatisticsStaffResponse']
export type ApiCustomerStatisticsGetRequest =
  operations['CustomerCrud_getStatistics']['parameters']['query']
