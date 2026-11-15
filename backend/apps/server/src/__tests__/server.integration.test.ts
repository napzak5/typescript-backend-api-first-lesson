import { createDecipheriv, hkdfSync, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { type ClientRequest, request as httpRequest } from 'node:http'
import type { AppConfig } from '@beauty-salon-backend/config'
import {
  Argon2PasswordHasher,
  createLogger,
} from '@beauty-salon-backend/infrastructure'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import postgres from 'postgres'
import { match, P } from 'ts-pattern'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type RunningServer, startServer } from '../server'

let container: StartedPostgreSqlContainer | undefined
let databaseUrl = ''
/** A connection of the test's own, to see the server's from the outside. */
let observer: postgres.Sql

beforeAll(async () => {
  const { TEST_DATABASE_URL: externalUrl } = process.env

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
      // Nothing listens there: a mail handed over fails to be delivered.
      mail: {
        host: '127.0.0.1',
        port: 1,
        tls: 'none',
        user: 'nobody',
        password: 'nothing',
        from: 'no-reply@salon.example',
      },
      publicAppUrl: 'https://salon.example',
      twoFactor: { encryptionKey: 'key-of-the-server-tests-and-nothing-else' },
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

/** The schema of the application, as the database package generates it. */
const setupSql = readFileSync(
  new URL('../../../../packages/database/sql/setup.sql', import.meta.url),
  'utf8',
)

/** A database of the test's own with the application's tables, so that a request gets as far as its use case. */
const createSchemaDatabase = async (): Promise<{
  url: string
  drop: () => Promise<void>
}> => {
  const name = `server_test_${randomUUID().replaceAll('-', '')}`
  await observer.unsafe(`CREATE DATABASE ${name}`)
  const url = new URL(databaseUrl)
  url.pathname = `/${name}`
  const setup = postgres(url.toString(), {
    max: 1,
    onnotice: () => undefined,
  })
  await setup.unsafe(setupSql)
  await setup.end()

  return {
    url: url.toString(),
    drop: async () => {
      await observer.unsafe(`DROP DATABASE ${name} WITH (FORCE)`)
    },
  }
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

    // The request reaches the route, which answers that it carries no
    // access token: the request was served.
    expect(await status).toBe(401)
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

describe('stop with mail under way', () => {
  it('should resolve after a registration handed a mail to an SMTP server nobody listens on, once the delivery has ended', async () => {
    const database = await createSchemaDatabase()
    const { config } = createConfig()
    const { server, logs } = await start({
      ...config,
      database: { ...config.database, url: database.url },
    })
    const response = await fetch(
      `http://127.0.0.1:${server.port}/api/v1/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hanako@example.com',
          password: 'violet tram under the bridge',
        }),
      },
    )

    await server.stop()
    await database.drop()

    expect(response.status).toBe(204)
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'error',
        msg: 'Failed to deliver mail',
        subject: 'メールアドレスの確認',
        failure: expect.objectContaining({ code: 'ESOCKET', command: 'CONN' }),
      }),
    )
    expect(JSON.stringify(logs)).not.toContain('hanako@example.com')
  })
})

describe('two-factor authentication', () => {
  const EMAIL = 'hanako@example.com'
  const PASSWORD = 'correct horse battery staple'

  const postJson = (
    port: number,
    path: string,
    body: object,
    accessToken: string | null = null,
  ): Promise<Response> =>
    fetch(`http://127.0.0.1:${port}/api/v1/auth/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken === null
          ? {}
          : { Authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify(body),
    })

  const accessTokenOf = (body: unknown): string =>
    match(body)
      .with({ data: { accessToken: P.string } }, ({ data }) => data.accessToken)
      .otherwise(() => {
        throw new Error(`No access token in ${JSON.stringify(body)}`)
      })

  const secretOf = (body: unknown): string =>
    match(body)
      .with({ data: { secret: P.string } }, ({ data }) => data.secret)
      .otherwise(() => {
        throw new Error(`No secret in ${JSON.stringify(body)}`)
      })

  /** Base32 (RFC 4648) without padding, as a secret is shown to the user. */
  const toBase32 = (bytes: Buffer): string => {
    const bits = [...bytes]
      .map((byte) => byte.toString(2).padStart(8, '0'))
      .join('')
    const groups = bits.match(/.{1,5}/g) ?? []

    return groups
      .map((group) =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.charAt(
          Number.parseInt(group.padEnd(5, '0'), 2),
        ),
      )
      .join('')
  }

  /**
   * The secret in a stored value `aes-256-gcm$<iv>$<ciphertext>$<tag>`,
   * opened with the key that HKDF-SHA-256 derives from `configuredKey`.
   * Throws when the value was encrypted under another key.
   */
  const openSecret = (stored: string, configuredKey: string): string => {
    const [, iv = '', ciphertext = '', tag = ''] = stored.split('$')
    const key = Buffer.from(
      hkdfSync(
        'sha256',
        Buffer.from(configuredKey, 'utf8'),
        Buffer.alloc(0),
        'beauty-salon:two-factor-secret',
        32,
      ),
    )
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'base64url'),
      { authTagLength: 16 },
    )
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))

    return toBase32(
      Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]),
    )
  }

  it.each(['2fa/enable', '2fa/verify', '2fa/disable', '2fa/backup-codes'])(
    'should answer POST /api/v1/auth/%s with 401 when no access token is sent',
    async (path) => {
      const { server } = await start(createConfig().config)

      const response = await postJson(server.port, path, {})
      const problem = await response.json()
      await server.stop()

      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe(
        'Bearer realm="beauty-salon-api"',
      )
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(problem).toMatchObject({ status: 401, code: '1001' })
    },
  )

  it('should start a setup for a signed-in user and store its secret encrypted under the configured key', async () => {
    const database = await createSchemaDatabase()
    const { config } = createConfig()
    const { server, logs } = await start({
      ...config,
      database: { ...config.database, url: database.url },
    })
    const hashed = await new Argon2PasswordHasher().hash(PASSWORD)
    if (hashed.type === 'error') {
      throw new Error('Hashing the test password failed')
    }
    const client = postgres(database.url, { max: 1 })
    await client`
      INSERT INTO users (email, "passwordHash", role, status, "emailVerified")
      VALUES (${EMAIL}, ${hashed.data}, 'customer', 'active', true)
    `

    const login = await postJson(server.port, 'login', {
      email: EMAIL,
      password: PASSWORD,
      rememberMe: false,
      twoFactorCode: null,
    })
    const setup = await postJson(
      server.port,
      '2fa/enable',
      { password: PASSWORD },
      accessTokenOf(await login.json()),
    )
    const secret = secretOf(await setup.json())
    const stored = await client<
      { twoFactorStatus: string; twoFactorSecret: string | null }[]
    >`SELECT "twoFactorStatus", "twoFactorSecret" FROM users`
    await client.end()
    await server.stop()
    await database.drop()

    expect(setup.status).toBe(200)
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    expect(stored).toEqual([
      {
        twoFactorStatus: 'pending',
        twoFactorSecret: expect.stringMatching(/^aes-256-gcm\$/),
      },
    ])
    const sealed = stored[0]?.twoFactorSecret ?? ''
    expect(openSecret(sealed, config.twoFactor.encryptionKey)).toBe(secret)
    expect(() =>
      openSecret(sealed, 'another-key-that-is-long-enough-to-be-one'),
    ).toThrow()
    expect(JSON.stringify(logs)).not.toContain(secret)
    expect(JSON.stringify(logs)).not.toContain(sealed)
  })
})

describe('sessions and the operations of administrators on accounts', () => {
  /** A UUID that names nothing: the request is refused before it is looked up. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

  it.each([
    ['GET', '/api/v1/auth/sessions'],
    ['DELETE', `/api/v1/auth/sessions/${SOME_ID}`],
    ['GET', `/api/v1/admin/auth/users/${SOME_ID}`],
    ['POST', `/api/v1/admin/auth/unlock/${SOME_ID}`],
    ['POST', `/api/v1/admin/auth/reset-two-factor/${SOME_ID}`],
  ])(
    'should answer %s %s with 401 when no access token is sent',
    async (method, path) => {
      const { server } = await start(createConfig().config)

      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      const problem = await response.json()
      await server.stop()

      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe(
        'Bearer realm="beauty-salon-api"',
      )
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(problem).toMatchObject({ status: 401, code: '1001' })
    },
  )
})

describe('the service categories of a salon', () => {
  /** A UUID that neither a salon nor a category has. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const CATEGORIES = `/api/v1/salons/${SOME_ID}/service-categories`

  it('should answer the list of a salon that does not exist with 404 when no access token is sent', async () => {
    const database = await createSchemaDatabase()
    const { config } = createConfig()
    const { server } = await start({
      ...config,
      database: { ...config.database, url: database.url },
    })

    const response = await fetch(`http://127.0.0.1:${server.port}${CATEGORIES}`)
    const problem = await response.json()
    await server.stop()
    await database.drop()

    expect(response.status).toBe(404)
    expect(problem).toMatchObject({
      type: 'urn:beauty-salon:problem:not-found',
      status: 404,
      code: '3001',
      detail: `Salon ${SOME_ID} was not found`,
    })
  })

  it.each([
    ['POST', CATEGORIES],
    ['PATCH', `${CATEGORIES}/${SOME_ID}`],
    ['DELETE', `${CATEGORIES}/${SOME_ID}`],
  ])(
    'should answer %s %s with 401 when no access token is sent',
    async (method, path) => {
      const { server } = await start(createConfig().config)

      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      const problem = await response.json()
      await server.stop()

      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe(
        'Bearer realm="beauty-salon-api"',
      )
      expect(problem).toMatchObject({ status: 401, code: '1001' })
    },
  )
})

describe('the services of a salon', () => {
  /** A UUID that neither a salon nor a service has. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const SERVICES = `/api/v1/salons/${SOME_ID}/services`

  it('should answer the list of a salon that does not exist with 404 when no access token is sent', async () => {
    const database = await createSchemaDatabase()
    const { config } = createConfig()
    const { server } = await start({
      ...config,
      database: { ...config.database, url: database.url },
    })

    const response = await fetch(`http://127.0.0.1:${server.port}${SERVICES}`)
    const problem = await response.json()
    await server.stop()
    await database.drop()

    expect(response.status).toBe(404)
    expect(problem).toMatchObject({
      type: 'urn:beauty-salon:problem:not-found',
      status: 404,
      code: '3001',
      detail: `Salon ${SOME_ID} was not found`,
    })
  })

  it.each([
    ['POST', SERVICES],
    ['PATCH', `${SERVICES}/bulk`],
    ['PATCH', `${SERVICES}/${SOME_ID}`],
    ['DELETE', `${SERVICES}/${SOME_ID}`],
  ])(
    'should answer %s %s with 401 when no access token is sent',
    async (method, path) => {
      const { server } = await start(createConfig().config)

      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      const problem = await response.json()
      await server.stop()

      expect(response.status).toBe(401)
      expect(response.headers.get('www-authenticate')).toBe(
        'Bearer realm="beauty-salon-api"',
      )
      expect(problem).toMatchObject({ status: 401, code: '1001' })
    },
  )
})

describe('the customer ledger', () => {
  /** A UUID that no customer has: the request is refused before it is looked up. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const CUSTOMERS = '/api/v1/customers'

  it("should answer each of its five routes, the three of a customer's own profile, and the four of the preferences, with 401 when no access token is sent", async () => {
    const { server } = await start(createConfig().config)
    const routes: [string, string][] = [
      ['GET', CUSTOMERS],
      ['POST', CUSTOMERS],
      ['GET', `${CUSTOMERS}/me`],
      ['POST', `${CUSTOMERS}/me`],
      ['PATCH', `${CUSTOMERS}/me`],
      ['GET', `${CUSTOMERS}/me/preferences`],
      ['PATCH', `${CUSTOMERS}/me/preferences`],
      ['GET', `${CUSTOMERS}/${SOME_ID}`],
      ['PATCH', `${CUSTOMERS}/${SOME_ID}`],
      ['DELETE', `${CUSTOMERS}/${SOME_ID}`],
      ['GET', `${CUSTOMERS}/${SOME_ID}/preferences`],
      ['PATCH', `${CUSTOMERS}/${SOME_ID}/preferences`],
    ]

    const answers: Record<string, unknown>[] = []
    for (const [method, path] of routes) {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      answers.push({
        route: `${method} ${path}`,
        status: response.status,
        challenge: response.headers.get('www-authenticate'),
        problem: await response.json(),
      })
    }
    await server.stop()

    expect(answers).toEqual(
      routes.map(([method, path]) => ({
        route: `${method} ${path}`,
        status: 401,
        challenge: 'Bearer realm="beauty-salon-api"',
        problem: expect.objectContaining({ status: 401, code: '1001' }),
      })),
    )
  })
})

describe('the staff ledger of a salon', () => {
  /** A UUID that neither a salon nor a staff member has: the request is refused before either is looked up. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const STAFF = `/api/v1/salons/${SOME_ID}/staff`

  it('should answer each of its five routes with 401 when no access token is sent', async () => {
    const { server } = await start(createConfig().config)
    const routes: [string, string][] = [
      ['GET', STAFF],
      ['POST', STAFF],
      ['GET', `${STAFF}/${SOME_ID}`],
      ['PATCH', `${STAFF}/${SOME_ID}`],
      ['DELETE', `${STAFF}/${SOME_ID}`],
    ]

    const answers: Record<string, unknown>[] = []
    for (const [method, path] of routes) {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      answers.push({
        route: `${method} ${path}`,
        status: response.status,
        challenge: response.headers.get('www-authenticate'),
        problem: await response.json(),
      })
    }
    await server.stop()

    expect(answers).toEqual(
      routes.map(([method, path]) => ({
        route: `${method} ${path}`,
        status: 401,
        challenge: 'Bearer realm="beauty-salon-api"',
        problem: expect.objectContaining({ status: 401, code: '1001' }),
      })),
    )
  })
})

describe('the schedule of a staff member', () => {
  /** A UUID that neither a salon nor a staff member has: the request is refused before either is looked up. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const SCHEDULES = `/api/v1/salons/${SOME_ID}/staff/${SOME_ID}/schedules`

  it('should answer both of its routes with 401 when no access token is sent', async () => {
    const { server } = await start(createConfig().config)
    const routes: [string, string][] = [
      ['GET', SCHEDULES],
      ['PUT', SCHEDULES],
    ]

    const answers: Record<string, unknown>[] = []
    for (const [method, path] of routes) {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      answers.push({
        route: `${method} ${path}`,
        status: response.status,
        challenge: response.headers.get('www-authenticate'),
        problem: await response.json(),
      })
    }
    await server.stop()

    expect(answers).toEqual(
      routes.map(([method, path]) => ({
        route: `${method} ${path}`,
        status: 401,
        challenge: 'Bearer realm="beauty-salon-api"',
        problem: expect.objectContaining({ status: 401, code: '1001' }),
      })),
    )
  })
})

describe('the invitation of a staff member', () => {
  /** A UUID that neither a salon nor a staff member has: the request is refused before either is looked up. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const INVITATION = `/api/v1/salons/${SOME_ID}/staff/${SOME_ID}/invitation`
  const OF_THE_INVITED = '/api/v1/auth/staff-invitation'

  it('should answer each of the three routes of a salon with 401 when no access token is sent', async () => {
    const { server } = await start(createConfig().config)
    const routes: [string, string][] = [
      ['GET', INVITATION],
      ['POST', INVITATION],
      ['DELETE', INVITATION],
    ]

    const answers: Record<string, unknown>[] = []
    for (const [method, path] of routes) {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      answers.push({
        route: `${method} ${path}`,
        status: response.status,
        challenge: response.headers.get('www-authenticate'),
        problem: await response.json(),
      })
    }
    await server.stop()

    expect(answers).toEqual(
      routes.map(([method, path]) => ({
        route: `${method} ${path}`,
        status: 401,
        challenge: 'Bearer realm="beauty-salon-api"',
        problem: expect.objectContaining({ status: 401, code: '1001' }),
      })),
    )
  })

  it('should answer both routes of the invited without asking for an access token: a request without the token of an invitation with 400, which no cache may keep', async () => {
    const { server } = await start(createConfig().config)
    const paths = [`${OF_THE_INVITED}/verify`, `${OF_THE_INVITED}/accept`]

    const answers: Record<string, unknown>[] = []
    for (const path of paths) {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'violet tram under the bridge' }),
      })
      answers.push({
        route: `POST ${path}`,
        status: response.status,
        challenge: response.headers.get('www-authenticate'),
        cacheControl: response.headers.get('cache-control'),
        problem: await response.json(),
      })
    }
    await server.stop()

    expect(answers).toEqual(
      paths.map((path) => ({
        route: `POST ${path}`,
        status: 400,
        challenge: null,
        cacheControl: 'no-store',
        problem: expect.objectContaining({
          status: 400,
          code: '2001',
          detail: 'Invalid staff invitation',
        }),
      })),
    )
  })

  it('should answer the route of an account that joins with 401 when no access token is sent, which no cache may keep', async () => {
    const { server } = await start(createConfig().config)

    const response = await fetch(
      `http://127.0.0.1:${server.port}${OF_THE_INVITED}/join`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'i'.repeat(43) }),
      },
    )
    const answer = {
      status: response.status,
      challenge: response.headers.get('www-authenticate'),
      cacheControl: response.headers.get('cache-control'),
      problem: await response.json(),
    }
    await server.stop()

    expect(answer).toEqual({
      status: 401,
      challenge: 'Bearer realm="beauty-salon-api"',
      cacheControl: 'no-store',
      problem: expect.objectContaining({ status: 401, code: '1001' }),
    })
  })
})

describe('the account of a staff member', () => {
  /** A UUID that neither a salon nor a staff member has: the request is refused before either is looked up. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const ACCOUNT = `/api/v1/salons/${SOME_ID}/staff/${SOME_ID}/account`

  it('should answer each of its three routes with 401 when no access token is sent', async () => {
    const { server } = await start(createConfig().config)
    const routes: [string, string][] = [
      ['GET', ACCOUNT],
      ['PATCH', ACCOUNT],
      ['DELETE', ACCOUNT],
    ]

    const answers: Record<string, unknown>[] = []
    for (const [method, path] of routes) {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      answers.push({
        route: `${method} ${path}`,
        status: response.status,
        challenge: response.headers.get('www-authenticate'),
        problem: await response.json(),
      })
    }
    await server.stop()

    expect(answers).toEqual(
      routes.map(([method, path]) => ({
        route: `${method} ${path}`,
        status: 401,
        challenge: 'Bearer realm="beauty-salon-api"',
        problem: expect.objectContaining({ status: 401, code: '1001' }),
      })),
    )
  })
})

describe('the staff profiles', () => {
  /** A UUID that no staff member has. */
  const SOME_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'
  const STAFF_PROFILES = '/api/v1/staff-profiles'

  it('should answer both of its routes when no access token is sent: the list with a page, a staff member that does not exist with 404', async () => {
    const database = await createSchemaDatabase()
    const { config } = createConfig()
    const { server } = await start({
      ...config,
      database: { ...config.database, url: database.url },
    })

    const listed = await fetch(
      `http://127.0.0.1:${server.port}${STAFF_PROFILES}`,
    )
    const page = await listed.json()
    const one = await fetch(
      `http://127.0.0.1:${server.port}${STAFF_PROFILES}/${SOME_ID}`,
    )
    const problem = await one.json()
    await server.stop()
    await database.drop()

    expect(listed.status).toBe(200)
    expect(listed.headers.get('www-authenticate')).toBeNull()
    expect(page).toMatchObject({
      data: [],
      meta: { total: 0, limit: 20, hasMore: false },
      links: { self: STAFF_PROFILES, next: null },
    })
    expect(one.status).toBe(404)
    expect(one.headers.get('www-authenticate')).toBeNull()
    expect(problem).toMatchObject({
      type: 'urn:beauty-salon:problem:not-found',
      status: 404,
      code: '3001',
      detail: `Staff member ${SOME_ID} was not found`,
    })
  })

  it('should answer the two routes of the own profile with 401 when no access token is sent: "me" is no ID', async () => {
    const { server } = await start(createConfig().config)
    const routes: [string, string][] = [
      ['GET', `${STAFF_PROFILES}/me`],
      ['PATCH', `${STAFF_PROFILES}/me`],
    ]

    const answers: Record<string, unknown>[] = []
    for (const [method, path] of routes) {
      const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
        method,
      })
      answers.push({
        route: `${method} ${path}`,
        status: response.status,
        challenge: response.headers.get('www-authenticate'),
        problem: await response.json(),
      })
    }
    await server.stop()

    expect(answers).toEqual(
      routes.map(([method, path]) => ({
        route: `${method} ${path}`,
        status: 401,
        challenge: 'Bearer realm="beauty-salon-api"',
        problem: expect.objectContaining({ status: 401, code: '1001' }),
      })),
    )
  })
})
