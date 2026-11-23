import { type Unread, unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import {
  Actions,
  Alert,
  Button,
  EmptyState,
  type FormErrors,
  LoadingIndicator,
  NO_ERRORS,
  RadioGroup,
  Select,
  TextField,
  UnreadNotice,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalBookingMessages } from '@beauty-salon-shared/i18n/messages/portal'
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from 'react'
import { match } from 'ts-pattern'
import {
  type Choice,
  dayAfter,
  dayBefore,
  type Time,
} from '../../utils/booking-choice'
import styles from './booking-form.module.css'

const { form: words } = portalBookingMessages

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
  message?: LocalizedText | undefined
  /**
   * The errors of the controls, under their names (`startTime`). A new
   * object is the answer to another attempt, and the focus goes to the
   * first control that has an error; the form says them in the language
   * of the page, and one that is said in another language moves nothing
   */
  errors?: FormErrors<LocalizedText> | undefined
  /** The attempt is on its way */
  pending?: boolean | undefined
  /** The time that was chosen (`startTime`), and the values of the controls that were given */
  onSubmit: (values: FormData) => void
}

/** The value of the choice for nobody in particular */
const ANYBODY = ''

/**
 * Where a customer chooses the time of a booking, for a new one and for
 * one that is moved: with whom, on which day, and at which of the times
 * that are free. The staff and the day belong to whoever shows the form,
 * which reads the times for them; the time, and what the controls that
 * were given hold, are kept by the browser until the form is sent. There
 * is nothing to send while the day has no time.
 *
 * It is no `Form` of the package, which always has its button and is sent
 * to be read: here choosing the staff or the day reads other times at
 * once, and the button is there only while the day has a free time.
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
  const say = useSay()
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
      {message !== undefined && <Alert tone='danger'>{say(message)}</Alert>}
      <Select
        label={say(words.staff)}
        options={[
          { value: ANYBODY, label: say(words.anybody) },
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
          label={say(words.day)}
          autoComplete='off'
          type='date'
          width='short'
          min={today}
          value={choice.date}
          onChange={chooseDate}
          required
        />
        <Actions>
          <Button
            size='small'
            disabled={choice.date <= today}
            onClick={() =>
              onChoose({ ...choice, date: dayBefore(choice.date, today) })
            }
          >
            {say(words.dayBefore)}
          </Button>
          <Button
            size='small'
            onClick={() => onChoose({ ...choice, date: dayAfter(choice.date) })}
          >
            {say(words.dayAfter)}
          </Button>
        </Actions>
      </div>
      {match(times)
        .with({ type: 'loading' }, () => (
          <LoadingIndicator label={say(words.loading)} />
        ))
        .with({ type: 'listed', times: [] }, () => (
          <EmptyState
            title={say(words.noTimes)}
            description={say(words.noTimesDescription)}
          />
        ))
        .with({ type: 'listed' }, (listed) => (
          <RadioGroup
            label={say(words.startTime)}
            name='startTime'
            layout='columns'
            required
            options={listed.times.map(({ startTime, label }) => ({
              value: startTime,
              label: say(label),
            }))}
            description={say(
              words.startTimeDescription(formats.monthDayOf(choice.date)),
            )}
            error={
              errors['startTime'] === undefined
                ? undefined
                : say(errors['startTime'])
            }
          />
        ))
        .with({ type: 'unread' }, ({ reason, retrying }) => (
          <UnreadNotice
            message={say(
              unreadMessageOf(portalBookingMessages.names.freeTimes, reason),
            )}
            onRetry={onRetry}
            pending={retrying}
          />
        ))
        .exhaustive()}
      {children}
      {times.type === 'listed' && times.times.length > 0 && (
        <Button type='submit' variant='primary' pending={pending}>
          {submitLabel}
        </Button>
      )}
    </form>
  )
}
