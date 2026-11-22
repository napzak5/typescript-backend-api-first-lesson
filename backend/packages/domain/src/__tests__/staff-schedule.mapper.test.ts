import { describe, expect, it } from 'vitest'
import { StaffScheduleReadMapper } from '../mappers/read/staff-schedule.mapper'
import { StaffScheduleWriteMapper } from '../mappers/write/staff-schedule.mapper'
import {
  dayOffEntry,
  dbStaffSchedule,
  singleDayEntry,
  weeklyEntry,
} from './staff-schedule-fixtures'

const PROPERTIES = [
  'dayOfWeek',
  'date',
  'startTime',
  'endTime',
  'breakStartTime',
  'breakEndTime',
  'isRecurring',
  'isAvailable',
  'notes',
]

describe('StaffScheduleReadMapper.toApiStaffSchedule', () => {
  it('returns the properties of an entry under the names of the columns, with their values unchanged', () => {
    expect(
      StaffScheduleReadMapper.toApiStaffSchedule(dbStaffSchedule()),
    ).toEqual(weeklyEntry())
  })

  it('leaves out the ID of the row, the staff member and the timestamps', () => {
    const entry = StaffScheduleReadMapper.toApiStaffSchedule(dbStaffSchedule())

    expect(Object.keys(entry).toSorted()).toEqual(PROPERTIES.toSorted())
  })

  it('does not pass on what a row carries beyond its columns', () => {
    const row = { ...dbStaffSchedule(), baseSalary: 300000 }

    const entry = StaffScheduleReadMapper.toApiStaffSchedule(row)

    expect(Object.keys(entry).toSorted()).toEqual(PROPERTIES.toSorted())
  })

  it.each([
    ['an entry of a single day', singleDayEntry()],
    ['a day off, whose times are null', dayOffEntry()],
    [
      'a weekly day off',
      dayOffEntry({ dayOfWeek: 'sunday', date: null, isRecurring: true }),
    ],
    ['an entry without notes', weeklyEntry({ notes: null })],
  ])('maps %s', (_case, entry) => {
    expect(
      StaffScheduleReadMapper.toApiStaffSchedule(dbStaffSchedule(entry)),
    ).toEqual(entry)
  })

  it.each(PROPERTIES)('takes %s from the column of that name', (property) => {
    const marked = { ...dbStaffSchedule(), [property]: `<${property}>` }

    const entry = StaffScheduleReadMapper.toApiStaffSchedule(marked)

    expect(entry).toEqual({ ...weeklyEntry(), [property]: `<${property}>` })
  })
})

describe('StaffScheduleWriteMapper.fromUpdateRequest', () => {
  it('turns no entries into no rows', () => {
    expect(StaffScheduleWriteMapper.fromUpdateRequest([])).toEqual([])
  })

  it('turns every entry into a row with the same properties, in the order of the request', () => {
    const request = [
      singleDayEntry(),
      weeklyEntry(),
      dayOffEntry(),
      weeklyEntry({ dayOfWeek: 'sunday', notes: '早番' }),
    ]

    expect(StaffScheduleWriteMapper.fromUpdateRequest(request)).toEqual(request)
  })

  it('keeps a time as it was given: the database reads it without seconds', () => {
    const entry = weeklyEntry({ startTime: '09:00', endTime: '18:30' })

    expect(StaffScheduleWriteMapper.fromUpdateRequest([entry])).toEqual([entry])
  })

  it('writes only the columns of an entry', () => {
    const entry = { ...weeklyEntry(), id: 'chosen-by-the-client', staffId: 'x' }

    const [row] = StaffScheduleWriteMapper.fromUpdateRequest([entry])

    expect(Object.keys(row ?? {}).toSorted()).toEqual(PROPERTIES.toSorted())
  })

  it.each(PROPERTIES)('writes %s to the column of that name', (property) => {
    const marked = { ...weeklyEntry(), [property]: `<${property}>` }

    expect(StaffScheduleWriteMapper.fromUpdateRequest([marked])).toEqual([
      marked,
    ])
  })
})

describe('StaffScheduleWriteMapper.fromSearchRequest', () => {
  it('asks about the day the request names', () => {
    expect(
      StaffScheduleWriteMapper.fromSearchRequest({ date: '2026-11-16' }),
    ).toStrictEqual({ date: '2026-11-16' })
  })

  it('asks about no day, the whole schedule, when the request names none', () => {
    expect(StaffScheduleWriteMapper.fromSearchRequest({})).toStrictEqual({
      date: null,
    })
  })
})
