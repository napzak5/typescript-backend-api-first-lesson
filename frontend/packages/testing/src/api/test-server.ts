/**
 * The test server of the backend for a test runner other than Vitest (the
 * browser tests): how to start it, and what to ask it for. Vitest names
 * `./global-setup` and `./setup` instead, and its tests call `testApi()`.
 */
export {
  type StartedTestApi,
  type TestApi,
  type TestApiOptions,
  type TestMail,
  type TestServer,
  testServerClient,
} from './test-server-client'
export {
  BACKEND_TEST_SERVER,
  type RunningTestServer,
  startTestServer,
} from './test-server-process'
