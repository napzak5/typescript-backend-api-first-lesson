import type { ModelsUserResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  bookingOfCustomerHrefOf,
  bookingsHrefOf,
  customerChangeHrefOf,
  customerEntryHrefOf,
  customerHistoryHrefOf,
  customerHrefOf,
  customerImportHrefOf,
  customerPointsHrefOf,
  customerPreferencesHrefOf,
  customersHrefOf,
  customerVersionHrefOf,
  navigationFor,
  pointEntryHrefOf,
  receiptHrefOf,
  refundHrefOf,
  saleChangeHrefOf,
  salesHrefOf,
  salonIdIn,
  treatmentChangeHrefOf,
  treatmentEntryHrefOf,
  treatmentHrefOf,
  treatmentPhotosHrefOf,
  treatmentStatisticsHrefOf,
  treatmentsHrefOf,
  treatmentsOfCustomerHrefOf,
} from './navigation'

const SALON_ID = '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'
const BOOKINGS = `/salons/${SALON_ID}/bookings`
const SALES = `/salons/${SALON_ID}/sales`
const CUSTOMERS = `/salons/${SALON_ID}/customers`
const TREATMENTS = `/salons/${SALON_ID}/treatments`

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
  it('should lead an administrator to the choice of a salon, and to the bookings, the sales, the customers and the treatment records of the salon chosen', () => {
    expect(navigationFor('admin', `${BOOKINGS}/x`)).toEqual([
      { href: '/', label: 'サロンを選ぶ', current: false },
      { href: BOOKINGS, label: '予約', current: true },
      { href: SALES, label: '売上', current: false },
      { href: CUSTOMERS, label: '顧客', current: false },
      { href: TREATMENTS, label: '施術記録', current: false },
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
        { href: TREATMENTS, label: '施術記録', current: false },
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
      { href: TREATMENTS, label: '施術記録', current: false },
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
      { href: TREATMENTS, label: '施術記録', current: false },
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
      { href: TREATMENTS, label: '施術記録', current: false },
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
        { href: TREATMENTS, label: '施術記録', current: true },
      ])
    },
  )

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
