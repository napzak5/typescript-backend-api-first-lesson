import type { SalesTrendPeriodType } from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'
import type {
  ApiDailySalesResponse,
  ApiSalesByCategoryResponse,
  ApiSalesByMethodResponse,
  ApiSalesByStaffResponse,
  ApiSalesReportResponse,
  ApiSalesTrendsResponse,
} from '../../../models/sales-report'
import type {
  CategoryFigures,
  DayFigures,
  MethodFigures,
  SalesFigures,
  SalesPeriod,
  StaffFigures,
} from '../../../repositories/sales-report.repository'
import { datesOf, mondayOf, monthOf } from './calendar'

/**
 * What a report says, from the figures of the sales of its period. The
 * figures are sums the repository read; these functions add them up,
 * divide them and put them in order, and decide nothing about which sale
 * or line counts.
 */

/** How many staff members the report of a period names. */
export const TOP_STAFF = 5

/**
 * An amount divided by a count, with the fraction of a yen dropped; 0 when
 * there is nothing to divide by.
 */
export const averageOf = (amount: number, count: number): number =>
  count === 0 ? 0 : Math.floor(amount / count)

/** A part of a whole in per cent, to one decimal place; 0 of a whole of 0. */
export const percentageOf = (amount: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((amount * 1000) / whole) / 10

const sumOf = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/** Text in the order of its code points: -1, 0 or 1. */
const compareText = (first: string, second: string): number =>
  Number(first > second) - Number(first < second)

/**
 * The payments by the kind of their payment method, the largest amount
 * first and kinds of equal amounts in the order of their names, each with
 * its part of what all of them took in.
 */
export const methodRowsOf = (
  methods: readonly MethodFigures[],
): ApiSalesByMethodResponse[] => {
  const whole = sumOf(methods.map(({ amount }) => amount))

  return methods
    .toSorted(
      (first, second) =>
        second.amount - first.amount ||
        compareText(first.method, second.method),
    )
    .map(({ method, amount, count }) => ({
      method,
      amount,
      count,
      percentage: percentageOf(amount, whole),
    }))
}

/**
 * The service lines by the kind of the category of their service, in the
 * order the payments are put in, each with its part of all of them.
 */
export const categoryRowsOf = (
  categories: readonly CategoryFigures[],
): ApiSalesByCategoryResponse[] => {
  const whole = sumOf(categories.map(({ amount }) => amount))

  return categories
    .toSorted(
      (first, second) =>
        second.amount - first.amount ||
        compareText(first.category, second.category),
    )
    .map(({ category, amount, count }) => ({
      category,
      amount,
      count,
      percentage: percentageOf(amount, whole),
    }))
}

/**
 * The staff members by what they brought in, the most first and those of
 * equal amounts in the order of their IDs.
 */
export const staffRowsOf = (
  staff: readonly StaffFigures[],
): ApiSalesByStaffResponse[] =>
  staff
    .toSorted(
      (first, second) =>
        second.totalSales - first.totalSales ||
        compareText(first.staffId, second.staffId),
    )
    .map(
      ({ staffId, displayName, totalSales, serviceSales, serviceCount }) => ({
        staffId,
        displayName,
        totalSales,
        serviceCount,
        averageServiceValue: averageOf(serviceSales, serviceCount),
      }),
    )

/**
 * The report of a period: the sums of its days, what the refunds of its
 * sales leave of them, and how the sales divide.
 */
export const reportOf = (
  period: SalesPeriod,
  figures: SalesFigures,
): ApiSalesReportResponse => {
  const { days } = figures
  const totalSales = sumOf(days.map(({ sales }) => sales))
  const totalRefunds = sumOf(days.map(({ refunds }) => refunds))
  const transactionCount = sumOf(days.map(({ transactions }) => transactions))

  return {
    salonId: period.salonId,
    startDate: period.startDate,
    endDate: period.endDate,
    totalSales,
    totalTax: sumOf(days.map(({ tax }) => tax)),
    totalDiscounts: sumOf(days.map(({ discounts }) => discounts)),
    totalRefunds,
    netSales: totalSales - totalRefunds,
    transactionCount,
    averageTransactionValue: averageOf(totalSales, transactionCount),
    salesByMethod: methodRowsOf(figures.methods),
    salesByCategory: categoryRowsOf(figures.categories),
    topStaff: staffRowsOf(figures.staff).slice(0, TOP_STAFF),
  }
}

/** The sales of one day, and what the refunds of them leave. */
export const dailyOf = (
  date: string,
  days: readonly DayFigures[],
): ApiDailySalesResponse => {
  const ofTheDay = days.filter(({ saleDate }) => saleDate === date)
  const sales = sumOf(ofTheDay.map((day) => day.sales))
  const refunds = sumOf(ofTheDay.map((day) => day.refunds))

  return {
    date,
    sales,
    transactions: sumOf(ofTheDay.map(({ transactions }) => transactions)),
    refunds,
    net: sales - refunds,
  }
}

/** The label of the part of a trend that a date falls in. */
const labelOf = (unit: SalesTrendPeriodType, date: string): string =>
  match(unit)
    .with('daily', () => date)
    .with('weekly', () => mondayOf(date))
    .with('monthly', () => monthOf(date))
    .exhaustive()

/**
 * The sales of a period cut into days, weeks beginning on a Monday or
 * months. Every part that overlaps the period is there, without a sale
 * too. The figures are of the days of the period alone, so the first and
 * the last part count only those of their days that are in it.
 */
export const trendsOf = (
  period: SalesPeriod,
  unit: SalesTrendPeriodType,
  days: readonly DayFigures[],
): ApiSalesTrendsResponse => {
  const labels = [
    ...new Set(
      datesOf(period.startDate, period.endDate).map((date) =>
        labelOf(unit, date),
      ),
    ),
  ]
  const ofLabel = (label: string): readonly DayFigures[] =>
    days.filter(({ saleDate }) => labelOf(unit, saleDate) === label)
  const sales = labels.map((label) =>
    sumOf(ofLabel(label).map((day) => day.sales)),
  )
  const transactions = labels.map((label) =>
    sumOf(ofLabel(label).map((day) => day.transactions)),
  )

  return {
    labels,
    sales,
    transactions,
    average: labels.map((_, index) =>
      averageOf(sales[index] ?? 0, transactions[index] ?? 0),
    ),
  }
}
