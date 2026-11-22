import type {
  ModelsInventoryTransactionResponse,
  ModelsProductResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { momentNameAt, PagedTable } from '@beauty-salon-frontend/salon-screens'
import type { More } from '@beauty-salon-frontend/ui'
import { countOf } from '@beauty-salon-frontend/ui'
import { priceNameOf } from '../../../products/product-format'
import {
  changeNameOf,
  movementReasonOf,
  movementTypeNameOf,
  performerNameOf,
} from '../../movement-format'
import { quantityNameOf } from '../../stock-format'

export type MovementTableProps = {
  /** What the table lists: 「在庫の移動」 or 「条件に合う在庫の移動」 */
  caption: string
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
}: MovementTableProps) => (
  <PagedTable
    caption={caption}
    columns={[
      {
        key: 'createdAt',
        header: '日時',
        cell: ({ createdAt }) => momentNameAt(createdAt, timezone),
      },
      {
        key: 'transactionType',
        header: '区分',
        cell: ({ transactionType }) => movementTypeNameOf(transactionType),
      },
      {
        key: 'quantity',
        header: '増減',
        align: 'end',
        cell: ({ quantity }) => changeNameOf(quantity, product),
      },
      {
        key: 'balanceAfter',
        header: '移動後の在庫数',
        align: 'end',
        cell: ({ balanceAfter }) => quantityNameOf(balanceAfter, product),
      },
      {
        key: 'totalCost',
        header: '金額',
        align: 'end',
        cell: ({ totalCost }) => priceNameOf(totalCost, currency),
      },
      {
        key: 'reason',
        header: '理由',
        cell: (movement) => movementReasonOf(movement),
      },
      {
        key: 'performedBy',
        header: '記録した人',
        // Nobody is named for an administrator, nor for the movement that
        // began the records of a row
        cell: ({ performedBy }) =>
          performedBy === null ? null : performerNameOf(performedBy, staff),
      },
    ]}
    rows={movements}
    rowKey={({ id }) => id}
    emptyMessage='在庫の移動はありません'
    count={countOf(total, movements.length, '件')}
    more={more}
    onMore={onMore}
  />
)
