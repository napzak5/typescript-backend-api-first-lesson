import {
  Badge,
  BulletList,
  classNames,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { LineCheck } from '../../api/bookings-api'
import { hoursOf } from '../../utils/booking-format'
import styles from './line-check-note.module.css'

const { check: WORDS } = adminBookingMessages.moves

export type LineCheckNoteProps = {
  check: LineCheck
  /** The time zone of the salon: the overlapping bookings are said on its clock */
  timezone: string
  /** Where the container puts the note */
  className?: string | undefined
}

/**
 * What was found out about the member of the staff of a line: free or
 * taken, with the bookings that overlap the time by their numbers and
 * hours. The numbers are no links: following one would leave the form
 * that is being filled in.
 */
export const LineCheckNote = ({
  check,
  timezone,
  className,
}: LineCheckNoteProps) => {
  const say = useSay()

  return match(check)
    .with({ type: 'unassigned' }, () => (
      <p className={classNames(styles['note'], className)}>
        {say(WORDS.unassigned)}
      </p>
    ))
    .with({ type: 'tooManyRequests' }, { type: 'failed' }, () => (
      <p className={classNames(styles['note'], className)}>
        <Badge tone='warning'>{say(WORDS.unread)}</Badge>
      </p>
    ))
    .with({ type: 'free' }, { type: 'taken' }, ({ type, overlapping }) => (
      <div className={classNames(styles['note'], className)}>
        <p>
          {type === 'taken' ? (
            <Badge tone='danger'>{say(WORDS.taken)}</Badge>
          ) : (
            <Badge tone='success'>{say(WORDS.free)}</Badge>
          )}
          {type === 'free' &&
            overlapping.length > 0 &&
            say(WORDS.withinCapacity)}
        </p>
        {overlapping.length > 0 && (
          <BulletList>
            {overlapping.map((booking) => (
              <li key={booking.id}>
                {say(
                  WORDS.overlapping(
                    booking.bookingNumber,
                    hoursOf(booking, timezone),
                  ),
                )}
              </li>
            ))}
          </BulletList>
        )}
      </div>
    ))
    .exhaustive()
}
