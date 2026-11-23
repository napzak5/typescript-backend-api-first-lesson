import { Alert, Button, Dialog, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { portalReviewMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'

const { own: words } = portalReviewMessages

export type ReviewRemovalProps = {
  /** The dialog is open */
  open: boolean
  /** What the review is of, as the dialog names it: 「Beauty Salon Tokyo（2026年11月10日 投稿）」 */
  subject: LocalizedText
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt to remove; it is said in the dialog, in the language of the page */
  message?: LocalizedText | undefined
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
}: ReviewRemovalProps) => {
  const say = useSay()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={say(words.deleteTitle)}
      description={say(words.deleteDescription(subject))}
      actions={
        <>
          <Button onClick={onClose}>{say(uiMessages.back)}</Button>
          <Button variant='danger' pending={pending} onClick={onRemove}>
            {say(words.delete)}
          </Button>
        </>
      }
    >
      {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
    </Dialog>
  )
}
