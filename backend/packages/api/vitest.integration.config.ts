import { defineConfig } from 'vitest/config'

/**
 * Integration tests run against a real PostgreSQL instance: the one at
 * TEST_DATABASE_URL when it is set, otherwise a container started through
 * testcontainers (which needs a running Docker daemon).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/__tests__/_shared/setup.ts'],
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
    // Every test creates its own schema; run files one at a time to keep the
    // number of open connections bounded.
    fileParallelism: false,
  },
})
