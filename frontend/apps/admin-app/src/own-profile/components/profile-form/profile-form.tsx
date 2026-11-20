import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import { Form, type FormProps } from '@beauty-salon-frontend/ui'
import { IntroductionFields } from '../../../staff/components/introduction-fields/introduction-fields'

export type ProfileFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'onSubmit'
> & {
  /** The profile the form opens with */
  profile: ModelsStaffProfileResponse
}

/**
 * What a member writes of themselves for the customers: the same controls
 * as the introduction in the staff ledger, opened with what the profile
 * says now.
 */
export const ProfileForm = ({
  profile,
  errors = {},
  ...form
}: ProfileFormProps) => (
  <Form {...form} errors={errors} submitLabel='保存する'>
    <IntroductionFields shown={profile} errors={errors} />
  </Form>
)
