import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import type { TestServer } from './test-server-client'

/** What the line starts with that the test server prints when it is ready */
const READY = 'READY '

/** A program that is a test server: how it is run, and how long it may take to be ready. */
export type TestServerProgram = {
  command: string
  args: string[]
  timeoutMs: number
}

/**
 * The test server of the backend: the process that owns the database (the
 * PostgreSQL at TEST_DATABASE_URL, or a container) and starts the APIs that
 * the tests ask for. A first start pulls the image of the database.
 */
export const BACKEND_TEST_SERVER: TestServerProgram = {
  command: 'pnpm',
  args: ['--filter', '@beauty-salon-backend/api', 'run', 'test:server'],
  timeoutMs: 300_000,
}

/** The test server of a run of the tests, and how the run stops it. */
export type RunningTestServer = TestServer & { stop: () => Promise<void> }

/**
 * Starts a test server for a run of the tests (`BACKEND_TEST_SERVER`): it
 * is handed the token its requests are to carry, and it is ready when it
 * prints `READY <origin>`. The run that started it stops it with `stop`.
 *
 * A server that ends before it is ready, or is not ready in time, is
 * stopped, and the run fails: what it reported is on the error output by
 * then.
 */
export const startTestServer = async ({
  command,
  args,
  timeoutMs,
}: TestServerProgram): Promise<RunningTestServer> => {
  const token = randomBytes(32).toString('hex')
  const server = spawn(command, args, {
    env: { ...process.env, TEST_SERVER_TOKEN: token },
    // The server stops when its input ends: with this process, at the latest.
    // What it has to say about a failure, it writes to the error output
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const ended = new Promise<void>((resolve) => {
    server.once('close', () => resolve())
  })
  const stop = async (): Promise<void> => {
    server.stdin.end()
    await ended
  }

  const origin = await new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => resolve(null), timeoutMs)
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
    assert.fail(
      'The test server did not start: what it reported is above this error',
    )
  }

  return { origin, token, stop }
}
