import { describe, expect, it } from 'vitest'
import { isAtOrBelow } from './addresses'

describe('isAtOrBelow', () => {
  it.each<[string, string, boolean]>([
    ['the screen itself', '/bookings', true],
    [
      'a screen below it',
      '/bookings/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c02',
      true,
    ],
    ['a screen further below it', '/bookings/a/reschedule', true],
    ['an address that only begins with the same letters', '/bookingsx', false],
    ['another screen', '/mypage', false],
    ['the screen above it', '/', false],
    ['an address that names the screen further down', '/x/bookings', false],
  ])(
    'should say of %s whether it is at or below the screen',
    (_case, pathname, below) => {
      // Act, Assert
      expect(isAtOrBelow(pathname, '/bookings')).toBe(below)
    },
  )
})
