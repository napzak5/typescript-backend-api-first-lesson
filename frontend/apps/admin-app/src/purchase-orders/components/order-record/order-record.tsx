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
  WrittenText,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import {
  deliveryDayNameOf,
  doneNameOf,
  itemQuantityNameOf,
  orderStatusNameOf,
  orderStatusToneOf,
} from '../../order-format'
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

/** What was written, in the lines it was written in; 「記録なし」 when nothing was. */
const writtenOf = (text: string | null): ReactNode =>
  text === null ? null : <WrittenText>{text}</WrittenText>

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
          description: momentNameAt(order.actualDelivery, timezone),
        },
      ]),
  ...(order.cancelledAt === null
    ? []
    : [
        {
          term: '取り消し',
          description: momentNameAt(order.cancelledAt, timezone),
        },
        {
          term: '取り消した理由',
          description: writtenOf(order.cancellationReason),
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
          { term: 'メモ', description: writtenOf(order.notes) },
          { term: '納品のメモ', description: writtenOf(order.deliveryNotes) },
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
            cell: ({ unitPrice }) => amountOf(unitPrice, currency),
          },
          {
            key: 'totalPrice',
            header: '金額',
            align: 'end',
            cell: ({ totalPrice }) => amountOf(totalPrice, currency),
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
          { term: '小計', description: amountOf(order.subtotal, currency) },
          { term: '税額', description: amountOf(order.taxAmount, currency) },
          {
            term: '送料',
            description:
              order.shippingCost === null
                ? null
                : amountOf(order.shippingCost, currency),
          },
          { term: '合計', description: amountOf(order.totalAmount, currency) },
        ]}
      />
    </Card>
  </div>
)
