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
import { PASSWORD } from '../../utils/two-factor-flow'

const { twoFactor } = securityMessages

export type TwoFactorPasswordFormProps = {
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with the password, under the name of its control */
  errors?: FormErrors<LocalizedText> | undefined
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
}: TwoFactorPasswordFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form
      submitLabel={say(twoFactor.begin)}
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
        label={say(securityMessages.password.title)}
        name={PASSWORD}
        autoComplete='current-password'
        required
        description={say(twoFactor.passwordDescription)}
        error={said.errors[PASSWORD]}
      />
    </Form>
  )
}
