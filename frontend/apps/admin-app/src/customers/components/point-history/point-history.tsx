import type { ModelsPointTransactionResponse } from '@beauty-salon-frontend/api-client'
import {
  dayNameOf,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import type { More } from '@beauty-salon-frontend/ui'
import { COUNTED, countOf, useSay } from '@beauty-salon-frontend/ui'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { customerMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { ReactNode } from 'react'
import { movementOf, transactionNameOf } from '../../utils/points'

const { history: words } = adminCustomerMessages.points

export type PointHistoryProps = {
  /** The transactions that were read so far, the latest first */
  transactions: readonly ModelsPointTransactionResponse[]
  /** How many transactions the customer has; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the transactions that come next */
  onMore: () => void
  /** The record a transaction was made for, as the screen names it; nothing for one made for none */
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
}: PointHistoryProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(words.title)}
      columns={[
        {
          key: 'createdAt',
          header: say(words.moment),
          cell: ({ createdAt }) => say(momentNameAt(createdAt, timezone)),
        },
        {
          key: 'transactionType',
          header: say(words.kind),
          cell: ({ transactionType }) =>
            say(transactionNameOf(transactionType)),
        },
        {
          key: 'points',
          header: say(words.movement),
          cell: ({ points }) => say(movementOf(points)),
          align: 'end',
        },
        {
          key: 'balance',
          header: say(words.balance),
          cell: ({ balance }) => say(customerMessages.pointsOf(balance)),
          align: 'end',
        },
        {
          key: 'expiryDate',
          header: say(words.expiryDate),
          cell: ({ expiryDate }) =>
            expiryDate === null ? '' : say(dayNameOf(expiryDate)),
        },
        {
          key: 'reference',
          header: say(words.reference),
          cell: referenceOf,
        },
        {
          key: 'description',
          header: say(words.description),
          cell: ({ description }) => description,
        },
      ]}
      rows={transactions}
      rowKey={({ id }) => id}
      emptyMessage={say(words.empty)}
      count={say(countOf(total, transactions.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
