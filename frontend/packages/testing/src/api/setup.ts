/**
 * What a test file that calls the API starts with: an API of its own, which
 * the code under test finds through `VITE_BACKEND_BASE_URL`. After every
 * test the API is given a fresh copy of the seeded database and the storage
 * of the browser is emptied, so no test sees what another one did.
 *
 * Name it in `setupFiles`, with `@beauty-salon-frontend/testing/api/global-setup`
 * in `globalSetup`.
 */
import { configure } from '@testing-library/dom'
import { afterAll, afterEach, inject, vi } from 'vitest'
import { openTestApi } from './test-api'

// What a test waits for comes from a real server on a real database. A
// password is checked with argon2, which takes more than the second the
// queries wait by default on a runner that runs other tests besides
configure({ asyncUtilTimeout: 5_000 })
vi.setConfig({ testTimeout: 30_000 })

const api = await openTestApi(inject('testServer'))

// A setup file runs before the test file imports the code under test, which
// reads the variable when it is loaded
vi.stubEnv('VITE_BACKEND_BASE_URL', api.origin)

afterEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  await api.reset()
})

afterAll(api.remove)
