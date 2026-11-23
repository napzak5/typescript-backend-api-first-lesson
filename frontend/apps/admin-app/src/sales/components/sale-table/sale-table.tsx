import type { ModelsSaleResponse } from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import {
  paymentStatusNameOf,
  paymentStatusToneOf,
} from '../../utils/sale-format'

const { ledger, words } = adminSaleMessages

export type SaleTableProps = {
  /** What the table lists: 「2026年11月20日（金）の売上」 */
  caption: LocalizedText
  /** The sales that were read so far, the latest first; at least one */
  rows: readonly ModelsSaleResponse[]
  /** How many sales there are; `null` when the API did not count them */
  total: number | null
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
  more: More
  /** Asks for the sales that come next */
  onMore: () => void
  /** The address of the page of a sale */
  saleHref: (sale: ModelsSaleResponse) => string
}

/**
 * The ledger of the sales: each by its number, which leads to it, with
 * when it was entered, what it comes to and how far it was paid. A sale
 * that was voided says so in place of its payment.
 */
export const SaleTable = ({
  caption,
  rows,
  total,
  timezone,
  currency,
  more,
  onMore,
  saleHref,
}: SaleTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(caption)}
      columns={[
        {
          key: 'saleNumber',
          header: say(words.saleNumber),
          cell: (sale) => <Link href={saleHref(sale)}>{sale.saleNumber}</Link>,
        },
        {
          key: 'saleTime',
          header: say(words.saleTime),
          cell: ({ saleTime }) => say(momentNameAt(saleTime, timezone)),
        },
        {
          key: 'totalAmount',
          header: say(words.total),
          cell: ({ totalAmount }) => say(amountOf(totalAmount, currency)),
        },
        {
          key: 'paymentStatus',
          header: say(words.payment),
          cell: ({ isVoid, paymentStatus }) =>
            isVoid ? (
              <Badge>{say(words.voided)}</Badge>
            ) : (
              <Badge tone={paymentStatusToneOf(paymentStatus)}>
                {say(paymentStatusNameOf(paymentStatus))}
              </Badge>
            ),
        },
      ]}
      rows={rows}
      rowKey={({ id }) => id}
      emptyMessage={say(ledger.empty)}
      count={say(countOf(total, rows.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
