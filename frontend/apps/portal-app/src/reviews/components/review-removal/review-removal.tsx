import { Alert, Button, Dialog } from '@beauty-salon-frontend/ui'

export type ReviewRemovalProps = {
  /** The dialog is open */
  open: boolean
  /** What the review is of, as the dialog names it: 「Beauty Salon Tokyo（2026年11月10日 投稿）」 */
  subject: string
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt to remove; it is said in the dialog */
  message?: string | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** The customer confirmed */
  onRemove: () => void
}

/**
 * The question before a review is removed. A review that was removed is
 * gone for good, with what the salon answered and with those who found it
 * helpful: the dialog names the review and says so, and that the visit can
 * be written about again.
 */
export const ReviewRemoval = ({
  open,
  subject,
  onClose,
  message,
  pending = false,
  onRemove,
}: ReviewRemovalProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    title='レビューを削除しますか？'
    description={`${subject}のレビューを削除します。削除したレビューは、サロンからの返信とともに消え、元に戻せません。この来店のレビューは、もう一度書けます。`}
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
)
