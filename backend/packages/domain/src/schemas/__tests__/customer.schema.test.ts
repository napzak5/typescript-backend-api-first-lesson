import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../__tests__/fixtures/auth-fixtures'
import {
  customerCreateRequest,
  OTHER_CUSTOMER_ID,
  REFERRER_ID,
} from '../../__tests__/fixtures/customer-fixtures'
import {
  brokenRules,
  MADE_UP_HEADLINE,
} from '../../__tests__/fixtures/fixtures'
import { parseWith } from '../../shared'
import {
  customerCreateRequestSchema,
  customerSearchRequestSchema,
  customerUpdateRequestSchema,
} from '../customer.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, MADE_UP_HEADLINE)
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** The properties of a request that may be null. */
const NULLABLE_PROPERTIES = [
  'firstNameKana',
  'lastNameKana',
  'alternativePhone',
  'postalCode',
  'prefecture',
  'city',
  'address',
  'building',
  'birthDate',
  'gender',
  'occupation',
  'preferences',
  'notes',
  'internalNotes',
  'referredBy',
  'referralCode',
  'hairType',
  'hairThickness',
  'scalpCondition',
]

/** The properties of a request that are never null, and the rule null breaks. */
const notNullable: [string, string][] = [
  ['firstName', 'firstName:invalid_type'],
  ['lastName', 'lastName:invalid_type'],
  ['email', 'email:invalid_type'],
  ['phoneNumber', 'phoneNumber:invalid_type'],
  ['membershipTier', 'membershipTier:invalid_value'],
  ['tags', 'tags:invalid_type'],
  ['allowMarketing', 'allowMarketing:invalid_type'],
  ['allowSms', 'allowSms:invalid_type'],
  ['allowEmail', 'allowEmail:invalid_type'],
  ['isActive', 'isActive:invalid_type'],
  ['customerStatus', 'customerStatus:invalid_value'],
]

/** The columns that the server manages, which no request may name. */
const MANAGED_PROPERTIES: [string, unknown][] = [
  ['id', CUSTOMER_ID],
  ['userId', OTHER_CUSTOMER_ID],
  ['loyaltyPoints', 100],
  ['lifetimeValue', 5000],
  ['firstVisitDate', '2026-01-10'],
  ['lastVisitDate', '2026-11-01'],
  ['visitCount', 3],
  ['noShowCount', 0],
  ['cancellationCount', 0],
  ['createdAt', '2026-11-14T09:00:00.000Z'],
  ['updatedAt', '2026-11-14T09:00:00.000Z'],
  ['deletedAt', null],
]

/** The texts that may be null, with the most characters each may have. */
const limitedTexts: [string, number][] = [
  ['firstNameKana', 100],
  ['lastNameKana', 100],
  ['postalCode', 10],
  ['prefecture', 50],
  ['city', 100],
  ['address', 255],
  ['building', 255],
  ['occupation', 100],
  ['referralCode', 50],
]

/** Values that a request may give, each kept as it is. */
const accepted: [string, Record<string, unknown>][] = [
  ['a first name of 100 characters', { firstName: 'a'.repeat(100) }],
  ['a last name of 100 characters', { lastName: 'a'.repeat(100) }],
  [
    'a first name of 100 characters outside the Basic Multilingual Plane',
    // 𠮷 (U+20BB7, as in 𠮷野) takes two units of UTF-16.
    { firstName: '𠮷'.repeat(100) },
  ],
  ['a name with spaces around it, untrimmed', { lastName: '  山田  ' }],
  ['an email of 255 characters', { email: `${'a'.repeat(243)}@example.com` }],
  ['a phone number of exactly 10 digits', { phoneNumber: '0312345678' }],
  [
    'a phone number with every separator',
    { phoneNumber: '+81 (90) 1234-5678' },
  ],
  ['a phone number of 20 characters', { phoneNumber: '090-1234-5678-901234' }],
  ['a second phone number', { alternativePhone: '+81 3 1234 5678' }],
  ['the earliest birth date a request may name', { birthDate: '1900-01-01' }],
  ['a birth date on a leap day', { birthDate: '2000-02-29' }],
  [
    'a birth date in the future, which is the rule of the use case',
    { birthDate: '2999-01-01' },
  ],
  [
    'no preferred services',
    { preferences: { preferredServices: [], notes: null } },
  ],
  [
    'every service category as a preference',
    {
      preferences: {
        preferredServices: [
          'cut',
          'color',
          'perm',
          'treatment',
          'spa',
          'styling',
          'extension',
          'other',
        ],
        notes: 'Anything goes',
      },
    },
  ],
  ['notes of 10,000 characters', { notes: 'a'.repeat(10_000) }],
  ['internal notes over several lines', { internalNotes: 'First\nSecond' }],
  ['no tags', { tags: [] }],
  ['tags that differ in case only', { tags: ['VIP', 'vip'] }],
  ['another customer as the referrer', { referredBy: OTHER_CUSTOMER_ID }],
  [
    'false for every flag',
    {
      allowMarketing: false,
      allowSms: false,
      allowEmail: false,
      isActive: false,
    },
  ],
  [
    'an inactive customer with the status active',
    { isActive: false, customerStatus: 'active' },
  ],
  [
    'an active customer with the status inactive',
    { isActive: true, customerStatus: 'inactive' },
  ],
  ...limitedTexts.map(([property, max]): [string, Record<string, unknown>] => [
    `${property} of ${max} characters`,
    { [property]: 'a'.repeat(max) },
  ]),
]

/**
 * What breaks the rule of a property, in a create request and, when the
 * property is present, in an update request.
 */
const violations: [string, Record<string, unknown>, string[]][] = [
  ['an empty first name', { firstName: '' }, ['firstName:invalid_format']],
  [
    'a first name of only spaces',
    { firstName: '   ' },
    ['firstName:invalid_format'],
  ],
  [
    'a last name of only full-width spaces',
    { lastName: '　　' },
    ['lastName:invalid_format'],
  ],
  [
    'a first name of 101 characters',
    { firstName: 'a'.repeat(101) },
    ['firstName:too_big'],
  ],
  [
    'a last name of 101 characters',
    { lastName: 'a'.repeat(101) },
    ['lastName:too_big'],
  ],
  [
    'a first name that is not text',
    { firstName: 42 },
    ['firstName:invalid_type'],
  ],
  ...limitedTexts.flatMap(
    ([property, max]): [string, Record<string, unknown>, string[]][] => [
      [
        `a blank ${property}`,
        { [property]: ' \t' },
        [`${property}:invalid_format`],
      ],
      [
        `an empty ${property}`,
        { [property]: '' },
        [`${property}:invalid_format`],
      ],
      [
        `${property} of ${max + 1} characters`,
        { [property]: 'a'.repeat(max + 1) },
        [`${property}:too_big`],
      ],
    ],
  ),
  ['an email that is not one', { email: 'hanako' }, ['email:invalid_format']],
  ['an email without a domain', { email: 'hanako@' }, ['email:invalid_format']],
  [
    'an email of 256 characters',
    { email: `${'a'.repeat(244)}@example.com` },
    ['email:too_big'],
  ],
  [
    'a phone number with letters and fewer than 10 digits',
    { phoneNumber: 'call-me-maybe' },
    ['phoneNumber:invalid_format', 'phoneNumber:custom'],
  ],
  [
    'a phone number with a letter and 10 digits',
    { phoneNumber: '090-1234-567x8' },
    ['phoneNumber:invalid_format'],
  ],
  [
    'a phone number of fewer than 10 digits',
    { phoneNumber: '03-1234-567' },
    ['phoneNumber:custom'],
  ],
  [
    'a phone number of 21 characters',
    { phoneNumber: '090-1234-5678-9012345' },
    ['phoneNumber:too_big'],
  ],
  [
    'a phone number that is a number',
    { phoneNumber: 9012345678 },
    ['phoneNumber:invalid_type'],
  ],
  [
    'a second phone number with letters',
    { alternativePhone: 'call-me-maybe' },
    ['alternativePhone:invalid_format', 'alternativePhone:custom'],
  ],
  [
    'a second phone number of fewer than 10 digits',
    { alternativePhone: '03-1234' },
    ['alternativePhone:custom'],
  ],
  [
    'a second phone number of 21 characters',
    { alternativePhone: '090-1234-5678-9012345' },
    ['alternativePhone:too_big'],
  ],
  [
    'a birth date that is not a date',
    { birthDate: 'April 1st' },
    ['birthDate:invalid_format'],
  ],
  [
    'a day that does not exist',
    { birthDate: '2023-02-30' },
    ['birthDate:invalid_format'],
  ],
  [
    'a leap day of a year without one',
    { birthDate: '2023-02-29' },
    ['birthDate:invalid_format'],
  ],
  [
    'a birth date without leading zeros',
    { birthDate: '1990-4-1' },
    ['birthDate:invalid_format'],
  ],
  [
    'a birth date with a time',
    { birthDate: '1990-04-01T00:00:00Z' },
    ['birthDate:invalid_format'],
  ],
  [
    'a birth date before 1900, the first day a request may name',
    { birthDate: '1899-12-31' },
    ['birthDate:too_small'],
  ],
  [
    'a birth date of the year 0, which PostgreSQL does not hold',
    { birthDate: '0000-01-01' },
    ['birthDate:too_small'],
  ],
  [
    'a birth date after 2999, the last year a request may name',
    { birthDate: '3000-01-01' },
    ['birthDate:too_big'],
  ],
  [
    'a gender that is not one of the four',
    { gender: 'unknown' },
    ['gender:invalid_value'],
  ],
  ['a gender in capitals', { gender: 'FEMALE' }, ['gender:invalid_value']],
  [
    'a membership tier that does not exist',
    { membershipTier: 'diamond' },
    ['membershipTier:invalid_value'],
  ],
  [
    'a status that does not exist',
    { customerStatus: 'deleted' },
    ['customerStatus:invalid_value'],
  ],
  [
    'preferences without their properties',
    { preferences: {} },
    [
      'preferences.preferredServices:invalid_type',
      'preferences.notes:invalid_type',
    ],
  ],
  [
    'preferences without notes',
    { preferences: { preferredServices: ['cut'] } },
    ['preferences.notes:invalid_type'],
  ],
  [
    'a preferred service that is no service category',
    { preferences: { preferredServices: ['cut', 'nails'], notes: null } },
    ['preferences.preferredServices.1:invalid_value'],
  ],
  [
    'a preferred service named twice',
    {
      preferences: {
        preferredServices: ['cut', 'color', 'cut'],
        notes: null,
      },
    },
    ['preferences.preferredServices.2:custom'],
  ],
  [
    'a property of the preferences that does not exist',
    { preferences: { preferredServices: [], notes: null, colour: 'red' } },
    ['preferences.colour:unrecognized_keys'],
  ],
  [
    'blank notes among the preferences',
    { preferences: { preferredServices: [], notes: ' ' } },
    ['preferences.notes:invalid_format'],
  ],
  [
    'preferences that are a list',
    { preferences: ['cut'] },
    ['preferences:invalid_type'],
  ],
  [
    'preferences that are text',
    { preferences: 'cut' },
    ['preferences:invalid_type'],
  ],
  ['empty notes', { notes: '' }, ['notes:invalid_format']],
  ['notes of only a line break', { notes: '\n' }, ['notes:invalid_format']],
  [
    'blank internal notes',
    { internalNotes: '  ' },
    ['internalNotes:invalid_format'],
  ],
  ['tags that are text', { tags: 'vip' }, ['tags:invalid_type']],
  ['a blank tag', { tags: ['vip', ' '] }, ['tags.1:invalid_format']],
  ['an empty tag', { tags: [''] }, ['tags.0:invalid_format']],
  ['a tag named twice', { tags: ['vip', 'color', 'vip'] }, ['tags.2:custom']],
  [
    'a referrer that is not a UUID',
    { referredBy: 'abc' },
    ['referredBy:invalid_format'],
  ],
  [
    'a referrer that is a UUID with a character too many',
    { referredBy: `${REFERRER_ID}0` },
    ['referredBy:invalid_format'],
  ],
  [
    'allowMarketing as text',
    { allowMarketing: 'true' },
    ['allowMarketing:invalid_type'],
  ],
  ['allowSms as a number', { allowSms: 1 }, ['allowSms:invalid_type']],
  ['allowEmail as text', { allowEmail: 'no' }, ['allowEmail:invalid_type']],
  ['isActive as a number', { isActive: 0 }, ['isActive:invalid_type']],
  [
    'a hair type that does not exist',
    { hairType: 'frizzy' },
    ['hairType:invalid_value'],
  ],
  [
    'a hair thickness that does not exist',
    { hairThickness: 'very thick' },
    ['hairThickness:invalid_value'],
  ],
  [
    'a scalp condition that does not exist',
    { scalpCondition: 'itchy' },
    ['scalpCondition:invalid_value'],
  ],
]

/** Every value of every property of an enumerated type. */
const enumeratedValues: [string, string][] = [
  ...['male', 'female', 'other', 'prefer_not_to_say'].map(
    (value): [string, string] => ['gender', value],
  ),
  ...['regular', 'silver', 'gold', 'platinum', 'vip'].map(
    (value): [string, string] => ['membershipTier', value],
  ),
  ...['active', 'inactive', 'vip', 'blacklisted'].map(
    (value): [string, string] => ['customerStatus', value],
  ),
  ...['straight', 'wavy', 'curly', 'coily'].map((value): [string, string] => [
    'hairType',
    value,
  ]),
  ...['thin', 'medium', 'thick'].map((value): [string, string] => [
    'hairThickness',
    value,
  ]),
  ...['normal', 'dry', 'oily', 'sensitive', 'dandruff'].map(
    (value): [string, string] => ['scalpCondition', value],
  ),
]

describe('customerCreateRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = customerCreateRequest()

    const result = parseWith(
      customerCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('accepts null for the 19 properties that may be unset and keeps it', () => {
    const request = {
      ...customerCreateRequest(),
      ...Object.fromEntries(
        NULLABLE_PROPERTIES.map((property) => [property, null]),
      ),
    }

    const result = parseWith(
      customerCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('returns the email in lower case', () => {
    const result = parseWith(
      customerCreateRequestSchema,
      { ...customerCreateRequest(), email: 'Hanako.Yamada@Example.COM' },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: { ...customerCreateRequest(), email: 'hanako.yamada@example.com' },
    })
  })

  it('reads a referrer written in upper case as the lower-case ID, the one the database returns', () => {
    const result = parseWith(
      customerCreateRequestSchema,
      { ...customerCreateRequest(), referredBy: REFERRER_ID.toUpperCase() },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: { ...customerCreateRequest(), referredBy: REFERRER_ID },
    })
  })

  it.each(enumeratedValues)('accepts %s %s', (property, value) => {
    const rules = rulesBrokenBy(customerCreateRequestSchema, {
      ...customerCreateRequest(),
      [property]: value,
    })

    expect(rules).toEqual([])
  })

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    const request = { ...customerCreateRequest(), ...change }

    const result = parseWith(
      customerCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each(violations)('rejects %s', (_case, change, expected) => {
    const rules = rulesBrokenBy(customerCreateRequestSchema, {
      ...customerCreateRequest(),
      ...change,
    })

    expect(rules).toEqual(expected)
  })

  it.each(notNullable)('rejects null for %s', (property, expected) => {
    const rules = rulesBrokenBy(customerCreateRequestSchema, {
      ...customerCreateRequest(),
      [property]: null,
    })

    expect(rules).toEqual([expected])
  })

  it.each(MANAGED_PROPERTIES)(
    'rejects %s, which the server manages, as a property the request does not have',
    (property, value) => {
      const rules = rulesBrokenBy(customerCreateRequestSchema, {
        ...customerCreateRequest(),
        [property]: value,
      })

      expect(rules).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it('rejects a property that does not exist', () => {
    const rules = rulesBrokenBy(customerCreateRequestSchema, {
      ...customerCreateRequest(),
      salonId: OTHER_CUSTOMER_ID,
    })

    expect(rules).toEqual(['salonId:unrecognized_keys'])
  })

  it.each(Object.keys(customerCreateRequest()))(
    'rejects a request that leaves %s out',
    (property) => {
      const request: Record<string, unknown> = customerCreateRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(request).filter(([name]) => name !== property),
      )

      const rules = rulesBrokenBy(customerCreateRequestSchema, withoutProperty)

      expect(rules.map((rule) => rule.replace(/:.*$/, ''))).toEqual([property])
    },
  )

  it.each([
    ['firstName', 'firstName:invalid_type'],
    ['tags', 'tags:invalid_type'],
    ['preferences', 'preferences:invalid_type'],
    ['isActive', 'isActive:invalid_type'],
  ])(
    'rejects a request that leaves %s out as a broken rule of its type',
    (property, expected) => {
      const request: Record<string, unknown> = customerCreateRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(request).filter(([name]) => name !== property),
      )

      expect(
        rulesBrokenBy(customerCreateRequestSchema, withoutProperty),
      ).toEqual([expected])
    },
  )

  it('has 30 properties, every one of them required', () => {
    const rules = rulesBrokenBy(customerCreateRequestSchema, {})

    expect(rules.map((rule) => rule.replace(/:.*$/, '')).toSorted()).toEqual(
      Object.keys(customerCreateRequest()).toSorted(),
    )
    expect(rules).toHaveLength(30)
  })

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(customerCreateRequestSchema, {
      ...customerCreateRequest(),
      firstName: ' ',
      email: 'hanako',
      phoneNumber: '03-1234',
      gender: 'unknown',
      tags: ['vip', 'vip'],
      preferences: { preferredServices: ['nails'], notes: null },
      loyaltyPoints: 100,
    })

    expect(rules.toSorted()).toEqual([
      'email:invalid_format',
      'firstName:invalid_format',
      'gender:invalid_value',
      'loyaltyPoints:unrecognized_keys',
      'phoneNumber:custom',
      'preferences.preferredServices.0:invalid_value',
      'tags.1:custom',
    ])
  })

  it.each([
    ['text', 'firstName=Hanako'],
    ['a list', [customerCreateRequest()]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(customerCreateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('customerUpdateRequestSchema', () => {
  it.each(Object.entries(customerCreateRequest()))(
    'accepts a request with %s alone',
    (property, value) => {
      const request = { [property]: value }

      const result = parseWith(
        customerUpdateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it('accepts every property together and returns the request unchanged', () => {
    const request = customerCreateRequest()

    const result = parseWith(
      customerUpdateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('returns the email in lower case and the referrer as the lower-case ID', () => {
    const result = parseWith(
      customerUpdateRequestSchema,
      {
        email: 'Hanako.Yamada@Example.COM',
        referredBy: REFERRER_ID.toUpperCase(),
      },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: { email: 'hanako.yamada@example.com', referredBy: REFERRER_ID },
    })
  })

  it.each(NULLABLE_PROPERTIES)(
    'accepts null for %s, which unsets it',
    (property) => {
      const request = { [property]: null }

      const result = parseWith(
        customerUpdateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it.each(notNullable)(
    'rejects null for %s, which is never unset',
    (property, expected) => {
      const rules = rulesBrokenBy(customerUpdateRequestSchema, {
        [property]: null,
      })

      expect(rules).toEqual([expected])
    },
  )

  it.each(accepted)('accepts %s', (_case, change) => {
    const result = parseWith(
      customerUpdateRequestSchema,
      change,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: change })
  })

  it('accepts an empty list of tags, which removes every tag', () => {
    expect(
      parseWith(customerUpdateRequestSchema, { tags: [] }, MADE_UP_HEADLINE),
    ).toEqual({ type: 'success', data: { tags: [] } })
  })

  it.each(violations)(
    'rejects %s, as a create request does',
    (_case, change, expected) => {
      expect(rulesBrokenBy(customerUpdateRequestSchema, change)).toEqual(
        expected,
      )
    },
  )

  it.each(MANAGED_PROPERTIES)(
    'rejects %s, which the server manages and a request never changes',
    (property, value) => {
      const rules = rulesBrokenBy(customerUpdateRequestSchema, {
        firstName: 'Renamed',
        [property]: value,
      })

      expect(rules).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it('rejects an empty request with one error for the request as a whole', () => {
    expect(rulesBrokenBy(customerUpdateRequestSchema, {})).toEqual([':custom'])
  })

  it('reports an unknown property as such, not as an empty request', () => {
    const rules = rulesBrokenBy(customerUpdateRequestSchema, {
      deletedAt: '2026-11-14T09:00:00.000Z',
    })

    expect(rules).toEqual(['deletedAt:unrecognized_keys'])
  })

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(customerUpdateRequestSchema, {
      lastName: '',
      birthDate: '2023-02-30',
      tags: null,
      customerStatus: null,
      visitCount: 3,
    })

    expect(rules.toSorted()).toEqual([
      'birthDate:invalid_format',
      'customerStatus:invalid_value',
      'lastName:invalid_format',
      'tags:invalid_type',
      'visitCount:unrecognized_keys',
    ])
  })

  it.each([
    ['text', 'firstName=Hanako'],
    ['a list', [{ firstName: 'Renamed' }]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(customerUpdateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('customerSearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    expect(
      parseWith(customerSearchRequestSchema, {}, MADE_UP_HEADLINE),
    ).toEqual({
      type: 'success',
      data: {},
    })
  })

  it.each([
    ['the smallest limit', { limit: 1 }],
    ['the largest limit', { limit: 100 }],
    ['a cursor', { cursor: CUSTOMER_ID }],
    ['a keyword', { search: '山田' }],
    ['a keyword of 100 characters', { search: 'a'.repeat(100) }],
    ['a keyword with spaces around it, untrimmed', { search: ' 090 ' }],
    ['one tag', { tags: ['vip'] }],
    ['several tags', { tags: ['vip', 'color'] }],
    ['a start of the registration', { registeredFrom: '2026-11-01T00:00:00Z' }],
    [
      'an end of the registration with milliseconds',
      { registeredTo: '2026-11-14T09:00:00.123Z' },
    ],
    [
      'the same instant as start and end',
      {
        registeredFrom: '2026-11-14T09:00:00.123Z',
        registeredTo: '2026-11-14T09:00:00.123Z',
      },
    ],
    [
      'the same instant as start and end, written with and without a fraction',
      {
        registeredFrom: '2026-11-14T00:00:00.000Z',
        registeredTo: '2026-11-14T00:00:00Z',
      },
    ],
    [
      'an end half a second after the start, written with a fraction',
      {
        registeredFrom: '2026-11-14T00:00:00Z',
        registeredTo: '2026-11-14T00:00:00.500Z',
      },
    ],
    ['a status', { customerStatus: 'blacklisted' }],
    ['a membership tier', { membershipTier: 'platinum' }],
    [
      'every parameter together',
      {
        limit: 50,
        cursor: CUSTOMER_ID,
        search: 'hanako',
        tags: ['vip'],
        registeredFrom: '2026-11-01T00:00:00Z',
        registeredTo: '2026-11-30T23:59:59.999Z',
        customerStatus: 'vip',
        membershipTier: 'gold',
      },
    ],
  ])('accepts %s and returns the request unchanged', (_case, request) => {
    expect(
      parseWith(customerSearchRequestSchema, request, MADE_UP_HEADLINE),
    ).toEqual({
      type: 'success',
      data: request,
    })
  })

  it('reads a cursor written in upper case as the lower-case ID, the one the database returns', () => {
    expect(
      parseWith(
        customerSearchRequestSchema,
        { cursor: CUSTOMER_ID.toUpperCase() },
        MADE_UP_HEADLINE,
      ),
    ).toEqual({ type: 'success', data: { cursor: CUSTOMER_ID } })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a negative limit', { limit: -1 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a fractional limit', { limit: 1.5 }, ['limit:invalid_type']],
    ['a limit that is still text', { limit: '10' }, ['limit:invalid_type']],
    [
      'a cursor that is not an ID',
      { cursor: 'offset:20' },
      ['cursor:invalid_format'],
    ],
    ['an empty cursor', { cursor: '' }, ['cursor:invalid_format']],
    ['an empty keyword', { search: '' }, ['search:invalid_format']],
    [
      'a keyword of only whitespace',
      { search: ' \t' },
      ['search:invalid_format'],
    ],
    [
      'a keyword of 101 characters',
      { search: 'a'.repeat(101) },
      ['search:too_big'],
    ],
    ['a blank tag', { tags: ['vip', ' '] }, ['tags.1:invalid_format']],
    ['an empty tag', { tags: [''] }, ['tags.0:invalid_format']],
    ['tags that are still text', { tags: 'vip' }, ['tags:invalid_type']],
    [
      'a start of the registration that is a date only',
      { registeredFrom: '2026-11-01' },
      ['registeredFrom:invalid_format'],
    ],
    [
      'an end of the registration that is a date only',
      { registeredTo: '2026-11-30' },
      ['registeredTo:invalid_format'],
    ],
    [
      'a start of the registration in Japanese time',
      { registeredFrom: '2026-11-01T00:00:00+09:00' },
      ['registeredFrom:invalid_format'],
    ],
    [
      'an end of the registration without a time zone',
      { registeredTo: '2026-11-30T00:00:00' },
      ['registeredTo:invalid_format'],
    ],
    [
      'a start after the end',
      {
        registeredFrom: '2026-11-30T00:00:00Z',
        registeredTo: '2026-11-01T00:00:00Z',
      },
      ['registeredTo:custom'],
    ],
    [
      'a start half a second after the end, written with a fraction',
      {
        registeredFrom: '2026-11-14T00:00:00.500Z',
        registeredTo: '2026-11-14T00:00:00Z',
      },
      ['registeredTo:custom'],
    ],
    [
      'a status that does not exist',
      { customerStatus: 'deleted' },
      ['customerStatus:invalid_value'],
    ],
    [
      'a membership tier that does not exist',
      { membershipTier: 'diamond' },
      ['membershipTier:invalid_value'],
    ],
    [
      'a parameter that does not exist',
      { page: 2 },
      ['page:unrecognized_keys'],
    ],
    [
      'filters that the list does not have',
      { gender: 'female', isActive: true },
      ['gender:unrecognized_keys', 'isActive:unrecognized_keys'],
    ],
    [
      'several broken rules',
      { limit: 1000, search: ' ', sort: 'name' },
      ['limit:too_big', 'search:invalid_format', 'sort:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(customerSearchRequestSchema, input)).toEqual(expected)
  })

  it('should say that an end before the start is earlier than registeredFrom', () => {
    // Arrange
    const search = {
      registeredFrom: '2026-11-30T00:00:00Z',
      registeredTo: '2026-11-01T00:00:00Z',
    }

    // Act
    const result = parseWith(
      customerSearchRequestSchema,
      search,
      MADE_UP_HEADLINE,
    )

    // Assert
    expect(result).toMatchObject({
      type: 'error',
      error: {
        issues: [{ message: ruleMessages.notEarlierThan('registeredFrom') }],
      },
    })
  })
})
