import {
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  PasswordField,
  TextField,
} from '@beauty-salon-frontend/ui'
import { CODE, PASSWORD } from '../../utils/two-factor-flow'

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
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title='2 要素認証を無効にしますか？'
      description='無効にすると、サインインのときに確かめるのは、パスワードだけになります。アカウントの持ち主であることを、パスワードと、認証アプリのコードかバックアップコードで確かめます。'
      submitLabel='無効にする'
      submitVariant='danger'
      message={message}
      errors={errors}
      pending={pending}
      onSubmit={onStop}
    >
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
    </FormDialog>
  )
}
