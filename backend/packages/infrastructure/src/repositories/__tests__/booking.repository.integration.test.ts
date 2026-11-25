import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  salons,
  services,
  staff,
} from '@beauty-salon-backend/database'
import {
  type BookingAction,
  type BookingId,
  type BookingListCriteria,
  type BookingOrigin,
  type BookingReach,
  bookingIdSchema,
  bookingServiceIdSchema,
  type CustomerBooker,
  type CustomerId,
  type CustomerMover,
  type CustomerReach,
  customerIdSchema,
  type LedgerReach,
  type RequestedBooking,
  type RequestedBookingService,
  type RequestedCustomerBooking,
  type SalonId,
  type ServiceId,
  type StaffId,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { asc, eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../../__tests__/_shared/database'
import { BookingRepository } from '../booking.repository.impl'
import {
  CANCELLED,
  COMPLETED,
  insertBookableSlot,
  insertBooking,
  insertBookingLine,
  insertCustomer,
  insertReview,
  insertSale,
  insertSalon,
  insertSchedule,
  insertService,
  insertStaffMember,
  insertTreatmentRecord,
} from './_shared/rows'

const databases = useTestDatabase()

const repository = () => new BookingRepository(databases.database())

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const DELETED_AT = '2026-12-01T00:00:00.000Z'

/** Who enters and changes the bookings; the column names no table. */
const EDITOR = userIdSchema.parse('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a2c')

/** Ten, half past ten and eleven in the morning in Tokyo on Monday 7 December 2026, as a request writes them. */
const AT_TEN = '2026-12-07T01:00:00.000Z'
const AT_HALF_PAST_TEN = '2026-12-07T01:30:00.000Z'
const AT_ELEVEN = '2026-12-07T02:00:00.000Z'

/** A week later, a Monday with no row in the calendar of the salon. */
const A_WEEK_LATER = '2026-12-14T01:00:00.000Z'

/** The moment a customer books or moves a booking at: before the visits of the tests. */
const NOW = new Date('2026-12-01T00:00:00Z')

/** What a booking is made of: a salon, a staff member, a service and a customer. */
type Parties = {
  salonId: SalonId
  staffId: StaffId
  serviceId: ServiceId
  customerId: CustomerId
}

const storedParties = async (): Promise<Parties> => {
  const db = databases.database()
  const salon = await insertSalon(db)
  const member = await insertStaffMember(db, salon.id)
  const service = await insertService(db, salon.id)
  const customer = await insertCustomer(db)

  return {
    salonId: salonIdSchema.parse(salon.id),
    staffId: staffIdSchema.parse(member.id),
    serviceId: serviceIdSchema.parse(service.id),
    customerId: customerIdSchema.parse(customer.id),
  }
}

/** The parties of a slot a customer can book on Monday 7 December 2026, from ten to seven. */
const storedSlot = async (): Promise<Parties> => {
  const slot = await insertBookableSlot(databases.database())

  return {
    salonId: salonIdSchema.parse(slot.salonId),
    staffId: staffIdSchema.parse(slot.staffId),
    serviceId: serviceIdSchema.parse(slot.serviceId),
    customerId: customerIdSchema.parse(slot.customerId),
  }
}

/** Another staff member of the salon, who works every Monday from ten to seven. */
const otherMemberOf = async (salonId: string): Promise<StaffId> => {
  const member = await insertStaffMember(databases.database(), salonId)
  await insertSchedule(databases.database(), member.id)

  return staffIdSchema.parse(member.id)
}

/** A booking of the parties: one service at ten, by the staff member in charge, unless the test says otherwise. */
const requestOf = (
  { salonId, staffId, serviceId, customerId }: Parties,
  lines: RequestedBookingService[] = [
    { serviceId, staffId, startTime: AT_TEN, notes: null },
  ],
): RequestedBooking => ({
  salonId,
  customerId,
  staffId,
  depositAmount: null,
  customerRequest: '前髪は短めに',
  internalNotes: null,
  source: 'phone',
  services: lines,
})

/** The booking a customer asks for: the service of the parties with their staff member, at ten unless the test says otherwise. */
const customerRequestOf = (
  { salonId, serviceId, staffId }: Parties,
  startTime: string = AT_TEN,
): RequestedCustomerBooking => ({
  salonId,
  serviceId,
  staffId,
  startTime,
  customerRequest: null,
})

const bookerOf = ({ customerId }: Parties): CustomerBooker => ({
  customerId,
  now: NOW,
})

const MOVER: CustomerMover = { changedBy: EDITOR, now: NOW }

let issued = 0

const originOf = (bookingNumber?: string): BookingOrigin => {
  issued += 1
  return {
    bookingNumber:
      bookingNumber ?? `BK-REPO-${String(issued).padStart(4, '0')}`,
    createdBy: EDITOR,
    client: { ipAddress: '203.0.113.7', userAgent: 'Mozilla/5.0' },
  }
}

const EVERY_SALON: LedgerReach = { type: 'everySalon' }

const ofSalon = (salonId: string): LedgerReach => ({
  type: 'salon',
  salonId: salonIdSchema.parse(salonId),
})

const ofCustomer = (customerId: string): CustomerReach => ({
  type: 'customer',
  customerId: customerIdSchema.parse(customerId),
})

const idOf = (id: string): BookingId => bookingIdSchema.parse(id)

const historyOf = (id: string) =>
  databases
    .database()
    .select({
      fromStatus: bookingStatusHistories.fromStatus,
      toStatus: bookingStatusHistories.toStatus,
      changedBy: bookingStatusHistories.changedBy,
      reason: bookingStatusHistories.reason,
    })
    .from(bookingStatusHistories)
    .where(eq(bookingStatusHistories.bookingId, id))
    .orderBy(asc(bookingStatusHistories.createdAt))

const storedBookingOf = async (id: string) => {
  const [stored] = await databases
    .database()
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))

  return stored ?? null
}

const linesOf = (id: string) =>
  databases
    .database()
    .select()
    .from(bookingServices)
    .where(eq(bookingServices.bookingId, id))
    .orderBy(asc(bookingServices.sortOrder))

const countsOf = async (customerId: string) => {
  const [counts] = await databases
    .database()
    .select({
      visitCount: customers.visitCount,
      lastVisitDate: customers.lastVisitDate,
    })
    .from(customers)
    .where(eq(customers.id, customerId))

  return counts ?? null
}

const allBookingIds = async () =>
  (await databases.database().select({ id: bookings.id }).from(bookings)).map(
    ({ id }) => id,
  )

/** The booking a create or a booking of a customer wrote, or none. */
const createdIdOf = (
  created: Awaited<
    ReturnType<BookingRepository['create'] | BookingRepository['book']>
  >,
): string =>
  created.type === 'success' && created.data.type === 'created'
    ? created.data.booking.booking.id
    : UNKNOWN_ID

/** A booking of the parties at ten with one line, by the staff member in charge, pending unless the test says otherwise. */
const bookingWithLine = async (
  parties: Parties,
  overrides: Partial<typeof bookings.$inferInsert> = {},
) => {
  const db = databases.database()
  const booking = await insertBooking(db, parties, overrides)
  const line = await insertBookingLine(db, booking.id, parties.serviceId, {
    staffId: parties.staffId,
    startTime: booking.startTime,
    endTime: booking.endTime,
  })

  return { booking, line }
}

describe('BookingRepository.create', () => {
  it('should write the booking with its service lines in their order, and the first entry of its history', async () => {
    // Arrange
    const parties = await storedParties()
    const other = await insertService(databases.database(), parties.salonId)
    const otherId = serviceIdSchema.parse(other.id)

    // Act
    const created = await repository().create(
      requestOf(parties, [
        {
          serviceId: parties.serviceId,
          staffId: parties.staffId,
          startTime: AT_TEN,
          notes: null,
        },
        {
          serviceId: otherId,
          staffId: null,
          startTime: AT_ELEVEN,
          notes: 'シャンプー台で',
        },
      ]),
      originOf('BK-REPO-FIRST'),
    )

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        booking: {
          booking: {
            bookingNumber: 'BK-REPO-FIRST',
            salonId: parties.salonId,
            customerId: parties.customerId,
            staffId: parties.staffId,
            status: 'pending',
            customerRequest: '前髪は短めに',
          },
          services: [
            { serviceId: parties.serviceId, sortOrder: 0 },
            { serviceId: otherId, sortOrder: 1, notes: 'シャンプー台で' },
          ],
        },
      },
    })
    expect(await historyOf(createdIdOf(created))).toEqual([
      {
        fromStatus: null,
        toStatus: 'pending',
        changedBy: EDITOR,
        reason: null,
      },
    ])
  })

  it.each<[string, (parties: Parties) => Promise<RequestedBooking>, string[]]>([
    [
      'a salon that is deleted',
      async (parties) => {
        const salon = await insertSalon(databases.database(), {
          deletedAt: DELETED_AT,
        })
        return {
          ...requestOf(parties),
          salonId: salonIdSchema.parse(salon.id),
        }
      },
      ['salonId'],
    ],
    [
      'a customer who is deleted',
      async (parties) => {
        const customer = await insertCustomer(databases.database(), {
          deletedAt: DELETED_AT,
        })
        return {
          ...requestOf(parties),
          customerId: customerIdSchema.parse(customer.id),
        }
      },
      ['customerId'],
    ],
    [
      'a staff member who is deleted',
      async (parties) => {
        const member = await insertStaffMember(
          databases.database(),
          parties.salonId,
          { deletedAt: DELETED_AT },
        )
        return requestOf({
          ...parties,
          staffId: staffIdSchema.parse(member.id),
        })
      },
      ['staffId', 'services.0.staffId'],
    ],
    [
      'a staff member of another salon',
      async (parties) => {
        const elsewhere = await storedParties()
        return requestOf({ ...parties, staffId: elsewhere.staffId })
      },
      ['staffId', 'services.0.staffId'],
    ],
    [
      'a service that is deleted',
      async (parties) => {
        const service = await insertService(
          databases.database(),
          parties.salonId,
          { deletedAt: DELETED_AT },
        )
        return requestOf({
          ...parties,
          serviceId: serviceIdSchema.parse(service.id),
        })
      },
      ['services.0.serviceId'],
    ],
    [
      'a service of another salon',
      async (parties) => {
        const elsewhere = await storedParties()
        return requestOf({ ...parties, serviceId: elsewhere.serviceId })
      },
      ['services.0.serviceId'],
    ],
  ])('should write no booking that names %s', async (_, arrange, fields) => {
    // Arrange
    const parties = await storedParties()
    const request = await arrange(parties)

    // Act
    const created = await repository().create(request, originOf())

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: fields.map((field) => ({ field })) },
    })
    expect(await allBookingIds()).toEqual([])
  })

  it('should write no booking for a staff member who has another booking at the time', async () => {
    // Arrange
    const parties = await storedParties()
    await bookingWithLine(parties)

    // Act
    const created = await repository().create(requestOf(parties), originOf())

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'staffOccupied', staffIds: [parties.staffId] },
    })
  })

  it('should write a booking for a staff member while another staff member has a booking at the time', async () => {
    // Arrange
    const parties = await storedParties()
    const other = await otherMemberOf(parties.salonId)
    await bookingWithLine({ ...parties, staffId: other })

    // Act
    const created = await repository().create(requestOf(parties), originOf())

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created' },
    })
  })

  it('should write a booking for a staff member whose other booking at the time was cancelled', async () => {
    // Arrange
    const parties = await storedParties()
    await bookingWithLine(parties, CANCELLED)

    // Act
    const created = await repository().create(requestOf(parties), originOf())

    // Assert
    expect(created).toMatchObject({
      type: 'success',
      data: { type: 'created' },
    })
  })

  it('should write nothing when another booking has the number', async () => {
    // Arrange
    const parties = await storedParties()
    await insertBooking(databases.database(), parties, {
      bookingNumber: 'BK-REPO-TAKEN',
      bookingDate: '2026-12-08',
      startTime: '2026-12-08T01:00:00Z',
      endTime: '2026-12-08T02:00:00Z',
    })

    // Act
    const created = await repository().create(
      requestOf(parties),
      originOf('BK-REPO-TAKEN'),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'bookingNumberTaken' },
    })
    expect(
      await databases
        .database()
        .select({ id: bookingServices.id })
        .from(bookingServices),
    ).toEqual([])
  })

  it('should see the booking another request wrote for the staff member while this one waited for them', async () => {
    // Arrange
    const parties = await storedParties()

    // Act
    const created = await databases.whileHeld(
      (held) =>
        held`select id from staff where id = ${parties.staffId} for update`,
      async (held) => {
        await held`insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate", "startTime", "endTime", duration, subtotal, "totalAmount") values ('BK-REPO-HELD', ${parties.salonId}, ${parties.customerId}, ${parties.staffId}, '2026-12-07', '2026-12-07T01:00:00Z', '2026-12-07T02:00:00Z', 60, 6600, 6600)`
        await held`insert into booking_services ("bookingId", "serviceId", "staffId", "startTime", "endTime", duration, price, "finalPrice", "taxIncluded") values ((select id from bookings where "bookingNumber" = 'BK-REPO-HELD'), ${parties.serviceId}, ${parties.staffId}, '2026-12-07T01:00:00Z', '2026-12-07T02:00:00Z', 60, 6600, 6600, true)`
      },
      () => repository().create(requestOf(parties), originOf()),
    )

    // Assert
    expect(created).toEqual({
      type: 'success',
      data: { type: 'staffOccupied', staffIds: [parties.staffId] },
    })
  })
})

describe('BookingRepository.book', () => {
  it('should write the booking a customer makes of a slot, with its line and the first entry of its history', async () => {
    // Arrange
    const slot = await storedSlot()

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf('BK-REPO-ONLINE'),
    )

    // Assert
    expect(booked).toMatchObject({
      type: 'success',
      data: {
        type: 'created',
        booking: {
          booking: {
            bookingNumber: 'BK-REPO-ONLINE',
            salonId: slot.salonId,
            customerId: slot.customerId,
            staffId: slot.staffId,
            bookingDate: '2026-12-07',
            startTime: '2026-12-07 01:00:00+00',
            source: 'online',
          },
          services: [{ serviceId: slot.serviceId, staffId: slot.staffId }],
        },
      },
    })
    expect(await historyOf(createdIdOf(booked))).toHaveLength(1)
  })

  it('should book a staff member who works on the date of the slot alone', async () => {
    // Arrange
    const slot = await storedSlot()
    const member = await insertStaffMember(databases.database(), slot.salonId)
    await insertSchedule(databases.database(), member.id, {
      isRecurring: false,
      dayOfWeek: null,
      date: '2026-12-07',
    })

    // Act
    const booked = await repository().book(
      customerRequestOf({ ...slot, staffId: staffIdSchema.parse(member.id) }),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toMatchObject({
      type: 'success',
      data: { type: 'created' },
    })
  })

  it('should book no slot of a date on which the staff member does not work, though they do every week', async () => {
    // Arrange
    const slot = await storedSlot()
    await insertSchedule(databases.database(), slot.staffId, {
      isRecurring: false,
      dayOfWeek: null,
      date: '2026-12-07',
      isAvailable: false,
      startTime: null,
      endTime: null,
    })

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toEqual({ type: 'success', data: { type: 'notASlot' } })
  })

  it('should book no slot of a date for which the salon has no hours', async () => {
    // Arrange
    const slot = await storedSlot()

    // Act
    const booked = await repository().book(
      customerRequestOf(slot, A_WEEK_LATER),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toEqual({ type: 'success', data: { type: 'notASlot' } })
  })

  it('should book no slot at which the staff member has another booking', async () => {
    // Arrange
    const slot = await storedSlot()
    const customer = await insertCustomer(databases.database())
    await bookingWithLine({
      ...slot,
      customerId: customerIdSchema.parse(customer.id),
    })

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toEqual({ type: 'success', data: { type: 'notASlot' } })
  })

  it('should book a slot at which the other booking of the staff member was cancelled', async () => {
    // Arrange
    const slot = await storedSlot()
    const customer = await insertCustomer(databases.database())
    await bookingWithLine(
      { ...slot, customerId: customerIdSchema.parse(customer.id) },
      CANCELLED,
    )

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toMatchObject({
      type: 'success',
      data: { type: 'created' },
    })
  })

  it('should book no slot of a service whose bookings of the day are as many as it takes', async () => {
    // Arrange
    const slot = await storedSlot()
    const db = databases.database()
    await db
      .update(services)
      .set({ maxBookingsPerDay: 1 })
      .where(eq(services.id, slot.serviceId))
    const member = await otherMemberOf(slot.salonId)
    const customer = await insertCustomer(db)
    await bookingWithLine(
      {
        ...slot,
        staffId: member,
        customerId: customerIdSchema.parse(customer.id),
      },
      {
        startTime: '2026-12-07T06:00:00Z',
        endTime: '2026-12-07T07:00:00Z',
      },
    )

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toEqual({ type: 'success', data: { type: 'notASlot' } })
  })

  it('should book nothing for a customer who has another booking at the time, at another salon', async () => {
    // Arrange
    const slot = await storedSlot()
    const elsewhere = await storedParties()
    await insertBooking(databases.database(), {
      ...elsewhere,
      customerId: slot.customerId,
    })

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toEqual({
      type: 'success',
      data: { type: 'customerOccupied' },
    })
  })

  it('should book for a customer whose other booking at the time was cancelled', async () => {
    // Arrange
    const slot = await storedSlot()
    const elsewhere = await storedParties()
    await insertBooking(
      databases.database(),
      { ...elsewhere, customerId: slot.customerId },
      CANCELLED,
    )

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toMatchObject({
      type: 'success',
      data: { type: 'created' },
    })
  })

  it('should book nothing for a customer whose profile is deleted', async () => {
    // Arrange
    const slot = await storedSlot()
    await databases
      .database()
      .update(customers)
      .set({ deletedAt: DELETED_AT })
      .where(eq(customers.id, slot.customerId))

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toEqual({
      type: 'success',
      data: { type: 'profileNotFound' },
    })
  })

  it.each<[string, (slot: Parties) => Promise<unknown>, string[]]>([
    [
      'a salon that is deleted',
      (slot) =>
        databases
          .database()
          .update(salons)
          .set({ deletedAt: DELETED_AT })
          .where(eq(salons.id, slot.salonId)),
      ['salonId'],
    ],
    [
      'a service that is deleted',
      (slot) =>
        databases
          .database()
          .update(services)
          .set({ deletedAt: DELETED_AT })
          .where(eq(services.id, slot.serviceId)),
      ['serviceId'],
    ],
    [
      'a staff member who is deleted',
      (slot) =>
        databases
          .database()
          .update(staff)
          .set({ deletedAt: DELETED_AT })
          .where(eq(staff.id, slot.staffId)),
      ['staffId'],
    ],
    [
      'a service and a staff member who are deleted',
      async (slot) => {
        await databases
          .database()
          .update(services)
          .set({ deletedAt: DELETED_AT })
          .where(eq(services.id, slot.serviceId))
        await databases
          .database()
          .update(staff)
          .set({ deletedAt: DELETED_AT })
          .where(eq(staff.id, slot.staffId))
      },
      ['serviceId', 'staffId'],
    ],
  ])('should book nothing of %s', async (_, arrange, fields) => {
    // Arrange
    const slot = await storedSlot()
    await arrange(slot)

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf(),
    )

    // Assert
    expect(booked).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: fields.map((field) => ({ field })) },
    })
    expect(await allBookingIds()).toEqual([])
  })

  it('should write nothing when another booking has the number', async () => {
    // Arrange
    const slot = await storedSlot()
    const elsewhere = await storedParties()
    await insertBooking(databases.database(), elsewhere, {
      bookingNumber: 'BK-REPO-TAKEN',
    })

    // Act
    const booked = await repository().book(
      customerRequestOf(slot),
      bookerOf(slot),
      originOf('BK-REPO-TAKEN'),
    )

    // Assert
    expect(booked).toEqual({
      type: 'success',
      data: { type: 'bookingNumberTaken' },
    })
  })

  it('should see the booking another request wrote for the customer while this one waited for them', async () => {
    // Arrange
    const slot = await storedSlot()
    const member = await otherMemberOf(slot.salonId)

    // Act
    const booked = await databases.whileHeld(
      (held) =>
        held`select id from customers where id = ${slot.customerId} for update`,
      (held) =>
        held`insert into bookings ("bookingNumber", "salonId", "customerId", "staffId", "bookingDate", "startTime", "endTime", duration, subtotal, "totalAmount") values ('BK-REPO-HELD', ${slot.salonId}, ${slot.customerId}, ${member}, '2026-12-07', '2026-12-07T01:00:00Z', '2026-12-07T02:00:00Z', 60, 6600, 6600)`,
      () =>
        repository().book(customerRequestOf(slot), bookerOf(slot), originOf()),
    )

    // Assert
    expect(booked).toEqual({
      type: 'success',
      data: { type: 'customerOccupied' },
    })
  })
})

describe('BookingRepository.findById', () => {
  it('should find the booking with its service lines in their order', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const booking = await insertBooking(db, parties)
    const second = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 1,
    })
    const first = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 0,
    })

    // Act
    const found = await repository().findById(idOf(booking.id), EVERY_SALON)

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: {
        booking: { id: booking.id },
        services: [{ id: first.id }, { id: second.id }],
      },
    })
  })

  it('should find a booking that has no service line', async () => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
    )

    // Act
    const found = await repository().findById(
      idOf(booking.id),
      ofSalon(booking.salonId),
    )

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { booking: { id: booking.id }, services: [] },
    })
  })

  it('should find the booking of the customer whose reach it is in', async () => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
    )

    // Act
    const found = await repository().findById(
      idOf(booking.id),
      ofCustomer(booking.customerId),
    )

    // Assert
    expect(found).toMatchObject({
      type: 'success',
      data: { booking: { id: booking.id } },
    })
  })

  it.each<[string, () => Promise<BookingReach>]>([
    [
      'of another salon',
      async () => ofSalon((await insertSalon(databases.database())).id),
    ],
    [
      'of another customer',
      async () => ofCustomer((await insertCustomer(databases.database())).id),
    ],
  ])('should find no booking for a reader %s', async (_, reachOf) => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
    )
    const reach = await reachOf()

    // Act
    const found = await repository().findById(idOf(booking.id), reach)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })

  it('should find no booking of an ID that names none', async () => {
    // Act
    const found = await repository().findById(idOf(UNKNOWN_ID), EVERY_SALON)

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('BookingRepository.changeStatus', () => {
  const change = (
    id: string,
    action: BookingAction,
    reach: BookingReach = EVERY_SALON,
  ) => repository().changeStatus(idOf(id), reach, action, EDITOR)

  it('should change the status, write the entry of the history, and leave the counts of the customer', async () => {
    // Arrange
    const parties = await storedParties()
    await databases
      .database()
      .update(customers)
      .set({
        visitCount: 5,
        firstVisitDate: '2026-01-10',
        lastVisitDate: '2026-11-01',
      })
      .where(eq(customers.id, parties.customerId))
    const { booking, line } = await bookingWithLine(parties)

    // Act
    const changed = await change(booking.id, { type: 'confirm' })

    // Assert
    expect(changed).toMatchObject({
      type: 'success',
      data: {
        type: 'changed',
        booking: {
          booking: { id: booking.id, status: 'confirmed' },
          services: [{ id: line.id, isCompleted: false }],
        },
      },
    })
    expect(await historyOf(booking.id)).toEqual([
      {
        fromStatus: 'pending',
        toStatus: 'confirmed',
        changedBy: EDITOR,
        reason: null,
      },
    ])
    expect(await countsOf(parties.customerId)).toMatchObject({ visitCount: 5 })
  })

  it('should complete the lines that are not, keep the moment of those that are, and count the visits of the customer again', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const booking = await insertBooking(db, parties, {
      status: 'in_progress',
      actualStartTime: '2026-12-07T01:05:00Z',
    })
    const done = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 0,
      isCompleted: true,
      completedAt: '2026-12-07T01:30:00Z',
    })
    const open = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 1,
    })

    // Act
    const changed = await change(booking.id, {
      type: 'complete',
      actualStartTime: null,
      actualEndTime: null,
    })

    // Assert
    expect(changed).toMatchObject({
      type: 'success',
      data: { type: 'changed', booking: { booking: { status: 'completed' } } },
    })
    const stored = await storedBookingOf(booking.id)
    expect(stored).toMatchObject({
      actualStartTime: '2026-12-07 01:05:00+00',
    })
    expect(await linesOf(booking.id)).toMatchObject([
      { id: done.id, isCompleted: true, completedAt: '2026-12-07 01:30:00+00' },
      { id: open.id, isCompleted: true, completedAt: stored?.completedAt },
    ])
    expect(await countsOf(parties.customerId)).toEqual({
      visitCount: 1,
      lastVisitDate: '2026-12-07',
    })
  })

  it('should start the visit at the moment the change got hold of the booking', async () => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
      { status: 'confirmed' },
    )

    // Act
    const changed = await databases.whileHeld(
      (held) =>
        held`select id from bookings where id = ${booking.id} for update`,
      (held) =>
        held`update bookings set "internalNotes" = clock_timestamp()::text where id = ${booking.id}`,
      () => change(booking.id, { type: 'start' }),
    )

    // Assert
    expect(changed).toMatchObject({
      type: 'success',
      data: {
        type: 'changed',
        booking: { booking: { status: 'in_progress' } },
      },
    })
    // The domain keeps a moment to the millisecond.
    const [started] = await databases
      .database()
      .select({
        afterTheWait: sql<boolean>`${bookings.actualStartTime} >= date_trunc('milliseconds', ${bookings.internalNotes}::timestamptz)`,
      })
      .from(bookings)
      .where(eq(bookings.id, booking.id))
    expect(started).toEqual({ afterTheWait: true })
  })

  it('should read the status another change committed while this one waited for the booking', async () => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
    )

    // Act
    const changed = await databases.whileHeld(
      (held) =>
        held`select id from bookings where id = ${booking.id} for update`,
      (held) =>
        held`update bookings set status = 'cancelled', "cancelledAt" = clock_timestamp() where id = ${booking.id}`,
      () => change(booking.id, { type: 'confirm' }),
    )

    // Assert
    expect(changed).toMatchObject({
      type: 'success',
      data: { type: 'statusDoesNotAllow', status: 'cancelled' },
    })
  })

  it('should write nothing for an action the status does not allow', async () => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
      COMPLETED,
    )

    // Act
    const changed = await change(booking.id, { type: 'confirm' })

    // Assert
    expect(changed).toMatchObject({
      type: 'success',
      data: { type: 'statusDoesNotAllow', status: 'completed' },
    })
    expect(await historyOf(booking.id)).toEqual([])
  })

  it('should change nothing of a booking outside the reach of the reader', async () => {
    // Arrange
    const db = databases.database()
    const booking = await insertBooking(db, await storedParties())
    const customer = await insertCustomer(db)

    // Act
    const changed = await change(
      booking.id,
      { type: 'confirm' },
      ofCustomer(customer.id),
    )

    // Assert
    expect(changed).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect(await storedBookingOf(booking.id)).toMatchObject({
      status: 'pending',
    })
  })

  it('should answer a database error when the write returns no row', async () => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
    )
    await databases.skipWrites('bookings', 'UPDATE')

    // Act
    const changed = await change(booking.id, { type: 'confirm' })

    // Assert
    expect(changed).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of booking status returned no row',
        cause: null,
      },
    })
    expect(await historyOf(booking.id)).toEqual([])
  })
})

describe('BookingRepository.update', () => {
  it('should write the notes of the booking, and leave its service lines', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking, line } = await bookingWithLine(parties, {
      updatedAt: '2020-01-01T00:00:00Z',
    })

    // Act
    const updated = await repository().update(
      idOf(booking.id),
      ofSalon(parties.salonId),
      { internalNotes: 'カラーの相談あり', depositAmount: 1000 },
    )

    // Assert
    expect(updated).toMatchObject({
      type: 'success',
      data: {
        booking: {
          id: booking.id,
          internalNotes: 'カラーの相談あり',
          depositAmount: 1000,
          customerRequest: booking.customerRequest,
        },
        services: [{ id: line.id }],
      },
    })
    expect((await storedBookingOf(booking.id))?.updatedAt).not.toBe(
      '2020-01-01 00:00:00+00',
    )
  })

  it('should write nothing of a booking of another salon', async () => {
    // Arrange
    const db = databases.database()
    const booking = await insertBooking(db, await storedParties())
    const salon = await insertSalon(db)

    // Act
    const updated = await repository().update(
      idOf(booking.id),
      ofSalon(salon.id),
      { internalNotes: 'カラーの相談あり' },
    )

    // Assert
    expect(updated).toEqual({ type: 'success', data: null })
    expect(await storedBookingOf(booking.id)).toMatchObject({
      internalNotes: null,
    })
  })

  it('should answer a database error when the write returns no row', async () => {
    // Arrange
    const booking = await insertBooking(
      databases.database(),
      await storedParties(),
    )
    await databases.skipWrites('bookings', 'UPDATE')

    // Act
    const updated = await repository().update(idOf(booking.id), EVERY_SALON, {
      internalNotes: 'カラーの相談あり',
    })

    // Assert
    expect(updated).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of booking notes returned no row',
        cause: null,
      },
    })
  })
})

describe('BookingRepository.reschedule', () => {
  /** Four in the morning on 8 December in Tokyo: still 7 December in UTC. */
  const AT_FOUR_ON_THE_NEXT_DAY = '2026-12-07T19:00:00.000Z'

  it('should move the booking and its lines, give the lines of the staff member in charge to the one the request names, and tell the day in the time zone of the salon', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const { booking, line } = await bookingWithLine(parties)
    const helper = await otherMemberOf(parties.salonId)
    const helped = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 1,
      staffId: helper,
      startTime: '2026-12-07T01:30:00Z',
      endTime: '2026-12-07T02:00:00Z',
      duration: 30,
    })
    const next = await otherMemberOf(parties.salonId)

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      ofSalon(parties.salonId),
      { startTime: AT_FOUR_ON_THE_NEXT_DAY, staffId: next },
    )

    // Assert
    expect(rescheduled).toMatchObject({
      type: 'success',
      data: {
        type: 'rescheduled',
        booking: {
          booking: {
            staffId: next,
            bookingDate: '2026-12-08',
            startTime: '2026-12-07 19:00:00+00',
            endTime: '2026-12-07 20:00:00+00',
          },
          services: [
            {
              id: line.id,
              staffId: next,
              startTime: '2026-12-07 19:00:00+00',
              endTime: '2026-12-07 20:00:00+00',
            },
            {
              id: helped.id,
              staffId: helper,
              startTime: '2026-12-07 19:30:00+00',
              endTime: '2026-12-07 20:00:00+00',
            },
          ],
        },
      },
    })
  })

  it('should move a booking whose lines it has where it was are in the way of where it goes', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      EVERY_SALON,
      { startTime: AT_HALF_PAST_TEN, staffId: parties.staffId },
    )

    // Assert
    expect(rescheduled).toMatchObject({
      type: 'success',
      data: {
        type: 'rescheduled',
        booking: { booking: { startTime: '2026-12-07 01:30:00+00' } },
      },
    })
  })

  it('should move a booking that has a line of a staff member who was deleted since', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const helper = await otherMemberOf(parties.salonId)
    await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 1,
      staffId: helper,
    })
    await db
      .update(staff)
      .set({ deletedAt: DELETED_AT })
      .where(eq(staff.id, helper))

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      EVERY_SALON,
      { startTime: AT_ELEVEN, staffId: parties.staffId },
    )

    // Assert
    expect(rescheduled).toMatchObject({
      type: 'success',
      data: { type: 'rescheduled' },
    })
  })

  it('should move no booking to a staff member who has another booking at the time', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const next = await otherMemberOf(parties.salonId)
    const customer = await insertCustomer(db)
    await bookingWithLine(
      {
        ...parties,
        staffId: next,
        customerId: customerIdSchema.parse(customer.id),
      },
      { startTime: AT_ELEVEN, endTime: '2026-12-07T03:00:00Z' },
    )

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      EVERY_SALON,
      { startTime: AT_ELEVEN, staffId: next },
    )

    // Assert
    expect(rescheduled).toEqual({
      type: 'success',
      data: { type: 'staffOccupied', staffIds: [next] },
    })
  })

  it.each<[string, (parties: Parties) => Promise<StaffId>]>([
    [
      'who is deleted',
      async ({ salonId }) =>
        staffIdSchema.parse(
          (
            await insertStaffMember(databases.database(), salonId, {
              deletedAt: DELETED_AT,
            })
          ).id,
        ),
    ],
    ['of another salon', async () => (await storedParties()).staffId],
  ])('should move no booking to a staff member %s', async (_, memberOf) => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const member = await memberOf(parties)

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      EVERY_SALON,
      { startTime: AT_ELEVEN, staffId: member },
    )

    // Assert
    expect(rescheduled).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'staffId' }] },
    })
  })

  it('should move no booking of a salon whose time zone is not known', async () => {
    // Arrange
    const parties = await storedParties()
    await databases
      .database()
      .update(salons)
      .set({ timezone: 'Mars/Olympus_Mons' })
      .where(eq(salons.id, parties.salonId))
    const { booking } = await bookingWithLine(parties)

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      EVERY_SALON,
      { startTime: AT_ELEVEN, staffId: parties.staffId },
    )

    // Assert
    expect(rescheduled).toEqual({
      type: 'success',
      data: { type: 'timeZoneUnknown' },
    })
  })

  it('should move no booking that is completed', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties, COMPLETED)

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      EVERY_SALON,
      { startTime: AT_ELEVEN, staffId: parties.staffId },
    )

    // Assert
    expect(rescheduled).toMatchObject({
      type: 'success',
      data: { type: 'statusDoesNotAllow', status: 'completed' },
    })
  })

  it('should move no booking of another salon', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const salon = await insertSalon(databases.database())

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      ofSalon(salon.id),
      { startTime: AT_ELEVEN, staffId: parties.staffId },
    )

    // Assert
    expect(rescheduled).toEqual({
      type: 'success',
      data: { type: 'notFound' },
    })
  })

  it('should answer a database error when the write returns no row', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    await databases.skipWrites('bookings', 'UPDATE')

    // Act
    const rescheduled = await repository().reschedule(
      idOf(booking.id),
      EVERY_SALON,
      { startTime: AT_ELEVEN, staffId: parties.staffId },
    )

    // Assert
    expect(rescheduled).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of moved booking returned no row',
        cause: null,
      },
    })
  })
})

describe('BookingRepository.rebook', () => {
  const rebook = (
    slot: Parties,
    bookingId: string,
    startTime: string,
    staffId: StaffId = slot.staffId,
    mover: CustomerMover = MOVER,
  ) =>
    repository().rebook(
      idOf(bookingId),
      ofCustomer(slot.customerId),
      { startTime, staffId },
      mover,
    )

  it('should move a confirmed booking of the customer to the slot, make it pending again, and write the entry of the history', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking, line } = await bookingWithLine(slot, {
      status: 'confirmed',
    })

    // Act
    const rebooked = await rebook(slot, booking.id, AT_ELEVEN)

    // Assert
    expect(rebooked).toMatchObject({
      type: 'success',
      data: {
        type: 'rescheduled',
        booking: {
          booking: {
            status: 'pending',
            startTime: '2026-12-07 02:00:00+00',
          },
          services: [{ id: line.id, startTime: '2026-12-07 02:00:00+00' }],
        },
      },
    })
    expect(await historyOf(booking.id)).toEqual([
      {
        fromStatus: 'confirmed',
        toStatus: 'pending',
        changedBy: EDITOR,
        reason: null,
      },
    ])
  })

  it('should move a pending booking and write no entry of the history', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)

    // Act
    const rebooked = await rebook(slot, booking.id, AT_ELEVEN)

    // Assert
    expect(rebooked).toMatchObject({
      type: 'success',
      data: {
        type: 'rescheduled',
        booking: { booking: { status: 'pending' } },
      },
    })
    expect(await historyOf(booking.id)).toEqual([])
  })

  it('should move a booking to a slot that it alone is in the way of, for the staff member, the service and the customer', async () => {
    // Arrange
    const slot = await storedSlot()
    await databases
      .database()
      .update(services)
      .set({ maxBookingsPerDay: 1 })
      .where(eq(services.id, slot.serviceId))
    const { booking } = await bookingWithLine(slot)

    // Act
    const rebooked = await rebook(slot, booking.id, AT_HALF_PAST_TEN)

    // Assert
    expect(rebooked).toMatchObject({
      type: 'success',
      data: {
        type: 'rescheduled',
        booking: { booking: { startTime: '2026-12-07 01:30:00+00' } },
      },
    })
  })

  it('should write nothing when the booking is at the time with the staff member already', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking, line } = await bookingWithLine(slot, {
      updatedAt: '2020-01-01T00:00:00Z',
    })

    // Act
    const rebooked = await rebook(slot, booking.id, AT_TEN)

    // Assert
    expect(rebooked).toMatchObject({
      type: 'success',
      data: {
        type: 'unchanged',
        booking: {
          booking: { id: booking.id, updatedAt: '2020-01-01 00:00:00+00' },
          services: [{ id: line.id }],
        },
      },
    })
    expect(await storedBookingOf(booking.id)).toMatchObject({
      updatedAt: '2020-01-01 00:00:00+00',
    })
  })

  it('should move no booking whose visit has begun', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)

    // Act
    const rebooked = await rebook(slot, booking.id, AT_ELEVEN, slot.staffId, {
      ...MOVER,
      now: new Date('2026-12-07T01:10:00Z'),
    })

    // Assert
    expect(rebooked).toEqual({
      type: 'success',
      data: { type: 'alreadyBegun' },
    })
  })

  it('should move no booking of more than one line', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)
    await insertBookingLine(databases.database(), booking.id, slot.serviceId, {
      sortOrder: 1,
      staffId: slot.staffId,
    })

    // Act
    const rebooked = await rebook(slot, booking.id, AT_ELEVEN)

    // Assert
    expect(rebooked).toEqual({
      type: 'success',
      data: { type: 'notOneSlot' },
    })
  })

  it('should move no booking that is completed', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot, COMPLETED)

    // Act
    const rebooked = await rebook(slot, booking.id, AT_ELEVEN)

    // Assert
    expect(rebooked).toMatchObject({
      type: 'success',
      data: { type: 'statusDoesNotAllow', status: 'completed' },
    })
  })

  it('should move no booking to a time that is no slot', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)

    // Act
    const rebooked = await rebook(slot, booking.id, A_WEEK_LATER)

    // Assert
    expect(rebooked).toEqual({ type: 'success', data: { type: 'notASlot' } })
  })

  it('should move no booking to a staff member of another salon', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)
    const elsewhere = await storedSlot()

    // Act
    const rebooked = await rebook(
      slot,
      booking.id,
      AT_ELEVEN,
      elsewhere.staffId,
    )

    // Assert
    expect(rebooked).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field: 'staffId' }] },
    })
  })

  it('should move nothing for a customer whose profile is deleted', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)
    await databases
      .database()
      .update(customers)
      .set({ deletedAt: DELETED_AT })
      .where(eq(customers.id, slot.customerId))

    // Act
    const rebooked = await rebook(slot, booking.id, AT_ELEVEN)

    // Assert
    expect(rebooked).toEqual({
      type: 'success',
      data: { type: 'profileNotFound' },
    })
  })

  it('should move no booking of another customer', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)
    const customer = await insertCustomer(databases.database())

    // Act
    const rebooked = await rebook(
      { ...slot, customerId: customerIdSchema.parse(customer.id) },
      booking.id,
      AT_ELEVEN,
    )

    // Assert
    expect(rebooked).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should answer a database error when the write returns no row', async () => {
    // Arrange
    const slot = await storedSlot()
    const { booking } = await bookingWithLine(slot)
    await databases.skipWrites('bookings', 'UPDATE')

    // Act
    const rebooked = await rebook(slot, booking.id, AT_ELEVEN)

    // Assert
    expect(rebooked).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Update of moved booking returned no row',
        cause: null,
      },
    })
  })
})

describe('BookingRepository.delete', () => {
  it('should delete the booking with its service lines and its history, and leave the counts of its customer', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    await db
      .update(customers)
      .set({
        visitCount: 5,
        firstVisitDate: '2026-01-10',
        lastVisitDate: '2026-11-01',
      })
      .where(eq(customers.id, parties.customerId))
    const { booking } = await bookingWithLine(parties)
    await db
      .insert(bookingStatusHistories)
      .values({ bookingId: booking.id, toStatus: 'pending' })

    // Act
    const deleted = await repository().delete(
      idOf(booking.id),
      ofSalon(parties.salonId),
    )

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    expect(await storedBookingOf(booking.id)).toBeNull()
    expect(await linesOf(booking.id)).toEqual([])
    expect(await historyOf(booking.id)).toEqual([])
    expect(await countsOf(parties.customerId)).toMatchObject({ visitCount: 5 })
  })

  it('should count the visits of the customer again when the booking was completed', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    await insertBooking(db, parties, {
      ...COMPLETED,
      bookingDate: '2026-12-01',
      startTime: '2026-12-01T01:00:00Z',
      endTime: '2026-12-01T02:00:00Z',
    })
    const booking = await insertBooking(db, parties, COMPLETED)
    await db
      .update(customers)
      .set({
        visitCount: 2,
        firstVisitDate: '2026-12-01',
        lastVisitDate: '2026-12-07',
      })
      .where(eq(customers.id, parties.customerId))

    // Act
    const deleted = await repository().delete(idOf(booking.id), EVERY_SALON)

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'deleted' } })
    expect(await countsOf(parties.customerId)).toEqual({
      visitCount: 1,
      lastVisitDate: '2026-12-01',
    })
  })

  it('should delete no booking that a sale, a treatment record and a review refer to', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const booking = await insertBooking(db, parties, COMPLETED)
    await insertSale(
      db,
      { salonId: parties.salonId, customerId: parties.customerId },
      { bookingId: booking.id },
    )
    await insertTreatmentRecord(db, {
      bookingId: booking.id,
      customerId: parties.customerId,
      staffId: parties.staffId,
      serviceId: parties.serviceId,
    })
    await insertReview(db, {
      bookingId: booking.id,
      salonId: parties.salonId,
      customerId: parties.customerId,
    })

    // Act
    const deleted = await repository().delete(idOf(booking.id), EVERY_SALON)

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'referredTo', by: ['sale', 'treatmentRecord', 'review'] },
    })
    expect(await storedBookingOf(booking.id)).not.toBeNull()
  })

  it.each<
    [string, (parties: Parties, bookingId: string) => Promise<unknown>, string]
  >([
    [
      'a sale',
      (parties, bookingId) =>
        insertSale(
          databases.database(),
          { salonId: parties.salonId, customerId: parties.customerId },
          { bookingId },
        ),
      'sale',
    ],
    [
      'a treatment record',
      (parties, bookingId) =>
        insertTreatmentRecord(databases.database(), {
          bookingId,
          customerId: parties.customerId,
          staffId: parties.staffId,
          serviceId: parties.serviceId,
        }),
      'treatmentRecord',
    ],
    [
      'a review',
      (parties, bookingId) =>
        insertReview(databases.database(), {
          bookingId,
          salonId: parties.salonId,
          customerId: parties.customerId,
        }),
      'review',
    ],
  ])('should delete no booking that %s refers to', async (_, refer, by) => {
    // Arrange
    const parties = await storedParties()
    const booking = await insertBooking(
      databases.database(),
      parties,
      COMPLETED,
    )
    await refer(parties, booking.id)

    // Act
    const deleted = await repository().delete(idOf(booking.id), EVERY_SALON)

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'referredTo', by: [by] },
    })
  })

  it('should see the sale another request wrote for the booking while this one waited for it', async () => {
    // Arrange
    const parties = await storedParties()
    const booking = await insertBooking(
      databases.database(),
      parties,
      COMPLETED,
    )

    // Act
    const deleted = await databases.whileHeld(
      (held) =>
        held`select id from bookings where id = ${booking.id} for update`,
      (held) =>
        held`insert into sales ("saleNumber", "salonId", "customerId", "bookingId", "saleDate", "saleTime", subtotal, "taxAmount", "totalAmount") values ('SL-REPO-HELD', ${parties.salonId}, ${parties.customerId}, ${booking.id}, '2026-12-07', '2026-12-07T02:00:00Z', 6000, 600, 6600)`,
      () => repository().delete(idOf(booking.id), EVERY_SALON),
    )

    // Assert
    expect(deleted).toEqual({
      type: 'success',
      data: { type: 'referredTo', by: ['sale'] },
    })
  })

  it('should delete no booking of another salon', async () => {
    // Arrange
    const db = databases.database()
    const booking = await insertBooking(db, await storedParties())
    const salon = await insertSalon(db)

    // Act
    const deleted = await repository().delete(
      idOf(booking.id),
      ofSalon(salon.id),
    )

    // Assert
    expect(deleted).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect(await storedBookingOf(booking.id)).not.toBeNull()
  })
})

describe('BookingRepository.addService', () => {
  /** A line at eleven of the service of the parties, with no staff member unless the test says otherwise. */
  const lineAtEleven = (
    parties: Parties,
    overrides: Partial<RequestedBookingService> = {},
  ): RequestedBookingService => ({
    serviceId: parties.serviceId,
    staffId: null,
    startTime: AT_ELEVEN,
    notes: null,
    ...overrides,
  })

  it('should add the line after the others, and sum the booking up again with the tax of the salon', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const other = await insertService(databases.database(), parties.salonId, {
      price: 6000,
      taxIncluded: false,
    })

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      ofSalon(parties.salonId),
      lineAtEleven(parties, {
        serviceId: serviceIdSchema.parse(other.id),
        staffId: parties.staffId,
        notes: 'カラー',
      }),
    )

    // Assert
    expect(added).toMatchObject({
      type: 'success',
      data: {
        type: 'added',
        service: {
          bookingId: booking.id,
          serviceId: other.id,
          staffId: parties.staffId,
          sortOrder: 1,
          notes: 'カラー',
          startTime: '2026-12-07 02:00:00+00',
        },
      },
    })
    expect(await storedBookingOf(booking.id)).toMatchObject({
      endTime: '2026-12-07 03:00:00+00',
      subtotal: 12600,
      taxAmount: 600,
      totalAmount: 13200,
    })
  })

  it('should add a line of the staff member at a time at which the booking itself has them', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      EVERY_SALON,
      lineAtEleven(parties, {
        staffId: parties.staffId,
        startTime: AT_HALF_PAST_TEN,
      }),
    )

    // Assert
    expect(added).toMatchObject({
      type: 'success',
      data: { type: 'added', service: { staffId: parties.staffId } },
    })
  })

  it('should add a line that no staff member is named for', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      EVERY_SALON,
      lineAtEleven(parties),
    )

    // Assert
    expect(added).toMatchObject({
      type: 'success',
      data: { type: 'added', service: { staffId: null } },
    })
  })

  it('should add no line of a staff member who has another booking at the time', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const helper = await otherMemberOf(parties.salonId)
    const customer = await insertCustomer(db)
    await bookingWithLine(
      {
        ...parties,
        staffId: helper,
        customerId: customerIdSchema.parse(customer.id),
      },
      { startTime: AT_ELEVEN, endTime: '2026-12-07T03:00:00Z' },
    )

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      EVERY_SALON,
      lineAtEleven(parties, { staffId: helper }),
    )

    // Assert
    expect(added).toEqual({
      type: 'success',
      data: { type: 'staffOccupied', staffIds: [helper] },
    })
  })

  it.each<
    [string, (parties: Parties) => Promise<RequestedBookingService>, string]
  >([
    [
      'a service that is deleted',
      async (parties) =>
        lineAtEleven(parties, {
          serviceId: serviceIdSchema.parse(
            (
              await insertService(databases.database(), parties.salonId, {
                deletedAt: DELETED_AT,
              })
            ).id,
          ),
        }),
      'serviceId',
    ],
    [
      'a service of another salon',
      async (parties) =>
        lineAtEleven(parties, {
          serviceId: (await storedParties()).serviceId,
        }),
      'serviceId',
    ],
    [
      'a staff member who is deleted',
      async (parties) =>
        lineAtEleven(parties, {
          staffId: staffIdSchema.parse(
            (
              await insertStaffMember(databases.database(), parties.salonId, {
                deletedAt: DELETED_AT,
              })
            ).id,
          ),
        }),
      'staffId',
    ],
    [
      'a staff member of another salon',
      async (parties) =>
        lineAtEleven(parties, { staffId: (await storedParties()).staffId }),
      'staffId',
    ],
  ])('should add no line that names %s', async (_, requestFor, field) => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const request = await requestFor(parties)

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      EVERY_SALON,
      request,
    )

    // Assert
    expect(added).toMatchObject({
      type: 'success',
      data: { type: 'invalid', issues: [{ field }] },
    })
    expect(await linesOf(booking.id)).toHaveLength(1)
  })

  it('should add no line to a booking that is completed', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties, COMPLETED)

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      EVERY_SALON,
      lineAtEleven(parties),
    )

    // Assert
    expect(added).toMatchObject({
      type: 'success',
      data: { type: 'statusDoesNotAllow', status: 'completed' },
    })
  })

  it('should add no line to a booking of another salon', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    const salon = await insertSalon(databases.database())

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      ofSalon(salon.id),
      lineAtEleven(parties),
    )

    // Assert
    expect(added).toEqual({ type: 'success', data: { type: 'notFound' } })
  })

  it('should answer a database error when the write returns no row, and sum nothing up', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithLine(parties)
    await databases.skipWrites('booking_services', 'INSERT')

    // Act
    const added = await repository().addService(
      idOf(booking.id),
      EVERY_SALON,
      lineAtEleven(parties),
    )

    // Assert
    expect(added).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'Insert of booking service returned no row',
        cause: null,
      },
    })
    expect(await storedBookingOf(booking.id)).toMatchObject({
      endTime: '2026-12-07 02:00:00+00',
      subtotal: 6600,
    })
  })
})

describe('BookingRepository.findService', () => {
  it('should find the service line of the booking', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking, line } = await bookingWithLine(parties)

    // Act
    const found = await repository().findService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(line.id),
      ofSalon(parties.salonId),
    )

    // Assert
    expect(found).toMatchObject({ type: 'success', data: { id: line.id } })
  })

  it('should find no service line of another booking', async () => {
    // Arrange
    const parties = await storedParties()
    const booking = await insertBooking(databases.database(), parties)
    const { line } = await bookingWithLine(parties, {
      startTime: '2026-12-07T03:00:00Z',
      endTime: '2026-12-07T04:00:00Z',
    })

    // Act
    const found = await repository().findService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(line.id),
      EVERY_SALON,
    )

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })

  it('should find no service line of a booking of another salon', async () => {
    // Arrange
    const { booking, line } = await bookingWithLine(await storedParties())
    const salon = await insertSalon(databases.database())

    // Act
    const found = await repository().findService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(line.id),
      ofSalon(salon.id),
    )

    // Assert
    expect(found).toEqual({ type: 'success', data: null })
  })
})

describe('BookingRepository.removeService', () => {
  /** A booking of two lines, from ten to eleven and from eleven to twelve. */
  const bookingWithTwoLines = async (
    parties: Parties,
    overrides: Partial<typeof bookings.$inferInsert> = {},
  ) => {
    const db = databases.database()
    const booking = await insertBooking(db, parties, {
      endTime: '2026-12-07T03:00:00Z',
      duration: 120,
      subtotal: 13200,
      totalAmount: 13200,
      ...overrides,
    })
    const first = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 0,
    })
    const second = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 1,
      startTime: '2026-12-07T02:00:00Z',
      endTime: '2026-12-07T03:00:00Z',
    })

    return { booking, first, second }
  }

  it('should remove the line, and sum up the booking of the lines that are left', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking, first, second } = await bookingWithTwoLines(parties)

    // Act
    const removed = await repository().removeService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(second.id),
      ofSalon(parties.salonId),
    )

    // Assert
    expect(removed).toEqual({ type: 'success', data: { type: 'removed' } })
    expect((await linesOf(booking.id)).map(({ id }) => id)).toEqual([first.id])
    expect(await storedBookingOf(booking.id)).toMatchObject({
      endTime: '2026-12-07 02:00:00+00',
      subtotal: 6600,
    })
  })

  it('should remove no line of another booking', async () => {
    // Arrange
    const parties = await storedParties()
    const { booking } = await bookingWithTwoLines(parties)
    const { line } = await bookingWithLine(parties, {
      startTime: '2026-12-07T05:00:00Z',
      endTime: '2026-12-07T06:00:00Z',
    })

    // Act
    const removed = await repository().removeService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(line.id),
      EVERY_SALON,
    )

    // Assert
    expect(removed).toEqual({
      type: 'success',
      data: { type: 'serviceNotFound' },
    })
    expect(await linesOf(line.bookingId)).toHaveLength(1)
  })

  it('should remove no line that is the last of its booking', async () => {
    // Arrange
    const { booking, line } = await bookingWithLine(await storedParties())

    // Act
    const removed = await repository().removeService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(line.id),
      EVERY_SALON,
    )

    // Assert
    expect(removed).toEqual({
      type: 'success',
      data: { type: 'lastService' },
    })
  })

  it('should remove no line of a booking that is completed', async () => {
    // Arrange
    const { booking, second } = await bookingWithTwoLines(
      await storedParties(),
      COMPLETED,
    )

    // Act
    const removed = await repository().removeService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(second.id),
      EVERY_SALON,
    )

    // Assert
    expect(removed).toMatchObject({
      type: 'success',
      data: { type: 'statusDoesNotAllow', status: 'completed' },
    })
  })

  it('should remove no line of a booking of another salon', async () => {
    // Arrange
    const { booking, second } = await bookingWithTwoLines(await storedParties())
    const salon = await insertSalon(databases.database())

    // Act
    const removed = await repository().removeService(
      idOf(booking.id),
      bookingServiceIdSchema.parse(second.id),
      ofSalon(salon.id),
    )

    // Assert
    expect(removed).toEqual({ type: 'success', data: { type: 'notFound' } })
    expect(await linesOf(booking.id)).toHaveLength(2)
  })
})

describe('BookingRepository.list', () => {
  const criteriaOf = (
    overrides: Partial<BookingListCriteria> = {},
  ): BookingListCriteria => ({
    reach: EVERY_SALON,
    limit: 20,
    after: null,
    salonId: null,
    customerId: null,
    staffId: null,
    status: null,
    bookingDateFrom: null,
    bookingDateTo: null,
    ...overrides,
  })

  const idsOf = (
    listed: Awaited<ReturnType<BookingRepository['list']>>,
  ): string[] | null =>
    listed.type === 'success' && listed.data !== null
      ? listed.data.bookings.map(({ booking }) => booking.id)
      : null

  /** A booking of the parties on the day, at the hour (UTC), half an hour long. */
  const bookingOn = (
    parties: Parties,
    day: string,
    hour: string,
    overrides: Partial<typeof bookings.$inferInsert> = {},
  ) =>
    insertBooking(databases.database(), parties, {
      bookingDate: day,
      startTime: `${day}T${hour}:00:00Z`,
      endTime: `${day}T${hour}:30:00Z`,
      duration: 30,
      ...overrides,
    })

  it('should list the bookings by the time they begin, a page at a time, the next page after the booking of the cursor', async () => {
    // Arrange
    const parties = await storedParties()
    const third = await bookingOn(parties, '2026-12-09', '01')
    const first = await bookingOn(parties, '2026-12-07', '01')
    const second = await bookingOn(parties, '2026-12-08', '01')

    // Act
    const page = await repository().list(criteriaOf({ limit: 2 }))
    const next = await repository().list(
      criteriaOf({ limit: 1, after: idOf(second.id) }),
    )

    // Assert
    expect(page).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: true },
    })
    expect(idsOf(page)).toEqual([first.id, second.id])
    expect(next).toMatchObject({
      type: 'success',
      data: { total: 3, hasMore: false },
    })
    expect(idsOf(next)).toEqual([third.id])
  })

  it('should list two bookings that begin at the same time in the order of their IDs, also across pages', async () => {
    // Arrange
    const parties = await storedParties()
    const [first, second] = [
      await bookingOn(parties, '2026-12-07', '01'),
      await bookingOn(parties, '2026-12-07', '01'),
    ]
      .map(({ id }) => id)
      .toSorted()

    // Act
    const listed = await repository().list(criteriaOf())
    const next = await repository().list(
      criteriaOf({ after: idOf(first ?? UNKNOWN_ID) }),
    )

    // Assert
    expect(idsOf(listed)).toEqual([first, second])
    expect(idsOf(next)).toEqual([second])
  })

  it('should list each booking with its service lines in their order', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const booking = await bookingOn(parties, '2026-12-07', '01')
    const second = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 1,
    })
    const first = await insertBookingLine(db, booking.id, parties.serviceId, {
      sortOrder: 0,
    })
    const without = await bookingOn(parties, '2026-12-08', '01')

    // Act
    const listed = await repository().list(criteriaOf())

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: {
        bookings: [
          {
            booking: { id: booking.id },
            services: [{ id: first.id }, { id: second.id }],
          },
          { booking: { id: without.id }, services: [] },
        ],
      },
    })
  })

  it('should list the bookings that every filter takes, and count them', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const taken = await bookingOn(parties, '2026-12-08', '01', {
      status: 'confirmed',
    })
    await bookingOn(parties, '2026-12-08', '02')
    await bookingOn(parties, '2026-12-06', '01', { status: 'confirmed' })
    await bookingOn(parties, '2026-12-11', '01', { status: 'confirmed' })
    const customer = await insertCustomer(db)
    await bookingOn(
      { ...parties, customerId: customerIdSchema.parse(customer.id) },
      '2026-12-08',
      '03',
      { status: 'confirmed' },
    )
    const member = await insertStaffMember(db, parties.salonId)
    await bookingOn(
      { ...parties, staffId: staffIdSchema.parse(member.id) },
      '2026-12-08',
      '04',
      { status: 'confirmed' },
    )
    const elsewhere = await storedParties()
    await bookingOn(
      { ...elsewhere, customerId: parties.customerId },
      '2026-12-08',
      '05',
      { status: 'confirmed' },
    )

    // Act
    const listed = await repository().list(
      criteriaOf({
        salonId: parties.salonId,
        customerId: parties.customerId,
        staffId: parties.staffId,
        status: 'confirmed',
        bookingDateFrom: '2026-12-07',
        bookingDateTo: '2026-12-10',
      }),
    )

    // Assert
    expect(listed).toMatchObject({
      type: 'success',
      data: { total: 1, hasMore: false },
    })
    expect(idsOf(listed)).toEqual([taken.id])
  })

  it('should list the bookings of the salon that the filter names, for a reader of every salon', async () => {
    // Arrange
    const parties = await storedParties()
    const first = await bookingOn(parties, '2026-12-08', '01')
    await bookingOn(await storedParties(), '2026-12-08', '02')

    // Act
    const listed = await repository().list(
      criteriaOf({ salonId: parties.salonId }),
    )

    // Assert
    expect(idsOf(listed)).toEqual([first.id])
  })

  it('should list the bookings of the days from the first to the last of the period', async () => {
    // Arrange
    const parties = await storedParties()
    await bookingOn(parties, '2026-12-06', '01')
    const first = await bookingOn(parties, '2026-12-07', '01')
    const last = await bookingOn(parties, '2026-12-10', '01')
    await bookingOn(parties, '2026-12-11', '01')

    // Act
    const listed = await repository().list(
      criteriaOf({
        bookingDateFrom: '2026-12-07',
        bookingDateTo: '2026-12-10',
      }),
    )

    // Assert
    expect(idsOf(listed)).toEqual([first.id, last.id])
  })

  it('should list a booking of the staff member who has one of its service lines and is not in charge of it', async () => {
    // Arrange
    const db = databases.database()
    const parties = await storedParties()
    const member = staffIdSchema.parse(
      (await insertStaffMember(db, parties.salonId)).id,
    )
    const helped = await bookingOn(parties, '2026-12-07', '01')
    await insertBookingLine(db, helped.id, parties.serviceId, {
      staffId: member,
    })
    const inCharge = await bookingOn(
      { ...parties, staffId: member },
      '2026-12-08',
      '01',
    )
    const other = await bookingOn(parties, '2026-12-09', '01')
    await insertBookingLine(db, other.id, parties.serviceId, {
      staffId: parties.staffId,
    })

    // Act
    const listed = await repository().list(criteriaOf({ staffId: member }))

    // Assert
    expect(idsOf(listed)).toEqual([helped.id, inCharge.id])
  })

  it.each<[string, (parties: Parties) => BookingReach]>([
    ['the salon', ({ salonId }) => ofSalon(salonId)],
    ['the customer', ({ customerId }) => ofCustomer(customerId)],
  ])(
    'should list only the bookings of %s whose reach it is',
    async (_, reachOf) => {
      // Arrange
      const parties = await storedParties()
      const own = await bookingOn(parties, '2026-12-07', '01')
      await bookingOn(await storedParties(), '2026-12-07', '01')

      // Act
      const listed = await repository().list(
        criteriaOf({ reach: reachOf(parties) }),
      )

      // Assert
      expect(listed).toMatchObject({ type: 'success', data: { total: 1 } })
      expect(idsOf(listed)).toEqual([own.id])
    },
  )

  it.each<[string, () => Promise<string>]>([
    [
      'a booking outside the reach of the reader',
      async () =>
        (await bookingOn(await storedParties(), '2026-12-07', '01')).id,
    ],
    ['an ID that names no booking', async () => UNKNOWN_ID],
  ])('should find no page after %s', async (_, cursorOf) => {
    // Arrange
    const parties = await storedParties()
    await bookingOn(parties, '2026-12-07', '01')
    const after = idOf(await cursorOf())

    // Act
    const listed = await repository().list(
      criteriaOf({ reach: ofSalon(parties.salonId), after }),
    )

    // Assert
    expect(listed).toEqual({ type: 'success', data: null })
  })
})

describe('BookingRepository when the database is gone', () => {
  const booking = idOf(UNKNOWN_ID)
  const line = bookingServiceIdSchema.parse(UNKNOWN_ID)
  const parties: Parties = {
    salonId: salonIdSchema.parse(UNKNOWN_ID),
    staffId: staffIdSchema.parse(UNKNOWN_ID),
    serviceId: serviceIdSchema.parse(UNKNOWN_ID),
    customerId: customerIdSchema.parse(UNKNOWN_ID),
  }
  const move = { startTime: AT_ELEVEN, staffId: parties.staffId }

  it.each<[string, (gone: BookingRepository) => Promise<unknown>]>([
    [
      'Failed to create booking',
      (gone) => gone.create(requestOf(parties), originOf()),
    ],
    [
      'Failed to book for customer',
      (gone) =>
        gone.book(customerRequestOf(parties), bookerOf(parties), originOf()),
    ],
    ['Failed to find booking', (gone) => gone.findById(booking, EVERY_SALON)],
    [
      'Failed to change the status of booking',
      (gone) =>
        gone.changeStatus(booking, EVERY_SALON, { type: 'confirm' }, EDITOR),
    ],
    [
      'Failed to update booking',
      (gone) => gone.update(booking, EVERY_SALON, { internalNotes: null }),
    ],
    [
      'Failed to reschedule booking',
      (gone) => gone.reschedule(booking, EVERY_SALON, move),
    ],
    [
      'Failed to rebook for customer',
      (gone) => gone.rebook(booking, ofCustomer(UNKNOWN_ID), move, MOVER),
    ],
    ['Failed to delete booking', (gone) => gone.delete(booking, EVERY_SALON)],
    [
      'Failed to add service to booking',
      (gone) =>
        gone.addService(booking, EVERY_SALON, {
          serviceId: parties.serviceId,
          staffId: null,
          startTime: AT_ELEVEN,
          notes: null,
        }),
    ],
    [
      'Failed to find service of booking',
      (gone) => gone.findService(booking, line, EVERY_SALON),
    ],
    [
      'Failed to remove service from booking',
      (gone) => gone.removeService(booking, line, EVERY_SALON),
    ],
    [
      'Failed to list bookings',
      (gone) =>
        gone.list({
          reach: EVERY_SALON,
          limit: 20,
          after: null,
          salonId: null,
          customerId: null,
          staffId: null,
          status: null,
          bookingDateFrom: null,
          bookingDateTo: null,
        }),
    ],
  ])('should answer %s', async (message, call) => {
    // Arrange
    const gone = new BookingRepository(await databases.gone())

    // Act
    const answered = await call(gone)

    // Assert
    expect(answered).toMatchObject({
      type: 'error',
      error: { type: 'database', message },
    })
  })
})
