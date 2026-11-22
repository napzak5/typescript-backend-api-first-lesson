import {
  answering,
  asked,
  page,
  problem,
  UNREAD,
  UNWRITTEN,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../bookings/components/examples'
import { aProduct } from '../../treatments/components/examples'
import { shampoo } from '../components/examples'
import {
  addProduct,
  changeProduct,
  mayKeepProducts,
  readProduct,
  readProductPage,
  readProducts,
  removeProduct,
} from './products-api'

/*
 * What the API answers to the products is met with the real API
 * (`products.integration.test.tsx`, `treatments.integration.test.tsx`).
 * Here are the answers a test cannot bring about there.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readProducts', () => {
  it('should read the products of the salon to their end in their largest pages', async () => {
    // Arrange
    const first = aProduct()
    const second = aProduct({ id: 'd6f8b0c2-4e5a-4b7c-9d1f-3a5b7d9f1c46' })
    const fetched = answering((request) =>
      new URL(request.url).searchParams.has('cursor')
        ? page([second])
        : page([first], first.id),
    )

    // Act
    const read = await readProducts(salon.id)

    // Assert
    expect(read).toEqual({ type: 'found', items: [first, second] })
    expect(asked(fetched)).toEqual([
      `GET /salons/${salon.id}/products?limit=100`,
      `GET /salons/${salon.id}/products?cursor=${first.id}&limit=100`,
    ])
  })

  it.each<[string, () => Response]>([
    ['403', () => problem(403)],
    ['400', () => problem(400)],
  ])('should read nothing after %s', async (_, answer) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readProducts(salon.id)

    // Assert
    expect(read).toEqual({ type: 'failed' })
  })

  it.each(UNREAD)('should read nothing after %s', async (_, answer, type) => {
    // Arrange
    answering(answer)

    // Act
    const read = await readProducts(salon.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

type Answer = () => Response | Promise<Response>

describe('mayKeepProducts', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should let %s keep the products: %s', (role, keeps) => {
    expect(mayKeepProducts(role)).toBe(keeps)
  })
})

describe('readProductPage', () => {
  it('should ask for a page of the ledger under the conditions, after the cursor', async () => {
    // Arrange
    const fetched = answering(() => page([shampoo]))

    // Act
    const read = await readProductPage(
      salon.id,
      { keyword: 'シャンプー', carried: 'carried', use: 'sale' },
      'c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35',
    )

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: [shampoo],
      total: 1,
      nextCursor: null,
    })
    expect(asked(fetched)).toEqual([
      `GET /salons/${salon.id}/products?cursor=c5e7a9b1-3d4f-4a6b-8c0e-2f4a6c8e0b35&isActive=true&isForSale=true&keyword=シャンプー&limit=20`,
    ])
  })

  it.each<[string, Answer, string]>([
    [
      'a cursor that names a product removed meanwhile',
      () => problem(400),
      'failed',
    ],
    ['a salon removed after it was read', () => problem(404), 'failed'],
    ...UNREAD,
  ])('should read no page after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readProductPage(salon.id, {}, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readProduct', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no product', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should read no product after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readProduct(salon.id, 'x')

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('addProduct', () => {
  it.each(UNWRITTEN)(
    'should add no product after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const written = await addProduct(salon.id, {
        productCode: 'OIL001',
        name: 'ヘアオイル',
        description: null,
        category: null,
        brand: null,
        purchasePrice: null,
        retailPrice: null,
        salonPrice: null,
        unit: '本',
        minimumStock: 0,
        maximumStock: null,
        reorderPoint: null,
        supplier: null,
        supplierProductCode: null,
        leadTimeDays: null,
        imageUrl: null,
        barcode: null,
        isForSale: true,
        isForTreatment: false,
        requiresLotTracking: false,
        expiryMonths: null,
        storageConditions: null,
        safetyDataSheet: null,
        isActive: true,
      })

      // Assert
      expect(written).toEqual({ type })
    },
  )
})

describe('changeProduct', () => {
  it.each(UNWRITTEN)(
    'should change no product after %s',
    async (_, given, type) => {
      // Arrange
      answering(given)

      // Act
      const written = await changeProduct(salon.id, shampoo.id, {
        salonPrice: 3200,
      })

      // Assert
      expect(written).toEqual({ type })
    },
  )
})

describe('removeProduct', () => {
  it.each<[string, Answer, string]>([
    ['an address that names no product', () => problem(400), 'notFound'],
    ...UNREAD,
  ])('should remove no product after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const removed = await removeProduct(salon.id, 'x')

    // Assert
    expect(removed).toEqual({ type })
  })
})
