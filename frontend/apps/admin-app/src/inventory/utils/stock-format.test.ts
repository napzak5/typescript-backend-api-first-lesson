import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  colour,
  gloves,
  PRODUCTS_OF_THE_SALON,
  shampoo,
} from '../../products/components/examples'
import { colourLot, glovesRow } from '../components/examples'
import {
  countedNameOf,
  EXPIRY_CHOICES,
  expiryNameOf,
  isExpired,
  placeNameOf,
  productChoicesOf,
  productNameOf,
  quantityNameOf,
  stockRowNameOf,
  viewItemsOf,
} from './stock-format'

/** A text that stands as it was written, in every language */
const asWritten = (written: string): LocalizedText => ({
  en: written,
  ja: written,
})

describe('productNameOf', () => {
  it('should name a product by its name and its code', () => {
    // Act, Assert
    expect(productNameOf(colour)).toEqual({
      en: 'ヘアカラー ナチュラルブラウン (COLOR001)',
      ja: 'ヘアカラー ナチュラルブラウン（COLOR001）',
    })
  })

  it('should name a product that was removed as removed', () => {
    // Act, Assert
    expect(productNameOf(undefined)).toEqual({
      en: 'Removed product',
      ja: '削除した商品',
    })
  })
})

describe('stockRowNameOf', () => {
  it('should name a row of a lot by its product and its lot', () => {
    // Act, Assert
    expect(stockRowNameOf(colourLot, colour)).toEqual({
      en: 'ヘアカラー ナチュラルブラウン (lot LOT-2026-041)',
      ja: 'ヘアカラー ナチュラルブラウン（ロット LOT-2026-041）',
    })
  })

  it('should name a row without a lot by its product alone', () => {
    // Act, Assert
    expect(stockRowNameOf(glovesRow, gloves)).toEqual(
      asWritten('ニトリル手袋 M'),
    )
  })

  it('should name a row of a product that was removed', () => {
    // Act, Assert
    expect(stockRowNameOf(colourLot, undefined)).toEqual({
      en: 'Removed product (lot LOT-2026-041)',
      ja: '削除した商品（ロット LOT-2026-041）',
    })
  })
})

describe('quantityNameOf', () => {
  it.each<[number, string, string]>([
    [0, '0 本', '0 本'],
    [12, '12 本', '12 本'],
    [2.5, '2.5 本', '2.5 本'],
    [1234.25, '1,234.25 本', '1,234.25 本'],
  ])('should say %d in the unit of the product', (quantity, en, ja) => {
    // Act, Assert
    expect(quantityNameOf(quantity, shampoo)).toEqual({ en, ja })
  })

  it.each<[number, string]>([
    [2.5, '2.5'],
    [1234.25, '1,234.25'],
  ])(
    'should say %d of a product that was removed without a unit',
    (quantity, name) => {
      // Act, Assert
      expect(quantityNameOf(quantity, undefined)).toEqual(asWritten(name))
    },
  )
})

describe('expiryNameOf', () => {
  it.each<[string | null, LocalizedText]>([
    ['2027-03-31', { en: 'March 31, 2027', ja: '2027年3月31日' }],
    [null, { en: 'No expiry', ja: '期限なし' }],
  ])('should say the expiry %s', (expiry, name) => {
    // Act, Assert
    expect(expiryNameOf(expiry)).toEqual(name)
  })
})

describe('isExpired', () => {
  it.each<[string | null, boolean]>([
    ['2026-11-19', true],
    ['2026-11-20', false],
    ['2026-11-21', false],
    [null, false],
  ])(
    'should tell whether %s expired before 2026-11-20: %s',
    (expiry, expired) => {
      // Act, Assert
      expect(isExpired(expiry, '2026-11-20')).toBe(expired)
    },
  )
})

describe('placeNameOf', () => {
  it.each<[string | null, string | null, LocalizedText | null]>([
    [
      'バックヤード',
      'B-2',
      { en: 'バックヤード (shelf B-2)', ja: 'バックヤード（棚 B-2）' },
    ],
    ['バックヤード', null, asWritten('バックヤード')],
    [null, 'B-2', { en: 'Shelf B-2', ja: '棚 B-2' }],
    [null, null, null],
  ])('should say where %s %s is', (location, shelf, name) => {
    // Act, Assert
    expect(placeNameOf({ location, shelf })).toEqual(name)
  })
})

describe('countedNameOf', () => {
  it.each<[string | null, LocalizedText | undefined, LocalizedText]>([
    [
      '2026-11-01T01:00:00.000Z',
      asWritten('佐藤 健'),
      {
        en: 'Sun, November 1, 2026 at 10:00 (佐藤 健)',
        ja: '2026年11月1日（日） 10:00（佐藤 健）',
      },
    ],
    [
      '2026-11-01T01:00:00.000Z',
      undefined,
      {
        en: 'Sun, November 1, 2026 at 10:00',
        ja: '2026年11月1日（日） 10:00',
      },
    ],
    [null, undefined, { en: 'Not counted yet', ja: '棚卸ししていません' }],
  ])(
    'should say when the row was counted: %s by %s',
    (counted, counter, name) => {
      // Act, Assert
      expect(countedNameOf(counted, 'Asia/Tokyo', counter)).toEqual(name)
    },
  )
})

describe('productChoicesOf', () => {
  it('should offer every product, those no longer carried marked', () => {
    // Act, Assert
    expect(
      productChoicesOf(PRODUCTS_OF_THE_SALON, undefined).map(
        ({ label }) => label,
      ),
    ).toEqual([
      {
        en: 'ヘアカラー ナチュラルブラウン (COLOR001)',
        ja: 'ヘアカラー ナチュラルブラウン（COLOR001）',
      },
      {
        en: 'プロフェッショナル シャンプー 500ml (SHMP001)',
        ja: 'プロフェッショナル シャンプー 500ml（SHMP001）',
      },
      { en: 'ニトリル手袋 M (SUP-GLOVE)', ja: 'ニトリル手袋 M（SUP-GLOVE）' },
      {
        en: 'スタイリングワックス 80g (WAX001), no longer carried',
        ja: 'スタイリングワックス 80g（WAX001）・取り扱いをやめた',
      },
    ])
  })

  it('should offer a product chosen that is not among them as removed', () => {
    // Act, Assert
    expect(productChoicesOf([colour], gloves.id)).toEqual([
      {
        value: colour.id,
        label: {
          en: 'ヘアカラー ナチュラルブラウン (COLOR001)',
          ja: 'ヘアカラー ナチュラルブラウン（COLOR001）',
        },
      },
      {
        value: gloves.id,
        label: { en: 'Removed product', ja: '削除した商品' },
      },
    ])
  })
})

describe('EXPIRY_CHOICES', () => {
  it('should offer the windows of the rows that expire soon', () => {
    // Assert
    expect(EXPIRY_CHOICES).toEqual([
      { value: '0', label: { en: 'By today', ja: '今日まで' } },
      { value: '7', label: { en: 'Within 7 days', ja: '7 日後まで' } },
      { value: '30', label: { en: 'Within 30 days', ja: '30 日後まで' } },
      { value: '90', label: { en: 'Within 90 days', ja: '90 日後まで' } },
    ])
  })
})

describe('viewItemsOf', () => {
  it('should lead to each view at the path, the one shown current', () => {
    // Act, Assert
    expect(
      viewItemsOf({ type: 'expiring', days: 7 }, '/salons/s/inventory'),
    ).toEqual([
      {
        href: '/salons/s/inventory',
        label: { en: 'All', ja: 'すべて' },
        current: false,
      },
      {
        href: '/salons/s/inventory?view=low-stock',
        label: { en: 'Low stock', ja: '在庫僅少' },
        current: false,
      },
      {
        href: '/salons/s/inventory?view=expiring',
        label: { en: 'Expiring soon', ja: '期限切れ間近' },
        current: true,
      },
    ])
  })
})
