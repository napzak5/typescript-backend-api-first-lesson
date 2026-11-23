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
  inJapanese,
  Link,
  Table,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import {
  deliveryDayNameOf,
  doneNameOf,
  itemQuantityNameOf,
  orderStatusNameOf,
  orderStatusToneOf,
} from '../../utils/order-format'
import styles from './order-record.module.css'

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
): DescriptionListItem[] => [
  ...(order.approvedAt === null
    ? []
    : [
        {
          term: '承認',
          description: doneNameOf(
            order.approvedAt,
            order.approvedBy,
            timezone,
            staff,
          ),
        },
      ]),
  ...(order.actualDelivery === null
    ? []
    : [
        {
          term: '納品日時',
          description: inJapanese(momentNameAt(order.actualDelivery, timezone)),
        },
      ]),
  ...(order.cancelledAt === null
    ? []
    : [
        {
          term: '取り消し',
          description: inJapanese(momentNameAt(order.cancelledAt, timezone)),
        },
        {
          term: '取り消した理由',
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
}: OrderRecordProps) => (
  <div className={styles['record']}>
    <Card title='発注'>
      <DescriptionList
        items={[
          { term: '発注番号', description: order.orderNumber },
          {
            term: 'ステータス',
            description: (
              <Badge tone={orderStatusToneOf(order.status)}>
                {orderStatusNameOf(order.status)}
              </Badge>
            ),
          },
          { term: '仕入先', description: order.supplier },
          {
            term: '発注日時',
            description: doneNameOf(
              order.orderDate,
              order.createdBy,
              timezone,
              staff,
            ),
          },
          {
            term: '納品予定日',
            description: deliveryDayNameOf(order.expectedDelivery, timezone),
          },
          ...eventsOf(order, timezone, staff),
          {
            term: '支払条件',
            description: order.paymentTerms,
          },
          {
            term: 'メモ',
            description: <WrittenText>{order.notes}</WrittenText>,
          },
          {
            term: '納品のメモ',
            description: <WrittenText>{order.deliveryNotes}</WrittenText>,
          },
        ]}
      />
    </Card>
    <Card title='明細'>
      <Table
        caption='明細'
        captionHidden
        rowHeader='productName'
        columns={[
          {
            key: 'productCode',
            header: '商品コード',
            cell: ({ productCode }) => productCode,
          },
          {
            key: 'productName',
            header: '商品名',
            cell: ({ inventoryId, productName }) =>
              inventoryId === null ? (
                productName
              ) : (
                <Link href={rowHref(inventoryId)}>{productName}</Link>
              ),
          },
          {
            key: 'quantity',
            header: '数量',
            align: 'end',
            cell: itemQuantityNameOf,
          },
          {
            key: 'unitPrice',
            header: '単価',
            align: 'end',
            cell: ({ unitPrice }) => inJapanese(amountOf(unitPrice, currency)),
          },
          {
            key: 'totalPrice',
            header: '金額',
            align: 'end',
            cell: ({ totalPrice }) =>
              inJapanese(amountOf(totalPrice, currency)),
          },
          {
            key: 'notes',
            header: 'メモ',
            cell: ({ notes }) => notes,
          },
        ]}
        rows={order.items}
        // An item names its row once; one of a row removed since, by what it ordered
        rowKey={({ inventoryId, productCode, quantity, unitPrice }) =>
          inventoryId ?? `${productCode}:${quantity}:${unitPrice}`
        }
        emptyMessage='明細はありません'
      />
    </Card>
    <Card title='金額'>
      <DescriptionList
        items={[
          {
            term: '小計',
            description: inJapanese(amountOf(order.subtotal, currency)),
          },
          {
            term: '税額',
            description: inJapanese(amountOf(order.taxAmount, currency)),
          },
          {
            term: '送料',
            description:
              order.shippingCost === null
                ? null
                : inJapanese(amountOf(order.shippingCost, currency)),
          },
          {
            term: '合計',
            description: inJapanese(amountOf(order.totalAmount, currency)),
          },
        ]}
      />
    </Card>
  </div>
)
