import { resolve } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import {
  ADMIN,
  API_ORIGIN,
  APPLICATIONS,
  DASHBOARD,
  PORTAL,
} from './src/support/applications'

const inCi = process.env['CI'] !== undefined

/**
 * The browser tests: a real browser on the built applications, which call
 * the production API on a PostgreSQL with the seed data. Nothing is stubbed.
 *
 * - `globalSetup` starts the test server of the backend and the API
 * - `webServer` builds each application for that API and serves the build.
 *   Like every build, it reads the workspace packages as they were last
 *   built: `pnpm test:e2e` at the root of the repository builds them first
 */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.test.ts',
  outputDir: './test-results',
  globalSetup: './src/support/global-setup.ts',

  // One API and one database for all the tests: they take their turns
  fullyParallel: false,
  workers: 1,
  // A test that fails now and then is not hidden by a second attempt
  retries: 0,
  forbidOnly: inCi,
  reporter: inCi
    ? [
        ['list'],
        ['html', { open: 'never', outputFolder: './playwright-report' }],
      ]
    : 'list',

  use: {
    // What the browser did in a test that failed, to open with `playwright show-trace`
    trace: 'retain-on-failure',
    // The browser is set to the Japanese of Japan: a page whose visitor chose
    // no language is in the language of the browser, and the tests are
    // written in Japanese. A test of the language of the browser sets another
    locale: 'ja-JP',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: APPLICATIONS.map(({ name, port, origin }) => {
    const build = resolve(import.meta.dirname, 'dist', name)

    return {
      name,
      cwd: resolve(import.meta.dirname, '../apps', name),
      command: [
        `pnpm exec vite build --mode test --outDir ${build} --emptyOutDir`,
        `pnpm exec vite preview --outDir ${build} --host 127.0.0.1 --port ${port} --strictPort`,
      ].join(' && '),
      env: {
        // The origin of the API becomes part of the build: a variable of the
        // environment comes before the `.env.test` of the application
        VITE_BACKEND_BASE_URL: API_ORIGIN,
        // So do the addresses of the applications: where one finds the
        // others, and where a link to it shows its image
        VITE_PORTAL_APP_URL: PORTAL.origin,
        VITE_ADMIN_APP_URL: ADMIN.origin,
        VITE_DASHBOARD_APP_URL: DASHBOARD.origin,
        // What is tested is a production build, whatever the run is given
        NODE_ENV: 'production',
      },
      url: origin,
      // Never a server that was left behind, with a build of another commit
      reuseExistingServer: false,
    }
  }),
})
