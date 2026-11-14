import { describe, expect, it } from 'vitest'
import { ApplicationError } from '../../_types/applicationError'
import { retrieveErrorInfo } from './retrieveErrorInfo'

class ConflictError extends ApplicationError {
  status = 409
}

describe('retrieveErrorInfo', () => {
  it('should return the status and message of an application error', () => {
    // Arrange
    const error = new ConflictError('The time slot is already booked')

    // Act
    const result = retrieveErrorInfo(error)

    // Assert
    expect(result).toEqual({
      status: 409,
      message: 'The time slot is already booked',
    })
  })

  it.each([
    { label: 'null', error: null },
    { label: 'undefined', error: undefined },
  ])('should fall back to a server error for $label', ({ error }) => {
    // Act
    const result = retrieveErrorInfo(error)

    // Assert
    expect(result).toEqual({
      status: 500,
      message: 'Something went wrong...',
    })
  })
})
