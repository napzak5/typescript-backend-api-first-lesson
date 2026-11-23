import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { LONGEST_LOT, lotLengthError } from './lot-number'

describe('lotLengthError', () => {
  it.each<[string, string, LocalizedText | undefined]>([
    ['the longest lot number', 'L'.repeat(LONGEST_LOT), undefined],
    [
      'a lot number one character too long',
      'L'.repeat(LONGEST_LOT + 1),
      {
        en: 'Lot number: enter up to 100 characters.',
        ja: 'ロット番号は、100 文字以内で入力してください。',
      },
    ],
    [
      'the longest lot number of characters outside the basic plane',
      '𠮷'.repeat(LONGEST_LOT),
      undefined,
    ],
    [
      'a lot number one such character too long',
      '𠮷'.repeat(LONGEST_LOT + 1),
      {
        en: 'Lot number: enter up to 100 characters.',
        ja: 'ロット番号は、100 文字以内で入力してください。',
      },
    ],
  ])('should tell what is wrong with %s', (_case, lot, said) => {
    // Act, Assert
    expect(lotLengthError(lot)).toEqual(said)
  })
})
