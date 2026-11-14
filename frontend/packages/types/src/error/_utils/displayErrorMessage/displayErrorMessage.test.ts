import { describe, expect, it } from 'vitest'
import { ApplicationError } from '../../_types/applicationError'
import { displayErrorMessage } from './displayErrorMessage'

class ConflictError extends ApplicationError {
  status = 409
}

describe('displayErrorMessage', () => {
  it('should return the message of an application error', () => {
    // Arrange
    const error = new ConflictError('The time slot is already booked')

    // Act
    const result = displayErrorMessage(error)

    // Assert
    expect(result).toBe('The time slot is already booked')
  })

  it.each([
    { label: 'null', error: null },
    { label: 'undefined', error: undefined },
  ])('should return the default message for $label', ({ error }) => {
    // Act
    const result = displayErrorMessage(error)

    // Assert
    expect(result).toBe('Something went wrong...')
  })

  it('should prefer the custom message over the message of the error', () => {
    // Arrange
    const error = new ConflictError('The time slot is already booked')

    // Act
    const result = displayErrorMessage(error, {
      customErrorMessage: '予約に失敗しました',
    })

    // Assert
    expect(result).toBe('予約に失敗しました')
  })

  it('should prefer the custom message over the default message', () => {
    // Act
    const result = displayErrorMessage(null, {
      customErrorMessage: '予約に失敗しました',
    })

    // Assert
    expect(result).toBe('予約に失敗しました')
  })
})
