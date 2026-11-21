import {
  Button,
  ButtonLink,
  FormDialog,
  TextArea,
} from '@beauty-salon-frontend/ui'
import styles from './booking-changes.module.css'

export type BookingChangesProps = {
  /**
   * The address of the screen that moves the booking; `undefined` for a
   * booking that only the salon can move, which is said in its place
   */
  moveHref?: string | undefined
  /** When the booking is, as the dialog names it: 「2026年11月24日火曜日 10:30〜11:30」 */
  when: string
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
  message?: string | undefined
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
  return (
    <div className={styles['changes']}>
      {moveHref === undefined ? (
        <p className={styles['note']}>
          この予約の日時の変更は、サロンにお問い合わせください。
        </p>
      ) : (
        <ButtonLink href={moveHref} variant='secondary'>
          日時を変更する
        </ButtonLink>
      )}
      <Button variant='danger' onClick={onOpen}>
        予約をキャンセルする
      </Button>
      <FormDialog
        open={open}
        onClose={onClose}
        title='予約をキャンセルしますか？'
        description={`${when}の予約をキャンセルします。キャンセルした予約は、元に戻せません。`}
        submitLabel='キャンセルを確定する'
        tone='danger'
        message={message}
        pending={pending}
        onSubmit={onCancel}
      >
        <TextArea
          label='キャンセルの理由'
          name='cancellationReason'
          description='サロンに伝えたいことがあれば、ご記入ください。空欄のままでも、キャンセルできます。'
        />
      </FormDialog>
    </div>
  )
}
