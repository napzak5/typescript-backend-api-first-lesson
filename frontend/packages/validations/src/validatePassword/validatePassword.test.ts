import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validatePassword } from './validatePassword'

const TOO_SHORT = '少なくとも8文字以上です'
const TOO_LONG = '多くとも20文字以下です'
const NO_LOWERCASE = '少なくとも小文字1文字以上を含めてください'
const NO_UPPERCASE = '少なくとも大文字1文字以上を含めてください'
const NO_DIGIT = '少なくとも数字1文字以上を含めてください'
const NO_SYMBOL = '少なくとも記号1文字以上を含めてください'

const messagesOf = (result: ReturnType<typeof validatePassword>): string[] =>
  result.match(
    () => [],
    (error) => error.issues.map((issue) => issue.message),
  )

describe('validatePassword', () => {
  it.each([
    { label: 'the minimum of 8 characters', data: 'Abcdef1!' },
    { label: 'the maximum of 20 characters', data: 'Abcdefghijklmnopq12!' },
  ])('should accept a password with $label', ({ data }) => {
    // Act
    const result = validatePassword(data)

    // Assert
    expect(result).toStrictEqual(ok(data))
  })

  it.each([
    { label: '7 characters', data: 'Abcde1!', expected: [TOO_SHORT] },
    {
      label: '21 characters',
      data: 'Abcdefghijklmnopq123!',
      expected: [TOO_LONG],
    },
    {
      label: 'no lowercase letter',
      data: 'ABCDEF1!',
      expected: [NO_LOWERCASE],
    },
    {
      label: 'no uppercase letter',
      data: 'abcdef1!',
      expected: [NO_UPPERCASE],
    },
    { label: 'no digit', data: 'Abcdefg!', expected: [NO_DIGIT] },
    { label: 'no symbol', data: 'Abcdefg1', expected: [NO_SYMBOL] },
    {
      label: 'whitespace instead of a symbol',
      data: 'Abcdefg1 ',
      expected: [NO_SYMBOL],
    },
  ])('should reject a password with $label', ({ data, expected }) => {
    // Act
    const result = validatePassword(data)

    // Assert
    expect(messagesOf(result)).toEqual(expected)
  })

  it('should report every rule that an empty password breaks', () => {
    // Act
    const result = validatePassword('')

    // Assert
    expect(messagesOf(result)).toEqual([
      TOO_SHORT,
      NO_LOWERCASE,
      NO_UPPERCASE,
      NO_DIGIT,
      NO_SYMBOL,
    ])
  })

  it.each([
    { label: 'a number', data: 12345678 },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validatePassword(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
