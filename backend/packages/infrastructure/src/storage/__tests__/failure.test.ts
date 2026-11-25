import { describe, expect, it } from 'vitest'
import { describeStorageFailure } from '../failure'

describe('describeStorageFailure', () => {
  it('should describe an answer of the storage by its name, its message and its status', () => {
    // Arrange
    const notFound = Object.assign(
      new Error('The specified key does not exist.'),
      { name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } },
    )

    // Act
    const description = describeStorageFailure(notFound)

    // Assert
    expect(description).toEqual({
      name: 'NoSuchKey',
      message: 'The specified key does not exist.',
      status: 404,
    })
  })

  it('should describe a failure that got no answer without a status', () => {
    // Arrange
    const timedOut = Object.assign(
      new Error('Connection timed out after 5000 ms'),
      { name: 'TimeoutError' },
    )

    // Act
    const description = describeStorageFailure(timedOut)

    // Assert
    expect(description).toEqual({
      name: 'TimeoutError',
      message: 'Connection timed out after 5000 ms',
      status: null,
    })
  })

  it('should describe something that is not an error', () => {
    // Arrange
    const thrown = 'boom'

    // Act
    const description = describeStorageFailure(thrown)

    // Assert
    expect(description).toEqual({
      name: null,
      message: 'The storage failed',
      status: null,
    })
  })
})
