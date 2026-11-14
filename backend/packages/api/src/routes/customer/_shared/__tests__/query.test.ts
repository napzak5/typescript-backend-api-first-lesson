import { describe, expect, it } from 'vitest'
import { decodeCustomerSearchQuery } from '../query'

const CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0d01'

describe('decodeCustomerSearchQuery', () => {
  it('gives the limit and the tags their types and leaves every other parameter as text', () => {
    const decoded = decodeCustomerSearchQuery({
      limit: '10',
      tags: 'vip',
      cursor: CUSTOMER_ID,
      search: '090-1234',
      registeredFrom: '2026-11-01T00:00:00Z',
      registeredTo: '2026-11-15T00:00:00.500Z',
      customerStatus: 'active',
      membershipTier: 'gold',
    })

    expect(decoded).toEqual({
      type: 'success',
      data: {
        limit: 10,
        tags: ['vip'],
        cursor: CUSTOMER_ID,
        search: '090-1234',
        registeredFrom: '2026-11-01T00:00:00Z',
        registeredTo: '2026-11-15T00:00:00.500Z',
        customerStatus: 'active',
        membershipTier: 'gold',
      },
    })
  })

  it('reads one tag as a list of one tag', () => {
    expect(decodeCustomerSearchQuery({ tags: 'vip' })).toEqual({
      type: 'success',
      data: { tags: ['vip'] },
    })
  })

  it('keeps repeated tags as a list in their order', () => {
    expect(decodeCustomerSearchQuery({ tags: ['vip', 'new'] })).toEqual({
      type: 'success',
      data: { tags: ['vip', 'new'] },
    })
  })

  it('keeps a search that is written like a number as text', () => {
    expect(decodeCustomerSearchQuery({ search: '09012345678' })).toEqual({
      type: 'success',
      data: { search: '09012345678' },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeCustomerSearchQuery({})).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('passes a limit that is not a whole number, or out of range, on for the use case to reject', () => {
    expect(decodeCustomerSearchQuery({ limit: '1.5' })).toEqual({
      type: 'success',
      data: { limit: 1.5 },
    })
    expect(decodeCustomerSearchQuery({ limit: '0' })).toEqual({
      type: 'success',
      data: { limit: 0 },
    })
    expect(decodeCustomerSearchQuery({ limit: '101' })).toEqual({
      type: 'success',
      data: { limit: 101 },
    })
  })

  it('passes a blank tag, a blank search, a cursor that is not a UUID, an unknown status and unknown parameters on for the use case', () => {
    const query = {
      tags: ['vip', ' '],
      search: '',
      cursor: 'abc',
      customerStatus: 'gone',
      page: '2',
    }

    expect(decodeCustomerSearchQuery(query)).toEqual({
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
      expect(decodeCustomerSearchQuery(query)).toMatchObject({
        type: 'error',
        error: { type: 'validation', issues: [{ field, rule }] },
      })
    },
  )
})
