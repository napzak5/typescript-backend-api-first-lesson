import { describe, expect, it } from 'vitest'
import {
  type ApiProperty,
  type ColumnInfo,
  compareModel,
  compareWithBaseline,
  describeFinding,
  type Finding,
  type ModelKind,
  type ModelRule,
  modelProperties,
  toBaseline,
} from '../api-consistency'

const columns = new Map<string, ColumnInfo>([
  ['id', { notNull: true, enumValues: null }],
  ['name', { notNull: true, enumValues: null }],
  ['description', { notNull: false, enumValues: null }],
  ['deletedAt', { notNull: false, enumValues: null }],
])

/** A table whose `status` is a column of an enum type. */
const columnsWithEnum = new Map<string, ColumnInfo>([
  ['name', { notNull: true, enumValues: null }],
  ['status', { notNull: true, enumValues: ['open', 'closed'] }],
])

const enumFindings = (apiProperties: Map<string, ApiProperty>): string[] =>
  compareModel(rule(), columnsWithEnum, apiProperties).map(
    ({ kind, property }) => `${kind}:${property}`,
  )

const properties = (
  entries: Record<string, Partial<ApiProperty>>,
): Map<string, ApiProperty> =>
  new Map(
    Object.entries(entries).map(([name, property]) => [
      name,
      { nullable: false, required: true, enumValues: null, ...property },
    ]),
  )

const rule = (overrides: Partial<ModelRule> = {}): ModelRule => ({
  model: 'Models.SalonResponse',
  table: 'salons',
  kind: 'response',
  ...overrides,
})

const kindsOf = (
  modelRule: ModelRule,
  apiProperties: Map<string, ApiProperty>,
): string[] =>
  compareModel(modelRule, columns, apiProperties).map(
    ({ kind, property }) => `${kind}:${property}`,
  )

describe('compareModel', () => {
  it('finds nothing when names, nullability and optionality agree', () => {
    const findings = kindsOf(
      rule({ omittedColumns: ['deletedAt'] }),
      properties({ id: {}, name: {}, description: { nullable: true } }),
    )

    expect(findings).toEqual([])
  })

  it('reports a property that has no column', () => {
    expect(kindsOf(rule(), properties({ website: {} }))).toEqual([
      'unknownProperty:website',
    ])
  })

  it('reports a nullable column that the API does not allow to be null', () => {
    expect(kindsOf(rule(), properties({ description: {} }))).toEqual([
      'shouldBeNullable:description',
    ])
  })

  it('reports a NOT NULL column that the API allows to be null', () => {
    expect(kindsOf(rule(), properties({ name: { nullable: true } }))).toEqual([
      'shouldNotBeNullable:name',
    ])
  })

  it.each<ModelKind>(['response', 'create'])(
    'requires every property of a %s model',
    (kind) => {
      const findings = kindsOf(
        rule({ kind }),
        properties({ name: { required: false } }),
      )

      expect(findings).toEqual(['shouldBeRequired:name'])
    },
  )

  it('requires every property of an update model to be optional, and still checks null', () => {
    const findings = kindsOf(
      rule({ kind: 'update' }),
      properties({
        name: { required: true },
        description: { required: false, nullable: true },
      }),
    )

    expect(findings).toEqual(['shouldBeOptional:name'])
  })

  it('does not look for a column behind an embedded property, but checks its optionality', () => {
    const embedded = rule({ embedded: ['openingHours'] })

    expect(kindsOf(embedded, properties({ openingHours: {} }))).toEqual([])
    expect(
      kindsOf(embedded, properties({ openingHours: { required: false } })),
    ).toEqual(['shouldBeRequired:openingHours'])
  })

  it('reports columns that are neither exposed nor omitted, once omissions are declared', () => {
    const exposed = properties({ id: {}, name: {} })

    expect(kindsOf(rule(), exposed)).toEqual([])
    expect(kindsOf(rule({ omittedColumns: ['deletedAt'] }), exposed)).toEqual([
      'missingColumn:description',
    ])
  })

  it('accepts a property with exactly the values of the enum of its column, in any order', () => {
    const findings = enumFindings(
      properties({ status: { enumValues: ['closed', 'open'] } }),
    )

    expect(findings).toEqual([])
  })

  it.each([
    ['is not an enum', null],
    ['lacks a value', ['open']],
    ['has a value the database does not know', ['open', 'closed', 'paused']],
  ])('reports a property of an enum column that %s', (_case, enumValues) => {
    expect(enumFindings(properties({ status: { enumValues } }))).toEqual([
      'enumMismatch:status',
    ])
  })

  it('lets the API limit a column that is not an enum', () => {
    const findings = enumFindings(
      properties({ name: { enumValues: ['Aoyama', 'Ginza'] } }),
    )

    expect(findings).toEqual([])
  })

  it('orders findings by kind and property so that the baseline is stable', () => {
    const findings = kindsOf(
      rule(),
      properties({ zebra: {}, description: {}, alpha: {} }),
    )

    expect(findings).toEqual([
      'shouldBeNullable:description',
      'unknownProperty:alpha',
      'unknownProperty:zebra',
    ])
  })
})

describe('describeFinding', () => {
  it('names the model, the property and what is expected', () => {
    expect(
      describeFinding({
        model: 'Models.SalonResponse',
        property: 'description',
        kind: 'shouldBeNullable',
      }),
    ).toBe(
      'Models.SalonResponse.description must allow null because the column does',
    )
  })
})

describe('baseline', () => {
  const findings: Finding[] = [
    { model: 'Models.Staff', property: 'bio', kind: 'shouldBeNullable' },
    { model: 'Models.Customer', property: 'tags', kind: 'unknownProperty' },
    { model: 'Models.Customer', property: 'age', kind: 'unknownProperty' },
  ]

  it('records findings by model, both in a stable order', () => {
    expect(JSON.stringify(toBaseline(findings))).toBe(
      JSON.stringify({
        'Models.Customer': ['unknownProperty:age', 'unknownProperty:tags'],
        'Models.Staff': ['shouldBeNullable:bio'],
      }),
    )
  })

  it('accepts exactly the findings it records', () => {
    expect(compareWithBaseline(findings, toBaseline(findings))).toEqual({
      unexpected: [],
      resolved: [],
    })
  })

  it('reports a finding that the baseline does not record', () => {
    const { unexpected, resolved } = compareWithBaseline(findings, {
      'Models.Customer': ['unknownProperty:age', 'unknownProperty:tags'],
    })

    expect(unexpected).toEqual([findings[0]])
    expect(resolved).toEqual([])
  })

  it('does not accept a finding because another model has the same one', () => {
    const { unexpected } = compareWithBaseline(
      [{ model: 'Models.Staff', property: 'age', kind: 'unknownProperty' }],
      { 'Models.Customer': ['unknownProperty:age'] },
    )

    expect(unexpected).toHaveLength(1)
  })

  it('reports a recorded finding that no longer occurs', () => {
    const { unexpected, resolved } = compareWithBaseline(findings.slice(1), {
      ...toBaseline(findings),
    })

    expect(unexpected).toEqual([])
    expect(resolved).toEqual([
      { model: 'Models.Staff', entry: 'shouldBeNullable:bio' },
    ])
  })
})

describe('modelProperties', () => {
  const schemas = {
    'Models.Audited': {
      required: ['createdAt'],
      properties: { createdAt: {}, deletedAt: { nullable: true } },
    },
    'Models.Salon': {
      allOf: [{ $ref: '#/components/schemas/Models.Audited' }],
      required: ['name', 'description'],
      properties: {
        name: {},
        description: { nullable: true },
        nickname: { nullable: true },
        owner: { allOf: [{ $ref: '#/components/schemas/Models.Audited' }] },
      },
    },
  }

  it('reads whether each property is required and whether it allows null', () => {
    expect(modelProperties(schemas, 'Models.Audited')).toEqual(
      new Map([
        ['createdAt', { nullable: false, required: true, enumValues: null }],
        ['deletedAt', { nullable: true, required: false, enumValues: null }],
      ]),
    )
  })

  it('includes the properties a model inherits through allOf', () => {
    const inherited = modelProperties(schemas, 'Models.Salon')

    expect([...(inherited?.keys() ?? [])].toSorted()).toEqual([
      'createdAt',
      'deletedAt',
      'description',
      'name',
      'nickname',
      'owner',
    ])
    expect(inherited?.get('createdAt')).toEqual({
      nullable: false,
      required: true,
      enumValues: null,
    })
    expect(inherited?.get('nickname')).toEqual({
      nullable: true,
      required: false,
      enumValues: null,
    })
  })

  it('reads the enum values of a property, however the document refers to them', () => {
    const withEnums = {
      'Models.DayOfWeekType': { enum: ['monday', 'tuesday'] },
      'Models.OpeningHours': {
        properties: {
          inline: { enum: ['open', 'closed'] },
          referenced: { $ref: '#/components/schemas/Models.DayOfWeekType' },
          nullable: {
            allOf: [{ $ref: '#/components/schemas/Models.DayOfWeekType' }],
            nullable: true,
          },
          list: {
            items: { $ref: '#/components/schemas/Models.DayOfWeekType' },
          },
          numeric: { enum: [1, 2] },
          text: {},
        },
      },
    }

    const enumValues = [
      ...(modelProperties(withEnums, 'Models.OpeningHours') ?? []),
    ].map(([name, property]) => [name, property.enumValues])

    expect(enumValues).toEqual([
      ['inline', ['open', 'closed']],
      ['referenced', ['monday', 'tuesday']],
      ['nullable', ['monday', 'tuesday']],
      ['list', ['monday', 'tuesday']],
      ['numeric', ['1', '2']],
      ['text', null],
    ])
  })

  it('returns null for a model the document does not define', () => {
    expect(modelProperties(schemas, 'Models.Unknown')).toBeNull()
  })
})
