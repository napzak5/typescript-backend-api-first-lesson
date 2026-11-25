import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runDatabaseCommand } from '../../__tests__/_shared/commands'
import { useTemporaryFolders } from '../../__tests__/_shared/folders'
import { useTestDatabases } from '../../__tests__/_shared/test-databases'
import { PACKAGE_PATHS } from '../../command'
import { readMigrationFiles } from '../../migrations'

const databases = useTestDatabases()
const folderOf = useTemporaryFolders()

/** Runs a command on the database of the test, as a test environment does. */
const run = (...argv: string[]) =>
  runDatabaseCommand(argv, {
    NODE_ENV: 'test',
    DATABASE_URL: databases.url(),
  })

/** Runs a command on the database of the test, with the SQL of the folder. */
const runWithSql = (sql: string, ...argv: string[]) =>
  runDatabaseCommand(
    argv,
    { NODE_ENV: 'test', DATABASE_URL: databases.url() },
    { sql },
  )

/** What the database of the test answers to a query of one value. */
const answerTo = async (query: string): Promise<unknown> => {
  const sql = databases.connect()
  const [row] = await sql.unsafe(query)
  await sql.end()
  return row?.['value']
}

const tableCount = (): Promise<unknown> =>
  answerTo(
    "SELECT count(*)::integer AS value FROM pg_tables WHERE schemaname = 'public'",
  )

const recordedCount = (): Promise<unknown> =>
  answerTo(
    'SELECT count(*)::integer AS value FROM migration_history.applied_migrations',
  )

/** The migrations of the repository, which setup.sql contains. */
const MIGRATIONS = readMigrationFiles(join(PACKAGE_PATHS.sql, 'migrations'))

/** The SQL of a schema small enough to read, and its first migration. */
const SMALL_SQL = {
  'setup.sql':
    'CREATE TABLE salons (id serial PRIMARY KEY, name text NOT NULL);',
  'migrations/202601010900_add_phone.sql':
    'ALTER TABLE salons ADD COLUMN phone text;',
}

describe('pnpm db:migrate', () => {
  it('should create an empty database from setup.sql and record every migration as applied', async () => {
    // Act
    const migrated = await run('migrate')

    // Assert
    expect(migrated).toMatchObject({ status: 0, stderr: '' })
    expect(migrated.stdout).toContain(
      `📝 Found ${MIGRATIONS.length} SQL migration files`,
    )
    expect(migrated.stdout).toContain(
      '🆕 Empty database: created the schema from sql/setup.sql',
    )
    expect(migrated.stdout).toContain(
      `✅ Recorded ${MIGRATIONS.length} migrations as already applied`,
    )
    expect(await recordedCount()).toBe(MIGRATIONS.length)
  })

  it('should tell the database without its password', async () => {
    // Act
    const migrated = await run('migrate')

    // Assert
    const password = new URL(databases.url()).password
    expect(migrated.stdout).toContain(':***@')
    expect(migrated.stdout).not.toContain(`:${password}@`)
  })

  it('should apply nothing to a database that is up to date', async () => {
    // Arrange
    await run('migrate')

    // Act
    const migrated = await run('migrate')

    // Assert
    expect(migrated.status).toBe(0)
    expect(migrated.stdout).toContain(
      '✅ Database is up to date, nothing to apply',
    )
  })

  it('should apply the migrations that were written since, and tell what the database noted', async () => {
    // Arrange
    await runWithSql(folderOf(SMALL_SQL), 'migrate')
    const later = folderOf({
      ...SMALL_SQL,
      'migrations/202601020900_add_email.sql': `
        ALTER TABLE salons ADD COLUMN email text;
        DO $$ BEGIN RAISE NOTICE 'noted by the migration'; END $$;
      `,
    })

    // Act
    const migrated = await runWithSql(later, 'migrate')

    // Assert
    expect(migrated.status).toBe(0)
    expect(migrated.stdout).toContain('  ℹ️  noted by the migration')
    expect(migrated.stdout).toContain(
      '  ✅ Applied: 202601020900_add_email.sql',
    )
    expect(migrated.stdout).toContain('✅ Applied 1 migrations')
    expect(await recordedCount()).toBe(2)
  })

  it('should fail on a migration that fails, tell why, and keep the database as it was', async () => {
    // Arrange
    await runWithSql(folderOf(SMALL_SQL), 'migrate')
    const broken = folderOf({
      ...SMALL_SQL,
      'migrations/202601020900_broken.sql':
        'ALTER TABLE salons ADD COLUMN name text;',
    })

    // Act
    const migrated = await runWithSql(broken, 'migrate')

    // Assert
    expect(migrated.status).toBe(1)
    expect(migrated.stderr).toContain('❌ migrate failed: PostgresError')
    expect(migrated.stderr).toContain(
      'column "name" of relation "salons" already exists',
    )
    expect(await recordedCount()).toBe(1)
  })

  it('should execute one SQL file and record nothing', async () => {
    // Arrange
    await runWithSql(folderOf(SMALL_SQL), 'migrate')
    const file = join(
      folderOf({ 'tried.sql': 'CREATE TABLE tried (id integer);' }),
      'tried.sql',
    )

    // Act
    const executed = await run('migrate', file)

    // Assert
    expect(executed.status).toBe(0)
    expect(executed.stdout).toContain(`📄 Executing single SQL file: ${file}`)
    expect(executed.stdout).toContain(
      '✅ SQL file executed successfully (not recorded as applied)',
    )
    expect(await tableCount()).toBe(2)
    expect(await recordedCount()).toBe(1)
  })

  it('should refuse a SQL file that does not exist, and execute nothing', async () => {
    // Arrange
    const file = join(folderOf({}), 'missing.sql')

    // Act
    const executed = await run('migrate', file)

    // Assert
    expect(executed.status).toBe(1)
    expect(executed.stderr).toBe(`❌ SQL file not found: ${file}\n`)
    expect(await tableCount()).toBe(0)
  })
})

describe('pnpm db:setup', () => {
  it('should create the schema of an empty database and record every migration as applied', async () => {
    // Act
    const setUp = await run('setup')

    // Assert
    expect(setUp).toMatchObject({ status: 0, stderr: '' })
    expect(setUp.stdout).toContain(
      `📝 Recorded ${MIGRATIONS.length} migrations as already applied`,
    )
    expect(await recordedCount()).toBe(MIGRATIONS.length)
    expect(await tableCount()).toBeGreaterThan(30)
  })

  it('should refuse a database that has the schema, and change nothing', async () => {
    // Arrange
    await run('setup')
    const tables = await tableCount()

    // Act
    const setUp = await run('setup')

    // Assert
    expect(setUp.status).toBe(1)
    expect(setUp.stderr).toContain('❌ setup failed: PostgresError')
    expect(await tableCount()).toBe(tables)
  })
})

describe('pnpm db:reset', () => {
  it('should drop every table, type and the history, so that the database counts as empty', async () => {
    // Arrange
    await run('migrate')

    // Act
    const reset = await run('reset')

    // Assert
    expect(reset).toMatchObject({ status: 0, stderr: '' })
    expect(reset.stdout).toContain('  Dropping table: salons')
    expect(reset.stdout).toContain('  Dropping type: account_status')
    expect(await tableCount()).toBe(0)
    expect(
      await answerTo(
        "SELECT count(*)::integer AS value FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'",
      ),
    ).toBe(0)
    expect((await run('migrate')).stdout).toContain('🆕 Empty database')
  })
})

describe('pnpm db:truncate', () => {
  it('should delete every row and keep the schema', async () => {
    // Arrange
    await run('migrate')
    await run('seed')

    // Act
    const truncated = await run('truncate')

    // Assert
    expect(truncated.status).toBe(0)
    expect(truncated.stdout).toContain(
      '✅ Database truncation completed successfully!',
    )
    expect(
      await answerTo('SELECT count(*)::integer AS value FROM salons'),
    ).toBe(0)
    expect(await answerTo('SELECT count(*)::integer AS value FROM users')).toBe(
      0,
    )
    expect(await recordedCount()).toBe(MIGRATIONS.length)
  })
})

describe('pnpm db:seed', () => {
  const salonCount = (): Promise<unknown> =>
    answerTo('SELECT count(*)::integer AS value FROM salons')

  it('should insert the seed data into a database without data, and tell the rows of every table that has rows', async () => {
    // Arrange
    await run('migrate')

    // Act
    const seeded = await run('seed')

    // Assert
    expect(seeded.status).toBe(0)
    const salons = await salonCount()
    expect(salons).toBeGreaterThan(0)
    expect(seeded.stdout).toContain(
      `│ ${'salons'.padEnd(31)} │ ${String(salons).padStart(9)} │`,
    )
    expect(seeded.stdout).not.toContain('│ sessions ')
    expect(seeded.stdout).toMatch(/│ TOTAL {27}│ +\d+ │/)
    expect(seeded.stdout).toContain(
      '✅ Database population completed successfully!',
    )
  })

  it('should refuse a database that has data, and write nothing', async () => {
    // Arrange
    await run('migrate')
    await run('seed')
    const salons = await salonCount()

    // Act
    const seeded = await run('seed')

    // Assert
    expect(seeded.status).toBe(1)
    expect(seeded.stderr).toContain(
      '❌ The database already has data, and the seed would insert the same rows again. Nothing was written.',
    )
    expect(seeded.stderr).toContain('   pnpm db:seed --if-empty')
    expect(await salonCount()).toBe(salons)
  })

  it('should leave a database that has data as it is when asked to seed only an empty one', async () => {
    // Arrange
    await run('migrate')
    await run('seed')
    const salons = await salonCount()

    // Act
    const seeded = await run('seed', '--if-empty')

    // Assert
    expect(seeded.status).toBe(0)
    expect(seeded.stdout).toContain(
      '⏭️  The database already has data, nothing to seed',
    )
    expect(await salonCount()).toBe(salons)
  })

  it('should delete every row of a database that has data before it inserts the seed data again', async () => {
    // Arrange
    await run('migrate')
    await run('seed')
    const salons = await salonCount()

    // Act
    const seeded = await run('seed', '-r')

    // Assert
    expect(seeded.status).toBe(0)
    expect(seeded.stdout).toContain('🔄 Reset database: true')
    expect(await salonCount()).toBe(salons)
  })

  it('should refuse to run in production, and write nothing', async () => {
    // Arrange
    await run('migrate')

    // Act
    const seeded = await runDatabaseCommand(['seed'], {
      NODE_ENV: 'production',
      DATABASE_URL: databases.url(),
    })

    // Assert
    expect(seeded.status).toBe(1)
    expect(seeded.stderr).toBe(
      '❌ The seed creates accounts with a published password and does not run against production.\n',
    )
    expect(await salonCount()).toBe(0)
  })
})
