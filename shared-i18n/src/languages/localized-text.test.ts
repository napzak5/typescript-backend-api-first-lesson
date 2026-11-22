import { describe, expect, it } from 'vitest'
import type { Locale } from './locale'
import { text, textIn } from './localized-text'

describe('textIn', () => {
  it.each<[Locale, string]>([
    ['en', 'Salon'],
    ['ja', 'サロン'],
  ])('should read a text in %s', (locale, expected) => {
    // Arrange
    const written = text({ en: 'Salon', ja: 'サロン' })

    // Act
    const read = textIn(written, locale)

    // Assert
    expect(read).toBe(expected)
  })
})
