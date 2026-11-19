import type {
  ModelsCustomerBookingResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import { Badge, DescriptionList, Link } from '@beauty-salon-frontend/ui'
import { durationOf } from '../../../salons/salon-format'
import {
  statusNameOf,
  statusNoteOf,
  statusToneOf,
  totalOf,
  whenOf,
} from '../../booking-format'
import styles from './booking-summary.module.css'

export type BookingSummaryProps = {
  booking: ModelsCustomerBookingResponse
  /**
   * The salon of the booking: its name, the time zone its times are read
   * in and the currency of its amounts
   */
  salon: Pick<ModelsSalonResponse, 'name' | 'timezone' | 'currency'>
  /** The address of the page of the salon */
  salonHref: string
  /** The name of the service; `null` when the salon no longer shows it */
  serviceName: string | null
  /** The name of the member of the staff; `null` when the salon no longer shows them */
  staffName: string | null
}

/** What stands where a name would, when the salon no longer shows what is named */
const NO_LONGER_SHOWN = '（掲載を終えています）'

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
  const note = statusNoteOf(booking.status)
  const when = whenOf(booking, salon.timezone)

  return (
    <DescriptionList
      items={[
        {
          term: '状態',
          description: (
            <>
              <Badge tone={statusToneOf(booking.status)}>
                {statusNameOf(booking.status)}
              </Badge>
              {note !== undefined && <p className={styles['note']}>{note}</p>}
            </>
          ),
        },
        {
          term: 'サロン',
          description: <Link href={salonHref}>{salon.name}</Link>,
        },
        { term: 'メニュー', description: serviceName ?? NO_LONGER_SHOWN },
        { term: '担当', description: staffName ?? NO_LONGER_SHOWN },
        {
          term: '日時',
          description: (
            <>
              <span className={styles['whole']}>{when.day}</span>{' '}
              <span className={styles['whole']}>
                {when.hours}（{durationOf(booking.duration)}）
              </span>
            </>
          ),
        },
        { term: '料金', description: totalOf(booking, salon.currency) },
        {
          term: 'ご要望',
          description:
            booking.customerRequest === null ? (
              'なし'
            ) : (
              <p className={styles['request']}>{booking.customerRequest}</p>
            ),
        },
      ]}
    />
  )
}
