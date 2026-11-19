import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Alert,
  Button,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  RadioGroup,
  Select,
  TextField,
} from '@beauty-salon-frontend/ui'
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from 'react'
import { match } from 'ts-pattern'
import { calendarDateOf } from '../../../salons/salon-format'
import type { Unread } from '../../../salons/salons-api'
import { UnreadNotice } from '../../../salons/unread-notice'
import {
  type Choice,
  dayAfter,
  dayBefore,
  type Time,
} from '../../booking-choice'
import styles from './booking-form.module.css'

/** The times of the chosen day: being read, read, or not read. */
export type TimesOfDay =
  | { type: 'loading' }
  | { type: 'listed'; times: readonly Time[] }
  | { type: 'unread'; reason: Unread; retrying: boolean }

export type BookingFormProps = {
  /** The members of the staff who can be asked for */
  staff: readonly ModelsStaffProfileResponse[]
  /** With whom and on which day: the times shown are those of this choice */
  choice: Choice
  /** The calendar date it is at the salon: no earlier day is offered */
  today: string
  onChoose: (choice: Choice) => void
  times: TimesOfDay
  /** Asks for the times again, after they could not be read */
  onRetry: () => void
  /**
   * What is sent with the time: the controls below the times (「ご要望」).
   * They are there on a day without a time, too
   */
  children?: ReactNode
  /** What the button that sends the form says: 「この内容で予約する」 */
  submitLabel: string
  /** What went wrong with the attempt as a whole */
  message?: string | undefined
  /**
   * The errors of the controls, under their names (`startTime`). A new
   * object is the answer to another attempt, and the focus goes to the
   * first control that has an error
   */
  errors?: FormErrors | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** The time that was chosen (`startTime`), and the values of the controls that were given */
  onSubmit: (values: FormData) => void
}

const NO_ERRORS: FormErrors = {}

/** The value of the choice for nobody in particular */
const ANYBODY = ''

/**
 * Where a customer chooses the time of a booking, for a new one and for
 * one that is moved: with whom, on which day, and at which of the times
 * that are free. The staff and the day belong to whoever shows the form,
 * which reads the times for them; the time, and what the controls that
 * were given hold, are kept by the browser until the form is sent. There
 * is nothing to send while the day has no time.
 */
export const BookingForm = ({
  staff,
  choice,
  today,
  onChoose,
  times,
  onRetry,
  children,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending = false,
  onSubmit,
}: BookingFormProps) => {
  const form = useRef<HTMLFormElement>(null)

  // The focus goes to the first control with an error, in the commit that
  // shows the errors. The error of the times is on their group: its first
  // button is what takes the focus
  useLayoutEffect(() => {
    if (Object.values(errors).some((error) => error !== undefined)) {
      form.current
        ?.querySelector<HTMLElement>(
          '[role="radiogroup"][aria-invalid="true"] input, :is(input, textarea, select)[aria-invalid="true"]',
        )
        ?.focus()
    }
  }, [errors])

  const chooseStaff = (event: ChangeEvent<HTMLSelectElement>): void => {
    const staffId = event.currentTarget.value
    onChoose({ ...choice, staffId: staffId === ANYBODY ? undefined : staffId })
  }

  const chooseDate = (event: ChangeEvent<HTMLInputElement>): void => {
    const date = event.currentTarget.value
    // A control that was emptied, and a day that has passed, choose
    // nothing: the control shows the chosen day again
    if (date !== '' && date >= today) {
      onChoose({ ...choice, date })
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!pending) {
      onSubmit(new FormData(event.currentTarget))
    }
  }

  return (
    <form className={styles['form']} noValidate onSubmit={submit} ref={form}>
      {message !== undefined && <Alert tone='danger'>{message}</Alert>}
      <Select
        label='スタッフ'
        options={[
          { value: ANYBODY, label: '指名しない' },
          ...staff.map((member) => ({
            value: member.id,
            label: member.displayName,
          })),
        ]}
        value={choice.staffId ?? ANYBODY}
        onChange={chooseStaff}
      />
      <div className={styles['day']}>
        <TextField
          label='日付'
          type='date'
          min={today}
          value={choice.date}
          onChange={chooseDate}
          required
        />
        <div className={styles['steps']}>
          <Button
            variant='secondary'
            size='small'
            disabled={choice.date <= today}
            onClick={() =>
              onChoose({ ...choice, date: dayBefore(choice.date, today) })
            }
          >
            前の日
          </Button>
          <Button
            variant='secondary'
            size='small'
            onClick={() => onChoose({ ...choice, date: dayAfter(choice.date) })}
          >
            次の日
          </Button>
        </div>
      </div>
      {match(times)
        .with({ type: 'loading' }, () => (
          <LoadingIndicator label='空いている時刻を読み込んでいます' />
        ))
        .with({ type: 'listed', times: [] }, () => (
          <EmptyState
            title='この日は、予約できる時刻がありません'
            description='日付かスタッフを変えて、お探しください。'
          />
        ))
        .with({ type: 'listed' }, (listed) => (
          <RadioGroup
            label='開始時刻'
            name='startTime'
            layout='columns'
            required
            options={listed.times.map(({ startTime, label }) => ({
              value: startTime,
              label,
            }))}
            description={`${calendarDateOf(choice.date)}の、空いている時刻です。時刻は、サロンのある地域の時刻です。`}
            error={errors['startTime']}
          />
        ))
        .with({ type: 'unread' }, ({ reason, retrying }) => (
          <UnreadNotice
            what='空いている時刻'
            reason={reason}
            onRetry={onRetry}
            retrying={retrying}
          />
        ))
        .exhaustive()}
      {children}
      {times.type === 'listed' && times.times.length > 0 && (
        <div className={styles['actions']}>
          <Button type='submit' variant='primary' pending={pending}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
