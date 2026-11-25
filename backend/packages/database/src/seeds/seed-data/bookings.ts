import { randomUUID } from 'node:crypto'
import { TZDate } from '@date-fns/tz'
import { addDays, addMinutes, format, set, startOfDay, subDays } from 'date-fns'
import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import type { CustomerKey, SeededCustomers } from './customers'
import type { SalonKey, SeededSalons } from './salons'
import type { SeededService, SeededServices, ServiceNames } from './services'
import type { SeededStaff, StaffCodes } from './staff'

type BookingStatus = (typeof schema.bookingStatus.enumValues)[number]

/** The statuses a booking of the seed has. */
type SeededStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

/** A service of a booking and who provides it, both of the salon of the booking. */
type LineAt<S extends SalonKey> = {
  readonly service: ServiceNames[S]
  readonly staffCode: StaffCodes[S]
}

/**
 * A booking of the seed, by what a create request says of a booking: whom
 * it is for and which services begin when. Everything else follows as it
 * does when the API creates a booking: the time and the amounts of a line
 * are those of its service, those of the booking come from its lines, and
 * the day of the visit is the day in the time zone of the salon.
 */
type BookingAt<S extends SalonKey> = {
  readonly salon: S
  readonly customer: CustomerKey
  /** The code of the staff member in charge. */
  readonly staffCode: StaffCodes[S]
  /** Days from today in the time zone of the salon; negative in the past. */
  readonly day: number
  /** The time of the salon at which the first service begins. */
  readonly hours: number
  readonly minutes: number
  /** The services by name, one right after the other, and who provides each. */
  readonly lines: readonly [LineAt<S>, ...LineAt<S>[]]
  readonly status: SeededStatus
  readonly depositAmount: number | null
  readonly customerRequest: string | null
  readonly source: string
}

/** A booking at either salon, which names the staff and the services of that salon alone. */
type SeededBooking = { readonly [S in SalonKey]: BookingAt<S> }[SalonKey]

/** The visits that took place, by the customer and what was done. */
export type VisitKey =
  | 'firstCutAndTreatment'
  | 'secondSignatureCut'
  | 'thirdMensCut'
  | 'vipColorAndCut'
  | 'firstPremiumHeadSpa'
  | 'secondSpaAndCut'

/**
 * The visits that took place, by name: whom they were for and what was
 * done. No two bookings occupy a staff member at the same time, except
 * the two of one afternoon for the staff member who takes two bookings
 * at once.
 */
const VISITS: Readonly<Record<VisitKey, SeededBooking>> = {
  firstCutAndTreatment: {
    salon: 'tokyo',
    customer: 'first',
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
  secondSignatureCut: {
    salon: 'osaka',
    customer: 'second',
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
  thirdMensCut: {
    salon: 'tokyo',
    customer: 'third',
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
  vipColorAndCut: {
    salon: 'tokyo',
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
  firstPremiumHeadSpa: {
    salon: 'osaka',
    customer: 'first',
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
  secondSpaAndCut: {
    salon: 'osaka',
    customer: 'second',
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
}

/** The other bookings, numbered after the visits. */
const LATER_BOOKINGS: readonly SeededBooking[] = [
  // A visit that was called off the day before
  {
    salon: 'tokyo',
    customer: 'first',
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
    salon: 'tokyo',
    customer: 'third',
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
    salon: 'osaka',
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
    salon: 'tokyo',
    customer: 'second',
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
    salon: 'tokyo',
    customer: 'third',
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
    salon: 'tokyo',
    customer: 'first',
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
    salon: 'tokyo',
    customer: 'second',
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
    salon: 'osaka',
    customer: 'third',
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
    salon: 'tokyo',
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
    salon: 'osaka',
    customer: 'first',
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

/** The rows of the seed that a booking names. */
export interface BookingSeedData {
  readonly salons: SeededSalons
  readonly customers: SeededCustomers
  readonly staff: SeededStaff
  readonly services: SeededServices
}

/** A visit that took place, as far as its review and its treatment record refer to it. */
type CompletedBooking = {
  readonly id: string
  readonly salonId: string
  readonly customerId: string
  readonly staffId: string
  /** The day of the visit in the time zone of the salon. */
  readonly bookingDate: string
  /** The services of the visit, in the order they were provided. */
  readonly services: readonly [string, ...string[]]
}

export type SeededVisits = Readonly<Record<VisitKey, CompletedBooking>>

type StatusChange = {
  readonly toStatus: BookingStatus
  readonly at: Date
  readonly reason: string | null
}

/** The statuses a booking went through before the one it has, and that one. */
type History = {
  readonly before: readonly StatusChange[]
  readonly last: StatusChange
}

const CANCELLATION_REASON = 'Customer illness'

/**
 * The statuses a booking of the seed went through, from its creation to
 * the status it has: confirmed the day after it was made, completed when
 * the visit ended, cancelled the day before the visit, and noted as one the
 * customer did not come to when it would have ended.
 */
const historyOf = (
  status: SeededStatus,
  times: { bookedAt: Date; dayBefore: Date; end: Date },
): History => {
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
  const histories: Record<SeededStatus, History> = {
    pending: { before: [], last: created },
    confirmed: { before: [created], last: confirmed },
    completed: {
      before: [created, confirmed],
      last: {
        toStatus: 'completed',
        at: times.end,
        reason: 'Service completed',
      },
    },
    cancelled: {
      before: [created],
      last: {
        toStatus: 'cancelled',
        at: times.dayBefore,
        reason: CANCELLATION_REASON,
      },
    },
    no_show: {
      before: [created, confirmed],
      last: { toStatus: 'no_show', at: times.end, reason: null },
    },
  }

  return histories[status]
}

const sumOf = (amounts: number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/**
 * A booking as it is stored, with its lines and its history, and the visit
 * it is if it took place.
 */
const planOf = <S extends SalonKey>(
  data: BookingSeedData,
  now: Date,
  seeded: BookingAt<S>,
) => {
  const salon = data.salons[seeded.salon]
  const staffIdOf = (staffCode: StaffCodes[S]): string =>
    data.staff[seeded.salon][staffCode]
  const serviceOf = (name: ServiceNames[S]): SeededService =>
    data.services[seeded.salon][name]
  const completed = seeded.status === 'completed'

  const start = set(
    addDays(startOfDay(new TZDate(now, salon.timezone)), seeded.day),
    { hours: seeded.hours, minutes: seeded.minutes },
  )
  const [firstLine, ...otherLines] = seeded.lines
  const services: readonly [string, ...string[]] = [
    serviceOf(firstLine.service).id,
    ...otherLines.map(({ service }) => serviceOf(service).id),
  ]
  const chosen = seeded.lines.map((line) => ({
    staffId: staffIdOf(line.staffCode),
    service: serviceOf(line.service),
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

  const bookedAt = subDays(start, DAYS_BOOKED_AHEAD)
  const dayBefore = subDays(start, 1)
  const { before, last } = historyOf(seeded.status, {
    bookedAt,
    dayBefore,
    end,
  })
  const cancelled = seeded.status === 'cancelled'
  const visit: CompletedBooking = {
    id: randomUUID(),
    salonId: salon.id,
    customerId: data.customers[seeded.customer],
    staffId: staffIdOf(seeded.staffCode),
    bookingDate: format(start, 'yyyy-MM-dd'),
    services,
  }

  return {
    ...visit,
    row: {
      id: visit.id,
      salonId: visit.salonId,
      customerId: visit.customerId,
      staffId: visit.staffId,
      bookingDate: visit.bookingDate,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration,
      status: seeded.status,
      subtotal,
      discountAmount,
      // Every price of the seed includes the tax, and the API adds tax to
      // the lines without it alone.
      taxAmount: 0,
      totalAmount: subtotal - discountAmount,
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
      updatedAt: last.at.toISOString(),
    },
    lines,
    statusChanges: [...before, last],
  }
}

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
): Promise<SeededVisits> {
  const now = new Date()
  const plan = (seeded: SeededBooking) => planOf(data, now, seeded)
  const visits = {
    firstCutAndTreatment: plan(VISITS.firstCutAndTreatment),
    secondSignatureCut: plan(VISITS.secondSignatureCut),
    thirdMensCut: plan(VISITS.thirdMensCut),
    vipColorAndCut: plan(VISITS.vipColorAndCut),
    firstPremiumHeadSpa: plan(VISITS.firstPremiumHeadSpa),
    secondSpaAndCut: plan(VISITS.secondSpaAndCut),
  }
  const planned = [...Object.values(visits), ...LATER_BOOKINGS.map(plan)]

  await db.insert(schema.bookings).values(
    planned.map(({ row }, index) => ({
      ...row,
      bookingNumber: `BK-SEED-${String(index + 1).padStart(4, '0')}`,
    })),
  )

  await db
    .insert(schema.bookingServices)
    .values(
      planned.flatMap(({ id, lines }) =>
        lines.map((line) => ({ ...line, bookingId: id })),
      ),
    )

  // The history of a booking begins with its creation, which has no status
  // before it.
  await db.insert(schema.bookingStatusHistories).values(
    planned.flatMap(({ id, statusChanges }) =>
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

  return visits
}
