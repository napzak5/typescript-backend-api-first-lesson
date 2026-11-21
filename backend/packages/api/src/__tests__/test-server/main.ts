import { createServer } from 'node:http'
import { SEED_PASSWORD, seedDatabase } from '@beauty-salon-backend/database'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { openTestDatabases } from '../_shared/test-databases'
import { createControl } from './control'
import { LOOPBACK, listen, openTestApis, stop } from './test-apis'
import { startTestStorage } from './test-storage'

/**
 * The test server: what the tests of the clients (the screens, the browser
 * tests) run against instead of a stub. It owns a PostgreSQL instance, the
 * one at TEST_DATABASE_URL or a container, and on it a template database
 * with the schema and the seed data; every API it starts for a test has a
 * copy of that template (see `control.ts` for what a test may ask for).
 * The APIs keep their files in the object storage of the server, a
 * SeaweedFS container (`test-storage.ts`).
 *
 * It is started with TEST_SERVER_TOKEN, the token that every request to it
 * has to carry. When it is ready it prints one line, `READY` followed by the
 * origin to send the requests to. It stops, and removes what it created,
 * when its standard input ends (so it never outlives the process that
 * started it) or on SIGINT or SIGTERM.
 */
const { TEST_DATABASE_URL: externalUrl, TEST_SERVER_TOKEN: token } = process.env

if (!token) {
  throw new Error(
    'TEST_SERVER_TOKEN is not set: the token that the requests to the test server carry',
  )
}

/** Says what the server needs, before the error that tells why it did not get it. */
const explain =
  (what: string) =>
  (error: unknown): never => {
    console.error(`The test server ${what}`)
    throw error
  }

const container = externalUrl
  ? undefined
  : await new PostgreSqlContainer('postgres:18-alpine')
      .withStartupTimeout(120000)
      .start()
      .catch(
        explain(
          'could not start a PostgreSQL container: it needs a running Docker daemon, or the URL of an instance in TEST_DATABASE_URL',
        ),
      )
const databases = await openTestDatabases(
  container?.getConnectionUri() ?? externalUrl ?? '',
  seedDatabase,
).catch(
  explain(
    'could not create its template database: it needs a PostgreSQL it may create databases on',
  ),
)
const storage = await startTestStorage().catch(
  explain(
    'could not start its object storage, a SeaweedFS container: it needs a running Docker daemon',
  ),
)
const apis = openTestApis(databases, storage.fileStorage)
const control = createServer(createControl(apis, token, SEED_PASSWORD))
const port = await listen(control)

let stopping = false
const shutDown = async (): Promise<void> => {
  if (stopping) {
    return
  }
  stopping = true
  await stop(control)
  await apis.close()
  await databases.close()
  await storage.stop()
  await container?.stop()
  process.exit(0)
}

process.stdin.on('end', shutDown)
process.stdin.resume()
process.on('SIGINT', shutDown)
process.on('SIGTERM', shutDown)

console.log(`READY http://${LOOPBACK}:${port}`)
