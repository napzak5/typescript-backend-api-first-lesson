import { textIn } from '@beauty-salon-shared/i18n'
import { saleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  BOOKING_ID,
  CUT_ID,
} from '../../../__tests__/fixtures/booking-fixtures'
import { dbSale, PRODUCT_ID } from '../../../__tests__/fixtures/sale-fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import type { DbPaymentTransaction, DbSale } from '../../../models/sale'
import { saleUpdateRequestSchema } from '../../../schemas/sale.schema'
import {
  bookingToHold,
  planSaleChange,
  refusalOfChange,
  refusalOfVoid,
  type SaleChangeReferences,
} from '..'

const MAX_INTEGER = 2_147_483_647

/** Another customer than the one of the sale. */
const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c09'

/** Another booking than the one of the sale. */
const OTHER_BOOKING_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f1b09'

const PAYMENT_STATUSES: DbPaymentTransaction['status'][] = [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partial_refund',
]

/** The statuses of a payment that holds money of the customer. */
const HOLDING: DbPaymentTransaction['status'][] = [
  'completed',
  'partial_refund',
]

/** A line that keeps every rule: something of no record for 1,000 yen and 100 of tax. */
const line = (overrides: Record<string, unknown> = {}) => ({
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

/** A correction as the schema hands it on. */
const change = (input: Record<string, unknown>) =>
  saleUpdateRequestSchema.parse(input)

/**
 * What a correction refers to: a salon in Tokyo and, unless a test says
 * otherwise, nothing else, as for a request that names nothing to look up.
 */
const references = (
  overrides: Partial<SaleChangeReferences> = {},
): SaleChangeReferences => ({
  salon: { timezone: 'Asia/Tokyo' },
  customerExists: false,
  staffIds: [],
  serviceIds: [],
  productIds: [],
  booking: null,
  ...overrides,
})

/** The booking of the sale of the fixtures, as it is looked up for that sale. */
const ownBooking = { customerId: CUSTOMER_ID, isBilled: false }

/** A sale to nobody: no customer, no booking, no points. */
const toNobody = (overrides: Partial<DbSale> = {}): DbSale =>
  dbSale({
    customerId: null,
    bookingId: null,
    pointsUsed: null,
    pointsEarned: null,
    ...overrides,
  })

/** A sale to the customer that is the bill of no booking. */
const withoutBooking = (overrides: Partial<DbSale> = {}): DbSale =>
  dbSale({ bookingId: null, ...overrides })

const plan = (
  input: Record<string, unknown>,
  found: SaleChangeReferences = references(),
  sale: DbSale = dbSale(),
) => planSaleChange(sale, change(input), found)

/** What a correction that is planned writes; anything else fails the test. */
const planned = (
  input: Record<string, unknown>,
  found: SaleChangeReferences = references(),
  sale: DbSale = dbSale(),
) => {
  const result = plan(input, found, sale)
  if (result.type !== 'planned') {
    throw new Error(`The correction was not planned: ${result.type}`)
  }
  return result.change
}

/** The broken rules of a correction that is refused, as `field:rule`. */
const rulesOf = (
  input: Record<string, unknown>,
  found: SaleChangeReferences = references(),
  sale: DbSale = dbSale(),
): string[] => {
  const result = plan(input, found, sale)
  return result.type === 'invalid'
    ? result.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []
}

/** What a refused correction is told, by `field`. */
const messagesOf = (
  input: Record<string, unknown>,
  found: SaleChangeReferences = references(),
  sale: DbSale = dbSale(),
): Record<string, string> => {
  const result = plan(input, found, sale)
  return result.type === 'invalid'
    ? Object.fromEntries(
        result.issues.map(({ field, message }) => [
          field,
          textIn(message, 'en'),
        ]),
      )
    : {}
}

describe('refusalOfChange', () => {
  const lines = change({ details: [line()] })
  const note = change({ notes: 'レシート再発行' })

  it('lets a sale that is not void and not paid be corrected in everything', () => {
    expect(refusalOfChange(dbSale(), lines)).toBeNull()
    expect(refusalOfChange(dbSale(), note)).toBeNull()
  })

  it('refuses every correction of a void sale', () => {
    const sale = dbSale({ isVoid: true })

    expect(refusalOfChange(sale, note)).toEqual({ type: 'void' })
    expect(refusalOfChange(sale, lines)).toEqual({ type: 'void' })
  })

  it.each(PAYMENT_STATUSES.filter((status) => status !== 'pending'))(
    'refuses new lines for a sale whose payment status is %s',
    (paymentStatus) => {
      expect(refusalOfChange(dbSale({ paymentStatus }), lines)).toEqual({
        type: 'paymentBegun',
      })
    },
  )

  it.each(PAYMENT_STATUSES)(
    'lets what is not a line be corrected whatever the payment status: %s',
    (paymentStatus) => {
      expect(
        refusalOfChange(
          dbSale({ paymentStatus }),
          change({
            customerId: OTHER_CUSTOMER_ID,
            staffId: null,
            bookingId: null,
            saleTime: '2026-11-21T01:00:00Z',
            pointsUsed: null,
            pointsEarned: 10,
            notes: null,
          }),
        ),
      ).toBeNull()
    },
  )

  it('says that a sale is void before it says that it is paid', () => {
    expect(
      refusalOfChange(
        dbSale({ isVoid: true, paymentStatus: 'completed' }),
        lines,
      ),
    ).toEqual({ type: 'void' })
  })
})

describe('bookingToHold', () => {
  it.each([
    ['notes', { notes: null }],
    ['the staff member', { staffId: OTHER_STAFF_MEMBER_ID }],
    ['the time', { saleTime: '2026-11-21T01:00:00Z' }],
    ['points', { pointsUsed: 0, pointsEarned: 0 }],
    ['lines', { details: [line()] }],
  ])('holds no booking for a correction of %s', (_case, input) => {
    expect(bookingToHold(dbSale(), change(input))).toBeNull()
  })

  it('holds the booking a correction names', () => {
    expect(
      bookingToHold(dbSale(), change({ bookingId: OTHER_BOOKING_ID })),
    ).toBe(OTHER_BOOKING_ID)
    expect(
      bookingToHold(withoutBooking(), change({ bookingId: BOOKING_ID })),
    ).toBe(BOOKING_ID)
  })

  it('holds no booking for a correction that takes the booking off the sale', () => {
    expect(bookingToHold(dbSale(), change({ bookingId: null }))).toBeNull()
    expect(
      bookingToHold(
        dbSale(),
        change({ bookingId: null, customerId: OTHER_CUSTOMER_ID }),
      ),
    ).toBeNull()
  })

  it('holds the booking the sale keeps when a correction names the customer', () => {
    expect(
      bookingToHold(dbSale(), change({ customerId: OTHER_CUSTOMER_ID })),
    ).toBe(BOOKING_ID)
    expect(bookingToHold(dbSale(), change({ customerId: null }))).toBe(
      BOOKING_ID,
    )
  })

  it('holds no booking for the customer of a sale without one', () => {
    expect(
      bookingToHold(
        withoutBooking(),
        change({ customerId: OTHER_CUSTOMER_ID }),
      ),
    ).toBeNull()
  })

  it('holds the named booking, not the one the sale had, when both are named', () => {
    expect(
      bookingToHold(
        dbSale(),
        change({ customerId: OTHER_CUSTOMER_ID, bookingId: OTHER_BOOKING_ID }),
      ),
    ).toBe(OTHER_BOOKING_ID)
  })
})

describe('planSaleChange', () => {
  it('writes the one property a correction names and leaves the lines', () => {
    expect(plan({ notes: 'レシート再発行' })).toStrictEqual({
      type: 'planned',
      change: { sale: { notes: 'レシート再発行' }, details: null },
    })
  })

  it.each([
    ['staffId', null],
    ['pointsUsed', null],
    ['pointsEarned', null],
    ['notes', null],
    ['pointsUsed', 0],
    ['pointsEarned', 5000],
  ])('writes %s as %s and nothing else', (property, value) => {
    expect(planned({ [property]: value })).toStrictEqual({
      sale: { [property]: value },
      details: null,
    })
  })

  it('writes everything a correction names, with the day and the sums that follow from it', () => {
    const found = references({
      customerExists: true,
      staffIds: [OTHER_STAFF_MEMBER_ID],
      serviceIds: [CUT_ID],
      productIds: [PRODUCT_ID],
      booking: { customerId: OTHER_CUSTOMER_ID, isBilled: false },
    })

    expect(
      planned(
        {
          customerId: OTHER_CUSTOMER_ID,
          staffId: OTHER_STAFF_MEMBER_ID,
          bookingId: OTHER_BOOKING_ID,
          saleTime: '2026-11-21T01:00:00Z',
          pointsUsed: 0,
          pointsEarned: 77,
          notes: null,
          details: [
            line({
              itemType: 'service',
              itemId: CUT_ID,
              itemName: 'カット',
              unitPrice: 6000,
              discountAmount: 500,
              taxAmount: 550,
              totalAmount: 6050,
              staffId: OTHER_STAFF_MEMBER_ID,
              commissionRate: 12.5,
              commissionAmount: 687,
              notes: '指名',
              sortOrder: 1,
            }),
            line({
              itemType: 'product',
              itemId: PRODUCT_ID,
              itemName: 'シャンプー',
              quantity: 2,
              unitPrice: 2800,
              taxAmount: 560,
              totalAmount: 6160,
              sortOrder: 0,
            }),
          ],
        },
        found,
      ),
    ).toStrictEqual({
      sale: {
        customerId: OTHER_CUSTOMER_ID,
        staffId: OTHER_STAFF_MEMBER_ID,
        bookingId: OTHER_BOOKING_ID,
        saleTime: '2026-11-21T01:00:00.000Z',
        pointsUsed: 0,
        pointsEarned: 77,
        notes: null,
        subtotal: 11600,
        discountAmount: 500,
        taxAmount: 1110,
        totalAmount: 12210,
        saleDate: '2026-11-21',
      },
      details: [
        {
          itemType: 'service',
          itemId: CUT_ID,
          itemName: 'カット',
          quantity: 1,
          unitPrice: 6000,
          discountAmount: 500,
          taxAmount: 550,
          totalAmount: 6050,
          staffId: OTHER_STAFF_MEMBER_ID,
          commissionRate: '12.50',
          commissionAmount: 687,
          notes: '指名',
          sortOrder: 1,
        },
        {
          itemType: 'product',
          itemId: PRODUCT_ID,
          itemName: 'シャンプー',
          quantity: 2,
          unitPrice: 2800,
          discountAmount: 0,
          taxAmount: 560,
          totalAmount: 6160,
          staffId: null,
          commissionRate: null,
          commissionAmount: null,
          notes: null,
          sortOrder: 0,
        },
      ],
    })
  })

  it('does not look at what the sale has and the correction does not name', () => {
    // The staff member, the customer and the booking of the sale are not
    // among what was found: they were there when they were written.
    expect(plan({ notes: null }, references()).type).toBe('planned')
    expect(plan({ pointsEarned: 1 }, references()).type).toBe('planned')
    expect(plan({ details: [line()] }, references()).type).toBe('planned')
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
      [
        'the evening before in Los Angeles',
        '2026-11-20T03:00:00Z',
        'America/Los_Angeles',
        '2026-11-19',
      ],
    ])(
      'follows a new time, in the time zone of the salon: %s',
      (_case, saleTime, timezone, saleDate) => {
        expect(
          planned({ saleTime }, references({ salon: { timezone } })).sale,
        ).toStrictEqual({
          saleTime: new Date(saleTime).toISOString(),
          saleDate,
        })
      },
    )

    it('stays as it is without a new time, whatever the time zone of the salon is by now', () => {
      const elsewhere = references({
        salon: { timezone: 'America/Los_Angeles' },
      })

      expect(planned({ notes: null }, elsewhere).sale).toStrictEqual({
        notes: null,
      })
    })

    it.each([
      ['a name that is none', 'Mars/Olympus'],
      ['an empty name', ''],
    ])('cannot be told in a time zone with %s', (_case, timezone) => {
      expect(
        plan(
          { saleTime: '2026-11-21T01:00:00Z' },
          references({ salon: { timezone } }),
        ),
      ).toEqual({ type: 'timeZoneUnknown' })
    })

    it('is not asked for by a correction that names no time: a time zone that is not known is no obstacle', () => {
      const unknown = references({ salon: { timezone: 'Mars/Olympus' } })

      expect(plan({ notes: null }, unknown).type).toBe('planned')
      expect(plan({ details: [line()] }, unknown).type).toBe('planned')
    })
  })

  describe('the lines of a sale', () => {
    it('take the place of the lines the sale has, and the sale says what they come to', () => {
      expect(
        planned({
          details: [
            line(),
            line({
              quantity: 3,
              discountAmount: 300,
              taxAmount: 270,
              totalAmount: 2970,
              sortOrder: 1,
            }),
          ],
        }).sale,
      ).toStrictEqual({
        subtotal: 4000,
        discountAmount: 300,
        taxAmount: 370,
        totalAmount: 4070,
      })
    })

    it('leave the sums alone when the correction names none', () => {
      expect(planned({ notes: null })).toStrictEqual({
        sale: { notes: null },
        details: null,
      })
    })

    it('may come to what an integer column holds, and not to more', () => {
      const most = line({
        unitPrice: MAX_INTEGER,
        taxAmount: 0,
        totalAmount: MAX_INTEGER,
      })
      const one = line({
        unitPrice: 1,
        taxAmount: 0,
        totalAmount: 1,
        sortOrder: 1,
      })

      expect(planned({ details: [most] }).sale).toStrictEqual({
        subtotal: MAX_INTEGER,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: MAX_INTEGER,
      })
      expect(plan({ details: [most, one] })).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'details',
            rule: 'too_big',
            message: saleMessages.amountsWithinLimit(MAX_INTEGER),
          },
        ],
      })
    })

    it('name staff members, services and products of the salon', () => {
      const details = [
        line({ staffId: STAFF_MEMBER_ID }),
        line({
          itemType: 'service',
          itemId: CUT_ID,
          staffId: OTHER_STAFF_MEMBER_ID,
          sortOrder: 1,
        }),
        line({ itemType: 'product', itemId: PRODUCT_ID, sortOrder: 2 }),
      ]

      expect(
        plan(
          { details },
          references({
            staffIds: [STAFF_MEMBER_ID, OTHER_STAFF_MEMBER_ID],
            serviceIds: [CUT_ID],
            productIds: [PRODUCT_ID],
          }),
        ).type,
      ).toBe('planned')
      expect(messagesOf({ details })).toEqual({
        'details.0.staffId': 'Must name a staff member of the salon',
        'details.1.staffId': 'Must name a staff member of the salon',
        'details.1.itemId': 'Must name a service of the salon',
        'details.2.itemId': 'Must name a product of the salon',
      })
    })

    it('do not take a product for a service, or a service for a product', () => {
      expect(
        rulesOf(
          {
            details: [
              line({ itemType: 'service', itemId: PRODUCT_ID }),
              line({ itemType: 'product', itemId: CUT_ID, sortOrder: 1 }),
            ],
          },
          references({ serviceIds: [CUT_ID], productIds: [PRODUCT_ID] }),
        ),
      ).toEqual(['details.0.itemId:not_found', 'details.1.itemId:not_found'])
    })
  })

  describe('what a correction refers to', () => {
    it('takes a customer who is there', () => {
      expect(
        planned(
          { customerId: OTHER_CUSTOMER_ID },
          references({ customerExists: true }),
          withoutBooking(),
        ),
      ).toStrictEqual({
        sale: { customerId: OTHER_CUSTOMER_ID },
        details: null,
      })
    })

    it('refuses a customer who is not there', () => {
      expect(
        messagesOf(
          { customerId: OTHER_CUSTOMER_ID },
          references(),
          withoutBooking(),
        ),
      ).toEqual({ customerId: 'Must name a customer' })
    })

    it('refuses the customer the sale has when a correction names them and they are gone', () => {
      expect(
        rulesOf({ customerId: CUSTOMER_ID }, references(), withoutBooking()),
      ).toEqual(['customerId:not_found'])
    })

    it('takes a staff member of the salon, and refuses one who is not', () => {
      expect(
        plan(
          { staffId: OTHER_STAFF_MEMBER_ID },
          references({ staffIds: [OTHER_STAFF_MEMBER_ID] }),
        ).type,
      ).toBe('planned')
      expect(
        messagesOf(
          { staffId: OTHER_STAFF_MEMBER_ID },
          references({ staffIds: [STAFF_MEMBER_ID] }),
        ),
      ).toEqual({ staffId: 'Must name a staff member of the salon' })
    })

    it('does not ask whether nobody is there', () => {
      expect(
        planned(
          { customerId: null, staffId: null, bookingId: null },
          references(),
          toNobody(),
        ),
      ).toStrictEqual({
        sale: { customerId: null, staffId: null, bookingId: null },
        details: null,
      })
    })

    it('reports everything that is not there at once, in the order of a sale that is entered', () => {
      expect(
        rulesOf(
          {
            customerId: OTHER_CUSTOMER_ID,
            staffId: OTHER_STAFF_MEMBER_ID,
            bookingId: OTHER_BOOKING_ID,
            details: [
              line({
                itemType: 'service',
                itemId: CUT_ID,
                staffId: STAFF_MEMBER_ID,
              }),
            ],
          },
          references(),
        ),
      ).toEqual([
        'customerId:not_found',
        'staffId:not_found',
        'bookingId:not_found',
        'details.0.staffId:not_found',
        'details.0.itemId:not_found',
      ])
    })
  })

  describe('the booking of a sale', () => {
    const NOT_THE_BOOKING =
      'Must name a booking of the salon that is of the customer of the sale'
    const NOT_THE_CUSTOMER = 'Must name the customer of the booking of the sale'

    it('takes a booking of the customer the sale has', () => {
      expect(
        planned(
          { bookingId: BOOKING_ID },
          references({ booking: ownBooking }),
          withoutBooking(),
        ),
      ).toStrictEqual({ sale: { bookingId: BOOKING_ID }, details: null })
    })

    it('refuses a booking that is not of the salon', () => {
      expect(
        messagesOf(
          { bookingId: OTHER_BOOKING_ID },
          references({ booking: null }),
        ),
      ).toEqual({ bookingId: NOT_THE_BOOKING })
    })

    it('refuses the booking of another customer than the one the sale has', () => {
      expect(
        messagesOf(
          { bookingId: OTHER_BOOKING_ID },
          references({
            booking: { customerId: OTHER_CUSTOMER_ID, isBilled: false },
          }),
        ),
      ).toEqual({ bookingId: NOT_THE_BOOKING })
    })

    it('refuses a booking for a sale to nobody: a booking is a customer’s', () => {
      expect(
        rulesOf(
          { bookingId: BOOKING_ID },
          references({ booking: ownBooking }),
          toNobody(),
        ),
      ).toEqual(['bookingId:not_found'])
    })

    it('holds a named booking to the customer the correction names with it', () => {
      const ofTheOther = references({
        customerExists: true,
        booking: { customerId: OTHER_CUSTOMER_ID, isBilled: false },
      })

      expect(
        plan(
          { customerId: OTHER_CUSTOMER_ID, bookingId: OTHER_BOOKING_ID },
          ofTheOther,
        ).type,
      ).toBe('planned')
      expect(
        rulesOf(
          { customerId: CUSTOMER_ID, bookingId: OTHER_BOOKING_ID },
          ofTheOther,
        ),
      ).toEqual(['bookingId:not_found'])
    })

    it('refuses another customer for a sale that keeps its booking, and says so of the customer', () => {
      expect(
        messagesOf(
          { customerId: OTHER_CUSTOMER_ID },
          references({ customerExists: true, booking: ownBooking }),
        ),
      ).toEqual({ customerId: NOT_THE_CUSTOMER })
    })

    it('refuses nobody for a sale that keeps its booking, and its points with them', () => {
      expect(
        messagesOf({ customerId: null }, references({ booking: ownBooking })),
      ).toEqual({
        customerId: NOT_THE_CUSTOMER,
        pointsUsed: 'Must be null for a sale without a customer',
        pointsEarned: 'Must be null for a sale without a customer',
      })
    })

    it('says of a customer who is not there only that, not also that the booking is another’s', () => {
      expect(
        messagesOf(
          { customerId: OTHER_CUSTOMER_ID },
          references({ booking: ownBooking }),
        ),
      ).toEqual({ customerId: 'Must name a customer' })
    })

    it('takes the customer of the booking the sale keeps', () => {
      expect(
        plan(
          { customerId: CUSTOMER_ID },
          references({ customerExists: true, booking: ownBooking }),
        ).type,
      ).toBe('planned')
    })

    it('lets the customer change when the booking is taken off with them', () => {
      expect(
        planned(
          { customerId: OTHER_CUSTOMER_ID, bookingId: null },
          references({ customerExists: true }),
        ),
      ).toStrictEqual({
        sale: { customerId: OTHER_CUSTOMER_ID, bookingId: null },
        details: null,
      })
    })

    it('bills a booking once: one that another sale bills is not taken', () => {
      expect(
        plan(
          { bookingId: BOOKING_ID },
          references({ booking: { ...ownBooking, isBilled: true } }),
          withoutBooking(),
        ),
      ).toEqual({ type: 'bookingBilled' })
    })

    it('refuses the booking of another customer before saying that it is billed', () => {
      expect(
        plan(
          { bookingId: OTHER_BOOKING_ID },
          references({
            booking: { customerId: OTHER_CUSTOMER_ID, isBilled: true },
          }),
        ).type,
      ).toBe('invalid')
    })
  })

  describe('the points of a sale', () => {
    const NOBODYS = 'Must be null for a sale without a customer'

    it.each(['pointsUsed', 'pointsEarned'])(
      'refuses %s for a sale to nobody, be it 0',
      (property) => {
        expect(rulesOf({ [property]: 0 }, references(), toNobody())).toEqual([
          `${property}:custom`,
        ])
        expect(rulesOf({ [property]: 50 }, references(), toNobody())).toEqual([
          `${property}:custom`,
        ])
      },
    )

    it('takes points for a sale that gets its customer with them', () => {
      expect(
        plan(
          { customerId: CUSTOMER_ID, pointsUsed: 10, pointsEarned: 20 },
          references({ customerExists: true }),
          toNobody(),
        ).type,
      ).toBe('planned')
    })

    it('refuses to take the customer off a sale that keeps points', () => {
      expect(
        messagesOf({ customerId: null }, references(), withoutBooking()),
      ).toEqual({ pointsUsed: NOBODYS, pointsEarned: NOBODYS })
    })

    it('names the points that stay, not the ones the correction empties', () => {
      expect(
        rulesOf(
          { customerId: null, pointsUsed: null },
          references(),
          withoutBooking(),
        ),
      ).toEqual(['pointsEarned:custom'])
      expect(
        rulesOf(
          { customerId: null, pointsEarned: null },
          references(),
          withoutBooking(),
        ),
      ).toEqual(['pointsUsed:custom'])
    })

    it.each([
      ['pointsUsed', { pointsUsed: 5, pointsEarned: null }],
      ['pointsEarned', { pointsUsed: null, pointsEarned: 5 }],
    ])(
      'names %s alone when those are the only points the sale keeps',
      (property, points) => {
        expect(
          rulesOf({ customerId: null }, references(), withoutBooking(points)),
        ).toEqual([`${property}:custom`])
      },
    )

    it('takes the customer off a sale whose points are emptied with them', () => {
      expect(
        planned(
          { customerId: null, pointsUsed: null, pointsEarned: null },
          references(),
          withoutBooking(),
        ),
      ).toStrictEqual({
        sale: { customerId: null, pointsUsed: null, pointsEarned: null },
        details: null,
      })
    })

    it('takes the customer off a sale that has no points', () => {
      expect(
        plan(
          { customerId: null },
          references(),
          withoutBooking({ pointsUsed: null, pointsEarned: null }),
        ).type,
      ).toBe('planned')
    })

    it('keeps the points of a sale whose customer changes', () => {
      expect(
        planned(
          { customerId: OTHER_CUSTOMER_ID },
          references({ customerExists: true }),
          withoutBooking(),
        ).sale,
      ).toStrictEqual({ customerId: OTHER_CUSTOMER_ID })
    })
  })

  describe('the order in which a correction is looked at', () => {
    const tooBig = [
      line({ unitPrice: MAX_INTEGER, taxAmount: 0, totalAmount: MAX_INTEGER }),
      line({ unitPrice: 1, taxAmount: 0, totalAmount: 1, sortOrder: 1 }),
    ]
    const billed = { customerId: CUSTOMER_ID, isBilled: true }
    const lost = { timezone: 'Mars/Olympus' }

    it('says what is not there before what the sale comes to', () => {
      expect(
        rulesOf({ staffId: OTHER_STAFF_MEMBER_ID, details: tooBig }),
      ).toEqual(['staffId:not_found'])
    })

    it('says that the sale comes to too much before the day cannot be told', () => {
      expect(
        rulesOf(
          { saleTime: '2026-11-21T01:00:00Z', details: tooBig },
          references({ salon: lost }),
        ),
      ).toEqual(['details:too_big'])
    })

    it('says that the day cannot be told before the booking is billed', () => {
      expect(
        plan(
          { saleTime: '2026-11-21T01:00:00Z', bookingId: BOOKING_ID },
          references({ salon: lost, booking: billed }),
          withoutBooking(),
        ),
      ).toEqual({ type: 'timeZoneUnknown' })
    })

    it('says what is not there before the booking is billed', () => {
      expect(
        rulesOf(
          { bookingId: BOOKING_ID, staffId: OTHER_STAFF_MEMBER_ID },
          references({ booking: billed }),
          withoutBooking(),
        ),
      ).toEqual(['staffId:not_found'])
    })
  })
})

describe('refusalOfVoid', () => {
  const payments = (...statuses: DbPaymentTransaction['status'][]) =>
    statuses.map((status) => ({ status }))

  it('lets a sale without a payment be voided', () => {
    expect(refusalOfVoid(dbSale(), [])).toBeNull()
  })

  it('refuses a sale that is void already', () => {
    expect(refusalOfVoid(dbSale({ isVoid: true }), [])).toEqual({
      type: 'void',
    })
  })

  it.each(HOLDING)(
    'refuses a sale with a payment that is %s: it holds money of the customer',
    (status) => {
      expect(refusalOfVoid(dbSale(), payments(status))).toEqual({
        type: 'paid',
      })
    },
  )

  it.each(PAYMENT_STATUSES.filter((status) => !HOLDING.includes(status)))(
    'lets a sale with a payment that is %s be voided: it holds nothing',
    (status) => {
      expect(refusalOfVoid(dbSale(), payments(status))).toBeNull()
    },
  )

  it('refuses a sale one of whose payments holds money, wherever it stands among them', () => {
    expect(
      refusalOfVoid(dbSale(), payments('failed', 'refunded', 'completed')),
    ).toEqual({ type: 'paid' })
    expect(
      refusalOfVoid(dbSale(), payments('partial_refund', 'failed')),
    ).toEqual({ type: 'paid' })
    expect(
      refusalOfVoid(dbSale(), payments('failed', 'refunded', 'pending')),
    ).toBeNull()
  })

  it('does not go by the payment status of the sale, which follows from the payments', () => {
    expect(refusalOfVoid(dbSale({ paymentStatus: 'completed' }), [])).toBeNull()
    expect(
      refusalOfVoid(
        dbSale({ paymentStatus: 'pending' }),
        payments('completed'),
      ),
    ).toEqual({ type: 'paid' })
  })

  it('says that a sale is void before it says that it is paid', () => {
    expect(
      refusalOfVoid(dbSale({ isVoid: true }), payments('completed')),
    ).toEqual({ type: 'void' })
  })
})
