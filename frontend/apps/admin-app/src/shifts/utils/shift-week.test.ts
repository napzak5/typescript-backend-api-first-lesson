import type { ModelsStaffSchedule } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  aSchedule,
  aShortSaturday,
  aSundayOff,
  aTrainingDay,
  aWeek,
} from '../components/examples'
import {
  dateRowsIn,
  daysOfWeek,
  mondayOf,
  type Shift,
  scheduleOn,
  shiftOf,
  timeNameOf,
  WEEKDAYS,
  weekdayOf,
  weekIn,
  weekNameOf,
} from './shift-week'

describe('dateRowsIn', () => {
  it('should find the rows that dates are written at, by their numbers, past the tenth', () => {
    const values = new FormData()
    values.set('monday.startTime', '09:00')
    values.set('dates.0.date', '2026-11-23')
    values.set('dates.12.date', '2026-12-01')
    values.set('dates.12.startTime', '10:00')
    values.set('dates.x.date', '')

    expect(dateRowsIn(values)).toEqual([0, 12])
  })
})

describe('weekdayOf', () => {
  it('should find the day of the week of every day of a week', () => {
    expect(daysOfWeek('2026-11-16').map(weekdayOf)).toEqual(WEEKDAYS)
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

describe('weekNameOf', () => {
  it('should name a week by its first and its last day', () => {
    // Act
    const week = weekNameOf('2026-11-16')

    // Assert
    expect(week).toEqual({
      en: 'Mon, November 16, 2026 – Sun, November 22, 2026',
      ja: '2026年11月16日（月）〜2026年11月22日（日）',
    })
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
        hours: { en: '09:00–20:00', ja: '09:00〜20:00' },
        rest: { en: '13:00–14:00', ja: '13:00〜14:00' },
        notes: null,
        once: false,
      },
    ],
    [
      'the hours of a row of a date without a break',
      aShortSaturday(),
      {
        type: 'works',
        hours: { en: '12:00–18:00', ja: '12:00〜18:00' },
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
    // Assert
    expect(shiftOf(row)).toEqual(shift)
  })

  it('should keep the seconds of a time that has some', () => {
    // Arrange
    const row: ModelsStaffSchedule = {
      ...aShortSaturday(),
      startTime: '12:00:30',
    }

    // Act
    const shift = shiftOf(row)

    // Assert
    expect(shift).toMatchObject({
      hours: { en: '12:00:30–18:00', ja: '12:00:30〜18:00' },
    })
  })
})
