import type { ModelsCustomerBookingResponse } from '@beauty-salon-frontend/api-client'
import {
  Badge,
  countOf,
  Link,
  type More,
  PagedList,
} from '@beauty-salon-frontend/ui'
import { useId } from 'react'
import { statusNameOf, statusToneOf, whenKnownOf } from '../../booking-format'
import type { Row } from '../../own-bookings'
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

/** What stands where a name would, when what is named is no longer there */
const NO_SALON = 'サロン（掲載を終えています）'
const NO_SERVICE = 'メニュー（掲載を終えています）'

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
  const headingId = useId()

  return (
    <section className={styles['list']} aria-labelledby={headingId}>
      <h2 className={styles['heading']} id={headingId}>
        {title}
      </h2>
      <PagedList
        items={rows}
        itemKey={({ booking }) => booking.id}
        count={countOf(
          total,
          rows.length,
          '件',
          (count) => `${count} 件の予約があります`,
        )}
        more={more}
        onMore={onMore}
      >
        {({ booking, salon, serviceName }) => {
          const when = whenKnownOf(booking, salon?.timezone ?? null)

          return (
            <>
              <h3 className={styles['when']}>
                <Link href={bookingHref(booking)}>
                  <span className={styles['whole']}>{when.day}</span>
                  {when.hours !== null && (
                    <>
                      {' '}
                      <span className={styles['whole']}>{when.hours}</span>
                    </>
                  )}
                </Link>
              </h3>
              <p>{salon?.name ?? NO_SALON}</p>
              <p>{serviceName ?? NO_SERVICE}</p>
              <p>
                <Badge tone={statusToneOf(booking.status)}>
                  {statusNameOf(booking.status)}
                </Badge>
              </p>
            </>
          )
        }}
      </PagedList>
    </section>
  )
}
