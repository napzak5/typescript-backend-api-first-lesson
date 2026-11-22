import type { Locale } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { languageAsked } from '../language'

describe('languageAsked', () => {
  it.each<[string, Record<string, string>, Locale]>([
    ['no language', {}, 'en'],
    ['Japanese', { 'accept-language': 'ja' }, 'ja'],
    ['Japanese of Japan', { 'accept-language': 'ja-JP' }, 'ja'],
    ['English', { 'accept-language': 'en' }, 'en'],
    [
      'English before Japanese',
      { 'accept-language': 'en-US,en;q=0.9,ja;q=0.8' },
      'en',
    ],
    [
      'Japanese before English',
      { 'accept-language': 'ja,en-US;q=0.9,en;q=0.8' },
      'ja',
    ],
    ['a language the API is not written in', { 'accept-language': 'fr' }, 'en'],
    ['any language', { 'accept-language': '*' }, 'en'],
    ['anything but English', { 'accept-language': 'en;q=0' }, 'ja'],
  ])(
    'should answer a request that asks for %s in the right language',
    (_case, headers, expected) => {
      // Act
      const language = languageAsked({ headers })

      // Assert
      expect(language).toBe(expected)
    },
  )
})
