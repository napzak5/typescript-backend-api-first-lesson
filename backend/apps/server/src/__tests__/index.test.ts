import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('the entry of the server', () => {
  /** The variables of the process before the entry read its environment file into them. */
  let before: Record<string, string | undefined> = {}

  beforeEach(() => {
    before = { ...process.env }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    for (const name of Object.keys(process.env)) {
      if (!(name in before)) {
        Reflect.deleteProperty(process.env, name)
      }
    }
  })

  // The entry imports the whole application, which is compiled from source
  // as it is imported: longer than the 5 seconds of a unit test when the
  // unit tests of every package run at once, as in CI.
  it('should run the server in the process of Node.js: its variables, filled from the environment file, and its exit', {
    timeout: 60_000,
  }, async () => {
    // Arrange
    vi.stubEnv('PORT', 'not a port')
    vi.stubEnv('MAIL_FROM', undefined)
    const exit = vi.fn<typeof process.exit>()
    vi.spyOn(process, 'exit').mockImplementation(exit)

    // Act
    await import('../index')

    // Assert
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
    expect(process.env['MAIL_FROM']).toEqual(expect.any(String))
  })
})
