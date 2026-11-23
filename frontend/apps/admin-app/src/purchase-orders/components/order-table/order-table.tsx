import type { ModelsPurchaseOrderResponse } from '@beauty-salon-frontend/api-client'
import { amountOf, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  COUNTED,
  countOf,
  inJapanese,
  Link,
  type More,
} from '@beauty-salon-frontend/ui'
import {
  deliveryDayNameOf,
  orderDayNameOf,
  orderStatusNameOf,
  orderStatusToneOf,
} from '../../utils/order-format'

export type OrderTableProps = {
  /** What the table lists: 「発注」 or 「条件に合う発注」 */
  caption: string
  /** The orders that were read so far, the latest made first; at least one */
  orders: readonly ModelsPurchaseOrderResponse[]
  /** The time zone of the salon, which the days are said in */
  timezone: string
  /** The currency of the salon, which the amounts are said in */
  currency: string
  /** The screen of an order */
  orderHref: (purchaseOrderId: string) => string
  /** How many orders there are; `null` when the API did not count them */
  total: number | null
  more: More
  /** Asks for the orders that come next */
  onMore: () => void
}

/**
 * The purchase orders of a salon: the number of each, which leads to it;
 * the day it was made and the day it is to be delivered on, at the
 * salon; its supplier, its status and what it comes to.
 */
export const OrderTable = ({
  caption,
  orders,
  timezone,
  currency,
  orderHref,
  total,
  more,
  onMore,
}: OrderTableProps) => (
  <PagedTable
    caption={caption}
    rowHeader='orderNumber'
    columns={[
      {
        key: 'orderNumber',
        header: '発注番号',
        cell: ({ id, orderNumber }) => (
          <Link href={orderHref(id)}>{orderNumber}</Link>
        ),
      },
      {
        key: 'orderDate',
        header: '発注日',
        cell: ({ orderDate }) => orderDayNameOf(orderDate, timezone),
      },
      { key: 'supplier', header: '仕入先', cell: ({ supplier }) => supplier },
      {
        key: 'status',
        header: 'ステータス',
        cell: ({ status }) => (
          <Badge tone={orderStatusToneOf(status)}>
            {orderStatusNameOf(status)}
          </Badge>
        ),
      },
      {
        key: 'totalAmount',
        header: '合計',
        align: 'end',
        cell: ({ totalAmount }) => inJapanese(amountOf(totalAmount, currency)),
      },
      {
        key: 'expectedDelivery',
        header: '納品予定日',
        cell: ({ expectedDelivery }) =>
          deliveryDayNameOf(expectedDelivery, timezone),
      },
    ]}
    rows={orders}
    rowKey={({ id }) => id}
    emptyMessage='発注はありません'
    count={inJapanese(countOf(total, orders.length, COUNTED.items))}
    more={more}
    onMore={onMore}
  />
)
