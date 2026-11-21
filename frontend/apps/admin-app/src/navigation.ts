import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { NavigationItem } from '@beauty-salon-frontend/ui'
import { mayKeepStaffLedger } from './staff/staff-format'

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

/** The screen that writes the treatment record of a booking. */
export const treatmentEntryHrefOf = (
  salonId: string,
  bookingId: string,
): string => `${bookingHrefOf(salonId, bookingId)}/treatment/new`

/** The treatment records of a salon. */
export const treatmentsHrefOf = (salonId: string): string =>
  `/salons/${salonId}/treatments`

/** The treatment records of a salon that one customer had. */
export const treatmentsOfCustomerHrefOf = (
  salonId: string,
  customerId: string,
): string => `${treatmentsHrefOf(salonId)}?customer=${customerId}`

/** A treatment record of a salon. */
export const treatmentHrefOf = (salonId: string, treatmentId: string): string =>
  `${treatmentsHrefOf(salonId)}/${treatmentId}`

/** The screen that changes a treatment record. */
export const treatmentChangeHrefOf = (
  salonId: string,
  treatmentId: string,
): string => `${treatmentHrefOf(salonId, treatmentId)}/edit`

/** The screen that adds photos to a treatment record. */
export const treatmentPhotosHrefOf = (
  salonId: string,
  treatmentId: string,
): string => `${treatmentHrefOf(salonId, treatmentId)}/photos/new`

/** The treatment records of a salon, counted. */
export const treatmentStatisticsHrefOf = (salonId: string): string =>
  `${treatmentsHrefOf(salonId)}/statistics`

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

/** The staff ledger of a salon. */
export const staffLedgerHrefOf = (salonId: string): string =>
  `/salons/${salonId}/staff`

/** The screen that registers a member in the staff ledger. */
export const staffEntryHrefOf = (salonId: string): string =>
  `${staffLedgerHrefOf(salonId)}/new`

/** A member of the staff ledger. */
export const staffMemberHrefOf = (salonId: string, staffId: string): string =>
  `${staffLedgerHrefOf(salonId)}/${staffId}`

/** The screen that changes what the ledger holds of a member. */
export const staffChangeHrefOf = (salonId: string, staffId: string): string =>
  `${staffMemberHrefOf(salonId, staffId)}/edit`

/** The account a member of the staff signs in with, and the invitation that makes it. */
export const staffAccountHrefOf = (salonId: string, staffId: string): string =>
  `${staffMemberHrefOf(salonId, staffId)}/account`

/** The shifts of a salon: the week of today at the salon. */
export const shiftsHrefOf = (salonId: string): string =>
  `/salons/${salonId}/shifts`

/** The shifts of a salon in the week that begins on a Monday. */
export const shiftWeekHrefOf = (salonId: string, monday: string): string =>
  `${shiftsHrefOf(salonId)}?week=${monday}`

/** The schedule of a member of the staff: when they work, every week and on dates. */
export const scheduleHrefOf = (salonId: string, staffId: string): string =>
  `${shiftsHrefOf(salonId)}/${staffId}`

/** The screen that changes the schedule of a member. */
export const scheduleChangeHrefOf = (
  salonId: string,
  staffId: string,
): string => `${scheduleHrefOf(salonId, staffId)}/edit`

/** The settings of a salon: its information, its hours and its calendar. */
export const settingsHrefOf = (salonId: string): string =>
  `/salons/${salonId}/settings`

/** The screen that changes the information of a salon. */
export const salonChangeHrefOf = (salonId: string): string =>
  `${settingsHrefOf(salonId)}/edit`

/** The screen that changes the hours of a salon: its week and its calendar. */
export const hoursChangeHrefOf = (salonId: string): string =>
  `${settingsHrefOf(salonId)}/hours`

/** The payment methods of a salon. */
export const paymentMethodsHrefOf = (salonId: string): string =>
  `${settingsHrefOf(salonId)}/payment-methods`

/** The screen that adds a payment method to a salon. */
export const paymentMethodEntryHrefOf = (salonId: string): string =>
  `${paymentMethodsHrefOf(salonId)}/new`

/** A payment method of a salon. */
export const paymentMethodHrefOf = (
  salonId: string,
  paymentMethodId: string,
): string => `${paymentMethodsHrefOf(salonId)}/${paymentMethodId}`

/** The screen that changes a payment method, and removes it. */
export const paymentMethodChangeHrefOf = (
  salonId: string,
  paymentMethodId: string,
): string => `${paymentMethodHrefOf(salonId, paymentMethodId)}/edit`

/** The product ledger of a salon: what it sells and what its treatments use. */
export const productsHrefOf = (salonId: string): string =>
  `/salons/${salonId}/products`

/** The screen that adds a product to the ledger. */
export const productEntryHrefOf = (salonId: string): string =>
  `${productsHrefOf(salonId)}/new`

/** A product of the ledger. */
export const productHrefOf = (salonId: string, productId: string): string =>
  `${productsHrefOf(salonId)}/${productId}`

/** The screen that changes a product, and removes it. */
export const productChangeHrefOf = (
  salonId: string,
  productId: string,
): string => `${productHrefOf(salonId, productId)}/edit`

/** The stock of a salon: a row for each lot of each product it keeps. */
export const inventoryHrefOf = (salonId: string): string =>
  `/salons/${salonId}/inventory`

/** The screen that adds a stock row. */
export const stockEntryHrefOf = (salonId: string): string =>
  `${inventoryHrefOf(salonId)}/new`

/** The count of the stock of a salon. */
export const stockCountHrefOf = (salonId: string): string =>
  `${inventoryHrefOf(salonId)}/count`

/** What the stock of a salon is worth, by the categories of its products. */
export const stockValueHrefOf = (salonId: string): string =>
  `${inventoryHrefOf(salonId)}/value`

/** The alerts of the stock of a salon. */
export const stockAlertsHrefOf = (salonId: string): string =>
  `${inventoryHrefOf(salonId)}/alerts`

/** A stock row of a salon. */
export const stockRowHrefOf = (salonId: string, inventoryId: string): string =>
  `${inventoryHrefOf(salonId)}/${inventoryId}`

/** The screen that changes a stock row, and removes it. */
export const stockRowChangeHrefOf = (
  salonId: string,
  inventoryId: string,
): string => `${stockRowHrefOf(salonId, inventoryId)}/edit`

/** The purchase orders of a salon. */
export const purchaseOrdersHrefOf = (salonId: string): string =>
  `/salons/${salonId}/purchase-orders`

/** The screen that makes a purchase order. */
export const purchaseOrderEntryHrefOf = (salonId: string): string =>
  `${purchaseOrdersHrefOf(salonId)}/new`

/** A purchase order of a salon. */
export const purchaseOrderHrefOf = (
  salonId: string,
  purchaseOrderId: string,
): string => `${purchaseOrdersHrefOf(salonId)}/${purchaseOrderId}`

/** The screen that changes the day of the delivery and the notes of a purchase order. */
export const orderChangeHrefOf = (
  salonId: string,
  purchaseOrderId: string,
): string => `${purchaseOrderHrefOf(salonId, purchaseOrderId)}/edit`

/** The movements of a stock row, the latest first. */
export const stockMovementsHrefOf = (
  salonId: string,
  inventoryId: string,
): string => `${stockRowHrefOf(salonId, inventoryId)}/movements`

/** The screen that records a movement of a stock row. */
export const movementEntryHrefOf = (
  salonId: string,
  inventoryId: string,
): string => `${stockMovementsHrefOf(salonId, inventoryId)}/new`

/** The menu of a salon: its categories and their services. */
export const menuHrefOf = (salonId: string): string => `/salons/${salonId}/menu`

/** A service of the menu, with everything the menu keeps of it. */
export const serviceHrefOf = (salonId: string, serviceId: string): string =>
  `${menuHrefOf(salonId)}/services/${serviceId}`

/** The screen that adds a service to the menu. */
export const serviceEntryHrefOf = (salonId: string): string =>
  `${menuHrefOf(salonId)}/services/new`

/** The screen that gives several services of the menu the same values. */
export const servicesChangeHrefOf = (salonId: string): string =>
  `${menuHrefOf(salonId)}/services/bulk`

/** The screen that changes a service of the menu, and removes it. */
export const serviceChangeHrefOf = (
  salonId: string,
  serviceId: string,
): string => `${serviceHrefOf(salonId, serviceId)}/edit`

/** The screen that adds a category to the menu. */
export const categoryEntryHrefOf = (salonId: string): string =>
  `${menuHrefOf(salonId)}/categories/new`

/** The screen that changes a category of the menu, and removes it. */
export const categoryChangeHrefOf = (
  salonId: string,
  categoryId: string,
): string => `${menuHrefOf(salonId)}/categories/${categoryId}/edit`

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

/** The screen that records an allergy of a customer, below the chart. */
export const allergyEntryHrefOf = (
  salonId: string,
  customerId: string,
): string => `${chartHrefOf(salonId, customerId)}/allergies/new`

/** The screen that changes an allergy of a customer. */
export const allergyChangeHrefOf = (
  salonId: string,
  customerId: string,
  allergyId: string,
): string => `${chartHrefOf(salonId, customerId)}/allergies/${allergyId}/edit`

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

/** Where a member of the staff sees and changes how they are introduced to the customers */
export const OWN_PROFILE_PATH = '/account/profile'

/**
 * The links of the header: the bookings, the sales, the customers, the
 * treatment records, the shifts, the menu, the products and the stock, from the salon of the address, and the
 * staff ledger for the roles that keep it. The screens of a salon are below its address;
 * an administrator chooses the salon at the start (`/`), and a member of
 * the staff is led from there to the salon they belong to. So a member who
 * is elsewhere (the security of the account, the profile) goes back to the
 * bookings through the start. A member of a salon is led to their own
 * profile last, wherever they are; an administrator is a member of none.
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
  const member = role !== undefined && SALON_ROLES.includes(role)
  const profile: NavigationItem[] = member
    ? [
        {
          href: OWN_PROFILE_PATH,
          label: 'プロフィール',
          current: pathname === OWN_PROFILE_PATH,
        },
      ]
    : []
  if (salonId !== undefined) {
    const bookings = bookingsHrefOf(salonId)
    const sales = salesHrefOf(salonId)
    const customers = customersHrefOf(salonId)
    const treatments = treatmentsHrefOf(salonId)
    const shifts = shiftsHrefOf(salonId)
    const menu = menuHrefOf(salonId)
    const products = productsHrefOf(salonId)
    const inventory = inventoryHrefOf(salonId)
    const purchaseOrders = purchaseOrdersHrefOf(salonId)
    const staff = staffLedgerHrefOf(salonId)
    const settings = settingsHrefOf(salonId)

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
      {
        href: treatments,
        label: '施術記録',
        current: isAtOrBelow(pathname, treatments),
      },
      {
        href: shifts,
        label: 'シフト',
        current: isAtOrBelow(pathname, shifts),
      },
      { href: menu, label: 'メニュー', current: isAtOrBelow(pathname, menu) },
      {
        href: products,
        label: '商品',
        current: isAtOrBelow(pathname, products),
      },
      {
        href: inventory,
        label: '在庫',
        current: isAtOrBelow(pathname, inventory),
      },
      {
        href: purchaseOrders,
        label: '発注',
        current: isAtOrBelow(pathname, purchaseOrders),
      },
      ...(role !== undefined && mayKeepStaffLedger(role)
        ? [
            {
              href: staff,
              label: 'スタッフ',
              current: isAtOrBelow(pathname, staff),
            },
          ]
        : []),
      {
        href: settings,
        label: '設定',
        current: isAtOrBelow(pathname, settings),
      },
      ...profile,
    ]
  }

  return member
    ? [...choice, { href: '/', label: '予約', current: false }, ...profile]
    : choice
}
