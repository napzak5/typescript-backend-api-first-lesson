import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminProfileMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { IntroductionFields } from '../../../staff/components/introduction-fields/introduction-fields'

const { form: FORM } = adminProfileMessages

export type ProfileFormProps = Pick<FormProps, 'pending' | 'onSubmit'> & {
  /** The profile the form opens with */
  profile: ModelsStaffProfileResponse
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
}

/**
 * What a member writes of themselves for the customers: the same controls
 * as the introduction in the staff ledger, opened with what the profile
 * says now.
 */
export const ProfileForm = ({
  profile,
  message,
  errors = NO_ERRORS,
  ...form
}: ProfileFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form
      {...form}
      message={said.message}
      errors={errors}
      submitLabel={say(FORM.submit)}
    >
      <IntroductionFields shown={profile} errors={said.errors} />
    </Form>
  )
}
