import { readFileSync } from 'node:fs'
import { getTableColumns, is } from 'drizzle-orm'
import { PgArray, type PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { parse } from 'yaml'
import { z } from 'zod'
import * as schema from '../../schema'
import {
  type ColumnInfo,
  checkModels,
  describeFinding,
  type OpenApiSchema,
} from '../api-consistency'
import { modelRules } from '../api-consistency-rules'
import type { Command } from '../command'

const openApiSchema: z.ZodType<OpenApiSchema> = z.looseObject({
  $ref: z.string().optional(),
  nullable: z.boolean().optional(),
  required: z.array(z.string()).optional(),
  enum: z.array(z.unknown()).optional(),
  get items() {
    return openApiSchema.optional()
  },
  get allOf() {
    return z.array(openApiSchema).optional()
  },
  get properties() {
    return z.record(z.string(), openApiSchema).optional()
  },
})

const openApiDocumentSchema = z.object({
  components: z.object({ schemas: z.record(z.string(), openApiSchema) }),
})

/** The values of the enum type of a column, or of its elements when it is a list. */
const enumValuesOf = (column: PgColumn): readonly string[] | null =>
  (is(column, PgArray) ? column.baseColumn.enumValues : column.enumValues) ??
  null

/** The columns of every table of the Drizzle schema, by the name it is exported under. */
const TABLES = new Map<string, ReadonlyMap<string, ColumnInfo>>(
  Object.entries(schema).flatMap(([exportName, value]) =>
    is(value, PgTable)
      ? [
          [
            exportName,
            new Map(
              Object.entries(getTableColumns(value)).map(([name, column]) => [
                name,
                { notNull: column.notNull, enumValues: enumValuesOf(column) },
              ]),
            ),
          ],
        ]
      : [],
  ),
)

/**
 * `pnpm check:api-db`: the API models agree with the database tables behind
 * them. Every model listed in `api-consistency-rules.ts` is compared; any
 * difference fails the check.
 */
export const checkApiConsistencyCommand: Command = {
  name: 'check-api-consistency',
  help: `
API and Database Consistency

Usage: pnpm check:api-db

Checks that the API models of the OpenAPI document agree with the database
tables behind them: the same property names, the same nullability, the same
values for a column of an enum type (or some of them, where a rule says so),
and the optionality that the kind of model calls for. Every model listed in
src/scripts/api-consistency-rules.ts is compared; any difference fails.
`,
  run: async (context) => {
    const document = openApiDocumentSchema.safeParse(
      parse(readFileSync(context.paths.openApi, 'utf8')),
    )
    if (!document.success) {
      context.complain(
        `Cannot read ${context.paths.openApi}: ${document.error.message}`,
      )
      return 1
    }

    const { unknownRules, findings } = checkModels(
      modelRules,
      TABLES,
      document.data.components.schemas,
    )
    if (unknownRules.length > 0) {
      context.complain('Rules in api-consistency-rules.ts that match nothing:')
      for (const unknownRule of unknownRules) {
        context.complain(`  - ${unknownRule}`)
      }
      return 1
    }
    if (findings.length > 0) {
      context.complain('API models that disagree with the database:')
      for (const finding of findings) {
        context.complain(`  - ${describeFinding(finding)}`)
      }
      context.complain(
        '\nThe database is the source of truth: fix the TypeSpec model, or change the\ntable with a migration, then run `pnpm generate`.',
      )
      return 1
    }

    context.say(`${modelRules.length} API models agree with the database.`)
    return 0
  },
}
