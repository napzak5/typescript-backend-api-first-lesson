import { Alert, Button, Dialog } from '@beauty-salon-frontend/ui'

export type SignOutEverywhereProps = {
  /** The dialog that asks first is open */
  open: boolean
  /** The button was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt; it is said in the dialog */
  message?: string | undefined
  /** The sign-out is on its way */
  pending?: boolean | undefined
  /** The person confirmed */
  onConfirm: () => void
}

/**
 * The way to sign the account out of every device at once, this one too:
 * for a password that others may know, or a device that was lost. It cannot
 * be taken back, so a dialog asks first.
 */
export const SignOutEverywhere = ({
  open,
  onOpen,
  onClose,
  message,
  pending = false,
  onConfirm,
}: SignOutEverywhereProps) => (
  <>
    <Button variant='danger' onClick={onOpen}>
      すべての端末でサインアウトする
    </Button>
    <Dialog
      open={open}
      onClose={onClose}
      title='すべての端末でサインアウトしますか？'
      description='この端末も含めて、このアカウントでサインインしている端末の、すべてのサインインを終わらせます。続けて使うには、もう一度サインインしてください。'
      actions={
        <>
          <Button onClick={onClose}>戻る</Button>
          <Button variant='danger' pending={pending} onClick={onConfirm}>
            サインアウトする
          </Button>
        </>
      }
    >
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
    </Dialog>
  </>
)
