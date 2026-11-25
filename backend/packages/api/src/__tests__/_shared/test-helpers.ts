import { createServer, type Socket } from 'node:net'
import {
  type IFileStorage,
  type WrittenMail,
  writtenMail,
} from '@beauty-salon-backend/domain'
import {
  connectDatabase,
  createLogger,
  type Database,
  type DatabaseConnection,
  TotpAuthenticator,
} from '@beauty-salon-backend/infrastructure'
import { sql } from 'drizzle-orm'
import type { Express } from 'express'
import type postgres from 'postgres'
import request, { type Response } from 'supertest'
import { expect } from 'vitest'
import { type AppSettings, createApp } from '../../index'
import { InMemoryFileStorage } from './in-memory-file-storage'
import { LOOPBACK, listen } from './listening'

// Global type declarations for testing
declare global {
  var __TEST_DB__: Database | undefined
  var __TEST_DB_CLIENT__: postgres.Sql | undefined
}

/**
 * Get the current test's isolated database connection
 */
export function getTestDb(): Database {
  if (!globalThis.__TEST_DB__) {
    throw new Error(
      'Test database not initialized. Make sure setup.ts has run.',
    )
  }
  return globalThis.__TEST_DB__
}

/**
 * The postgres.js client under `getTestDb()`, for code that builds its own
 * Drizzle instance on the test's schema.
 */
export function getTestDbClient(): postgres.Sql {
  if (globalThis.__TEST_DB_CLIENT__ === undefined) {
    throw new Error(
      'Test database not initialized. Make sure setup.ts has run.',
    )
  }
  return globalThis.__TEST_DB_CLIENT__
}

export const ALLOWED_ORIGIN = 'https://salon.example'

/** Where the links in mails point. */
export const PUBLIC_APP_URL = 'https://app.salon.example'

/** What the application under test encrypts the secrets of authenticator apps under. */
export const TWO_FACTOR_ENCRYPTION_KEY = 'key-of-the-api-integration-tests-only'

const settings: AppSettings = {
  trustProxyHops: 0,
  cors: {
    origins: [ALLOWED_ORIGIN],
    credentials: true,
    maxAgeSeconds: 600,
  },
  rateLimit: { windowMs: 60_000, maxRequests: 1000 },
  publicAppUrl: PUBLIC_APP_URL,
}

export type TestAppOptions = {
  /** The test's isolated database unless another one is given. */
  database?: Database
  rateLimit?: AppSettings['rateLimit']
  /** Receives every line the application logs, parsed. Not logged if absent. */
  logs?: unknown[]
  /**
   * Receives every mail the application hands over, as its recipient reads
   * it: in its language. Dropped if absent.
   */
  mails?: WrittenMail[]
  /** Holds the files of the attachments; a storage of its own if absent. */
  fileStorage?: IFileStorage
}

/**
 * Create the production Express app for testing
 */
export function createTestApp({
  database = getTestDb(),
  rateLimit = settings.rateLimit,
  logs,
  mails,
  fileStorage = new InMemoryFileStorage(),
}: TestAppOptions = {}): Express {
  return createApp({
    database,
    settings: { ...settings, rateLimit },
    mailer: { deliver: (mail) => mails?.push(writtenMail(mail)) },
    fileStorage,
    twoFactorAuthenticator: new TotpAuthenticator(TWO_FACTOR_ENCRYPTION_KEY),
    logger: createLogger(
      {
        level: logs === undefined ? 'silent' : 'info',
        format: 'json',
        environment: 'test',
      },
      { write: (line) => logs?.push(JSON.parse(line)) },
    ),
  })
}

/**
 * The moment on the clock of the database, in milliseconds. A test that holds
 * a row reads it last in its transaction: whatever waited for the row was let
 * through after that moment, so a stamp it wrote is not earlier. The clock of
 * the tests does not serve for this: a timer of Node.js may fire up to a
 * millisecond early.
 */
export async function databaseMoment(
  database: Pick<Database, 'execute'>,
): Promise<number> {
  const [moment] = await database.execute<{ at: string }>(
    sql`SELECT clock_timestamp()::text AS "at"`,
  )

  return new Date(moment?.at ?? '').getTime()
}

/** A database nothing listens on: every query fails at once. */
export function connectUnreachableDatabase(): DatabaseConnection {
  return connectDatabase({
    url: 'postgres://nobody:nothing@127.0.0.1:1/nowhere',
    poolMax: 1,
    connectTimeoutMs: 1000,
  })
}

/**
 * A database that takes the connection and never answers: a query waits
 * until the connection is closed.
 */
export async function connectSilentDatabase(): Promise<DatabaseConnection> {
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket)
  })
  const port = await listen(server)
  const connection = connectDatabase({
    url: `postgres://nobody:nothing@${LOOPBACK}:${port}/nowhere`,
    poolMax: 1,
    connectTimeoutMs: 30_000,
  })

  return {
    database: connection.database,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      server.close()
      await connection.close()
    },
  }
}

export const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** What tells one problem from another; `type` is the last part of the URN. */
export type ExpectedProblem = { status: number; code: string; type: string }

/*
 * The problems of the API, as a test expects them. The status, the code and
 * the type are written here once, as the contract has them, and not taken
 * from the code that answers with them.
 */
export const badRequest: ExpectedProblem = {
  status: 400,
  code: '2001',
  type: 'validation',
}
export const malformedBody: ExpectedProblem = {
  status: 400,
  code: '2002',
  type: 'malformed-body',
}
export const authenticationRequired: ExpectedProblem = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
export const invalidCredentials: ExpectedProblem = {
  status: 401,
  code: '1002',
  type: 'invalid-credentials',
}
export const tokenExpired: ExpectedProblem = {
  status: 401,
  code: '1003',
  type: 'token-expired',
}
export const invalidToken: ExpectedProblem = {
  status: 401,
  code: '1004',
  type: 'invalid-token',
}
export const twoFactorRequired: ExpectedProblem = {
  status: 401,
  code: '1007',
  type: 'two-factor-required',
}
export const passwordRequired: ExpectedProblem = {
  status: 403,
  code: '1002',
  type: 'password-required',
}
export const forbidden: ExpectedProblem = {
  status: 403,
  code: '1005',
  type: 'forbidden',
}
export const notFound: ExpectedProblem = {
  status: 404,
  code: '3001',
  type: 'not-found',
}
export const routeNotFound: ExpectedProblem = {
  status: 404,
  code: '3001',
  type: 'route-not-found',
}
export const alreadyExists: ExpectedProblem = {
  status: 409,
  code: '3002',
  type: 'already-exists',
}
export const notAllowed: ExpectedProblem = {
  status: 409,
  code: '3003',
  type: 'operation-not-allowed',
}
export const unsupportedMediaType: ExpectedProblem = {
  status: 415,
  code: '2002',
  type: 'unsupported-media-type',
}
export const databaseProblem: ExpectedProblem = {
  status: 500,
  code: '4003',
  type: 'database',
}
export const storageProblem: ExpectedProblem = {
  status: 500,
  code: '4004',
  type: 'storage',
}

/** Checks that a response is the expected problem, in the form every problem has. */
export const expectProblem = (
  response: Response,
  expected: ExpectedProblem,
): void => {
  expect(response.status).toBe(expected.status)
  expect(response.headers['content-type']).toBe(
    'application/problem+json; charset=utf-8',
  )
  expect(response.body).toMatchObject({
    type: `urn:beauty-salon:problem:${expected.type}`,
    status: expected.status,
    code: expected.code,
    instance: response.request.url.replace(/^https?:\/\/[^/]+/, ''),
    timestamp: expect.stringMatching(ISO_TIMESTAMP),
  })
}

/** The rules a validation problem reports, as `field:rule`. */
export const brokenRules = (response: Response): string[] =>
  response.body.errors.map(
    ({ field, rule }: { field: string; rule: string }) => `${field}:${rule}`,
  )

export { request }
