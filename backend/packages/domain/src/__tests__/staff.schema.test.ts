import { describe, expect, it } from 'vitest'
import {
  staffCreateRequestSchema,
  staffSearchRequestSchema,
  staffUpdateRequestSchema,
} from '../schemas/staff.schema'
import { parseWith } from '../shared'
import { brokenRules, SALON_ID } from './fixtures'
import { STAFF_MEMBER_ID, staffCreateRequest } from './staff-fixtures'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** The properties of a request that may be null. */
const NULLABLE_PROPERTIES = [
  'firstNameKana',
  'lastNameKana',
  'alternativePhone',
  'staffCode',
  'position',
  'bio',
  'imageUrl',
  'yearsOfExperience',
  'hireDate',
  'employmentType',
  'baseSalary',
  'commissionRate',
]

/** The properties of a request that are never null, and the rule null breaks. */
const notNullable: [string, string][] = [
  ['firstName', 'firstName:invalid_type'],
  ['lastName', 'lastName:invalid_type'],
  ['displayName', 'displayName:invalid_type'],
  ['email', 'email:invalid_type'],
  ['phoneNumber', 'phoneNumber:invalid_type'],
  ['level', 'level:invalid_value'],
  ['specialties', 'specialties:invalid_type'],
  ['certifications', 'certifications:invalid_type'],
  ['canReceiveBookings', 'canReceiveBookings:invalid_type'],
  ['maxConcurrentBookings', 'maxConcurrentBookings:invalid_type'],
  ['bufferTimeBefore', 'bufferTimeBefore:invalid_type'],
  ['bufferTimeAfter', 'bufferTimeAfter:invalid_type'],
  ['isActive', 'isActive:invalid_type'],
]

/** The columns that a request does not write. */
const MANAGED_PROPERTIES: [string, unknown][] = [
  ['id', STAFF_MEMBER_ID],
  ['salonId', SALON_ID],
  ['userId', null],
  ['awards', []],
  ['schedules', []],
  ['createdAt', '2026-11-14T09:00:00.000Z'],
  ['updatedAt', '2026-11-14T09:00:00.000Z'],
  ['deletedAt', null],
]

/** Values that a request may give, each kept as it is. */
const accepted: [string, Record<string, unknown>][] = [
  ['a first name of 100 characters', { firstName: 'a'.repeat(100) }],
  ['a last name of 100 characters', { lastName: 'a'.repeat(100) }],
  ['a reading of 100 characters', { firstNameKana: 'ア'.repeat(100) }],
  ['a display name of 255 characters', { displayName: 'a'.repeat(255) }],
  ['a name with spaces around it, untrimmed', { lastName: '  山田  ' }],
  ['an email of 255 characters', { email: `${'a'.repeat(243)}@example.com` }],
  ['a phone number of exactly 10 digits', { phoneNumber: '0312345678' }],
  [
    'a phone number with every separator',
    { phoneNumber: '+81 (90) 1234-5678' },
  ],
  ['a second phone number', { alternativePhone: '+81 3 1234 5678' }],
  ['a staff code of 50 characters', { staffCode: 'S'.repeat(50) }],
  ['a position of 100 characters', { position: 'p'.repeat(100) }],
  ['no specialties', { specialties: [] }],
  ['specialties that differ in case only', { specialties: ['Cut', 'cut'] }],
  ['no certifications', { certifications: [] }],
  ['an image URL of 500 characters', { imageUrl: urlOfLength(500) }],
  ['an image URL over http', { imageUrl: 'http://aoyama.example.com/a.jpg' }],
  ['no experience', { yearsOfExperience: 0 }],
  ['100 years of experience', { yearsOfExperience: 100 }],
  ['a hire date on a leap day', { hireDate: '2024-02-29' }],
  ['a hire date in the future', { hireDate: '2999-01-01' }],
  ['an employment type of 50 characters', { employmentType: 'e'.repeat(50) }],
  ['no salary', { baseSalary: 0 }],
  ['the largest salary the column holds', { baseSalary: 2_147_483_647 }],
  ['a commission rate of 0', { commissionRate: 0 }],
  ['a commission rate of 100', { commissionRate: 100 }],
  ['a commission rate with two decimal places', { commissionRate: 12.34 }],
  ['a commission rate of 0.07', { commissionRate: 0.07 }],
  ['one booking at a time', { maxConcurrentBookings: 1 }],
  ['ten bookings at a time', { maxConcurrentBookings: 10 }],
  ['no buffer time', { bufferTimeBefore: 0, bufferTimeAfter: 0 }],
  ['buffer times of 120', { bufferTimeBefore: 120, bufferTimeAfter: 120 }],
  ['a staff member who takes no bookings', { canReceiveBookings: false }],
  ['an inactive staff member', { isActive: false }],
]

function urlOfLength(length: number): string {
  const start = 'https://aoyama.example.com/staff/'
  return `${start}${'a'.repeat(length - start.length)}`
}

/** Values that break a rule, with the rules they break. */
const violations: [string, Record<string, unknown>, string[]][] = [
  ['an empty first name', { firstName: '' }, ['firstName:invalid_format']],
  ['a blank first name', { firstName: ' \t' }, ['firstName:invalid_format']],
  [
    'a first name of 101 characters',
    { firstName: 'a'.repeat(101) },
    ['firstName:too_big'],
  ],
  ['a blank last name', { lastName: '　' }, ['lastName:invalid_format']],
  [
    'a last name of 101 characters',
    { lastName: 'a'.repeat(101) },
    ['lastName:too_big'],
  ],
  [
    'a blank reading of the first name',
    { firstNameKana: ' ' },
    ['firstNameKana:invalid_format'],
  ],
  [
    'a reading of the last name of 101 characters',
    { lastNameKana: 'ア'.repeat(101) },
    ['lastNameKana:too_big'],
  ],
  [
    'a blank display name',
    { displayName: ' ' },
    ['displayName:invalid_format'],
  ],
  [
    'a display name of 256 characters',
    { displayName: 'a'.repeat(256) },
    ['displayName:too_big'],
  ],
  ['an email without a domain', { email: 'hanako' }, ['email:invalid_format']],
  [
    'an email of 256 characters',
    { email: `${'a'.repeat(244)}@example.com` },
    ['email:too_big'],
  ],
  [
    'a phone number of 9 digits',
    { phoneNumber: '031234567' },
    ['phoneNumber:custom'],
  ],
  [
    'a phone number of 21 characters',
    { phoneNumber: '090-1234-5678-9012345' },
    ['phoneNumber:too_big'],
  ],
  [
    'a phone number with letters',
    { phoneNumber: '03-1234-5678 ext' },
    ['phoneNumber:invalid_format'],
  ],
  [
    'a second phone number of 9 digits',
    { alternativePhone: '031234567' },
    ['alternativePhone:custom'],
  ],
  ['a blank staff code', { staffCode: ' ' }, ['staffCode:invalid_format']],
  [
    'a staff code of 51 characters',
    { staffCode: 'S'.repeat(51) },
    ['staffCode:too_big'],
  ],
  ['a level that does not exist', { level: 'chief' }, ['level:invalid_value']],
  ['a level in upper case', { level: 'SENIOR' }, ['level:invalid_value']],
  ['a blank position', { position: ' ' }, ['position:invalid_format']],
  [
    'a position of 101 characters',
    { position: 'p'.repeat(101) },
    ['position:too_big'],
  ],
  [
    'specialties that are not a list',
    { specialties: 'cut' },
    ['specialties:invalid_type'],
  ],
  [
    'a blank specialty',
    { specialties: ['cut', ' '] },
    ['specialties.1:invalid_format'],
  ],
  [
    'a specialty that is not text',
    { specialties: [3] },
    ['specialties.0:invalid_type'],
  ],
  [
    'a specialty given twice',
    { specialties: ['cut', 'color', 'cut'] },
    ['specialties.2:custom'],
  ],
  [
    'a blank certification',
    { certifications: [''] },
    ['certifications.0:invalid_format'],
  ],
  [
    'a certification given twice',
    { certifications: ['美容師免許', '美容師免許'] },
    ['certifications.1:custom'],
  ],
  ['a blank biography', { bio: '\n' }, ['bio:invalid_format']],
  [
    'an image URL that is not http',
    { imageUrl: 'ftp://aoyama.example.com/a.jpg' },
    ['imageUrl:invalid_format'],
  ],
  [
    'an image URL that is a path',
    { imageUrl: '/staff/hanako.jpg' },
    ['imageUrl:invalid_format'],
  ],
  [
    'an image URL of 501 characters',
    { imageUrl: urlOfLength(501) },
    ['imageUrl:too_big'],
  ],
  [
    'negative years of experience',
    { yearsOfExperience: -1 },
    ['yearsOfExperience:too_small'],
  ],
  [
    '101 years of experience',
    { yearsOfExperience: 101 },
    ['yearsOfExperience:too_big'],
  ],
  [
    'half a year of experience',
    { yearsOfExperience: 1.5 },
    ['yearsOfExperience:invalid_type'],
  ],
  [
    'a hire date that is not a date',
    { hireDate: '2026-02-30' },
    ['hireDate:invalid_format'],
  ],
  [
    'a hire date with a time',
    { hireDate: '2020-04-01T00:00:00Z' },
    ['hireDate:invalid_format'],
  ],
  [
    'a blank employment type',
    { employmentType: ' ' },
    ['employmentType:invalid_format'],
  ],
  [
    'an employment type of 51 characters',
    { employmentType: 'e'.repeat(51) },
    ['employmentType:too_big'],
  ],
  ['a negative salary', { baseSalary: -1 }, ['baseSalary:too_small']],
  [
    'a salary the column cannot hold',
    { baseSalary: 2_147_483_648 },
    ['baseSalary:too_big'],
  ],
  [
    'a salary with a fraction',
    { baseSalary: 0.5 },
    ['baseSalary:invalid_type'],
  ],
  [
    'a negative commission rate',
    { commissionRate: -0.01 },
    ['commissionRate:too_small'],
  ],
  [
    'a commission rate above 100',
    { commissionRate: 100.01 },
    ['commissionRate:too_big'],
  ],
  [
    'a commission rate with three decimal places',
    { commissionRate: 12.345 },
    ['commissionRate:not_multiple_of'],
  ],
  [
    'a commission rate as text',
    { commissionRate: '12.5' },
    ['commissionRate:invalid_type'],
  ],
  [
    'no booking at a time',
    { maxConcurrentBookings: 0 },
    ['maxConcurrentBookings:too_small'],
  ],
  [
    'eleven bookings at a time',
    { maxConcurrentBookings: 11 },
    ['maxConcurrentBookings:too_big'],
  ],
  [
    'a negative buffer time before',
    { bufferTimeBefore: -1 },
    ['bufferTimeBefore:too_small'],
  ],
  [
    'a buffer time before of 121',
    { bufferTimeBefore: 121 },
    ['bufferTimeBefore:too_big'],
  ],
  [
    'a negative buffer time after',
    { bufferTimeAfter: -1 },
    ['bufferTimeAfter:too_small'],
  ],
  [
    'a buffer time after of 121',
    { bufferTimeAfter: 121 },
    ['bufferTimeAfter:too_big'],
  ],
  [
    'a flag that is not a boolean',
    { canReceiveBookings: 'yes' },
    ['canReceiveBookings:invalid_type'],
  ],
]

describe('staffCreateRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const result = parseWith(
      staffCreateRequestSchema,
      staffCreateRequest(),
      'Invalid',
    )

    expect(result).toEqual({ type: 'success', data: staffCreateRequest() })
  })

  it('accepts null for the 12 properties that may be unset and keeps it', () => {
    const unset = Object.fromEntries(
      NULLABLE_PROPERTIES.map((property) => [property, null]),
    )
    const request = { ...staffCreateRequest(), ...unset }

    const result = parseWith(staffCreateRequestSchema, request, 'Invalid')

    expect(NULLABLE_PROPERTIES).toHaveLength(12)
    expect(result).toEqual({ type: 'success', data: request })
  })

  it('returns the email in lower case', () => {
    const result = parseWith(
      staffCreateRequestSchema,
      { ...staffCreateRequest(), email: 'Hanako@Aoyama.Example.COM' },
      'Invalid',
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { email: 'hanako@aoyama.example.com' },
    })
  })

  it.each(['junior', 'stylist', 'senior', 'expert', 'director'])(
    'accepts the level %s',
    (level) => {
      const request = { ...staffCreateRequest(), level }

      expect(rulesBrokenBy(staffCreateRequestSchema, request)).toEqual([])
    },
  )

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    const request = { ...staffCreateRequest(), ...change }

    const result = parseWith(staffCreateRequestSchema, request, 'Invalid')

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each(violations)('rejects %s', (_case, change, expected) => {
    const request = { ...staffCreateRequest(), ...change }

    expect(rulesBrokenBy(staffCreateRequestSchema, request)).toEqual(expected)
  })

  it.each(notNullable)('rejects null for %s', (property, expected) => {
    const request = { ...staffCreateRequest(), [property]: null }

    expect(rulesBrokenBy(staffCreateRequestSchema, request)).toEqual([expected])
  })

  it.each(MANAGED_PROPERTIES)(
    'rejects %s, which a request does not write',
    (property, value) => {
      const request = { ...staffCreateRequest(), [property]: value }

      expect(rulesBrokenBy(staffCreateRequestSchema, request)).toEqual([
        `${property}:unrecognized_keys`,
      ])
    },
  )

  it.each(Object.keys(staffCreateRequest()))(
    'rejects a request without %s',
    (property) => {
      const { [property]: _omitted, ...request }: Record<string, unknown> =
        staffCreateRequest()

      const rules = rulesBrokenBy(staffCreateRequestSchema, request)

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(new RegExp(`^${property}:invalid_`))
    },
  )

  it('has 25 properties, every one of them required', () => {
    expect(Object.keys(staffCreateRequest())).toHaveLength(25)
    expect(NULLABLE_PROPERTIES.length + notNullable.length).toBe(25)
    expect(rulesBrokenBy(staffCreateRequestSchema, {})).toHaveLength(25)
  })

  it('reports every broken rule at once', () => {
    const request = {
      ...staffCreateRequest(),
      firstName: ' ',
      email: 'hanako',
      specialties: ['cut', 'cut'],
      commissionRate: 101,
      userId: null,
    }

    expect(rulesBrokenBy(staffCreateRequestSchema, request).toSorted()).toEqual(
      [
        'commissionRate:too_big',
        'email:invalid_format',
        'firstName:invalid_format',
        'specialties.1:custom',
        'userId:unrecognized_keys',
      ],
    )
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a list', [staffCreateRequest()]],
    ['a text', 'staff'],
  ])('rejects %s in place of a request', (_case, input) => {
    expect(rulesBrokenBy(staffCreateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('staffUpdateRequestSchema', () => {
  it.each(Object.entries(staffCreateRequest()))(
    'accepts %s alone and returns nothing else',
    (property, value) => {
      const result = parseWith(
        staffUpdateRequestSchema,
        { [property]: value },
        'Invalid',
      )

      expect(result).toEqual({ type: 'success', data: { [property]: value } })
    },
  )

  it('accepts every property together and returns the request unchanged', () => {
    const result = parseWith(
      staffUpdateRequestSchema,
      staffCreateRequest(),
      'Invalid',
    )

    expect(result).toEqual({ type: 'success', data: staffCreateRequest() })
  })

  it('returns the email in lower case', () => {
    const result = parseWith(
      staffUpdateRequestSchema,
      { email: 'Hanako@Aoyama.Example.COM' },
      'Invalid',
    )

    expect(result).toEqual({
      type: 'success',
      data: { email: 'hanako@aoyama.example.com' },
    })
  })

  it.each(NULLABLE_PROPERTIES)(
    'accepts null for %s, which clears it',
    (property) => {
      const result = parseWith(
        staffUpdateRequestSchema,
        { [property]: null },
        'Invalid',
      )

      expect(result).toEqual({ type: 'success', data: { [property]: null } })
    },
  )

  it.each(notNullable)(
    'rejects null for %s, which cannot be cleared',
    (property, expected) => {
      expect(
        rulesBrokenBy(staffUpdateRequestSchema, { [property]: null }),
      ).toEqual([expected])
    },
  )

  it.each(accepted)('accepts %s', (_case, change) => {
    const result = parseWith(staffUpdateRequestSchema, change, 'Invalid')

    expect(result).toEqual({ type: 'success', data: change })
  })

  it.each(violations)(
    'rejects %s under the rule of the create request',
    (_case, change, expected) => {
      expect(rulesBrokenBy(staffUpdateRequestSchema, change)).toEqual(expected)
    },
  )

  it.each(MANAGED_PROPERTIES)(
    'rejects %s, which a request does not write',
    (property, value) => {
      expect(
        rulesBrokenBy(staffUpdateRequestSchema, { [property]: value }),
      ).toEqual([`${property}:unrecognized_keys`])
    },
  )

  it('rejects an empty request with one error for the request as a whole', () => {
    expect(rulesBrokenBy(staffUpdateRequestSchema, {})).toEqual([':custom'])
  })

  it('reports an unknown property as such, not as an empty request', () => {
    expect(
      rulesBrokenBy(staffUpdateRequestSchema, { nickname: 'Hana' }),
    ).toEqual(['nickname:unrecognized_keys'])
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a list', [{ position: null }]],
  ])('rejects %s in place of a request', (_case, input) => {
    expect(rulesBrokenBy(staffUpdateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('staffSearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    const result = parseWith(staffSearchRequestSchema, {}, 'Invalid')

    expect(result).toEqual({ type: 'success', data: {} })
  })

  it.each([
    ['the smallest limit', { limit: 1 }],
    ['the largest limit', { limit: 100 }],
    ['a cursor', { cursor: STAFF_MEMBER_ID }],
    ['a limit and a cursor', { limit: 20, cursor: STAFF_MEMBER_ID }],
  ])('accepts %s', (_case, request) => {
    const result = parseWith(staffSearchRequestSchema, request, 'Invalid')

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('reads a cursor written in upper case as the lower-case ID, the one the database returns', () => {
    const result = parseWith(
      staffSearchRequestSchema,
      { cursor: STAFF_MEMBER_ID.toUpperCase() },
      'Invalid',
    )

    expect(result).toEqual({
      type: 'success',
      data: { cursor: STAFF_MEMBER_ID },
    })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a limit with a fraction', { limit: 1.5 }, ['limit:invalid_type']],
    ['a limit as text', { limit: '20' }, ['limit:invalid_type']],
    [
      'a cursor that is not a UUID',
      { cursor: 'abc' },
      ['cursor:invalid_format'],
    ],
    ['an empty cursor', { cursor: '' }, ['cursor:invalid_format']],
    [
      'a parameter that does not exist',
      { isActive: true },
      ['isActive:unrecognized_keys'],
    ],
    [
      'the salon, which the path states',
      { salonId: SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, request, expected) => {
    expect(rulesBrokenBy(staffSearchRequestSchema, request)).toEqual(expected)
  })
})
