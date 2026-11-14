import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validateMaxLength } from './validateMaxLength'

describe('validateMaxLength', () => {
  it.each([
    { label: 'a string shorter than the limit', size: 5, data: 'abcd' },
    { label: 'a string exactly at the limit', size: 5, data: 'abcde' },
    { label: 'an empty string', size: 5, data: '' },
    { label: 'an empty string when the limit is zero', size: 0, data: '' },
    { label: 'multi-byte characters at the limit', size: 3, data: '美容室' },
    { label: 'emoji counted as single characters', size: 2, data: '😀😀' },
  ])('should accept $label', ({ size, data }) => {
    // Act
    const result = validateMaxLength(size, data)

    // Assert
    expect(result).toStrictEqual(ok(data))
  })

  it.each([
    { label: 'a string one character over the limit', size: 5, data: 'abcdef' },
    { label: 'any character when the limit is zero', size: 0, data: 'a' },
    { label: 'emoji over the limit', size: 2, data: '😀😀😀' },
  ])('should reject $label', ({ size, data }) => {
    // Act
    const result = validateMaxLength(size, data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'a number', data: 123 },
    { label: 'an array', data: ['a'] },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validateMaxLength(5, data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
