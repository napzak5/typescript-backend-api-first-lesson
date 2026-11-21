import {
  Button,
  FormDialog,
  type FormErrors,
  TextArea,
} from '@beauty-salon-frontend/ui'
import styles from './sale-void.module.css'

export type SaleVoidProps = {
  /**
   * Why the sale is not voided, or not by this account; `undefined` when it
   * is. It is said in place of the button
   */
  why: string | undefined
  /** Which sale it is, as the dialog names it: 「売上番号 SL-2KQM-9F4H」 */
  subject: string
  /** The dialog that asks why is open */
  open: boolean
  /** The button that voids was pressed: the dialog is to be opened */
  onOpen: () => void
  /**
   * The dialog has closed, or its button that changes nothing was pressed.
   * Set `open` to false here
   */
  onClose: () => void
  /** What went wrong with the attempt as a whole; it is said in the dialog */
  message?: string | undefined
  /** What is wrong with a value, under the name of its control */
  errors?: FormErrors | undefined
  /** The voiding is on its way */
  pending?: boolean | undefined
  /** The form of the dialog was sent: `voidReason` */
  onVoid: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * The voiding of a sale that should not count: one entered by mistake, or
 * one whose payments were given back to be paid again. A voided sale stays
 * in the ledger, and says why it was voided, so the dialog asks for that
 * before anything is sent; the booking it billed can be billed again.
 */
export const SaleVoid = ({
  why,
  subject,
  open,
  onOpen,
  onClose,
  message,
  errors = NO_ERRORS,
  pending = false,
  onVoid,
}: SaleVoidProps) => {
  if (why !== undefined) {
    return <p className={styles['why']}>{why}</p>
  }

  return (
    <div className={styles['void']}>
      <p className={styles['why']}>
        誤って入れた売上や、支払いを全額返金して払い直す売上を、取り消します。
      </p>
      <p>
        <Button variant='danger' onClick={onOpen}>
          売上を取り消す
        </Button>
      </p>
      <FormDialog
        open={open}
        onClose={onClose}
        title='売上を取り消しますか？'
        description={`${subject}を取り消します。取り消した売上は、取り消しの記録として売上台帳に残り、直すことも支払いを受けることもできません。予約の会計は、入れ直せます。取り消しは、元に戻せません。`}
        submitLabel='取り消す'
        tone='danger'
        message={message}
        errors={errors}
        pending={pending}
        onSubmit={onVoid}
      >
        <TextArea
          label='取り消しの理由'
          name='voidReason'
          rows={3}
          required
          description='取り消した売上に残ります。あとで見る人に分かるように書きます。'
          error={errors['voidReason']}
        />
      </FormDialog>
    </div>
  )
}
