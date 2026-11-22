import { upTo } from '@beauty-salon-frontend/fields'
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
} from '@beauty-salon-frontend/ui'
import { type ReactNode, useState } from 'react'
import { timeInputOf } from '../../../shifts/schedule-form'
import { weekdayNameOf } from '../../../shifts/shift-week'
import type { Hours } from '../../hours-api'
import {
  CLOSED,
  calendarPartsOf,
  dateControlOf,
  type HoursProperty,
  LONGEST_HOLIDAY_NAME,
  OPEN,
  weekdayControlOf,
  weekPartsOf,
} from '../../hours-form'
import { periodNameOf } from '../../settings-format'

export type HoursFormProps = {
  /** The hours the form was opened with, as the API keeps them */
  hours: Hours
  /** Today at the salon: the dates before it are kept out of sight */
  today: string
  /** The time zone of the salon, which the period of hours is named in */
  timezone: string
  submitLabel: string
  message?: string | undefined
  errors?: FormErrors | undefined
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
const Times = ({ nameOf, openTime, closeTime, errors }: TimesProps) => (
  <FieldRow>
    <TextField
      label='開店'
      type='time'
      name={nameOf('openTime')}
      autoComplete='off'
      required
      defaultValue={timeInputOf(openTime ?? null)}
      error={errors[nameOf('openTime')]}
    />
    <TextField
      label='閉店'
      type='time'
      name={nameOf('closeTime')}
      autoComplete='off'
      required
      defaultValue={timeInputOf(closeTime ?? null)}
      error={errors[nameOf('closeTime')]}
    />
  </FieldRow>
)

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
  const week = weekPartsOf(hours.businessHours)
  const calendar = calendarPartsOf(hours.openingHours, today)
  const [opens, setOpens] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(week.map(({ weekday, opens }) => [weekday, opens])),
  )
  const dates = useRepeatedRows<DateRow>(
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
  return (
    <Form
      submitLabel={submitLabel}
      message={message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <FormPart
        label='毎週'
        description='曜日ごとの営業時間です。時刻は、サロンの時計の時刻です。お客様の予約の空き枠は、営業時間から休憩を除いた時間にできます。'
      >
        {week.map((part) => {
          const nameOf = (property: HoursProperty): string =>
            weekdayControlOf(part.weekday, property)
          const open = opens[part.weekday] ?? false

          return (
            <FormRow key={part.weekday} label={weekdayNameOf(part.weekday)}>
              <RadioGroup
                label='営業'
                name={nameOf('opens')}
                options={[
                  { value: OPEN, label: '営業する' },
                  { value: CLOSED, label: '休業' },
                ]}
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
                    errors={errors}
                  />
                  <FieldRow>
                    <TextField
                      label='休憩の始まり'
                      type='time'
                      name={nameOf('breakStart')}
                      autoComplete='off'
                      description='休憩がないときは、始まりも終わりも空にします。'
                      defaultValue={timeInputOf(part.breakStart ?? null)}
                      error={errors[nameOf('breakStart')]}
                    />
                    <TextField
                      label='休憩の終わり'
                      type='time'
                      name={nameOf('breakEnd')}
                      autoComplete='off'
                      defaultValue={timeInputOf(part.breakEnd ?? null)}
                      error={errors[nameOf('breakEnd')]}
                    />
                  </FieldRow>
                </>
              )}
              {part.more && (
                <Note size='small'>
                  この曜日には、営業時間か休憩が 2
                  つ以上あります。毎週の営業時間を変えて保存すると、最初の営業時間と最初の休憩だけが残ります。
                </Note>
              )}
              {part.effectivePeriod !== null && (
                <Note size='small'>
                  {`この曜日の営業時間は、${periodNameOf(part.effectivePeriod, timezone)}です。期間は、この画面では変えません。`}
                </Note>
              )}
            </FormRow>
          )
        })}
      </FormPart>
      <FormPart
        label='日付ごと'
        description='祝日、臨時休業、短縮営業の日です。日付ごとの行がある日は、曜日の営業時間の代わりに、その行を使います。'
      >
        {dates.rows.map((row, index) => {
          const nameOf = (property: HoursProperty): string =>
            dateControlOf(index, property)

          return (
            <FormRow
              key={row.key}
              ref={dates.rowRef(row.key)}
              label={`${index + 1} 行目`}
            >
              <TextField
                width='short'
                label='日付'
                type='date'
                name={nameOf('date')}
                autoComplete='off'
                required
                defaultValue={row.value.shown.date}
                error={dates.errors[nameOf('date')]}
              />
              <RadioGroup
                label='営業'
                name={nameOf('opens')}
                options={[
                  { value: OPEN, label: '営業する' },
                  { value: CLOSED, label: '終日休業' },
                ]}
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
                    errors={dates.errors}
                  />
                  <Checkbox
                    label='祝日の営業'
                    name={nameOf('isHoliday')}
                    description='祝日や店休日に、時間を決めて営業する日に印を付けます。'
                    defaultChecked={row.value.shown.isHoliday}
                  />
                </>
              )}
              <TextField
                label='祝日・休業日の名前'
                name={nameOf('holidayName')}
                autoComplete='off'
                description={`${upTo(LONGEST_HOLIDAY_NAME)}「元日」「年末年始」「設備の点検」など。`}
                defaultValue={row.value.shown.holidayName}
                error={dates.errors[nameOf('holidayName')]}
              />
              <TextField
                label='備考'
                name={nameOf('notes')}
                autoComplete='off'
                defaultValue={row.value.shown.notes}
                error={dates.errors[nameOf('notes')]}
              />
              <Button
                size='small'
                aria-label={`${index + 1} 行目を外す`}
                onClick={() => dates.remove(row.key)}
              >
                外す
              </Button>
            </FormRow>
          )
        })}
        <Button
          ref={dates.addRef}
          onClick={() => dates.add({ shown: EMPTY, opens: false })}
        >
          日付の行を足す
        </Button>
        {calendar.past.length > 0 && (
          <Note size='small'>
            {`今日より前の日付（${calendar.past.length} 行）は、記録としてそのまま残ります。`}
          </Note>
        )}
      </FormPart>
    </Form>
  )
}
