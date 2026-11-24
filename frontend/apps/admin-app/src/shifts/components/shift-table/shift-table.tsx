import type { ModelsStaffSchedule } from '@beauty-salon-frontend/api-client'
import { Link, Table, useSay } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminShiftMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import {
  daysOfWeek,
  type Shift,
  scheduleOn,
  shiftOf,
  weekNameOf,
} from '../../utils/shift-week'
import styles from './shift-table.module.css'

const { week: WEEK } = adminShiftMessages

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
const ShiftWords = ({ shift }: ShiftWordsProps) => {
  const say = useSay()

  return match(shift)
    .with({ type: 'works' }, ({ hours, rest, once }) => (
      <span className={styles['shift']}>
        <span className={styles['time']}>{say(hours)}</span>
        {rest !== undefined && (
          // A narrow column breaks the line after the word, not inside the times
          <span>
            {say(WEEK.rest)} <span className={styles['time']}>{say(rest)}</span>
          </span>
        )}
        {once && (
          <span className={styles['once']}>{say(WEEK.onlyThisDate)}</span>
        )}
      </span>
    ))
    .with({ type: 'off' }, ({ notes, once }) => (
      <span className={styles['shift']}>
        <span>{say(WEEK.off)}</span>
        {notes !== null && <span>{notes}</span>}
        {once && (
          <span className={styles['once']}>{say(WEEK.onlyThisDate)}</span>
        )}
      </span>
    ))
    .with({ type: 'none' }, () => (
      <span className={styles['none']}>{say(WEEK.noWork)}</span>
    ))
    .exhaustive()
}

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
}: ShiftTableProps) => {
  const say = useSay()

  return (
    <Table
      caption={say(WEEK.caption(weekNameOf(monday)))}
      columns={[
        {
          key: 'member',
          header: say(WEEK.member),
          cell: ({ id, name }: ShiftMember) => (
            <Link href={scheduleHref(id)}>{name}</Link>
          ),
        },
        ...daysOfWeek(monday).map((day) => ({
          key: day,
          header: say(formats.shortDayOf(day)),
          cell: ({ rows }: ShiftMember) => (
            <ShiftWords shift={shiftOf(scheduleOn(rows, day))} />
          ),
        })),
      ]}
      rows={members}
      rowKey={({ id }) => id}
      emptyMessage={say(WEEK.none)}
    />
  )
}
