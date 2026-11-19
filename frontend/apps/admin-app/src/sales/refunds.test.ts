import type {
  ModelsPaymentStatusType,
  ModelsSaleResponse,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aPaidSale, aPayment, aSale, salon } from './components/examples'
import {
  afterRefund,
  type RefundAttempt,
  readRefund,
  voidableAfter,
  whyNoRefund,
} from './refunds'

const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

/** A payment of 3,000 yen in cash */
const payment = aPayment()

describe('whyNoRefund', () => {
  it.each<[ModelsPaymentStatusType, string | undefined]>([
    ['completed', undefined],
    ['refunded', 'この支払いは、全額を返金しました。'],
    [
      'partial_refund',
      'この支払いは、一部を返金しました。1 件の支払いの返金は 1 回で、残りは返金できません。',
    ],
    ['pending', 'この支払いは、受け取っていないため、返金できません。'],
    ['processing', 'この支払いは、受け取っていないため、返金できません。'],
    ['failed', 'この支払いは、受け取っていないため、返金できません。'],
  ])('should say whether a payment that is %s is given back', (status, why) => {
    // Act, Assert
    expect(whyNoRefund({ status })).toBe(why)
  })
})

describe('readRefund', () => {
  it.each<[string, Record<string, string>, number, string]>([
    [
      'the whole of the payment',
      { refundAmount: '3000', refundReason: '施術のやり直し' },
      3000,
      '施術のやり直し',
    ],
    [
      'a part, in digits of full width and commas',
      { refundAmount: '１,０００', refundReason: ' お釣りの渡し忘れ ' },
      1000,
      'お釣りの渡し忘れ',
    ],
    ['a yen', { refundAmount: '1', refundReason: '端数' }, 1, '端数'],
  ])('should read %s', (_case, entries, refundAmount, refundReason) => {
    // Act, Assert
    expect(readRefund(formOf(entries), payment, salon.currency)).toEqual({
      type: 'valid',
      request: { refundAmount, refundReason },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'no amount and no reason',
      { refundAmount: '', refundReason: '' },
      {
        refundAmount: '返金する金額は、1 以上の円の整数で入力してください。',
        refundReason: '返金の理由を入力してください。',
      },
    ],
    [
      'nothing given back',
      { refundAmount: '0', refundReason: '取り違え' },
      { refundAmount: '返金する金額は、1 以上の円の整数で入力してください。' },
    ],
    [
      'what is no whole number of yen',
      { refundAmount: '500.5', refundReason: '取り違え' },
      { refundAmount: '返金する金額は、1 以上の円の整数で入力してください。' },
    ],
    [
      'more than the payment was',
      { refundAmount: '3001', refundReason: '取り違え' },
      {
        refundAmount:
          '返金する金額は、支払いの金額（￥3,000）以下にしてください。',
      },
    ],
    [
      'a reason of blanks',
      { refundAmount: '3000', refundReason: '   ' },
      { refundReason: '返金の理由を入力してください。' },
    ],
  ])('should refuse %s', (_case, entries, errors) => {
    // Act, Assert
    expect(readRefund(formOf(entries), payment, salon.currency)).toEqual({
      type: 'invalid',
      errors,
    })
  })
})

describe('voidableAfter', () => {
  const [cash, card] = aPaidSale().payments
  const inCash = aSale({ payments: [payment] })

  it.each<[string, ModelsSaleResponse, string, number, boolean]>([
    ['the only payment, given back whole', inCash, payment.id, 3000, true],
    ['the only payment, given back in part', inCash, payment.id, 2999, false],
    [
      'one of two payments, the other received',
      aPaidSale(),
      cash?.id ?? '',
      3000,
      false,
    ],
    [
      'the last of two payments, the other given back before',
      aSale({
        payments: [
          aPayment({ status: 'refunded', refundAmount: 3000 }),
          ...(card === undefined ? [] : [card]),
        ],
      }),
      card?.id ?? '',
      2500,
      true,
    ],
    [
      'a payment of a sale that was voided',
      aSale({ isVoid: true, payments: [payment] }),
      payment.id,
      3000,
      false,
    ],
  ])(
    'should say whether the sale is voided after %s',
    (_case, sale, paymentId, refundAmount, voidable) => {
      // Act, Assert
      expect(voidableAfter(sale, paymentId, { refundAmount })).toBe(voidable)
    },
  )
})

describe('afterRefund', () => {
  const now = aSale({
    payments: [aPayment({ status: 'refunded', refundAmount: 3000 })],
  })
  const AGAIN =
    '返金を記録できませんでした。通信の状態を確かめて、もう一度お試しください。'

  it.each<[string, RefundAttempt, ReturnType<typeof afterRefund>]>([
    ['a refund', { type: 'refunded' }, { type: 'done' }],
    [
      'an amount over the payment, at its control',
      { type: 'invalid', values: [{ field: 'refundAmount', rule: 'too_big' }] },
      {
        type: 'again',
        message: undefined,
        errors: {
          refundAmount: '返金する金額が、支払いの金額を超えています。',
        },
      },
    ],
    [
      'an amount the API did not take, at its control',
      {
        type: 'invalid',
        values: [{ field: 'refundAmount', rule: 'too_small' }],
      },
      {
        type: 'again',
        message: undefined,
        errors: {
          refundAmount: '返金する金額は、1 以上の円の整数で入力してください。',
        },
      },
    ],
    [
      'a reason the API did not take, at its control',
      { type: 'invalid', values: [{ field: 'refundReason', rule: 'custom' }] },
      {
        type: 'again',
        message: undefined,
        errors: { refundReason: '返金の理由を入力してください。' },
      },
    ],
    [
      'a body the API did not take',
      { type: 'invalid', values: [{ field: '', rule: 'unrecognized_keys' }] },
      { type: 'again', message: AGAIN, errors: {} },
    ],
    [
      'a payment given back meanwhile',
      { type: 'refused', sale: now },
      { type: 'refused', sale: now },
    ],
    ['a payment that is gone', { type: 'notFound' }, { type: 'gone' }],
    [
      'an account that may not',
      { type: 'forbidden' },
      {
        type: 'again',
        message:
          'このアカウントでは、返金を記録できません。返金は、オーナーとマネージャーができます。',
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
    [
      'no answer',
      { type: 'failed' },
      { type: 'again', message: AGAIN, errors: {} },
    ],
  ])('should follow %s', (_case, outcome, says) => {
    // Act, Assert
    expect(afterRefund(outcome)).toEqual(says)
  })
})
