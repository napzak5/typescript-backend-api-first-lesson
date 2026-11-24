import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminPaymentMethodMessages } from './index'

const { change, entry, form, removal, values } = adminPaymentMethodMessages

/** Amounts, as the formats write them */
const LEAST = { en: '¥1,000', ja: '￥1,000' }
const MOST = { en: '¥20,000', ja: '￥20,000' }

/** A kind of payment, as the words of the business name it */
const CASH = { en: 'Cash', ja: '現金' }

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminPaymentMethodMessages.values.amounts',
    values.amounts({ least: LEAST, most: MOST }),
    { en: '¥1,000 to ¥20,000', ja: '￥1,000から￥20,000まで' },
  ],
  [
    'adminPaymentMethodMessages.values.placesOf',
    values.placesOf([values.offline, values.online]),
    { en: 'In store, Online', ja: '店頭、オンライン' },
  ],
  [
    'adminPaymentMethodMessages.form.kindKept',
    form.kindKept(CASH),
    {
      en: 'Type: Cash. The type cannot be changed. If it is wrong, remove this payment method and add it again when no payment was received by it; otherwise stop using it and add a new one.',
      ja: '種類: 現金。種類は変えられません。間違えたときは、この支払い方法で受け取った支払いがなければ削除して足し直し、あれば使うのをやめて、新しく足してください。',
    },
  ],
  [
    'adminPaymentMethodMessages.form.displayNameDescription',
    form.displayNameDescription(100),
    {
      en: 'Up to 100 characters. The name shown on the sales screens and the receipts.',
      ja: '100 文字まで。売上の画面とレシートに出る名前です。',
    },
  ],
  [
    'adminPaymentMethodMessages.form.processorDescription',
    form.processorDescription(100),
    {
      en: 'Up to 100 characters. Leave it empty when the payments do not go through a processor.',
      ja: '100 文字まで。決済代行会社を介さないときは空にします。',
    },
  ],
  [
    'adminPaymentMethodMessages.entry.added',
    entry.added('現金'),
    {
      en: 'Added the payment method “現金”.',
      ja: '支払い方法「現金」を足しました。',
    },
  ],
  [
    'adminPaymentMethodMessages.change.changed',
    change.changed('現金'),
    {
      en: 'Saved the payment method “現金”.',
      ja: '支払い方法「現金」を直しました。',
    },
  ],
  [
    'adminPaymentMethodMessages.removal.title',
    removal.title('現金'),
    {
      en: 'Remove the payment method “現金”?',
      ja: '支払い方法「現金」を削除しますか？',
    },
  ],
  [
    'adminPaymentMethodMessages.removal.done',
    removal.done('現金'),
    {
      en: 'Removed the payment method “現金”.',
      ja: '支払い方法「現金」を削除しました。',
    },
  ],
  [
    'adminPaymentMethodMessages.removal.inUse',
    removal.inUse('現金'),
    {
      en: 'Payments were received by the payment method “現金”, so it cannot be removed. To stop using it, clear “Use this payment method” and save.',
      ja: '支払い方法「現金」で受け取った支払いがあるので、削除できません。使うのをやめるときは、「この支払い方法を使う」の印を外して保存してください。',
    },
  ],
]

describe('the messages of the payment methods of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminPaymentMethodMessages }, '').made.toSorted(),
    )
  })

  it('should say that a method used in no place is used in neither', () => {
    // Assert
    expect(values.placesOf([])).toEqual({
      en: 'Neither',
      ja: 'どちらでも使わない',
    })
  })

  it.each([
    [
      { least: LEAST, most: null },
      { en: '¥1,000 or more', ja: '￥1,000から' },
    ],
    [
      { least: null, most: MOST },
      { en: 'Up to ¥20,000', ja: '￥20,000まで' },
    ],
    [null, { en: 'No limits', ja: '下限も上限もなし' }],
  ])(
    'should say what a method takes at once as the sales say it, the value standing alone: %o',
    (limits, expected) => {
      // Assert
      expect(values.amounts(limits)).toEqual(expected)
    },
  )
})
