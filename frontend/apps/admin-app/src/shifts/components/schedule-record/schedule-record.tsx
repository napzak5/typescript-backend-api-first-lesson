import type {
  ModelsDayOfWeekType,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { inJapanese, NONE, Note, Table } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import { partsOf } from '../../utils/schedule-form'
import { type Shift, shiftOf, weekdayNameOf } from '../../utils/shift-week'
import styles from './schedule-record.module.css'

export type ScheduleRecordProps = {
  /** The whole schedule, as the API lists it */
  rows: readonly ModelsStaffSchedule[]
  /** Today at the salon: the rows of the days before it are only counted */
  today: string
}

/** Whether a member works on the day of a row: the hours, a day off, or no work. */
const workOf = (shift: Shift): string =>
  match(shift)
    .with({ type: 'works' }, ({ hours }) => hours)
    .with({ type: 'off' }, () => '休み')
    .with({ type: 'none' }, () => '勤務なし')
    .exhaustive()

/** The break of the day of a row: none on a day off, or on one without a break. */
const restOf = (shift: Shift): string =>
  shift.type === 'works' ? (shift.rest ?? inJapanese(NONE)) : ''

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
  const parts = partsOf(rows, today)
  const weekly = parts.weekly.map(
    ({ weekday, row }): Weekly => ({
      weekday,
      shift: shiftOf(row),
      notes: row?.notes ?? null,
    }),
  )
  const dated = parts.dates.flatMap((row): Dated[] =>
    row.date === null
      ? []
      : [{ date: row.date, shift: shiftOf(row), notes: row.notes }],
  )

  return (
    <div className={styles['record']}>
      <Table
        caption='毎週'
        columns={[
          {
            key: 'weekday',
            header: '曜日',
            cell: ({ weekday }: Weekly) => weekdayNameOf(weekday),
          },
          { key: 'work', header: '勤務', cell: ({ shift }) => workOf(shift) },
          { key: 'rest', header: '休憩', cell: ({ shift }) => restOf(shift) },
          { key: 'notes', header: '備考', cell: ({ notes }) => notes },
        ]}
        rows={weekly}
        rowKey={({ weekday }) => weekday}
        emptyMessage='曜日はありません'
      />
      <Table
        caption='日付ごと'
        columns={[
          {
            key: 'date',
            header: '日付',
            cell: ({ date }: Dated) => inJapanese(dayNameOf(date)),
          },
          { key: 'work', header: '勤務', cell: ({ shift }) => workOf(shift) },
          { key: 'rest', header: '休憩', cell: ({ shift }) => restOf(shift) },
          { key: 'notes', header: '備考', cell: ({ notes }) => notes },
        ]}
        rows={dated}
        rowKey={({ date }) => date}
        emptyMessage='今日から後の日付の行はありません。その日だけ勤務時間を変える日や休みの日は、日付ごとの行に入れます。'
      />
      {parts.past.length > 0 && (
        <Note>
          {`今日より前の日付の行が、ほかに ${parts.past.length} 行あります。`}
        </Note>
      )}
    </div>
  )
}
