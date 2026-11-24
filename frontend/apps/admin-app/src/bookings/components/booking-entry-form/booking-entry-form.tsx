import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Button,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  type FormProps,
  formValuesOf,
  NO_ERRORS,
  Select,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { LineCheck } from '../../api/bookings-api'
import { BookingLines } from '../booking-lines/booking-lines'
import { BookingNotesFields } from '../booking-notes-fields/booking-notes-fields'
import styles from './booking-entry-form.module.css'

const { form: WORDS } = adminBookingMessages.entry

export type BookingEntryFormProps = Pick<
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
  /** The day of the visit the form opens with */
  date: string
  /** The time zone of the salon: the times are those of its clock */
  timezone: string
  /** What was found out about the member of each line; `undefined` while nothing is */
  checks?: readonly LineCheck[] | undefined
  /** The members of the lines are being checked */
  checking?: boolean | undefined
  /** What the last check found, in a sentence */
  checked?: LocalizedText | undefined
  /** The button that checks the members was pressed: with the values of the form */
  onCheck: (values: FormData) => void
  /** The member of the booking, the day or a line changed: what was found out is out of date */
  onLinesChange: () => void
}

/**
 * A booking the salon puts into its ledger: the member of the staff and the
 * day, the lines, and what the salon writes down. The browser keeps the
 * values, and the form hands them over when it is sent.
 *
 * Whether the members of the lines are free can be found out before it is
 * sent: the button hands the values of the form over, and what was found
 * out is shown at each line and said in a sentence, until the member, the
 * day or a line changes.
 */
export const BookingEntryForm = ({
  staff,
  services,
  date,
  timezone,
  checks,
  checking = false,
  checked,
  onCheck,
  onLinesChange,
  message,
  errors = NO_ERRORS,
  ...form
}: BookingEntryFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)

  return (
    <Form
      {...form}
      message={said.message}
      errors={errors}
      submitLabel={say(WORDS.submit)}
    >
      <FormPart label={say(WORDS.staffAndDate)} onChange={onLinesChange}>
        <FieldRow>
          <Select
            label={say(WORDS.staff)}
            name='staffId'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder={say(WORDS.choose)}
            required
            defaultValue=''
            description={say(WORDS.staffDescription)}
            error={said.errors['staffId']}
          />
          <TextField
            label={say(WORDS.date)}
            name='date'
            autoComplete='off'
            type='date'
            required
            defaultValue={date}
            min={EARLIEST_DAY}
            max={LATEST_DAY}
            description={say(WORDS.dateDescription)}
            error={said.errors['date']}
          />
        </FieldRow>
        <BookingLines
          staff={staff}
          services={services}
          errors={errors}
          checks={checks}
          timezone={timezone}
          onRowsChange={onLinesChange}
        />
        <div className={styles['check']}>
          <Button
            pending={checking}
            onClick={(event) => onCheck(formValuesOf(event.currentTarget))}
          >
            {say(WORDS.check)}
          </Button>
          <p role='status'>
            {checked === undefined ? undefined : say(checked)}
          </p>
        </div>
      </FormPart>
      <FormPart label={say(WORDS.record)}>
        <BookingNotesFields errors={errors} />
      </FormPart>
    </Form>
  )
}
