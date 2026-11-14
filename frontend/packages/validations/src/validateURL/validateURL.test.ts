import { ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'
import { validateURL } from './validateURL'

describe('validateURL', () => {
  it.each([
    'https://example.com',
    'http://localhost:3000',
    'https://example.com/salons/1?tab=menu#reviews',
  ])('should accept %s', (data) => {
    // Act
    const result = validateURL(data)

    // Assert
    expect(result).toStrictEqual(ok(data))
  })

  it.each([
    { label: 'an empty string', data: '' },
    { label: 'a host without a scheme', data: 'example.com' },
    { label: 'a scheme without a host', data: 'https://' },
    { label: 'a relative path', data: '/salons/1' },
    { label: 'a protocol-relative URL', data: '//example.com' },
    { label: 'a host with a space', data: 'https://exa mple.com' },
    { label: 'plain text', data: 'not a url' },
  ])('should reject $label', ({ data }) => {
    // Act
    const result = validateURL(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })

  it.each([
    { label: 'a number', data: 42 },
    { label: 'a URL object', data: new URL('https://example.com') },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should reject $label because it is not a string', ({ data }) => {
    // Act
    const result = validateURL(data)

    // Assert
    expect(result.isErr()).toBe(true)
  })
})
