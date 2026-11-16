import { describe, expect, it } from 'vitest'
import { decodeSaleSearchQuery } from '../query'

const SALE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3a01'

/** The broken rules of a query that cannot be decoded, as `field:rule`. */
const rulesOf = (query: unknown): string[] => {
  const decoded = decodeSaleSearchQuery(query)
  return decoded.type === 'error' && decoded.error.type === 'validation'
    ? decoded.error.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []
}

describe('decodeSaleSearchQuery', () => {
  it('gives the limit its type and leaves every other parameter as text', () => {
    const decoded = decodeSaleSearchQuery({
      limit: '10',
      cursor: SALE_ID,
      salonId: SALE_ID,
      customerId: SALE_ID,
      bookingId: SALE_ID,
      paymentStatus: 'completed',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    })

    expect(decoded).toEqual({
      type: 'success',
      data: {
        limit: 10,
        cursor: SALE_ID,
        salonId: SALE_ID,
        customerId: SALE_ID,
        bookingId: SALE_ID,
        paymentStatus: 'completed',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeSaleSearchQuery({})).toEqual({ type: 'success', data: {} })
  })

  it('keeps a parameter the search does not have: the use case refuses it', () => {
    expect(decodeSaleSearchQuery({ page: '2' })).toEqual({
      type: 'success',
      data: { page: '2' },
    })
  })

  it('keeps a day as text: it is no number', () => {
    expect(decodeSaleSearchQuery({ startDate: '20261101' })).toEqual({
      type: 'success',
      data: { startDate: '20261101' },
    })
  })

  it('decodes a limit with a fraction or a sign as that number: the use case refuses it', () => {
    expect(decodeSaleSearchQuery({ limit: '1.5' })).toEqual({
      type: 'success',
      data: { limit: 1.5 },
    })
    expect(decodeSaleSearchQuery({ limit: '-1' })).toEqual({
      type: 'success',
      data: { limit: -1 },
    })
  })

  it.each([
    ['a word', 'ten'],
    ['an empty text', ''],
    ['a number with a unit', '10px'],
    ['a number in exponent form', '1e2'],
  ])('refuses %s for the limit', (_case, limit) => {
    expect(rulesOf({ limit })).toEqual(['limit:invalid_format'])
  })

  it('refuses a limit that is given twice', () => {
    expect(rulesOf({ limit: ['10', '20'] })).toEqual(['limit:invalid_type'])
  })

  it('says that the search is what is wrong', () => {
    const decoded = decodeSaleSearchQuery({ limit: 'ten' })

    expect(decoded).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid sale search' },
    })
  })
})
