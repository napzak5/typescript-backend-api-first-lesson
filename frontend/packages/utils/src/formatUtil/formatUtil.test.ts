import { describe, expect, it } from 'vitest'
import { formatCurrency, formatNumber } from './formatUtil'

describe('formatNumber', () => {
  it.each([
    { value: 0, expected: '0' },
    { value: 999, expected: '999' },
    { value: 1000, expected: '1,000' },
    { value: 1234567, expected: '1,234,567' },
    { value: -1234567, expected: '-1,234,567' },
  ])(
    'should group the digits of $value as $expected',
    ({ value, expected }) => {
      // Act
      const result = formatNumber(value)

      // Assert
      expect(result).toBe(expected)
    },
  )

  it.each([
    { value: 1234.5, expected: '1,234.5' },
    { value: -0.25, expected: '-0.25' },
    { value: '1234.50', expected: '1,234.50' },
    { value: '0.100', expected: '0.100' },
  ])('should keep the decimal places of $value', ({ value, expected }) => {
    // Act
    const result = formatNumber(value)

    // Assert
    expect(result).toBe(expected)
  })

  it('should format a numeric string like the number it represents', () => {
    // Act
    const result = formatNumber('1234567')

    // Assert
    expect(result).toBe('1,234,567')
  })
})

describe('formatCurrency', () => {
  it.each([
    { value: 0, expected: '0円' },
    { value: 980, expected: '980円' },
    { value: 1234, expected: '1,234円' },
    { value: 1234567, expected: '1,234,567円' },
    { value: '5500', expected: '5,500円' },
  ])('should format $value as $expected', ({ value, expected }) => {
    // Act
    const result = formatCurrency(value)

    // Assert
    expect(result).toBe(expected)
  })

  it('should keep the decimal places of the input', () => {
    // Act
    const result = formatCurrency('1234.5')

    // Assert
    expect(result).toBe('1,234.5円')
  })

  it('should keep the minus sign of a negative amount', () => {
    // Act
    const result = formatCurrency(-1234)

    // Assert
    expect(result).toBe('-1,234円')
  })
})
