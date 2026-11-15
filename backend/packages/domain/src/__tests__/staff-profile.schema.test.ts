import { describe, expect, it } from 'vitest'
import { staffProfileSearchRequestSchema } from '../schemas/staff-profile.schema'
import { parseWith } from '../shared'
import { brokenRules, SALON_ID } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

const rulesBrokenBy = (input: unknown): string[] => {
  const result = parseWith(staffProfileSearchRequestSchema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

describe('staffProfileSearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    const result = parseWith(staffProfileSearchRequestSchema, {}, 'Invalid')

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
      'Invalid',
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
        'Invalid',
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
