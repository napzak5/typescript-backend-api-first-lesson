import { textIn } from '@beauty-salon-shared/i18n'
import { paymentMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  brokenRules,
  MADE_UP_HEADLINE,
} from '../../__tests__/fixtures/fixtures'
import {
  paymentRefundRequest,
  saleProcessRequest,
} from '../../__tests__/fixtures/payment-fixtures'
import { PAYMENT_METHOD_ID } from '../../__tests__/fixtures/payment-method-fixtures'
import { PAYMENT_ID } from '../../__tests__/fixtures/sale-fixtures'
import { parsePaymentId } from '../../models/payment'
import { parseWith } from '../../shared'
import {
  paymentRefundRequestSchema,
  saleProcessRequestSchema,
} from '../payment.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, MADE_UP_HEADLINE)
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** What a refused request is told, by `field`. */
const messagesOf = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): Record<string, string> => {
  const result = parseWith(schema, input, MADE_UP_HEADLINE)
  return result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [
          field,
          textIn(message, 'en'),
        ]),
      )
    : {}
}

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

/** The request of the fixtures without one of its keys. */
const without = (
  request: Record<string, unknown>,
  key: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(request).filter(([name]) => name !== key))

describe('saleProcessRequestSchema', () => {
  const process = (overrides: Record<string, unknown> = {}) => ({
    ...saleProcessRequest(),
    ...overrides,
  })

  it('accepts a payment with a card and hands it on as it is', () => {
    expect(saleProcessRequestSchema.parse(saleProcessRequest())).toEqual(
      saleProcessRequest(),
    )
  })

  it('accepts a payment of which no card is recorded', () => {
    const request = process({ cardLastFour: null, cardBrand: null })

    expect(saleProcessRequestSchema.parse(request)).toEqual(request)
  })

  it.each([
    ['1 yen', 1],
    ['the largest amount of the column', MAX_INTEGER],
  ])('accepts an amount of %s', (_case, amount) => {
    expect(
      rulesBrokenBy(saleProcessRequestSchema, process({ amount })),
    ).toEqual([])
  })

  it.each([
    ['four zeros', '0000'],
    ['four nines', '9999'],
  ])('accepts %s for the digits of the card', (_case, cardLastFour) => {
    expect(
      rulesBrokenBy(saleProcessRequestSchema, process({ cardLastFour })),
    ).toEqual([])
  })

  it('accepts a brand of 50 characters, counted as code points', () => {
    expect(
      rulesBrokenBy(
        saleProcessRequestSchema,
        process({ cardBrand: '𠮷'.repeat(50) }),
      ),
    ).toEqual([])
  })

  it('hands the ID of the payment method on in lower case', () => {
    expect(
      saleProcessRequestSchema.parse(
        process({ paymentMethodId: PAYMENT_METHOD_ID.toUpperCase() }),
      ).paymentMethodId,
    ).toBe(PAYMENT_METHOD_ID)
  })

  it.each([['paymentMethodId'], ['amount'], ['cardLastFour'], ['cardBrand']])(
    'refuses a request without %s: every key is stated',
    (key) => {
      const rules = rulesBrokenBy(
        saleProcessRequestSchema,
        without(saleProcessRequest(), key),
      )

      expect(rules).toHaveLength(1)
      expect(rules[0]).toMatch(new RegExp(`^${key}:invalid_`))
    },
  )

  it.each<[string, Record<string, unknown>, string[]]>([
    [
      'a payment method that is no ID',
      { paymentMethodId: 'cash' },
      ['paymentMethodId:invalid_format'],
    ],
    [
      'null for the payment method',
      { paymentMethodId: null },
      ['paymentMethodId:invalid_type'],
    ],
    ['an amount of nothing', { amount: 0 }, ['amount:too_small']],
    ['a negative amount', { amount: -1 }, ['amount:too_small']],
    ['an amount with a fraction', { amount: 100.5 }, ['amount:invalid_type']],
    [
      'an amount beyond the column',
      { amount: MAX_INTEGER + 1 },
      ['amount:too_big'],
    ],
    ['an amount that is text', { amount: '12650' }, ['amount:invalid_type']],
    ['null for the amount', { amount: null }, ['amount:invalid_type']],
    [
      'three digits of a card',
      { cardLastFour: '424' },
      ['cardLastFour:invalid_format'],
    ],
    [
      'five digits of a card',
      { cardLastFour: '42424' },
      ['cardLastFour:invalid_format'],
    ],
    [
      'letters for the digits of a card',
      { cardLastFour: '42a2' },
      ['cardLastFour:invalid_format'],
    ],
    [
      'full-width digits of a card',
      { cardLastFour: '４２４２' },
      ['cardLastFour:invalid_format'],
    ],
    [
      'four digits and a line break',
      { cardLastFour: '4242\n' },
      ['cardLastFour:invalid_format'],
    ],
    [
      'no digits of a card at all',
      { cardLastFour: '' },
      ['cardLastFour:invalid_format'],
    ],
    [
      'the digits of a card as a number',
      { cardLastFour: 4242 },
      ['cardLastFour:invalid_type'],
    ],
    ['an empty brand', { cardBrand: '' }, ['cardBrand:invalid_format']],
    [
      'a brand of only spaces',
      { cardBrand: '   ' },
      ['cardBrand:invalid_format'],
    ],
    [
      'a brand of only full-width spaces',
      { cardBrand: '　' },
      ['cardBrand:invalid_format'],
    ],
    [
      'a brand of 51 characters',
      { cardBrand: 'a'.repeat(51) },
      ['cardBrand:too_big'],
    ],
    ['a brand that is not text', { cardBrand: 1 }, ['cardBrand:invalid_type']],
    [
      'the status of the payment',
      { status: 'failed' },
      ['status:unrecognized_keys'],
    ],
    [
      'the number of the payment',
      { transactionNumber: 'PT-0000-0001' },
      ['transactionNumber:unrecognized_keys'],
    ],
    [
      'the time of the payment',
      { processedAt: '2026-11-20T03:42:00Z' },
      ['processedAt:unrecognized_keys'],
    ],
    [
      'the sale once more',
      { saleId: PAYMENT_ID },
      ['saleId:unrecognized_keys'],
    ],
  ])('refuses %s', (_case, overrides, rules) => {
    expect(rulesBrokenBy(saleProcessRequestSchema, process(overrides))).toEqual(
      rules,
    )
  })

  it('says what the digits of a card are', () => {
    expect(
      messagesOf(saleProcessRequestSchema, process({ cardLastFour: '42' })),
    ).toEqual({ cardLastFour: 'Must be four digits' })
  })

  it('reports every broken rule of a request at once', () => {
    expect(
      rulesBrokenBy(saleProcessRequestSchema, {
        paymentMethodId: 'cash',
        amount: 0,
        cardLastFour: 'abcd',
        cardBrand: ' ',
      }),
    ).toEqual([
      'paymentMethodId:invalid_format',
      'amount:too_small',
      'cardLastFour:invalid_format',
      'cardBrand:invalid_format',
    ])
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'cash'],
    ['nothing', undefined],
  ])('refuses %s for the request', (_case, input) => {
    expect(rulesBrokenBy(saleProcessRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('paymentRefundRequestSchema', () => {
  const refund = (overrides: Record<string, unknown> = {}) => ({
    ...paymentRefundRequest(),
    ...overrides,
  })

  it('accepts a refund with a reason and hands it on as it is', () => {
    expect(paymentRefundRequestSchema.parse(paymentRefundRequest())).toEqual(
      paymentRefundRequest(),
    )
  })

  it('accepts a refund of which no reason is kept', () => {
    expect(
      paymentRefundRequestSchema.parse(refund({ refundReason: null })),
    ).toEqual(refund({ refundReason: null }))
  })

  it.each([
    ['1 yen', 1],
    ['the largest amount of the column', MAX_INTEGER],
  ])('accepts a refund of %s', (_case, refundAmount) => {
    expect(
      rulesBrokenBy(paymentRefundRequestSchema, refund({ refundAmount })),
    ).toEqual([])
  })

  it('keeps a reason as it is written, with its spaces', () => {
    expect(
      paymentRefundRequestSchema.parse(refund({ refundReason: ' 返品 ' }))
        .refundReason,
    ).toBe(' 返品 ')
  })

  it('takes a reason of any length, as its column of text does', () => {
    expect(
      rulesBrokenBy(
        paymentRefundRequestSchema,
        refund({ refundReason: '返品'.repeat(5_000) }),
      ),
    ).toEqual([])
  })

  it.each([['refundAmount'], ['refundReason']])(
    'refuses a request without %s: every key is stated',
    (key) => {
      expect(
        rulesBrokenBy(
          paymentRefundRequestSchema,
          without(paymentRefundRequest(), key),
        ),
      ).toEqual([`${key}:invalid_type`])
    },
  )

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a refund of nothing', { refundAmount: 0 }, ['refundAmount:too_small']],
    ['a negative refund', { refundAmount: -5500 }, ['refundAmount:too_small']],
    [
      'a refund with a fraction',
      { refundAmount: 0.5 },
      ['refundAmount:invalid_type'],
    ],
    [
      'a refund beyond the column',
      { refundAmount: MAX_INTEGER + 1 },
      ['refundAmount:too_big'],
    ],
    [
      'a refund that is text',
      { refundAmount: '5500' },
      ['refundAmount:invalid_type'],
    ],
    [
      'null for the refund',
      { refundAmount: null },
      ['refundAmount:invalid_type'],
    ],
    ['an empty reason', { refundReason: '' }, ['refundReason:invalid_format']],
    [
      'a reason of only whitespace',
      { refundReason: ' \n\t' },
      ['refundReason:invalid_format'],
    ],
    [
      'a reason of only full-width spaces',
      { refundReason: '　　' },
      ['refundReason:invalid_format'],
    ],
    [
      'a reason that is not text',
      { refundReason: 42 },
      ['refundReason:invalid_type'],
    ],
    [
      'the status of the payment',
      { status: 'refunded' },
      ['status:unrecognized_keys'],
    ],
    [
      'the time of the refund',
      { refundedAt: '2026-11-22T00:00:00Z' },
      ['refundedAt:unrecognized_keys'],
    ],
    ['the amount of the payment', { amount: 1 }, ['amount:unrecognized_keys']],
  ])('refuses %s', (_case, overrides, rules) => {
    expect(
      rulesBrokenBy(paymentRefundRequestSchema, refund(overrides)),
    ).toEqual(rules)
  })

  it('says that a reason says something', () => {
    expect(
      messagesOf(paymentRefundRequestSchema, refund({ refundReason: ' ' })),
    ).toEqual({ refundReason: 'Must not be blank' })
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['a number', 5500],
    ['nothing', undefined],
  ])('refuses %s for the request', (_case, input) => {
    expect(rulesBrokenBy(paymentRefundRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('parsePaymentId', () => {
  it('returns the ID of a payment', () => {
    expect(parsePaymentId(PAYMENT_ID)).toEqual({
      type: 'success',
      data: PAYMENT_ID,
    })
  })

  it('returns the ID in lower case', () => {
    expect(parsePaymentId(PAYMENT_ID.toUpperCase())).toEqual({
      type: 'success',
      data: PAYMENT_ID,
    })
  })

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a payment number', 'PT-4H8N-2VWC'],
    ['a number', 42],
    ['null', null],
    ['nothing', undefined],
  ])('refuses %s and names the parameter', (_case, id) => {
    const result = parsePaymentId(id)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: paymentMessages.invalidPaymentId },
    })
    expect(result.type === 'error' ? brokenRules(result.error) : []).toEqual([
      expect.stringMatching(/^id:invalid_/),
    ])
  })
})
