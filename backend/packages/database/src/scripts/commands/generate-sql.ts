import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Command } from '../command'
import { runProgram } from '../program'

const HEADER = `-- Generated setup.sql from Drizzle ORM schema
-- This file contains the complete database schema including:
-- - All enum types
-- - All tables with columns, constraints, and defaults
-- - All foreign key relationships
-- - All indexes
-- Source: backend/packages/database/src/schema.ts

`

/** `pnpm db:generate-sql`: generates `sql/setup.sql` from `schema.ts`. */
export const generateSqlCommand: Command = {
  name: 'generate-sql',
  help: `
Setup SQL Generation

Usage: pnpm db:generate-sql

Generates sql/setup.sql from src/schema.ts with drizzle-kit: every type,
table, constraint and index. Recreate the database from it with pnpm db:fresh.
`,
  run: async (context) => {
    context.say(
      `🏗️ Generating setup.sql from current schema in ${context.environment.toUpperCase()} environment...`,
    )
    context.say('📝 Running drizzle-kit export...')
    const schemaPath = path.join(context.paths.source, 'schema.ts')
    const exported = await runProgram(
      'pnpm',
      [
        'exec',
        'drizzle-kit',
        'export',
        '--dialect',
        'postgresql',
        '--schema',
        schemaPath,
        '--sql',
      ],
      { cwd: context.paths.package, env: context.env, input: '' },
    )
    context.stderr.write(exported.stderr)

    const statements = exported.stdout.trim()
    if (statements.length === 0) {
      context.complain(
        `❌ No SQL was generated from ${schemaPath}: it has no tables`,
      )
      return 1
    }

    const setupSqlPath = path.join(context.paths.sql, 'setup.sql')
    const setupSql = HEADER + statements
    fs.mkdirSync(context.paths.sql, { recursive: true })
    fs.writeFileSync(setupSqlPath, setupSql)

    context.say('✅ Successfully generated setup.sql!')
    context.say(`📄 Output written to: ${setupSqlPath}`)
    context.say(`📊 File size: ${setupSql.length} characters`)
    context.say('ℹ️  Recreate the database from this file with: pnpm db:fresh')
    return 0
  },
}
