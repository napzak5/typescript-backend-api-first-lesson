import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  BOOKING_ID,
  COLOR_ID,
  CUT_ID,
} from '../../../__tests__/fixtures/booking-fixtures'
import { SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  PRODUCT_ID,
  SALE_NUMBER,
  saleCreateRequest,
  saleReferences,
} from '../../../__tests__/fixtures/sale-fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import type { ApiSaleCreateRequest } from '../../../models/sale'
import { saleCreateRequestSchema } from '../../../schemas/sale.schema'
import {
  planSale,
  type SaleOrigin,
  type SaleReferences,
  saleNumberFrom,
} from '..'

const MAX_INTEGER = 2_147_483_647

/** A third staff member, whom the references of the fixtures do not hold. */
const UNKNOWN_STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2e09'

/** Another customer than the one of the fixtures. */
const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c09'

/** Another product, which the references of the fixtures do not hold. */
const UNKNOWN_PRODUCT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3b09'

const origin: SaleOrigin = { saleNumber: SALE_NUMBER }

type Line = ApiSaleCreateRequest['details'][number]

/** A line that keeps every rule: something of no record for 1,000 yen and 100 of tax. */
const line = (overrides: Partial<Line> = {}): Line => ({
  itemType: 'fee',
  itemId: null,
  itemName: '指名料',
  quantity: 1,
  unitPrice: 1000,
  discountAmount: 0,
  taxAmount: 100,
  totalAmount: 1100,
  staffId: null,
  commissionRate: null,
  commissionAmount: null,
  notes: null,
  sortOrder: 0,
  ...overrides,
})

/** The request of the fixtures with these properties changed. */
const requestWith = (
  overrides: Partial<ApiSaleCreateRequest>,
): ApiSaleCreateRequest => ({ ...saleCreateRequest(), ...overrides })

/** The request of the fixtures with these lines, each at a place of its own. */
const withLines = (...details: Line[]): ApiSaleCreateRequest =>
  requestWith({
    details: details.map((detail, sortOrder) => ({ ...detail, sortOrder })),
  })

/** A sale to nobody: no customer, no booking, no points. */
const toNobody = (
  overrides: Partial<ApiSaleCreateRequest> = {},
): ApiSaleCreateRequest =>
  requestWith({
    customerId: null,
    bookingId: null,
    pointsUsed: null,
    pointsEarned: null,
    ...overrides,
  })

const plan = (
  request: ApiSaleCreateRequest = saleCreateRequest(),
  references: SaleReferences = saleReferences(),
  from: SaleOrigin = origin,
) => planSale(saleCreateRequestSchema.parse(request), references, from)

/** The rows of a request that is planned; anything else fails the test. */
const planned = (
  request: ApiSaleCreateRequest = saleCreateRequest(),
  references: SaleReferences = saleReferences(),
  from: SaleOrigin = origin,
) => {
  const result = plan(request, references, from)
  if (result.type !== 'planned') {
    throw new Error(`The sale was not planned: ${result.type}`)
  }
  return result.write
}

/** The broken rules of a request that is refused, as `field:rule`. */
const rulesOf = (
  request: ApiSaleCreateRequest,
  references: SaleReferences = saleReferences(),
): string[] => {
  const result = plan(request, references)
  return result.type === 'invalid'
    ? result.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []
}

/** What a refused request is told, by `field`. */
const messagesOf = (
  request: ApiSaleCreateRequest,
  references: SaleReferences = saleReferences(),
): Record<string, string> => {
  const result = plan(request, references)
  return result.type === 'invalid'
    ? Object.fromEntries(
        result.issues.map(({ field, message }) => [field, message]),
      )
    : {}
}

/** The day of a sale at that time in a salon in that time zone. */
const saleDateOf = (saleTime: string, timezone: string): string =>
  planned(requestWith({ saleTime }), saleReferences({ salon: { timezone } }))
    .sale.saleDate

describe('planSale', () => {
  it('plans the sale of the request with the lines as they are stated', () => {
    expect(plan()).toEqual({
      type: 'planned',
      write: {
        sale: {
          saleNumber: SALE_NUMBER,
          salonId: SALON_ID,
          customerId: CUSTOMER_ID,
          staffId: STAFF_MEMBER_ID,
          bookingId: BOOKING_ID,
          saleDate: '2026-11-20',
          saleTime: '2026-11-20T03:40:00.000Z',
          subtotal: 12100,
          discountAmount: 600,
          taxAmount: 1150,
          totalAmount: 12650,
          pointsUsed: 100,
          pointsEarned: 126,
          paymentStatus: 'pending',
          isVoid: false,
          voidedAt: null,
          voidReason: null,
          notes: '現金でお支払い',
        },
        details: [
          {
            itemType: 'service',
            itemId: CUT_ID,
            itemName: 'カット',
            quantity: 1,
            unitPrice: 6000,
            discountAmount: 0,
            taxAmount: 600,
            totalAmount: 6600,
            staffId: STAFF_MEMBER_ID,
            commissionRate: '40.00',
            commissionAmount: 2400,
            notes: null,
            sortOrder: 0,
          },
          {
            itemType: 'product',
            itemId: PRODUCT_ID,
            itemName: 'シャンプー',
            quantity: 2,
            unitPrice: 2800,
            discountAmount: 600,
            taxAmount: 500,
            totalAmount: 5500,
            staffId: OTHER_STAFF_MEMBER_ID,
            commissionRate: '12.50',
            commissionAmount: 625,
            notes: 'セット割引',
            sortOrder: 1,
          },
          {
            itemType: 'fee',
            itemId: null,
            itemName: '指名料',
            quantity: 1,
            unitPrice: 500,
            discountAmount: 0,
            taxAmount: 50,
            totalAmount: 550,
            staffId: null,
            commissionRate: null,
            commissionAmount: null,
            notes: null,
            sortOrder: 2,
          },
        ],
      },
    })
  })

  it('plans a sale to nobody without a booking', () => {
    const { sale } = planned(
      toNobody({ staffId: null, notes: null }),
      saleReferences({ customerExists: false, booking: null }),
    )

    expect(sale).toMatchObject({
      customerId: null,
      staffId: null,
      bookingId: null,
      pointsUsed: null,
      pointsEarned: null,
      notes: null,
    })
  })

  it('begins every sale unpaid and not void, whatever it is of', () => {
    const sales = [
      planned().sale,
      planned(toNobody(), saleReferences({ booking: null })).sale,
    ]

    for (const sale of sales) {
      expect(sale).toMatchObject({
        paymentStatus: 'pending',
        isVoid: false,
        voidedAt: null,
        voidReason: null,
      })
    }
  })

  it('gives the sale the number it was issued', () => {
    expect(
      planned(saleCreateRequest(), saleReferences(), {
        saleNumber: 'SL-0000-0001',
      }).sale.saleNumber,
    ).toBe('SL-0000-0001')
  })

  describe('the sums of a sale', () => {
    const sumsOf = (...details: Line[]) => {
      const { subtotal, discountAmount, taxAmount, totalAmount } = planned(
        withLines(...details),
      ).sale
      return { subtotal, discountAmount, taxAmount, totalAmount }
    }

    it('takes the sums of one line from that line', () => {
      expect(sumsOf(line())).toEqual({
        subtotal: 1000,
        discountAmount: 0,
        taxAmount: 100,
        totalAmount: 1100,
      })
    })

    it('counts every piece of a line into the subtotal', () => {
      expect(
        sumsOf(
          line({
            quantity: 3,
            unitPrice: 1200,
            discountAmount: 600,
            taxAmount: 300,
            totalAmount: 3300,
          }),
        ),
      ).toEqual({
        subtotal: 3600,
        discountAmount: 600,
        taxAmount: 300,
        totalAmount: 3300,
      })
    })

    it('adds the lines up, each sum by itself', () => {
      expect(
        sumsOf(
          line({ unitPrice: 1000, taxAmount: 100, totalAmount: 1100 }),
          line({
            quantity: 2,
            unitPrice: 500,
            discountAmount: 200,
            taxAmount: 80,
            totalAmount: 880,
          }),
          line({ unitPrice: 0, taxAmount: 0, totalAmount: 0 }),
        ),
      ).toEqual({
        subtotal: 2000,
        discountAmount: 200,
        taxAmount: 180,
        totalAmount: 1980,
      })
    })

    it('holds a sale that comes to exactly what an integer column holds', () => {
      expect(
        sumsOf(
          line({
            unitPrice: MAX_INTEGER - 1,
            taxAmount: 0,
            totalAmount: MAX_INTEGER - 1,
          }),
          line({ unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
        ),
      ).toEqual({
        subtotal: MAX_INTEGER,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: MAX_INTEGER,
      })
    })

    it('refuses a sale whose total is a yen more than that', () => {
      const request = withLines(
        line({
          unitPrice: MAX_INTEGER,
          taxAmount: 0,
          totalAmount: MAX_INTEGER,
        }),
        line({ unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
      )

      expect(plan(request)).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'details',
            rule: 'too_big',
            message: 'The amounts of a sale must not exceed 2147483647',
          },
        ],
      })
    })

    it('refuses a sale whose subtotal is too big though its total is not', () => {
      const discounted = line({
        unitPrice: 2_000_000_000,
        discountAmount: 1_500_000_000,
        taxAmount: 0,
        totalAmount: 500_000_000,
      })

      expect(rulesOf(withLines(discounted, discounted))).toEqual([
        'details:too_big',
      ])
    })

    it('refuses a sale whose total is too big though its subtotal is not', () => {
      const taxed = line({
        unitPrice: 1_000_000_000,
        taxAmount: 100_000_000,
        totalAmount: 1_100_000_000,
      })

      expect(rulesOf(withLines(taxed, taxed))).toEqual(['details:too_big'])
    })

    it('sums a hundred lines of the largest amounts exactly before refusing them', () => {
      const largest = line({
        unitPrice: MAX_INTEGER,
        taxAmount: 0,
        totalAmount: MAX_INTEGER,
      })

      expect(
        rulesOf(withLines(...Array.from({ length: 100 }, () => largest))),
      ).toEqual(['details:too_big'])
    })
  })

  describe('the commission of a line', () => {
    it.each([
      [0, '0.00'],
      [0.01, '0.01'],
      [7, '7.00'],
      [12.5, '12.50'],
      [33.33, '33.33'],
      [100, '100.00'],
    ])('writes a rate of %s as the text %s', (commissionRate, stored) => {
      const [detail] = planned(withLines(line({ commissionRate }))).details

      expect(detail?.commissionRate).toBe(stored)
    })

    it('leaves a line without a rate without one', () => {
      const [detail] = planned(
        withLines(line({ commissionRate: null, commissionAmount: 300 })),
      ).details

      expect(detail).toMatchObject({
        commissionRate: null,
        commissionAmount: 300,
      })
    })
  })

  describe('the day of a sale', () => {
    it.each([
      [
        'the last moment of a day in Tokyo',
        '2026-11-19T14:59:59.999Z',
        'Asia/Tokyo',
        '2026-11-19',
      ],
      ['midnight in Tokyo', '2026-11-19T15:00:00Z', 'Asia/Tokyo', '2026-11-20'],
      ['noon in Tokyo', '2026-11-20T03:00:00Z', 'Asia/Tokyo', '2026-11-20'],
      [
        'the evening before in Los Angeles',
        '2026-11-20T03:00:00Z',
        'America/Los_Angeles',
        '2026-11-19',
      ],
      ['the same moment in UTC', '2026-11-20T03:00:00Z', 'UTC', '2026-11-20'],
      [
        'the first moment of a year in Auckland',
        '2026-12-31T11:00:00Z',
        'Pacific/Auckland',
        '2027-01-01',
      ],
    ])('is the day of the salon: %s', (_case, saleTime, timezone, saleDate) => {
      expect(saleDateOf(saleTime, timezone)).toBe(saleDate)
    })

    it('keeps the time of the sale as the moment it is', () => {
      expect(
        planned(
          requestWith({ saleTime: '2026-11-19T15:00:00Z' }),
          saleReferences({ salon: { timezone: 'America/Los_Angeles' } }),
        ).sale.saleTime,
      ).toBe('2026-11-19T15:00:00.000Z')
    })

    it.each([
      ['a name that is none', 'Mars/Olympus'],
      ['an empty name', ''],
      ['an abbreviation the runtime does not know', 'JSTX'],
    ])('cannot tell the day in a time zone with %s', (_case, timezone) => {
      expect(
        plan(saleCreateRequest(), saleReferences({ salon: { timezone } })),
      ).toEqual({ type: 'timeZoneUnknown' })
    })
  })

  describe('what a sale refers to', () => {
    it('refuses a salon that is not there, and looks no further than the customer', () => {
      const nothing = saleReferences({
        salon: null,
        customerExists: true,
        staffIds: [],
        serviceIds: [],
        productIds: [],
        booking: null,
      })

      expect(plan(saleCreateRequest(), nothing)).toEqual({
        type: 'invalid',
        issues: [
          { field: 'salonId', rule: 'not_found', message: 'Must name a salon' },
        ],
      })
    })

    it('reports the customer with the salon', () => {
      expect(
        rulesOf(
          saleCreateRequest(),
          saleReferences({ salon: null, customerExists: false }),
        ),
      ).toEqual(['salonId:not_found', 'customerId:not_found'])
    })

    it('refuses a customer who is not there', () => {
      const references = saleReferences({ customerExists: false })

      expect(rulesOf(requestWith({ bookingId: null }), references)).toEqual([
        'customerId:not_found',
      ])
      expect(messagesOf(requestWith({ bookingId: null }), references)).toEqual({
        customerId: 'Must name a customer',
      })
    })

    it('asks for no customer of a sale to nobody', () => {
      expect(
        plan(
          toNobody(),
          saleReferences({ customerExists: false, booking: null }),
        ).type,
      ).toBe('planned')
    })

    it('refuses a staff member in charge who is not of the salon', () => {
      const request = requestWith({ staffId: UNKNOWN_STAFF_ID })

      expect(rulesOf(request)).toEqual(['staffId:not_found'])
      expect(messagesOf(request)).toEqual({
        staffId: 'Must name a staff member of the salon',
      })
    })

    it('asks for no staff member of a sale without one', () => {
      expect(
        plan(withLines(line()), saleReferences({ staffIds: [STAFF_MEMBER_ID] }))
          .type,
      ).toBe('planned')
      expect(
        plan(
          requestWith({ staffId: null, details: [line()] }),
          saleReferences({ staffIds: [] }),
        ).type,
      ).toBe('planned')
    })

    it('refuses the staff member of a line who is not of the salon, under the line', () => {
      const request = withLines(
        line(),
        line({ staffId: UNKNOWN_STAFF_ID }),
        line({ staffId: OTHER_STAFF_MEMBER_ID }),
      )

      expect(rulesOf(request)).toEqual(['details.1.staffId:not_found'])
      expect(messagesOf(request)).toEqual({
        'details.1.staffId': 'Must name a staff member of the salon',
      })
    })

    it('refuses a service that is not of the salon', () => {
      const request = withLines(line({ itemType: 'service', itemId: COLOR_ID }))

      expect(rulesOf(request)).toEqual(['details.0.itemId:not_found'])
      expect(messagesOf(request)).toEqual({
        'details.0.itemId': 'Must name a service of the salon',
      })
    })

    it('refuses a product that is not of the salon', () => {
      const request = withLines(
        line(),
        line({ itemType: 'product', itemId: UNKNOWN_PRODUCT_ID }),
      )

      expect(rulesOf(request)).toEqual(['details.1.itemId:not_found'])
      expect(messagesOf(request)).toEqual({
        'details.1.itemId': 'Must name a product of the salon',
      })
    })

    it('looks a service up among the services and a product among the products', () => {
      expect(
        rulesOf(
          withLines(
            line({ itemType: 'service', itemId: PRODUCT_ID }),
            line({ itemType: 'product', itemId: CUT_ID }),
          ),
        ),
      ).toEqual(['details.0.itemId:not_found', 'details.1.itemId:not_found'])
    })

    it('asks for no record of a line that names none', () => {
      expect(
        plan(
          withLines(
            line({ itemType: 'service', itemId: null }),
            line({ itemType: 'product', itemId: null }),
            line({ itemType: 'fee', itemId: null }),
          ),
          saleReferences({ serviceIds: [], productIds: [] }),
        ).type,
      ).toBe('planned')
    })

    it('reports everything that is not there at once, the sale before its lines', () => {
      expect(
        rulesOf(
          requestWith({
            staffId: UNKNOWN_STAFF_ID,
            details: [
              line({
                itemType: 'service',
                itemId: CUT_ID,
                staffId: UNKNOWN_STAFF_ID,
                sortOrder: 0,
              }),
              line({
                itemType: 'product',
                itemId: PRODUCT_ID,
                staffId: STAFF_MEMBER_ID,
                sortOrder: 1,
              }),
            ],
          }),
          saleReferences({
            customerExists: false,
            staffIds: [STAFF_MEMBER_ID],
            serviceIds: [],
            productIds: [],
            booking: null,
          }),
        ),
      ).toEqual([
        'customerId:not_found',
        'staffId:not_found',
        'bookingId:not_found',
        'details.0.staffId:not_found',
        'details.0.itemId:not_found',
        'details.1.itemId:not_found',
      ])
    })
  })

  describe('the booking of a sale', () => {
    const NOT_THE_BOOKING = {
      bookingId:
        'Must name a booking of the salon that is of the customer of the sale',
    }

    it('refuses a booking that is not of the salon', () => {
      const references = saleReferences({ booking: null })

      expect(rulesOf(saleCreateRequest(), references)).toEqual([
        'bookingId:not_found',
      ])
      expect(messagesOf(saleCreateRequest(), references)).toEqual(
        NOT_THE_BOOKING,
      )
    })

    it('refuses the booking of another customer', () => {
      const references = saleReferences({
        booking: { customerId: OTHER_CUSTOMER_ID, isBilled: false },
      })

      expect(rulesOf(saleCreateRequest(), references)).toEqual([
        'bookingId:not_found',
      ])
      expect(messagesOf(saleCreateRequest(), references)).toEqual(
        NOT_THE_BOOKING,
      )
    })

    it('refuses a booking for a sale to nobody: a booking is a customer’s', () => {
      expect(
        rulesOf(
          toNobody({ bookingId: BOOKING_ID }),
          saleReferences({ customerExists: false }),
        ),
      ).toEqual(['bookingId:not_found'])
    })

    it('refuses the booking of another customer before saying that it is billed', () => {
      expect(
        plan(
          saleCreateRequest(),
          saleReferences({
            booking: { customerId: OTHER_CUSTOMER_ID, isBilled: true },
          }),
        ).type,
      ).toBe('invalid')
    })

    it('bills a booking once', () => {
      expect(
        plan(
          saleCreateRequest(),
          saleReferences({
            booking: { customerId: CUSTOMER_ID, isBilled: true },
          }),
        ),
      ).toEqual({ type: 'bookingBilled' })
    })

    it('asks for no booking of a sale without one', () => {
      expect(
        plan(
          requestWith({ bookingId: null }),
          saleReferences({ booking: null }),
        ).type,
      ).toBe('planned')
    })
  })

  describe('the order in which a request is looked at', () => {
    const tooBig = withLines(
      line({ unitPrice: MAX_INTEGER, taxAmount: 0, totalAmount: MAX_INTEGER }),
      line({ unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
    )
    const billed = { customerId: CUSTOMER_ID, isBilled: true }

    it('says what is not there before what the sale comes to', () => {
      expect(
        rulesOf(tooBig, saleReferences({ customerExists: false })),
      ).toEqual(['customerId:not_found'])
    })

    it('says that the sale comes to too much before the day cannot be told', () => {
      expect(
        rulesOf(
          tooBig,
          saleReferences({ salon: { timezone: 'Mars/Olympus' } }),
        ),
      ).toEqual(['details:too_big'])
    })

    it('says that the day cannot be told before the booking is billed', () => {
      expect(
        plan(
          saleCreateRequest(),
          saleReferences({
            salon: { timezone: 'Mars/Olympus' },
            booking: billed,
          }),
        ),
      ).toEqual({ type: 'timeZoneUnknown' })
    })
  })
})

describe('saleNumberFrom', () => {
  /** Picks these indices one after the other. */
  const picking = (indices: number[]) => {
    const upcoming = [...indices]
    return () => upcoming.shift() ?? 0
  }

  it('is SL and two groups of four symbols', () => {
    expect(saleNumberFrom(() => 0)).toBe('SL-0000-0000')
    expect(saleNumberFrom(picking([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(
      'SL-1234-5678',
    )
  })

  it('asks for one of 32 symbols, eight times', () => {
    const counts: number[] = []

    saleNumberFrom((count) => {
      counts.push(count)
      return 0
    })

    expect(counts).toEqual([32, 32, 32, 32, 32, 32, 32, 32])
  })

  it('uses the digits and the capital letters that are not mistaken for one', () => {
    expect(
      Array.from({ length: 32 }, (_value, index) =>
        saleNumberFrom(() => index).charAt(3),
      ).join(''),
    ).toBe('0123456789ABCDEFGHJKMNPQRSTVWXYZ')
  })

  it('fits the 50 characters of its column', () => {
    expect(saleNumberFrom(() => 31)).toBe('SL-ZZZZ-ZZZZ')
    expect(saleNumberFrom(() => 31).length).toBeLessThanOrEqual(50)
  })
})
