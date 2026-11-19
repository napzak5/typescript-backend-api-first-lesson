import { Alert, Button, ButtonLink, Dialog } from '@beauty-salon-frontend/ui'
import styles from './booking-changes.module.css'

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
  when: string
  /** The dialog that asks before the booking is removed is open */
  open: boolean
  /** The button that removes was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt to remove; it is said in the dialog */
  message?: string | undefined
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
}: BookingChangesProps) => (
  <div className={styles['changes']}>
    {moveHref !== undefined && (
      <ButtonLink href={moveHref} variant='secondary'>
        日時と担当を変える
      </ButtonLink>
    )}
    {lineEntryHref !== undefined && (
      <ButtonLink href={lineEntryHref} variant='secondary'>
        施術明細を追加する
      </ButtonLink>
    )}
    <ButtonLink href={notesHref} variant='secondary'>
      要望とメモを変える
    </ButtonLink>
    {removable && (
      <>
        <Button variant='danger' onClick={onOpen}>
          予約を削除する
        </Button>
        <Dialog
          open={open}
          onClose={onClose}
          title='予約を削除しますか？'
          description={`${when}の予約を、施術明細とともに台帳から取り除きます。誤って入れた予約や、重複した予約を取り除くためのものです。行われない予約は、削除せずにキャンセルしてください。削除した予約は、元に戻せません。`}
          actions={
            <>
              <Button onClick={onClose}>戻る</Button>
              <Button variant='danger' pending={pending} onClick={onRemove}>
                削除する
              </Button>
            </>
          }
        >
          {message !== undefined && <Alert tone='danger'>{message}</Alert>}
        </Dialog>
      </>
    )}
  </div>
)
