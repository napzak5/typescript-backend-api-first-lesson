import { defaultClientConditions, defaultServerConditions } from 'vite'
import { describe, expect, it } from 'vitest'
import { configDefaults } from 'vitest/config'
import { backendTests, frontendTests, sharedTests } from './package-tests'

/** What lies among the sources and is never measured. */
const TEST_MATERIAL = [
  '**/*.test.{ts,tsx}',
  '**/*.stories.tsx',
  '**/*.d.ts',
  '**/__tests__/**',
  '**/__stories__/**',
  '**/__fixtures__/**',
  '**/components/examples.ts',
]

describe('backendTests', () => {
  it('should make a project of the unit tests and one of the integration tests, each of the files of its kind', () => {
    // Act
    const config = backendTests({ unit: {}, integration: {} })

    // Assert
    expect(config.test?.projects).toEqual([
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/*.integration.test.*'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 120_000,
          env: {
            NODE_ENV: 'test',
            TESTCONTAINERS_RYUK_DISABLED: 'true',
            DOCKER_CONFIG: '/dev/null',
            TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE: '/var/run/docker.sock',
          },
        },
      },
    ])
  })

  it('should make the project of the tests a package has, and no other', () => {
    // Act
    const unitOnly = backendTests({ unit: {} })
    const integrationOnly = backendTests({ integration: {} })

    // Assert
    expect(unitOnly.test?.projects).toEqual([
      { test: expect.objectContaining({ name: 'unit' }) },
    ])
    expect(integrationOnly.test?.projects).toEqual([
      { test: expect.objectContaining({ name: 'integration' }) },
    ])
  })

  it('should give each project the options of the package', () => {
    // Act
    const config = backendTests({
      unit: { isolate: false },
      integration: {
        setupFiles: ['./src/__tests__/_shared/setup.ts'],
        fileParallelism: false,
      },
    })

    // Assert
    expect(config.test?.projects).toEqual([
      { test: expect.objectContaining({ name: 'unit', isolate: false }) },
      {
        test: expect.objectContaining({
          name: 'integration',
          setupFiles: ['./src/__tests__/_shared/setup.ts'],
          fileParallelism: false,
        }),
      },
    ])
  })

  it('should run the tests in Node.js, with the workspace packages read from their sources and the others as the server reads them', () => {
    // Act
    const config = backendTests({ unit: {} })

    // Assert
    expect(config.test).toMatchObject({ environment: 'node' })
    expect(config.resolve).toBeUndefined()
    expect(config.ssr?.resolve?.conditions).toEqual([
      '@beauty-salon-backend/source',
      'node',
      'development|production',
    ])
  })
})

describe('frontendTests', () => {
  it('should run the unit tests in Node.js, with nothing set up, when the package names no document', () => {
    // Act
    const config = frontendTests({ unit: {} })

    // Assert
    expect(config.test?.projects).toEqual([
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [...configDefaults.exclude, '**/*.integration.test.*'],
          env: { VITE_BACKEND_BASE_URL: 'http://localhost:3000' },
          environment: 'node',
        },
      },
    ])
  })

  it('should set up what jsdom lacks for unit tests in its document, then the stories, then the setup of the package', () => {
    // Act
    const document = frontendTests({ unit: { environment: 'jsdom' } })
    const stories = frontendTests({
      unit: {
        environment: 'jsdom',
        stories: true,
        setupFiles: ['./vitest.setup.ts'],
        pool: 'vmThreads',
      },
    })

    // Assert
    expect(document.test?.projects).toEqual([
      {
        test: expect.objectContaining({
          environment: 'jsdom',
          setupFiles: ['@beauty-salon-frontend/testing/setup'],
        }),
      },
    ])
    expect(stories.test?.projects).toEqual([
      {
        test: expect.objectContaining({
          environment: 'jsdom',
          setupFiles: [
            '@beauty-salon-frontend/testing/setup',
            '@beauty-salon-frontend/testing/stories',
            './vitest.setup.ts',
          ],
          pool: 'vmThreads',
        }),
      },
    ])
  })

  it('should leave the pool of Vitest to unit tests that name none', () => {
    // Act
    const config = frontendTests({ unit: { environment: 'jsdom' } })

    // Assert
    expect(config.test?.projects).toEqual([
      { test: expect.not.objectContaining({ pool: expect.anything() }) },
    ])
  })

  it('should run the integration tests in jsdom against the test server of the backend, with an API for each file', () => {
    // Act
    const config = frontendTests({ integration: {} })

    // Assert
    expect(config.test?.projects).toEqual([
      {
        test: {
          name: 'integration',
          environment: 'jsdom',
          include: ['src/**/*.integration.test.{ts,tsx}'],
          globalSetup: ['@beauty-salon-frontend/testing/api/global-setup'],
          setupFiles: [
            '@beauty-salon-frontend/testing/setup',
            '@beauty-salon-frontend/testing/api/setup',
            '@beauty-salon-frontend/testing/stories',
          ],
        },
      },
    ])
  })

  it('should read the workspace packages from their sources, and the class names of the CSS Modules as they are written', () => {
    // Act
    const config = frontendTests({ unit: {} })

    // Assert
    expect(config.resolve?.conditions).toEqual([
      '@beauty-salon-frontend/source',
      ...defaultClientConditions,
    ])
    expect(config.ssr?.resolve?.conditions).toEqual([
      '@beauty-salon-frontend/source',
      ...defaultServerConditions,
    ])
    expect(config.test?.css).toEqual({
      modules: { classNameStrategy: 'non-scoped' },
    })
  })
})

describe('sharedTests', () => {
  it('should run the unit tests of `src` in Node.js, and read every package as it is installed', () => {
    // Act
    const config = sharedTests()

    // Assert
    expect(config.resolve).toBeUndefined()
    expect(config.ssr).toBeUndefined()
    expect(config.test).toMatchObject({ environment: 'node' })
    expect(config.test?.projects).toEqual([
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, '**/__fixtures__/**'],
        },
      },
    ])
    expect(config.test?.coverage).toMatchObject({
      include: ['src/**/*.{ts,tsx}'],
    })
  })

  it('should run and measure the folders of the sources a package names', () => {
    // Act
    const config = sharedTests({ sources: ['vite', 'vitest'] })

    // Assert
    expect(config.test?.projects).toEqual([
      {
        test: expect.objectContaining({
          include: ['vite/**/*.test.ts', 'vitest/**/*.test.ts'],
        }),
      },
    ])
    expect(config.test?.coverage).toMatchObject({
      include: ['vite/**/*.{ts,tsx}', 'vitest/**/*.{ts,tsx}'],
    })
  })
})

describe('the coverage', () => {
  it('should measure the sources with v8, without the test material', () => {
    // Act
    const configs = [
      backendTests({ unit: {} }),
      frontendTests({ unit: {} }),
      sharedTests(),
    ]

    // Assert
    for (const config of configs) {
      expect(config.test?.coverage).toEqual({
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: TEST_MATERIAL,
        reporter: [['text', { skipFull: true }], 'html'],
      })
    }
  })

  it('should not measure the sources a package names', () => {
    // Act
    const config = frontendTests({
      unit: {},
      unmeasured: ['src/generated/**'],
    })

    // Assert
    expect(config.test?.coverage).toMatchObject({
      exclude: [...TEST_MATERIAL, 'src/generated/**'],
    })
  })

  it('should fail a run that covers less than everything, for a package that says its tests cover all of it', () => {
    // Act
    const configs = [
      backendTests({ unit: {}, full: true }),
      frontendTests({ unit: {}, full: true }),
      sharedTests({ full: true }),
    ]

    // Assert
    for (const config of configs) {
      expect(config.test?.coverage).toMatchObject({
        thresholds: { 100: true },
      })
    }
  })
})
