import type { Locale, LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { isToldInEveryLanguage, type Told, toldIn } from '..'

const WRITTEN: LocalizedText = {
  en: 'Invalid salon',
  ja: 'サロンの内容が正しくありません',
}

describe('toldIn', () => {
  it.each<[string, Told, Locale, string]>([
    ['a text in every language in English', WRITTEN, 'en', 'Invalid salon'],
    [
      'a text in every language in Japanese',
      WRITTEN,
      'ja',
      'サロンの内容が正しくありません',
    ],
    [
      'a text in English alone in English',
      'Invalid booking',
      'en',
      'Invalid booking',
    ],
    [
      'a text in English alone in English, when Japanese is asked for',
      'Invalid booking',
      'ja',
      'Invalid booking',
    ],
  ])('should tell %s', (_what, told, language, expected) => {
    // Act
    const said = toldIn(told, language)

    // Assert
    expect(said).toBe(expected)
  })
})

describe('isToldInEveryLanguage', () => {
  it.each<[string, Told, boolean]>([
    ['a text in every language', WRITTEN, true],
    ['a text in English alone', 'Invalid booking', false],
    ['an empty text in English alone', '', false],
  ])('should say of %s whether it is', (_what, told, expected) => {
    // Act
    const answer = isToldInEveryLanguage(told)

    // Assert
    expect(answer).toBe(expected)
  })
})
