import type { Database } from '@beauty-salon-backend/infrastructure'
import type { Express } from 'express'
import request from 'supertest'
import { createApp } from './app'

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

/**
 * Create an Express app instance for testing
 */
export function createTestApp(): Express {
  const db = getTestDb()
  return createApp({ database: db })
}

export { request }
