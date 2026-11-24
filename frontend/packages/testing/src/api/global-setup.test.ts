import { describe, expect, it } from 'vitest'
import { READY_AT_ONCE } from './__tests__/server-programs'
import { globalSetupOf } from './global-setup'

describe('the global setup of the tests that call the API', () => {
  it('should provide where the test server listens and the token its requests carry, and stop it after the run', async () => {
    // Arrange
    const provided: [string, unknown][] = []

    // Act
    const stopAfterTheRun = await globalSetupOf(READY_AT_ONCE)({
      provide: (key, value) => {
        provided.push([key, value])
      },
    })

    // Assert
    const [[key, server] = ['', null]] = provided
    expect(provided).toHaveLength(1)
    expect(key).toBe('testServer')
    expect(server).toEqual({
      origin: expect.stringMatching(/^[0-9a-f]{64}$/),
      token: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    await expect(stopAfterTheRun()).resolves.toBeUndefined()
  })
})
