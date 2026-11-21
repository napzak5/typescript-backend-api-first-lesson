import type { ModelsCustomerBookingResponse } from '@beauty-salon-frontend/api-client'
import { Alert, Badge, Button, Link, Note } from '@beauty-salon-frontend/ui'
import { useId, useLayoutEffect, useRef } from 'react'
import type { More } from '../../../salons/pages'
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

const countOf = (total: number | null, shown: number): string => {
  if (total === null) {
    return `${shown} 件を表示しています`
  }

  return shown < total
    ? `${total} 件の予約があります（${shown} 件を表示しています）`
    : `${total} 件の予約があります`
}

/**
 * The bookings of a customer: when each is, where, what, and where it
 * stands. The time of a booking is the link to its page. When its button
 * adds bookings to the list, the focus moves to the first of them: whoever
 * pressed 「さらに表示」 goes on reading where the new ones begin. Bookings
 * that nobody asked for (those whose names arrive later, those of a list
 * that was read again) leave the focus where it is.
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
  const list = useRef<HTMLUListElement>(null)
  const shown = useRef(rows.length)
  // Whether the button was pressed and what it asked for is yet to be shown
  const asked = useRef(false)

  // In the commit that shows the added bookings, before they are painted
  useLayoutEffect(() => {
    if (asked.current && rows.length > shown.current) {
      list.current?.children
        .item(shown.current)
        ?.querySelector<HTMLAnchorElement>('a')
        ?.focus()
      asked.current = false
    }
    shown.current = rows.length
  }, [rows.length])

  const askForMore = (): void => {
    asked.current = true
    onMore()
  }

  return (
    <section className={styles['list']} aria-labelledby={headingId}>
      <h2 className={styles['heading']} id={headingId}>
        {title}
      </h2>
      <Note role='status'>{countOf(total, rows.length)}</Note>
      <ul className={styles['bookings']} ref={list}>
        {rows.map(({ booking, salon, serviceName }) => {
          const when = whenKnownOf(booking, salon?.timezone ?? null)

          return (
            <li key={booking.id} className={styles['booking']}>
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
            </li>
          )
        })}
      </ul>
      {more === 'failed' && (
        <Alert tone='danger'>
          続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。
        </Alert>
      )}
      {more !== 'none' && (
        <Button onClick={askForMore} pending={more === 'loading'}>
          {more === 'failed' ? 'もう一度読み込む' : 'さらに表示'}
        </Button>
      )}
    </section>
  )
}
