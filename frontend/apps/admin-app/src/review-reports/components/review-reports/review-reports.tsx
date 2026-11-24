import { Alert, Button, Card, Dialog, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminReviewReportMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { uiMessages } from '@beauty-salon-shared/i18n/messages/ui'
import type { ReactNode, Ref } from 'react'
import styles from './review-reports.module.css'

const { dismissal, ofReview } = adminReviewReportMessages

export type ReviewReportsProps = {
  /** What is shown of the reports: that they are read, that they could not be, that there are none, or their table */
  children: ReactNode
  /** The heading of the part: the focus goes there after a dismissal, where its button was */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** Why the last dismissal changed nothing, said above the reports */
  refusal?: LocalizedText | undefined
  /** When the report the dialog asks to dismiss was received, in words; `undefined` while the dialog is closed */
  asking?: LocalizedText | undefined
  /** The dismissal is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, in the dialog */
  message?: LocalizedText | undefined
  /** The dialog has closed, or its button that changes nothing was pressed */
  onClose: () => void
  /** The dismissal was confirmed */
  onDismiss: () => void
}

/**
 * The reports of a review, for an administrator: those that wait are
 * dismissed when the review breaks no rule, after a dialog, since a
 * dismissal is not undone. A review that breaks one is removed instead.
 */
export const ReviewReports = ({
  children,
  headingRef,
  refusal,
  asking,
  pending = false,
  message,
  onClose,
  onDismiss,
}: ReviewReportsProps) => {
  const say = useSay()

  return (
    <Card title={say(ofReview.title)} headingRef={headingRef}>
      <div className={styles['reports']}>
        <p>{say(ofReview.explanation)}</p>
        {refusal !== undefined && <Alert tone='warning'>{say(refusal)}</Alert>}
        {children}
      </div>
      <Dialog
        open={asking !== undefined}
        onClose={onClose}
        title={say(dismissal.confirm)}
        description={
          asking === undefined ? undefined : say(dismissal.description(asking))
        }
        actions={
          <>
            <Button onClick={onClose}>{say(uiMessages.back)}</Button>
            <Button variant='primary' pending={pending} onClick={onDismiss}>
              {say(dismissal.submit)}
            </Button>
          </>
        }
      >
        {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      </Dialog>
    </Card>
  )
}
