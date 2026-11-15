import { describe, expect, it } from 'vitest'
import { scheduleOn } from '../business-logic/staff-schedule/_shared/applicable-schedule'
import type { DbStaffSchedule } from '../models/staff-schedule'
import {
  dayOffEntry,
  dbStaffSchedule,
  singleDayEntry,
  weeklyEntry,
} from './staff-schedule-fixtures'

const monday = dbStaffSchedule({ id: 'monday', ...weeklyEntry() })
const wednesdayOff = dbStaffSchedule({
  id: 'wednesday-off',
  ...dayOffEntry({ dayOfWeek: 'wednesday', date: null, isRecurring: true }),
})
const sunday = dbStaffSchedule({
  id: 'sunday',
  ...weeklyEntry({ dayOfWeek: 'sunday' }),
})
// 2026-12-28 is a Monday, 2026-12-30 a Wednesday, 2026-12-31 a Thursday.
const shortMonday = dbStaffSchedule({
  id: 'short-monday',
  ...singleDayEntry({ date: '2026-12-28' }),
})
const workingWednesday = dbStaffSchedule({
  id: 'working-wednesday',
  ...singleDayEntry({ date: '2026-12-30' }),
})
const thursday = dbStaffSchedule({ id: 'thursday', ...singleDayEntry() })
const mondayOff = dbStaffSchedule({
  id: 'monday-off',
  ...dayOffEntry({ date: '2027-01-04' }),
})

const schedules: DbStaffSchedule[] = [
  monday,
  wednesdayOff,
  sunday,
  shortMonday,
  workingWednesday,
  thursday,
  mondayOff,
]

describe('scheduleOn', () => {
  it.each([
    ['a Monday', '2026-12-21', monday],
    ['another Monday, years later', '2031-03-03', monday],
    ['a Monday in the past', '2020-01-06', monday],
    ['a Sunday', '2027-01-03', sunday],
    ['29 February of a leap year, a Sunday', '2032-02-29', sunday],
  ])(
    'returns the weekly row of the day of the week on %s',
    (_case, date, row) => {
      expect(scheduleOn(schedules, date)).toBe(row)
    },
  )

  it('returns the weekly row of a day off: the row that applies need not be a working day', () => {
    expect(scheduleOn(schedules, '2026-12-23')).toBe(wednesdayOff)
  })

  it.each([
    ['a Tuesday', '2026-12-29'],
    ['a Thursday without a row of its own', '2026-12-24'],
    ['a Friday', '2027-01-01'],
    ['a Saturday', '2027-01-02'],
  ])('returns null on %s, a day of the week without a row', (_case, date) => {
    expect(scheduleOn(schedules, date)).toBeNull()
  })

  it('returns the row of a single day on its date, on a day of the week without a weekly row', () => {
    expect(scheduleOn(schedules, '2026-12-31')).toBe(thursday)
  })

  it.each([
    ['working hours of its own', '2026-12-28', shortMonday],
    ['a day off', '2027-01-04', mondayOff],
    [
      'a working day where the weekly row is a day off',
      '2026-12-30',
      workingWednesday,
    ],
  ])(
    'returns the row of a single day in place of the weekly row: %s',
    (_case, date, row) => {
      expect(scheduleOn(schedules, date)).toBe(row)
    },
  )

  it('returns the row of the single day whichever of the two rows comes first', () => {
    expect(scheduleOn([shortMonday, monday], '2026-12-28')).toBe(shortMonday)
    expect(scheduleOn([monday, shortMonday], '2026-12-28')).toBe(shortMonday)
  })

  it('returns to the weekly row a week after the single day', () => {
    expect(scheduleOn(schedules, '2027-01-11')).toBe(monday)
  })

  it('returns null for a schedule without rows', () => {
    expect(scheduleOn([], '2026-12-28')).toBeNull()
  })

  it('returns null for a schedule of single days alone on another date', () => {
    expect(scheduleOn([shortMonday, thursday], '2026-12-29')).toBeNull()
  })

  it.each([
    ['a word', 'monday'],
    ['a date that does not exist', '2026-02-30'],
    ['an empty text', ''],
  ])('returns null for %s, which names no day', (_case, text) => {
    expect(scheduleOn(schedules, text)).toBeNull()
  })
})
