import type {
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'
import { EARLIEST_DAY, LATEST_DAY } from '@beauty-salon-frontend/fields'
import {
  Button,
  FieldRow,
  Form,
  FormPart,
  type FormProps,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import type { LineCheck } from '../../api/bookings-api'
import { BookingLines } from '../booking-lines/booking-lines'
import { BookingNotesFields } from '../booking-notes-fields/booking-notes-fields'
import styles from './booking-entry-form.module.css'

export type BookingEntryFormProps = Pick<
  FormProps,
  'message' | 'errors' | 'pending' | 'actions' | 'onSubmit'
> & {
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
  checked?: string | undefined
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
  errors = {},
  ...form
}: BookingEntryFormProps) => (
  <Form {...form} errors={errors} submitLabel='予約を入れる'>
    <FormPart label='担当と日時' onChange={onLinesChange}>
      <FieldRow>
        <Select
          label='担当スタッフ'
          name='staffId'
          options={staff.map(({ id, displayName }) => ({
            value: id,
            label: displayName,
          }))}
          placeholder='選んでください'
          required
          defaultValue=''
          description='予約の担当です。明細の担当が「予約の担当と同じ」なら、この人が施術します。'
          error={errors['staffId']}
        />
        <TextField
          label='来店日'
          name='date'
          autoComplete='off'
          type='date'
          required
          defaultValue={date}
          min={EARLIEST_DAY}
          max={LATEST_DAY}
          description='サロンの時計の日付です。明細は、この日の時刻に始まります。'
          error={errors['date']}
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
          onClick={(event) => {
            const { form: values } = event.currentTarget
            if (values !== null) {
              onCheck(new FormData(values))
            }
          }}
        >
          担当の空きを確かめる
        </Button>
        <p role='status'>{checked}</p>
      </div>
    </FormPart>
    <FormPart label='受付の記録'>
      <BookingNotesFields errors={errors} />
    </FormPart>
  </Form>
)
