/**
 * Compares API models with the database tables they are backed by.
 *
 * The database is the source of truth, so for every API property that has a
 * column the two must agree on the name, on whether null is allowed and, for
 * a column of an enum type, on the values. The
 * functions here are pure; `check-api-consistency.ts` feeds them the Drizzle
 * schema and the generated OpenAPI document.
 */

/** What the comparison needs to know about a column. */
export type ColumnInfo = {
  notNull: boolean
  /** The values of the column's enum type; null when it is not an enum. */
  enumValues: readonly string[] | null
}

/** What the comparison needs to know about a property of an API model. */
export type ApiProperty = {
  nullable: boolean
  required: boolean
  /** The values the property is limited to; null when it is not an enum. */
  enumValues: readonly string[] | null
}

/**
 * How a model relates to its table:
 * - `response`: every property is required
 * - `create`: every property is required (nullable columns accept null)
 * - `update`: every property is optional
 */
export type ModelKind = 'response' | 'create' | 'update'

export type ModelRule = {
  /** OpenAPI schema name, e.g. `Models.SalonResponse` */
  model: string
  /** Export name of the table in the Drizzle schema, e.g. `salons` */
  table: string
  kind: ModelKind
  /**
   * API properties that are not columns of the table by design: rows of a
   * child table embedded in the model.
   */
  embedded?: readonly string[]
  /**
   * Columns the model leaves out on purpose. When given, any other column
   * missing from the model is reported, so that leaving one out is a decision
   * and not an oversight.
   */
  omittedColumns?: readonly string[]
}

type FindingKind =
  | 'unknownProperty'
  | 'missingColumn'
  | 'shouldBeRequired'
  | 'shouldBeOptional'
  | 'shouldBeNullable'
  | 'shouldNotBeNullable'
  | 'enumMismatch'

export type Finding = { model: string; property: string; kind: FindingKind }

const compareText = (left: string, right: string): number =>
  Number(left > right) - Number(left < right)

/** Text form of a finding, used to report findings in a stable order. */
const formatFinding = (finding: Finding): string =>
  `${finding.kind}:${finding.property}`

export const describeFinding = (finding: Finding): string => {
  const descriptions: Record<FindingKind, string> = {
    unknownProperty: 'has no column in the table',
    missingColumn: 'is a column that the model neither exposes nor omits',
    shouldBeRequired: 'must be required',
    shouldBeOptional: 'must be optional',
    shouldBeNullable: 'must allow null because the column does',
    shouldNotBeNullable: 'must not allow null because the column is NOT NULL',
    enumMismatch: 'must have exactly the values of the enum type of its column',
  }
  return `${finding.model}.${finding.property} ${descriptions[finding.kind]}`
}

/** Whether the property is limited to exactly the values of the enum type. */
const hasValuesOf = (
  enumValues: readonly string[],
  property: ApiProperty,
): boolean =>
  property.enumValues !== null &&
  new Set(enumValues).symmetricDifference(new Set(property.enumValues)).size ===
    0

export const compareModel = (
  rule: ModelRule,
  columns: ReadonlyMap<string, ColumnInfo>,
  properties: ReadonlyMap<string, ApiProperty>,
): Finding[] => {
  const embedded = new Set(rule.embedded ?? [])
  const findings: Finding[] = []
  const report = (property: string, kind: FindingKind): void => {
    findings.push({ model: rule.model, property, kind })
  }

  for (const [name, property] of properties) {
    if (rule.kind === 'update' && property.required) {
      report(name, 'shouldBeOptional')
    }
    if (rule.kind !== 'update' && !property.required) {
      report(name, 'shouldBeRequired')
    }
    if (embedded.has(name)) {
      continue
    }
    const column = columns.get(name)
    if (column === undefined) {
      report(name, 'unknownProperty')
      continue
    }
    if (column.notNull && property.nullable) {
      report(name, 'shouldNotBeNullable')
    }
    if (!column.notNull && !property.nullable) {
      report(name, 'shouldBeNullable')
    }
    if (
      column.enumValues !== null &&
      !hasValuesOf(column.enumValues, property)
    ) {
      report(name, 'enumMismatch')
    }
  }

  if (rule.omittedColumns !== undefined) {
    const omitted = new Set(rule.omittedColumns)
    for (const name of columns.keys()) {
      if (!properties.has(name) && !omitted.has(name)) {
        report(name, 'missingColumn')
      }
    }
  }

  return findings.toSorted((left, right) =>
    compareText(formatFinding(left), formatFinding(right)),
  )
}

/** The parts of an OpenAPI 3.0 schema object that the comparison reads. */
export type OpenApiSchema = {
  $ref?: string | undefined
  allOf?: OpenApiSchema[] | undefined
  properties?: Record<string, OpenApiSchema> | undefined
  required?: string[] | undefined
  nullable?: boolean | undefined
  enum?: unknown[] | undefined
  items?: OpenApiSchema | undefined
}

const SCHEMA_REF_PREFIX = '#/components/schemas/'

/**
 * Properties of a model, including those it inherits through `allOf`.
 * Returns null when the document has no schema of that name.
 */
export const modelProperties = (
  schemas: Readonly<Record<string, OpenApiSchema>>,
  model: string,
): ReadonlyMap<string, ApiProperty> | null => {
  const root = schemas[model]
  if (root === undefined) {
    return null
  }

  const referencedBy = (schema: OpenApiSchema): OpenApiSchema | undefined =>
    schema.$ref === undefined
      ? undefined
      : schemas[schema.$ref.replace(SCHEMA_REF_PREFIX, '')]

  /**
   * The enum values of a property: its own, those of the schema it refers to
   * (directly or through `allOf`, which is how a nullable reference is
   * written), or those of its items when it is a list.
   */
  const enumValuesOf = (schema: OpenApiSchema): readonly string[] | null =>
    schema.enum !== undefined
      ? schema.enum.map(String)
      : ([referencedBy(schema), schema.items, ...(schema.allOf ?? [])]
          .flatMap((part) => (part === undefined ? [] : [enumValuesOf(part)]))
          .find((values) => values !== null) ?? null)

  const found = new Map<
    string,
    { nullable: boolean; enumValues: readonly string[] | null }
  >()
  const required = new Set<string>()
  const visit = (schema: OpenApiSchema): void => {
    for (const part of [referencedBy(schema), ...(schema.allOf ?? [])]) {
      if (part !== undefined) {
        visit(part)
      }
    }
    for (const [name, property] of Object.entries(schema.properties ?? {})) {
      found.set(name, {
        nullable: property.nullable === true,
        enumValues: enumValuesOf(property),
      })
    }
    for (const name of schema.required ?? []) {
      required.add(name)
    }
  }
  visit(root)

  return new Map(
    [...found].map(([name, property]) => [
      name,
      { ...property, required: required.has(name) },
    ]),
  )
}
