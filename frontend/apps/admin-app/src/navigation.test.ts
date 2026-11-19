import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { bookingsHrefOf, navigationFor, salonIdIn } from './navigation'

const SALON_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'
const BOOKINGS = `/salons/${SALON_ID}/bookings`

type Role = ModelsUserResponse['role']

const MEMBERS: Role[] = ['owner', 'manager', 'staff']

const NO_LINKS: [string, Role | undefined][] = [
  ['nobody is signed in', undefined],
  ['the account is of a customer', 'customer'],
]

describe('salonIdIn', () => {
  it.each([
    ['the bookings of a salon', BOOKINGS, SALON_ID],
    ['a booking', `${BOOKINGS}/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c02`, SALON_ID],
    ['the address of the salon itself', `/salons/${SALON_ID}`, SALON_ID],
    ['the start', '/', undefined],
    ['the security of the account', '/account/security', undefined],
    [
      'an address that only begins with the same letters',
      '/salonsx/a',
      undefined,
    ],
  ])('should find the salon of %s', (_case, pathname, salonId) => {
    expect(salonIdIn(pathname)).toBe(salonId)
  })
})

describe('navigationFor', () => {
  it('should lead an administrator to the choice of a salon, and to the bookings of the salon chosen', () => {
    expect(navigationFor('admin', `${BOOKINGS}/x`)).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: false },
      { href: BOOKINGS, label: '予約', current: true },
    ])
  })

  it('should mark the choice of a salon as the screen an administrator is on', () => {
    expect(navigationFor('admin', '/')).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: true },
    ])
  })

  it.each(MEMBERS)(
    'should lead a member of the staff (%s) to the bookings of the salon of the address',
    (role) => {
      expect(navigationFor(role, BOOKINGS)).toEqual([
        { href: BOOKINGS, label: '予約', current: true },
      ])
    },
  )

  it('should lead a member of the staff who is elsewhere to the bookings through the start', () => {
    expect(navigationFor('staff', '/account/security')).toEqual([
      { href: '/', label: '予約', current: false },
    ])
  })

  it.each(NO_LINKS)('should offer no link when %s', (_case, role) => {
    expect(navigationFor(role, '/')).toEqual([])
  })

  it('should leave the link of a salon not current on a screen of another kind below it', () => {
    expect(navigationFor('owner', `/salons/${SALON_ID}`)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
    ])
  })

  it('should write the address of the bookings of a salon', () => {
    expect(bookingsHrefOf(SALON_ID)).toBe(BOOKINGS)
  })
})
