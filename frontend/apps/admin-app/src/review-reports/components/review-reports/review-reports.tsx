import { Alert, Button, Card, Dialog } from '@beauty-salon-frontend/ui'
import type { ReactNode, Ref } from 'react'
import styles from './review-reports.module.css'

export type ReviewReportsProps = {
  /** What is shown of the reports: that they are read, that they could not be, that there are none, or their table */
  children: ReactNode
  /** The heading of the part: the focus goes there after a dismissal, where its button was */
  headingRef?: Ref<HTMLHeadingElement> | undefined
  /** Why the last dismissal changed nothing, said above the reports */
  refusal?: string | undefined
  /** When the report the dialog asks to dismiss was received, in words; `undefined` while the dialog is closed */
  asking?: string | undefined
  /** The dismissal is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, in the dialog */
  message?: string | undefined
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
}: ReviewReportsProps) => (
  <Card title='通報' headingRef={headingRef}>
    <div className={styles['reports']}>
      <p>
        お客様とサロンから届いた、このレビューへの通報です。レビューが規則に反していなければ、通報を却下します。反していれば、「レビューの削除」から、レビューを削除します。
      </p>
      {refusal !== undefined && <Alert tone='warning'>{refusal}</Alert>}
      {children}
    </div>
    <Dialog
      open={asking !== undefined}
      onClose={onClose}
      title='通報を却下しますか？'
      description={`${asking ?? ''}に受け付けた通報を却下します。却下した通報は未処理の通報から外れ、レビューは、そのまま掲載されます。却下は、取り消せません。`}
      actions={
        <>
          <Button onClick={onClose}>戻る</Button>
          <Button variant='primary' pending={pending} onClick={onDismiss}>
            却下する
          </Button>
        </>
      }
    >
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
    </Dialog>
  </Card>
)
