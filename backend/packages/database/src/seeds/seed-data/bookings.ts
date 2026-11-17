import { TZDate } from '@date-fns/tz'
import { addDays, addMinutes, format, set, startOfDay, subDays } from 'date-fns'
import { inArray, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

type BookingStatus = (typeof schema.bookingStatus.enumValues)[number]

/**
 * A booking of the seed, by what a create request says of a booking: whom
 * it is for and which services begin when. Everything else follows as it
 * does when the API creates a booking: the time and the amounts of a line
 * are those of its service, those of the booking come from its lines, and
 * the day of the visit is the day in the time zone of the salon.
 */
type SeededBooking = {
  /** The position of the salon among the seeded ones. */
  salon: number
  /** The position of the customer among the seeded ones, or the VIP customer. */
  customer: number | 'vip'
  /** The code of the staff member in charge. */
  staffCode: string
  /** Days from today in the time zone of the salon; negative in the past. */
  day: number
  /** The time of the salon at which the first service begins. */
  hours: number
  minutes: number
  /** The services by name, one right after the other, and who provides each. */
  lines: { service: string; staffCode: string }[]
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
  depositAmount: number | null
  customerRequest: string | null
  source: string
}

/**
 * No two of these occupy a staff member at the same time, except the two of
 * one afternoon for the staff member who takes two bookings at once.
 */
const BOOKINGS: SeededBooking[] = [
  // Visits that took place. The reviews are written for the first five.
  {
    salon: 0,
    customer: 0,
    staffCode: 'STF001',
    day: -30,
    hours: 14,
    minutes: 0,
    lines: [
      { service: 'Ladies Cut', staffCode: 'STF001' },
      { service: 'Deep Conditioning Treatment', staffCode: 'STF001' },
    ],
    status: 'completed',
    depositAmount: null,
    customerRequest: null,
    source: 'online',
  },
  {
    salon: 1,
    customer: 1,
    staffCode: 'STF003',
    day: -25,
    hours: 11,
    minutes: 0,
    lines: [{ service: 'Signature Cut', staffCode: 'STF003' }],
    status: 'completed',
    depositAmount: null,
    customerRequest: null,
    source: 'online',
  },
  {
    salon: 0,
    customer: 2,
    staffCode: 'STF004',
    day: -20,
    hours: 10,
    minutes: 30,
    lines: [{ service: 'Mens Cut', staffCode: 'STF004' }],
    status: 'completed',
    depositAmount: null,
    customerRequest: null,
    source: 'phone',
  },
  {
    salon: 0,
    customer: 'vip',
    staffCode: 'STF002',
    day: -15,
    hours: 13,
    minutes: 0,
    lines: [
      { service: 'Full Color', staffCode: 'STF002' },
      { service: 'Ladies Cut', staffCode: 'STF001' },
    ],
    status: 'completed',
    depositAmount: 1000,
    customerRequest: null,
    source: 'online',
  },
  {
    salon: 1,
    customer: 0,
    staffCode: 'STF003',
    day: -10,
    hours: 15,
    minutes: 0,
    lines: [{ service: 'Premium Head Spa (60 min)', staffCode: 'STF003' }],
    status: 'completed',
    depositAmount: null,
    customerRequest: null,
    source: 'online',
  },
  {
    salon: 1,
    customer: 1,
    staffCode: 'STF003',
    day: -5,
    hours: 16,
    minutes: 0,
    lines: [{ service: 'Spa & Cut Package', staffCode: 'STF003' }],
    status: 'completed',
    depositAmount: null,
    customerRequest: null,
    source: 'phone',
  },
  // A visit that was called off the day before
  {
    salon: 0,
    customer: 0,
    staffCode: 'STF001',
    day: -2,
    hours: 11,
    minutes: 0,
    lines: [{ service: 'Ladies Cut', staffCode: 'STF001' }],
    status: 'cancelled',
    depositAmount: null,
    customerRequest: null,
    source: 'online',
  },
  // A visit the customer did not come to
  {
    salon: 0,
    customer: 2,
    staffCode: 'STF004',
    day: -1,
    hours: 16,
    minutes: 0,
    lines: [{ service: 'Mens Cut', staffCode: 'STF004' }],
    status: 'no_show',
    depositAmount: null,
    customerRequest: null,
    source: 'phone',
  },
  // Visits of the coming week
  {
    salon: 1,
    customer: 'vip',
    staffCode: 'STF003',
    day: 1,
    hours: 10,
    minutes: 0,
    lines: [{ service: 'Premium Head Spa (60 min)', staffCode: 'STF003' }],
    status: 'confirmed',
    depositAmount: 1000,
    customerRequest: 'Please prepare organic products',
    source: 'online',
  },
  {
    salon: 0,
    customer: 1,
    staffCode: 'STF001',
    day: 2,
    hours: 11,
    minutes: 0,
    lines: [
      { service: 'Ladies Cut', staffCode: 'STF001' },
      { service: 'Full Color', staffCode: 'STF002' },
    ],
    status: 'confirmed',
    depositAmount: 1000,
    customerRequest: null,
    source: 'online',
  },
  {
    salon: 0,
    customer: 2,
    staffCode: 'STF004',
    day: 3,
    hours: 13,
    minutes: 0,
    lines: [{ service: 'Keratin Treatment', staffCode: 'STF004' }],
    status: 'pending',
    depositAmount: null,
    customerRequest: null,
    source: 'phone',
  },
  // Two at once: this staff member takes two bookings at a time.
  {
    salon: 0,
    customer: 0,
    staffCode: 'STF001',
    day: 4,
    hours: 14,
    minutes: 0,
    lines: [{ service: 'Kids Cut (Under 12)', staffCode: 'STF001' }],
    status: 'pending',
    depositAmount: null,
    customerRequest: null,
    source: 'online',
  },
  {
    salon: 0,
    customer: 1,
    staffCode: 'STF001',
    day: 4,
    hours: 14,
    minutes: 0,
    lines: [{ service: 'Mens Cut', staffCode: 'STF001' }],
    status: 'pending',
    depositAmount: null,
    customerRequest: null,
    source: 'phone',
  },
  {
    salon: 1,
    customer: 2,
    staffCode: 'STF003',
    day: 5,
    hours: 12,
    minutes: 0,
    lines: [{ service: 'Scalp Treatment', staffCode: 'STF003' }],
    status: 'pending',
    depositAmount: null,
    customerRequest: null,
    source: 'online',
  },
  {
    salon: 0,
    customer: 'vip',
    staffCode: 'STF002',
    day: 6,
    hours: 15,
    minutes: 0,
    lines: [{ service: 'Digital Perm', staffCode: 'STF002' }],
    status: 'pending',
    depositAmount: null,
    customerRequest: null,
    source: 'phone',
  },
  {
    salon: 1,
    customer: 0,
    staffCode: 'STF003',
    day: 7,
    hours: 17,
    minutes: 0,
    lines: [
      { service: 'Signature Cut', staffCode: 'STF003' },
      { service: 'Head Spa (30 min)', staffCode: 'STF003' },
    ],
    status: 'pending',
    depositAmount: null,
    customerRequest: null,
    source: 'online',
  },
]

/** How long before the visit a booking of the seed was made. */
const DAYS_BOOKED_AHEAD = 14

type BookingSeedData = {
  salonIds: string[]
  customerIds: string[]
  vipCustomerId: string
}

/** A visit that took place, as far as a review of it refers to it. */
export type CompletedBooking = {
  id: string
  salonId: string
  customerId: string
  staffId: string
}

type StatusChange = {
  toStatus: BookingStatus
  at: Date
  reason: string | null
}

const CANCELLATION_REASON = 'Customer illness'

/**
 * The statuses a booking of the seed went through, from its creation to
 * the status it has: confirmed the day after it was made, completed when
 * the visit ended, cancelled the day before the visit, and noted as one the
 * customer did not come to when it would have ended.
 */
const statusChangesTo = (
  status: SeededBooking['status'],
  times: { bookedAt: Date; dayBefore: Date; end: Date },
): StatusChange[] => {
  const created: StatusChange = {
    toStatus: 'pending',
    at: times.bookedAt,
    reason: null,
  }
  const confirmed: StatusChange = {
    toStatus: 'confirmed',
    at: addDays(times.bookedAt, 1),
    reason: 'Customer confirmed',
  }
  const changes: Record<SeededBooking['status'], StatusChange[]> = {
    pending: [created],
    confirmed: [created, confirmed],
    completed: [
      created,
      confirmed,
      { toStatus: 'completed', at: times.end, reason: 'Service completed' },
    ],
    cancelled: [
      created,
      {
        toStatus: 'cancelled',
        at: times.dayBefore,
        reason: CANCELLATION_REASON,
      },
    ],
    no_show: [
      created,
      confirmed,
      { toStatus: 'no_show', at: times.end, reason: null },
    ],
  }

  return changes[status]
}

const found = <T>(row: T | undefined, what: string): T => {
  if (row === undefined) {
    throw new Error(`The booking seed needs ${what}`)
  }

  return row
}

const sumOf = (amounts: number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/**
 * The tax that is added to an amount without tax, with the fraction of a
 * yen dropped; the rate is a percentage with two decimal places.
 */
const taxAddedTo = (amount: number, taxRate: string): number =>
  Number((BigInt(amount) * BigInt(Math.round(Number(taxRate) * 100))) / 10_000n)

/**
 * Sets what a customer has of visits, no-shows and cancellations to what
 * their bookings say, as the API does when the status of a booking changes.
 */
const countBookingsOfCustomers = async (
  db: PostgresJsDatabase<typeof schema>,
): Promise<void> => {
  const { bookings, customers } = schema
  const counted = db
    .select({
      customerId: bookings.customerId,
      visits:
        sql<number>`count(*) filter (where ${bookings.status} = 'completed')`.as(
          'visits',
        ),
      noShows:
        sql<number>`count(*) filter (where ${bookings.status} = 'no_show')`.as(
          'no_shows',
        ),
      cancellations:
        sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`.as(
          'cancellations',
        ),
      firstVisit:
        sql<string>`min(${bookings.bookingDate}) filter (where ${bookings.status} = 'completed')`.as(
          'first_visit',
        ),
      lastVisit:
        sql<string>`max(${bookings.bookingDate}) filter (where ${bookings.status} = 'completed')`.as(
          'last_visit',
        ),
    })
    .from(bookings)
    .groupBy(bookings.customerId)
    .as('counted')

  await db
    .update(customers)
    .set({
      visitCount: sql`${counted.visits}`,
      noShowCount: sql`${counted.noShows}`,
      cancellationCount: sql`${counted.cancellations}`,
      firstVisitDate: sql`${counted.firstVisit}`,
      lastVisitDate: sql`${counted.lastVisit}`,
    })
    .from(counted)
    .where(sql`${customers.id} = ${counted.customerId}`)
}

export async function seedBookings(
  db: PostgresJsDatabase<typeof schema>,
  data: BookingSeedData,
): Promise<CompletedBooking[]> {
  const { salonIds, customerIds, vipCustomerId } = data

  const salons = await db
    .select({
      id: schema.salons.id,
      timezone: schema.salons.timezone,
      taxRate: schema.salons.taxRate,
    })
    .from(schema.salons)
    .where(inArray(schema.salons.id, salonIds))
  const staff = await db
    .select({
      id: schema.staff.id,
      salonId: schema.staff.salonId,
      staffCode: schema.staff.staffCode,
    })
    .from(schema.staff)
    .where(inArray(schema.staff.salonId, salonIds))
  const services = await db
    .select({
      id: schema.services.id,
      salonId: schema.services.salonId,
      name: schema.services.name,
      duration: schema.services.duration,
      price: schema.services.price,
      discountPrice: schema.services.discountPrice,
      taxIncluded: schema.services.taxIncluded,
    })
    .from(schema.services)
    .where(inArray(schema.services.salonId, salonIds))

  const now = new Date()
  const planned = BOOKINGS.map((seeded, index) => {
    const salon = found(
      salons.find(({ id }) => id === salonIds[seeded.salon]),
      `salon ${seeded.salon}`,
    )
    const staffIdOf = (staffCode: string): string =>
      found(
        staff.find(
          (member) =>
            member.salonId === salon.id && member.staffCode === staffCode,
        ),
        `the staff member ${staffCode} in salon ${seeded.salon}`,
      ).id
    const customerId =
      seeded.customer === 'vip'
        ? vipCustomerId
        : found(customerIds[seeded.customer], `customer ${seeded.customer}`)
    const completed = seeded.status === 'completed'

    const start = set(
      addDays(startOfDay(new TZDate(now, salon.timezone)), seeded.day),
      { hours: seeded.hours, minutes: seeded.minutes },
    )
    const chosen = seeded.lines.map((line) => ({
      staffId: staffIdOf(line.staffCode),
      service: found(
        services.find(
          (service) =>
            service.salonId === salon.id && service.name === line.service,
        ),
        `the service ${line.service} in salon ${seeded.salon}`,
      ),
    }))
    const lines = chosen.map(({ staffId, service }, sortOrder) => {
      const startTime = addMinutes(
        start,
        sumOf(chosen.slice(0, sortOrder).map((line) => line.service.duration)),
      )
      const endTime = addMinutes(startTime, service.duration)
      const discountAmount =
        service.price - (service.discountPrice ?? service.price)

      return {
        serviceId: service.id,
        staffId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: service.duration,
        price: service.price,
        discountAmount,
        finalPrice: service.price - discountAmount,
        taxIncluded: service.taxIncluded,
        isCompleted: completed,
        completedAt: completed ? endTime.toISOString() : null,
        notes: null,
        sortOrder,
      }
    })

    const duration = sumOf(lines.map((line) => line.duration))
    const end = addMinutes(start, duration)
    const subtotal = sumOf(lines.map((line) => line.price))
    const discountAmount = sumOf(lines.map((line) => line.discountAmount))
    const taxAmount = taxAddedTo(
      sumOf(
        lines
          .filter(({ taxIncluded }) => !taxIncluded)
          .map((line) => line.finalPrice),
      ),
      salon.taxRate,
    )

    const bookedAt = subDays(start, DAYS_BOOKED_AHEAD)
    const dayBefore = subDays(start, 1)
    const statusChanges = statusChangesTo(seeded.status, {
      bookedAt,
      dayBefore,
      end,
    })
    const cancelled = seeded.status === 'cancelled'

    return {
      booking: {
        bookingNumber: `BK-SEED-${String(index + 1).padStart(4, '0')}`,
        salonId: salon.id,
        customerId,
        staffId: staffIdOf(seeded.staffCode),
        bookingDate: format(start, 'yyyy-MM-dd'),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration,
        status: seeded.status,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount: subtotal - discountAmount + taxAmount,
        depositAmount: seeded.depositAmount,
        pointsUsed: null,
        pointsEarned: null,
        customerRequest: seeded.customerRequest,
        internalNotes: null,
        reminderSent: completed,
        reminderSentAt: completed ? dayBefore.toISOString() : null,
        cancelledAt: cancelled ? dayBefore.toISOString() : null,
        cancelledBy: null,
        cancellationReason: cancelled ? CANCELLATION_REASON : null,
        cancellationFee: cancelled ? 0 : null,
        completedAt: completed ? end.toISOString() : null,
        actualStartTime: completed ? start.toISOString() : null,
        actualEndTime: completed ? end.toISOString() : null,
        source: seeded.source,
        ipAddress: null,
        userAgent: null,
        createdAt: bookedAt.toISOString(),
        updatedAt: found(statusChanges.at(-1), 'a status').at.toISOString(),
      },
      lines,
      statusChanges,
    }
  })

  const inserted = await db
    .insert(schema.bookings)
    .values(planned.map(({ booking }) => booking))
    .returning({
      id: schema.bookings.id,
      bookingNumber: schema.bookings.bookingNumber,
    })
  const written = planned.map((plan) => ({
    ...plan,
    id: found(
      inserted.find(
        ({ bookingNumber }) => bookingNumber === plan.booking.bookingNumber,
      ),
      `the booking ${plan.booking.bookingNumber}`,
    ).id,
  }))

  await db
    .insert(schema.bookingServices)
    .values(
      written.flatMap(({ id, lines }) =>
        lines.map((line) => ({ ...line, bookingId: id })),
      ),
    )

  // The history of a booking begins with its creation, which has no status
  // before it.
  await db.insert(schema.bookingStatusHistories).values(
    written.flatMap(({ id, statusChanges }) =>
      statusChanges.map(({ toStatus, at, reason }, position) => ({
        bookingId: id,
        fromStatus: statusChanges[position - 1]?.toStatus ?? null,
        toStatus,
        changedBy: null,
        reason,
        metadata: null,
        createdAt: at.toISOString(),
      })),
    ),
  )

  await countBookingsOfCustomers(db)

  return written
    .filter(({ booking }) => booking.status === 'completed')
    .map(({ id, booking }) => ({
      id,
      salonId: booking.salonId,
      customerId: booking.customerId,
      staffId: booking.staffId,
    }))
}
