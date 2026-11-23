import type { ModelsCustomerPreferencesResponse } from '@beauty-salon-frontend/api-client'
import {
  CheckboxGroup,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  Note,
  Select,
  TextArea,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { preferenceMessages } from '@beauty-salon-shared/i18n/messages/ui'
import {
  AVOIDED_STAFF,
  AVOIDED_STYLES,
  COMMUNICATION_STYLE,
  enteredOf,
  INSPIRATION_IMAGES,
  MAX_COMMUNICATION_STYLE_LENGTH,
  PREFERRED_COLORS,
  PREFERRED_LENGTH,
  PREFERRED_STAFF,
  SPECIAL_REQUESTS,
  TIME_SLOTS,
} from '../../utils/preferences-flow'
import { type StaffChoice, staffLabelOf } from '../../utils/staff-choices'
import { TimeSlotFields } from '../time-slot-fields/time-slot-fields'
import styles from './preferences-form.module.css'

export type PreferencesFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What went wrong with the attempt as a whole (`afterPreferencesChange`) */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls (`readPreferencesChange`) */
  errors?: FormErrors<LocalizedText> | undefined
  /** The preferences the form opens with */
  preferences: ModelsCustomerPreferencesResponse
  /**
   * The members of the staff the form offers. With none of them the form
   * has no control for the staff, and says how to get one
   */
  staff: readonly StaffChoice[]
}

const { form: words } = preferenceMessages

/**
 * What a customer wants the salons to keep in mind, in the parts a person
 * thinks of it in: the staff, the time of a visit, the style, and how they
 * like to be served. A control is named as the property of the request is,
 * and one inside another by its path; the browser keeps the values, and
 * the form hands them over when it is sent.
 *
 * A list that a person writes (colours, styles, the addresses of pictures)
 * is a text with a line for each entry. The staff are chosen from those
 * the form is given, each named with their salon: the preferences are one
 * record for every salon the customer goes to.
 */
export const PreferencesForm = ({
  preferences,
  staff,
  message,
  errors = NO_ERRORS,
  ...form
}: PreferencesFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const entered = enteredOf(preferences, staff)
  const options = staff.map((member) => ({
    value: member.id,
    label: say(staffLabelOf(member)),
  }))

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(words.staff)}>
        {entered.preferredStaffId === undefined ||
        entered.avoidStaffIds === undefined ? (
          <Note size='small'>{say(words.staffAfterBooking)}</Note>
        ) : (
          <div className={styles['controls']}>
            <Select
              label={say(words.preferredStaff)}
              name={PREFERRED_STAFF}
              placeholder={say(words.noPreferredStaff)}
              options={options}
              defaultValue={entered.preferredStaffId}
              error={said.errors[PREFERRED_STAFF]}
            />
            <CheckboxGroup
              label={say(words.avoidedStaff)}
              name={AVOIDED_STAFF}
              options={options}
              defaultValue={entered.avoidStaffIds}
              error={said.errors[AVOIDED_STAFF]}
            />
          </div>
        )}
      </FormPart>
      <FormPart
        label={say(words.timeSlots)}
        description={say(words.timeSlotsDescription)}
      >
        <TimeSlotFields
          name={TIME_SLOTS}
          defaultValue={entered.timeSlots}
          errors={errors}
        />
      </FormPart>
      <FormPart label={say(words.style)}>
        <TextField
          label={say(words.preferredLength)}
          name={PREFERRED_LENGTH}
          autoComplete='off'
          defaultValue={entered.preferredLength}
          error={said.errors[PREFERRED_LENGTH]}
        />
        <TextArea
          label={say(words.preferredColors)}
          name={PREFERRED_COLORS}
          description={say(words.oneALine)}
          defaultValue={entered.preferredColors}
          error={said.errors[PREFERRED_COLORS]}
        />
        <TextArea
          label={say(words.avoidedStyles)}
          name={AVOIDED_STYLES}
          description={say(words.oneALine)}
          defaultValue={entered.avoidStyles}
          error={said.errors[AVOIDED_STYLES]}
        />
        <TextArea
          label={say(words.inspirationImages)}
          name={INSPIRATION_IMAGES}
          description={say(words.inspirationImagesDescription)}
          defaultValue={entered.inspirationImages}
          error={said.errors[INSPIRATION_IMAGES]}
        />
      </FormPart>
      <FormPart label={say(words.service)}>
        <TextField
          label={say(words.communicationStyle)}
          name={COMMUNICATION_STYLE}
          autoComplete='off'
          description={say(
            words.communicationStyleDescription(MAX_COMMUNICATION_STYLE_LENGTH),
          )}
          defaultValue={entered.communicationStyle}
          error={said.errors[COMMUNICATION_STYLE]}
        />
        <TextArea
          label={say(words.specialRequests)}
          name={SPECIAL_REQUESTS}
          rows={4}
          defaultValue={entered.specialRequests}
          error={said.errors[SPECIAL_REQUESTS]}
        />
      </FormPart>
    </Form>
  )
}
