import {
  Actions,
  Alert,
  Button,
  ButtonLink,
  Card,
  Dialog,
} from '@beauty-salon-frontend/ui'
import { KEPT_BY_OTHERS } from '../../utils/customer-history'
import styles from './customer-keeping.module.css'

export type CustomerKeepingProps = {
  /** The account may read the history, merge the customer and remove them: the owner, a manager, the operator of the platform */
  keepable: boolean
  /** The name of the customer, as the dialog names them: 「山田 花子」 */
  name: string
  /** The address of the history of the customer */
  historyHref: string
  /** The address of the screen that merges the customer with another record of them */
  mergeHref: string
  /** The dialog that asks before the customer is removed is open */
  open: boolean
  /** The button that removes was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt to remove, and may be tried again; it is said in the dialog */
  message?: string | undefined
  /** Why the customer stays, which another attempt does not change; it is said here */
  refusal?: string | undefined
  /** The removal is on its way */
  pending?: boolean | undefined
  /** The removal was confirmed */
  onRemove: () => void
}

/**
 * What is done with the record of the customer itself: its history is
 * read, another record of the same person is merged into it, and the
 * customer is taken out of the ledger. A dialog asks before the removal,
 * and says what follows; a removed customer can be brought back. A member
 * of the staff is told who does it.
 */
export const CustomerKeeping = ({
  keepable,
  name,
  historyHref,
  mergeHref,
  open,
  onOpen,
  onClose,
  message,
  refusal,
  pending = false,
  onRemove,
}: CustomerKeepingProps) => (
  <Card title='台帳の管理'>
    {keepable ? (
      <div className={styles['keeping']}>
        <p>
          台帳をだれがいつ変えたかを確かめ、同じお客様の 2 つの記録を 1
          つにまとめ、来なくなったお客様を台帳から削除します。
        </p>
        {refusal !== undefined && <Alert tone='danger'>{refusal}</Alert>}
        <Actions>
          <ButtonLink href={historyHref}>変更履歴</ButtonLink>
          <ButtonLink href={mergeHref}>ほかのお客様とまとめる</ButtonLink>
          <Button variant='danger' onClick={onOpen}>
            台帳から削除する
          </Button>
        </Actions>
        <Dialog
          open={open}
          onClose={onClose}
          title={`${name} 様を台帳から削除しますか？`}
          description='顧客台帳と予約で、このお客様を選べなくなります。予約と売上の記録は残ります。削除したあとも、台帳に戻せます。'
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
      </div>
    ) : (
      <p>{KEPT_BY_OTHERS}</p>
    )}
  </Card>
)
