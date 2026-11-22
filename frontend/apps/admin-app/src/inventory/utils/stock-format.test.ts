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
  EXPIRY_OPTIONS,
  expiryNameOf,
  isExpired,
  placeNameOf,
  productOptionsOf,
  quantityNameOf,
  stockRowNameOf,
  viewItemsOf,
} from './stock-format'

describe('stockRowNameOf', () => {
  it('should name a row of a lot by its product and its lot', () => {
    expect(stockRowNameOf(colourLot, colour)).toBe(
      'ヘアカラー ナチュラルブラウン（ロット LOT-2026-041）',
    )
  })

  it('should name a row without a lot by its product alone', () => {
    expect(stockRowNameOf(glovesRow, gloves)).toBe('ニトリル手袋 M')
  })

  it('should name a row of a product that was removed', () => {
    expect(stockRowNameOf(colourLot, undefined)).toBe(
      '削除した商品（ロット LOT-2026-041）',
    )
  })
})

describe('quantityNameOf', () => {
  it.each<[number, string]>([
    [0, '0 本'],
    [12, '12 本'],
    [2.5, '2.5 本'],
    [1234.25, '1,234.25 本'],
  ])('should say %d in the unit of the product', (quantity, name) => {
    expect(quantityNameOf(quantity, shampoo)).toBe(name)
  })

  it('should say a quantity of a product that was removed without a unit', () => {
    expect(quantityNameOf(2.5, undefined)).toBe('2.5')
  })
})

describe('expiryNameOf', () => {
  it.each<[string | null, string]>([
    ['2027-03-31', '2027年3月31日'],
    [null, '期限なし'],
  ])('should say the expiry %s', (expiry, name) => {
    expect(expiryNameOf(expiry)).toBe(name)
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
      expect(isExpired(expiry, '2026-11-20')).toBe(expired)
    },
  )
})

describe('placeNameOf', () => {
  it.each<[string | null, string | null, string | null]>([
    ['バックヤード', 'B-2', 'バックヤード（棚 B-2）'],
    ['バックヤード', null, 'バックヤード'],
    [null, 'B-2', '棚 B-2'],
    [null, null, null],
  ])('should say where %s %s is', (location, shelf, name) => {
    expect(placeNameOf({ location, shelf })).toBe(name)
  })
})

describe('countedNameOf', () => {
  it.each<[string | null, string | undefined, string]>([
    [
      '2026-11-01T01:00:00.000Z',
      '佐藤 健',
      '2026年11月1日（日） 10:00（佐藤 健）',
    ],
    ['2026-11-01T01:00:00.000Z', undefined, '2026年11月1日（日） 10:00'],
    [null, undefined, '棚卸ししていません'],
  ])(
    'should say when the row was counted: %s by %s',
    (counted, counter, name) => {
      expect(countedNameOf(counted, 'Asia/Tokyo', counter)).toBe(name)
    },
  )
})

describe('productOptionsOf', () => {
  it('should offer every product, those no longer carried marked', () => {
    expect(
      productOptionsOf(PRODUCTS_OF_THE_SALON, undefined).map(
        ({ label }) => label,
      ),
    ).toEqual([
      'ヘアカラー ナチュラルブラウン（COLOR001）',
      'プロフェッショナル シャンプー 500ml（SHMP001）',
      'ニトリル手袋 M（SUP-GLOVE）',
      'スタイリングワックス 80g（WAX001）・取り扱いをやめた',
    ])
  })

  it('should offer a product chosen that is not among them as removed', () => {
    expect(
      productOptionsOf([colour], gloves.id).map(({ value, label }) => [
        value,
        label,
      ]),
    ).toEqual([
      [colour.id, 'ヘアカラー ナチュラルブラウン（COLOR001）'],
      [gloves.id, '削除した商品'],
    ])
  })
})

describe('EXPIRY_OPTIONS', () => {
  it('should offer the windows of the rows that expire soon', () => {
    expect(EXPIRY_OPTIONS).toEqual([
      { value: '0', label: '今日まで' },
      { value: '7', label: '7 日後まで' },
      { value: '30', label: '30 日後まで' },
      { value: '90', label: '90 日後まで' },
    ])
  })
})

describe('viewItemsOf', () => {
  it('should lead to each view at the path, the one shown current', () => {
    expect(
      viewItemsOf({ type: 'expiring', days: 7 }, '/salons/s/inventory'),
    ).toEqual([
      { href: '/salons/s/inventory', label: 'すべて', current: false },
      {
        href: '/salons/s/inventory?view=low-stock',
        label: '在庫僅少',
        current: false,
      },
      {
        href: '/salons/s/inventory?view=expiring',
        label: '期限切れ間近',
        current: true,
      },
    ])
  })
})
