import { salons } from '@beauty-salon-backend/database'
import { Result } from '@beauty-salon-backend/utility'
import { count, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { newSalon } from '../../repositories/__tests__/_shared/rows'
import { CLOCK, CLOCK_ONCE, ONE_MOMENT } from '../clock'
import { describeDatabaseError } from '../failure'
import {
  connectDatabase,
  type DatabaseConnection,
  pingDatabase,
} from '../index'
import { AT_ONE_MOMENT } from '../snapshot'

const databases = useTestDatabase()

/** A port of the loopback interface on which nothing listens. */
const NOTHING_LISTENS = 'postgres://postgres:postgres@127.0.0.1:1/nothing'

describe('connectDatabase and pingDatabase', () => {
  const opened: DatabaseConnection[] = []
  const open = (url: string): DatabaseConnection => {
    const connection = connectDatabase({
      url,
      poolMax: 2,
      connectTimeoutMs: 2_000,
    })
    opened.push(connection)
    return connection
  }

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((connection) => connection.close()))
  })

  it('should answer a ping when the database answers a query', async () => {
    // Arrange
    const { database } = open(databases.url())

    // Act
    const pinged = await pingDatabase(database)

    // Assert
    expect(pinged).toEqual({ type: 'success', data: null })
  })

  it('should answer a ping of a database that cannot be reached with what the driver said', async () => {
    // Arrange
    const { database } = open(NOTHING_LISTENS)

    // Act
    const pinged = await pingDatabase(database)

    // Assert
    expect(pinged).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Database is unreachable',
        cause: expect.objectContaining({ code: 'ECONNREFUSED' }),
      },
    })
  })

  it('should run no query once it is closed', async () => {
    // Arrange
    const connection = open(databases.url())
    await pingDatabase(connection.database)

    // Act
    await connection.close()
    const pinged = await pingDatabase(connection.database)

    // Assert
    expect(pinged).toMatchObject({
      type: 'error',
      error: { cause: { code: 'CONNECTION_ENDED' } },
    })
  })
})

describe('the clock of the database', () => {
  it('should read a moment of its own for every statement, where now() stays the start of the transaction', async () => {
    // Arrange
    const reading = sql`select extract(epoch from ${CLOCK})::float8 as "clock", extract(epoch from now())::float8 as "now"`

    // Act
    const [first, second] = await databases
      .database()
      .transaction(async (tx) => [
        ...(await tx.execute<{ clock: number; now: number }>(reading)),
        ...(await tx.execute<{ clock: number; now: number }>(reading)),
      ])

    // Assert
    expect(second?.clock).toBeGreaterThan(first?.clock ?? Infinity)
    expect(second?.now).toBe(first?.now)
  })

  it('should stamp every column of a new row with the one moment it read', async () => {
    // Act
    const [row] = await databases
      .database()
      .with(CLOCK_ONCE)
      .insert(salons)
      .values({ ...newSalon(), createdAt: ONE_MOMENT, updatedAt: ONE_MOMENT })
      .returning()

    // Assert
    expect(row?.updatedAt).toBe(row?.createdAt)
  })
})

describe('AT_ONE_MOMENT', () => {
  it('should read what was committed before its first statement, and nothing committed after it', async () => {
    // Arrange
    const db = databases.database()
    await db.insert(salons).values(newSalon())

    // Act
    const counts = await db.transaction(async (tx) => {
      const [before] = await tx.select({ total: count() }).from(salons)
      await db.insert(salons).values(newSalon())
      const [after] = await tx.select({ total: count() }).from(salons)
      return [before?.total, after?.total]
    }, AT_ONE_MOMENT)

    // Assert
    expect(counts).toEqual([1, 1])
    expect(await db.select({ total: count() }).from(salons)).toEqual([
      { total: 2 },
    ])
  })

  it('should write nothing', async () => {
    // Arrange
    const db = databases.database()

    // Act
    const written = Result.mapError(
      await Result.fromPromise(
        db.transaction(
          (tx) => tx.insert(salons).values(newSalon()),
          AT_ONE_MOMENT,
        ),
      ),
      describeDatabaseError,
    )

    // Assert
    expect(written).toMatchObject({
      type: 'error',
      error: { code: '25006' },
    })
    expect(await db.select({ total: count() }).from(salons)).toEqual([
      { total: 0 },
    ])
  })
})
