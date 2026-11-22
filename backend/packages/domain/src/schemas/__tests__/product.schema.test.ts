import { describe, expect, it } from 'vitest'
import { brokenRules, SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  PRODUCT_ID,
  productCreateRequest,
} from '../../__tests__/fixtures/product-fixtures'
import { parseWith } from '../../shared'
import {
  productCreateRequestSchema,
  productSearchRequestSchema,
  productUpdateRequestSchema,
} from '../product.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** What a refused request is told, as `field: message`, in order. */
const messagesOf = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, 'Invalid')
  return result.type === 'error' && result.error.type === 'validation'
    ? result.error.issues.map(({ field, message }) => `${field}: ${message}`)
    : []
}

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

/** A request without the levels that are ordered against the minimum. */
const withoutLevels = (): Record<string, unknown> => ({
  ...productCreateRequest(),
  maximumStock: null,
  reorderPoint: null,
})

/** The properties that are text and may be unset, with their longest value. */
const nullableTexts: [string, number | null][] = [
  ['description', null],
  ['category', 100],
  ['brand', 100],
  ['supplier', 255],
  ['supplierProductCode', 100],
  ['barcode', 100],
  ['storageConditions', null],
]

/**
 * What breaks the rule of a property, in a create request and, when the
 * property is present, in an update request.
 */
const violations: [string, Record<string, unknown>, string[]][] = [
  [
    'an empty product code',
    { productCode: '' },
    ['productCode:invalid_format'],
  ],
  [
    'a product code of only full-width spaces',
    { productCode: '　　' },
    ['productCode:invalid_format'],
  ],
  [
    'a product code of 101 characters',
    { productCode: 'C'.repeat(101) },
    ['productCode:too_big'],
  ],
  [
    'a product code that is null',
    { productCode: null },
    ['productCode:invalid_type'],
  ],
  ['a blank name', { name: ' \n' }, ['name:invalid_format']],
  ['a name of 256 characters', { name: 'あ'.repeat(256) }, ['name:too_big']],
  ['a blank unit', { unit: ' ' }, ['unit:invalid_format']],
  ['a unit of 21 characters', { unit: 'u'.repeat(21) }, ['unit:too_big']],
  ['a unit that is null', { unit: null }, ['unit:invalid_type']],
  ...nullableTexts.flatMap(
    ([property, longest]): [string, Record<string, unknown>, string[]][] => [
      [
        `a blank ${property}`,
        { [property]: ' ' },
        [`${property}:invalid_format`],
      ],
      [
        `an empty ${property}`,
        { [property]: '' },
        [`${property}:invalid_format`],
      ],
      ...(longest === null
        ? []
        : ([
            [
              `a ${property} of ${longest + 1} characters`,
              { [property]: 'x'.repeat(longest + 1) },
              [`${property}:too_big`],
            ],
          ] satisfies [string, Record<string, unknown>, string[]][])),
    ],
  ),
  ...['purchasePrice', 'retailPrice', 'salonPrice'].flatMap(
    (property): [string, Record<string, unknown>, string[]][] => [
      [`a negative ${property}`, { [property]: -1 }, [`${property}:too_small`]],
      [
        `a ${property} with yen fractions`,
        { [property]: 0.5 },
        [`${property}:invalid_type`],
      ],
      [
        `a ${property} beyond the column`,
        { [property]: MAX_INTEGER + 1 },
        [`${property}:too_big`],
      ],
      [
        `a ${property} that is text`,
        { [property]: '1500' },
        [`${property}:invalid_type`],
      ],
    ],
  ),
  ...['minimumStock', 'maximumStock', 'reorderPoint'].flatMap(
    (property): [string, Record<string, unknown>, string[]][] => [
      [
        `a negative ${property}`,
        { [property]: -0.01 },
        [`${property}:too_small`],
      ],
      [
        `a ${property} beyond the column`,
        { [property]: 100_000_000 },
        [`${property}:too_big`],
      ],
      [
        `a ${property} with three decimals`,
        { [property]: 1.005 },
        [`${property}:not_multiple_of`],
      ],
      [
        `a ${property} that is text`,
        { [property]: '5' },
        [`${property}:invalid_type`],
      ],
    ],
  ),
  [
    'a minimum stock that is null',
    { minimumStock: null },
    ['minimumStock:invalid_type'],
  ],
  ['a negative lead time', { leadTimeDays: -1 }, ['leadTimeDays:too_small']],
  [
    'a lead time of half a day',
    { leadTimeDays: 0.5 },
    ['leadTimeDays:invalid_type'],
  ],
  ['no months to expiry', { expiryMonths: 0 }, ['expiryMonths:too_small']],
  [
    'months to expiry beyond the column',
    { expiryMonths: MAX_INTEGER + 1 },
    ['expiryMonths:too_big'],
  ],
  ...['imageUrl', 'safetyDataSheet'].flatMap(
    (property): [string, Record<string, unknown>, string[]][] => [
      [
        `a ${property} that is a path`,
        { [property]: '/images/products/shampoo-001.jpg' },
        [`${property}:invalid_format`],
      ],
      [
        `a ${property} of another scheme`,
        { [property]: 'ftp://example.com/shampoo.jpg' },
        [`${property}:invalid_format`],
      ],
      [
        `a ${property} of 501 characters`,
        { [property]: `https://example.com/${'a'.repeat(481)}` },
        [`${property}:too_big`],
      ],
    ],
  ),
  ...['isForSale', 'isForTreatment', 'requiresLotTracking', 'isActive'].map(
    (property): [string, Record<string, unknown>, string[]] => [
      `a ${property} that is text`,
      { [property]: 'true' },
      [`${property}:invalid_type`],
    ],
  ),
]

/** What is accepted at the edges of the rules. */
const accepted: [string, Record<string, unknown>][] = [
  ['a product code of 100 characters', { productCode: '𠮷'.repeat(100) }],
  ['a name of 255 characters', { name: 'あ'.repeat(255) }],
  ['a unit of 20 characters', { unit: 'u'.repeat(20) }],
  ['spaces around a name, kept', { name: '  シャンプー\n' }],
  ['a description of any length', { description: 'a'.repeat(10_000) }],
  ['prices of 0', { purchasePrice: 0, retailPrice: 0, salonPrice: 0 }],
  ['a price as large as the column takes', { retailPrice: MAX_INTEGER }],
  [
    'a selling price below the purchase price',
    { purchasePrice: 3000, salonPrice: 1000 },
  ],
  ['stock levels of 0', { minimumStock: 0, reorderPoint: 0, maximumStock: 0 }],
  [
    'stock levels as large as the column takes',
    {
      minimumStock: 99_999_999.99,
      reorderPoint: 99_999_999.99,
      maximumStock: 99_999_999.99,
    },
  ],
  [
    'stock levels with two decimals',
    { minimumStock: 0.01, reorderPoint: 2.5, maximumStock: 12.34 },
  ],
  ['a lead time of 0 days', { leadTimeDays: 0 }],
  ['one month to expiry', { expiryMonths: 1 }],
  ['an address over http', { imageUrl: 'http://example.com/a.jpg' }],
  [
    'an address of 500 characters',
    { safetyDataSheet: `https://example.com/${'a'.repeat(480)}` },
  ],
  [
    'a product neither sold nor used in treatments',
    { isForSale: false, isForTreatment: false },
  ],
]

/** Stock levels in order, as the minimum, the reorder point and the maximum. */
const inOrder: [string, number, number | null, number | null][] = [
  ['all equal', 5, 5, 5],
  ['rising', 5, 10, 50],
  ['without a reorder point', 5, null, 5],
  ['without a maximum', 5, 1000, null],
  ['with only a minimum', 99_999_999.99, null, null],
]

/** Stock levels out of order, with the issues a request that names all three is told. */
const outOfOrder: [string, number, number | null, number | null, string[]][] = [
  [
    'a reorder point below the minimum',
    5,
    4.99,
    null,
    ['reorderPoint: Must not be less than minimumStock'],
  ],
  [
    'a maximum below the minimum',
    5,
    null,
    4,
    ['maximumStock: Must not be less than minimumStock'],
  ],
  [
    'a reorder point above the maximum',
    5,
    40,
    30,
    ['maximumStock: Must not be less than reorderPoint'],
  ],
  [
    'a minimum above both',
    20,
    10,
    15,
    [
      'reorderPoint: Must not be less than minimumStock',
      'maximumStock: Must not be less than minimumStock',
    ],
  ],
  [
    'all three the wrong way round',
    30,
    20,
    10,
    [
      'reorderPoint: Must not be less than minimumStock',
      'maximumStock: Must not be less than minimumStock',
      'maximumStock: Must not be less than reorderPoint',
    ],
  ],
]

describe('productCreateRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = productCreateRequest()

    expect(parseWith(productCreateRequestSchema, request, 'Invalid')).toEqual({
      type: 'success',
      data: request,
    })
  })

  it('accepts null for every property that may be unset and keeps it', () => {
    const request = {
      ...productCreateRequest(),
      description: null,
      category: null,
      brand: null,
      purchasePrice: null,
      retailPrice: null,
      salonPrice: null,
      maximumStock: null,
      reorderPoint: null,
      supplier: null,
      supplierProductCode: null,
      leadTimeDays: null,
      imageUrl: null,
      barcode: null,
      expiryMonths: null,
      storageConditions: null,
      safetyDataSheet: null,
    }

    expect(parseWith(productCreateRequestSchema, request, 'Invalid')).toEqual({
      type: 'success',
      data: request,
    })
  })

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    const request = { ...withoutLevels(), ...change }

    expect(parseWith(productCreateRequestSchema, request, 'Invalid')).toEqual({
      type: 'success',
      data: request,
    })
  })

  it.each(violations)('rejects %s', (_case, change, expected) => {
    expect(
      rulesBrokenBy(productCreateRequestSchema, {
        ...withoutLevels(),
        ...change,
      }),
    ).toEqual(expected)
  })

  it.each(inOrder)(
    'accepts stock levels %s',
    (_case, minimumStock, reorderPoint, maximumStock) => {
      expect(
        rulesBrokenBy(productCreateRequestSchema, {
          ...productCreateRequest(),
          minimumStock,
          reorderPoint,
          maximumStock,
        }),
      ).toEqual([])
    },
  )

  it.each(outOfOrder)(
    'rejects %s under the upper level of each order it breaks',
    (_case, minimumStock, reorderPoint, maximumStock, expected) => {
      expect(
        messagesOf(productCreateRequestSchema, {
          ...productCreateRequest(),
          minimumStock,
          reorderPoint,
          maximumStock,
        }),
      ).toEqual(expected)
    },
  )

  it.each([
    [
      'a negative minimum',
      { minimumStock: -1, maximumStock: 0 },
      ['minimumStock:too_small'],
    ],
    [
      'a maximum that is text',
      { minimumStock: 5, maximumStock: '1' },
      ['maximumStock:invalid_type'],
    ],
    [
      'a reorder point with three decimals',
      { minimumStock: 5, reorderPoint: 1.001 },
      ['reorderPoint:not_multiple_of'],
    ],
  ])(
    'does not compare the levels when one of them is refused for what it is: %s',
    (_case, change, expected) => {
      expect(
        rulesBrokenBy(productCreateRequestSchema, {
          ...withoutLevels(),
          ...change,
        }),
      ).toEqual(expected)
    },
  )

  it('reports levels out of order together with what else is wrong with the values', () => {
    expect(
      rulesBrokenBy(productCreateRequestSchema, {
        ...productCreateRequest(),
        name: ' ',
        minimumStock: 20,
        maximumStock: 10,
        reorderPoint: null,
      }),
    ).toEqual(['name:invalid_format', 'maximumStock:custom'])
  })

  it('does not compare the levels of a request whose shape is wrong', () => {
    const { unit: _unit, ...withoutUnit } = productCreateRequest()

    expect(
      rulesBrokenBy(productCreateRequestSchema, {
        ...withoutUnit,
        minimumStock: 20,
        maximumStock: 10,
      }),
    ).toEqual(['unit:invalid_type'])
  })

  it.each(Object.keys(productCreateRequest()))(
    'rejects a request without %s: every key is required, null has to be said',
    (property) => {
      const request: Record<string, unknown> = { ...withoutLevels() }
      delete request[property]

      expect(rulesBrokenBy(productCreateRequestSchema, request)).toEqual([
        `${property}:invalid_type`,
      ])
    },
  )

  it.each([
    ['salonId', SALON_ID],
    ['id', PRODUCT_ID],
    ['deletedAt', null],
    ['createdAt', '2026-11-17T03:00:00.000Z'],
    ['updatedAt', '2026-11-17T03:00:00.000Z'],
    ['supplierId', PRODUCT_ID],
  ])('rejects %s, which no request writes', (property, value) => {
    expect(
      rulesBrokenBy(productCreateRequestSchema, {
        ...productCreateRequest(),
        [property]: value,
      }),
    ).toEqual([`${property}:unrecognized_keys`])
  })

  it.each([
    ['a list', [productCreateRequest()]],
    ['text', 'productCode=SHMP001'],
    ['null', null],
  ])('rejects %s as the body', (_case, input) => {
    expect(rulesBrokenBy(productCreateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('productUpdateRequestSchema', () => {
  it('accepts everything a product has and returns it unchanged', () => {
    const request = productCreateRequest()

    expect(parseWith(productUpdateRequestSchema, request, 'Invalid')).toEqual({
      type: 'success',
      data: request,
    })
  })

  it.each(Object.entries(productCreateRequest()))(
    'accepts %s alone',
    (property, value) => {
      expect(
        parseWith(productUpdateRequestSchema, { [property]: value }, 'Invalid'),
      ).toEqual({ type: 'success', data: { [property]: value } })
    },
  )

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    expect(parseWith(productUpdateRequestSchema, change, 'Invalid')).toEqual({
      type: 'success',
      data: change,
    })
  })

  it.each(violations)('rejects %s', (_case, change, expected) => {
    expect(rulesBrokenBy(productUpdateRequestSchema, change)).toEqual(expected)
  })

  it.each([
    'description',
    'maximumStock',
    'reorderPoint',
    'supplier',
    'imageUrl',
    'expiryMonths',
  ])('accepts null for %s, which clears it', (property) => {
    expect(
      parseWith(productUpdateRequestSchema, { [property]: null }, 'Invalid'),
    ).toEqual({ type: 'success', data: { [property]: null } })
  })

  it.each(['productCode', 'name', 'unit', 'minimumStock', 'isActive'])(
    'rejects %s that is present without a value',
    (property) => {
      expect(
        rulesBrokenBy(productUpdateRequestSchema, { [property]: undefined }),
      ).toEqual([`${property}:invalid_type`])
    },
  )

  it('rejects a request that names nothing', () => {
    expect(messagesOf(productUpdateRequestSchema, {})).toEqual([
      ': At least one property must be specified',
    ])
  })

  it('says of a request with only a property that is not known that the property is not known, not that it names nothing', () => {
    expect(
      rulesBrokenBy(productUpdateRequestSchema, { salonId: SALON_ID }),
    ).toEqual(['salonId:unrecognized_keys'])
  })

  it.each([
    [
      'the minimum and the maximum',
      { minimumStock: 5, maximumStock: 4 },
      ['maximumStock: Must not be less than minimumStock'],
    ],
    [
      'the minimum and the reorder point',
      { minimumStock: 5, reorderPoint: 4 },
      ['reorderPoint: Must not be less than minimumStock'],
    ],
    [
      'the reorder point and the maximum',
      { reorderPoint: 5, maximumStock: 4 },
      ['maximumStock: Must not be less than reorderPoint'],
    ],
  ])(
    'rejects %s out of order, when the request names both',
    (_case, change, expected) => {
      expect(messagesOf(productUpdateRequestSchema, change)).toEqual(expected)
    },
  )

  it.each([
    ['a minimum', { minimumStock: 99_999_999.99 }],
    ['a maximum', { maximumStock: 0 }],
    ['a reorder point', { reorderPoint: 0 }],
    [
      'a minimum, with a maximum taken away',
      { minimumStock: 9, maximumStock: null },
    ],
  ])(
    'leaves %s that the stored product alone tells about to where the product is written',
    (_case, change) => {
      expect(rulesBrokenBy(productUpdateRequestSchema, change)).toEqual([])
    },
  )
})

describe('productSearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    expect(parseWith(productSearchRequestSchema, {}, 'Invalid')).toEqual({
      type: 'success',
      data: {},
    })
  })

  it('accepts every parameter and returns it unchanged', () => {
    const request = {
      limit: 100,
      cursor: PRODUCT_ID,
      keyword: 'シャンプー',
      category: 'Hair Care',
      barcode: '4901234567890',
      isActive: false,
      isForSale: true,
      isForTreatment: false,
    }

    expect(parseWith(productSearchRequestSchema, request, 'Invalid')).toEqual({
      type: 'success',
      data: request,
    })
  })

  it('reads a cursor written in upper case as the lower-case ID, the one the database returns', () => {
    expect(
      parseWith(
        productSearchRequestSchema,
        { cursor: PRODUCT_ID.toUpperCase() },
        'Invalid',
      ),
    ).toEqual({ type: 'success', data: { cursor: PRODUCT_ID } })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a limit of 1.5', { limit: 1.5 }, ['limit:invalid_type']],
    [
      'a cursor that is not an ID',
      { cursor: 'next' },
      ['cursor:invalid_format'],
    ],
    ['an empty keyword', { keyword: '' }, ['keyword:invalid_format']],
    ['a blank keyword', { keyword: '　' }, ['keyword:invalid_format']],
    [
      'a keyword of 101 characters',
      { keyword: 'k'.repeat(101) },
      ['keyword:too_big'],
    ],
    ['a blank category', { category: ' ' }, ['category:invalid_format']],
    [
      'a category of 101 characters',
      { category: 'c'.repeat(101) },
      ['category:too_big'],
    ],
    ['an empty barcode', { barcode: '' }, ['barcode:invalid_format']],
    [
      'a barcode of 101 characters',
      { barcode: '1'.repeat(101) },
      ['barcode:too_big'],
    ],
    [
      'an active flag that is text',
      { isActive: 'true' },
      ['isActive:invalid_type'],
    ],
    [
      'a sale flag that is text',
      { isForSale: 'true' },
      ['isForSale:invalid_type'],
    ],
    [
      'a treatment flag that is text',
      { isForTreatment: 'true' },
      ['isForTreatment:invalid_type'],
    ],
    [
      'a parameter that is not known',
      { sort: 'name' },
      ['sort:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, request, expected) => {
    expect(rulesBrokenBy(productSearchRequestSchema, request)).toEqual(expected)
  })

  it('accepts a keyword, a category and a barcode of 100 characters', () => {
    expect(
      rulesBrokenBy(productSearchRequestSchema, {
        keyword: '𠮷'.repeat(100),
        category: 'c'.repeat(100),
        barcode: '1'.repeat(100),
      }),
    ).toEqual([])
  })
})
