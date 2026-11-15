import { describe, expect, it } from 'vitest'
import {
  type ApiProperty,
  type ColumnInfo,
  compareModel,
  describeFinding,
  type ModelKind,
  type ModelRule,
  modelProperties,
} from '../api-consistency'
import { modelRules } from '../api-consistency-rules'

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

/** As `enumFindings`, by a rule that says `status` has some of the values. */
const narrowedFindings = (apiProperties: Map<string, ApiProperty>): string[] =>
  compareModel(
    rule({ narrowed: ['status'] }),
    columnsWithEnum,
    apiProperties,
  ).map(({ kind, property }) => `${kind}:${property}`)

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

  it('requires an embedded property of an update model to be optional, and looks for no column behind it', () => {
    const embedded = rule({ kind: 'update', embedded: ['options'] })

    expect(
      kindsOf(embedded, properties({ options: { required: false } })),
    ).toEqual([])
    expect(
      kindsOf(embedded, properties({ options: { required: true } })),
    ).toEqual(['shouldBeOptional:options'])
  })

  it('does not look for a column behind a computed property', () => {
    const findings = kindsOf(
      rule({ computed: ['current'], omittedColumns: ['deletedAt'] }),
      properties({
        id: {},
        name: {},
        description: { nullable: true },
        current: {},
      }),
    )

    expect(findings).toEqual([])
  })

  it('does not hold a computed property to a column on null either way', () => {
    const computed = rule({ computed: ['current'] })

    expect(
      kindsOf(computed, properties({ current: { nullable: true } })),
    ).toEqual([])
    expect(
      kindsOf(computed, properties({ current: { nullable: false } })),
    ).toEqual([])
  })

  it.each<ModelKind>(['response', 'create'])(
    'still requires a computed property of a %s model',
    (kind) => {
      const findings = kindsOf(
        rule({ kind, computed: ['current'] }),
        properties({ current: { required: false } }),
      )

      expect(findings).toEqual(['shouldBeRequired:current'])
    },
  )

  it('still requires a computed property of an update model to be optional', () => {
    const computed = rule({ kind: 'update', computed: ['current'] })

    expect(
      kindsOf(computed, properties({ current: { required: true } })),
    ).toEqual(['shouldBeOptional:current'])
    expect(
      kindsOf(computed, properties({ current: { required: false } })),
    ).toEqual([])
  })

  it('still reports a property without a column that is neither computed nor embedded', () => {
    const findings = kindsOf(
      rule({ computed: ['current'], embedded: ['openingHours'] }),
      properties({ current: {}, openingHours: {}, website: {} }),
    )

    expect(findings).toEqual(['unknownProperty:website'])
  })

  it('reports columns that are neither exposed nor omitted, once omissions are declared', () => {
    const exposed = properties({ id: {}, name: {} })

    expect(kindsOf(rule(), exposed)).toEqual([])
    expect(kindsOf(rule({ omittedColumns: ['deletedAt'] }), exposed)).toEqual([
      'missingColumn:description',
    ])
  })

  it('reports an omitted column that the table does not have', () => {
    const exposed = properties({
      id: {},
      name: {},
      description: { nullable: true },
    })

    expect(
      kindsOf(rule({ omittedColumns: ['deletedAt', 'removedAt'] }), exposed),
    ).toEqual(['omittedUnknownColumn:removedAt'])
  })

  it('reports nothing about omitted columns when the rule omits none', () => {
    const exposed = properties({
      id: {},
      name: {},
      description: { nullable: true },
    })

    expect(kindsOf(rule({ omittedColumns: [] }), exposed)).toEqual([
      'missingColumn:deletedAt',
    ])
    expect(kindsOf(rule(), exposed)).toEqual([])
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

  it('accepts a narrowed property with some of the values of the enum of its column', () => {
    const findings = narrowedFindings(
      properties({ status: { enumValues: ['closed'] } }),
    )

    expect(findings).toEqual([])
  })

  it.each([
    ['is not an enum', null],
    ['has no value', []],
    ['has every value', ['closed', 'open']],
    ['has a value the database does not know', ['open', 'paused']],
    ['has only values the database does not know', ['paused']],
  ])(
    'reports a narrowed property of an enum column that %s',
    (_case, enumValues) => {
      expect(narrowedFindings(properties({ status: { enumValues } }))).toEqual([
        'enumNotNarrowed:status',
      ])
    },
  )

  it('narrows only the properties the rule lists', () => {
    const findings = compareModel(
      rule({ narrowed: ['name'] }),
      columnsWithEnum,
      properties({ name: {}, status: { enumValues: ['closed'] } }),
    ).map(({ kind, property }) => `${kind}:${property}`)

    expect(findings).toEqual(['enumMismatch:status'])
  })

  it('orders findings by kind and property so that the report is stable', () => {
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

  it('tells that an omitted column is not a column of the table', () => {
    expect(
      describeFinding({
        model: 'Models.CustomerPreferencesResponse',
        property: 'preferredServices',
        kind: 'omittedUnknownColumn',
      }),
    ).toBe(
      'Models.CustomerPreferencesResponse.preferredServices is left out by the rule of the model, and the table has no such column',
    )
  })

  it('tells a narrowed property what it may have of the enum type', () => {
    expect(
      describeFinding({
        model: 'Models.StaffAccountResponse',
        property: 'role',
        kind: 'enumNotNarrowed',
      }),
    ).toBe(
      'Models.StaffAccountResponse.role must have some of the values of the enum type of its column, and not all of them',
    )
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

describe('modelRules', () => {
  it('lists the omitted columns of every model, so that no column is left out by oversight', () => {
    const withoutOmittedColumns = modelRules
      .filter((modelRule) => modelRule.omittedColumns === undefined)
      .map((modelRule) => modelRule.model)

    expect(withoutOmittedColumns).toEqual([])
  })

  it('names every model once', () => {
    const models = modelRules.map((modelRule) => modelRule.model)

    expect(models).toEqual([...new Set(models)])
  })

  it('declares only that a session is the current one as worked out rather than stored', () => {
    const computed = modelRules
      .filter((modelRule) => modelRule.computed !== undefined)
      .map(({ model, computed }) => [model, computed])

    expect(computed).toEqual([['Models.SessionResponse', ['current']]])
  })

  it('lets a request for a service category leave out what the database assigns and the salon, which the path names, and the response nothing', () => {
    const omitted = Object.fromEntries(
      modelRules
        .filter((modelRule) => modelRule.table === 'serviceCategories')
        .map(({ model, kind, omittedColumns }) => [
          model,
          { kind, omittedColumns },
        ]),
    )

    expect(omitted).toEqual({
      'Models.ServiceCategoryResponse': {
        kind: 'response',
        omittedColumns: [],
      },
      'Models.ServiceCategoryCreateRequest': {
        kind: 'create',
        omittedColumns: ['id', 'salonId', 'createdAt', 'updatedAt'],
      },
      'Models.ServiceCategoryUpdateRequest': {
        kind: 'update',
        omittedColumns: ['id', 'salonId', 'createdAt', 'updatedAt'],
      },
    })
  })

  it("lets a request for a customer leave out the columns the server manages, and the response only deletedAt; a profile leaves out what is the staff's as well", () => {
    const managed = [
      'id',
      'userId',
      'loyaltyPoints',
      'lifetimeValue',
      'firstVisitDate',
      'lastVisitDate',
      'visitCount',
      'noShowCount',
      'cancellationCount',
      'deletedAt',
      'createdAt',
      'updatedAt',
    ]
    /** What the customer's own profile does not show. */
    const keptByTheStaff = [
      'notes',
      'internalNotes',
      'tags',
      'referredBy',
      'isActive',
      'customerStatus',
      'lifetimeValue',
      'noShowCount',
      'cancellationCount',
    ]
    /** What the customer's own profile does not write, besides the managed columns. */
    const notTheCustomers = [
      'email',
      'membershipTier',
      'notes',
      'internalNotes',
      'tags',
      'referredBy',
      'referralCode',
      'isActive',
      'hairType',
      'hairThickness',
      'scalpCondition',
      'customerStatus',
    ]

    const rules = Object.fromEntries(
      modelRules
        .filter((modelRule) => modelRule.table === 'customers')
        .map(({ model, kind, omittedColumns, embedded, computed }) => [
          model,
          { kind, omittedColumns, embedded, computed },
        ]),
    )

    expect(rules).toEqual({
      'Models.CustomerResponse': {
        kind: 'response',
        omittedColumns: ['deletedAt'],
        embedded: undefined,
        computed: undefined,
      },
      'Models.CustomerCreateRequest': {
        kind: 'create',
        omittedColumns: managed,
        embedded: undefined,
        computed: undefined,
      },
      'Models.CustomerUpdateRequest': {
        kind: 'update',
        omittedColumns: managed,
        embedded: undefined,
        computed: undefined,
      },
      'Models.CustomerProfileResponse': {
        kind: 'response',
        omittedColumns: [...keptByTheStaff, 'userId', 'deletedAt'],
        embedded: undefined,
        computed: undefined,
      },
      'Models.CustomerProfileCreateRequest': {
        kind: 'create',
        omittedColumns: [...managed, ...notTheCustomers],
        embedded: undefined,
        computed: undefined,
      },
      'Models.CustomerProfileUpdateRequest': {
        kind: 'update',
        omittedColumns: [...managed, ...notTheCustomers],
        embedded: undefined,
        computed: undefined,
      },
    })
  })

  it('shows the preferences of a customer without the row that holds them, and lets a request change every one of them', () => {
    const theRow = ['id', 'customerId', 'createdAt', 'updatedAt']

    const rules = Object.fromEntries(
      modelRules
        .filter((modelRule) => modelRule.table === 'customerPreferences')
        .map(
          ({ model, kind, omittedColumns, embedded, computed, narrowed }) => [
            model,
            { kind, omittedColumns, embedded, computed, narrowed },
          ],
        ),
    )

    expect(rules).toEqual({
      'Models.CustomerPreferencesResponse': {
        kind: 'response',
        omittedColumns: theRow,
        embedded: undefined,
        computed: undefined,
        narrowed: undefined,
      },
      'Models.CustomerPreferencesUpdateRequest': {
        kind: 'update',
        omittedColumns: theRow,
        embedded: undefined,
        computed: undefined,
        narrowed: undefined,
      },
    })
  })

  it('lets a request for a staff member leave out what the server assigns, the salon, which the path names, the login account and the awards; the response leaves out the awards and deletedAt, the profile everything customers are not shown, and none embeds anything', () => {
    const managed = [
      'id',
      'salonId',
      'userId',
      'awards',
      'deletedAt',
      'createdAt',
      'updatedAt',
    ]

    const hidden = [
      'userId',
      'firstName',
      'lastName',
      'firstNameKana',
      'lastNameKana',
      'email',
      'phoneNumber',
      'alternativePhone',
      'staffCode',
      'awards',
      'hireDate',
      'employmentType',
      'baseSalary',
      'commissionRate',
      'maxConcurrentBookings',
      'bufferTimeBefore',
      'bufferTimeAfter',
      'isActive',
      'deletedAt',
      'createdAt',
      'updatedAt',
    ]

    const rules = Object.fromEntries(
      modelRules
        .filter((modelRule) => modelRule.table === 'staff')
        .map(({ model, kind, omittedColumns, embedded, computed }) => [
          model,
          { kind, omittedColumns, embedded, computed },
        ]),
    )

    expect(rules).toEqual({
      'Models.StaffResponse': {
        kind: 'response',
        omittedColumns: ['awards', 'deletedAt'],
        embedded: undefined,
        computed: undefined,
      },
      'Models.StaffCreateRequest': {
        kind: 'create',
        omittedColumns: managed,
        embedded: undefined,
        computed: undefined,
      },
      'Models.StaffUpdateRequest': {
        kind: 'update',
        omittedColumns: managed,
        embedded: undefined,
        computed: undefined,
      },
      'Models.StaffProfileResponse': {
        kind: 'response',
        omittedColumns: hidden,
        embedded: undefined,
        computed: undefined,
      },
      // The five properties that describe the staff member are the ones
      // left: specialties, bio, imageUrl, yearsOfExperience, certifications.
      'Models.StaffProfileUpdateRequest': {
        kind: 'update',
        omittedColumns: [
          'id',
          'salonId',
          'displayName',
          'level',
          'position',
          'canReceiveBookings',
          ...hidden,
        ],
        embedded: undefined,
        computed: undefined,
      },
    })
  })

  it('checks an entry of a staff schedule, which requests and responses share, as a response: every property is required, and it leaves out the ID of the row, the staff member, whom the path names, and the timestamps', () => {
    const rules = modelRules
      .filter((modelRule) => modelRule.table === 'staffSchedules')
      .map(({ model, kind, omittedColumns, embedded, computed }) => ({
        model,
        kind,
        omittedColumns,
        embedded,
        computed,
      }))

    expect(rules).toEqual([
      {
        model: 'Models.StaffSchedule',
        kind: 'response',
        omittedColumns: ['id', 'staffId', 'createdAt', 'updatedAt'],
        embedded: undefined,
        computed: undefined,
      },
    ])
  })

  it('shows an invitation of a staff member without the hash of its token, and lets the request that creates one state the role only', () => {
    const rules = modelRules
      .filter((modelRule) => modelRule.table === 'staffInvitations')
      .map(({ model, kind, omittedColumns, embedded, computed }) => ({
        model,
        kind,
        omittedColumns,
        embedded,
        computed,
      }))

    expect(rules).toEqual([
      {
        model: 'Models.StaffInvitationResponse',
        kind: 'response',
        omittedColumns: ['tokenHash'],
        embedded: undefined,
        computed: undefined,
      },
      {
        model: 'Models.StaffInvitationCreateRequest',
        kind: 'create',
        omittedColumns: [
          'id',
          'staffId',
          'email',
          'tokenHash',
          'expiresAt',
          'createdAt',
        ],
        embedded: undefined,
        computed: undefined,
      },
    ])
  })

  it('shows the salon who signs in as a staff member, with which role and whether the account is in use, lets a request change the role only, and narrows the role in both to the roles of a salon', () => {
    const hidden = [
      'passwordHash',
      'permissions',
      'emailVerified',
      'emailVerificationTokenHash',
      'emailVerificationExpiry',
      'passwordResetTokenHash',
      'passwordResetExpiry',
      'lastPasswordChange',
      'twoFactorSecret',
      'backupCodes',
      'twoFactorLastUsedStep',
      'failedLoginAttempts',
      'lockedUntil',
      'lastLoginIp',
      'customerId',
      'staffId',
      'metadata',
      'deletedAt',
    ]
    const rules = modelRules
      .filter((modelRule) => modelRule.model.startsWith('Models.StaffAccount'))
      .map(({ model, table, kind, omittedColumns, embedded, computed }) => ({
        model,
        table,
        kind,
        omittedColumns,
        embedded,
        computed,
      }))

    expect(rules).toEqual([
      {
        model: 'Models.StaffAccountResponse',
        table: 'users',
        kind: 'response',
        omittedColumns: hidden,
        embedded: undefined,
        computed: undefined,
      },
      {
        model: 'Models.StaffAccountUpdateRequest',
        table: 'users',
        kind: 'update',
        omittedColumns: [
          'id',
          'email',
          'status',
          'twoFactorStatus',
          'lastLoginAt',
          'createdAt',
          'updatedAt',
          ...hidden,
        ],
        embedded: undefined,
        computed: undefined,
      },
    ])
  })

  it('narrows nothing but the role of the account of a staff member', () => {
    const narrowed = modelRules
      .filter((modelRule) => modelRule.narrowed !== undefined)
      .map(({ model, narrowed }) => [model, narrowed])

    expect(narrowed).toEqual([
      ['Models.StaffAccountResponse', ['role']],
      ['Models.StaffAccountUpdateRequest', ['role']],
    ])
  })
})
