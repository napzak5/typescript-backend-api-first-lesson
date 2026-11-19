import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import {
  Form,
  type FormProps,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import { SAME_STAFF } from '../../booking-entry'
import type { LineCheck } from '../../bookings-api'
import {
  serviceOptionsOf,
  staffOptionsOf,
} from '../booking-lines/booking-lines'
import { LineCheckNote } from '../line-check-note/line-check-note'
import styles from './booking-line-form.module.css'

export type BookingLineFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
  /** The members of the staff of the salon */
  staff: readonly ModelsStaffProfileResponse[]
  /** The services of the salon, those it does not take bookings for as well */
  services: readonly ModelsServiceResponse[]
  /** The day of the visit, as it is named: 「2026年11月20日（金）」 */
  day: string
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
  errors = {},
  ...form
}: BookingLineFormProps) => (
  <Form {...form} errors={errors} submitLabel='施術明細を追加する'>
    <fieldset className={styles['part']} onChange={onValuesChange}>
      <legend className={styles['name']}>足す明細</legend>
      <div className={styles['controls']}>
        <Select
          label='メニュー'
          name='serviceId'
          options={serviceOptionsOf(services)}
          placeholder='選んでください'
          required
          defaultValue=''
          error={errors['serviceId']}
        />
        <div className={styles['pair']}>
          <Select
            label='担当'
            name='staffId'
            options={staffOptionsOf(staff)}
            defaultValue={SAME_STAFF}
            description='「決めない」明細は、誰の時間も占有しません。'
            error={errors['staffId']}
          />
          <TextField
            label='開始の時刻'
            name='startTime'
            type='time'
            required
            description={`来店日（${day}）の、サロンの時計の時刻です。`}
            error={errors['startTime']}
          />
        </div>
        <TextField label='メモ' name='notes' error={errors['notes']} />
        {check !== undefined && (
          <LineCheckNote check={check} timezone={timezone} />
        )}
      </div>
    </fieldset>
  </Form>
)
