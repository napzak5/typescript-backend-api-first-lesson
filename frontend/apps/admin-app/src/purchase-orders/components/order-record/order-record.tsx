import type {
  ModelsPurchaseOrderResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  Card,
  DescriptionList,
  type DescriptionListItem,
  Link,
  Table,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminPurchaseOrderMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  deliveryDayNameOf,
  doneNameOf,
  itemQuantityNameOf,
  orderStatusNameOf,
  orderStatusToneOf,
} from '../../utils/order-format'
import styles from './order-record.module.css'

const { record: WORDS, words } = adminPurchaseOrderMessages

/** How the record is said: `useSay()` of the page */
type Say = (message: LocalizedText) => string

export type OrderRecordProps = {
  order: ModelsPurchaseOrderResponse
  /** The time zone of the salon, which the moments are said in */
  timezone: string
  /** The currency of the salon, which the amounts are said in */
  currency: string
  /** The members of the staff of the salon, who made and approved the order; `undefined` while they are read */
  staff:
    | readonly Pick<ModelsStaffProfileResponse, 'id' | 'displayName'>[]
    | undefined
  /** The screen of a stock row an item orders */
  rowHref: (inventoryId: string) => string
}

/** What happened to the order after it was made: its approval, its delivery, its cancellation, each once it happened */
const eventsOf = (
  order: ModelsPurchaseOrderResponse,
  timezone: string,
  staff: OrderRecordProps['staff'],
  say: Say,
): DescriptionListItem[] => [
  ...(order.approvedAt === null
    ? []
    : [
        {
          term: say(WORDS.approved),
          description: say(
            doneNameOf(order.approvedAt, order.approvedBy, timezone, staff),
          ),
        },
      ]),
  ...(order.actualDelivery === null
    ? []
    : [
        {
          term: say(WORDS.deliveredAt),
          description: say(momentNameAt(order.actualDelivery, timezone)),
        },
      ]),
  ...(order.cancelledAt === null
    ? []
    : [
        {
          term: say(WORDS.cancelled),
          description: say(momentNameAt(order.cancelledAt, timezone)),
        },
        {
          term: say(WORDS.cancellationReason),
          description: <WrittenText>{order.cancellationReason}</WrittenText>,
        },
      ]),
]

/**
 * What a purchase order holds: its supplier and status, when it was made
 * and by whom, when it is to be delivered, and what happened to it since;
 * the items it orders, each leading to its stock row while the row is
 * there; and what it comes to.
 */
export const OrderRecord = ({
  order,
  timezone,
  currency,
  staff,
  rowHref,
}: OrderRecordProps) => {
  const say = useSay()

  return (
    <div className={styles['record']}>
      <Card title={say(words.order)}>
        <DescriptionList
          items={[
            { term: say(words.orderNumber), description: order.orderNumber },
            {
              term: say(words.status),
              description: (
                <Badge tone={orderStatusToneOf(order.status)}>
                  {say(orderStatusNameOf(order.status))}
                </Badge>
              ),
            },
            { term: say(words.supplier), description: order.supplier },
            {
              term: say(WORDS.orderedAt),
              description: say(
                doneNameOf(order.orderDate, order.createdBy, timezone, staff),
              ),
            },
            {
              term: say(words.expectedDelivery),
              description: say(
                deliveryDayNameOf(order.expectedDelivery, timezone),
              ),
            },
            ...eventsOf(order, timezone, staff, say),
            {
              term: say(words.paymentTerms),
              description: order.paymentTerms,
            },
            {
              term: say(words.notes),
              description: <WrittenText>{order.notes}</WrittenText>,
            },
            {
              term: say(words.deliveryNotes),
              description: <WrittenText>{order.deliveryNotes}</WrittenText>,
            },
          ]}
        />
      </Card>
      <Card title={say(words.items)}>
        <Table
          caption={say(words.items)}
          captionHidden
          rowHeader='productName'
          columns={[
            {
              key: 'productCode',
              header: say(words.productCode),
              cell: ({ productCode }) => productCode,
            },
            {
              key: 'productName',
              header: say(words.productName),
              cell: ({ inventoryId, productName }) =>
                inventoryId === null ? (
                  productName
                ) : (
                  <Link href={rowHref(inventoryId)}>{productName}</Link>
                ),
            },
            {
              key: 'quantity',
              header: say(words.quantity),
              align: 'end',
              cell: (item) => say(itemQuantityNameOf(item)),
            },
            {
              key: 'unitPrice',
              header: say(WORDS.unitPrice),
              align: 'end',
              cell: ({ unitPrice }) => say(amountOf(unitPrice, currency)),
            },
            {
              key: 'totalPrice',
              header: say(WORDS.amount),
              align: 'end',
              cell: ({ totalPrice }) => say(amountOf(totalPrice, currency)),
            },
            {
              key: 'notes',
              header: say(words.notes),
              cell: ({ notes }) => notes,
            },
          ]}
          rows={order.items}
          // An item names its row once; one of a row removed since, by what it ordered
          rowKey={({ inventoryId, productCode, quantity, unitPrice }) =>
            inventoryId ?? `${productCode}:${quantity}:${unitPrice}`
          }
          emptyMessage={say(WORDS.noItems)}
        />
      </Card>
      <Card title={say(WORDS.amounts)}>
        <DescriptionList
          items={[
            {
              term: say(WORDS.subtotal),
              description: say(amountOf(order.subtotal, currency)),
            },
            {
              term: say(WORDS.tax),
              description: say(amountOf(order.taxAmount, currency)),
            },
            {
              term: say(WORDS.shipping),
              description:
                order.shippingCost === null
                  ? null
                  : say(amountOf(order.shippingCost, currency)),
            },
            {
              term: say(words.total),
              description: say(amountOf(order.totalAmount, currency)),
            },
          ]}
        />
      </Card>
    </div>
  )
}
