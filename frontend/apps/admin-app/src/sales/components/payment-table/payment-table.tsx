import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { DescriptionList, Link, Table } from '@beauty-salon-frontend/ui'
import {
  cardNameOf,
  methodNameOf,
  paymentNameOf,
  refundNameOf,
} from '../../sale-format'

export type PaymentTableProps = {
  /** The payments of a sale, in the order they were recorded */
  payments: readonly ModelsPaymentResponse[]
  /** The payment methods of the salon, those it uses no more as well */
  methods: readonly Pick<ModelsPaymentMethodResponse, 'id' | 'displayName'>[]
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
  /**
   * The address of the screen that gives a payment back; `undefined` for a
   * payment that is not given back, or not by this account
   */
  refundHrefOf?:
    | ((payment: ModelsPaymentResponse) => string | undefined)
    | undefined
}

/**
 * The payments of a sale: each by its number, with when and how it was
 * received, how much, the card it was made with, what became of it, and
 * what was given back of it, and when. A payment that can be given back
 * links to the screen that does, named by its number. Why a payment was
 * given back follows the table, by the number of the payment: a reason
 * is a sentence, and the cells of a table keep to one line.
 */
export const PaymentTable = ({
  payments,
  methods,
  timezone,
  currency,
  refundHrefOf = () => undefined,
}: PaymentTableProps) => {
  const reasons = payments.flatMap(({ transactionNumber, refundReason }) =>
    refundReason === null
      ? []
      : [
          {
            term: `${transactionNumber} の返金の理由`,
            description: refundReason,
          },
        ],
  )

  return (
    <>
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
            cell: ({ paymentMethodId }) =>
              methodNameOf(paymentMethodId, methods),
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
          {
            key: 'refund',
            header: '返金',
            cell: (payment) => {
              const refund = refundNameOf(payment, timezone, currency)
              const href = refundHrefOf(payment)
              if (refund !== null || href === undefined) {
                return refund ?? 'なし'
              }

              return (
                <Link
                  href={href}
                  aria-label={`${payment.transactionNumber} を返金する`}
                >
                  返金する
                </Link>
              )
            },
          },
        ]}
        rows={payments}
        rowKey={({ id }) => id}
        emptyMessage='まだ支払いはありません'
      />
      {reasons.length > 0 && <DescriptionList items={reasons} />}
    </>
  )
}
