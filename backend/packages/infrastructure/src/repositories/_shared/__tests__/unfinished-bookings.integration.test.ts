import { bookingServices, bookings } from '@beauty-salon-backend/database'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../../__tests__/_shared/database'
import {
  CANCELLED,
  COMPLETED,
  insertBooking,
  insertBookingLine,
  insertCustomer,
  insertSalon,
  insertService,
  insertStaffMember,
} from '../../__tests__/_shared/rows'
import {
  customersOfUnfinishedBookings,
  hasLineOfUnfinishedBooking,
  hasUnfinishedBooking,
} from '../unfinished-bookings'

const databases = useTestDatabase()

/** The columns of a booking of each status. */
const STATUSES: [string, Parameters<typeof insertBooking>[2]][] = [
  ['draft', { status: 'draft' }],
  ['pending', { status: 'pending' }],
  ['confirmed', { status: 'confirmed' }],
  [
    'in_progress',
    { status: 'in_progress', actualStartTime: '2026-12-07T01:05:00Z' },
  ],
  ['completed', COMPLETED],
  ['cancelled', CANCELLED],
  ['no_show', { status: 'no_show' }],
]

const UNFINISHED = new Set(['draft', 'pending', 'confirmed', 'in_progress'])

/** A salon with a customer, a member of the staff and a service. */
const aSalon = async () => {
  const db = databases.database()
  const salon = await insertSalon(db)
  return {
    db,
    parties: {
      salonId: salon.id,
      customerId: (await insertCustomer(db)).id,
      staffId: (await insertStaffMember(db, salon.id)).id,
    },
    serviceId: (await insertService(db, salon.id)).id,
  }
}

describe('hasUnfinishedBooking', () => {
  it.each(STATUSES)(
    'should tell whether a booking that is %s is not finished',
    async (status, columns) => {
      // Arrange
      const { db, parties } = await aSalon()
      await insertBooking(db, parties, columns)

      // Act
      const found = await hasUnfinishedBooking(
        db,
        eq(bookings.salonId, parties.salonId),
      )

      // Assert
      expect(found).toBe(UNFINISHED.has(status))
    },
  )

  it('should look at the bookings the condition picks alone', async () => {
    // Arrange
    const { db, parties } = await aSalon()
    const other = await aSalon()
    await insertBooking(db, parties, COMPLETED)
    await insertBooking(other.db, other.parties, { status: 'confirmed' })

    // Act
    const found = await hasUnfinishedBooking(
      db,
      eq(bookings.salonId, parties.salonId),
    )

    // Assert
    expect(found).toBe(false)
  })
})

describe('customersOfUnfinishedBookings', () => {
  it('should name each of the customers a booking which is not finished is of, once', async () => {
    // Arrange
    const { db, parties } = await aSalon()
    const finishedOnly = (await insertCustomer(db)).id
    const withoutBookings = (await insertCustomer(db)).id
    await insertBooking(db, parties, { status: 'pending' })
    await insertBooking(db, parties, { status: 'confirmed' })
    await insertBooking(db, { ...parties, customerId: finishedOnly }, CANCELLED)

    // Act
    const referred = await customersOfUnfinishedBookings(db, [
      parties.customerId,
      finishedOnly,
      withoutBookings,
    ])

    // Assert
    expect(referred).toEqual([parties.customerId])
  })

  it('should name nobody among no customers', async () => {
    // Arrange
    const { db, parties } = await aSalon()
    await insertBooking(db, parties, { status: 'pending' })

    // Act
    const referred = await customersOfUnfinishedBookings(db, [])

    // Assert
    expect(referred).toEqual([])
  })
})

describe('hasLineOfUnfinishedBooking', () => {
  it.each(STATUSES)(
    'should tell whether a line of a booking that is %s is of one that is not finished',
    async (status, columns) => {
      // Arrange
      const { db, parties, serviceId } = await aSalon()
      const booking = await insertBooking(db, parties, columns)
      await insertBookingLine(db, booking.id, serviceId)

      // Act
      const found = await hasLineOfUnfinishedBooking(
        db,
        eq(bookingServices.serviceId, serviceId),
      )

      // Assert
      expect(found).toBe(UNFINISHED.has(status))
    },
  )

  it('should look at the lines the condition picks alone', async () => {
    // Arrange
    const { db, parties, serviceId } = await aSalon()
    const otherService = (await insertService(db, parties.salonId)).id
    const booking = await insertBooking(db, parties, { status: 'confirmed' })
    await insertBookingLine(db, booking.id, otherService)

    // Act
    const found = await hasLineOfUnfinishedBooking(
      db,
      eq(bookingServices.serviceId, serviceId),
    )

    // Assert
    expect(found).toBe(false)
  })
})
