import {
  connectDatabase,
  createLogger,
  type Database,
  type DatabaseConnection,
} from '@beauty-salon-backend/infrastructure'
import type { Express } from 'express'
import type postgres from 'postgres'
import request, { type Response } from 'supertest'
import { expect } from 'vitest'
import { type AppSettings, createApp } from '../../index'

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

const settings: AppSettings = {
  trustProxyHops: 0,
  cors: {
    origins: [ALLOWED_ORIGIN],
    credentials: true,
    maxAgeSeconds: 600,
  },
  rateLimit: { windowMs: 60_000, maxRequests: 1000 },
}

export type TestAppOptions = {
  /** The test's isolated database unless another one is given. */
  database?: Database
  rateLimit?: AppSettings['rateLimit']
  /** Receives every line the application logs, parsed. Not logged if absent. */
  logs?: unknown[]
}

/**
 * Create the production Express app for testing
 */
export function createTestApp({
  database = getTestDb(),
  rateLimit = settings.rateLimit,
  logs,
}: TestAppOptions = {}): Express {
  return createApp({
    database,
    settings: { ...settings, rateLimit },
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

/** A database nothing listens on: every query fails at once. */
export function connectUnreachableDatabase(): DatabaseConnection {
  return connectDatabase({
    url: 'postgres://nobody:nothing@127.0.0.1:1/nowhere',
    poolMax: 1,
    connectTimeoutMs: 1000,
  })
}

export const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** What tells one problem from another; `type` is the last part of the URN. */
export type ExpectedProblem = { status: number; code: string; type: string }

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
