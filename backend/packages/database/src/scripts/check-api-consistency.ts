#!/usr/bin/env tsx

/**
 * Checks that the API models agree with the database tables behind them:
 * same property names, same nullability, and the optionality that the kind
 * of model calls for.
 *
 *   pnpm check:api-db                       fail on any difference that is not in the baseline
 *   pnpm check:api-db --update-baseline     record the current differences as the baseline
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getTableColumns, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { parse } from 'yaml'
import { z } from 'zod'
import * as schema from '../schema'
import {
  type ColumnInfo,
  compareModel,
  compareWithBaseline,
  describeFinding,
  type Finding,
  modelProperties,
  type OpenApiSchema,
  toBaseline,
} from './api-consistency'
import { modelRules } from './api-consistency-rules'

const packageDir = resolve(import.meta.dirname, '../..')
const openApiPath = resolve(
  packageDir,
  '../../../specs/tsp-output/@typespec/openapi3/generated/openapi.yaml',
)
const baselinePath = resolve(packageDir, 'api-consistency-baseline.json')

const openApiSchema: z.ZodType<OpenApiSchema> = z.looseObject({
  $ref: z.string().optional(),
  nullable: z.boolean().optional(),
  required: z.array(z.string()).optional(),
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

const baselineSchema = z.record(z.string(), z.array(z.string()))

const tableColumns = new Map<string, ReadonlyMap<string, ColumnInfo>>(
  Object.entries(schema).flatMap(([exportName, value]) =>
    is(value, PgTable)
      ? [
          [
            exportName,
            new Map(
              Object.entries(getTableColumns(value)).map(([name, column]) => [
                name,
                { notNull: column.notNull },
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
const baseline = baselineSchema.safeParse(
  JSON.parse(readFileSync(baselinePath, 'utf8')),
)

const check = (
  schemas: Readonly<Record<string, OpenApiSchema>>,
  accepted: Readonly<Record<string, readonly string[]>>,
): void => {
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

  if (process.argv.includes('--update-baseline')) {
    writeFileSync(
      baselinePath,
      `${JSON.stringify(toBaseline(findings), null, 2)}\n`,
    )
    console.log(
      `Recorded ${findings.length} differences in ${modelRules.length} models as the baseline.`,
    )
    return
  }

  const { unexpected, resolved } = compareWithBaseline(findings, accepted)

  if (unexpected.length > 0) {
    console.error('API models that disagree with the database:')
    for (const finding of unexpected) {
      console.error(`  - ${describeFinding(finding)}`)
    }
    console.error(
      '\nThe database is the source of truth: fix the TypeSpec model, or change the\ntable with a migration, then run `pnpm generate`.',
    )
  }
  if (resolved.length > 0) {
    console.error('Baseline entries that no longer occur:')
    for (const { model, entry } of resolved) {
      console.error(`  - ${model}: ${entry}`)
    }
    console.error(
      '\nRemove them with `pnpm check:api-db --update-baseline` so that they cannot come back.',
    )
  }
  if (unexpected.length > 0 || resolved.length > 0) {
    process.exitCode = 1
    return
  }

  console.log(
    `${modelRules.length} API models agree with the database (${findings.length} known differences in the baseline).`,
  )
}

if (!document.success) {
  console.error(`Cannot read ${openApiPath}: ${document.error.message}`)
  process.exitCode = 1
} else if (!baseline.success) {
  console.error(`Cannot read ${baselinePath}: ${baseline.error.message}`)
  process.exitCode = 1
} else {
  check(document.data.components.schemas, baseline.data)
}
