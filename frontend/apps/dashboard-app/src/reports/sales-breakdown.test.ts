import { describe, expect, it } from 'vitest'
import { percentOfMost, perServiceOf } from './sales-breakdown'

describe('percentOfMost', () => {
  it.each<[number, number, number]>([
    [23_100, 23_100, 100],
    [11_550, 23_100, 50],
    [0, 23_100, 0],
    [0, 0, 0],
    [5, 0, 0],
  ])('should draw %s of a most of %s as %s percent', (value, most, percent) => {
    // Act, Assert
    expect(percentOfMost(value, most)).toBe(percent)
  })

  it('should keep a bar within its length when a value is more than the most', () => {
    // Act, Assert
    expect(percentOfMost(30_000, 23_100)).toBe(100)
    expect(percentOfMost(-1, 23_100)).toBe(0)
  })
})

describe('perServiceOf', () => {
  it.each<[number, number, number]>([
    [17_600, 2, 8800],
    [10_000, 3, 3333],
    [10_000, 6, 1666],
    [5500, 1, 5500],
    [0, 0, 0],
  ])(
    'should make %s of %s services %s a service, without the part of a yen',
    (amount, count, per) => {
      // Act, Assert
      expect(perServiceOf(amount, count)).toBe(per)
    },
  )
})
