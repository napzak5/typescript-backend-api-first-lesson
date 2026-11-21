import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  refusedValuesOf,
  UNANSWERED_PARTS,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/answers'
import {
  type ModelsDailySalesResponse,
  type ModelsProblemDetails,
  type ModelsSalesByCategoryResponse,
  type ModelsSalesByStaffResponse,
  type ModelsSalesReportResponse,
  type ModelsSalesTrendPeriodType,
  type ModelsSalesTrendsResponse,
  salesReportCrudExport,
  salesReportCrudGet,
  salesReportCrudGetByCategory,
  salesReportCrudGetByStaff,
  salesReportCrudGetDaily,
  salesReportCrudGetTrends,
} from '@beauty-salon-frontend/api-client'
import { type FileToSave, fileOfAnswer } from '@beauty-salon-frontend/io'
import type { Period } from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'

/*
 * The sales of a salon, counted by the API at every read: over a period,
 * by member of the staff, by kind of service, in parts of a period, on one
 * day, and the CSV file it makes of a period. A
 * period or a day the screens send is one the API counts over (366 days at
 * most, the end not before the start), so a 400 says the salon was removed
 * since it was read.
 */

const UNANSWERED = P.union(...UNANSWERED_PARTS)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The query of a report: the salon and the days of its sales */
const paramsOf = (salonId: string, { from, to }: Period) => ({
  salonId,
  startDate: from,
  endDate: to,
})

/**
 * What a 400 says: the salon is not there any more (`salonId` is
 * `not_found`), or something the screen did not send.
 */
const refusalOf = (problem: ModelsProblemDetails): NotFound | Unread =>
  refusedValuesOf(problem).some(
    ({ field, rule }) => field === 'salonId' && rule === 'not_found',
  )
    ? NOT_FOUND
    : FAILED

export type SalesReportRead =
  | { type: 'found'; report: ModelsSalesReportResponse }
  /** The salon was removed */
  | NotFound
  /** The account is of another salon */
  | Forbidden
  | Unread

/** The key of the reports of a salon, and of one period of them. */
const salesReportsKeyOf = (salonId: string): readonly string[] => [
  'salons',
  salonId,
  'sales-reports',
]

export const salesReportKeyOf = (
  salonId: string,
  { from, to }: Period,
): readonly string[] => [...salesReportsKeyOf(salonId), from, to]

/** The sales of the salon whose day is in the period (`GET /sales-reports`). */
export const readSalesReport = async (
  salonId: string,
  period: Period,
): Promise<SalesReportRead> => {
  const answer = await salesReportCrudGet(paramsOf(salonId, period)).catch(
    () => null,
  )

  return match(answer)
    .returnType<SalesReportRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      report: data.data,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, ({ data }) => refusalOf(data))
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type SalesByStaffRead =
  | { type: 'found'; staff: ModelsSalesByStaffResponse[] }
  /** The salon was removed */
  | NotFound
  /** The account is of another salon */
  | Forbidden
  | Unread

export const salesByStaffKeyOf = (
  salonId: string,
  { from, to }: Period,
): readonly string[] => [...salesReportsKeyOf(salonId), 'by-staff', from, to]

/**
 * The sales of the period of every member of the staff who had a line of
 * them, the most first (`GET /sales-reports/by-staff`).
 */
export const readSalesByStaff = async (
  salonId: string,
  period: Period,
): Promise<SalesByStaffRead> => {
  const answer = await salesReportCrudGetByStaff(
    paramsOf(salonId, period),
  ).catch(() => null)

  return match(answer)
    .returnType<SalesByStaffRead>()
    .with({ status: 200 }, ({ data }) => ({ type: 'found', staff: data.data }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, ({ data }) => refusalOf(data))
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type SalesByCategoryRead =
  | { type: 'found'; categories: ModelsSalesByCategoryResponse[] }
  /** The salon was removed */
  | NotFound
  /** The account is of another salon */
  | Forbidden
  | Unread

export const salesByCategoryKeyOf = (
  salonId: string,
  { from, to }: Period,
): readonly string[] => [...salesReportsKeyOf(salonId), 'by-category', from, to]

/**
 * The sales of services of the period by kind of service, the most first
 * (`GET /sales-reports/by-category`).
 */
export const readSalesByCategory = async (
  salonId: string,
  period: Period,
): Promise<SalesByCategoryRead> => {
  const answer = await salesReportCrudGetByCategory(
    paramsOf(salonId, period),
  ).catch(() => null)

  return match(answer)
    .returnType<SalesByCategoryRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      categories: data.data,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, ({ data }) => refusalOf(data))
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type SalesTrendsRead =
  | { type: 'found'; trends: ModelsSalesTrendsResponse }
  /** The salon was removed */
  | NotFound
  /** The account is of another salon */
  | Forbidden
  | Unread

export const salesTrendsKeyOf = (
  salonId: string,
  { from, to }: Period,
  unit: ModelsSalesTrendPeriodType,
): readonly string[] => [
  ...salesReportsKeyOf(salonId),
  'trends',
  from,
  to,
  unit,
]

/**
 * The sales of the period in parts of a day, a week or a month
 * (`GET /sales-reports/trends`).
 */
export const readSalesTrends = async (
  salonId: string,
  period: Period,
  unit: ModelsSalesTrendPeriodType,
): Promise<SalesTrendsRead> => {
  const answer = await salesReportCrudGetTrends({
    ...paramsOf(salonId, period),
    period: unit,
  }).catch(() => null)

  return match(answer)
    .returnType<SalesTrendsRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      trends: data.data,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, ({ data }) => refusalOf(data))
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type DailySalesRead =
  | { type: 'found'; sales: ModelsDailySalesResponse }
  /** The salon was removed */
  | NotFound
  /** The account is of another salon */
  | Forbidden
  | Unread

export const dailySalesKeyOf = (
  salonId: string,
  day: string,
): readonly string[] => [...salesReportsKeyOf(salonId), 'daily', day]

/** The sales of the salon on one day (`GET /sales-reports/daily`). */
export const readDailySales = async (
  salonId: string,
  day: string,
): Promise<DailySalesRead> => {
  const answer = await salesReportCrudGetDaily({ salonId, date: day }).catch(
    () => null,
  )

  return match(answer)
    .returnType<DailySalesRead>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'found',
      sales: data.data,
    }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, ({ data }) => refusalOf(data))
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}

export type SalesReportExport =
  | { type: 'exported'; file: FileToSave }
  | NotFound
  | Forbidden
  | Unread

/**
 * The sales of the period as the CSV file the API writes, a day a row
 * (`GET /sales-reports/export`). The file holds letters of ASCII alone, so
 * it is saved as it came, without the mark of a byte order.
 */
export const exportSalesReport = async (
  salonId: string,
  period: Period,
): Promise<SalesReportExport> => {
  const answer = await salesReportCrudExport(paramsOf(salonId, period)).catch(
    () => null,
  )

  return match(answer)
    .returnType<SalesReportExport>()
    .with({ status: 200 }, ({ data, headers }) => {
      const file = fileOfAnswer(headers, data)

      return file === undefined ? FAILED : { type: 'exported', file }
    })
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: 400 }, ({ data }) => refusalOf(data))
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
