import {
  countOf,
  type More,
  PagedTable,
} from '@beauty-salon-frontend/salon-screens'
import { Badge, Link } from '@beauty-salon-frontend/ui'
import { customerNameOf } from '../../../customers/customers-api'
import {
  GONE_CUSTOMER,
  GONE_SERVICE,
  hoursOf,
  statusNameOf,
  statusToneOf,
  UNLISTED_STAFF,
} from '../../booking-format'
import type { BookingRow } from '../../day-bookings'

export type DayBookingTableProps = {
  /** What the table lists: 「2026年11月20日（金）の予約」 */
  caption: string
  /** The bookings that were read so far, in the order they begin; at least one */
  rows: readonly BookingRow[]
  /** How many bookings there are; `null` when the API did not count them */
  total: number | null
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  more: More
  /** Asks for the bookings that come next */
  onMore: () => void
  /** The address of the screen of a booking */
  bookingHref: (row: BookingRow) => string
}

/**
 * The bookings of a day, in the order they begin. The customer of a row
 * leads to the booking; a customer who was removed is said to be so, and
 * still leads to it.
 */
export const DayBookingTable = ({
  caption,
  rows,
  total,
  timezone,
  more,
  onMore,
  bookingHref,
}: DayBookingTableProps) => (
  <PagedTable
    caption={caption}
    columns={[
      {
        key: 'hours',
        header: '時刻',
        cell: ({ booking }) => hoursOf(booking, timezone),
      },
      {
        key: 'customer',
        header: 'お客様',
        cell: (row) => (
          <Link href={bookingHref(row)}>
            {row.customer === null
              ? GONE_CUSTOMER
              : customerNameOf(row.customer)}
          </Link>
        ),
      },
      {
        key: 'staff',
        header: '担当',
        cell: ({ staffName }) => staffName ?? UNLISTED_STAFF,
      },
      {
        key: 'services',
        header: 'メニュー',
        cell: ({ serviceNames }) =>
          serviceNames.map((name) => name ?? GONE_SERVICE).join('、'),
      },
      {
        key: 'status',
        header: '状態',
        cell: ({ booking }) => (
          <Badge tone={statusToneOf(booking.status)}>
            {statusNameOf(booking.status)}
          </Badge>
        ),
      },
      {
        key: 'bookingNumber',
        header: '予約番号',
        cell: ({ booking }) => booking.bookingNumber,
      },
    ]}
    rows={rows}
    rowKey={({ booking }) => booking.id}
    emptyMessage='予約はありません'
    count={countOf(total, rows.length, '件')}
    more={more}
    onMore={onMore}
  />
)
