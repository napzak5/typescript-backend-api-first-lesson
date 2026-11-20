import { describe, expect, it } from 'vitest'
import {
  lastYearUntil,
  type Period,
  periodIn,
  periodNameOf,
  periodQueryOf,
  readDays,
  readPeriod,
} from './customer-statistics'

const TODAY = '2026-11-20'

const formOf = (from: string, to: string): FormData => {
  const form = new FormData()
  form.append('from', from)
  form.append('to', to)

  return form
}

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
    expect(periodIn(new URLSearchParams(query), TODAY)).toEqual(period)
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
  ])('should give the year up to today for %s', (_case, query) => {
    // Act, Assert
    expect(periodIn(new URLSearchParams(query), TODAY)).toEqual({
      from: '2025-11-20',
      to: TODAY,
    })
  })
})

describe('readPeriod', () => {
  it('should read a period of 366 days', () => {
    // Act, Assert
    expect(readPeriod(formOf('2024-01-01', '2024-12-31'))).toEqual({
      type: 'valid',
      request: { from: '2024-01-01', to: '2024-12-31' },
    })
  })

  it.each<[string, string, string, Record<string, string>]>([
    [
      'days left empty',
      '',
      '',
      { from: '日付を入力してください。', to: '日付を入力してください。' },
    ],
    [
      'an end before the start',
      '2026-11-20',
      '2026-11-19',
      { to: '終わりの日は、始まりの日と同じか、その後にしてください。' },
    ],
    [
      'a period of 367 days',
      '2023-12-31',
      '2024-12-31',
      { to: '期間は 366 日までにしてください。' },
    ],
  ])('should say what is wrong with %s', (_case, from, to, errors) => {
    // Act, Assert
    expect(readPeriod(formOf(from, to))).toEqual({ type: 'invalid', errors })
  })
})

describe('readDays', () => {
  it('should read days as many as they are', () => {
    // Act, Assert
    expect(readDays(formOf('2020-01-01', '2026-11-20'))).toEqual({
      type: 'valid',
      request: { from: '2020-01-01', to: '2026-11-20' },
    })
  })

  it('should say what is wrong with an end before the start', () => {
    // Act, Assert
    expect(readDays(formOf('2026-11-20', '2026-11-19'))).toEqual({
      type: 'invalid',
      errors: {
        to: '終わりの日は、始まりの日と同じか、その後にしてください。',
      },
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
    expect(periodIn(periodQueryOf(period), TODAY)).toEqual(period)
  })

  it.each<[string, Period, string]>([
    [
      'a period',
      { from: '2026-11-01', to: TODAY },
      '2026年11月1日（日）〜2026年11月20日（金）',
    ],
    ['a day', { from: TODAY, to: TODAY }, '2026年11月20日（金）'],
  ])('should name %s', (_case, period, name) => {
    // Act, Assert
    expect(periodNameOf(period)).toBe(name)
  })
})
