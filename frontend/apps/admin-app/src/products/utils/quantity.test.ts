import { describe, expect, it } from 'vitest'
import { hundredthsOf, quantityOf } from './quantity'

describe('hundredthsOf', () => {
  it.each<[number, number]>([
    [3, 300],
    [0.29, 29],
    [1.15, 115],
    [99_999_999.99, 9_999_999_999],
  ])('should give %d in hundredths as %d', (quantity, hundredths) => {
    expect(hundredthsOf(quantity)).toBe(hundredths)
  })
})

describe('quantityOf', () => {
  it.each<[number, string]>([
    [3, '3'],
    [0.29, '0.29'],
    [1234.25, '1,234.25'],
    [2.125, '2.13'],
  ])(
    'should write %d with the separators of the language and two decimals at most',
    (quantity, written) => {
      // Act, Assert
      expect(quantityOf(quantity)).toEqual({ en: written, ja: written })
    },
  )
})
