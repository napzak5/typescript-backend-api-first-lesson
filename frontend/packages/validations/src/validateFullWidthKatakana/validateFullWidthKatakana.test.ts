import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validateFullWidthKatakana } from './validateFullWidthKatakana'

describe('validateFullWidthKatakana', () => {
  it.each([
    { label: 'plain katakana', data: 'ヤマダハナコ' },
    { label: 'a long vowel mark', data: 'サトー' },
    { label: 'voiced and small katakana', data: 'ヴァイオリン' },
    { label: 'the first character of the range', data: 'ァ' },
    { label: 'the last character of the range', data: 'ヶ' },
  ])('should accept $label', ({ data }) => {
    // Act
    const result = validateFullWidthKatakana(data)

    // Assert
    expect(result).toStrictEqual(ok(data))
  })

  it.each([
    { label: 'an empty string', data: '' },
    { label: 'hiragana', data: 'やまだ' },
    { label: 'half-width katakana', data: 'ﾔﾏﾀﾞ' },
    { label: 'kanji', data: '山田' },
    { label: 'latin letters', data: 'Yamada' },
    { label: 'katakana followed by a digit', data: 'ヤマダ1' },
    { label: 'a half-width space between names', data: 'ヤマダ ハナコ' },
    { label: 'a full-width space between names', data: 'ヤマダ　ハナコ' },
    { label: 'a middle dot between names', data: 'ヤマダ・ハナコ' },
  ])('should reject $label', ({ data }) => {
    // Act
    const result = validateFullWidthKatakana(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'a number', data: 123 },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validateFullWidthKatakana(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
