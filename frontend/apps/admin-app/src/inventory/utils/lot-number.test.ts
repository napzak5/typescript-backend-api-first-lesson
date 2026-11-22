import { describe, expect, it } from 'vitest'
import { LONGEST_LOT, lotLengthError } from './lot-number'

describe('lotLengthError', () => {
  it.each<[string, string, string | undefined]>([
    ['the longest lot number', 'L'.repeat(LONGEST_LOT), undefined],
    [
      'a lot number one character too long',
      'L'.repeat(LONGEST_LOT + 1),
      'ロット番号は、100 文字以内で入力してください。',
    ],
    [
      'the longest lot number of characters outside the basic plane',
      '𠮷'.repeat(LONGEST_LOT),
      undefined,
    ],
    [
      'a lot number one such character too long',
      '𠮷'.repeat(LONGEST_LOT + 1),
      'ロット番号は、100 文字以内で入力してください。',
    ],
  ])('should tell what is wrong with %s', (_case, lot, said) => {
    expect(lotLengthError(lot)).toBe(said)
  })
})
