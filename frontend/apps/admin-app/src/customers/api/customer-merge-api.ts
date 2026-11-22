import {
  FAILED,
  type Forbidden,
  type NotFound,
  outsideTheContract,
  refusedValuesOf,
  UNANSWERED_PARTS,
  UNREAD_TYPES,
  type Unread,
  unreadOf,
  whyUnread,
} from '@beauty-salon-frontend/answers'
import {
  customerCrudMerge,
  type ModelsCustomerResponse,
  type ModelsMedicalChartResponse,
} from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import { readChart } from '../../charts/api/charts-api'
import type {
  MergeAttempt,
  MergePair,
  MergeRecords,
  MergeSide,
  MergeWay,
} from '../utils/customer-merge'
import { readErasureRequest } from './customer-erasure-api'
import { customerKeyOf, readCustomer } from './customers-api'

/*
 * What two customers are merged by: the one chosen to merge with, what
 * else of both the API looks at before it merges them, and the merge.
 */

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/**
 * The key of what is read of the customer chosen to merge with the
 * customer of the address. It begins with the key of that customer: what
 * drops them drops it too.
 */
export const mergeKeyOf = (customerId: string, otherId: string): string[] => [
  ...customerKeyOf(customerId),
  'merge',
  otherId,
]

/**
 * Whether the customer asked for their data to be erased, and the request
 * is pending (`GET /customers/{id}/deletion-request`). A customer who never
 * asked has no request (404).
 */
const readErasureAsked = async (
  customerId: string,
): Promise<{ type: 'read'; asked: boolean } | Unread> => {
  const read = await readErasureRequest(customerId)

  return (
    match(read)
      .returnType<{ type: 'read'; asked: boolean } | Unread>()
      .with({ type: 'read' }, ({ request }) => ({
        type: 'read',
        asked: request?.status === 'pending',
      }))
      // The screen offers the merge only to who may read the requests
      .with({ type: 'forbidden' }, () => FAILED)
      .with({ type: P.union(...UNREAD_TYPES) }, (unread) => unread)
      .exhaustive()
  )
}

/** The customer chosen to merge with, and what the merge looks at of both */
export type MergeRead =
  | {
      type: 'found'
      other: ModelsCustomerResponse
      /** The records of the customer of the address, and of the other, as the merge would read them */
      records: {
        erasureAsked: { this: boolean; other: boolean }
        charts: {
          this: ModelsMedicalChartResponse | null
          other: ModelsMedicalChartResponse | null
        }
      }
    }
  /** No customer has the ID, or the customer left the ledger */
  | NotFound
  | Unread

/**
 * The customer chosen to merge with the customer of the address, and of
 * both whether they asked for their data to be erased and their charts:
 * what the API refuses a merge for.
 */
export const readMerge = async (
  customerId: string,
  otherId: string,
): Promise<MergeRead> => {
  const [other, thisAsked, otherAsked, thisChart, otherChart] =
    await Promise.all([
      readCustomer(otherId),
      readErasureAsked(customerId),
      readErasureAsked(otherId),
      readChart(customerId),
      readChart(otherId),
    ])
  if (other.type !== 'found') {
    return other
  }
  if (
    thisAsked.type !== 'read' ||
    otherAsked.type !== 'read' ||
    thisChart.type !== 'read' ||
    otherChart.type !== 'read'
  ) {
    return whyUnread([thisAsked, otherAsked, thisChart, otherChart])
  }

  return {
    type: 'found',
    other: other.customer,
    records: {
      erasureAsked: { this: thisAsked.asked, other: otherAsked.asked },
      charts: { this: thisChart.chart, other: otherChart.chart },
    },
  }
}

/** The records of a read, by the part each customer takes in the merge. */
export const mergeRecordsOf = (
  { records }: Extract<MergeRead, { type: 'found' }>,
  thisKept: boolean,
): MergeRecords => ({
  erasureAsked: thisKept
    ? {
        primary: records.erasureAsked.this,
        secondary: records.erasureAsked.other,
      }
    : {
        primary: records.erasureAsked.other,
        secondary: records.erasureAsked.this,
      },
  charts: thisKept
    ? { primary: records.charts.this, secondary: records.charts.other }
    : { primary: records.charts.other, secondary: records.charts.this },
})

const SIDES: Readonly<Record<string, MergeSide>> = {
  primaryCustomerId: 'primary',
  secondaryCustomerId: 'secondary',
}

/**
 * Merges the secondary into the primary (`POST /customers/merge`). A
 * customer who left the ledger in the meantime is named by the property
 * that held them; any other refusal (409) is told in a sentence alone.
 */
export const mergeCustomers = async (
  { primary, secondary }: MergePair,
  way: MergeWay,
): Promise<MergeAttempt> => {
  const answer = await customerCrudMerge({
    primaryCustomerId: primary.id,
    secondaryCustomerId: secondary.id,
    conflictResolution: way,
  }).catch(() => null)

  return match(answer)
    .returnType<MergeAttempt>()
    .with({ status: 200 }, ({ data }) => ({
      type: 'merged',
      customer: data.data,
    }))
    .with({ status: 400 }, ({ data }) => {
      const sides = refusedValuesOf(data).flatMap(({ field, rule }) => {
        const side = SIDES[field]
        return rule === 'not_found' && side !== undefined ? [side] : []
      })
      // The two are customers that were read: nothing else is refused
      return sides.length === 0 ? FAILED : { type: 'gone', sides }
    })
    .with({ status: 409 }, () => ({ type: 'refused' }))
    .with({ status: 403 }, () => FORBIDDEN)
    .with({ status: P.union(413, 415) }, () => FAILED)
    .with(P.union(...UNANSWERED_PARTS), unreadOf)
    .exhaustive(outsideTheContract)
}
