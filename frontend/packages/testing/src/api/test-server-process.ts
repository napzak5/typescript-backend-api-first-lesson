import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import type { TestServer } from './test-server-client'

/** What the line starts with that the test server prints when it is ready */
const READY = 'READY '

/** A first start pulls the image of the database */
const START_TIMEOUT_MS = 300_000

/** The test server of a run of the tests, and how the run stops it. */
export type RunningTestServer = TestServer & { stop: () => Promise<void> }

/**
 * Starts the test server of the backend for a run of the tests: the process
 * that owns the database (the PostgreSQL at TEST_DATABASE_URL, or a
 * container) and starts the APIs that the tests ask for.
 *
 * Resolves to `null` when the server did not start; what it reported is on
 * the error output by then. The run that started it stops it with `stop`.
 */
export const startTestServer = async (): Promise<RunningTestServer | null> => {
  const token = randomBytes(32).toString('hex')
  const server = spawn(
    'pnpm',
    ['--filter', '@beauty-salon-backend/api', 'run', 'test:server'],
    {
      env: { ...process.env, TEST_SERVER_TOKEN: token },
      // The server stops when its input ends: with this process, at the latest.
      // What it has to say about a failure, it writes to the error output
      stdio: ['pipe', 'pipe', 'inherit'],
    },
  )
  const ended = new Promise<void>((resolve) => {
    server.once('close', () => resolve())
  })
  const stop = async (): Promise<void> => {
    server.stdin.end()
    await ended
  }

  const origin = await new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => resolve(null), START_TIMEOUT_MS)
    const settle = (value: string | null): void => {
      clearTimeout(timeout)
      resolve(value)
    }
    createInterface({ input: server.stdout }).on('line', (line) => {
      if (line.startsWith(READY)) {
        settle(line.slice(READY.length))
      }
    })
    void ended.then(() => settle(null))
  })

  if (origin === null) {
    await stop()
    return null
  }

  return { origin, token, stop }
}
