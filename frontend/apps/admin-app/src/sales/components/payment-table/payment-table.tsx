import type {
  ModelsPaymentMethodResponse,
  ModelsPaymentResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  DescriptionList,
  Link,
  NONE,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  cardNameOf,
  methodNameOf,
  paymentNameOf,
  refundNameOf,
} from '../../utils/sale-format'

const { words } = adminSaleMessages
const { table } = adminSaleMessages.payments

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
  const say = useSay()
  const reasons = payments.flatMap(({ transactionNumber, refundReason }) =>
    refundReason === null
      ? []
      : [
          {
            term: say(table.reasonOf(transactionNumber)),
            description: refundReason,
          },
        ],
  )

  return (
    <>
      <Table
        caption={say(words.payments)}
        captionHidden
        columns={[
          {
            key: 'transactionNumber',
            header: say(words.transactionNumber),
            cell: ({ transactionNumber }) => transactionNumber,
          },
          {
            key: 'processedAt',
            header: say(words.receivedAt),
            cell: ({ processedAt, createdAt }) =>
              say(momentNameAt(processedAt ?? createdAt, timezone)),
          },
          {
            key: 'method',
            header: say(words.method),
            cell: ({ paymentMethodId }) =>
              say(methodNameOf(paymentMethodId, methods)),
          },
          {
            key: 'amount',
            header: say(words.amount),
            cell: ({ amount }) => say(amountOf(amount, currency)),
          },
          {
            key: 'card',
            header: say(words.card),
            cell: (payment) => {
              const card = cardNameOf(payment)

              return card === null ? null : say(card)
            },
          },
          {
            key: 'status',
            header: say(table.status),
            cell: ({ status }) => say(paymentNameOf(status)),
          },
          {
            key: 'refund',
            header: say(table.refund),
            cell: (payment) => {
              const refund = refundNameOf(payment, timezone, currency)
              const href = refundHrefOf(payment)
              if (refund !== null || href === undefined) {
                return say(refund ?? NONE)
              }

              return (
                <Link
                  href={href}
                  aria-label={say(table.refundOf(payment.transactionNumber))}
                >
                  {say(table.refundLink)}
                </Link>
              )
            },
          },
        ]}
        rows={payments}
        rowKey={({ id }) => id}
        emptyMessage={say(table.empty)}
      />
      {reasons.length > 0 && <DescriptionList items={reasons} />}
    </>
  )
}
