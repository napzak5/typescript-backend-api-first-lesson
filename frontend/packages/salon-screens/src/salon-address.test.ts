import { describe, expect, it } from 'vitest'
import { salonIdIn } from './salon-address'

const SALON_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'

describe('salonIdIn', () => {
  it.each<[string, string, string | undefined]>([
    ['a screen of a salon', `/salons/${SALON_ID}/reports`, SALON_ID],
    [
      'a screen below a screen of a salon',
      `/salons/${SALON_ID}/bookings/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c02`,
      SALON_ID,
    ],
    ['the address of the salon itself', `/salons/${SALON_ID}`, SALON_ID],
    ['the start', '/', undefined],
    ['the list of the salons', '/salons', undefined],
    ['the security of the account', '/account/security', undefined],
    [
      'an address that only begins with the same letters',
      '/salonsx/a',
      undefined,
    ],
    [
      'an address that names the salons further down',
      `/account/salons/${SALON_ID}`,
      undefined,
    ],
  ])('should find the salon of %s', (_case, pathname, salonId) => {
    // Act, Assert
    expect(salonIdIn(pathname)).toBe(salonId)
  })
})
