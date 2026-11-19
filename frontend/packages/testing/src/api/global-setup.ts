import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Where the test server listens, and the token its requests carry */
    testServer: { origin: string; token: string }
  }
}

/** What the line starts with that the test server prints when it is ready */
const READY = 'READY '

/** A first start pulls the image of the database */
const START_TIMEOUT_MS = 300_000

/**
 * Starts the test server of the backend for a run of the tests, and stops it
 * after the run. The server owns the database (the PostgreSQL at
 * TEST_DATABASE_URL, or a container) and starts the APIs that
 * `@beauty-salon-frontend/testing/api/setup` asks for, one for each test file.
 *
 * Name it in `globalSetup` of the configuration of the tests that call the API.
 */
export default async (project: TestProject): Promise<() => Promise<void>> => {
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
  }
  assert.ok(
    origin !== null,
    'The test server of the backend did not start: what it reported is above this error',
  )
  project.provide('testServer', { origin, token })

  return stop
}
