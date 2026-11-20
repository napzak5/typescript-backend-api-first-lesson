import type { ModelsStaffSchedule } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  aSchedule,
  aShortSaturday,
  aSundayOff,
  aTrainingDay,
  aWeek,
} from './components/examples'
import {
  daysOfWeek,
  mondayOf,
  type Shift,
  scheduleOn,
  shiftOf,
  shortDayNameOf,
  timeNameOf,
  WEEKDAYS,
  weekdayNameOf,
  weekdayOf,
  weekIn,
  weekNameOf,
} from './shift-week'

describe('weekdayOf', () => {
  it('should find the day of the week of every day of a week', () => {
    expect(daysOfWeek('2026-11-16').map(weekdayOf)).toEqual(WEEKDAYS)
  })
})

describe('weekdayNameOf', () => {
  it('should name the days of the week from Monday', () => {
    expect(WEEKDAYS.map(weekdayNameOf)).toEqual([
      '月曜日',
      '火曜日',
      '水曜日',
      '木曜日',
      '金曜日',
      '土曜日',
      '日曜日',
    ])
  })
})

describe('mondayOf', () => {
  it.each<[string, string, string]>([
    ['a Monday', '2026-11-16', '2026-11-16'],
    ['a Sunday', '2026-11-22', '2026-11-16'],
    ['a Wednesday after the end of a month', '2026-12-02', '2026-11-30'],
    ['a Friday after the end of a year', '2027-01-01', '2026-12-28'],
  ])('should find the Monday of the week of %s', (_, day, monday) => {
    expect(mondayOf(day)).toBe(monday)
  })
})

describe('daysOfWeek', () => {
  it('should give the seven days from a Monday, across the end of a month', () => {
    expect(daysOfWeek('2026-11-30')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ])
  })
})

describe('weekIn', () => {
  it.each<[string, string, string]>([
    ['a day of the week', 'week=2026-11-19', '2026-11-16'],
    ['its Monday', 'week=2026-12-07', '2026-12-07'],
    ['no week', '', '2026-11-16'],
    ['a day that does not exist', 'week=2026-02-30', '2026-11-16'],
    ['something else', 'week=next', '2026-11-16'],
  ])('should find the week of the query that names %s', (_, search, monday) => {
    expect(weekIn(new URLSearchParams(search), '2026-11-20')).toBe(monday)
  })
})

describe('shortDayNameOf', () => {
  it('should name a day by its month, its day and its day of the week', () => {
    expect(shortDayNameOf('2026-11-16')).toBe('11/16（月）')
  })
})

describe('weekNameOf', () => {
  it('should name a week by its first and its last day', () => {
    expect(weekNameOf('2026-11-16')).toBe(
      '2026年11月16日（月）〜2026年11月22日（日）',
    )
  })
})

describe('scheduleOn', () => {
  it.each<[string, string, ModelsStaffSchedule | undefined]>([
    ['the row of its date over the weekly row', '2026-11-18', aTrainingDay()],
    ['the row of its date on a Saturday', '2026-11-21', aShortSaturday()],
    [
      'the weekly row of a day without a row of its date',
      '2026-11-17',
      aWeek()[1],
    ],
    ['the weekly row of a day off', '2026-11-22', aSundayOff()],
  ])('should find %s', (_, day, row) => {
    expect(scheduleOn(aSchedule(), day)).toEqual(row)
  })

  it('should find no row of a day the member does not work on, nor of a date of another week', () => {
    expect(scheduleOn(aWeek(), '2026-11-22')).toBeUndefined()
    expect(scheduleOn([aTrainingDay()], '2026-11-25')).toBeUndefined()
  })

  it('should apply a weekly row on every day of its day of the week', () => {
    const weekly: ModelsStaffSchedule = {
      ...aSundayOff(),
      dayOfWeek: 'wednesday',
    }

    expect(
      ['2026-11-18', '2026-11-25', '2026-12-02'].map((day) =>
        scheduleOn([weekly], day),
      ),
    ).toEqual([weekly, weekly, weekly])
  })
})

describe('timeNameOf', () => {
  it.each<[string, string]>([
    ['09:00:00', '09:00'],
    ['09:00:30', '09:00:30'],
    ['18:30', '18:30'],
  ])('should show %s as %s', (time, name) => {
    expect(timeNameOf(time)).toBe(name)
  })
})

describe('shiftOf', () => {
  it.each<[string, ModelsStaffSchedule | undefined, Shift]>([
    [
      'the hours and the break of a weekly row',
      aWeek()[0],
      {
        type: 'works',
        hours: '09:00〜20:00',
        rest: '13:00〜14:00',
        notes: null,
        once: false,
      },
    ],
    [
      'the hours of a row of a date without a break',
      aShortSaturday(),
      {
        type: 'works',
        hours: '12:00〜18:00',
        rest: undefined,
        notes: '午前は講習',
        once: true,
      },
    ],
    [
      'a weekly day off',
      aSundayOff(),
      { type: 'off', notes: '定休日', once: false },
    ],
    [
      'a day off on a date',
      aTrainingDay(),
      { type: 'off', notes: '研修', once: true },
    ],
    ['no row', undefined, { type: 'none' }],
  ])('should say %s', (_, row, shift) => {
    expect(shiftOf(row)).toEqual(shift)
  })
})
