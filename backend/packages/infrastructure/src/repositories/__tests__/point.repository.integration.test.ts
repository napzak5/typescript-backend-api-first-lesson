import {
  bookings,
  customerPoints,
  customers,
  sales,
} from '@beauty-salon-backend/database'
import {
  type CustomerId,
  customerIdSchema,
  type LedgerReach,
  type PointListCriteria,
  type PointMovement,
  pointTransactionIdSchema,
  type RequestedPoints,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { PointRepository } from '../point.repository.impl'
import {
  insertBooking,
  insertCustomer,
  insertPoints,
  insertSale,
  insertSalon,
  insertStaffMember,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new PointRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const ofSalon = (salonId: string): LedgerReach => ({
  type: 'salon',
  salonId: salonIdSchema.parse(salonId),
})

/** A customer in the table with the balance the test gives, by the ID a repository is given. */
const storedCustomer = async (
  overrides: Partial<typeof customers.$inferInsert> = {},
): Promise<CustomerId> =>
  customerIdSchema.parse(
    (await insertCustomer(databases.database(), overrides)).id,
  )

/** What a movement asks of the balance of the customer, with no record it refers to unless the test says. */
const requestOf = (
  customerId: CustomerId,
  overrides: Partial<RequestedPoints> = {},
): RequestedPoints => ({
  customerId,
  points: 50,
  description: null,
  referenceType: null,
  referenceId: null,
  ...overrides,
})

const earningOf = (
  customerId: CustomerId,
  overrides: Partial<RequestedPoints> = {},
): PointMovement => ({
  type: 'earned',
  request: { ...requestOf(customerId, overrides), expiryDate: null },
})

const useOf = (
  customerId: CustomerId,
  overrides: Partial<RequestedPoints> = {},
): PointMovement => ({
  type: 'used',
  request: requestOf(customerId, overrides),
})

const balanceInTheTable = async (customerId: string) => {
  const [customer] = await databases
    .database()
    .select({ loyaltyPoints: customers.loyaltyPoints })
    .from(customers)
    .where(eq(customers.id, customerId))
  return customer?.loyaltyPoints
}

const transactionsInTheTable = (customerId: string) =>
  databases
    .database()
    .select()
    .from(customerPoints)
    .where(eq(customerPoints.customerId, customerId))
    .orderBy(asc(customerPoints.createdAt), asc(customerPoints.id))

/** A sale of the customer at a salon, and a booking of the customer there, pending. */
const storedRecords = async (customerId: CustomerId) => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const staff = await insertStaffMember(db, salon.id)
  const sale = await insertSale(db, { salonId: salon.id, customerId })
  const booking = await insertBooking(db, {
    salonId: salon.id,
    customerId,
    staffId: staff.id,
  })
  return {
    salonId: salon.id,
    staffId: staff.id,
    saleId: sale.id,
    bookingId: booking.id,
  }
}

describe('PointRepository.balanceOf', () => {
  it('should read the balance of the customer', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 320 })

    // Act
    const read = await repository().balanceOf(customerId)

    // Assert
    expect(read).toEqual({ type: 'success', data: 320 })
  })

  it('should read no balance of a customer who is deleted', async () => {
    // Arrange
    const customerId = await storedCustomer({
      loyaltyPoints: 320,
      deletedAt: DELETED_AT,
    })

    // Act
    const read = await repository().balanceOf(customerId)

    // Assert
    expect(read).toEqual({ type: 'success', data: null })
  })
})

describe('PointRepository.list', () => {
  const criteriaOf = (
    customerId: CustomerId,
    overrides: Partial<PointListCriteria> = {},
  ): PointListCriteria => ({
    customerId,
    limit: 20,
    after: null,
    startDate: null,
    endDate: null,
    ...overrides,
  })

  const idsOf = (listed: Awaited<ReturnType<PointRepository['list']>>) =>
    listed.type === 'success' && listed.data.type === 'listed'
      ? listed.data.transactions.map(({ id }) => id)
      : []

  /**
   * Three transactions of the customer, the latest first; the two latest
   * at one moment, the one of the greater ID first.
   */
  const storedHistory = async () => {
    const db = databases.database()
    const customerId = await storedCustomer({ loyaltyPoints: 130 })
    const earliest = await insertPoints(db, customerId, {
      createdAt: '2026-12-07T01:00:00Z',
    })
    const [latest, next] = (
      await Promise.all(
        [10, 20].map((points) =>
          insertPoints(db, customerId, {
            points,
            balance: 100 + points,
            createdAt: '2026-12-08T01:00:00Z',
          }),
        ),
      )
    ).toSorted((a, b) => b.id.localeCompare(a.id))
    await insertPoints(db, await storedCustomer())
    return {
      customerId,
      ids: [latest?.id, next?.id, earliest.id],
    }
  }

  it('should list the transactions of the customer, the latest first and those of one moment by their IDs', async () => {
    // Arrange
    const { customerId, ids } = await storedHistory()

    // Act
    const listed = await repository().list(criteriaOf(customerId))

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { type: 'listed', total: 3, hasMore: false },
    })
    expect(idsOf(listed)).toEqual(ids)
  })

  it('should list a page at a time, the next one after the transaction of the cursor, also one of the same moment', async () => {
    // Arrange
    const { customerId, ids } = await storedHistory()
    const [latest, next, earliest] = ids

    // Act
    const page = await repository().list(criteriaOf(customerId, { limit: 1 }))
    const after = await repository().list(
      criteriaOf(customerId, {
        limit: 1,
        after: pointTransactionIdSchema.parse(latest),
      }),
    )
    const last = await repository().list(
      criteriaOf(customerId, {
        limit: 1,
        after: pointTransactionIdSchema.parse(next),
      }),
    )

    // Assert
    expect(page).toMatchObject({
      type: 'success',
      data: { type: 'listed', total: 3, hasMore: true },
    })
    expect(idsOf(page)).toEqual([latest])
    expect(idsOf(after)).toEqual([next])
    expect(last).toMatchObject({
      type: 'success',
      data: { type: 'listed', total: 3, hasMore: false },
    })
    expect(idsOf(last)).toEqual([earliest])
  })

  it('should list the transactions of the period to the millisecond a response shows, its first and its last included', async () => {
    // Arrange
    const db = databases.database()
    const customerId = await storedCustomer({ loyaltyPoints: 130 })
    await insertPoints(db, customerId, {
      createdAt: '2026-12-07T01:00:00.122999Z',
    })
    const first = await insertPoints(db, customerId, {
      points: 10,
      balance: 110,
      createdAt: '2026-12-07T01:00:00.123456Z',
    })
    const last = await insertPoints(db, customerId, {
      points: 20,
      balance: 130,
      createdAt: '2026-12-07T01:00:00.124999Z',
    })
    await insertPoints(db, customerId, {
      points: 30,
      balance: 160,
      createdAt: '2026-12-07T01:00:00.125Z',
    })

    // Act
    const listed = await repository().list(
      criteriaOf(customerId, {
        startDate: '2026-12-07T01:00:00.123Z',
        endDate: '2026-12-07T01:00:00.124Z',
      }),
    )

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { type: 'listed', total: 2, hasMore: false },
    })
    expect(idsOf(listed)).toEqual([last.id, first.id])
  })

  it.each<[string, () => Promise<string>]>([
    [
      'a transaction of another customer',
      async () =>
        (await insertPoints(databases.database(), await storedCustomer())).id,
    ],
    ['an ID that names no transaction', async () => UNKNOWN_ID],
  ])('should find no page after %s', async (_case, cursorOf) => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 100 })
    await insertPoints(databases.database(), customerId)
    const after = pointTransactionIdSchema.parse(await cursorOf())

    // Act
    const listed = await repository().list(criteriaOf(customerId, { after }))

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'cursorNotFound' },
    })
  })

  it('should list no transactions of a customer who is deleted', async () => {
    // Arrange
    const customerId = await storedCustomer({
      loyaltyPoints: 100,
      deletedAt: DELETED_AT,
    })
    await insertPoints(databases.database(), customerId)

    // Act
    const listed = await repository().list(criteriaOf(customerId))

    // Assert
    expect(listed).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })
})

describe('PointRepository.record', () => {
  it('should write the transaction with the balance after it, at the moment it is written, and the balance of the customer', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 0 })
    const other = await storedCustomer({ loyaltyPoints: 30 })

    // Act
    const recorded = await repository().record(EVERY_SALON, {
      type: 'earned',
      request: {
        ...requestOf(customerId, { points: 120, description: '来店の特典' }),
        expiryDate: '2027-12-31',
      },
    })

    // Assert
    expect(recorded).toMatchObject({
      type: 'success',
      data: {
        type: 'recorded',
        transaction: {
          customerId,
          transactionType: 'earned',
          points: 120,
          balance: 120,
          description: '来店の特典',
          expiryDate: '2027-12-31',
        },
      },
    })
    expect(await balanceInTheTable(customerId)).toBe(120)
    expect(await balanceInTheTable(other)).toBe(30)
  })

  it.each<['sale' | 'booking']>([['sale'], ['booking']])(
    'should write the points used for a %s of the customer within the reach, on which points were earned',
    async (referenceType) => {
      // Arrange
      const db = databases.database()
      const customerId = await storedCustomer({ loyaltyPoints: 100 })
      const records = await storedRecords(customerId)
      const referenceId =
        referenceType === 'sale' ? records.saleId : records.bookingId
      await insertPoints(db, customerId, { referenceType, referenceId })
      await insertPoints(db, customerId, {
        transactionType: 'used',
        points: -10,
        balance: 90,
        referenceType,
        referenceId: UNKNOWN_ID,
      })

      // Act
      const recorded = await repository().record(
        ofSalon(records.salonId),
        useOf(customerId, { referenceType, referenceId }),
      )

      // Assert
      expect(recorded).toMatchObject({
        type: 'success',
        data: {
          type: 'recorded',
          transaction: {
            transactionType: 'used',
            points: -50,
            balance: 50,
            referenceType,
            referenceId,
          },
        },
      })
      expect(await balanceInTheTable(customerId)).toBe(50)
    },
  )

  it.each<
    [
      string,
      'sale' | 'booking',
      (records: Awaited<ReturnType<typeof storedRecords>>) => Promise<{
        referenceId: string
        reach: LedgerReach
      }>,
    ]
  >([
    [
      'a sale of another salon than the reach',
      'sale',
      async ({ saleId }) => ({
        referenceId: saleId,
        reach: ofSalon(UNKNOWN_ID),
      }),
    ],
    [
      'a booking of another salon than the reach',
      'booking',
      async ({ bookingId }) => ({
        referenceId: bookingId,
        reach: ofSalon(UNKNOWN_ID),
      }),
    ],
    [
      'a sale of another customer',
      'sale',
      async ({ salonId }) => ({
        referenceId: (
          await insertSale(databases.database(), {
            salonId,
            customerId: await storedCustomer(),
          })
        ).id,
        reach: EVERY_SALON,
      }),
    ],
    [
      'a booking of another customer',
      'booking',
      async ({ salonId, staffId }) => ({
        referenceId: (
          await insertBooking(databases.database(), {
            salonId,
            staffId,
            customerId: await storedCustomer(),
          })
        ).id,
        reach: EVERY_SALON,
      }),
    ],
    [
      'an ID that names no sale',
      'sale',
      async () => ({ referenceId: UNKNOWN_ID, reach: EVERY_SALON }),
    ],
  ])(
    'should write no points for %s',
    async (_case, referenceType, referenceOf) => {
      // Arrange
      const customerId = await storedCustomer({ loyaltyPoints: 100 })
      const { referenceId, reach } = await referenceOf(
        await storedRecords(customerId),
      )

      // Act
      const recorded = await repository().record(
        reach,
        earningOf(customerId, { referenceType, referenceId }),
      )

      // Assert
      expect(recorded).toMatchObject({
        type: 'success',
        data: { type: 'invalid', issues: [{ field: 'referenceId' }] },
      })
      expect(await transactionsInTheTable(customerId)).toEqual([])
    },
  )

  it.each<
    [
      'sale' | 'booking',
      (records: Awaited<ReturnType<typeof storedRecords>>) => Promise<string>,
    ]
  >([
    [
      'sale',
      async ({ saleId }) => {
        await databases
          .database()
          .update(sales)
          .set({ isVoid: true, voidedAt: DELETED_AT })
          .where(eq(sales.id, saleId))
        return saleId
      },
    ],
    [
      'booking',
      async ({ bookingId }) => {
        await databases
          .database()
          .update(bookings)
          .set({ status: 'no_show' })
          .where(eq(bookings.id, bookingId))
        return bookingId
      },
    ],
  ])(
    'should write no points for a %s that is closed',
    async (referenceType, closedOf) => {
      // Arrange
      const customerId = await storedCustomer({ loyaltyPoints: 100 })
      const referenceId = await closedOf(await storedRecords(customerId))

      // Act
      const recorded = await repository().record(
        EVERY_SALON,
        earningOf(customerId, { referenceType, referenceId }),
      )

      // Assert
      expect(recorded).toEqual({
        type: 'success',
        data: { type: 'referenceClosed', reference: referenceType },
      })
    },
  )

  it('should read the void of the sale another request committed while this one waited for it', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 100 })
    const { saleId } = await storedRecords(customerId)

    // Act
    const recorded = await databases.whileHeld(
      (held) => held`select id from sales where id = ${saleId} for update`,
      (held) =>
        held`update sales set "isVoid" = true, "voidedAt" = now() where id = ${saleId}`,
      () =>
        repository().record(
          EVERY_SALON,
          earningOf(customerId, { referenceType: 'sale', referenceId: saleId }),
        ),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'referenceClosed', reference: 'sale' },
    })
  })

  it('should read the cancellation of the booking another request committed while this one waited for it', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 100 })
    const { bookingId } = await storedRecords(customerId)

    // Act
    const recorded = await databases.whileHeld(
      (held) =>
        held`select id from bookings where id = ${bookingId} for update`,
      (held) =>
        held`update bookings set status = 'cancelled', "cancelledAt" = now() where id = ${bookingId}`,
      () =>
        repository().record(
          EVERY_SALON,
          earningOf(customerId, {
            referenceType: 'booking',
            referenceId: bookingId,
          }),
        ),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'referenceClosed', reference: 'booking' },
    })
  })

  it('should write no points twice for one sale', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 100 })
    const { saleId } = await storedRecords(customerId)
    await insertPoints(databases.database(), customerId, {
      referenceType: 'sale',
      referenceId: saleId,
    })

    // Act
    const recorded = await repository().record(
      EVERY_SALON,
      earningOf(customerId, { referenceType: 'sale', referenceId: saleId }),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'referenceTaken' },
    })
    expect(await balanceInTheTable(customerId)).toBe(100)
  })

  it('should answer that the sale was used for before it looks at the balance', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 0 })
    const { saleId } = await storedRecords(customerId)
    await insertPoints(databases.database(), customerId, {
      transactionType: 'used',
      points: -50,
      balance: 0,
      referenceType: 'sale',
      referenceId: saleId,
    })

    // Act
    const recorded = await repository().record(
      EVERY_SALON,
      useOf(customerId, { referenceType: 'sale', referenceId: saleId }),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'referenceTaken' },
    })
  })

  it('should write no points for a sale that a movement of another customer took while this one was written', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 100 })
    const other = await storedCustomer()
    const { saleId } = await storedRecords(customerId)

    // Act
    const recorded = await databases.whileHeld(
      (held) =>
        held`insert into customer_points ("customerId", "transactionType", points, balance, "referenceType", "referenceId") values (${other}, 'earned', 10, 10, 'sale', ${saleId})`,
      (held) => held`select 1`,
      () =>
        repository().record(
          EVERY_SALON,
          earningOf(customerId, { referenceType: 'sale', referenceId: saleId }),
        ),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'referenceTaken' },
    })
    expect(await balanceInTheTable(customerId)).toBe(100)
  })

  it('should read the balance another movement of the customer committed while this one waited for the customer', async () => {
    // Arrange
    const customerId = await storedCustomer({ loyaltyPoints: 100 })

    // Act
    const recorded = await databases.whileHeld(
      (held) =>
        held`select id from customers where id = ${customerId} for update`,
      async (held) => {
        await held`insert into customer_points ("customerId", "transactionType", points, balance) values (${customerId}, 'used', -100, 0)`
        await held`update customers set "loyaltyPoints" = 0 where id = ${customerId}`
      },
      () => repository().record(EVERY_SALON, useOf(customerId)),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'balanceShort' },
    })
  })

  it('should write no points of a customer who is deleted', async () => {
    // Arrange
    const customerId = await storedCustomer({ deletedAt: DELETED_AT })

    // Act
    const recorded = await repository().record(
      EVERY_SALON,
      earningOf(customerId),
    )

    // Assert
    expect(recorded).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
    expect(await transactionsInTheTable(customerId)).toEqual([])
  })
})

describe('PointRepository.transactionsOf', () => {
  it('should read the transactions of the customer, the earliest first and those of one moment by their IDs', async () => {
    // Arrange
    const db = databases.database()
    const customerId = await storedCustomer({ loyaltyPoints: 130 })
    const latest = '00000000-0000-4000-8000-000000000001'
    const first = '00000000-0000-4000-8000-000000000002'
    const second = '00000000-0000-4000-8000-000000000003'
    await insertPoints(db, customerId, {
      id: second,
      points: 10,
      balance: 30,
      createdAt: '2026-12-07T01:00:00Z',
    })
    await insertPoints(db, customerId, {
      id: first,
      points: 20,
      balance: 20,
      createdAt: '2026-12-07T01:00:00Z',
    })
    await insertPoints(db, customerId, {
      id: latest,
      balance: 130,
      createdAt: '2026-12-08T01:00:00Z',
    })
    await insertPoints(db, await storedCustomer())

    // Act
    const read = await repository().transactionsOf(customerId)

    // Assert
    expect(
      read.type === 'success' ? read.data?.map(({ id }) => id) : null,
    ).toEqual([first, second, latest])
  })

  it('should read no transactions of a customer who is deleted', async () => {
    // Arrange
    const customerId = await storedCustomer({
      loyaltyPoints: 100,
      deletedAt: DELETED_AT,
    })
    await insertPoints(databases.database(), customerId)

    // Act
    const read = await repository().transactionsOf(customerId)

    // Assert
    expect(read).toEqual({ type: 'success', data: null })
  })
})

describe('PointRepository.expire', () => {
  const PROCESS_BEFORE = '2026-12-07'

  /** A customer of 100 points, earned with the expiry date the test gives. */
  const customerWithPointsUntil = async (
    expiryDate: string,
    overrides: Partial<typeof customers.$inferInsert> = {},
  ) => {
    const customerId = await storedCustomer({
      loyaltyPoints: 100,
      ...overrides,
    })
    await insertPoints(databases.database(), customerId, { expiryDate })
    return customerId
  }

  it('should write the expiry of the points of the customer that lapsed, and the balance after it', async () => {
    // Arrange
    const customerId = await customerWithPointsUntil('2026-12-06')

    // Act
    const expired = await repository().expire(customerId, PROCESS_BEFORE)

    // Assert
    expect(expired).toEqual({
      type: 'success',
      data: { type: 'expired', processedCount: 1, totalPoints: 100 },
    })
    expect(await transactionsInTheTable(customerId)).toMatchObject([
      { transactionType: 'earned' },
      { transactionType: 'expired', points: -100, balance: 0 },
    ])
    expect(await balanceInTheTable(customerId)).toBe(0)
  })

  it('should write nothing for a customer whose points lapse on the day the expiry is before', async () => {
    // Arrange
    const customerId = await customerWithPointsUntil(PROCESS_BEFORE)

    // Act
    const expired = await repository().expire(customerId, PROCESS_BEFORE)

    // Assert
    expect(expired).toEqual({
      type: 'success',
      data: { type: 'expired', processedCount: 0, totalPoints: 0 },
    })
    expect(await transactionsInTheTable(customerId)).toHaveLength(1)
  })

  it('should expire nothing of a customer who is deleted', async () => {
    // Arrange
    const customerId = await customerWithPointsUntil('2026-12-06', {
      deletedAt: DELETED_AT,
    })

    // Act
    const expired = await repository().expire(customerId, PROCESS_BEFORE)

    // Assert
    expect(expired).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })

  it('should expire the points that lapsed of every customer who is not deleted and has points', async () => {
    // Arrange
    const db = databases.database()
    const first = await customerWithPointsUntil('2026-12-06')
    const second = await storedCustomer({ loyaltyPoints: 150 })
    await insertPoints(db, second, { expiryDate: '2026-11-30' })
    await insertPoints(db, second, { points: 50, balance: 150 })
    const later = await customerWithPointsUntil(PROCESS_BEFORE)
    await customerWithPointsUntil('2026-12-06', { deletedAt: DELETED_AT })
    const spent = await customerWithPointsUntil('2026-12-06', {
      loyaltyPoints: 0,
    })
    await insertPoints(db, spent, {
      transactionType: 'used',
      points: -100,
      balance: 0,
    })

    // Act
    const expired = await repository().expire(null, PROCESS_BEFORE)

    // Assert
    expect(expired).toEqual({
      type: 'success',
      data: { type: 'expired', processedCount: 2, totalPoints: 200 },
    })
    expect(await balanceInTheTable(first)).toBe(0)
    expect(await balanceInTheTable(second)).toBe(50)
    expect(await balanceInTheTable(later)).toBe(100)
    expect(await transactionsInTheTable(spent)).toHaveLength(2)
  })

  it('should pass over a customer who was deleted after the customers were read', async () => {
    // Arrange
    const kept = await customerWithPointsUntil('2026-12-06')
    const deleted = await customerWithPointsUntil('2026-12-06')

    // Act
    const expired = await databases.whileHeld(
      (held) => held`select id from customers where id = ${deleted} for update`,
      (held) =>
        held`update customers set "deletedAt" = now() where id = ${deleted}`,
      () => repository().expire(null, PROCESS_BEFORE),
    )

    // Assert
    expect(expired).toEqual({
      type: 'success',
      data: { type: 'expired', processedCount: 1, totalPoints: 100 },
    })
    expect(await balanceInTheTable(kept)).toBe(0)
    expect(await transactionsInTheTable(deleted)).toHaveLength(1)
  })
})

describe('PointRepository when the database is gone', () => {
  const customerId = customerIdSchema.parse(UNKNOWN_ID)

  it.each<[string, (gone: PointRepository) => Promise<unknown>]>([
    [
      'Failed to read the balance of points',
      (gone) => gone.balanceOf(customerId),
    ],
    [
      'Failed to list point transactions',
      (gone) =>
        gone.list({
          customerId,
          limit: 20,
          after: null,
          startDate: null,
          endDate: null,
        }),
    ],
    [
      'Failed to record points',
      (gone) => gone.record(EVERY_SALON, earningOf(customerId)),
    ],
    [
      'Failed to read point transactions',
      (gone) => gone.transactionsOf(customerId),
    ],
    ['Failed to expire points', (gone) => gone.expire(null, '2026-12-07')],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new PointRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
