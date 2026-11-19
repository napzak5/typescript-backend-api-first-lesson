import type { ModelsSaleResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import {
  aPaidSale,
  aPayment,
  aSale,
  paymentMethods,
} from './components/examples'
import {
  cardNameOf,
  methodNameOf,
  owedOf,
  receivedOf,
  refundedOf,
  whyNoPayment,
  whyNoReceipt,
} from './sale-format'

const halfPaid = aSale({ paymentStatus: 'processing', payments: [aPayment()] })

const refunded = aSale({
  paymentStatus: 'partial_refund',
  payments: [
    aPayment({ amount: 5500, status: 'partial_refund', refundAmount: 500 }),
  ],
})

const givenBack = aSale({
  paymentStatus: 'refunded',
  payments: [
    aPayment({ amount: 5500, status: 'refunded', refundAmount: 5500 }),
  ],
})

/** A payment the API does not write: one that is waiting, and one that failed */
const unreceived = aSale({
  payments: [
    aPayment({ status: 'pending' }),
    aPayment({ status: 'failed', amount: 2500 }),
  ],
})

describe('what was received and what is left to pay', () => {
  it.each<[string, ModelsSaleResponse, number, number, number]>([
    ['nothing received', aSale(), 0, 0, 5500],
    ['a part received', halfPaid, 3000, 0, 2500],
    ['everything received', aPaidSale(), 5500, 0, 0],
    ['a refund, which does not make more to pay', refunded, 5500, 500, 0],
    [
      'a payment given back whole, which was received',
      givenBack,
      5500,
      5500,
      0,
    ],
    ['payments that were not received', unreceived, 0, 0, 5500],
  ])('should count %s', (_case, sale, received, given, owed) => {
    // Act, Assert
    expect(receivedOf(sale)).toBe(received)
    expect(refundedOf(sale)).toBe(given)
    expect(owedOf(sale)).toBe(owed)
  })
})

describe('whyNoPayment', () => {
  it.each<[string, ModelsSaleResponse, string | undefined]>([
    ['a sale with nothing received', aSale(), undefined],
    ['a sale with a part received', halfPaid, undefined],
    [
      'a sale that was voided',
      aSale({ isVoid: true }),
      'この売上は取り消されているため、支払いを記録できません。',
    ],
    [
      'a sale with a refund',
      refunded,
      'この売上には返金があるため、支払いを記録できません。払い直すときは、売上を取り消して、会計を入れ直してください。',
    ],
    ['a sale that was paid', aPaidSale(), 'この売上は、合計を受け取りました。'],
    [
      'a sale of nothing',
      aSale({ totalAmount: 0 }),
      '合計が 0 円の売上は、受け取る支払いがありません。',
    ],
  ])('should say why %s takes no payment', (_case, sale, why) => {
    // Act, Assert
    expect(whyNoPayment(sale)).toBe(why)
  })
})

describe('whyNoReceipt', () => {
  it.each<[string, ModelsSaleResponse, string | undefined]>([
    ['a sale that was paid', aPaidSale(), undefined],
    ['a sale that was paid and refunded', refunded, undefined],
    ['a sale of nothing', aSale({ totalAmount: 0 }), undefined],
    [
      'a sale with a part received',
      halfPaid,
      'レシートは、合計を受け取ってから出せます。',
    ],
    [
      'a sale that was voided',
      { ...aPaidSale(), isVoid: true },
      '取り消された売上の、レシートは出せません。',
    ],
  ])('should say why %s has no receipt', (_case, sale, why) => {
    // Act, Assert
    expect(whyNoReceipt(sale)).toBe(why)
  })
})

describe('methodNameOf', () => {
  it('should name a payment by its method, and one the salon removed as such', () => {
    // Act, Assert
    expect(methodNameOf(paymentMethods[1]?.id ?? '', paymentMethods)).toBe(
      'クレジットカード',
    )
    expect(methodNameOf('removed', paymentMethods)).toBe('一覧にない支払い方法')
  })
})

describe('cardNameOf', () => {
  it.each<[string, string | null, string | null, string | null]>([
    ['the brand and the last four digits', 'VISA', '4242', 'VISA 下 4 桁 4242'],
    ['the brand alone', 'JCB', null, 'JCB'],
    ['the last four digits alone', null, '0005', '下 4 桁 0005'],
    ['nothing of a card', null, null, null],
  ])(
    'should name a card by %s that was recorded',
    (_case, cardBrand, cardLastFour, expected) => {
      // Act, Assert
      expect(cardNameOf({ cardBrand, cardLastFour })).toBe(expected)
    },
  )
})
