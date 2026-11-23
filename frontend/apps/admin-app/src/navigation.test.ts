import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import type { NavigationOf } from '@beauty-salon-frontend/app-frame'
import { describe, expect, it } from 'vitest'
import {
  attachmentHrefOf,
  attachmentsHrefOf,
  bookingOfCustomerHrefOf,
  bookingsHrefOf,
  categoryChangeHrefOf,
  categoryEntryHrefOf,
  customerChangeHrefOf,
  customerEntryHrefOf,
  customerHistoryHrefOf,
  customerHrefOf,
  customerImportHrefOf,
  customerPointsHrefOf,
  customerPreferencesHrefOf,
  customersHrefOf,
  customerVersionHrefOf,
  hoursChangeHrefOf,
  inventoryHrefOf,
  navigationFor as linksFor,
  menuHrefOf,
  movementEntryHrefOf,
  OPERATIONS_PATH,
  orderChangeHrefOf,
  orderReceiptHrefOf,
  paymentMethodChangeHrefOf,
  paymentMethodEntryHrefOf,
  paymentMethodHrefOf,
  paymentMethodsHrefOf,
  pointEntryHrefOf,
  productChangeHrefOf,
  productEntryHrefOf,
  productHrefOf,
  productsHrefOf,
  purchaseOrderEntryHrefOf,
  purchaseOrderHrefOf,
  purchaseOrdersHrefOf,
  receiptHrefOf,
  refundHrefOf,
  reorderSuggestionsHrefOf,
  reviewHrefOf,
  reviewResponseHrefOf,
  reviewsHrefOf,
  SALON_ENTRY_PATH,
  saleChangeHrefOf,
  salesHrefOf,
  salonChangeHrefOf,
  scheduleChangeHrefOf,
  scheduleHrefOf,
  serviceChangeHrefOf,
  serviceEntryHrefOf,
  serviceHrefOf,
  servicesChangeHrefOf,
  settingsHrefOf,
  shareLinkEntryHrefOf,
  shareLinkHrefOf,
  shiftsHrefOf,
  shiftWeekHrefOf,
  staffAccountHrefOf,
  staffChangeHrefOf,
  staffEntryHrefOf,
  staffLedgerHrefOf,
  staffMemberHrefOf,
  stockAlertsHrefOf,
  stockCountHrefOf,
  stockEntryHrefOf,
  stockMovementsHrefOf,
  stockRowChangeHrefOf,
  stockRowHrefOf,
  stockValueHrefOf,
  suggestedOrderHrefOf,
  treatmentChangeHrefOf,
  treatmentEntryHrefOf,
  treatmentHrefOf,
  treatmentPhotosHrefOf,
  treatmentStatisticsHrefOf,
  treatmentsHrefOf,
  treatmentsOfCustomerHrefOf,
} from './navigation'

/** The links of the header, named as a page in Japanese names them */
const navigationFor = (...address: Parameters<NavigationOf>) =>
  linksFor(...address).map(({ label, ...link }) => ({
    ...link,
    label: label.ja,
  }))

const SALON_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'
const BOOKINGS = `/salons/${SALON_ID}/bookings`
const SALES = `/salons/${SALON_ID}/sales`
const CUSTOMERS = `/salons/${SALON_ID}/customers`
const REVIEWS = `/salons/${SALON_ID}/reviews`
const FILES = `/salons/${SALON_ID}/files`
const TREATMENTS = `/salons/${SALON_ID}/treatments`
const SHIFTS = `/salons/${SALON_ID}/shifts`
const STAFF = `/salons/${SALON_ID}/staff`
const MENU = `/salons/${SALON_ID}/menu`
const PRODUCTS = `/salons/${SALON_ID}/products`
const INVENTORY = `/salons/${SALON_ID}/inventory`
const PURCHASE_ORDERS = `/salons/${SALON_ID}/purchase-orders`
const SETTINGS = `/salons/${SALON_ID}/settings`
const SETTINGS_LINK = { href: SETTINGS, label: '設定', current: false }

/** The screen an administrator runs the platform with, after the choice of a salon */
const OPERATIONS = { href: '/operations', label: '運用', current: false }

type Role = ModelsUserResponse['role']

/** The roles of a salon that do not keep its staff ledger */
const NO_LEDGER_ROLES: Role[] = ['manager', 'staff']

/** The last link of a member of a salon: their own profile, not the screen they are on */
const PROFILE = {
  href: '/account/profile',
  label: 'プロフィール',
  current: false,
}

const NO_LINKS: [string, Role | undefined][] = [
  ['nobody is signed in', undefined],
  ['the account is of a customer', 'customer'],
]

describe('navigationFor', () => {
  it('should name the links in English too, in the order of the header', () => {
    // Act
    const names = linksFor('owner', BOOKINGS).map(({ label }) => label.en)

    // Assert
    expect(names).toEqual([
      'Bookings',
      'Sales',
      'Customers',
      'Reviews',
      'Files',
      'Treatment records',
      'Shifts',
      'Menu',
      'Products',
      'Inventory',
      'Purchase orders',
      'Staff',
      'Settings',
      'Profile',
    ])
  })

  it('should name the links of an administrator in English too', () => {
    // Act
    const names = linksFor('admin', '/').map(({ label }) => label.en)

    // Assert
    expect(names).toEqual(['Choose a salon', 'Operations'])
  })

  it('should lead an administrator to the choice of a salon, to the operations, and to the bookings, the sales, the customers, the treatment records, the shifts and the staff of the salon chosen', () => {
    expect(navigationFor('admin', `${BOOKINGS}/x`)).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: false },
      OPERATIONS,
      { href: BOOKINGS, label: '予約', current: true },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      { href: STAFF, label: 'スタッフ', current: false },
      SETTINGS_LINK,
    ])
  })

  it('should mark the choice of a salon as the screen an administrator is on', () => {
    expect(navigationFor('admin', '/')).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: true },
      OPERATIONS,
    ])
  })

  it.each<[string, string]>([
    ['the screen that adds a salon', SALON_ENTRY_PATH],
    ['what that screen would lead to', `${SALON_ENTRY_PATH}/x`],
  ])(
    'should lead an administrator to no screen of a salon from %s: no salon is added yet',
    (_case, pathname) => {
      expect(navigationFor('admin', pathname)).toEqual([
        { href: '/', label: 'サロンを選ぶ', current: false },
        OPERATIONS,
      ])
    },
  )

  it('should lead to the screens of a salon whose address only begins like the screen that adds one', () => {
    expect(
      navigationFor('admin', '/salons/newer/bookings').map(({ href }) => href),
    ).toContain('/salons/newer/bookings')
  })

  it('should mark the operations as the screen an administrator is on there', () => {
    expect(navigationFor('admin', OPERATIONS_PATH)).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: false },
      { ...OPERATIONS, current: true },
    ])
  })

  it.each(NO_LEDGER_ROLES)(
    'should lead a member of the staff (%s) to the bookings and the shifts of the salon of the address, and not to the staff ledger',
    (role) => {
      expect(navigationFor(role, BOOKINGS)).toEqual([
        { href: BOOKINGS, label: '予約', current: true },
        { href: SALES, label: '売上', current: false },
        { href: CUSTOMERS, label: '顧客', current: false },
        { href: REVIEWS, label: 'レビュー', current: false },
        { href: FILES, label: 'ファイル', current: false },
        { href: TREATMENTS, label: '施術記録', current: false },
        { href: SHIFTS, label: 'シフト', current: false },
        { href: MENU, label: 'メニュー', current: false },
        { href: PRODUCTS, label: '商品', current: false },
        { href: INVENTORY, label: '在庫', current: false },
        { href: PURCHASE_ORDERS, label: '発注', current: false },
        SETTINGS_LINK,
        PROFILE,
      ])
    },
  )

  it.each<[string, string]>([
    ['the ledger', STAFF],
    ['the registration of a member', staffEntryHrefOf(SALON_ID)],
    ['a member', staffMemberHrefOf(SALON_ID, 'x')],
    ['the change of a member', staffChangeHrefOf(SALON_ID, 'x')],
  ])(
    'should lead the owner to the staff ledger as well, and mark it as the screen of %s',
    (_case, pathname) => {
      expect(navigationFor('owner', pathname)).toEqual([
        { href: BOOKINGS, label: '予約', current: false },
        { href: SALES, label: '売上', current: false },
        { href: CUSTOMERS, label: '顧客', current: false },
        { href: REVIEWS, label: 'レビュー', current: false },
        { href: FILES, label: 'ファイル', current: false },
        { href: TREATMENTS, label: '施術記録', current: false },
        { href: SHIFTS, label: 'シフト', current: false },
        { href: MENU, label: 'メニュー', current: false },
        { href: PRODUCTS, label: '商品', current: false },
        { href: INVENTORY, label: '在庫', current: false },
        { href: PURCHASE_ORDERS, label: '発注', current: false },
        { href: STAFF, label: 'スタッフ', current: true },
        SETTINGS_LINK,
        PROFILE,
      ])
    },
  )

  it('should lead a member of the staff who is elsewhere to the bookings through the start', () => {
    expect(navigationFor('staff', '/account/security')).toEqual([
      { href: '/', label: '予約', current: false },
      PROFILE,
    ])
  })

  it.each<Role>(['owner', 'manager', 'staff'])(
    'should mark the profile as the screen a member (%s) is on there, after the way back to the bookings',
    (role) => {
      expect(navigationFor(role, '/account/profile')).toEqual([
        { href: '/', label: '予約', current: false },
        { ...PROFILE, current: true },
      ])
    },
  )

  it('should lead an administrator to no profile, as no salon has them as a member', () => {
    expect(
      navigationFor('admin', '/account/profile').map(({ label }) => label),
    ).toEqual(['サロンを選ぶ', '運用'])
  })

  it.each(NO_LINKS)('should offer no link when %s', (_case, role) => {
    expect(navigationFor(role, '/')).toEqual([])
  })

  it('should leave the link of a salon not current on a screen of another kind below it', () => {
    expect(navigationFor('owner', `/salons/${SALON_ID}`)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      { href: STAFF, label: 'スタッフ', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it.each([
    ['the ledger', SALES],
    ['the receipt of a sale', receiptHrefOf(SALON_ID, 'x')],
    ['the change of a sale', saleChangeHrefOf(SALON_ID, 'x')],
    ['a refund', refundHrefOf(SALON_ID, 'x', 'y')],
  ])('should mark the sales as the screen of %s', (_case, pathname) => {
    expect(navigationFor('manager', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: true },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it.each<[string, string]>([
    ['the ledger', CUSTOMERS],
    ['the registration of a customer', customerEntryHrefOf(SALON_ID)],
    ['the registration of a file', customerImportHrefOf(SALON_ID)],
    ['a customer', customerHrefOf(SALON_ID, 'x')],
    ['the change of a customer', customerChangeHrefOf(SALON_ID, 'x')],
    [
      'the change of the preferences of a customer',
      customerPreferencesHrefOf(SALON_ID, 'x'),
    ],
    ['the history of a customer', customerHistoryHrefOf(SALON_ID, 'x')],
    ['a version of a customer', customerVersionHrefOf(SALON_ID, 'x', 3)],
    ['the points of a customer', customerPointsHrefOf(SALON_ID, 'x')],
    ['the recording of points', pointEntryHrefOf(SALON_ID, 'x')],
  ])('should mark the customers as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: true },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it.each<[string, string]>([
    ['the records', TREATMENTS],
    ['the records of a customer', treatmentsOfCustomerHrefOf(SALON_ID, 'x')],
    ['a record', treatmentHrefOf(SALON_ID, 'x')],
    ['the change of a record', treatmentChangeHrefOf(SALON_ID, 'x')],
    ['the photos added to a record', treatmentPhotosHrefOf(SALON_ID, 'x')],
    ['the statistics', treatmentStatisticsHrefOf(SALON_ID)],
  ])(
    'should mark the treatment records as the screen of %s',
    (_case, address) => {
      const [pathname = ''] = address.split('?')
      expect(navigationFor('staff', pathname)).toEqual([
        { href: BOOKINGS, label: '予約', current: false },
        { href: SALES, label: '売上', current: false },
        { href: CUSTOMERS, label: '顧客', current: false },
        { href: REVIEWS, label: 'レビュー', current: false },
        { href: FILES, label: 'ファイル', current: false },
        { href: TREATMENTS, label: '施術記録', current: true },
        { href: SHIFTS, label: 'シフト', current: false },
        { href: MENU, label: 'メニュー', current: false },
        { href: PRODUCTS, label: '商品', current: false },
        { href: INVENTORY, label: '在庫', current: false },
        { href: PURCHASE_ORDERS, label: '発注', current: false },
        SETTINGS_LINK,
        PROFILE,
      ])
    },
  )

  it.each<[string, string]>([
    ['the week', SHIFTS],
    ['a schedule', scheduleHrefOf(SALON_ID, 'x')],
    ['the change of a schedule', scheduleChangeHrefOf(SALON_ID, 'x')],
  ])('should mark the shifts as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: true },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it('should mark the shifts, not the staff ledger, as the screen of the schedule of a member for the owner', () => {
    expect(navigationFor('owner', scheduleHrefOf(SALON_ID, 'x'))).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: true },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      { href: STAFF, label: 'スタッフ', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it('should write the treatment record of a booking below the booking, where the bookings are the screen', () => {
    const pathname = treatmentEntryHrefOf(SALON_ID, 'booking')

    expect(pathname).toBe(`${BOOKINGS}/booking/treatment/new`)
    expect(navigationFor('owner', pathname)[0]).toEqual({
      href: BOOKINGS,
      label: '予約',
      current: true,
    })
  })

  it('should write the addresses of the treatment records', () => {
    expect([
      treatmentsHrefOf(SALON_ID),
      treatmentsOfCustomerHrefOf(SALON_ID, 'customer'),
      treatmentHrefOf(SALON_ID, 'record'),
      treatmentChangeHrefOf(SALON_ID, 'record'),
      treatmentPhotosHrefOf(SALON_ID, 'record'),
      treatmentStatisticsHrefOf(SALON_ID),
    ]).toEqual([
      TREATMENTS,
      `${TREATMENTS}?customer=customer`,
      `${TREATMENTS}/record`,
      `${TREATMENTS}/record/edit`,
      `${TREATMENTS}/record/photos/new`,
      `${TREATMENTS}/statistics`,
    ])
  })

  it('should write the addresses of the staff ledger', () => {
    expect([
      staffLedgerHrefOf(SALON_ID),
      staffEntryHrefOf(SALON_ID),
      staffMemberHrefOf(SALON_ID, 'member'),
      staffChangeHrefOf(SALON_ID, 'member'),
      staffAccountHrefOf(SALON_ID, 'member'),
    ]).toEqual([
      STAFF,
      `${STAFF}/new`,
      `${STAFF}/member`,
      `${STAFF}/member/edit`,
      `${STAFF}/member/account`,
    ])
  })

  it('should mark the staff ledger as the screen of the account of a member', () => {
    expect(navigationFor('owner', staffAccountHrefOf(SALON_ID, 'x'))).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      { href: STAFF, label: 'スタッフ', current: true },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it.each<[string, string]>([
    ['the menu', MENU],
    ['a service', serviceHrefOf(SALON_ID, 'x')],
    ['a new service', serviceEntryHrefOf(SALON_ID)],
    ['the change of a service', serviceChangeHrefOf(SALON_ID, 'x')],
    ['the change of several services', servicesChangeHrefOf(SALON_ID)],
    ['a new category', categoryEntryHrefOf(SALON_ID)],
    ['the change of a category', categoryChangeHrefOf(SALON_ID, 'x')],
  ])('should mark the menu as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: true },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it.each<[string, string]>([
    ['the product ledger', PRODUCTS],
    ['a product', productHrefOf(SALON_ID, 'x')],
    ['a new product', productEntryHrefOf(SALON_ID)],
    ['the change of a product', productChangeHrefOf(SALON_ID, 'x')],
  ])('should mark the products as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: true },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it('should write the addresses of the products', () => {
    expect([
      productsHrefOf(SALON_ID),
      productEntryHrefOf(SALON_ID),
      productHrefOf(SALON_ID, 'product'),
      productChangeHrefOf(SALON_ID, 'product'),
    ]).toEqual([
      PRODUCTS,
      `${PRODUCTS}/new`,
      `${PRODUCTS}/product`,
      `${PRODUCTS}/product/edit`,
    ])
  })

  it.each<[string, string]>([
    ['the stock', INVENTORY],
    ['a stock row', stockRowHrefOf(SALON_ID, 'x')],
    ['a new stock row', stockEntryHrefOf(SALON_ID)],
    ['the change of a stock row', stockRowChangeHrefOf(SALON_ID, 'x')],
    ['the movements of a stock row', stockMovementsHrefOf(SALON_ID, 'x')],
    ['a new movement of a stock row', movementEntryHrefOf(SALON_ID, 'x')],
    ['the count of the stock', stockCountHrefOf(SALON_ID)],
    ['the value of the stock', stockValueHrefOf(SALON_ID)],
    ['the alerts of the stock', stockAlertsHrefOf(SALON_ID)],
  ])('should mark the stock as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: true },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it('should write the addresses of the stock', () => {
    expect([
      inventoryHrefOf(SALON_ID),
      stockEntryHrefOf(SALON_ID),
      stockRowHrefOf(SALON_ID, 'row'),
      stockRowChangeHrefOf(SALON_ID, 'row'),
      stockMovementsHrefOf(SALON_ID, 'row'),
      movementEntryHrefOf(SALON_ID, 'row'),
      stockCountHrefOf(SALON_ID),
      stockValueHrefOf(SALON_ID),
      stockAlertsHrefOf(SALON_ID),
    ]).toEqual([
      INVENTORY,
      `${INVENTORY}/new`,
      `${INVENTORY}/row`,
      `${INVENTORY}/row/edit`,
      `${INVENTORY}/row/movements`,
      `${INVENTORY}/row/movements/new`,
      `${INVENTORY}/count`,
      `${INVENTORY}/value`,
      `${INVENTORY}/alerts`,
    ])
  })

  it.each<[string, string]>([
    ['the purchase orders', PURCHASE_ORDERS],
    ['a new purchase order', purchaseOrderEntryHrefOf(SALON_ID)],
    ['a purchase order', purchaseOrderHrefOf(SALON_ID, 'x')],
    ['the change of a purchase order', orderChangeHrefOf(SALON_ID, 'x')],
    ['the receipt of a purchase order', orderReceiptHrefOf(SALON_ID, 'x')],
    ['the reorder suggestions', reorderSuggestionsHrefOf(SALON_ID)],
  ])(
    'should mark the purchase orders as the screen of %s',
    (_case, pathname) => {
      expect(navigationFor('staff', pathname)).toEqual([
        { href: BOOKINGS, label: '予約', current: false },
        { href: SALES, label: '売上', current: false },
        { href: CUSTOMERS, label: '顧客', current: false },
        { href: REVIEWS, label: 'レビュー', current: false },
        { href: FILES, label: 'ファイル', current: false },
        { href: TREATMENTS, label: '施術記録', current: false },
        { href: SHIFTS, label: 'シフト', current: false },
        { href: MENU, label: 'メニュー', current: false },
        { href: PRODUCTS, label: '商品', current: false },
        { href: INVENTORY, label: '在庫', current: false },
        { href: PURCHASE_ORDERS, label: '発注', current: true },
        SETTINGS_LINK,
        PROFILE,
      ])
    },
  )

  it('should write the addresses of the purchase orders', () => {
    expect([
      purchaseOrdersHrefOf(SALON_ID),
      purchaseOrderEntryHrefOf(SALON_ID),
      purchaseOrderHrefOf(SALON_ID, 'order'),
      orderChangeHrefOf(SALON_ID, 'order'),
      orderReceiptHrefOf(SALON_ID, 'order'),
      reorderSuggestionsHrefOf(SALON_ID),
    ]).toEqual([
      PURCHASE_ORDERS,
      `${PURCHASE_ORDERS}/new`,
      `${PURCHASE_ORDERS}/order`,
      `${PURCHASE_ORDERS}/order/edit`,
      `${PURCHASE_ORDERS}/order/receive`,
      `${PURCHASE_ORDERS}/suggestions`,
    ])
  })

  it('should write the address of a new purchase order that starts with the suggestions of a supplier', () => {
    expect([
      suggestedOrderHrefOf(SALON_ID, 'A&B 商事'),
      suggestedOrderHrefOf(SALON_ID, null),
    ]).toEqual([
      `${PURCHASE_ORDERS}/new?suggested=A%26B+%E5%95%86%E4%BA%8B`,
      `${PURCHASE_ORDERS}/new?suggested=`,
    ])
  })

  it.each<[string, string]>([
    ['the reviews', REVIEWS],
    ['a review', reviewHrefOf(SALON_ID, 'x')],
    ['the answer to a review', reviewResponseHrefOf(SALON_ID, 'x')],
  ])('should mark the reviews as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: true },
      { href: FILES, label: 'ファイル', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it('should write the addresses of the reviews', () => {
    expect([
      reviewsHrefOf(SALON_ID),
      reviewHrefOf(SALON_ID, 'review'),
      reviewResponseHrefOf(SALON_ID, 'review'),
    ]).toEqual([REVIEWS, `${REVIEWS}/review`, `${REVIEWS}/review/response`])
  })

  it.each<[string, string]>([
    ['the files', FILES],
    ['a file', attachmentHrefOf(SALON_ID, 'x')],
    ['the issue of a share link', shareLinkEntryHrefOf(SALON_ID, 'x')],
    ['a share link', shareLinkHrefOf(SALON_ID, 'x', 'y')],
  ])('should mark the files as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: REVIEWS, label: 'レビュー', current: false },
      { href: FILES, label: 'ファイル', current: true },
      { href: TREATMENTS, label: '施術記録', current: false },
      { href: SHIFTS, label: 'シフト', current: false },
      { href: MENU, label: 'メニュー', current: false },
      { href: PRODUCTS, label: '商品', current: false },
      { href: INVENTORY, label: '在庫', current: false },
      { href: PURCHASE_ORDERS, label: '発注', current: false },
      SETTINGS_LINK,
      PROFILE,
    ])
  })

  it('should write the addresses of the files', () => {
    expect([
      attachmentsHrefOf(SALON_ID),
      attachmentHrefOf(SALON_ID, 'file'),
      shareLinkEntryHrefOf(SALON_ID, 'file'),
      shareLinkHrefOf(SALON_ID, 'file', 'link'),
    ]).toEqual([
      FILES,
      `${FILES}/file`,
      `${FILES}/file/share-links/new`,
      `${FILES}/file/share-links/link`,
    ])
  })

  it('should write the addresses of the menu', () => {
    expect([
      menuHrefOf(SALON_ID),
      serviceHrefOf(SALON_ID, 'service'),
      serviceEntryHrefOf(SALON_ID),
      serviceChangeHrefOf(SALON_ID, 'service'),
      servicesChangeHrefOf(SALON_ID),
      categoryEntryHrefOf(SALON_ID),
      categoryChangeHrefOf(SALON_ID, 'category'),
    ]).toEqual([
      MENU,
      `${MENU}/services/service`,
      `${MENU}/services/new`,
      `${MENU}/services/service/edit`,
      `${MENU}/services/bulk`,
      `${MENU}/categories/new`,
      `${MENU}/categories/category/edit`,
    ])
  })

  it.each<[string, Role, string]>([
    ['the settings', 'staff', SETTINGS],
    ['the change of the information', 'manager', `${SETTINGS}/edit`],
    ['the change of the hours', 'owner', `${SETTINGS}/hours`],
    ['the payment methods', 'staff', `${SETTINGS}/payment-methods`],
    [
      'the change of a payment method',
      'manager',
      `${SETTINGS}/payment-methods/method/edit`,
    ],
  ])(
    'should mark the settings as the screen of %s for a member (%s)',
    (_case, role, pathname) => {
      expect(
        navigationFor(role, pathname)
          .filter(({ current }) => current)
          .map(({ label }) => label),
      ).toEqual(['設定'])
    },
  )

  it('should write the addresses of the settings', () => {
    expect([
      settingsHrefOf(SALON_ID),
      salonChangeHrefOf(SALON_ID),
      hoursChangeHrefOf(SALON_ID),
    ]).toEqual([SETTINGS, `${SETTINGS}/edit`, `${SETTINGS}/hours`])
  })

  it('should write the addresses of the payment methods', () => {
    expect([
      paymentMethodsHrefOf(SALON_ID),
      paymentMethodEntryHrefOf(SALON_ID),
      paymentMethodHrefOf(SALON_ID, 'method'),
      paymentMethodChangeHrefOf(SALON_ID, 'method'),
    ]).toEqual([
      `${SETTINGS}/payment-methods`,
      `${SETTINGS}/payment-methods/new`,
      `${SETTINGS}/payment-methods/method`,
      `${SETTINGS}/payment-methods/method/edit`,
    ])
  })

  it('should write the addresses of the shifts', () => {
    expect([
      shiftsHrefOf(SALON_ID),
      shiftWeekHrefOf(SALON_ID, '2026-11-16'),
      scheduleHrefOf(SALON_ID, 'member'),
      scheduleChangeHrefOf(SALON_ID, 'member'),
    ]).toEqual([
      SHIFTS,
      `${SHIFTS}?week=2026-11-16`,
      `${SHIFTS}/member`,
      `${SHIFTS}/member/edit`,
    ])
  })

  it('should write the address of the bookings of a salon', () => {
    expect(bookingsHrefOf(SALON_ID)).toBe(BOOKINGS)
  })

  it('should write the address of the sales of a salon', () => {
    expect(salesHrefOf(SALON_ID)).toBe(SALES)
  })

  it('should write the addresses of the change of a sale and of the refund of its payment', () => {
    expect([
      saleChangeHrefOf(SALON_ID, 'sale'),
      refundHrefOf(SALON_ID, 'sale', 'payment'),
    ]).toEqual([`${SALES}/sale/edit`, `${SALES}/sale/payments/payment/refund`])
  })

  it('should write the addresses of the customers of the ledger', () => {
    expect([
      customersHrefOf(SALON_ID),
      customerEntryHrefOf(SALON_ID),
      customerImportHrefOf(SALON_ID),
      customerHrefOf(SALON_ID, 'customer'),
      customerChangeHrefOf(SALON_ID, 'customer'),
      customerPreferencesHrefOf(SALON_ID, 'customer'),
      customerHistoryHrefOf(SALON_ID, 'customer'),
      customerVersionHrefOf(SALON_ID, 'customer', 12),
      customerPointsHrefOf(SALON_ID, 'customer'),
      pointEntryHrefOf(SALON_ID, 'customer'),
    ]).toEqual([
      CUSTOMERS,
      `${CUSTOMERS}/new`,
      `${CUSTOMERS}/import`,
      `${CUSTOMERS}/customer`,
      `${CUSTOMERS}/customer/edit`,
      `${CUSTOMERS}/customer/preferences`,
      `${CUSTOMERS}/customer/history`,
      `${CUSTOMERS}/customer/history/12`,
      `${CUSTOMERS}/customer/points`,
      `${CUSTOMERS}/customer/points/new`,
    ])
  })

  it('should write the address of the points recorded for a sale, of the kind the sale asks for', () => {
    expect(
      pointEntryHrefOf(SALON_ID, 'customer', { saleId: 'sale', kind: 'used' }),
    ).toBe(`${CUSTOMERS}/customer/points/new?saleId=sale&kind=used`)
  })

  it('should write the address of a booking to put in for a customer, on a day', () => {
    expect(bookingOfCustomerHrefOf(SALON_ID, '2026-11-20', 'customer')).toBe(
      `${BOOKINGS}/new?date=2026-11-20&customerId=customer`,
    )
  })
})
