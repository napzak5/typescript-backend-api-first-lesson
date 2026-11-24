/**
 * The tests of a package, configured here for every package of the
 * repository. The unit tests and the integration tests of a package are the
 * two projects of one configuration, `unit` and `integration`: they run
 * apart (`vitest run --project unit`, as `test` and `test:integration` do)
 * or together (`vitest run --coverage`, as `test:coverage` does), and the
 * coverage is measured over both. A package names the tests it has and
 * what is its own; what every package of its side shares is written here.
 */
import { defaultClientConditions, defaultServerConditions } from 'vite'
import {
  configDefaults,
  defineConfig,
  type TestProjectInlineConfiguration,
  type ViteUserConfig,
} from 'vitest/config'
import { NOT_BUILT } from '../vite/library.ts'

/** What a package says of its coverage. */
interface Coverage {
  /**
   * Every statement, branch, function and line is covered, and a run that
   * covers less fails. A package says so once its tests cover all of it.
   */
  full?: true
  /** Sources that are not measured, beyond what is test material: generated code. */
  unmeasured?: string[]
}

/** The tests of a package of the backend. */
export interface BackendTests extends Coverage {
  /** The unit tests (`*.test.ts` below `src`), when the package has them. */
  unit?: {
    /**
     * `false` evaluates the modules once per worker instead of once per
     * file: for a package whose files import much the same modules and
     * leave nothing behind that another file could see.
     */
    isolate?: false
  }
  /**
   * The integration tests (`*.integration.test.ts` below `src`), when the
   * package has them: against a real PostgreSQL, an SMTP server and an
   * object storage.
   */
  integration?: {
    /** What runs before each file, and around each test of it. */
    setupFiles?: string[]
    /** `false` runs the files one at a time. */
    fileParallelism?: false
  }
}

/** The unit tests of a package of the frontend. */
type FrontendUnitTests =
  | {
      /** In Node.js: modules without markup. */
      environment?: 'node'
    }
  | {
      /** In the document of jsdom, with what jsdom lacks. */
      environment: 'jsdom'
      /** The tests compose stories, and are given what the catalogue gives every story. */
      stories?: true
      /** Setup files of the package, after the others. */
      setupFiles?: string[]
      /**
       * `vmThreads` sets the document up once per worker, and still runs
       * every file in a context of its own.
       */
      pool?: 'vmThreads'
    }

/** The tests of a package of the frontend. */
export interface FrontendTests extends Coverage {
  /** The unit tests (`*.test.{ts,tsx}` below `src`), when the package has them. */
  unit?: FrontendUnitTests
  /**
   * The integration tests (`*.integration.test.{ts,tsx}` below `src`),
   * when the package has them: against the test server of the backend.
   */
  integration?: Record<string, never>
}

/** The tests of a package that is neither of the backend nor of the frontend. */
export interface SharedTests extends Coverage {
  /** The folders of the sources and of their unit tests: `src` when not given. */
  sources?: string[]
}

/**
 * What lies among the sources and is test material: tests, stories, what
 * only they use, and the examples the stories of an application show.
 */
const TEST_MATERIAL = [
  ...NOT_BUILT,
  '**/__fixtures__/**',
  '**/components/examples.ts',
]

/** The setups of the frontend tests, in `@beauty-salon-frontend/testing`. */
const FRONTEND_SETUP = '@beauty-salon-frontend/testing/setup'
const STORIES_SETUP = '@beauty-salon-frontend/testing/stories'

/**
 * The environment of the integration tests of the backend, which start
 * PostgreSQL, Mailpit and SeaweedFS through testcontainers.
 */
const INTEGRATION_ENVIRONMENT = {
  NODE_ENV: 'test',
  // Work around credential-helper and Ryuk issues when testcontainers
  // starts a container
  TESTCONTAINERS_RYUK_DISABLED: 'true',
  DOCKER_CONFIG: '/dev/null',
  TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE: '/var/run/docker.sock',
}

/** The configuration of the projects, and the coverage over them. */
const configured = (
  resolved: ViteUserConfig,
  projects: TestProjectInlineConfiguration[],
  sources: string[],
  { full, unmeasured = [] }: Coverage,
): ViteUserConfig =>
  defineConfig({
    ...resolved,
    test: {
      ...resolved.test,
      projects,
      coverage: {
        provider: 'v8',
        include: sources.map((source) => `${source}/**/*.{ts,tsx}`),
        exclude: [...TEST_MATERIAL, ...unmeasured],
        // The files that are not fully covered, and a page of each file
        // in `coverage/`
        reporter: [['text', { skipFull: true }], 'html'],
        ...(full ? { thresholds: { 100: true } } : {}),
      },
    },
  })

/** The tests of a package of the backend. */
export const backendTests = (tests: BackendTests): ViteUserConfig =>
  configured(
    {
      // Workspace packages are tested from source, not from their last
      // build. Every other package is resolved as Node resolves it when the
      // server runs: without `module`, which names a build that is meant
      // for a bundler.
      ssr: {
        resolve: {
          conditions: [
            '@beauty-salon-backend/source',
            'node',
            'development|production',
          ],
        },
      },
      test: { environment: 'node' },
    },
    [
      ...(tests.unit
        ? [
            {
              test: {
                name: 'unit',
                include: ['src/**/*.test.ts'],
                exclude: [...configDefaults.exclude, '**/*.integration.test.*'],
                ...tests.unit,
              },
            },
          ]
        : []),
      ...(tests.integration
        ? [
            {
              test: {
                name: 'integration',
                include: ['src/**/*.integration.test.ts'],
                testTimeout: 60_000,
                hookTimeout: 120_000,
                env: INTEGRATION_ENVIRONMENT,
                ...tests.integration,
              },
            },
          ]
        : []),
    ],
    ['src'],
    tests,
  )

/** The setup files and the pool of the unit tests of the frontend. */
const frontendUnit = (unit: FrontendUnitTests) =>
  unit.environment === 'jsdom'
    ? {
        environment: unit.environment,
        setupFiles: [
          FRONTEND_SETUP,
          ...(unit.stories ? [STORIES_SETUP] : []),
          ...(unit.setupFiles ?? []),
        ],
        ...(unit.pool ? { pool: unit.pool } : {}),
      }
    : { environment: 'node' }

/** The tests of a package of the frontend. */
export const frontendTests = (tests: FrontendTests): ViteUserConfig =>
  configured(
    {
      // Workspace packages are tested from source, not from their last build
      resolve: {
        conditions: [
          '@beauty-salon-frontend/source',
          ...defaultClientConditions,
        ],
      },
      ssr: {
        resolve: {
          conditions: [
            '@beauty-salon-frontend/source',
            ...defaultServerConditions,
          ],
        },
      },
      test: {
        css: {
          // The class names of the CSS Modules, as they are written
          modules: { classNameStrategy: 'non-scoped' },
        },
      },
    },
    [
      ...(tests.unit
        ? [
            {
              test: {
                name: 'unit',
                include: ['src/**/*.test.{ts,tsx}'],
                exclude: [...configDefaults.exclude, '**/*.integration.test.*'],
                // The origin that the API client sends its requests to
                env: { VITE_BACKEND_BASE_URL: 'http://localhost:3000' },
                ...frontendUnit(tests.unit),
              },
            },
          ]
        : []),
      ...(tests.integration
        ? [
            {
              test: {
                name: 'integration',
                environment: 'jsdom',
                include: ['src/**/*.integration.test.{ts,tsx}'],
                // Starts the test server of the backend for the run, and
                // stops it. It needs a PostgreSQL: the one at
                // TEST_DATABASE_URL when it is set, otherwise a container
                // (and so a running Docker daemon)
                globalSetup: [
                  '@beauty-salon-frontend/testing/api/global-setup',
                ],
                // An API for the file, a fresh database for every test
                setupFiles: [
                  FRONTEND_SETUP,
                  '@beauty-salon-frontend/testing/api/setup',
                  STORIES_SETUP,
                ],
              },
            },
          ]
        : []),
    ],
    ['src'],
    tests,
  )

/** The tests of a package that is neither of the backend nor of the frontend: unit tests in Node.js. */
export const sharedTests = (tests: SharedTests = {}): ViteUserConfig => {
  const sources = tests.sources ?? ['src']

  return configured(
    { test: { environment: 'node' } },
    [
      {
        test: {
          name: 'unit',
          include: sources.map((source) => `${source}/**/*.test.ts`),
          exclude: [...configDefaults.exclude, '**/__fixtures__/**'],
        },
      },
    ],
    sources,
    tests,
  )
}
