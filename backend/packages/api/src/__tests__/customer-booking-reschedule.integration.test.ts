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
  bookingIdSchema,
  type CustomerBookingReschedule,
  type CustomerReach,
  customerIdSchema,
  type DomainError,
  staffIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { BookingRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  epochMs,
  insertCustomer,
  insertMember,
  signedInUser,
  signIn,
  type TestUser,
} from './_shared/auth-helpers'
import {
  DAY,
  dateIn,
  daysAfter,
  inStatus,
  inTokyo,
  iso,
  jst,
  type NewBooking,
  type NewService,
  type NewStaff,
  STARTS,
  slotFixtures,
  weeklyHours,
} from './_shared/slot-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  expectProblem,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  request,
} from './_shared/test-helpers'

const OWN_BOOKINGS = '/api/v1/customers/me/bookings'
const LEDGER = '/api/v1/bookings'
const SALONS = '/api/v1/salons'

/** A well-formed ID that no row has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The day after the day of the tests. */
const NEXT_DAY = daysAfter(DAY, 1)

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const databaseProblem = { status: 500, code: '4003', type: 'database' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID_RESCHEDULE = 'Invalid booking reschedule'
const NOT_A_SLOT =
  'The staff member has no available slot for the service at that time; choose one of the available slots of the salon'
const CUSTOMER_OCCUPIED =
  'The customer has another booking at that time; cancel it first or choose another time'
const NOT_ACCEPTED =
  'This customer profile does not take bookings online; contact the salon to book'
const TIME_ZONE_UNKNOWN =
  'The time zone of the salon is not one that is known, so the times of its hours cannot be told; correct the time zone of the salon first'
const ALREADY_BEGUN =
  'The time of the booking has come, so the customer cannot move it any more; the salon notes what became of the visit'
const NOT_ONE_SLOT =
  'The booking has several services, or a service with another staff member than the one in charge, so the customer cannot move it; contact the salon to move it'
const notMovable = (status: string): string =>
  `A booking that is ${status} cannot be rescheduled; its status has to be draft or pending or confirmed`

const malformedIds: [string, string][] = [
  ['a word', 'haircut'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
]

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** The moment of the clock that the changes of a booking write by. */
const databaseClock = async (): Promise<number> => {
  const [row] = await getTestDbClient()<{ now: number }[]>`
    SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
  `
  if (row === undefined) {
    throw new Error('The database did not tell the time')
  }
  return row.now
}

/** The status and the code of a problem; the status alone of a success. */
const statusAndCode = (response: Response): string =>
  response.status < 400
    ? `${response.status}`
    : `${response.status} ${response.body.code}`

/**
 * A response in a few words: its status and, for a validation problem, the
 * broken rules, or else the code of the problem.
 */
const outcomeOf = (response: Response): string =>
  response.status === 400 && response.body.code === '2001'
    ? `400 ${brokenRules(response).join(',')}`
    : statusAndCode(response)

/** What every response with one booking has around it. */
const meta = {
  correlationId: expect.any(String),
  timestamp: expect.stringMatching(ISO_TIMESTAMP),
  version: 'v1',
}

describe('Customer booking reschedule API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let admin: TestUser
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The account of the customer of the tests. */
  let customer: TestUser
  /** The Authorization header of that customer. */
  let asCustomer: string
  let salonId: string
  let customerId: string
  /** A staff member who works on the day of the tests. */
  let staffId: string
  /** Another one who does. */
  let otherStaffId: string
  /** A cut of an hour. */
  let cutId: string

  const { salon, staffMember, insertService, works, opens, insertBooking } =
    slotFixtures(() => ({ db, salonId, customerId, staffId, cutId }))

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    const signedInAdmin = await signedInUser(app, db, { role: 'admin' })
    admin = signedInAdmin
    asAdmin = signedInAdmin.authorization
    customerId = await insertCustomer(db)
    const signedInCustomer = await signedInUser(app, db, { customerId })
    customer = signedInCustomer
    asCustomer = signedInCustomer.authorization
    salonId = await salon()
    staffId = await staffMember()
    await works()
    otherStaffId = await staffMember()
    await works(DAY, otherStaffId)
    cutId = await insertService()
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Another customer with an account and a profile. */
  const otherCustomer = async () => {
    const id = await insertCustomer(db)
    const account = await signedInUser(app, db, { customerId: id })
    return { ...account, customerId: id }
  }

  const changeCustomer = async (
    changes: Partial<typeof customers.$inferInsert>,
  ): Promise<void> => {
    await db.update(customers).set(changes).where(eq(customers.id, customerId))
  }

  const changeService = async (
    changes: Partial<NewService>,
    id: string = cutId,
  ): Promise<void> => {
    await db.update(services).set(changes).where(eq(services.id, id))
  }

  const changeStaff = async (
    changes: Partial<NewStaff>,
    id: string = staffId,
  ): Promise<void> => {
    await db.update(staff).set(changes).where(eq(staff.id, id))
  }

  /**
   * Books through the API: the cut at ten with the staff member of the
   * tests, as the customer of the tests, unless stated otherwise. Returns
   * the booking as its customer is shown it.
   */
  const booked = async (
    time = '10:00',
    more: Record<string, unknown> = {},
    as: string = asCustomer,
  ) => {
    const response = await authorized(request(app).post(OWN_BOOKINGS), as).send(
      {
        salonId,
        serviceId: cutId,
        staffId,
        startTime: iso(time),
        customerRequest: null,
        ...more,
      },
    )
    expect(response.status).toBe(201)
    return response.body.data
  }

  /** What a customer sends to move a booking: to two on the day, with the staff member of the tests, unless stated otherwise. */
  const to = (time = '14:00', by: string = staffId, date: string = DAY) => ({
    startTime: iso(time, date),
    staffId: by,
  })

  /** Moves a booking; to two on the day and as the customer of the tests unless stated otherwise. */
  const reschedule = (
    id: string,
    body: unknown = to(),
    as: string | null = asCustomer,
  ) =>
    authorized(request(app).post(`${OWN_BOOKINGS}/${id}/reschedule`), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))

  const cancel = (id: string, as: string = asCustomer) =>
    authorized(request(app).post(`${OWN_BOOKINGS}/${id}/cancel`), as).send({
      cancellationReason: null,
    })

  /** The salon confirms a booking in its ledger. */
  const confirm = (id: string) =>
    authorized(request(app).post(`${LEDGER}/${id}/confirm`), asAdmin)

  /** The slots the list of available slots offers for a service, as Tokyo's clocks show them. */
  const offered = async (
    date: string = DAY,
    by: string = staffId,
    service: string = cutId,
  ): Promise<string[]> => {
    const response = await authorized(
      request(app).get(
        `${SALONS}/${salonId}/available-slots?${new URLSearchParams({ serviceId: service, staffId: by, date, limit: '100' })}`,
      ),
      asCustomer,
    )
    expect(response.status).toBe(200)
    return response.body.data.map(({ startTime }: { startTime: string }) =>
      inTokyo(startTime),
    )
  }

  const storedBooking = async (id: string) => {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
    if (row === undefined) {
      throw new Error(`No booking ${id} is stored`)
    }
    return row
  }

  const storedLines = (id: string) =>
    db
      .select()
      .from(bookingServices)
      .where(eq(bookingServices.bookingId, id))
      .orderBy(asc(bookingServices.sortOrder))

  /** A booking and its lines as they are stored, to compare before and after. */
  const stored = async (id: string) => ({
    booking: await storedBooking(id),
    lines: await storedLines(id),
  })

  const historyOf = (id: string) =>
    db
      .select({
        fromStatus: bookingStatusHistories.fromStatus,
        toStatus: bookingStatusHistories.toStatus,
        changedBy: bookingStatusHistories.changedBy,
        reason: bookingStatusHistories.reason,
        metadata: bookingStatusHistories.metadata,
      })
      .from(bookingStatusHistories)
      .where(eq(bookingStatusHistories.bookingId, id))
      .orderBy(
        asc(bookingStatusHistories.createdAt),
        asc(bookingStatusHistories.id),
      )

  /** Where a stored booking is: with whom, and when in Tokyo. */
  const placeOf = async (id: string) => {
    const row = await storedBooking(id)
    return {
      staffId: row.staffId,
      date: row.bookingDate,
      from: inTokyo(new Date(row.startTime).toISOString()),
      until: inTokyo(new Date(row.endTime).toISOString()),
    }
  }

  /** Another day on which the salon is open and the staff member works. */
  const openNextDay = async (by: string = staffId): Promise<void> => {
    await opens(NEXT_DAY)
    await works(NEXT_DAY, by)
  }

  describe('a booking that is moved', () => {
    it('moves a booking to another slot and returns it as the customer is shown it', async () => {
      const created = await booked('10:00', { customerRequest: '窓ぎわで' })

      const response = await reschedule(created.id, to('14:00'))

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(response.body).toEqual({
        data: {
          ...created,
          startTime: iso('14:00'),
          endTime: iso('15:00'),
          services: [
            {
              ...created.services[0],
              startTime: iso('14:00'),
              endTime: iso('15:00'),
            },
          ],
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta,
        links: {
          self: `${OWN_BOOKINGS}/${created.id}`,
          list: OWN_BOOKINGS,
        },
      })
    })

    it('returns what a GET of the booking returns', async () => {
      const created = await booked()

      const response = await reschedule(created.id)
      const read = await authorized(
        request(app).get(`${OWN_BOOKINGS}/${created.id}`),
        asCustomer,
      )

      expect(read.body.data).toEqual(response.body.data)
    })

    it('writes where the booking and its line are, and nothing else of them', async () => {
      const created = await booked()
      const before = await stored(created.id)

      await reschedule(created.id, to('14:00'))

      const after = await stored(created.id)
      expect(after.booking).toEqual({
        ...before.booking,
        startTime: expect.any(String),
        endTime: expect.any(String),
        updatedAt: expect.any(String),
      })
      expect(await placeOf(created.id)).toEqual({
        staffId,
        date: DAY,
        from: '14:00',
        until: '15:00',
      })
      expect(after.lines).toEqual([
        {
          ...before.lines[0],
          startTime: after.booking.startTime,
          endTime: after.booking.endTime,
          updatedAt: expect.any(String),
        },
      ])
      expect(new Date(after.booking.updatedAt).getTime()).toBeGreaterThan(
        new Date(before.booking.updatedAt).getTime(),
      )
      expect(
        new Date(after.lines[0]?.updatedAt ?? '').getTime(),
      ).toBeGreaterThan(new Date(before.lines[0]?.updatedAt ?? '').getTime())
    })

    it('gives the booking and its line to the staff member of the request', async () => {
      const created = await booked()

      const response = await reschedule(created.id, to('10:00', otherStaffId))

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        staffId: otherStaffId,
        startTime: iso('10:00'),
        services: [{ staffId: otherStaffId, startTime: iso('10:00') }],
      })
      expect(await placeOf(created.id)).toMatchObject({
        staffId: otherStaffId,
        from: '10:00',
      })
      expect(
        (await storedLines(created.id)).map((line) => line.staffId),
      ).toEqual([otherStaffId])
    })

    it('moves a booking to another day, which is the day of the visit from then on', async () => {
      await openNextDay()
      const created = await booked()

      const response = await reschedule(
        created.id,
        to('15:30', staffId, NEXT_DAY),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        bookingDate: NEXT_DAY,
        startTime: iso('15:30', NEXT_DAY),
        endTime: iso('16:30', NEXT_DAY),
      })
      expect(await placeOf(created.id)).toEqual({
        staffId,
        date: NEXT_DAY,
        from: '15:30',
        until: '16:30',
      })
    })

    it('gives the slot the booking had back to the list, and takes the one it has', async () => {
      const created = await booked()
      expect(await offered()).not.toContain('10:00')

      await reschedule(created.id, to('14:00'))

      const slots = await offered()
      expect(slots).toEqual(
        STARTS.filter((start) => !['13:30', '14:00', '14:30'].includes(start)),
      )
    })

    it('moves a booking the salon entered for the customer', async () => {
      const id = await insertBooking(jst('10:00'), {
        source: 'phone',
        internalNotes: '電話で受付',
      })

      const response = await reschedule(id)

      expect(response.status).toBe(200)
      expect(JSON.stringify(response.body)).not.toContain('電話で受付')
      expect(await storedBooking(id)).toMatchObject({
        source: 'phone',
        internalNotes: '電話で受付',
      })
      expect(await placeOf(id)).toMatchObject({ from: '14:00' })
    })

    it('keeps the time the booking takes and what it costs, whatever its service is now', async () => {
      const created = await booked()
      await changeService({ duration: 90, price: 9900 })

      // An hour from eleven ends at the break; an hour and a half would not.
      const response = await reschedule(created.id, to('11:00'))

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        startTime: iso('11:00'),
        endTime: iso('12:00'),
        duration: 60,
        subtotal: 6600,
        totalAmount: 6600,
        services: [{ endTime: iso('12:00'), duration: 60, price: 6600 }],
      })
    })

    it('asks for a slot of the time the booking takes, though its service takes less now', async () => {
      const created = await booked()
      await changeService({ duration: 30 })
      expect(await offered()).toContain('11:30')

      const response = await reschedule(created.id, to('11:30'))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_A_SLOT)
    })

    describe('the booking itself is not in its own way', () => {
      it('moves a booking to a time it occupies itself', async () => {
        const created = await booked()
        expect(await offered()).not.toContain('10:30')

        const response = await reschedule(created.id, to('10:30'))

        expect(response.status).toBe(200)
        expect(await placeOf(created.id)).toMatchObject({
          from: '10:30',
          until: '11:30',
        })
      })

      it('does not count the booking among those its service takes that day', async () => {
        const once = await insertService({ maxBookingsPerDay: 1 })
        const created = await booked('10:00', { serviceId: once })
        expect(await offered(DAY, staffId, once)).toEqual([])

        const response = await reschedule(created.id, to('14:00'))

        expect(response.status).toBe(200)
      })

      it('counts the bookings other customers have of the service on the day it goes to', async () => {
        await openNextDay()
        await works(NEXT_DAY, otherStaffId)
        const once = await insertService({ maxBookingsPerDay: 1 })
        const other = await otherCustomer()
        await insertBooking(jst('10:00', NEXT_DAY), {
          service: once,
          by: otherStaffId,
          customerId: other.customerId,
          bookingDate: NEXT_DAY,
        })
        const created = await booked('10:00', { serviceId: once })

        const response = await reschedule(
          created.id,
          to('14:00', staffId, NEXT_DAY),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_A_SLOT)
      })

      it('does not take the booking for another one of the customer at that time', async () => {
        const created = await booked()

        const response = await reschedule(created.id, to('10:30', otherStaffId))

        expect(response.status).toBe(200)
      })
    })
  })

  describe('the status once a booking is moved', () => {
    it('leaves a pending booking pending, and writes nothing into its history', async () => {
      const created = await booked()

      const response = await reschedule(created.id)

      expect(response.body.data.status).toBe('pending')
      expect(await historyOf(created.id)).toHaveLength(1)
    })

    it('leaves a draft a draft', async () => {
      const id = await insertBooking(jst('10:00'), inStatus('draft'))

      const response = await reschedule(id)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('draft')
      expect(await historyOf(id)).toEqual([])
    })

    it('makes a confirmed booking wait for the salon again, and writes who moved it into the history', async () => {
      const created = await booked()
      expect((await confirm(created.id)).status).toBe(200)

      const response = await reschedule(created.id)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('pending')
      expect((await storedBooking(created.id)).status).toBe('pending')
      expect(await historyOf(created.id)).toEqual([
        {
          fromStatus: null,
          toStatus: 'pending',
          changedBy: customer.id,
          reason: null,
          metadata: null,
        },
        {
          fromStatus: 'pending',
          toStatus: 'confirmed',
          changedBy: admin.id,
          reason: null,
          metadata: null,
        },
        {
          fromStatus: 'confirmed',
          toStatus: 'pending',
          changedBy: customer.id,
          reason: null,
          metadata: null,
        },
      ])
    })

    it('lets the salon confirm the booking where it is now', async () => {
      const created = await booked()
      await confirm(created.id)
      await reschedule(created.id)

      const response = await confirm(created.id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        status: 'confirmed',
        startTime: iso('14:00'),
      })
    })
  })

  describe('a request for the time and the staff member the booking has', () => {
    it('changes nothing and returns the booking', async () => {
      const created = await booked()
      const before = await stored(created.id)

      const response = await reschedule(created.id, to('10:00'))

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: created,
        meta,
        links: {
          self: `${OWN_BOOKINGS}/${created.id}`,
          list: OWN_BOOKINGS,
        },
      })
      expect(await stored(created.id)).toEqual(before)
    })

    it('leaves a confirmed booking confirmed', async () => {
      const created = await booked()
      await confirm(created.id)

      const response = await reschedule(created.id, to('10:00'))

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('confirmed')
      expect(await historyOf(created.id)).toHaveLength(2)
    })

    it('is answered though the slot is not offered any more and the salons do not take bookings from the customer', async () => {
      const created = await booked()
      await changeService({ allowOnlineBooking: false })
      await changeCustomer({ customerStatus: 'blacklisted' })

      const response = await reschedule(created.id, to('10:00'))

      expect(response.status).toBe(200)
    })

    it('is a move when the staff member is another one', async () => {
      const created = await booked()
      await confirm(created.id)

      const response = await reschedule(created.id, to('10:00', otherStaffId))

      expect(response.body.data).toMatchObject({
        status: 'pending',
        staffId: otherStaffId,
      })
    })
  })

  describe('only an available slot', () => {
    /** Expects a refusal that leaves the booking where it is. */
    const expectNoSlot = async (
      id: string,
      body: unknown,
      before: Awaited<ReturnType<typeof stored>>,
    ) => {
      const response = await reschedule(id, body)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_A_SLOT)
      expect(await stored(id)).toEqual(before)
    }

    it('moves a booking to every slot the list of available slots offers', async () => {
      const created = await booked('10:00', {}, asCustomer)
      const slots = await offered(DAY, otherStaffId)
      expect(slots).toEqual(STARTS)

      for (const start of slots) {
        const response = await reschedule(created.id, to(start, otherStaffId))

        expect(response.status).toBe(200)
        expect(response.body.data.startTime).toBe(iso(start))
      }
    })

    it.each<[string, string]>([
      ['before the salon opens', '09:00'],
      ['between two slots', '14:15'],
      ['too late to end before the break', '11:30'],
      ['in the break of the staff member', '12:00'],
      ['too late to end before the staff member leaves', '17:30'],
      ['in the night', '03:00'],
    ])('refuses a time %s', async (_case, time) => {
      const created = await booked()

      await expectNoSlot(created.id, to(time), await stored(created.id))
    })

    it('refuses a time that has passed, on a day the salon was open and the staff member worked', async () => {
      const yesterday = dateIn(-1)
      await opens(yesterday)
      await works(yesterday)
      const created = await booked()

      await expectNoSlot(
        created.id,
        to('14:00', staffId, yesterday),
        await stored(created.id),
      )
    })

    it('refuses a day on which the staff member does not work', async () => {
      await opens(NEXT_DAY)
      const created = await booked()

      await expectNoSlot(
        created.id,
        to('14:00', staffId, NEXT_DAY),
        await stored(created.id),
      )
    })

    it('refuses a day the calendar of the salon closes', async () => {
      await opens(NEXT_DAY, { openTime: null, closeTime: null })
      await works(NEXT_DAY)
      const created = await booked()

      await expectNoSlot(
        created.id,
        to('14:00', staffId, NEXT_DAY),
        await stored(created.id),
      )
    })

    it.each<[string, () => Promise<unknown>]>([
      [
        'the salon does not take bookings any more',
        () =>
          db
            .update(salons)
            .set({ isActive: false })
            .where(eq(salons.id, salonId)),
      ],
      [
        'the service is not active any more',
        () => changeService({ isActive: false }),
      ],
      [
        'the service is not booked online any more',
        () => changeService({ allowOnlineBooking: false }),
      ],
      [
        'the service is discontinued',
        () => changeService({ serviceStatus: 'discontinued' }),
      ],
      [
        'the staff member does not take bookings any more',
        () => changeStaff({ canReceiveBookings: false }),
      ],
      [
        'the staff member is not active any more',
        () => changeStaff({ isActive: false }),
      ],
      [
        'the service asks for a level the staff member does not have',
        async () => {
          await changeStaff({ level: 'junior' })
          await changeService({ requiredStaffLevel: 'senior' })
        },
      ],
    ])('refuses every slot once %s', async (_case, change) => {
      const created = await booked()
      await change()

      await expectNoSlot(created.id, to('14:00'), await stored(created.id))
    })

    it('refuses a staff member who is occupied at the time, by a booking of another customer', async () => {
      const other = await otherCustomer()
      await insertBooking(jst('14:00'), { customerId: other.customerId })
      const created = await booked()
      const before = await stored(created.id)

      await expectNoSlot(created.id, to('13:30'), before)
      await expectNoSlot(created.id, to('14:00'), before)
      await expectNoSlot(created.id, to('14:30'), before)
      expect((await reschedule(created.id, to('15:00'))).status).toBe(200)
    })

    it('refuses a slot within the time the staff member keeps free around another booking', async () => {
      await changeStaff({ bufferTimeBefore: 30, bufferTimeAfter: 30 })
      const other = await otherCustomer()
      await insertBooking(jst('14:00'), { customerId: other.customerId })
      const created = await booked()
      const before = await stored(created.id)

      await expectNoSlot(created.id, to('15:00'), before)
      await expectNoSlot(created.id, to('13:00'), before)
      expect((await reschedule(created.id, to('16:00'))).status).toBe(200)
    })

    it('moves a booking into a slot another customer has with a staff member who takes two at once', async () => {
      await changeStaff({ maxConcurrentBookings: 2 }, otherStaffId)
      const other = await otherCustomer()
      await insertBooking(jst('14:00'), {
        customerId: other.customerId,
        by: otherStaffId,
      })
      const created = await booked()

      const response = await reschedule(created.id, to('14:00', otherStaffId))

      expect(response.status).toBe(200)
    })

    it.each<[NewBooking['status'], string]>([
      ['cancelled', '200'],
      ['no_show', '200'],
      ['completed', '409 3003'],
    ])(
      'answers the move to a slot another customer has a %s booking in with %s',
      async (status, outcome) => {
        const other = await otherCustomer()
        await insertBooking(jst('14:00'), {
          customerId: other.customerId,
          ...inStatus(status),
        })
        const created = await booked()

        const response = await reschedule(created.id, to('14:00'))

        expect(statusAndCode(response)).toBe(outcome)
      },
    )
  })

  describe('the customer who moves the booking', () => {
    it.each<[string, Partial<typeof customers.$inferInsert>, string]>([
      ['is a VIP', { customerStatus: 'vip' }, '200'],
      ['is inactive', { customerStatus: 'inactive' }, '409 3003'],
      ['is blacklisted', { customerStatus: 'blacklisted' }, '409 3003'],
      ['has a record that is not active', { isActive: false }, '409 3003'],
    ])('answers a customer who %s with %s', async (_case, changes, outcome) => {
      const created = await booked()
      const before = await stored(created.id)
      await changeCustomer(changes)

      const response = await reschedule(created.id)

      expect(statusAndCode(response)).toBe(outcome)
      if (outcome !== '200') {
        expect(response.body.detail).toBe(NOT_ACCEPTED)
        expect(await stored(created.id)).toEqual(before)
      }
    })

    it('does not tell a customer why the salons do not take their bookings, and still lets them cancel', async () => {
      const created = await booked()
      await changeCustomer({ customerStatus: 'blacklisted' })

      const response = await reschedule(created.id)
      const cancelled = await cancel(created.id)

      expect(response.body.detail).toBe(NOT_ACCEPTED)
      expect(JSON.stringify(response.body)).not.toMatch(/blacklist|inactive/i)
      expect(cancelled.status).toBe(200)
    })

    it.each<[string, string, number, string]>([
      ['ends when the slot begins', '13:00', 60, '200'],
      ['begins when the slot ends', '15:00', 60, '200'],
      ['ends within the slot', '13:30', 60, '409 3003'],
      ['begins within the slot', '14:30', 60, '409 3003'],
    ])(
      'answers a move to a slot when another booking of the customer %s with %s',
      async (_case, time, minutes, outcome) => {
        await insertBooking(jst(time), { by: otherStaffId, minutes })
        const created = await booked()
        const before = await stored(created.id)

        const response = await reschedule(created.id, to('14:00'))

        expect(statusAndCode(response)).toBe(outcome)
        if (outcome !== '200') {
          expect(response.body.detail).toBe(CUSTOMER_OCCUPIED)
          expect(await stored(created.id)).toEqual(before)
        }
      },
    )

    it.each<[NewBooking['status']]>([['cancelled'], ['no_show']])(
      'does not look at a booking of the customer that is %s',
      async (status) => {
        await insertBooking(jst('14:00'), {
          by: otherStaffId,
          ...inStatus(status),
        })
        const created = await booked()

        const response = await reschedule(created.id, to('14:00'))

        expect(response.status).toBe(200)
      },
    )

    it('looks at the bookings the customer has at other salons', async () => {
      const elsewhere = await salon()
      const there = await staffMember({}, elsewhere)
      await insertBooking(jst('14:30'), {
        of: elsewhere,
        by: there,
        service: await insertService({}, elsewhere),
      })
      const created = await booked()

      const response = await reschedule(created.id, to('14:00'))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(CUSTOMER_OCCUPIED)
    })
  })

  describe('a booking the customer does not move', () => {
    it.each<[NewBooking['status'], string]>([
      ['draft', '200'],
      ['pending', '200'],
      ['confirmed', '200'],
      ['in_progress', '409 3003'],
      ['completed', '409 3003'],
      ['cancelled', '409 3003'],
      ['no_show', '409 3003'],
    ])(
      'answers the move of a booking that is %s with %s',
      async (status, outcome) => {
        const id = await insertBooking(jst('10:00'), inStatus(status))
        const before = await stored(id)

        const response = await reschedule(id)

        expect(statusAndCode(response)).toBe(outcome)
        if (outcome !== '200') {
          expect(response.body.detail).toBe(notMovable(status ?? ''))
          expect(await stored(id)).toEqual(before)
        }
      },
    )

    it.each<[string, number, string]>([
      ['began a minute ago', -1, '409 3003'],
      ['was yesterday', -24 * 60, '409 3003'],
      ['begins in two minutes', 2, '200'],
    ])(
      'answers the move of a booking that %s with %s',
      async (_case, minutes, outcome) => {
        const id = await insertBooking(
          new Date(Date.now() + minutes * 60_000),
          inStatus('confirmed'),
        )
        const before = await stored(id)

        const response = await reschedule(id)

        expect(statusAndCode(response)).toBe(outcome)
        if (outcome !== '200') {
          expect(response.body.detail).toBe(ALREADY_BEGUN)
          expect(await stored(id)).toEqual(before)
          expect(await historyOf(id)).toEqual([])
        }
      },
    )

    it('leaves a booking that has begun to the salon, which still moves it', async () => {
      const id = await insertBooking(new Date(Date.now() - 60_000))

      const own = await reschedule(id)
      const bySalon = await authorized(
        request(app).post(`${LEDGER}/${id}/reschedule`),
        asAdmin,
      ).send(to())

      expectProblem(own, notAllowed)
      expect(bySalon.status).toBe(200)
    })

    it('does not move a booking the salon added a service to', async () => {
      const created = await booked()
      const added = await authorized(
        request(app).post(`${LEDGER}/${created.id}/services`),
        asAdmin,
      ).send({
        serviceId: cutId,
        staffId,
        startTime: iso('11:00'),
        notes: null,
      })
      expect(added.status).toBe(201)
      const before = await stored(created.id)

      const response = await reschedule(created.id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_ONE_SLOT)
      expect(await stored(created.id)).toEqual(before)
    })

    it.each<[string, string | null]>([
      ['another staff member than the one in charge', 'other'],
      ['no staff member', null],
    ])(
      'does not move a booking whose service is with %s',
      async (_case, by) => {
        const id = await insertBooking(jst('10:00'), {
          lineBy: by === null ? null : otherStaffId,
        })
        const before = await stored(id)

        const response = await reschedule(id)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_ONE_SLOT)
        expect(await stored(id)).toEqual(before)
      },
    )

    it('answers a booking of another customer like one that does not exist, and leaves it where it is', async () => {
      const other = await otherCustomer()
      const theirs = await booked('10:00', {}, other.authorization)
      const before = await stored(theirs.id)

      const response = await reschedule(theirs.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${theirs.id} was not found`)
      expect(await stored(theirs.id)).toEqual(before)
    })

    it('answers 404 for an ID that no booking has', async () => {
      const response = await reschedule(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
    })

    it.each(malformedIds)('refuses %s for an ID', async (_case, id) => {
      const response = await reschedule(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid booking ID')
      expect(brokenRules(response)[0]).toMatch(/^id:/)
    })
  })

  describe('what a request may be', () => {
    it.each<[string, (staffId: string) => unknown, string]>([
      [
        'no property',
        () => ({}),
        '400 startTime:invalid_type,staffId:invalid_type',
      ],
      [
        'a time with seconds',
        (by) => ({
          startTime: iso('14:00').replace(':00.000Z', ':30.000Z'),
          staffId: by,
        }),
        '400 startTime:custom',
      ],
      [
        'a time that is not in UTC',
        (by) => ({ startTime: `${DAY}T14:00:00+09:00`, staffId: by }),
        '400 startTime:invalid_format',
      ],
      [
        'a date for a time',
        (by) => ({ startTime: DAY, staffId: by }),
        '400 startTime:invalid_format',
      ],
      [
        'a staff member that is no ID',
        () => ({ startTime: iso('14:00'), staffId: 'the usual one' }),
        '400 staffId:invalid_format',
      ],
      [
        'no staff member',
        () => ({ startTime: iso('14:00'), staffId: null }),
        '400 staffId:invalid_type',
      ],
      [
        'a service',
        (by) => ({
          startTime: iso('14:00'),
          staffId: by,
          serviceId: UNKNOWN_ID,
        }),
        '400 serviceId:unrecognized_keys',
      ],
      [
        'a status',
        (by) => ({ startTime: iso('14:00'), staffId: by, status: 'confirmed' }),
        '400 status:unrecognized_keys',
      ],
      ['a list', () => [], '400 :invalid_type'],
    ])('refuses a request with %s', async (_case, body, outcome) => {
      const created = await booked()
      const before = await stored(created.id)

      const response = await reschedule(created.id, body(staffId))

      expect(outcomeOf(response)).toBe(outcome)
      expect(response.body.detail).toBe(INVALID_RESCHEDULE)
      expect(await stored(created.id)).toEqual(before)
    })

    it('answers a body that is not JSON with 400', async () => {
      const created = await booked()

      const response = await authorized(
        request(app).post(`${OWN_BOOKINGS}/${created.id}/reschedule`),
        asCustomer,
      )
        .set('Content-Type', 'application/json')
        .send('{"startTime": ')

      expect(statusAndCode(response)).toBe('400 2002')
    })

    it.each<[string, () => Promise<string>]>([
      ['of another salon', async () => staffMember({}, await salon())],
      [
        'who was deleted',
        async () => {
          await changeStaff(
            { deletedAt: new Date().toISOString() },
            otherStaffId,
          )
          return otherStaffId
        },
      ],
      ['who does not exist', async () => UNKNOWN_ID],
    ])('reports a staff member %s', async (_case, staffMemberOf) => {
      const created = await booked()
      const before = await stored(created.id)

      const response = await reschedule(
        created.id,
        to('14:00', await staffMemberOf()),
      )

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_RESCHEDULE)
      expect(response.body.errors).toEqual([
        {
          field: 'staffId',
          rule: 'not_found',
          message: 'Must name a staff member of the salon',
          value: null,
          constraint: null,
        },
      ])
      expect(await stored(created.id)).toEqual(before)
    })
  })

  describe('the order in which a request is looked at', () => {
    it('looks at the account, then at the ID, then at the request, then for the booking', async () => {
      const wrong = { time: 'later' }
      const owner = await insertMember(db, 'owner', salonId)
      const asOwner = (await signIn(app, owner.email)).authorization
      const withoutProfile = (await signedInUser(app, db)).authorization

      const responses = [
        await reschedule('haircut', wrong, null),
        await reschedule('haircut', wrong, asAdmin),
        await reschedule('haircut', wrong, asOwner),
        await reschedule('haircut', wrong, withoutProfile),
        await reschedule('haircut', wrong),
        await reschedule(UNKNOWN_ID, wrong),
        await reschedule(UNKNOWN_ID),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '403 1005',
        '404 3001',
        expect.stringMatching(/^400 id:/),
        '400 startTime:invalid_type,staffId:invalid_type,time:unrecognized_keys',
        '404 3001',
      ])
    })

    it('looks at the status, then at the time of the booking, then at its services', async () => {
      const closedAndBegun = await insertBooking(
        new Date(Date.now() - 60 * 60_000),
        inStatus('completed'),
      )
      const begunWithAnother = await insertBooking(
        new Date(Date.now() - 60_000),
        { lineBy: otherStaffId },
      )

      const responses = [
        await reschedule(closedAndBegun),
        await reschedule(begunWithAnother),
      ]

      expect(responses.map(({ body }) => body.detail)).toEqual([
        notMovable('completed'),
        ALREADY_BEGUN,
      ])
    })

    it('looks at the services of the booking before it says that nothing changes', async () => {
      const id = await insertBooking(jst('10:00'), { lineBy: otherStaffId })

      const response = await reschedule(id, to('10:00'))

      expect(response.body.detail).toBe(NOT_ONE_SLOT)
    })

    it('reports the staff member before the time zone, the time zone before the customer, the customer before the slot, the slot before the other bookings', async () => {
      const created = await booked()
      await insertBooking(jst('03:00'), { by: otherStaffId })
      const elsewhere = await staffMember({}, await salon())

      await changeCustomer({ customerStatus: 'blacklisted' })
      await db
        .update(salons)
        .set({ timezone: 'Mars/Olympus' })
        .where(eq(salons.id, salonId))
      const staffFirst = await reschedule(created.id, to('03:00', elsewhere))
      const zoneFirst = await reschedule(created.id, to('03:00'))
      await db
        .update(salons)
        .set({ timezone: 'Asia/Tokyo' })
        .where(eq(salons.id, salonId))
      const customerFirst = await reschedule(created.id, to('03:00'))
      await changeCustomer({ customerStatus: 'active' })
      const slotFirst = await reschedule(created.id, to('03:00'))

      expect(outcomeOf(staffFirst)).toBe('400 staffId:not_found')
      expectProblem(zoneFirst, notAllowed)
      expect([
        zoneFirst.body.detail,
        customerFirst.body.detail,
        slotFirst.body.detail,
      ]).toEqual([TIME_ZONE_UNKNOWN, NOT_ACCEPTED, NOT_A_SLOT])
    })

    it('answers 500 for a salon whose stored weekly hours do not have the shape of the model', async () => {
      const created = await booked()
      const before = await stored(created.id)
      await db
        .update(salons)
        .set({
          businessHours: [{ ...weeklyHours(), timezone: 'Asia/Tokyo' }],
        })
        .where(eq(salons.id, salonId))

      const response = await reschedule(created.id)

      expectProblem(response, databaseProblem)
      expect(await stored(created.id)).toEqual(before)
    })
  })

  describe('requests at the same moment', () => {
    it('moves the booking of one of six customers to a slot they all want, each for another service', async () => {
      const wanting = await Promise.all(
        Array.from({ length: 6 }, async () => {
          const other = await otherCustomer()
          const by = await staffMember()
          await works(DAY, by)
          const service = await insertService()
          const theirs = await booked(
            '10:00',
            { staffId: by, serviceId: service },
            other.authorization,
          )
          return { id: theirs.id, authorization: other.authorization }
        }),
      )

      const responses = await Promise.all(
        wanting.map(({ id, authorization }) =>
          reschedule(id, to('14:00'), authorization),
        ),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(
        responses
          .filter(({ status }) => status === 409)
          .map(({ body }) => body.detail),
      ).toEqual(Array.from({ length: 5 }, () => NOT_A_SLOT))
      const places = await Promise.all(wanting.map(({ id }) => placeOf(id)))
      expect(places.filter(({ from }) => from === '14:00')).toHaveLength(1)
    })

    it('gives a slot to one of a customer who moves a booking there and one who books it', async () => {
      const other = await otherCustomer()
      const created = await booked('10:00')

      const rounds = await Promise.all(
        ['13:00', '15:00', '17:00'].map((time) =>
          Promise.all([
            reschedule(created.id, to(time)),
            authorized(
              request(app).post(OWN_BOOKINGS),
              other.authorization,
            ).send({
              salonId,
              serviceId: cutId,
              staffId,
              startTime: iso(time),
              customerRequest: null,
            }),
          ]),
        ),
      )

      // The moves of one booking come one after the other, and each slot
      // goes to the move or to the booking: never to both.
      for (const [moved, made] of rounds) {
        expect([
          ['200', '409 3003'],
          ['409 3003', '201'],
        ]).toContainEqual([
          moved === undefined ? '' : statusAndCode(moved),
          made === undefined ? '' : statusAndCode(made),
        ])
      }
    })

    it('moves one of two bookings of a customer to a time both are sent to, each with another staff member for another service', async () => {
      const first = await booked('10:00')
      const second = await booked('16:00', {
        staffId: otherStaffId,
        serviceId: await insertService(),
      })

      const responses = await Promise.all([
        reschedule(first.id, to('14:00')),
        reschedule(second.id, to('14:00', otherStaffId)),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
      ])
      expect(responses.find(({ status }) => status === 409)?.body.detail).toBe(
        CUSTOMER_OCCUPIED,
      )
    })

    it('moves a confirmed booking once when the customer sends the move six times', async () => {
      const created = await booked()
      await confirm(created.id)

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => reschedule(created.id, to('14:00'))),
      )

      // The first one moves the booking; the others find it where they
      // want it and change nothing.
      expect(responses.map(statusAndCode)).toEqual(
        Array.from({ length: 6 }, () => '200'),
      )
      expect(await historyOf(created.id)).toHaveLength(3)
      expect(await placeOf(created.id)).toMatchObject({ from: '14:00' })
    })

    it('lets one of the customer who moves and the customer who cancels come first, and the other meet what it made', async () => {
      const ids = []
      for (const time of ['10:00', '13:00', '15:00']) {
        ids.push((await booked(time)).id)
      }

      const rounds = await Promise.all(
        ids.map((id, index) =>
          Promise.all([
            reschedule(id, to(['11:00', '14:00', '16:00'][index] ?? '')),
            cancel(id),
          ]),
        ),
      )

      for (const [index, [moved, cancelled]] of rounds.entries()) {
        // Moved and then cancelled, or cancelled and not moved.
        expect(cancelled?.status).toBe(200)
        expect(['200', '409 3003']).toContain(
          moved === undefined ? '' : statusAndCode(moved),
        )
        expect((await storedBooking(ids[index] ?? '')).status).toBe('cancelled')
      }
    })
    // `now()` is the moment a transaction began, which is before what it
    // waited for: by it, a move that waited for the salon to confirm the
    // booking would be noted in the history as the earlier of the two.
    it('writes the times of the moment it got hold of the booking, not of the moment it began to wait', async () => {
      const created = await booked()
      await confirm(created.id)

      const { pending, until } = await db.transaction(async (tx) => {
        await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.id, created.id))
          .for('update')
        const underWay = reschedule(created.id).then((response) => response)
        await pause(300)

        return { pending: underWay, until: await databaseClock() }
      })
      const moved = await pending
      const after = await databaseClock()

      expect(moved.status).toBe(200)
      const lineTimes = await db
        .select({ at: epochMs(bookingServices.updatedAt) })
        .from(bookingServices)
        .where(eq(bookingServices.bookingId, created.id))
      const historyTimes = await db
        .select({ at: epochMs(bookingStatusHistories.createdAt) })
        .from(bookingStatusHistories)
        .where(
          and(
            eq(bookingStatusHistories.bookingId, created.id),
            eq(bookingStatusHistories.fromStatus, 'confirmed'),
          ),
        )
      const times = [
        Date.parse(moved.body.data.updatedAt),
        ...lineTimes.map(({ at }) => at),
        ...historyTimes.map(({ at }) => at),
      ]
      expect(times).toHaveLength(3)
      for (const time of times) {
        expect(time).toBeGreaterThanOrEqual(Math.floor(until))
        expect(time).toBeLessThanOrEqual(Math.ceil(after))
      }
    })
  })

  describe('who moves a booking', () => {
    it.each<[string, () => Promise<string>]>([
      ['an administrator', async () => asAdmin],
      [
        'the owner of the salon',
        async () =>
          (await signIn(app, (await insertMember(db, 'owner', salonId)).email))
            .authorization,
      ],
      [
        'a staff member of the salon',
        async () =>
          (await signIn(app, (await insertMember(db, 'staff', salonId)).email))
            .authorization,
      ],
    ])('answers %s with 403: they keep the ledger', async (_case, signInAs) => {
      const created = await booked()
      const before = await stored(created.id)

      const response = await reschedule(created.id, to(), await signInAs())

      expectProblem(response, forbidden)
      expect(await stored(created.id)).toEqual(before)
    })
  })

  describe('BookingRepository', () => {
    const repository = () => new BookingRepository(db)
    const reach = (of: string = customerId): CustomerReach => ({
      type: 'customer',
      customerId: customerIdSchema.parse(of),
    })
    const mover = (now: Date = new Date()) => ({
      changedBy: userIdSchema.parse(customer.id),
      now,
    })
    /** A request as the use case hands it on. */
    const requestOf = (time = '14:00', by: string = staffId) => ({
      startTime: iso(time),
      staffId: staffIdSchema.parse(by),
    })
    const typeOf = (
      result: Result<CustomerBookingReschedule, DomainError>,
    ): string =>
      result.type === 'success' ? result.data.type : result.error.type

    describe('rebook', () => {
      it('moves the booking and returns the rows', async () => {
        const id = await insertBooking(jst('10:00'), inStatus('confirmed'))

        const result = await repository().rebook(
          bookingIdSchema.parse(id),
          reach(),
          requestOf('14:00', otherStaffId),
          mover(),
        )

        expect(result).toMatchObject({
          type: 'success',
          data: {
            type: 'rescheduled',
            booking: {
              booking: { id, staffId: otherStaffId, status: 'pending' },
              services: [{ staffId: otherStaffId, serviceId: cutId }],
            },
          },
        })
        expect(await placeOf(id)).toEqual({
          staffId: otherStaffId,
          date: DAY,
          from: '14:00',
          until: '15:00',
        })
      })

      it('decides by the moment it is given whether the booking has begun and whether the slot is still to come', async () => {
        const id = bookingIdSchema.parse(await insertBooking(jst('15:00')))
        const beforeOne = new Date(jst('13:00').getTime() - 1)

        const results = [
          await repository().rebook(
            id,
            reach(),
            requestOf(),
            mover(jst('15:00')),
          ),
          await repository().rebook(
            id,
            reach(),
            requestOf('13:00'),
            mover(jst('13:00')),
          ),
          await repository().rebook(
            id,
            reach(),
            requestOf('13:00'),
            mover(beforeOne),
          ),
        ]

        expect(results.map(typeOf)).toEqual([
          'alreadyBegun',
          'notASlot',
          'rescheduled',
        ])
      })

      it('returns the booking as it is when the request names where it is', async () => {
        const id = await insertBooking(jst('10:00'), inStatus('confirmed'))
        const before = await stored(id)

        const result = await repository().rebook(
          bookingIdSchema.parse(id),
          reach(),
          requestOf('10:00'),
          mover(),
        )

        expect(result).toEqual({
          type: 'success',
          data: {
            type: 'unchanged',
            booking: { booking: before.booking, services: before.lines },
          },
        })
        expect(await stored(id)).toEqual(before)
      })

      it('finds no booking outside the reach, and leaves it where it is', async () => {
        const other = await otherCustomer()
        const id = await insertBooking(jst('10:00'))
        const before = await stored(id)

        const result = await repository().rebook(
          bookingIdSchema.parse(id),
          reach(other.customerId),
          requestOf(),
          mover(),
        )

        expect(result).toEqual({ type: 'success', data: { type: 'notFound' } })
        expect(await stored(id)).toEqual(before)
      })

      it('resolves to what stands in the way, and writes nothing', async () => {
        const id = await insertBooking(jst('10:00'))
        const before = await stored(id)
        await changeCustomer({ customerStatus: 'blacklisted' })

        const results = [
          await repository().rebook(
            bookingIdSchema.parse(id),
            reach(),
            requestOf('14:00', UNKNOWN_ID),
            mover(),
          ),
          await repository().rebook(
            bookingIdSchema.parse(id),
            reach(),
            requestOf(),
            mover(),
          ),
        ]

        expect(results.map(typeOf)).toEqual(['invalid', 'customerNotAccepted'])
        expect(await stored(id)).toEqual(before)
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(connection.database).rebook(
          bookingIdSchema.parse(UNKNOWN_ID),
          reach(),
          requestOf(),
          mover(),
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to rebook for customer' },
        })
      })
    })
  })
})
