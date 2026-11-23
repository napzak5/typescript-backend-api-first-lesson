import type { ModelsCustomerBookingResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  COUNTED,
  countOf,
  Link,
  type More,
  PagedList,
  useSay,
} from '@beauty-salon-frontend/ui'
import { portalBookingMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { useId } from 'react'
import {
  statusNameOf,
  statusToneOf,
  whenKnownOf,
} from '../../utils/booking-format'
import type { Row } from '../../utils/own-bookings'
import styles from './booking-list.module.css'

export type BookingListProps = {
  /** What the list is: 「これからの予約」 */
  title: string
  /** The bookings that were read so far, the earliest visit first; at least one */
  rows: readonly Row[]
  /** How many bookings the list has; `null` when the API did not count them */
  total: number | null
  /**
   * What comes after the bookings: nothing (`none`), a page that can be
   * asked for (`available`), one that is on its way (`loading`), or one
   * that was asked for and did not come (`failed`)
   */
  more: More
  /** Asks for the bookings that come next */
  onMore: () => void
  /** The address of the page of a booking */
  bookingHref: (booking: ModelsCustomerBookingResponse) => string
}

const { list: words } = portalBookingMessages

/**
 * The bookings of a customer: when each is, where, what, and where it
 * stands. The time of a booking is the link to its page, and takes the
 * focus when 「さらに表示」 added the booking.
 */
export const BookingList = ({
  title,
  rows,
  total,
  more,
  onMore,
  bookingHref,
}: BookingListProps) => {
  const say = useSay()
  const headingId = useId()

  return (
    <section className={styles['list']} aria-labelledby={headingId}>
      <h2 className={styles['heading']} id={headingId}>
        {title}
      </h2>
      <PagedList
        items={rows}
        itemKey={({ booking }) => booking.id}
        count={say(countOf(total, rows.length, COUNTED.items, words.count))}
        more={more}
        onMore={onMore}
      >
        {({ booking, salon, serviceName }) => {
          const when = whenKnownOf(booking, salon?.timezone ?? null)

          return (
            <>
              <h3 className={styles['when']}>
                <Link href={bookingHref(booking)}>
                  <span className={styles['whole']}>{say(when.day)}</span>
                  {when.hours !== null && (
                    <>
                      {' '}
                      <span className={styles['whole']}>{say(when.hours)}</span>
                    </>
                  )}
                </Link>
              </h3>
              <p>{salon?.name ?? say(words.noSalon)}</p>
              <p>{serviceName ?? say(words.noService)}</p>
              <p>
                <Badge tone={statusToneOf(booking.status)}>
                  {say(statusNameOf(booking.status))}
                </Badge>
              </p>
            </>
          )
        }}
      </PagedList>
    </section>
  )
}
