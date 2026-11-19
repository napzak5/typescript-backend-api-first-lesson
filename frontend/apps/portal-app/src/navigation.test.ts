import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { navigationFor } from './navigation'

const BOOKING_ID = 'e7092b3c-68fd-4a13-9b35-d7f902245846'
const SALON_ID = '0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'

/** The labels of the links that are the current ones. */
const currentAt = (pathname: string): string[] =>
  navigationFor('customer', pathname).flatMap(({ label, current }) =>
    current === true ? [label] : [],
  )

describe('navigationFor', () => {
  it('should lead a customer to the search and to their bookings', () => {
    expect(
      navigationFor('customer', '/').map(({ href, label }) => [href, label]),
    ).toEqual([
      ['/', 'サロンを探す'],
      ['/bookings', '予約の一覧'],
    ])
  })

  it('should have no link for a visitor', () => {
    expect(navigationFor(undefined, '/')).toEqual([])
  })

  it.each<ModelsUserResponse['role']>(['staff', 'manager', 'owner', 'admin'])(
    'should have no link for an account of the role %s: the bookings of a customer are of no use to it',
    (role) => {
      expect(navigationFor(role, '/bookings')).toEqual([])
    },
  )

  it.each([
    ['the search', '/', ['サロンを探す']],
    ['the page of a salon', `/salons/${SALON_ID}`, ['サロンを探す']],
    [
      'the screen that books',
      `/salons/${SALON_ID}/services/${BOOKING_ID}/booking`,
      ['サロンを探す'],
    ],
    ['the bookings', '/bookings', ['予約の一覧']],
    ['the page of a booking', `/bookings/${BOOKING_ID}`, ['予約の一覧']],
    [
      'the screen that moves a booking',
      `/bookings/${BOOKING_ID}/reschedule`,
      ['予約の一覧'],
    ],
    ['the sign-in screen', '/sign-in', []],
    ['a screen that is not there', '/bookings-of-others', []],
    ['an address that only begins like the salons', '/salons', []],
  ])('should mark the link of %s', (_case, pathname, current) => {
    expect(currentAt(pathname)).toEqual(current)
  })
})
