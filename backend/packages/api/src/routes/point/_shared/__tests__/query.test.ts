import { pointMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  decodeExpiringPointsQuery,
  decodePointTransactionSearchQuery,
} from '../query'

const POINT_TRANSACTION_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f4a01'

describe('decodePointTransactionSearchQuery', () => {
  it('gives the limit its type and leaves every other parameter as text', () => {
    expect(
      decodePointTransactionSearchQuery({
        limit: '10',
        cursor: POINT_TRANSACTION_ID,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T15:00:00.500Z',
      }),
    ).toEqual({
      type: 'success',
      data: {
        limit: 10,
        cursor: POINT_TRANSACTION_ID,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T15:00:00.500Z',
      },
    })
  })

  it('decodes an empty query to no parameter', () => {
    expect(decodePointTransactionSearchQuery({})).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('passes a limit out of range, a cursor that is not a UUID, a date that is not a moment and unknown parameters on for the use case', () => {
    const query = {
      cursor: 'next',
      startDate: '2026-11-01',
      customerId: POINT_TRANSACTION_ID,
    }

    expect(decodePointTransactionSearchQuery(query)).toEqual({
      type: 'success',
      data: query,
    })
    expect(decodePointTransactionSearchQuery({ limit: '101' })).toEqual({
      type: 'success',
      data: { limit: 101 },
    })
  })

  it.each([
    ['a limit that is not a number', { limit: 'ten' }, 'invalid_format'],
    ['an empty limit', { limit: '' }, 'invalid_format'],
    ['a limit given twice', { limit: ['1', '2'] }, 'invalid_type'],
  ])('rejects %s as a broken rule of the parameter', (_case, query, rule) => {
    expect(decodePointTransactionSearchQuery(query)).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: pointMessages.invalidPointTransactionSearch,
        issues: [{ field: 'limit', rule }],
      },
    })
  })
})

describe('decodeExpiringPointsQuery', () => {
  it('gives the days their type', () => {
    expect(decodeExpiringPointsQuery({ days: '7' })).toEqual({
      type: 'success',
      data: { days: 7 },
    })
    expect(decodeExpiringPointsQuery({})).toEqual({ type: 'success', data: {} })
  })

  it('passes days out of range and unknown parameters on for the use case', () => {
    expect(decodeExpiringPointsQuery({ days: '366', limit: '10' })).toEqual({
      type: 'success',
      data: { days: 366, limit: '10' },
    })
  })

  it.each([
    ['days that are not a number', { days: 'a week' }, 'invalid_format'],
    ['days given twice', { days: ['1', '2'] }, 'invalid_type'],
  ])('rejects %s as a broken rule of the parameter', (_case, query, rule) => {
    expect(decodeExpiringPointsQuery(query)).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: pointMessages.invalidExpiringPointsSearch,
        issues: [{ field: 'days', rule }],
      },
    })
  })
})
