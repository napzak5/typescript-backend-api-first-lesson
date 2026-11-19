import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  createLogger,
  TotpAuthenticator,
} from '@beauty-salon-backend/infrastructure'
import type { Express } from 'express'
import { createApp } from '../../index'
import { InMemoryFileStorage } from '../_shared/in-memory-file-storage'
import type { TestDatabase, TestDatabases } from '../_shared/test-databases'

/** What the applications encrypt the secrets of authenticator apps under. */
const TWO_FACTOR_ENCRYPTION_KEY = 'key-of-the-test-server-only'

/** The APIs listen on this machine only. */
export const LOOPBACK = '127.0.0.1'

/** One API: the production application on a database of its own. */
type TestApi = {
  server: Server
  database: TestDatabase
  app: Express
}

type QueryOutcome =
  | { type: 'rows'; rows: unknown[] }
  | { type: 'unknownApi' }
  /** The database refused the statement */
  | { type: 'refused'; message: string }

export type TestApis = {
  /** Starts an API on a port and a database of its own. */
  create: () => Promise<{ id: string; origin: string }>
  /** Gives the API a fresh database: nothing of what was done to it stays. */
  reset: (id: string) => Promise<boolean>
  /** Runs a statement on the database of the API. */
  query: (
    id: string,
    text: string,
    values: (string | number | boolean | null)[],
  ) => Promise<QueryOutcome>
  remove: (id: string) => Promise<boolean>
  close: () => Promise<void>
}

const applicationOn = (database: TestDatabase): Express =>
  createApp({
    database: database.db,
    settings: {
      trustProxyHops: 0,
      cors: { origins: [], credentials: true, maxAgeSeconds: 600 },
      rateLimit: { windowMs: 60_000, maxRequests: 1000 },
      publicAppUrl: 'https://app.salon.example',
    },
    mailer: { deliver: () => undefined },
    fileStorage: new InMemoryFileStorage(),
    twoFactorAuthenticator: new TotpAuthenticator(TWO_FACTOR_ENCRYPTION_KEY),
    logger: createLogger({
      level: 'silent',
      format: 'json',
      environment: 'test',
    }),
  })

/** Listens on a free port of this machine; the port it was given. */
export const listen = (server: Server): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, LOOPBACK, () => {
      const address: AddressInfo | string | null = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('The server listens on no port'))
        return
      }
      resolve(address.port)
    })
  })

export const stop = (server: Server): Promise<void> =>
  new Promise((resolve) => {
    server.close(() => resolve())
    // A client that keeps its connections open does not hold the server up
    server.closeAllConnections()
  })

/**
 * The APIs that the tests of the clients call. Each is the application that
 * production runs (`createApp`), with a mailer that delivers nothing and a
 * file storage in memory, on a port of its own and on a database of its own:
 * a copy of the template of `databases`.
 */
export const openTestApis = (databases: TestDatabases): TestApis => {
  const apis = new Map<string, TestApi>()

  const close = async ({ server, database }: TestApi): Promise<void> => {
    await stop(server)
    await database.drop()
  }

  return {
    create: async () => {
      const database = await databases.create()
      const api: TestApi = {
        database,
        app: applicationOn(database),
        // Looked up for every request: a reset replaces the application
        server: createServer((request, response) => api.app(request, response)),
      }
      const port = await listen(api.server)
      const id = randomUUID()
      apis.set(id, api)

      return { id, origin: `http://${LOOPBACK}:${port}` }
    },

    reset: async (id) => {
      const api = apis.get(id)
      if (api === undefined) {
        return false
      }
      const previous = api.database
      api.database = await databases.create()
      api.app = applicationOn(api.database)
      await previous.drop()

      return true
    },

    query: async (id, text, values) => {
      const api = apis.get(id)
      if (api === undefined) {
        return { type: 'unknownApi' }
      }

      return api.database.queryClient.unsafe(text, values).then(
        (rows): QueryOutcome => ({ type: 'rows', rows: [...rows] }),
        (error: unknown): QueryOutcome => ({
          type: 'refused',
          message: String(error),
        }),
      )
    },

    remove: async (id) => {
      const api = apis.get(id)
      if (api === undefined) {
        return false
      }
      apis.delete(id)
      await close(api)

      return true
    },

    close: async () => {
      await Promise.all([...apis.values()].map(close))
      apis.clear()
    },
  }
}
