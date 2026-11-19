import { describe, expect, it } from 'vitest'
import { classNames } from './class-names'

describe('classNames', () => {
  it('should join the names with a space', () => {
    // Act
    const joined = classNames('button', 'primary')

    // Assert
    expect(joined).toBe('button primary')
  })

  it('should leave out what is not a name', () => {
    // Arrange
    const isSmall = false

    // Act
    const joined = classNames('button', isSmall && 'small', undefined, null, '')

    // Assert
    expect(joined).toBe('button')
  })

  it('should be empty when no name is given', () => {
    // Act
    const joined = classNames()

    // Assert
    expect(joined).toBe('')
  })
})
