import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  aPayment,
  aPaymentMethod,
  aSale,
  paymentMethods,
} from '../components/examples'
import {
  afterPayment,
  limitsOf,
  methodLabelOf,
  methodsInUse,
  type PaymentAttempt,
  readPayment,
} from './payments'

const [cash, card, money, qr] = paymentMethods

/** What is said of a brand of a card that is too long, or that the API refused */
const BRAND = {
  en: 'Card brand: enter up to 50 characters.',
  ja: 'カードのブランドは、50 文字以内で入力してください。',
}

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

  it('should offer methods of the same place in the order of their IDs', () => {
    // Arrange
    const later = aPaymentMethod({
      id: 'f0000000-0000-4000-8000-000000000002',
      displayName: '後の現金',
      sortOrder: 1,
    })
    const earlier = aPaymentMethod({
      id: 'f0000000-0000-4000-8000-000000000001',
      displayName: '先の現金',
      sortOrder: 1,
    })

    // Act
    const offered = methodsInUse([later, earlier])

    // Assert
    expect(offered.map(({ displayName }) => displayName)).toEqual([
      '先の現金',
      '後の現金',
    ])
  })
})

describe('limitsOf', () => {
  it.each<[string, number | null, number | null, LocalizedText | undefined]>([
    ['no limits', null, null, undefined],
    [
      'the least',
      1000,
      null,
      {
        en: 'Takes ¥1,000 or more at a time.',
        ja: '1 回 ￥1,000から受け付けます。',
      },
    ],
    [
      'the most',
      null,
      20000,
      {
        en: 'Takes up to ¥20,000 at a time.',
        ja: '1 回 ￥20,000まで受け付けます。',
      },
    ],
    [
      'both',
      1000,
      20000,
      {
        en: 'Takes ¥1,000 to ¥20,000 at a time.',
        ja: '1 回 ￥1,000から￥20,000まで受け付けます。',
      },
    ],
  ])('should say %s a method takes at once', (_case, least, most, said) => {
    // Act, Assert
    expect(
      limitsOf({ minimumAmount: least, maximumAmount: most }, 'JPY'),
    ).toEqual(said)
  })
})

describe('methodLabelOf', () => {
  it.each<[string, number | null, number | null, LocalizedText]>([
    ['no limits', null, null, { en: '現金', ja: '現金' }],
    [
      'the least',
      1000,
      null,
      { en: '現金 (¥1,000 or more)', ja: '現金（￥1,000から）' },
    ],
    [
      'the most',
      null,
      20000,
      { en: '現金 (up to ¥20,000)', ja: '現金（￥20,000まで）' },
    ],
    [
      'both',
      1000,
      20000,
      { en: '現金 (¥1,000–¥20,000)', ja: '現金（￥1,000〜￥20,000）' },
    ],
  ])(
    'should offer a method with %s it takes at once',
    (_case, least, most, label) => {
      // Act, Assert
      expect(
        methodLabelOf(
          { displayName: '現金', minimumAmount: least, maximumAmount: most },
          'JPY',
        ),
      ).toEqual(label)
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

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    [
      'nothing',
      {},
      {
        paymentMethodId: {
          en: 'Choose a payment method.',
          ja: '支払い方法を選んでください。',
        },
        amount: {
          en: 'Enter the amount as a whole number of yen, 1 or more.',
          ja: '金額は、1 以上の円の整数で入力してください。',
        },
      },
    ],
    [
      'no amount',
      { paymentMethodId: cash?.id ?? '', amount: '0' },
      {
        amount: {
          en: 'Enter the amount as a whole number of yen, 1 or more.',
          ja: '金額は、1 以上の円の整数で入力してください。',
        },
      },
    ],
    [
      'an amount that is no whole number',
      { paymentMethodId: cash?.id ?? '', amount: '1.5' },
      {
        amount: {
          en: 'Enter the amount as a whole number of yen, 1 or more.',
          ja: '金額は、1 以上の円の整数で入力してください。',
        },
      },
    ],
    [
      'more than is left to pay',
      { paymentMethodId: cash?.id ?? '', amount: '5501' },
      {
        amount: {
          en: 'The amount can be at most what is left to pay (¥5,500).',
          ja: '金額は、未払い残額（￥5,500）以下にしてください。',
        },
      },
    ],
    [
      'less than a card takes at once',
      { paymentMethodId: card?.id ?? '', amount: '999' },
      {
        amount: {
          en: 'クレジットカード takes ¥1,000 or more at a time.',
          ja: 'クレジットカードは、1 回 ￥1,000から受け付けます。',
        },
      },
    ],
    [
      'a card number that is not four digits',
      { paymentMethodId: card?.id ?? '', amount: '5500', cardLastFour: '424' },
      {
        cardLastFour: {
          en: 'Enter the last four digits of the card as 4 digits.',
          ja: 'カードの下 4 桁は、4 桁の数字で入力してください。',
        },
      },
    ],
    [
      'a brand too long',
      {
        paymentMethodId: card?.id ?? '',
        amount: '5500',
        cardBrand: 'あ'.repeat(51),
      },
      { cardBrand: BRAND },
    ],
    [
      'a method the salon uses no more',
      { paymentMethodId: qr?.id ?? '', amount: '5500' },
      {
        paymentMethodId: {
          en: 'Choose a payment method.',
          ja: '支払い方法を選んでください。',
        },
      },
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
      errors: {
        amount: {
          en: '交通系 IC takes up to ¥20,000 at a time.',
          ja: '交通系 ICは、1 回 ￥20,000まで受け付けます。',
        },
      },
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
          amount: {
            en: 'The amount is more than is left to pay, or more than the payment method takes at a time.',
            ja: '未払い残額か、支払い方法が 1 回に受け付ける金額を超えています。',
          },
          paymentMethodId: {
            en: 'This payment method can no longer be used. Choose again.',
            ja: 'この支払い方法は、もう使えません。選び直してください。',
          },
        },
      },
    ],
    [
      'a refusal of what the form has no control for',
      { type: 'invalid', values: [{ field: '', rule: 'custom' }] },
      {
        type: 'again',
        message: {
          en: 'The payment could not be recorded. Check your connection and try again.',
          ja: '支払いを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
        errors: {},
      },
    ],
    [
      'a sale with a refund',
      { type: 'refused', sale: refunded },
      {
        type: 'refused',
        sale: refunded,
        message: {
          en: 'This sale has a refund, so no payment can be recorded. To pay again, void the sale and check out again.',
          ja: 'この売上には返金があるため、支払いを記録できません。払い直すときは、売上を取り消して、会計を入れ直してください。',
        },
      },
    ],
    [
      'a sale that takes a payment still',
      { type: 'refused', sale: aSale() },
      {
        type: 'refused',
        sale: aSale(),
        message: {
          en: 'The payment could not be recorded. Check your connection and try again.',
          ja: '支払いを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
        },
      },
    ],
    [
      'the card the API refused, and a value it refused for a reason the form does not name',
      {
        type: 'invalid',
        values: [
          { field: 'cardLastFour', rule: 'custom' },
          { field: 'cardBrand', rule: 'custom' },
          { field: 'amount', rule: 'invalid_type' },
        ],
      },
      {
        type: 'again',
        message: undefined,
        errors: {
          cardLastFour: {
            en: 'Enter the last four digits of the card as 4 digits.',
            ja: 'カードの下 4 桁は、4 桁の数字で入力してください。',
          },
          cardBrand: BRAND,
          amount: {
            en: 'This value was not accepted. Check what you entered.',
            ja: 'この値は受け付けられませんでした。入力を確かめてください。',
          },
        },
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message: {
          en: 'There are too many requests. Wait a while and try again.',
          ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        },
        errors: {},
      },
    ],
    ['a sale that is gone', { type: 'notFound' }, { type: 'gone' }],
    ['a sale of another salon', { type: 'forbidden' }, { type: 'gone' }],
  ])('should say what came of %s', (_case, outcome, said) => {
    // Act, Assert
    expect(afterPayment(outcome)).toEqual(said)
  })
})
