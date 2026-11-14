import { describe, expect, it } from 'vitest'
import { decodeSessionSearchQuery } from '../query'

const SESSION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c02'

describe('decodeSessionSearchQuery', () => {
  it('gives the limit its type and leaves the cursor as text', () => {
    const decoded = decodeSessionSearchQuery({
      limit: '10',
      cursor: SESSION_ID,
    })

    expect(decoded).toEqual({
      type: 'success',
      data: { limit: 10, cursor: SESSION_ID },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeSessionSearchQuery({})).toEqual({ type: 'success', data: {} })
  })

  it('passes a limit that is not a whole number on for the use case to reject', () => {
    expect(decodeSessionSearchQuery({ limit: '1.5' })).toEqual({
      type: 'success',
      data: { limit: 1.5 },
    })
  })

  it('passes a cursor that is not a UUID and unknown parameters on for the use case to reject', () => {
    expect(decodeSessionSearchQuery({ cursor: 'abc', page: '2' })).toEqual({
      type: 'success',
      data: { cursor: 'abc', page: '2' },
    })
  })

  it.each([
    ['a limit that is not a number', { limit: 'ten' }, 'invalid_format'],
    ['an empty limit', { limit: '' }, 'invalid_format'],
    ['a limit in exponent notation', { limit: '1e1' }, 'invalid_format'],
    ['a limit given twice', { limit: ['1', '2'] }, 'invalid_type'],
  ])('rejects %s as a broken rule of limit', (_case, query, rule) => {
    expect(decodeSessionSearchQuery(query)).toMatchObject({
      type: 'error',
      error: { type: 'validation', issues: [{ field: 'limit', rule }] },
    })
  })
})
