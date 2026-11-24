import { describe, expect, it } from 'vitest'
import {
  CARRIED_CHOICES,
  carriedNameOf,
  categoriesOf,
  expiryNameOf,
  leadTimeNameOf,
  levelNameOf,
  lotsNameOf,
  priceNameOf,
  USE_CHOICES,
  usesNameOf,
} from './product-format'

describe('priceNameOf', () => {
  it.each<[number | null, { en: string; ja: string } | null]>([
    [3000, { en: '¥3,000', ja: '￥3,000' }],
    [0, { en: '¥0', ja: '￥0' }],
    [null, null],
  ])('should name the price %s as %o', (price, name) => {
    // Assert
    expect(priceNameOf(price, 'JPY')).toEqual(name)
  })
})

describe('usesNameOf', () => {
  it.each<[boolean, boolean, { en: string; ja: string }]>([
    [true, true, { en: 'In-store sale, Treatment', ja: '店頭販売、施術' }],
    [true, false, { en: 'In-store sale', ja: '店頭販売' }],
    [false, true, { en: 'Treatment', ja: '施術' }],
    [false, false, { en: 'Neither', ja: 'どちらでもない' }],
  ])(
    'should name a product sold %s and used %s as %o',
    (isForSale, isForTreatment, name) => {
      // Assert
      expect(usesNameOf({ isForSale, isForTreatment })).toEqual(name)
    },
  )
})

describe('the words of a product', () => {
  it('should name whether the salon carries it, and how its stock is kept', () => {
    // Assert
    expect([
      carriedNameOf(true),
      carriedNameOf(false),
      lotsNameOf(true),
      lotsNameOf(false),
    ]).toEqual([
      { en: 'Active', ja: '取り扱い中' },
      { en: 'Discontinued', ja: '取り扱いをやめた' },
      { en: 'By lot number', ja: 'ロット番号で分ける' },
      { en: 'Not by lot', ja: '分けない' },
    ])
  })

  it('should name the levels of the stock in the unit, with two decimals at most', () => {
    // Assert
    expect([
      levelNameOf(10, 'bottle'),
      levelNameOf(2.5, 'ml'),
      levelNameOf(1234.56, '本'),
      levelNameOf(null, '本'),
    ]).toEqual([
      { en: '10 bottle', ja: '10 bottle' },
      { en: '2.5 ml', ja: '2.5 ml' },
      { en: '1,234.56 本', ja: '1,234.56 本' },
      { en: 'Not set', ja: '決めていない' },
    ])
  })

  it('should name the days of a delivery and the months a product keeps', () => {
    // Assert
    expect([
      leadTimeNameOf(0),
      leadTimeNameOf(1),
      leadTimeNameOf(3),
      leadTimeNameOf(null),
      expiryNameOf(1),
      expiryNameOf(24),
      expiryNameOf(null),
    ]).toEqual([
      { en: '0 days', ja: '0 日' },
      { en: '1 day', ja: '1 日' },
      { en: '3 days', ja: '3 日' },
      null,
      { en: '1 month', ja: '1 か月' },
      { en: '24 months', ja: '24 か月' },
      null,
    ])
  })
})

describe('the choices of the product ledger', () => {
  it('should offer whether the salon carries a product, and what it is for, by their names', () => {
    // Assert
    expect([...CARRIED_CHOICES, ...USE_CHOICES]).toEqual([
      { value: 'carried', label: { en: 'Active', ja: '取り扱い中' } },
      {
        value: 'dropped',
        label: { en: 'Discontinued', ja: '取り扱いをやめた' },
      },
      { value: 'sale', label: { en: 'Sold in store', ja: '店頭で販売する' } },
      {
        value: 'treatment',
        label: { en: 'Used in treatments', ja: '施術で使う' },
      },
    ])
  })
})

describe('categoriesOf', () => {
  it('should list each category once, in the order of their names, without the products that have none', () => {
    // Act
    const categories = categoriesOf(
      [
        { category: 'Hair Color' },
        { category: null },
        { category: 'Hair Care' },
        { category: 'Hair Color' },
      ],
      undefined,
    )

    // Assert
    expect(categories).toEqual(['Hair Care', 'Hair Color'])
  })

  it('should keep the category the ledger is narrowed to among them, although no product read has it', () => {
    // Assert
    expect(categoriesOf([{ category: 'Spa' }], 'Styling')).toEqual([
      'Spa',
      'Styling',
    ])
  })
})
