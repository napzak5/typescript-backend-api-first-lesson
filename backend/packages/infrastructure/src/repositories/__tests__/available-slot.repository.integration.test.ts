import { type bookings, staff } from '@beauty-salon-backend/database'
import {
  type OccupancyQuery,
  type SlotDay,
  type SlotDayQuery,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import type { Result } from '@beauty-salon-backend/utility'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { AvailableSlotRepository } from '../available-slot.repository.impl'
import {
  CANCELLED,
  insertBooking,
  insertBookingLine,
  insertCustomer,
  insertOpeningHours,
  insertSalon,
  insertSchedule,
  insertService,
  insertStaffMember,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new AvailableSlotRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** Monday 7 December 2026, the day of the slots of the tests. */
const DATE = '2026-12-07'

/** A salon with a service, and a customer to book them. */
const storedSalon = async () => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const service = await insertService(db, salon.id)
  const customer = await insertCustomer(db)

  return { salonId: salon.id, serviceId: service.id, customerId: customer.id }
}

type Salon = Awaited<ReturnType<typeof storedSalon>>

/**
 * A booking of the customer of the salon whose one line is the staff
 * member's, of the service unless the test says otherwise, from the start
 * to the end (UTC); pending unless the test says otherwise.
 */
const lineOf = async (
  { salonId, serviceId, customerId }: Salon,
  staffId: string,
  { startTime, endTime, duration }: Times,
  overrides: Partial<typeof bookings.$inferInsert> = {},
  ofService: string = serviceId,
) => {
  const db = databases.database()
  const booking = await insertBooking(
    db,
    { salonId, customerId, staffId },
    {
      bookingDate: startTime.slice(0, 10),
      startTime,
      endTime,
      duration,
      ...overrides,
    },
  )
  await insertBookingLine(db, booking.id, ofService, {
    staffId,
    startTime,
    endTime,
    duration,
  })

  return booking
}

/** The time of a line, as the table writes it, and its minutes. */
type Times = { startTime: string; endTime: string; duration: number }

const halfAnHourFrom = (startTime: string, endTime: string): Times => ({
  startTime,
  endTime,
  duration: 30,
})

const dayOf = (
  { salonId, serviceId }: Salon,
  staffId: string | null = null,
): SlotDayQuery => ({
  salonId: salonIdSchema.parse(salonId),
  serviceId: serviceIdSchema.parse(serviceId),
  staffId: staffId === null ? null : staffIdSchema.parse(staffId),
  date: DATE,
})

/** What the day says, or nothing when it was not read. */
const readOf = (read: Result<SlotDay | null, unknown>): SlotDay | null =>
  read.type === 'success' ? read.data : null

const inOrder = (times: readonly Date[]): Date[] =>
  times.toSorted((a, b) => a.getTime() - b.getTime())

describe('AvailableSlotRepository.findDay', () => {
  it('should read the salon, the row of its calendar for the date, and the service', async () => {
    // Arrange
    const salon = await storedSalon()
    const db = databases.database()
    await insertOpeningHours(db, salon.salonId)
    await insertOpeningHours(db, salon.salonId, {
      date: '2026-12-08',
      dayOfWeek: 'tuesday',
      openTime: '12:00:00',
    })

    // Act
    const read = await repository().findDay(dayOf(salon))

    // Assert
    expect(read).toEqual({
      type: 'success',
      data: {
        salon: {
          id: salon.salonId,
          isActive: true,
          timezone: 'Asia/Tokyo',
          businessHours: null,
        },
        calendarDay: { openTime: '10:00:00', closeTime: '19:00:00' },
        service: {
          duration: 60,
          isActive: true,
          serviceStatus: 'active',
          allowOnlineBooking: true,
          availability: 'always',
          bookingRequirements: [],
          maxBookingsPerDay: null,
          requiredStaffLevel: null,
        },
        serviceLineStarts: [],
        staff: [],
      },
    })
  })

  it('should read no row of the calendar of another date', async () => {
    // Arrange
    const salon = await storedSalon()
    await insertOpeningHours(databases.database(), salon.salonId, {
      date: '2026-12-08',
      dayOfWeek: 'tuesday',
    })

    // Act
    const read = await repository().findDay(dayOf(salon))

    // Assert
    expect(readOf(read)).toMatchObject({ calendarDay: null })
  })

  it.each<[string, (salon: Salon) => Promise<SlotDayQuery>]>([
    [
      'a salon that is deleted',
      async (salon) => {
        const deleted = await insertSalon(databases.database(), {
          deletedAt: DELETED_AT,
        })
        return {
          ...dayOf(salon),
          salonId: salonIdSchema.parse(deleted.id),
        }
      },
    ],
    [
      'an ID that names no salon',
      async (salon) => ({
        ...dayOf(salon),
        salonId: salonIdSchema.parse(UNKNOWN_ID),
      }),
    ],
  ])('should read no day of %s', async (_, queryOf) => {
    // Arrange
    const query = await queryOf(await storedSalon())

    // Act
    const read = await repository().findDay(query)

    // Assert
    expect(read).toEqual({ type: 'success', data: null })
  })

  it.each<[string, (salon: Salon) => Promise<string>]>([
    [
      'a service that is deleted',
      async ({ salonId }) =>
        (
          await insertService(databases.database(), salonId, {
            deletedAt: DELETED_AT,
          })
        ).id,
    ],
    ['a service of another salon', async () => (await storedSalon()).serviceId],
  ])(
    'should read no service, and no line of it, of %s',
    async (_, serviceOf) => {
      // Arrange
      const salon = await storedSalon()
      const serviceId = await serviceOf(salon)
      const member = await insertStaffMember(
        databases.database(),
        salon.salonId,
      )
      await lineOf(
        salon,
        member.id,
        {
          startTime: '2026-12-07T01:00:00Z',
          endTime: '2026-12-07T02:00:00Z',
          duration: 60,
        },
        {},
        serviceId,
      )

      // Act
      const read = await repository().findDay(dayOf({ ...salon, serviceId }))

      // Assert
      expect(readOf(read)).toMatchObject({
        service: null,
        serviceLineStarts: [],
      })
    },
  )

  it('should read the staff members of the salon who are not deleted, in the order of their IDs', async () => {
    // Arrange
    const salon = await storedSalon()
    const db = databases.database()
    const members = [
      await insertStaffMember(db, salon.salonId),
      await insertStaffMember(db, salon.salonId, {
        bufferTimeBefore: 10,
        bufferTimeAfter: 15,
        maxConcurrentBookings: 2,
        canReceiveBookings: false,
        level: 'senior',
      }),
    ].toSorted((a, b) => a.id.localeCompare(b.id))
    for (const [index, member] of members.entries()) {
      // Their names are in the other order.
      await db
        .update(staff)
        .set({ displayName: `佐藤 ${members.length - index}` })
        .where(eq(staff.id, member.id))
    }
    await insertStaffMember(db, salon.salonId, { deletedAt: DELETED_AT })
    await insertStaffMember(db, (await storedSalon()).salonId)

    // Act
    const read = await repository().findDay(dayOf(salon))

    // Assert
    expect(readOf(read)?.staff).toEqual(
      members.map((member) => ({
        id: member.id,
        level: member.level,
        isActive: member.isActive,
        canReceiveBookings: member.canReceiveBookings,
        bufferTimeBefore: member.bufferTimeBefore,
        bufferTimeAfter: member.bufferTimeAfter,
        maxConcurrentBookings: member.maxConcurrentBookings,
        schedules: [],
        taken: [],
      })),
    )
  })

  it('should read the staff member who was asked for alone', async () => {
    // Arrange
    const salon = await storedSalon()
    const db = databases.database()
    const asked = await insertStaffMember(db, salon.salonId)
    await insertStaffMember(db, salon.salonId)

    // Act
    const read = await repository().findDay(dayOf(salon, asked.id))

    // Assert
    expect(readOf(read)?.staff.map(({ id }) => id)).toEqual([asked.id])
  })

  it('should read the rows of the schedules for the date and the weekly ones, each with its staff member', async () => {
    // Arrange
    const salon = await storedSalon()
    const db = databases.database()
    const first = await insertStaffMember(db, salon.salonId)
    const second = await insertStaffMember(db, salon.salonId)
    const weekly = await insertSchedule(db, first.id)
    const ofTheDate = await insertSchedule(db, first.id, {
      isRecurring: false,
      dayOfWeek: null,
      date: DATE,
      startTime: '12:00:00',
    })
    await insertSchedule(db, first.id, {
      isRecurring: false,
      dayOfWeek: null,
      date: '2026-12-14',
    })
    const ofTuesdays = await insertSchedule(db, second.id, {
      dayOfWeek: 'tuesday',
    })

    // Act
    const read = await repository().findDay(dayOf(salon))

    // Assert
    const schedulesOf = (id: string) =>
      readOf(read)
        ?.staff.find((member) => member.id === id)
        ?.schedules.map((schedule) => schedule.id)
        .toSorted()
    expect(schedulesOf(first.id)).toEqual([weekly.id, ofTheDate.id].toSorted())
    expect(schedulesOf(second.id)).toEqual([ofTuesdays.id])
  })

  it('should read the lines of other bookings that a staff member has around the date, but those of cancelled ones, each with its staff member', async () => {
    // Arrange
    const salon = await storedSalon()
    const db = databases.database()
    const first = await insertStaffMember(db, salon.salonId)
    const second = await insertStaffMember(db, salon.salonId)
    const morning = await lineOf(
      salon,
      first.id,
      halfAnHourFrom('2026-12-07T01:00:00Z', '2026-12-07T01:30:00Z'),
    )
    const evening = await lineOf(
      salon,
      second.id,
      halfAnHourFrom('2026-12-07T09:00:00Z', '2026-12-07T09:30:00Z'),
    )
    await lineOf(
      salon,
      first.id,
      halfAnHourFrom('2026-12-07T03:00:00Z', '2026-12-07T03:30:00Z'),
      CANCELLED,
    )
    await lineOf(
      salon,
      first.id,
      halfAnHourFrom('2026-12-09T01:00:00Z', '2026-12-09T01:30:00Z'),
    )

    // Act
    const read = await repository().findDay(dayOf(salon))

    // Assert
    const takenOf = (id: string) =>
      readOf(read)?.staff.find((member) => member.id === id)?.taken
    expect(takenOf(first.id)).toEqual([
      {
        bookingId: morning.id,
        startTime: new Date('2026-12-07T01:00:00Z'),
        endTime: new Date('2026-12-07T01:30:00Z'),
      },
    ])
    expect(takenOf(second.id)).toEqual([
      {
        bookingId: evening.id,
        startTime: new Date('2026-12-07T09:00:00Z'),
        endTime: new Date('2026-12-07T09:30:00Z'),
      },
    ])
  })

  it('should read the lines of the day as wide as it is in any time zone, and wider by the most time a staff member keeps free around a booking', async () => {
    // Arrange
    const salon = await storedSalon()
    const db = databases.database()
    const member = await insertStaffMember(db, salon.salonId)
    await insertStaffMember(db, salon.salonId, {
      bufferTimeBefore: 30,
      bufferTimeAfter: 30,
    })
    // The day is from ten on the 6th to twelve on the 8th (UTC) in some
    // time zone, and an hour wider for the staff member who keeps it free.
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-06T08:30:00Z', '2026-12-06T09:00:00Z'),
    )
    const early = await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-06T09:00:00Z', '2026-12-06T09:30:00Z'),
    )
    const late = await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-08T12:30:00Z', '2026-12-08T13:00:00Z'),
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-08T13:00:00Z', '2026-12-08T13:30:00Z'),
    )

    // Act
    const read = await repository().findDay(dayOf(salon))

    // Assert
    expect(
      readOf(read)
        ?.staff.find(({ id }) => id === member.id)
        ?.taken.map(({ bookingId }) => bookingId)
        .toSorted(),
    ).toEqual([early.id, late.id].toSorted())
  })

  it('should read when the lines of the service begin within the day in any time zone, but those of cancelled bookings and of other services', async () => {
    // Arrange
    const salon = await storedSalon()
    const db = databases.database()
    const member = await insertStaffMember(db, salon.salonId)
    const other = await insertService(db, salon.salonId)
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-06T09:30:00Z', '2026-12-06T10:00:00Z'),
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-06T10:00:00Z', '2026-12-06T10:30:00Z'),
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-08T11:30:00Z', '2026-12-08T12:00:00Z'),
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-08T12:00:00Z', '2026-12-08T12:30:00Z'),
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-07T01:00:00Z', '2026-12-07T01:30:00Z'),
      CANCELLED,
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-07T02:00:00Z', '2026-12-07T02:30:00Z'),
      {},
      other.id,
    )

    // Act
    const read = await repository().findDay(dayOf(salon))

    // Assert
    expect(inOrder(readOf(read)?.serviceLineStarts ?? [])).toEqual([
      new Date('2026-12-06T10:00:00Z'),
      new Date('2026-12-08T11:30:00Z'),
    ])
  })
})

describe('AvailableSlotRepository.findOccupancy', () => {
  /** A staff member who keeps a quarter of an hour free before and after a booking. */
  const storedMember = async ({ salonId }: Salon) =>
    insertStaffMember(databases.database(), salonId, {
      bufferTimeBefore: 15,
      bufferTimeAfter: 15,
      maxConcurrentBookings: 2,
    })

  const occupancyOf = (
    { salonId, serviceId }: Salon,
    staffId: string,
  ): OccupancyQuery => ({
    salonId: salonIdSchema.parse(salonId),
    serviceId: serviceIdSchema.parse(serviceId),
    staffId: staffIdSchema.parse(staffId),
    // Ten in Tokyo: the hour of the service and a quarter on either side are
    // kept, and a line of another booking keeps its own quarter as well.
    startTime: new Date('2026-12-07T01:00:00Z'),
  })

  it('should read the service, the staff member and the lines of other bookings that meet the time either of them keeps free', async () => {
    // Arrange
    const salon = await storedSalon()
    const member = await storedMember(salon)
    await lineOf(salon, member.id, {
      startTime: '2026-12-07T00:10:00Z',
      endTime: '2026-12-07T00:30:00Z',
      duration: 20,
    })
    const before = await lineOf(salon, member.id, {
      startTime: '2026-12-07T00:15:00Z',
      endTime: '2026-12-07T00:35:00Z',
      duration: 20,
    })
    const after = await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-07T02:20:00Z', '2026-12-07T02:50:00Z'),
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-07T02:30:00Z', '2026-12-07T03:00:00Z'),
    )
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-07T01:00:00Z', '2026-12-07T01:30:00Z'),
      CANCELLED,
    )
    const other = await insertStaffMember(databases.database(), salon.salonId)
    await lineOf(
      salon,
      other.id,
      halfAnHourFrom('2026-12-07T01:00:00Z', '2026-12-07T01:30:00Z'),
    )

    // Act
    const read = await repository().findOccupancy(occupancyOf(salon, member.id))

    // Assert
    expect(read).toMatchObject({
      type: 'success',
      data: {
        service: { duration: 60 },
        staff: {
          bufferTimeBefore: 15,
          bufferTimeAfter: 15,
          maxConcurrentBookings: 2,
        },
      },
    })
    const taken = read.type === 'success' ? read.data.taken : []
    expect(
      taken.toSorted((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    ).toEqual([
      {
        bookingId: before.id,
        startTime: new Date('2026-12-07T00:15:00Z'),
        endTime: new Date('2026-12-07T00:35:00Z'),
      },
      {
        bookingId: after.id,
        startTime: new Date('2026-12-07T02:20:00Z'),
        endTime: new Date('2026-12-07T02:50:00Z'),
      },
    ])
  })

  it.each<[string, (salon: Salon) => Promise<string>]>([
    [
      'a service that is deleted',
      async ({ salonId }) =>
        (
          await insertService(databases.database(), salonId, {
            deletedAt: DELETED_AT,
          })
        ).id,
    ],
    ['a service of another salon', async () => (await storedSalon()).serviceId],
  ])('should read no line for %s', async (_, serviceOf) => {
    // Arrange
    const salon = await storedSalon()
    const member = await storedMember(salon)
    await lineOf(
      salon,
      member.id,
      halfAnHourFrom('2026-12-07T01:00:00Z', '2026-12-07T01:30:00Z'),
    )
    const serviceId = await serviceOf(salon)

    // Act
    const read = await repository().findOccupancy(
      occupancyOf({ ...salon, serviceId }, member.id),
    )

    // Assert
    expect(read).toMatchObject({
      type: 'success',
      data: { service: null, staff: { bufferTimeBefore: 15 }, taken: [] },
    })
  })

  it.each<[string, (salon: Salon) => Promise<string>]>([
    [
      'who is deleted',
      async ({ salonId }) =>
        (
          await insertStaffMember(databases.database(), salonId, {
            deletedAt: DELETED_AT,
          })
        ).id,
    ],
    [
      'of another salon',
      async () =>
        (
          await insertStaffMember(
            databases.database(),
            (
              await storedSalon()
            ).salonId,
          )
        ).id,
    ],
  ])('should read no line for a staff member %s', async (_, memberOf) => {
    // Arrange
    const salon = await storedSalon()
    const memberId = await memberOf(salon)
    await lineOf(
      salon,
      memberId,
      halfAnHourFrom('2026-12-07T01:00:00Z', '2026-12-07T01:30:00Z'),
    )

    // Act
    const read = await repository().findOccupancy(occupancyOf(salon, memberId))

    // Assert
    expect(read).toEqual({
      type: 'success',
      data: { service: { duration: 60 }, staff: null, taken: [] },
    })
  })
})

describe('AvailableSlotRepository when the database is gone', () => {
  const salon: Salon = {
    salonId: UNKNOWN_ID,
    serviceId: UNKNOWN_ID,
    customerId: UNKNOWN_ID,
  }

  it.each<[string, (gone: AvailableSlotRepository) => Promise<unknown>]>([
    [
      'Failed to read the day of the available slots',
      (gone) => gone.findDay(dayOf(salon)),
    ],
    [
      'Failed to read the occupancy of a staff member',
      (gone) =>
        gone.findOccupancy({
          salonId: salonIdSchema.parse(UNKNOWN_ID),
          serviceId: serviceIdSchema.parse(UNKNOWN_ID),
          staffId: staffIdSchema.parse(UNKNOWN_ID),
          startTime: new Date('2026-12-07T01:00:00Z'),
        }),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new AvailableSlotRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
