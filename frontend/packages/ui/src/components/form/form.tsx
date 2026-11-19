import type { FormEvent, ReactNode } from 'react'
import { Alert } from '../alert/alert'
import { Button } from '../button/button'
import { type FormErrors, useErrorFocus } from './error-focus'
import styles from './form.module.css'

export type FormProps = {
  /** The controls, in the order they are filled in */
  children: ReactNode
  /** What the button that sends the form says */
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /**
   * The errors the controls show. The form shows none of them itself: a
   * control is given its own. A new object is the answer to another attempt,
   * also when it says the same, and the focus goes to the first control that
   * has an error
   */
  errors?: FormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  /** The values of the controls, under their names */
  onSubmit: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * A form that is sent to the API: its controls in one column, what went
 * wrong with the attempt above them, and the button below. It keeps no
 * state. The browser keeps the values, and the form hands them over when it
 * is sent, once: while an attempt is on its way it is not sent again.
 *
 * The form changes without a page load, so it says itself where to go on:
 * after an attempt the focus is on the first control that has an error. It
 * is moved in the commit that shows the errors, before the browser paints
 * them.
 */
export const Form = ({
  children,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending = false,
  actions,
  onSubmit,
}: FormProps) => {
  const form = useErrorFocus(errors)

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    // The button ignores a press while an attempt is on its way. A form can
    // also be sent without one: by the Enter key, or by a script
    if (!pending) {
      onSubmit(new FormData(event.currentTarget))
    }
  }

  return (
    // The messages of the fields replace those of the browser, which are
    // shown one at a time and not to everyone
    <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      {children}
      <div className={styles['actions']}>
        <Button type='submit' variant='primary' pending={pending}>
          {submitLabel}
        </Button>
        {actions}
      </div>
    </form>
  )
}
