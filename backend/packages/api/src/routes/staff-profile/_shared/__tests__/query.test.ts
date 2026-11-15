import { describe, expect, it } from 'vitest'
import { decodeStaffProfileSearchQuery } from '../query'

const STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01'
const SALON_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

describe('decodeStaffProfileSearchQuery', () => {
  it('gives the limit its type and leaves every other parameter as text', () => {
    const decoded = decodeStaffProfileSearchQuery({
      limit: '10',
      cursor: STAFF_ID,
      salonId: SALON_ID,
      specialty: 'color',
      city: '渋谷区',
    })

    expect(decoded).toEqual({
      type: 'success',
      data: {
        limit: 10,
        cursor: STAFF_ID,
        salonId: SALON_ID,
        specialty: 'color',
        city: '渋谷区',
      },
    })
  })

  it('keeps a specialty and a city that are written like numbers as text', () => {
    expect(
      decodeStaffProfileSearchQuery({ specialty: '100', city: '23' }),
    ).toEqual({
      type: 'success',
      data: { specialty: '100', city: '23' },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeStaffProfileSearchQuery({})).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('passes a limit that is not a whole number, or out of range, on for the use case to reject', () => {
    expect(decodeStaffProfileSearchQuery({ limit: '1.5' })).toEqual({
      type: 'success',
      data: { limit: 1.5 },
    })
    expect(decodeStaffProfileSearchQuery({ limit: '0' })).toEqual({
      type: 'success',
      data: { limit: 0 },
    })
    expect(decodeStaffProfileSearchQuery({ limit: '101' })).toEqual({
      type: 'success',
      data: { limit: 101 },
    })
  })

  it('passes IDs that are not UUIDs, blank filters, a filter given twice and unknown parameters on for the use case', () => {
    const query = {
      cursor: 'abc',
      salonId: 'abc',
      specialty: ['cut', 'color'],
      city: '',
      page: '2',
    }

    expect(decodeStaffProfileSearchQuery(query)).toEqual({
      type: 'success',
      data: query,
    })
  })

  it.each([
    [
      'a limit that is not a number',
      { limit: 'ten' },
      'limit',
      'invalid_format',
    ],
    ['an empty limit', { limit: '' }, 'limit', 'invalid_format'],
    [
      'a limit in exponent notation',
      { limit: '1e1' },
      'limit',
      'invalid_format',
    ],
    ['a limit given twice', { limit: ['1', '2'] }, 'limit', 'invalid_type'],
  ])(
    'rejects %s as a broken rule of the parameter',
    (_case, query, field, rule) => {
      expect(decodeStaffProfileSearchQuery(query)).toMatchObject({
        type: 'error',
        error: {
          type: 'validation',
          message: 'Invalid staff profile search',
          issues: [{ field, rule }],
        },
      })
    },
  )
})
