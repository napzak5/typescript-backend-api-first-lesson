import {
  ButtonLink,
  Form,
  type FormErrors,
  PasswordField,
} from '@beauty-salon-frontend/ui'
import { PASSWORD_RULE } from '../../password-rule'
import { CURRENT_PASSWORD, NEW_PASSWORD } from '../../security-flow'

export type PasswordChangeFormProps = {
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with a password, under the name of its control */
  errors?: FormErrors | undefined
  /** The change is on its way */
  pending?: boolean | undefined
  /** Where the way back leads: the screen of the security of the account */
  cancelHref: string
  /** The values of the two controls, under their names */
  onSubmit: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * The form that changes the password: the current one, which shows that it
 * is the owner who asks, and the new one with the rule it has to keep. The
 * new password is asked for once: either can be shown as it was typed, and
 * pasted from a password manager.
 */
export const PasswordChangeForm = ({
  message,
  errors = NO_ERRORS,
  pending,
  cancelHref,
  onSubmit,
}: PasswordChangeFormProps) => (
  <Form
    submitLabel='パスワードを変更する'
    message={message}
    errors={errors}
    pending={pending}
    actions={<ButtonLink href={cancelHref}>やめる</ButtonLink>}
    onSubmit={onSubmit}
  >
    <PasswordField
      label='現在のパスワード'
      name={CURRENT_PASSWORD}
      autoComplete='current-password'
      required
      error={errors[CURRENT_PASSWORD]}
    />
    <PasswordField
      label='新しいパスワード'
      name={NEW_PASSWORD}
      autoComplete='new-password'
      required
      description={PASSWORD_RULE}
      error={errors[NEW_PASSWORD]}
    />
  </Form>
)
