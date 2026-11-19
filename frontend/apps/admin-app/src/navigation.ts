import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { NavigationItem } from '@beauty-salon-frontend/ui'

/** The start of the addresses of the screens of one salon. */
const SALON_PATH = /^\/salons\/([^/]+)(?:\/|$)/

/** The salon whose screens an address is of, if it is one of them. */
export const salonIdIn = (pathname: string): string | undefined =>
  SALON_PATH.exec(pathname)?.[1]

/** The bookings of a salon: where its screens begin. */
export const bookingsHrefOf = (salonId: string): string =>
  `/salons/${salonId}/bookings`

/** A booking of a salon. */
export const bookingHrefOf = (salonId: string, bookingId: string): string =>
  `${bookingsHrefOf(salonId)}/${bookingId}`

/** The screen that puts a booking into the ledger of a salon, opened on a day. */
export const bookingEntryHrefOf = (salonId: string, date: string): string =>
  `${bookingsHrefOf(salonId)}/new?date=${date}`

/** Whether an address is that of a screen, or of one below it. */
const isAtOrBelow = (pathname: string, screen: string): boolean =>
  pathname === screen || pathname.startsWith(`${screen}/`)

const SALON_ROLES: readonly string[] = ['owner', 'manager', 'staff']

/**
 * The links of the header. The screens of a salon are below its address;
 * an administrator chooses the salon at the start (`/`), and a member of
 * the staff is led from there to the salon they belong to. So a member who
 * is elsewhere (the security of the account) goes back to the bookings
 * through the start.
 */
export const navigationFor = (
  role: ModelsUserResponse['role'] | undefined,
  pathname: string,
): NavigationItem[] => {
  const salonId = salonIdIn(pathname)
  const choice: NavigationItem[] =
    role === 'admin'
      ? [{ href: '/', label: 'サロンを選ぶ', current: pathname === '/' }]
      : []
  if (salonId !== undefined) {
    const bookings = bookingsHrefOf(salonId)

    return [
      ...choice,
      {
        href: bookings,
        label: '予約',
        current: isAtOrBelow(pathname, bookings),
      },
    ]
  }

  return role !== undefined && SALON_ROLES.includes(role)
    ? [...choice, { href: '/', label: '予約', current: false }]
    : choice
}
