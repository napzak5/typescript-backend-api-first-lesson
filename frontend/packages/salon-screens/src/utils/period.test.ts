import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { FormErrors } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  daysErrorsOf,
  lastYearUntil,
  monthUntil,
  type Period,
  periodIn,
  periodNameOf,
  periodQueryOf,
  readDays,
  readPeriod,
} from './period'

const TODAY = '2026-11-20'

/** What is said of a day that is none */
const DAY = { en: 'Enter a date.', ja: '日付を入力してください。' }

/** What is said of an end before the start */
const RANGE = {
  en: 'Make the last day the same as the first day, or later.',
  ja: '終わりの日は、始まりの日と同じか、その後にしてください。',
}

describe('monthUntil', () => {
  it.each<[string, Period]>([
    [TODAY, { from: '2026-11-01', to: TODAY }],
    ['2026-12-01', { from: '2026-12-01', to: '2026-12-01' }],
  ])('should count the month up to %s', (today, period) => {
    expect(monthUntil(today)).toEqual(period)
  })
})

describe('lastYearUntil', () => {
  it('should give the 366 days that end with today', () => {
    // Act, Assert
    expect(lastYearUntil(TODAY)).toEqual({ from: '2025-11-20', to: TODAY })
  })
})

describe('periodIn', () => {
  it.each<[string, string, Period]>([
    [
      'a period of an address',
      'from=2026-11-01&to=2026-11-30',
      { from: '2026-11-01', to: '2026-11-30' },
    ],
    ['a day', 'from=2026-11-20&to=2026-11-20', { from: TODAY, to: TODAY }],
    [
      'the longest period the API counts over',
      'from=2025-11-20&to=2026-11-20',
      { from: '2025-11-20', to: TODAY },
    ],
  ])('should read %s', (_case, query, period) => {
    // Act, Assert
    expect(periodIn(new URLSearchParams(query), lastYearUntil(TODAY))).toEqual(
      period,
    )
  })

  it.each<[string, string]>([
    ['no period', ''],
    ['a start alone', 'from=2026-11-01'],
    ['a day that is none', 'from=2026-02-30&to=2026-11-20'],
    ['an end before the start', 'from=2026-11-20&to=2026-11-19'],
    [
      'a period longer than the API counts over',
      'from=2025-11-19&to=2026-11-20',
    ],
  ])('should give the period the screen starts with for %s', (_case, query) => {
    // Act, Assert
    expect(periodIn(new URLSearchParams(query), lastYearUntil(TODAY))).toEqual({
      from: '2025-11-20',
      to: TODAY,
    })
    expect(periodIn(new URLSearchParams(query), monthUntil(TODAY))).toEqual({
      from: '2026-11-01',
      to: TODAY,
    })
  })
})

describe('readPeriod', () => {
  it('should read a period of 366 days', () => {
    // Act, Assert
    expect(
      readPeriod(formOf({ from: '2024-01-01', to: '2024-12-31' })),
    ).toEqual({
      type: 'valid',
      value: { from: '2024-01-01', to: '2024-12-31' },
    })
  })

  it.each<[string, string, string, FormErrors<LocalizedText>]>([
    ['days left empty', '', '', { from: DAY, to: DAY }],
    ['an end before the start', '2026-11-20', '2026-11-19', { to: RANGE }],
    [
      'a period of 367 days',
      '2023-12-31',
      '2024-12-31',
      {
        to: {
          en: 'Make the period 366 days or shorter.',
          ja: '期間は 366 日までにしてください。',
        },
      },
    ],
  ])('should say what is wrong with %s', (_case, from, to, errors) => {
    // Act, Assert
    expect(readPeriod(formOf({ from, to }))).toEqual({
      type: 'invalid',
      errors,
    })
  })
})

describe('daysErrorsOf', () => {
  it.each<[string, string, 'required' | 'optional', FormErrors<LocalizedText>]>(
    [
      ['2026-11-01', '2026-11-30', 'required', {}],
      ['2026-11-30', '2026-11-30', 'required', {}],
      ['', '', 'optional', {}],
      ['2026-11-01', '', 'optional', {}],
      ['', '2026-11-30', 'optional', {}],
      ['', '', 'required', { from: DAY, to: DAY }],
      ['2026-11-01', '', 'required', { to: DAY }],
      ['11/1', '2026-11-30', 'optional', { from: DAY }],
      ['2026-11-01', '2026-02-30', 'optional', { to: DAY }],
      ['2026-11-30', '2026-11-01', 'required', { to: RANGE }],
      ['2026-11-30', '2026-11-01', 'optional', { to: RANGE }],
      ['11/30', '2026-11-01', 'optional', { from: DAY }],
    ],
  )('should find %j to %j (%s) to say %j', (from, to, ends, errors) => {
    expect(daysErrorsOf(from, to, ends)).toEqual(errors)
  })
})

describe('readDays', () => {
  it('should read days as many as they are', () => {
    // Act, Assert
    expect(readDays(formOf({ from: '2020-01-01', to: '2026-11-20' }))).toEqual({
      type: 'valid',
      value: { from: '2020-01-01', to: '2026-11-20' },
    })
  })

  it('should say what is wrong with an end before the start', () => {
    // Act, Assert
    expect(readDays(formOf({ from: '2026-11-20', to: '2026-11-19' }))).toEqual({
      type: 'invalid',
      errors: { to: RANGE },
    })
  })
})

describe('periodQueryOf and periodNameOf', () => {
  it('should keep a period in an address', () => {
    // Arrange
    const period = { from: '2026-11-01', to: TODAY }

    // Act, Assert
    expect(periodQueryOf(period).toString()).toBe(
      'from=2026-11-01&to=2026-11-20',
    )
    expect(periodIn(periodQueryOf(period), lastYearUntil(TODAY))).toEqual(
      period,
    )
  })

  it.each<[string, Period, LocalizedText]>([
    [
      'a period',
      { from: '2026-11-01', to: TODAY },
      {
        en: 'Sun, November 1, 2026 – Fri, November 20, 2026',
        ja: '2026年11月1日（日）〜2026年11月20日（金）',
      },
    ],
    [
      'a day',
      { from: TODAY, to: TODAY },
      { en: 'Fri, November 20, 2026', ja: '2026年11月20日（金）' },
    ],
  ])('should name %s', (_case, period, name) => {
    // Act, Assert
    expect(periodNameOf(period)).toEqual(name)
  })
})
