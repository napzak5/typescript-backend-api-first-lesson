import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('the entry of the commands', () => {
  /** The arguments of the process before the test set its own. */
  let argv: string[] = []

  beforeEach(() => {
    argv = process.argv
  })

  afterEach(() => {
    process.argv = argv
    process.exitCode = undefined
    vi.restoreAllMocks()
  })

  // The entry imports every command, which is compiled from source as it is
  // imported: longer than the 5 seconds of a unit test when the unit tests
  // of every package run at once, as in CI.
  it('should run the command the arguments of the process name, and end the process with its status', {
    timeout: 60_000,
  }, async () => {
    // Arrange
    process.argv = [process.execPath, 'main.ts', 'no-such-command']
    const written = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    // Act
    await import('../main')

    // Assert
    expect(process.exitCode).toBe(1)
    expect(written).toHaveBeenCalledWith(
      expect.stringContaining(
        '❌ No command "no-such-command". The commands: migrate,',
      ),
    )
  })
})
