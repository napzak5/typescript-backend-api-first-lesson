import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { NavigationItem } from '@beauty-salon-frontend/ui'

/**
 * The links of the header. They are for a customer who is signed in: the
 * search, and the bookings of the customer. A visitor has the search in
 * front of them and nothing else to go to, and the screens of a booking
 * are of no use to an account of another role.
 *
 * A link is the current one on every screen below it: the page of a salon
 * and the screen that books belong to the search, the page of a booking to
 * the bookings.
 */
export const navigationFor = (
  role: ModelsUserResponse['role'] | undefined,
  pathname: string,
): NavigationItem[] => {
  if (role !== 'customer') {
    return []
  }
  const ofBookings =
    pathname === '/bookings' || pathname.startsWith('/bookings/')

  return [
    {
      href: '/',
      label: 'サロンを探す',
      current: pathname === '/' || pathname.startsWith('/salons/'),
    },
    { href: '/bookings', label: '予約の一覧', current: ofBookings },
  ]
}
