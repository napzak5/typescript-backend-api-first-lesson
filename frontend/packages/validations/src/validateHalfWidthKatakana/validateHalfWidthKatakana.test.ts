import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validateHalfWidthKatakana } from './validateHalfWidthKatakana'

describe('validateHalfWidthKatakana', () => {
  it.each([
    { label: 'plain katakana', data: 'ﾔﾏﾀﾊﾅｺ' },
    { label: 'a long vowel mark', data: 'ｻﾄｰ' },
    { label: 'voiced and semi-voiced marks', data: 'ﾔﾏﾀﾞﾊﾟﾝ' },
    { label: 'the first character of the range', data: 'ｦ' },
    { label: 'the last character of the range', data: 'ﾟ' },
  ])('should accept $label', ({ data }) => {
    // Act
    const result = validateHalfWidthKatakana(data)

    // Assert
    expect(result).toStrictEqual(ok(data))
  })

  it.each([
    { label: 'an empty string', data: '' },
    { label: 'full-width katakana', data: 'ヤマダ' },
    { label: 'hiragana', data: 'やまだ' },
    { label: 'latin letters', data: 'Yamada' },
    { label: 'katakana followed by a digit', data: 'ﾔﾏﾀﾞ1' },
    { label: 'a space between names', data: 'ﾔﾏﾀﾞ ﾊﾅｺ' },
    { label: 'a half-width middle dot', data: 'ﾔﾏﾀﾞ･ﾊﾅｺ' },
  ])('should reject $label', ({ data }) => {
    // Act
    const result = validateHalfWidthKatakana(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'a number', data: 123 },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validateHalfWidthKatakana(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
