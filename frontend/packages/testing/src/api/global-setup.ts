import type { TestProject } from 'vitest/node'
import type { TestServer } from './test-server-client'
import {
  BACKEND_TEST_SERVER,
  startTestServer,
  type TestServerProgram,
} from './test-server-process'

declare module 'vitest' {
  export interface ProvidedContext {
    /** Where the test server listens, and the token its requests carry */
    testServer: TestServer
  }
}

/**
 * Starts a test server for a run of the tests, and stops it after the run:
 * the tests of the run find it in what the run provides (`testServer`).
 */
export const globalSetupOf =
  (program: TestServerProgram) =>
  async (
    project: Pick<TestProject, 'provide'>,
  ): Promise<() => Promise<void>> => {
    const server = await startTestServer(program)
    project.provide('testServer', {
      origin: server.origin,
      token: server.token,
    })

    return server.stop
  }

/**
 * Starts the test server of the backend for a run of the tests, and stops it
 * after the run. The server owns the database (the PostgreSQL at
 * TEST_DATABASE_URL, or a container) and starts the APIs that
 * `@beauty-salon-frontend/testing/api/setup` asks for, one for each test file.
 *
 * Name it in `globalSetup` of the configuration of the tests that call the API.
 */
export default globalSetupOf(BACKEND_TEST_SERVER)
