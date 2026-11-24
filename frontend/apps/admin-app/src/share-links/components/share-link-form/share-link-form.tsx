import {
  Form,
  type FormErrors,
  NO_ERRORS,
  Note,
  PasswordField,
  Select,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminShareLinkMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import {
  DEFAULT_PERIOD,
  MAX_DOWNLOADS,
  PASSWORD,
  PERIOD,
  PERIODS,
} from '../../utils/share-link'

const { form: FORM } = adminShareLinkMessages

export type ShareLinkFormProps = {
  /** The name of the file the link shows */
  filename: string
  /** What went wrong with the attempt as a whole, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with a value, under the name of its control. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The link is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/**
 * The form that issues a share link of a file: how long it works, from
 * the moment it is issued, how often it gives the file, and the password
 * it asks for, if any. The password is one chosen for the link, so the
 * browser is asked to offer a new one.
 */
export const ShareLinkForm = ({
  filename,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: ShareLinkFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form
      submitLabel={say(FORM.submit)}
      message={said.message}
      errors={said.errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <Note>{say(FORM.intro(filename))}</Note>
      <Select
        label={say(FORM.period)}
        name={PERIOD}
        options={PERIODS.map(({ days, label }) => ({
          value: String(days),
          label: say(label),
        }))}
        defaultValue={String(DEFAULT_PERIOD)}
        required
        description={say(FORM.periodDescription)}
        error={said.errors[PERIOD]}
      />
      <TextField
        width='short'
        label={say(FORM.limit)}
        name={MAX_DOWNLOADS}
        inputMode='numeric'
        autoComplete='off'
        description={say(FORM.limitDescription)}
        error={said.errors[MAX_DOWNLOADS]}
      />
      <PasswordField
        label={say(FORM.password)}
        name={PASSWORD}
        autoComplete='new-password'
        description={say(FORM.passwordDescription)}
        error={said.errors[PASSWORD]}
      />
    </Form>
  )
}
