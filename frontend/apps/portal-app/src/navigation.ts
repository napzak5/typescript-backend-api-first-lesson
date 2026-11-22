import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { isAtOrBelow } from '@beauty-salon-frontend/app-frame'
import type { NavigationItem } from '@beauty-salon-frontend/ui'

/**
 * The links of the header. They are for a customer who is signed in: the
 * search, the bookings of the customer, and what the salons know of them.
 * A visitor has the search in front of them and nothing else to go to, and
 * the screens of a customer are of no use to an account of another role.
 *
 * A link is the current one on every screen below it: the page of a salon
 * and the screen that books belong to the search, the page of a booking to
 * the bookings, the form of the profile to the page of the customer.
 */
export const navigationFor = (
  role: ModelsUserResponse['role'] | undefined,
  pathname: string,
): NavigationItem[] => {
  if (role !== 'customer') {
    return []
  }

  return [
    {
      href: '/',
      label: 'サロンを探す',
      current: pathname === '/' || pathname.startsWith('/salons/'),
    },
    {
      href: '/bookings',
      label: '予約の一覧',
      current: isAtOrBelow(pathname, '/bookings'),
    },
    {
      href: '/mypage',
      label: 'マイページ',
      current: isAtOrBelow(pathname, '/mypage'),
    },
  ]
}
