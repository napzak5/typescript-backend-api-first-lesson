import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminProductMessages } from './index'

const { change, entry, form, removal } = adminProductMessages

/** A name of a product, which stands in every language as it was written */
const NAME = 'モイストシャンプー'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminProductMessages.usesOf',
    adminProductMessages.usesOf({ isForSale: true, isForTreatment: true }),
    { en: 'In-store sale, Treatment', ja: '店頭販売、施術' },
  ],
  [
    'adminProductMessages.leadTimeOf',
    adminProductMessages.leadTimeOf(3),
    { en: '3 days', ja: '3 日' },
  ],
  [
    'adminProductMessages.expiryOf',
    adminProductMessages.expiryOf(24),
    { en: '24 months', ja: '24 か月' },
  ],
  [
    'adminProductMessages.form.productCodeDescription',
    form.productCodeDescription(100),
    {
      en: 'Up to 100 characters. Another product of this salon that was not removed cannot have the same code, nor can a product that is no longer carried.',
      ja: '100 文字まで。このサロンの、削除していないほかの商品と同じコードは使えません。取り扱いをやめた商品のコードも使えません。',
    },
  ],
  [
    'adminProductMessages.form.unitDescription',
    form.unitDescription(20),
    {
      en: 'Such as bottles, pieces or ml. Up to 20 characters. The unit the stock is counted in.',
      ja: '本、個、ml など。20 文字まで。在庫の数を数える単位です。',
    },
  ],
  [
    'adminProductMessages.form.categoryDescription',
    form.categoryDescription(100),
    {
      en: 'Up to 100 characters. The product ledger can be searched by category, and the value of the stock is totalled by category.',
      ja: '100 文字まで。商品台帳で、カテゴリーで探せます。在庫の評価額をカテゴリーごとに集計します。',
    },
  ],
  [
    'adminProductMessages.form.supplierProductCodeDescription',
    form.supplierProductCodeDescription(100),
    {
      en: 'Up to 100 characters. Used when ordering.',
      ja: '100 文字まで。発注するときに使います。',
    },
  ],
  [
    'adminProductMessages.form.barcodeDescription',
    form.barcodeDescription(100),
    {
      en: 'Up to 100 characters. The product ledger can be searched by barcode.',
      ja: '100 文字まで。商品台帳で、バーコードで探せます。',
    },
  ],
  [
    'adminProductMessages.form.safetyDataSheetDescription',
    form.safetyDataSheetDescription(500),
    {
      en: 'The URL of the safety data sheet (SDS) of the manufacturer. Up to 500 characters.',
      ja: 'メーカーの安全データシート（SDS）の URL。500 文字まで。',
    },
  ],
  [
    'adminProductMessages.entry.added',
    entry.added(NAME),
    {
      en: 'Added the product “モイストシャンプー”.',
      ja: '商品「モイストシャンプー」を足しました。',
    },
  ],
  [
    'adminProductMessages.change.changed',
    change.changed(NAME),
    {
      en: 'Saved the product “モイストシャンプー”.',
      ja: '商品「モイストシャンプー」を直しました。',
    },
  ],
  [
    'adminProductMessages.removal.title',
    removal.title(NAME),
    {
      en: 'Remove the product “モイストシャンプー”?',
      ja: '商品「モイストシャンプー」を削除しますか？',
    },
  ],
  [
    'adminProductMessages.removal.done',
    removal.done(NAME),
    {
      en: 'Removed the product “モイストシャンプー”.',
      ja: '商品「モイストシャンプー」を削除しました。',
    },
  ],
  [
    'adminProductMessages.removal.inStock',
    removal.inStock(NAME),
    {
      en: 'The product “モイストシャンプー” has stock records, so it cannot be removed. To discontinue it, clear “Active” and save.',
      ja: '商品「モイストシャンプー」には在庫の記録があるので、削除できません。取り扱いをやめるときは、「取り扱い中」の印を外して保存してください。',
    },
  ],
]

describe('the messages of the products of the admin application', () => {
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
      messagesOf({ adminProductMessages }, '').made.toSorted(),
    )
  })

  it.each<[boolean, boolean, { en: string; ja: string }]>([
    [true, false, { en: 'In-store sale', ja: '店頭販売' }],
    [false, true, { en: 'Treatment', ja: '施術' }],
    [false, false, { en: 'Neither', ja: 'どちらでもない' }],
  ])(
    'should say what a product sold in store (%s) and used in treatments (%s) is for',
    (isForSale, isForTreatment, expected) => {
      // Assert
      expect(
        adminProductMessages.usesOf({ isForSale, isForTreatment }),
      ).toEqual(expected)
    },
  )

  it('should count one day and one month as one', () => {
    // Assert
    expect(adminProductMessages.leadTimeOf(1)).toEqual({
      en: '1 day',
      ja: '1 日',
    })
    expect(adminProductMessages.expiryOf(1)).toEqual({
      en: '1 month',
      ja: '1 か月',
    })
  })

  it('should name the control a discontinued product is cleared at in the sentence of a refused removal', () => {
    // Assert
    expect(removal.inStock(NAME).en).toContain(
      `“${adminProductMessages.carried.en}”`,
    )
    expect(removal.inStock(NAME).ja).toContain(
      `「${adminProductMessages.carried.ja}」`,
    )
  })
})
