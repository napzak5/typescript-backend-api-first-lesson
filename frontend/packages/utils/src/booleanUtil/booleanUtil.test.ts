import { describe, expect, it } from 'vitest'
import { toBoolean } from './booleanUtil'

describe('toBoolean', () => {
  it.each([
    { label: 'boolean true', input: true },
    { label: "string 'true'", input: 'true' },
    { label: "string '1'", input: '1' },
    { label: 'number 1', input: 1 },
  ])('should return true for $label', ({ input }) => {
    // Act
    const result = toBoolean(input)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'boolean false', input: false },
    { label: "string 'false'", input: 'false' },
    { label: "string '0'", input: '0' },
    { label: 'number 0', input: 0 },
    { label: 'null', input: null },
    { label: 'undefined', input: undefined },
  ])('should return false for $label', ({ input }) => {
    // Act
    const result = toBoolean(input)

    // Assert
    expect(result).toBe(false)
  })

  it.each([
    { label: 'an empty string', input: '' },
    { label: 'an empty array', input: [] },
    { label: 'an empty object', input: {} },
    { label: 'an empty Map', input: new Map() },
    { label: 'an empty Set', input: new Set() },
  ])('should return false for $label', ({ input }) => {
    // Act
    const result = toBoolean(input)

    // Assert
    expect(result).toBe(false)
  })

  it.each([
    { label: "string 'yes'", input: 'yes' },
    { label: "string 'on'", input: 'on' },
    { label: 'number 2', input: 2 },
    { label: 'number -1', input: -1 },
    { label: 'a non-empty array', input: [true] },
    { label: 'a non-empty object', input: { value: true } },
  ])('should not treat $label as a boolean flag', ({ input }) => {
    // Act
    const result = toBoolean(input)

    // Assert
    expect(result).toBe(false)
  })
})
