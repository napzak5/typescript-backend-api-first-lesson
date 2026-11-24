import { Alert, Button, Card, Dialog, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import styles from './review-removal.module.css'

const { removal } = adminReviewReportMessages

export type ReviewRemovalProps = {
  /** What the review is called: its title, or its overall rating */
  name: LocalizedText
  /** Why the last attempt changed nothing, said above the button */
  refusal?: LocalizedText | undefined
  /** Whether the dialog of the removal is open */
  asking?: boolean | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, in the dialog */
  message?: LocalizedText | undefined
  /** The button of the removal was pressed: the dialog opens */
  onAsk: () => void
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  /** The removal was confirmed */
  onRemove: () => void
}

/**
 * The removal of a review that breaks the rules of the platform, for an
 * administrator, after a dialog: its reports go with it, and it is not
 * brought back.
 */
export const ReviewRemoval = ({
  name,
  refusal,
  asking = false,
  pending = false,
  message,
  onAsk,
  onClose,
  onRemove,
}: ReviewRemovalProps) => {
  const say = useSay()

  return (
    <Card title={say(removal.title)}>
      <div className={styles['removal']}>
        <p>{say(removal.explanation)}</p>
        {refusal !== undefined && <Alert tone='danger'>{say(refusal)}</Alert>}
        <Button variant='danger' onClick={onAsk}>
          {say(removal.open)}
        </Button>
      </div>
      <Dialog
        open={asking}
        onClose={onClose}
        title={say(removal.confirm(name))}
        description={say(removal.description)}
        actions={
          <>
            <Button onClick={onClose}>{say(uiMessages.back)}</Button>
            <Button variant='danger' pending={pending} onClick={onRemove}>
              {say(removal.submit)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
