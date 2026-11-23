import { staffMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { decodeStaffSearchQuery } from '../query'

const STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01'

describe('decodeStaffSearchQuery', () => {
  it('gives the limit its type and leaves the cursor as text', () => {
    expect(decodeStaffSearchQuery({ limit: '10', cursor: STAFF_ID })).toEqual({
      type: 'success',
      data: { limit: 10, cursor: STAFF_ID },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeStaffSearchQuery({})).toEqual({ type: 'success', data: {} })
  })

  it('passes a limit that is not a whole number, or out of range, on for the use case to reject', () => {
    expect(decodeStaffSearchQuery({ limit: '1.5' })).toEqual({
      type: 'success',
      data: { limit: 1.5 },
    })
    expect(decodeStaffSearchQuery({ limit: '0' })).toEqual({
      type: 'success',
      data: { limit: 0 },
    })
    expect(decodeStaffSearchQuery({ limit: '101' })).toEqual({
      type: 'success',
      data: { limit: 101 },
    })
  })

  it('passes a cursor that is not a UUID and unknown parameters on for the use case', () => {
    const query = { cursor: 'abc', isActive: 'true', page: '2' }

    expect(decodeStaffSearchQuery(query)).toEqual({
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
      expect(decodeStaffSearchQuery(query)).toMatchObject({
        type: 'error',
        error: {
          type: 'validation',
          message: staffMessages.invalidStaffSearch,
          issues: [{ field, rule }],
        },
      })
    },
  )
})
