import {
  type SalesFigures,
  type SalesPeriod,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { SalesReportRepository } from '../sales-report.repository.impl'
import {
  insertCategory,
  insertPayment,
  insertPaymentMethod,
  insertSale,
  insertSaleLine,
  insertSalon,
  insertService,
  insertStaffMember,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new SalesReportRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The period of the reports of the tests: Monday 7 and Tuesday 8 December 2026. */
const periodOf = (salonId: string): SalesPeriod => ({
  salonId: salonIdSchema.parse(salonId),
  startDate: '2026-12-07',
  endDate: '2026-12-08',
})

/**
 * The sales of a salon in the period, and around it:
 * - on the 7th, a sale of 9,900 yen by Sato with a cut (6,600), a product
 *   sold by Suzuki (2,200) and a service line that names no service
 *   (1,100), paid 6,600 yen in cash and refunded 1,000 yen; and a sale of
 *   2,200 yen that is not paid yet and has no lines
 * - on the 8th, a sale of 5,500 yen that names no staff member, with two
 *   head spas by Suzuki of a category of the kind `other` (3,300) and a
 *   service of no category that no staff member is named for (2,200),
 *   paid by card, with a card payment of 500 yen that was refunded in
 *   full and one that is still pending
 * - a void sale on the 7th, sales on the 6th and on the 9th, and a sale of
 *   another salon on the 7th, none of which a report counts
 */
const storedSales = async () => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const sato = await insertStaffMember(db, salon.id, { displayName: '佐藤' })
  const suzuki = await insertStaffMember(db, salon.id, {
    displayName: '鈴木',
  })
  const cut = await insertService(db, salon.id, {
    categoryId: (await insertCategory(db, salon.id, { category: 'cut' })).id,
  })
  const spa = await insertService(db, salon.id, {
    categoryId: (await insertCategory(db, salon.id, { category: 'other' })).id,
  })
  const uncategorized = await insertService(db, salon.id)
  const cash = await insertPaymentMethod(db, salon.id)
  const card = await insertPaymentMethod(db, salon.id, {
    method: 'credit_card',
    displayName: 'クレジットカード',
  })
  const parties = { salonId: salon.id, customerId: null }

  const first = await insertSale(db, parties, {
    staffId: sato.id,
    subtotal: 9000,
    taxAmount: 900,
    totalAmount: 9900,
  })
  await insertSaleLine(db, first.id, { itemId: cut.id, sortOrder: 0 })
  await insertSaleLine(db, first.id, {
    itemType: 'product',
    itemName: 'ヘアオイル',
    unitPrice: 2000,
    taxAmount: 200,
    totalAmount: 2200,
    staffId: suzuki.id,
    sortOrder: 1,
  })
  await insertSaleLine(db, first.id, {
    itemName: '前髪カット',
    unitPrice: 1000,
    taxAmount: 100,
    totalAmount: 1100,
    sortOrder: 2,
  })
  await insertPayment(db, first.id, cash.id, {
    status: 'partial_refund',
    refundAmount: 1000,
    refundedAt: '2026-12-07T03:00:00Z',
  })
  await insertSale(db, parties, {
    subtotal: 2000,
    taxAmount: 200,
    totalAmount: 2200,
  })

  const second = await insertSale(db, parties, {
    saleDate: '2026-12-08',
    saleTime: '2026-12-08T02:00:00Z',
    subtotal: 5000,
    discountAmount: 0,
    taxAmount: 500,
    totalAmount: 5500,
  })
  await insertSaleLine(db, second.id, {
    itemId: spa.id,
    itemName: 'ヘッドスパ',
    quantity: 2,
    unitPrice: 1500,
    taxAmount: 300,
    totalAmount: 3300,
    staffId: suzuki.id,
    sortOrder: 0,
  })
  await insertSaleLine(db, second.id, {
    itemId: uncategorized.id,
    itemName: 'ブロー',
    unitPrice: 2000,
    taxAmount: 200,
    totalAmount: 2200,
    sortOrder: 1,
  })
  await insertPayment(db, second.id, card.id, { amount: 5500 })
  await insertPayment(db, second.id, card.id, {
    amount: 500,
    status: 'refunded',
    refundAmount: 500,
    refundedAt: '2026-12-08T03:00:00Z',
  })
  await insertPayment(db, second.id, card.id, {
    amount: 500,
    status: 'pending',
    processedAt: null,
  })

  const voided = await insertSale(db, parties, {
    staffId: sato.id,
    isVoid: true,
    voidedAt: '2026-12-07T04:00:00Z',
  })
  await insertSaleLine(db, voided.id, { itemId: cut.id })
  await insertPayment(db, voided.id, cash.id)
  for (const day of ['2026-12-06', '2026-12-09']) {
    const outside = await insertSale(db, parties, {
      staffId: sato.id,
      saleDate: day,
      saleTime: `${day}T02:00:00Z`,
    })
    await insertSaleLine(db, outside.id, { itemId: cut.id })
    await insertPayment(db, outside.id, cash.id)
  }
  const elsewhere = await insertSalon(db)
  const other = await insertSale(db, {
    salonId: elsewhere.id,
    customerId: null,
  })
  await insertSaleLine(db, other.id)
  await insertPayment(
    db,
    other.id,
    (await insertPaymentMethod(db, elsewhere.id)).id,
  )

  return { salonId: salon.id, sato: sato.id, suzuki: suzuki.id }
}

/** The figures of a read that found the salon. */
const figuresOf = (
  read: Result<SalesFigures | null, unknown>,
): SalesFigures | null => (read.type === 'success' ? read.data : null)

describe('SalesReportRepository.findFigures', () => {
  it('should sum the sales of each day of the period that are not void, with what was refunded of them', async () => {
    // Arrange
    const { salonId } = await storedSales()

    // Act
    const read = await repository().findFigures(periodOf(salonId))

    // Assert
    expect(
      figuresOf(read)?.days.toSorted((a, b) =>
        a.saleDate.localeCompare(b.saleDate),
      ),
    ).toEqual([
      {
        saleDate: '2026-12-07',
        sales: 12100,
        tax: 1100,
        discounts: 0,
        transactions: 2,
        refunds: 1000,
      },
      {
        saleDate: '2026-12-08',
        sales: 5500,
        tax: 500,
        discounts: 0,
        transactions: 1,
        refunds: 500,
      },
    ])
  })

  it('should sum what each payment method received and kept, of the payments that were received', async () => {
    // Arrange
    const { salonId } = await storedSales()

    // Act
    const read = await repository().findFigures(periodOf(salonId))

    // Assert
    expect(
      figuresOf(read)?.methods.toSorted((a, b) =>
        a.method.localeCompare(b.method),
      ),
    ).toEqual([
      { method: 'cash', amount: 5600, count: 1 },
      { method: 'credit_card', amount: 5500, count: 2 },
    ])
  })

  it('should sum the service lines by the kind of the category of their service, a line of no category as other', async () => {
    // Arrange
    const { salonId } = await storedSales()

    // Act
    const read = await repository().findFigures(periodOf(salonId))

    // Assert
    expect(
      figuresOf(read)?.categories.toSorted((a, b) =>
        a.category.localeCompare(b.category),
      ),
    ).toEqual([
      { category: 'cut', amount: 6600, count: 1 },
      { category: 'other', amount: 6600, count: 4 },
    ])
  })

  it('should sum the lines by the staff member of the line, or else of the sale, and leave out a line of neither', async () => {
    // Arrange
    const { salonId, sato, suzuki } = await storedSales()

    // Act
    const read = await repository().findFigures(periodOf(salonId))

    // Assert
    expect(
      figuresOf(read)?.staff.toSorted((a, b) =>
        a.displayName.localeCompare(b.displayName),
      ),
    ).toEqual([
      {
        staffId: sato,
        displayName: '佐藤',
        totalSales: 7700,
        serviceSales: 7700,
        serviceCount: 2,
      },
      {
        staffId: suzuki,
        displayName: '鈴木',
        totalSales: 5500,
        serviceSales: 3300,
        serviceCount: 2,
      },
    ])
  })

  it('should count nothing of a period without sales', async () => {
    // Arrange
    const { salonId } = await storedSales()

    // Act
    const read = await repository().findFigures({
      ...periodOf(salonId),
      startDate: '2026-12-10',
      endDate: '2026-12-31',
    })

    // Assert
    expect(read).toEqual({
      type: 'success',
      data: { days: [], methods: [], categories: [], staff: [] },
    })
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a salon that is deleted',
      async () =>
        (
          await insertSalon(databases.database(), {
            deletedAt: '2026-12-01T00:00:00Z',
          })
        ).id,
    ],
    ['an ID that names no salon', async () => UNKNOWN_ID],
  ])('should read no figures of %s', async (_case, salonOf) => {
    // Arrange
    const salonId = await salonOf()

    // Act
    const read = await repository().findFigures(periodOf(salonId))

    // Assert
    expect(read).toEqual({ type: 'success', data: null })
  })

  it('should answer Failed to read the figures of a sales report when the database is gone', async () => {
    // Arrange
    const gone = new SalesReportRepository(await databases.gone())

    // Act
    const read = await gone.findFigures(periodOf(UNKNOWN_ID))

    // Assert
    expect(read).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: 'Failed to read the figures of a sales report',
      },
    })
  })
})
