import { describe, expect, it } from 'vitest'
import { localeOfLanguages } from './browser-languages'
import type { Locale } from './locale'

describe('localeOfLanguages', () => {
  it.each<[string, readonly string[], Locale]>([
    ['no languages', [], 'ja'],
    ['a language the product is not written in', ['fr-FR'], 'ja'],
    ['languages the product is not written in', ['fr-FR', 'de'], 'en'],
    ['a language whose tag only begins as one of the product', ['jam'], 'en'],
  ])('should answer %s (%j) in the fallback', (_case, languages, fallback) => {
    // Act
    const locale = localeOfLanguages(languages, fallback)

    // Assert
    expect(locale).toBe(fallback)
  })

  it.each<[string, readonly string[], Locale, Locale]>([
    ['the language of the product the browser is set to', ['ja'], 'en', 'ja'],
    ['the language of a tag with a region', ['en-US'], 'ja', 'en'],
    ['the language of a tag with a script', ['ja-Jpan-JP'], 'en', 'ja'],
    ['a tag in mixed case', ['En-GB'], 'ja', 'en'],
    [
      'the first language the product is written in',
      ['fr', 'en', 'ja'],
      'ja',
      'en',
    ],
    ['the language the browser prefers first', ['ja-JP', 'en-US'], 'en', 'ja'],
  ])(
    'should answer %s (%j) in that language',
    (_case, languages, fallback, expected) => {
      // Act
      const locale = localeOfLanguages(languages, fallback)

      // Assert
      expect(locale).toBe(expected)
    },
  )
})
