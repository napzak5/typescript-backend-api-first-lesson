import { describe, expect, it } from 'vitest'
import { transformArray } from './transformUtil'

describe('transformArray', () => {
  it.each([
    { label: 'null', value: null },
    { label: 'undefined', value: undefined },
  ])('should return an empty array for $label', ({ value }) => {
    // Act
    const result = transformArray(value)

    // Assert
    expect(result).toEqual([])
  })

  it('should return the same array when given an array', () => {
    // Arrange
    const value = ['cut', 'color']

    // Act
    const result = transformArray(value)

    // Assert
    expect(result).toBe(value)
  })

  it('should keep an empty array empty', () => {
    // Act
    const result = transformArray([])

    // Assert
    expect(result).toEqual([])
  })

  it.each([
    { label: 'a string', value: 'cut' },
    { label: 'an empty string', value: '' },
    { label: 'zero', value: 0 },
    { label: 'false', value: false },
    { label: 'an object', value: { id: 1 } },
  ])('should wrap $label in an array', ({ value }) => {
    // Act
    const result = transformArray(value)

    // Assert
    expect(result).toEqual([value])
  })
})
