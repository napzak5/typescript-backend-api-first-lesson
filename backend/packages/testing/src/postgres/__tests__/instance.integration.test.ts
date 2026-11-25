import postgres from 'postgres'
import { describe, expect, it } from 'vitest'
import { startTestPostgres } from '../instance'

describe('startTestPostgres', () => {
  // TEST_DATABASE_URL is not passed on, so a container is started also in CI,
  // where it names the instance of every package
  it('should start a PostgreSQL 18 of its own without TEST_DATABASE_URL, with a role that may create databases', async () => {
    // Arrange
    const instance = await startTestPostgres({})
    const sql = postgres(instance.url, { max: 1 })

    // Act
    const rows = await sql<{ version: number; mayCreate: boolean }[]>`
      SELECT current_setting('server_version_num')::integer / 10000 AS version,
        rolcreatedb AS "mayCreate"
      FROM pg_roles WHERE rolname = current_user
    `
    await sql.end()
    await instance.stop()

    // Assert
    expect(rows).toEqual([{ version: 18, mayCreate: true }])
  })

  it('should stop the container it started', async () => {
    // Arrange
    const instance = await startTestPostgres({})

    // Act
    await instance.stop()

    // Assert
    const after = postgres(instance.url, { max: 1, connect_timeout: 5 })
    await expect(after`SELECT 1`).rejects.toThrow()
    await after.end()
  })
})
