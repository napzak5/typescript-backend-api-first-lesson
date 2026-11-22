import { describe, expect, it } from 'vitest'
import { localeOfAcceptLanguage } from './accept-language'
import type { Locale } from './locale'

describe('localeOfAcceptLanguage', () => {
  it.each<[string, string | undefined, Locale]>([
    ['no header', undefined, 'en'],
    ['no header', undefined, 'ja'],
    ['an empty header', '', 'ja'],
    ['a language the product is not written in', 'fr', 'ja'],
    ['a language whose tag only begins as one of the product', 'jam', 'en'],
    ['any language', '*', 'ja'],
    ['any language after one the product is not written in', 'fr, *', 'ja'],
    ['a range that is written with an underscore', 'ja_JP', 'en'],
    ['a weight above 1', 'ja;q=2', 'en'],
    ['a weight above 1 by a decimal', 'ja;q=1.5', 'en'],
    ['a weight of four decimals', 'ja;q=0.1234', 'en'],
    ['a parameter that is no weight', 'ja;level=1', 'en'],
    ['a language that is refused alone', 'ja;q=0', 'en'],
  ])('should answer %s (%j) in the fallback', (_case, header, fallback) => {
    // Act
    const locale = localeOfAcceptLanguage(header, fallback)

    // Assert
    expect(locale).toBe(fallback)
  })

  it.each<[string, string, Locale, Locale]>([
    ['the language of the product that is asked for', 'ja', 'en', 'ja'],
    ['the other language of the product', 'en', 'ja', 'en'],
    ['the language of a tag with a region', 'ja-JP', 'en', 'ja'],
    ['the language of a tag with a script', 'ja-Jpan-JP', 'en', 'ja'],
    ['a tag in upper case', 'JA', 'en', 'ja'],
    ['a tag in mixed case', 'En-us', 'ja', 'en'],
    ['the first range the product is written in', 'fr, ja, en', 'en', 'ja'],
    ['the earlier of two ranges of one weight', 'en, ja', 'ja', 'en'],
    ['the heavier range', 'en;q=0.8, ja;q=0.9', 'en', 'ja'],
    [
      'a range without a weight before a lighter one',
      'en;q=0.9, ja',
      'en',
      'ja',
    ],
    ['the weight 1 written with decimals', 'en;q=0.9, ja;q=1.000', 'en', 'ja'],
    [
      'what a browser set to Japanese sends',
      'ja,en-US;q=0.9,en;q=0.8',
      'en',
      'ja',
    ],
    [
      'what a browser set to English sends',
      'en-US,en;q=0.9,ja;q=0.8',
      'ja',
      'en',
    ],
    ['a range after any language', '*, ja;q=0.5', 'en', 'ja'],
    [
      'ranges with spaces around their parts',
      ' en ; q=0.5 ,\tja ; q=0.7 ',
      'en',
      'ja',
    ],
    ['a weight named in upper case', 'en;Q=0.5, ja;Q=0.7', 'en', 'ja'],
    [
      'a range beside one that is not written as a range',
      'ja_JP, ja',
      'en',
      'ja',
    ],
    ['a range between empty elements', ',, ja ,', 'en', 'ja'],
    ['a wanted language beside a refused one', 'en;q=0, ja', 'en', 'ja'],
  ])('should choose %s (%j)', (_case, header, fallback, expected) => {
    // Act
    const locale = localeOfAcceptLanguage(header, fallback)

    // Assert
    expect(locale).toBe(expected)
  })

  it.each<[string, string, Locale, Locale]>([
    ['the fallback', 'en;q=0', 'en', 'ja'],
    ['the fallback, with decimals', 'ja;q=0.000', 'ja', 'en'],
    ['the fallback, in a tag with a region', 'en-GB;q=0', 'en', 'ja'],
    [
      'the fallback, beside a language the product is not written in',
      'fr, en;q=0',
      'en',
      'ja',
    ],
  ])(
    'should not answer in a language that is refused: %s (%j)',
    (_case, header, fallback, expected) => {
      // Act
      const locale = localeOfAcceptLanguage(header, fallback)

      // Assert
      expect(locale).toBe(expected)
    },
  )

  it('should answer in the fallback when every language is refused', () => {
    // Act
    const locale = localeOfAcceptLanguage('en;q=0, ja;q=0, *;q=0', 'ja')

    // Assert
    expect(locale).toBe('ja')
  })
})
