import { describe, expect, it } from 'vitest'
import { dateTimeFormatIn, displayNamesIn, numberFormatIn } from './formatters'

describe('the formatters that are kept', () => {
  it('should give the same formatter again for the same language and options', () => {
    // Act
    const first = numberFormatIn('ja', { maximumFractionDigits: 2 })
    const second = numberFormatIn('ja', { maximumFractionDigits: 2 })

    // Assert
    expect(second).toBe(first)
  })

  it('should make another formatter for another language', () => {
    // Act
    const japanese = dateTimeFormatIn('ja', { dateStyle: 'long' })
    const english = dateTimeFormatIn('en', { dateStyle: 'long' })

    // Assert
    expect(english).not.toBe(japanese)
    expect(english.resolvedOptions().locale).toBe('en')
    expect(japanese.resolvedOptions().locale).toBe('ja')
  })

  it('should make another formatter for other options', () => {
    // Act
    const tokyo = dateTimeFormatIn('ja', { timeZone: 'Asia/Tokyo' })
    const utc = dateTimeFormatIn('ja', { timeZone: 'UTC' })

    // Assert
    expect(utc).not.toBe(tokyo)
    expect(utc.resolvedOptions().timeZone).toBe('UTC')
    expect(tokyo.resolvedOptions().timeZone).toBe('Asia/Tokyo')
  })

  it('should keep the names of each language apart', () => {
    // Act
    const japanese = displayNamesIn('ja', { type: 'currency' })
    const english = displayNamesIn('en', { type: 'currency' })

    // Assert
    expect(displayNamesIn('ja', { type: 'currency' })).toBe(japanese)
    expect(english.of('JPY')).toBe('Japanese Yen')
    expect(japanese.of('JPY')).toBe('日本円')
  })
})
