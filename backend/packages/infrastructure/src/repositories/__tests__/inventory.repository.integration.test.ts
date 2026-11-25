import {
  inventory,
  inventoryTransactions,
} from '@beauty-salon-backend/database'
import {
  type DbNewInventory,
  type DbNewInventoryMovement,
  type InventoryListCriteria,
  type InventoryStockCountCriteria,
  inventoryIdSchema,
  inventoryTransactionIdSchema,
  type LedgerReach,
  productIdSchema,
  type SalonId,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { inventoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { InventoryRepository } from '../inventory.repository.impl'
import {
  insertMovement,
  insertProduct,
  insertSalon,
  insertStock,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new InventoryRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** An ID the test chooses, so that rows are in an order of their IDs it knows. */
const idOf = (place: number) =>
  `00000000-0000-4000-8000-${String(place).padStart(12, '0')}`

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const reachOf = (salonId: SalonId): LedgerReach => ({ type: 'salon', salonId })

const COUNTER = staffIdSchema.parse('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a2c')

/** A salon in the table, by the ID a repository is given. */
const storedSalon = async (): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database())).id)

/** A product of the salon in the table, by the ID a repository is given. */
const storedProduct = async (
  salonId: SalonId,
  overrides: Parameters<typeof insertProduct>[2] = {},
) => {
  const row = await insertProduct(databases.database(), salonId, overrides)
  return { ...row, id: productIdSchema.parse(row.id) }
}

/** A stock row of the product in the table, by the ID a repository is given. */
const storedRow = async (
  salonId: SalonId,
  productId: string,
  overrides: Parameters<typeof insertStock>[3] = {},
) => {
  const row = await insertStock(
    databases.database(),
    salonId,
    productId,
    overrides,
  )
  return { ...row, id: inventoryIdSchema.parse(row.id) }
}

/** A stock row of a product of a salon of its own. */
const storedStock = async (
  overrides: Parameters<typeof insertStock>[3] = {},
) => {
  const salonId = await storedSalon()
  const product = await storedProduct(salonId)
  const row = await storedRow(salonId, product.id, overrides)
  return { salonId, product, row }
}

const storedOf = async (id: string) => {
  const [row] = await databases
    .database()
    .select()
    .from(inventory)
    .where(eq(inventory.id, id))
  return row
}

const movementsOf = (inventoryId: string) =>
  databases
    .database()
    .select()
    .from(inventoryTransactions)
    .where(eq(inventoryTransactions.inventoryId, inventoryId))
    .orderBy(asc(inventoryTransactions.createdAt))

/** A row a create writes: on the second shelf, of no lot. */
const rowOf = (
  salonId: SalonId,
  productId: string,
  overrides: Partial<DbNewInventory> = {},
): DbNewInventory => ({
  salonId,
  productId,
  lotNumber: null,
  expiryDate: null,
  location: 'バックヤード',
  shelf: 'B-2',
  notes: null,
  ...overrides,
})

/** A use of 3 in a treatment. */
const USE: DbNewInventoryMovement = {
  transactionType: 'use',
  quantity: '-3.00',
  unitCost: null,
  totalCost: null,
  referenceType: null,
  referenceId: null,
  reason: null,
  performedBy: null,
}

const failureOf = (message: string) => ({
  type: 'error',
  error: { type: 'database', message, cause: null },
})

describe('InventoryRepository.create', () => {
  it('should write the row of the product with no stock', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)
    const row = rowOf(salonId, product.id)

    // Act
    const created = await repository().create(row)

    // Assert
    const expected = {
      ...row,
      currentStock: '0.00',
      availableStock: '0.00',
      reservedStock: '0.00',
      lastCountedAt: null,
    }
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', row: expected },
    })
    expect(
      await databases
        .database()
        .select()
        .from(inventory)
        .where(eq(inventory.productId, product.id)),
    ).toMatchObject([expected])
  })

  it('should write the row of a lot of a product kept by lots', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, { requiresLotTracking: true })

    // Act
    const created = await repository().create(
      rowOf(salonId, product.id, {
        lotNumber: 'L-001',
        expiryDate: '2027-06-30',
      }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        row: { lotNumber: 'L-001', expiryDate: '2027-06-30' },
      },
    })
  })

  it.each([
    [
      'no lot number of a product kept by lots',
      true,
      null,
      inventoryMessages.lotOfProductKeptByLots,
    ],
    [
      'a lot number of a product not kept by lots',
      false,
      'L-001',
      inventoryMessages.nullForProductNotKeptByLots,
    ],
  ])(
    'should write no row with %s',
    async (_case, requiresLotTracking, lotNumber, message) => {
      // Arrange
      const salonId = await storedSalon()
      const product = await storedProduct(salonId, { requiresLotTracking })

      // Act
      const created = await repository().create(
        rowOf(salonId, product.id, { lotNumber }),
      )

      // Assert
      expect(created).toEqual({
        type: 'success',
        data: { type: 'lotNumberRefused', message },
      })
      expect(
        await databases
          .database()
          .select()
          .from(inventory)
          .where(eq(inventory.productId, product.id)),
      ).toEqual([])
    },
  )

  it.each<[string, (salonId: SalonId) => Promise<string>]>([
    [
      'product that is deleted',
      async (salonId) =>
        (await storedProduct(salonId, { deletedAt: '2026-12-01T00:00:00Z' }))
          .id,
    ],
    [
      'product of another salon',
      async () => (await storedProduct(await storedSalon())).id,
    ],
    ['product of an ID that names none', async () => UNKNOWN_ID],
  ])('should find no %s', async (_case, productIdOf) => {
    // Arrange
    const salonId = await storedSalon()
    const productId = await productIdOf(salonId)

    // Act
    const created = await repository().create(rowOf(salonId, productId))

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'productNotFound' },
    })
  })

  it.each([
    ['the lot of another row', true, 'L-001', 'L-001'],
    ['another row without a lot', false, null, 'null'],
  ])(
    'should write no row that repeats %s of the product',
    async (_case, requiresLotTracking, lotNumber, value) => {
      // Arrange
      const salonId = await storedSalon()
      const product = await storedProduct(salonId, { requiresLotTracking })
      await storedRow(salonId, product.id, { lotNumber })

      // Act
      const created = await repository().create(
        rowOf(salonId, product.id, { lotNumber }),
      )

      // Assert
      expect(created).toMatchObject({
        type: 'error',
        error: { type: 'alreadyExists', field: 'lotNumber', value },
      })
    },
  )

  it('should write a row of the lot of a row of another product', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, { requiresLotTracking: true })
    const other = await storedProduct(salonId)
    await storedRow(salonId, other.id, { lotNumber: 'L-001' })

    // Act
    const created = await repository().create(
      rowOf(salonId, product.id, { lotNumber: 'L-001' }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created', row: { lotNumber: 'L-001' } },
    })
  })

  it('should find no product that the deletion it waited for took away', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`select id from products where id = ${product.id} for update`,
      (held) =>
        held`update products set "deletedAt" = now() where id = ${product.id}`,
      () => repository().create(rowOf(salonId, product.id)),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'productNotFound' },
    })
  })

  it('should decide on the lot number by the product as the change it waited for left it', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`select id from products where id = ${product.id} for update`,
      (held) =>
        held`update products set "requiresLotTracking" = true where id = ${product.id}`,
      () => repository().create(rowOf(salonId, product.id)),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: {
        type: 'lotNumberRefused',
        message: inventoryMessages.lotOfProductKeptByLots,
      },
    })
  })

  it('should answer a database error for a value longer than its column', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)

    // Act
    const created = await repository().create(
      rowOf(salonId, product.id, { shelf: 'B'.repeat(51) }),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'error',
      error: { type: 'database', message: 'Failed to create stock row' },
    })
  })

  it('should answer that the insert returned no row when a trigger skips it', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId)
    await databases.skipWrites('inventory', 'INSERT')

    // Act
    const created = await repository().create(rowOf(salonId, product.id))

    // Assert
    expect(created).toEqual(failureOf('Insert of stock row returned no row'))
  })
})

describe('InventoryRepository.findById', () => {
  it.each<[string, (salonId: SalonId) => LedgerReach]>([
    ['its salon', reachOf],
    ['every salon', () => EVERY_SALON],
  ])('should find the row for a reader of %s', async (_case, reach) => {
    // Arrange
    const { salonId, row } = await storedStock()

    // Act
    const found = await repository().findById(reach(salonId), row.id)

    // Assert
    expect(found).toEqual({ type: 'success', data: row })
  })

  it.each<[string, () => Promise<string>]>([
    ['row of another salon', async () => (await storedStock()).row.id],
    ['row of an ID that names none', async () => UNKNOWN_ID],
  ])('should find no %s', async (_case, idOfRow) => {
    // Arrange
    const salonId = await storedSalon()
    const id = inventoryIdSchema.parse(await idOfRow())

    // Act
    const found = await repository().findById(reachOf(salonId), id)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

/**
 * Two salons with a product of the code A-100 each, and a product B-200 of
 * the first with three rows: one of no lot, and the lots L-1 and L-2. The
 * IDs are in another order than the rows of the list.
 */
const storedShelf = async () => {
  const salonId = await storedSalon()
  const other = await storedSalon()
  const shampoo = await storedProduct(salonId, { productCode: 'A-100' })
  const colour = await storedProduct(salonId, { productCode: 'B-200' })
  const elsewhere = await storedProduct(other, { productCode: 'A-100' })
  const plain = await storedRow(salonId, shampoo.id, { id: idOf(2) })
  const second = await storedRow(salonId, colour.id, {
    id: idOf(4),
    lotNumber: 'L-2',
  })
  const first = await storedRow(salonId, colour.id, {
    id: idOf(3),
    lotNumber: 'L-1',
  })
  const unlotted = await storedRow(salonId, colour.id, { id: idOf(5) })
  const away = await storedRow(other, elsewhere.id, { id: idOf(1) })
  return {
    salonId,
    other,
    colour,
    rows: { plain, unlotted, first, second, away },
  }
}

const listOf = (
  overrides: Partial<InventoryListCriteria> = {},
): InventoryListCriteria => ({
  reach: EVERY_SALON,
  limit: 20,
  after: null,
  salonId: null,
  productId: null,
  lotNumber: null,
  ...overrides,
})

type Shelf = Awaited<ReturnType<typeof storedShelf>>

describe('InventoryRepository.list', () => {
  it('should list the rows of the salon by product code, then by lot number, a row of no lot first', async () => {
    // Arrange
    const { salonId, rows } = await storedShelf()

    // Act
    const listed = await repository().list(listOf({ reach: reachOf(salonId) }))

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        rows: [rows.plain, rows.unlotted, rows.first, rows.second],
        total: 4,
        hasMore: false,
      },
    })
  })

  it('should list the rows of every salon, those of one code and lot by their IDs', async () => {
    // Arrange
    const { rows } = await storedShelf()

    // Act
    const listed = await repository().list(listOf())

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        rows: [rows.away, rows.plain, rows.unlotted, rows.first, rows.second],
        total: 5,
        hasMore: false,
      },
    })
  })

  it.each<
    [
      string,
      (shelf: Shelf) => Partial<InventoryListCriteria>,
      (shelf: Shelf) => { id: string }[],
    ]
  >([
    [
      'the salon',
      ({ other }) => ({ salonId: other }),
      ({ rows }) => [rows.away],
    ],
    [
      'the product',
      ({ colour }) => ({ productId: colour.id }),
      ({ rows }) => [rows.unlotted, rows.first, rows.second],
    ],
    [
      'the lot number',
      () => ({ lotNumber: 'L-1' }),
      ({ rows }) => [rows.first],
    ],
    [
      'the salon the reader reaches and another salon',
      ({ salonId, other }) => ({ reach: reachOf(salonId), salonId: other }),
      () => [],
    ],
  ])(
    'should list the rows of %s, and count them',
    async (_case, criteriaOf, expectedOf) => {
      // Arrange
      const shelf = await storedShelf()
      const expected = expectedOf(shelf)

      // Act
      const listed = await repository().list(listOf(criteriaOf(shelf)))

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { rows: expected, total: expected.length, hasMore: false },
      })
    },
  )

  it('should list a page at a time, from the row after the cursor', async () => {
    // Arrange
    const { salonId, rows } = await storedShelf()
    const reach = reachOf(salonId)

    // Act
    const firstPage = await repository().list(listOf({ reach, limit: 2 }))
    const secondPage = await repository().list(
      listOf({ reach, limit: 2, after: rows.unlotted.id }),
    )

    // Assert
    expect(firstPage).toEqual({
      type: 'success',
      data: { rows: [rows.plain, rows.unlotted], total: 4, hasMore: true },
    })
    expect(secondPage).toEqual({
      type: 'success',
      data: { rows: [rows.first, rows.second], total: 4, hasMore: false },
    })
  })

  it('should go on after a row of the same code and lot of another salon', async () => {
    // Arrange
    const { rows } = await storedShelf()

    // Act
    const listed = await repository().list(
      listOf({ limit: 1, after: rows.away.id }),
    )

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { rows: [rows.plain], total: 5, hasMore: true },
    })
  })

  it.each<[string, (shelf: Shelf) => string]>([
    ['a row of a salon the reader does not reach', ({ rows }) => rows.away.id],
    ['an ID that names no row', () => UNKNOWN_ID],
  ])('should list no page after %s', async (_case, cursorOf) => {
    // Arrange
    const shelf = await storedShelf()

    // Act
    const listed = await repository().list(
      listOf({
        reach: reachOf(shelf.salonId),
        after: inventoryIdSchema.parse(cursorOf(shelf)),
      }),
    )

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

/**
 * A salon whose products keep at least 5: one with two rows of 2 (4 in
 * all), one with rows of 3 and 3 (6), one with a row of 5 and one, not
 * used any more, with none. Another salon has a product of 1.
 */
const storedLowShelf = async () => {
  const salonId = await storedSalon()
  const other = await storedSalon()
  const minimum = { minimumStock: '5.00' }
  const low = await storedProduct(salonId, { ...minimum, productCode: 'A-100' })
  const enough = await storedProduct(salonId, {
    ...minimum,
    productCode: 'B-200',
  })
  const atMinimum = await storedProduct(salonId, {
    ...minimum,
    productCode: 'C-300',
  })
  const retired = await storedProduct(salonId, {
    ...minimum,
    productCode: 'D-400',
    isActive: false,
  })
  const elsewhere = await storedProduct(other, { ...minimum })
  const stock = (amount: string) => ({
    currentStock: amount,
    availableStock: amount,
  })
  const lowSecond = await storedRow(salonId, low.id, {
    id: idOf(2),
    lotNumber: 'L-2',
    ...stock('2.00'),
  })
  const lowFirst = await storedRow(salonId, low.id, {
    id: idOf(3),
    lotNumber: 'L-1',
    ...stock('2.00'),
  })
  await storedRow(salonId, enough.id, { lotNumber: 'L-1', ...stock('3.00') })
  await storedRow(salonId, enough.id, { lotNumber: 'L-2', ...stock('3.00') })
  const exactly = await storedRow(salonId, atMinimum.id, stock('5.00'))
  await storedRow(salonId, retired.id, stock('0.00'))
  await storedRow(other, elsewhere.id, stock('1.00'))
  return { salonId, other, rows: { lowFirst, lowSecond, exactly } }
}

describe('InventoryRepository.listLowStock', () => {
  it('should list the rows of the active products whose stock is at most their minimum', async () => {
    // Arrange
    const { salonId, rows } = await storedLowShelf()

    // Act
    const listed = await repository().listLowStock({
      salonId,
      limit: 20,
      after: null,
      threshold: null,
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        rows: [rows.lowFirst, rows.lowSecond, rows.exactly],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should list the rows of the products whose stock is at most the threshold', async () => {
    // Arrange
    const { salonId, rows } = await storedLowShelf()

    // Act
    const listed = await repository().listLowStock({
      salonId,
      limit: 20,
      after: null,
      threshold: 4,
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { rows: [rows.lowFirst, rows.lowSecond], total: 2, hasMore: false },
    })
  })

  it('should list a page at a time, from the row after the cursor', async () => {
    // Arrange
    const { salonId, rows } = await storedLowShelf()

    // Act
    const firstPage = await repository().listLowStock({
      salonId,
      limit: 1,
      after: null,
      threshold: null,
    })
    const nextPage = await repository().listLowStock({
      salonId,
      limit: 1,
      after: rows.lowFirst.id,
      threshold: null,
    })

    // Assert
    expect(firstPage).toEqual({
      type: 'success',
      data: { rows: [rows.lowFirst], total: 3, hasMore: true },
    })
    expect(nextPage).toEqual({
      type: 'success',
      data: { rows: [rows.lowSecond], total: 3, hasMore: true },
    })
  })

  it.each<[string, (other: SalonId) => Promise<string>]>([
    [
      'a row of another salon',
      async (other) =>
        (await storedRow(other, (await storedProduct(other)).id)).id,
    ],
    ['an ID that names no row', async () => UNKNOWN_ID],
  ])('should list no page after %s', async (_case, cursorOf) => {
    // Arrange
    const { salonId, other } = await storedLowShelf()
    const after = inventoryIdSchema.parse(await cursorOf(other))

    // Act
    const listed = await repository().listLowStock({
      salonId,
      limit: 20,
      after,
      threshold: null,
    })

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

/**
 * A salon with three rows with stock that expire by 2026-12-20, two of
 * them on one day, and rows that do not count: one that expires later, one
 * without stock, one without an expiry date. Another salon has a row that
 * expires on the first of those days.
 */
const storedExpiringShelf = async () => {
  const salonId = await storedSalon()
  const other = await storedSalon()
  const product = await storedProduct(salonId, { requiresLotTracking: true })
  const lot = (place: number, expiryDate: string | null, stock = '1.00') =>
    storedRow(salonId, product.id, {
      id: idOf(place),
      lotNumber: `L-${place}`,
      expiryDate,
      currentStock: stock,
      availableStock: stock,
    })
  const last = await lot(12, '2026-12-20')
  const sameDayLater = await lot(13, '2026-12-10')
  const sameDayFirst = await lot(11, '2026-12-10')
  await lot(14, '2026-12-21')
  await lot(15, '2026-12-05', '0.00')
  const undated = await lot(16, null)
  const away = await storedRow(other, (await storedProduct(other)).id, {
    expiryDate: '2026-12-10',
  })
  return {
    salonId,
    rows: { sameDayFirst, sameDayLater, last, undated, away },
  }
}

describe('InventoryRepository.listExpiring', () => {
  it('should list the rows with stock that expire by the day, by their expiry dates and then their IDs', async () => {
    // Arrange
    const { salonId, rows } = await storedExpiringShelf()

    // Act
    const listed = await repository().listExpiring({
      salonId,
      limit: 20,
      after: null,
      until: '2026-12-20',
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        rows: [rows.sameDayFirst, rows.sameDayLater, rows.last],
        total: 3,
        hasMore: false,
      },
    })
  })

  it('should list a page at a time, from the row after the cursor', async () => {
    // Arrange
    const { salonId, rows } = await storedExpiringShelf()

    // Act
    const firstPage = await repository().listExpiring({
      salonId,
      limit: 1,
      after: null,
      until: '2026-12-20',
    })
    const nextPage = await repository().listExpiring({
      salonId,
      limit: 1,
      after: rows.sameDayFirst.id,
      until: '2026-12-20',
    })

    // Assert
    expect(firstPage).toEqual({
      type: 'success',
      data: { rows: [rows.sameDayFirst], total: 3, hasMore: true },
    })
    expect(nextPage).toEqual({
      type: 'success',
      data: { rows: [rows.sameDayLater], total: 3, hasMore: true },
    })
  })

  it.each<
    [
      string,
      (rows: Awaited<ReturnType<typeof storedExpiringShelf>>['rows']) => string,
    ]
  >([
    ['a row without an expiry date', (rows) => rows.undated.id],
    ['a row of another salon', (rows) => rows.away.id],
    ['an ID that names no row', () => UNKNOWN_ID],
  ])('should list no page after %s', async (_case, cursorOf) => {
    // Arrange
    const { salonId, rows } = await storedExpiringShelf()

    // Act
    const listed = await repository().listExpiring({
      salonId,
      limit: 20,
      after: inventoryIdSchema.parse(cursorOf(rows)),
      until: '2026-12-20',
    })

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('InventoryRepository.update', () => {
  it('should write the changes with the time', async () => {
    // Arrange
    const { salonId, row } = await storedStock({
      updatedAt: '2020-01-01T00:00:00Z',
    })
    const changes = {
      location: '店頭',
      shelf: 'A-1',
      notes: '入口の棚',
      expiryDate: '2027-03-31',
    }

    // Act
    const updated = await repository().update(reachOf(salonId), row.id, changes)

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', row: { ...changes, lotNumber: null } },
    })
    const stored = await storedOf(row.id)
    expect(stored).toMatchObject(changes)
    expect(stored?.updatedAt).not.toBe(row.updatedAt)
  })

  it('should write the lot number of a row of a product kept by lots, for a reader of every salon', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, { requiresLotTracking: true })
    const row = await storedRow(salonId, product.id, { lotNumber: 'L-001' })

    // Act
    const updated = await repository().update(EVERY_SALON, row.id, {
      lotNumber: 'L-002',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', row: { lotNumber: 'L-002' } },
    })
  })

  it.each([
    [
      'no lot number for a product kept by lots',
      true,
      'L-001',
      null,
      inventoryMessages.lotOfProductKeptByLots,
    ],
    [
      'a lot number for a product not kept by lots',
      false,
      null,
      'L-001',
      inventoryMessages.nullForProductNotKeptByLots,
    ],
  ])(
    'should keep the lot number of the row when the change names %s',
    async (_case, requiresLotTracking, before, lotNumber, message) => {
      // Arrange
      const salonId = await storedSalon()
      const product = await storedProduct(salonId, { requiresLotTracking })
      const row = await storedRow(salonId, product.id, { lotNumber: before })

      // Act
      const updated = await repository().update(reachOf(salonId), row.id, {
        lotNumber,
      })

      // Assert
      expect(updated).toEqual({
        type: 'success',
        data: { type: 'lotNumberRefused', message },
      })
      expect((await storedOf(row.id))?.lotNumber).toBe(before)
    },
  )

  it.each<
    [string, () => Promise<string>, { notes?: string; lotNumber?: null }]
  >([
    [
      'row of another salon',
      async () => (await storedStock()).row.id,
      { notes: '別の棚' },
    ],
    [
      'row of another salon by a lot number its product refuses',
      async () => {
        const salonId = await storedSalon()
        const product = await storedProduct(salonId, {
          requiresLotTracking: true,
        })
        return (await storedRow(salonId, product.id, { lotNumber: 'L-001' })).id
      },
      { lotNumber: null },
    ],
    [
      'row of an ID that names none',
      async () => UNKNOWN_ID,
      { notes: '別の棚' },
    ],
    [
      'row of an ID that names none by its lot number',
      async () => UNKNOWN_ID,
      { lotNumber: null },
    ],
  ])('should change no %s', async (_case, idOfRow, changes) => {
    // Arrange
    const salonId = await storedSalon()
    const id = inventoryIdSchema.parse(await idOfRow())

    // Act
    const updated = await repository().update(reachOf(salonId), id, changes)

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect((await storedOf(id))?.notes ?? null).toBeNull()
  })

  it('should write no lot number of another row of the product', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, { requiresLotTracking: true })
    await storedRow(salonId, product.id, { lotNumber: 'L-001' })
    const row = await storedRow(salonId, product.id, { lotNumber: 'L-002' })

    // Act
    const updated = await repository().update(reachOf(salonId), row.id, {
      lotNumber: 'L-001',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'error',
      error: { type: 'alreadyExists', field: 'lotNumber', value: 'L-001' },
    })
  })

  it('should find no row that the deletion it waited for took away', async () => {
    // Arrange
    const { salonId, row } = await storedStock()

    // Act
    const updated = await databases.whileHeld(
      (held) => held`select id from inventory where id = ${row.id} for update`,
      (held) => held`delete from inventory where id = ${row.id}`,
      () => repository().update(reachOf(salonId), row.id, { notes: '棚の奥' }),
    )

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should decide on the lot number by the product as the change it waited for left it', async () => {
    // Arrange
    const { salonId, product, row } = await storedStock()

    // Act
    const updated = await databases.whileHeld(
      (held) =>
        held`select id from products where id = ${product.id} for update`,
      (held) =>
        held`update products set "requiresLotTracking" = true where id = ${product.id}`,
      () => repository().update(reachOf(salonId), row.id, { lotNumber: null }),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: {
        type: 'lotNumberRefused',
        message: inventoryMessages.lotOfProductKeptByLots,
      },
    })
  })
})

describe('InventoryRepository.delete', () => {
  it('should delete the row without stock, and leave the others', async () => {
    // Arrange
    const { salonId, product, row } = await storedStock({
      currentStock: '0.00',
      availableStock: '0.00',
    })
    const other = await storedRow(salonId, product.id, {
      lotNumber: 'L-001',
      currentStock: '0.00',
      availableStock: '0.00',
    })

    // Act
    const deleted = await repository().delete(reachOf(salonId), row.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    expect(await storedOf(row.id)).toBeUndefined()
    expect(await storedOf(other.id)).toEqual(other)
  })

  it('should delete no row that holds stock', async () => {
    // Arrange
    const { salonId, row } = await storedStock()

    // Act
    const deleted = await repository().delete(reachOf(salonId), row.id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'inStock' } })
    expect(await storedOf(row.id)).toEqual(row)
  })

  it('should delete no row that the movement it waited for left with stock', async () => {
    // Arrange
    const { salonId, row } = await storedStock({
      currentStock: '0.00',
      availableStock: '0.00',
    })

    // Act
    const deleted = await databases.whileHeld(
      (held) => held`select id from inventory where id = ${row.id} for update`,
      (held) =>
        held`update inventory set "currentStock" = 2, "availableStock" = 2 where id = ${row.id}`,
      () => repository().delete(reachOf(salonId), row.id),
    )

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'inStock' } })
  })

  it.each<[string, () => Promise<string>]>([
    [
      'row of another salon',
      async () =>
        (await storedStock({ currentStock: '0.00', availableStock: '0.00' }))
          .row.id,
    ],
    ['row of an ID that names none', async () => UNKNOWN_ID],
  ])('should delete no %s', async (_case, idOfRow) => {
    // Arrange
    const salonId = await storedSalon()
    const id = inventoryIdSchema.parse(await idOfRow())

    // Act
    const deleted = await repository().delete(reachOf(salonId), id)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
  })
})

describe('InventoryRepository.recordMovement', () => {
  it('should move the stock and what is available, and record the movement with the row and its balances', async () => {
    // Arrange
    const { salonId, product, row } = await storedStock({
      lotNumber: null,
      expiryDate: '2027-01-31',
      reservedStock: '2.00',
      availableStock: '8.00',
      updatedAt: '2020-01-01T00:00:00Z',
    })

    // Act
    const recorded = await repository().recordMovement(
      reachOf(salonId),
      row.id,
      USE,
    )

    // Assert
    const movement = {
      ...USE,
      salonId,
      productId: product.id,
      inventoryId: row.id,
      lotNumber: null,
      expiryDate: '2027-01-31',
      balanceBefore: '10.00',
      balanceAfter: '7.00',
    }
    expect(recorded).toMatchObject({
      type: 'success',
      data: { type: 'recorded', transaction: movement },
    })
    expect(await storedOf(row.id)).toMatchObject({
      currentStock: '7.00',
      availableStock: '5.00',
      reservedStock: '2.00',
    })
    expect((await storedOf(row.id))?.updatedAt).not.toBe(row.updatedAt)
    expect(await movementsOf(row.id)).toMatchObject([movement])
  })

  it.each([
    ['down to what is reserved', '-8.00', '2.00'],
    ['up to the most a row holds', '99999989.99', '99999999.99'],
  ])('should record a movement %s', async (_case, quantity, after) => {
    // Arrange
    const { salonId, row } = await storedStock({
      reservedStock: '2.00',
      availableStock: '8.00',
    })

    // Act
    const recorded = await repository().recordMovement(
      reachOf(salonId),
      row.id,
      {
        ...USE,
        transactionType: 'adjustment',
        quantity,
        reason: '棚卸しの差',
      },
    )

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: { type: 'recorded', transaction: { balanceAfter: after } },
    })
  })

  it.each([
    ['below what is reserved', '-8.01', 'belowReserved'],
    ['above the most a row holds', '99999990.00', 'overLimit'],
  ])('should record no movement %s', async (_case, quantity, refused) => {
    // Arrange
    const { salonId, row } = await storedStock({
      reservedStock: '2.00',
      availableStock: '8.00',
    })

    // Act
    const recorded = await repository().recordMovement(
      reachOf(salonId),
      row.id,
      {
        ...USE,
        transactionType: 'adjustment',
        quantity,
        reason: '棚卸しの差',
      },
    )

    // Assert
    expect(recorded).toEqual({ type: 'success', data: { type: refused } })
    expect(await storedOf(row.id)).toEqual(row)
    expect(await movementsOf(row.id)).toEqual([])
  })

  it.each<[string, () => Promise<string>]>([
    ['row of another salon', async () => (await storedStock()).row.id],
    ['row of an ID that names none', async () => UNKNOWN_ID],
  ])('should move no %s', async (_case, idOfRow) => {
    // Arrange
    const salonId = await storedSalon()
    const id = inventoryIdSchema.parse(await idOfRow())

    // Act
    const recorded = await repository().recordMovement(
      reachOf(salonId),
      id,
      USE,
    )

    // Assert
    expect(recorded).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should move the stock the movement it waited for left', async () => {
    // Arrange
    const { salonId, row } = await storedStock()

    // Act
    const recorded = await databases.whileHeld(
      (held) => held`select id from inventory where id = ${row.id} for update`,
      (held) =>
        held`update inventory set "currentStock" = 4, "availableStock" = 4 where id = ${row.id}`,
      () => repository().recordMovement(reachOf(salonId), row.id, USE),
    )

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: {
        type: 'recorded',
        transaction: { balanceBefore: '4.00', balanceAfter: '1.00' },
      },
    })
  })

  it.each<
    [
      string,
      'inventory' | 'inventory_transactions',
      'UPDATE' | 'INSERT',
      string,
    ]
  >([
    [
      'the update of the row',
      'inventory',
      'UPDATE',
      'Update of moved stock row returned no row',
    ],
    [
      'the insert of the movement',
      'inventory_transactions',
      'INSERT',
      'Insert of stock movement returned no row',
    ],
  ])(
    'should answer that %s returned no row when a trigger skips it',
    async (_case, table, operation, message) => {
      // Arrange
      const { salonId, row } = await storedStock()
      await databases.skipWrites(table, operation)

      // Act
      const recorded = await repository().recordMovement(
        reachOf(salonId),
        row.id,
        USE,
      )

      // Assert
      expect(recorded).toEqual(failureOf(message))
    },
  )
})

/**
 * A row with four movements: a purchase on 2026-12-01, two adjustments on
 * 2026-12-02 at one moment, whose IDs are in the other order, and a use
 * on 2026-12-03 at a moment with microseconds. Another row has a movement too.
 */
const storedHistory = async () => {
  const { salonId, product, row } = await storedStock()
  const db = databases.database()
  const movement = (
    place: number,
    createdAt: string,
    overrides: Parameters<typeof insertMovement>[2] = {},
  ) => insertMovement(db, row, { id: idOf(place), createdAt, ...overrides })
  const bought = await movement(21, '2026-12-01T10:00:00Z')
  const counted: Parameters<typeof insertMovement>[2] = {
    transactionType: 'adjustment',
    quantity: '1.00',
    balanceBefore: '5.00',
    balanceAfter: '6.00',
    reason: '棚卸しの差',
  }
  const adjustedLater = await movement(22, '2026-12-02T10:00:00Z', counted)
  const adjustedFirst = await movement(23, '2026-12-02T10:00:00Z', counted)
  const used = await movement(24, '2026-12-03T10:00:00.123456Z', {
    transactionType: 'use',
    quantity: '-1.00',
    balanceBefore: '6.00',
    balanceAfter: '5.00',
  })
  const other = await storedRow(salonId, product.id, { lotNumber: 'L-001' })
  const elsewhere = await insertMovement(db, other)
  return {
    salonId,
    row,
    movements: { bought, adjustedFirst, adjustedLater, used, elsewhere },
  }
}

const transactionIdOf = (id: string) => inventoryTransactionIdSchema.parse(id)

describe('InventoryRepository.listMovements', () => {
  it('should list the movements of the row, the latest and then the greatest ID first', async () => {
    // Arrange
    const { salonId, row, movements } = await storedHistory()

    // Act
    const listed = await repository().listMovements(reachOf(salonId), {
      inventoryId: row.id,
      limit: 20,
      after: null,
      transactionType: null,
      startDate: null,
      endDate: null,
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        type: 'listed',
        transactions: [
          movements.used,
          movements.adjustedFirst,
          movements.adjustedLater,
          movements.bought,
        ],
        total: 4,
        hasMore: false,
      },
    })
  })

  it.each<
    [
      string,
      {
        transactionType: 'adjustment' | null
        startDate: string | null
        endDate: string | null
      },
      (
        movements: Awaited<ReturnType<typeof storedHistory>>['movements'],
      ) => unknown[],
    ]
  >([
    [
      'their kind',
      { transactionType: 'adjustment', startDate: null, endDate: null },
      (movements) => [movements.adjustedFirst, movements.adjustedLater],
    ],
    [
      'the first moment, at the milliseconds a response shows',
      {
        transactionType: null,
        startDate: '2026-12-03T10:00:00.123Z',
        endDate: null,
      },
      (movements) => [movements.used],
    ],
    [
      'the last moment, at the milliseconds a response shows',
      {
        transactionType: null,
        startDate: null,
        endDate: '2026-12-03T10:00:00.123Z',
      },
      (movements) => [
        movements.used,
        movements.adjustedFirst,
        movements.adjustedLater,
        movements.bought,
      ],
    ],
    [
      'a period',
      {
        transactionType: null,
        startDate: '2026-12-02T10:00:00.000Z',
        endDate: '2026-12-02T10:00:00.000Z',
      },
      (movements) => [movements.adjustedFirst, movements.adjustedLater],
    ],
  ])(
    'should list the movements by %s, and count them',
    async (_case, filters, expectedOf) => {
      // Arrange
      const { salonId, row, movements } = await storedHistory()
      const expected = expectedOf(movements)

      // Act
      const listed = await repository().listMovements(reachOf(salonId), {
        inventoryId: row.id,
        limit: 20,
        after: null,
        ...filters,
      })

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: {
          type: 'listed',
          transactions: expected,
          total: expected.length,
          hasMore: false,
        },
      })
    },
  )

  it('should list a page at a time, from the movement after the cursor', async () => {
    // Arrange
    const { salonId, row, movements } = await storedHistory()
    const criteria = {
      inventoryId: row.id,
      limit: 1,
      transactionType: null,
      startDate: null,
      endDate: null,
    }

    // Act
    const listed = await repository().listMovements(reachOf(salonId), {
      ...criteria,
      after: transactionIdOf(movements.adjustedFirst.id),
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: {
        type: 'listed',
        transactions: [movements.adjustedLater],
        total: 4,
        hasMore: true,
      },
    })
  })

  it.each<[string, () => Promise<string>]>([
    ['row of another salon', async () => (await storedStock()).row.id],
    ['row of an ID that names none', async () => UNKNOWN_ID],
  ])('should list no movements of a %s', async (_case, idOfRow) => {
    // Arrange
    const salonId = await storedSalon()

    // Act
    const listed = await repository().listMovements(reachOf(salonId), {
      inventoryId: inventoryIdSchema.parse(await idOfRow()),
      limit: 20,
      after: null,
      transactionType: null,
      startDate: null,
      endDate: null,
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'inventoryNotFound' },
    })
  })

  it.each<
    [
      string,
      (
        movements: Awaited<ReturnType<typeof storedHistory>>['movements'],
      ) => string,
    ]
  >([
    ['a movement of another row', (movements) => movements.elsewhere.id],
    ['an ID that names no movement', () => UNKNOWN_ID],
  ])('should list no page after %s', async (_case, cursorOf) => {
    // Arrange
    const { salonId, row, movements } = await storedHistory()

    // Act
    const listed = await repository().listMovements(reachOf(salonId), {
      inventoryId: row.id,
      limit: 20,
      after: transactionIdOf(cursorOf(movements)),
      transactionType: null,
      startDate: null,
      endDate: null,
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'cursorNotFound' },
    })
  })
})

/**
 * Three rows of a salon, whose IDs are in another order than the count
 * names them: the first holds 10 with 1 reserved, the second 5 and the
 * third 3, of a lot that expires.
 */
const storedCount = async () => {
  const salonId = await storedSalon()
  const product = await storedProduct(salonId, { requiresLotTracking: true })
  const first = await storedRow(salonId, product.id, {
    id: idOf(33),
    lotNumber: 'L-1',
    reservedStock: '1.00',
    availableStock: '9.00',
  })
  const second = await storedRow(salonId, product.id, {
    id: idOf(31),
    lotNumber: 'L-2',
    currentStock: '5.00',
    availableStock: '5.00',
  })
  const third = await storedRow(salonId, product.id, {
    id: idOf(32),
    lotNumber: 'L-3',
    expiryDate: '2027-02-28',
    currentStock: '3.00',
    availableStock: '3.00',
  })
  return { salonId, product, rows: { first, second, third } }
}

const countOf = (
  salonId: SalonId,
  items: InventoryStockCountCriteria['items'],
): InventoryStockCountCriteria => ({
  salonId,
  items,
  reason: '月末の棚卸し',
  performedBy: COUNTER,
})

describe('InventoryRepository.performStockCount', () => {
  it('should write what was counted of every row, and record an adjustment of each row that differs, in the order of the count', async () => {
    // Arrange
    const { salonId, product, rows } = await storedCount()

    // Act
    const counted = await repository().performStockCount(
      countOf(salonId, [
        { inventoryId: rows.first.id, countedQuantity: '7.00' },
        { inventoryId: rows.second.id, countedQuantity: '5.00' },
        { inventoryId: rows.third.id, countedQuantity: '6.00' },
      ]),
    )

    // Assert
    const adjustment = {
      transactionType: 'adjustment',
      salonId,
      productId: product.id,
      reason: '月末の棚卸し',
      performedBy: COUNTER,
      unitCost: null,
      totalCost: null,
      referenceType: null,
      referenceId: null,
    }
    expect(counted).toMatchObject({
      type: 'success',
      data: {
        type: 'counted',
        adjustments: [
          {
            ...adjustment,
            inventoryId: rows.first.id,
            lotNumber: 'L-1',
            expiryDate: null,
            quantity: '-3.00',
            balanceBefore: '10.00',
            balanceAfter: '7.00',
          },
          {
            ...adjustment,
            inventoryId: rows.third.id,
            lotNumber: 'L-3',
            expiryDate: '2027-02-28',
            quantity: '3.00',
            balanceBefore: '3.00',
            balanceAfter: '6.00',
          },
        ],
        discrepancies: [
          {
            inventoryId: rows.first.id,
            expected: '10.00',
            counted: '7.00',
            difference: '-3.00',
          },
          {
            inventoryId: rows.third.id,
            expected: '3.00',
            counted: '6.00',
            difference: '3.00',
          },
        ],
      },
    })
    const first = await storedOf(rows.first.id)
    expect(first).toMatchObject({
      currentStock: '7.00',
      availableStock: '6.00',
      reservedStock: '1.00',
      lastCountedBy: COUNTER,
    })
    expect(first?.lastCountedAt).not.toBeNull()
    expect(first?.updatedAt).toBe(first?.lastCountedAt)
    expect(await storedOf(rows.second.id)).toMatchObject({
      currentStock: '5.00',
      lastCountedAt: first?.lastCountedAt,
    })
    expect(await storedOf(rows.third.id)).toMatchObject({
      currentStock: '6.00',
      availableStock: '6.00',
      lastCountedAt: first?.lastCountedAt,
    })
    expect(
      (await movementsOf(rows.first.id)).map(({ createdAt }) => createdAt),
    ).toEqual([first?.lastCountedAt])
    expect(await movementsOf(rows.second.id)).toEqual([])
  })

  it('should record no adjustment when nothing differs', async () => {
    // Arrange
    const { salonId, rows } = await storedCount()

    // Act
    const counted = await repository().performStockCount(
      countOf(salonId, [
        { inventoryId: rows.second.id, countedQuantity: '5.00' },
      ]),
    )

    // Assert
    expect(counted).toEqual({
      type: 'success',
      data: { type: 'counted', adjustments: [], discrepancies: [] },
    })
    expect((await storedOf(rows.second.id))?.lastCountedAt).not.toBeNull()
  })

  it('should answer the places in the count of the rows that are not of the salon, and write nothing', async () => {
    // Arrange
    const { salonId, rows } = await storedCount()
    const away = (await storedStock()).row

    // Act
    const counted = await repository().performStockCount(
      countOf(salonId, [
        { inventoryId: rows.first.id, countedQuantity: '7.00' },
        { inventoryId: away.id, countedQuantity: '7.00' },
        {
          inventoryId: inventoryIdSchema.parse(UNKNOWN_ID),
          countedQuantity: '7.00',
        },
      ]),
    )

    // Assert
    expect(counted).toEqual({
      type: 'success',
      data: { type: 'rowsNotFound', indexes: [1, 2] },
    })
    expect(await storedOf(rows.first.id)).toEqual(rows.first)
    expect(await storedOf(away.id)).toEqual(away)
  })

  it('should count no row below what is reserved of it, and write nothing', async () => {
    // Arrange
    const { salonId, rows } = await storedCount()

    // Act
    const counted = await repository().performStockCount(
      countOf(salonId, [
        { inventoryId: rows.second.id, countedQuantity: '4.00' },
        { inventoryId: rows.first.id, countedQuantity: '0.99' },
      ]),
    )

    // Assert
    expect(counted).toEqual({
      type: 'success',
      data: { type: 'belowReserved', inventoryId: rows.first.id },
    })
    expect(await storedOf(rows.second.id)).toEqual(rows.second)
  })

  it('should compare what was counted with the stock the movement it waited for left', async () => {
    // Arrange
    const { salonId, rows } = await storedCount()

    // Act
    const counted = await databases.whileHeld(
      (held) =>
        held`select id from inventory where id = ${rows.second.id} for update`,
      (held) =>
        held`update inventory set "currentStock" = 4, "availableStock" = 4 where id = ${rows.second.id}`,
      () =>
        repository().performStockCount(
          countOf(salonId, [
            { inventoryId: rows.second.id, countedQuantity: '5.00' },
          ]),
        ),
    )

    // Assert
    expect(counted).toMatchObject({
      type: 'success',
      data: {
        type: 'counted',
        discrepancies: [
          {
            inventoryId: rows.second.id,
            expected: '4.00',
            counted: '5.00',
            difference: '1.00',
          },
        ],
      },
    })
  })

  it.each<
    [
      string,
      'inventory' | 'inventory_transactions',
      'UPDATE' | 'INSERT',
      string,
    ]
  >([
    [
      'the update of the rows',
      'inventory',
      'UPDATE',
      'Update of counted stock rows returned no row for 2 of 2',
    ],
    [
      'the insert of the adjustments',
      'inventory_transactions',
      'INSERT',
      'Insert of stock count adjustments returned no row for 1 of 1',
    ],
  ])(
    'should answer that %s returned no row when a trigger skips it',
    async (_case, table, operation, message) => {
      // Arrange
      const { salonId, rows } = await storedCount()
      await databases.skipWrites(table, operation)

      // Act
      const counted = await repository().performStockCount(
        countOf(salonId, [
          { inventoryId: rows.first.id, countedQuantity: '7.00' },
          { inventoryId: rows.second.id, countedQuantity: '5.00' },
        ]),
      )

      // Assert
      expect(counted).toEqual(failureOf(message))
    },
  )
})

describe('InventoryRepository.valueReport', () => {
  /**
   * Hair care of 4000 (2.5 and 1 at 1000, and 1.5 at 333: 3999.5 summed),
   * colour of 300, products without a category of 300 and tools of 0, which
   * have no purchase price. A row without stock and the stock of another
   * salon do not count.
   */
  const storedValues = async () => {
    const salonId = await storedSalon()
    const other = await storedSalon()
    const product = (overrides: Parameters<typeof insertProduct>[2]) =>
      storedProduct(salonId, { requiresLotTracking: true, ...overrides })
    const stock = (productId: string, lotNumber: string, amount: string) =>
      storedRow(salonId, productId, {
        lotNumber,
        currentStock: amount,
        availableStock: amount,
      })
    const shampoo = await product({
      category: 'hair_care',
      purchasePrice: 1000,
    })
    await stock(shampoo.id, 'L-1', '2.50')
    await stock(shampoo.id, 'L-2', '1.00')
    await stock(shampoo.id, 'L-3', '0.00')
    const conditioner = await product({
      category: 'hair_care',
      purchasePrice: 333,
    })
    await stock(conditioner.id, 'L-1', '1.50')
    const colour = await product({ category: 'color', purchasePrice: 100 })
    await stock(colour.id, 'L-1', '3.00')
    const towels = await product({ category: null, purchasePrice: 150 })
    await stock(towels.id, 'L-1', '2.00')
    const scissors = await product({ category: 'tools', purchasePrice: null })
    await stock(scissors.id, 'L-1', '5.00')
    const empty = await product({ category: 'styling', purchasePrice: 500 })
    await stock(empty.id, 'L-1', '0.00')
    await storedRow(
      other,
      (await storedProduct(other, { category: 'color', purchasePrice: 9000 }))
        .id,
    )
    return salonId
  }

  it('should sum the value of the stock by category, the greatest first and those of the same value by category, none last', async () => {
    // Arrange
    const salonId = await storedValues()

    // Act
    const report = await repository().valueReport(salonId, null)

    // Assert
    expect(report).toEqual({
      type: 'success',
      data: [
        { category: 'hair_care', value: '4000', itemCount: 2 },
        { category: 'color', value: '300', itemCount: 1 },
        { category: null, value: '300', itemCount: 1 },
        { category: 'tools', value: '0', itemCount: 1 },
      ],
    })
  })

  it('should sum the value of the stock of one category', async () => {
    // Arrange
    const salonId = await storedValues()

    // Act
    const report = await repository().valueReport(salonId, 'color')

    // Assert
    expect(report).toEqual({
      type: 'success',
      data: [{ category: 'color', value: '300', itemCount: 1 }],
    })
  })
})

describe('InventoryRepository when the database is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const id = inventoryIdSchema.parse(UNKNOWN_ID)
  const reach = reachOf(salonId)

  it.each<[string, (gone: InventoryRepository) => Promise<unknown>]>([
    [
      'Failed to create stock row',
      (gone) => gone.create(rowOf(salonId, UNKNOWN_ID)),
    ],
    ['Failed to find stock row', (gone) => gone.findById(reach, id)],
    ['Failed to list stock rows', (gone) => gone.list(listOf())],
    [
      'Failed to list low stock',
      (gone) =>
        gone.listLowStock({ salonId, limit: 20, after: null, threshold: null }),
    ],
    [
      'Failed to list expiring stock',
      (gone) =>
        gone.listExpiring({
          salonId,
          limit: 20,
          after: null,
          until: '2026-12-31',
        }),
    ],
    [
      'Failed to update stock row',
      (gone) => gone.update(reach, id, { notes: null }),
    ],
    ['Failed to delete stock row', (gone) => gone.delete(reach, id)],
    [
      'Failed to record stock movement',
      (gone) => gone.recordMovement(reach, id, USE),
    ],
    [
      'Failed to list stock movements',
      (gone) =>
        gone.listMovements(reach, {
          inventoryId: id,
          limit: 20,
          after: null,
          transactionType: null,
          startDate: null,
          endDate: null,
        }),
    ],
    [
      'Failed to perform stock count',
      (gone) =>
        gone.performStockCount(
          countOf(salonId, [{ inventoryId: id, countedQuantity: '1.00' }]),
        ),
    ],
    [
      'Failed to read the value of the stock',
      (gone) => gone.valueReport(salonId, null),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new InventoryRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
