import {
  bookingServices,
  bookings,
  openingHours,
  type salons,
  services,
  type staff,
  staffSchedules,
} from '@beauty-salon-backend/database'
import type { Database } from '@beauty-salon-backend/infrastructure'
import { insertSalon, insertStaff } from './auth-helpers'

/**
 * A salon in Tokyo with a staff member, a service and a day on which
 * slots can be booked: the times and the rows that the tests of the
 * available slots and of the bookings customers make of them share.
 */

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
const DAY_LENGTH = 24 * HOUR

export type NewOpeningHours = typeof openingHours.$inferInsert
export type NewSchedule = typeof staffSchedules.$inferInsert
export type NewSalon = typeof salons.$inferInsert
export type NewStaff = typeof staff.$inferInsert
export type NewService = typeof services.$inferInsert
export type NewBooking = typeof bookings.$inferInsert
export type DayOfWeek = NewOpeningHours['dayOfWeek']

/** The days of the week in the order `getUTCDay` counts them. */
const DAYS: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

/** The day of the week of a date (`YYYY-MM-DD`). */
export const dayOfWeekOf = (date: string): DayOfWeek =>
  DAYS.at(new Date(`${date}T00:00:00Z`).getUTCDay()) ?? 'sunday'

/** The date the clocks of Tokyo show at a moment (`YYYY-MM-DD`). */
const dateInTokyo = (moment: Date): string =>
  new Date(moment.getTime() + 9 * HOUR).toISOString().slice(0, 10)

/** The date in Tokyo so many days from today; before today when negative. */
export const dateIn = (days: number): string =>
  dateInTokyo(new Date(Date.now() + days * DAY_LENGTH))

/** The date so many days after another. */
export const daysAfter = (date: string, days: number): string =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_LENGTH)
    .toISOString()
    .slice(0, 10)

/** The first date, a week from today or later, that is on a day of the week. */
export const nextOn = (dayOfWeek: DayOfWeek): string => {
  const candidates = Array.from({ length: 7 }, (_, days) => dateIn(7 + days))
  return candidates.find((date) => dayOfWeekOf(date) === dayOfWeek) ?? ''
}

/**
 * The day most tests are about: a month from now, so that every slot of it
 * is still to come whenever the tests run.
 */
export const DAY = dateIn(30)

/** The moment at which the clocks of Tokyo show a time (HH:mm) on a date. */
export const jst = (time: string, date: string = DAY): Date =>
  new Date(`${date}T${time}:00+09:00`)

/** That moment as the API writes it. */
export const iso = (time: string, date: string = DAY): string =>
  jst(time, date).toISOString()

/** The time the clocks of Tokyo show at a moment written in UTC (HH:mm). */
export const inTokyo = (moment: string): string =>
  new Date(new Date(moment).getTime() + 9 * HOUR).toISOString().slice(11, 16)

/** The weekly hours of the day of the week of a date: open from 10:00 to 19:00. */
export const weeklyHours = (
  date: string = DAY,
  overrides: Record<string, unknown> = {},
) => ({
  dayOfWeek: dayOfWeekOf(date),
  operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
  breakSlots: null,
  isClosed: false,
  effectivePeriod: null,
  ...overrides,
})

/**
 * When the staff member of the tests can begin the cut of an hour on the
 * day: the salon is open from 10:00 to 19:00, and they work from 09:00 to
 * 18:00 with a break from 12:00 to 13:00.
 */
export const STARTS = [
  ...['10:00', '10:30', '11:00'],
  ...['13:00', '13:30', '14:00', '14:30', '15:00'],
  ...['15:30', '16:00', '16:30', '17:00'],
]

/** What the rows of a test are written for, unless the test says otherwise. */
export type SlotWorld = {
  db: Database
  salonId: string
  customerId: string
  /** The staff member who works on the day of the tests. */
  staffId: string
  /** The cut of an hour. */
  cutId: string
}

/** What a booking in a status has to have beside it. */
export const inStatus = (
  status: NewBooking['status'],
): Partial<NewBooking> => ({
  status,
  ...(status === 'cancelled' ? { cancelledAt: new Date().toISOString() } : {}),
  ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {}),
  ...(status === 'in_progress'
    ? { actualStartTime: new Date().toISOString() }
    : {}),
})

/**
 * Writers of the rows the slots depend on. `world` is asked at every call:
 * a test file sets up its salon, staff member, service and customer before
 * each test and names them here.
 */
export const slotFixtures = (world: () => SlotWorld) => {
  let rows = 0

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(world().db, {
      timezone: 'Asia/Tokyo',
      businessHours: [weeklyHours()],
      ...overrides,
    })

  /** A staff member of a salon who takes one booking at a time and keeps no time free, unless stated otherwise. */
  const staffMember = (
    overrides: Partial<NewStaff> = {},
    of: string = world().salonId,
  ): Promise<string> =>
    insertStaff(world().db, of, {
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      ...overrides,
    })

  /** A service of a salon as a row; returns its ID. */
  const insertService = async (
    overrides: Partial<NewService> = {},
    of: string = world().salonId,
  ): Promise<string> => {
    const [service] = await world()
      .db.insert(services)
      .values({
        salonId: of,
        name: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
        ...overrides,
      })
      .returning({ id: services.id })
    if (service === undefined) {
      throw new Error('No service was inserted')
    }
    return service.id
  }

  /**
   * A row of the schedule of a staff member for a date: from 09:00 to
   * 18:00 with a break from 12:00 to 13:00 unless stated otherwise.
   */
  const works = async (
    date: string = DAY,
    by: string = world().staffId,
    overrides: Partial<NewSchedule> = {},
  ): Promise<void> => {
    await world()
      .db.insert(staffSchedules)
      .values({
        staffId: by,
        date,
        dayOfWeek: null,
        isRecurring: false,
        isAvailable: true,
        startTime: '09:00',
        endTime: '18:00',
        breakStartTime: '12:00',
        breakEndTime: '13:00',
        ...overrides,
      })
  }

  /** A day off of a staff member on a date. */
  const isOff = (
    date: string = DAY,
    by: string = world().staffId,
  ): Promise<void> =>
    works(date, by, {
      isAvailable: false,
      startTime: null,
      endTime: null,
      breakStartTime: null,
      breakEndTime: null,
    })

  /** A row of the calendar of a salon for a date: open from 10:00 to 19:00 unless stated otherwise. */
  const opens = async (
    date: string = DAY,
    overrides: Partial<NewOpeningHours> = {},
    of: string = world().salonId,
  ): Promise<void> => {
    await world()
      .db.insert(openingHours)
      .values({
        salonId: of,
        dayOfWeek: dayOfWeekOf(date),
        date,
        openTime: '10:00',
        closeTime: '19:00',
        ...overrides,
      })
  }

  /** A date on which the salon is open and the staff member works from 00:00 to 23:59. */
  const allDay = async (
    date: string,
    by: string = world().staffId,
  ): Promise<void> => {
    await opens(date, { openTime: '00:00', closeTime: '23:59' })
    await works(date, by, {
      startTime: '00:00',
      endTime: '23:59',
      breakStartTime: null,
      breakEndTime: null,
    })
  }

  /**
   * Writes a booking with one service line directly: of the cut, by the
   * staff member of the tests, pending and an hour long unless stated
   * otherwise. `lineBy` is the staff member of the line, which is nobody
   * when null. Returns the ID of the booking.
   */
  const insertBooking = async (
    from: Date,
    {
      by = world().staffId,
      lineBy = by,
      minutes = 60,
      service = world().cutId,
      of = world().salonId,
      ...columns
    }: Partial<NewBooking> & {
      by?: string
      lineBy?: string | null
      minutes?: number
      service?: string
      of?: string
    } = {},
  ): Promise<string> => {
    rows += 1
    const { db, customerId } = world()
    const times = {
      startTime: from.toISOString(),
      endTime: new Date(from.getTime() + minutes * MINUTE).toISOString(),
      duration: minutes,
    }
    const [row] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-SLOTS-${String(rows).padStart(4, '0')}`,
        salonId: of,
        customerId,
        staffId: by,
        bookingDate: dateInTokyo(from),
        status: 'pending',
        subtotal: 6600,
        totalAmount: 6600,
        ...times,
        ...columns,
      })
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    await db.insert(bookingServices).values({
      bookingId: row.id,
      serviceId: service,
      staffId: lineBy,
      price: 6600,
      finalPrice: 6600,
      taxIncluded: true,
      ...times,
    })
    return row.id
  }

  return {
    salon,
    staffMember,
    insertService,
    works,
    isOff,
    opens,
    allDay,
    insertBooking,
  }
}
