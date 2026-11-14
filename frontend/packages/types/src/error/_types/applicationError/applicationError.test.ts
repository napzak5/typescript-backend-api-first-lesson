import { describe, expect, it } from 'vitest'
import { ApplicationError, isApplicationError } from './applicationError'

class NotFoundError extends ApplicationError {
  status = 404
  override name = 'NotFoundError'
}

describe('ApplicationError', () => {
  it('should behave like an Error with the given message', () => {
    // Act
    const error = new NotFoundError('Salon not found')

    // Assert
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Salon not found')
  })

  it('should keep the cause that was passed in', () => {
    // Arrange
    const cause = new Error('connection refused')

    // Act
    const error = new NotFoundError('Salon not found', { cause })

    // Assert
    expect(error.cause).toBe(cause)
  })

  it('should have no cause when none was passed in', () => {
    // Act
    const error = new NotFoundError('Salon not found')

    // Assert
    expect(error.cause).toBeUndefined()
  })

  it('should serialise its status, name, message and cause to JSON', () => {
    // Arrange
    const error = new NotFoundError('Salon not found', {
      cause: { salonId: 's_1' },
    })

    // Act
    const result: unknown = JSON.parse(JSON.stringify(error))

    // Assert
    expect(result).toMatchObject({
      status: 404,
      name: 'NotFoundError',
      message: 'Salon not found',
      cause: { salonId: 's_1' },
    })
  })

  it('should include the stack trace when serialised', () => {
    // Arrange
    const error = new NotFoundError('Salon not found')

    // Act
    const result = error.toJSON()

    // Assert
    expect(result.stack).toContain('Salon not found')
  })
})

describe('isApplicationError', () => {
  it('should return true for an instance of an ApplicationError subclass', () => {
    // Arrange
    const error = new NotFoundError('Salon not found')

    // Act
    const result = isApplicationError(error)

    // Assert
    expect(result).toBe(true)
  })

  it.each([
    { label: 'a plain Error', error: new Error('failed') },
    {
      label: 'an object shaped like an ApplicationError',
      error: { name: 'NotFoundError', status: 404, message: 'Salon not found' },
    },
    { label: 'a string', error: 'Salon not found' },
    { label: 'null', error: null },
    { label: 'undefined', error: undefined },
  ])('should return false for $label', ({ error }) => {
    // Act
    const result = isApplicationError(error)

    // Assert
    expect(result).toBe(false)
  })
})
