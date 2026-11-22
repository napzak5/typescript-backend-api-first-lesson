import { describe, expect, it } from 'vitest'
import { lengthErrors, tooLong } from './lengths'

describe('tooLong', () => {
  it('should say how many characters a text may have', () => {
    expect(tooLong(255)).toBe('255 文字以内で入力してください。')
  })
})

describe('lengthErrors', () => {
  const lengths = { city: 3, building: 5 }

  it.each<
    [string, Record<string, string | null>, Record<string, string | undefined>]
  >([
    [
      'nothing of texts as long as their lengths',
      { city: 'あいう', building: 'あいうえお' },
      { city: undefined, building: undefined },
    ],
    [
      'that a text one longer than its length is too long',
      { city: 'あいうえ', building: 'あいうえお' },
      { city: '3 文字以内で入力してください。', building: undefined },
    ],
    [
      'nothing of texts that were left empty',
      { city: null, building: null },
      { city: undefined, building: undefined },
    ],
    [
      'what is wrong with every text that is too long',
      { city: 'あいうえ', building: 'あいうえおか' },
      {
        city: '3 文字以内で入力してください。',
        building: '5 文字以内で入力してください。',
      },
    ],
  ])('should say %s', (_case, texts, errors) => {
    expect(lengthErrors(lengths, (name) => texts[name] ?? null)).toEqual(errors)
  })
})
