import type {
  ModelsCustomerResponse,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Badge,
  Card,
  DescriptionList,
  Link,
  Table,
} from '@beauty-salon-frontend/ui'
import { NO_RECORD } from '../../../bookings/booking-entry'
import { amountOf, GONE_CUSTOMER } from '../../../bookings/booking-format'
import { memberNameOf, type Names } from '../../../bookings/day-bookings'
import { customerNameOf } from '../../../customers/customers-api'
import { dayNameOf, momentNameAt } from '../../../salon-time'
import {
  owedOf,
  paymentStatusNameOf,
  paymentStatusToneOf,
  receivedOf,
  refundedOf,
} from '../../sale-format'
import styles from './sale-record.module.css'

export type SaleRecordProps = {
  sale: ModelsSaleResponse
  /** `null`: the customer was removed */
  customer: Pick<ModelsCustomerResponse, 'lastName' | 'firstName'> | null
  staff: Names['staff']
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
  /** The address of the page of the booking the sale bills */
  bookingHref?: string | undefined
}

const NONE = 'なし'

/**
 * What the ledger keeps of a sale: when it was entered, for whom and by
 * whom, what it bills line by line, and what it comes to: what was
 * received of it, what was given back, and what is left to pay. A sale
 * that was voided says when and why.
 */
export const SaleRecord = ({
  sale,
  customer,
  staff,
  timezone,
  currency,
  bookingHref,
}: SaleRecordProps) => {
  const refunded = refundedOf(sale)

  return (
    <div className={styles['record']}>
      <Card title='売上'>
        <DescriptionList
          items={[
            { term: '売上番号', description: sale.saleNumber },
            {
              term: '会計日時',
              description: momentNameAt(sale.saleTime, timezone),
            },
            { term: '会計日', description: dayNameOf(sale.saleDate) },
            {
              term: 'お客様',
              description: customerNameIn(sale.customerId, customer),
            },
            {
              term: '会計の担当',
              description:
                sale.staffId === null
                  ? NO_RECORD
                  : memberNameOf(sale.staffId, staff),
            },
            {
              term: '予約',
              description:
                bookingHref === undefined ? (
                  NONE
                ) : (
                  <Link href={bookingHref}>予約の内容</Link>
                ),
            },
            {
              term: '支払い',
              description: sale.isVoid ? (
                <Badge tone='neutral'>取り消し</Badge>
              ) : (
                <Badge tone={paymentStatusToneOf(sale.paymentStatus)}>
                  {paymentStatusNameOf(sale.paymentStatus)}
                </Badge>
              ),
            },
            ...(sale.voidedAt === null
              ? []
              : [
                  {
                    term: '取り消した日時',
                    description: momentNameAt(sale.voidedAt, timezone),
                  },
                  {
                    term: '取り消しの理由',
                    description: sale.voidReason ?? NO_RECORD,
                  },
                ]),
            { term: 'メモ', description: sale.notes ?? NONE },
          ]}
        />
      </Card>
      <Card title='明細'>
        <Table
          caption='明細'
          captionHidden
          columns={[
            {
              key: 'itemName',
              header: '品目',
              cell: ({ itemName }) => itemName,
            },
            {
              key: 'staff',
              header: '担当',
              cell: ({ staffId }) => memberNameOf(staffId, staff),
            },
            {
              key: 'quantity',
              header: '数量',
              cell: ({ quantity }) => String(quantity),
            },
            {
              key: 'unitPrice',
              header: '単価',
              cell: ({ unitPrice }) => amountOf(unitPrice, currency),
            },
            {
              key: 'discountAmount',
              header: '割引',
              cell: ({ discountAmount }) => amountOf(discountAmount, currency),
            },
            {
              key: 'taxAmount',
              header: '消費税',
              cell: ({ taxAmount }) => amountOf(taxAmount, currency),
            },
            {
              key: 'totalAmount',
              header: '金額',
              cell: ({ totalAmount }) => amountOf(totalAmount, currency),
            },
          ]}
          rows={sale.details}
          rowKey={({ sortOrder }) => String(sortOrder)}
          emptyMessage='明細はありません'
        />
      </Card>
      <Card title='金額'>
        <DescriptionList
          items={[
            { term: '小計', description: amountOf(sale.subtotal, currency) },
            {
              term: '割引',
              description: amountOf(sale.discountAmount, currency),
            },
            {
              term: '消費税',
              description: amountOf(sale.taxAmount, currency),
            },
            { term: '合計', description: amountOf(sale.totalAmount, currency) },
            {
              term: '受け取った金額',
              description: amountOf(receivedOf(sale), currency),
            },
            ...(refunded === 0
              ? []
              : [
                  {
                    term: '返金した金額',
                    description: amountOf(refunded, currency),
                  },
                ]),
            {
              term: '未払い残額',
              description: amountOf(owedOf(sale), currency),
            },
          ]}
        />
      </Card>
    </div>
  )
}

/** The customer of a sale, by name: none recorded, or removed from the ledger. */
const customerNameIn = (
  customerId: string | null,
  customer: SaleRecordProps['customer'],
): string => {
  if (customerId === null) {
    return NO_RECORD
  }

  return customer === null ? GONE_CUSTOMER : customerNameOf(customer)
}
