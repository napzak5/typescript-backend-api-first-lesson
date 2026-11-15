#!/usr/bin/env tsx

/**
 * Checks that the API models agree with the database tables behind them:
 * same property names, same nullability, the same values for a column of an
 * enum type (or some of them, where a rule says so), and the optionality that
 * the kind of model calls for.
 *
 * Every model listed in `api-consistency-rules.ts` is compared; any difference
 * fails the check.
 *
 *   pnpm check:api-db
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getTableColumns, is } from 'drizzle-orm'
import { PgArray, type PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { parse } from 'yaml'
import { z } from 'zod'
import * as schema from '../schema'
import {
  type ColumnInfo,
  compareModel,
  describeFinding,
  type Finding,
  modelProperties,
  type OpenApiSchema,
} from './api-consistency'
import { modelRules } from './api-consistency-rules'

const packageDir = resolve(import.meta.dirname, '../..')
const openApiPath = resolve(
  packageDir,
  '../../../specs/tsp-output/@typespec/openapi3/generated/openapi.yaml',
)

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

const tableColumns = new Map<string, ReadonlyMap<string, ColumnInfo>>(
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

const document = openApiDocumentSchema.safeParse(
  parse(readFileSync(openApiPath, 'utf8')),
)

const check = (schemas: Readonly<Record<string, OpenApiSchema>>): void => {
  const unknownRules: string[] = []
  const findings: Finding[] = []
  for (const rule of modelRules) {
    const columns = tableColumns.get(rule.table)
    const properties = modelProperties(schemas, rule.model)
    if (columns === undefined) {
      unknownRules.push(`${rule.model}: no table "${rule.table}" in schema.ts`)
    } else if (properties === null) {
      unknownRules.push(`${rule.model}: no such model in the OpenAPI document`)
    } else {
      findings.push(...compareModel(rule, columns, properties))
    }
  }

  if (unknownRules.length > 0) {
    console.error('Rules in api-consistency-rules.ts that match nothing:')
    for (const unknownRule of unknownRules) {
      console.error(`  - ${unknownRule}`)
    }
    process.exitCode = 1
    return
  }

  if (findings.length > 0) {
    console.error('API models that disagree with the database:')
    for (const finding of findings) {
      console.error(`  - ${describeFinding(finding)}`)
    }
    console.error(
      '\nThe database is the source of truth: fix the TypeSpec model, or change the\ntable with a migration, then run `pnpm generate`.',
    )
    process.exitCode = 1
    return
  }

  console.log(`${modelRules.length} API models agree with the database.`)
}

if (!document.success) {
  console.error(`Cannot read ${openApiPath}: ${document.error.message}`)
  process.exitCode = 1
} else {
  check(document.data.components.schemas)
}
