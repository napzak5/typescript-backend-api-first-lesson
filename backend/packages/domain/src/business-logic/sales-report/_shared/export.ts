import { SalesReportReadMapper } from '../../../mappers/read/sales-report.mapper'
import type {
  DayFigures,
  SalesPeriod,
} from '../../../repositories/sales-report.repository'
import { datesOf } from './calendar'

/** A sales report as a file: what it is called and what it says. */
export type SalesReportFile = {
  fileName: string
  content: string
}

/**
 * The columns of the file, in their order: the properties of the sales of
 * a day as the API answers with them (`toApiDailySales`), with the tax and
 * the discounts of the day after the sales.
 */
export const EXPORT_COLUMNS = [
  'date',
  'sales',
  'tax',
  'discounts',
  'transactions',
  'refunds',
  'net',
].join(',')

/** Every line ends with CRLF, as RFC 4180 has it. */
const LINE_END = '\r\n'

const totalOf = (
  days: readonly DayFigures[],
  amountOf: (day: DayFigures) => number,
): number => days.reduce((sum, day) => sum + amountOf(day), 0)

/** The line of one day: the sales of the day as `toApiDailySales` counts them. */
const lineOf = (date: string, days: readonly DayFigures[]): string => {
  const { sales, transactions, refunds, net } =
    SalesReportReadMapper.toApiDailySales(date, days)
  const ofTheDay = days.filter(({ saleDate }) => saleDate === date)

  return [
    date,
    sales,
    totalOf(ofTheDay, ({ tax }) => tax),
    totalOf(ofTheDay, ({ discounts }) => discounts),
    transactions,
    refunds,
    net,
  ].join(',')
}

/**
 * The sales of a period as a CSV file: the names of the columns, then one
 * line for every day of the period in the order of the days, a day
 * without a sale in zeros. There is no line of totals: the totals of the
 * columns are those of the report of the period. Every value is a date or
 * an integer, so nothing is quoted and the text is ASCII.
 */
export const exportOf = (
  period: SalesPeriod,
  days: readonly DayFigures[],
): SalesReportFile => ({
  fileName: `sales-report-${period.startDate}-${period.endDate}.csv`,
  content: [
    EXPORT_COLUMNS,
    ...datesOf(period.startDate, period.endDate).map((date) =>
      lineOf(date, days),
    ),
  ]
    .map((line) => `${line}${LINE_END}`)
    .join(''),
})
