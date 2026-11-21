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
  RadioGroup,
  TextField,
} from '@beauty-salon-frontend/ui'
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
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
} from '../../schedule-form'
import { weekdayNameOf } from '../../shift-week'
import styles from './schedule-form.module.css'

export type ScheduleFormProps = {
  /** The schedule the form was opened with, as the API lists it */
  rows: readonly ModelsStaffSchedule[]
  /** Today at the salon: the rows of the days before it are kept out of sight */
  today: string
  submitLabel: string
  message?: string | undefined
  errors?: FormErrors | undefined
  pending?: boolean | undefined
  actions?: ReactNode
  onSubmit: (values: FormData) => void
}

/** A row of a date the form holds */
type DateRow = {
  key: number
  shown: ModelsStaffSchedule | undefined
  works: boolean
}

/** Where the focus goes after a row was added or taken away */
type Focus = { type: 'row'; key: number } | { type: 'add' } | undefined

const NO_ERRORS: FormErrors = {}

type HoursProps = {
  nameOf: (property: ScheduleProperty) => string
  shown: ModelsStaffSchedule | undefined
  errors: FormErrors
}

/** The hours of a day the member works on, and the break, at the clock of the salon. */
const Hours = ({ nameOf, shown, errors }: HoursProps) => (
  <>
    <FieldRow>
      <TextField
        label='始まり'
        type='time'
        name={nameOf('startTime')}
        autoComplete='off'
        required
        defaultValue={timeInputOf(shown?.startTime ?? null)}
        error={errors[nameOf('startTime')]}
      />
      <TextField
        label='終わり'
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
        label='休憩の始まり'
        type='time'
        name={nameOf('breakStartTime')}
        autoComplete='off'
        description='休憩がないときは、始まりも終わりも空にします。'
        defaultValue={timeInputOf(shown?.breakStartTime ?? null)}
        error={errors[nameOf('breakStartTime')]}
      />
      <TextField
        label='休憩の終わり'
        type='time'
        name={nameOf('breakEndTime')}
        autoComplete='off'
        defaultValue={timeInputOf(shown?.breakEndTime ?? null)}
        error={errors[nameOf('breakEndTime')]}
      />
    </FieldRow>
  </>
)

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
  const [rows, setRows] = useState<DateRow[]>(() =>
    parts.dates.map((shown, key) => ({
      key,
      shown,
      works: shown.isAvailable,
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
    setRows([...rows, { key: nextKey, shown: undefined, works: false }])
    setNextKey(nextKey + 1)
    setFocus({ type: 'row', key: nextKey })
  }

  const removeRow = (key: number): void => {
    setRows(rows.filter((row) => row.key !== key))
    setOutdated(errors)
    setFocus({ type: 'add' })
  }

  const choose = (key: number, works: boolean): void => {
    setRows(rows.map((row) => (row.key === key ? { ...row, works } : row)))
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
      <FormPart
        label='毎週'
        description='曜日ごとの勤務時間です。時刻は、サロンの時計の時刻です。勤務しない曜日に備考を書くと、休みの理由として残ります。'
      >
        {parts.weekly.map(({ weekday, row }) => {
          const nameOf = (property: ScheduleProperty): string =>
            weeklyControlOf(weekday, property)
          const works = weekly[weekday] ?? false

          return (
            <fieldset key={weekday} className={styles['row']}>
              <legend className={styles['rowName']}>
                {weekdayNameOf(weekday)}
              </legend>
              <div className={styles['rowControls']}>
                <RadioGroup
                  label='勤務'
                  name={nameOf('works')}
                  options={[
                    { value: WORKS, label: '勤務する' },
                    { value: OFF, label: '勤務しない' },
                  ]}
                  value={works ? WORKS : OFF}
                  onChange={(event) =>
                    setWeekly({
                      ...weekly,
                      [weekday]: event.target.value === WORKS,
                    })
                  }
                />
                {works && <Hours nameOf={nameOf} shown={row} errors={errors} />}
                <TextField
                  label='備考'
                  name={nameOf('notes')}
                  autoComplete='off'
                  defaultValue={row?.notes ?? undefined}
                  error={errors[nameOf('notes')]}
                />
              </div>
            </fieldset>
          )
        })}
      </FormPart>
      <FormPart
        label='日付ごと'
        description='その日だけ勤務時間を変える日や、休みの日です。日付ごとの行がある日は、曜日の勤務時間の代わりに、その行を使います。'
      >
        {rows.map((row, index) => {
          const nameOf = (property: ScheduleProperty): string =>
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
                  autoComplete='off'
                  required
                  defaultValue={row.shown?.date ?? undefined}
                  error={said[nameOf('date')]}
                />
                <RadioGroup
                  label='勤務'
                  name={nameOf('works')}
                  options={[
                    { value: WORKS, label: '勤務する' },
                    { value: OFF, label: '休み' },
                  ]}
                  value={row.works ? WORKS : OFF}
                  onChange={(event) =>
                    choose(row.key, event.target.value === WORKS)
                  }
                />
                {row.works && (
                  <Hours nameOf={nameOf} shown={row.shown} errors={said} />
                )}
                <TextField
                  label='備考'
                  name={nameOf('notes')}
                  autoComplete='off'
                  description='休みの理由（有給休暇、研修など）や、勤務時間を変える理由です。'
                  defaultValue={row.shown?.notes ?? undefined}
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
        {rows.length + parts.past.length < MOST_DATES ? (
          <Button className={styles['add']} ref={add} onClick={addRow}>
            日付の行を足す
          </Button>
        ) : (
          <p className={styles['note']}>
            {`日付ごとの行は、今日より前の行と合わせて ${MOST_DATES} 行まで入れられます。`}
          </p>
        )}
        {parts.past.length > 0 && (
          <Checkbox
            name={DROP_PAST}
            label={`今日より前の日付の行（${parts.past.length} 行）を消す`}
            description='消さないときは、そのまま残ります。済んだ日の行は、シフトに使われません。'
          />
        )}
      </FormPart>
    </Form>
  )
}
