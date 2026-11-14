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
    const columnsBefore = await columnsOf('salons')
    await dropHistory(sql)

    const outcome = await migrate(sql, plan)

    expect(outcome).toEqual({
      type: 'migrated',
      applied: plan.migrations.map(({ name }) => name),
    })
    expect(await columnsOf('salons')).toEqual(columnsBefore)
  })
})
