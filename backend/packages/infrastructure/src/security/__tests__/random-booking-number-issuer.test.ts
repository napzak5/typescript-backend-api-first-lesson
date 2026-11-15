import { describe, expect, it } from 'vitest'
import { RandomBookingNumberIssuer } from '../random-booking-number-issuer'

/** `BK-XXXX-XXXX` in the symbols of Crockford's Base32. */
const BOOKING_NUMBER = /^BK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

describe('RandomBookingNumberIssuer', () => {
  const issuer = new RandomBookingNumberIssuer()

  it('issues a number of two groups of four symbols after BK', () => {
    expect(issuer.issue()).toMatch(BOOKING_NUMBER)
  })

  it('issues numbers that all have the format and do not repeat', () => {
    // 32^8 numbers: a repetition among 1,000 has a chance of one in two million.
    const numbers = Array.from({ length: 1000 }, () => issuer.issue())

    expect(numbers.every((number) => BOOKING_NUMBER.test(number))).toBe(true)
    expect(new Set(numbers).size).toBe(1000)
  })

  it('uses every one of the 32 symbols, and no other', () => {
    const symbols = new Set(
      Array.from({ length: 1000 }, () => issuer.issue()).flatMap((number) => [
        ...number.slice(3).replace('-', ''),
      ]),
    )

    expect([...symbols].toSorted().join('')).toBe(
      '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
    )
  })
})
