import {
  Alert,
  Button,
  Dialog,
  type FormErrors,
  PasswordField,
  TextField,
  useErrorFocus,
} from '@beauty-salon-frontend/ui'
import { type FormEvent, useId } from 'react'
import { CODE, PASSWORD } from '../../two-factor-flow'
import styles from './two-factor-stop-dialog.module.css'

export type TwoFactorStopDialogProps = {
  open: boolean
  onClose: () => void
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with a value, under the name of its control */
  errors?: FormErrors | undefined
  /** The request is on its way */
  pending?: boolean | undefined
  /** The values of the two controls, under their names */
  onStop: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * Turns the second factor off, after the password and a code: a session
 * alone does not change how the account is kept.
 */
export const TwoFactorStopDialog = ({
  open,
  onClose,
  message,
  errors = NO_ERRORS,
  pending = false,
  onStop,
}: TwoFactorStopDialogProps) => {
  const formId = useId()
  const form = useErrorFocus(errors)

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!pending) {
      onStop(new FormData(event.currentTarget))
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title='2 要素認証を無効にしますか？'
      description='無効にすると、サインインのときに確かめるのは、パスワードだけになります。アカウントの持ち主であることを、パスワードと、認証アプリのコードかバックアップコードで確かめます。'
      actions={
        <>
          <Button onClick={onClose}>戻る</Button>
          <Button
            type='submit'
            form={formId}
            variant='danger'
            pending={pending}
          >
            無効にする
          </Button>
        </>
      }
    >
      <form
        className={styles['form']}
        id={formId}
        noValidate
        onSubmit={submit}
        ref={form}
      >
        {message !== undefined && <Alert tone='danger'>{message}</Alert>}
        <PasswordField
          label='パスワード'
          name={PASSWORD}
          autoComplete='current-password'
          required
          error={errors[PASSWORD]}
        />
        <TextField
          label='認証アプリのコードかバックアップコード'
          name={CODE}
          autoComplete='one-time-code'
          required
          description='認証アプリに表示されている 6 桁のコードか、まだ使っていないバックアップコードです。'
          error={errors[CODE]}
        />
      </form>
    </Dialog>
  )
}
