import type {
  ModelsBookingServiceResponse,
  ModelsBookingStatusType,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { service } from '../bookings/components/examples'
import {
  afterCheckout,
  agreesWith,
  type BillLine,
  billLinesOf,
  type CheckoutAttempt,
  readCheckout,
  saleDetailsOf,
  saleOfBooking,
  saleRequestOf,
  taxSharesOf,
  whyNoCheckout,
  whyNotCalculated,
} from './checkout'
import { aBooking, aSale, services, staff } from './components/examples'

const [cut, colour] = services
const [misaki, ken] = staff

/** A line of a bill that costs so much before the tax, with the tax in its price or not. */
const line = (net: number, taxIncluded = false): BillLine => ({
  serviceId: null,
  name: 'カット',
  unitPrice: net,
  discountAmount: 0,
  taxIncluded,
  staffId: null,
})

describe('whyNoCheckout', () => {
  it.each<[ModelsBookingStatusType, string | undefined]>([
    ['draft', '会計は、施術を始めると入れられます。'],
    ['pending', '会計は、施術を始めると入れられます。'],
    ['confirmed', '会計は、施術を始めると入れられます。'],
    ['in_progress', undefined],
    ['completed', undefined],
    ['cancelled', 'キャンセルした予約には、会計を入れません。'],
    ['no_show', 'キャンセルした予約には、会計を入れません。'],
  ])('should say why a booking that is %s takes no checkout', (status, why) => {
    // Act, Assert
    expect(whyNoCheckout({ status })).toBe(why)
  })
})

describe('saleOfBooking', () => {
  it('should find the sale that is not void among those of the booking', () => {
    // Arrange
    const voided = aSale({ id: 'a', isVoid: true })
    const billed = aSale({ id: 'b' })

    // Act, Assert
    expect(saleOfBooking([voided, billed])).toBe(billed)
    expect(saleOfBooking([voided])).toBeUndefined()
  })
})

describe('billLinesOf', () => {
  const discounted: ModelsServiceResponse = {
    ...service('b08e4d7a-1c2e-4f3a-9b5c-6d7e8f9a0b1c', 'トリートメント', 3300),
    discountPrice: 3000,
    taxIncluded: false,
  }

  /** A colour at 10:00 that nobody does, with a discount, its price without the tax */
  const colourLine: ModelsBookingServiceResponse = {
    id: 'second',
    serviceId: colour?.id ?? '',
    staffId: null,
    startTime: '2026-11-20T01:00:00.000Z',
    endTime: '2026-11-20T02:00:00.000Z',
    duration: 60,
    price: 8800,
    discountAmount: 800,
    finalPrice: 8000,
    taxIncluded: false,
    isCompleted: false,
    completedAt: null,
    notes: null,
    sortOrder: 1,
  }

  it('should bill the lines of the booking in their order at the amounts they took, then the services added at the prices of the menu, done by the member of the booking', () => {
    // Arrange
    const booking = aBooking({
      staffId: ken?.id ?? '',
      services: [colourLine, ...aBooking().services],
    })

    // Act
    const lines = billLinesOf(
      booking,
      [discounted.id, cut?.id ?? ''],
      [...services, discounted],
    )

    // Assert
    expect(lines).toEqual([
      {
        serviceId: cut?.id,
        name: 'カット',
        unitPrice: 5500,
        discountAmount: 0,
        taxIncluded: true,
        staffId: misaki?.id,
      },
      {
        serviceId: colour?.id,
        name: 'カラー',
        unitPrice: 8800,
        discountAmount: 800,
        taxIncluded: false,
        staffId: null,
      },
      {
        serviceId: discounted.id,
        name: 'トリートメント',
        unitPrice: 3300,
        discountAmount: 300,
        taxIncluded: false,
        staffId: ken?.id,
      },
      {
        serviceId: cut?.id,
        name: 'カット',
        unitPrice: 5500,
        discountAmount: 0,
        taxIncluded: true,
        staffId: ken?.id,
      },
    ])
  })

  it('should bill a line whose service was removed under no service, and leave out an added service that is not on the menu', () => {
    // Act
    const lines = billLinesOf(aBooking(), ['not-on-the-menu'], [])

    // Assert
    expect(lines).toEqual([
      {
        serviceId: null,
        name: '削除されたメニュー',
        unitPrice: 5500,
        discountAmount: 0,
        taxIncluded: true,
        staffId: misaki?.id,
      },
    ])
  })
})

describe('taxSharesOf', () => {
  it.each<[string, BillLine[], number, number[]]>([
    [
      'shared by what the lines cost',
      [line(6000), line(3000)],
      900,
      [600, 300],
    ],
    [
      'the yen left given one each to the first lines',
      [line(1000), line(1000), line(1000)],
      200,
      [67, 67, 66],
    ],
    [
      'nothing on a line whose price includes it',
      [line(5500, true), line(3000)],
      300,
      [0, 300],
    ],
    [
      'no yen left to a line that costs nothing',
      [line(0), line(1001), line(1001)],
      201,
      [0, 101, 100],
    ],
    ['nothing when every price includes it', [line(5500, true)], 0, [0]],
    ['nothing when nothing costs anything', [line(0), line(0)], 0, [0, 0]],
  ])('should put the tax on the lines: %s', (_case, lines, tax, shares) => {
    // Act
    const shared = taxSharesOf(lines, tax)

    // Assert
    expect(shared).toEqual(shares)
    expect(shared.reduce((sum, share) => sum + share, 0)).toBe(tax)
  })
})

describe('saleDetailsOf', () => {
  it('should make a detail of each line, with its share of the tax, its total and its place', () => {
    // Arrange
    const lines: BillLine[] = [
      { ...line(5500, true), serviceId: cut?.id ?? null, staffId: 'a' },
      {
        ...line(8800),
        name: 'カラー',
        discountAmount: 800,
        serviceId: colour?.id ?? null,
      },
    ]

    // Act
    const details = saleDetailsOf(lines, 800)

    // Assert
    expect(details).toEqual([
      {
        itemType: 'service',
        itemId: cut?.id,
        itemName: 'カット',
        quantity: 1,
        unitPrice: 5500,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 5500,
        staffId: 'a',
        commissionRate: null,
        commissionAmount: null,
        notes: null,
        sortOrder: 0,
      },
      {
        itemType: 'service',
        itemId: colour?.id,
        itemName: 'カラー',
        quantity: 1,
        unitPrice: 8800,
        discountAmount: 800,
        taxAmount: 800,
        totalAmount: 8800,
        staffId: null,
        commissionRate: null,
        commissionAmount: null,
        notes: null,
        sortOrder: 1,
      },
    ])
  })
})

describe('readCheckout', () => {
  it.each<[string, Record<string, string>, ReturnType<typeof readCheckout>]>([
    [
      'a member and a note',
      { staffId: 'abc', notes: ' 現金で ' },
      { staffId: 'abc', notes: '現金で' },
    ],
    [
      'nobody and no note',
      { staffId: 'none', notes: '  ' },
      { staffId: null, notes: null },
    ],
    ['nothing at all', {}, { staffId: null, notes: null }],
  ])('should read %s', (_case, entries, read) => {
    // Act, Assert
    expect(readCheckout(formOf(entries))).toEqual(read)
  })
})

describe('saleRequestOf', () => {
  it('should bill the customer of the booking, at the moment it is sent, without points', () => {
    // Arrange
    const booking = aBooking()
    const details = saleDetailsOf(billLinesOf(booking, [], services), 0)

    // Act
    const request = saleRequestOf(
      booking,
      { staffId: misaki?.id ?? null, notes: null },
      details,
      new Date('2026-11-20T02:05:00.000Z'),
    )

    // Assert
    expect(request).toEqual({
      salonId: booking.salonId,
      customerId: booking.customerId,
      staffId: misaki?.id,
      bookingId: booking.id,
      saleTime: '2026-11-20T02:05:00.000Z',
      pointsUsed: null,
      pointsEarned: null,
      notes: null,
      details,
    })
  })
})

describe('afterCheckout', () => {
  const sale = aSale()

  it.each<[string, CheckoutAttempt, ReturnType<typeof afterCheckout>]>([
    ['a sale', { type: 'created', sale }, { type: 'done', sale }],
    [
      'a sale made meanwhile',
      { type: 'billed', sale },
      { type: 'billed', sale },
    ],
    [
      'a member that was removed',
      {
        type: 'invalid',
        values: [{ field: 'staffId', rule: 'not_found' }],
      },
      {
        type: 'again',
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {
          staffId: 'このスタッフは、もう選べません。選び直してください。',
        },
      },
    ],
    [
      'a service of a line that was removed',
      {
        type: 'invalid',
        values: [{ field: 'details.1.itemId', rule: 'not_found' }],
      },
      {
        type: 'again',
        message:
          'メニューか担当のスタッフが、その間に削除されていたため、会計を入れられませんでした。予約の内容から開き直してください。',
        errors: {},
      },
    ],
    [
      'a customer that was removed',
      {
        type: 'invalid',
        values: [{ field: 'customerId', rule: 'not_found' }],
      },
      {
        type: 'again',
        message:
          'この予約のお客様は、台帳から削除されていたため、会計を入れられませんでした。',
        errors: {},
      },
    ],
    [
      'a bill too large',
      { type: 'invalid', values: [{ field: 'details', rule: 'too_big' }] },
      {
        type: 'again',
        message:
          '金額の合計が、1 件の売上で扱える上限を超えます。足した施術を減らしてください。',
        errors: {},
      },
    ],
    [
      'a refusal that names nothing',
      { type: 'invalid', values: [] },
      {
        type: 'again',
        message:
          '会計を入れられませんでした。通信の状態を確かめて、もう一度お試しください。',
        errors: {},
      },
    ],
    [
      'a salon whose time zone is no name',
      { type: 'unbillable' },
      {
        type: 'again',
        message:
          'サロンのタイムゾーンが正しくないため、会計日を決められず、会計を入れられませんでした。サロンの設定を直してください。',
        errors: {},
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        errors: {},
      },
    ],
  ])('should say what came of %s', (_case, outcome, said) => {
    // Act, Assert
    expect(afterCheckout(outcome)).toEqual(said)
  })
})

describe('agreesWith', () => {
  const lines = [line(5500, true), { ...line(8800), discountAmount: 800 }]

  it.each<[string, number, number, boolean]>([
    ['the same prices and discounts', 14300, 800, true],
    ['another price', 14400, 800, false],
    ['another discount', 14300, 0, false],
  ])(
    'should say whether a calculation of %s is that of the lines',
    (_case, subtotal, discountAmount, agrees) => {
      // Act, Assert
      expect(
        agreesWith(lines, {
          subtotal,
          discountAmount,
          taxAmount: 0,
          totalAmount: 0,
        }),
      ).toBe(agrees)
    },
  )
})

describe('whyNotCalculated', () => {
  const added = [colour?.id ?? '', cut?.id ?? '', colour?.id ?? '']

  it.each<[string, { field: string; rule: string }[], string]>([
    [
      'services removed from the menu, each named once',
      [
        { field: 'services.0', rule: 'not_found' },
        { field: 'services.2', rule: 'not_found' },
        { field: 'services.1', rule: 'not_found' },
      ],
      'カラー、カットは、メニューから削除されていました。外してください。',
    ],
    [
      'a booking that was removed',
      [{ field: 'bookingId', rule: 'not_found' }],
      'この予約は、削除されていました。',
    ],
    [
      'a bill too large',
      [{ field: 'services', rule: 'too_big' }],
      '金額の合計が、1 件の売上で扱える上限を超えます。足した施術を減らしてください。',
    ],
    [
      'what names nothing that was added',
      [{ field: 'services.7', rule: 'not_found' }],
      '金額を計算できませんでした。',
    ],
  ])('should say why the bill was not calculated: %s', (_case, values, why) => {
    // Act, Assert
    expect(whyNotCalculated(values, added, services)).toBe(why)
  })
})
