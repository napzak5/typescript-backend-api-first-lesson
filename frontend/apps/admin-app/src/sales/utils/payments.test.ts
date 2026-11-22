import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { aPayment, aSale, paymentMethods } from '../components/examples'
import {
  afterPayment,
  limitsOf,
  methodLabelOf,
  methodsInUse,
  type PaymentAttempt,
  readPayment,
} from './payments'

const [cash, card, money, qr] = paymentMethods

describe('methodsInUse', () => {
  it('should offer the methods the salon uses, in its order', () => {
    // Act
    const offered = methodsInUse(
      [qr, money, card, cash].flatMap((one) =>
        one === undefined ? [] : [one],
      ),
    )

    // Assert
    expect(offered.map(({ displayName }) => displayName)).toEqual([
      '現金',
      'クレジットカード',
      '交通系 IC',
    ])
  })
})

describe('limitsOf', () => {
  it.each<[string, number | null, number | null, string | undefined]>([
    ['no limits', null, null, undefined],
    ['the least', 1000, null, '1 回 ￥1,000から受け付けます。'],
    ['the most', null, 20000, '1 回 ￥20,000まで受け付けます。'],
    ['both', 1000, 20000, '1 回 ￥1,000から￥20,000まで受け付けます。'],
  ])('should say %s a method takes at once', (_case, least, most, said) => {
    // Act, Assert
    expect(limitsOf({ minimumAmount: least, maximumAmount: most }, 'JPY')).toBe(
      said,
    )
  })
})

describe('methodLabelOf', () => {
  it.each<[string, number | null, number | null, string]>([
    ['no limits', null, null, '現金'],
    ['the least', 1000, null, '現金（￥1,000から）'],
    ['the most', null, 20000, '現金（￥20,000まで）'],
    ['both', 1000, 20000, '現金（￥1,000〜￥20,000）'],
  ])(
    'should offer a method with %s it takes at once',
    (_case, least, most, label) => {
      // Act, Assert
      expect(
        methodLabelOf(
          { displayName: '現金', minimumAmount: least, maximumAmount: most },
          'JPY',
        ),
      ).toBe(label)
    },
  )
})

describe('readPayment', () => {
  const read = (entries: Record<string, string>, owed = 5500) =>
    readPayment(formOf(entries), paymentMethods, owed, 'JPY')

  it('should read a payment in cash, without a card', () => {
    // Act, Assert
    expect(
      read({
        paymentMethodId: cash?.id ?? '',
        amount: '３，０００',
        cardLastFour: '4242',
        cardBrand: 'VISA',
      }),
    ).toEqual({
      type: 'valid',
      value: {
        paymentMethodId: cash?.id,
        amount: 3000,
        cardLastFour: null,
        cardBrand: null,
      },
    })
  })

  it.each<[string, Record<string, string>, string | null, string | null]>([
    [
      'with its card',
      { cardLastFour: '４２４２', cardBrand: ' VISA ' },
      '4242',
      'VISA',
    ],
    ['without it', { cardLastFour: '', cardBrand: '' }, null, null],
    [
      'of a brand of 50 characters, counted as the API counts them',
      { cardLastFour: '4242', cardBrand: '𠮷'.repeat(50) },
      '4242',
      '𠮷'.repeat(50),
    ],
  ])('should read a payment by card %s', (_case, entries, lastFour, brand) => {
    // Act, Assert
    expect(
      read({ paymentMethodId: card?.id ?? '', amount: '5500', ...entries }),
    ).toEqual({
      type: 'valid',
      value: {
        paymentMethodId: card?.id,
        amount: 5500,
        cardLastFour: lastFour,
        cardBrand: brand,
      },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'nothing',
      {},
      {
        paymentMethodId: '支払い方法を選んでください。',
        amount: '金額は、1 以上の円の整数で入力してください。',
      },
    ],
    [
      'no amount',
      { paymentMethodId: cash?.id ?? '', amount: '0' },
      { amount: '金額は、1 以上の円の整数で入力してください。' },
    ],
    [
      'an amount that is no whole number',
      { paymentMethodId: cash?.id ?? '', amount: '1.5' },
      { amount: '金額は、1 以上の円の整数で入力してください。' },
    ],
    [
      'more than is left to pay',
      { paymentMethodId: cash?.id ?? '', amount: '5501' },
      { amount: '金額は、未払い残額（￥5,500）以下にしてください。' },
    ],
    [
      'less than a card takes at once',
      { paymentMethodId: card?.id ?? '', amount: '999' },
      {
        amount: 'クレジットカードは、1 回 ￥1,000から受け付けます。',
      },
    ],
    [
      'a card number that is not four digits',
      { paymentMethodId: card?.id ?? '', amount: '5500', cardLastFour: '424' },
      { cardLastFour: 'カードの下 4 桁は、4 桁の数字で入力してください。' },
    ],
    [
      'a brand too long',
      {
        paymentMethodId: card?.id ?? '',
        amount: '5500',
        cardBrand: 'あ'.repeat(51),
      },
      { cardBrand: 'カードのブランドは、50 文字以内で入力してください。' },
    ],
    [
      'a method the salon uses no more',
      { paymentMethodId: qr?.id ?? '', amount: '5500' },
      { paymentMethodId: '支払い方法を選んでください。' },
    ],
  ])('should refuse %s', (_case, entries, errors) => {
    // Act, Assert
    expect(
      readPayment(formOf(entries), methodsInUse(paymentMethods), 5500, 'JPY'),
    ).toEqual({ type: 'invalid', errors })
  })

  it('should refuse more than electronic money takes at once, though less than is left to pay', () => {
    // Act, Assert
    expect(
      read({ paymentMethodId: money?.id ?? '', amount: '20001' }, 30000),
    ).toEqual({
      type: 'invalid',
      errors: { amount: '交通系 ICは、1 回 ￥20,000まで受け付けます。' },
    })
  })
})

describe('afterPayment', () => {
  const refunded = aSale({
    paymentStatus: 'refunded',
    payments: [
      aPayment({ status: 'refunded', refundAmount: 3000, amount: 3000 }),
    ],
  })

  it.each<[string, PaymentAttempt, ReturnType<typeof afterPayment>]>([
    ['a payment', { type: 'recorded' }, { type: 'done' }],
    [
      'values the API refused',
      {
        type: 'invalid',
        values: [
          { field: 'amount', rule: 'too_big' },
          { field: 'paymentMethodId', rule: 'not_found' },
          { field: 'amount', rule: 'too_small' },
        ],
      },
      {
        type: 'again',
        message: undefined,
        errors: {
          amount:
            '未払い残額か、支払い方法が 1 回に受け付ける金額を超えています。',
          paymentMethodId:
            'この支払い方法は、もう使えません。選び直してください。',
        },
      },
    ],
    [
      'a refusal of what the form has no control for',
      { type: 'invalid', values: [{ field: '', rule: 'custom' }] },
      {
        type: 'again',
        message:
          '支払いを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
        errors: {},
      },
    ],
    [
      'a sale with a refund',
      { type: 'refused', sale: refunded },
      {
        type: 'refused',
        sale: refunded,
        message:
          'この売上には返金があるため、支払いを記録できません。払い直すときは、売上を取り消して、会計を入れ直してください。',
      },
    ],
    [
      'a sale that takes a payment still',
      { type: 'refused', sale: aSale() },
      {
        type: 'refused',
        sale: aSale(),
        message:
          '支払いを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
    ['a sale that is gone', { type: 'notFound' }, { type: 'gone' }],
    ['a sale of another salon', { type: 'forbidden' }, { type: 'gone' }],
  ])('should say what came of %s', (_case, outcome, said) => {
    // Act, Assert
    expect(afterPayment(outcome)).toEqual(said)
  })
})
