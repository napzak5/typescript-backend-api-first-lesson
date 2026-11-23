import type {
  ModelsPaymentMethodResponse,
  ModelsSaleReceiptResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { amountOf, momentNameAt } from '@beauty-salon-frontend/salon-screens'
import { DescriptionList, Table, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { numberOf } from '@beauty-salon-shared/i18n/formats'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useId } from 'react'
import { cardNameOf, methodNameOf, refundedOf } from '../../utils/sale-format'
import styles from './receipt.module.css'

const { receipt: texts, words } = adminSaleMessages

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
 * The parts are those the salon wrote, set apart as the portal sets them;
 * a salon that gave no postal code or no building is written without it.
 */
const placeOf = ({
  postalCode,
  prefecture,
  city,
  address,
  building,
}: ReceiptProps['salon']): LocalizedText =>
  texts.addressOf(postalCode, [
    prefecture,
    city,
    address,
    ...(building === null ? [] : [building]),
  ])

/**
 * The receipt of a sale, to hand over printed: the salon, the number and
 * the time of the sale, what was bought at what price, the tax, the total,
 * and how it was paid. What was given back is said below the payments.
 * On paper it stands alone, without the frame of the screen. It is in the
 * language of the page, which the one who prints it chose.
 */
export const Receipt = ({ receipt, salon, methods }: ReceiptProps) => {
  const say = useSay()
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
        <p>{say(placeOf(salon))}</p>
        <p>{say(texts.phoneOf(salon.phoneNumber))}</p>
      </header>
      <DescriptionList
        items={[
          {
            term: say(texts.receiptNumber),
            description: receipt.receiptNumber,
          },
          {
            term: say(words.saleTime),
            description: say(momentNameAt(sale.saleTime, salon.timezone)),
          },
          {
            term: say(texts.issuedAt),
            description: say(momentNameAt(receipt.issuedAt, salon.timezone)),
          },
        ]}
      />
      <Table
        caption={say(texts.items)}
        columns={[
          {
            key: 'itemName',
            header: say(words.item),
            cell: ({ itemName }) => itemName,
          },
          {
            key: 'quantity',
            header: say(words.quantity),
            cell: ({ quantity }) => say(numberOf(quantity)),
          },
          {
            key: 'unitPrice',
            header: say(words.unitPrice),
            cell: ({ unitPrice }) => say(amountOf(unitPrice, currency)),
          },
          {
            key: 'discountAmount',
            header: say(words.discount),
            cell: ({ discountAmount }) =>
              say(amountOf(discountAmount, currency)),
          },
          {
            key: 'totalAmount',
            header: say(words.amount),
            cell: ({ totalAmount }) => say(amountOf(totalAmount, currency)),
          },
        ]}
        rows={sale.details}
        rowKey={({ sortOrder }) => String(sortOrder)}
        emptyMessage={say(words.noLineItems)}
      />
      <DescriptionList
        className={styles['amounts']}
        items={[
          {
            term: say(words.subtotal),
            description: say(amountOf(sale.subtotal, currency)),
          },
          {
            term: say(words.discount),
            description: say(amountOf(sale.discountAmount, currency)),
          },
          {
            term: say(words.tax),
            description: say(amountOf(sale.taxAmount, currency)),
          },
          {
            term: say(words.total),
            description: say(amountOf(sale.totalAmount, currency)),
          },
          ...sale.payments.map((payment) => ({
            term: say(
              texts.paidBy(
                methodNameOf(payment.paymentMethodId, methods),
                cardNameOf(payment),
              ),
            ),
            description: say(amountOf(payment.amount, currency)),
          })),
          ...(refunded === 0
            ? []
            : [
                {
                  term: say(texts.refunded),
                  description: say(amountOf(refunded, currency)),
                },
              ]),
        ]}
      />
      <p className={styles['thanks']}>{say(texts.thanks)}</p>
    </article>
  )
}
