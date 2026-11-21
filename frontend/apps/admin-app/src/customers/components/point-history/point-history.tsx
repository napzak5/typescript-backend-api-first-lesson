import type { ModelsPointTransactionResponse } from '@beauty-salon-frontend/api-client'
import {
  countOf,
  dayNameOf,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import type { More } from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { countNameOf } from '../../customer-format'
import { movementOf, transactionNameOf } from '../../points'

export type PointHistoryProps = {
  /** The transactions that were read so far, the latest first */
  transactions: readonly ModelsPointTransactionResponse[]
  /** How many transactions the customer has; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the transactions that come next */
  onMore: () => void
  /** The record a transaction was made for, as the screen names it */
  referenceOf: (transaction: ModelsPointTransactionResponse) => ReactNode
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
}

/**
 * The transactions of the points of a customer, the latest first: when,
 * what kind, how the balance moved and what it was after, the day the
 * points given expire on, the record they were made for, and why, which
 * may be long and comes last.
 */
export const PointHistory = ({
  transactions,
  total,
  more,
  onMore,
  referenceOf,
  timezone,
}: PointHistoryProps) => (
  <PagedTable
    caption='ポイントの履歴'
    columns={[
      {
        key: 'createdAt',
        header: '日時',
        cell: ({ createdAt }) => momentNameAt(createdAt, timezone),
      },
      {
        key: 'transactionType',
        header: '種類',
        cell: ({ transactionType }) => transactionNameOf(transactionType),
      },
      {
        key: 'points',
        header: '増減',
        cell: ({ points }) => movementOf(points),
        align: 'end',
      },
      {
        key: 'balance',
        header: '残高',
        cell: ({ balance }) => countNameOf(balance, 'ポイント'),
        align: 'end',
      },
      {
        key: 'expiryDate',
        header: '有効期限',
        cell: ({ expiryDate }) =>
          expiryDate === null ? '' : dayNameOf(expiryDate),
      },
      {
        key: 'reference',
        header: 'もとになった記録',
        cell: (transaction) =>
          transaction.referenceId === null ? '' : referenceOf(transaction),
      },
      {
        key: 'description',
        header: '説明',
        cell: ({ description }) => description,
      },
    ]}
    rows={transactions}
    rowKey={({ id }) => id}
    emptyMessage='ポイントの履歴はありません'
    count={countOf(total, transactions.length, '件')}
    more={more}
    onMore={onMore}
  />
)
