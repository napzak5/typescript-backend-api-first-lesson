import {
  type FormEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
} from 'react'
import { Alert } from '../alert/alert'
import { Button } from '../button/button'
import { Dialog, type DialogProps } from '../dialog/dialog'
import { type FormErrors, useErrorFocus } from '../form/error-focus'
import styles from './form-dialog.module.css'

export type FormDialogProps = Pick<
  DialogProps,
  'open' | 'onClose' | 'title' | 'description' | 'size'
> & {
  /** The controls, in the order they are filled in */
  children: ReactNode
  /** What the button that sends the form says */
  submitLabel: string
  /**
   * `danger` when what is sent cannot be undone (a cancellation, a voiding):
   * the button says so with its colour too
   */
  tone?: 'primary' | 'danger' | undefined
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /**
   * The errors the controls show: a new object is the answer to another
   * attempt, and the focus goes to the first control that has an error
   */
  errors?: FormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** The values of the controls, under their names */
  onSubmit: (values: FormData) => void
  /**
   * What the form brought, when it is to be read before the dialog closes
   * (the codes that were issued, or that the same was sent before): it
   * takes the place of the form, and 「閉じる」 that of the two buttons
   */
  answer?: ReactNode
}

const NO_ERRORS: FormErrors = {}

/**
 * A question answered with a form: a `Dialog` whose content is the form and
 * whose actions are 「戻る」 and the button that sends it. The button is
 * outside the form element, among the actions of the dialog, and belongs
 * to it through `form`, so the Enter key in a control sends it as well.
 * While an attempt is on its way the form is not sent again, by the button
 * or by the Enter key, and after an attempt the focus is on the first
 * control that has an error.
 *
 * Once there is an answer, the dialog shows it in place of the form, and
 * the focus goes to it in the commit that shows it: the button that sent
 * the form went with the form.
 */
export const FormDialog = ({
  open,
  onClose,
  title,
  description,
  size,
  children,
  submitLabel,
  tone = 'primary',
  message,
  errors = NO_ERRORS,
  pending = false,
  onSubmit,
  answer,
}: FormDialogProps) => {
  const formId = useId()
  const form = useErrorFocus(errors)
  const answerRef = useRef<HTMLDivElement>(null)
  const answered = answer !== undefined

  useLayoutEffect(() => {
    if (answered) {
      answerRef.current?.focus()
    }
  }, [answered])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!pending) {
      onSubmit(new FormData(event.currentTarget))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      // Each button has a key of its own: React would otherwise make the
      // button that goes back the one that closes, and the browser would
      // draw it changing from the one look into the other
      actions={
        answered ? (
          <Button key='close' variant='primary' onClick={onClose}>
            閉じる
          </Button>
        ) : (
          <>
            <Button key='back' onClick={onClose}>
              戻る
            </Button>
            <Button
              key='send'
              type='submit'
              form={formId}
              variant={tone}
              pending={pending}
            >
              {submitLabel}
            </Button>
          </>
        )
      }
    >
      {answered ? (
        <div className={styles['answer']} ref={answerRef} tabIndex={-1}>
          {answer}
        </div>
      ) : (
        // The messages of the controls replace those of the browser
        <form
          className={styles['form']}
          id={formId}
          noValidate
          onSubmit={submit}
          ref={form}
        >
          {message !== undefined && <Alert tone='danger'>{message}</Alert>}
          {children}
        </form>
      )}
    </Dialog>
  )
}
