import type { ModelsBookingResponse } from '@beauty-salon-frontend/api-client'
import {
  momentNameAt,
  unreadMessageOf,
} from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Card,
  LoadingIndicator,
  UnreadNotice,
} from '@beauty-salon-frontend/ui'
import { match, P } from 'ts-pattern'
import type { TreatmentOfBookingRead } from '../../treatments-api'
import styles from './booking-treatment.module.css'

export type BookingTreatmentProps = {
  booking: Pick<ModelsBookingResponse, 'status'>
  /**
   * The record of the booking; `undefined` while it is on its way. It is
   * read only of a booking whose treatment began
   */
  found: TreatmentOfBookingRead | undefined
  /** The time zone of the salon, which the moment the record was written is shown in */
  timezone: string
  /** The address of a record */
  treatmentHref: (treatmentId: string) => string
  /** The address of the screen that writes the record of the booking */
  entryHref: string
  /** Asks for the record again */
  onRetry: () => void
  retrying: boolean
}

/**
 * The part 「施術記録」 of the page of a booking: the record of its
 * treatment, or the way to write it once the treatment began. A booking
 * has one record at most.
 */
export const BookingTreatment = ({
  booking,
  found,
  timezone,
  treatmentHref,
  entryHref,
  onRetry,
  retrying,
}: BookingTreatmentProps) => (
  <Card title='施術記録'>
    {match(booking.status)
      .with(P.union('in_progress', 'completed'), () =>
        match(found)
          .with(undefined, () => (
            <LoadingIndicator label='施術記録を読み込んでいます' />
          ))
          .with({ type: P.union('tooManyRequests', 'failed') }, (reason) => (
            <UnreadNotice
              message={unreadMessageOf('施術記録', reason)}
              onRetry={onRetry}
              retrying={retrying}
            />
          ))
          .with({ type: 'found', record: null }, () => (
            <div className={styles['part']}>
              <p className={styles['said']}>まだ施術記録を書いていません。</p>
              <p className={styles['said']}>
                <ButtonLink href={entryHref} variant='primary'>
                  施術記録を書く
                </ButtonLink>
              </p>
            </div>
          ))
          .with({ type: 'found', record: P.nonNullable }, ({ record }) => (
            <div className={styles['part']}>
              <p className={styles['said']}>
                {`${momentNameAt(record.createdAt, timezone)}に書いた施術記録があります。`}
              </p>
              <p className={styles['said']}>
                <ButtonLink href={treatmentHref(record.id)} variant='secondary'>
                  施術記録を見る
                </ButtonLink>
              </p>
            </div>
          ))
          .exhaustive(),
      )
      .with(P.union('draft', 'pending', 'confirmed'), () => (
        <p className={styles['said']}>施術を始めると、施術記録を書けます。</p>
      ))
      .with(P.union('cancelled', 'no_show'), () => (
        <p className={styles['said']}>
          施術をしなかった予約には、施術記録はありません。
        </p>
      ))
      .exhaustive()}
  </Card>
)
