import { SalesTrendPeriodTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import { daysIn } from '../business-logic/sales-report/_shared/calendar'
import type {
  ApiDailySalesGetRequest,
  ApiSalesReportGetRequest,
  ApiSalesTrendsGetRequest,
} from '../models/sales-report'
import { salonIdSchema } from '../models/salon'

/**
 * Validation of the queries of the sales reports. A period is of the days
 * of the sales (`saleDate`), both of its ends included. Whether the salon
 * is there is the repository's to say.
 */

/** The most days a period of a report has. */
export const MAX_REPORT_DAYS = 366

const period = {
  salonId: salonIdSchema,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
}

/**
 * The end of a period is not before its beginning, and the period is not
 * longer than a report covers. The dates are compared only when each of
 * them is one: a date that was refused for itself says nothing of the
 * period.
 */
const periodInOrder = (
  context: z.core.ParsePayload<{ startDate: string; endDate: string }>,
): void => {
  const { startDate, endDate } = context.value
  const aDateIsRefused = context.issues.some(
    ({ path }) => path?.[0] === 'startDate' || path?.[0] === 'endDate',
  )
  if (aDateIsRefused) {
    return
  }
  if (endDate < startDate) {
    context.issues.push({
      code: 'custom',
      path: ['endDate'],
      message: 'Must not be earlier than startDate',
      input: endDate,
    })
  } else if (daysIn(startDate, endDate) > MAX_REPORT_DAYS) {
    context.issues.push({
      code: 'custom',
      path: ['endDate'],
      message: `Must be within ${MAX_REPORT_DAYS} days of startDate, both included`,
      input: endDate,
    })
  }
}

export const salesReportGetRequestSchema = z
  .strictObject(period)
  .check(periodInOrder) satisfies z.ZodType<ApiSalesReportGetRequest>

export const salesTrendsGetRequestSchema = z
  .strictObject({ ...period, period: SalesTrendPeriodTypeSchema })
  .check(periodInOrder) satisfies z.ZodType<ApiSalesTrendsGetRequest>

export const dailySalesGetRequestSchema = z.strictObject({
  salonId: salonIdSchema,
  date: z.iso.date(),
}) satisfies z.ZodType<ApiDailySalesGetRequest>
