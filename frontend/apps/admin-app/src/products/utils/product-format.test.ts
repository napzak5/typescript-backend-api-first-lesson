import { describe, expect, it } from 'vitest'
import {
  carriedNameOf,
  categoriesOf,
  expiryNameOf,
  leadTimeNameOf,
  levelNameOf,
  lotsNameOf,
  priceNameOf,
  usesNameOf,
} from './product-format'

describe('priceNameOf', () => {
  it.each<[number | null, string | null]>([
    [3000, '￥3,000'],
    [0, '￥0'],
    [null, null],
  ])('should name the price %s %s', (price, name) => {
    expect(priceNameOf(price, 'JPY')).toBe(name)
  })
})

describe('usesNameOf', () => {
  it.each<[boolean, boolean, string]>([
    [true, true, '店頭販売、施術'],
    [true, false, '店頭販売'],
    [false, true, '施術'],
    [false, false, 'どちらでもない'],
  ])(
    'should name a product sold %s and used %s %s',
    (isForSale, isForTreatment, name) => {
      expect(usesNameOf({ isForSale, isForTreatment })).toBe(name)
    },
  )
})

describe('the words of a product', () => {
  it('should name whether the salon carries it, and how its stock is kept', () => {
    expect([
      carriedNameOf(true),
      carriedNameOf(false),
      lotsNameOf(true),
      lotsNameOf(false),
    ]).toEqual([
      '取り扱い中',
      '取り扱いをやめた',
      'ロット番号で分ける',
      '分けない',
    ])
  })

  it('should name the levels of the stock in the unit, with two decimals at most', () => {
    expect([
      levelNameOf(10, 'bottle'),
      levelNameOf(2.5, 'ml'),
      levelNameOf(1234.56, '本'),
      levelNameOf(null, '本'),
    ]).toEqual(['10 bottle', '2.5 ml', '1,234.56 本', '決めていない'])
  })

  it('should name the days of a delivery and the months a product keeps', () => {
    expect([
      leadTimeNameOf(0),
      leadTimeNameOf(3),
      leadTimeNameOf(null),
      expiryNameOf(24),
      expiryNameOf(null),
    ]).toEqual(['0 日', '3 日', null, '24 か月', null])
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
    expect(categoriesOf([{ category: 'Spa' }], 'Styling')).toEqual([
      'Spa',
      'Styling',
    ])
  })
})
