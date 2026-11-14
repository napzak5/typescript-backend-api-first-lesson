import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate } from './formatDate'
import { isValidDay } from './isValidDay'
import { now } from './now'
import { fromTokyoTime, toTokyoTime } from './tokyoTime'
import type { AllowFormatValue } from './types'

describe('formatDate', () => {
  it('should format a Date as yyyy-MM-dd by default', () => {
    // Arrange
    const date = new Date(2024, 0, 5)

    // Act
    const result = formatDate(date)

    // Assert
    expect(result).toBe('2024-01-05')
  })

  it.each<{ pattern: AllowFormatValue; expected: string }>([
    { pattern: 'yyyy-MM', expected: '2024-01' },
    { pattern: 'yyyy-MM-dd', expected: '2024-01-05' },
    { pattern: 'yyyy年MM月', expected: '2024年01月' },
    { pattern: 'M月d日', expected: '1月5日' },
    { pattern: 'yyyy年MM月dd日', expected: '2024年01月05日' },
    { pattern: 'yyyy年M月d日', expected: '2024年1月5日' },
    { pattern: 'yyyy年M月d日(EEE)', expected: '2024年1月5日(金)' },
    { pattern: 'yyyy/MM/dd', expected: '2024/01/05' },
    { pattern: 'yyyy-MM-dd HH:mm', expected: '2024-01-05 09:07' },
    { pattern: 'yyyy年M月d日 HH:mm', expected: '2024年1月5日 09:07' },
  ])(
    'should format a Date with the $pattern pattern',
    ({ pattern, expected }) => {
      // Arrange
      const date = new Date(2024, 0, 5, 9, 7)

      // Act
      const result = formatDate(date, pattern)

      // Assert
      expect(result).toBe(expected)
    },
  )

  it('should produce an RFC 3339 string that denotes the same instant', () => {
    // Arrange
    const date = new Date(2024, 0, 5, 9, 7, 30)

    // Act
    const result = formatDate(date, "yyyy-MM-dd'T'HH:mm:ssXXX")

    // Assert
    expect(new Date(result).getTime()).toBe(date.getTime())
  })

  it('should treat a date-only string as a calendar date', () => {
    // Arrange
    const date = '2024-01-05'

    // Act
    const result = formatDate(date, 'yyyy年M月d日')

    // Assert
    expect(result).toBe('2024年1月5日')
  })

  it('should treat a string without an offset as local time', () => {
    // Arrange
    const date = '2024-01-05T09:07:00'

    // Act
    const result = formatDate(date, 'yyyy-MM-dd HH:mm')

    // Assert
    expect(result).toBe('2024-01-05 09:07')
  })

  it.each([
    { label: 'at the start of the UTC day', date: '1992-07-31T00:00:00.000Z' },
    { label: 'in the afternoon in UTC', date: '1992-07-31T15:00:00.000Z' },
    { label: 'at the end of the UTC day', date: '1992-07-31T23:59:59.999Z' },
    { label: 'without milliseconds', date: '1992-07-31T15:00:00Z' },
  ])('should keep the UTC date of an ISO string $label', ({ date }) => {
    // Act
    const result = formatDate(date)

    // Assert
    expect(result).toBe('1992-07-31')
  })

  it('should format a UTC string like the equivalent Date when preserveUTC is false', () => {
    // Arrange
    const isoString = '1992-07-31T15:00:00.000Z'

    // Act
    const result = formatDate(isoString, 'yyyy-MM-dd', false)

    // Assert
    expect(result).toBe(formatDate(new Date(isoString)))
  })
})

describe('isValidDay', () => {
  it('should accept a date inside the supported range', () => {
    // Arrange
    const date = new Date(2024, 5, 15, 10, 30)

    // Act
    const result = isValidDay(date)

    // Assert
    expect(result).toBe(true)
  })

  it('should reject an invalid Date', () => {
    // Arrange
    const date = new Date(Number.NaN)

    // Act
    const result = isValidDay(date)

    // Assert
    expect(result).toBe(false)
  })

  it.each([
    { label: 'the first moment of 1912', date: new Date(1912, 0, 1) },
    { label: 'midnight on 2060-12-31', date: new Date(2060, 11, 31) },
    {
      label: 'the last second of 2060',
      date: new Date(2060, 11, 31, 23, 59, 59),
    },
  ])('should accept $label', ({ date }) => {
    // Act
    const result = isValidDay(date)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    {
      label: 'the last second of 1911',
      date: new Date(1911, 11, 31, 23, 59, 59),
    },
    { label: 'the first moment of 2061', date: new Date(2061, 0, 1) },
    { label: 'a three digit year', date: new Date(999, 5, 15) },
    { label: 'a five digit year', date: new Date(10000, 5, 15) },
  ])('should reject $label', ({ date }) => {
    // Act
    const result = isValidDay(date)

    // Assert
    expect(result).toBe(false)
  })

  it.each<{ pattern: AllowFormatValue }>([
    { pattern: 'yyyy-MM-dd' },
    { pattern: 'yyyy/MM/dd' },
    { pattern: 'yyyy年M月d日' },
  ])(
    'should apply the same year range for the $pattern pattern',
    ({ pattern }) => {
      // Arrange
      const lastSupportedDay = new Date(2060, 11, 31, 12)
      const firstUnsupportedDay = new Date(2061, 0, 1)

      // Act
      const results = [
        isValidDay(lastSupportedDay, pattern),
        isValidDay(firstUnsupportedDay, pattern),
      ]

      // Assert
      expect(results).toEqual([true, false])
    },
  )
})

describe('now', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('should return the current system time', () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T03:04:05.678Z'))

    // Act
    const result = now()

    // Assert
    expect(result.toISOString()).toBe('2024-01-15T03:04:05.678Z')
  })

  it('should return a new Date on every call', () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T03:04:05.678Z'))

    // Act
    const first = now()
    const second = now()

    // Assert
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })

  it('should fix NOW at the time the module is loaded', async () => {
    // Arrange
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T03:04:05.678Z'))
    vi.resetModules()

    // Act
    const loaded = await import('./now')
    vi.setSystemTime(new Date('2024-06-30T12:00:00.000Z'))

    // Assert
    expect(loaded.NOW.toISOString()).toBe('2024-01-15T03:04:05.678Z')
    expect(loaded.now().toISOString()).toBe('2024-06-30T12:00:00.000Z')
  })
})

describe('toTokyoTime', () => {
  it('should expose the Tokyo wall clock for the same instant', () => {
    // Arrange
    const date = new Date('2024-01-15T15:30:00.000Z')

    // Act
    const result = toTokyoTime(date)

    // Assert
    expect(result.getTime()).toBe(date.getTime())
    expect([
      result.getFullYear(),
      result.getMonth(),
      result.getDate(),
      result.getHours(),
      result.getMinutes(),
    ]).toEqual([2024, 0, 16, 0, 30])
  })

  it('should roll over to the next year when Tokyo is already past midnight', () => {
    // Arrange
    const date = new Date('2023-12-31T15:00:00.000Z')

    // Act
    const result = toTokyoTime(date)

    // Assert
    expect(formatDate(result, 'yyyy-MM-dd HH:mm')).toBe('2024-01-01 00:00')
  })

  it('should format with the +09:00 offset on any machine', () => {
    // Arrange
    const date = new Date('2024-01-15T15:30:00.000Z')

    // Act
    const result = formatDate(toTokyoTime(date), "yyyy-MM-dd'T'HH:mm:ssXXX")

    // Assert
    expect(result).toBe('2024-01-16T00:30:00+09:00')
  })
})

describe('fromTokyoTime', () => {
  it('should expose the UTC wall clock for the same instant', () => {
    // Arrange
    const tokyoDate = toTokyoTime(new Date('2024-01-15T15:30:00.000Z'))

    // Act
    const result = fromTokyoTime(tokyoDate)

    // Assert
    expect(result.getTime()).toBe(tokyoDate.getTime())
    expect([
      result.getFullYear(),
      result.getMonth(),
      result.getDate(),
      result.getHours(),
      result.getMinutes(),
    ]).toEqual([2024, 0, 15, 15, 30])
  })

  it('should format with the Z offset on any machine', () => {
    // Arrange
    const tokyoDate = toTokyoTime(new Date('2024-01-15T15:30:00.000Z'))

    // Act
    const result = formatDate(
      fromTokyoTime(tokyoDate),
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    )

    // Assert
    expect(result).toBe('2024-01-15T15:30:00Z')
  })
})
