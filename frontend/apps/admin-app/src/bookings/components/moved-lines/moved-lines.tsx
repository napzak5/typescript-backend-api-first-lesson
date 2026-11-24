import type { ModelsBookingServiceResponse } from '@beauty-salon-frontend/api-client'
import { useSay } from '@beauty-salon-frontend/ui'
import {
  adminBookingMessages,
  adminMenuMessages,
} from '@beauty-salon-shared/i18n/messages/admin'
import type { LineCheck } from '../../api/bookings-api'
import { hoursOf } from '../../utils/booking-format'
import {
  memberNameOf,
  type Names,
  serviceNameOf,
} from '../../utils/day-bookings'
import { LineCheckNote } from '../line-check-note/line-check-note'
import styles from './moved-lines.module.css'

const { move: WORDS } = adminBookingMessages.moves

export type MovedLinesProps = {
  /** The lines as the move would leave them, in their order */
  lines: readonly ModelsBookingServiceResponse[]
  staff: Names['staff']
  services: Names['services']
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** What was found out about the member of each line where it would be; `undefined` while nothing is */
  checks?: readonly LineCheck[] | undefined
}

/**
 * The lines of a booking where a move would put them: each with its
 * service, who does it and its hours, and, after the API refused the move,
 * what was found out about its member.
 */
export const MovedLines = ({
  lines,
  staff,
  services,
  timezone,
  checks,
}: MovedLinesProps) => {
  const say = useSay()

  return (
    <ol className={styles['lines']}>
      {lines.map((line, index) => {
        const check = checks?.[index]

        return (
          <li key={line.id} className={styles['line']}>
            <p className={styles['service']}>
              {say(
                WORDS.movedLine(
                  index + 1,
                  serviceNameOf(line.serviceId, services) ??
                    say(adminMenuMessages.removedService),
                ),
              )}
            </p>
            <p>
              {say(
                WORDS.movedHours(
                  hoursOf(line, timezone),
                  memberNameOf(line.staffId, staff),
                ),
              )}
            </p>
            {check !== undefined && (
              <LineCheckNote
                check={check}
                timezone={timezone}
                className={styles['check']}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
