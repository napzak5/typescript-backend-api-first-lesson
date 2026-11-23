import {
  ButtonLink,
  Form,
  type FormErrors,
  NO_ERRORS,
  PasswordField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { PASSWORD_RULE } from '../../utils/password-rule'
import { CURRENT_PASSWORD, NEW_PASSWORD } from '../../utils/security-flow'

const { password } = securityMessages

export type PasswordChangeFormProps = {
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with a password, under the name of its control */
  errors?: FormErrors<LocalizedText> | undefined
  /** The change is on its way */
  pending?: boolean | undefined
  /** Where the way back leads: the screen of the security of the account */
  cancelHref: string
  /** The values of the two controls, under their names */
  onSubmit: (values: FormData) => void
}

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
}: PasswordChangeFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form
      submitLabel={say(password.change)}
      message={said.message}
      errors={errors}
      pending={pending}
      actions={
        <ButtonLink href={cancelHref}>
          {say(securityMessages.cancel)}
        </ButtonLink>
      }
      onSubmit={onSubmit}
    >
      <PasswordField
        label={say(password.current)}
        name={CURRENT_PASSWORD}
        autoComplete='current-password'
        required
        error={said.errors[CURRENT_PASSWORD]}
      />
      <PasswordField
        label={say(password.new)}
        name={NEW_PASSWORD}
        autoComplete='new-password'
        required
        description={say(PASSWORD_RULE)}
        error={said.errors[NEW_PASSWORD]}
      />
    </Form>
  )
}
