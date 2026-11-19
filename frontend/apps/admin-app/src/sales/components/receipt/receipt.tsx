import type {
  ModelsPaymentMethodResponse,
  ModelsSaleReceiptResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { DescriptionList, Table } from '@beauty-salon-frontend/ui'
import { useId } from 'react'
import { amountOf } from '../../../bookings/booking-format'
import { momentNameAt } from '../../../salon-time'
import { cardNameOf, methodNameOf, refundedOf } from '../../sale-format'
import styles from './receipt.module.css'

export type ReceiptProps = {
  receipt: ModelsSaleReceiptResponse
  /** The salon that issues it: its name, where it is and how it is reached */
  salon: Pick<
    ModelsSalonResponse,
    | 'name'
    | 'postalCode'
    | 'prefecture'
    | 'city'
    | 'address'
    | 'building'
    | 'phoneNumber'
    | 'timezone'
    | 'currency'
  >
  /** The payment methods of the salon, those it uses no more as well */
  methods: readonly Pick<ModelsPaymentMethodResponse, 'id' | 'displayName'>[]
}

/**
 * Where the salon is, in one line: 「〒150-0001 東京都 渋谷区 神宮前 4-1-1」.
 * The parts are those the salon wrote, set apart as the portal sets them.
 */
const placeOf = ({
  postalCode,
  prefecture,
  city,
  address,
  building,
}: ReceiptProps['salon']): string =>
  [
    `〒${postalCode}`,
    prefecture,
    city,
    address,
    ...(building === null ? [] : [building]),
  ].join(' ')

/**
 * The receipt of a sale, to hand over printed: the salon, the number and
 * the time of the sale, what was bought at what price, the tax, the total,
 * and how it was paid. What was given back is said below the payments.
 * On paper it stands alone, without the frame of the screen.
 */
export const Receipt = ({ receipt, salon, methods }: ReceiptProps) => {
  const name = useId()
  const { sale } = receipt
  const { currency } = salon
  const refunded = refundedOf(sale)

  return (
    <article className={styles['receipt']} aria-labelledby={name}>
      <header className={styles['issuer']}>
        <h2 className={styles['salon']} id={name}>
          {salon.name}
        </h2>
        <p>{placeOf(salon)}</p>
        <p>{`電話 ${salon.phoneNumber}`}</p>
      </header>
      <DescriptionList
        items={[
          { term: 'レシート番号', description: receipt.receiptNumber },
          {
            term: '会計日時',
            description: momentNameAt(sale.saleTime, salon.timezone),
          },
          {
            term: '発行日時',
            description: momentNameAt(receipt.issuedAt, salon.timezone),
          },
        ]}
      />
      <Table
        caption='お買い上げの明細'
        columns={[
          { key: 'itemName', header: '品目', cell: ({ itemName }) => itemName },
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
            key: 'totalAmount',
            header: '金額',
            cell: ({ totalAmount }) => amountOf(totalAmount, currency),
          },
        ]}
        rows={sale.details}
        rowKey={({ sortOrder }) => String(sortOrder)}
        emptyMessage='明細はありません'
      />
      <DescriptionList
        className={styles['amounts']}
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
          ...sale.payments.map((payment) => {
            const method = methodNameOf(payment.paymentMethodId, methods)
            const card = cardNameOf(payment)

            return {
              term: `お支払い（${card === null ? method : `${method} ${card}`}）`,
              description: amountOf(payment.amount, currency),
            }
          }),
          ...(refunded === 0
            ? []
            : [
                {
                  term: 'ご返金',
                  description: amountOf(refunded, currency),
                },
              ]),
        ]}
      />
      <p className={styles['thanks']}>ご来店ありがとうございました。</p>
    </article>
  )
}
