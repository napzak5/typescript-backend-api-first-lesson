import { availableSlotMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { decodeAvailableSlotSearchQuery } from '../query'

const SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1c01'
const STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e01'

/** The broken rules of a query that cannot be decoded, as `field:rule`. */
const rulesOf = (query: unknown): string[] => {
  const decoded = decodeAvailableSlotSearchQuery(query)
  return decoded.type === 'error' && decoded.error.type === 'validation'
    ? decoded.error.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []
}

describe('decodeAvailableSlotSearchQuery', () => {
  it('gives the limit and the duration their type and leaves every other parameter as text', () => {
    const decoded = decodeAvailableSlotSearchQuery({
      limit: '10',
      duration: '90',
      cursor: `2026-11-16T01:00:00.000Z_${STAFF_ID}`,
      serviceId: SERVICE_ID,
      staffId: STAFF_ID,
      date: '2026-11-16',
    })

    expect(decoded).toEqual({
      type: 'success',
      data: {
        limit: 10,
        duration: 90,
        cursor: `2026-11-16T01:00:00.000Z_${STAFF_ID}`,
        serviceId: SERVICE_ID,
        staffId: STAFF_ID,
        date: '2026-11-16',
      },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodeAvailableSlotSearchQuery({})).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('keeps a parameter the search does not have: the use case refuses it', () => {
    expect(decodeAvailableSlotSearchQuery({ sortBy: 'startTime' })).toEqual({
      type: 'success',
      data: { sortBy: 'startTime' },
    })
  })

  it('keeps a date as text: it is no number', () => {
    expect(decodeAvailableSlotSearchQuery({ date: '20261116' })).toEqual({
      type: 'success',
      data: { date: '20261116' },
    })
  })

  it('decodes a number with a fraction or a sign as that number: the use case refuses it', () => {
    expect(
      decodeAvailableSlotSearchQuery({ limit: '1.5', duration: '-30' }),
    ).toEqual({
      type: 'success',
      data: { limit: 1.5, duration: -30 },
    })
  })

  it.each([
    ['a word', 'ten'],
    ['an empty text', ''],
    ['a number with a unit', '60min'],
    ['a number in exponent form', '1e2'],
  ])('refuses %s for the limit and for the duration', (_case, text) => {
    expect(rulesOf({ limit: text })).toEqual(['limit:invalid_format'])
    expect(rulesOf({ duration: text })).toEqual(['duration:invalid_format'])
  })

  it('reports both numbers when neither is one', () => {
    expect(rulesOf({ limit: 'many', duration: 'long' })).toEqual([
      'limit:invalid_format',
      'duration:invalid_format',
    ])
  })

  it('refuses a number that is given twice', () => {
    expect(rulesOf({ limit: ['10', '20'] })).toEqual(['limit:invalid_type'])
    expect(rulesOf({ duration: ['30', '60'] })).toEqual([
      'duration:invalid_type',
    ])
  })

  it('says that the search is what is wrong', () => {
    const decoded = decodeAvailableSlotSearchQuery({ duration: 'long' })

    expect(decoded).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: availableSlotMessages.invalidAvailableSlotSearch,
      },
    })
  })
})
