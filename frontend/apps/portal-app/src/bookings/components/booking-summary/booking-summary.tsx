import type {
  ModelsCustomerBookingResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Badge,
  DescriptionList,
  Link,
  Note,
  useSay,
  WrittenText,
} from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalBookingMessages } from '@beauty-salon-shared/i18n/messages/portal'
import {
  statusNameOf,
  statusNoteOf,
  statusToneOf,
  totalOf,
  whenKnownOf,
} from '../../utils/booking-format'
import styles from './booking-summary.module.css'

export type BookingSummaryProps = {
  booking: ModelsCustomerBookingResponse
  /**
   * The salon of the booking: its name, the time zone its times are read
   * in and the currency of its amounts. `null` when the salon is no longer
   * there: the booking then has its day, and neither a time nor an amount
   */
  salon: Pick<ModelsSalonResponse, 'name' | 'timezone' | 'currency'> | null
  /** The address of the page of the salon */
  salonHref: string
  /** The name of the service; `null` when the salon no longer shows it */
  serviceName: string | null
  /** The name of the member of the staff; `null` when the salon no longer shows them */
  staffName: string | null
}

const { summary: words } = portalBookingMessages

/**
 * A booking as its customer reads it: where it stands, where and what it
 * is, with whom, when, what it comes to, and what the customer asked for.
 */
export const BookingSummary = ({
  booking,
  salon,
  salonHref,
  serviceName,
  staffName,
}: BookingSummaryProps) => {
  const say = useSay()
  const note = statusNoteOf(booking.status)
  const when = whenKnownOf(booking, salon?.timezone ?? null)

  return (
    <DescriptionList
      items={[
        {
          term: say(words.state),
          description: (
            <>
              <Badge tone={statusToneOf(booking.status)}>
                {say(statusNameOf(booking.status))}
              </Badge>
              {note !== undefined && (
                <Note className={styles['note']} size='small'>
                  {say(note)}
                </Note>
              )}
            </>
          ),
        },
        {
          term: say(words.salon),
          description:
            salon === null ? (
              say(words.noLongerShown)
            ) : (
              <Link href={salonHref}>{salon.name}</Link>
            ),
        },
        {
          term: say(words.service),
          description: serviceName ?? say(words.noLongerShown),
        },
        {
          term: say(words.staff),
          description: staffName ?? say(words.noLongerShown),
        },
        {
          term: say(words.when),
          description: (
            <>
              <span className={styles['whole']}>{say(when.day)}</span>{' '}
              <span className={styles['whole']}>
                {say(
                  words.withDuration(
                    when.hours,
                    formats.durationOf(booking.duration),
                  ),
                )}
              </span>
            </>
          ),
        },
        ...(salon === null
          ? []
          : [
              {
                term: say(words.price),
                description: say(totalOf(booking, salon.currency)),
              },
            ]),
        {
          term: say(words.request),
          description: <WrittenText>{booking.customerRequest}</WrittenText>,
        },
      ]}
    />
  )
}
