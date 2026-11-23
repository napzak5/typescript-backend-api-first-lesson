import {
  FormDialog,
  type FormErrors,
  NO_ERRORS,
  PasswordField,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { securityMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { CODE, PASSWORD } from '../../utils/two-factor-flow'

const { turnOff } = securityMessages

export type TwoFactorStopDialogProps = {
  open: boolean
  onClose: () => void
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with a value, under the name of its control */
  errors?: FormErrors<LocalizedText> | undefined
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
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={say(turnOff.title)}
      description={say(turnOff.description)}
      submitLabel={say(turnOff.submit)}
      submitVariant='danger'
      message={said.message}
      errors={errors}
      pending={pending}
      onSubmit={onStop}
    >
      <PasswordField
        label={say(securityMessages.password.title)}
        name={PASSWORD}
        autoComplete='current-password'
        required
        error={said.errors[PASSWORD]}
      />
      <TextField
        label={say(turnOff.code)}
        name={CODE}
        autoComplete='one-time-code'
        required
        description={say(turnOff.codeDescription)}
        error={said.errors[CODE]}
      />
    </FormDialog>
  )
}
