import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import postgres from 'postgres'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  applyBaseline,
  dropHistory,
  type MigrationFile,
  migrate,
  readBaseline,
  readMigrationFiles,
} from '../migrations'

const sqlDirectory = path.resolve(import.meta.dirname, '../../../sql')

let container: StartedPostgreSqlContainer | undefined
/** Connection to the instance, to create and drop the databases of the tests. */
let admin: postgres.Sql
let instanceUrl = ''

/** The database of the running test: empty when the test starts. */
let databaseName = ''
let sql: postgres.Sql

const connect = (): postgres.Sql => {
  const url = new URL(instanceUrl)
  url.pathname = `/${databaseName}`
  return postgres(url.toString(), { max: 2, onnotice: () => undefined })
}

beforeAll(async () => {
  const { TEST_DATABASE_URL: externalUrl } = process.env

  if (!externalUrl) {
    container = await new PostgreSqlContainer('postgres:18-alpine')
      .withStartupTimeout(120000)
      .start()
  }

  instanceUrl = container?.getConnectionUri() ?? externalUrl ?? ''
  admin = postgres(instanceUrl, { max: 1 })
})

afterAll(async () => {
  await admin.end()
  await container?.stop()
})

beforeEach(async () => {
  databaseName = `migrations_test_${randomUUID().replaceAll('-', '')}`
  await admin.unsafe(`CREATE DATABASE ${databaseName}`)
  sql = connect()
})

afterEach(async () => {
  await sql.end()
  await admin.unsafe(`DROP DATABASE ${databaseName} WITH (FORCE)`)
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
    const other = connect()
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
    const other = connect()
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

    it('should give the database the rules and the indexes of setup.sql', async () => {
      expect(await describeSchema()).not.toEqual(schemaOfSetup)

      await run()

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
})
