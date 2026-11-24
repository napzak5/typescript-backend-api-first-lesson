import type { ModelsCustomerAllergyResponse } from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Form,
  type FormErrors,
  NO_ERRORS,
  RadioGroup,
  Select,
  TextArea,
  TextField,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminChartMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { ReactNode } from 'react'
import { ALLERGY_TYPE_CHOICES, SEVERITY_CHOICES } from '../../utils/allergies'

const { form: FORM, words } = adminChartMessages.allergies

export type AllergyFormProps = {
  /** The allergy the form opens with; none for one that is recorded */
  allergy?: ModelsCustomerAllergyResponse | undefined
  /** Today at the salon: the last day an allergy was confirmed on */
  today: string
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** What else can be done, beside the button that sends the form */
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

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
}: AllergyFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)

  return (
    <Form
      submitLabel={submitLabel}
      message={said.message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <TextField
        label={say(words.allergen)}
        name='allergenName'
        autoComplete='off'
        required
        description={say(FORM.allergenDescription)}
        defaultValue={allergy?.allergenName}
        error={said.errors['allergenName']}
      />
      <Select
        label={say(words.type)}
        name='allergyType'
        options={options(ALLERGY_TYPE_CHOICES)}
        placeholder={say(FORM.choose)}
        required
        defaultValue={allergy?.allergyType ?? ''}
        error={said.errors['allergyType']}
      />
      <RadioGroup
        label={say(words.severity)}
        name='severityType'
        options={options(SEVERITY_CHOICES)}
        required
        defaultValue={allergy?.severityType}
        error={said.errors['severityType']}
      />
      <TextArea
        label={say(words.symptoms)}
        name='symptoms'
        rows={2}
        description={say(FORM.symptomsDescription)}
        defaultValue={allergy?.symptoms ?? undefined}
        error={said.errors['symptoms']}
      />
      <TextArea
        label={say(words.notes)}
        name='notes'
        rows={2}
        description={say(FORM.notesDescription)}
        defaultValue={allergy?.notes ?? undefined}
        error={said.errors['notes']}
      />
      <TextField
        width='short'
        label={say(words.confirmedDate)}
        name='confirmedDate'
        autoComplete='off'
        type='date'
        min={EARLIEST_DAY}
        max={today}
        description={say(FORM.confirmedDateDescription)}
        defaultValue={allergy?.confirmedDate ?? undefined}
        error={said.errors['confirmedDate']}
      />
    </Form>
  )
}
