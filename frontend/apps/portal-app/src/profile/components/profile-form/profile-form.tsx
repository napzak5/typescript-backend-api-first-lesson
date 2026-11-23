import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  EARLIEST_DAY,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
} from '@beauty-salon-frontend/fields'
import {
  Checkbox,
  CheckboxGroup,
  FieldRow,
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
import { portalProfileMessages } from '@beauty-salon-shared/i18n/messages/portal'
import {
  CATEGORY_CHOICES,
  GENDER_CHOICES,
  type NamedChoice,
} from '../../utils/profile-format'

const { controls, parts, email } = portalProfileMessages

export type ProfileFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /**
   * The profile the form opens with. `null` for an account that has none:
   * the form is then empty, and what it is sent with makes the profile
   */
  profile: ModelsCustomerProfileResponse | null
  /** The last day somebody can have been born on: `2026-11-19` */
  today: string
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /**
   * The errors of the controls, under their names. A new object is a new
   * attempt: the focus goes to the first control with an error
   */
  errors?: FormErrors<LocalizedText> | undefined
}

/**
 * Everything a customer says about themselves, in the parts a person
 * thinks of them in: the name, how to reach them, where they live, who
 * they are, what they like, and what a salon may send them. A control is
 * named as the property of the request is; the browser keeps the values,
 * and the form hands them over when it is sent.
 *
 * The address of the customer is none of them: a new profile gets the
 * address of the account, and after that the salons keep it. The form says
 * so where the address would be asked for.
 */
export const ProfileForm = ({
  profile,
  today,
  message,
  errors = NO_ERRORS,
  ...form
}: ProfileFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const options = (choices: readonly NamedChoice[]) =>
    choices.map(({ value, label }) => ({ value, label: say(label) }))

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(parts.name)}>
        <FieldRow>
          <TextField
            label={say(controls.lastName)}
            name='lastName'
            autoComplete='family-name'
            required
            defaultValue={profile?.lastName}
            error={said.errors['lastName']}
          />
          <TextField
            label={say(controls.firstName)}
            name='firstName'
            autoComplete='given-name'
            required
            defaultValue={profile?.firstName}
            error={said.errors['firstName']}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label={say(controls.lastNameKana)}
            name='lastNameKana'
            autoComplete='off'
            defaultValue={profile?.lastNameKana ?? undefined}
            error={said.errors['lastNameKana']}
          />
          <TextField
            label={say(controls.firstNameKana)}
            name='firstNameKana'
            autoComplete='off'
            defaultValue={profile?.firstNameKana ?? undefined}
            error={said.errors['firstNameKana']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label={say(parts.contact)}>
        <TextField
          label={say(controls.phoneNumber)}
          name='phoneNumber'
          type='tel'
          autoComplete='tel'
          required
          description={say(controls.phoneNumberDescription)}
          defaultValue={profile?.phoneNumber}
          error={said.errors['phoneNumber']}
        />
        <TextField
          label={say(controls.alternativePhone)}
          name='alternativePhone'
          autoComplete='off'
          type='tel'
          description={say(controls.alternativePhoneDescription)}
          defaultValue={profile?.alternativePhone ?? undefined}
          error={said.errors['alternativePhone']}
        />
        <Note size='small'>
          {say(
            profile === null
              ? email.ofNewProfile
              : email.unchangeable(profile.email),
          )}
        </Note>
      </FormPart>
      <FormPart label={say(parts.address)}>
        <TextField
          label={say(controls.postalCode)}
          name='postalCode'
          autoComplete='postal-code'
          defaultValue={profile?.postalCode ?? undefined}
          error={said.errors['postalCode']}
        />
        <FieldRow>
          <TextField
            label={say(controls.prefecture)}
            name='prefecture'
            autoComplete='address-level1'
            defaultValue={profile?.prefecture ?? undefined}
            error={said.errors['prefecture']}
          />
          <TextField
            label={say(controls.city)}
            name='city'
            autoComplete='address-level2'
            defaultValue={profile?.city ?? undefined}
            error={said.errors['city']}
          />
        </FieldRow>
        <TextField
          label={say(controls.address)}
          name='address'
          autoComplete='address-line1'
          defaultValue={profile?.address ?? undefined}
          error={said.errors['address']}
        />
        <TextField
          label={say(controls.building)}
          name='building'
          autoComplete='address-line2'
          defaultValue={profile?.building ?? undefined}
          error={said.errors['building']}
        />
      </FormPart>
      <FormPart label={say(parts.aboutYou)}>
        <FieldRow>
          <TextField
            label={say(controls.birthDate)}
            name='birthDate'
            type='date'
            autoComplete='bday'
            min={EARLIEST_DAY}
            max={today}
            defaultValue={profile?.birthDate ?? undefined}
            error={said.errors['birthDate']}
          />
          <Select
            label={say(controls.gender)}
            name='gender'
            autoComplete='sex'
            placeholder={say(controls.noGender)}
            options={options(GENDER_CHOICES)}
            defaultValue={profile?.gender ?? ''}
            error={said.errors['gender']}
          />
        </FieldRow>
        <TextField
          label={say(controls.occupation)}
          name='occupation'
          autoComplete='organization-title'
          defaultValue={profile?.occupation ?? undefined}
          error={said.errors['occupation']}
        />
      </FormPart>
      <FormPart label={say(parts.likes)}>
        <CheckboxGroup
          label={say(controls.preferredServices)}
          name={PREFERRED_SERVICES}
          layout='columns'
          options={options(CATEGORY_CHOICES)}
          defaultValue={profile?.preferences?.preferredServices}
          error={said.errors[PREFERRED_SERVICES]}
        />
        <TextArea
          label={say(controls.notes)}
          name={PREFERENCE_NOTES}
          rows={4}
          description={say(controls.notesDescription)}
          defaultValue={profile?.preferences?.notes ?? undefined}
          error={said.errors[PREFERENCE_NOTES]}
        />
      </FormPart>
      <FormPart label={say(parts.contacts)}>
        <Checkbox
          label={say(controls.allowEmail)}
          name='allowEmail'
          defaultChecked={profile?.allowEmail}
        />
        <Checkbox
          label={say(controls.allowSms)}
          name='allowSms'
          defaultChecked={profile?.allowSms}
        />
        <Checkbox
          label={say(controls.allowMarketing)}
          name='allowMarketing'
          defaultChecked={profile?.allowMarketing}
        />
      </FormPart>
    </Form>
  )
}
