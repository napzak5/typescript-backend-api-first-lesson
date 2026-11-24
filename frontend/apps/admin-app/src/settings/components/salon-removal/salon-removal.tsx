import { Alert, Button, Card, Link, useSay } from '@beauty-salon-frontend/ui'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { SalonRemovalRefusal } from '../../utils/salon-removal'
import styles from './salon-removal.module.css'

const { removal } = adminSettingsMessages

export type SalonRemovalProps = {
  /** The name of the salon */
  name: string
  /** Why the salon was not removed the last time it was asked, or nothing */
  refusal: SalonRemovalRefusal | undefined
  /** The bookings of the salon: where a booking that is not finished is finished */
  bookingsHref: string
  /** Asks whether to remove the salon */
  onRemove: () => void
}

/**
 * The removal of a salon, at the end of its settings: what it does, and
 * the button that asks. Why it was refused is said here, where the button
 * was pressed; bookings that are not finished are said with the way to
 * them.
 */
export const SalonRemoval = ({
  name,
  refusal,
  bookingsHref,
  onRemove,
}: SalonRemovalProps) => {
  const say = useSay()

  return (
    <Card title={say(removal.title)}>
      <div className={styles['removal']}>
        <p>{say(removal.description(name))}</p>
        {match(refusal)
          .with(undefined, () => null)
          .with({ type: 'bookingsUnfinished' }, ({ message }) => (
            <Alert tone='danger'>
              {say(message)}{' '}
              <Link href={bookingsHref}>{say(removal.toBookings)}</Link>
            </Alert>
          ))
          .with({ type: 'forbidden' }, ({ message }) => (
            <Alert tone='danger'>{say(message)}</Alert>
          ))
          .exhaustive()}
        <Button variant='danger' onClick={onRemove}>
          {say(removal.ask)}
        </Button>
      </div>
    </Card>
  )
}
