import type {
  ModelsDayOfWeekType,
  ModelsStaffSchedule,
} from '@beauty-salon-frontend/api-client'
import {
  dayAfter,
  dayNameOf,
  isDay,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'

/*
 * The weeks of the shifts of a salon, and what the schedule of a member
 * says of a day. A week runs from Monday to Sunday, the order the API
 * lists the weekly rows of a schedule in. The times of a row are those of
 * the clock of the salon, as the API keeps them.
 */

/** The days of the week, from Monday */
export const WEEKDAYS: readonly ModelsDayOfWeekType[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** A day of the week as the screens name it: 「月曜日」. */
export const weekdayNameOf = (weekday: ModelsDayOfWeekType): string =>
  match(weekday)
    .with('monday', () => '月曜日')
    .with('tuesday', () => '火曜日')
    .with('wednesday', () => '水曜日')
    .with('thursday', () => '木曜日')
    .with('friday', () => '金曜日')
    .with('saturday', () => '土曜日')
    .with('sunday', () => '日曜日')
    .exhaustive()

/** The day of the week a day of the calendar is. */
export const weekdayOf = (day: string): ModelsDayOfWeekType =>
  match(new Date(`${day}T00:00:00Z`).getUTCDay())
    .returnType<ModelsDayOfWeekType>()
    .with(1, () => 'monday')
    .with(2, () => 'tuesday')
    .with(3, () => 'wednesday')
    .with(4, () => 'thursday')
    .with(5, () => 'friday')
    .with(6, () => 'saturday')
    .otherwise(() => 'sunday')

/** The Monday of the week a day is in. */
export const mondayOf = (day: string): string =>
  dayAfter(day, -WEEKDAYS.indexOf(weekdayOf(day)))

/** The seven days of the week that begins on a Monday. */
export const daysOfWeek = (monday: string): string[] =>
  WEEKDAYS.map((_, index) => dayAfter(monday, index))

/**
 * The week the query of an address names (`week`, a day of it), as its
 * Monday: the week of today at the salon when the query names none, or
 * no day.
 */
export const weekIn = (query: URLSearchParams, today: string): string => {
  const week = query.get('week') ?? ''

  return mondayOf(isDay(week) ? week : today)
}

/** A day as a column of a week names it: 「11/16（月）」. */
export const shortDayNameOf = (day: string): string => {
  const moment = new Date(`${day}T00:00:00Z`)
  const date = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(moment)
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(moment)

  return `${date}（${weekday}）`
}

/** A week as a heading names it: 「2026年11月16日（月）〜2026年11月22日（日）」. */
export const weekNameOf = (monday: string): string =>
  `${dayNameOf(monday)}〜${dayNameOf(dayAfter(monday, 6))}`

/**
 * The row of a schedule that applies on a day, as the API decides it: the
 * row of that date, or else the weekly row of its day of the week. None,
 * when the member does not work on the day.
 */
export const scheduleOn = (
  rows: readonly ModelsStaffSchedule[],
  day: string,
): ModelsStaffSchedule | undefined =>
  rows.find((row) => !row.isRecurring && row.date === day) ??
  rows.find((row) => row.isRecurring && row.dayOfWeek === weekdayOf(day))

/** A time of a row as the clock of the salon shows it: 「09:00」, with the seconds only when there are some. */
export const timeNameOf = (time: string): string =>
  time.length === 8 && time.endsWith(':00') ? time.slice(0, 5) : time

/** What a row says of a day: the hours worked and the break, a day off, or no row. */
export type Shift =
  | {
      type: 'works'
      hours: string
      /** The break, 「13:00〜14:00」: none for a day without one */
      rest: string | undefined
      notes: string | null
      /** The row is of that date alone, not of every week */
      once: boolean
    }
  | { type: 'off'; notes: string | null; once: boolean }
  | { type: 'none' }

/** The words of a row, or of no row: the hours 「09:00〜20:00」 with the break 「13:00〜14:00」, a day off, or none. */
export const shiftOf = (row: ModelsStaffSchedule | undefined): Shift =>
  match(row)
    .returnType<Shift>()
    .with(undefined, () => ({ type: 'none' }))
    .with(
      { isAvailable: true, startTime: P.string, endTime: P.string },
      (worked) => ({
        type: 'works',
        hours: `${timeNameOf(worked.startTime)}〜${timeNameOf(worked.endTime)}`,
        rest:
          worked.breakStartTime === null || worked.breakEndTime === null
            ? undefined
            : `${timeNameOf(worked.breakStartTime)}〜${timeNameOf(worked.breakEndTime)}`,
        notes: worked.notes,
        once: !worked.isRecurring,
      }),
    )
    // A row without hours is a day off, as the API keeps every row it does not work on
    .otherwise((off) => ({
      type: 'off',
      notes: off.notes,
      once: !off.isRecurring,
    }))
