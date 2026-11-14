import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validateBirthday } from './validateBirthday'

describe('validateBirthday', () => {
  it.each(['1990-01-31', '2000-02-29', '2024-12-31'])(
    'should accept the calendar date %s',
    (data) => {
      // Act
      const result = validateBirthday(data)

      // Assert
      expect(result).toStrictEqual(ok(data))
    },
  )

  it.each([
    { label: 'an empty string', data: '' },
    { label: 'slashes as separators', data: '1990/01/31' },
    { label: 'a month without zero padding', data: '1990-1-31' },
    { label: 'no separators', data: '19900131' },
    { label: 'a date with a time', data: '1990-01-31T00:00:00Z' },
    { label: 'surrounding whitespace', data: ' 1990-01-31 ' },
  ])('should reject $label', ({ data }) => {
    // Act
    const result = validateBirthday(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'month 13', data: '2024-13-01' },
    { label: 'month 00', data: '2024-00-10' },
    { label: 'day 00', data: '2024-01-00' },
    { label: 'day 32', data: '2024-01-32' },
    { label: 'April 31st', data: '2024-04-31' },
    { label: 'February 29th of a common year', data: '2023-02-29' },
    { label: 'February 29th of a century year', data: '1900-02-29' },
  ])('should reject $label because it is not on the calendar', ({ data }) => {
    // Act
    const result = validateBirthday(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'a number', data: 19900131 },
    { label: 'a Date', data: new Date(0) },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validateBirthday(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
