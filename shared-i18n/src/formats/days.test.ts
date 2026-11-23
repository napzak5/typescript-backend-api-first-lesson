import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../languages/localized-text'
import {
  dayOf,
  dayWithWeekdayOf,
  fullDayOf,
  monthDayOf,
  monthOf,
  shortDayOf,
} from './days'

describe('the days of the calendar', () => {
  it.each<[string, (day: string) => LocalizedText, LocalizedText]>([
    ['dayOf', dayOf, { en: 'November 20, 2026', ja: '2026年11月20日' }],
    [
      'dayWithWeekdayOf',
      dayWithWeekdayOf,
      { en: 'Fri, November 20, 2026', ja: '2026年11月20日（金）' },
    ],
    [
      'fullDayOf',
      fullDayOf,
      { en: 'Friday, November 20, 2026', ja: '2026年11月20日金曜日' },
    ],
    [
      'monthDayOf',
      monthDayOf,
      { en: 'Fri, November 20', ja: '11月20日（金）' },
    ],
    ['shortDayOf', shortDayOf, { en: 'Fri, 11/20', ja: '11/20（金）' }],
  ])('should write a day with %s in each language', (_, format, expected) => {
    // Act
    const written = format('2026-11-20')

    // Assert
    expect(written).toEqual(expected)
  })

  it.each<[string, (day: string) => LocalizedText, LocalizedText]>([
    ['dayOf', dayOf, { en: 'January 1, 2027', ja: '2027年1月1日' }],
    [
      'dayWithWeekdayOf',
      dayWithWeekdayOf,
      { en: 'Fri, January 1, 2027', ja: '2027年1月1日（金）' },
    ],
    [
      'fullDayOf',
      fullDayOf,
      { en: 'Friday, January 1, 2027', ja: '2027年1月1日金曜日' },
    ],
    ['monthDayOf', monthDayOf, { en: 'Fri, January 1', ja: '1月1日（金）' }],
    ['shortDayOf', shortDayOf, { en: 'Fri, 1/1', ja: '1/1（金）' }],
  ])(
    'should write the day that is written with %s as it stands, whatever the time zone where it is read',
    (_, format, expected) => {
      // Act
      const written = format('2027-01-01')

      // Assert
      expect(written).toEqual(expected)
    },
  )
})

describe('monthOf', () => {
  it.each<[string, LocalizedText]>([
    ['2026-11', { en: 'November 2026', ja: '2026年11月' }],
    ['2027-01', { en: 'January 2027', ja: '2027年1月' }],
  ])('should write the month %s in each language', (month, expected) => {
    // Act
    const written = monthOf(month)

    // Assert
    expect(written).toEqual(expected)
  })
})
