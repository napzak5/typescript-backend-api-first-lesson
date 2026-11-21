import { Alert, Button, Card } from '@beauty-salon-frontend/ui'
import styles from './account-unlock.module.css'

export type AccountUnlockProps = {
  /** The lifting is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, or why it changed nothing: said above the button */
  message?: string | undefined
  /** The button was pressed */
  onUnlock: () => void
}

/**
 * The lifting of the lock that wrong passwords put on an account, for an
 * administrator. It is done when the button is pressed, without a
 * dialog: it does what the end of the lock does, and changes neither the
 * password nor the devices signed in.
 */
export const AccountUnlock = ({
  pending = false,
  message,
  onUnlock,
}: AccountUnlockProps) => (
  <Card title='ロックの解除'>
    <div className={styles['unlock']}>
      <p>
        解除すると、利用者は、いまのパスワードですぐにログインできます。パスワードの誤りの回数は
        0 に戻ります。パスワードと、ログインしている端末は変わりません。
      </p>
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      <Button variant='primary' pending={pending} onClick={onUnlock}>
        ロックを解除する
      </Button>
    </div>
  </Card>
)
