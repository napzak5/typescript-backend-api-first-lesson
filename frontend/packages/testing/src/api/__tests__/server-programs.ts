import type { TestServerProgram } from '../test-server-process'

/** A program of Node.js that stands in for a test server, run from its source. */
export const programOf = (
  source: string,
  timeoutMs = 10_000,
): TestServerProgram => ({
  command: process.execPath,
  args: ['-e', source],
  timeoutMs,
})

/**
 * A test server that says something else first, and is then ready at an
 * origin that is the token it was handed. It ends when its input does.
 */
export const READY_AT_ONCE = programOf(`
console.log('starting')
console.log('READY ' + process.env.TEST_SERVER_TOKEN)
process.stdin.resume()
process.stdin.on('end', () => process.exit(0))
`)
