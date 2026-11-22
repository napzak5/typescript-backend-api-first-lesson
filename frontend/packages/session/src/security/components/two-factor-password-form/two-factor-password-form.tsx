import {
  ButtonLink,
  Form,
  type FormErrors,
  NO_ERRORS,
  PasswordField,
} from '@beauty-salon-frontend/ui'
import { PASSWORD } from '../../two-factor-flow'

export type TwoFactorPasswordFormProps = {
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with the password, under the name of its control */
  errors?: FormErrors | undefined
  /** The password is on its way */
  pending?: boolean | undefined
  /** Where the way back leads: the screen of the security of the account */
  cancelHref: string
  /** The value of the control, under its name */
  onSubmit: (values: FormData) => void
}

/**
 * The first step of setting up the second factor: the password, which
 * shows that it is the owner of the account who asks.
 */
export const TwoFactorPasswordForm = ({
  message,
  errors = NO_ERRORS,
  pending,
  cancelHref,
  onSubmit,
}: TwoFactorPasswordFormProps) => (
  <Form
    submitLabel='設定を始める'
    message={message}
    errors={errors}
    pending={pending}
    actions={<ButtonLink href={cancelHref}>やめる</ButtonLink>}
    onSubmit={onSubmit}
  >
    <PasswordField
      label='パスワード'
      name={PASSWORD}
      autoComplete='current-password'
      required
      description='このアカウントのパスワードです。設定するのが、アカウントの持ち主であることを確かめます。'
      error={errors[PASSWORD]}
    />
  </Form>
)
