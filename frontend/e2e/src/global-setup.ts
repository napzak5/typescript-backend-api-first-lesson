import assert from 'node:assert/strict'
import {
  startTestServer,
  testServerClient,
} from '@beauty-salon-frontend/testing/api/test-server'
import { API_PORT, APPLICATIONS } from './applications'
import { handOver } from './run'

/**
 * Starts the test server of the backend and, on it, the API that the built
 * applications call: the production application on a database with the seed
 * data, on the port that the applications were built for, open to the pages
 * of the three applications. After the run it stops the server, which
 * removes the API and its database.
 */
export default async (): Promise<() => Promise<void>> => {
  const server = await startTestServer()
  assert.ok(
    server !== null,
    'The test server of the backend did not start: what it reported is above this error',
  )
  const client = testServerClient(server, (message) => assert.fail(message))
  const api = await client
    .start({
      port: API_PORT,
      corsOrigins: APPLICATIONS.map(({ origin }) => origin),
    })
    .catch(async (error: unknown) => {
      await server.stop()
      return Promise.reject(error)
    })
  handOver({ server: { origin: server.origin, token: server.token }, api })

  return server.stop
}
