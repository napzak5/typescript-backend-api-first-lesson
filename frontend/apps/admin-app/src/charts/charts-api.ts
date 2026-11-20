import {
  type MedicalChartCrudListParams,
  type ModelsCustomerResponse,
  type ModelsMedicalChartCreateRequest,
  type ModelsMedicalChartResponse,
  type ModelsMedicalChartUpdateRequest,
  medicalChartCrudCreate,
  medicalChartCrudGetByCustomer,
  medicalChartCrudList,
  medicalChartCrudUpdate,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { customerKeyOf, readCustomers } from '../customers/customers-api'
import { outsideTheContract } from '../outside-the-contract'
import {
  FAILED,
  type Forbidden,
  from,
  NOT_FOUND,
  type NotFound,
  type Page,
  pageOf,
  type RefusedValue,
  refusedValuesOf,
  type Unread,
  unreadOf,
} from '../reading'

/*
 * The charts of the customers: what a member of the staff makes sure of
 * before a treatment. A customer has one chart at most; the ledger of the
 * customers is one for every salon, and so are their charts.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 400 },
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** The key of the chart of a customer: what drops the customer drops their chart. */
export const chartKeyOf = (customerId: string): string[] => [
  ...customerKeyOf(customerId),
  'chart',
]

/** The key of every list of charts that was read */
export const CHART_LISTS = ['charts']

/** The chart of a customer; `null` for one who has none yet. */
export type ChartRead =
  | { type: 'read'; chart: ModelsMedicalChartResponse | null }
  | Unread

/**
 * The chart of a customer (`GET /medical-charts/customer/{customerId}`).
 * The API answers 404 for a customer without a chart, and for one who was
 * removed from the ledger: the screens read the customer first, and a
 * chart written for one who left meanwhile is refused when it is sent.
 */
export const readChart = async (customerId: string): Promise<ChartRead> => {
  const answer = await medicalChartCrudGetByCustomer(customerId).catch(
    () => null,
  )

  return (
    match(answer)
      .returnType<ChartRead>()
      .with({ status: 200 }, ({ data }) => ({ type: 'read', chart: data.data }))
      .with({ status: 404 }, () => ({ type: 'read', chart: null }))
      // The screens of a customer are behind the same permission as the charts
      .with({ status: 403 }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** Which charts are looked for: the names are those of the query of the address. */
export type ChartConditions = {
  /** Part of the conditions, the notes or the names of the products */
  search?: string
  /** Whether the customer has allergies recorded; absent for either */
  allergies?: 'with' | 'without'
}

/** A chart that was found, and its customer; `undefined` for one who left the ledger meanwhile. */
export type FoundChart = {
  chart: ModelsMedicalChartResponse
  customer: ModelsCustomerResponse | undefined
}

/** What the API is asked for. */
export const chartListParamsOf = ({
  search,
  allergies,
}: ChartConditions): Omit<MedicalChartCrudListParams, 'cursor' | 'limit'> => ({
  ...(search === undefined ? {} : { search }),
  ...(allergies === undefined ? {} : { hasAllergies: allergies === 'with' }),
})

/**
 * A page of the charts that meet the conditions, the latest made first,
 * with their customers, who are read at once: a chart holds the ID of its
 * customer only.
 */
export const readChartPage = async (
  conditions: ChartConditions,
  cursor: string | undefined,
): Promise<Page<FoundChart> | Unread> => {
  const answer = await medicalChartCrudList({
    ...chartListParamsOf(conditions),
    ...from(cursor),
  }).catch(() => null)
  if (answer?.status !== 200) {
    return match(answer)
      .returnType<Unread>()
      .with({ status: 403 }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  }
  const charts = answer.data.data
  const customers = await readCustomers(
    charts.map(({ customerId }) => customerId),
  )
  if (customers.type !== 'found') {
    return customers
  }

  return pageOf(
    charts.map((chart) => ({
      chart,
      customer: customers.customers.get(chart.customerId),
    })),
    answer.data.meta,
  )
}

/** What came of a chart that was made or changed. */
export type ChartWrite =
  | { type: 'written'; chart: ModelsMedicalChartResponse }
  | { type: 'invalid'; values: RefusedValue[] }
  /** Another account made the chart of the customer meanwhile */
  | { type: 'exists' }
  /** The customer was removed from the ledger meanwhile */
  | NotFound
  | Forbidden
  | Unread

/** Makes the chart of a customer (`POST /medical-charts`). */
export const createChart = async (
  request: ModelsMedicalChartCreateRequest,
): Promise<ChartWrite> => {
  const answer = await medicalChartCrudCreate(request).catch(() => null)

  return (
    match(answer)
      .returnType<ChartWrite>()
      .with({ status: 201 }, ({ data }) => ({
        type: 'written',
        chart: data.data,
      }))
      .with({ status: 400 }, ({ data }) => {
        const values = refusedValuesOf(data)

        // The customer is refused as a value of the body when they left the ledger
        return values.some(({ field }) => field === 'customerId')
          ? NOT_FOUND
          : { type: 'invalid', values }
      })
      .with({ status: 409 }, () => ({ type: 'exists' }))
      .with({ status: 403 }, () => FORBIDDEN)
      // The body is the form, far from the limits of size and of type
      .with({ status: P.union(413, 415) }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

/** Changes the chart of a customer (`PATCH /medical-charts/{id}`): what the request names, and nothing else. */
export const updateChart = async (
  chartId: string,
  request: ModelsMedicalChartUpdateRequest,
): Promise<Exclude<ChartWrite, { type: 'exists' }>> => {
  const answer = await medicalChartCrudUpdate(chartId, request).catch(
    () => null,
  )

  return match(answer)
    .returnType<Exclude<ChartWrite, { type: 'exists' }>>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'written',
      chart: data.data,
    }))
    .with({ status: 400 }, ({ data }) => ({
      type: 'invalid',
      values: refusedValuesOf(data),
    }))
    .with({ status: 404 }, () => NOT_FOUND)
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(UNANSWERED, unreadOf)
    .exhaustive(outsideTheContract)
}
