import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import type postgres from 'postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTestDatabases } from '../../__tests__/_shared/test-databases'
import {
  applyBaseline,
  dropHistory,
  type MigrationFile,
  migrate,
  readBaseline,
  readMigrationFiles,
} from '../migrations'

const sqlDirectory = path.resolve(import.meta.dirname, '../../../sql')

const databases = useTestDatabases()

/** The database of the running test: empty when the test starts. */
let sql: postgres.Sql

beforeEach(() => {
  sql = databases.connect()
})

afterEach(async () => {
  await sql.end()
})

/** A schema small enough to read, shaped like the real one. */
const baseline = `
  CREATE TABLE salons (id serial PRIMARY KEY, name text NOT NULL, phone text);
`

/** Not idempotent on purpose: applying one of them twice fails. */
const addPhone: MigrationFile = {
  name: '202601010900_add_phone.sql',
  sql: 'ALTER TABLE salons ADD COLUMN phone text;',
}
const addEmail: MigrationFile = {
  name: '202601020900_add_email.sql',
  sql: 'ALTER TABLE salons ADD COLUMN email text;',
}
const broken: MigrationFile = {
  name: '202601030900_broken.sql',
  sql: `
    ALTER TABLE salons ADD COLUMN website text;
    ALTER TABLE salons ADD COLUMN name text;
  `,
}

const columnsOf = async (table: string): Promise<string[]> => {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY ordinal_position
  `
  return rows.map((row) => row.column_name)
}

/**
 * Everything the public schema defines, one line per column, enum, index and
 * constraint, so that two states of a database can be compared as a whole.
 */
const describeSchema = async (): Promise<string[]> => {
  const columns = await sql<{ line: string }[]>`
    SELECT format(
      'column %s.%s %s nullable=%s default=%s',
      table_name, column_name, udt_name, is_nullable,
      coalesce(column_default, '-')
    ) AS line
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `
  const enums = await sql<{ line: string }[]>`
    SELECT format(
      'enum %s: %s',
      t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
    ) AS line
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
  `
  const indexes = await sql<{ line: string }[]>`
    SELECT format('index %s', indexdef) AS line
    FROM pg_indexes
    WHERE schemaname = 'public'
  `
  const constraints = await sql<{ line: string }[]>`
    SELECT format(
      'constraint %s on %s: %s',
      c.conname, c.conrelid::regclass, pg_get_constraintdef(c.oid)
    ) AS line
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
  `

  return [...columns, ...enums, ...indexes, ...constraints]
    .map((row) => row.line)
    .sort()
}

const recordedMigrations = async (): Promise<string[]> => {
  const rows = await sql<{ name: string }[]>`
    SELECT name FROM migration_history.applied_migrations ORDER BY name
  `
  return rows.map((row) => row.name)
}

/** A database that was set up before migrations were recorded. */
const createLegacyDatabase = async (): Promise<void> => {
  await sql.unsafe(
    'CREATE TABLE salons (id serial PRIMARY KEY, name text NOT NULL);',
  )
}

describe('migrate', () => {
  it('should create an empty database from the baseline and record the migrations without running them', async () => {
    const outcome = await migrate(sql, { baseline, migrations: [addPhone] })

    expect(outcome).toEqual({ type: 'initialized', recorded: [addPhone.name] })
    expect(await columnsOf('salons')).toEqual(['id', 'name', 'phone'])
    expect(await recordedMigrations()).toEqual([addPhone.name])
  })

  it('should apply the migrations an existing database has not seen, in the order of their names', async () => {
    await createLegacyDatabase()

    const outcome = await migrate(sql, {
      baseline,
      migrations: [addPhone, addEmail],
    })

    expect(outcome).toEqual({
      type: 'migrated',
      applied: [addPhone.name, addEmail.name],
    })
    expect(await columnsOf('salons')).toEqual(['id', 'name', 'phone', 'email'])
    expect(await recordedMigrations()).toEqual([addPhone.name, addEmail.name])
  })

  it('should apply nothing on a second run', async () => {
    await createLegacyDatabase()
    await migrate(sql, { baseline, migrations: [addPhone] })

    const outcome = await migrate(sql, { baseline, migrations: [addPhone] })

    expect(outcome).toEqual({ type: 'migrated', applied: [] })
  })

  it('should apply only the migration that was added since the last run', async () => {
    await migrate(sql, { baseline, migrations: [addPhone] })

    const outcome = await migrate(sql, {
      baseline,
      migrations: [addPhone, addEmail],
    })

    expect(outcome).toEqual({ type: 'migrated', applied: [addEmail.name] })
    expect(await columnsOf('salons')).toEqual(['id', 'name', 'phone', 'email'])
  })

  it('should roll back a failing migration entirely and keep the ones before it', async () => {
    await createLegacyDatabase()

    await expect(
      migrate(sql, { baseline, migrations: [addPhone, broken, addEmail] }),
    ).rejects.toThrow('column "name" of relation "salons" already exists')

    expect(await columnsOf('salons')).toEqual(['id', 'name', 'phone'])
    expect(await recordedMigrations()).toEqual([addPhone.name])
  })

  it('should continue after the failing migration has been corrected', async () => {
    await createLegacyDatabase()
    await migrate(sql, { baseline, migrations: [addPhone, broken] }).catch(
      () => undefined,
    )
    const corrected = {
      name: broken.name,
      sql: 'ALTER TABLE salons ADD COLUMN website text;',
    }

    const outcome = await migrate(sql, {
      baseline,
      migrations: [addPhone, corrected, addEmail],
    })

    expect(outcome).toEqual({
      type: 'migrated',
      applied: [corrected.name, addEmail.name],
    })
  })

  it('should apply a migration once when two processes run at the same time', async () => {
    await createLegacyDatabase()
    const other = databases.connect()
    const plan = { baseline, migrations: [addPhone, addEmail] }

    const outcomes = await Promise.all([
      migrate(sql, plan),
      migrate(other, plan),
    ])
    await other.end()

    const applied = outcomes.flatMap((outcome) =>
      outcome.type === 'migrated' ? outcome.applied : [],
    )
    expect(applied.sort()).toEqual([addPhone.name, addEmail.name])
    expect(await columnsOf('salons')).toEqual(['id', 'name', 'phone', 'email'])
  })

  it('should create an empty database once when two processes run at the same time', async () => {
    const other = databases.connect()
    const plan = { baseline, migrations: [addPhone] }

    const outcomes = await Promise.all([
      migrate(sql, plan),
      migrate(other, plan),
    ])
    await other.end()

    expect(outcomes.map((outcome) => outcome.type).sort()).toEqual([
      'initialized',
      'migrated',
    ])
    expect(await recordedMigrations()).toEqual([addPhone.name])
  })
})

describe('applyBaseline', () => {
  it('should create the schema and record every migration as applied', async () => {
    const recorded = await applyBaseline(sql, {
      baseline,
      migrations: [addPhone],
    })

    expect(recorded).toEqual([addPhone.name])
    expect(await migrate(sql, { baseline, migrations: [addPhone] })).toEqual({
      type: 'migrated',
      applied: [],
    })
  })

  it('should fail and change nothing on a database that has the schema', async () => {
    await createLegacyDatabase()

    await expect(
      applyBaseline(sql, { baseline, migrations: [addPhone] }),
    ).rejects.toThrow('relation "salons" already exists')

    expect(await columnsOf('salons')).toEqual(['id', 'name'])
  })
  it('should create the schema and record nothing before the first migration is written', async () => {
    // Arrange
    const plan = { baseline, migrations: [] }

    // Act
    const recorded = await applyBaseline(sql, plan)

    // Assert
    expect(recorded).toEqual([])
    expect(await recordedMigrations()).toEqual([])
    expect(await columnsOf('salons')).toEqual(['id', 'name', 'phone'])
  })
})

describe('dropHistory', () => {
  it('should make an emptied database count as empty again', async () => {
    await migrate(sql, { baseline, migrations: [addPhone] })
    await sql.unsafe('DROP TABLE salons')

    await dropHistory(sql)

    expect(await migrate(sql, { baseline, migrations: [addPhone] })).toEqual({
      type: 'initialized',
      recorded: [addPhone.name],
    })
  })
})

describe('the migrations of this repository', () => {
  const plan = {
    baseline: readBaseline(path.join(sqlDirectory, 'setup.sql')),
    migrations: readMigrationFiles(path.join(sqlDirectory, 'migrations')),
  }

  it('should be read in the order of their timestamps', () => {
    const names = plan.migrations.map(({ name }) => name)

    expect(names.length).toBeGreaterThan(0)
    expect(names).toEqual([...names].sort())
    expect(names.every((name) => /^\d{12}_\w+\.sql$/.test(name))).toBe(true)
  })

  it('should create an empty database from setup.sql', async () => {
    const outcome = await migrate(sql, plan)

    expect(outcome.type).toBe('initialized')
    expect(await columnsOf('salons')).toContain('phoneNumber')
    expect(await recordedMigrations()).toEqual(
      plan.migrations.map(({ name }) => name),
    )
  })

  it('should bring a database from before the history up to date without changing the schema', async () => {
    await applyBaseline(sql, plan)
    const schemaBefore = await describeSchema()
    await dropHistory(sql)

    const outcome = await migrate(sql, plan)

    expect(outcome).toEqual({
      type: 'migrated',
      applied: plan.migrations.map(({ name }) => name),
    })
    expect(schemaBefore.length).toBeGreaterThan(100)
    expect(await describeSchema()).toEqual(schemaBefore)
  })

  /** Stores a salon with the weekly hours and returns its ID. */
  const storeSalon = async (businessHours: unknown): Promise<string> => {
    const id = randomUUID()
    const hours = businessHours === null ? null : JSON.stringify(businessHours)
    await sql`
      INSERT INTO salons (
        id, name, prefecture, city, address, "phoneNumber", email,
        "imageUrls", features, amenities, "businessHours", "updatedAt"
      )
      VALUES (
        ${id}, 'Hair Studio Aoyama', '東京都', '港区', '南青山1-2-3',
        '03-1234-5678', ${`${id}@example.com`}, '{}', '{}', '{}',
        ${hours}::text::jsonb, '2026-01-01T00:00:00Z'
      )
    `
    return id
  }

  /** Stores a customer of their own and returns the ID. */
  const storeNewCustomer = async (): Promise<string> => {
    const id = randomUUID()
    await sql`
      INSERT INTO customers (
        id, "firstName", "lastName", email, "phoneNumber", tags
      )
      VALUES (
        ${id}, 'Taro', 'Suzuki', ${`${id}@example.com`}, '090-8765-4321', '{}'
      )
    `
    return id
  }

  /** Stores a user of their own, an administrator, and returns the ID. */
  const storeNewUser = async (): Promise<string> => {
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO users (email, "passwordHash", role)
      VALUES (${`${randomUUID()}@example.com`}, 'hash', 'admin')
      RETURNING id
    `
    if (user === undefined) {
      throw new Error('No user was stored')
    }
    return user.id
  }

  type StoredReview = {
    overallRating: number
    serviceRating?: number | null
    imageUrls?: string | null
    ownerResponse?: string | null
    ownerRespondedAt?: string | null
  }

  /**
   * A review of the salon, by a customer of their own, of a booking of
   * their own with a staff member of the salon; returns its ID.
   * `imageUrls` is the JSON text of the column.
   */
  const storeReview = async (
    salonId: string,
    {
      overallRating,
      serviceRating = null,
      imageUrls = '[]',
      ownerResponse = null,
      ownerRespondedAt = null,
    }: StoredReview,
  ): Promise<string> => {
    const customerId = await storeNewCustomer()
    const staffId = randomUUID()
    await sql`
      INSERT INTO staff (
        id, "salonId", "firstName", "lastName", "displayName", email,
        "phoneNumber", specialties, certifications
      )
      VALUES (
        ${staffId}, ${salonId}, 'Hanako', 'Sato', 'Hanako',
        ${`${staffId}@example.com`}, '03-1234-5678', '{}', '{}'
      )
    `
    const bookingId = randomUUID()
    await sql`
      INSERT INTO bookings (
        id, "bookingNumber", "salonId", "customerId", "staffId",
        "bookingDate", "startTime", "endTime", duration, subtotal,
        "totalAmount"
      )
      VALUES (
        ${bookingId}, ${`BK-${bookingId.slice(0, 8)}`}, ${salonId},
        ${customerId}, ${staffId}, '2026-11-01',
        '2026-11-01T01:00:00Z', '2026-11-01T02:00:00Z', 60, 0, 0
      )
    `
    const id = randomUUID()
    await sql`
      INSERT INTO reviews (
        id, "salonId", "customerId", "bookingId", "staffId",
        "overallRating", "serviceRating", "imageUrls", "ownerResponse",
        "ownerRespondedAt"
      )
      VALUES (
        ${id}, ${salonId}, ${customerId}, ${bookingId}, ${staffId},
        ${overallRating}, ${serviceRating}, ${imageUrls}::text::jsonb,
        ${ownerResponse}, ${ownerRespondedAt}
      )
    `
    return id
  }

  /** Runs one migration of the repository the way `migrate` would. */
  const runMigration = async (migration: string): Promise<void> => {
    const files = plan.migrations.filter(({ name }) => name === migration)
    expect(files).toHaveLength(1)
    await Promise.all(files.map((file) => sql.unsafe(file.sql)))
  }

  describe('202611160500_business_hours_without_time_zone.sql', () => {
    const monday = {
      dayOfWeek: 'monday',
      operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
      breakSlots: [{ startTime: '13:00', endTime: '14:00' }],
      isClosed: false,
      effectivePeriod: null,
    }
    const sunday = {
      dayOfWeek: 'sunday',
      operatingSlots: [],
      breakSlots: null,
      isClosed: true,
      effectivePeriod: null,
    }

    /**
     * What the salon has of hours, when it says it was last changed, and
     * the transaction that wrote the row: the same as long as nothing did.
     */
    const rowOf = (id: string) => sql<
      { hours: unknown; updatedAt: string; writtenBy: string }[]
    >`
      SELECT
        "businessHours" AS hours,
        "updatedAt"::text AS "updatedAt",
        xmin::text AS "writtenBy"
      FROM salons
      WHERE id = ${id}
    `

    /** The hours alone, to be compared key by key. */
    const hoursOf = async (id: string): Promise<unknown[]> =>
      (await rowOf(id)).map(({ hours }) => hours)

    const run = (): Promise<void> =>
      runMigration('202611160500_business_hours_without_time_zone.sql')

    beforeEach(async () => {
      await applyBaseline(sql, plan)
    })

    it('should take the time zone out of every day of the weekly hours and keep the rest in its order', async () => {
      const tuesday = { ...monday, dayOfWeek: 'tuesday' }
      /** The key is the day's: below the day it is not this migration's. */
      const wednesday = {
        ...monday,
        dayOfWeek: 'wednesday',
        effectivePeriod: { timezone: 'UTC' },
      }
      const id = await storeSalon([
        { ...sunday, timezone: null },
        { ...monday, timezone: 'Asia/Tokyo' },
        tuesday,
        { ...wednesday, timezone: 'UTC' },
      ])
      const untouched = await storeSalon([sunday, monday])
      const [before] = await rowOf(untouched)

      await run()

      expect(await hoursOf(id)).toEqual([[sunday, monday, tuesday, wednesday]])
      expect(await rowOf(untouched)).toEqual([before])
    })

    it('should not say that the salon was changed, and write nothing on a second run', async () => {
      const id = await storeSalon([{ ...monday, timezone: 'Asia/Tokyo' }])
      const [before] = await rowOf(id)

      await run()
      const [after] = await rowOf(id)
      await run()

      expect(after?.hours).toEqual([monday])
      expect(after?.updatedAt).toBe(before?.updatedAt)
      expect(after?.writtenBy).not.toBe(before?.writtenBy)
      expect(await rowOf(id)).toEqual([after])
    })

    it('should keep the entries that are not objects where they are', async () => {
      const id = await storeSalon([
        'timezone',
        { ...monday, timezone: 'UTC' },
        ['timezone'],
        null,
        7,
      ])

      await run()

      expect(await hoursOf(id)).toEqual([
        ['timezone', monday, ['timezone'], null, 7],
      ])
    })

    it.each([
      ['no weekly hours', null],
      ['an empty list of days', []],
      ['days without a time zone', [monday, sunday]],
      ['hours that are not a list', { timezone: 'Asia/Tokyo' }],
      ['hours that are a text', 'timezone'],
      ['a list without objects', ['timezone', ['timezone'], null, 7]],
      [
        'a time zone below the days only',
        [{ ...monday, effectivePeriod: { timezone: 'Asia/Tokyo' } }],
      ],
    ])('should not write a salon that has %s', async (_case, businessHours) => {
      const id = await storeSalon(businessHours)
      const before = await rowOf(id)

      await run()

      expect(before).toHaveLength(1)
      expect(await rowOf(id)).toEqual(before)
    })
  })

  describe('202611160600_opening_hours_one_row_per_date.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611160600_opening_hours_one_row_per_date.sql')

    /** A calendar row of the salon that opens at a time and was written at another. */
    const storeDay = async (
      salonId: string,
      date: string,
      openTime: string,
      updatedAt: string,
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO opening_hours (
          id, "salonId", "dayOfWeek", date, "openTime", "closeTime",
          "updatedAt"
        )
        VALUES (
          ${id}, ${salonId},
          lower(trim(to_char(${date}::date, 'Day')))::day_of_week,
          ${date}, ${openTime}, '19:00', ${updatedAt}
        )
      `
      return id
    }

    /** The calendar of the salon: when it opens on which date. */
    const calendarOf = async (salonId: string): Promise<string[]> => {
      const rows = await sql<{ day: string }[]>`
        SELECT date::text || ' ' || "openTime"::text AS day
        FROM opening_hours
        WHERE "salonId" = ${salonId}
        ORDER BY day
      `
      return rows.map(({ day }) => day)
    }

    // A database from before the migration: nothing keeps two rows for a
    // date out.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      await sql`DROP INDEX opening_hours_salon_date_unique`
    })

    it('should keep, of the rows a salon has for a date, the one that was written last', async () => {
      const salon = await storeSalon(null)
      const other = await storeSalon(null)
      await storeDay(salon, '2026-11-16', '10:00', '2026-11-02T00:00:00Z')
      await storeDay(salon, '2026-11-16', '11:00', '2026-11-03T00:00:00Z')
      await storeDay(salon, '2026-11-16', '09:00', '2026-11-01T00:00:00Z')
      await storeDay(salon, '2026-11-17', '12:00', '2026-11-01T00:00:00Z')
      await storeDay(other, '2026-11-16', '08:00', '2026-10-01T00:00:00Z')

      await run()

      expect(await calendarOf(salon)).toEqual([
        '2026-11-16 11:00:00',
        '2026-11-17 12:00:00',
      ])
      expect(await calendarOf(other)).toEqual(['2026-11-16 08:00:00'])
    })

    it('should keep one of the rows that were written at the same moment', async () => {
      const salon = await storeSalon(null)
      const ids = [
        await storeDay(salon, '2026-11-16', '10:00', '2026-11-01T00:00:00Z'),
        await storeDay(salon, '2026-11-16', '10:00', '2026-11-01T00:00:00Z'),
        await storeDay(salon, '2026-11-16', '10:00', '2026-11-01T00:00:00Z'),
      ]

      await run()

      const kept = await sql<{ id: string }[]>`
        SELECT id FROM opening_hours WHERE "salonId" = ${salon}
      `
      expect(kept).toEqual([{ id: ids.toSorted().at(-1) }])
    })

    it('should keep a second row for a date out from then on', async () => {
      const salon = await storeSalon(null)
      await storeDay(salon, '2026-11-16', '10:00', '2026-11-01T00:00:00Z')

      await run()

      await expect(
        storeDay(salon, '2026-11-16', '11:00', '2026-11-02T00:00:00Z'),
      ).rejects.toThrow('opening_hours_salon_date_unique')
      expect(await calendarOf(salon)).toEqual(['2026-11-16 10:00:00'])
    })

    it('should delete nothing where every date has one row, and nothing on a second run', async () => {
      const salon = await storeSalon(null)
      await storeDay(salon, '2026-11-16', '10:00', '2026-11-02T00:00:00Z')
      await storeDay(salon, '2026-11-16', '11:00', '2026-11-01T00:00:00Z')
      await storeDay(salon, '2026-11-17', '12:00', '2026-11-01T00:00:00Z')

      await run()
      const afterFirst = await calendarOf(salon)
      await run()

      expect(afterFirst).toEqual(['2026-11-16 10:00:00', '2026-11-17 12:00:00'])
      expect(await calendarOf(salon)).toEqual(afterFirst)
    })
  })

  describe('202611161000_customer_points_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611161000_customer_points_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** A customer with a balance; returns their ID. */
    const storeCustomer = async (loyaltyPoints: number): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO customers (
          id, "firstName", "lastName", email, "phoneNumber", tags,
          "loyaltyPoints"
        )
        VALUES (
          ${id}, 'Taro', 'Suzuki', ${`${id}@example.com`}, '090-8765-4321',
          '{}', ${loyaltyPoints}
        )
      `
      return id
    }

    type StoredPoints = {
      id?: string
      transactionType?: string
      points: number
      balance: number
      createdAt?: string
      referenceType?: string | null
      referenceId?: string | null
    }

    /** A point transaction of the customer, an adjustment unless said otherwise. */
    const storePoints = (
      customerId: string,
      {
        id = randomUUID(),
        transactionType = 'adjusted',
        points,
        balance,
        createdAt = '2026-01-01T00:00:00Z',
        referenceType = null,
        referenceId = null,
      }: StoredPoints,
    ) => sql`
      INSERT INTO customer_points (
        id, "customerId", "transactionType", points, balance,
        "referenceType", "referenceId", "createdAt"
      )
      VALUES (
        ${id}, ${customerId}, ${transactionType}, ${points}, ${balance},
        ${referenceType}, ${referenceId}, ${createdAt}
      )
    `

    /** The point transactions of the customer in the order they were written, as `type points balance description`. */
    const ledgerOf = async (customerId: string): Promise<string[]> => {
      const rows = await sql<{ line: string }[]>`
        SELECT concat_ws(
          ' ', "transactionType", points, balance, description
        ) AS line
        FROM customer_points
        WHERE "customerId" = ${customerId}
        ORDER BY "createdAt", id
      `
      return rows.map(({ line }) => line)
    }

    const countOfPoints = async (): Promise<number> => {
      const [row] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM customer_points
      `
      return row?.count ?? -1
    }

    // A database from before the migration: none of its rules and indexes.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE customers
          DROP CONSTRAINT customers_loyalty_points_not_negative;
        ALTER TABLE customer_points
          DROP CONSTRAINT customer_points_points_of_type,
          DROP CONSTRAINT customer_points_balance_not_negative,
          DROP CONSTRAINT customer_points_expiry_of_earned,
          DROP CONSTRAINT customer_points_reference_pair,
          DROP CONSTRAINT customer_points_reference_type_known;
        DROP INDEX customer_points_reference_unique;
        DROP INDEX idx_customer_points_customer_time;
        CREATE INDEX idx_customer_points_customer_id
          ON customer_points USING btree ("customerId");
      `)
    })

    it('should give the database the rules and the indexes of setup.sql, with the rules of a transfer the merge of customers changed since', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await runMigration('202611181900_customer_merge.sql')

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should open the ledger of every customer whose balance is not that of their latest transaction', async () => {
      const withoutTransactions = await storeCustomer(300)
      const above = await storeCustomer(500)
      await storePoints(above, { points: 999, balance: 999 })
      await storePoints(above, {
        transactionType: 'used',
        points: -799,
        balance: 200,
        createdAt: '2026-02-01T00:00:00Z',
      })
      const below = await storeCustomer(100)
      await storePoints(below, { points: 400, balance: 400 })
      // Of two transactions of one moment, the one of the greater ID is the latest.
      const tied = await storeCustomer(50)
      await storePoints(tied, {
        id: '00000000-0000-4000-8000-000000000002',
        points: 20,
        balance: 20,
      })
      await storePoints(tied, {
        id: '00000000-0000-4000-8000-000000000001',
        points: 70,
        balance: 70,
      })

      await run()

      expect(await ledgerOf(withoutTransactions)).toEqual([
        'adjusted 300 300 ポイント台帳の開始残高',
      ])
      expect(await ledgerOf(above)).toEqual([
        'adjusted 999 999',
        'used -799 200',
        'adjusted 300 500 ポイント台帳の開始残高',
      ])
      expect(await ledgerOf(below)).toEqual([
        'adjusted 400 400',
        'adjusted -300 100 ポイント台帳の開始残高',
      ])
      expect(await ledgerOf(tied)).toEqual([
        'adjusted 70 70',
        'adjusted 20 20',
        'adjusted 30 50 ポイント台帳の開始残高',
      ])
    })

    it('should write nothing where every balance agrees, and nothing on a second run', async () => {
      const none = await storeCustomer(0)
      const agreeing = await storeCustomer(700)
      await storePoints(agreeing, { points: 700, balance: 700 })
      const differing = await storeCustomer(10)

      await run()
      const afterFirst = await countOfPoints()
      await run()

      expect(await ledgerOf(none)).toEqual([])
      expect(await ledgerOf(agreeing)).toEqual(['adjusted 700 700'])
      expect(await ledgerOf(differing)).toEqual([
        'adjusted 10 10 ポイント台帳の開始残高',
      ])
      expect(afterFirst).toBe(2)
      expect(await countOfPoints()).toBe(afterFirst)
    })

    it('should fail and change nothing where a row breaks a rule', async () => {
      await storeCustomer(300)
      const broken = await storeCustomer(100)
      await storePoints(broken, { points: 0, balance: 100 })
      const before = await describeSchema()

      await expect(run()).rejects.toThrow('customer_points_points_of_type')

      expect(await countOfPoints()).toBe(1)
      expect(await describeSchema()).toEqual(before)
    })

    it('should keep a second earning on a record, and a kind of record it does not know, out from then on', async () => {
      const customer = await storeCustomer(0)
      const sale = { referenceType: 'sale', referenceId: randomUUID() }
      await run()

      await storePoints(customer, {
        transactionType: 'earned',
        points: 10,
        balance: 10,
        ...sale,
      })
      await storePoints(customer, {
        transactionType: 'used',
        points: -10,
        balance: 0,
        ...sale,
      })
      await storePoints(customer, { points: 5, balance: 5, ...sale })
      await storePoints(customer, { points: -5, balance: 0, ...sale })

      await expect(
        storePoints(customer, {
          transactionType: 'earned',
          points: 1,
          balance: 1,
          ...sale,
        }),
      ).rejects.toThrow('customer_points_reference_unique')
      await expect(
        storePoints(customer, {
          points: 1,
          balance: 1,
          referenceType: 'payment',
          referenceId: randomUUID(),
        }),
      ).rejects.toThrow('customer_points_reference_type_known')
      expect(await countOfPoints()).toBe(4)
    })
  })

  describe('202611171000_review_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171000_review_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** A salon with the rating and the review count it says it has. */
    const storeRatedSalon = async (
      rating: string | null,
      reviewCount: number,
    ): Promise<string> => {
      const id = await storeSalon(null)
      await sql`
        UPDATE salons
        SET rating = ${rating}, "reviewCount" = ${reviewCount}
        WHERE id = ${id}
      `
      return id
    }

    /**
     * What the salon says of its reviews, as `rating count`, and the
     * transaction that wrote the row: the same as long as nothing did.
     */
    const figuresOf = async (
      id: string,
    ): Promise<{ figures: string; writtenBy: string }> => {
      const [row] = await sql<{ figures: string; writtenBy: string }[]>`
        SELECT
          concat_ws(' ', coalesce(rating::text, 'null'), "reviewCount")
            AS figures,
          xmin::text AS "writtenBy"
        FROM salons
        WHERE id = ${id}
      `
      return row ?? { figures: 'missing', writtenBy: 'missing' }
    }

    const imagesOf = async (id: string): Promise<unknown> => {
      const [row] = await sql<{ imageUrls: unknown }[]>`
        SELECT "imageUrls" FROM reviews WHERE id = ${id}
      `
      return row?.imageUrls
    }

    // A database from before the migration: none of its rules, and image
    // URLs that may be missing.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE reviews
          DROP CONSTRAINT reviews_ratings_in_range,
          DROP CONSTRAINT reviews_counts_not_negative,
          DROP CONSTRAINT reviews_owner_response_pair,
          DROP CONSTRAINT reviews_image_urls_array,
          ALTER COLUMN "imageUrls" DROP NOT NULL;
        ALTER TABLE salons
          DROP CONSTRAINT salons_review_count_not_negative,
          DROP CONSTRAINT salons_rating_in_range,
          DROP CONSTRAINT salons_rating_of_reviews;
      `)
    })

    it('should give the database the rules of setup.sql', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should count the rating and the review count of every salon from its reviews', async () => {
      const counted = await storeRatedSalon('4.80', 324)
      for (const overallRating of [5, 4, 4]) {
        await storeReview(counted, { overallRating })
      }
      const roundedUp = await storeRatedSalon(null, 0)
      for (const overallRating of [5, 5, 4]) {
        await storeReview(roundedUp, { overallRating })
      }
      const withoutReviews = await storeRatedSalon('3.00', 10)

      await run()

      expect((await figuresOf(counted)).figures).toBe('4.33 3')
      expect((await figuresOf(roundedUp)).figures).toBe('4.67 3')
      expect((await figuresOf(withoutReviews)).figures).toBe('null 0')
    })

    it('should give a review without images an empty array and keep the images of the others', async () => {
      const salon = await storeRatedSalon('4.00', 3)
      const missing = await storeReview(salon, {
        overallRating: 4,
        imageUrls: null,
      })
      const jsonNull = await storeReview(salon, {
        overallRating: 4,
        imageUrls: 'null',
      })
      const withImages = await storeReview(salon, {
        overallRating: 4,
        imageUrls: '["https://example.com/after.jpg"]',
      })

      await run()

      expect(await imagesOf(missing)).toEqual([])
      expect(await imagesOf(jsonNull)).toEqual([])
      expect(await imagesOf(withImages)).toEqual([
        'https://example.com/after.jpg',
      ])
    })

    it('should write no salon whose figures agree, and nothing on a second run', async () => {
      const agreeing = await storeRatedSalon('4.50', 2)
      await storeReview(agreeing, { overallRating: 5 })
      await storeReview(agreeing, { overallRating: 4 })
      const empty = await storeRatedSalon(null, 0)
      const differing = await storeRatedSalon(null, 0)
      await storeReview(differing, { overallRating: 3 })
      const before = await figuresOf(agreeing)
      const emptyBefore = await figuresOf(empty)

      await run()
      const afterFirst = await figuresOf(differing)
      await run()

      expect(await figuresOf(agreeing)).toEqual(before)
      expect(await figuresOf(empty)).toEqual(emptyBefore)
      expect(afterFirst.figures).toBe('3.00 1')
      expect(await figuresOf(differing)).toEqual(afterFirst)
    })

    it('should fail and change nothing where a review breaks a rule', async () => {
      const salon = await storeRatedSalon('4.80', 324)
      await storeReview(salon, { overallRating: 4, serviceRating: 0 })
      const before = await describeSchema()

      await expect(run()).rejects.toThrow('reviews_ratings_in_range')

      expect((await figuresOf(salon)).figures).toBe('4.80 324')
      expect(await describeSchema()).toEqual(before)
    })

    it('should keep a review and a salon that break a rule out from then on', async () => {
      const salon = await storeRatedSalon(null, 0)
      await run()

      await expect(storeReview(salon, { overallRating: 6 })).rejects.toThrow(
        'reviews_ratings_in_range',
      )
      await expect(
        storeReview(salon, { overallRating: 4, imageUrls: '{}' }),
      ).rejects.toThrow('reviews_image_urls_array')
      await expect(
        storeReview(salon, { overallRating: 4, imageUrls: null }),
      ).rejects.toThrow('imageUrls')
      await expect(
        storeReview(salon, {
          overallRating: 4,
          ownerResponse: 'Thank you',
        }),
      ).rejects.toThrow('reviews_owner_response_pair')
      await expect(
        sql`UPDATE salons SET rating = 4 WHERE id = ${salon}`,
      ).rejects.toThrow('salons_rating_of_reviews')
      await expect(
        sql`UPDATE salons SET rating = 4, "reviewCount" = -1 WHERE id = ${salon}`,
      ).rejects.toThrow('salons_review_count_not_negative')
      await expect(
        sql`UPDATE salons SET rating = 5.5, "reviewCount" = 1 WHERE id = ${salon}`,
      ).rejects.toThrow('salons_rating_in_range')
    })
  })

  describe('202611171100_review_helpful_votes.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171100_review_helpful_votes.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** A review that says it was found helpful so many times. */
    const storeCountedReview = async (
      helpfulCount: number,
    ): Promise<string> => {
      const id = await storeReview(await storeSalon(null), { overallRating: 4 })
      await sql`
        UPDATE reviews SET "helpfulCount" = ${helpfulCount} WHERE id = ${id}
      `
      return id
    }

    /** The customer found the review helpful. */
    const storeVote = async (
      reviewId: string,
      customerId: string,
    ): Promise<void> => {
      await sql`
        INSERT INTO review_helpful_votes ("reviewId", "customerId")
        VALUES (${reviewId}, ${customerId})
      `
    }

    /**
     * The helpful count of a review, and the transaction that wrote the
     * row: the same as long as nothing did.
     */
    const helpfulOf = async (
      id: string,
    ): Promise<{ count: number; writtenBy: string }> => {
      const [row] = await sql<{ count: number; writtenBy: string }[]>`
        SELECT "helpfulCount" AS count, xmin::text AS "writtenBy"
        FROM reviews
        WHERE id = ${id}
      `
      return row ?? { count: -1, writtenBy: 'missing' }
    }

    // A database from before the migration: no table of the marks.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe('DROP TABLE review_helpful_votes')
    })

    it('should give the database the table of setup.sql', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should count every review again: nobody is known to have found one helpful', async () => {
      const counted = await storeCountedReview(12)
      const none = await storeCountedReview(0)
      const noneBefore = await helpfulOf(none)

      await run()

      expect((await helpfulOf(counted)).count).toBe(0)
      expect(await helpfulOf(none)).toEqual(noneBefore)
    })

    it('should count the marks of a review, write no review whose count agrees, and nothing on a second run', async () => {
      await run()
      const marked = await storeCountedReview(0)
      await storeVote(marked, await storeNewCustomer())
      await storeVote(marked, await storeNewCustomer())
      const agreeing = await storeCountedReview(1)
      await storeVote(agreeing, await storeNewCustomer())
      const agreeingBefore = await helpfulOf(agreeing)

      await run()
      const afterSecond = await helpfulOf(marked)
      await run()

      expect(afterSecond.count).toBe(2)
      expect(await helpfulOf(marked)).toEqual(afterSecond)
      expect(await helpfulOf(agreeing)).toEqual(agreeingBefore)
    })

    it('should keep a second mark of a customer out, and take the marks of a review away with it', async () => {
      await run()
      const review = await storeCountedReview(0)
      const customer = await storeNewCustomer()
      await storeVote(review, customer)

      await expect(storeVote(review, customer)).rejects.toThrow(
        'review_helpful_votes_review_customer_unique',
      )
      await sql`DELETE FROM reviews WHERE id = ${review}`
      expect(
        await sql`SELECT 1 FROM review_helpful_votes WHERE "reviewId" = ${review}`,
      ).toHaveLength(0)
    })
  })

  describe('202611171200_review_reports.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171200_review_reports.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** A review that says it was reported so many times. */
    const storeReportedReview = async (
      reportCount: number,
    ): Promise<string> => {
      const id = await storeReview(await storeSalon(null), { overallRating: 2 })
      await sql`
        UPDATE reviews SET "reportCount" = ${reportCount} WHERE id = ${id}
      `
      return id
    }

    type StoredReport = {
      reportedBy?: string
      reason?: string
      details?: string | null
      status?: string
      resolvedBy?: string | null
      resolvedAt?: string | null
    }

    /** A report of the review, by an account of its own: pending, for spam. */
    const storeReport = async (
      reviewId: string,
      {
        reportedBy = randomUUID(),
        reason = 'spam',
        details = null,
        status = 'pending',
        resolvedBy = null,
        resolvedAt = null,
      }: StoredReport = {},
    ): Promise<void> => {
      await sql`
        INSERT INTO review_reports (
          "reviewId", "reportedBy", reason, details, status, "resolvedBy",
          "resolvedAt"
        )
        VALUES (
          ${reviewId}, ${reportedBy}, ${reason}, ${details}, ${status},
          ${resolvedBy}, ${resolvedAt}
        )
      `
    }

    /** A report an administrator dismissed. */
    const dismissed: StoredReport = {
      status: 'dismissed',
      resolvedBy: randomUUID(),
      resolvedAt: '2026-11-17T03:00:00Z',
    }

    /**
     * The report count of a review, and the transaction that wrote the
     * row: the same as long as nothing did.
     */
    const reportsOf = async (
      id: string,
    ): Promise<{ count: number; writtenBy: string }> => {
      const [row] = await sql<{ count: number; writtenBy: string }[]>`
        SELECT "reportCount" AS count, xmin::text AS "writtenBy"
        FROM reviews
        WHERE id = ${id}
      `
      return row ?? { count: -1, writtenBy: 'missing' }
    }

    // A database from before the migration: no table of the reports and
    // none of its types.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP TABLE review_reports;
        DROP TYPE review_report_reason;
        DROP TYPE review_report_status;
      `)
    })

    it('should give the database the table and the types of setup.sql', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should count every review again: nobody is known to have reported one', async () => {
      const counted = await storeReportedReview(3)
      const none = await storeReportedReview(0)
      const noneBefore = await reportsOf(none)

      await run()

      expect((await reportsOf(counted)).count).toBe(0)
      expect(await reportsOf(none)).toEqual(noneBefore)
    })

    it('should count the pending reports of a review and no dismissed one, write no review whose count agrees, and nothing on a second run', async () => {
      await run()
      const reported = await storeReportedReview(0)
      await storeReport(reported)
      await storeReport(reported, { reason: 'inappropriate' })
      await storeReport(reported, dismissed)
      const agreeing = await storeReportedReview(1)
      await storeReport(agreeing)
      await storeReport(agreeing, dismissed)
      const agreeingBefore = await reportsOf(agreeing)

      await run()
      const afterSecond = await reportsOf(reported)
      await run()

      expect(afterSecond.count).toBe(2)
      expect(await reportsOf(reported)).toEqual(afterSecond)
      expect(await reportsOf(agreeing)).toEqual(agreeingBefore)
    })

    it('should keep a second report of an account out, and take the reports of a review away with it', async () => {
      await run()
      const review = await storeReportedReview(0)
      const account = randomUUID()
      await storeReport(review, { reportedBy: account })
      await storeReport(review, { ...dismissed, reportedBy: randomUUID() })

      await expect(
        storeReport(review, { ...dismissed, reportedBy: account }),
      ).rejects.toThrow('review_reports_review_reporter_unique')
      await sql`DELETE FROM reviews WHERE id = ${review}`
      expect(
        await sql`SELECT 1 FROM review_reports WHERE "reviewId" = ${review}`,
      ).toHaveLength(0)
    })

    it.each<[string, StoredReport, string]>([
      [
        'a pending report that says who dismissed it',
        { resolvedBy: randomUUID() },
        'review_reports_resolved_when_dismissed',
      ],
      [
        'a pending report that says when it was dismissed',
        { resolvedAt: '2026-11-17T03:00:00Z' },
        'review_reports_resolved_when_dismissed',
      ],
      [
        'a dismissed report that does not say who dismissed it',
        { ...dismissed, resolvedBy: null },
        'review_reports_resolved_when_dismissed',
      ],
      [
        'a dismissed report that does not say when',
        { ...dismissed, resolvedAt: null },
        'review_reports_resolved_when_dismissed',
      ],
      [
        'a report for another reason that does not say what it is about',
        { reason: 'other' },
        'review_reports_other_has_details',
      ],
      [
        'details of more than 2000 characters',
        { details: 'x'.repeat(2001) },
        'value too long',
      ],
    ])('should keep %s out', async (_, report, rule) => {
      await run()
      const review = await storeReportedReview(0)

      await expect(storeReport(review, report)).rejects.toThrow(rule)
    })

    it('should take a report for another reason that says what it is about, and details of 2000 characters', async () => {
      await run()
      const review = await storeReportedReview(0)

      await storeReport(review, { reason: 'other', details: 'x'.repeat(2000) })

      expect(
        await sql`SELECT 1 FROM review_reports WHERE "reviewId" = ${review}`,
      ).toHaveLength(1)
    })
  })

  describe('202611171300_product_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171300_product_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    type StoredProduct = {
      productCode?: string
      minimumStock?: string | null
      maximumStock?: string | null
      reorderPoint?: string | null
      purchasePrice?: number | null
      leadTimeDays?: number | null
      expiryMonths?: number | null
      deletedAt?: string | null
    }

    /** A product of the salon, with what it states of the columns named. */
    const storeProduct = async (
      salonId: string,
      product: StoredProduct = {},
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO products (
          id, "salonId", "productCode", name, unit, "minimumStock",
          "maximumStock", "reorderPoint", "purchasePrice", "leadTimeDays",
          "expiryMonths", "deletedAt"
        )
        VALUES (
          ${id}, ${salonId}, ${product.productCode ?? `CODE-${id}`},
          'Shampoo', 'bottle',
          ${product.minimumStock === undefined ? '0' : product.minimumStock},
          ${product.maximumStock ?? null}, ${product.reorderPoint ?? null},
          ${product.purchasePrice ?? null}, ${product.leadTimeDays ?? null},
          ${product.expiryMonths ?? null}, ${product.deletedAt ?? null}
        )
      `
      return id
    }

    const minimumStockOf = async (
      id: string,
    ): Promise<string | null | undefined> => {
      const [row] = await sql<{ minimumStock: string | null }[]>`
        SELECT "minimumStock"::text AS "minimumStock"
        FROM products
        WHERE id = ${id}
      `
      return row?.minimumStock
    }

    // A database from before the migration: a minimum stock that may be
    // missing, the ID of a supplier, a product code unique among the
    // deleted products too, and none of the rules.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP INDEX products_code_salon_unique;
        ALTER TABLE products
          DROP CONSTRAINT products_prices_not_negative,
          DROP CONSTRAINT products_stock_levels,
          DROP CONSTRAINT products_lead_time_not_negative,
          DROP CONSTRAINT products_expiry_months_positive,
          ALTER COLUMN "minimumStock" DROP NOT NULL,
          DROP COLUMN supplier,
          ADD COLUMN "supplierId" uuid,
          ADD CONSTRAINT products_code_salon_unique
            UNIQUE ("salonId", "productCode");
      `)
    })

    it('should give the database the rules of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should give a product without a minimum stock a minimum of 0 and keep the others', async () => {
      const salon = await storeSalon(null)
      const missing = await storeProduct(salon, { minimumStock: null })
      const stated = await storeProduct(salon, { minimumStock: '2.50' })

      await run()

      expect(await minimumStockOf(missing)).toBe('0.00')
      expect(await minimumStockOf(stated)).toBe('2.50')
    })

    it('should drop the IDs of suppliers and keep the product', async () => {
      const salon = await storeSalon(null)
      const id = await storeProduct(salon)
      await sql`UPDATE products SET "supplierId" = ${randomUUID()} WHERE id = ${id}`

      await run()

      expect(await sql`SELECT supplier FROM products WHERE id = ${id}`).toEqual(
        [{ supplier: null }],
      )
    })

    it('should let the code of a deleted product be given to another, and to no two that are not deleted', async () => {
      const salon = await storeSalon(null)
      const other = await storeSalon(null)
      await storeProduct(salon, {
        productCode: 'SHMP001',
        deletedAt: '2026-11-17T03:00:00Z',
      })
      await run()

      await storeProduct(salon, {
        productCode: 'SHMP001',
        deletedAt: '2026-11-17T04:00:00Z',
      })
      await storeProduct(salon, { productCode: 'SHMP001' })
      await storeProduct(other, { productCode: 'SHMP001' })

      await expect(
        storeProduct(salon, { productCode: 'SHMP001' }),
      ).rejects.toThrow('products_code_salon_unique')
    })

    it('should fail and change nothing where a product breaks a rule', async () => {
      const salon = await storeSalon(null)
      const missing = await storeProduct(salon, { minimumStock: null })
      await storeProduct(salon, { minimumStock: '10', maximumStock: '5' })
      const before = await describeSchema()

      await expect(run()).rejects.toThrow('products_stock_levels')

      expect(await minimumStockOf(missing)).toBeNull()
      expect(await describeSchema()).toEqual(before)
    })

    it.each<[string, StoredProduct, string]>([
      [
        'a negative price',
        { purchasePrice: -1 },
        'products_prices_not_negative',
      ],
      [
        'a negative minimum stock',
        { minimumStock: '-1' },
        'products_stock_levels',
      ],
      [
        'a reorder point below the minimum stock',
        { minimumStock: '5', reorderPoint: '4' },
        'products_stock_levels',
      ],
      [
        'a maximum stock below the minimum stock',
        { minimumStock: '5', maximumStock: '4' },
        'products_stock_levels',
      ],
      [
        'a reorder point above the maximum stock',
        { reorderPoint: '9', maximumStock: '8' },
        'products_stock_levels',
      ],
      [
        'a negative lead time',
        { leadTimeDays: -1 },
        'products_lead_time_not_negative',
      ],
      [
        'no months to expiry',
        { expiryMonths: 0 },
        'products_expiry_months_positive',
      ],
      [
        'a product without a minimum stock',
        { minimumStock: null },
        'minimumStock',
      ],
    ])('should keep %s out from then on', async (_, product, rule) => {
      await run()
      const salon = await storeSalon(null)

      await expect(storeProduct(salon, product)).rejects.toThrow(rule)
    })

    it('should take stock levels that are equal, and those without a maximum or a reorder point', async () => {
      await run()
      const salon = await storeSalon(null)

      await storeProduct(salon, {
        minimumStock: '5',
        reorderPoint: '5',
        maximumStock: '5',
      })
      await storeProduct(salon, { minimumStock: '5', reorderPoint: '50' })
      await storeProduct(salon, { minimumStock: '5', maximumStock: '50' })
      await storeProduct(salon, {
        minimumStock: '0',
        purchasePrice: 0,
        leadTimeDays: 0,
        expiryMonths: 1,
      })

      expect(
        await sql`SELECT 1 FROM products WHERE "salonId" = ${salon}`,
      ).toHaveLength(4)
    })
  })

  describe('202611171400_inventory_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171400_inventory_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    type StoredStock = {
      lotNumber?: string | null
      currentStock?: string
      availableStock?: string
      reservedStock?: string
    }

    const storeProduct = async (salonId: string): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO products (id, "salonId", "productCode", name, unit)
        VALUES (${id}, ${salonId}, ${`CODE-${id}`}, 'Shampoo', 'bottle')
      `
      return id
    }

    /** A stock row of the product, with what it states of the columns named. */
    const storeStock = async (
      salonId: string,
      productId: string,
      stock: StoredStock = {},
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO inventory (
          id, "salonId", "productId", "lotNumber", "currentStock",
          "availableStock", "reservedStock"
        )
        VALUES (
          ${id}, ${salonId}, ${productId},
          ${stock.lotNumber === undefined ? null : stock.lotNumber},
          ${stock.currentStock ?? '0'}, ${stock.availableStock ?? '0'},
          ${stock.reservedStock ?? '0'}
        )
      `
      return id
    }

    // A database from before the migration: any number of rows of a
    // product without a lot number, and no rule for the stock figures.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP INDEX inventory_unique_without_lot;
        ALTER TABLE inventory DROP CONSTRAINT inventory_stock;
      `)
    })

    it('should give the database the rules of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep the rows that follow the rules, the seeded reservation among them', async () => {
      const salon = await storeSalon(null)
      const product = await storeProduct(salon)
      const other = await storeProduct(salon)
      await storeStock(salon, product, {
        lotNumber: 'LOT-1',
        currentStock: '20',
        availableStock: '18',
        reservedStock: '2',
      })
      await storeStock(salon, product, { lotNumber: 'LOT-2' })
      await storeStock(salon, other)

      await run()

      expect(
        await sql`SELECT 1 FROM inventory WHERE "salonId" = ${salon}`,
      ).toHaveLength(3)
    })

    it('should fail and change nothing where a product has two rows without a lot number', async () => {
      const salon = await storeSalon(null)
      const product = await storeProduct(salon)
      await storeStock(salon, product)
      await storeStock(salon, product)
      const before = await describeSchema()

      await expect(run()).rejects.toThrow('inventory_unique_without_lot')

      expect(await describeSchema()).toEqual(before)
    })

    it('should fail and change nothing where a row breaks the rule of the stock figures', async () => {
      const salon = await storeSalon(null)
      const product = await storeProduct(salon)
      await storeStock(salon, product, {
        currentStock: '20',
        availableStock: '20',
        reservedStock: '2',
      })
      const before = await describeSchema()

      await expect(run()).rejects.toThrow('inventory_stock')

      expect(await describeSchema()).toEqual(before)
    })

    it('should keep a second row of a product without a lot number out from then on, in each salon', async () => {
      await run()
      const salon = await storeSalon(null)
      const other = await storeSalon(null)
      const product = await storeProduct(salon)
      await storeStock(salon, product)
      await storeStock(other, product)
      await storeStock(salon, product, { lotNumber: 'LOT-1' })

      await expect(storeStock(salon, product)).rejects.toThrow(
        'inventory_unique_without_lot',
      )
      await expect(
        storeStock(salon, product, { lotNumber: 'LOT-1' }),
      ).rejects.toThrow('inventory_unique')
    })

    it.each<[string, StoredStock]>([
      [
        'a negative stock',
        { currentStock: '-1', availableStock: '-1', reservedStock: '0' },
      ],
      [
        'a negative reservation',
        { currentStock: '1', availableStock: '2', reservedStock: '-1' },
      ],
      [
        'more reserved than there is',
        { currentStock: '1', availableStock: '-1', reservedStock: '2' },
      ],
      [
        'an available stock that is not what is left after the reservation',
        { currentStock: '5', availableStock: '5', reservedStock: '1' },
      ],
    ])('should keep %s out from then on', async (_, stock) => {
      await run()
      const salon = await storeSalon(null)
      const product = await storeProduct(salon)

      await expect(storeStock(salon, product, stock)).rejects.toThrow(
        'inventory_stock',
      )
    })

    it('should take a row whose stock is all reserved, and one without stock', async () => {
      await run()
      const salon = await storeSalon(null)
      const product = await storeProduct(salon)

      await storeStock(salon, product, {
        lotNumber: 'LOT-1',
        currentStock: '2.50',
        availableStock: '0',
        reservedStock: '2.50',
      })
      await storeStock(salon, product, { lotNumber: 'LOT-2' })

      expect(
        await sql`SELECT 1 FROM inventory WHERE "productId" = ${product}`,
      ).toHaveLength(2)
    })
  })

  describe('202611171500_inventory_transaction_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171500_inventory_transaction_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    type StoredMovement = {
      id?: string
      transactionType?: string
      quantity?: string
      balanceBefore?: string
      balanceAfter?: string
      unitCost?: number | null
      totalCost?: number | null
      referenceType?: string | null
      referenceId?: string | null
      reason?: string | null
      createdAt?: string
    }

    /** A product of the salon kept by lots; returns its ID. */
    const storeProduct = async (salonId: string): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO products (
          id, "salonId", "productCode", name, unit, "requiresLotTracking"
        )
        VALUES (
          ${id}, ${salonId}, ${`CODE-${id}`}, 'Shampoo', 'bottle', true
        )
      `
      return id
    }

    /** A stock row of a new product of the salon, with the stock given. */
    const storeStock = async (
      salonId: string,
      currentStock: string,
    ): Promise<{ id: string; productId: string }> => {
      const id = randomUUID()
      const productId = await storeProduct(salonId)
      await sql`
        INSERT INTO inventory (
          id, "salonId", "productId", "lotNumber", "expiryDate",
          "currentStock", "availableStock", "reservedStock"
        )
        VALUES (
          ${id}, ${salonId}, ${productId}, ${`LOT-${id}`}, '2027-03-31',
          ${currentStock}, ${currentStock}, '0'
        )
      `
      return { id, productId }
    }

    /**
     * A movement of the stock row: an adjustment of 5, from 0 to 5, unless
     * said otherwise.
     */
    const storeMovement = (
      salonId: string,
      row: { id: string; productId: string },
      {
        id = randomUUID(),
        transactionType = 'adjustment',
        quantity = '5',
        balanceBefore = '0',
        balanceAfter = '5',
        unitCost = null,
        totalCost = null,
        referenceType = null,
        referenceId = null,
        reason = 'Counted',
        createdAt = '2026-01-01T00:00:00Z',
      }: StoredMovement = {},
    ) => sql`
      INSERT INTO inventory_transactions (
        id, "salonId", "productId", "inventoryId", "transactionType",
        quantity, "balanceBefore", "balanceAfter", "unitCost", "totalCost",
        "referenceType", "referenceId", reason, "createdAt"
      )
      VALUES (
        ${id}, ${salonId}, ${row.productId}, ${row.id}, ${transactionType},
        ${quantity}, ${balanceBefore}, ${balanceAfter}, ${unitCost},
        ${totalCost}, ${referenceType}, ${referenceId}, ${reason},
        ${createdAt}
      )
    `

    /**
     * The movements of a stock row in the order they were written, as
     * `type quantity before after lot expiry reason`, the lot as whether it is the row's.
     */
    const historyOf = async (inventoryId: string): Promise<string[]> => {
      const rows = await sql<{ line: string }[]>`
        SELECT concat_ws(
          ' ', "transactionType", quantity, "balanceBefore", "balanceAfter",
          CASE
            WHEN "lotNumber" = 'LOT-' || "inventoryId"::text THEN 'its-lot'
            WHEN "lotNumber" IS NULL THEN 'no-lot'
            ELSE 'another-lot'
          END,
          "expiryDate", reason
        ) AS line
        FROM inventory_transactions
        WHERE "inventoryId" = ${inventoryId}
        ORDER BY "createdAt", id
      `
      return rows.map(({ line }) => line)
    }

    const countOfMovements = async (): Promise<number> => {
      const [row] = await sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM inventory_transactions
      `
      return row?.count ?? -1
    }

    const OPENING = '在庫移動の記録を始めた時点の在庫数'

    // A database from before the migration: none of its rules, and the
    // index on the stock row alone.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE inventory_transactions
          DROP CONSTRAINT inventory_transactions_quantity_of_type,
          DROP CONSTRAINT inventory_transactions_balance,
          DROP CONSTRAINT inventory_transactions_cost,
          DROP CONSTRAINT inventory_transactions_reference_pair,
          DROP CONSTRAINT inventory_transactions_reason_of_type;
        DROP INDEX idx_inventory_transactions_inventory_time;
        CREATE INDEX idx_inventory_transactions_inventory_id
          ON inventory_transactions USING btree ("inventoryId");
      `)
    })

    it('should give the database the rules and the index of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should open each row with stock and no movement with an adjustment, once', async () => {
      const salon = await storeSalon(null)
      const stocked = await storeStock(salon, '20')
      const fraction = await storeStock(salon, '2.50')
      const empty = await storeStock(salon, '0')

      await run()
      await run()

      expect(await historyOf(stocked.id)).toEqual([
        `adjustment 20.00 0.00 20.00 its-lot 2027-03-31 ${OPENING}`,
      ])
      expect(await historyOf(fraction.id)).toEqual([
        `adjustment 2.50 0.00 2.50 its-lot 2027-03-31 ${OPENING}`,
      ])
      expect(await historyOf(empty.id)).toEqual([])
      const [opening] = await sql<
        { salonId: string; productId: string; performedBy: null }[]
      >`
        SELECT "salonId", "productId", "performedBy"
        FROM inventory_transactions
        WHERE "inventoryId" = ${stocked.id}
      `
      expect(opening).toEqual({
        salonId: salon,
        productId: stocked.productId,
        performedBy: null,
      })
    })

    it('should adjust a row by the difference from its latest movement, either way', async () => {
      const salon = await storeSalon(null)
      const more = await storeStock(salon, '8')
      await storeMovement(salon, more)
      const less = await storeStock(salon, '4')
      await storeMovement(salon, less, {
        quantity: '10',
        balanceAfter: '10',
      })

      await run()

      expect(await historyOf(more.id)).toEqual([
        'adjustment 5.00 0.00 5.00 no-lot Counted',
        `adjustment 3.00 5.00 8.00 its-lot 2027-03-31 ${OPENING}`,
      ])
      expect(await historyOf(less.id)).toEqual([
        'adjustment 10.00 0.00 10.00 no-lot Counted',
        `adjustment -6.00 10.00 4.00 its-lot 2027-03-31 ${OPENING}`,
      ])
    })

    it('should take the latest movement by its time, then by its ID, and leave a row that agrees with it', async () => {
      const salon = await storeSalon(null)
      const byTime = await storeStock(salon, '7')
      await storeMovement(salon, byTime, {
        quantity: '7',
        balanceAfter: '7',
        createdAt: '2026-02-01T00:00:00Z',
      })
      await storeMovement(salon, byTime, {
        quantity: '9',
        balanceAfter: '9',
        createdAt: '2026-01-01T00:00:00Z',
      })
      const byId = await storeStock(salon, '9')
      await storeMovement(salon, byId, {
        id: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
        quantity: '9',
        balanceAfter: '9',
      })
      await storeMovement(salon, byId, {
        id: '00000000-0000-4000-8000-000000000000',
        quantity: '7',
        balanceAfter: '7',
      })
      const before = await countOfMovements()

      await run()

      expect(await countOfMovements()).toBe(before)
    })

    it('should fail and change nothing where a movement breaks a rule', async () => {
      const salon = await storeSalon(null)
      const row = await storeStock(salon, '20')
      await storeMovement(salon, row, {
        transactionType: 'purchase',
        quantity: '-5',
        balanceBefore: '5',
        balanceAfter: '0',
      })
      const before = await describeSchema()

      await expect(run()).rejects.toThrow(
        'inventory_transactions_quantity_of_type',
      )

      expect(await describeSchema()).toEqual(before)
      expect(await historyOf(row.id)).toHaveLength(1)
    })

    it.each<[string, string, StoredMovement]>([
      [
        'a movement of nothing',
        'inventory_transactions_quantity_of_type',
        { quantity: '0', balanceAfter: '0' },
      ],
      [
        'a purchase that takes stock out',
        'inventory_transactions_quantity_of_type',
        {
          transactionType: 'purchase',
          quantity: '-1',
          balanceBefore: '1',
          balanceAfter: '0',
        },
      ],
      ...['sale', 'use', 'disposal'].map(
        (transactionType): [string, string, StoredMovement] => [
          `a ${transactionType} that brings stock in`,
          'inventory_transactions_quantity_of_type',
          { transactionType, quantity: '1', balanceAfter: '1' },
        ],
      ),
      [
        'a balance after that is not the balance before and the quantity',
        'inventory_transactions_balance',
        { quantity: '5', balanceBefore: '1', balanceAfter: '5' },
      ],
      [
        'a negative balance after',
        'inventory_transactions_balance',
        { quantity: '-6', balanceBefore: '5', balanceAfter: '-1' },
      ],
      [
        'a negative balance before',
        'inventory_transactions_balance',
        { quantity: '6', balanceBefore: '-1', balanceAfter: '5' },
      ],
      [
        'a unit cost without a total cost',
        'inventory_transactions_cost',
        { unitCost: 100 },
      ],
      [
        'a total cost without a unit cost',
        'inventory_transactions_cost',
        { totalCost: 500 },
      ],
      [
        'a total cost that is not the unit cost times the quantity',
        'inventory_transactions_cost',
        { unitCost: 100, totalCost: 499 },
      ],
      [
        'a total cost of a quantity taken out that is negative',
        'inventory_transactions_cost',
        {
          transactionType: 'sale',
          quantity: '-5',
          balanceBefore: '5',
          balanceAfter: '0',
          unitCost: 100,
          totalCost: -500,
        },
      ],
      [
        'a negative unit cost',
        'inventory_transactions_cost',
        { unitCost: -100, totalCost: 500 },
      ],
      [
        'a kind of reference without an ID',
        'inventory_transactions_reference_pair',
        { referenceType: 'purchase_order' },
      ],
      [
        'an ID of a reference without its kind',
        'inventory_transactions_reference_pair',
        { referenceId: randomUUID() },
      ],
      [
        'an adjustment without a reason',
        'inventory_transactions_reason_of_type',
        { reason: null },
      ],
      [
        'a disposal without a reason',
        'inventory_transactions_reason_of_type',
        {
          transactionType: 'disposal',
          quantity: '-1',
          balanceBefore: '1',
          balanceAfter: '0',
          reason: null,
        },
      ],
    ])('should keep %s out from then on', async (_, constraint, movement) => {
      await run()
      const salon = await storeSalon(null)
      const row = await storeStock(salon, '0')

      await expect(storeMovement(salon, row, movement)).rejects.toThrow(
        constraint,
      )
    })

    it.each<[string, StoredMovement]>([
      [
        'an adjustment that takes stock out',
        { quantity: '-5', balanceBefore: '5', balanceAfter: '0' },
      ],
      ...['return', 'transfer'].flatMap(
        (transactionType): [string, StoredMovement][] => [
          [`a ${transactionType} in`, { transactionType, reason: null }],
          [
            `a ${transactionType} out`,
            {
              transactionType,
              quantity: '-5',
              balanceBefore: '5',
              balanceAfter: '0',
              reason: null,
            },
          ],
        ],
      ),
      [
        'a purchase with a total cost rounded half up',
        {
          transactionType: 'purchase',
          quantity: '0.50',
          balanceAfter: '0.50',
          unitCost: 3,
          totalCost: 2,
          referenceType: 'purchase_order',
          referenceId: randomUUID(),
          reason: null,
        },
      ],
      [
        'a use that costs nothing',
        {
          transactionType: 'use',
          quantity: '-2.25',
          balanceBefore: '2.25',
          balanceAfter: '0',
          unitCost: 0,
          totalCost: 0,
          reason: null,
        },
      ],
    ])('should take %s', async (_, movement) => {
      await run()
      const salon = await storeSalon(null)
      const row = await storeStock(salon, '0')

      await storeMovement(salon, row, movement)

      expect(await historyOf(row.id)).toHaveLength(1)
    })
  })
  describe('202611171600_purchase_orders.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171600_purchase_orders.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** A stock row of a new product of the salon, without stock. */
    const storeStock = async (salonId: string): Promise<string> => {
      const productId = randomUUID()
      const id = randomUUID()
      await sql`
        INSERT INTO products (id, "salonId", "productCode", name, unit)
        VALUES (${productId}, ${salonId}, ${`CODE-${productId}`}, 'Shampoo', 'bottle')
      `
      await sql`
        INSERT INTO inventory (
          id, "salonId", "productId", "currentStock", "availableStock"
        )
        VALUES (${id}, ${salonId}, ${productId}, '0', '0')
      `
      return id
    }

    type StoredOrder = {
      orderNumber?: string
      supplier?: string
      status?: string
      subtotal?: number
      taxAmount?: number
      shippingCost?: number | null
      totalAmount?: number
      actualDelivery?: string | null
      approvedBy?: string | null
      approvedAt?: string | null
      cancelledAt?: string | null
      cancellationReason?: string | null
    }

    /**
     * An order of the salon: a draft of 1000 yen and 100 of tax, without
     * a shipping cost, unless said otherwise; returns its ID.
     */
    const storeOrder = async (
      salonId: string,
      {
        orderNumber = `PO-${randomUUID()}`,
        supplier = 'Beauty Supply',
        status = 'draft',
        subtotal = 1000,
        taxAmount = 100,
        shippingCost = null,
        totalAmount = 1100,
        actualDelivery = null,
        approvedBy = null,
        approvedAt = null,
        cancelledAt = null,
        cancellationReason = null,
      }: StoredOrder = {},
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO purchase_orders (
          id, "salonId", "orderNumber", supplier, status, subtotal,
          "taxAmount", "shippingCost", "totalAmount", "actualDelivery",
          "approvedBy", "approvedAt", "cancelledAt", "cancellationReason"
        )
        VALUES (
          ${id}, ${salonId}, ${orderNumber}, ${supplier}, ${status},
          ${subtotal}, ${taxAmount}, ${shippingCost}, ${totalAmount},
          ${actualDelivery}, ${approvedBy}, ${approvedAt}, ${cancelledAt},
          ${cancellationReason}
        )
      `
      return id
    }

    type StoredItem = {
      inventoryId?: string | null
      productCode?: string
      quantity?: string
      unitPrice?: number
      totalPrice?: number
      sortOrder?: number
    }

    /** An item of the order: 2 of the stock row at 500 yen, first. */
    const storeItem = (
      purchaseOrderId: string,
      {
        inventoryId = null,
        productCode = 'CODE-1',
        quantity = '2',
        unitPrice = 500,
        totalPrice = 1000,
        sortOrder = 0,
      }: StoredItem = {},
    ) => sql`
      INSERT INTO purchase_order_items (
        "purchaseOrderId", "inventoryId", "productCode", "productName",
        quantity, unit, "unitPrice", "totalPrice", "sortOrder"
      )
      VALUES (
        ${purchaseOrderId}, ${inventoryId}, ${productCode}, 'Shampoo',
        ${quantity}, 'bottle', ${unitPrice}, ${totalPrice}, ${sortOrder}
      )
    `

    /** The items of an order, as `sortOrder:inventoryId`, in their order. */
    const itemsOf = async (purchaseOrderId: string): Promise<string[]> => {
      const rows = await sql<{ line: string }[]>`
        SELECT "sortOrder" || ':' || coalesce("inventoryId"::text, 'none') AS line
        FROM purchase_order_items
        WHERE "purchaseOrderId" = ${purchaseOrderId}
        ORDER BY "sortOrder"
      `
      return rows.map(({ line }) => line)
    }

    const approved: StoredOrder = {
      status: 'approved',
      approvedBy: randomUUID(),
      approvedAt: '2026-11-17T03:00:00Z',
    }

    // A database from before the migration: neither table nor the type.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP TABLE purchase_order_items;
        DROP TABLE purchase_orders;
        DROP TYPE order_status;
      `)
    })

    it('should give the database the tables and the type of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep the items of an order, the item of a removed stock row without it, and take them away with the order', async () => {
      await run()
      const salon = await storeSalon(null)
      const [kept, removed] = [await storeStock(salon), await storeStock(salon)]
      const order = await storeOrder(salon, {
        subtotal: 2000,
        totalAmount: 2100,
      })
      await storeItem(order, { inventoryId: kept, sortOrder: 0 })
      await storeItem(order, { inventoryId: removed, sortOrder: 1 })

      await sql`DELETE FROM inventory WHERE id = ${removed}`
      const afterRemoval = await itemsOf(order)
      await sql`DELETE FROM purchase_orders WHERE id = ${order}`

      expect(afterRemoval).toEqual([`0:${kept}`, '1:none'])
      expect(await itemsOf(order)).toEqual([])
    })

    it('should take the orders of a salon away with it', async () => {
      await run()
      const salon = await storeSalon(null)
      const order = await storeOrder(salon)
      await storeItem(order)

      await sql`DELETE FROM salons WHERE id = ${salon}`

      expect(
        await sql`SELECT 1 FROM purchase_orders WHERE id = ${order}`,
      ).toHaveLength(0)
      expect(await itemsOf(order)).toEqual([])
    })

    it('should keep an order number twice, a stock row twice in an order and a place twice in an order out, and take items of no stock row', async () => {
      await run()
      const salon = await storeSalon(null)
      const row = await storeStock(salon)
      const order = await storeOrder(salon, { orderNumber: 'PO-0000-0001' })
      await storeItem(order, { inventoryId: row, sortOrder: 0 })
      await storeItem(order, { inventoryId: null, sortOrder: 1 })
      await storeItem(order, { inventoryId: null, sortOrder: 2 })

      await expect(
        storeOrder(salon, { orderNumber: 'PO-0000-0001' }),
      ).rejects.toThrow('purchase_orders_order_number_unique')
      await expect(
        storeItem(order, { inventoryId: row, sortOrder: 3 }),
      ).rejects.toThrow('purchase_order_items_order_inventory_unique')
      await expect(storeItem(order, { sortOrder: 2 })).rejects.toThrow(
        'purchase_order_items_order_sort_unique',
      )
      expect(await itemsOf(order)).toEqual([`0:${row}`, '1:none', '2:none'])
    })

    it.each<[string, StoredOrder, string]>([
      [
        'a subtotal below zero',
        { subtotal: -1, totalAmount: 99 },
        'purchase_orders_amounts',
      ],
      [
        'a tax below zero',
        { taxAmount: -1, totalAmount: 999 },
        'purchase_orders_amounts',
      ],
      [
        'a shipping cost below zero',
        { shippingCost: -1, totalAmount: 1099 },
        'purchase_orders_amounts',
      ],
      [
        'a total that is not its parts',
        { totalAmount: 1000 },
        'purchase_orders_amounts',
      ],
      [
        'a total without its shipping cost',
        { shippingCost: 500, totalAmount: 1100 },
        'purchase_orders_amounts',
      ],
      [
        'an approver of an order not approved',
        { approvedBy: randomUUID() },
        'purchase_orders_approval',
      ],
      [
        'a pending order that was approved',
        { status: 'pending', approvedAt: '2026-11-17T03:00:00Z' },
        'purchase_orders_approval',
      ],
      [
        'an approved order that does not say when',
        { ...approved, approvedAt: null, approvedBy: null },
        'purchase_orders_approval',
      ],
      [
        'an approved order with an approver but no time',
        { ...approved, approvedAt: null },
        'purchase_orders_approval',
      ],
      [
        'an ordered order that was not approved',
        { status: 'ordered' },
        'purchase_orders_approval',
      ],
      [
        'a shipped order that was not approved',
        { status: 'shipped' },
        'purchase_orders_approval',
      ],
      [
        'a cancelled order that does not say when',
        { status: 'cancelled', cancellationReason: 'Wrong supplier' },
        'purchase_orders_cancellation',
      ],
      [
        'a cancelled order that does not say why',
        { status: 'cancelled', cancelledAt: '2026-11-17T03:00:00Z' },
        'purchase_orders_cancellation',
      ],
      [
        'a draft that says when it was cancelled',
        {
          cancelledAt: '2026-11-17T03:00:00Z',
          cancellationReason: 'Wrong supplier',
        },
        'purchase_orders_cancellation',
      ],
      [
        'a draft that says why it was cancelled',
        { cancellationReason: 'Wrong supplier' },
        'purchase_orders_cancellation',
      ],
      [
        'a delivered order that does not say when',
        { ...approved, status: 'delivered' },
        'purchase_orders_delivery',
      ],
      [
        'an approved order that says when it was delivered',
        { ...approved, actualDelivery: '2026-11-17T03:00:00Z' },
        'purchase_orders_delivery',
      ],
      [
        'a supplier of more than 255 characters',
        { supplier: 'x'.repeat(256) },
        'value too long',
      ],
    ])('should keep %s out', async (_, order, rule) => {
      await run()

      await expect(storeOrder(await storeSalon(null), order)).rejects.toThrow(
        rule,
      )
    })

    it.each<[string, StoredOrder]>([
      ['a draft without a shipping cost', {}],
      [
        'an order with a shipping cost',
        { shippingCost: 500, totalAmount: 1600 },
      ],
      [
        'an order of nothing',
        { subtotal: 0, taxAmount: 0, shippingCost: 0, totalAmount: 0 },
      ],
      [
        'the largest total',
        {
          subtotal: 2_147_483_000,
          taxAmount: 600,
          shippingCost: 47,
          totalAmount: 2_147_483_647,
        },
      ],
      ['an order an administrator approved', { ...approved, approvedBy: null }],
      ['an order placed with the supplier', { ...approved, status: 'ordered' }],
      ['an order shipped', { ...approved, status: 'shipped' }],
      [
        'an order delivered',
        {
          ...approved,
          status: 'delivered',
          actualDelivery: '2026-11-18T03:00:00Z',
        },
      ],
      [
        'a pending order cancelled',
        {
          status: 'cancelled',
          cancelledAt: '2026-11-17T03:00:00Z',
          cancellationReason: 'Wrong supplier',
        },
      ],
      [
        'an approved order cancelled',
        {
          ...approved,
          status: 'cancelled',
          cancelledAt: '2026-11-18T03:00:00Z',
          cancellationReason: 'Out of stock',
        },
      ],
      ['a supplier of 255 characters', { supplier: 'x'.repeat(255) }],
    ])('should take %s', async (_, order) => {
      await run()
      const salon = await storeSalon(null)

      const id = await storeOrder(salon, order)

      expect(
        await sql`SELECT 1 FROM purchase_orders WHERE id = ${id}`,
      ).toHaveLength(1)
    })

    it.each<[string, StoredItem, string]>([
      [
        'a quantity of nothing',
        { quantity: '0', totalPrice: 0 },
        'purchase_order_items_amounts',
      ],
      [
        'a quantity below zero',
        { quantity: '-1', totalPrice: 500 },
        'purchase_order_items_amounts',
      ],
      [
        'a unit price below zero',
        { unitPrice: -1, totalPrice: 2 },
        'purchase_order_items_amounts',
      ],
      ['a place below zero', { sortOrder: -1 }, 'purchase_order_items_amounts'],
      [
        'a total that is not the quantity times the price',
        { totalPrice: 999 },
        'purchase_order_items_amounts',
      ],
      [
        'a total rounded down from a half',
        { quantity: '0.50', unitPrice: 3, totalPrice: 1 },
        'purchase_order_items_amounts',
      ],
      [
        'a product code of more than 100 characters',
        { productCode: 'x'.repeat(101) },
        'value too long',
      ],
    ])('should keep an item of %s out', async (_, item, rule) => {
      await run()
      const order = await storeOrder(await storeSalon(null))

      await expect(storeItem(order, item)).rejects.toThrow(rule)
    })

    it.each<[string, StoredItem]>([
      [
        'a total rounded up from a half',
        { quantity: '0.50', unitPrice: 3, totalPrice: 2 },
      ],
      [
        'a total rounded down',
        { quantity: '0.25', unitPrice: 333, totalPrice: 83 },
      ],
      ['a free item', { unitPrice: 0, totalPrice: 0 }],
      [
        'the smallest quantity',
        { quantity: '0.01', unitPrice: 100, totalPrice: 1 },
      ],
      ['a product code of 100 characters', { productCode: 'x'.repeat(100) }],
    ])('should take an item of %s', async (_, item) => {
      await run()
      const order = await storeOrder(await storeSalon(null))

      await storeItem(order, item)

      expect(await itemsOf(order)).toEqual(['0:none'])
    })
  })

  describe('202611171700_inventory_alert_acknowledgements.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171700_inventory_alert_acknowledgements.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    type Stock = { salonId: string; productId: string; inventoryId: string }

    /** A product of a new salon and a stock row of it, without stock. */
    const storeStock = async (): Promise<Stock> => {
      const salonId = await storeSalon(null)
      const productId = randomUUID()
      const inventoryId = randomUUID()
      await sql`
        INSERT INTO products (id, "salonId", "productCode", name, unit)
        VALUES (${productId}, ${salonId}, ${`CODE-${productId}`}, 'Shampoo', 'bottle')
      `
      await sql`
        INSERT INTO inventory (
          id, "salonId", "productId", "currentStock", "availableStock",
          "expiryDate"
        )
        VALUES (${inventoryId}, ${salonId}, ${productId}, '0', '0', '2026-12-01')
      `
      return { salonId, productId, inventoryId }
    }

    type StoredAcknowledgement = {
      inventoryId?: string | null
      alert?: string
      severity?: string
      threshold?: string | null
      expiryDate?: string | null
      notes?: string | null
      acknowledgedBy?: string | null
    }

    /**
     * An acknowledgement of an alert of the stock: the low stock of the
     * product, at a threshold of 5, by a staff member, unless said
     * otherwise; returns its ID.
     */
    const storeAcknowledgement = async (
      { salonId, productId }: Stock,
      {
        inventoryId = null,
        alert = 'low_stock',
        severity = 'warning',
        threshold = '5',
        expiryDate = null,
        notes = null,
        acknowledgedBy = randomUUID(),
      }: StoredAcknowledgement = {},
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO inventory_alert_acknowledgements (
          id, "salonId", "productId", "inventoryId", alert, severity,
          threshold, "expiryDate", notes, "acknowledgedBy"
        )
        VALUES (
          ${id}, ${salonId}, ${productId}, ${inventoryId}, ${alert},
          ${severity}, ${threshold}, ${expiryDate}, ${notes},
          ${acknowledgedBy}
        )
      `
      return id
    }

    /** The IDs of the acknowledgements of the product, in no order. */
    const acknowledgementsOf = async (productId: string): Promise<string[]> => {
      const rows = await sql<{ id: string }[]>`
        SELECT id FROM inventory_alert_acknowledgements
        WHERE "productId" = ${productId}
      `
      return rows.map(({ id }) => id).sort()
    }

    /** An alert of the stock row: it expires soon. */
    const expiringOf = ({ inventoryId }: Stock): StoredAcknowledgement => ({
      inventoryId,
      alert: 'expiring',
      severity: 'warning',
      threshold: null,
      expiryDate: '2026-12-01',
    })

    // A database from before the migration: neither the table nor the
    // types, and the stock movements by their product alone.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP TABLE inventory_alert_acknowledgements;
        DROP TYPE inventory_alert_type;
        DROP TYPE inventory_alert_severity;
        DROP INDEX idx_inventory_transactions_product_time;
        CREATE INDEX idx_inventory_transactions_product_id
          ON inventory_transactions USING btree ("productId");
      `)
    })

    it('should give the database the table, the types and the indexes of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should take the acknowledgements of a stock row away with it, and keep those of its product', async () => {
      await run()
      const stock = await storeStock()
      const ofProduct = await storeAcknowledgement(stock)
      await storeAcknowledgement(stock, expiringOf(stock))

      await sql`DELETE FROM inventory WHERE id = ${stock.inventoryId}`

      expect(await acknowledgementsOf(stock.productId)).toEqual([ofProduct])
    })

    it('should take the acknowledgements of a product away with it', async () => {
      await run()
      const stock = await storeStock()
      const other = await storeStock()
      const kept = await storeAcknowledgement(other)
      await storeAcknowledgement(stock)

      await sql`DELETE FROM inventory WHERE id = ${stock.inventoryId}`
      await sql`DELETE FROM products WHERE id = ${stock.productId}`

      expect(await acknowledgementsOf(stock.productId)).toEqual([])
      expect(await acknowledgementsOf(other.productId)).toEqual([kept])
    })

    it('should take the acknowledgements of a salon away with it', async () => {
      await run()
      const stock = await storeStock()
      await storeAcknowledgement(stock)
      await storeAcknowledgement(stock, expiringOf(stock))

      await sql`DELETE FROM salons WHERE id = ${stock.salonId}`

      expect(await acknowledgementsOf(stock.productId)).toEqual([])
    })

    it('should keep an acknowledgement of a stock row that is not there out', async () => {
      await run()
      const stock = await storeStock()

      await expect(
        storeAcknowledgement(stock, {
          ...expiringOf(stock),
          inventoryId: randomUUID(),
        }),
      ).rejects.toThrow('inventory_alert_acknowledgements_inventory_id_fk')
    })

    it.each<[string, (stock: Stock) => StoredAcknowledgement, string]>([
      [
        'a low stock of a stock row',
        ({ inventoryId }) => ({ inventoryId }),
        'inventory_alert_acknowledgements_subject',
      ],
      [
        'an overstock with an expiry date',
        () => ({
          alert: 'overstock',
          severity: 'info',
          expiryDate: '2026-12-01',
        }),
        'inventory_alert_acknowledgements_subject',
      ],
      [
        'a low stock without a threshold',
        () => ({ threshold: null }),
        'inventory_alert_acknowledgements_subject',
      ],
      [
        'a low stock at a threshold below zero',
        () => ({ threshold: '-0.01' }),
        'inventory_alert_acknowledgements_subject',
      ],
      [
        'an expiring stock row of no row',
        (stock) => ({ ...expiringOf(stock), inventoryId: null }),
        'inventory_alert_acknowledgements_subject',
      ],
      [
        'an expired stock row without an expiry date',
        (stock) => ({
          ...expiringOf(stock),
          alert: 'expired',
          severity: 'critical',
          expiryDate: null,
        }),
        'inventory_alert_acknowledgements_subject',
      ],
      [
        'an expiring stock row with a threshold',
        (stock) => ({ ...expiringOf(stock), threshold: '5' }),
        'inventory_alert_acknowledgements_subject',
      ],
      [
        'a low stock of severity info',
        () => ({ severity: 'info' }),
        'inventory_alert_acknowledgements_severity',
      ],
      [
        'an overstock of severity warning',
        () => ({ alert: 'overstock', severity: 'warning' }),
        'inventory_alert_acknowledgements_severity',
      ],
      [
        'an expiring stock row of severity critical',
        (stock) => ({ ...expiringOf(stock), severity: 'critical' }),
        'inventory_alert_acknowledgements_severity',
      ],
      [
        'an expired stock row of severity warning',
        (stock) => ({ ...expiringOf(stock), alert: 'expired' }),
        'inventory_alert_acknowledgements_severity',
      ],
      [
        'an alert of another kind',
        () => ({ alert: 'out_of_stock' }),
        'invalid input value for enum inventory_alert_type',
      ],
    ])('should keep %s out', async (_, acknowledgement, rule) => {
      await run()
      const stock = await storeStock()

      await expect(
        storeAcknowledgement(stock, acknowledgement(stock)),
      ).rejects.toThrow(rule)
    })

    it.each<[string, (stock: Stock) => StoredAcknowledgement]>([
      ['a low stock of severity warning', () => ({})],
      [
        'a low stock of severity critical at a threshold of 0',
        () => ({ severity: 'critical', threshold: '0' }),
      ],
      [
        'an overstock',
        () => ({ alert: 'overstock', severity: 'info', threshold: '20' }),
      ],
      ['an expiring stock row', (stock) => expiringOf(stock)],
      [
        'an expired stock row',
        (stock) => ({
          ...expiringOf(stock),
          alert: 'expired',
          severity: 'critical',
        }),
      ],
      [
        'an acknowledgement by an administrator, with notes',
        () => ({ acknowledgedBy: null, notes: 'Ordered from the supplier' }),
      ],
    ])('should take %s', async (_, acknowledgement) => {
      await run()
      const stock = await storeStock()

      const id = await storeAcknowledgement(stock, acknowledgement(stock))

      expect(await acknowledgementsOf(stock.productId)).toEqual([id])
    })
  })

  describe('202611171800_treatment_record_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171800_treatment_record_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    type Booked = { salonId: string; bookingId: string }

    /** A booking of a new salon, by a customer and a staff member of their own. */
    const storeBooking = async (): Promise<
      Booked & { customerId: string; staffId: string }
    > => {
      const salonId = await storeSalon(null)
      const customerId = await storeNewCustomer()
      const staffId = randomUUID()
      await sql`
        INSERT INTO staff (
          id, "salonId", "firstName", "lastName", "displayName", email,
          "phoneNumber", specialties, certifications
        )
        VALUES (
          ${staffId}, ${salonId}, 'Hanako', 'Sato', 'Hanako',
          ${`${staffId}@example.com`}, '03-1234-5678', '{}', '{}'
        )
      `
      const bookingId = randomUUID()
      await sql`
        INSERT INTO bookings (
          id, "bookingNumber", "salonId", "customerId", "staffId",
          "bookingDate", "startTime", "endTime", duration, subtotal,
          "totalAmount"
        )
        VALUES (
          ${bookingId}, ${`BK-${bookingId.slice(0, 8)}`}, ${salonId},
          ${customerId}, ${staffId}, '2026-11-01',
          '2026-11-01T01:00:00Z', '2026-11-01T02:00:00Z', 60, 0, 0
        )
      `
      return { salonId, bookingId, customerId, staffId }
    }

    /**
     * The JSON texts of the columns of a record that the migration changes,
     * and its numbers; NULL where a value is null.
     */
    type StoredRecord = {
      services?: string
      techniques?: string | null
      nextRecommendedServices?: string | null
      processingTime?: number | null
      customerSatisfaction?: number | null
    }

    /** A treatment record of a new booking; returns its ID and the booking. */
    const storeRecord = async ({
      services = `["${randomUUID()}"]`,
      techniques = '[]',
      nextRecommendedServices = '[]',
      processingTime = null,
      customerSatisfaction = null,
    }: StoredRecord = {}): Promise<{ id: string; booked: Booked }> => {
      const { customerId, staffId, ...booked } = await storeBooking()
      const id = randomUUID()
      await sql`
        INSERT INTO treatment_records (
          id, "bookingId", "customerId", "staffId", services, techniques,
          "nextRecommendedServices", "processingTime",
          "customerSatisfaction"
        )
        VALUES (
          ${id}, ${booked.bookingId}, ${customerId}, ${staffId},
          ${services}::text::jsonb, ${techniques}::text::jsonb,
          ${nextRecommendedServices}::text::jsonb, ${processingTime},
          ${customerSatisfaction}
        )
      `
      return { id, booked }
    }

    /** A product of the salon, to use as a material. */
    const storeProduct = async (salonId: string): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO products (id, "salonId", "productCode", name, unit)
        VALUES (${id}, ${salonId}, ${`CODE-${id}`}, 'Color Cream', 'g')
      `
      return id
    }

    /** A material of the record, as stored before the migration. */
    const storeMaterial = async (
      recordId: string,
      productId: string,
      {
        id = randomUUID(),
        createdAt = '2026-11-17T03:00:00Z',
        quantity = '30',
      },
    ): Promise<string> => {
      await sql`
        INSERT INTO treatment_materials (
          id, "treatmentRecordId", "productId", quantity, unit, "createdAt"
        )
        VALUES (${id}, ${recordId}, ${productId}, ${quantity}, 'g', ${createdAt})
      `
      return id
    }

    // A database from before the migration: seven jsonb columns, two
    // lists that may be missing, photos in the record, materials without
    // an order, and none of the rules.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP INDEX idx_treatment_records_created_at;
        ALTER TABLE treatment_records
          DROP CONSTRAINT treatment_records_lists,
          DROP CONSTRAINT treatment_records_ranges,
          ALTER COLUMN techniques DROP NOT NULL,
          ALTER COLUMN "nextRecommendedServices" DROP NOT NULL,
          ALTER COLUMN "scalpCondition" TYPE jsonb USING to_jsonb("scalpCondition"),
          ALTER COLUMN "hairCondition" TYPE jsonb USING to_jsonb("hairCondition"),
          ALTER COLUMN "colorFormula" TYPE jsonb USING to_jsonb("colorFormula"),
          ADD COLUMN "beforePhotos" jsonb DEFAULT '[]'::jsonb,
          ADD COLUMN "afterPhotos" jsonb DEFAULT '[]'::jsonb;
        ALTER TABLE treatment_materials
          DROP CONSTRAINT treatment_materials_amounts,
          DROP CONSTRAINT treatment_materials_record_sort_unique,
          DROP COLUMN "sortOrder";
      `)
    })

    it('should give the database the rules of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep a JSON string of a state as the string, any other JSON value as its text, and a missing one as null', async () => {
      const { id } = await storeRecord()
      await sql`
        UPDATE treatment_records
        SET "scalpCondition" = '"乾燥ぎみ"'::jsonb,
            "hairCondition" = '{"damage": "high", "porosity": 3}'::jsonb,
            "colorFormula" = NULL
        WHERE id = ${id}
      `

      await run()

      expect(
        await sql`
          SELECT "scalpCondition", "hairCondition", "colorFormula"
          FROM treatment_records WHERE id = ${id}
        `,
      ).toEqual([
        {
          scalpCondition: '乾燥ぎみ',
          hairCondition: '{"damage": "high", "porosity": 3}',
          colorFormula: null,
        },
      ])
    })

    it('should give a record without a list of techniques or of recommended services an empty list, and keep the others', async () => {
      const service = randomUUID()
      const missing = await storeRecord({
        techniques: null,
        nextRecommendedServices: null,
      })
      const stated = await storeRecord({
        techniques: '["バレイヤージュ"]',
        nextRecommendedServices: `["${service}"]`,
      })

      await run()

      const listsOf = (id: string) => sql`
        SELECT techniques, "nextRecommendedServices"
        FROM treatment_records WHERE id = ${id}
      `
      expect(await listsOf(missing.id)).toEqual([
        { techniques: [], nextRecommendedServices: [] },
      ])
      expect(await listsOf(stated.id)).toEqual([
        { techniques: ['バレイヤージュ'], nextRecommendedServices: [service] },
      ])
    })

    it('should number the materials of each record by their creation time and then their ID', async () => {
      const first = await storeRecord()
      const second = await storeRecord()
      const product = await storeProduct(first.booked.salonId)
      const other = await storeProduct(second.booked.salonId)
      const latest = await storeMaterial(first.id, product, {
        createdAt: '2026-11-17T03:00:02Z',
      })
      const earlierOfTwo = await storeMaterial(first.id, product, {
        id: '00000000-0000-4000-8000-000000000001',
        createdAt: '2026-11-17T03:00:01Z',
      })
      const laterOfTwo = await storeMaterial(first.id, product, {
        id: 'ffffffff-ffff-4fff-bfff-ffffffffffff',
        createdAt: '2026-11-17T03:00:01Z',
      })
      const ofTheOther = await storeMaterial(second.id, other, {
        createdAt: '2026-11-17T03:00:03Z',
      })

      await run()

      expect(
        await sql`
          SELECT id, "sortOrder" FROM treatment_materials
          ORDER BY "treatmentRecordId" = ${first.id} DESC, "sortOrder"
        `,
      ).toEqual([
        { id: earlierOfTwo, sortOrder: 0 },
        { id: laterOfTwo, sortOrder: 1 },
        { id: latest, sortOrder: 2 },
        { id: ofTheOther, sortOrder: 0 },
      ])
    })

    it('should fail and change nothing where a record breaks a rule', async () => {
      const missing = await storeRecord({ techniques: null })
      await storeRecord({ processingTime: 1441 })
      const before = await describeSchema()

      await expect(run()).rejects.toThrow('treatment_records_ranges')

      expect(
        await sql`SELECT techniques FROM treatment_records WHERE id = ${missing.id}`,
      ).toEqual([{ techniques: null }])
      expect(await describeSchema()).toEqual(before)
    })

    it.each<[string, StoredRecord, string]>([
      [
        'a record without services',
        { services: '[]' },
        'treatment_records_lists',
      ],
      [
        'services that are not a list',
        { services: '{"cut": true}' },
        'treatment_records_lists',
      ],
      [
        'techniques that are not a list',
        { techniques: '"balayage"' },
        'treatment_records_lists',
      ],
      [
        'recommended services that are not a list',
        { nextRecommendedServices: '{}' },
        'treatment_records_lists',
      ],
      [
        'a record without a list of techniques',
        { techniques: null },
        'techniques',
      ],
      [
        'a record without a list of recommended services',
        { nextRecommendedServices: null },
        'nextRecommendedServices',
      ],
      [
        'a negative processing time',
        { processingTime: -1 },
        'treatment_records_ranges',
      ],
      [
        'a processing time above a day',
        { processingTime: 1441 },
        'treatment_records_ranges',
      ],
      [
        'a satisfaction below 1',
        { customerSatisfaction: 0 },
        'treatment_records_ranges',
      ],
      [
        'a satisfaction above 5',
        { customerSatisfaction: 6 },
        'treatment_records_ranges',
      ],
    ])('should keep %s out from then on', async (_, record, rule) => {
      await run()

      await expect(storeRecord(record)).rejects.toThrow(rule)
    })

    it('should take the bounds of the processing time and of the satisfaction, and records without them', async () => {
      await run()

      await storeRecord({ processingTime: 0, customerSatisfaction: 1 })
      await storeRecord({ processingTime: 1440, customerSatisfaction: 5 })
      await storeRecord({ techniques: '["カット", "ブロー"]' })

      expect(await sql`SELECT 1 FROM treatment_records`).toHaveLength(3)
    })

    it('should keep out a material of no quantity, and a second material at the place of another in the record', async () => {
      await run()
      const { id, booked } = await storeRecord()
      const product = await storeProduct(booked.salonId)
      const material = (sortOrder: number, quantity: string) => sql`
        INSERT INTO treatment_materials (
          "treatmentRecordId", "productId", quantity, unit, "sortOrder"
        )
        VALUES (${id}, ${product}, ${quantity}, 'g', ${sortOrder})
      `

      await material(0, '0.01')
      await expect(material(1, '0')).rejects.toThrow(
        'treatment_materials_amounts',
      )
      await expect(material(-1, '1')).rejects.toThrow(
        'treatment_materials_amounts',
      )
      await expect(material(0, '1')).rejects.toThrow(
        'treatment_materials_record_sort_unique',
      )
    })
  })

  describe('202611171900_treatment_photo_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611171900_treatment_photo_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** A treatment record of a booking of a new salon; returns its ID. */
    const storeRecord = async (): Promise<string> => {
      const salonId = await storeSalon(null)
      const customerId = await storeNewCustomer()
      const staffId = randomUUID()
      await sql`
        INSERT INTO staff (
          id, "salonId", "firstName", "lastName", "displayName", email,
          "phoneNumber", specialties, certifications
        )
        VALUES (
          ${staffId}, ${salonId}, 'Hanako', 'Sato', 'Hanako',
          ${`${staffId}@example.com`}, '03-1234-5678', '{}', '{}'
        )
      `
      const bookingId = randomUUID()
      await sql`
        INSERT INTO bookings (
          id, "bookingNumber", "salonId", "customerId", "staffId",
          "bookingDate", "startTime", "endTime", duration, subtotal,
          "totalAmount"
        )
        VALUES (
          ${bookingId}, ${`BK-${bookingId.slice(0, 8)}`}, ${salonId},
          ${customerId}, ${staffId}, '2026-11-01',
          '2026-11-01T01:00:00Z', '2026-11-01T02:00:00Z', 60, 0, 0
        )
      `
      const id = randomUUID()
      await sql`
        INSERT INTO treatment_records (
          id, "bookingId", "customerId", "staffId", services
        )
        VALUES (
          ${id}, ${bookingId}, ${customerId}, ${staffId},
          ${`["${randomUUID()}"]`}::text::jsonb
        )
      `
      return id
    }

    /** What a stored photo states, beside its record. */
    type StoredPhoto = {
      photoType?: string
      photoUrl?: string
      isPublic?: boolean
      customerConsent?: boolean
      sortOrder?: number
    }

    /** A photo of the record; returns its ID. */
    const storePhoto = async (
      recordId: string,
      {
        photoType = 'after',
        photoUrl = `https://images.example.com/${randomUUID()}.jpg`,
        isPublic = false,
        customerConsent = false,
        sortOrder = 0,
      }: StoredPhoto = {},
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO treatment_photos (
          id, "treatmentRecordId", "photoType", "photoUrl", "isPublic",
          "customerConsent", "sortOrder"
        )
        VALUES (
          ${id}, ${recordId}, ${photoType}, ${photoUrl}, ${isPublic},
          ${customerConsent}, ${sortOrder}
        )
      `
      return id
    }

    // A database from before the migration: the kind of a photo is any
    // text of up to 20 characters, two indexes, and none of the rules.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE treatment_photos
          DROP CONSTRAINT treatment_photos_consent,
          DROP CONSTRAINT treatment_photos_sort_order,
          DROP CONSTRAINT treatment_photos_record_url_unique,
          ALTER COLUMN "photoType" TYPE varchar(20) USING "photoType"::text;
        DROP TYPE treatment_photo_type;
        CREATE INDEX idx_treatment_photos_photo_type
          ON treatment_photos USING btree ("photoType");
        CREATE INDEX idx_treatment_photos_treatment_record_id
          ON treatment_photos USING btree ("treatmentRecordId");
      `)
    })

    it('should give the database the rules of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep every photo of a known kind, and the photos of one address in two records', async () => {
      const first = await storeRecord()
      const second = await storeRecord()
      const shared = 'https://images.example.com/shared.jpg'
      const kinds = ['before', 'during', 'after', 'other']
      for (const [sortOrder, photoType] of kinds.entries()) {
        await storePhoto(first, { photoType, sortOrder })
      }
      await storePhoto(first, {
        photoUrl: shared,
        isPublic: true,
        customerConsent: true,
      })
      await storePhoto(second, { photoUrl: shared })

      await run()

      expect(
        await sql`
          SELECT "photoType"::text AS "photoType", "sortOrder"
          FROM treatment_photos
          WHERE "treatmentRecordId" = ${first} AND "photoUrl" <> ${shared}
          ORDER BY "sortOrder"
        `,
      ).toEqual(kinds.map((photoType, sortOrder) => ({ photoType, sortOrder })))
      expect(
        await sql`SELECT 1 FROM treatment_photos WHERE "photoUrl" = ${shared}`,
      ).toHaveLength(2)
    })

    it.each<[string, (recordId: string) => Promise<unknown>, string]>([
      [
        'a photo of an unknown kind',
        (recordId) => storePhoto(recordId, { photoType: 'Before' }),
        'treatment_photo_type',
      ],
      [
        'a public photo without the consent of the customer',
        (recordId) => storePhoto(recordId, { isPublic: true }),
        'treatment_photos_consent',
      ],
      [
        'a photo before the first place',
        (recordId) => storePhoto(recordId, { sortOrder: -1 }),
        'treatment_photos_sort_order',
      ],
      [
        'two photos of one address in a record',
        async (recordId) => {
          const photoUrl = 'https://images.example.com/twice.jpg'
          await storePhoto(recordId, { photoUrl })
          await storePhoto(recordId, { photoUrl, sortOrder: 1 })
        },
        'treatment_photos_record_url_unique',
      ],
    ])(
      'should fail and change nothing where the database holds %s, and keep it out from then on',
      async (_, store, rule) => {
        const recordId = await storeRecord()
        const kept = await storePhoto(recordId, { photoType: 'before' })
        await store(recordId)
        const before = await describeSchema()

        await expect(run()).rejects.toThrow(rule)

        expect(
          await sql`SELECT "photoType" FROM treatment_photos WHERE id = ${kept}`,
        ).toEqual([{ photoType: 'before' }])
        expect(await describeSchema()).toEqual(before)

        await sql`DELETE FROM treatment_photos WHERE id <> ${kept}`
        await run()

        await expect(store(recordId)).rejects.toThrow(rule)
      },
    )
  })

  describe('202611181100_customer_allergy_rules.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611181100_customer_allergy_rules.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** An allergy as stored before the migration, with both severities. */
    type OldAllergy = {
      allergenName?: string
      severity?: number
      severityType?: string | null
    }

    /** An allergy of the customer before the migration; returns its ID. */
    const storeOldAllergy = async (
      customerId: string,
      {
        allergenName = `allergen ${randomUUID()}`,
        severity = 3,
        severityType = null,
      }: OldAllergy = {},
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO customer_allergies (
          id, "customerId", "allergyType", "allergenName", severity,
          "severityType"
        )
        VALUES (
          ${id}, ${customerId}, 'chemical', ${allergenName}, ${severity},
          ${severityType}::allergy_severity
        )
      `
      return id
    }

    /** An allergy of the customer once the migration is applied. */
    const storeAllergy = (
      customerId: string,
      allergenName: string,
      severityType: string | null = 'mild',
    ) => sql`
      INSERT INTO customer_allergies (
        "customerId", "allergyType", "allergenName", "severityType"
      )
      VALUES (
        ${customerId}, 'chemical', ${allergenName},
        ${severityType}::allergy_severity
      )
    `

    const levelOf = async (id: string): Promise<unknown> =>
      sql`
        SELECT "severityType"::text AS "severityType"
        FROM customer_allergies WHERE id = ${id}
      `

    // A database from before the migration: a severity as a number beside
    // a level that may be missing, an index on the customer, and no rule
    // that keeps an allergen of a customer to one row.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE customer_allergies
          DROP CONSTRAINT customer_allergies_customer_allergen_unique,
          ALTER COLUMN "severityType" DROP NOT NULL,
          ADD COLUMN severity integer DEFAULT 3 NOT NULL;
        CREATE INDEX idx_customer_allergies_customer_id
          ON customer_allergies USING btree ("customerId");
      `)
    })

    it('should give the database the rules of setup.sql, and keep them on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it.each<[number, string]>([
      [-1, 'mild'],
      [1, 'mild'],
      [2, 'mild'],
      [3, 'moderate'],
      [4, 'severe'],
      [5, 'life_threatening'],
      [9, 'life_threatening'],
    ])(
      'should give an allergy of severity %i and no level the level %s',
      async (severity, level) => {
        const id = await storeOldAllergy(await storeNewCustomer(), {
          severity,
        })

        await run()

        expect(await levelOf(id)).toEqual([{ severityType: level }])
      },
    )

    it('should keep the level of an allergy that has one, whatever its number', async () => {
      const customerId = await storeNewCustomer()
      const mild = await storeOldAllergy(customerId, {
        severity: 5,
        severityType: 'mild',
      })
      const severe = await storeOldAllergy(customerId, {
        severity: 1,
        severityType: 'severe',
      })

      await run()

      expect(await levelOf(mild)).toEqual([{ severityType: 'mild' }])
      expect(await levelOf(severe)).toEqual([{ severityType: 'severe' }])
    })

    it('should keep the allergens of one name of two customers, and names of one customer that differ in case', async () => {
      const first = await storeNewCustomer()
      const second = await storeNewCustomer()
      await storeOldAllergy(first, { allergenName: 'PPD' })
      await storeOldAllergy(first, { allergenName: 'ppd' })
      await storeOldAllergy(second, { allergenName: 'PPD' })

      await run()

      await storeAllergy(second, 'ppd')
      expect(await sql`SELECT 1 FROM customer_allergies`).toHaveLength(4)
    })

    it('should fail and change nothing where a customer has two rows of one allergen, and keep them out from then on', async () => {
      const customerId = await storeNewCustomer()
      const kept = await storeOldAllergy(customerId, { allergenName: 'PPD' })
      const second = await storeOldAllergy(customerId, {
        allergenName: 'PPD',
      })
      const before = await describeSchema()

      await expect(run()).rejects.toThrow(
        'customer_allergies_customer_allergen_unique',
      )

      expect(await levelOf(kept)).toEqual([{ severityType: null }])
      expect(await describeSchema()).toEqual(before)

      await sql`DELETE FROM customer_allergies WHERE id = ${second}`
      await run()

      await expect(storeAllergy(customerId, 'PPD')).rejects.toThrow(
        'customer_allergies_customer_allergen_unique',
      )
    })

    it('should keep an allergy without a level out from then on', async () => {
      await run()

      await expect(
        storeAllergy(await storeNewCustomer(), 'PPD', null),
      ).rejects.toThrow('severityType')
    })
  })

  describe('202611181200_unused_tables_and_columns.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611181200_unused_tables_and_columns.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** The columns that accept NULL and have a default, as `table.column`. */
    const nullableWithDefault = async (): Promise<string[]> => {
      const rows = await sql<{ name: string }[]>`
        SELECT table_name || '.' || column_name AS name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND is_nullable = 'YES'
          AND column_default IS NOT NULL
        ORDER BY 1
      `
      return rows.map(({ name }) => name)
    }

    /**
     * A staff member of the salon; the years of experience are left to the
     * column when `years` is missing. Returns the ID.
     */
    const storeStaff = async (
      salonId: string,
      years?: number | null,
    ): Promise<string> => {
      const id = randomUUID()
      await sql`
        INSERT INTO staff (
          id, "salonId", "firstName", "lastName", "displayName", email,
          "phoneNumber", specialties, certifications
        )
        VALUES (
          ${id}, ${salonId}, 'Hanako', 'Sato', 'Hanako',
          ${`${id}@example.com`}, '03-1234-5678', '{}', '{}'
        )
      `
      if (years !== undefined) {
        await sql`
          UPDATE staff SET "yearsOfExperience" = ${years} WHERE id = ${id}
        `
      }
      return id
    }

    const yearsOf = async (id: string): Promise<unknown> =>
      sql`SELECT "yearsOfExperience" FROM staff WHERE id = ${id}`

    // A database from before the migration: the tables and the types that
    // nothing read, the jsonb columns without a defined structure, and a
    // default of 0 years of experience.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        CREATE TYPE notification_type AS ENUM ('booking_reminder', 'birthday');
        CREATE TYPE notification_channel AS ENUM ('email', 'sms');
        CREATE TABLE membership_tiers (
          id uuid PRIMARY KEY,
          "salonId" uuid NOT NULL REFERENCES salons (id) ON DELETE CASCADE,
          tier membership_tier NOT NULL,
          benefits jsonb DEFAULT '[]'::jsonb
        );
        CREATE TABLE staff_skills (
          id uuid PRIMARY KEY,
          "staffId" uuid NOT NULL REFERENCES staff (id) ON DELETE CASCADE
        );
        CREATE TABLE staff_performances (
          id uuid PRIMARY KEY,
          "staffId" uuid NOT NULL REFERENCES staff (id) ON DELETE CASCADE
        );
        CREATE TABLE daily_summaries (
          id uuid PRIMARY KEY,
          "salonId" uuid NOT NULL REFERENCES salons (id) ON DELETE CASCADE
        );
        CREATE TABLE notification_logs (
          id uuid PRIMARY KEY,
          "notificationType" notification_type NOT NULL,
          "notificationChannel" notification_channel NOT NULL
        );
        ALTER TABLE services
          ADD COLUMN "requiredProducts" jsonb DEFAULT '[]'::jsonb;
        ALTER TABLE staff
          ADD COLUMN awards jsonb DEFAULT '[]'::jsonb,
          ALTER COLUMN "yearsOfExperience" SET DEFAULT 0;
        ALTER TABLE users ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
        ALTER TABLE salons
          ADD COLUMN "cancellationPolicy" jsonb,
          ADD COLUMN "bookingPolicy" jsonb;
        ALTER TABLE booking_services ADD COLUMN "selectedOptions" jsonb;
      `)
    })

    it('should give the database the schema of setup.sql, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should leave no column that accepts NULL and has a default', async () => {
      expect(await nullableWithDefault()).toEqual([
        'membership_tiers.benefits',
        'services.requiredProducts',
        'staff.awards',
        'staff.yearsOfExperience',
        'users.metadata',
      ])

      await run()

      expect(await nullableWithDefault()).toEqual([])
    })

    it('should keep the years of experience that are stored, and leave those of a later row unstated', async () => {
      const salonId = await storeSalon(null)
      const twelve = await storeStaff(salonId, 12)
      const unstated = await storeStaff(salonId, null)
      const defaulted = await storeStaff(salonId)

      await run()
      const later = await storeStaff(salonId)

      expect(await yearsOf(twelve)).toEqual([{ yearsOfExperience: 12 }])
      expect(await yearsOf(unstated)).toEqual([{ yearsOfExperience: null }])
      expect(await yearsOf(defaulted)).toEqual([{ yearsOfExperience: 0 }])
      expect(await yearsOf(later)).toEqual([{ yearsOfExperience: null }])
    })
  })

  describe('202611181300_users_without_permissions.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611181300_users_without_permissions.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** The rows of the users, by email. */
    const userRows = (ids: string[]): Promise<Record<string, unknown>[]> =>
      sql<Record<string, unknown>[]>`
        SELECT * FROM users WHERE id = ANY(${ids}::uuid[]) ORDER BY email
      `

    /** The rows as the migration should leave them: without permissions. */
    const withoutPermissions = (
      rows: Record<string, unknown>[],
    ): Record<string, unknown>[] =>
      rows.map(({ permissions: _permissions, ...row }) => row)

    // A database from before the migration: every user has a list of
    // permission names, which nothing reads.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE users
          ADD COLUMN permissions jsonb DEFAULT '[]'::jsonb NOT NULL;
      `)
    })

    it('should give the database the schema of setup.sql, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep every user, with all that the row stores but the permissions', async () => {
      const owner = randomUUID()
      const customer = randomUUID()
      await sql`
        INSERT INTO users (id, email, "passwordHash", role, permissions)
        VALUES
          (${owner}, 'owner@example.com', 'hash', 'owner', '["all"]'::jsonb),
          (${customer}, 'customer@example.com', 'hash', 'customer', '[]'::jsonb)
      `
      const before = await userRows([owner, customer])
      expect(before).toMatchObject([
        { email: 'customer@example.com', permissions: [] },
        { email: 'owner@example.com', permissions: ['all'] },
      ])

      await run()

      expect(await userRows([owner, customer])).toEqual(
        withoutPermissions(before),
      )
    })
  })

  describe('202611181400_customers_without_lifetime_value.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611181400_customers_without_lifetime_value.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** The rows of the customers, by email. */
    const customerRows = (ids: string[]): Promise<Record<string, unknown>[]> =>
      sql<Record<string, unknown>[]>`
        SELECT * FROM customers WHERE id = ANY(${ids}::uuid[]) ORDER BY email
      `

    /** The rows as the migration should leave them: without the lifetime value. */
    const withoutLifetimeValue = (
      rows: Record<string, unknown>[],
    ): Record<string, unknown>[] =>
      rows.map(({ lifetimeValue: _lifetimeValue, ...row }) => row)

    // A database from before the migration: every customer has a lifetime
    // value, which nothing kept up to date.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE customers
          ADD COLUMN "lifetimeValue" integer DEFAULT 0 NOT NULL;
      `)
    })

    it('should give the database the schema of setup.sql, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep every customer, with all that the row stores but the lifetime value', async () => {
      const regular = await storeNewCustomer()
      const newcomer = await storeNewCustomer()
      await sql`
        UPDATE customers SET "lifetimeValue" = 150000, "loyaltyPoints" = 120
        WHERE id = ${regular}
      `
      const before = await customerRows([regular, newcomer])
      expect(before).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: regular, lifetimeValue: 150000 }),
          expect.objectContaining({ id: newcomer, lifetimeValue: 0 }),
        ]),
      )

      await run()

      expect(await customerRows([regular, newcomer])).toEqual(
        withoutLifetimeValue(before),
      )
    })
  })

  describe('202611181800_customer_versions.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611181800_customer_versions.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    /** The versions of the customers: the number, the operation, the user and a few values. */
    const versionsOf = (ids: string[]) =>
      sql<
        {
          customerId: string
          version: number
          operation: string
          changedBy: string | null
          email: string
          notes: string | null
          tags: string[]
        }[]
      >`
        SELECT "customerId", version, operation::text AS operation,
               "changedBy", email, notes, tags
        FROM customer_versions
        WHERE "customerId" = ANY(${ids}::uuid[])
        ORDER BY "customerId", version
      `

    // A database from before the migration: no versions are kept.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP TABLE customer_versions;
        DROP TYPE customer_version_operation;
      `)
    })

    it('should give the database the schema of setup.sql, with the operations the merge and the erasure of customers added since, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()
      await runMigration('202611181900_customer_merge.sql')
      await runMigration('202611182000_customer_deletion_requests.sql')

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should give every customer, deleted or not, one baseline version of the values they have, and none on a second run', async () => {
      const kept = await storeNewCustomer()
      const deleted = await storeNewCustomer()
      await sql`
        UPDATE customers SET notes = 'Window seat', tags = '{vip}'
        WHERE id = ${kept}
      `
      await sql`UPDATE customers SET "deletedAt" = now() WHERE id = ${deleted}`

      await run()
      await run()

      expect(await versionsOf([kept, deleted])).toEqual(
        [
          {
            customerId: kept,
            version: 1,
            operation: 'baseline',
            changedBy: null,
            email: `${kept}@example.com`,
            notes: 'Window seat',
            tags: ['vip'],
          },
          {
            customerId: deleted,
            version: 1,
            operation: 'baseline',
            changedBy: null,
            email: `${deleted}@example.com`,
            notes: null,
            tags: [],
          },
        ].sort((left, right) => (left.customerId < right.customerId ? -1 : 1)),
      )
    })

    it('should let only a baseline be without the user who wrote it, number versions from 1 once each, and drop the versions with their customer', async () => {
      await run()
      const id = await storeNewCustomer()
      await run()
      const write = (version: number, operation: string, by: string | null) =>
        sql`
          INSERT INTO customer_versions (
            "customerId", version, operation, "changedBy", "firstName",
            "lastName", email, "phoneNumber", "membershipTier", tags,
            "allowMarketing", "allowSms", "allowEmail", "isActive",
            "customerStatus"
          )
          VALUES (
            ${id}, ${version}, ${operation}::customer_version_operation, ${by},
            'Taro', 'Suzuki', 'taro@example.com', '090-8765-4321', 'regular',
            '{}', true, true, true, true, 'active'
          )
        `

      await expect(write(2, 'update', null)).rejects.toThrow(
        /customer_versions_changed_by_unless_baseline/,
      )
      await expect(write(0, 'baseline', null)).rejects.toThrow(
        /customer_versions_version_positive/,
      )
      await expect(write(1, 'baseline', null)).rejects.toThrow(
        /customer_versions_customer_version_unique/,
      )
      await expect(write(2, 'baseline', randomUUID())).rejects.toThrow(
        /customer_versions_changed_by_unless_baseline/,
      )
      await sql`DELETE FROM customers WHERE id = ${id}`
      expect(await versionsOf([id])).toEqual([])
    })
  })

  describe('202611181900_customer_merge.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611181900_customer_merge.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    // A database from before the migration: no version is a merge, and no
    // transfer of points is written.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        ALTER TABLE customer_versions
            DROP CONSTRAINT customer_versions_changed_by_unless_baseline;
        ALTER TYPE customer_version_operation
            RENAME TO customer_version_operation_with_merge;
        CREATE TYPE customer_version_operation
            AS ENUM ('baseline', 'create', 'update', 'delete', 'restore');
        ALTER TABLE customer_versions
            ALTER COLUMN operation TYPE customer_version_operation
            USING operation::text::customer_version_operation;
        DROP TYPE customer_version_operation_with_merge;
        ALTER TABLE customer_versions
            ADD CONSTRAINT customer_versions_changed_by_unless_baseline
            CHECK ((operation = 'baseline') = ("changedBy" IS NULL));
        ALTER TABLE customer_points
            DROP CONSTRAINT customer_points_transfer_names_customer,
            DROP CONSTRAINT customer_points_expiry_of_earned,
            DROP CONSTRAINT customer_points_reference_type_known;
        ALTER TABLE customer_points
            ADD CONSTRAINT customer_points_expiry_of_earned
            CHECK ("expiryDate" IS NULL OR "transactionType" = 'earned'),
            ADD CONSTRAINT customer_points_reference_type_known
            CHECK (
                "referenceType" IS NULL
                OR "referenceType"::text IN ('sale', 'booking')
            );
      `)
    })

    /** A point transaction of a customer: what it is, what it names and when it expires. */
    const writePoints = (
      customerId: string,
      transactionType: string,
      points: number,
      referenceType: string | null,
      expiryDate: string | null,
    ) => sql`
      INSERT INTO customer_points (
        "customerId", "transactionType", points, balance, "referenceType",
        "referenceId", "expiryDate"
      )
      VALUES (
        ${customerId}, ${transactionType}::point_transaction_type, ${points},
        100, ${referenceType},
        ${referenceType === null ? null : randomUUID()}, ${expiryDate}
      )
    `

    it('should give the database the schema of setup.sql, with the operation the erasure of customers added since, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()
      await runMigration('202611182000_customer_deletion_requests.sql')

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should let a version be a merge, and keep the versions there are', async () => {
      const id = await storeNewCustomer()
      await sql`
        INSERT INTO customer_versions (
          "customerId", version, operation, "firstName", "lastName", email,
          "phoneNumber", "membershipTier", tags, "allowMarketing", "allowSms",
          "allowEmail", "isActive", "customerStatus"
        )
        VALUES (
          ${id}, 1, 'baseline', 'Taro', 'Suzuki', 'taro@example.com',
          '090-8765-4321', 'regular', '{}', true, true, true, true, 'active'
        )
      `

      await run()
      await sql`
        WITH admin AS (
          INSERT INTO users (email, "passwordHash", role)
          VALUES (${`${id}@example.com`}, 'hash', 'admin')
          RETURNING id
        )
        INSERT INTO customer_versions (
          "customerId", version, operation, "changedBy", "firstName",
          "lastName", email, "phoneNumber", "membershipTier", tags,
          "allowMarketing", "allowSms", "allowEmail", "isActive",
          "customerStatus"
        )
        SELECT ${id}, 2, 'merge', admin.id, 'Taro', 'Suzuki',
               'taro@example.com', '090-8765-4321', 'regular', '{}', true,
               true, true, true, 'active'
        FROM admin
      `

      expect(
        await sql<{ version: number; operation: string }[]>`
          SELECT version, operation::text AS operation FROM customer_versions
          WHERE "customerId" = ${id} ORDER BY version
        `,
      ).toEqual([
        { version: 1, operation: 'baseline' },
        { version: 2, operation: 'merge' },
      ])
    })

    it('should let a transfer, and only a transfer, name a customer, and only a transfer that adds points have an expiry date besides an earning', async () => {
      const id = await storeNewCustomer()
      await run()

      await writePoints(id, 'transferred', 30, 'customer', '2027-01-31')
      await writePoints(id, 'transferred', -30, 'customer', null)
      await writePoints(id, 'earned', 30, 'sale', '2027-01-31')
      await expect(
        writePoints(id, 'transferred', 30, null, null),
      ).rejects.toThrow(/customer_points_transfer_names_customer/)
      await expect(
        writePoints(id, 'transferred', 30, 'sale', null),
      ).rejects.toThrow(/customer_points_transfer_names_customer/)
      await expect(
        writePoints(id, 'adjusted', 30, 'customer', null),
      ).rejects.toThrow(/customer_points_transfer_names_customer/)
      await expect(
        writePoints(id, 'transferred', -30, 'customer', '2027-01-31'),
      ).rejects.toThrow(/customer_points_expiry_of_earned/)
      await expect(
        writePoints(id, 'adjusted', 30, null, '2027-01-31'),
      ).rejects.toThrow(/customer_points_expiry_of_earned/)
      await expect(
        writePoints(id, 'earned', 30, 'payment', null),
      ).rejects.toThrow(/customer_points_reference_type_known/)
    })

    it('should stop, and change nothing, at a transfer written before that names no customer', async () => {
      const id = await storeNewCustomer()
      await writePoints(id, 'transferred', 30, null, null)
      const before = await describeSchema()

      await expect(run()).rejects.toThrow(
        /customer_points_transfer_names_customer/,
      )

      expect(await describeSchema()).toEqual(before)
    })
  })

  describe('202611182000_customer_deletion_requests.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611182000_customer_deletion_requests.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    // A database from before the migration: no request is recorded, and no
    // version is an erasure.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP TABLE customer_deletion_requests;
        DROP TYPE customer_deletion_request_status;
        ALTER TABLE customer_versions
            DROP CONSTRAINT customer_versions_changed_by_unless_baseline;
        ALTER TYPE customer_version_operation
            RENAME TO customer_version_operation_with_erase;
        CREATE TYPE customer_version_operation AS ENUM (
            'baseline', 'create', 'update', 'delete', 'restore', 'merge'
        );
        ALTER TABLE customer_versions
            ALTER COLUMN operation TYPE customer_version_operation
            USING operation::text::customer_version_operation;
        DROP TYPE customer_version_operation_with_erase;
        ALTER TABLE customer_versions
            ADD CONSTRAINT customer_versions_changed_by_unless_baseline
            CHECK ((operation = 'baseline') = ("changedBy" IS NULL));
      `)
    })

    /** A request of the customer, taken by the user, with what else is given. */
    const writeRequest = (
      customerId: string,
      by: string,
      more: {
        reason?: string
        status?: string
        scheduledAfter?: string
        cancelled?: boolean
        cancelledBy?: string | null
        completed?: boolean
        completedBy?: string | null
      } = {},
    ) => sql`
      INSERT INTO customer_deletion_requests (
        "customerId", reason, status, "requestedBy", "requestedAt",
        "scheduledAt", "cancelledBy", "cancelledAt", "completedBy",
        "completedAt"
      )
      VALUES (
        ${customerId}, ${more.reason ?? '本人の依頼'},
        ${more.status ?? 'pending'}::customer_deletion_request_status, ${by},
        '2026-11-01T00:00:00Z',
        '2026-11-01T00:00:00Z'::timestamptz
          + ${more.scheduledAfter ?? '336 hours'}::interval,
        ${more.cancelledBy === undefined ? (more.cancelled === true ? by : null) : more.cancelledBy},
        ${more.cancelled === true ? '2026-11-02T00:00:00Z' : null},
        ${more.completedBy === undefined ? (more.completed === true ? by : null) : more.completedBy},
        ${more.completed === true ? '2026-11-15T00:00:00Z' : null}
      )
    `

    it('should give the database the schema of setup.sql, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should let a version be an erasure, and keep the versions there are', async () => {
      const id = await storeNewCustomer()
      const admin = await storeNewUser()
      const version = (number: number, operation: string) => sql`
        INSERT INTO customer_versions (
          "customerId", version, operation, "changedBy", "firstName",
          "lastName", email, "phoneNumber", "membershipTier", tags,
          "allowMarketing", "allowSms", "allowEmail", "isActive",
          "customerStatus"
        )
        VALUES (
          ${id}, ${number}, ${operation}::customer_version_operation, ${admin},
          'Taro', 'Suzuki', 'taro@example.com', '090-8765-4321', 'regular',
          '{}', true, true, true, true, 'active'
        )
      `
      await version(1, 'create')

      await run()
      await version(2, 'erase')

      expect(
        await sql<{ version: number; operation: string }[]>`
          SELECT version, operation::text AS operation FROM customer_versions
          WHERE "customerId" = ${id} ORDER BY version
        `,
      ).toEqual([
        { version: 1, operation: 'create' },
        { version: 2, operation: 'erase' },
      ])
    })

    it('should keep one pending request a customer, with a reason, due 336 hours after it was taken, and drop the requests with their customer', async () => {
      await run()
      const id = await storeNewCustomer()
      const other = await storeNewCustomer()
      const admin = await storeNewUser()

      await writeRequest(id, admin, { status: 'cancelled', cancelled: true })
      await writeRequest(id, admin, { status: 'completed', completed: true })
      await writeRequest(id, admin)
      await writeRequest(other, admin)
      await expect(writeRequest(id, admin)).rejects.toThrow(
        /customer_deletion_requests_one_pending/,
      )
      await expect(
        writeRequest(other, admin, { status: 'cancelled', cancelled: true }),
      ).resolves.toBeDefined()
      await expect(writeRequest(id, admin, { reason: '' })).rejects.toThrow(
        /customer_deletion_requests_reason_length/,
      )
      await expect(
        writeRequest(id, admin, {
          status: 'cancelled',
          cancelled: true,
          reason: 'あ'.repeat(1001),
        }),
      ).rejects.toThrow(/customer_deletion_requests_reason_length/)
      await expect(
        writeRequest(id, admin, {
          status: 'cancelled',
          cancelled: true,
          reason: 'あ'.repeat(1000),
        }),
      ).resolves.toBeDefined()
      await expect(
        writeRequest(id, admin, {
          status: 'cancelled',
          cancelled: true,
          scheduledAfter: '14 days 1 second',
        }),
      ).rejects.toThrow(/customer_deletion_requests_scheduled_after_grace/)
      await expect(
        writeRequest(id, admin, { status: 'cancelled' }),
      ).rejects.toThrow(/customer_deletion_requests_cancelled_when_cancelled/)
      await expect(
        writeRequest(id, admin, {
          status: 'completed',
          completed: true,
          cancelled: true,
        }),
      ).rejects.toThrow(/customer_deletion_requests_cancelled_when_cancelled/)
      await expect(
        writeRequest(id, admin, {
          status: 'cancelled',
          cancelled: true,
          cancelledBy: null,
        }),
      ).rejects.toThrow(/customer_deletion_requests_cancelled_when_cancelled/)
      await expect(
        writeRequest(id, admin, { status: 'completed' }),
      ).rejects.toThrow(/customer_deletion_requests_completed_when_completed/)
      await expect(
        writeRequest(id, admin, {
          status: 'cancelled',
          cancelled: true,
          completed: true,
        }),
      ).rejects.toThrow(/customer_deletion_requests_completed_when_completed/)
      await expect(
        writeRequest(id, admin, { completed: true, completedBy: null }),
      ).rejects.toThrow(/customer_deletion_requests_completed_when_completed/)
      await expect(
        writeRequest(id, randomUUID(), {
          status: 'cancelled',
          cancelled: true,
        }),
      ).rejects.toThrow(/customer_deletion_requests_requested_by_fk/)

      await sql`DELETE FROM customers WHERE id = ${id}`
      expect(
        await sql<{ customerId: string }[]>`
          SELECT "customerId" FROM customer_deletion_requests
          WHERE "customerId" IN (${id}, ${other})
        `,
      ).toEqual([{ customerId: other }, { customerId: other }])
    })
  })

  describe('202611182100_attachments.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611182100_attachments.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    // A database from before the migration: no attachment is recorded.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe(`
        DROP TABLE share_links;
        DROP TABLE attachments;
        DROP TYPE attachment_content_type;
        DROP TYPE attachment_status;
      `)
    })

    /**
     * An attachment the user announced at 2026-11-18T02:00:00Z, of the
     * platform unless a salon is given, with what else is given.
     */
    const writeAttachment = (
      by: string,
      more: {
        salonId?: string
        filename?: string
        contentType?: string
        size?: number
        status?: string
        expiresAfter?: string
        uploaded?: boolean
        deleted?: boolean
      } = {},
    ) => sql<{ id: string }[]>`
      INSERT INTO attachments (
        "salonId", filename, "contentType", size, status, "uploadedBy",
        "uploadExpiresAt", "uploadedAt", "deletedAt", "createdAt"
      )
      VALUES (
        ${more.salonId ?? null}, ${more.filename ?? '施術前.png'},
        ${more.contentType ?? 'image/png'}::attachment_content_type,
        ${more.size ?? 64},
        ${more.status ?? 'pending'}::attachment_status, ${by},
        '2026-11-18T02:00:00Z'::timestamptz
          + ${more.expiresAfter ?? '15 minutes'}::interval,
        ${more.uploaded === true ? '2026-11-18T02:05:00Z' : null},
        ${more.deleted === true ? '2026-11-18T03:00:00Z' : null},
        '2026-11-18T02:00:00Z'
      )
      RETURNING id
    `

    it('should give the database the schema of setup.sql, with the share links added since, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()
      await runMigration('202611182200_share_links.sql')

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep the attachments there are on a second run', async () => {
      await run()
      const user = await storeNewUser()
      const [written] = await writeAttachment(user)

      await run()

      expect(await sql<{ id: string }[]>`SELECT id FROM attachments`).toEqual([
        written,
      ])
    })

    it('should write an attachment as a pending one with an ID of its own, of a salon or of none', async () => {
      await run()
      const user = await storeNewUser()
      const salonId = await storeSalon(null)

      await sql`
        INSERT INTO attachments (
          "salonId", filename, "contentType", size, "uploadedBy",
          "uploadExpiresAt"
        )
        VALUES
          (${salonId}, 'before.png', 'image/png', 64, ${user},
           now() + interval '15 minutes'),
          (NULL, '同意書.pdf', 'application/pdf', 2048, ${user},
           now() + interval '15 minutes')
      `

      const stored = await sql<Record<string, unknown>[]>`
        SELECT
          id::text ~ '^[0-9a-f-]{36}$' AS "hasId", "salonId", filename,
          "contentType"::text AS "contentType", size, status::text AS status,
          "uploadedBy", "uploadedAt", "deletedAt",
          "createdAt" = "updatedAt" AS "writtenAtOnce"
        FROM attachments ORDER BY size
      `
      expect(stored).toEqual([
        {
          hasId: true,
          salonId,
          filename: 'before.png',
          contentType: 'image/png',
          size: 64,
          status: 'pending',
          uploadedBy: user,
          uploadedAt: null,
          deletedAt: null,
          writtenAtOnce: true,
        },
        {
          hasId: true,
          salonId: null,
          filename: '同意書.pdf',
          contentType: 'application/pdf',
          size: 2048,
          status: 'pending',
          uploadedBy: user,
          uploadedAt: null,
          deletedAt: null,
          writtenAtOnce: true,
        },
      ])
    })

    it('should take the four kinds of file, of a byte to 10 MiB, under a name of 1 to 255 characters, and refuse the others', async () => {
      await run()
      const user = await storeNewUser()

      for (const contentType of [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
      ]) {
        await expect(
          writeAttachment(user, { contentType }),
        ).resolves.toHaveLength(1)
      }
      await expect(
        writeAttachment(user, { contentType: 'image/gif' }),
      ).rejects.toThrow(
        /invalid input value for enum attachment_content_type: "image\/gif"/,
      )
      await expect(
        writeAttachment(user, { contentType: 'text/html' }),
      ).rejects.toThrow(/invalid input value for enum attachment_content_type/)

      await expect(writeAttachment(user, { size: 1 })).resolves.toHaveLength(1)
      await expect(
        writeAttachment(user, { size: 10_485_760 }),
      ).resolves.toHaveLength(1)
      await expect(writeAttachment(user, { size: 0 })).rejects.toThrow(
        /attachments_size_within_limit/,
      )
      await expect(writeAttachment(user, { size: -1 })).rejects.toThrow(
        /attachments_size_within_limit/,
      )
      await expect(writeAttachment(user, { size: 10_485_761 })).rejects.toThrow(
        /attachments_size_within_limit/,
      )

      await expect(
        writeAttachment(user, { filename: 'a' }),
      ).resolves.toHaveLength(1)
      // Characters, not bytes: 255 of three bytes each.
      await expect(
        writeAttachment(user, { filename: 'あ'.repeat(255) }),
      ).resolves.toHaveLength(1)
      await expect(writeAttachment(user, { filename: '' })).rejects.toThrow(
        /attachments_filename_not_empty/,
      )
      await expect(
        writeAttachment(user, { filename: 'a'.repeat(256) }),
      ).rejects.toThrow(/value too long for type character varying\(255\)/)
    })

    it('should hold the time of the upload to the status, and the end of the upload URL to after the attachment was written', async () => {
      await run()
      const user = await storeNewUser()

      await expect(
        writeAttachment(user, { status: 'uploaded', uploaded: true }),
      ).resolves.toHaveLength(1)
      await expect(
        writeAttachment(user, { status: 'uploaded' }),
      ).rejects.toThrow(/attachments_uploaded_when_uploaded/)
      await expect(writeAttachment(user, { uploaded: true })).rejects.toThrow(
        /attachments_uploaded_when_uploaded/,
      )
      await expect(
        writeAttachment(user, { status: 'deleted' }),
      ).rejects.toThrow(/invalid input value for enum attachment_status/)

      // A pending and an uploaded attachment are deleted alike.
      await expect(
        writeAttachment(user, { deleted: true }),
      ).resolves.toHaveLength(1)
      await expect(
        writeAttachment(user, {
          status: 'uploaded',
          uploaded: true,
          deleted: true,
        }),
      ).resolves.toHaveLength(1)

      await expect(
        writeAttachment(user, { expiresAfter: '1 microsecond' }),
      ).resolves.toHaveLength(1)
      await expect(
        writeAttachment(user, { expiresAfter: '0 seconds' }),
      ).rejects.toThrow(/attachments_upload_expires_after_created/)
      await expect(
        writeAttachment(user, { expiresAfter: '-1 second' }),
      ).rejects.toThrow(/attachments_upload_expires_after_created/)
    })

    it('should hold an attachment to a salon and to a user there are, and keep both while it names them', async () => {
      await run()
      const user = await storeNewUser()
      const salonId = await storeSalon(null)

      await expect(
        writeAttachment(user, { salonId: randomUUID() }),
      ).rejects.toThrow(/attachments_salon_id_fk/)
      await expect(writeAttachment(randomUUID())).rejects.toThrow(
        /attachments_uploaded_by_fk/,
      )
      const [written] = await writeAttachment(user, { salonId })

      await expect(
        sql`DELETE FROM salons WHERE id = ${salonId}`,
      ).rejects.toThrow(/attachments_salon_id_fk/)
      await expect(sql`DELETE FROM users WHERE id = ${user}`).rejects.toThrow(
        /attachments_uploaded_by_fk/,
      )

      await sql`DELETE FROM attachments WHERE id = ${written?.id ?? null}`
      await expect(
        sql`DELETE FROM salons WHERE id = ${salonId}`,
      ).resolves.toBeDefined()
      await expect(
        sql`DELETE FROM users WHERE id = ${user}`,
      ).resolves.toBeDefined()
    })

    it('should index the uploaded attachments that are not deleted by their order in a list, and what a purge looks at by the end of its URL', async () => {
      await run()

      const indexes = await sql<{ indexname: string; indexdef: string }[]>`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'attachments'
        ORDER BY indexname
      `

      expect(indexes.map(({ indexname }) => indexname)).toEqual([
        'attachments_pkey',
        'idx_attachments_purge',
        'idx_attachments_salon_uploaded',
        'idx_attachments_uploaded',
      ])
      const definitionOf = (name: string): string =>
        indexes.find(({ indexname }) => indexname === name)?.indexdef ?? ''
      expect(definitionOf('idx_attachments_salon_uploaded')).toMatch(
        /\("salonId", "uploadedAt", id\) WHERE \(\(status = 'uploaded'::attachment_status\) AND \("deletedAt" IS NULL\)\)$/,
      )
      expect(definitionOf('idx_attachments_uploaded')).toMatch(
        /\("uploadedAt", id\) WHERE \(\(status = 'uploaded'::attachment_status\) AND \("deletedAt" IS NULL\)\)$/,
      )
      expect(definitionOf('idx_attachments_purge')).toMatch(
        /\("uploadExpiresAt"\) WHERE \(\(status = 'pending'::attachment_status\) OR \("deletedAt" IS NOT NULL\)\)$/,
      )
    })
  })

  describe('202611182200_share_links.sql', () => {
    const run = (): Promise<void> =>
      runMigration('202611182200_share_links.sql')

    /** The schema of setup.sql, which the migration brings a database to. */
    let schemaOfSetup: string[] = []

    // A database from before the migration: no share link is recorded.
    beforeEach(async () => {
      await applyBaseline(sql, plan)
      schemaOfSetup = await describeSchema()
      await sql.unsafe('DROP TABLE share_links;')
    })

    /** An uploaded attachment of the platform that the user announced; returns its ID. */
    const storeAttachment = async (by: string): Promise<string> => {
      const [attachment] = await sql<{ id: string }[]>`
        INSERT INTO attachments (
          filename, "contentType", size, status, "uploadedBy",
          "uploadExpiresAt", "uploadedAt", "createdAt"
        )
        VALUES (
          'before.png', 'image/png', 64, 'uploaded', ${by},
          '2026-11-18T01:15:00Z', '2026-11-18T01:05:00Z',
          '2026-11-18T01:00:00Z'
        )
        RETURNING id
      `
      if (attachment === undefined) {
        throw new Error('No attachment was stored')
      }
      return attachment.id
    }

    /**
     * A link to the attachment that the user created at
     * 2026-11-18T02:00:00Z, which works for a day unless another span is
     * given, with what else is given.
     */
    const writeLink = (
      attachmentId: string,
      by: string,
      more: {
        tokenHash?: string
        endsAfter?: string
        maxDownloads?: number
        downloadCount?: number
        failedAttempts?: number
      } = {},
    ) => sql<{ id: string }[]>`
      INSERT INTO share_links (
        "attachmentId", "tokenHash", "expiresAt", "maxDownloads",
        "downloadCount", "failedAttempts", "createdBy", "createdAt"
      )
      VALUES (
        ${attachmentId}, ${more.tokenHash ?? randomUUID()},
        '2026-11-18T02:00:00Z'::timestamptz
          + ${more.endsAfter ?? '1 day'}::interval,
        ${more.maxDownloads ?? null}, ${more.downloadCount ?? 0},
        ${more.failedAttempts ?? 0}, ${by}, '2026-11-18T02:00:00Z'
      )
      RETURNING id
    `

    it('should give the database the schema of setup.sql, and keep it on a second run', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()
      await run()

      expect(await describeSchema()).toEqual(schemaOfSetup)
    })

    it('should keep the share links there are on a second run', async () => {
      await run()
      const user = await storeNewUser()
      const [written] = await writeLink(await storeAttachment(user), user)

      await run()

      expect(await sql<{ id: string }[]>`SELECT id FROM share_links`).toEqual([
        written,
      ])
    })

    it('should write a link with an ID of its own, without a password, a limit, a download or a wrong password', async () => {
      await run()
      const user = await storeNewUser()
      const attachmentId = await storeAttachment(user)

      await sql`
        INSERT INTO share_links (
          "attachmentId", "tokenHash", "expiresAt", "createdBy"
        )
        VALUES (
          ${attachmentId}, 'hash-of-a-token', now() + interval '1 hour',
          ${user}
        )
      `

      const stored = await sql<Record<string, unknown>[]>`
        SELECT
          id::text ~ '^[0-9a-f-]{36}$' AS "hasId", "attachmentId",
          "tokenHash", "passwordHash", "maxDownloads", "downloadCount",
          "failedAttempts", "lockedUntil", "createdBy",
          "createdAt" = "updatedAt" AS "writtenAtOnce"
        FROM share_links
      `
      expect(stored).toEqual([
        {
          hasId: true,
          attachmentId,
          tokenHash: 'hash-of-a-token',
          passwordHash: null,
          maxDownloads: null,
          downloadCount: 0,
          failedAttempts: 0,
          lockedUntil: null,
          createdBy: user,
          writtenAtOnce: true,
        },
      ])
    })

    it('should hold the end of a link to after it was created, and to 720 hours from then at most', async () => {
      await run()
      const user = await storeNewUser()
      const attachmentId = await storeAttachment(user)
      const write = (endsAfter: string) =>
        writeLink(attachmentId, user, { endsAfter })

      await expect(write('1 microsecond')).resolves.toHaveLength(1)
      await expect(write('720 hours')).resolves.toHaveLength(1)
      await expect(write('0 seconds')).rejects.toThrow(
        /share_links_expires_within_limit/,
      )
      await expect(write('-1 second')).rejects.toThrow(
        /share_links_expires_within_limit/,
      )
      await expect(write('720 hours 1 microsecond')).rejects.toThrow(
        /share_links_expires_within_limit/,
      )
      await expect(write('31 days')).rejects.toThrow(
        /share_links_expires_within_limit/,
      )
    })

    it('should hold the downloads of a link to its limit, the limit to one download at least, and the wrong passwords to none at least', async () => {
      await run()
      const user = await storeNewUser()
      const attachmentId = await storeAttachment(user)
      const write = (more: Parameters<typeof writeLink>[2]) =>
        writeLink(attachmentId, user, more)

      await expect(write({ maxDownloads: 1 })).resolves.toHaveLength(1)
      await expect(write({ maxDownloads: 0 })).rejects.toThrow(
        /share_links_max_downloads_positive/,
      )

      await expect(
        write({ maxDownloads: 2, downloadCount: 2 }),
      ).resolves.toHaveLength(1)
      await expect(
        write({ maxDownloads: 2, downloadCount: 3 }),
      ).rejects.toThrow(/share_links_download_count_within_limit/)
      await expect(write({ downloadCount: -1 })).rejects.toThrow(
        /share_links_download_count_within_limit/,
      )
      // A link without a limit counts on.
      await expect(write({ downloadCount: 1000 })).resolves.toHaveLength(1)

      await expect(write({ failedAttempts: 5 })).resolves.toHaveLength(1)
      await expect(write({ failedAttempts: -1 })).rejects.toThrow(
        /share_links_failed_attempts_not_negative/,
      )
    })

    it('should refuse a link the hash of whose token another link has', async () => {
      await run()
      const user = await storeNewUser()
      const first = await storeAttachment(user)
      const second = await storeAttachment(user)
      await writeLink(first, user, { tokenHash: 'one-hash' })

      await expect(
        writeLink(second, user, { tokenHash: 'one-hash' }),
      ).rejects.toThrow(/share_links_token_hash_unique/)
      await expect(
        writeLink(first, user, { tokenHash: 'another-hash' }),
      ).resolves.toHaveLength(1)
    })

    it('should hold a link to an attachment and to a user there are, and keep the user while it names them', async () => {
      await run()
      const uploader = await storeNewUser()
      const creator = await storeNewUser()
      const attachmentId = await storeAttachment(uploader)

      await expect(writeLink(randomUUID(), creator)).rejects.toThrow(
        /share_links_attachment_id_fk/,
      )
      await expect(writeLink(attachmentId, randomUUID())).rejects.toThrow(
        /share_links_created_by_fk/,
      )
      const [written] = await writeLink(attachmentId, creator)

      await expect(
        sql`DELETE FROM users WHERE id = ${creator}`,
      ).rejects.toThrow(/share_links_created_by_fk/)

      await sql`DELETE FROM share_links WHERE id = ${written?.id ?? null}`
      await expect(
        sql`DELETE FROM users WHERE id = ${creator}`,
      ).resolves.toBeDefined()
    })

    it('should remove the links of an attachment with the attachment, and leave those of the others', async () => {
      await run()
      const user = await storeNewUser()
      const removed = await storeAttachment(user)
      const kept = await storeAttachment(user)
      await writeLink(removed, user)
      await writeLink(removed, user)
      const [left] = await writeLink(kept, user)

      await sql`DELETE FROM attachments WHERE id = ${removed}`

      expect(await sql<{ id: string }[]>`SELECT id FROM share_links`).toEqual([
        left,
      ])
    })

    it('should index the links of an attachment by the order they are listed in, and a link by the hash of its token', async () => {
      await run()

      const indexes = await sql<{ indexname: string; indexdef: string }[]>`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'share_links'
        ORDER BY indexname
      `

      expect(indexes.map(({ indexname }) => indexname)).toEqual([
        'idx_share_links_attachment_created',
        'share_links_pkey',
        'share_links_token_hash_unique',
      ])
      const definitionOf = (name: string): string =>
        indexes.find(({ indexname }) => indexname === name)?.indexdef ?? ''
      expect(definitionOf('idx_share_links_attachment_created')).toMatch(
        /\("attachmentId", "createdAt", id\)$/,
      )
      expect(definitionOf('share_links_token_hash_unique')).toMatch(
        /^CREATE UNIQUE INDEX .* \("tokenHash"\)$/,
      )
    })
  })
})
