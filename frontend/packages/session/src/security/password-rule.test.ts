import { describe, expect, it } from 'vitest'
import { newPasswordError, refusedPasswordMessage } from './password-rule'

const TOO_SHORT = 'パスワードが短すぎます。15 文字以上で入力してください。'
const TOO_LONG = 'パスワードが長すぎます。128 文字以下で入力してください。'

/**
 * One character that some keyboards type as two: a kana and its voicing
 * mark. The API counts a password as it stores it, with the two composed.
 */
const TYPED_AS_TWO = 'が'

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

  it.each([
    ['nothing', '', 'パスワードを入力してください。'],
    ['fourteen characters', 'a'.repeat(14), TOO_SHORT],
    ['fourteen emoji, of 28 units', '💇'.repeat(14), TOO_SHORT],
    [
      'fourteen characters that are typed as 28',
      TYPED_AS_TWO.repeat(14),
      TOO_SHORT,
    ],
    ['129 characters', 'a'.repeat(129), TOO_LONG],
  ])('should say what to do about %s', (_case, password, error) => {
    expect(newPasswordError(password)).toBe(error)
  })
})

describe('refusedPasswordMessage', () => {
  it.each([
    ['too_small', TOO_SHORT],
    ['too_big', TOO_LONG],
    [
      'blocklisted',
      'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
    ],
    [
      'invalid_format',
      'このパスワードは使えません。別のパスワードを入力してください。',
    ],
  ])(
    'should say what to do about a password the API refused as %s',
    (rule, message) => {
      expect(refusedPasswordMessage(rule)).toBe(message)
    },
  )
})
