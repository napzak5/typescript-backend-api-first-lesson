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
  ['id', { notNull: true }],
  ['name', { notNull: true }],
  ['description', { notNull: false }],
  ['deletedAt', { notNull: false }],
])

const properties = (
  entries: Record<string, Partial<ApiProperty>>,
): Map<string, ApiProperty> =>
  new Map(
    Object.entries(entries).map(([name, property]) => [
      name,
      { nullable: false, required: true, ...property },
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
        ['createdAt', { nullable: false, required: true }],
        ['deletedAt', { nullable: true, required: false }],
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
    })
    expect(inherited?.get('nickname')).toEqual({
      nullable: true,
      required: false,
    })
  })

  it('returns null for a model the document does not define', () => {
    expect(modelProperties(schemas, 'Models.Unknown')).toBeNull()
  })
})
