import { Alert, Button, Card, Dialog } from '@beauty-salon-frontend/ui'
import styles from './review-removal.module.css'

export type ReviewRemovalProps = {
  /** What the review is called: its title, or its overall rating */
  name: string
  /** Why the last attempt changed nothing, said above the button */
  refusal?: string | undefined
  /** Whether the dialog of the removal is open */
  asking?: boolean | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** What went wrong with the last attempt, in the dialog */
  message?: string | undefined
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
}: ReviewRemovalProps) => (
  <Card title='レビューの削除'>
    <div className={styles['removal']}>
      <p className={styles['text']}>
        規則に反するレビューを削除します。削除すると、お客様の画面とサロンの画面から消え、このレビューへの通報も消えます。削除したレビューは、元に戻せません。
      </p>
      {refusal !== undefined && <Alert tone='danger'>{refusal}</Alert>}
      <p className={styles['text']}>
        <Button variant='danger' onClick={onAsk}>
          レビューを削除する
        </Button>
      </p>
    </div>
    <Dialog
      open={asking}
      onClose={onClose}
      title={`「${name}」を削除しますか？`}
      description='削除したレビューは、元に戻せません。このレビューへの通報も、一緒に消えます。'
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
  </Card>
)
