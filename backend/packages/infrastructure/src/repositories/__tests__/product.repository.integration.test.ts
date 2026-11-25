import { products } from '@beauty-salon-backend/database'
import {
  type DbNewProduct,
  type DbProductChanges,
  type ProductListCriteria,
  productIdSchema,
  type SalonId,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { ProductRepository } from '../product.repository.impl'
import { insertProduct, insertSalon, insertStock } from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new ProductRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** A salon in the table, by the ID a repository is given. */
const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

/** A product in the table, of the salon, by the ID a repository is given. */
const storedProduct = async (
  salonId: SalonId,
  overrides: Partial<typeof products.$inferInsert> = {},
) => {
  const row = await insertProduct(databases.database(), salonId, overrides)
  return { ...row, id: productIdSchema.parse(row.id) }
}

const storedOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(products)
    .where(eq(products.id, id))
  return row
}

/** A treatment that a salon sells too, as a create writes it. */
const TREATMENT: DbNewProduct = {
  productCode: 'TR-001',
  name: 'ヘアトリートメント',
  description: '傷んだ髪の内側を補修する',
  category: 'treatment',
  brand: 'Kushi Lab',
  purchasePrice: 1200,
  retailPrice: 3300,
  salonPrice: 2400,
  unit: '本',
  minimumStock: '2.00',
  maximumStock: '20.00',
  reorderPoint: '5.00',
  supplierProductCode: 'KL-TR-001',
  leadTimeDays: 7,
  imageUrl: null,
  barcode: '4900000000011',
  isForSale: true,
  isForTreatment: true,
  requiresLotTracking: false,
  expiryMonths: 24,
  storageConditions: '直射日光を避ける',
  safetyDataSheet: null,
  isActive: true,
  supplier: '櫛商事',
}

describe('ProductRepository.create', () => {
  it('should write the product of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()

    // Act
    const created = await repository().create(salonId, TREATMENT)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { ...TREATMENT, salonId, deletedAt: null },
    })
    expect(
      await databases
        .database()
        .select()
        .from(products)
        .where(eq(products.salonId, salonId)),
    ).toMatchObject([TREATMENT])
  })

  it('should write no product with the code of another product of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedProduct(salonId, { productCode: TREATMENT.productCode })

    // Act
    const created = await repository().create(salonId, TREATMENT)

    // Assert
    expect(created).toMatchObject({
      type: 'error',
      error: {
        type: 'alreadyExists',
        field: 'productCode',
        value: TREATMENT.productCode,
      },
    })
  })

  it.each<[string, (salonId: SalonId) => Promise<unknown>]>([
    [
      'a product that is deleted',
      (salonId) =>
        storedProduct(salonId, {
          productCode: TREATMENT.productCode,
          deletedAt: '2026-12-01T00:00:00Z',
        }),
    ],
    [
      'a product of another salon',
      async () =>
        storedProduct(await storedSalon(), {
          productCode: TREATMENT.productCode,
        }),
    ],
  ])('should write a product with the code of %s', async (_case, arrange) => {
    // Arrange
    const salonId = await storedSalon()
    await arrange(salonId)

    // Act
    const created = await repository().create(salonId, TREATMENT)

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { productCode: TREATMENT.productCode, salonId },
    })
  })

  it('should answer that the insert returned no row when a trigger skips it', async () => {
    // Arrange
    const salonId = await storedSalon()
    await databases.skipWrites('products', 'INSERT')

    // Act
    const created = await repository().create(salonId, TREATMENT)

    // Assert
    expect(created).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of product returned no row',
        cause: null,
      },
    })
  })
})

describe('ProductRepository.findById', () => {
  it('should find the product of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)

    // Act
    const found = await repository().findById(salonId, product.id)

    // Assert
    expect(found).toEqual({ type: 'success', data: product })
  })

  it.each<[string, (salonId: SalonId) => Promise<string>]>([
    [
      'a product of another salon',
      async () => (await storedProduct(await storedSalon())).id,
    ],
    [
      'a product that is deleted',
      async (salonId) =>
        (await storedProduct(salonId, { deletedAt: '2026-12-01T00:00:00Z' }))
          .id,
    ],
    ['an ID that names none', async () => UNKNOWN_ID],
  ])('should find no product for %s', async (_case, idOf) => {
    // Arrange
    const salonId = await storedSalon()
    const id = productIdSchema.parse(await idOf(salonId))

    // Act
    const found = await repository().findById(salonId, id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('ProductRepository.list', () => {
  const criteriaOf = (
    salonId: SalonId,
    overrides: Partial<ProductListCriteria> = {},
  ): ProductListCriteria => ({
    salonId,
    limit: 20,
    after: null,
    keyword: null,
    category: null,
    barcode: null,
    isActive: null,
    isForSale: null,
    isForTreatment: null,
    ...overrides,
  })

  const codesOf = (listed: Awaited<ReturnType<ProductRepository['list']>>) =>
    listed.type === 'success' && listed.data !== null
      ? listed.data.products.map(({ productCode }) => productCode)
      : []

  /**
   * Three products of the salon, by their codes: a shampoo of Kushi Lab
   * that is sold and used, a cream for sale only that is not active, and a
   * colour used in treatments only. A deleted product of the salon and a
   * product of another salon are not listed.
   */
  const storedShelf = async () => {
    const salonId = await storedSalon()
    await storedProduct(salonId, {
      productCode: 'C-300',
      name: 'カラー剤 100% オーガニック',
      category: 'color',
      barcode: '4900000000300',
    })
    await storedProduct(salonId, {
      productCode: 'B-200',
      name: 'ハンドクリーム',
      category: 'retail',
      isActive: false,
      isForSale: true,
      isForTreatment: false,
    })
    await storedProduct(salonId, {
      productCode: 'A-100',
      name: 'シャンプー',
      brand: 'Kushi Lab',
      isForSale: true,
    })
    await storedProduct(salonId, {
      productCode: 'A-000',
      deletedAt: '2026-12-01T00:00:00Z',
    })
    await storedProduct(await storedSalon(), { productCode: 'A-050' })
    return salonId
  }

  it('should list the products of the salon by their codes, and count them', async () => {
    // Arrange
    const salonId = await storedShelf()

    // Act
    const listed = await repository().list(criteriaOf(salonId))

    // Assert
    expect(codesOf(listed)).toEqual(['A-100', 'B-200', 'C-300'])
    expect(listed).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: false },
    })
  })

  it.each<[string, Partial<ProductListCriteria>, string[]]>([
    ['a part of the name', { keyword: 'クリーム' }, ['B-200']],
    ['a part of the code in another case', { keyword: 'c-3' }, ['C-300']],
    ['a part of the brand in another case', { keyword: 'kushi' }, ['A-100']],
    ['a percent sign, as it is', { keyword: '100%' }, ['C-300']],
    ['an underscore, as it is', { keyword: 'A_1' }, []],
    ['the category', { category: 'retail' }, ['B-200']],
    ['the barcode', { barcode: '4900000000300' }, ['C-300']],
    ['being active', { isActive: false }, ['B-200']],
    ['being for sale', { isForSale: true }, ['A-100', 'B-200']],
    ['being for treatments', { isForTreatment: false }, ['B-200']],
    ['two filters at once', { isForSale: true, isActive: true }, ['A-100']],
  ])(
    'should list the products by %s, and count them',
    async (_case, filters, codes) => {
      // Arrange
      const salonId = await storedShelf()

      // Act
      const listed = await repository().list(criteriaOf(salonId, filters))

      // Assert
      expect(codesOf(listed)).toEqual(codes)
      expect(listed).toMatchObject({
        type: 'success',
        data: { total: codes.length },
      })
    },
  )

  it('should list a page at a time, the next one after the product of the cursor', async () => {
    // Arrange
    const salonId = await storedShelf()
    const [first] = await databases
      .database()
      .select()
      .from(products)
      .where(eq(products.productCode, 'A-100'))

    // Act
    const page = await repository().list(criteriaOf(salonId, { limit: 2 }))
    const next = await repository().list(
      criteriaOf(salonId, {
        limit: 2,
        after: productIdSchema.parse(first?.id),
      }),
    )

    // Assert
    expect(codesOf(page)).toEqual(['A-100', 'B-200'])
    expect(page).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: true },
    })
    expect(codesOf(next)).toEqual(['B-200', 'C-300'])
    expect(next).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: false },
    })
  })

  it.each<[string, (salonId: SalonId) => Promise<string>]>([
    [
      'a product that is deleted',
      async (salonId) =>
        (await storedProduct(salonId, { deletedAt: '2026-12-01T00:00:00Z' }))
          .id,
    ],
    [
      'a product of another salon',
      async () => (await storedProduct(await storedSalon())).id,
    ],
    ['an ID that names none', async () => UNKNOWN_ID],
  ])('should find no page after %s', async (_case, idOf) => {
    // Arrange
    const salonId = await storedShelf()
    const after = productIdSchema.parse(await idOf(salonId))

    // Act
    const listed = await repository().list(criteriaOf(salonId, { after }))

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('ProductRepository.update', () => {
  it('should write the changes and the time of the change, and keep what they do not name', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, {
      minimumStock: '2.00',
      reorderPoint: '5.00',
      updatedAt: '2020-01-01T00:00:00Z',
    })

    // Act
    const updated = await repository().update(salonId, product.id, {
      name: 'シャンプー（詰め替え）',
      maximumStock: '30.00',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        product: {
          id: product.id,
          name: 'シャンプー（詰め替え）',
          minimumStock: '2.00',
          reorderPoint: '5.00',
          maximumStock: '30.00',
        },
      },
    })
    expect((await storedOf(product.id))?.updatedAt).not.toBe(product.updatedAt)
  })

  it.each<
    [
      string,
      Partial<typeof products.$inferInsert>,
      DbProductChanges,
      string[][],
    ]
  >([
    [
      'reorder point below the minimum the product keeps',
      { minimumStock: '5.00' },
      { reorderPoint: '3.00' },
      [['minimumStock', 'reorderPoint']],
    ],
    [
      'minimum above the reorder point the product keeps',
      { reorderPoint: '5.00' },
      { minimumStock: '6.00' },
      [['minimumStock', 'reorderPoint']],
    ],
    [
      'minimum above the maximum the product keeps',
      { maximumStock: '10.00' },
      { minimumStock: '12.00' },
      [['minimumStock', 'maximumStock']],
    ],
    [
      'reorder point above the maximum the product keeps',
      { maximumStock: '10.00' },
      { reorderPoint: '12.00' },
      [['reorderPoint', 'maximumStock']],
    ],
  ])('should write no %s', async (_case, stored, changes, broken) => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, stored)

    // Act
    const updated = await repository().update(salonId, product.id, changes)

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'stockLevelsOutOfOrder', broken },
    })
    expect(await storedOf(product.id)).toMatchObject(stored)
  })

  it.each<[string, Partial<typeof products.$inferInsert>, DbProductChanges]>([
    [
      'a minimum below the reorder point the product keeps',
      { minimumStock: '2.00', reorderPoint: '5.00' },
      { minimumStock: '4.00' },
    ],
    [
      'a minimum when the change takes the maximum away',
      { maximumStock: '10.00' },
      { minimumStock: '12.00', maximumStock: null },
    ],
  ])('should write %s', async (_case, stored, changes) => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, stored)

    // Act
    const updated = await repository().update(salonId, product.id, changes)

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', product: changes },
    })
  })

  it('should read the maximum another change committed while this one waited', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)

    // Act
    const updated = await databases.whileHeld(
      (held) =>
        held`select id from products where id = ${product.id} for update`,
      (held) =>
        held`update products set "maximumStock" = 10 where id = ${product.id}`,
      () => repository().update(salonId, product.id, { minimumStock: '12.00' }),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: {
        type: 'stockLevelsOutOfOrder',
        broken: [['minimumStock', 'maximumStock']],
      },
    })
  })

  it('should write no code of another product of the salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    await storedProduct(salonId, { productCode: 'TAKEN' })
    const product = await storedProduct(salonId)

    // Act
    const updated = await repository().update(salonId, product.id, {
      productCode: 'TAKEN',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'error',
      error: { type: 'alreadyExists', field: 'productCode', value: 'TAKEN' },
    })
  })

  it.each<[string, (salonId: SalonId) => Promise<string>]>([
    [
      'product of another salon',
      async () => (await storedProduct(await storedSalon())).id,
    ],
    [
      'product that is deleted',
      async (salonId) =>
        (await storedProduct(salonId, { deletedAt: '2026-12-01T00:00:00Z' }))
          .id,
    ],
  ])('should change no %s', async (_case, idOf) => {
    // Arrange
    const salonId = await storedSalon()
    const id = productIdSchema.parse(await idOf(salonId))

    // Act
    const updated = await repository().update(salonId, id, { name: '別名' })

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect((await storedOf(id))?.name).toBe('シャンプー')
  })

  it('should answer that the update returned no row when a trigger skips it', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)
    await databases.skipWrites('products', 'UPDATE')

    // Act
    const updated = await repository().update(salonId, product.id, {
      name: '別名',
    })

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of product returned no row',
        cause: null,
      },
    })
  })
})

describe('ProductRepository.delete', () => {
  it('should mark the product deleted, with the time, and leave the others', async () => {
    // Arrange
    const db = databases.database()
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, {
      updatedAt: '2020-01-01T00:00:00Z',
    })
    const stocked = await storedProduct(salonId)
    await insertStock(db, salonId, stocked.id)

    // Act
    const deleted = await repository().delete(salonId, product.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    const stored = await storedOf(product.id)
    expect(stored?.deletedAt).not.toBeNull()
    expect(stored?.updatedAt).not.toBe(product.updatedAt)
    expect((await storedOf(stocked.id))?.deletedAt).toBeNull()
  })

  it('should delete no product that has a stock row', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)
    await insertStock(databases.database(), salonId, product.id)

    // Act
    const deleted = await repository().delete(salonId, product.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'inStock' } })
    expect((await storedOf(product.id))?.deletedAt).toBeNull()
  })

  it('should delete no product that a stock row is being written for', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)

    // Act
    const deleted = await databases.whileHeld(
      (held) =>
        held`select id from products where id = ${product.id} for key share`,
      (held) =>
        held`insert into inventory ("salonId", "productId", "currentStock", "availableStock") values (${salonId}, ${product.id}, 10, 10)`,
      () => repository().delete(salonId, product.id),
    )

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'inStock' } })
  })

  it.each<[string, (salonId: SalonId) => Promise<string>]>([
    [
      'product of another salon',
      async () => (await storedProduct(await storedSalon())).id,
    ],
    [
      'product that is deleted already',
      async (salonId) =>
        (await storedProduct(salonId, { deletedAt: '2026-12-01T00:00:00Z' }))
          .id,
    ],
  ])('should delete no %s', async (_case, idOf) => {
    // Arrange
    const salonId = await storedSalon()
    const id = productIdSchema.parse(await idOf(salonId))

    // Act
    const deleted = await repository().delete(salonId, id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
  })
})

describe('ProductRepository when the database is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const id = productIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (gone: ProductRepository) => Promise<unknown>]>([
    ['Failed to create product', (gone) => gone.create(salonId, TREATMENT)],
    ['Failed to find product', (gone) => gone.findById(salonId, id)],
    [
      'Failed to list products',
      (gone) =>
        gone.list({
          salonId,
          limit: 20,
          after: null,
          keyword: null,
          category: null,
          barcode: null,
          isActive: null,
          isForSale: null,
          isForTreatment: null,
        }),
    ],
    [
      'Failed to update product',
      (gone) => gone.update(salonId, id, { productCode: 'TR-002' }),
    ],
    ['Failed to delete product', (gone) => gone.delete(salonId, id)],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new ProductRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
