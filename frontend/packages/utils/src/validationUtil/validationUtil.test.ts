import { describe, expect, it } from 'vitest'
import { hasNameProps } from './hasNameProps'

describe('hasNameProps', () => {
  it.each([
    { label: 'an object with a string name', data: { name: 'Hanako' } },
    { label: 'an object with an empty name', data: { name: '' } },
    {
      label: 'an object with a name and other properties',
      data: { name: 'Hanako', age: 30 },
    },
    { label: 'an Error', data: new Error('failed') },
  ])('should return true for $label', ({ data }) => {
    // Act
    const result = hasNameProps(data)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'an object without a name', data: { title: 'Hanako' } },
    { label: 'an object with a numeric name', data: { name: 1 } },
    { label: 'an object with a null name', data: { name: null } },
    { label: 'a string', data: 'Hanako' },
    { label: 'an array', data: ['Hanako'] },
    { label: 'null', data: null },
    { label: 'undefined', data: undefined },
  ])('should return false for $label', ({ data }) => {
    // Act
    const result = hasNameProps(data)

    // Assert
    expect(result).toBe(false)
  })
})
