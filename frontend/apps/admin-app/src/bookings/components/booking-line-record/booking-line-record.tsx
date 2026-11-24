import type { ModelsBookingServiceResponse } from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  dayAt,
  dayNameOf,
  momentNameAt,
} from '@beauty-salon-frontend/salon-screens'
import { Card, DescriptionList, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import {
  adminBookingMessages,
  adminMenuMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import { hoursOf } from '../../utils/booking-format'
import {
  memberNameOf,
  type Names,
  serviceNameOf,
} from '../../utils/day-bookings'

const { line: WORDS } = adminBookingMessages.moves

export type BookingLineRecordProps = {
  line: ModelsBookingServiceResponse
  staff: Names['staff']
  services: Names['services']
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** The currency of the salon */
  currency: string
}

/**
 * A line of a booking, as the salon keeps it: the service, who does it,
 * when and for how long, what it costs with its discount, whether it was
 * done, and the note. The amounts are those of the service when the line
 * was put in.
 */
export const BookingLineRecord = ({
  line,
  staff,
  services,
  timezone,
  currency,
}: BookingLineRecordProps) => {
  const say = useSay()

  return (
    <Card title={say(WORDS.line)}>
      <DescriptionList
        items={[
          {
            term: say(WORDS.service),
            description:
              serviceNameOf(line.serviceId, services) ??
              say(adminMenuMessages.removedService),
          },
          {
            term: say(WORDS.staff),
            description: say(memberNameOf(line.staffId, staff)),
          },
          {
            term: say(WORDS.hours),
            description: say(
              WORDS.when(
                dayNameOf(dayAt(new Date(line.startTime), timezone)),
                hoursOf(line, timezone),
              ),
            ),
          },
          {
            term: say(WORDS.duration),
            description: say(formats.minutesOf(line.duration)),
          },
          {
            term: say(WORDS.price),
            description: say(amountOf(line.price, currency)),
          },
          {
            term: say(WORDS.discount),
            description: say(amountOf(line.discountAmount, currency)),
          },
          {
            term: say(WORDS.finalPrice),
            description: say(
              WORDS.finalPriceOf(
                amountOf(line.finalPrice, currency),
                line.taxIncluded,
              ),
            ),
          },
          {
            term: say(WORDS.completed),
            // The database keeps a line that was done with when it was recorded
            description: say(
              line.completedAt === null
                ? WORDS.notDone
                : WORDS.doneAt(momentNameAt(line.completedAt, timezone)),
            ),
          },
          { term: say(WORDS.notes), description: line.notes },
        ]}
      />
    </Card>
  )
}
