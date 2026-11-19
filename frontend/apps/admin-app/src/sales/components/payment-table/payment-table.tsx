import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentResponse,
} from '@beauty-salon-frontend/api-client'
import { Table } from '@beauty-salon-frontend/ui'
import { amountOf } from '../../../bookings/booking-format'
import { momentNameAt } from '../../../salon-time'
import { cardNameOf, methodNameOf, paymentNameOf } from '../../sale-format'

export type PaymentTableProps = {
  /** The payments of a sale, in the order they were recorded */
  payments: readonly ModelsPaymentResponse[]
  /** The payment methods of the salon, those it uses no more as well */
  methods: readonly Pick<ModelsPaymentMethodResponse, 'id' | 'displayName'>[]
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
}

/**
 * The payments of a sale: each by its number, with when and how it was
 * received, how much, the card it was made with, and what became of it.
 */
export const PaymentTable = ({
  payments,
  methods,
  timezone,
  currency,
}: PaymentTableProps) => (
  <Table
    caption='支払い'
    captionHidden
    columns={[
      {
        key: 'transactionNumber',
        header: '取引番号',
        cell: ({ transactionNumber }) => transactionNumber,
      },
      {
        key: 'processedAt',
        header: '受けた日時',
        cell: ({ processedAt, createdAt }) =>
          momentNameAt(processedAt ?? createdAt, timezone),
      },
      {
        key: 'method',
        header: '支払い方法',
        cell: ({ paymentMethodId }) => methodNameOf(paymentMethodId, methods),
      },
      {
        key: 'amount',
        header: '金額',
        cell: ({ amount }) => amountOf(amount, currency),
      },
      {
        key: 'card',
        header: 'カード',
        cell: (payment) => cardNameOf(payment) ?? 'なし',
      },
      {
        key: 'status',
        header: '状態',
        cell: ({ status }) => paymentNameOf(status),
      },
    ]}
    rows={payments}
    rowKey={({ id }) => id}
    emptyMessage='まだ支払いはありません'
  />
)
