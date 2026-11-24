import { PagedTable } from '@beauty-salon-frontend/salon-screens'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  adminBookingMessages,
  adminCustomerMessages,
  adminMenuMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { customerNameOf } from '../../../customers/api/customers-api'
import { hoursOf, statusNameOf, statusToneOf } from '../../utils/booking-format'
import type { BookingRow } from '../../utils/day-bookings'

const { table: WORDS } = adminBookingMessages.ledger

export type DayBookingTableProps = {
  /** What the table lists: 「2026年11月20日（金）の予約」 */
  caption: LocalizedText
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
}: DayBookingTableProps) => {
  const say = useSay()

  return (
    <PagedTable
      caption={say(caption)}
      columns={[
        {
          key: 'hours',
          header: say(WORDS.hours),
          cell: ({ booking }) => say(hoursOf(booking, timezone)),
        },
        {
          key: 'customer',
          header: say(WORDS.customer),
          cell: (row) => (
            <Link href={bookingHref(row)}>
              {row.customer === null
                ? say(adminCustomerMessages.naming.removed)
                : customerNameOf(row.customer)}
            </Link>
          ),
        },
        {
          key: 'staff',
          header: say(WORDS.staff),
          cell: ({ staffName }) =>
            staffName ?? say(adminStaffMessages.unlisted),
        },
        {
          key: 'services',
          header: say(WORDS.services),
          cell: ({ serviceNames }) =>
            say(
              WORDS.servicesOf(
                serviceNames.map(
                  (name) => name ?? say(adminMenuMessages.removedService),
                ),
              ),
            ),
        },
        {
          key: 'status',
          header: say(WORDS.status),
          cell: ({ booking }) => (
            <Badge tone={statusToneOf(booking.status)}>
              {say(statusNameOf(booking.status))}
            </Badge>
          ),
        },
        {
          key: 'bookingNumber',
          header: say(WORDS.bookingNumber),
          cell: ({ booking }) => booking.bookingNumber,
        },
      ]}
      rows={rows}
      rowKey={({ booking }) => booking.id}
      emptyMessage={say(WORDS.empty)}
      count={say(countOf(total, rows.length, COUNTED.items))}
      more={more}
      onMore={onMore}
    />
  )
}
