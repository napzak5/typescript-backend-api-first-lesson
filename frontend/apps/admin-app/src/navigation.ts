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

/** The screen that moves a booking to another time or another member of the staff. */
export const bookingMoveHrefOf = (salonId: string, bookingId: string): string =>
  `${bookingHrefOf(salonId, bookingId)}/reschedule`

/** The screen that adds a line to a booking. */
export const lineEntryHrefOf = (salonId: string, bookingId: string): string =>
  `${bookingHrefOf(salonId, bookingId)}/services/new`

/** A line of a booking. */
export const lineHrefOf = (
  salonId: string,
  bookingId: string,
  lineId: string,
): string => `${bookingHrefOf(salonId, bookingId)}/services/${lineId}`

/** The screen that puts a booking into the ledger of a salon, opened on a day. */
export const bookingEntryHrefOf = (salonId: string, date: string): string =>
  `${bookingsHrefOf(salonId)}/new?date=${date}`

/** The screen that enters the sale of a booking. */
export const checkoutHrefOf = (salonId: string, bookingId: string): string =>
  `${bookingHrefOf(salonId, bookingId)}/checkout`

/** The ledger of the sales of a salon. */
export const salesHrefOf = (salonId: string): string =>
  `/salons/${salonId}/sales`

/** A sale of a salon. */
export const saleHrefOf = (salonId: string, saleId: string): string =>
  `${salesHrefOf(salonId)}/${saleId}`

/** The screen that records a payment of a sale. */
export const paymentEntryHrefOf = (salonId: string, saleId: string): string =>
  `${saleHrefOf(salonId, saleId)}/payments/new`

/** The receipt of a sale. */
export const receiptHrefOf = (salonId: string, saleId: string): string =>
  `${saleHrefOf(salonId, saleId)}/receipt`

/** The screen that changes a sale: the member who took it, its time, its note. */
export const saleChangeHrefOf = (salonId: string, saleId: string): string =>
  `${saleHrefOf(salonId, saleId)}/edit`

/** The screen that gives a payment of a sale back. */
export const refundHrefOf = (
  salonId: string,
  saleId: string,
  paymentId: string,
): string => `${saleHrefOf(salonId, saleId)}/payments/${paymentId}/refund`

/** Whether an address is that of a screen, or of one below it. */
const isAtOrBelow = (pathname: string, screen: string): boolean =>
  pathname === screen || pathname.startsWith(`${screen}/`)

const SALON_ROLES: readonly string[] = ['owner', 'manager', 'staff']

/**
 * The links of the header: the bookings and the sales of the salon of the
 * address. The screens of a salon are below its address;
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
    const sales = salesHrefOf(salonId)

    return [
      ...choice,
      {
        href: bookings,
        label: '予約',
        current: isAtOrBelow(pathname, bookings),
      },
      { href: sales, label: '売上', current: isAtOrBelow(pathname, sales) },
    ]
  }

  return role !== undefined && SALON_ROLES.includes(role)
    ? [...choice, { href: '/', label: '予約', current: false }]
    : choice
}
