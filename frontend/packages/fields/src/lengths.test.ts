import { describe, expect, it } from 'vitest'
import {
  charactersOf,
  eachTooLongOf,
  lengthErrors,
  lengthOf,
  neededError,
  neededWithin,
  tooLong,
  tooLongError,
  tooLongOf,
  upTo,
} from './lengths'

describe('lengthOf', () => {
  it.each<[string, string, number]>([
    ['an empty text', '', 0],
    ['letters of the basic plane', 'あいう', 3],
    ['a character outside the basic plane as one', '𠮷', 1],
    ['every emoji as one', '😀😀', 2],
    ['a letter and the mark that follows it as two', 'é', 2],
    ['the parts of a joined emoji one by one', '👨‍👩‍👧', 5],
  ])('should count %s', (_case, text, length) => {
    expect(lengthOf(text)).toBe(length)
  })
})

describe('charactersOf', () => {
  it.each<[string, number, string]>([
    ['a small number as it is', 255, '255 文字'],
    ['a number of four digits with a separator', 2000, '2,000 文字'],
  ])('should write %s', (_case, count, text) => {
    expect(charactersOf(count)).toBe(text)
  })
})

describe('the sentences of a text that is too long', () => {
  it('should say how many characters a text may have', () => {
    expect(tooLong(255)).toBe('255 文字以内で入力してください。')
  })

  it('should write a large number with a separator', () => {
    expect(tooLong(2000)).toBe('2,000 文字以内で入力してください。')
  })

  it('should name the text that is too long', () => {
    expect(tooLongOf('仕入先', 255)).toBe(
      '仕入先は、255 文字以内で入力してください。',
    )
  })

  it('should say how long each entry of a list may be', () => {
    expect(eachTooLongOf('技法の名前', 100)).toBe(
      '技法の名前は、1 つ 100 文字以内で入力してください。',
    )
  })

  it('should ask for a text that has to be written, within its length', () => {
    expect(neededWithin('商品名', 255)).toBe(
      '商品名を、255 文字以内で入力してください。',
    )
  })

  it('should say in a description how long a text may be', () => {
    expect(upTo(1000)).toBe('1,000 文字まで。')
  })
})

describe('tooLongError', () => {
  it.each<[string, string | null, string | undefined]>([
    ['nothing of a text that was left empty', null, undefined],
    ['nothing of a text as long as its length', 'あいう', undefined],
    ['the message of a text one longer', 'あいうえ', '長すぎます'],
    [
      'nothing of characters outside the basic plane as many as the length',
      '𠮷😀𠮷',
      undefined,
    ],
    ['the message of one such character more', '𠮷😀𠮷😀', '長すぎます'],
  ])('should say %s', (_case, text, error) => {
    expect(tooLongError(text, 3, '長すぎます')).toBe(error)
  })
})

describe('neededError', () => {
  it.each<[string, string, string | undefined]>([
    ['the message of a text that is missing', '', '入力してください'],
    ['nothing of a text of one character', 'あ', undefined],
    ['nothing of a text as long as its length', 'あいう', undefined],
    ['the message of a text one longer', 'あいうえ', '入力してください'],
    [
      'nothing of characters outside the basic plane as many as the length',
      '𠮷😀𠮷',
      undefined,
    ],
    ['the message of one such character more', '𠮷😀𠮷😀', '入力してください'],
  ])('should say %s', (_case, text, error) => {
    expect(neededError(text, 3, '入力してください')).toBe(error)
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
    [
      'nothing of characters outside the basic plane as many as the lengths',
      { city: '𠮷𠮷𠮷', building: '😀😀😀😀😀' },
      { city: undefined, building: undefined },
    ],
  ])('should say %s', (_case, texts, errors) => {
    expect(lengthErrors(lengths, (name) => texts[name] ?? null)).toEqual(errors)
  })
})
