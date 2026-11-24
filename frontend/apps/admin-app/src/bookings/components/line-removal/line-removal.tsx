import { Alert, Button, Dialog, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './line-removal.module.css'

const { removal: WORDS } = adminBookingMessages.moves

export type LineRemovalProps = {
  /** Why the line stays on the booking; `undefined` when it is taken away */
  why: LocalizedText | undefined
  /** The line, as the dialog names it: 「カット（10:00〜11:00）」 */
  what: LocalizedText
  /** The dialog that asks before the line is taken away is open */
  open: boolean
  /** The button that takes the line away was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt; it is said in the dialog, in the language of the page */
  message?: LocalizedText | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** The removal was confirmed */
  onRemove: () => void
}

/**
 * Takes a line away from its booking, after a dialog that asks first: the
 * booking is summed up again from the lines that stay. A line is not
 * changed: another is added, and this one taken away. A line that stays
 * says why instead.
 */
export const LineRemoval = ({
  why,
  what,
  open,
  onOpen,
  onClose,
  message,
  pending = false,
  onRemove,
}: LineRemovalProps) => {
  const say = useSay()

  return why === undefined ? (
    <div className={styles['removal']}>
      <p>{say(WORDS.unchangeable)}</p>
      <Button variant='danger' onClick={onOpen}>
        {say(WORDS.open)}
      </Button>
      <Dialog
        open={open}
        onClose={onClose}
        title={say(WORDS.title)}
        description={say(WORDS.description(what))}
        actions={
          <>
            <Button onClick={onClose}>{say(WORDS.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              {say(WORDS.submit)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </div>
  ) : (
    <p>{say(why)}</p>
  )
}
