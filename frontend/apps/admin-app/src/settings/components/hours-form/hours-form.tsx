import {
  Button,
  Checkbox,
  Form,
  type FormErrors,
  RadioGroup,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { timeInputOf } from '../../../shifts/schedule-form'
import { weekdayNameOf } from '../../../shifts/shift-week'
import type { Hours } from '../../hours-api'
import {
  CLOSED,
  calendarPartsOf,
  dateControlOf,
  type HoursProperty,
  OPEN,
  weekdayControlOf,
  weekPartsOf,
} from '../../hours-form'
import { periodNameOf } from '../../settings-format'
import styles from './hours-form.module.css'

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

/** A row of a date the form holds */
type DateRow = { key: number; shown: Shown; opens: boolean }

/** Where the focus goes after a row was added or taken away */
type Focus = { type: 'row'; key: number } | { type: 'add' } | undefined

const NO_ERRORS: FormErrors = {}

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
  <div className={styles['pair']}>
    <TextField
      label='開店'
      type='time'
      name={nameOf('openTime')}
      required
      defaultValue={timeInputOf(openTime ?? null)}
      error={errors[nameOf('openTime')]}
    />
    <TextField
      label='閉店'
      type='time'
      name={nameOf('closeTime')}
      required
      defaultValue={timeInputOf(closeTime ?? null)}
      error={errors[nameOf('closeTime')]}
    />
  </div>
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
  const [rows, setRows] = useState<DateRow[]>(() =>
    calendar.dates.map((date, key) => ({
      key,
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
  )
  const [nextKey, setNextKey] = useState(rows.length)
  const [focus, setFocus] = useState<Focus>()
  const [outdated, setOutdated] = useState<FormErrors | undefined>(undefined)
  const said = errors === outdated ? NO_ERRORS : errors
  const groups = useRef(new Map<number, HTMLFieldSetElement>())
  const add = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (focus?.type === 'row') {
      groups.current.get(focus.key)?.querySelector('input')?.focus()
    }
    if (focus?.type === 'add') {
      add.current?.focus()
    }
  }, [focus])

  const addRow = (): void => {
    setRows([...rows, { key: nextKey, shown: EMPTY, opens: false }])
    setNextKey(nextKey + 1)
    setFocus({ type: 'row', key: nextKey })
  }

  const removeRow = (key: number): void => {
    setRows(rows.filter((row) => row.key !== key))
    setOutdated(errors)
    setFocus({ type: 'add' })
  }

  const choose = (key: number, open: boolean): void => {
    setRows(
      rows.map((row) => (row.key === key ? { ...row, opens: open } : row)),
    )
  }

  return (
    <Form
      submitLabel={submitLabel}
      message={message}
      errors={errors}
      pending={pending}
      actions={actions}
      onSubmit={onSubmit}
    >
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>毎週</legend>
        <div className={styles['controls']}>
          <p className={styles['note']}>
            曜日ごとの営業時間です。時刻は、サロンの時計の時刻です。お客様の予約の空き枠は、営業時間から休憩を除いた時間にできます。
          </p>
          {week.map((part) => {
            const nameOf = (property: HoursProperty): string =>
              weekdayControlOf(part.weekday, property)
            const open = opens[part.weekday] ?? false

            return (
              <fieldset key={part.weekday} className={styles['row']}>
                <legend className={styles['rowName']}>
                  {weekdayNameOf(part.weekday)}
                </legend>
                <div className={styles['rowControls']}>
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
                      <div className={styles['pair']}>
                        <TextField
                          label='休憩の始まり'
                          type='time'
                          name={nameOf('breakStart')}
                          description='休憩がないときは、始まりも終わりも空にします。'
                          defaultValue={timeInputOf(part.breakStart ?? null)}
                          error={errors[nameOf('breakStart')]}
                        />
                        <TextField
                          label='休憩の終わり'
                          type='time'
                          name={nameOf('breakEnd')}
                          defaultValue={timeInputOf(part.breakEnd ?? null)}
                          error={errors[nameOf('breakEnd')]}
                        />
                      </div>
                    </>
                  )}
                  {part.more && (
                    <p className={styles['note']}>
                      この曜日には、営業時間か休憩が 2
                      つ以上あります。毎週の営業時間を変えて保存すると、最初の営業時間と最初の休憩だけが残ります。
                    </p>
                  )}
                  {part.effectivePeriod !== null && (
                    <p className={styles['note']}>
                      {`この曜日の営業時間は、${periodNameOf(part.effectivePeriod, timezone)}です。期間は、この画面では変えません。`}
                    </p>
                  )}
                </div>
              </fieldset>
            )
          })}
        </div>
      </fieldset>
      <fieldset className={styles['part']}>
        <legend className={styles['name']}>日付ごと</legend>
        <div className={styles['controls']}>
          <p className={styles['note']}>
            祝日、臨時休業、短縮営業の日です。日付ごとの行がある日は、曜日の営業時間の代わりに、その行を使います。
          </p>
          {rows.map((row, index) => {
            const nameOf = (property: HoursProperty): string =>
              dateControlOf(index, property)

            return (
              <fieldset
                key={row.key}
                className={styles['row']}
                ref={(group) => {
                  if (group === null) {
                    groups.current.delete(row.key)
                  } else {
                    groups.current.set(row.key, group)
                  }
                }}
              >
                <legend className={styles['rowName']}>
                  {`${index + 1} 行目`}
                </legend>
                <div className={styles['rowControls']}>
                  <TextField
                    className={styles['short']}
                    label='日付'
                    type='date'
                    name={nameOf('date')}
                    required
                    defaultValue={row.shown.date}
                    error={said[nameOf('date')]}
                  />
                  <RadioGroup
                    label='営業'
                    name={nameOf('opens')}
                    options={[
                      { value: OPEN, label: '営業する' },
                      { value: CLOSED, label: '終日休業' },
                    ]}
                    value={row.opens ? OPEN : CLOSED}
                    onChange={(event) =>
                      choose(row.key, event.target.value === OPEN)
                    }
                  />
                  {row.opens && (
                    <>
                      <Times
                        nameOf={nameOf}
                        openTime={row.shown.openTime}
                        closeTime={row.shown.closeTime}
                        errors={said}
                      />
                      <Checkbox
                        label='祝日の営業'
                        name={nameOf('isHoliday')}
                        description='祝日や店休日に、時間を決めて営業する日に印を付けます。'
                        defaultChecked={row.shown.isHoliday}
                      />
                    </>
                  )}
                  <TextField
                    label='祝日・休業日の名前'
                    name={nameOf('holidayName')}
                    autoComplete='off'
                    description='100 文字まで。「元日」「年末年始」「設備の点検」など。'
                    defaultValue={row.shown.holidayName}
                    error={said[nameOf('holidayName')]}
                  />
                  <TextField
                    label='備考'
                    name={nameOf('notes')}
                    autoComplete='off'
                    defaultValue={row.shown.notes}
                    error={said[nameOf('notes')]}
                  />
                  <Button
                    className={styles['remove']}
                    size='small'
                    aria-label={`${index + 1} 行目を外す`}
                    onClick={() => removeRow(row.key)}
                  >
                    外す
                  </Button>
                </div>
              </fieldset>
            )
          })}
          <Button className={styles['add']} ref={add} onClick={addRow}>
            日付の行を足す
          </Button>
          {calendar.past.length > 0 && (
            <p className={styles['note']}>
              {`今日より前の日付（${calendar.past.length} 行）は、記録としてそのまま残ります。`}
            </p>
          )}
        </div>
      </fieldset>
    </Form>
  )
}
