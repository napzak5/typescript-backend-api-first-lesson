import type {
  ModelsDayOfWeekType,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'
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
  useSaidForm,
  useSay,
} from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { type ReactNode, useState } from 'react'
import {
  DROP_PAST,
  dateControlOf,
  MOST_DATES,
  OFF,
  partsOf,
  type ScheduleProperty,
  timeInputOf,
  WORKS,
  weeklyControlOf,
} from '../../utils/schedule-form'

const { form } = adminShiftMessages

export type ScheduleFormProps = {
  /** The schedule the form was opened with, as the API lists it */
  rows: readonly ModelsStaffSchedule[]
  /** Today at the salon: the rows of the days before it are kept out of sight */
  today: string
  submitLabel: string
  /** What is said about the whole attempt, in the language of the page */
  message?: LocalizedText | undefined
  /** What is wrong with the values, under the names of the controls. A new object is the answer to another attempt */
  errors?: FormErrors<LocalizedText> | undefined
  pending?: boolean | undefined
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/** A row of a date the form holds: what it opened with, if anything, and whether the member works on the date */
type DateRow = {
  shown: ModelsStaffSchedule | undefined
  works: boolean
}

type HoursProps = {
  nameOf: (property: ScheduleProperty) => string
  shown: ModelsStaffSchedule | undefined
  errors: FormErrors
}

/** The hours of a day the member works on, and the break, at the clock of the salon. */
const Hours = ({ nameOf, shown, errors }: HoursProps) => {
  const say = useSay()

  return (
    <>
      <FieldRow>
        <TextField
          label={say(form.start)}
          type='time'
          name={nameOf('startTime')}
          autoComplete='off'
          required
          defaultValue={timeInputOf(shown?.startTime ?? null)}
          error={errors[nameOf('startTime')]}
        />
        <TextField
          label={say(form.end)}
          type='time'
          name={nameOf('endTime')}
          autoComplete='off'
          required
          defaultValue={timeInputOf(shown?.endTime ?? null)}
          error={errors[nameOf('endTime')]}
        />
      </FieldRow>
      <FieldRow>
        <TextField
          label={say(form.breakStart)}
          type='time'
          name={nameOf('breakStartTime')}
          autoComplete='off'
          description={say(form.breakDescription)}
          defaultValue={timeInputOf(shown?.breakStartTime ?? null)}
          error={errors[nameOf('breakStartTime')]}
        />
        <TextField
          label={say(form.breakEnd)}
          type='time'
          name={nameOf('breakEndTime')}
          autoComplete='off'
          defaultValue={timeInputOf(shown?.breakEndTime ?? null)}
          error={errors[nameOf('breakEndTime')]}
        />
      </FieldRow>
    </>
  )
}

/**
 * The schedule of a member: a part for every day of the week, and the rows
 * of dates from today on, which apply on their dates in place of the day
 * of the week. A day the member works on asks for the hours, and takes a
 * break; a day off takes a note.
 *
 * A row of a date is a group of its own: one is added at the end and its
 * date takes the focus, one that is taken away gives the focus to the
 * button that adds one. An error names a row by its number, and taking a
 * row away renumbers the rows after it: the errors of the rows are shown
 * until a row is taken away, and again after the next attempt. The rows
 * of the days before today are not shown: they are kept, unless the form
 * is told to remove them.
 */
export const ScheduleForm = ({
  rows: schedule,
  today,
  submitLabel,
  message,
  errors = NO_ERRORS,
  pending,
  actions,
  onSubmit,
}: ScheduleFormProps) => {
  const say = useSay()
  const said = useSaidForm(message, errors)
  const parts = partsOf(schedule, today)
  const [weekly, setWeekly] = useState<
    Partial<Record<ModelsDayOfWeekType, boolean>>
  >(() =>
    Object.fromEntries(
      parts.weekly.map(({ weekday, row }) => [
        weekday,
        row?.isAvailable ?? false,
      ]),
    ),
  )
  const dates = useRepeatedRows<DateRow, LocalizedText>(
    () => parts.dates.map((shown) => ({ shown, works: shown.isAvailable })),
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
      <FormPart label={say(form.week)} description={say(form.weekDescription)}>
        {parts.weekly.map(({ weekday, row }) => {
          const nameOf = (property: ScheduleProperty): string =>
            weeklyControlOf(weekday, property)
          const works = weekly[weekday] ?? false

          return (
            <FormRow key={weekday} label={say(termMessages.dayOfWeek[weekday])}>
              <RadioGroup
                label={say(form.work)}
                name={nameOf('works')}
                options={[
                  { value: WORKS, label: say(form.works) },
                  { value: OFF, label: say(form.worksNot) },
                ]}
                value={works ? WORKS : OFF}
                onChange={(event) =>
                  setWeekly({
                    ...weekly,
                    [weekday]: event.target.value === WORKS,
                  })
                }
              />
              {works && (
                <Hours nameOf={nameOf} shown={row} errors={said.errors} />
              )}
              <TextField
                label={say(form.notes)}
                name={nameOf('notes')}
                autoComplete='off'
                defaultValue={row?.notes ?? undefined}
                error={said.errors[nameOf('notes')]}
              />
            </FormRow>
          )
        })}
      </FormPart>
      <FormPart
        label={say(form.dates)}
        description={say(form.datesDescription)}
      >
        {dates.rows.map((row, index) => {
          const nameOf = (property: ScheduleProperty): string =>
            dateControlOf(index, property)

          return (
            <FormRow
              key={row.key}
              ref={dates.rowRef(row.key)}
              label={say(form.row(index + 1))}
            >
              <TextField
                width='short'
                label={say(form.date)}
                type='date'
                name={nameOf('date')}
                autoComplete='off'
                required
                defaultValue={row.value.shown?.date ?? undefined}
                error={dateErrors[nameOf('date')]}
              />
              <RadioGroup
                label={say(form.work)}
                name={nameOf('works')}
                options={[
                  { value: WORKS, label: say(form.works) },
                  { value: OFF, label: say(form.off) },
                ]}
                value={row.value.works ? WORKS : OFF}
                onChange={(event) =>
                  dates.change(row.key, {
                    ...row.value,
                    works: event.target.value === WORKS,
                  })
                }
              />
              {row.value.works && (
                <Hours
                  nameOf={nameOf}
                  shown={row.value.shown}
                  errors={dateErrors}
                />
              )}
              <TextField
                label={say(form.notes)}
                name={nameOf('notes')}
                autoComplete='off'
                description={say(form.notesDescription)}
                defaultValue={row.value.shown?.notes ?? undefined}
                error={dateErrors[nameOf('notes')]}
              />
              <Button
                size='small'
                aria-label={say(form.removeRow(index + 1))}
                onClick={() => dates.remove(row.key)}
              >
                {say(form.remove)}
              </Button>
            </FormRow>
          )
        })}
        {dates.rows.length + parts.past.length < MOST_DATES ? (
          <Button
            ref={dates.addRef}
            onClick={() => dates.add({ shown: undefined, works: false })}
          >
            {say(form.addRow)}
          </Button>
        ) : (
          <Note size='small'>{say(form.mostDates(MOST_DATES))}</Note>
        )}
        {parts.past.length > 0 && (
          <Checkbox
            name={DROP_PAST}
            label={say(form.dropPast(parts.past.length))}
            description={say(form.dropPastDescription)}
          />
        )}
      </FormPart>
    </Form>
  )
}
