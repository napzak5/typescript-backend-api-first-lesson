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

/** The ledger of the customers, from the screens of a salon. */
export const customersHrefOf = (salonId: string): string =>
  `/salons/${salonId}/customers`

/** The screen that registers a customer in the ledger. */
export const customerEntryHrefOf = (salonId: string): string =>
  `${customersHrefOf(salonId)}/new`

/** The screen that registers the customers of a CSV file at once. */
export const customerImportHrefOf = (salonId: string): string =>
  `${customersHrefOf(salonId)}/import`

/** A customer of the ledger, from the screens of a salon. */
export const customerHrefOf = (salonId: string, customerId: string): string =>
  `${customersHrefOf(salonId)}/${customerId}`

/** The screen that changes what the ledger holds of a customer. */
export const customerChangeHrefOf = (
  salonId: string,
  customerId: string,
): string => `${customerHrefOf(salonId, customerId)}/edit`

/** The screen that changes what a customer wishes for. */
export const customerPreferencesHrefOf = (
  salonId: string,
  customerId: string,
): string => `${customerHrefOf(salonId, customerId)}/preferences`

/** The history of the versions of a customer. */
export const customerHistoryHrefOf = (
  salonId: string,
  customerId: string,
): string => `${customerHrefOf(salonId, customerId)}/history`

/** A version of a customer. */
export const customerVersionHrefOf = (
  salonId: string,
  customerId: string,
  version: number,
): string => `${customerHistoryHrefOf(salonId, customerId)}/${version}`

/** The points of a customer: the balance, the points that expire soon and the history. */
export const customerPointsHrefOf = (
  salonId: string,
  customerId: string,
): string => `${customerHrefOf(salonId, customerId)}/points`

/** The chart of a customer: what the staff makes sure of before a treatment. */
export const chartHrefOf = (salonId: string, customerId: string): string =>
  `${customerHrefOf(salonId, customerId)}/chart`

/** The screen that makes the chart of a customer. */
export const chartEntryHrefOf = (salonId: string, customerId: string): string =>
  `${chartHrefOf(salonId, customerId)}/new`

/** The screen that changes the chart of a customer. */
export const chartChangeHrefOf = (
  salonId: string,
  customerId: string,
): string => `${chartHrefOf(salonId, customerId)}/edit`

/** The search of the charts of the customers. */
export const chartSearchHrefOf = (salonId: string): string =>
  `${customersHrefOf(salonId)}/charts`

/** What the screen that merges two customers searched the ledger for, and the customer chosen to merge with. */
export type MergeChoice = {
  keyword: string | undefined
  otherId: string | undefined
}

/** The screen that merges a customer with another record of the same person. */
export const customerMergeHrefOf = (
  salonId: string,
  customerId: string,
  { keyword, otherId }: MergeChoice = {
    keyword: undefined,
    otherId: undefined,
  },
): string => {
  const query = new URLSearchParams([
    ...(keyword === undefined ? [] : [['keyword', keyword]]),
    ...(otherId === undefined ? [] : [['with', otherId]]),
  ])
  const search = query.toString()

  return `${customerHrefOf(salonId, customerId)}/merge${search === '' ? '' : `?${search}`}`
}

/** The sale points are recorded for, and what is recorded at first. */
export type PointsOfSale = { saleId: string; kind: 'earned' | 'used' }

/** The screen that records points of a customer: for a sale, when the page of the sale leads to it. */
export const pointEntryHrefOf = (
  salonId: string,
  customerId: string,
  ofSale?: PointsOfSale,
): string =>
  `${customerPointsHrefOf(salonId, customerId)}/new${
    ofSale === undefined
      ? ''
      : `?${new URLSearchParams({ saleId: ofSale.saleId, kind: ofSale.kind })}`
  }`

/** The screen that puts a booking into the ledger of a salon for a customer, opened on a day. */
export const bookingOfCustomerHrefOf = (
  salonId: string,
  date: string,
  customerId: string,
): string => `${bookingEntryHrefOf(salonId, date)}&customerId=${customerId}`

/** Whether an address is that of a screen, or of one below it. */
const isAtOrBelow = (pathname: string, screen: string): boolean =>
  pathname === screen || pathname.startsWith(`${screen}/`)

const SALON_ROLES: readonly string[] = ['owner', 'manager', 'staff']

/**
 * The links of the header: the bookings, the sales and the customers, from
 * the salon of the address. The screens of a salon are below its address;
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
    const customers = customersHrefOf(salonId)

    return [
      ...choice,
      {
        href: bookings,
        label: '予約',
        current: isAtOrBelow(pathname, bookings),
      },
      { href: sales, label: '売上', current: isAtOrBelow(pathname, sales) },
      {
        href: customers,
        label: '顧客',
        current: isAtOrBelow(pathname, customers),
      },
    ]
  }

  return role !== undefined && SALON_ROLES.includes(role)
    ? [...choice, { href: '/', label: '予約', current: false }]
    : choice
}
