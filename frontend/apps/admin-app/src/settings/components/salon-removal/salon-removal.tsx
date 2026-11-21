import { Alert, Button, Card, Link } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import type { SalonRemovalRefusal } from '../../salon-removal'
import styles from './salon-removal.module.css'

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
}: SalonRemovalProps) => (
  <Card title='サロンの削除'>
    <div className={styles['removal']}>
      <p className={styles['text']}>
        {`サロン「${name}」を削除すると、サロンの一覧とお客様の画面から消え、スタッフはこのサロンの画面を使えなくなります。削除したサロンは、元に戻せません。終わっていない予約があるあいだは、削除できません。`}
      </p>
      {match(refusal)
        .with(undefined, () => null)
        .with({ type: 'bookingsUnfinished' }, ({ message }) => (
          <Alert tone='danger'>
            {message} <Link href={bookingsHref}>予約台帳を開く</Link>
          </Alert>
        ))
        .with({ type: 'forbidden' }, ({ message }) => (
          <Alert tone='danger'>{message}</Alert>
        ))
        .exhaustive()}
      <p className={styles['text']}>
        <Button variant='danger' onClick={onRemove}>
          サロンを削除する
        </Button>
      </p>
    </div>
  </Card>
)
