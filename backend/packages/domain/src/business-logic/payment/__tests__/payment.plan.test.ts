import { describe, expect, it } from 'vitest'
import {
  PAYMENT_NUMBER,
  paymentRefundRequest,
  saleProcessRequest,
} from '../../../__tests__/fixtures/payment-fixtures'
import { PAYMENT_METHOD_ID } from '../../../__tests__/fixtures/payment-method-fixtures'
import { SALE_ID } from '../../../__tests__/fixtures/sale-fixtures'
import type { DbPaymentMethod } from '../../../models/payment-method'
import type { DbPaymentTransaction } from '../../../models/sale'
import {
  paymentRefundRequestSchema,
  saleProcessRequestSchema,
} from '../../../schemas/payment.schema'
import { toldIn } from '../../../shared'
import {
  type MoneyOfPayment,
  type PaymentMethodOfPayment,
  paymentNumberFrom,
  planPayment,
  planRefund,
  refusalOfPayment,
} from '..'
import { NOT_A_CARD, paymentStatusOf } from '../_shared/plan'

/** What the sale of the fixtures charges. */
const TOTAL = 12650

const sale = { id: SALE_ID, totalAmount: TOTAL }

/** The statuses of a payment whose money was never received. */
const NOT_RECEIVED: DbPaymentTransaction['status'][] = [
  'pending',
  'processing',
  'failed',
]

/** The kinds of payment method that are no card. */
const NOT_CARDS: DbPaymentMethod['method'][] = [
  'cash',
  'e_money',
  'qr_payment',
  'bank_transfer',
  'point',
]

/** A payment that was received and not given back. */
const completed = (amount: number): MoneyOfPayment => ({
  status: 'completed',
  amount,
  refundAmount: null,
})

/** A payment a part of which was given back. */
const partlyRefunded = (
  amount: number,
  refundAmount: number,
): MoneyOfPayment => ({ status: 'partial_refund', amount, refundAmount })

/** A payment all of which was given back. */
const refunded = (amount: number): MoneyOfPayment => ({
  status: 'refunded',
  amount,
  refundAmount: amount,
})

/** A payment in a status in which no money was received. */
const notReceived = (
  status: DbPaymentTransaction['status'],
  amount: number,
): MoneyOfPayment => ({ status, amount, refundAmount: null })

/** A card terminal that is in use and has no limits. */
const card = (
  overrides: Partial<PaymentMethodOfPayment> = {},
): PaymentMethodOfPayment => ({
  method: 'credit_card',
  isActive: true,
  minimumAmount: null,
  maximumAmount: null,
  ...overrides,
})

/** The till: cash, in use, without limits. */
const cash = (
  overrides: Partial<PaymentMethodOfPayment> = {},
): PaymentMethodOfPayment => card({ method: 'cash', ...overrides })

/** A payment as the schema hands it on. */
const payment = (overrides: Record<string, unknown> = {}) =>
  saleProcessRequestSchema.parse({ ...saleProcessRequest(), ...overrides })

/** A payment of which no card is recorded. */
const withoutCard = (overrides: Record<string, unknown> = {}) =>
  payment({ cardLastFour: null, cardBrand: null, ...overrides })

/** A refund as the schema hands it on. */
const refund = (overrides: Record<string, unknown> = {}) =>
  paymentRefundRequestSchema.parse({ ...paymentRefundRequest(), ...overrides })

const origin = { transactionNumber: PAYMENT_NUMBER }

const plan = (
  request: ReturnType<typeof payment>,
  paymentMethod: PaymentMethodOfPayment | null = card(),
  payments: readonly MoneyOfPayment[] = [],
) => planPayment(sale, payments, paymentMethod, request, origin)

/** The broken rules of a plan, as `field:rule`; empty for a planned payment. */
const rulesOf = (
  planned: ReturnType<typeof planPayment> | ReturnType<typeof planRefund>,
): string[] =>
  planned.type === 'invalid'
    ? planned.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []

/** What a refused plan is told, in the order of the issues. */
const messagesOf = (
  planned: ReturnType<typeof planPayment> | ReturnType<typeof planRefund>,
): string[] =>
  planned.type === 'invalid'
    ? planned.issues.map(({ message }) => toldIn(message, 'en'))
    : []

describe('paymentStatusOf', () => {
  it.each<[string, MoneyOfPayment[], string]>([
    ['no payment', [], 'pending'],
    ['a part of the total', [completed(5000)], 'processing'],
    ['one yen less than the total', [completed(TOTAL - 1)], 'processing'],
    ['the total at once', [completed(TOTAL)], 'completed'],
    [
      'the total in two payments',
      [completed(5000), completed(7650)],
      'completed',
    ],
    [
      'the total, a part of it given back',
      [partlyRefunded(TOTAL, 5500)],
      'partial_refund',
    ],
    [
      'the total, one yen of it given back',
      [partlyRefunded(TOTAL, 1)],
      'partial_refund',
    ],
    [
      'two payments, one of them given back',
      [refunded(5000), completed(7650)],
      'partial_refund',
    ],
    [
      'two payments, one given back and a part of the other',
      [refunded(5000), partlyRefunded(7650, 650)],
      'partial_refund',
    ],
    ['the total, all of it given back', [refunded(TOTAL)], 'refunded'],
    [
      'two payments, both given back',
      [refunded(5000), refunded(7650)],
      'refunded',
    ],
    ['a part of the total, all of it given back', [refunded(5000)], 'refunded'],
    [
      'a part of the total, a part of that given back',
      [partlyRefunded(5000, 1)],
      'partial_refund',
    ],
  ])('is told a sale with %s', (_case, payments, status) => {
    expect(paymentStatusOf(TOTAL, payments)).toBe(status)
  })

  it.each(NOT_RECEIVED)(
    'does not count a payment that is %s: nothing was received with it',
    (status) => {
      expect(paymentStatusOf(TOTAL, [notReceived(status, TOTAL)])).toBe(
        'pending',
      )
      expect(
        paymentStatusOf(TOTAL, [notReceived(status, TOTAL), completed(5000)]),
      ).toBe('processing')
      expect(
        paymentStatusOf(TOTAL, [notReceived(status, 1), completed(TOTAL - 1)]),
      ).toBe('processing')
    },
  )

  it('does not count what a payment that was never received says of a refund', () => {
    expect(
      paymentStatusOf(TOTAL, [
        { status: 'failed', amount: TOTAL, refundAmount: TOTAL },
        completed(TOTAL),
      ]),
    ).toBe('completed')
  })

  it('never tells a sale that it failed', () => {
    expect(
      paymentStatusOf(TOTAL, [
        notReceived('failed', TOTAL),
        notReceived('failed', TOTAL),
      ]),
    ).toBe('pending')
  })

  it('leaves a sale that charges nothing pending', () => {
    expect(paymentStatusOf(0, [])).toBe('pending')
  })

  it('counts a sale that received more than it charges as completed', () => {
    expect(paymentStatusOf(TOTAL, [completed(TOTAL + 1)])).toBe('completed')
  })
})

describe('refusalOfPayment', () => {
  const open = { isVoid: false, totalAmount: TOTAL }

  it.each<[string, MoneyOfPayment[]]>([
    ['nothing', []],
    ['a part of the total', [completed(5000)]],
    ['all but one yen', [completed(5000), completed(7649)]],
    [
      'only payments that were never received',
      NOT_RECEIVED.map((status) => notReceived(status, TOTAL)),
    ],
  ])('lets a sale that received %s take a payment', (_case, payments) => {
    expect(refusalOfPayment(open, payments)).toBeNull()
  })

  it('refuses a void sale', () => {
    expect(refusalOfPayment({ ...open, isVoid: true }, [])).toEqual({
      type: 'void',
    })
  })

  it.each<[string, MoneyOfPayment[]]>([
    ['was paid', [completed(TOTAL)]],
    ['was refunded', [refunded(TOTAL)]],
    ['was refunded in part', [partlyRefunded(5000, 100)]],
  ])('says of a void sale that %s that it is void', (_case, payments) => {
    expect(refusalOfPayment({ ...open, isVoid: true }, payments)).toEqual({
      type: 'void',
    })
  })

  it.each<[string, MoneyOfPayment[]]>([
    ['the total at once', [completed(TOTAL)]],
    ['the total in two payments', [completed(5000), completed(7650)]],
    ['more than the total', [completed(TOTAL + 1)]],
  ])('refuses a sale that received %s: nothing is left', (_case, payments) => {
    expect(refusalOfPayment(open, payments)).toEqual({ type: 'nothingLeft' })
  })

  it('refuses a sale that charges nothing: nothing is left', () => {
    expect(refusalOfPayment({ isVoid: false, totalAmount: 0 }, [])).toEqual({
      type: 'nothingLeft',
    })
  })

  it.each<[string, MoneyOfPayment[]]>([
    ['all it received', [refunded(TOTAL)]],
    ['one of its payments', [refunded(5000), completed(7650)]],
    ['a part of a payment', [partlyRefunded(TOTAL, 1)]],
    [
      'a part of a payment that left something to pay',
      [partlyRefunded(5000, 1)],
    ],
    ['a payment that left something to pay', [refunded(5000)]],
  ])('refuses a sale that gave back %s', (_case, payments) => {
    expect(refusalOfPayment(open, payments)).toEqual({ type: 'refundMade' })
  })
})

describe('planPayment', () => {
  it('plans the payment of the whole sale with a card', () => {
    expect(plan(payment())).toEqual({
      type: 'planned',
      write: {
        payment: {
          saleId: SALE_ID,
          paymentMethodId: PAYMENT_METHOD_ID,
          transactionNumber: PAYMENT_NUMBER,
          amount: TOTAL,
          status: 'completed',
          cardLastFour: '4242',
          cardBrand: 'visa',
        },
        paymentStatus: 'completed',
      },
    })
  })

  it('plans a payment of a part of the sale, which is processing with it', () => {
    expect(plan(withoutCard({ amount: 5000 }), cash())).toEqual({
      type: 'planned',
      write: {
        payment: {
          saleId: SALE_ID,
          paymentMethodId: PAYMENT_METHOD_ID,
          transactionNumber: PAYMENT_NUMBER,
          amount: 5000,
          status: 'completed',
          cardLastFour: null,
          cardBrand: null,
        },
        paymentStatus: 'processing',
      },
    })
  })

  it.each<[string, number, string]>([
    ['what is left', 7650, 'completed'],
    ['one yen less than what is left', 7649, 'processing'],
    ['one yen', 1, 'processing'],
  ])(
    'plans a second payment of %s after one of 5,000 yen',
    (_case, amount, paymentStatus) => {
      expect(
        plan(withoutCard({ amount }), cash(), [completed(5000)]),
      ).toMatchObject({
        type: 'planned',
        write: { payment: { amount, status: 'completed' }, paymentStatus },
      })
    },
  )

  it('writes every payment as completed: it is the record of money that was taken', () => {
    const planned = plan(withoutCard({ amount: 1 }), cash())

    expect(planned).toMatchObject({
      type: 'planned',
      write: { payment: { status: 'completed' } },
    })
  })

  it('names the sale, the payment method and the number it was given', () => {
    const planned = planPayment(
      { id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3a02', totalAmount: 100 },
      [],
      cash(),
      withoutCard({ amount: 100 }),
      { transactionNumber: 'PT-0000-0001' },
    )

    expect(planned).toMatchObject({
      type: 'planned',
      write: {
        payment: {
          saleId: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f3a02',
          paymentMethodId: PAYMENT_METHOD_ID,
          transactionNumber: 'PT-0000-0001',
        },
        paymentStatus: 'completed',
      },
    })
  })

  describe('the payment method', () => {
    it('refuses a payment method that is not one of the salon', () => {
      const planned = plan(payment(), null)

      expect(rulesOf(planned)).toEqual(['paymentMethodId:not_found'])
      expect(messagesOf(planned)).toEqual([
        'Must name a payment method of the salon of the sale that is active',
      ])
    })

    it('refuses a payment method that is not in use', () => {
      expect(rulesOf(plan(payment(), card({ isActive: false })))).toEqual([
        'paymentMethodId:not_found',
      ])
    })

    it('asks nothing else of a payment method that is not in use', () => {
      expect(
        rulesOf(
          plan(
            payment({ amount: 500 }),
            cash({ isActive: false, minimumAmount: 1000, maximumAmount: 100 }),
          ),
        ),
      ).toEqual(['paymentMethodId:not_found'])
    })

    it('says of a payment method that is not there what is left to pay as well', () => {
      expect(rulesOf(plan(payment({ amount: TOTAL + 1 }), null))).toEqual([
        'paymentMethodId:not_found',
        'amount:too_big',
      ])
    })
  })

  describe('the card', () => {
    it.each<[DbPaymentMethod['method']]>([['credit_card'], ['debit_card']])(
      'keeps the digits and the brand for a payment by %s',
      (method) => {
        expect(plan(payment(), card({ method }))).toMatchObject({
          type: 'planned',
          write: { payment: { cardLastFour: '4242', cardBrand: 'visa' } },
        })
      },
    )

    it.each<[DbPaymentMethod['method']]>([['credit_card'], ['debit_card']])(
      'records a payment by %s without the digits and the brand',
      (method) => {
        expect(plan(withoutCard(), card({ method }))).toMatchObject({
          type: 'planned',
          write: { payment: { cardLastFour: null, cardBrand: null } },
        })
      },
    )

    it.each(NOT_CARDS)('records a payment by %s without a card', (method) => {
      expect(plan(withoutCard(), card({ method })).type).toBe('planned')
    })

    it.each(NOT_CARDS)(
      'refuses the digits and the brand of a card for a payment by %s',
      (method) => {
        const planned = plan(payment(), card({ method }))

        expect(rulesOf(planned)).toEqual([
          'cardLastFour:custom',
          'cardBrand:custom',
        ])
        expect(messagesOf(planned)).toEqual([NOT_A_CARD, NOT_A_CARD])
      },
    )

    it('refuses the digits alone for a payment in cash', () => {
      expect(rulesOf(plan(payment({ cardBrand: null }), cash()))).toEqual([
        'cardLastFour:custom',
      ])
    })

    it('refuses the brand alone for a payment in cash', () => {
      expect(rulesOf(plan(payment({ cardLastFour: null }), cash()))).toEqual([
        'cardBrand:custom',
      ])
    })

    it('says what is wrong with the card in words', () => {
      expect(NOT_A_CARD).toBe(
        'Must be null unless the payment method is a credit card or a debit card',
      )
    })
  })

  describe('the limits of the payment method', () => {
    it.each<[string, number]>([
      ['the lower limit', 1000],
      ['the upper limit', 5000],
      ['an amount between the limits', 3000],
    ])('takes %s', (_case, amount) => {
      expect(
        plan(
          payment({ amount }),
          card({ minimumAmount: 1000, maximumAmount: 5000 }),
        ).type,
      ).toBe('planned')
    })

    it('refuses an amount below the lower limit', () => {
      const planned = plan(
        payment({ amount: 999 }),
        card({ minimumAmount: 1000 }),
      )

      expect(rulesOf(planned)).toEqual(['amount:too_small'])
      expect(messagesOf(planned)).toEqual([
        'Must not be less than the minimumAmount of the payment method (1000)',
      ])
    })

    it('refuses an amount above the upper limit', () => {
      const planned = plan(
        payment({ amount: 5001 }),
        card({ maximumAmount: 5000 }),
      )

      expect(rulesOf(planned)).toEqual(['amount:too_big'])
      expect(messagesOf(planned)).toEqual([
        'Must not be more than the maximumAmount of the payment method (5000)',
      ])
    })

    it('takes any amount up to what is left when the payment method has no limits', () => {
      expect(plan(payment({ amount: 1 })).type).toBe('planned')
      expect(plan(payment({ amount: TOTAL })).type).toBe('planned')
    })

    it('holds the last payment of a sale to the lower limit as well', () => {
      expect(
        rulesOf(
          plan(payment({ amount: 650 }), card({ minimumAmount: 1000 }), [
            completed(12000),
          ]),
        ),
      ).toEqual(['amount:too_small'])
    })
  })

  describe('what is left to pay', () => {
    it('refuses more than the sale charges', () => {
      const planned = plan(payment({ amount: TOTAL + 1 }))

      expect(rulesOf(planned)).toEqual(['amount:too_big'])
      expect(messagesOf(planned)).toEqual([
        'Must not be more than what is left to pay (12650)',
      ])
    })

    it('refuses more than the payments before it left', () => {
      const planned = plan(payment({ amount: 7651 }), card(), [
        completed(3000),
        completed(2000),
      ])

      expect(rulesOf(planned)).toEqual(['amount:too_big'])
      expect(messagesOf(planned)).toEqual([
        'Must not be more than what is left to pay (7650)',
      ])
    })

    it.each(NOT_RECEIVED)(
      'does not count a payment that is %s against what is left',
      (status) => {
        expect(
          plan(payment(), card(), [notReceived(status, TOTAL)]),
        ).toMatchObject({
          type: 'planned',
          write: { paymentStatus: 'completed' },
        })
      },
    )

    it('does not count a refund as something that is left to pay again', () => {
      const planned = plan(payment({ amount: 7651 }), card(), [
        partlyRefunded(5000, 5000 - 1),
      ])

      expect(messagesOf(planned)).toEqual([
        'Must not be more than what is left to pay (7650)',
      ])
    })

    it('says of an amount above the upper limit and above what is left both', () => {
      const planned = plan(
        payment({ amount: TOTAL + 1 }),
        card({ maximumAmount: 5000 }),
      )

      expect(rulesOf(planned)).toEqual(['amount:too_big', 'amount:too_big'])
      expect(messagesOf(planned)).toEqual([
        'Must not be more than the maximumAmount of the payment method (5000)',
        'Must not be more than what is left to pay (12650)',
      ])
    })
  })

  it('reports what is wrong in the order of the payment method, the card and the amount', () => {
    expect(
      rulesOf(
        plan(
          payment({ amount: TOTAL + 1 }),
          cash({ minimumAmount: 20000, maximumAmount: 10000 }),
        ),
      ),
    ).toEqual([
      'cardLastFour:custom',
      'cardBrand:custom',
      'amount:too_small',
      'amount:too_big',
      'amount:too_big',
    ])
  })
})

describe('planRefund', () => {
  const planOf = (
    refunding: MoneyOfPayment,
    request: ReturnType<typeof refund> = refund(),
    others: readonly MoneyOfPayment[] = [],
  ) => planRefund({ totalAmount: TOTAL }, refunding, others, request)

  it('plans a refund of a part of a payment', () => {
    expect(planOf(completed(TOTAL))).toEqual({
      type: 'planned',
      write: {
        payment: {
          status: 'partial_refund',
          refundAmount: 5500,
          refundReason: '商品の返品',
        },
        paymentStatus: 'partial_refund',
      },
    })
  })

  it('plans a refund of all of a payment', () => {
    expect(planOf(completed(TOTAL), refund({ refundAmount: TOTAL }))).toEqual({
      type: 'planned',
      write: {
        payment: {
          status: 'refunded',
          refundAmount: TOTAL,
          refundReason: '商品の返品',
        },
        paymentStatus: 'refunded',
      },
    })
  })

  it.each<[string, number, string]>([
    ['one yen', 1, 'partial_refund'],
    ['all but one yen', TOTAL - 1, 'partial_refund'],
    ['all of it', TOTAL, 'refunded'],
  ])(
    'tells a payment of which %s is given back so',
    (_case, amount, status) => {
      expect(
        planOf(completed(TOTAL), refund({ refundAmount: amount })),
      ).toMatchObject({
        type: 'planned',
        write: { payment: { status, refundAmount: amount } },
      })
    },
  )

  it('keeps a refund without a reason without one', () => {
    expect(
      planOf(completed(TOTAL), refund({ refundReason: null })),
    ).toMatchObject({
      type: 'planned',
      write: { payment: { refundReason: null } },
    })
  })

  describe('the payment status of the sale', () => {
    it.each<[string, MoneyOfPayment, number, MoneyOfPayment[], string]>([
      [
        'one of two payments is given back',
        completed(5000),
        5000,
        [completed(7650)],
        'partial_refund',
      ],
      [
        'the second of two payments is given back as the first was',
        completed(7650),
        7650,
        [refunded(5000)],
        'refunded',
      ],
      [
        'the second of two payments is given back, and of the first a part',
        completed(7650),
        7650,
        [partlyRefunded(5000, 100)],
        'partial_refund',
      ],
      [
        'a part of the second is given back, and the first was in full',
        completed(7650),
        650,
        [refunded(5000)],
        'partial_refund',
      ],
      [
        'the only payment, of a part of the total, is given back',
        completed(5000),
        5000,
        [],
        'refunded',
      ],
      [
        'the only payment that was received is given back, next to one that failed',
        completed(TOTAL),
        TOTAL,
        [notReceived('failed', TOTAL)],
        'refunded',
      ],
    ])('is told a sale of which %s', (_case, of, amount, others, status) => {
      expect(
        planOf(of, refund({ refundAmount: amount }), others),
      ).toMatchObject({ type: 'planned', write: { paymentStatus: status } })
    })
  })

  it.each<[DbPaymentTransaction['status']]>([
    ['pending'],
    ['processing'],
    ['failed'],
    ['refunded'],
    ['partial_refund'],
  ])('refuses the refund of a payment that is %s', (status) => {
    expect(planOf({ status, amount: TOTAL, refundAmount: null })).toEqual({
      type: 'notCompleted',
    })
  })

  it('refuses a second refund of a payment a part of which was given back', () => {
    expect(
      planOf(partlyRefunded(TOTAL, 5500), refund({ refundAmount: 1 })),
    ).toEqual({ type: 'notCompleted' })
  })

  it('refuses more than the payment received', () => {
    const planned = planOf(completed(5000), refund({ refundAmount: 5001 }))

    expect(rulesOf(planned)).toEqual(['refundAmount:too_big'])
    expect(messagesOf(planned)).toEqual([
      'Must not be more than the amount of the payment (5000)',
    ])
  })

  it('holds a refund to the payment and not to the sale', () => {
    expect(
      rulesOf(
        planOf(completed(5000), refund({ refundAmount: 7650 }), [
          completed(7650),
        ]),
      ),
    ).toEqual(['refundAmount:too_big'])
  })

  it('says that a payment is not completed before it looks at the amount', () => {
    expect(planOf(refunded(5000), refund({ refundAmount: 5001 }))).toEqual({
      type: 'notCompleted',
    })
  })
})

describe('paymentNumberFrom', () => {
  /** Picks these indices one after the other. */
  const picking = (indices: number[]) => {
    const upcoming = [...indices]
    return () => upcoming.shift() ?? 0
  }

  it('is PT and two groups of four symbols', () => {
    expect(paymentNumberFrom(() => 0)).toBe('PT-0000-0000')
    expect(paymentNumberFrom(picking([1, 2, 3, 4, 5, 6, 7, 8]))).toBe(
      'PT-1234-5678',
    )
  })

  it('asks for one of 32 symbols, eight times', () => {
    const counts: number[] = []

    paymentNumberFrom((count) => {
      counts.push(count)
      return 0
    })

    expect(counts).toEqual([32, 32, 32, 32, 32, 32, 32, 32])
  })

  it('fits the 100 characters of its column', () => {
    expect(paymentNumberFrom(() => 31)).toBe('PT-ZZZZ-ZZZZ')
    expect(paymentNumberFrom(() => 31).length).toBeLessThanOrEqual(100)
  })
})
