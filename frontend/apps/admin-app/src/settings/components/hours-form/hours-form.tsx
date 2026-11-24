import {
  Button,
  Checkbox,
  FieldRow,
  Form,
  type FormErrors,
  FormPart,
  FormRow,
  NO_ERRORS,
  Note,
  RadioGroup,
  TextField,
  useRepeatedRows,
  useSaidChoices,
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { type ReactNode, useState } from 'react'
import { timeInputOf } from '../../../shifts/utils/schedule-form'
import type { Hours } from '../../api/hours-api'
import {
  CLOSED,
  calendarPartsOf,
  dateControlOf,
  type HoursProperty,
  LONGEST_HOLIDAY_NAME,
  OPEN,
  weekdayControlOf,
  weekPartsOf,
} from '../../utils/hours-form'
import { periodNameOf } from '../../utils/settings-format'

const { hoursForm: WORDS } = adminSettingsMessages

/** Whether a day of the week opens */
const WEEKDAY_CHOICES = [
  { value: OPEN, label: WORDS.isOpen },
  { value: CLOSED, label: WORDS.isClosed },
]

/** Whether a date opens */
const DATE_CHOICES = [
  { value: OPEN, label: WORDS.isOpen },
  { value: CLOSED, label: WORDS.isClosedAllDay },
]

export type HoursFormProps = {
  /** The hours the form was opened with, as the API keeps them */
  hours: Hours
  /** Today at the salon: the dates before it are kept out of sight */
  today: string
  /** The time zone of the salon, which the period of hours is named in */
  timezone: string
  submitLabel: string
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  pending?: boolean | undefined
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/** The values a row of a date opens with */
type Shown = {
  date: string | undefined
  openTime: string | undefined
  closeTime: string | undefined
  isHoliday: boolean
  holidayName: string | undefined
  notes: string | undefined
}

/** A row of a date the form holds: what it opened with, and whether the salon opens on the date */
type DateRow = { shown: Shown; opens: boolean }

const EMPTY: Shown = {
  date: undefined,
  openTime: undefined,
  closeTime: undefined,
  isHoliday: false,
  holidayName: undefined,
  notes: undefined,
}

type TimesProps = {
  nameOf: (property: HoursProperty) => string
  openTime: string | undefined
  closeTime: string | undefined
  errors: FormErrors
}

/** The hours of a day the salon is open on, at the clock of the salon. */
const Times = ({ nameOf, openTime, closeTime, errors }: TimesProps) => {
  const say = useSay()

  return (
    <FieldRow>
      <TextField
        label={say(WORDS.opens)}
        type='time'
        name={nameOf('openTime')}
        autoComplete='off'
        required
        defaultValue={timeInputOf(openTime ?? null)}
        error={errors[nameOf('openTime')]}
      />
      <TextField
        label={say(WORDS.closes)}
        type='time'
        name={nameOf('closeTime')}
        autoComplete='off'
        required
        defaultValue={timeInputOf(closeTime ?? null)}
        error={errors[nameOf('closeTime')]}
      />
    </FieldRow>
  )
}

/**
 * The hours of a salon: a part for every day of the week, and the rows of
 * the dates of its calendar from today on, which set the hours of their
 * days in place of the day of the week. A day the salon is open on asks
 * for the hours, and a day of the week takes a break.
 *
 * A row of a date is a group of its own: one is added at the end and its
 * date takes the focus, one that is taken away gives the focus to the
 * button that adds one. An error names a row by its number, and taking a
 * row away renumbers the rows after it: the errors of the rows are shown
 * until a row is taken away, and again after the next attempt. The dates
 * before today are not shown: they are kept as they are.
 */
export const HoursForm = ({
  hours,
  today,
  timezone,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: HoursFormProps) => {
  const say = useSay()
  const options = useSaidChoices()
  const said = useSaidForm(message, errors)
  const week = weekPartsOf(hours.businessHours)
  const calendar = calendarPartsOf(hours.openingHours, today)
  const [opens, setOpens] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(week.map(({ weekday, opens }) => [weekday, opens])),
  )
  const dates = useRepeatedRows<DateRow, LocalizedText>(
    () =>
      calendar.dates.map((date) => ({
        shown: {
          date: date.date,
          openTime: date.openTime ?? undefined,
          closeTime: date.closeTime ?? undefined,
          isHoliday: date.isHoliday,
          holidayName: date.holidayName ?? undefined,
          notes: date.notes ?? undefined,
        },
        opens: date.openTime !== null && date.closeTime !== null,
      })),
    errors,
  )
  const dateErrors = useSaidForm(undefined, dates.errors).errors

  return (
    <Form
      submitLabel={submitLabel}
      message={said.message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <FormPart
        label={say(WORDS.week)}
        description={say(WORDS.weekDescription)}
      >
        {week.map((part) => {
          const nameOf = (property: HoursProperty): string =>
            weekdayControlOf(part.weekday, property)
          const open = opens[part.weekday] ?? false

          return (
            <FormRow
              key={part.weekday}
              label={say(termMessages.dayOfWeek[part.weekday])}
            >
              <RadioGroup
                label={say(WORDS.open)}
                name={nameOf('opens')}
                options={options(WEEKDAY_CHOICES)}
                value={open ? OPEN : CLOSED}
                onChange={(event) =>
                  setOpens({
                    ...opens,
                    [part.weekday]: event.target.value === OPEN,
                  })
                }
              />
              {open && (
                <>
                  <Times
                    nameOf={nameOf}
                    openTime={part.openTime}
                    closeTime={part.closeTime}
                    errors={said.errors}
                  />
                  <FieldRow>
                    <TextField
                      label={say(WORDS.breakStart)}
                      type='time'
                      name={nameOf('breakStart')}
                      autoComplete='off'
                      description={say(WORDS.breakDescription)}
                      defaultValue={timeInputOf(part.breakStart ?? null)}
                      error={said.errors[nameOf('breakStart')]}
                    />
                    <TextField
                      label={say(WORDS.breakEnd)}
                      type='time'
                      name={nameOf('breakEnd')}
                      autoComplete='off'
                      defaultValue={timeInputOf(part.breakEnd ?? null)}
                      error={said.errors[nameOf('breakEnd')]}
                    />
                  </FieldRow>
                </>
              )}
              {part.more && <Note size='small'>{say(WORDS.moreSlots)}</Note>}
              {part.effectivePeriod !== null && (
                <Note size='small'>
                  {say(
                    WORDS.periodKept(
                      periodNameOf(part.effectivePeriod, timezone),
                    ),
                  )}
                </Note>
              )}
            </FormRow>
          )
        })}
      </FormPart>
      <FormPart
        label={say(WORDS.dates)}
        description={say(WORDS.datesDescription)}
      >
        {dates.rows.map((row, index) => {
          const nameOf = (property: HoursProperty): string =>
            dateControlOf(index, property)

          return (
            <FormRow
              key={row.key}
              ref={dates.rowRef(row.key)}
              label={say(WORDS.row(index + 1))}
            >
              <TextField
                width='short'
                label={say(WORDS.date)}
                type='date'
                name={nameOf('date')}
                autoComplete='off'
                required
                defaultValue={row.value.shown.date}
                error={dateErrors[nameOf('date')]}
              />
              <RadioGroup
                label={say(WORDS.open)}
                name={nameOf('opens')}
                options={options(DATE_CHOICES)}
                value={row.value.opens ? OPEN : CLOSED}
                onChange={(event) =>
                  dates.change(row.key, {
                    ...row.value,
                    opens: event.target.value === OPEN,
                  })
                }
              />
              {row.value.opens && (
                <>
                  <Times
                    nameOf={nameOf}
                    openTime={row.value.shown.openTime}
                    closeTime={row.value.shown.closeTime}
                    errors={dateErrors}
                  />
                  <Checkbox
                    label={say(WORDS.holidayOpen)}
                    name={nameOf('isHoliday')}
                    description={say(WORDS.holidayOpenDescription)}
                    defaultChecked={row.value.shown.isHoliday}
                  />
                </>
              )}
              <TextField
                label={say(WORDS.holidayName)}
                name={nameOf('holidayName')}
                autoComplete='off'
                description={say(
                  WORDS.holidayNameDescription(LONGEST_HOLIDAY_NAME),
                )}
                defaultValue={row.value.shown.holidayName}
                error={dateErrors[nameOf('holidayName')]}
              />
              <TextField
                label={say(WORDS.notes)}
                name={nameOf('notes')}
                autoComplete='off'
                defaultValue={row.value.shown.notes}
                error={dateErrors[nameOf('notes')]}
              />
              <Button
                size='small'
                aria-label={say(WORDS.removeRow(index + 1))}
                onClick={() => dates.remove(row.key)}
              >
                {say(WORDS.remove)}
              </Button>
            </FormRow>
          )
        })}
        <Button
          ref={dates.addRef}
          onClick={() => dates.add({ shown: EMPTY, opens: false })}
        >
          {say(WORDS.addRow)}
        </Button>
        {calendar.past.length > 0 && (
          <Note size='small'>{say(WORDS.pastKept(calendar.past.length))}</Note>
        )}
      </FormPart>
    </Form>
  )
}
