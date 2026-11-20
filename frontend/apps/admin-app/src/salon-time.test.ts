import { describe, expect, it } from 'vitest'
import {
  dayAfter,
  dayAt,
  dayNameOf,
  isDay,
  momentNameAt,
  momentOf,
  startOfDayAt,
  timeOfDayAt,
} from './salon-time'

describe('isDay', () => {
  it.each([
    ['a day', '2026-11-20', true],
    ['the first day the API takes', '1900-01-01', true],
    ['the last day the API takes', '2999-12-31', true],
    ['the 29th of February of a leap year', '2028-02-29', true],
    ['a day before the first', '1899-12-31', false],
    ['a day after the last', '3000-01-01', false],
    ['the 29th of February of another year', '2026-02-29', false],
    ['a month that does not exist', '2026-13-01', false],
    ['a moment', '2026-11-20T10:00', false],
    ['a day without its zeros', '2026-1-2', false],
    ['nothing', '', false],
  ])('should tell %s', (_case, text, day) => {
    expect(isDay(text)).toBe(day)
  })
})

describe('dayAt', () => {
  it.each([
    ['Tokyo, where it is already the next day', 'Asia/Tokyo', '2026-11-21'],
    ['New York, where it is still the day', 'America/New_York', '2026-11-20'],
    ['UTC', 'UTC', '2026-11-20'],
  ])('should give the day at a salon in %s', (_case, timezone, day) => {
    expect(dayAt(new Date('2026-11-20T15:30:00Z'), timezone)).toBe(day)
  })
})

describe('dayAfter', () => {
  it.each([
    ['the next day', '2026-11-20', 1, '2026-11-21'],
    ['the day before', '2026-11-20', -1, '2026-11-19'],
    ['the next day across a month', '2026-11-30', 1, '2026-12-01'],
    ['the day before across a year', '2026-01-01', -1, '2025-12-31'],
    ['the next day in a leap year', '2028-02-28', 1, '2028-02-29'],
  ])('should give %s', (_case, day, days, after) => {
    expect(dayAfter(day, days)).toBe(after)
  })
})

describe('dayNameOf', () => {
  it('should name a day with its weekday', () => {
    expect(dayNameOf('2026-11-20')).toBe('2026年11月20日（金）')
  })
})

describe('timeOfDayAt', () => {
  it.each([
    ['Asia/Tokyo', '10:30'],
    ['America/New_York', '20:30'],
  ])('should give the time on the clock of a salon in %s', (timezone, time) => {
    expect(timeOfDayAt('2026-11-20T01:30:00.000Z', timezone)).toBe(time)
  })
})

describe('momentNameAt', () => {
  it('should name the day and the time at the salon', () => {
    expect(momentNameAt('2026-11-20T15:30:00.000Z', 'Asia/Tokyo')).toBe(
      '2026年11月21日（土） 00:30',
    )
  })
})

describe('momentOf', () => {
  it.each([
    ['in Tokyo', '2026-11-20T10:30', 'Asia/Tokyo', '2026-11-20T01:30:00.000Z'],
    [
      'in Tokyo, just after midnight',
      '2026-11-21T00:15',
      'Asia/Tokyo',
      '2026-11-20T15:15:00.000Z',
    ],
    ['in UTC', '2026-11-20T10:30', 'UTC', '2026-11-20T10:30:00.000Z'],
    [
      'in New York in winter',
      '2026-11-20T10:30',
      'America/New_York',
      '2026-11-20T15:30:00.000Z',
    ],
    [
      'in New York in summer',
      '2026-07-20T10:30',
      'America/New_York',
      '2026-07-20T14:30:00.000Z',
    ],
    [
      'in New York, just after the clock was put forward',
      '2026-03-08T03:30',
      'America/New_York',
      '2026-03-08T07:30:00.000Z',
    ],
    [
      'in New York, the first of the hour the clock shows twice',
      '2026-11-01T01:30',
      'America/New_York',
      '2026-11-01T05:30:00.000Z',
    ],
    [
      'in Kolkata, half an hour off',
      '2026-11-20T10:30',
      'Asia/Kolkata',
      '2026-11-20T05:00:00.000Z',
    ],
  ])(
    'should give the moment of a time %s',
    (_case, local, timezone, moment) => {
      expect(momentOf(local, timezone)).toBe(moment)
    },
  )

  it.each([
    ['a time the clock skips', '2026-03-08T02:30', 'America/New_York'],
    ['a date alone', '2026-11-20', 'Asia/Tokyo'],
    ['a time with seconds', '2026-11-20T10:30:00', 'Asia/Tokyo'],
    ['a day that does not exist', '2026-02-30T10:30', 'Asia/Tokyo'],
    ['nothing', '', 'Asia/Tokyo'],
  ])('should give nothing for %s', (_case, local, timezone) => {
    expect(momentOf(local, timezone)).toBeUndefined()
  })
})

describe('startOfDayAt', () => {
  it.each<[string, string, string, string]>([
    ['in Tokyo', '2026-11-20', 'Asia/Tokyo', '2026-11-19T15:00:00.000Z'],
    ['in UTC', '2026-11-20', 'UTC', '2026-11-20T00:00:00.000Z'],
    [
      'in New York on the day the clock is put forward, after midnight',
      '2026-03-08',
      'America/New_York',
      '2026-03-08T05:00:00.000Z',
    ],
    [
      'in Santiago on the day the clock skips midnight',
      '2026-09-06',
      'America/Santiago',
      '2026-09-06T04:00:00.000Z',
    ],
  ])(
    'should give the moment a day begins %s',
    (_case, day, timezone, moment) => {
      expect(startOfDayAt(day, timezone)).toBe(moment)
    },
  )

  it('should give nothing for what is no day', () => {
    expect(startOfDayAt('2026-02-30', 'Asia/Tokyo')).toBeUndefined()
  })
})
