import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validateMinLength } from './validateMinLength'

describe('validateMinLength', () => {
  it.each([
    { label: 'a string longer than the minimum', size: 3, data: 'abcd' },
    { label: 'a string exactly at the minimum', size: 3, data: 'abc' },
    { label: 'an empty string when the minimum is zero', size: 0, data: '' },
    { label: 'multi-byte characters at the minimum', size: 3, data: '美容室' },
    { label: 'emoji counted as single characters', size: 2, data: '😀😀' },
  ])('should accept $label', ({ size, data }) => {
    // Act
    const result = validateMinLength(size, data)

    // Assert
    expect(result).toStrictEqual(ok(data))
  })

  it.each([
    { label: 'a string one character short', size: 3, data: 'ab' },
    {
      label: 'an empty string when one character is required',
      size: 1,
      data: '',
    },
    { label: 'emoji below the minimum', size: 3, data: '😀😀' },
  ])('should reject $label', ({ size, data }) => {
    // Act
    const result = validateMinLength(size, data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'a number', data: 123 },
    { label: 'an array', data: ['a', 'b', 'c'] },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validateMinLength(3, data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
