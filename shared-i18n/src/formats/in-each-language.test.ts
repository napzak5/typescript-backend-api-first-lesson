import { describe, expect, it } from 'vitest'
import type { Locale } from '../languages/locale'
import { inEachLanguage } from './in-each-language'

describe('inEachLanguage', () => {
  it('should write the value once in each language of the product', () => {
    // Arrange
    const asked: Locale[] = []

    // Act
    const written = inEachLanguage((language) => {
      asked.push(language)
      return `in ${language}`
    })

    // Assert
    expect(written).toEqual({ en: 'in en', ja: 'in ja' })
    expect(asked.toSorted()).toEqual(['en', 'ja'])
  })
})
