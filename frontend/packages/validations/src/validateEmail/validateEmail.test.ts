import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validateEmail } from './validateEmail'

describe('validateEmail', () => {
  it.each([
    'hanako@example.com',
    'hanako.yamada@example.co.jp',
    'hanako+salon@example.com',
    'HANAKO@EXAMPLE.COM',
  ])('should accept %s', (data) => {
    // Act
    const result = validateEmail(data)

    // Assert
    expect(result).toStrictEqual(ok(data))
  })

  it.each([
    { label: 'an empty string', data: '' },
    { label: 'an address without a domain', data: 'hanako@' },
    { label: 'an address without a local part', data: '@example.com' },
    { label: 'an address without an at sign', data: 'hanako.example.com' },
    { label: 'a domain without a top-level domain', data: 'hanako@example' },
    { label: 'a domain with consecutive dots', data: 'hanako@example..com' },
    { label: 'a local part with a space', data: 'hanako yamada@example.com' },
    { label: 'a leading space', data: ' hanako@example.com' },
  ])('should reject $label', ({ data }) => {
    // Act
    const result = validateEmail(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'a number', data: 123 },
    { label: 'an object', data: { email: 'hanako@example.com' } },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validateEmail(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
