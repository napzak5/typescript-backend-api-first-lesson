import { defineConfig } from 'vitest/config'

/**
 * Integration tests send mail to a real SMTP server: a Mailpit container
 * started through testcontainers (which needs a running Docker daemon).
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
      // starts the mail server
      TESTCONTAINERS_RYUK_DISABLED: 'true',
      DOCKER_CONFIG: '/dev/null',
      TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE: '/var/run/docker.sock',
    },
  },
})
