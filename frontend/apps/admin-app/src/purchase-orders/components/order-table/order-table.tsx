import type { ModelsPurchaseOrderResponse } from '@beauty-salon-frontend/api-client'
import { amountOf, PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  deliveryDayNameOf,
  orderDayNameOf,
  orderStatusNameOf,
  orderStatusToneOf,
} from '../../utils/order-format'

const { list, words } = adminPurchaseOrderMessages

export type OrderTableProps = {
  /** What the table lists, in the language of the page: 「発注」 or 「条件に合う発注」 */
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
}: OrderTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={caption}
      rowHeader='orderNumber'
      columns={[
        {
          key: 'orderNumber',
          header: say(words.orderNumber),
          cell: ({ id, orderNumber }) => (
            <Link href={orderHref(id)}>{orderNumber}</Link>
          ),
        },
        {
          key: 'orderDate',
          header: say(words.orderDate),
          cell: ({ orderDate }) => say(orderDayNameOf(orderDate, timezone)),
        },
        {
          key: 'supplier',
          header: say(words.supplier),
          cell: ({ supplier }) => supplier,
        },
        {
          key: 'status',
          header: say(words.status),
          cell: ({ status }) => (
            <Badge tone={orderStatusToneOf(status)}>
              {say(orderStatusNameOf(status))}
            </Badge>
          ),
        },
        {
          key: 'totalAmount',
          header: say(words.total),
          align: 'end',
          cell: ({ totalAmount }) => say(amountOf(totalAmount, currency)),
        },
        {
          key: 'expectedDelivery',
          header: say(words.expectedDelivery),
          cell: ({ expectedDelivery }) =>
            say(deliveryDayNameOf(expectedDelivery, timezone)),
        },
      ]}
      rows={orders}
      rowKey={({ id }) => id}
      emptyMessage={say(list.none)}
      count={say(countOf(total, orders.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
