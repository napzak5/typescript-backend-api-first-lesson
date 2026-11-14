import { randomUUID } from 'node:crypto'
import { type ClientRequest, request as httpRequest } from 'node:http'
import type { AppConfig } from '@beauty-salon-backend/config'
import { createLogger } from '@beauty-salon-backend/infrastructure'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type RunningServer, startServer } from '../server'

let container: StartedPostgreSqlContainer | undefined
let databaseUrl = ''
/** A connection of the test's own, to see the server's from the outside. */
let observer: postgres.Sql

beforeAll(async () => {
  const externalUrl = process.env.TEST_DATABASE_URL

  if (!externalUrl) {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withStartupTimeout(120000)
      .start()
  }

  databaseUrl = container?.getConnectionUri() ?? externalUrl ?? ''
  observer = postgres(databaseUrl, { max: 1 })
})

afterAll(async () => {
  await observer.end()
  await container?.stop()
})

/**
 * A configuration whose database connections carry a name of their own, so
 * that the test can count them.
 */
const createConfig = (
  overrides: Partial<AppConfig['server']> = {},
): { config: AppConfig; connectionName: string } => {
  const connectionName = `server-test-${randomUUID()}`
  const url = new URL(databaseUrl)
  url.searchParams.set('application_name', connectionName)

  return {
    connectionName,
    config: {
      environment: 'test',
      server: { host: '127.0.0.1', port: 0, trustProxyHops: 0, ...overrides },
      database: { url: url.toString(), poolMax: 2, connectTimeoutMs: 5000 },
      cors: {
        origins: ['https://salon.example'],
        credentials: true,
        maxAgeSeconds: 600,
      },
      rateLimit: { windowMs: 60_000, maxRequests: 1000 },
      logging: { level: 'info', format: 'json' },
    },
  }
}

const createRecordingLogger = () => {
  const logs: unknown[] = []
  const logger = createLogger(
    { level: 'info', format: 'json', environment: 'test' },
    { write: (line) => logs.push(JSON.parse(line)) },
  )
  return { logger, logs }
}

const openConnections = async (connectionName: string): Promise<number> => {
  const rows = await observer<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM pg_stat_activity
    WHERE application_name = ${connectionName}
  `
  return rows[0]?.count ?? 0
}

const start = async (
  config: AppConfig,
  shutdownGraceMs?: number,
): Promise<{ server: RunningServer; logs: unknown[] }> => {
  const { logger, logs } = createRecordingLogger()
  const started = await startServer(config, logger, shutdownGraceMs)

  if (started.type === 'error') {
    throw new Error(`Server did not start: ${started.error.type}`)
  }
  return { server: started.data, logs }
}

/** Sends the head and the first part of a body, and leaves the request open. */
const openRequest = (port: number): ClientRequest => {
  const pending = httpRequest({
    host: '127.0.0.1',
    port,
    method: 'POST',
    path: '/api/v1/salons',
    headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
  })
  pending.write('{')
  return pending
}

const statusOf = (pending: ClientRequest): Promise<number | 'failed'> =>
  new Promise((resolve) => {
    pending.once('response', (response) => {
      response.resume()
      resolve(response.statusCode ?? 0)
    })
    pending.once('error', () => resolve('failed'))
  })

/** Lets the server receive what the client has sent so far. */
const serverHasReceived = async (port: number): Promise<void> => {
  await fetch(`http://127.0.0.1:${port}/api/system/alive`)
}

describe('startServer', () => {
  it('should listen and answer once the database has answered', async () => {
    const { config } = createConfig()

    const { server } = await start(config)
    const response = await fetch(
      `http://127.0.0.1:${server.port}/api/system/ready`,
    )
    await server.stop()

    expect(server.port).toBeGreaterThan(0)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ready: true, reason: null })
  })

  it('should not start when the database is unreachable', async () => {
    const { config } = createConfig()
    const { logger } = createRecordingLogger()

    const started = await startServer(
      {
        ...config,
        database: {
          ...config.database,
          url: 'postgres://nobody:nothing@127.0.0.1:1/nowhere',
        },
      },
      logger,
    )

    expect(started).toMatchObject({
      type: 'error',
      error: {
        type: 'databaseUnreachable',
        error: { type: 'database', cause: { code: 'ECONNREFUSED' } },
      },
    })
  })

  it('should not start when the port is taken, and leave no database connection behind', async () => {
    const first = await start(createConfig().config)
    const { config, connectionName } = createConfig({
      port: first.server.port,
    })
    const { logger } = createRecordingLogger()

    const started = await startServer(config, logger)
    await first.server.stop()

    expect(started).toMatchObject({
      type: 'error',
      error: { type: 'listenFailed', error: { code: 'EADDRINUSE' } },
    })
    await expect.poll(() => openConnections(connectionName)).toBe(0)
  })
})

describe('stop', () => {
  it('should refuse new requests and close the database connections', async () => {
    const { config, connectionName } = createConfig()
    const { server } = await start(config)
    const url = `http://127.0.0.1:${server.port}/api/system/ready`
    await fetch(url)
    const openBefore = await openConnections(connectionName)

    await server.stop()

    expect(openBefore).toBeGreaterThan(0)
    await expect.poll(() => openConnections(connectionName)).toBe(0)
    await expect(fetch(url)).rejects.toThrow()
  })

  it('should let a request in flight finish first', async () => {
    const { server } = await start(createConfig().config)
    const pending = openRequest(server.port)
    const status = statusOf(pending)
    await serverHasReceived(server.port)

    const stopped = server.stop()
    pending.end('}')

    // The empty object reaches validation: the request was served.
    expect(await status).toBe(400)
    await stopped
  })

  it('should cut off what is still open after the grace period', async () => {
    const { server, logs } = await start(createConfig().config, 200)
    const pending = openRequest(server.port)
    const status = statusOf(pending)
    await serverHasReceived(server.port)
    const startedAt = performance.now()

    await server.stop()

    expect(performance.now() - startedAt).toBeLessThan(5000)
    expect(await status).toBe('failed')
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        msg: 'Closing connections that are still open',
        graceMs: 200,
      }),
    )
  })
})
