import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  bookingOfCustomerHrefOf,
  bookingsHrefOf,
  customerChangeHrefOf,
  customerEntryHrefOf,
  customerHrefOf,
  customerPreferencesHrefOf,
  customersHrefOf,
  navigationFor,
  receiptHrefOf,
  refundHrefOf,
  saleChangeHrefOf,
  salesHrefOf,
  salonIdIn,
} from './navigation'

const SALON_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'
const BOOKINGS = `/salons/${SALON_ID}/bookings`
const SALES = `/salons/${SALON_ID}/sales`
const CUSTOMERS = `/salons/${SALON_ID}/customers`

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
  it('should lead an administrator to the choice of a salon, and to the bookings, the sales and the customers of the salon chosen', () => {
    expect(navigationFor('admin', `${BOOKINGS}/x`)).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: false },
      { href: BOOKINGS, label: '予約', current: true },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
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
        { href: SALES, label: '売上', current: false },
        { href: CUSTOMERS, label: '顧客', current: false },
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
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
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
    ])
  })

  it.each<[string, string]>([
    ['the ledger', CUSTOMERS],
    ['the registration of a customer', customerEntryHrefOf(SALON_ID)],
    ['a customer', customerHrefOf(SALON_ID, 'x')],
    ['the change of a customer', customerChangeHrefOf(SALON_ID, 'x')],
    [
      'the change of the preferences of a customer',
      customerPreferencesHrefOf(SALON_ID, 'x'),
    ],
  ])('should mark the customers as the screen of %s', (_case, pathname) => {
    expect(navigationFor('staff', pathname)).toEqual([
      { href: BOOKINGS, label: '予約', current: false },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: true },
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
      customerHrefOf(SALON_ID, 'customer'),
      customerChangeHrefOf(SALON_ID, 'customer'),
      customerPreferencesHrefOf(SALON_ID, 'customer'),
    ]).toEqual([
      CUSTOMERS,
      `${CUSTOMERS}/new`,
      `${CUSTOMERS}/customer`,
      `${CUSTOMERS}/customer/edit`,
      `${CUSTOMERS}/customer/preferences`,
    ])
  })

  it('should write the address of a booking to put in for a customer, on a day', () => {
    expect(bookingOfCustomerHrefOf(SALON_ID, '2026-11-20', 'customer')).toBe(
      `${BOOKINGS}/new?date=2026-11-20&customerId=customer`,
    )
  })
})
