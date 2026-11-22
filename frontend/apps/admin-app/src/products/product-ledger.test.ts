import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import {
  isNarrowed,
  type ProductConditions,
  productConditionsIn,
  productListParamsOf,
  productQueryOf,
  readProductConditions,
} from './product-ledger'

describe('productConditionsIn', () => {
  it('should read every condition of the address', () => {
    // Act
    const conditions = productConditionsIn(
      new URLSearchParams(
        'keyword=シャンプー&barcode=4901234567894&category=Hair+Care&carried=dropped&use=treatment',
      ),
    )

    // Assert
    expect(conditions).toEqual({
      keyword: 'シャンプー',
      barcode: '4901234567894',
      category: 'Hair Care',
      carried: 'dropped',
      use: 'treatment',
    })
  })

  it.each<[string, string]>([
    ['an empty keyword', 'keyword=+'],
    ['a keyword of 101 characters', `keyword=${'あ'.repeat(101)}`],
    ['a barcode of 101 characters', `barcode=${'1'.repeat(101)}`],
    ['a category of spaces', 'category=+++'],
    ['a category of 101 characters', `category=${'a'.repeat(101)}`],
    ['a state that is none', 'carried=yes'],
    ['a use that is none', 'use=both'],
  ])('should take %s for no condition', (_case, query) => {
    expect(productConditionsIn(new URLSearchParams(query))).toEqual({})
  })

  it.each<[string, string]>([
    ['keyword', '𠮷'.repeat(100)],
    ['barcode', '𠮷'.repeat(100)],
    ['category', '𠮷'.repeat(100)],
  ])(
    'should keep a %s of 100 characters, counted as the API counts them',
    (name, text) => {
      expect(
        productConditionsIn(new URLSearchParams({ [name]: text })),
      ).toEqual({ [name]: text })
    },
  )

  it('should keep a category as it is written, and a barcode without the spaces around it', () => {
    expect(
      productConditionsIn(
        new URLSearchParams('category=+Hair+Care+&barcode=+490+'),
      ),
    ).toEqual({ category: ' Hair Care ', barcode: '490' })
  })
})

describe('readProductConditions', () => {
  it('should read the conditions that were filled in, and nothing for what was left empty', () => {
    // Act
    const read = readProductConditions(
      formOf({
        keyword: ' カラー ',
        barcode: '',
        category: 'Hair Color',
        carried: 'carried',
        use: '',
      }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        keyword: 'カラー',
        category: 'Hair Color',
        carried: 'carried',
      },
    })
  })

  it('should take a keyword and a barcode of 100 characters, counted as the API counts them', () => {
    // Act
    const read = readProductConditions(
      formOf({ keyword: '𠮷'.repeat(100), barcode: '𠮷'.repeat(100) }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: { keyword: '𠮷'.repeat(100), barcode: '𠮷'.repeat(100) },
    })
  })

  it('should say that a keyword and a barcode are too long, at their controls', () => {
    // Act
    const read = readProductConditions(
      formOf({ keyword: 'あ'.repeat(101), barcode: '1'.repeat(101) }),
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        keyword: 'キーワードは、100 文字以内で入力してください。',
        barcode: 'バーコードは、100 文字以内で入力してください。',
      },
    })
  })
})

describe('productQueryOf', () => {
  it('should keep the same conditions in the same address, whatever order they came in', () => {
    // Arrange
    const conditions: ProductConditions = {
      use: 'sale',
      category: 'Hair Care',
      keyword: 'シャンプー',
    }

    // Act
    const query = productQueryOf(conditions).toString()

    // Assert
    expect(query).toBe(
      new URLSearchParams([
        ['keyword', 'シャンプー'],
        ['category', 'Hair Care'],
        ['use', 'sale'],
      ]).toString(),
    )
    expect(productConditionsIn(new URLSearchParams(query))).toEqual(conditions)
  })

  it('should tell the whole ledger from a narrowed one', () => {
    expect([isNarrowed({}), isNarrowed({ carried: 'carried' })]).toEqual([
      false,
      true,
    ])
  })
})

describe('productListParamsOf', () => {
  it.each<[string, ProductConditions, Record<string, unknown>]>([
    ['nothing', {}, {}],
    [
      'the products carried and sold at the counter',
      { carried: 'carried', use: 'sale' },
      { isActive: true, isForSale: true },
    ],
    [
      'the products no longer carried and used in treatments',
      { carried: 'dropped', use: 'treatment' },
      { isActive: false, isForTreatment: true },
    ],
    [
      'a keyword, a barcode and a category',
      { keyword: 'wax', barcode: '490', category: 'Styling' },
      { keyword: 'wax', barcode: '490', category: 'Styling' },
    ],
  ])('should ask the API for %s', (_case, conditions, params) => {
    expect(productListParamsOf(conditions)).toEqual(params)
  })
})
