import { describe, expect, it } from 'vitest'
import { RandomPurchaseOrderNumberIssuer } from '../random-purchase-order-number-issuer'

/** `PO-XXXX-XXXX` in the symbols of Crockford's Base32. */
const ORDER_NUMBER = /^PO-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

describe('RandomPurchaseOrderNumberIssuer', () => {
  const issuer = new RandomPurchaseOrderNumberIssuer()

  it('issues numbers of two groups of four symbols after PO that do not repeat', () => {
    // 32^8 numbers: a repetition among 1,000 has a chance of one in two million.
    const numbers = Array.from({ length: 1000 }, () => issuer.issue())

    expect(numbers.every((number) => ORDER_NUMBER.test(number))).toBe(true)
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
