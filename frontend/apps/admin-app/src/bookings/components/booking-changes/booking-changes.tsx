import {
  Alert,
  Button,
  ButtonLink,
  Dialog,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './booking-changes.module.css'

const { changes: WORDS } = adminBookingMessages.details

export type BookingChangesProps = {
  /** The address of the screen that moves the booking; `undefined` when it is not moved in its state */
  moveHref?: string | undefined
  /** The address of the screen that adds a line; `undefined` when the booking takes none */
  lineEntryHref?: string | undefined
  /** The address of the screen that changes what the salon wrote down on the booking */
  notesHref: string
  /** The account may remove a booking: the owner, a manager, the operator of the platform */
  removable: boolean
  /** When the booking is, as the dialog names it: 「2026年11月20日（金） 10:00〜11:00」 */
  when: LocalizedText
  /** The dialog that asks before the booking is removed is open */
  open: boolean
  /** The button that removes was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt to remove; it is said in the dialog, in the language of the page */
  message?: LocalizedText | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** The removal was confirmed */
  onRemove: () => void
}

/**
 * What the salon can do with a booking beside its state: move it, add a
 * line to it, change what it wrote down, each on a screen of its own, and
 * remove a booking that should not be in the ledger. A removed booking is
 * gone, so a dialog asks first, and says what a removal is for; a member of
 * the staff cancels instead.
 */
export const BookingChanges = ({
  moveHref,
  lineEntryHref,
  notesHref,
  removable,
  when,
  open,
  onOpen,
  onClose,
  message,
  pending = false,
  onRemove,
}: BookingChangesProps) => {
  const say = useSay()

  return (
    <div className={styles['changes']}>
      {moveHref !== undefined && (
        <ButtonLink href={moveHref}>{say(WORDS.move)}</ButtonLink>
      )}
      {lineEntryHref !== undefined && (
        <ButtonLink href={lineEntryHref}>{say(WORDS.addLine)}</ButtonLink>
      )}
      <ButtonLink href={notesHref}>{say(WORDS.changeNotes)}</ButtonLink>
      {removable && (
        <>
          <Button variant='danger' onClick={onOpen}>
            {say(WORDS.remove)}
          </Button>
          <Dialog
            open={open}
            onClose={onClose}
            title={say(WORDS.removal.title)}
            description={say(WORDS.removal.description(when))}
            actions={
              <>
                <Button onClick={onClose}>{say(WORDS.removal.back)}</Button>
                <Button variant='danger' pending={pending} onClick={onRemove}>
                  {say(WORDS.removal.submit)}
                </Button>
              </>
            }
          >
            {message !== undefined && (
              <Alert tone='danger'>{say(message)}</Alert>
            )}
          </Dialog>
        </>
      )}
    </div>
  )
}
