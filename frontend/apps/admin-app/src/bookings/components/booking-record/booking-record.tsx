import type {
  ModelsBookingResponse,
  ModelsCustomerResponse,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  dayNameOf,
  momentNameAt,
} from '@beauty-salon-frontend/salon-screens'
import {
  Card,
  DescriptionList,
  Link,
  Table,
  useSay,
} from '@beauty-salon-frontend/ui'
import {
  adminBookingMessages,
  adminCustomerMessages,
  adminMenuMessages,
  adminStaffMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { customerNameOf } from '../../../customers/api/customers-api'
import { sourceNameOf } from '../../utils/booking-entry'
import { hoursOf } from '../../utils/booking-format'
import {
  memberNameOf,
  type Names,
  serviceNameOf,
  staffNameOf,
} from '../../utils/day-bookings'
import styles from './booking-record.module.css'

const { record: WORDS } = adminBookingMessages.details
const { amountWithTax } = adminBookingMessages

export type BookingRecordProps = {
  booking: ModelsBookingResponse
  /** `null`: the customer was removed */
  customer: Pick<
    ModelsCustomerResponse,
    'lastName' | 'firstName' | 'phoneNumber'
  > | null
  /** The address of the page of the customer */
  customerHref: string
  staff: Names['staff']
  services: Names['services']
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
  /** The address of the page of a line of the booking */
  lineHrefOf: (lineId: string) => string
}

/**
 * What the salon keeps of a booking: who comes when, for what, with whom,
 * what it comes to, and what happened to it. What the salon leaves empty
 * is said to be so; what has not happened yet (a cancellation, the times
 * the treatment actually took) is not shown.
 */
export const BookingRecord = ({
  booking,
  customer,
  customerHref,
  staff,
  services,
  timezone,
  currency,
  lineHrefOf,
}: BookingRecordProps) => {
  const say = useSay()
  const amount = (value: number): string => say(amountOf(value, currency))
  const happened = [
    ...(booking.cancelledAt === null
      ? []
      : [
          {
            term: say(WORDS.cancelledAt),
            description: say(momentNameAt(booking.cancelledAt, timezone)),
          },
          {
            term: say(WORDS.cancellationReason),
            description: booking.cancellationReason,
          },
        ]),
    ...(booking.actualStartTime === null
      ? []
      : [
          {
            term: say(WORDS.actualStart),
            description: say(momentNameAt(booking.actualStartTime, timezone)),
          },
        ]),
    ...(booking.actualEndTime === null
      ? []
      : [
          {
            term: say(WORDS.actualEnd),
            description: say(momentNameAt(booking.actualEndTime, timezone)),
          },
        ]),
    ...(booking.completedAt === null
      ? []
      : [
          {
            term: say(WORDS.completedAt),
            description: say(momentNameAt(booking.completedAt, timezone)),
          },
        ]),
  ]

  return (
    <div className={styles['record']}>
      <Card title={say(WORDS.booking)}>
        <DescriptionList
          items={[
            {
              term: say(WORDS.bookingNumber),
              description: booking.bookingNumber,
            },
            {
              term: say(WORDS.date),
              description: say(dayNameOf(booking.bookingDate)),
            },
            {
              term: say(WORDS.hours),
              description: say(hoursOf(booking, timezone)),
            },
            {
              term: say(WORDS.customer),
              description:
                customer === null ? (
                  say(adminCustomerMessages.naming.removed)
                ) : (
                  <Link href={customerHref}>{customerNameOf(customer)}</Link>
                ),
            },
            ...(customer === null
              ? []
              : [
                  {
                    term: say(WORDS.phoneNumber),
                    description: customer.phoneNumber,
                  },
                ]),
            {
              term: say(WORDS.staff),
              description:
                staffNameOf(booking.staffId, staff) ??
                say(adminStaffMessages.unlisted),
            },
            {
              term: say(WORDS.customerRequest),
              description: booking.customerRequest,
            },
            {
              term: say(WORDS.internalNotes),
              description: booking.internalNotes,
            },
            {
              term: say(WORDS.source),
              description:
                booking.source === null
                  ? null
                  : say(sourceNameOf(booking.source)),
            },
            {
              term: say(WORDS.deposit),
              description:
                booking.depositAmount === null
                  ? null
                  : amount(booking.depositAmount),
            },
            ...happened,
          ]}
        />
      </Card>
      <Card title={say(WORDS.lines)}>
        <Table
          caption={say(WORDS.lines)}
          captionHidden
          columns={[
            {
              key: 'service',
              header: say(WORDS.service),
              cell: ({ id, serviceId }) => (
                <Link href={lineHrefOf(id)}>
                  {serviceNameOf(serviceId, services) ??
                    say(adminMenuMessages.removedService)}
                </Link>
              ),
            },
            {
              key: 'staff',
              header: say(WORDS.staff),
              cell: ({ staffId }) => say(memberNameOf(staffId, staff)),
            },
            {
              key: 'hours',
              header: say(WORDS.hours),
              cell: (line) => say(hoursOf(line, timezone)),
            },
            {
              key: 'price',
              header: say(WORDS.amount),
              align: 'end',
              cell: ({ finalPrice, discountAmount, taxIncluded }) =>
                say(
                  amountWithTax(
                    amountOf(finalPrice, currency),
                    discountAmount > 0
                      ? amountOf(discountAmount, currency)
                      : null,
                    taxIncluded,
                  ),
                ),
            },
            {
              key: 'completed',
              header: say(WORDS.completed),
              cell: ({ isCompleted }) =>
                say(isCompleted ? WORDS.done : WORDS.notDone),
            },
          ]}
          rows={booking.services.toSorted(
            (one, other) => one.sortOrder - other.sortOrder,
          )}
          rowKey={({ id }) => id}
          emptyMessage={say(WORDS.noLines)}
        />
      </Card>
      <Card title={say(WORDS.amounts)}>
        <DescriptionList
          items={[
            {
              term: say(WORDS.subtotal),
              description: amount(booking.subtotal),
            },
            {
              term: say(WORDS.discount),
              description: amount(booking.discountAmount),
            },
            {
              term: say(WORDS.tax),
              description: amount(booking.taxAmount),
            },
            {
              term: say(WORDS.total),
              description: amount(booking.totalAmount),
            },
          ]}
        />
      </Card>
    </div>
  )
}
