import { describe, expect, it } from 'vitest'
import { decodeServiceSearchQuery } from '../query'

const SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'
const CATEGORY_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d01'

describe('decodeServiceSearchQuery', () => {
  it('gives the limit and isActive their types and leaves the cursor and the category as text', () => {
    const decoded = decodeServiceSearchQuery({
      limit: '10',
      isActive: 'false',
      cursor: SERVICE_ID,
      categoryId: CATEGORY_ID,
    })

    expect(decoded).toEqual({
      type: 'success',
      data: {
        limit: 10,
        isActive: false,
        cursor: SERVICE_ID,
        categoryId: CATEGORY_ID,
      },
    })
  })

  it.each([
    ['true', true],
    ['false', false],
  ])('reads isActive=%s as a boolean', (text, isActive) => {
    expect(decodeServiceSearchQuery({ isActive: text })).toEqual({
      type: 'success',
      data: { isActive },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeServiceSearchQuery({})).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('passes a limit that is not a whole number, or out of range, on for the use case to reject', () => {
    expect(decodeServiceSearchQuery({ limit: '1.5' })).toEqual({
      type: 'success',
      data: { limit: 1.5 },
    })
    expect(decodeServiceSearchQuery({ limit: '0' })).toEqual({
      type: 'success',
      data: { limit: 0 },
    })
    expect(decodeServiceSearchQuery({ limit: '101' })).toEqual({
      type: 'success',
      data: { limit: 101 },
    })
  })

  it('passes a cursor or a category that is not a UUID, IDs in upper case, and unknown parameters on for the use case', () => {
    const decoded = decodeServiceSearchQuery({
      cursor: 'abc',
      categoryId: CATEGORY_ID.toUpperCase(),
      page: '2',
      salonId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b',
    })

    expect(decoded).toEqual({
      type: 'success',
      data: {
        cursor: 'abc',
        categoryId: CATEGORY_ID.toUpperCase(),
        page: '2',
        salonId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b',
      },
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
    [
      'isActive that is neither true nor false',
      { isActive: 'yes' },
      'isActive',
      'invalid_value',
    ],
    ['isActive as a digit', { isActive: '1' }, 'isActive', 'invalid_value'],
    ['isActive in capitals', { isActive: 'TRUE' }, 'isActive', 'invalid_value'],
    ['an empty isActive', { isActive: '' }, 'isActive', 'invalid_value'],
    [
      'isActive given twice',
      { isActive: ['true', 'false'] },
      'isActive',
      'invalid_value',
    ],
  ])(
    'rejects %s as a broken rule of the parameter',
    (_case, query, field, rule) => {
      expect(decodeServiceSearchQuery(query)).toMatchObject({
        type: 'error',
        error: { type: 'validation', issues: [{ field, rule }] },
      })
    },
  )

  it('reports every parameter it cannot read at once', () => {
    const decoded = decodeServiceSearchQuery({
      limit: 'ten',
      isActive: 'yes',
    })

    expect(decoded).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        issues: [
          { field: 'limit', rule: 'invalid_format' },
          { field: 'isActive', rule: 'invalid_value' },
        ],
      },
    })
  })
})
