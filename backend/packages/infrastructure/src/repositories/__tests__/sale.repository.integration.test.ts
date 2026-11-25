import {
  type paymentTransactions,
  sales,
  salesDetails,
  salons,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  customerIdSchema,
  type LedgerReach,
  type RequestedSale,
  type RequestedSaleChange,
  type RequestedSalesDetail,
  type SaleListCriteria,
  type SaleOrigin,
  saleIdSchema,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { SaleRepository } from '../sale.repository.impl'
import {
  insertBooking,
  insertBookingLine,
  insertCustomer,
  insertPayment,
  insertPaymentMethod,
  insertProduct,
  insertSale,
  insertSaleLine,
  insertSalon,
  insertService,
  insertStaffMember,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new SaleRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const ofSalon = (salonId: string): LedgerReach => ({
  type: 'salon',
  salonId: salonIdSchema.parse(salonId),
})

/**
 * What a sale names: a salon, a customer and a member of its staff, a
 * service and a product of the salon, and a booking of the customer there.
 */
const storedParties = async () => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const customer = await insertCustomer(db)
  const member = await insertStaffMember(db, salon.id)
  const service = await insertService(db, salon.id)
  const product = await insertProduct(db, salon.id)
  const booking = await insertBooking(db, {
    salonId: salon.id,
    customerId: customer.id,
    staffId: member.id,
  })
  return {
    salonId: salonIdSchema.parse(salon.id),
    customerId: customerIdSchema.parse(customer.id),
    staffId: staffIdSchema.parse(member.id),
    serviceId: service.id,
    productId: product.id,
    bookingId: bookingIdSchema.parse(booking.id),
  }
}

type Parties = Awaited<ReturnType<typeof storedParties>>

/** A line of a sale: a cut of 6,000 yen and its tax, of no service and by nobody. */
const lineOf = (
  overrides: Partial<RequestedSalesDetail> = {},
): RequestedSalesDetail => ({
  itemType: 'service',
  itemId: null,
  itemName: 'カット',
  quantity: 1,
  unitPrice: 6000,
  discountAmount: 0,
  taxAmount: 600,
  totalAmount: 6600,
  staffId: null,
  commissionRate: null,
  commissionAmount: null,
  notes: null,
  sortOrder: 0,
  ...overrides,
})

/**
 * The bill of the booking, at one in the morning of 7 December in Tokyo:
 * the service by the member of the staff, and the product before it.
 */
const requestOf = (
  parties: Parties,
  overrides: Partial<RequestedSale> = {},
): RequestedSale => ({
  salonId: parties.salonId,
  customerId: parties.customerId,
  staffId: parties.staffId,
  bookingId: parties.bookingId,
  saleTime: '2026-12-06T16:00:00.000Z',
  pointsUsed: null,
  pointsEarned: 66,
  notes: null,
  details: [
    lineOf({
      itemId: parties.serviceId,
      staffId: parties.staffId,
      commissionRate: 12.5,
      sortOrder: 1,
    }),
    lineOf({
      itemType: 'product',
      itemId: parties.productId,
      itemName: 'ヘアオイル',
      unitPrice: 2000,
      taxAmount: 200,
      totalAmount: 2200,
      sortOrder: 0,
    }),
  ],
  ...overrides,
})

let issued = 0

const originOf = (saleNumber?: string): SaleOrigin => {
  issued += 1
  return {
    saleNumber: saleNumber ?? `SL-REPO-${String(issued).padStart(4, '0')}`,
  }
}

const linesInTheTable = (saleId: string) =>
  databases
    .database()
    .select()
    .from(salesDetails)
    .where(eq(salesDetails.saleId, saleId))
    .orderBy(asc(salesDetails.sortOrder))

const salesInTheTable = (salonId: string) =>
  databases.database().select().from(sales).where(eq(sales.salonId, salonId))

/** A sale of the customer in the table, with no booking and one line, unpaid unless the test says otherwise. */
const storedSale = async (
  parties: Parties,
  overrides: Partial<typeof sales.$inferInsert> = {},
) => {
  const db = databases.database()
  const sale = await insertSale(
    db,
    { salonId: parties.salonId, customerId: parties.customerId },
    overrides,
  )
  await insertSaleLine(db, sale.id)
  return saleIdSchema.parse(sale.id)
}

describe('SaleRepository.create', () => {
  it('should write the sale with its lines in their order, on the day of its time in the time zone of the salon, and with no payment', async () => {
    // Arrange
    const parties = await storedParties()

    // Act
    const created = await repository().create(
      requestOf(parties),
      originOf('SL-REPO-ONE'),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        sale: {
          sale: {
            saleNumber: 'SL-REPO-ONE',
            salonId: parties.salonId,
            customerId: parties.customerId,
            staffId: parties.staffId,
            bookingId: parties.bookingId,
            saleDate: '2026-12-07',
            subtotal: 8000,
            discountAmount: 0,
            taxAmount: 800,
            totalAmount: 8800,
            pointsEarned: 66,
            paymentStatus: 'pending',
            isVoid: false,
          },
          details: [
            { itemType: 'product', itemId: parties.productId, sortOrder: 0 },
            {
              itemType: 'service',
              itemId: parties.serviceId,
              staffId: parties.staffId,
              commissionRate: '12.50',
              sortOrder: 1,
            },
          ],
          payments: [],
        },
      },
    })
  })

  it('should write a sale that names no customer, staff member or booking, with a line by a member of the staff', async () => {
    // Arrange
    const parties = await storedParties()

    // Act
    const created = await repository().create(
      requestOf(parties, {
        customerId: null,
        staffId: null,
        bookingId: null,
        pointsEarned: null,
        details: [lineOf({ staffId: parties.staffId })],
      }),
      originOf(),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        sale: {
          sale: {
            customerId: null,
            staffId: null,
            bookingId: null,
            totalAmount: 6600,
          },
          details: [{ itemId: null, staffId: parties.staffId }],
        },
      },
    })
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a salon that is deleted',
      async () =>
        (await insertSalon(databases.database(), { deletedAt: DELETED_AT })).id,
    ],
    ['an ID that names no salon', async () => UNKNOWN_ID],
  ])('should write no sale of %s', async (_case, salonOf) => {
    // Arrange
    const parties = await storedParties()
    const salonId = salonIdSchema.parse(await salonOf())

    // Act
    const created = await repository().create(
      requestOf(parties, { salonId }),
      originOf(),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'salonId' }] },
    })
    expect(await salesInTheTable(salonId)).toEqual([])
  })

  it('should write no sale of a customer who is deleted', async () => {
    // Arrange
    const parties = await storedParties()
    const customer = await insertCustomer(databases.database(), {
      deletedAt: DELETED_AT,
    })

    // Act
    const created = await repository().create(
      requestOf(parties, {
        customerId: customerIdSchema.parse(customer.id),
        bookingId: null,
      }),
      originOf(),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'customerId' }] },
    })
  })

  it.each<
    [string, (parties: Parties) => Promise<Partial<RequestedSale>>, string]
  >([
    [
      'a staff member who is deleted',
      async ({ salonId }) => ({
        staffId: staffIdSchema.parse(
          (
            await insertStaffMember(databases.database(), salonId, {
              deletedAt: DELETED_AT,
            })
          ).id,
        ),
      }),
      'staffId',
    ],
    [
      'a staff member of another salon',
      async () => ({
        staffId: staffIdSchema.parse(
          (
            await insertStaffMember(
              databases.database(),
              (
                await insertSalon(databases.database())
              ).id,
            )
          ).id,
        ),
      }),
      'staffId',
    ],
    [
      'a line by a staff member of another salon',
      async () => ({
        details: [
          lineOf({
            staffId: staffIdSchema.parse(
              (
                await insertStaffMember(
                  databases.database(),
                  (
                    await insertSalon(databases.database())
                  ).id,
                )
              ).id,
            ),
          }),
        ],
      }),
      'details.0.staffId',
    ],
    [
      'a service that is deleted',
      async ({ salonId }) => ({
        details: [
          lineOf({
            itemId: (
              await insertService(databases.database(), salonId, {
                deletedAt: DELETED_AT,
              })
            ).id,
          }),
        ],
      }),
      'details.0.itemId',
    ],
    [
      'a service of another salon',
      async () => ({
        details: [
          lineOf({
            itemId: (
              await insertService(
                databases.database(),
                (
                  await insertSalon(databases.database())
                ).id,
              )
            ).id,
          }),
        ],
      }),
      'details.0.itemId',
    ],
    [
      'a product that is deleted',
      async ({ salonId }) => ({
        details: [
          lineOf({
            itemType: 'product',
            itemId: (
              await insertProduct(databases.database(), salonId, {
                deletedAt: DELETED_AT,
              })
            ).id,
          }),
        ],
      }),
      'details.0.itemId',
    ],
    [
      'a product of another salon',
      async () => ({
        details: [
          lineOf({
            itemType: 'product',
            itemId: (
              await insertProduct(
                databases.database(),
                (
                  await insertSalon(databases.database())
                ).id,
              )
            ).id,
          }),
        ],
      }),
      'details.0.itemId',
    ],
  ])('should write no sale that names %s', async (_case, changesOf, field) => {
    // Arrange
    const parties = await storedParties()
    const changes = await changesOf(parties)

    // Act
    const created = await repository().create(
      requestOf(parties, changes),
      originOf(),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field }] },
    })
    expect(await salesInTheTable(parties.salonId)).toEqual([])
  })

  it.each<[string, (parties: Parties) => Promise<string>]>([
    [
      'a booking of another salon',
      async ({ customerId }) => {
        const db = databases.database()
        const salon = await insertSalon(db)
        const member = await insertStaffMember(db, salon.id)
        return (
          await insertBooking(db, {
            salonId: salon.id,
            customerId,
            staffId: member.id,
          })
        ).id
      },
    ],
    [
      'a booking of another customer',
      async ({ salonId, staffId }) =>
        (
          await insertBooking(databases.database(), {
            salonId,
            staffId,
            customerId: (await insertCustomer(databases.database())).id,
          })
        ).id,
    ],
  ])('should write no sale that bills %s', async (_case, bookingOf) => {
    // Arrange
    const parties = await storedParties()
    const bookingId = bookingIdSchema.parse(await bookingOf(parties))

    // Act
    const created = await repository().create(
      requestOf(parties, { bookingId }),
      originOf(),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'bookingId' }] },
    })
  })

  it('should write no second bill of a booking', async () => {
    // Arrange
    const parties = await storedParties()
    await storedSale(parties, { bookingId: parties.bookingId })

    // Act
    const created = await repository().create(requestOf(parties), originOf())

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'bookingBilled' },
    })
    expect(await salesInTheTable(parties.salonId)).toHaveLength(1)
  })

  it('should bill a booking whose bill was voided', async () => {
    // Arrange
    const parties = await storedParties()
    await storedSale(parties, {
      bookingId: parties.bookingId,
      isVoid: true,
      voidedAt: DELETED_AT,
    })

    // Act
    const created = await repository().create(requestOf(parties), originOf())

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created' },
    })
  })

  it('should bill no booking that another request billed while this one waited for it', async () => {
    // Arrange
    const parties = await storedParties()

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`select id from bookings where id = ${parties.bookingId} for update`,
      (held) =>
        held`insert into sales ("saleNumber", "salonId", "customerId", "bookingId", "saleDate", "saleTime", subtotal, "taxAmount", "totalAmount") values ('SL-REPO-HELD', ${parties.salonId}, ${parties.customerId}, ${parties.bookingId}, '2026-12-07', '2026-12-07T02:00:00Z', 6000, 600, 6600)`,
      () => repository().create(requestOf(parties), originOf()),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'bookingBilled' },
    })
  })

  it('should write nothing when another sale has the sale number', async () => {
    // Arrange
    const parties = await storedParties()
    await insertSale(
      databases.database(),
      { salonId: parties.salonId, customerId: null },
      { saleNumber: 'SL-REPO-TAKEN' },
    )

    // Act
    const created = await repository().create(
      requestOf(parties),
      originOf('SL-REPO-TAKEN'),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'saleNumberTaken' },
    })
    expect(await databases.database().select().from(salesDetails)).toEqual([])
  })

  it('should write no sale of a salon whose time zone is none', async () => {
    // Arrange
    const parties = await storedParties()
    await databases
      .database()
      .update(salons)
      .set({ timezone: 'Mars/Olympus' })
      .where(eq(salons.id, parties.salonId))

    // Act
    const created = await repository().create(requestOf(parties), originOf())

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'timeZoneUnknown' },
    })
  })
})

describe('SaleRepository.findById', () => {
  it('should find the sale with its lines in their order and its payments in the order they were made', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const sale = await insertSale(db, {
      salonId: parties.salonId,
      customerId: parties.customerId,
    })
    await insertSaleLine(db, sale.id, { sortOrder: 1 })
    await insertSaleLine(db, sale.id, { itemName: 'シャンプー', sortOrder: 0 })
    const cash = await insertPaymentMethod(db, parties.salonId)
    const later = await insertPayment(db, sale.id, cash.id, {
      amount: 2600,
      createdAt: '2026-12-07T03:00:00Z',
    })
    const earlier = await insertPayment(db, sale.id, cash.id, {
      amount: 4000,
      createdAt: '2026-12-07T02:00:00Z',
    })
    await storedSale(parties)

    // Act
    const found = await repository().findById(
      saleIdSchema.parse(sale.id),
      ofSalon(parties.salonId),
    )

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: {
        sale: { id: sale.id },
        details: [
          { itemName: 'シャンプー', sortOrder: 0 },
          { itemName: 'カット', sortOrder: 1 },
        ],
        payments: [{ id: earlier.id }, { id: later.id }],
      },
    })
  })

  it('should find a sale with no lines', async () => {
    // Arrange
    const parties = await storedParties()
    const sale = await insertSale(databases.database(), {
      salonId: parties.salonId,
      customerId: null,
    })

    // Act
    const found = await repository().findById(
      saleIdSchema.parse(sale.id),
      EVERY_SALON,
    )

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { sale: { id: sale.id }, details: [], payments: [] },
    })
  })

  it.each<[string, (saleId: string) => { id: string; reach: LedgerReach }]>([
    [
      'a reader of another salon',
      (saleId) => ({ id: saleId, reach: ofSalon(UNKNOWN_ID) }),
    ],
    [
      'an ID that names no sale',
      () => ({ id: UNKNOWN_ID, reach: EVERY_SALON }),
    ],
  ])('should find no sale for %s', async (_case, targetOf) => {
    // Arrange
    const { id, reach } = targetOf(await storedSale(await storedParties()))

    // Act
    const found = await repository().findById(saleIdSchema.parse(id), reach)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('SaleRepository.update', () => {
  it('should change what the request names, and answer with the lines and the payments the sale has', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const saleId = await storedSale(parties, { paymentStatus: 'processing' })
    const cash = await insertPaymentMethod(db, parties.salonId)
    const payment = await insertPayment(db, saleId, cash.id, { amount: 3000 })
    await insertPayment(db, await storedSale(parties), cash.id)
    const member = await insertStaffMember(db, parties.salonId)

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, {
      staffId: staffIdSchema.parse(member.id),
      notes: '指名料込み',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        sale: {
          sale: {
            id: saleId,
            staffId: member.id,
            notes: '指名料込み',
            totalAmount: 6600,
          },
          details: [{ itemName: 'カット' }],
          payments: [{ id: payment.id }],
        },
      },
    })
  })

  it('should put the lines of the request in the place of those of the sale, and sum them', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties)

    // Act
    const updated = await repository().update(
      saleId,
      ofSalon(parties.salonId),
      {
        details: [
          lineOf({
            itemName: '前髪カット',
            unitPrice: 1000,
            taxAmount: 100,
            totalAmount: 1100,
            sortOrder: 1,
          }),
          lineOf({ itemId: parties.serviceId, sortOrder: 0 }),
        ],
      },
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        sale: {
          sale: { subtotal: 7000, taxAmount: 700, totalAmount: 7700 },
          details: [
            { itemId: parties.serviceId, sortOrder: 0 },
            { itemName: '前髪カット', sortOrder: 1 },
          ],
        },
      },
    })
    expect(await linesInTheTable(saleId)).toMatchObject([
      { itemId: parties.serviceId },
      { itemName: '前髪カット' },
    ])
  })

  it('should bill the booking and the customer the request names', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties, { customerId: null })

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, {
      customerId: parties.customerId,
      bookingId: parties.bookingId,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        type: 'updated',
        sale: {
          sale: {
            customerId: parties.customerId,
            bookingId: parties.bookingId,
          },
        },
      },
    })
  })

  it('should not take the sale for a second bill of its own booking', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties, { bookingId: parties.bookingId })

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, {
      customerId: parties.customerId,
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated' },
    })
  })

  it('should bill no booking that another sale bills', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties)
    await storedSale(parties, { bookingId: parties.bookingId })

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, {
      bookingId: parties.bookingId,
    })

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'bookingBilled' },
    })
  })

  it('should name no staff member of another salon than that of the sale', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const saleId = await storedSale(parties)
    const member = await insertStaffMember(db, (await insertSalon(db)).id)

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, {
      staffId: staffIdSchema.parse(member.id),
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'staffId' }] },
    })
  })

  it('should take the day of the sale in the time zone of its salon, also of a salon that is deleted', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties)
    await databases
      .database()
      .update(salons)
      .set({ deletedAt: DELETED_AT })
      .where(eq(salons.id, parties.salonId))

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, {
      saleTime: '2026-12-08T15:30:00.000Z',
    })

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: { type: 'updated', sale: { sale: { saleDate: '2026-12-09' } } },
    })
  })

  it.each<
    [string, Partial<typeof sales.$inferInsert>, RequestedSaleChange, string]
  >([
    [
      'a sale that is void',
      { isVoid: true, voidedAt: DELETED_AT },
      { notes: '指名料込み' },
      'void',
    ],
    [
      'the lines of a sale whose payment began',
      { paymentStatus: 'processing' },
      { details: [lineOf()] },
      'paymentBegun',
    ],
  ])('should change nothing of %s', async (_case, columns, request, type) => {
    // Arrange
    const saleId = await storedSale(await storedParties(), columns)

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, request)

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type } })
  })

  it('should read the payment status a payment left while this change waited for the sale', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties)
    const cash = await insertPaymentMethod(
      databases.database(),
      parties.salonId,
    )

    // Act
    const updated = await databases.whileHeld(
      (held) => held`select id from sales where id = ${saleId} for update`,
      async (held) => {
        await held`insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber", amount, status, "processedAt") values (${saleId}, ${cash.id}, 'TX-REPO-HELD', 3000, 'completed', '2026-12-07T02:00:00Z')`
        await held`update sales set "paymentStatus" = 'processing' where id = ${saleId}`
      },
      () => repository().update(saleId, EVERY_SALON, { details: [lineOf()] }),
    )

    // Assert
    expect(updated).toEqual({
      type: 'success',
      data: { type: 'paymentBegun' },
    })
  })

  it.each<[string, (saleId: string) => { id: string; reach: LedgerReach }]>([
    [
      'a reader of another salon',
      (saleId) => ({ id: saleId, reach: ofSalon(UNKNOWN_ID) }),
    ],
    [
      'an ID that names no sale',
      () => ({ id: UNKNOWN_ID, reach: EVERY_SALON }),
    ],
  ])('should change no sale for %s', async (_case, targetOf) => {
    // Arrange
    const { id, reach } = targetOf(await storedSale(await storedParties()))

    // Act
    const updated = await repository().update(saleIdSchema.parse(id), reach, {
      notes: '指名料込み',
    })

    // Assert
    expect(updated).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should answer that the update returned no row when a trigger skips it', async () => {
    // Arrange
    const saleId = await storedSale(await storedParties())
    await databases.skipWrites('sales', 'UPDATE')

    // Act
    const updated = await repository().update(saleId, EVERY_SALON, {
      details: [lineOf({ itemName: '前髪カット' })],
    })

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of sale returned no row',
        cause: null,
      },
    })
    expect(await linesInTheTable(saleId)).toMatchObject([
      { itemName: 'カット' },
    ])
  })
})

describe('SaleRepository.voidSale', () => {
  it('should void the sale with the reason, and answer with its lines in their order and its payments', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const sale = await insertSale(db, {
      salonId: parties.salonId,
      customerId: parties.customerId,
    })
    await insertSaleLine(db, sale.id, { sortOrder: 1 })
    await insertSaleLine(db, sale.id, { itemName: 'シャンプー', sortOrder: 0 })
    const saleId = saleIdSchema.parse(sale.id)
    const cash = await insertPaymentMethod(
      databases.database(),
      parties.salonId,
    )
    const payment = await insertPayment(databases.database(), saleId, cash.id, {
      status: 'failed',
      processedAt: null,
      failedAt: '2026-12-07T02:00:00Z',
      errorMessage: 'カードの期限切れ',
    })
    await insertPayment(
      databases.database(),
      await storedSale(parties),
      cash.id,
    )

    // Act
    const voided = await repository().voidSale(
      saleId,
      ofSalon(parties.salonId),
      { voidReason: '会計の入力の誤り' },
    )

    // Assert
    expect(voided).toMatchObject({
      type: 'success',
      data: {
        type: 'voided',
        sale: {
          sale: { id: saleId, isVoid: true, voidReason: '会計の入力の誤り' },
          details: [{ itemName: 'シャンプー' }, { itemName: 'カット' }],
          payments: [{ id: payment.id }],
        },
      },
    })
    const [stored] = await databases
      .database()
      .select({ voidedAt: sales.voidedAt })
      .from(sales)
      .where(eq(sales.id, saleId))
    expect(stored?.voidedAt).not.toBeNull()
  })

  it('should void a sale whose payment was given back', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties, { paymentStatus: 'refunded' })
    const cash = await insertPaymentMethod(
      databases.database(),
      parties.salonId,
    )
    await insertPayment(databases.database(), saleId, cash.id, {
      status: 'refunded',
      refundAmount: 6600,
      refundedAt: '2026-12-07T03:00:00Z',
    })

    // Act
    const voided = await repository().voidSale(saleId, EVERY_SALON, {
      voidReason: null,
    })

    // Assert
    expect(voided).toMatchObject({
      type: 'success',
      data: { type: 'voided' },
    })
  })

  it.each<[string, Partial<typeof paymentTransactions.$inferInsert>]>([
    ['is received', {}],
    [
      'was given back in part',
      {
        status: 'partial_refund',
        refundAmount: 1000,
        refundedAt: '2026-12-07T03:00:00Z',
      },
    ],
  ])('should void no sale whose payment %s', async (_case, payment) => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties)
    const cash = await insertPaymentMethod(
      databases.database(),
      parties.salonId,
    )
    await insertPayment(databases.database(), saleId, cash.id, payment)

    // Act
    const voided = await repository().voidSale(saleId, EVERY_SALON, {
      voidReason: null,
    })

    // Assert
    expect(voided).toEqual({ type: 'success', data: { type: 'paid' } })
  })

  it('should void no sale that a payment was recorded for while this void waited for it', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties)
    const cash = await insertPaymentMethod(
      databases.database(),
      parties.salonId,
    )

    // Act
    const voided = await databases.whileHeld(
      (held) => held`select id from sales where id = ${saleId} for update`,
      (held) =>
        held`insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber", amount, status, "processedAt") values (${saleId}, ${cash.id}, 'TX-REPO-HELD', 6600, 'completed', '2026-12-07T02:00:00Z')`,
      () => repository().voidSale(saleId, EVERY_SALON, { voidReason: null }),
    )

    // Assert
    expect(voided).toEqual({ type: 'success', data: { type: 'paid' } })
  })

  it('should void no sale twice', async () => {
    // Arrange
    const saleId = await storedSale(await storedParties(), {
      isVoid: true,
      voidedAt: DELETED_AT,
    })

    // Act
    const voided = await repository().voidSale(saleId, EVERY_SALON, {
      voidReason: null,
    })

    // Assert
    expect(voided).toEqual({ type: 'success', data: { type: 'void' } })
  })

  it.each<[string, (saleId: string) => { id: string; reach: LedgerReach }]>([
    [
      'a reader of another salon',
      (saleId) => ({ id: saleId, reach: ofSalon(UNKNOWN_ID) }),
    ],
    [
      'an ID that names no sale',
      () => ({ id: UNKNOWN_ID, reach: EVERY_SALON }),
    ],
  ])('should void no sale for %s', async (_case, targetOf) => {
    // Arrange
    const { id, reach } = targetOf(await storedSale(await storedParties()))

    // Act
    const voided = await repository().voidSale(saleIdSchema.parse(id), reach, {
      voidReason: null,
    })

    // Assert
    expect(voided).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should answer that the update returned no row when a trigger skips it', async () => {
    // Arrange
    const parties = await storedParties()
    const saleId = await storedSale(parties)
    await databases.skipWrites('sales', 'UPDATE')

    // Act
    const voided = await repository().voidSale(saleId, EVERY_SALON, {
      voidReason: null,
    })

    // Assert
    expect(voided).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of voided sale returned no row',
        cause: null,
      },
    })
    expect(await salesInTheTable(parties.salonId)).toMatchObject([
      { isVoid: false },
    ])
  })
})

describe('SaleRepository.list', () => {
  /**
   * Three sales, the latest first: one of the salon on the 8th of another
   * customer, unpaid; the bill of the booking on the 7th, paid, with two
   * lines; and one of the customer at another salon on the 6th, unpaid.
   */
  const storedLedger = async () => {
    const db = databases.database()
    const parties = await storedParties()
    const otherCustomer = await insertCustomer(db)
    const elsewhere = await insertSalon(db)
    const latest = await insertSale(
      db,
      { salonId: parties.salonId, customerId: otherCustomer.id },
      { saleDate: '2026-12-08', saleTime: '2026-12-08T02:00:00Z' },
    )
    const billed = await insertSale(
      db,
      { salonId: parties.salonId, customerId: parties.customerId },
      { bookingId: parties.bookingId, paymentStatus: 'completed' },
    )
    await insertSaleLine(db, billed.id, { sortOrder: 1 })
    await insertSaleLine(db, billed.id, {
      itemName: 'シャンプー',
      sortOrder: 0,
    })
    const earliest = await insertSale(
      db,
      { salonId: elsewhere.id, customerId: parties.customerId },
      { saleDate: '2026-12-06', saleTime: '2026-12-06T02:00:00Z' },
    )
    return {
      ...parties,
      otherCustomerId: customerIdSchema.parse(otherCustomer.id),
      elsewhere: elsewhere.id,
      latest: latest.id,
      billed: billed.id,
      earliest: earliest.id,
    }
  }

  type Ledger = Awaited<ReturnType<typeof storedLedger>>

  const criteriaOf = (
    overrides: Partial<SaleListCriteria> = {},
  ): SaleListCriteria => ({
    reach: EVERY_SALON,
    limit: 20,
    after: null,
    salonId: null,
    customerId: null,
    bookingId: null,
    paymentStatus: null,
    startDate: null,
    endDate: null,
    ...overrides,
  })

  const idsOf = (listed: Awaited<ReturnType<SaleRepository['list']>>) =>
    listed.type === 'success' && listed.data !== null
      ? listed.data.sales.map(({ sale }) => sale.id)
      : []

  it('should list the sales, the latest first, each with its lines in their order', async () => {
    // Arrange
    const ledger = await storedLedger()

    // Act
    const listed = await repository().list(criteriaOf())

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: {
        sales: [
          { sale: { id: ledger.latest }, details: [] },
          {
            sale: { id: ledger.billed },
            details: [{ itemName: 'シャンプー' }, { itemName: 'カット' }],
          },
          { sale: { id: ledger.earliest }, details: [] },
        ],
        total: 3,
        hasMore: false,
      },
    })
  })

  it.each<
    [
      string,
      (ledger: Ledger) => Partial<SaleListCriteria>,
      (ledger: Ledger) => string[],
    ]
  >([
    [
      'the salon',
      ({ salonId }) => ({ salonId }),
      ({ latest, billed }) => [latest, billed],
    ],
    [
      'the customer',
      ({ customerId }) => ({ customerId }),
      ({ billed, earliest }) => [billed, earliest],
    ],
    [
      'the booking',
      ({ bookingId }) => ({ bookingId }),
      ({ billed }) => [billed],
    ],
    [
      'the payment status',
      () => ({ paymentStatus: 'pending' }),
      ({ latest, earliest }) => [latest, earliest],
    ],
    [
      'the first day',
      () => ({ startDate: '2026-12-07' }),
      ({ latest, billed }) => [latest, billed],
    ],
    [
      'the last day',
      () => ({ endDate: '2026-12-07' }),
      ({ billed, earliest }) => [billed, earliest],
    ],
    [
      'the salon of the reader',
      ({ elsewhere }) => ({ reach: ofSalon(elsewhere) }),
      ({ earliest }) => [earliest],
    ],
  ])(
    'should list the sales of %s, and count them',
    async (_case, filterOf, expectedOf) => {
      // Arrange
      const ledger = await storedLedger()

      // Act
      const listed = await repository().list(criteriaOf(filterOf(ledger)))

      // Assert
      const expected = expectedOf(ledger)
      expect(idsOf(listed)).toEqual(expected)
      expect(listed).toMatchObject({
        type: 'success',
        data: { total: expected.length, hasMore: false },
      })
    },
  )

  it('should list a page at a time, the next one after the sale of the cursor', async () => {
    // Arrange
    const ledger = await storedLedger()

    // Act
    const page = await repository().list(criteriaOf({ limit: 2 }))
    const next = await repository().list(
      criteriaOf({ limit: 2, after: saleIdSchema.parse(ledger.billed) }),
    )

    // Assert
    expect(idsOf(page)).toEqual([ledger.latest, ledger.billed])
    expect(page).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: true },
    })
    expect(idsOf(next)).toEqual([ledger.earliest])
    expect(next).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: false },
    })
  })

  it('should list the sales of one moment by their IDs, the greater first, also across pages', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const [first, second, third] = (
      await Promise.all(
        [0, 1, 2].map(() =>
          insertSale(db, { salonId: parties.salonId, customerId: null }),
        ),
      )
    ).toSorted((a, b) => b.id.localeCompare(a.id))

    // Act
    const all = await repository().list(criteriaOf())
    const page = await repository().list(criteriaOf({ limit: 1 }))
    const next = await repository().list(
      criteriaOf({ limit: 1, after: saleIdSchema.parse(first?.id) }),
    )

    // Assert
    expect(idsOf(all)).toEqual([first?.id, second?.id, third?.id])
    expect(idsOf(page)).toEqual([first?.id])
    expect(idsOf(next)).toEqual([second?.id])
  })

  it.each<[string, (ledger: Ledger) => string]>([
    ['a sale the reader does not reach', ({ earliest }) => earliest],
    ['an ID that names no sale', () => UNKNOWN_ID],
  ])('should find no page after %s', async (_case, cursorOf) => {
    // Arrange
    const ledger = await storedLedger()

    // Act
    const listed = await repository().list(
      criteriaOf({
        reach: ofSalon(ledger.salonId),
        after: saleIdSchema.parse(cursorOf(ledger)),
      }),
    )

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('SaleRepository.findCalculationReferences', () => {
  it('should read the salon, the lines of the booking in their order, the services added and the payment methods in their order', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    await insertBookingLine(db, parties.bookingId, parties.serviceId, {
      sortOrder: 1,
    })
    const another = await insertBooking(db, {
      salonId: parties.salonId,
      customerId: parties.customerId,
      staffId: parties.staffId,
    })
    await insertBookingLine(db, another.id, parties.serviceId, {
      price: 1100,
      finalPrice: 1100,
    })
    await insertBookingLine(db, parties.bookingId, parties.serviceId, {
      price: 3300,
      discountAmount: 300,
      finalPrice: 3000,
      taxIncluded: false,
      sortOrder: 0,
    })
    const added = await insertService(db, parties.salonId, {
      price: 2200,
      discountPrice: 2000,
      taxIncluded: false,
    })
    const deleted = await insertService(db, parties.salonId, {
      deletedAt: DELETED_AT,
    })
    const elsewhere = await insertSalon(db)
    const foreign = await insertService(db, elsewhere.id)
    await insertPaymentMethod(db, elsewhere.id)
    await insertPaymentMethod(db, parties.salonId, {
      method: 'credit_card',
      displayName: 'クレジットカード',
      minimumAmount: 100,
      maximumAmount: 100000,
      sortOrder: 2,
    })
    const both = [
      await insertPaymentMethod(db, parties.salonId, {
        method: 'e_money',
        displayName: '電子マネー',
        sortOrder: 1,
      }),
      await insertPaymentMethod(db, parties.salonId, {
        method: 'qr_payment',
        displayName: 'QR コード決済',
        sortOrder: 1,
      }),
    ].toSorted((a, b) => a.id.localeCompare(b.id))
    await insertPaymentMethod(db, parties.salonId, {
      isActive: false,
      sortOrder: 0,
    })

    // Act
    const read = await repository().findCalculationReferences({
      salonId: parties.salonId,
      bookingId: parties.bookingId,
      services: [added.id, added.id, deleted.id, foreign.id].map((id) =>
        serviceIdSchema.parse(id),
      ),
    })

    // Assert
    expect(read).toEqual({
      type: 'success',
      data: {
        salon: { taxRate: '10.00' },
        booking: {
          lines: [
            {
              price: 3300,
              discountAmount: 300,
              finalPrice: 3000,
              taxIncluded: false,
            },
            {
              price: 6600,
              discountAmount: 0,
              finalPrice: 6600,
              taxIncluded: true,
            },
          ],
        },
        services: [
          {
            id: added.id,
            price: 2200,
            discountPrice: 2000,
            taxIncluded: false,
          },
        ],
        paymentMethods: [
          {
            method: 'cash',
            isActive: false,
            minimumAmount: null,
            maximumAmount: null,
          },
          ...both.map(({ method }) => ({
            method,
            isActive: true,
            minimumAmount: null,
            maximumAmount: null,
          })),
          {
            method: 'credit_card',
            isActive: true,
            minimumAmount: 100,
            maximumAmount: 100000,
          },
        ],
      },
    })
  })

  it.each<[string, () => Promise<string | null>]>([
    [
      'a booking of another salon',
      async () => (await storedParties()).bookingId,
    ],
    ['no booking', async () => null],
  ])(
    'should read no booking for %s, and no services when the request names none',
    async (_case, bookingOf) => {
      // Arrange
      const parties = await storedParties()
      const booking = await bookingOf()

      // Act
      const read = await repository().findCalculationReferences({
        salonId: parties.salonId,
        bookingId: booking === null ? null : bookingIdSchema.parse(booking),
        services: [],
      })

      // Assert
      expect(read).toEqual({
        type: 'success',
        data: {
          salon: { taxRate: '10.00' },
          booking: null,
          services: [],
          paymentMethods: [],
        },
      })
    },
  )

  it('should read nothing of a salon that is deleted', async () => {
    // Arrange
    const db = databases.database()
    const salon = await insertSalon(db, { deletedAt: DELETED_AT })
    const service = await insertService(db, salon.id)

    // Act
    const read = await repository().findCalculationReferences({
      salonId: salonIdSchema.parse(salon.id),
      bookingId: null,
      services: [serviceIdSchema.parse(service.id)],
    })

    // Assert
    expect(read).toEqual({
      type: 'success',
      data: { salon: null, booking: null, services: [], paymentMethods: [] },
    })
  })
})

describe('SaleRepository when the database is gone', () => {
  const id = saleIdSchema.parse(UNKNOWN_ID)
  const salonId = salonIdSchema.parse(UNKNOWN_ID)
  const request: RequestedSale = {
    salonId,
    customerId: null,
    staffId: null,
    bookingId: null,
    saleTime: '2026-12-06T16:00:00.000Z',
    pointsUsed: null,
    pointsEarned: null,
    notes: null,
    details: [lineOf()],
  }

  it.each<[string, (gone: SaleRepository) => Promise<unknown>]>([
    ['Failed to create sale', (gone) => gone.create(request, originOf())],
    ['Failed to find sale', (gone) => gone.findById(id, EVERY_SALON)],
    [
      'Failed to update sale',
      (gone) => gone.update(id, EVERY_SALON, { notes: null }),
    ],
    [
      'Failed to void sale',
      (gone) => gone.voidSale(id, EVERY_SALON, { voidReason: null }),
    ],
    [
      'Failed to list sales',
      (gone) =>
        gone.list({
          reach: EVERY_SALON,
          limit: 20,
          after: null,
          salonId: null,
          customerId: null,
          bookingId: null,
          paymentStatus: null,
          startDate: null,
          endDate: null,
        }),
    ],
    [
      'Failed to read what a calculation refers to',
      (gone) =>
        gone.findCalculationReferences({
          salonId,
          bookingId: null,
          services: [],
        }),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new SaleRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
