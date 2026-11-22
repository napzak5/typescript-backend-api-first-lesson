import { Badge, BulletList, classNames } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { LineCheck } from '../../api/bookings-api'
import { hoursOf } from '../../utils/booking-format'
import styles from './line-check-note.module.css'

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
}: LineCheckNoteProps) =>
  match(check)
    .with({ type: 'unassigned' }, () => (
      <p className={classNames(styles['note'], className)}>
        担当を決めない明細は、誰の時間も占有しません。
      </p>
    ))
    .with({ type: 'tooManyRequests' }, { type: 'failed' }, () => (
      <p className={classNames(styles['note'], className)}>
        <Badge tone='warning'>空きを確かめられませんでした</Badge>
      </p>
    ))
    .with({ type: 'free' }, { type: 'taken' }, ({ type, overlapping }) => (
      <div className={classNames(styles['note'], className)}>
        <p>
          {type === 'taken' ? (
            <Badge tone='danger'>重なる予約があります</Badge>
          ) : (
            <Badge tone='success'>空いています</Badge>
          )}
          {type === 'free' &&
            overlapping.length > 0 &&
            '（同時に受けられる数の内で、重なる予約があります）'}
        </p>
        {overlapping.length > 0 && (
          <BulletList>
            {overlapping.map((booking) => (
              <li key={booking.id}>
                {`${booking.bookingNumber} ${hoursOf(booking, timezone)}`}
              </li>
            ))}
          </BulletList>
        )}
      </div>
    ))
    .exhaustive()
