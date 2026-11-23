import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  newPasswordError,
  PASSWORD_RULE,
  refusedPasswordMessage,
} from './password-rule'

const TOO_SHORT = {
  en: 'The password is too short. Enter 15 characters or more.',
  ja: 'パスワードが短すぎます。15 文字以上で入力してください。',
}
const TOO_LONG = {
  en: 'The password is too long. Enter 128 characters or fewer.',
  ja: 'パスワードが長すぎます。128 文字以下で入力してください。',
}

/**
 * One character that some keyboards type as two: a kana and its voicing
 * mark. The API counts a password as it stores it, with the two composed.
 */
const TYPED_AS_TWO = 'が'

describe('PASSWORD_RULE', () => {
  it('should say the least length the API takes, and what is safe', () => {
    expect(PASSWORD_RULE).toEqual({
      en: 'Enter 15 characters or more. A long sentence, or several words together, is safe.',
      ja: '15 文字以上で入力してください。長い文や、いくつかの単語の組み合わせが安全です。',
    })
  })
})

describe('newPasswordError', () => {
  it.each([
    ['the shortest the API takes', 'a'.repeat(15)],
    ['the longest the API takes', 'a'.repeat(128)],
    ['spaces, which are characters of a password', ' '.repeat(15)],
    ['fifteen emoji: a character is counted, not its units', '💇'.repeat(15)],
    [
      '128 characters that are typed as 256: the API counts them as it stores them',
      TYPED_AS_TWO.repeat(128),
    ],
  ])('should find nothing wrong with %s', (_case, password) => {
    expect(newPasswordError(password)).toBeUndefined()
  })

  it.each<[string, string, LocalizedText]>([
    [
      'nothing',
      '',
      { en: 'Enter a password.', ja: 'パスワードを入力してください。' },
    ],
    ['fourteen characters', 'a'.repeat(14), TOO_SHORT],
    ['fourteen emoji, of 28 units', '💇'.repeat(14), TOO_SHORT],
    [
      'fourteen characters that are typed as 28',
      TYPED_AS_TWO.repeat(14),
      TOO_SHORT,
    ],
    ['129 characters', 'a'.repeat(129), TOO_LONG],
  ])('should say what to do about %s', (_case, password, error) => {
    expect(newPasswordError(password)).toEqual(error)
  })
})

describe('refusedPasswordMessage', () => {
  it.each<[string, LocalizedText]>([
    ['too_small', TOO_SHORT],
    ['too_big', TOO_LONG],
    [
      'blocklisted',
      {
        en: 'This password is easy to guess and cannot be used. Enter another password.',
        ja: 'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
      },
    ],
    [
      'invalid_format',
      {
        en: 'This password cannot be used. Enter another password.',
        ja: 'このパスワードは使えません。別のパスワードを入力してください。',
      },
    ],
  ])(
    'should say what to do about a password the API refused as %s',
    (rule, message) => {
      expect(refusedPasswordMessage(rule)).toEqual(message)
    },
  )
})
