import type { ModelsSaleResponse } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  aPaidSale,
  aPayment,
  aSale,
  moment,
  paymentMethods,
  salon,
} from '../components/examples'
import {
  cardNameOf,
  methodNameOf,
  owedOf,
  receivedAtOf,
  receivedOf,
  refundedOf,
  refundNameOf,
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
  it.each<[string, ModelsSaleResponse, LocalizedText | undefined]>([
    ['a sale with nothing received', aSale(), undefined],
    ['a sale with a part received', halfPaid, undefined],
    [
      'a sale that was voided',
      aSale({ isVoid: true }),
      {
        en: 'This sale was voided, so no payment can be recorded.',
        ja: 'この売上は取り消されているため、支払いを記録できません。',
      },
    ],
    [
      'a sale with a refund',
      refunded,
      {
        en: 'This sale has a refund, so no payment can be recorded. To pay again, void the sale and check out again.',
        ja: 'この売上には返金があるため、支払いを記録できません。払い直すときは、売上を取り消して、会計を入れ直してください。',
      },
    ],
    [
      'a sale that was paid',
      aPaidSale(),
      {
        en: 'The total of this sale was received.',
        ja: 'この売上は、合計を受け取りました。',
      },
    ],
    [
      'a sale of nothing',
      aSale({ totalAmount: 0 }),
      {
        en: 'A sale whose total is zero takes no payment.',
        ja: '合計が 0 円の売上は、受け取る支払いがありません。',
      },
    ],
  ])('should say why %s takes no payment', (_case, sale, why) => {
    // Act, Assert
    expect(whyNoPayment(sale)).toEqual(why)
  })
})

describe('whyNoReceipt', () => {
  it.each<[string, ModelsSaleResponse, LocalizedText | undefined]>([
    ['a sale that was paid', aPaidSale(), undefined],
    ['a sale that was paid and refunded', refunded, undefined],
    ['a sale of nothing', aSale({ totalAmount: 0 }), undefined],
    [
      'a sale with a part received',
      halfPaid,
      {
        en: 'A receipt can be issued once the total is received.',
        ja: 'レシートは、合計を受け取ってから出せます。',
      },
    ],
    [
      'a sale that was voided',
      { ...aPaidSale(), isVoid: true },
      {
        en: 'A voided sale has no receipt.',
        ja: '取り消された売上の、レシートは出せません。',
      },
    ],
  ])('should say why %s has no receipt', (_case, sale, why) => {
    // Act, Assert
    expect(whyNoReceipt(sale)).toEqual(why)
  })
})

describe('methodNameOf', () => {
  it('should name a payment by its method, and one the salon removed as such', () => {
    // Act, Assert
    expect(methodNameOf(paymentMethods[1]?.id ?? '', paymentMethods)).toEqual({
      en: 'クレジットカード',
      ja: 'クレジットカード',
    })
    expect(methodNameOf('removed', paymentMethods)).toEqual({
      en: 'Payment method not listed',
      ja: '一覧にない支払い方法',
    })
  })
})

describe('refundNameOf', () => {
  it.each<[string, Parameters<typeof refundNameOf>[0], LocalizedText | null]>([
    [
      'how much and when',
      { refundAmount: 500, refundedAt: moment(90) },
      {
        en: '¥500, Fri, November 20, 2026 at 11:30',
        ja: '￥500、2026年11月20日（金） 11:30',
      },
    ],
    [
      'how much, of a refund whose time was not recorded',
      { refundAmount: 3000, refundedAt: null },
      { en: '¥3,000', ja: '￥3,000' },
    ],
    [
      'nothing for a payment that was not given back',
      { refundAmount: null, refundedAt: null },
      null,
    ],
  ])('should say %s', (_case, payment, said) => {
    // Act, Assert
    expect(refundNameOf(payment, salon.timezone, salon.currency)).toEqual(said)
  })
})

describe('receivedAtOf', () => {
  it.each<[string, string | null, string]>([
    [
      'when it was received',
      '2026-11-20T02:30:00.000Z',
      '2026-11-20T02:30:00.000Z',
    ],
    [
      'when it was recorded, as it was not received',
      null,
      '2026-11-20T02:00:00.000Z',
    ],
  ])('should say %s', (_case, processedAt, expected) => {
    // Act, Assert
    expect(
      receivedAtOf({ processedAt, createdAt: '2026-11-20T02:00:00.000Z' }),
    ).toBe(expected)
  })
})

describe('cardNameOf', () => {
  it.each<[string, string | null, string | null, LocalizedText | null]>([
    [
      'the brand and the last four digits',
      'VISA',
      '4242',
      { en: 'VISA ending in 4242', ja: 'VISA 下 4 桁 4242' },
    ],
    ['the brand alone', 'JCB', null, { en: 'JCB', ja: 'JCB' }],
    [
      'the last four digits alone',
      null,
      '0005',
      { en: 'Ending in 0005', ja: '下 4 桁 0005' },
    ],
    ['nothing of a card', null, null, null],
  ])(
    'should name a card by %s that was recorded',
    (_case, cardBrand, cardLastFour, expected) => {
      // Act, Assert
      expect(cardNameOf({ cardBrand, cardLastFour })).toEqual(expected)
    },
  )
})
