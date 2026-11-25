import { inventoryAlertAcknowledgements } from '@beauty-salon-backend/database'
import {
  type AlertAcknowledgement,
  type DbInventoryAlertFacts,
  type DomainError,
  type LedgerReach,
  type SalonId,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { Result } from '@beauty-salon-backend/utility'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { InventoryAlertRepository } from '../inventory-alert.repository.impl'
import {
  insertAcknowledgement,
  insertMovement,
  insertProduct,
  insertSalon,
  insertStock,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new InventoryAlertRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const reachOf = (salonId: SalonId): LedgerReach => ({ type: 'salon', salonId })

/** 2026-12-10 at noon in Tokyo: the rows that expire by 2027-01-09 expire soon. */
const NOW = new Date('2026-12-10T03:00:00Z')

/** A salon in the table, by the ID a repository is given. */
const storedSalon = async (
  overrides: Parameters<typeof insertSalon>[1] = {},
): Promise<SalonId> =>
  salonIdSchema.parse((await insertSalon(databases.database(), overrides)).id)

const storedProduct = (
  salonId: SalonId,
  overrides: Parameters<typeof insertProduct>[2] = {},
) => insertProduct(databases.database(), salonId, overrides)

const storedRow = (
  salonId: SalonId,
  productId: string,
  overrides: Parameters<typeof insertStock>[3] = {},
) => insertStock(databases.database(), salonId, productId, overrides)

/** What a row holds, all of it available. */
const stock = (amount: string) => ({
  currentStock: amount,
  availableStock: amount,
})

type Product = Awaited<ReturnType<typeof storedProduct>>
type Row = Awaited<ReturnType<typeof storedRow>>

const productFactOf = (product: Product, total: string, place: number) => ({
  productId: product.id,
  salonId: product.salonId,
  productCode: product.productCode,
  productName: product.name,
  unit: product.unit,
  minimumStock: product.minimumStock,
  maximumStock: product.maximumStock,
  stock: total,
  place,
})

const rowFactOf = (product: Product, row: Row, place: number) => ({
  inventoryId: row.id,
  salonId: row.salonId,
  productId: product.id,
  productCode: product.productCode,
  productName: product.name,
  unit: product.unit,
  lotNumber: row.lotNumber,
  expiryDate: row.expiryDate,
  currentStock: row.currentStock,
  place,
})

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** The facts, in an order of their own: the database reads them in none. */
const inOrder = (facts: Result<DbInventoryAlertFacts, DomainError>) =>
  Result.map(facts, ({ products, rows, acknowledgements }) => ({
    products: products.toSorted((a, b) => a.place - b.place),
    rows: rows.toSorted(
      (a, b) => a.place - b.place || compareText(a.inventoryId, b.inventoryId),
    ),
    acknowledgements: acknowledgements.toSorted((a, b) =>
      compareText(a.acknowledgement.id, b.acknowledgement.id),
    ),
  }))

/**
 * A salon whose products are, by code: A-050, deleted; A-100, at its
 * minimum of 3 (2 of a lot that expires on 2026-12-31 and 1 of a later
 * one); B-200, at its maximum of 10; C-300, above its maximum of 8, of a
 * row that expired; D-400, not used any more, below its minimum, of a row
 * that expires on 2026-12-20; and E-500, below its minimum without a stock
 * row. Another salon has a product below its minimum, whose code comes
 * first, and a row that expires.
 */
const storedShelf = async () => {
  const salonId = await storedSalon()
  const other = await storedSalon()
  await storedProduct(salonId, {
    productCode: 'A-050',
    deletedAt: '2026-12-01T00:00:00Z',
  })
  const low = await storedProduct(salonId, {
    productCode: 'A-100',
    minimumStock: '3.00',
  })
  const atMaximum = await storedProduct(salonId, {
    productCode: 'B-200',
    minimumStock: '5.00',
    maximumStock: '10.00',
  })
  const over = await storedProduct(salonId, {
    productCode: 'C-300',
    maximumStock: '8.00',
  })
  const retired = await storedProduct(salonId, {
    productCode: 'D-400',
    minimumStock: '5.00',
    isActive: false,
  })
  await storedProduct(salonId, { productCode: 'E-500', minimumStock: '5.00' })
  const lowExpiring = await storedRow(salonId, low.id, {
    lotNumber: 'L-1',
    expiryDate: '2026-12-31',
    ...stock('2.00'),
  })
  await storedRow(salonId, low.id, {
    lotNumber: 'L-2',
    expiryDate: '2027-01-01',
    ...stock('1.00'),
  })
  await storedRow(salonId, atMaximum.id, stock('10.00'))
  await storedRow(salonId, atMaximum.id, {
    lotNumber: 'L-1',
    expiryDate: '2026-12-01',
    ...stock('0.00'),
  })
  const overExpired = await storedRow(salonId, over.id, {
    expiryDate: '2026-11-01',
    ...stock('9.00'),
  })
  const retiredExpiring = await storedRow(salonId, retired.id, {
    expiryDate: '2026-12-20',
    ...stock('1.00'),
  })
  const elsewhere = await storedProduct(other, {
    productCode: 'A-000',
    minimumStock: '5.00',
  })
  await storedRow(other, elsewhere.id, {
    expiryDate: '2026-12-20',
    ...stock('1.00'),
  })
  return {
    salonId,
    facts: {
      products: [productFactOf(low, '3.00', 2), productFactOf(over, '9.00', 4)],
      rows: [
        rowFactOf(low, lowExpiring, 2),
        rowFactOf(over, overExpired, 4),
        rowFactOf(retired, retiredExpiring, 5),
      ],
    },
  }
}

describe('InventoryAlertRepository.listFacts', () => {
  it('should read the active products at or below their minimum or above their maximum, and the rows with stock that expire by the day', async () => {
    // Arrange
    const { salonId, facts } = await storedShelf()

    // Act
    const listed = await repository().listFacts({
      salonId,
      lastExpiringDay: '2026-12-31',
    })

    // Assert
    expect(inOrder(listed)).toEqual({
      type: 'success',
      data: { ...facts, acknowledgements: [] },
    })
  })

  it('should read no facts of a salon with nothing to tell of', async () => {
    // Arrange
    const salonId = await storedSalon()
    const product = await storedProduct(salonId, { minimumStock: '1.00' })
    await storedRow(salonId, product.id, stock('2.00'))

    // Act
    const listed = await repository().listFacts({
      salonId,
      lastExpiringDay: '2026-12-31',
    })

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { products: [], rows: [], acknowledgements: [] },
    })
  })

  it('should read the latest acknowledgement of each alert, with what the stock has been since', async () => {
    // Arrange
    const db = databases.database()
    const salonId = await storedSalon()
    // Low at 4 now: 5 when it was acknowledged, 3 after a use, then 4
    // after two purchases of one moment. A purchase before does not count.
    const low = await storedProduct(salonId, {
      productCode: 'A-100',
      minimumStock: '5.00',
    })
    const lowRow = await storedRow(salonId, low.id, stock('4.00'))
    await insertAcknowledgement(db, low, {
      threshold: '5.00',
      acknowledgedAt: '2026-12-01T00:00:00Z',
    })
    const lowAcknowledged = await insertAcknowledgement(db, low, {
      threshold: '5.00',
      acknowledgedAt: '2026-12-02T00:00:00Z',
    })
    await insertMovement(db, lowRow, { createdAt: '2026-12-01T12:00:00Z' })
    await insertMovement(db, lowRow, {
      createdAt: '2026-12-03T00:00:00Z',
      transactionType: 'use',
      quantity: '-2.00',
      balanceBefore: '5.00',
      balanceAfter: '3.00',
    })
    for (const balanceBefore of ['3.00', '3.50']) {
      await insertMovement(db, lowRow, {
        createdAt: '2026-12-04T00:00:00Z',
        quantity: '0.50',
        balanceBefore,
        balanceAfter: String(Number(balanceBefore) + 0.5),
      })
    }
    // Low at 2, with no movement since it was acknowledged.
    const still = await storedProduct(salonId, {
      productCode: 'B-200',
      minimumStock: '5.00',
    })
    await storedRow(salonId, still.id, stock('2.00'))
    const stillAcknowledged = await insertAcknowledgement(db, still, {
      threshold: '5.00',
      acknowledgedAt: '2026-12-02T00:00:00Z',
    })
    // Rows that expire: one used down to 1 since it was acknowledged, and
    // left at nothing before; one not moved since.
    const lotted = await storedProduct(salonId, { productCode: 'C-300' })
    const used = await storedRow(salonId, lotted.id, {
      lotNumber: 'L-1',
      expiryDate: '2026-12-20',
      ...stock('1.00'),
    })
    const expiring: Parameters<typeof insertAcknowledgement>[2] = {
      alert: 'expiring',
      severity: 'warning',
      threshold: null,
    }
    const usedAcknowledged = await insertAcknowledgement(db, lotted, {
      ...expiring,
      inventoryId: used.id,
      expiryDate: '2026-12-20',
      acknowledgedAt: '2026-12-02T00:00:00Z',
    })
    await insertMovement(db, used, {
      createdAt: '2026-12-01T00:00:00Z',
      transactionType: 'use',
      quantity: '-1.00',
      balanceBefore: '1.00',
      balanceAfter: '0.00',
    })
    await insertMovement(db, used, {
      createdAt: '2026-12-03T00:00:00Z',
      quantity: '2.00',
      balanceBefore: '1.00',
      balanceAfter: '3.00',
    })
    await insertMovement(db, used, {
      createdAt: '2026-12-04T00:00:00Z',
      transactionType: 'use',
      quantity: '-2.00',
      balanceBefore: '3.00',
      balanceAfter: '1.00',
    })
    const untouched = await storedRow(salonId, lotted.id, {
      lotNumber: 'L-2',
      expiryDate: '2026-12-25',
      ...stock('1.00'),
    })
    const untouchedAcknowledged = await insertAcknowledgement(db, lotted, {
      ...expiring,
      inventoryId: untouched.id,
      expiryDate: '2026-12-25',
      acknowledgedAt: '2026-12-02T00:00:00Z',
    })
    // Acknowledgements of a product and of rows that have no alert now.
    await insertAcknowledgement(db, low, {
      ...expiring,
      inventoryId: lowRow.id,
      expiryDate: '2026-12-20',
    })
    const fine = await storedProduct(salonId, {
      productCode: 'D-400',
      minimumStock: '1.00',
    })
    const fineRow = await storedRow(salonId, fine.id, stock('5.00'))
    await insertAcknowledgement(db, fine, { threshold: '1.00' })
    await insertAcknowledgement(db, fine, {
      ...expiring,
      inventoryId: fineRow.id,
      expiryDate: '2026-12-20',
    })

    // Act
    const listed = await repository().listFacts({
      salonId,
      lastExpiringDay: '2026-12-31',
    })

    // Assert
    expect(inOrder(listed)).toMatchObject({
      type: 'success',
      data: {
        acknowledgements: [
          {
            type: 'product',
            acknowledgement: lowAcknowledged,
            lowestStock: '3.00',
            highestStock: '5.00',
          },
          {
            type: 'product',
            acknowledgement: stillAcknowledged,
            lowestStock: '2.00',
            highestStock: '2.00',
          },
          {
            type: 'stockRow',
            acknowledgement: usedAcknowledged,
            lowestStock: '1.00',
          },
          {
            type: 'stockRow',
            acknowledgement: untouchedAcknowledged,
            lowestStock: null,
          },
        ].toSorted((a, b) =>
          compareText(a.acknowledgement.id, b.acknowledgement.id),
        ),
      },
    })
  })
})

/**
 * A salon whose product A-100 is low, of a row that expires on
 * 2026-12-20, and whose product B-200 has no alert, of a row that does not
 * expire.
 */
const storedCursors = async () => {
  const salonId = await storedSalon()
  const low = await storedProduct(salonId, {
    productCode: 'A-100',
    minimumStock: '5.00',
  })
  const expiring = await storedRow(salonId, low.id, {
    expiryDate: '2026-12-20',
    ...stock('1.00'),
  })
  const quiet = await storedProduct(salonId, { productCode: 'B-200' })
  const quietRow = await storedRow(salonId, quiet.id)
  const other = await storedSalon()
  const elsewhere = await storedProduct(other)
  const elsewhereRow = await storedRow(other, elsewhere.id)
  return {
    salonId,
    cursors: { low, expiring, quiet, quietRow, elsewhere, elsewhereRow },
    facts: {
      products: [productFactOf(low, '1.00', 1)],
      rows: [rowFactOf(low, expiring, 1)],
      acknowledgements: [],
    },
  }
}

type Cursors = Awaited<ReturnType<typeof storedCursors>>['cursors']

describe('InventoryAlertRepository.listFactsAfter', () => {
  it.each<
    [string, (cursors: Cursors) => string, (cursors: Cursors) => unknown]
  >([
    [
      'a product with an alert',
      ({ low }) => low.id,
      () => ({ place: 1, inventoryId: null, expiryDate: null }),
    ],
    [
      'a product without one',
      ({ quiet }) => quiet.id,
      () => ({ place: 2, inventoryId: null, expiryDate: null }),
    ],
    [
      'a row with an alert',
      ({ expiring }) => expiring.id,
      ({ expiring }) => ({
        place: 1,
        inventoryId: expiring.id,
        expiryDate: '2026-12-20',
      }),
    ],
    [
      'a row without an expiry date',
      ({ quietRow }) => quietRow.id,
      ({ quietRow }) => ({
        place: 2,
        inventoryId: quietRow.id,
        expiryDate: null,
      }),
    ],
  ])(
    'should read the facts, and where the alert of %s stands',
    async (_case, cursorOf, positionOf) => {
      // Arrange
      const { salonId, cursors, facts } = await storedCursors()

      // Act
      const listed = await repository().listFactsAfter(
        { salonId, lastExpiringDay: '2026-12-31' },
        cursorOf(cursors),
      )

      // Assert
      expect(listed).toEqual({
        type: 'success',
        data: { type: 'listed', facts, after: positionOf(cursors) },
      })
    },
  )

  it.each<[string, (cursors: Cursors) => string]>([
    ['a product of another salon', ({ elsewhere }) => elsewhere.id],
    ['a row of another salon', ({ elsewhereRow }) => elsewhereRow.id],
    ['an ID that names neither', () => UNKNOWN_ID],
  ])('should read nothing after %s', async (_case, cursorOf) => {
    // Arrange
    const { salonId, cursors } = await storedCursors()

    // Act
    const listed = await repository().listFactsAfter(
      { salonId, lastExpiringDay: '2026-12-31' },
      cursorOf(cursors),
    )

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'cursorNotFound' },
    })
  })
})

const requestOf = (
  product: Product,
  overrides: Partial<AlertAcknowledgement> = {},
): AlertAcknowledgement => ({
  alert: 'low_stock',
  productId: product.id,
  inventoryId: null,
  notes: '発注済み',
  acknowledgedBy: null,
  ...overrides,
})

const acknowledgementsOf = (productId: string) =>
  databases
    .database()
    .select()
    .from(inventoryAlertAcknowledgements)
    .where(eq(inventoryAlertAcknowledgements.productId, productId))

describe('InventoryAlertRepository.acknowledge', () => {
  it.each<[string, (salonId: SalonId) => LedgerReach]>([
    ['its salon', reachOf],
    ['every salon', () => EVERY_SALON],
  ])(
    'should acknowledge the low stock of a product, as it is now, for a reader of %s',
    async (_case, reach) => {
      // Arrange
      const salonId = await storedSalon()
      const low = await storedProduct(salonId, { minimumStock: '5.00' })
      await storedRow(salonId, low.id, stock('2.00'))

      // Act
      const acknowledged = await repository().acknowledge(
        reach(salonId),
        requestOf(low),
        NOW,
      )

      // Assert
      const [stored] = await acknowledgementsOf(low.id)
      expect(stored).toMatchObject({
        salonId,
        inventoryId: null,
        alert: 'low_stock',
        severity: 'warning',
        threshold: '5.00',
        expiryDate: null,
        notes: '発注済み',
        acknowledgedBy: null,
      })
      expect(acknowledged).toEqual({
        type: 'success',
        data: {
          type: 'acknowledged',
          alert: {
            alert: 'low_stock',
            severity: 'warning',
            salonId,
            productId: low.id,
            productCode: low.productCode,
            productName: low.name,
            unit: low.unit,
            inventoryId: null,
            lotNumber: null,
            expiryDate: null,
            currentStock: '2.00',
            threshold: '5.00',
            acknowledgement: stored,
            position: { place: 1, inventoryId: null, expiryDate: null },
          },
        },
      })
    },
  )

  it.each<[string, 'expiring' | 'expired', string, 'warning' | 'critical']>([
    ['expires soon', 'expiring', '2027-01-09', 'warning'],
    ['has expired', 'expired', '2026-12-09', 'critical'],
  ])(
    'should acknowledge that a row %s, by the days of its salon',
    async (_case, alert, expiryDate, severity) => {
      // Arrange
      const salonId = await storedSalon()
      const product = await storedProduct(salonId)
      const row = await storedRow(salonId, product.id, {
        lotNumber: 'L-1',
        expiryDate,
        ...stock('1.00'),
      })

      // Act
      const acknowledged = await repository().acknowledge(
        reachOf(salonId),
        requestOf(product, { alert, inventoryId: row.id }),
        NOW,
      )

      // Assert
      const [stored] = await acknowledgementsOf(product.id)
      expect(stored).toMatchObject({
        inventoryId: row.id,
        alert,
        severity,
        threshold: null,
        expiryDate,
      })
      expect(acknowledged).toMatchObject({
        type: 'success',
        data: {
          type: 'acknowledged',
          alert: {
            alert,
            severity,
            inventoryId: row.id,
            lotNumber: 'L-1',
            expiryDate,
            currentStock: '1.00',
            threshold: null,
            acknowledgement: stored,
            position: { place: 1, inventoryId: row.id, expiryDate },
          },
        },
      })
    },
  )

  it.each<
    [
      string,
      (
        salonId: SalonId,
      ) => Promise<Partial<AlertAcknowledgement> & { productId: string }>,
    ]
  >([
    [
      'product of another salon',
      async () => {
        const other = await storedSalon()
        return { productId: (await storedProduct(other)).id }
      },
    ],
    [
      'product of an ID that names none',
      async () => ({ productId: UNKNOWN_ID }),
    ],
    [
      'row of another product',
      async (salonId) => {
        const product = await storedProduct(salonId)
        const other = await storedProduct(salonId)
        const row = await storedRow(salonId, other.id, {
          expiryDate: '2026-12-20',
        })
        return { productId: product.id, inventoryId: row.id, alert: 'expiring' }
      },
    ],
    [
      'row of an ID that names none',
      async (salonId) => ({
        productId: (await storedProduct(salonId)).id,
        inventoryId: UNKNOWN_ID,
        alert: 'expiring',
      }),
    ],
  ])('should find no %s', async (_case, requested) => {
    // Arrange
    const salonId = await storedSalon()
    const request = await requested(salonId)

    // Act
    const acknowledged = await repository().acknowledge(
      reachOf(salonId),
      {
        alert: 'low_stock',
        inventoryId: null,
        notes: null,
        acknowledgedBy: null,
        ...request,
      },
      NOW,
    )

    // Assert
    expect(acknowledged).toEqual({
      type: 'success',
      data: { type: 'notFound' },
    })
  })

  it('should acknowledge nothing of a salon in a time zone the runtime does not know', async () => {
    // Arrange
    const salonId = await storedSalon({ timezone: 'Mars/Olympus_Mons' })
    const low = await storedProduct(salonId, { minimumStock: '5.00' })
    await storedRow(salonId, low.id, stock('2.00'))

    // Act
    const acknowledged = await repository().acknowledge(
      reachOf(salonId),
      requestOf(low),
      NOW,
    )

    // Assert
    expect(acknowledged).toEqual({
      type: 'success',
      data: {
        type: 'unknownTimeZone',
        salonId,
        timezone: 'Mars/Olympus_Mons',
      },
    })
    expect(await acknowledgementsOf(low.id)).toEqual([])
  })

  it.each<[string, Partial<AlertAcknowledgement>, string]>([
    ['the low stock of a product that has enough', {}, '10.00'],
    [
      'too much of a product whose stock is low',
      { alert: 'overstock' },
      '2.00',
    ],
  ])(
    'should acknowledge no alert that is not there: %s',
    async (_case, overrides, amount) => {
      // Arrange
      const salonId = await storedSalon()
      const product = await storedProduct(salonId, {
        minimumStock: '5.00',
        maximumStock: '20.00',
      })
      await storedRow(salonId, product.id, stock(amount))

      // Act
      const acknowledged = await repository().acknowledge(
        reachOf(salonId),
        requestOf(product, overrides),
        NOW,
      )

      // Assert
      expect(acknowledged).toEqual({
        type: 'success',
        data: { type: 'notActive' },
      })
      expect(await acknowledgementsOf(product.id)).toEqual([])
    },
  )

  it('should acknowledge no alert whose acknowledgement still holds', async () => {
    // Arrange
    const salonId = await storedSalon()
    const low = await storedProduct(salonId, { minimumStock: '5.00' })
    await storedRow(salonId, low.id, stock('2.00'))
    const holding = await insertAcknowledgement(databases.database(), low, {
      threshold: '5.00',
    })

    // Act
    const acknowledged = await repository().acknowledge(
      reachOf(salonId),
      requestOf(low),
      NOW,
    )

    // Assert
    expect(acknowledged).toEqual({
      type: 'success',
      data: { type: 'alreadyAcknowledged' },
    })
    expect(await acknowledgementsOf(low.id)).toEqual([holding])
  })

  it('should acknowledge the alert as the movement it waited for left the stock', async () => {
    // Arrange
    const salonId = await storedSalon()
    const low = await storedProduct(salonId, { minimumStock: '5.00' })
    const row = await storedRow(salonId, low.id, stock('2.00'))

    // Act
    const acknowledged = await databases.whileHeld(
      (held) => held`select id from inventory where id = ${row.id} for update`,
      (held) =>
        held`update inventory set "currentStock" = 0, "availableStock" = 0 where id = ${row.id}`,
      () => repository().acknowledge(reachOf(salonId), requestOf(low), NOW),
    )

    // Assert
    expect(acknowledged).toMatchObject({
      type: 'success',
      data: {
        type: 'acknowledged',
        alert: {
          severity: 'critical',
          currentStock: '0.00',
          acknowledgement: { severity: 'critical' },
        },
      },
    })
  })

  it('should decide on the alert by the levels the change of the product it waited for left', async () => {
    // Arrange
    const salonId = await storedSalon()
    const low = await storedProduct(salonId, { minimumStock: '5.00' })
    await storedRow(salonId, low.id, stock('2.00'))

    // Act
    const acknowledged = await databases.whileHeld(
      (held) => held`select id from products where id = ${low.id} for update`,
      (held) =>
        held`update products set "minimumStock" = 1 where id = ${low.id}`,
      () => repository().acknowledge(reachOf(salonId), requestOf(low), NOW),
    )

    // Assert
    expect(acknowledged).toEqual({
      type: 'success',
      data: { type: 'notActive' },
    })
    expect(await acknowledgementsOf(low.id)).toEqual([])
  })

  it('should answer that the insert returned no row when a trigger skips it', async () => {
    // Arrange
    const salonId = await storedSalon()
    const low = await storedProduct(salonId, { minimumStock: '5.00' })
    await storedRow(salonId, low.id, stock('2.00'))
    await databases.skipWrites('inventory_alert_acknowledgements', 'INSERT')

    // Act
    const acknowledged = await repository().acknowledge(
      reachOf(salonId),
      requestOf(low),
      NOW,
    )

    // Assert
    expect(acknowledged).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of inventory alert acknowledgement returned no row',
        cause: null,
      },
    })
  })
})

describe('InventoryAlertRepository when the database is gone', () => {
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const criteria = { salonId, lastExpiringDay: '2026-12-31' }

  it.each<
    [string, string, (gone: InventoryAlertRepository) => Promise<unknown>]
  >([
    [
      'the facts',
      'Failed to list inventory alerts',
      (gone) => gone.listFacts(criteria),
    ],
    [
      'the facts after a cursor',
      'Failed to list inventory alerts',
      (gone) => gone.listFactsAfter(criteria, UNKNOWN_ID),
    ],
    [
      'an acknowledgement',
      'Failed to acknowledge inventory alert',
      (gone) =>
        gone.acknowledge(
          reachOf(salonId),
          {
            alert: 'low_stock',
            productId: UNKNOWN_ID,
            inventoryId: null,
            notes: null,
            acknowledgedBy: null,
          },
          NOW,
        ),
    ],
  ])('should answer for %s: %s', async (_subject, message, call) => {
    // Arrange
    const gone = new InventoryAlertRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
