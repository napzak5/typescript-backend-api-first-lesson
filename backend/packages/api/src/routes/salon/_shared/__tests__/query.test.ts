import { describe, expect, it } from 'vitest'
import { decodeSalonSearchQuery } from '../query'

describe('decodeSalonSearchQuery', () => {
  it('gives numbers, booleans and lists their types and leaves text alone', () => {
    const decoded = decodeSalonSearchQuery({
      limit: '10',
      minRating: '4.5',
      isActive: 'false',
      features: 'color',
      keyword: '10',
      cursor: 'abc',
    })

    expect(decoded).toEqual({
      type: 'success',
      data: {
        limit: 10,
        minRating: 4.5,
        isActive: false,
        features: ['color'],
        keyword: '10',
        cursor: 'abc',
      },
    })
  })

  it('keeps a repeated list parameter as a list', () => {
    const decoded = decodeSalonSearchQuery({ features: ['color', 'kids'] })

    expect(decoded).toEqual({
      type: 'success',
      data: { features: ['color', 'kids'] },
    })
  })

  it('passes unknown parameters on for the use case to reject', () => {
    expect(decodeSalonSearchQuery({ page: '2' })).toEqual({
      type: 'success',
      data: { page: '2' },
    })
  })

  it.each([
    ['a limit that is not a number', { limit: 'ten' }, 'limit'],
    ['an empty limit', { limit: '' }, 'limit'],
    ['a rating in exponent notation', { minRating: '1e1' }, 'minRating'],
    ['a boolean that is not true or false', { isActive: '1' }, 'isActive'],
    ['a number given twice', { limit: ['1', '2'] }, 'limit'],
  ])('rejects %s', (_case, query, field) => {
    expect(decodeSalonSearchQuery(query)).toMatchObject({
      type: 'error',
      error: { type: 'validation', issues: [{ field }] },
    })
  })
})
