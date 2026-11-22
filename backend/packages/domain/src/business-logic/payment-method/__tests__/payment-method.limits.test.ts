import { describe, expect, it } from 'vitest'
import { limitsAfter, limitsAreInOrder } from '..'

describe('limitsAreInOrder', () => {
  it.each([
    ['no limit at all', null, null],
    ['a lower limit alone', 1000, null],
    ['an upper limit alone', null, 1000],
    ['a lower limit below the upper one', 1000, 1001],
    ['equal limits', 1000, 1000],
    ['the smallest limits', 1, 1],
  ])('takes %s', (_case, minimumAmount, maximumAmount) => {
    expect(limitsAreInOrder({ minimumAmount, maximumAmount })).toBe(true)
  })

  it.each([
    ['a lower limit one above the upper one', 1001, 1000],
    ['a lower limit far above the upper one', 2_147_483_647, 1],
  ])('refuses %s', (_case, minimumAmount, maximumAmount) => {
    expect(limitsAreInOrder({ minimumAmount, maximumAmount })).toBe(false)
  })
})

describe('limitsAfter', () => {
  const current = { minimumAmount: 1000, maximumAmount: 5000 }

  it('keeps both limits when the change names neither', () => {
    expect(limitsAfter(current, {})).toEqual(current)
  })

  it('takes the lower limit a change names and keeps the upper one', () => {
    expect(limitsAfter(current, { minimumAmount: 2000 })).toEqual({
      minimumAmount: 2000,
      maximumAmount: 5000,
    })
  })

  it('takes the upper limit a change names and keeps the lower one', () => {
    expect(limitsAfter(current, { maximumAmount: 800 })).toEqual({
      minimumAmount: 1000,
      maximumAmount: 800,
    })
  })

  it('takes both when the change names both', () => {
    expect(
      limitsAfter(current, { minimumAmount: 1, maximumAmount: 2 }),
    ).toEqual({ minimumAmount: 1, maximumAmount: 2 })
  })

  it('takes a limit away when the change names null, which is not the same as not naming it', () => {
    expect(limitsAfter(current, { minimumAmount: null })).toEqual({
      minimumAmount: null,
      maximumAmount: 5000,
    })
    expect(limitsAfter(current, { maximumAmount: null })).toEqual({
      minimumAmount: 1000,
      maximumAmount: null,
    })
  })

  it('gives limits to a payment method that had none', () => {
    expect(
      limitsAfter(
        { minimumAmount: null, maximumAmount: null },
        { maximumAmount: 300 },
      ),
    ).toEqual({ minimumAmount: null, maximumAmount: 300 })
  })

  it('returns nothing but the limits, whatever else the two hold', () => {
    const stored = { ...current, sortOrder: 4 }
    const changes = { maximumAmount: 6000, displayName: 'Card' }

    expect(limitsAfter(stored, changes)).toStrictEqual({
      minimumAmount: 1000,
      maximumAmount: 6000,
    })
  })
})
