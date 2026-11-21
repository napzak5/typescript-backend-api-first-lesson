import type { ModelsSaleResponse } from '@beauty-salon-frontend/api-client'
import {
  countOf,
  type More,
  momentNameAt,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import { Badge, Link } from '@beauty-salon-frontend/ui'
import { amountOf } from '../../../bookings/booking-format'
import { paymentStatusNameOf, paymentStatusToneOf } from '../../sale-format'

export type SaleTableProps = {
  /** What the table lists: 「2026年11月20日（金）の売上」 */
  caption: string
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
}: SaleTableProps) => (
  <PagedTable
    caption={caption}
    columns={[
      {
        key: 'saleNumber',
        header: '売上番号',
        cell: (sale) => <Link href={saleHref(sale)}>{sale.saleNumber}</Link>,
      },
      {
        key: 'saleTime',
        header: '会計日時',
        cell: ({ saleTime }) => momentNameAt(saleTime, timezone),
      },
      {
        key: 'totalAmount',
        header: '合計',
        cell: ({ totalAmount }) => amountOf(totalAmount, currency),
      },
      {
        key: 'paymentStatus',
        header: '支払い',
        cell: ({ isVoid, paymentStatus }) =>
          isVoid ? (
            <Badge tone='neutral'>取り消し</Badge>
          ) : (
            <Badge tone={paymentStatusToneOf(paymentStatus)}>
              {paymentStatusNameOf(paymentStatus)}
            </Badge>
          ),
      },
    ]}
    rows={rows}
    rowKey={({ id }) => id}
    emptyMessage='売上はありません'
    count={countOf(total, rows.length, '件')}
    more={more}
    onMore={onMore}
  />
)
