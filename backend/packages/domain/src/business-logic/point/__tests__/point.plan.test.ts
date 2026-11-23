import {
  pointMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import { BOOKING_ID } from '../../../__tests__/fixtures/booking-fixtures'
import {
  pointAdjustRequest,
  pointEarnRequest,
  pointUseRequest,
} from '../../../__tests__/fixtures/point-fixtures'
import { SALE_ID } from '../../../__tests__/fixtures/sale-fixtures'
import type { DbBooking } from '../../../models/booking'
import type { CustomerId } from '../../../models/customer'
import {
  pointAdjustRequestSchema,
  pointEarnRequestSchema,
  pointUseRequestSchema,
} from '../../../schemas/point.schema'
import {
  earliestExpiryDateOf,
  isClosed,
  issuesOfExpiry,
  type PointMovement,
  type PointReference,
  planPoints,
  pointsOf,
} from '../_shared/plan'

const OTHER_CUSTOMER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c05'

const customerId = (): CustomerId => {
  const parsed = pointEarnRequestSchema.parse(pointEarnRequest())
  return parsed.customerId
}

const earned = (
  overrides: Parameters<typeof pointEarnRequest>[0] = {},
): PointMovement => ({
  type: 'earned',
  request: pointEarnRequestSchema.parse(pointEarnRequest(overrides)),
})

const used = (
  overrides: Parameters<typeof pointUseRequest>[0] = {},
): PointMovement => ({
  type: 'used',
  request: pointUseRequestSchema.parse(pointUseRequest(overrides)),
})

const adjusted = (
  overrides: Parameters<typeof pointAdjustRequest>[0] = {},
): PointMovement => ({
  type: 'adjusted',
  request: pointAdjustRequestSchema.parse(pointAdjustRequest(overrides)),
})

const sale = (
  overrides: Partial<{ customerId: string | null; isVoid: boolean }> = {},
): PointReference => ({
  type: 'sale',
  customerId: CUSTOMER_ID,
  isVoid: false,
  ...overrides,
})

const booking = (
  status: DbBooking['status'],
  customer: string = CUSTOMER_ID,
): PointReference => ({ type: 'booking', customerId: customer, status })

const open = { balance: 2500, reference: sale(), referenceTaken: false }

describe('pointsOf', () => {
  it('adds what is earned, takes away what is used and moves what is adjusted either way', () => {
    expect(pointsOf(earned({ points: 120 }))).toBe(120)
    expect(pointsOf(used({ points: 500 }))).toBe(-500)
    expect(pointsOf(adjusted({ points: -300 }))).toBe(-300)
    expect(pointsOf(adjusted({ points: 300 }))).toBe(300)
  })
})

describe('isClosed', () => {
  it('closes a void sale and leaves a sale that is not void open', () => {
    expect(isClosed(sale({ isVoid: true }))).toBe(true)
    expect(isClosed(sale())).toBe(false)
  })

  const statuses: [DbBooking['status'], boolean][] = [
    ['draft', true],
    ['pending', false],
    ['confirmed', false],
    ['in_progress', false],
    ['completed', false],
    ['cancelled', true],
    ['no_show', true],
  ]

  it.each(statuses)('a booking that is %s is closed: %s', (status, closed) => {
    expect(isClosed(booking(status))).toBe(closed)
  })
})

describe('planPoints', () => {
  it('writes an earning with the balance after it and every property of the request', () => {
    expect(planPoints(customerId(), earned(), open)).toEqual({
      type: 'planned',
      write: {
        customerId: CUSTOMER_ID,
        transactionType: 'earned',
        points: 120,
        balance: 2620,
        description: 'お会計 12,650 円',
        referenceType: 'sale',
        referenceId: SALE_ID,
        expiryDate: '2027-11-30',
      },
    })
  })

  it('writes a use as negative points, without an expiry date', () => {
    expect(planPoints(customerId(), used(), open)).toEqual({
      type: 'planned',
      write: {
        customerId: CUSTOMER_ID,
        transactionType: 'used',
        points: -500,
        balance: 2000,
        description: null,
        referenceType: 'sale',
        referenceId: SALE_ID,
        expiryDate: null,
      },
    })
  })

  it('writes an adjustment without a record and without an expiry date', () => {
    expect(
      planPoints(customerId(), adjusted(), { ...open, reference: null }),
    ).toEqual({
      type: 'planned',
      write: {
        customerId: CUSTOMER_ID,
        transactionType: 'adjusted',
        points: -300,
        balance: 2200,
        description: '取り消した売上の付与を戻す',
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      },
    })
  })

  it('writes a movement without a record whatever the context says of one', () => {
    const plan = planPoints(
      customerId(),
      earned({ referenceType: null, referenceId: null }),
      { balance: 0, reference: sale({ isVoid: true }), referenceTaken: true },
    )

    expect(plan).toMatchObject({
      type: 'planned',
      write: { balance: 120, referenceType: null, referenceId: null },
    })
  })

  it('refers to a booking of the customer', () => {
    const plan = planPoints(
      customerId(),
      earned({ referenceType: 'booking', referenceId: BOOKING_ID }),
      { ...open, reference: booking('completed') },
    )

    expect(plan).toMatchObject({
      type: 'planned',
      write: { referenceType: 'booking', referenceId: BOOKING_ID },
    })
  })

  describe('the record', () => {
    it.each([
      ['no record was found', null],
      [
        'the sale is of another customer',
        sale({ customerId: OTHER_CUSTOMER_ID }),
      ],
      ['the sale has no customer', sale({ customerId: null })],
      ['the record found is a booking', booking('completed')],
    ])('is not one of the customer when %s', (_, reference) => {
      for (const movement of [
        earned(),
        used(),
        adjusted({ referenceType: 'sale', referenceId: SALE_ID }),
      ]) {
        expect(
          planPoints(customerId(), movement, { ...open, reference }),
        ).toEqual({
          type: 'invalid',
          issues: [
            {
              field: 'referenceId',
              rule: 'not_found',
              message: pointMessages.aReferenceOfCustomer('sale'),
            },
          ],
        })
      }
    })

    it('names the kind of record that is not one of the customer', () => {
      expect(
        planPoints(
          customerId(),
          used({ referenceType: 'booking', referenceId: BOOKING_ID }),
          { ...open, reference: booking('completed', OTHER_CUSTOMER_ID) },
        ),
      ).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'referenceId',
            rule: 'not_found',
            message: pointMessages.aReferenceOfCustomer('booking'),
          },
        ],
      })
    })

    it('is not earned on or used for when it is closed', () => {
      for (const movement of [earned(), used()]) {
        expect(
          planPoints(customerId(), movement, {
            ...open,
            reference: sale({ isVoid: true }),
          }),
        ).toEqual({ type: 'referenceClosed', reference: 'sale' })
      }
      expect(
        planPoints(
          customerId(),
          earned({ referenceType: 'booking', referenceId: BOOKING_ID }),
          { ...open, reference: booking('cancelled') },
        ),
      ).toEqual({ type: 'referenceClosed', reference: 'booking' })
    })

    it('is earned on or used for once', () => {
      for (const movement of [earned(), used()]) {
        expect(
          planPoints(customerId(), movement, { ...open, referenceTaken: true }),
        ).toEqual({ type: 'referenceTaken' })
      }
    })

    it('is closed before it is taken', () => {
      expect(
        planPoints(customerId(), earned(), {
          ...open,
          reference: sale({ isVoid: true }),
          referenceTaken: true,
        }),
      ).toEqual({ type: 'referenceClosed', reference: 'sale' })
    })

    it('may be adjusted for when it is closed or taken', () => {
      const plan = planPoints(
        customerId(),
        adjusted({ referenceType: 'sale', referenceId: SALE_ID }),
        {
          balance: 2500,
          reference: sale({ isVoid: true }),
          referenceTaken: true,
        },
      )

      expect(plan).toMatchObject({
        type: 'planned',
        write: { referenceType: 'sale', referenceId: SALE_ID, balance: 2200 },
      })
    })

    it('is checked before the balance', () => {
      expect(
        planPoints(customerId(), used({ points: 9999 }), {
          ...open,
          referenceTaken: true,
        }),
      ).toEqual({ type: 'referenceTaken' })
    })
  })

  describe('the balance', () => {
    it('may come to 0 and no lower', () => {
      expect(
        planPoints(customerId(), used({ points: 2500 }), open),
      ).toMatchObject({ type: 'planned', write: { balance: 0 } })
      expect(planPoints(customerId(), used({ points: 2501 }), open)).toEqual({
        type: 'balanceShort',
      })
      expect(
        planPoints(customerId(), adjusted({ points: -2501 }), open),
      ).toEqual({ type: 'balanceShort' })
    })

    it('may come to the largest integer and no higher', () => {
      const nearlyFull = { ...open, balance: 2_147_483_547 }

      expect(
        planPoints(customerId(), earned({ points: 100 }), nearlyFull),
      ).toMatchObject({ type: 'planned', write: { balance: 2_147_483_647 } })
      expect(
        planPoints(customerId(), earned({ points: 101 }), nearlyFull),
      ).toEqual({ type: 'balanceOverLimit' })
      expect(
        planPoints(customerId(), adjusted({ points: 101 }), {
          ...nearlyFull,
          reference: null,
        }),
      ).toEqual({ type: 'balanceOverLimit' })
    })
  })
})

describe('earliestExpiryDateOf', () => {
  it('is the day before the date in UTC', () => {
    expect(earliestExpiryDateOf(new Date('2026-11-20T03:00:00.000Z'))).toBe(
      '2026-11-19',
    )
    expect(earliestExpiryDateOf(new Date('2026-11-20T00:00:00.000Z'))).toBe(
      '2026-11-19',
    )
    expect(earliestExpiryDateOf(new Date('2026-11-20T23:59:59.999Z'))).toBe(
      '2026-11-19',
    )
    expect(earliestExpiryDateOf(new Date('2027-01-01T00:00:00.000Z'))).toBe(
      '2026-12-31',
    )
  })
})

describe('issuesOfExpiry', () => {
  const now = new Date('2026-11-20T03:00:00.000Z')

  it('takes no expiry date, the earliest one and any later one', () => {
    expect(issuesOfExpiry(null, now)).toEqual([])
    expect(issuesOfExpiry('2026-11-19', now)).toEqual([])
    expect(issuesOfExpiry('2026-11-20', now)).toEqual([])
    expect(issuesOfExpiry('2099-12-31', now)).toEqual([])
  })

  it('refuses a date before the earliest one', () => {
    expect(issuesOfExpiry('2026-11-18', now)).toEqual([
      {
        field: 'expiryDate',
        rule: 'too_small',
        message: ruleMessages.notEarlierThan('2026-11-19'),
      },
    ])
  })
})
