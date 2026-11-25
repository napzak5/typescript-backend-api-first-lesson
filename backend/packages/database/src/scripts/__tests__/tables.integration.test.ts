import type postgres from 'postgres'
import { afterEach, describe, expect, it } from 'vitest'
import { useTestDatabases } from '../../__tests__/_shared/test-databases'
import { publicTablesOf, rowCountsOf, truncateAll } from '../tables'

const databases = useTestDatabases()
const connections: postgres.Sql[] = []

afterEach(async () => {
  await Promise.all(connections.splice(0).map((sql) => sql.end()))
})

/** A connection to the database of the test, which the test ends. */
const connect = (): postgres.Sql => {
  const sql = databases.connect()
  connections.push(sql)
  return sql
}

/**
 * Two tables of the public schema, one with a row that names a row of the
 * other, and a table of another schema with a row.
 */
const arrangeTables = async (sql: postgres.Sql): Promise<void> => {
  await sql.unsafe(`
    CREATE TABLE salons (id integer PRIMARY KEY);
    CREATE TABLE "Visits" (id integer PRIMARY KEY, salon integer REFERENCES salons (id));
    INSERT INTO salons VALUES (1), (2);
    INSERT INTO "Visits" VALUES (1, 1);
    CREATE SCHEMA kept;
    CREATE TABLE kept.history (id integer PRIMARY KEY);
    INSERT INTO kept.history VALUES (1);
  `)
}

describe('publicTablesOf', () => {
  it('should name the tables of the public schema alone, in the order of the bytes of their names', async () => {
    // Arrange
    const sql = connect()
    await arrangeTables(sql)

    // Act
    const tables = await publicTablesOf(sql)

    // Assert
    expect(tables).toEqual(['Visits', 'salons'])
  })
})

describe('rowCountsOf', () => {
  it('should count the rows of every table of the public schema, in the order of the bytes of their names', async () => {
    // Arrange
    const sql = connect()
    await arrangeTables(sql)

    // Act
    const counts = await rowCountsOf(sql)

    // Assert
    expect(counts).toEqual([
      { table: 'Visits', count: 1 },
      { table: 'salons', count: 2 },
    ])
  })
})

describe('truncateAll', () => {
  it('should delete every row of the public schema, also of the rows that others name, and keep the tables and the other schemas', async () => {
    // Arrange
    const sql = connect()
    await arrangeTables(sql)

    // Act
    await truncateAll(sql)

    // Assert
    expect(await rowCountsOf(sql)).toEqual([
      { table: 'Visits', count: 0 },
      { table: 'salons', count: 0 },
    ])
    expect(await sql`SELECT id FROM kept.history`).toEqual([{ id: 1 }])
  })

  it('should leave a database without tables as it is', async () => {
    // Arrange
    const sql = connect()

    // Act
    await truncateAll(sql)

    // Assert
    expect(await publicTablesOf(sql)).toEqual([])
  })
})
