import { z } from 'zod'
import type { ApiCustomerStatisticsGetRequest } from '../models/customer-statistics'
import { periodInOrder, reportPeriod } from './sales-report.schema'

/**
 * Validation of the query of the statistics of a customer: the salon and
 * the period of a sales report, with the same rules. The bookings are
 * counted by their day (`bookingDate`) and the sales by theirs
 * (`saleDate`). Whether the salon is there is the repository's to say.
 */
export const customerStatisticsGetRequestSchema = z
  .strictObject(reportPeriod)
  .check(periodInOrder) satisfies z.ZodType<ApiCustomerStatisticsGetRequest>
