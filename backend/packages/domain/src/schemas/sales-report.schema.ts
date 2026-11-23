import { SalesTrendPeriodTypeSchema } from '@beauty-salon-backend/generated'
import { asOneString } from '@beauty-salon-shared/i18n'
import {
  ruleMessages,
  salesReportMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { daysIn } from '../business-logic/sales-report/_shared/calendar'
import type {
  ApiDailySalesGetRequest,
  ApiSalesReportGetRequest,
  ApiSalesTrendsGetRequest,
} from '../models/sales-report'
import { salonIdSchema } from '../models/salon'
import { calendarDate } from './rules'

/**
 * Validation of the queries of the sales reports. A period is of the days
 * of the sales (`saleDate`), both of its ends included. Whether the salon
 * is there is the repository's to say. The statistics of a customer take
 * the same salon and period (`customer-statistics.schema.ts`).
 */

/** The most days a period of a report has. */
export const MAX_REPORT_DAYS = 366

/** A salon and the first and the last day of a period. */
export const reportPeriod = {
  salonId: salonIdSchema,
  startDate: calendarDate,
  endDate: calendarDate,
}

/**
 * The end of a period is not before its beginning, and the period is not
 * longer than a report covers. The dates are compared only when each of
 * them is one: a date that was refused for itself says nothing of the
 * period.
 */
export const periodInOrder = (
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
      message: asOneString(ruleMessages.notEarlierThan('startDate')),
      input: endDate,
    })
  } else if (daysIn(startDate, endDate) > MAX_REPORT_DAYS) {
    context.issues.push({
      code: 'custom',
      path: ['endDate'],
      message: asOneString(
        salesReportMessages.withinDaysOfStartDate(MAX_REPORT_DAYS),
      ),
      input: endDate,
    })
  }
}

export const salesReportGetRequestSchema = z
  .strictObject(reportPeriod)
  .check(periodInOrder) satisfies z.ZodType<ApiSalesReportGetRequest>

/** The query of a report that passed the rules of its own. */
export type SalesReportGetRequest = z.infer<typeof salesReportGetRequestSchema>

export const salesTrendsGetRequestSchema = z
  .strictObject({ ...reportPeriod, period: SalesTrendPeriodTypeSchema })
  .check(periodInOrder) satisfies z.ZodType<ApiSalesTrendsGetRequest>

/** The query of the trends that passed the rules of its own. */
export type SalesTrendsGetRequest = z.infer<typeof salesTrendsGetRequestSchema>

export const dailySalesGetRequestSchema = z.strictObject({
  salonId: salonIdSchema,
  date: calendarDate,
}) satisfies z.ZodType<ApiDailySalesGetRequest>

/** The query of the sales of a day that passed the rules of its own. */
export type DailySalesGetRequest = z.infer<typeof dailySalesGetRequestSchema>
