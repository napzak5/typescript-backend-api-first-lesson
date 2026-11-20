import type { ModelsStaffSchedule } from '@beauty-salon-frontend/api-client'
import { Link, Table } from '@beauty-salon-frontend/ui'
import { match } from 'ts-pattern'
import {
  daysOfWeek,
  type Shift,
  scheduleOn,
  shiftOf,
  shortDayNameOf,
  weekNameOf,
} from '../../shift-week'
import styles from './shift-table.module.css'

/** A member of the staff and their schedule */
export type ShiftMember = {
  id: string
  /** The name the customers see */
  name: string
  rows: readonly ModelsStaffSchedule[]
}

export type ShiftTableProps = {
  /** The Monday of the week */
  monday: string
  members: readonly ShiftMember[]
  /** The address of the schedule of a member */
  scheduleHref: (staffId: string) => string
}

type ShiftWordsProps = { shift: Shift }

/** What a member does on a day: the hours and the break, a day off with its note, or no work. */
const ShiftWords = ({ shift }: ShiftWordsProps) =>
  match(shift)
    .with({ type: 'works' }, ({ hours, rest, once }) => (
      <span className={styles['shift']}>
        <span className={styles['time']}>{hours}</span>
        {rest !== undefined && (
          // A narrow column breaks the line after the word, not inside the times
          <span>
            休憩 <span className={styles['time']}>{rest}</span>
          </span>
        )}
        {once && <span className={styles['once']}>（この日だけ）</span>}
      </span>
    ))
    .with({ type: 'off' }, ({ notes, once }) => (
      <span className={styles['shift']}>
        <span>休み</span>
        {notes !== null && <span>{notes}</span>}
        {once && <span className={styles['once']}>（この日だけ）</span>}
      </span>
    ))
    .with({ type: 'none' }, () => (
      <span className={styles['none']}>勤務なし</span>
    ))
    .exhaustive()

/**
 * The shifts of a week: a row for every member, by the name that leads to
 * their schedule, and a column for every day from Monday. A day says the
 * row of the schedule that applies on it: that of its date, or else that
 * of its day of the week.
 */
export const ShiftTable = ({
  monday,
  members,
  scheduleHref,
}: ShiftTableProps) => (
  <Table
    caption={`${weekNameOf(monday)}のシフト`}
    columns={[
      {
        key: 'member',
        header: 'スタッフ',
        cell: ({ id, name }: ShiftMember) => (
          <Link href={scheduleHref(id)}>{name}</Link>
        ),
      },
      ...daysOfWeek(monday).map((day) => ({
        key: day,
        header: shortDayNameOf(day),
        cell: ({ rows }: ShiftMember) => (
          <ShiftWords shift={shiftOf(scheduleOn(rows, day))} />
        ),
      })),
    ]}
    rows={members}
    rowKey={({ id }) => id}
    emptyMessage='スタッフはいません'
  />
)
