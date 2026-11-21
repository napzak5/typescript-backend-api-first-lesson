import { Alert, Button, Card, Dialog } from '@beauty-salon-frontend/ui'
import styles from './two-factor-reset.module.css'

export type TwoFactorResetProps = {
  /** The address of the account, which the dialog names */
  email: string
  /** Why the last attempt changed nothing, said above the button */
  refusal?: string | undefined
  /** Whether the dialog of the reset is open */
  asking?: boolean | undefined
  /** The reset is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, in the dialog */
  message?: string | undefined
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
}: TwoFactorResetProps) => (
  <Card title='2 要素認証のリセット'>
    <div className={styles['reset']}>
      <p>
        認証アプリとバックアップコードの両方をなくした利用者のための操作です。リセットすると、利用者は、パスワードだけでログインし、2
        要素認証を設定し直します。
      </p>
      {refusal !== undefined && <Alert tone='danger'>{refusal}</Alert>}
      <Button variant='danger' onClick={onAsk}>
        2 要素認証をリセットする
      </Button>
    </div>
    <Dialog
      open={asking}
      onClose={onClose}
      title={`${email} の 2 要素認証をリセットしますか？`}
      description='依頼した人が、このアカウントの利用者本人であることを、サポートの手続きで確かめてから行ってください。システムは確かめません。リセットすると、認証アプリのコードもバックアップコードも使えなくなります。利用者には、メールで知らせます。ログインしている端末は、そのまま使えます。'
      actions={
        <>
          <Button onClick={onClose}>戻る</Button>
          <Button variant='danger' pending={pending} onClick={onReset}>
            リセットする
          </Button>
        </>
      }
    >
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
    </Dialog>
  </Card>
)
