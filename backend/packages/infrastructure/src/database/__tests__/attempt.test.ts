import { describe, expect, it } from 'vitest'
import { attempt } from '../attempt'
import { describeDatabaseError } from '../failure'

describe('attempt', () => {
  it('should answer with what the queries answered', async () => {
    // Act
    const result = await attempt('Failed to find salon', async () => [
      { id: 'salon-1' },
    ])

    // Assert
    expect(result).toEqual({ type: 'success', data: [{ id: 'salon-1' }] })
  })

  it('should answer a failure as a database error with a description that is safe to log', async () => {
    // Arrange
    const refused = Object.assign(
      new Error('connect ECONNREFUSED 127.0.0.1:5432'),
      { code: 'ECONNREFUSED' },
    )

    // Act
    const result = await attempt('Failed to find salon', async () => {
      throw refused
    })

    // Assert
    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Failed to find salon',
        cause: describeDatabaseError(refused),
      },
    })
  })
})
