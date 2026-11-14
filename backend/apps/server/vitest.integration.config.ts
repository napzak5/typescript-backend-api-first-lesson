import { defineConfig } from 'vitest/config'

/**
 * Integration tests start the real server against a real PostgreSQL
 * instance: the one at TEST_DATABASE_URL when it is set, otherwise a
 * container started through testcontainers (which needs a running Docker
 * daemon).
 */
export default defineConfig({
  // Workspace packages are tested from source, not from their last build.
  ssr: {
    resolve: {
      conditions: [
        '@beauty-salon-backend/source',
        'module',
        'node',
        'development|production',
      ],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: 'test',
      // Work around credential-helper and Ryuk issues when testcontainers
      // starts the database
      TESTCONTAINERS_RYUK_DISABLED: 'true',
      DOCKER_CONFIG: '/dev/null',
      TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE: '/var/run/docker.sock',
    },
  },
})
