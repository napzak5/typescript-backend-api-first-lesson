import type {
  ModelsDayOfWeekType,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { NONE, Note, Table, useSay } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'
import { match } from 'ts-pattern'
import { partsOf } from '../../utils/schedule-form'
import { type Shift, shiftOf } from '../../utils/shift-week'
import styles from './schedule-record.module.css'

const { record } = adminShiftMessages

export type ScheduleRecordProps = {
  /** The whole schedule, as the API lists it */
  rows: readonly ModelsStaffSchedule[]
  /** Today at the salon: the rows of the days before it are only counted */
  today: string
}

/** Whether a member works on the day of a row: the hours, a day off, or no work. */
const workOf = (shift: Shift): LocalizedText =>
  match(shift)
    .with({ type: 'works' }, ({ hours }) => hours)
    .with({ type: 'off' }, () => record.off)
    .with({ type: 'none' }, () => record.noWork)
    .exhaustive()

/** The break of the day of a row: none on a day off, or on one without a break. */
const restOf = (shift: Shift): LocalizedText | undefined =>
  shift.type === 'works' ? (shift.rest ?? NONE) : undefined

type Weekly = {
  weekday: ModelsDayOfWeekType
  shift: Shift
  notes: string | null
}

type Dated = { date: string; shift: Shift; notes: string | null }

/**
 * The schedule of a member: the hours of every day of the week, and the
 * rows of dates from today on, which apply on their dates in place of the
 * day of the week. The rows of the days before today are counted, not
 * listed.
 */
export const ScheduleRecord = ({ rows, today }: ScheduleRecordProps) => {
  const say = useSay()
  const parts = partsOf(rows, today)
  const weekly = parts.weekly.map(
    ({ weekday, row }): Weekly => ({
      weekday,
      shift: shiftOf(row),
      notes: row?.notes ?? null,
    }),
  )
  const dated = parts.dates.map(
    (row): Dated => ({ date: row.date, shift: shiftOf(row), notes: row.notes }),
  )
  const restIn = (shift: Shift): string => {
    const rest = restOf(shift)

    return rest === undefined ? '' : say(rest)
  }

  return (
    <div className={styles['record']}>
      <Table
        caption={say(record.week)}
        columns={[
          {
            key: 'weekday',
            header: say(record.weekday),
            cell: ({ weekday }: Weekly) => say(termMessages.dayOfWeek[weekday]),
          },
          {
            key: 'work',
            header: say(record.work),
            cell: ({ shift }) => say(workOf(shift)),
          },
          {
            key: 'rest',
            header: say(record.rest),
            cell: ({ shift }) => restIn(shift),
          },
          {
            key: 'notes',
            header: say(record.notes),
            cell: ({ notes }) => notes,
          },
        ]}
        rows={weekly}
        rowKey={({ weekday }) => weekday}
        emptyMessage={say(record.noWeekdays)}
      />
      <Table
        caption={say(record.dates)}
        columns={[
          {
            key: 'date',
            header: say(record.date),
            cell: ({ date }: Dated) => say(dayNameOf(date)),
          },
          {
            key: 'work',
            header: say(record.work),
            cell: ({ shift }) => say(workOf(shift)),
          },
          {
            key: 'rest',
            header: say(record.rest),
            cell: ({ shift }) => restIn(shift),
          },
          {
            key: 'notes',
            header: say(record.notes),
            cell: ({ notes }) => notes,
          },
        ]}
        rows={dated}
        rowKey={({ date }) => date}
        emptyMessage={say(record.noDates)}
      />
      {parts.past.length > 0 && (
        <Note>{say(record.pastOf(parts.past.length))}</Note>
      )}
    </div>
  )
}
