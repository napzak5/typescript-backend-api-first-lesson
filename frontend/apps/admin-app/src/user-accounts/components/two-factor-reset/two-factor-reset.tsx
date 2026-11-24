import { Alert, Button, Card, Dialog, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminUserAccountMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './two-factor-reset.module.css'

const { reset } = adminUserAccountMessages

export type TwoFactorResetProps = {
  /** The address of the account, which the dialog names */
  email: string
  /** Why the last attempt changed nothing, said above the button */
  refusal?: LocalizedText | undefined
  /** Whether the dialog of the reset is open */
  asking?: boolean | undefined
  /** The reset is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, in the dialog */
  message?: LocalizedText | undefined
  /** The button of the reset was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  /** The reset was confirmed */
  onReset: () => void
}

/**
 * The reset of the second factor of an account, for an administrator,
 * after a dialog: the way back for a user who lost both the authenticator
 * and the backup codes. The dialog says that the administrator makes sure
 * first that the person who asks is the user: nothing else checks it.
 */
export const TwoFactorReset = ({
  email,
  refusal,
  asking = false,
  pending = false,
  message,
  onAsk,
  onClose,
  onReset,
}: TwoFactorResetProps) => {
  const say = useSay()

  return (
    <Card title={say(reset.title)}>
      <div className={styles['reset']}>
        <p>{say(reset.text)}</p>
        {refusal !== undefined && <Alert tone='danger'>{say(refusal)}</Alert>}
        <Button variant='danger' onClick={onAsk}>
          {say(reset.button)}
        </Button>
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title={say(reset.question(email))}
        description={say(reset.warning)}
        actions={
          <>
            <Button onClick={onClose}>{say(reset.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onReset}>
              {say(reset.confirm)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
