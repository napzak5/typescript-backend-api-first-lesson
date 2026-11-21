import type { ModelsCustomerAllergyResponse } from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY } from '@beauty-salon-frontend/salon-screens'
import {
  Form,
  type FormErrors,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from '@beauty-salon-frontend/ui'
import type { ReactNode } from 'react'
import { ALLERGY_TYPE_OPTIONS, SEVERITY_OPTIONS } from '../../allergies'

export type AllergyFormProps = {
  /** The allergy the form opens with; none for one that is recorded */
  allergy?: ModelsCustomerAllergyResponse | undefined
  /** Today at the salon: the last day an allergy was confirmed on */
  today: string
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/**
 * An allergy of a customer: what causes it and of what kind, how heavy it
 * is, the symptoms it gave, what to take care of in a treatment, and the
 * day it was confirmed on, when it is known. The severities stand the
 * heaviest first, as the list of the customer does.
 */
export const AllergyForm = ({
  allergy,
  today,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: AllergyFormProps) => (
  <Form
    submitLabel={submitLabel}
    message={message}
    errors={errors}
    pending={pending}
    actions={actions}
    onSubmit={onSubmit}
  >
    <TextField
      label='アレルゲン'
      name='allergenName'
      autoComplete='off'
      required
      description='薬剤の成分、香料、金属などの名前。お客様 1 人に、同じアレルゲンは 1 件です。'
      defaultValue={allergy?.allergenName}
      error={errors['allergenName']}
    />
    <Select
      label='種類'
      name='allergyType'
      options={ALLERGY_TYPE_OPTIONS}
      placeholder='選んでください'
      required
      defaultValue={allergy?.allergyType ?? ''}
      error={errors['allergyType']}
    />
    <RadioGroup
      label='重篤度'
      name='severityType'
      options={SEVERITY_OPTIONS}
      required
      defaultValue={allergy?.severityType}
      error={errors['severityType']}
    />
    <TextArea
      label='症状'
      name='symptoms'
      rows={2}
      description='出た症状。記録しなければ空のままにします。'
      defaultValue={allergy?.symptoms ?? undefined}
      error={errors['symptoms']}
    />
    <TextArea
      label='施術のときの注意'
      name='notes'
      rows={2}
      description='使わない薬剤や、代わりに使うものなど。'
      defaultValue={allergy?.notes ?? undefined}
      error={errors['notes']}
    />
    <TextField
      label='確かめた日'
      name='confirmedDate'
      autoComplete='off'
      type='date'
      min={EARLIEST_DAY}
      max={today}
      description='カウンセリングやパッチテストで確かめた日。分からなければ空のままにします。'
      defaultValue={allergy?.confirmedDate ?? undefined}
      error={errors['confirmedDate']}
    />
  </Form>
)
