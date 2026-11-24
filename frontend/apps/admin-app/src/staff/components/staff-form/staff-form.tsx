import type { ModelsStaffResponse } from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  NO_ERRORS,
  Select,
  TextField,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { MOST_BUFFER, MOST_CONCURRENT, MOST_RATE } from '../../utils/staff-form'
import { LEVEL_CHOICES } from '../../utils/staff-format'
import { IntroductionFields } from '../introduction-fields/introduction-fields'

const { form: FORM, words } = adminStaffMessages

export type StaffFormProps = Pick<
  FormProps,
  'submitLabel' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** What went wrong with the attempt as a whole */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /**
   * The member the form opens with. `null` for a new one: the form then
   * opens with what the ledger gives a member nobody said more of, who is
   * active and takes one booking at a time
   */
  member: ModelsStaffResponse | null
}

/** A number of the ledger as a control shows it: nothing for none. */
const numberText = (number: number | null | undefined): string | undefined =>
  number === null || number === undefined ? undefined : String(number)

/**
 * Everything the staff ledger keeps of a member, in the parts an employer
 * thinks of them in: the name, how to reach them, how they are employed and
 * paid, how the customers are told of them, how they take bookings, and
 * whether they work at the salon. A control is named as the property of the
 * request is; the browser keeps the values, and the form hands them over
 * when it is sent.
 *
 * The values are those of a person the owner enters for somebody else, so
 * the browser is asked not to fill them in from what it knows of the user.
 */
export const StaffForm = ({
  member,
  message,
  errors = NO_ERRORS,
  ...form
}: StaffFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)

  return (
    <Form {...form} message={said.message} errors={errors}>
      <FormPart label={say(words.name)}>
        <FieldRow>
          <TextField
            label={say(words.lastName)}
            name='lastName'
            autoComplete='off'
            required
            defaultValue={member?.lastName}
            error={said.errors['lastName']}
          />
          <TextField
            label={say(words.firstName)}
            name='firstName'
            autoComplete='off'
            required
            defaultValue={member?.firstName}
            error={said.errors['firstName']}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label={say(words.lastNameKana)}
            name='lastNameKana'
            autoComplete='off'
            defaultValue={member?.lastNameKana ?? undefined}
            error={said.errors['lastNameKana']}
          />
          <TextField
            label={say(words.firstNameKana)}
            name='firstNameKana'
            autoComplete='off'
            defaultValue={member?.firstNameKana ?? undefined}
            error={said.errors['firstNameKana']}
          />
        </FieldRow>
        <TextField
          label={say(words.displayName)}
          name='displayName'
          autoComplete='off'
          required
          description={say(FORM.displayNameDescription)}
          defaultValue={member?.displayName}
          error={said.errors['displayName']}
        />
      </FormPart>
      <FormPart label={say(words.contact)}>
        <TextField
          label={say(words.email)}
          name='email'
          type='email'
          autoComplete='off'
          required
          description={say(FORM.emailDescription)}
          defaultValue={member?.email}
          error={said.errors['email']}
        />
        <FieldRow>
          <TextField
            label={say(words.phoneNumber)}
            name='phoneNumber'
            type='tel'
            autoComplete='off'
            required
            defaultValue={member?.phoneNumber}
            error={said.errors['phoneNumber']}
          />
          <TextField
            label={say(words.alternativePhone)}
            name='alternativePhone'
            type='tel'
            autoComplete='off'
            defaultValue={member?.alternativePhone ?? undefined}
            error={said.errors['alternativePhone']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label={say(words.employment)}>
        <FieldRow>
          <TextField
            label={say(words.staffCode)}
            name='staffCode'
            autoComplete='off'
            description={say(FORM.staffCodeDescription)}
            defaultValue={member?.staffCode ?? undefined}
            error={said.errors['staffCode']}
          />
          <Select
            label={say(words.level)}
            name='level'
            required
            placeholder={say(FORM.choose)}
            options={options(LEVEL_CHOICES)}
            defaultValue={member?.level ?? ''}
            error={said.errors['level']}
          />
        </FieldRow>
        <FieldRow>
          <TextField
            label={say(words.position)}
            name='position'
            autoComplete='off'
            defaultValue={member?.position ?? undefined}
            error={said.errors['position']}
          />
          <TextField
            label={say(words.employmentType)}
            name='employmentType'
            autoComplete='off'
            description={say(FORM.employmentTypeDescription)}
            defaultValue={member?.employmentType ?? undefined}
            error={said.errors['employmentType']}
          />
        </FieldRow>
        <TextField
          label={say(words.hireDate)}
          name='hireDate'
          type='date'
          autoComplete='off'
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          width='short'
          description={say(FORM.hireDateDescription)}
          defaultValue={member?.hireDate ?? undefined}
          error={said.errors['hireDate']}
        />
        <FieldRow>
          <TextField
            label={say(FORM.baseSalary)}
            name='baseSalary'
            inputMode='numeric'
            autoComplete='off'
            description={say(FORM.baseSalaryDescription)}
            defaultValue={numberText(member?.baseSalary)}
            error={said.errors['baseSalary']}
          />
          <TextField
            label={say(FORM.commissionRate)}
            name='commissionRate'
            inputMode='decimal'
            autoComplete='off'
            description={say(FORM.commissionRateDescription(MOST_RATE))}
            defaultValue={numberText(member?.commissionRate)}
            error={said.errors['commissionRate']}
          />
        </FieldRow>
      </FormPart>
      <FormPart
        label={say(words.introduction)}
        description={say(FORM.introductionDescription)}
      >
        <IntroductionFields shown={member} errors={said.errors} />
      </FormPart>
      <FormPart label={say(words.bookingSettings)}>
        <Checkbox
          label={say(FORM.canReceiveBookings)}
          name='canReceiveBookings'
          description={say(FORM.canReceiveBookingsDescription)}
          defaultChecked={member?.canReceiveBookings ?? true}
          error={said.errors['canReceiveBookings']}
        />
        <TextField
          label={say(FORM.maxConcurrentBookings)}
          name='maxConcurrentBookings'
          inputMode='numeric'
          autoComplete='off'
          required
          width='short'
          description={say(
            FORM.maxConcurrentBookingsDescription(MOST_CONCURRENT),
          )}
          defaultValue={numberText(member?.maxConcurrentBookings ?? 1)}
          error={said.errors['maxConcurrentBookings']}
        />
        <FieldRow>
          <TextField
            label={say(FORM.bufferTimeBefore)}
            name='bufferTimeBefore'
            inputMode='numeric'
            autoComplete='off'
            required
            description={say(FORM.bufferTimeBeforeDescription(MOST_BUFFER))}
            defaultValue={numberText(member?.bufferTimeBefore ?? 0)}
            error={said.errors['bufferTimeBefore']}
          />
          <TextField
            label={say(FORM.bufferTimeAfter)}
            name='bufferTimeAfter'
            inputMode='numeric'
            autoComplete='off'
            required
            description={say(FORM.bufferTimeAfterDescription(MOST_BUFFER))}
            defaultValue={numberText(member?.bufferTimeAfter ?? 0)}
            error={said.errors['bufferTimeAfter']}
          />
        </FieldRow>
      </FormPart>
      <FormPart label={say(FORM.activity)}>
        <Checkbox
          label={say(FORM.isActive)}
          name='isActive'
          description={say(FORM.isActiveDescription)}
          defaultChecked={member?.isActive ?? true}
          error={said.errors['isActive']}
        />
      </FormPart>
    </Form>
  )
}
