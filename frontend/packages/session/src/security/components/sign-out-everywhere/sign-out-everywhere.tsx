import { Alert, Button, Dialog, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import {
  securityMessages,
  uiMessages,
} from '@beauty-salon-shared/i18n/messages/ui'

const { everywhere } = securityMessages

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
  message?: LocalizedText | undefined
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
}: SignOutEverywhereProps) => {
  const say = useSay()

  return (
    <>
      <Button variant='danger' onClick={onOpen}>
        {say(everywhere.button)}
      </Button>
      <Dialog
        open={open}
        onClose={onClose}
        title={say(everywhere.title)}
        description={say(everywhere.description)}
        actions={
          <>
            <Button onClick={onClose}>{say(uiMessages.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onConfirm}>
              {say(everywhere.confirm)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </>
  )
}
