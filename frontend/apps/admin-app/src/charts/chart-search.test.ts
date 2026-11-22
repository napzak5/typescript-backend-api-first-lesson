import { describe, expect, it } from 'vitest'
import {
  chartConditionsIn,
  chartQueryOf,
  readChartConditions,
} from './chart-search'

const valuesOf = (search: string, allergies: string): FormData => {
  const values = new FormData()
  values.set('search', search)
  values.set('allergies', allergies)

  return values
}

describe('chartConditionsIn', () => {
  it.each<[string, string, object]>([
    ['nothing', '', {}],
    [
      'a keyword and allergies',
      'search=%E3%82%AB%E3%83%A9%E3%83%BC&allergies=with',
      { search: 'カラー', allergies: 'with' },
    ],
    ['no allergies', 'allergies=without', { allergies: 'without' }],
    ['a choice that is none', 'allergies=maybe', {}],
    ['a keyword that is too long', `search=${'a'.repeat(101)}`, {}],
  ])('should read %s', (_, query, conditions) => {
    // Act
    const read = chartConditionsIn(new URLSearchParams(query))

    // Assert
    expect(read).toEqual(conditions)
  })
})

describe('readChartConditions', () => {
  it('should read the keyword without the spaces around it, and the choice', () => {
    // Act
    const read = readChartConditions(valuesOf(' PPD ', 'without'))

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: { search: 'PPD', allergies: 'without' },
    })
  })

  it('should take nothing as no condition', () => {
    // Act
    const read = readChartConditions(valuesOf('  ', ''))

    // Assert
    expect(read).toEqual({ type: 'valid', value: {} })
  })

  it('should refuse a keyword of more than 100 characters', () => {
    // Act
    const read = readChartConditions(valuesOf('a'.repeat(101), ''))

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: { search: 'キーワードは 100 文字以内で入力してください。' },
    })
  })
})

describe('chartQueryOf', () => {
  it('should keep the conditions in the same order, whatever they were filled in', () => {
    // Act
    const query = chartQueryOf({ allergies: 'with', search: 'カラー' })

    // Assert
    expect(query.toString()).toBe(
      'search=%E3%82%AB%E3%83%A9%E3%83%BC&allergies=with',
    )
  })
})
