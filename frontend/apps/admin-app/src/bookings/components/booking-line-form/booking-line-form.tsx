import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
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
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { LineCheck } from '../../api/bookings-api'
import { SAME_STAFF } from '../../utils/booking-entry'
import {
  serviceOptionsOf,
  staffOptionsOf,
} from '../booking-lines/booking-lines'
import { LineCheckNote } from '../line-check-note/line-check-note'

const { addition: WORDS } = adminBookingMessages.moves
const { lines: LINES } = adminBookingMessages.entry

export type BookingLineFormProps = Pick<
  FormProps,
  'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The members of the staff of the salon */
  staff: readonly ModelsStaffProfileResponse[]
  /** The services of the salon, those it does not take bookings for as well */
  services: readonly ModelsServiceResponse[]
  /** The day of the visit, as it is named: 「2026年11月20日（金）」 */
  day: LocalizedText
  /** The time zone of the salon: the overlapping bookings are said on its clock */
  timezone: string
  /** What was found out about the member of the line, after the API refused it */
  check?: LineCheck | undefined
  /** A value changed: what was found out is out of date */
  onValuesChange: () => void
}

/**
 * Adds a line to a booking: a service, who does it (the member of the
 * booking at first), the time it begins on the day of the visit, and a
 * note. Its controls are named as the API names the values of a line.
 */
export const BookingLineForm = ({
  staff,
  services,
  day,
  timezone,
  check,
  onValuesChange,
  message,
  errors = NO_ERRORS,
  ...form
}: BookingLineFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)

  return (
    <Form
      {...form}
      message={said.message}
      errors={errors}
      submitLabel={say(WORDS.submit)}
    >
      <FormPart label={say(WORDS.line)} onChange={onValuesChange}>
        <Select
          label={say(WORDS.service)}
          name='serviceId'
          options={options(serviceOptionsOf(services))}
          placeholder={say(WORDS.choose)}
          required
          defaultValue=''
          error={said.errors['serviceId']}
        />
        <FieldRow>
          <Select
            label={say(WORDS.staff)}
            name='staffId'
            options={options(staffOptionsOf(staff))}
            defaultValue={SAME_STAFF}
            description={say(WORDS.staffDescription(LINES.noStaff))}
            error={said.errors['staffId']}
          />
          <TextField
            label={say(WORDS.startTime)}
            name='startTime'
            autoComplete='off'
            type='time'
            required
            description={say(WORDS.startTimeDescription(day))}
            error={said.errors['startTime']}
          />
        </FieldRow>
        <TextField
          label={say(WORDS.notes)}
          name='notes'
          autoComplete='off'
          error={said.errors['notes']}
        />
        {check !== undefined && (
          <LineCheckNote check={check} timezone={timezone} />
        )}
      </FormPart>
    </Form>
  )
}
