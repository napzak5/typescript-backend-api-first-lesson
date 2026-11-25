import postgres from 'postgres'
import { describe, expect, it } from 'vitest'
import { useTestDatabases } from '../use-test-databases'

const databases = useTestDatabases({
  prefix: 'testing_hooks',
  schema: 'CREATE TABLE visits (name text NOT NULL)',
})

/** The name of the database a connection reaches. */
const nameOf = async (sql: postgres.Sql): Promise<string | undefined> => {
  const [row] = await sql<{ name: string }[]>`SELECT current_database() AS name`
  return row?.name
}

describe('useTestDatabases', () => {
  // The two tests write the same row: each finds a database where it is not
  // there yet, whichever runs first
  it.each(['first', 'second'])(
    'should give the %s test a database of its own, which starts with the schema',
    async (test) => {
      // Arrange
      const sql = databases.client()

      // Act
      const before = await sql`SELECT name FROM visits`
      await sql`INSERT INTO visits VALUES (${test})`

      // Assert
      expect(before).toEqual([])
    },
  )

  it('should drop the database of a test after it: one database of the file is left beside the template', async () => {
    // Arrange
    const name = (await nameOf(databases.client())) ?? ''
    const mark = name.replace(/_\d+$/, '')

    // Act
    const rows = await databases.client()<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE starts_with(datname, ${mark})
      ORDER BY datname COLLATE "C"
    `

    // Assert
    expect(rows).toEqual([{ datname: name }, { datname: `${mark}_template` }])
  })

  it('should give the URL and other connections of the database of the running test', async () => {
    // Arrange
    const byUrl = postgres(databases.url(), { max: 1 })
    const other = databases.connect()

    // Act
    const names = [
      await nameOf(databases.client()),
      await nameOf(byUrl),
      await nameOf(other),
    ]

    // Assert
    expect(new Set(names).size).toBe(1)
    expect(names[0]).toMatch(/^testing_hooks_[0-9a-f]{12}_\d+$/)
    await byUrl.end()
    await other.end()
  })
})
