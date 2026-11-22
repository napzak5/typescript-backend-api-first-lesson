import { describe, expect, it } from 'vitest'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import {
  dbProduct,
  OTHER_PRODUCT_ID,
  PRODUCT_ID,
  productCreateRequest,
} from '../../__tests__/fixtures/product-fixtures'
import { productIdSchema } from '../../models/product'
import { salonIdSchema } from '../../models/salon'
import { productSearchRequestSchema } from '../../schemas/product.schema'
import { ProductReadMapper } from '../read/product.mapper'
import { ProductWriteMapper } from '../write/product.mapper'

describe('ProductReadMapper', () => {
  it('returns the columns under their names, the stock levels as numbers and the timestamps as ISO 8601, without the time it was deleted', () => {
    const result = ProductReadMapper.toApiProduct(dbProduct())

    expect(result).toStrictEqual({
      type: 'success',
      data: {
        id: PRODUCT_ID,
        salonId: SALON_ID,
        productCode: 'SHMP001',
        name: 'プロフェッショナル シャンプー 500ml',
        description: null,
        category: 'Hair Care',
        brand: 'Salon Pro',
        purchasePrice: 1500,
        retailPrice: null,
        salonPrice: 3000,
        unit: '本',
        minimumStock: 5,
        maximumStock: 50.25,
        reorderPoint: null,
        supplier: 'Tokyo Beauty Supply',
        supplierProductCode: null,
        leadTimeDays: 7,
        imageUrl: null,
        barcode: '4901234567890',
        isForSale: true,
        isForTreatment: false,
        requiresLotTracking: true,
        expiryMonths: 36,
        storageConditions: null,
        safetyDataSheet: null,
        isActive: true,
        createdAt: '2026-11-14T09:00:00.123Z',
        updatedAt: '2026-11-14T09:30:00.000Z',
      },
    })
  })

  it('returns every column that is set as it is stored', () => {
    const result = ProductReadMapper.toApiProduct(
      dbProduct({
        description: '保湿',
        category: null,
        brand: null,
        purchasePrice: 0,
        retailPrice: 3500,
        salonPrice: null,
        unit: 'ml',
        reorderPoint: '10.50',
        supplier: null,
        supplierProductCode: 'TBS-1',
        leadTimeDays: 0,
        imageUrl: 'https://example.com/a.jpg',
        barcode: null,
        isForSale: false,
        isForTreatment: true,
        requiresLotTracking: false,
        expiryMonths: null,
        storageConditions: '冷暗所',
        safetyDataSheet: 'https://example.com/a.pdf',
        isActive: false,
      }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        description: '保湿',
        category: null,
        brand: null,
        purchasePrice: 0,
        retailPrice: 3500,
        salonPrice: null,
        unit: 'ml',
        reorderPoint: 10.5,
        supplier: null,
        supplierProductCode: 'TBS-1',
        leadTimeDays: 0,
        imageUrl: 'https://example.com/a.jpg',
        barcode: null,
        isForSale: false,
        isForTreatment: true,
        requiresLotTracking: false,
        expiryMonths: null,
        storageConditions: '冷暗所',
        safetyDataSheet: 'https://example.com/a.pdf',
        isActive: false,
      },
    })
  })

  it('does not show the time a product was deleted, even when it is set', () => {
    const result = ProductReadMapper.toApiProduct(
      dbProduct({ deletedAt: '2026-11-15 10:00:00+00' }),
    )

    expect(result.type === 'success' && 'deletedAt' in result.data).toBe(false)
  })

  it.each([
    ['0.00', 0],
    ['0.01', 0.01],
    ['99999999.99', 99_999_999.99],
  ])('reads a stock level of %s as %d', (stored, level) => {
    const result = ProductReadMapper.toApiProduct(
      dbProduct({
        minimumStock: stored,
        maximumStock: stored,
        reorderPoint: stored,
      }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { minimumStock: level, maximumStock: level, reorderPoint: level },
    })
  })

  it('keeps a level that is not set as null, which is not a level of 0', () => {
    const result = ProductReadMapper.toApiProduct(
      dbProduct({ maximumStock: null, reorderPoint: null }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { maximumStock: null, reorderPoint: null },
    })
  })

  it.each([
    ['minimumStock', { minimumStock: 'five' }],
    ['maximumStock', { maximumStock: 'Infinity' }],
    ['reorderPoint', { reorderPoint: 'NaN' }],
    ['createdAt', { createdAt: 'yesterday' }],
    ['updatedAt', { updatedAt: '' }],
  ])(
    'reports a stored %s that cannot be read as a database error that names the product',
    (_column, overrides) => {
      const result = ProductReadMapper.toApiProduct(dbProduct(overrides))

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored product ${PRODUCT_ID} does not match the API model`,
        },
      })
    },
  )

  it('maps a list in its order', () => {
    const result = ProductReadMapper.toApiProducts([
      dbProduct({ id: OTHER_PRODUCT_ID, productCode: 'A001' }),
      dbProduct(),
    ])

    expect(result).toMatchObject({
      type: 'success',
      data: [{ id: OTHER_PRODUCT_ID }, { id: PRODUCT_ID }],
    })
  })

  it('maps an empty list to an empty list', () => {
    expect(ProductReadMapper.toApiProducts([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('fails a list with the first product that cannot be presented', () => {
    const result = ProductReadMapper.toApiProducts([
      dbProduct(),
      dbProduct({ id: OTHER_PRODUCT_ID, updatedAt: 'later' }),
    ])

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored product ${OTHER_PRODUCT_ID} does not match the API model`,
      },
    })
  })
})

describe('ProductWriteMapper', () => {
  it('writes every property of a create request under its name, the stock levels as text', () => {
    expect(
      ProductWriteMapper.fromCreateRequest(productCreateRequest()),
    ).toStrictEqual({
      ...productCreateRequest(),
      minimumStock: '5',
      maximumStock: '50',
      reorderPoint: '10.5',
    })
  })

  it('writes a level that is not set as null', () => {
    expect(
      ProductWriteMapper.fromCreateRequest({
        ...productCreateRequest(),
        minimumStock: 0,
        maximumStock: null,
        reorderPoint: null,
      }),
    ).toMatchObject({
      minimumStock: '0',
      maximumStock: null,
      reorderPoint: null,
    })
  })

  it.each([
    [0.01, '0.01'],
    [12.34, '12.34'],
    [99_999_999.99, '99999999.99'],
  ])('writes a level of %d as %s', (level, stored) => {
    expect(
      ProductWriteMapper.fromCreateRequest({
        ...productCreateRequest(),
        minimumStock: level,
        maximumStock: level,
        reorderPoint: level,
      }),
    ).toMatchObject({
      minimumStock: stored,
      maximumStock: stored,
      reorderPoint: stored,
    })
  })

  it('writes only what an update request names', () => {
    expect(
      ProductWriteMapper.fromUpdateRequest({ name: 'シャンプー' }),
    ).toStrictEqual({ name: 'シャンプー' })
    expect(
      ProductWriteMapper.fromUpdateRequest({ reorderPoint: 3 }),
    ).toStrictEqual({ reorderPoint: '3' })
  })

  it('writes a level an update takes away as null, and leaves the levels it does not name out', () => {
    expect(
      ProductWriteMapper.fromUpdateRequest({
        maximumStock: null,
        isActive: false,
      }),
    ).toStrictEqual({ maximumStock: null, isActive: false })
  })

  it('writes everything an update request can name', () => {
    expect(
      ProductWriteMapper.fromUpdateRequest(productCreateRequest()),
    ).toStrictEqual({
      ...productCreateRequest(),
      minimumStock: '5',
      maximumStock: '50',
      reorderPoint: '10.5',
    })
  })
})

describe('ProductReadMapper.toApiProductPage', () => {
  const paging = { limit: 2, after: productIdSchema.parse(PRODUCT_ID) }

  it('answers with the products, the counts of the list and the place of the page', () => {
    expect(
      ProductReadMapper.toApiProductPage(
        {
          products: [dbProduct({ id: OTHER_PRODUCT_ID }), dbProduct()],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: OTHER_PRODUCT_ID }, { id: PRODUCT_ID }],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: PRODUCT_ID,
          nextCursor: PRODUCT_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      ProductReadMapper.toApiProductPage(
        { products: [dbProduct()], total: 1, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
        },
      },
    })
  })

  it('fails on the first product that does not match the API model', () => {
    expect(
      ProductReadMapper.toApiProductPage(
        {
          products: [
            dbProduct(),
            dbProduct({ id: OTHER_PRODUCT_ID, createdAt: 'never' }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        message: `Stored product ${OTHER_PRODUCT_ID} does not match the API model`,
      },
    })
  })
})

describe('ProductWriteMapper.fromSearchRequest', () => {
  const salonId = salonIdSchema.parse(SALON_ID)
  const unfiltered = {
    keyword: null,
    category: null,
    barcode: null,
    isActive: null,
    isForSale: null,
    isForTreatment: null,
  }

  it('lists the first 20 products of the salon when the request names nothing', () => {
    expect(
      ProductWriteMapper.fromSearchRequest(
        productSearchRequestSchema.parse({}),
        salonId,
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      ...unfiltered,
    })
  })

  it('takes the place of the page and every filter the request names', () => {
    expect(
      ProductWriteMapper.fromSearchRequest(
        productSearchRequestSchema.parse({
          limit: 5,
          cursor: PRODUCT_ID,
          keyword: 'シャンプー',
          category: 'Hair Care',
          barcode: '4901234567890',
          isActive: false,
          isForSale: false,
          isForTreatment: false,
        }),
        salonId,
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 5,
      after: PRODUCT_ID,
      keyword: 'シャンプー',
      category: 'Hair Care',
      barcode: '4901234567890',
      isActive: false,
      isForSale: false,
      isForTreatment: false,
    })
  })

  it.each<[string, Record<string, string | boolean>]>([
    ['a keyword', { keyword: 'シャンプー' }],
    ['the category', { category: 'Hair Care' }],
    ['the barcode', { barcode: '4901234567890' }],
    ['whether the salon stocks it', { isActive: true }],
    ['whether it is sold', { isForSale: true }],
    ['whether it is used in treatments', { isForTreatment: true }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      ProductWriteMapper.fromSearchRequest(
        productSearchRequestSchema.parse(filter),
        salonId,
      ),
    ).toStrictEqual({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      ...unfiltered,
      ...filter,
    })
  })
})
