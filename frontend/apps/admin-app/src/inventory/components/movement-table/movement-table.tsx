import type {
  ModelsInventoryTransactionResponse,
  ModelsProductResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import { COUNTED, countOf, type More, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminInventoryMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  changeNameOf,
  movementReasonOf,
  movementTypeNameOf,
  performerNameOf,
} from '../../utils/movement-format'
import { quantityNameOf } from '../../utils/stock-format'

const { history, table } = adminInventoryMessages.movements

export type MovementTableProps = {
  /** What the table lists: 「在庫の移動」 or 「条件に合う在庫の移動」 */
  caption: LocalizedText
  /** The movements that were read so far, the latest first; at least one */
  movements: readonly ModelsInventoryTransactionResponse[]
  /** The product of the row, whose unit the quantities are in; `undefined` when it was removed */
  product: ModelsProductResponse | undefined
  /** The members of the staff of the salon, who recorded the movements */
  staff: readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** The currency of the salon */
  currency: string
  /** How many movements there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the movements that come next */
  onMore: () => void
}

/**
 * The movements of a stock row, the latest first: when, of what kind, how
 * the stock changed and what it left, what it cost, why, and who recorded
 * it.
 */
export const MovementTable = ({
  caption,
  movements,
  product,
  staff,
  timezone,
  currency,
  total,
  more,
  onMore,
}: MovementTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(caption)}
      columns={[
        {
          key: 'createdAt',
          header: say(table.moment),
          cell: ({ createdAt }) => say(momentNameAt(createdAt, timezone)),
        },
        {
          key: 'transactionType',
          header: say(table.kind),
          cell: ({ transactionType }) =>
            say(movementTypeNameOf(transactionType)),
        },
        {
          key: 'quantity',
          header: say(table.change),
          align: 'end',
          cell: ({ quantity }) => say(changeNameOf(quantity, product)),
        },
        {
          key: 'balanceAfter',
          header: say(table.balance),
          align: 'end',
          cell: ({ balanceAfter }) =>
            say(quantityNameOf(balanceAfter, product)),
        },
        {
          key: 'totalCost',
          header: say(table.cost),
          align: 'end',
          cell: ({ totalCost }) =>
            totalCost === null ? null : say(amountOf(totalCost, currency)),
        },
        {
          key: 'reason',
          header: say(table.reason),
          cell: (movement) => {
            const reason = movementReasonOf(movement)

            return reason === null ? null : say(reason)
          },
        },
        {
          key: 'performedBy',
          header: say(table.performer),
          // Nobody is named for an administrator, nor for the movement that
          // began the records of a row
          cell: ({ performedBy }) =>
            performedBy === null
              ? null
              : say(performerNameOf(performedBy, staff)),
        },
      ]}
      rows={movements}
      rowKey={({ id }) => id}
      emptyMessage={say(history.empty)}
      count={say(countOf(total, movements.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
