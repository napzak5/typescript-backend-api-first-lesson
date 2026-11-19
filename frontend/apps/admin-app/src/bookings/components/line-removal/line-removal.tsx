import { Alert, Button, Dialog } from '@beauty-salon-frontend/ui'
import styles from './line-removal.module.css'

export type LineRemovalProps = {
  /** Why the line stays on the booking; `undefined` when it is taken away */
  why: string | undefined
  /** The line, as the dialog names it: 「カット（10:00〜11:00）」 */
  what: string
  /** The dialog that asks before the line is taken away is open */
  open: boolean
  /** The button that takes the line away was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt; it is said in the dialog */
  message?: string | undefined
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
}: LineRemovalProps) =>
  why === undefined ? (
    <div className={styles['removal']}>
      <p className={styles['said']}>
        明細の担当や開始の時刻は、変えられません。新しい明細を足してから、この明細を外してください。
      </p>
      <Button variant='danger' onClick={onOpen}>
        この明細を外す
      </Button>
      <Dialog
        open={open}
        onClose={onClose}
        title='施術明細を外しますか？'
        description={`${what}を、予約から外します。予約の時刻と金額は、残る明細から算出し直します。外した明細は、元に戻せません。`}
        actions={
          <>
            <Button onClick={onClose}>戻る</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              外す
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      </Dialog>
    </div>
  ) : (
    <p className={styles['said']}>{why}</p>
  )
