import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { navigationFor } from './navigation'

const BOOKING_ID = 'e7092b3c-68fd-4a13-9b35-d7f902245846'
const SALON_ID = '0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'

const SEARCH = { en: 'Find a salon', ja: 'サロンを探す' }
const BOOKINGS = { en: 'Your bookings', ja: '予約の一覧' }
const MY_PAGE = { en: 'My page', ja: 'マイページ' }

/** The labels of the links that are the current ones. */
const currentAt = (pathname: string): LocalizedText[] =>
  navigationFor('customer', pathname).flatMap(({ label, current }) =>
    current === true ? [label] : [],
  )

describe('navigationFor', () => {
  it('should lead a customer to the search, to their bookings and to their own page', () => {
    expect(
      navigationFor('customer', '/').map(({ href, label }) => [href, label]),
    ).toEqual([
      ['/', SEARCH],
      ['/bookings', BOOKINGS],
      ['/mypage', MY_PAGE],
    ])
  })

  it('should have no link for a visitor', () => {
    expect(navigationFor(undefined, '/')).toEqual([])
  })

  it.each<ModelsUserResponse['role']>(['staff', 'manager', 'owner', 'admin'])(
    'should have no link for an account of the role %s: the screens of a customer are of no use to it',
    (role) => {
      expect(navigationFor(role, '/bookings')).toEqual([])
      expect(navigationFor(role, '/mypage')).toEqual([])
    },
  )

  it.each<[string, string, LocalizedText[]]>([
    ['the search', '/', [SEARCH]],
    ['the page of a salon', `/salons/${SALON_ID}`, [SEARCH]],
    [
      'the screen that books',
      `/salons/${SALON_ID}/services/${BOOKING_ID}/booking`,
      [SEARCH],
    ],
    ['the bookings', '/bookings', [BOOKINGS]],
    ['the page of a booking', `/bookings/${BOOKING_ID}`, [BOOKINGS]],
    [
      'the screen that moves a booking',
      `/bookings/${BOOKING_ID}/reschedule`,
      [BOOKINGS],
    ],
    ['the page of the customer', '/mypage', [MY_PAGE]],
    ['the form of the profile', '/mypage/profile', [MY_PAGE]],
    ['the sign-in screen', '/sign-in', []],
    ['a screen that is not there', '/bookings-of-others', []],
    [
      'an address that only begins like the page of the customer',
      '/mypages',
      [],
    ],
    ['an address that only begins like the salons', '/salons', []],
  ])('should mark the link of %s', (_case, pathname, current) => {
    expect(currentAt(pathname)).toEqual(current)
  })
})
