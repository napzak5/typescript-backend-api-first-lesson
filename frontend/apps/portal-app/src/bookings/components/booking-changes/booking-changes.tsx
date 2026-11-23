import {
  Button,
  ButtonLink,
  FormDialog,
  Note,
  TextArea,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalBookingMessages } from '@beauty-salon-shared/i18n/messages/portal'
import styles from './booking-changes.module.css'

const { changes: words } = portalBookingMessages

export type BookingChangesProps = {
  /**
   * The address of the screen that moves the booking; `undefined` for a
   * booking that only the salon can move, which is said in its place
   */
  moveHref?: string | undefined
  /** When the booking is, as the dialog names it: 「2026年11月24日火曜日 10:30〜11:30」 */
  when: LocalizedText
  /** The dialog that asks before the booking is cancelled is open */
  open: boolean
  /** The button that cancels was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt to cancel; it is said in the dialog */
  message?: LocalizedText | undefined
  /** The cancellation is on its way */
  pending?: boolean | undefined
  /** The customer confirmed, and gave this reason (`cancellationReason`) */
  onCancel: (values: FormData) => void
}

/**
 * What a customer can still do with a booking: move it to another time, on
 * a screen of its own, or cancel it. A booking that was cancelled stays
 * cancelled, so a dialog asks first, and takes the reason if there is one
 * to give.
 */
export const BookingChanges = ({
  moveHref,
  when,
  open,
  onOpen,
  onClose,
  message,
  pending = false,
  onCancel,
}: BookingChangesProps) => {
  const say = useSay()

  return (
    <div className={styles['changes']}>
      {moveHref === undefined ? (
        <Note className={styles['note']}>{say(words.askTheSalon)}</Note>
      ) : (
        <ButtonLink href={moveHref}>{say(words.move)}</ButtonLink>
      )}
      <Button variant='danger' onClick={onOpen}>
        {say(words.cancel)}
      </Button>
      <FormDialog
        open={open}
        onClose={onClose}
        title={say(words.cancelTitle)}
        description={say(words.cancelDescription(when))}
        submitLabel={say(words.confirmCancel)}
        submitVariant='danger'
        message={message === undefined ? undefined : say(message)}
        pending={pending}
        onSubmit={onCancel}
      >
        <TextArea
          label={say(words.reason)}
          name='cancellationReason'
          rows={4}
          description={say(words.reasonDescription)}
        />
      </FormDialog>
    </div>
  )
}
