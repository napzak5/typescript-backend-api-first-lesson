import { describe, expect, it } from 'vitest'
import { hundredthsOf } from './quantity'

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
