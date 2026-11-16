import { describe, expect, it } from 'vitest'
import {
  type CalculationReferences,
  type PaymentMethodOfCalculation,
  planCalculation,
  type SaleCalculation,
} from '../business-logic/sale'
import { methodsTaking } from '../business-logic/sale/_shared/calculation'
import type { ApiSaleCalculateRequest } from '../models/sale'
import { saleCalculateRequestSchema } from '../schemas/sale.schema'
import { BOOKING_ID, COLOR_ID, CUT_ID } from './booking-fixtures'
import { SALON_ID } from './fixtures'
import {
  calculationReferences,
  saleCalculateRequest,
  TREATMENT_ID,
} from './sale-fixtures'

const MAX_INTEGER = 2_147_483_647

/** Calculates the request of the fixtures, with some of its keys changed. */
const calculate = (
  overrides: Partial<ApiSaleCalculateRequest> = {},
  references: Partial<CalculationReferences> = {},
): SaleCalculation =>
  planCalculation(
    saleCalculateRequestSchema.parse({
      ...saleCalculateRequest(),
      ...overrides,
    }),
    calculationReferences(references),
  )

/** The broken rules of a calculation, as `field:rule`; empty for one that was made. */
const rulesOf = (calculation: SaleCalculation): string[] =>
  calculation.type === 'invalid'
    ? calculation.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []

/** The breakdown of a calculation that was made; null otherwise. */
const breakdownOf = (calculation: SaleCalculation) =>
  calculation.type === 'calculated' ? calculation.calculation.breakdown : null

/** A line of a booking that nothing is taken off, without the tax in its price. */
const bookedLine = (price: number, taxIncluded = false) => ({
  price,
  discountAmount: 0,
  finalPrice: price,
  taxIncluded,
})

/** A payment method in use without limits. */
const paymentMethod = (
  overrides: Partial<PaymentMethodOfCalculation> = {},
): PaymentMethodOfCalculation => ({
  method: 'cash',
  isActive: true,
  minimumAmount: null,
  maximumAmount: null,
  ...overrides,
})

describe('planCalculation', () => {
  it('tells what the lines of the booking and the services the request adds come to, and which kinds of payment method take it', () => {
    expect(calculate()).toEqual({
      type: 'calculated',
      calculation: {
        salonId: SALON_ID,
        bookingId: BOOKING_ID,
        breakdown: {
          subtotal: 12310,
          discountAmount: 300,
          taxAmount: 1201,
          totalAmount: 13211,
        },
        recommendedMethods: ['cash', 'credit_card'],
      },
    })
  })

  it('adds the tax once to the sum and drops the fraction of a yen then, not for every line', () => {
    // Each treatment of 1,505 would have 150.5 yen of tax on its own.
    const twice = breakdownOf(calculate({ bookingId: null }, { booking: null }))
    const once = breakdownOf(
      calculate(
        { bookingId: null, services: [TREATMENT_ID] },
        { booking: null },
      ),
    )

    expect(once).toEqual({
      subtotal: 1505,
      discountAmount: 0,
      taxAmount: 150,
      totalAmount: 1655,
    })
    expect(twice).toEqual({
      subtotal: 3010,
      discountAmount: 0,
      taxAmount: 301,
      totalAmount: 3311,
    })
  })

  it('counts a service as often as the request names it', () => {
    const thrice = breakdownOf(
      calculate(
        {
          bookingId: null,
          services: [TREATMENT_ID, TREATMENT_ID, TREATMENT_ID],
        },
        { booking: null },
      ),
    )

    expect(thrice).toMatchObject({ subtotal: 4515, taxAmount: 451 })
  })

  it('counts the lines of the booking at the amounts they copied, and a service at the price it has now', () => {
    const calculation = calculate(
      { services: [CUT_ID] },
      {
        booking: {
          lines: [
            {
              price: 5000,
              discountAmount: 500,
              finalPrice: 4500,
              taxIncluded: true,
            },
          ],
        },
        services: [
          { id: CUT_ID, price: 6000, discountPrice: 5400, taxIncluded: false },
        ],
      },
    )

    expect(breakdownOf(calculation)).toEqual({
      subtotal: 11000,
      discountAmount: 1100,
      taxAmount: 540,
      totalAmount: 10440,
    })
  })

  it('takes off what the discounted price of a service takes off its price', () => {
    const calculation = calculate(
      { bookingId: null, services: [COLOR_ID] },
      {
        booking: null,
        services: [
          { id: COLOR_ID, price: 8800, discountPrice: 7040, taxIncluded: true },
        ],
      },
    )

    expect(breakdownOf(calculation)).toEqual({
      subtotal: 8800,
      discountAmount: 1760,
      taxAmount: 0,
      totalAmount: 7040,
    })
  })

  it('adds no tax to a price that includes it, and tax to the others only', () => {
    const calculation = calculate(
      { services: [] },
      { booking: { lines: [bookedLine(5500, true), bookedLine(1000)] } },
    )

    expect(breakdownOf(calculation)).toEqual({
      subtotal: 6500,
      discountAmount: 0,
      taxAmount: 100,
      totalAmount: 6600,
    })
  })

  it.each([
    ['the reduced rate', '8.00', 960],
    ['a rate with a fraction', '10.50', 1261],
    ['no tax', '0.00', 0],
  ])(
    'adds the tax at the rate of the salon: %s',
    (_case, taxRate, taxAmount) => {
      expect(
        breakdownOf(calculate({}, { salon: { taxRate } }))?.taxAmount,
      ).toBe(taxAmount)
    },
  )

  it('calculates a visit without a booking from the services alone', () => {
    const calculation = calculate({ bookingId: null }, { booking: null })

    expect(calculation).toMatchObject({
      type: 'calculated',
      calculation: { bookingId: null, breakdown: { subtotal: 3010 } },
    })
  })

  it('calculates a booking with nothing added from its lines alone', () => {
    expect(breakdownOf(calculate({ services: [] }))).toEqual({
      subtotal: 9300,
      discountAmount: 300,
      taxAmount: 900,
      totalAmount: 9900,
    })
  })

  it('reports only the salon when the salon is not there: nothing else could be of it', () => {
    const calculation = calculate(
      { services: [CUT_ID, COLOR_ID] },
      { salon: null, booking: null, services: [] },
    )

    expect(rulesOf(calculation)).toEqual(['salonId:not_found'])
  })

  it('reports a booking and services that are not of the salon together, each service in its place', () => {
    const calculation = calculate(
      { services: [CUT_ID, TREATMENT_ID, COLOR_ID, CUT_ID] },
      { booking: null },
    )

    expect(rulesOf(calculation)).toEqual([
      'bookingId:not_found',
      'services.0:not_found',
      'services.2:not_found',
      'services.3:not_found',
    ])
  })

  it('reports nothing of the booking when the request names none', () => {
    const calculation = calculate(
      { bookingId: null, services: [COLOR_ID] },
      { booking: null },
    )

    expect(rulesOf(calculation)).toEqual(['services.0:not_found'])
  })

  it.each([
    [
      'a booking without service lines and no service',
      { services: [] },
      { booking: { lines: [] } },
    ],
    [
      'no booking and no service',
      { bookingId: null, services: [] },
      { booking: null },
    ],
  ])(
    'refuses %s: there is nothing to calculate',
    (_case, change, references) => {
      const calculation = calculate(change, references)

      expect(calculation).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'services',
            rule: 'too_small',
            message: 'Must name a service when the booking has no service line',
          },
        ],
      })
    },
  )

  it('looks at whether there is a line only once everything the request names is there', () => {
    const calculation = calculate(
      { bookingId: BOOKING_ID, services: [] },
      { booking: null },
    )

    expect(rulesOf(calculation)).toEqual(['bookingId:not_found'])
  })

  it.each([
    ['a total that an integer column holds', MAX_INTEGER - 1, true, []],
    [
      'a subtotal of more than an integer column holds',
      MAX_INTEGER,
      true,
      ['services:too_big'],
    ],
    [
      'a total of more than an integer column holds, with its tax',
      2_000_000_000,
      false,
      ['services:too_big'],
    ],
  ])('takes %s', (_case, price, taxIncluded, rules) => {
    const calculation = calculate(
      { services: [CUT_ID] },
      {
        booking: { lines: [bookedLine(1, true)] },
        services: [{ id: CUT_ID, price, discountPrice: null, taxIncluded }],
      },
    )

    expect(rulesOf(calculation)).toEqual(rules)
  })

  it('tells why a sale that comes to more than it holds is refused', () => {
    const calculation = calculate(
      { services: [CUT_ID] },
      {
        services: [
          {
            id: CUT_ID,
            price: MAX_INTEGER,
            discountPrice: null,
            taxIncluded: true,
          },
        ],
      },
    )

    expect(calculation).toEqual({
      type: 'invalid',
      issues: [
        {
          field: 'services',
          rule: 'too_big',
          message: `The amounts of a sale must not exceed ${MAX_INTEGER}`,
        },
      ],
    })
  })

  it('recommends the kinds of payment method that take the total', () => {
    const calculation = calculate(
      {},
      {
        paymentMethods: [
          paymentMethod({ method: 'qr_payment', maximumAmount: 10000 }),
          paymentMethod({ method: 'e_money' }),
        ],
      },
    )

    expect(calculation).toMatchObject({
      calculation: { recommendedMethods: ['e_money'] },
    })
  })
})

describe('methodsTaking', () => {
  it('takes the kinds of the payment methods in use, in the order they come in', () => {
    expect(
      methodsTaking(5000, [
        paymentMethod({ method: 'qr_payment' }),
        paymentMethod({ method: 'cash', isActive: false }),
        paymentMethod({ method: 'credit_card' }),
      ]),
    ).toEqual(['qr_payment', 'credit_card'])
  })

  it('names a kind once, where its first payment method that takes the total comes', () => {
    expect(
      methodsTaking(5000, [
        paymentMethod({ method: 'credit_card', minimumAmount: 10000 }),
        paymentMethod({ method: 'cash' }),
        paymentMethod({ method: 'qr_payment' }),
        paymentMethod({ method: 'cash' }),
        paymentMethod({ method: 'credit_card' }),
      ]),
    ).toEqual(['cash', 'qr_payment', 'credit_card'])
  })

  it.each([
    ['a total below the smallest amount', 999, []],
    ['the smallest amount', 1000, ['credit_card']],
    ['the largest amount', 50000, ['credit_card']],
    ['a total above the largest amount', 50001, []],
  ])('holds %s to the limits of the payment method', (_case, total, kinds) => {
    expect(
      methodsTaking(total, [
        paymentMethod({
          method: 'credit_card',
          minimumAmount: 1000,
          maximumAmount: 50000,
        }),
      ]),
    ).toEqual(kinds)
  })

  it('takes any total by a payment method without limits', () => {
    expect(methodsTaking(1, [paymentMethod()])).toEqual(['cash'])
    expect(methodsTaking(MAX_INTEGER, [paymentMethod()])).toEqual(['cash'])
  })

  it('takes nothing for a total of 0, which is no payment', () => {
    expect(methodsTaking(0, [paymentMethod()])).toEqual([])
  })

  it('takes nothing when no payment method is in use', () => {
    expect(methodsTaking(5000, [paymentMethod({ isActive: false })])).toEqual(
      [],
    )
    expect(methodsTaking(5000, [])).toEqual([])
  })
})
