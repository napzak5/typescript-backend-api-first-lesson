import { EventEmitter } from 'node:events'
import { createServer, type Server } from 'node:net'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { match, P } from 'ts-pattern'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { main } from '../main'

let container: StartedPostgreSqlContainer | undefined
let databaseUrl = ''

beforeAll(async () => {
  const { TEST_DATABASE_URL: externalUrl } = process.env

  if (!externalUrl) {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withStartupTimeout(120000)
      .start()
  }

  databaseUrl = container?.getConnectionUri() ?? externalUrl ?? ''
})

afterAll(async () => {
  await container?.stop()
})

/** Listens on a port the system chooses, and says which. */
const listening = async (): Promise<{ server: Server; port: number }> => {
  const server = createServer()
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve()),
  )
  const port = match(server.address())
    .with({ port: P.select(P.number) }, (chosen) => chosen)
    .otherwise(() => {
      throw new Error('The server listens on no port')
    })
  return { server, port }
}

const closed = (server: Server): Promise<void> =>
  new Promise((resolve) => server.close(() => resolve()))

/** A port that nobody listens on. */
const freePort = async (): Promise<number> => {
  const { server, port } = await listening()
  await closed(server)
  return port
}

/**
 * Every variable the server reads, as a deployment of the tests would set
 * them: the environment file has nothing left to add that the server reads.
 */
const variablesOf = async (
  overrides: Record<string, string> = {},
): Promise<Record<string, string | undefined>> => ({
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: String(await freePort()),
  TRUST_PROXY_HOPS: '0',
  DATABASE_URL: databaseUrl,
  DATABASE_POOL_MAX: '2',
  DATABASE_CONNECTION_TIMEOUT: '5000',
  CORS_ORIGIN: 'https://salon.example',
  CORS_CREDENTIALS: 'true',
  CORS_MAX_AGE: '600',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX_REQUESTS: '1000',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1',
  SMTP_TLS: 'none',
  SMTP_USER: 'nobody',
  SMTP_PASSWORD: 'nothing',
  MAIL_FROM: 'no-reply@salon.example',
  PUBLIC_APP_URL: 'https://salon.example',
  TWO_FACTOR_ENCRYPTION_KEY: 'key-of-the-tests-of-the-entry-and-nothing-else',
  STORAGE_ENDPOINT: 'http://127.0.0.1:1',
  STORAGE_PUBLIC_ENDPOINT: 'http://127.0.0.1:1',
  STORAGE_REGION: 'us-east-1',
  STORAGE_BUCKET: 'entry-tests',
  STORAGE_ACCESS_KEY_ID: 'nobody',
  STORAGE_SECRET_ACCESS_KEY: 'nothing',
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  ...overrides,
})

/**
 * What `main` is run in: a process whose signals and exceptions are what the
 * test emits, which keeps the statuses it is ended with, and a log that the
 * test reads.
 */
const processOf = (env: Record<string, string | undefined>) => {
  const exits: number[] = []
  const logs: unknown[] = []
  const serverProcess = Object.assign(new EventEmitter(), {
    env,
    exit: (code: number) => {
      exits.push(code)
    },
  })
  const destination = { write: (line: string) => logs.push(JSON.parse(line)) }

  return {
    serverProcess,
    exits,
    logs,
    run: () => main(serverProcess, destination),
  }
}

describe('main', () => {
  it('should log what is wrong with the configuration and end with 1, before it listens for anything', async () => {
    // Arrange
    const running = processOf(
      await variablesOf({ PORT: 'not a port', SMTP_TLS: 'sometimes' }),
    )

    // Act
    await running.run()

    // Assert
    expect(running.logs).toEqual([
      expect.objectContaining({
        level: 'fatal',
        msg: 'Invalid configuration',
        environment: 'test',
        issues: [
          expect.objectContaining({ variable: 'PORT' }),
          expect.objectContaining({ variable: 'SMTP_TLS' }),
        ],
      }),
    ])
    expect(running.exits).toEqual([1])
    expect(running.serverProcess.eventNames()).toEqual([])
  })

  it.each<NodeJS.Signals>(['SIGTERM', 'SIGINT'])(
    'should start, answer, and stop at %s with 0, taking the signal once',
    async (signal) => {
      // Arrange
      const variables = await variablesOf()
      const port = Number(variables['PORT'])
      const running = processOf(variables)
      await running.run()
      const response = await fetch(`http://127.0.0.1:${port}/api/system/ready`)

      // Act
      running.serverProcess.emit(signal, signal)

      // Assert
      expect(response.status).toBe(200)
      await expect.poll(() => running.exits).toEqual([0])
      expect(running.logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            msg: 'Starting server',
            envFile: expect.stringMatching(/^\.env/),
          }),
          expect.objectContaining({
            msg: 'Server listening',
            address: { address: '127.0.0.1', family: 'IPv4', port },
          }),
          expect.objectContaining({ msg: 'Shutting down', signal }),
          expect.objectContaining({ msg: 'Server stopped' }),
        ]),
      )
      expect(running.serverProcess.listenerCount(signal)).toBe(0)
    },
  )

  it('should end with 1 when the database is unreachable', async () => {
    // Arrange
    const running = processOf(
      await variablesOf({
        DATABASE_URL: 'postgres://nobody:nothing@127.0.0.1:1/nowhere',
      }),
    )

    // Act
    await running.run()

    // Assert
    expect(running.logs).toContainEqual(
      expect.objectContaining({
        level: 'fatal',
        msg: 'Cannot start: the database is unreachable',
        error: expect.objectContaining({ type: 'database' }),
      }),
    )
    expect(running.exits).toEqual([1])
  })

  it('should end with 1 when the port is taken', async () => {
    // Arrange
    const taken = await listening()
    const running = processOf(await variablesOf({ PORT: String(taken.port) }))

    // Act
    await running.run()
    await closed(taken.server)

    // Assert
    expect(running.logs).toContainEqual(
      expect.objectContaining({
        level: 'fatal',
        msg: 'Cannot start: cannot listen',
        err: expect.objectContaining({ code: 'EADDRINUSE' }),
      }),
    )
    expect(running.exits).toEqual([1])
  })

  it.each([
    [
      'an exception that nothing caught',
      'uncaughtException',
      'Uncaught exception',
    ],
    [
      'a rejection that nothing handled',
      'unhandledRejection',
      'Unhandled rejection',
    ],
  ])('should log %s as fatal and end with 1', async (_, event, message) => {
    // Arrange
    const running = processOf(await variablesOf())
    await running.run()

    // Act
    running.serverProcess.emit(event, new Error('Nobody saw this coming'))

    // Assert
    expect(running.logs).toContainEqual(
      expect.objectContaining({
        level: 'fatal',
        msg: message,
        err: expect.objectContaining({ message: 'Nobody saw this coming' }),
      }),
    )
    expect(running.exits).toEqual([1])
    running.serverProcess.emit('SIGTERM', 'SIGTERM')
    await expect.poll(() => running.exits).toEqual([1, 0])
  })
})
