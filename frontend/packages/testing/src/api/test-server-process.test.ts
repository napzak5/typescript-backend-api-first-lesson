import { describe, expect, it } from 'vitest'
import { programOf, READY_AT_ONCE } from './__tests__/server-programs'
import { startTestServer } from './test-server-process'

const NOT_STARTED =
  'The test server did not start: what it reported is above this error'

describe('startTestServer', () => {
  it('should hand the server a token, and take the origin of the line it prints once it is ready', async () => {
    // Act
    const server = await startTestServer(READY_AT_ONCE)

    // Assert
    expect(server.token).toMatch(/^[0-9a-f]{64}$/)
    expect(server.origin).toBe(server.token)
    await expect(server.stop()).resolves.toBeUndefined()
  })

  it('should hand every server a token of its own', async () => {
    // Act
    const first = await startTestServer(READY_AT_ONCE)
    const second = await startTestServer(READY_AT_ONCE)

    // Assert
    expect(first.token).not.toBe(second.token)
    await Promise.all([first.stop(), second.stop()])
  })

  it('should fail the run when the server ends before it is ready', async () => {
    // Act, Assert
    await expect(startTestServer(programOf('process.exit(1)'))).rejects.toThrow(
      NOT_STARTED,
    )
  })

  it('should stop a server that is not ready in time, and fail the run', async () => {
    // Arrange: a server that is never ready, and ends when its input does
    const neverReady = programOf(
      `process.stdin.resume(); process.stdin.on('end', () => process.exit(0))`,
      200,
    )

    // Act, Assert
    await expect(startTestServer(neverReady)).rejects.toThrow(NOT_STARTED)
  })
})
