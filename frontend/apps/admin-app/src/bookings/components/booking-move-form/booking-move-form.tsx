import type {
  ModelsBookingResponse,
  ModelsBookingServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import { timeAt } from '@beauty-salon-frontend/salon-screens'
import {
  FieldRow,
  Form,
  type FormErrors,
  type FormProps,
  NO_ERRORS,
  Select,
  TextField,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminBookingMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { useId } from 'react'
import type { LineCheck } from '../../api/bookings-api'
import type { Names } from '../../utils/day-bookings'
import { MovedLines } from '../moved-lines/moved-lines'
import styles from './booking-move-form.module.css'

const { move: WORDS } = adminBookingMessages.moves

export type BookingMoveFormProps = Pick<
  FormProps,
  'pending' | 'actions' | 'onSubmit'
> & {
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  /** The members of the staff of the salon */
  staff: readonly ModelsStaffProfileResponse[]
  /** The services of the salon, by name */
  services: Names['services']
  /** What the booking has now: the form opens with it */
  booking: Pick<ModelsBookingResponse, 'staffId' | 'bookingDate' | 'startTime'>
  /** The time zone of the salon: the day and the time are those of its clock */
  timezone: string
  /** The lines as the values of the form would leave them; `undefined` while the values are no move */
  moved: readonly ModelsBookingServiceResponse[] | undefined
  /** What was found out about the member of each line where it would be; `undefined` while nothing is */
  checks?: readonly LineCheck[] | undefined
  /** A value of the form changed: with the values */
  onValuesChange: (values: FormData) => void
}

/**
 * Moves a booking: the member of the staff, the day and the time its first
 * line begins, each opened with what the booking has. Below them, the lines
 * where the values would put them, read anew as a value changes: every line
 * moves as far as the first, and the lines of the member of the booking go
 * to the new member.
 */
export const BookingMoveForm = ({
  staff,
  services,
  booking,
  timezone,
  moved,
  checks,
  onValuesChange,
  message,
  errors = NO_ERRORS,
  ...form
}: BookingMoveFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const movedName = useId()

  return (
    <Form
      {...form}
      message={said.message}
      errors={errors}
      submitLabel={say(WORDS.submit)}
    >
      <fieldset
        className={styles['part']}
        onChange={(event) => {
          const { form: values } = event.currentTarget
          if (values !== null) {
            onValuesChange(new FormData(values))
          }
        }}
      >
        <legend className={styles['name']}>{say(WORDS.to)}</legend>
        <div className={styles['controls']}>
          <Select
            label={say(WORDS.staff)}
            name='staffId'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder={say(WORDS.choose)}
            required
            defaultValue={booking.staffId}
            description={say(WORDS.staffDescription)}
            error={said.errors['staffId']}
          />
          <FieldRow>
            <TextField
              label={say(WORDS.date)}
              name='date'
              autoComplete='off'
              type='date'
              required
              defaultValue={booking.bookingDate}
              min={EARLIEST_DAY}
              max={LATEST_DAY}
              description={say(WORDS.dateDescription)}
              error={said.errors['date']}
            />
            <TextField
              label={say(WORDS.startTime)}
              name='startTime'
              autoComplete='off'
              type='time'
              required
              defaultValue={timeAt(booking.startTime, timezone)}
              description={say(WORDS.startTimeDescription)}
              error={said.errors['startTime']}
            />
          </FieldRow>
        </div>
      </fieldset>
      <section className={styles['part']} aria-labelledby={movedName}>
        <h2 className={styles['name']} id={movedName}>
          {say(WORDS.moved)}
        </h2>
        {moved === undefined ? (
          <p>{say(WORDS.noMove)}</p>
        ) : (
          <MovedLines
            lines={moved}
            staff={staff}
            services={services}
            timezone={timezone}
            checks={checks}
          />
        )}
      </section>
    </Form>
  )
}
