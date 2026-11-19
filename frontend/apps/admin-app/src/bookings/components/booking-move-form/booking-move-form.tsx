import type {
  ModelsBookingResponse,
  ModelsBookingServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Form,
  type FormProps,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import { useId } from 'react'
import { EARLIEST_DAY, LATEST_DAY, timeOfDayAt } from '../../../salon-time'
import type { LineCheck } from '../../bookings-api'
import type { Names } from '../../day-bookings'
import { MovedLines } from '../moved-lines/moved-lines'
import styles from './booking-move-form.module.css'

export type BookingMoveFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
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
  errors = {},
  ...form
}: BookingMoveFormProps) => {
  const movedName = useId()

  return (
    <Form {...form} errors={errors} submitLabel='日時と担当を変える'>
      <fieldset
        className={styles['part']}
        onChange={(event) => {
          const { form: values } = event.currentTarget
          if (values !== null) {
            onValuesChange(new FormData(values))
          }
        }}
      >
        <legend className={styles['name']}>移す先</legend>
        <div className={styles['controls']}>
          <Select
            label='担当スタッフ'
            name='staffId'
            options={staff.map(({ id, displayName }) => ({
              value: id,
              label: displayName,
            }))}
            placeholder='選んでください'
            required
            defaultValue={booking.staffId}
            description='予約の担当です。いまの担当が受け持つ明細は、新しい担当に替わります。ほかのスタッフの明細と、担当を決めない明細は、担当がそのままです。'
            error={errors['staffId']}
          />
          <div className={styles['pair']}>
            <TextField
              label='来店日'
              name='date'
              type='date'
              required
              defaultValue={booking.bookingDate}
              min={EARLIEST_DAY}
              max={LATEST_DAY}
              description='サロンの時計の日付です。'
              error={errors['date']}
            />
            <TextField
              label='開始の時刻'
              name='startTime'
              type='time'
              required
              defaultValue={timeOfDayAt(booking.startTime, timezone)}
              description='最初の明細が始まる時刻です。すべての明細が、同じ時間だけ動きます。'
              error={errors['startTime']}
            />
          </div>
        </div>
      </fieldset>
      <section className={styles['part']} aria-labelledby={movedName}>
        <h2 className={styles['name']} id={movedName}>
          動かしたあとの明細
        </h2>
        {moved === undefined ? (
          <p className={styles['unread']}>
            担当スタッフ、来店日、開始の時刻を入れると、動かしたあとの明細を出します。
          </p>
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
