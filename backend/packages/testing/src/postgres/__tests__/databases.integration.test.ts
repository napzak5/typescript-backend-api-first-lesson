import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { openTestDatabases } from '../databases'
import { startTestPostgres, type TestPostgres } from '../instance'

let instance: TestPostgres
/** A connection of the test's own to the instance, to see the databases from the outside. */
let observer: postgres.Sql

beforeAll(async () => {
  instance = await startTestPostgres(process.env)
  observer = postgres(instance.url, { max: 1 })
})

afterAll(async () => {
  await observer.end()
  await instance.stop()
})

/** The names of the databases of the instance that begin with `start`. */
const databasesBeginningWith = async (start: string): Promise<string[]> => {
  const rows = await observer<{ datname: string }[]>`
    SELECT datname FROM pg_database
    WHERE starts_with(datname, ${start})
    ORDER BY datname COLLATE "C"
  `
  return rows.map(({ datname }) => datname)
}

/** The tables of the public schema of a database. */
const tablesOf = async (sql: postgres.Sql): Promise<string[]> => {
  const rows = await sql<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    ORDER BY tablename
  `
  return rows.map(({ tablename }) => tablename)
}

describe('openTestDatabases', () => {
  it('should start every database with the schema and the rows written into the template', async () => {
    // Arrange
    const databases = await openTestDatabases(instance.url, {
      prefix: 'testing_filled',
      schema: `
        CREATE TABLE salons (name text PRIMARY KEY);
        CREATE TABLE visits (salon text NOT NULL REFERENCES salons);
      `,
      fill: async (template) => {
        await template`INSERT INTO salons VALUES ('Ginza')`
        await template`INSERT INTO visits VALUES ('Ginza')`
      },
    })

    // Act
    const first = await databases.create()
    const second = await databases.create()

    // Assert
    for (const database of [first, second]) {
      expect(await database.client`SELECT salon FROM visits`).toEqual([
        { salon: 'Ginza' },
      ])
      await database.drop()
    }
    await databases.close()
  })

  it('should start every database empty without a schema and rows', async () => {
    // Arrange
    const databases = await openTestDatabases(instance.url, {
      prefix: 'testing_empty',
    })

    // Act
    const database = await databases.create()

    // Assert
    expect(await tablesOf(database.client)).toEqual([])
    await database.drop()
    await databases.close()
  })

  it('should keep what one database is written apart from the others', async () => {
    // Arrange
    const databases = await openTestDatabases(instance.url, {
      prefix: 'testing_apart',
      schema: 'CREATE TABLE visits (name text NOT NULL)',
    })
    const first = await databases.create()
    const second = await databases.create()

    // Act
    await first.client`INSERT INTO visits VALUES ('only in the first')`

    // Assert
    expect(await second.client`SELECT name FROM visits`).toEqual([])
    await first.drop()
    await second.drop()
    await databases.close()
  })

  it('should name the databases of a call after the prefix and a mark of the call, in 63 characters at most', async () => {
    // Arrange
    const prefix = 'testing_names_of_forty_one_characters_abc'
    const first = await openTestDatabases(instance.url, { prefix })
    const second = await openTestDatabases(instance.url, { prefix })

    // Act
    const databases = [
      await first.create(),
      await first.create(),
      await second.create(),
    ]

    // Assert
    const [one = '', two = '', three = ''] = databases.map(({ name }) => name)
    const markOf = (name: string): string => name.replace(/_\d+$/, '')
    expect(markOf(one)).toMatch(new RegExp(`^${prefix}_[0-9a-f]{12}$`))
    expect([one, two]).toEqual([`${markOf(one)}_1`, `${markOf(one)}_2`])
    expect(markOf(three)).not.toBe(markOf(one))
    const names = await databasesBeginningWith(prefix)
    expect(names).toEqual(
      [
        one,
        two,
        `${markOf(one)}_template`,
        three,
        `${markOf(three)}_template`,
      ].sort(),
    )
    expect(Math.max(...names.map((name) => name.length))).toBe(63)
    for (const database of databases) {
      await database.drop()
    }
    await first.close()
    await second.close()
  })

  it('should give a database a URL and other connections that reach it', async () => {
    // Arrange
    const databases = await openTestDatabases(instance.url, {
      prefix: 'testing_reach',
    })
    const database = await databases.create()
    const byUrl = postgres(database.url, { max: 1 })
    const other = database.connect()

    // Act
    const reached = await Promise.all(
      [database.client, byUrl, other].map(
        async (sql) =>
          (await sql<{ name: string }[]>`SELECT current_database() AS name`)[0],
      ),
    )

    // Assert
    expect(reached).toEqual(Array(3).fill({ name: database.name }))
    await byUrl.end()
    await other.end()
    await database.drop()
    await databases.close()
  })

  it('should drop a database with the connections that are still open to it', async () => {
    // Arrange
    const databases = await openTestDatabases(instance.url, {
      prefix: 'testing_drop',
    })
    const database = await databases.create()
    const other = database.connect()
    await other`SELECT 1`

    // Act
    await database.drop()

    // Assert
    expect(await databasesBeginningWith(database.name)).toEqual([])
    await expect(other`SELECT 1`).rejects.toThrow()
    await expect(database.client`SELECT 1`).rejects.toThrow()
    await other.end()
    await databases.close()
  })

  it('should drop the template when the databases are closed', async () => {
    // Arrange
    const databases = await openTestDatabases(instance.url, {
      prefix: 'testing_closed',
    })
    const database = await databases.create()
    await database.drop()

    // Act
    await databases.close()

    // Assert
    expect(await databasesBeginningWith('testing_closed_')).toEqual([])
  })

  it('should write nothing of what PostgreSQL says by the way', async () => {
    // Arrange
    const log = vi.spyOn(console, 'log')
    const databases = await openTestDatabases(instance.url, {
      prefix: 'testing_quiet',
      schema: 'DROP TABLE IF EXISTS nothing_in_the_schema',
      fill: async (template) => {
        await template`DROP TABLE IF EXISTS nothing_in_the_rows`
      },
    })
    const database = await databases.create()

    // Act
    await database.client`DROP TABLE IF EXISTS nothing_in_the_database`

    // Assert
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
    await database.drop()
    await databases.close()
  })
})
