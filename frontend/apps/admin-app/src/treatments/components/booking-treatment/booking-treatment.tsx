import { UNREAD_TYPES, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsBookingResponse } from '@beauty-salon-frontend/api-client'
import { momentNameAt } from '@beauty-salon-frontend/salon-screens'
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingIndicator,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match, P } from 'ts-pattern'
import type { TreatmentOfBookingRead } from '../../api/treatments-api'
import styles from './booking-treatment.module.css'

const { booking: WORDS, names } = adminTreatmentMessages

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
}: BookingTreatmentProps) => {
  const say = useSay()

  return (
    <Card title={say(WORDS.title)}>
      {match(booking.status)
        .with(P.union('in_progress', 'completed'), () =>
          match(found)
            .with(undefined, () => (
              <LoadingIndicator label={say(WORDS.loading)} />
            ))
            .with({ type: P.union(...UNREAD_TYPES) }, (reason) => (
              <UnreadNotice
                message={say(unreadMessageOf(names.record, reason))}
                onRetry={onRetry}
                pending={retrying}
              />
            ))
            .with({ type: 'found', record: null }, () => (
              <EmptyState
                kind='part'
                title={say(WORDS.none)}
                actions={
                  <ButtonLink href={entryHref} variant='primary'>
                    {say(WORDS.write)}
                  </ButtonLink>
                }
              />
            ))
            .with({ type: 'found', record: P.nonNullable }, ({ record }) => (
              <div className={styles['part']}>
                <p>
                  {say(
                    WORDS.writtenAt(momentNameAt(record.createdAt, timezone)),
                  )}
                </p>
                <ButtonLink href={treatmentHref(record.id)}>
                  {say(WORDS.view)}
                </ButtonLink>
              </div>
            ))
            .exhaustive(),
        )
        .with(P.union('draft', 'pending', 'confirmed'), () => (
          <p>{say(WORDS.notBegun)}</p>
        ))
        .with(P.union('cancelled', 'no_show'), () => (
          <p>{say(WORDS.notTreated)}</p>
        ))
        .exhaustive()}
    </Card>
  )
}
