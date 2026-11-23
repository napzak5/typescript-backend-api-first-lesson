import {
  Button,
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  TextArea,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSaleMessages } from '@beauty-salon-shared/i18n/messages/admin'
import styles from './sale-void.module.css'

const { void: texts } = adminSaleMessages.changes

export type SaleVoidProps = {
  /**
   * Why the sale is not voided, or not by this account; `undefined` when it
   * is. It is said in place of the button
   */
  why: LocalizedText | undefined
  /** Which sale it is, as the dialog names it: 「売上番号 SL-2KQM-9F4H」 */
  subject: LocalizedText
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
  message?: LocalizedText | undefined
  /** What is wrong with a value, under the name of its control */
  errors?: FormErrors<LocalizedText> | undefined
  /** The voiding is on its way */
  pending?: boolean | undefined
  /** The form of the dialog was sent: `voidReason` */
  onVoid: (values: FormData) => void
}

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
  const say = useSay()
  const said = useSaidForm(message, errors)
  if (why !== undefined) {
    return <p>{say(why)}</p>
  }

  return (
    <div className={styles['void']}>
      <p>{say(texts.explanation)}</p>
      <Button variant='danger' onClick={onOpen}>
        {say(texts.open)}
      </Button>
      <FormDialog
        open={open}
        onClose={onClose}
        title={say(texts.confirm)}
        description={say(texts.description(subject))}
        submitLabel={say(texts.submit)}
        submitVariant='danger'
        message={said.message}
        errors={errors}
        pending={pending}
        onSubmit={onVoid}
      >
        <TextArea
          label={say(texts.reason)}
          name='voidReason'
          required
          description={say(texts.reasonDescription)}
          error={said.errors['voidReason']}
        />
      </FormDialog>
    </div>
  )
}
