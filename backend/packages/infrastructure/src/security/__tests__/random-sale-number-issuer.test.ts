import { describe, expect, it } from 'vitest'
import { RandomSaleNumberIssuer } from '../random-sale-number-issuer'

/** `SL-XXXX-XXXX` in the symbols of Crockford's Base32. */
const SALE_NUMBER = /^SL-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

describe('RandomSaleNumberIssuer', () => {
  const issuer = new RandomSaleNumberIssuer()

  it('should issue numbers of two groups of four symbols after SL that do not repeat', () => {
    // Arrange
    // 32^8 numbers: a repetition among 1,000 has a chance of one in two million.
    const count = 1000

    // Act
    const numbers = Array.from({ length: count }, () => issuer.issue())

    // Assert
    expect(numbers.every((number) => SALE_NUMBER.test(number))).toBe(true)
    expect(new Set(numbers).size).toBe(count)
  })
})
