import { describe, expect, it } from 'vitest'
import { RandomPaymentNumberIssuer } from '../random-payment-number-issuer'

/** `PT-XXXX-XXXX` in the symbols of Crockford's Base32. */
const PAYMENT_NUMBER = /^PT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

describe('RandomPaymentNumberIssuer', () => {
  const issuer = new RandomPaymentNumberIssuer()

  it('should issue numbers of two groups of four symbols after PT that do not repeat', () => {
    // Arrange
    // 32^8 numbers: a repetition among 1,000 has a chance of one in two million.
    const count = 1000

    // Act
    const numbers = Array.from({ length: count }, () => issuer.issue())

    // Assert
    expect(numbers.every((number) => PAYMENT_NUMBER.test(number))).toBe(true)
    expect(new Set(numbers).size).toBe(count)
  })
})
