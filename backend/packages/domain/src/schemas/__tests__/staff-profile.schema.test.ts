import { describe, expect, it } from 'vitest'
import {
  brokenRules,
  MADE_UP_HEADLINE,
  SALON_ID,
} from '../../__tests__/fixtures/fixtures'
import {
  STAFF_MEMBER_ID,
  staffCreateRequest,
} from '../../__tests__/fixtures/staff-fixtures'
import { parseWith } from '../../shared'
import {
  staffProfileSearchRequestSchema,
  staffProfileUpdateRequestSchema,
} from '../staff-profile.schema'

const rulesBrokenBy = (input: unknown): string[] => {
  const result = parseWith(
    staffProfileSearchRequestSchema,
    input,
    MADE_UP_HEADLINE,
  )
  return result.type === 'error' ? brokenRules(result.error) : []
}

describe('staffProfileSearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    const result = parseWith(
      staffProfileSearchRequestSchema,
      {},
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: {} })
  })

  it.each([
    ['the smallest limit', { limit: 1 }],
    ['the largest limit', { limit: 100 }],
    ['a cursor', { cursor: STAFF_MEMBER_ID }],
    ['a salon', { salonId: SALON_ID }],
    ['a specialty', { specialty: 'color' }],
    ['a specialty of one character', { specialty: 'x' }],
    ['a specialty with spaces around it', { specialty: ' hair color ' }],
    ['a specialty that is not Latin', { specialty: 'カラー' }],
    ['a city', { city: 'Shibuya-ku' }],
    ['a city of 100 characters', { city: 'a'.repeat(100) }],
    [
      'every parameter together',
      {
        limit: 20,
        cursor: STAFF_MEMBER_ID,
        salonId: SALON_ID,
        specialty: 'color',
        city: '渋谷区',
      },
    ],
  ])('accepts %s and keeps it as it is', (_case, request) => {
    const result = parseWith(
      staffProfileSearchRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each([
    ['cursor', STAFF_MEMBER_ID],
    ['salonId', SALON_ID],
  ])(
    'reads %s written in upper case as the lower-case ID, the one the database returns',
    (parameter, id) => {
      const result = parseWith(
        staffProfileSearchRequestSchema,
        { [parameter]: id.toUpperCase() },
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: { [parameter]: id } })
    },
  )

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
      'a salon that is not a UUID',
      { salonId: 'abc' },
      ['salonId:invalid_format'],
    ],
    ['an empty salon', { salonId: '' }, ['salonId:invalid_format']],
    ['an empty specialty', { specialty: '' }, ['specialty:invalid_format']],
    [
      'a specialty of spaces only',
      { specialty: '   ' },
      ['specialty:invalid_format'],
    ],
    [
      'two specialties',
      { specialty: ['cut', 'color'] },
      ['specialty:invalid_type'],
    ],
    ['an empty city', { city: '' }, ['city:invalid_format']],
    ['a city of spaces only', { city: ' ' }, ['city:invalid_format']],
    ['a city of 101 characters', { city: 'a'.repeat(101) }, ['city:too_big']],
    [
      'a parameter of the salon list',
      { prefecture: 'Tokyo' },
      ['prefecture:unrecognized_keys'],
    ],
    [
      'isActive: only staff members who work at the salon are shown',
      { isActive: false },
      ['isActive:unrecognized_keys'],
    ],
    ['a keyword', { keyword: 'Hanako' }, ['keyword:unrecognized_keys']],
  ])('rejects %s', (_case, request, expected) => {
    expect(rulesBrokenBy(request)).toEqual(expected)
  })

  it('reports every broken rule at once', () => {
    expect(
      rulesBrokenBy({ limit: 0, cursor: 'abc', salonId: 'abc', city: '' }),
    ).toEqual([
      'limit:too_small',
      'cursor:invalid_format',
      'salonId:invalid_format',
      'city:invalid_format',
    ])
  })
})

const updateRulesBrokenBy = (input: unknown): string[] => {
  const result = parseWith(
    staffProfileUpdateRequestSchema,
    input,
    MADE_UP_HEADLINE,
  )
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** What a staff member writes of their own profile, with a value for each. */
const OWN: Record<string, unknown> = {
  specialties: ['cut', 'perm'],
  bio: 'Fifteen years of cutting.',
  imageUrl: 'https://aoyama.example.com/staff/hanako-2.jpg',
  yearsOfExperience: 15,
  certifications: ['美容師免許', '管理美容師'],
}

/** The properties of a ledger entry that the salon writes and the staff member does not. */
const THE_SALONS = Object.entries(staffCreateRequest()).filter(
  ([property]) => !(property in OWN),
)

const urlOfLength = (length: number): string =>
  `https://example.com/${'a'.repeat(length - 'https://example.com/'.length)}`

describe('staffProfileUpdateRequestSchema', () => {
  it.each(Object.entries(OWN))(
    'accepts %s alone and returns nothing else',
    (property, value) => {
      const result = parseWith(
        staffProfileUpdateRequestSchema,
        { [property]: value },
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: { [property]: value } })
    },
  )

  it('accepts the five properties together and returns the request unchanged', () => {
    const result = parseWith(
      staffProfileUpdateRequestSchema,
      OWN,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: OWN })
  })

  it.each(['bio', 'imageUrl', 'yearsOfExperience'])(
    'accepts null for %s, which clears it',
    (property) => {
      const result = parseWith(
        staffProfileUpdateRequestSchema,
        { [property]: null },
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: { [property]: null } })
    },
  )

  // A request that names a property changes it. One that named a property
  // without a value would pass for a change and change nothing.
  it.each(Object.keys(OWN))(
    'rejects %s when it is present without a value: a property has a value or is left out',
    (property) => {
      expect(updateRulesBrokenBy({ [property]: undefined })).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it.each(['specialties', 'certifications'])(
    'rejects null for %s, which is emptied with an empty list',
    (property) => {
      expect(updateRulesBrokenBy({ [property]: null })).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it.each<[string, Record<string, unknown>]>([
    ['no specialties', { specialties: [] }],
    ['no certifications', { certifications: [] }],
    ['an image URL of 500 characters', { imageUrl: urlOfLength(500) }],
    ['an image URL over http', { imageUrl: 'http://aoyama.example.com/a.jpg' }],
    ['no experience', { yearsOfExperience: 0 }],
    ['100 years of experience', { yearsOfExperience: 100 }],
  ])('accepts %s', (_case, change) => {
    const result = parseWith(
      staffProfileUpdateRequestSchema,
      change,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: change })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
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
      'a specialty twice',
      { specialties: ['cut', 'color', 'cut'] },
      ['specialties.2:custom'],
    ],
    [
      'a blank certification',
      { certifications: [''] },
      ['certifications.0:invalid_format'],
    ],
    [
      'a certification twice',
      { certifications: ['美容師免許', '美容師免許'] },
      ['certifications.1:custom'],
    ],
    ['a blank biography', { bio: '\n' }, ['bio:invalid_format']],
    ['a biography that is no text', { bio: 3 }, ['bio:invalid_type']],
    [
      'an image URL that is not http or https',
      { imageUrl: 'ftp://aoyama.example.com/a.jpg' },
      ['imageUrl:invalid_format'],
    ],
    [
      'an image URL without a host',
      { imageUrl: '/staff/hanako.jpg' },
      ['imageUrl:invalid_format'],
    ],
    [
      'an image URL of 501 characters',
      { imageUrl: urlOfLength(501) },
      ['imageUrl:too_big'],
    ],
    [
      'negative experience',
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
  ])('rejects %s under the rule of the ledger', (_case, change, expected) => {
    expect(updateRulesBrokenBy(change)).toEqual(expected)
  })

  it('leaves the 20 other properties of a ledger entry to the salon', () => {
    expect(THE_SALONS.map(([property]) => property)).toEqual([
      'firstName',
      'lastName',
      'firstNameKana',
      'lastNameKana',
      'displayName',
      'email',
      'phoneNumber',
      'alternativePhone',
      'staffCode',
      'level',
      'position',
      'hireDate',
      'employmentType',
      'baseSalary',
      'commissionRate',
      'canReceiveBookings',
      'maxConcurrentBookings',
      'bufferTimeBefore',
      'bufferTimeAfter',
      'isActive',
    ])
  })

  it.each(THE_SALONS)(
    'rejects %s, which the salon writes in the ledger',
    (property, value) => {
      expect(updateRulesBrokenBy({ [property]: value })).toEqual([
        `${property}:unrecognized_keys`,
      ])
    },
  )

  it.each<[string, unknown]>([
    ['id', STAFF_MEMBER_ID],
    ['salonId', SALON_ID],
    ['userId', null],
    ['awards', []],
    ['updatedAt', '2026-11-14T09:00:00.000Z'],
    ['deletedAt', null],
  ])('rejects %s, which no request writes', (property, value) => {
    expect(updateRulesBrokenBy({ ...OWN, [property]: value })).toEqual([
      `${property}:unrecognized_keys`,
    ])
  })

  it('rejects an empty request with one error for the request as a whole', () => {
    expect(updateRulesBrokenBy({})).toEqual([':custom'])
  })

  it('reports an unknown property as such, not as an empty request', () => {
    expect(updateRulesBrokenBy({ nickname: 'Hana' })).toEqual([
      'nickname:unrecognized_keys',
    ])
  })

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a list', [{ bio: null }]],
  ])('rejects %s in place of a request', (_case, input) => {
    expect(updateRulesBrokenBy(input)).toEqual([':invalid_type'])
  })

  it('reports every broken rule at once', () => {
    expect(
      updateRulesBrokenBy({
        specialties: [''],
        bio: ' ',
        imageUrl: 'x',
        yearsOfExperience: -1,
        certifications: 'none',
      }),
    ).toEqual([
      'specialties.0:invalid_format',
      'bio:invalid_format',
      'imageUrl:invalid_format',
      'yearsOfExperience:too_small',
      'certifications:invalid_type',
    ])
  })
})
