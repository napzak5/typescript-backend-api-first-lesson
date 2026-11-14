import {
  connectDatabase,
  createLogger,
  type Database,
  type DatabaseConnection,
} from '@beauty-salon-backend/infrastructure'
import type { Express } from 'express'
import request from 'supertest'
import { type AppSettings, createApp } from '../../index'

// Global type declarations for testing
declare global {
  var __TEST_DB__: Database | undefined
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

export { request }
