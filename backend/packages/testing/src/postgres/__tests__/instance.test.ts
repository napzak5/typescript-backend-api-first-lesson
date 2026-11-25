import { describe, expect, it } from 'vitest'
import { startTestPostgres } from '../instance'

describe('startTestPostgres', () => {
  it('should take the instance at TEST_DATABASE_URL, which it has nothing to stop of', async () => {
    // Arrange
    const url = 'postgres://tests:secret@database.example:5432/postgres'

    // Act
    const instance = await startTestPostgres({ TEST_DATABASE_URL: url })

    // Assert
    expect(instance.url).toBe(url)
    await expect(instance.stop()).resolves.toBeUndefined()
  })
})
