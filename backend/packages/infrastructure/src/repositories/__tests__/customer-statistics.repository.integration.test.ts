import {
  type CustomerId,
  type CustomerStatisticsPeriod,
  customerIdSchema,
  type SalonId,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { CustomerStatisticsRepository } from '../customer-statistics.repository.impl'
import {
  CANCELLED,
  COMPLETED,
  insertBooking,
  insertBookingLine,
  insertCustomer,
  insertPayment,
  insertPaymentMethod,
  insertSale,
  insertSalon,
  insertService,
  insertStaffMember,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new CustomerStatisticsRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** The period of December 2026 at the salon. */
const decemberAt = (salonId: SalonId): CustomerStatisticsPeriod => ({
  salonId,
  startDate: '2026-12-01',
  endDate: '2026-12-31',
})

/** The columns of a booking of the day, from the hour given, an hour long. */
const onDay = (day: string, hour: string) => ({
  bookingDate: day,
  startTime: `${day}T${hour}:00:00Z`,
  endTime: `${day}T${String(Number(hour) + 1).padStart(2, '0')}:00:00Z`,
})

/** The figures of statistics that were found; a test that finds none fails here. */
const figuresOf = (
  found: Awaited<ReturnType<CustomerStatisticsRepository['findStatistics']>>,
) => {
  if (found.type !== 'success' || found.data.type !== 'found') {
    throw new Error('The statistics were not found')
  }
  return found.data.figures
}

/** The rows of a list in no order, sorted by the ID each names. */
const sortedBy = <Row>(
  rows: readonly Row[],
  idOf: (row: Row) => string,
): Row[] => rows.toSorted((a, b) => idOf(a).localeCompare(idOf(b)))

const ofService = ({ serviceId }: { serviceId: string }) => serviceId

const ofStaffMember = ({ staffId }: { staffId: string }) => staffId

/** A salon with a member of the staff, and a customer, as a repository is given them. */
const storedParties = async () => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const member = await insertStaffMember(db, salon.id, { displayName: '佐藤' })
  const customer = await insertCustomer(db, { loyaltyPoints: 250 })
  return {
    salonId: salonIdSchema.parse(salon.id),
    staffId: member.id,
    customerId: customerIdSchema.parse(customer.id),
    customerSince: customer.createdAt,
  }
}

describe('CustomerStatisticsRepository.findStatistics', () => {
  it('should count the bookings of the period at the salon, and what the customer spent there', async () => {
    // Arrange
    const db = databases.database()
    const { salonId, staffId, customerId, customerSince } =
      await storedParties()
    const parties = { salonId, customerId, staffId }
    const other = await insertStaffMember(db, salonId, { displayName: '鈴木' })
    const cut = await insertService(db, salonId, { name: 'カット' })
    const color = await insertService(db, salonId, { name: 'カラー' })
    const first = await insertBooking(db, parties, {
      ...COMPLETED,
      ...onDay('2026-12-03', '01'),
    })
    await insertBookingLine(db, first.id, cut.id)
    await insertBookingLine(db, first.id, color.id, { sortOrder: 1 })
    const last = await insertBooking(
      db,
      { ...parties, staffId: other.id },
      { ...COMPLETED, ...onDay('2026-12-20', '05') },
    )
    await insertBookingLine(db, last.id, cut.id)
    const cancelled = await insertBooking(db, parties, {
      ...CANCELLED,
      ...onDay('2026-12-10', '01'),
    })
    await insertBookingLine(db, cancelled.id, color.id)
    await insertBooking(db, parties, {
      status: 'no_show',
      ...onDay('2026-12-12', '01'),
    })
    await insertBooking(db, parties, onDay('2026-12-31', '01'))
    await insertBooking(db, parties, {
      ...COMPLETED,
      ...onDay('2026-11-30', '01'),
    })
    const elsewhere = await insertSalon(db)
    await insertBooking(
      db,
      {
        salonId: elsewhere.id,
        customerId,
        staffId: (await insertStaffMember(db, elsewhere.id)).id,
      },
      { ...COMPLETED, ...onDay('2026-12-05', '01') },
    )
    const method = await insertPaymentMethod(db, salonId)
    const ofBooking = await insertSale(
      db,
      { salonId, customerId },
      { bookingId: first.id, saleDate: '2026-12-03' },
    )
    await insertPayment(db, ofBooking.id, method.id, {
      status: 'partial_refund',
      refundAmount: 1000,
      refundedAt: '2026-12-04T01:00:00Z',
      amount: 4000,
    })
    await insertPayment(db, ofBooking.id, method.id, {
      status: 'refunded',
      refundAmount: 600,
      refundedAt: '2026-12-04T01:00:00Z',
      amount: 600,
    })
    await insertPayment(db, ofBooking.id, method.id, { amount: 2000 })
    await insertSale(
      db,
      { salonId, customerId },
      {
        saleDate: '2026-12-15',
        subtotal: 3000,
        taxAmount: 300,
        totalAmount: 3300,
      },
    )
    await insertSale(
      db,
      { salonId, customerId },
      {
        saleDate: '2026-12-16',
        isVoid: true,
        voidedAt: '2026-12-16T03:00:00Z',
      },
    )
    await insertSale(db, { salonId, customerId }, { saleDate: '2026-11-30' })
    await insertSale(
      db,
      { salonId: elsewhere.id, customerId },
      { saleDate: '2026-12-05' },
    )

    // Act
    const found = await repository().findStatistics(
      customerId,
      decemberAt(salonId),
    )

    // Assert
    const { services, staff, ...counts } = figuresOf(found)
    expect(counts).toEqual({
      bookings: 5,
      cancelled: 1,
      noShows: 1,
      spent: 6600 - 1600 + 3300,
      bookingSpent: 6600 - 1600,
      bookingSales: 1,
      lastVisit: '2026-12-20 05:00:00+00',
      loyaltyPoints: 250,
      customerSince,
    })
    expect(sortedBy(services, ofService)).toEqual(
      sortedBy(
        [
          { serviceId: cut.id, name: 'カット', bookingCount: 2 },
          { serviceId: color.id, name: 'カラー', bookingCount: 1 },
        ],
        ofService,
      ),
    )
    expect(sortedBy(staff, ofStaffMember)).toEqual(
      sortedBy(
        [
          { staffId, displayName: '佐藤', bookingCount: 1 },
          { staffId: other.id, displayName: '鈴木', bookingCount: 1 },
        ],
        ofStaffMember,
      ),
    )
  })

  it('should count nothing of a customer who has no booking and no sale in the period', async () => {
    // Arrange
    const { salonId, customerId, customerSince } = await storedParties()

    // Act
    const found = await repository().findStatistics(
      customerId,
      decemberAt(salonId),
    )

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: {
        type: 'found',
        figures: {
          bookings: 0,
          cancelled: 0,
          noShows: 0,
          spent: 0,
          bookingSpent: 0,
          bookingSales: 0,
          lastVisit: null,
          services: [],
          staff: [],
          loyaltyPoints: 250,
          customerSince,
        },
      },
    })
  })

  it.each<[string, () => Promise<SalonId>]>([
    [
      'that is deleted',
      async () =>
        salonIdSchema.parse(
          (await insertSalon(databases.database(), { deletedAt: DELETED_AT }))
            .id,
        ),
    ],
    ['of an ID that names none', async () => salonIdSchema.parse(UNKNOWN_ID)],
  ])('should find no salon %s', async (_, arrange) => {
    // Arrange
    const { customerId } = await storedParties()
    const salonId = await arrange()

    // Act
    const found = await repository().findStatistics(
      customerId,
      decemberAt(salonId),
    )

    // Assert
    expect(found).toEqual({ type: 'success', data: { type: 'salonNotFound' } })
  })

  it.each<[string, () => Promise<CustomerId>]>([
    [
      'who is deleted',
      async () =>
        customerIdSchema.parse(
          (
            await insertCustomer(databases.database(), {
              deletedAt: DELETED_AT,
            })
          ).id,
        ),
    ],
    [
      'of an ID that names none',
      async () => customerIdSchema.parse(UNKNOWN_ID),
    ],
  ])('should find no customer %s', async (_, arrange) => {
    // Arrange
    const { salonId } = await storedParties()
    const customerId = await arrange()

    // Act
    const found = await repository().findStatistics(
      customerId,
      decemberAt(salonId),
    )

    // Assert
    expect(found).toEqual({
      type: 'success',
      data: { type: 'customerNotFound' },
    })
  })

  it('should answer "Failed to read the statistics of a customer" with what the driver said', async () => {
    // Arrange
    const gone = new CustomerStatisticsRepository(await databases.gone())

    // Act
    const found = await gone.findStatistics(
      customerIdSchema.parse(UNKNOWN_ID),
      decemberAt(salonIdSchema.parse(UNKNOWN_ID)),
    )

    // Assert
    expect(found).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Failed to read the statistics of a customer',
        cause: expect.objectContaining({ code: 'CONNECTION_ENDED' }),
      },
    })
  })
})
