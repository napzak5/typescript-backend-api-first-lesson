import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { alternativePhoneError, phoneError } from './phones'

const MALFORMED = {
  en: 'Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
  ja: '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
}

describe('phoneError', () => {
  it.each<[string, string, LocalizedText | undefined]>([
    ['a number of a fixed line', '03-1234-5678', undefined],
    ['a number of a mobile phone without separators', '09012345678', undefined],
    [
      'a number from abroad, with a plus sign, brackets and spaces',
      '+81 (3) 1234 5678',
      undefined,
    ],
    ['a number of ten digits', '0312345678', undefined],
    ['a number of the longest length', '0'.repeat(20), undefined],
    [
      'nothing',
      '',
      { en: 'Enter a phone number.', ja: '電話番号を入力してください。' },
    ],
    ['a number of nine digits', '031234567', MALFORMED],
    ['a number one character too long', '0'.repeat(21), MALFORMED],
    ['a number with a letter in it', '03-1234-567a', MALFORMED],
    ['a number with a full stop in it', '03.1234.5678', MALFORMED],
  ])('should tell what is wrong with %s', (_case, phoneNumber, said) => {
    expect(phoneError(phoneNumber)).toEqual(said)
  })
})

describe('alternativePhoneError', () => {
  it.each<[string, string | null, LocalizedText | undefined]>([
    ['a number left empty', null, undefined],
    ['a number', '090-1234-5678', undefined],
    ['a number that is too short', '090-1234', MALFORMED],
    ['a number with a letter in it', '03-1234-567a', MALFORMED],
  ])('should tell what is wrong with %s', (_case, phoneNumber, said) => {
    expect(alternativePhoneError(phoneNumber)).toEqual(said)
  })
})
