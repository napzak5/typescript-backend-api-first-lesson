import { Alert, Button, Card, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminUserAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './account-unlock.module.css'

const { unlock } = adminUserAccountMessages

export type AccountUnlockProps = {
  /** The lifting is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, or why it changed nothing: said above the button */
  message?: LocalizedText | undefined
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
}: AccountUnlockProps) => {
  const say = useSay()

  return (
    <Card title={say(unlock.title)}>
      <div className={styles['unlock']}>
        <p>{say(unlock.text)}</p>
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
        <Button variant='primary' pending={pending} onClick={onUnlock}>
          {say(unlock.button)}
        </Button>
      </div>
    </Card>
  )
}
