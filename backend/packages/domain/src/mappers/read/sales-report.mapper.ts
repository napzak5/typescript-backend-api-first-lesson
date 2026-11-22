import type { SalesTrendPeriodType } from '@beauty-salon-backend/generated'
import { match } from 'ts-pattern'
import {
  datesOf,
  mondayOf,
  monthOf,
} from '../../business-logic/sales-report/_shared/calendar'
import {
  averageOf,
  compareText,
  percentageOf,
  TOP_STAFF,
} from '../../business-logic/sales-report/_shared/report'
import type {
  ApiDailySalesResponse,
  ApiSalesByCategoryResponse,
  ApiSalesByMethodResponse,
  ApiSalesByStaffResponse,
  ApiSalesReportResponse,
  ApiSalesTrendsResponse,
} from '../../models/sales-report'
import type {
  CategoryFigures,
  DayFigures,
  MethodFigures,
  SalesFigures,
  SalesPeriod,
  StaffFigures,
} from '../../repositories/sales-report.repository'

/**
 * What the sales of a period come to → API responses. The figures are sums
 * the repository read; this mapper adds them up, divides them and puts
 * them in order, and decides nothing about which sale or line counts.
 * How an amount is averaged, how a part is written in per cent and how
 * many staff members a report names are rules of the reports
 * (`business-logic/sales-report/_shared/report.ts`).
 */

const sumOf = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/**
 * The payments by the kind of their payment method, the largest amount
 * first and kinds of equal amounts in the order of their names, each with
 * its part of what all of them took in.
 */
const toApiSalesByMethod = (
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
const toApiSalesByCategory = (
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
const toApiSalesByStaff = (
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

/** The sales of one day, and what the refunds of them leave. */
const toApiDailySales = (
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

export const SalesReportReadMapper = {
  toApiSalesByMethod,
  toApiSalesByCategory,
  toApiSalesByStaff,
  toApiDailySales,

  /**
   * The report of a period: the sums of its days, what the refunds of its
   * sales leave of them, and how the sales divide.
   */
  toApiSalesReport(
    period: SalesPeriod,
    figures: SalesFigures,
  ): ApiSalesReportResponse {
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
      salesByMethod: toApiSalesByMethod(figures.methods),
      salesByCategory: toApiSalesByCategory(figures.categories),
      topStaff: toApiSalesByStaff(figures.staff).slice(0, TOP_STAFF),
    }
  },

  /**
   * The sales of a period cut into days, weeks beginning on a Monday or
   * months. Every part that overlaps the period is there, without a sale
   * too. The figures are of the days of the period alone, so the first and
   * the last part count only those of their days that are in it.
   */
  toApiSalesTrends(
    period: SalesPeriod,
    unit: SalesTrendPeriodType,
    days: readonly DayFigures[],
  ): ApiSalesTrendsResponse {
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
  },
}
