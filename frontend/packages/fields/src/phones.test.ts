import { describe, expect, it } from 'vitest'
import { alternativePhoneError, phoneError } from './phones'

const MALFORMED =
  '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。'

describe('phoneError', () => {
  it.each<[string, string, string | undefined]>([
    ['a number of a fixed line', '03-1234-5678', undefined],
    ['a number of a mobile phone without separators', '09012345678', undefined],
    [
      'a number from abroad, with a plus sign, brackets and spaces',
      '+81 (3) 1234 5678',
      undefined,
    ],
    ['a number of ten digits', '0312345678', undefined],
    ['a number of the longest length', '0'.repeat(20), undefined],
    ['nothing', '', '電話番号を入力してください。'],
    ['a number of nine digits', '031234567', MALFORMED],
    ['a number one character too long', '0'.repeat(21), MALFORMED],
    ['a number with a letter in it', '03-1234-567a', MALFORMED],
    ['a number with a full stop in it', '03.1234.5678', MALFORMED],
  ])('should tell what is wrong with %s', (_case, phoneNumber, said) => {
    expect(phoneError(phoneNumber)).toBe(said)
  })
})

describe('alternativePhoneError', () => {
  it.each<[string, string | null, string | undefined]>([
    ['a number left empty', null, undefined],
    ['a number', '090-1234-5678', undefined],
    ['a number that is too short', '090-1234', MALFORMED],
    ['a number with a letter in it', '03-1234-567a', MALFORMED],
  ])('should tell what is wrong with %s', (_case, phoneNumber, said) => {
    expect(alternativePhoneError(phoneNumber)).toBe(said)
  })
})
