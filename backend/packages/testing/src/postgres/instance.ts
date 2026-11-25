import { PostgreSqlContainer } from '@testcontainers/postgresql'

/** The PostgreSQL that docker compose and CI run. */
const IMAGE = 'postgres:18-alpine'

/** How long the first start may take, which pulls the image. */
const STARTUP_TIMEOUT_MS = 120_000

/** A PostgreSQL instance of the tests, and how it is let go. */
export interface TestPostgres {
  /** The URL of the instance, with a role that may create databases. */
  readonly url: string
  /** Stops the container that was started for the tests, if one was. */
  stop(): Promise<void>
}

/**
 * The PostgreSQL instance of the tests: the one at `TEST_DATABASE_URL`
 * (CI runs one for the tests of every package), or else a container of its
 * own. The tests make databases of their own on it, so the tests of
 * several packages can share it.
 */
export const startTestPostgres = async (
  variables: Readonly<Record<string, string | undefined>>,
): Promise<TestPostgres> => {
  const { TEST_DATABASE_URL: url } = variables
  if (url) {
    return { url, stop: async () => undefined }
  }

  const container = await new PostgreSqlContainer(IMAGE)
    .withStartupTimeout(STARTUP_TIMEOUT_MS)
    .start()

  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop()
    },
  }
}
