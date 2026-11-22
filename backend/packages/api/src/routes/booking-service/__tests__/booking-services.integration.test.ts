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
  bookingServiceIdSchema,
  type DomainError,
  type LedgerReach,
  type RequestedBookingService,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { BookingRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { asc, eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  epochMs,
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertStaff,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
} from '../../../__tests__/_shared/auth-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  request,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const BOOKINGS = '/api/v1/bookings'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID_LINE = 'Invalid booking service'
const TOO_MANY = 'A booking has at most 20 services'
const TOO_LONG =
  'Every service of a booking begins within 24 hours of the earliest one'
const LAST_LINE =
  'A booking keeps at least one service; cancel a booking that will not take place'
const TIME_ZONE_UNKNOWN =
  'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first'
const AMOUNTS_TOO_BIG = 'The amounts of a booking must not exceed 2147483647'

type Status = (typeof bookings.status.enumValues)[number]

const STATUSES: Status[] = [
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]

/** The lines of a booking change until the booking is finished. */
const UNFINISHED: Status[] = ['draft', 'pending', 'confirmed', 'in_progress']
const FINISHED: Status[] = ['completed', 'cancelled', 'no_show']

const settled = (status: Status): string =>
  `The services of a booking that is ${status} cannot be changed; its status has to be draft or pending or confirmed or in_progress`

const occupied = (staffId: string): string =>
  `Other bookings occupy staff member ${staffId} at a time of this booking`

/** The properties of a service line, in the order of the alphabet. */
const SERVICE_PROPERTIES = [
  'completedAt',
  'discountAmount',
  'duration',
  'endTime',
  'finalPrice',
  'id',
  'isCompleted',
  'notes',
  'price',
  'serviceId',
  'sortOrder',
  'staffId',
  'startTime',
  'taxIncluded',
]

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** A time of a day of November 2026 in UTC, `HH:MM`; ten in the morning in Tokyo is 01:00. */
const at = (time: string, day = '20'): string => `2026-11-${day}T${time}:00Z`

/** The same time as a response writes it. */
const written = (time: string, day = '20'): string =>
  `2026-11-${day}T${time}:00.000Z`

/** What a booking of one cut from ten in Tokyo says of its lines. */
const ofOneCut = {
  bookingDate: '2026-11-20',
  startTime: written('01:00'),
  endTime: written('02:00'),
  duration: 60,
  subtotal: 6600,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 6600,
}

/** What the visit of three services says of its lines. */
const ofTheVisit = {
  bookingDate: '2026-11-20',
  startTime: written('01:00'),
  endTime: written('04:30'),
  duration: 210,
  subtotal: 21200,
  discountAmount: 1000,
  taxAmount: 700,
  totalAmount: 20900,
}

describe('Booking service lines API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests: in Tokyo, with a tax of 10%. */
  let salonId: string
  let customerId: string
  /** A staff member of the salon who takes one booking at a time and keeps no time free. */
  let staffId: string
  /** A cut of the salon: 60 minutes, 6,600 yen with the tax in it. */
  let cutId: string
  /** A colouring of the salon: 90 minutes, 8,000 yen discounted to 7,000, the tax not in it. */
  let colorId: string

  type NewSalon = typeof salons.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type NewService = typeof services.$inferInsert
  type NewBooking = typeof bookings.$inferInsert
  type Executor = Pick<typeof db, 'insert'>

  /** A service of a salon as a row; returns its ID. */
  const insertService = async (
    overrides: Partial<NewService> = {},
    salon: string = salonId,
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId: salon,
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

  /** A staff member of a salon who takes one booking at a time and keeps no time free, unless stated otherwise. */
  const staffMember = (
    overrides: Partial<NewStaff> = {},
    salon: string = salonId,
  ): Promise<string> =>
    insertStaff(db, salon, {
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      ...overrides,
    })

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(db, { timezone: 'Asia/Tokyo', taxRate: '10.00', ...overrides })

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await salon()
    customerId = await insertCustomer(db)
    staffId = await staffMember()
    cutId = await insertService()
    colorId = await insertService({
      name: 'Colour',
      duration: 90,
      price: 8000,
      discountPrice: 7000,
      taxIncluded: false,
    })
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A service line that keeps every rule: a cut by the staff member from ten in Tokyo. */
  const line = (overrides: Record<string, unknown> = {}) => ({
    serviceId: cutId,
    staffId,
    startTime: at('01:00'),
    notes: null,
    ...overrides,
  })

  /** A line nobody is named for, which is at any time: a cut from eleven in Tokyo unless said otherwise. */
  const free = (overrides: Record<string, unknown> = {}) =>
    line({ staffId: null, startTime: at('02:00'), ...overrides })

  /** A request for a booking that keeps every rule and states nothing that may be unset. */
  const booking = (overrides: Record<string, unknown> = {}) => ({
    salonId,
    customerId,
    staffId,
    depositAmount: null,
    customerRequest: null,
    internalNotes: null,
    source: null,
    services: [line()],
    ...overrides,
  })

  /** Enters a booking; as the admin. */
  const create = (body: object) =>
    authorized(request(app).post(BOOKINGS), asAdmin).send(body)

  /** The booking a request created; anything but 201 fails the test. */
  const created = async (overrides: Record<string, unknown> = {}) => {
    const response = await create(booking(overrides))
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** A booking of one cut at that time; by the staff member of the tests unless another is given. */
  const cutAt = async (
    time: string,
    by: string = staffId,
    day = '20',
  ): Promise<string> =>
    (
      await created({
        staffId: by,
        services: [line({ staffId: by, startTime: at(time, day) })],
      })
    ).id

  /**
   * A visit of three services: a cut by the staff member of the tests from
   * 01:00, a colouring by a second one from 02:00, and a cut nobody is named
   * for from 03:30 to 04:30. The staff member of the tests is in charge.
   */
  const visit = async (day = '20') => {
    const second = await staffMember()
    const data = await created({
      services: [
        line({ startTime: at('01:00', day) }),
        line({
          serviceId: colorId,
          staffId: second,
          startTime: at('02:00', day),
        }),
        line({ staffId: null, startTime: at('03:30', day) }),
      ],
    })
    const id: string = data.id
    const lineIds: string[] = data.services.map(
      (service: { id: string }) => service.id,
    )
    const [cut = '', color = '', last = ''] = lineIds
    return { id, data, second, cut, color, last }
  }

  /**
   * A booking of one cut nobody is named for, from ten in Tokyo: it
   * occupies no one, so there are as many of them as a test wants. Returns
   * its ID.
   */
  const unassigned = async (): Promise<string> =>
    (await created({ services: [line({ staffId: null })] })).id

  /** Reads a booking; as the admin. */
  const read = (id: string) =>
    authorized(request(app).get(`${BOOKINGS}/${id}`), asAdmin)

  /** Where the service lines of a booking are. */
  const linesOf = (bookingId: string): string =>
    `${BOOKINGS}/${bookingId}/services`

  /** Adds a line to a booking; as the admin unless said otherwise. */
  const add = (
    bookingId: string,
    body: object | undefined,
    as: string | null = asAdmin,
  ) => {
    const call = authorized(request(app).post(linesOf(bookingId)), as)
    return body === undefined ? call : call.send(body)
  }

  /** The line a request added; anything but 201 fails the test. */
  const added = async (
    bookingId: string,
    overrides: Record<string, unknown> = {},
  ) => {
    const response = await add(bookingId, free(overrides))
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Reads a line of a booking; as the admin unless said otherwise. */
  const get = (bookingId: string, id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${linesOf(bookingId)}/${id}`), as)

  /** Removes a line from a booking; as the admin unless said otherwise. */
  const remove = (bookingId: string, id: string, as: string | null = asAdmin) =>
    authorized(request(app).delete(`${linesOf(bookingId)}/${id}`), as)

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

  /** Checks that a time of a response is of the milliseconds between two moments. */
  const expectBetween = (
    time: unknown,
    before: number,
    after: number,
  ): void => {
    expect(time).toEqual(expect.stringMatching(ISO_TIMESTAMP))
    const moment = Date.parse(String(time))
    expect(moment).toBeGreaterThanOrEqual(Math.floor(before))
    expect(moment).toBeLessThanOrEqual(Math.ceil(after))
  }

  /** A status with the times the table wants a booking in that status to have, and no others. */
  const inStatus = (status: Status): Partial<NewBooking> => ({
    status,
    cancelledAt: status === 'cancelled' ? at('00:30') : null,
    completedAt: status === 'completed' ? at('02:00') : null,
    actualStartTime: status === 'in_progress' ? at('01:00') : null,
  })

  /** Writes a status directly: neither a history row nor the customer follows. */
  const setStatus = async (id: string, status: Status): Promise<void> => {
    await db.update(bookings).set(inStatus(status)).where(eq(bookings.id, id))
  }

  const stored = async (id: string) => {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
    if (row === undefined) {
      throw new Error(`Booking ${id} is not stored`)
    }
    return row
  }

  const storedLines = (id: string) =>
    db
      .select()
      .from(bookingServices)
      .where(eq(bookingServices.bookingId, id))
      .orderBy(asc(bookingServices.sortOrder))

  const storedHistory = (id: string) =>
    db
      .select()
      .from(bookingStatusHistories)
      .where(eq(bookingStatusHistories.bookingId, id))

  const storedCustomer = async () => {
    const [row] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
    if (row === undefined) {
      throw new Error('The customer is not stored')
    }
    return row
  }

  /** A booking with its lines and its history as they are stored. */
  const everythingOf = async (id: string) => ({
    booking: await stored(id),
    lines: await storedLines(id),
    history: await storedHistory(id),
  })

  /** What a booking says of its lines taken together, as the API writes it. */
  const summaryOf = async (id: string) => {
    const {
      bookingDate,
      startTime,
      endTime,
      duration,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    } = (await read(id)).body.data
    return {
      bookingDate,
      startTime,
      endTime,
      duration,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    }
  }

  /** What is stored of a booking apart from what it says of its lines and the time it was written at. */
  const restOf = async (id: string) => {
    const {
      bookingDate: _bookingDate,
      startTime: _startTime,
      endTime: _endTime,
      duration: _duration,
      subtotal: _subtotal,
      discountAmount: _discountAmount,
      taxAmount: _taxAmount,
      totalAmount: _totalAmount,
      updatedAt: _updatedAt,
      ...rest
    } = await stored(id)
    return rest
  }

  /** The moments a line was written at, in milliseconds. */
  const lineTimesOf = async (id: string) => {
    const [row] = await db
      .select({
        createdAt: epochMs(bookingServices.createdAt),
        updatedAt: epochMs(bookingServices.updatedAt),
      })
      .from(bookingServices)
      .where(eq(bookingServices.id, id))
    if (row === undefined) {
      throw new Error(`Service line ${id} is not stored`)
    }
    return row
  }

  /** The moment a booking was last written at, in milliseconds. */
  const writtenAt = async (id: string): Promise<number> => {
    const [row] = await db
      .select({ at: epochMs(bookings.updatedAt) })
      .from(bookings)
      .where(eq(bookings.id, id))
    if (row === undefined) {
      throw new Error(`Booking ${id} is not stored`)
    }
    return row.at
  }

  let rows = 0

  /**
   * Writes a booking of one cut directly, pending, from a time to an hour
   * later, by a staff member; with no line when `withLine` is false.
   * Returns the ID of the booking.
   */
  const insertBooking = async (
    by: string,
    time: string,
    until: string,
    {
      executor = db,
      withLine = true,
    }: { executor?: Executor; withLine?: boolean } = {},
  ): Promise<string> => {
    rows += 1
    const [row] = await executor
      .insert(bookings)
      .values({
        bookingNumber: `BK-LINES-${String(rows).padStart(4, '0')}`,
        salonId,
        customerId,
        staffId: by,
        bookingDate: '2026-11-20',
        startTime: at(time),
        endTime: at(until),
        duration: 60,
        status: 'pending',
        subtotal: 6600,
        totalAmount: 6600,
      })
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    if (withLine) {
      await executor.insert(bookingServices).values({
        bookingId: row.id,
        serviceId: cutId,
        staffId: by,
        startTime: at(time),
        endTime: at(until),
        duration: 60,
        price: 6600,
        finalPrice: 6600,
        taxIncluded: true,
      })
    }
    return row.id
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** A member of a salon; of the salon of the tests unless another is given. */
  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
      staffOverrides: Partial<NewStaff> = {},
    ): SignInAs =>
    async () => {
      const { email } = await insertMember(
        db,
        role,
        await salonOf(),
        staffOverrides,
      )
      return (await signIn(app, email)).authorization
    }

  /** Everyone who keeps the ledger of the salon of the tests. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Accounts the ledger is closed to. */
  const notKeepers: [string, SignInAs][] = [
    [
      'a customer with a profile',
      async () =>
        (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
          .authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
    [
      'an account of a salon whose staff record is deleted',
      member('staff', async () => salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      }),
    ],
  ]

  /**
   * Tokens that every operation refuses, before anything else is looked at:
   * none, one that names no session, one that has run out.
   */
  const unauthenticated: [
    string,
    () => Promise<string | null>,
    ExpectedProblem,
    string,
  ][] = [
    ['no access token', async () => null, authenticationRequired, CHALLENGE],
    [
      'a token that names no session',
      async () => `Bearer ${'t'.repeat(43)}`,
      invalidToken,
      INVALID_TOKEN_CHALLENGE,
    ],
    [
      'an access token that has run out',
      async () =>
        (
          await insertSession(db, (await insertUser(db)).id, {
            expiresAt: minutesFromNow(-1),
          })
        ).authorization,
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  const deleted = { deletedAt: '2026-11-01T00:00:00.000Z' }

  describe('POST /api/v1/bookings/:bookingId/services', () => {
    it('adds a line to a booking and returns it, a copy of its service, with where it is', async () => {
      const { id } = await created()
      const other = await staffMember()

      const response = await add(
        id,
        line({
          serviceId: colorId,
          staffId: other,
          startTime: at('02:00'),
          notes: '明るめ',
        }),
      )

      expect(response.status).toBe(201)
      // One reading of the clock stamps the new row, to the microsecond
      const [stamps] = await db
        .select({
          createdAt: bookingServices.createdAt,
          updatedAt: bookingServices.updatedAt,
        })
        .from(bookingServices)
        .where(eq(bookingServices.id, response.body.data.id))
      expect(stamps?.updatedAt).toBe(stamps?.createdAt)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const self = `${BOOKINGS}/${id}/services/${response.body.data.id}`
      expect(response.headers['location']).toBe(self)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          serviceId: colorId,
          staffId: other,
          startTime: written('02:00'),
          endTime: written('03:30'),
          duration: 90,
          price: 8000,
          discountAmount: 1000,
          finalPrice: 7000,
          taxIncluded: false,
          isCompleted: false,
          completedAt: null,
          notes: '明るめ',
          sortOrder: 1,
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self, booking: `${BOOKINGS}/${id}` },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(
        SERVICE_PROPERTIES,
      )
    })

    it('stores the line with its booking at the moment it is added, and the booking shows it after the lines it had', async () => {
      const entered = await created()
      const id: string = entered.id
      const before = await databaseClock()

      const data = await added(id, { serviceId: colorId })
      const after = await databaseClock()

      expect((await read(id)).body.data.services).toEqual([
        ...entered.services,
        data,
      ])
      expect(await storedLines(id)).toEqual([
        expect.objectContaining({ sortOrder: 0, serviceId: cutId }),
        expect.objectContaining({
          id: data.id,
          bookingId: id,
          serviceId: colorId,
          staffId: null,
          duration: 90,
          price: 8000,
          discountAmount: 1000,
          finalPrice: 7000,
          taxIncluded: false,
          isCompleted: false,
          completedAt: null,
          notes: null,
          sortOrder: 1,
        }),
      ])
      const times = await lineTimesOf(data.id)
      for (const time of [times.createdAt, times.updatedAt]) {
        expect(time).toBeGreaterThanOrEqual(before)
        expect(time).toBeLessThanOrEqual(after)
      }
    })

    it('says of the booking again what its lines say together, and leaves the rest of it, its history and its customer', async () => {
      const { id } = await created({
        depositAmount: 1000,
        internalNotes: '電話で受付',
      })
      const rest = await restOf(id)
      const history = await storedHistory(id)
      const customer = await storedCustomer()
      const before = await databaseClock()

      await added(id, { serviceId: colorId })
      const after = await databaseClock()

      expect(await summaryOf(id)).toEqual({
        bookingDate: '2026-11-20',
        startTime: written('01:00'),
        endTime: written('03:30'),
        duration: 150,
        subtotal: 14600,
        discountAmount: 1000,
        taxAmount: 700,
        totalAmount: 14300,
      })
      expect(await restOf(id)).toEqual(rest)
      expect(await storedHistory(id)).toEqual(history)
      expect(await storedCustomer()).toEqual(customer)
      expectBetween((await read(id)).body.data.updatedAt, before, after)
    })

    it('begins the visit with the line when it is before the others, on the day that is then in the time zone of the salon', async () => {
      const { id } = await created()

      // Half past eleven in the evening of the 19th in Tokyo.
      await added(id, { startTime: at('14:30', '19') })

      expect(await summaryOf(id)).toEqual({
        ...ofOneCut,
        bookingDate: '2026-11-19',
        startTime: written('14:30', '19'),
        endTime: written('02:00'),
        duration: 690,
        subtotal: 13200,
        totalAmount: 13200,
      })
    })

    it('leaves the times of the visit when the line is within them', async () => {
      const { id } = await visit()

      await added(id, { startTime: at('02:15') })

      expect(await summaryOf(id)).toEqual({
        ...ofTheVisit,
        subtotal: 27800,
        totalAmount: 27500,
      })
    })

    it('adds the tax once to the lines that do not include it, by the rate the salon has at that moment', async () => {
      const treatment = await insertService({
        name: 'Treatment',
        duration: 30,
        price: 995,
        taxIncluded: false,
      })
      const { id } = await created({
        services: [line({ serviceId: treatment, staffId: null })],
      })
      // A tenth of 995 yen, the half yen dropped.
      const ofOne = (await summaryOf(id)).taxAmount

      await added(id, { serviceId: treatment })
      // A tenth of 1,990 yen, which is a yen more than twice 99.
      const ofTwo = await summaryOf(id)
      await db
        .update(salons)
        .set({ taxRate: '8.00' })
        .where(eq(salons.id, salonId))
      // A cut with the tax in it: the lines that were there are taxed again.
      await added(id)
      const atTheNewRate = await summaryOf(id)

      expect(ofOne).toBe(99)
      expect(ofTwo).toMatchObject({
        subtotal: 1990,
        discountAmount: 0,
        taxAmount: 199,
        totalAmount: 2189,
      })
      // 8% of 1,990 yen is 159.2 yen.
      expect(atTheNewRate).toMatchObject({
        subtotal: 8590,
        discountAmount: 0,
        taxAmount: 159,
        totalAmount: 8749,
      })
    })

    it('copies the service as it is at that moment, and keeps the copy when the service changes', async () => {
      const entered = await created()
      const id: string = entered.id
      await db
        .update(services)
        .set({
          duration: 45,
          price: 7000,
          discountPrice: 6500,
          taxIncluded: false,
        })
        .where(eq(services.id, cutId))

      const data = await added(id, { startTime: at('03:00') })
      await db
        .update(services)
        .set({ duration: 30, price: 9000, discountPrice: null })
        .where(eq(services.id, cutId))

      expect(data).toMatchObject({
        startTime: written('03:00'),
        endTime: written('03:45'),
        duration: 45,
        price: 7000,
        discountAmount: 500,
        finalPrice: 6500,
        taxIncluded: false,
      })
      expect((await read(id)).body.data.services).toEqual([
        ...entered.services,
        data,
      ])
      expect(await summaryOf(id)).toMatchObject({
        endTime: written('03:45'),
        duration: 165,
        subtotal: 13600,
        discountAmount: 500,
        taxAmount: 650,
        totalAmount: 13750,
      })
    })

    it('gives the line the place after the last one, and fills no place a removed line left', async () => {
      const { id, color } = await visit()

      await remove(id, color)
      const afterTheGap = await added(id, { startTime: at('05:00') })
      await remove(id, afterTheGap.id)
      const afterTheLast = await added(id, { startTime: at('05:00') })

      expect([afterTheGap.sortOrder, afterTheLast.sortOrder]).toEqual([3, 3])
      expect((await storedLines(id)).map((row) => row.sortOrder)).toEqual([
        0, 2, 3,
      ])
    })

    it('takes a line nobody is named for, and the notes of a line', async () => {
      const { id } = await created()

      const response = await add(id, free({ notes: '前髪のみ' }))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        staffId: null,
        notes: '前髪のみ',
      })
    })

    it.each(UNFINISHED)(
      'adds a line to a booking that is %s, and leaves the status',
      async (status) => {
        const { id } = await created()
        await setStatus(id, status)

        const response = await add(id, free())

        expect(response.status).toBe(201)
        expect((await stored(id)).status).toBe(status)
        expect(await storedLines(id)).toHaveLength(2)
      },
    )

    it.each(FINISHED)(
      'refuses a line for a booking that is %s: what took place is not rewritten',
      async (status) => {
        const { id } = await created()
        await setStatus(id, status)
        const before = await everythingOf(id)

        const response = await add(id, free())

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(settled(status))
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    it('takes a twentieth line and refuses a twenty-first', async () => {
      const { id } = await created({
        services: Array.from({ length: 19 }, () => line({ staffId: null })),
      })

      const twentieth = await add(id, free())
      const before = await everythingOf(id)
      const twentyFirst = await add(id, free())

      expect(twentieth.status).toBe(201)
      expect(twentieth.body.data.sortOrder).toBe(19)
      expectProblem(twentyFirst, notAllowed)
      expect(twentyFirst.body.detail).toBe(TOO_MANY)
      expect(await everythingOf(id)).toEqual(before)
    })

    // The booking has lines from 01:00 and from 02:00 of the 20th.
    it.each([
      ['24 hours after the earliest', at('01:00', '21'), '201'],
      [
        'a minute more than 24 hours after the earliest, though within them of another',
        at('01:01', '21'),
        '409 3003',
      ],
      ['24 hours before the latest', at('02:00', '19'), '201'],
      [
        'a minute more than 24 hours before the latest, though within them of another',
        at('01:59', '19'),
        '409 3003',
      ],
    ])(
      'keeps a booking to one visit: a line that begins %s',
      async (_case, startTime, answer) => {
        const { id } = await created({
          services: [line(), free({ startTime: at('02:00') })],
        })
        const before = await everythingOf(id)

        const response = await add(id, free({ startTime }))

        expect(statusAndCode(response)).toBe(answer)
        if (response.status === 409) {
          expect(response.body.detail).toBe(TOO_LONG)
          expect(await everythingOf(id)).toEqual(before)
        }
      },
    )

    it('measures the visit by the lines the booking has then', async () => {
      const entered = await created({
        services: [line(), free({ startTime: at('02:00') })],
      })
      const id: string = entered.id
      const late = free({ startTime: at('01:01', '21') })

      const refused = await add(id, late)
      await remove(id, entered.services[0].id)
      const taken = await add(id, late)

      expect([refused, taken].map(statusAndCode)).toEqual(['409 3003', '201'])
    })

    describe('what a line refers to', () => {
      it.each<[string, () => Promise<string>]>([
        ['an ID that no service has', async () => UNKNOWN_ID],
        ['a deleted service', () => insertService(deleted)],
        [
          'a service of another salon',
          async () => insertService({}, await salon()),
        ],
        ['the ID of a staff member', async () => staffId],
      ])(
        'refuses %s for the service, and changes nothing',
        async (_case, serviceOf) => {
          const { id } = await created()
          const before = await everythingOf(id)

          const response = await add(id, free({ serviceId: await serviceOf() }))

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_LINE)
          expect(response.body.errors).toEqual([
            issue('serviceId', 'not_found', 'Must name a service of the salon'),
          ])
          expect(await everythingOf(id)).toEqual(before)
        },
      )

      it.each<[string, () => Promise<string>]>([
        ['an ID that no staff member has', async () => UNKNOWN_ID],
        ['a deleted staff member', () => staffMember(deleted)],
        [
          'a staff member of another salon',
          async () => staffMember({}, await salon()),
        ],
        ['the ID of a customer', async () => customerId],
      ])(
        'refuses %s for the staff member, and changes nothing',
        async (_case, staffOf) => {
          const { id } = await created()
          const before = await everythingOf(id)

          const response = await add(id, free({ staffId: await staffOf() }))

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_LINE)
          expect(response.body.errors).toEqual([
            issue(
              'staffId',
              'not_found',
              'Must name a staff member of the salon',
            ),
          ])
          expect(await everythingOf(id)).toEqual(before)
        },
      )

      it('reports the service and the staff member that are not there at once', async () => {
        const { id } = await created()

        const response = await add(
          id,
          free({ serviceId: UNKNOWN_ID, staffId: UNKNOWN_ID }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'serviceId:not_found',
          'staffId:not_found',
        ])
      })

      it('refuses a booking of a salon whose time zone is not known, as a state the salon has to leave first', async () => {
        const { id } = await created()
        await db
          .update(salons)
          .set({ timezone: 'Mars/Olympus' })
          .where(eq(salons.id, salonId))
        const before = await everythingOf(id)

        const response = await add(id, free())

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(TIME_ZONE_UNKNOWN)
        expect(await everythingOf(id)).toEqual(before)
      })

      it.each([
        ['prices are', { price: 1_500_000_000 }, { price: 1_000_000_000 }],
        [
          'total with the tax is',
          { price: 1_900_000_000, taxIncluded: false },
          { price: 100_000_000, taxIncluded: false },
        ],
      ])(
        'refuses a line with which the %s more than a booking can hold',
        async (_case, there, more) => {
          const { id } = await created({
            services: [
              line({ serviceId: await insertService(there), staffId: null }),
            ],
          })
          const before = await everythingOf(id)

          const response = await add(
            id,
            free({ serviceId: await insertService(more) }),
          )

          expectProblem(response, notAllowed)
          expect(response.body.detail).toBe(AMOUNTS_TOO_BIG)
          expect(await everythingOf(id)).toEqual(before)
        },
      )
    })

    describe('a staff member who is occupied', () => {
      it('refuses a line at a time the staff member has another booking, names them, and changes nothing', async () => {
        const { id } = await created()
        await cutAt('05:00')
        const before = await everythingOf(id)

        const response = await add(id, line({ startTime: at('05:30') }))

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(occupied(staffId))
        expect(await everythingOf(id)).toEqual(before)
      })

      // The other booking is from 05:00 to 06:00.
      it.each([
        ['ends when the other begins', '04:00', 201],
        ['begins when the other ends', '06:00', 201],
        ['ends a minute into the other', '04:01', 409],
        ['begins a minute before the other ends', '05:59', 409],
        ['is at the same time', '05:00', 409],
      ])('answers a line that %s with %i', async (_case, time, status) => {
        const { id } = await created()
        await cutAt('05:00')

        const response = await add(id, line({ startTime: at(time) }))

        expect(response.status).toBe(status)
      })

      it.each([
        // The other one is kept free from 04:50 to 06:15, and the line from ten minutes before it begins to fifteen after it ends.
        ['25 minutes after the other ends', '06:25', 201],
        ['24 minutes after the other ends', '06:24', 409],
        ['an hour that ends 25 minutes before the other begins', '03:35', 201],
        ['an hour that ends 24 minutes before the other begins', '03:36', 409],
      ])(
        'keeps the time a staff member keeps free before and after a service: %s',
        async (_case, time, status) => {
          const careful = await staffMember({
            bufferTimeBefore: 10,
            bufferTimeAfter: 15,
          })
          const { id } = await created()
          await cutAt('05:00', careful)

          const response = await add(
            id,
            line({ staffId: careful, startTime: at(time) }),
          )

          expect(response.status).toBe(status)
        },
      )

      it('lets a staff member have as many bookings at once as they take, and no more', async () => {
        const two = await staffMember({ maxConcurrentBookings: 2 })
        const ofTwo = line({ staffId: two, startTime: at('05:00') })

        await cutAt('05:00', two)
        const second = await add(await unassigned(), ofTwo)
        const third = await add(await unassigned(), ofTwo)

        expect([second, third].map(statusAndCode)).toEqual(['201', '409 3003'])
      })

      it.each<[Status, string]>([
        ['draft', '409 3003'],
        ['pending', '409 3003'],
        ['confirmed', '409 3003'],
        ['in_progress', '409 3003'],
        ['completed', '409 3003'],
        ['cancelled', '201'],
        ['no_show', '201'],
      ])(
        'answers a line at the time of a booking that is %s with %s',
        async (status, answer) => {
          const { id } = await created()
          await setStatus(await cutAt('05:00'), status)

          const response = await add(id, line({ startTime: at('05:00') }))

          expect(statusAndCode(response)).toBe(answer)
        },
      )

      it('does not count the lines the booking has itself: one booking occupies a staff member once', async () => {
        const { id } = await created()

        const responses = [
          await add(id, line()),
          await add(id, line({ startTime: at('01:30') })),
        ]

        expect(responses.map(statusAndCode)).toEqual(['201', '201'])
        expect(
          statusAndCode(
            await create(
              booking({ services: [line({ startTime: at('02:00') })] }),
            ),
          ),
        ).toBe('409 3003')
      })

      it('looks at the staff member of the line alone, not at those of the lines the booking has', async () => {
        const other = await staffMember()
        const { id } = await created()
        // Written past the rule: the staff member of the booking is occupied twice.
        await insertBooking(staffId, '01:00', '02:00')

        const responses = [
          await add(id, line({ staffId: other })),
          await add(id, free({ startTime: at('01:00') })),
        ]

        expect(responses.map(statusAndCode)).toEqual(['201', '201'])
      })

      it('lets a line nobody is named for be at any time', async () => {
        const { id } = await created()
        await cutAt('05:00')

        const response = await add(id, free({ startTime: at('05:00') }))

        expect(response.status).toBe(201)
      })

      it('occupies the staff member of the line for the bookings that come after it', async () => {
        const other = await staffMember()
        const { id } = await created()
        await added(id, { staffId: other, startTime: at('05:00') })

        const response = await create(
          booking({
            staffId: other,
            services: [line({ staffId: other, startTime: at('05:30') })],
          }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(occupied(other))
      })
    })

    describe('what a request may be', () => {
      it.each<[string, Record<string, unknown>, string[]]>([
        [
          'a service that is no ID',
          { serviceId: 'cut' },
          ['serviceId:invalid_format'],
        ],
        [
          'a staff member that is no ID',
          { staffId: 'hanako' },
          ['staffId:invalid_format'],
        ],
        [
          'a time with an offset',
          { startTime: '2026-11-20T10:00:00+09:00' },
          ['startTime:invalid_format'],
        ],
        [
          'a time without seconds',
          { startTime: '2026-11-20T01:00Z' },
          ['startTime:invalid_format'],
        ],
        [
          'a time on half a minute',
          { startTime: '2026-11-20T01:00:30Z' },
          ['startTime:custom'],
        ],
        [
          'a day that does not exist',
          { startTime: '2026-02-30T01:00:00Z' },
          ['startTime:invalid_format'],
        ],
        ['notes that say nothing', { notes: ' ' }, ['notes:invalid_format']],
        ['a price', { price: 0 }, ['price:unrecognized_keys']],
        ['an end', { endTime: at('03:00') }, ['endTime:unrecognized_keys']],
        ['a duration', { duration: 5 }, ['duration:unrecognized_keys']],
        [
          'whether the price includes the tax',
          { taxIncluded: false },
          ['taxIncluded:unrecognized_keys'],
        ],
        ['a place', { sortOrder: 0 }, ['sortOrder:unrecognized_keys']],
        [
          'a booking',
          { bookingId: UNKNOWN_ID },
          ['bookingId:unrecognized_keys'],
        ],
        [
          'several broken rules',
          { serviceId: 'cut', startTime: '2026-11-20T01:00:30Z', price: 0 },
          [
            'price:unrecognized_keys',
            'serviceId:invalid_format',
            'startTime:custom',
          ],
        ],
      ])(
        'refuses a line with %s, and changes nothing',
        async (_case, change, rules) => {
          const { id } = await created()
          const before = await everythingOf(id)

          const response = await add(id, free(change))

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_LINE)
          expect(brokenRules(response).toSorted()).toEqual(rules)
          expect(await everythingOf(id)).toEqual(before)
        },
      )

      it.each(['serviceId', 'staffId', 'startTime', 'notes'])(
        'requires %s: nothing of a new line is optional',
        async (property) => {
          const { id } = await created()
          const { [property]: _omitted, ...body }: Record<string, unknown> =
            free()

          const response = await add(id, body)

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual([`${property}:invalid_type`])
        },
      )

      it.each<[string, object | undefined]>([
        ['no body', undefined],
        ['a list of lines', [free()]],
      ])('refuses %s', async (_case, body) => {
        const { id } = await created()

        const response = await add(id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_LINE)
        expect(await storedLines(id)).toHaveLength(1)
      })

      it('answers what is not an ID of a booking with 400, before it looks at the body', async () => {
        const responses = [
          await add('latest', free()),
          await add('BK-TEST-0001', free()),
          await add(`${UNKNOWN_ID}0`, free()),
          await add('latest', {}),
        ]

        for (const response of responses) {
          expectProblem(response, badRequest)
          expect(response.body.detail).toBe('Invalid booking ID')
          expect(brokenRules(response)).toHaveLength(1)
          expect(brokenRules(response)[0]).toMatch(/^bookingId:/)
        }
      })

      it('answers an ID that no booking has with 404', async () => {
        const response = await add(UNKNOWN_ID, free())

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
        expect(await db.$count(bookingServices)).toBe(0)
      })

      it('finds the booking by its ID in capitals, takes the IDs of the line in capitals, and says where the line is by the path it was asked at', async () => {
        const { id } = await created()
        const asked = `/API/V1/Bookings/${id.toUpperCase()}`

        const response = await authorized(
          request(app).post(`${asked}/Services?notify=true`),
          asAdmin,
        ).send(
          line({
            serviceId: colorId.toUpperCase(),
            staffId: staffId.toUpperCase(),
            startTime: at('02:00'),
          }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data).toMatchObject({
          serviceId: colorId,
          staffId,
        })
        const self = `${asked}/Services/${response.body.data.id}`
        expect(response.headers['location']).toBe(self)
        expect(response.body.links).toEqual({ self, booking: asked })
      })
    })
  })

  describe('GET /api/v1/bookings/:bookingId/services/:id', () => {
    it('returns a line of the booking as the booking shows it, with where it is', async () => {
      const { id, data, color } = await visit()

      const response = await get(id, color)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: data.services[1],
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${BOOKINGS}/${id}/services/${color}`,
          booking: `${BOOKINGS}/${id}`,
        },
      })
      expect(response.body.data).toMatchObject({
        id: color,
        serviceId: colorId,
        taxIncluded: false,
        sortOrder: 1,
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(
        SERVICE_PROPERTIES,
      )
    })

    it('returns each line of a booking by its own ID', async () => {
      const { id, data, cut, color, last } = await visit()

      const responses = [
        await get(id, cut),
        await get(id, color),
        await get(id, last),
      ]

      expect(responses.map(({ body }) => body.data)).toEqual(data.services)
    })

    it.each(STATUSES)(
      'returns a line of a booking that is %s',
      async (status) => {
        const entered = await created()
        await setStatus(entered.id, status)

        const response = await get(entered.id, entered.services[0].id)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(entered.services[0])
      },
    )

    it('returns a line that was written with microseconds and completed', async () => {
      const { id } = await created()
      const [row] = await db
        .insert(bookingServices)
        .values({
          bookingId: id,
          serviceId: colorId,
          staffId: null,
          startTime: '2026-11-20 11:00:00.123456+09',
          endTime: '2026-11-20 12:30:00.123456+09',
          duration: 90,
          price: 8000,
          discountAmount: 1000,
          finalPrice: 7000,
          taxIncluded: false,
          isCompleted: true,
          completedAt: '2026-11-20 12:31:00.654321+09',
          notes: '明るめ',
          sortOrder: 5,
        })
        .returning({ id: bookingServices.id })

      const response = await get(id, row?.id ?? '')

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        id: row?.id,
        serviceId: colorId,
        staffId: null,
        startTime: '2026-11-20T02:00:00.123Z',
        endTime: '2026-11-20T03:30:00.123Z',
        duration: 90,
        price: 8000,
        discountAmount: 1000,
        finalPrice: 7000,
        taxIncluded: false,
        isCompleted: true,
        completedAt: '2026-11-20T03:31:00.654Z',
        notes: '明るめ',
        sortOrder: 5,
      })
    })

    it('answers a line of another booking, a line nothing has and a booking nothing has like a line that is not there', async () => {
      const { id, cut } = await visit()
      const other = await created({
        services: [free({ startTime: at('05:00') })],
      })

      const responses = [
        await get(id, other.services[0].id),
        await get(other.id, cut),
        await get(id, UNKNOWN_ID),
        await get(UNKNOWN_ID, cut),
        // The ID of the booking is no ID of a line of it.
        await get(id, id),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses.map((response) => response.body.detail)).toEqual([
        `Booking service ${other.services[0].id} was not found`,
        `Booking service ${cut} was not found`,
        `Booking service ${UNKNOWN_ID} was not found`,
        `Booking service ${cut} was not found`,
        `Booking service ${id} was not found`,
      ])
    })

    it('answers what is not an ID with 400, the booking before the line', async () => {
      const { id, cut } = await visit()

      const responses = [
        await get('latest', 'first'),
        await get(`${UNKNOWN_ID}0`, cut),
        await get(id, 'first'),
        await get(UNKNOWN_ID, `${cut}0`),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toHaveLength(1)
      }
      expect(
        responses.map((response) => [
          response.body.detail,
          response.body.errors[0].field,
        ]),
      ).toEqual([
        ['Invalid booking ID', 'bookingId'],
        ['Invalid booking ID', 'bookingId'],
        ['Invalid booking service ID', 'id'],
        ['Invalid booking service ID', 'id'],
      ])
    })

    it('finds the line by IDs in capitals, and says where it is by the path it was asked at', async () => {
      const { id, data, color } = await visit()
      const asked = `/API/V1/Bookings/${id.toUpperCase()}`

      const response = await authorized(
        request(app).get(`${asked}/Services/${color.toUpperCase()}?expand=1`),
        asAdmin,
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(data.services[1])
      expect(response.body.links).toEqual({
        self: `${asked}/Services/${color}`,
        booking: asked,
      })
    })
  })

  describe('DELETE /api/v1/bookings/:bookingId/services/:id', () => {
    it('removes a line from a booking, answers nothing, and leaves the other lines as they are', async () => {
      const { id, data, cut, color, last } = await visit()

      const response = await remove(id, color)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(response.headers['content-type']).toBeUndefined()
      expect((await read(id)).body.data.services).toEqual([
        data.services[0],
        data.services[2],
      ])
      expect((await storedLines(id)).map((row) => row.id)).toEqual([cut, last])
      expect(statusAndCode(await get(id, color))).toBe('404 3001')
    })

    it('says of the booking again what the lines that stay say together, and leaves the rest of it, its history and its customer', async () => {
      const { id, color } = await visit()
      const rest = await restOf(id)
      const history = await storedHistory(id)
      const customer = await storedCustomer()
      const before = await databaseClock()

      await remove(id, color)
      const after = await databaseClock()

      expect(await summaryOf(id)).toEqual({
        ...ofTheVisit,
        subtotal: 13200,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 13200,
      })
      expect(await restOf(id)).toEqual(rest)
      expect(await storedHistory(id)).toEqual(history)
      expect(await storedCustomer()).toEqual(customer)
      expectBetween((await read(id)).body.data.updatedAt, before, after)
    })

    it('begins the visit with the earliest line that stays and ends it with the latest', async () => {
      const { id, cut, last } = await visit()

      await remove(id, cut)
      const withoutTheFirst = await summaryOf(id)
      await remove(id, last)

      expect(withoutTheFirst).toEqual({
        ...ofTheVisit,
        startTime: written('02:00'),
        duration: 150,
        subtotal: 14600,
        totalAmount: 14300,
      })
      expect(await summaryOf(id)).toEqual({
        ...ofTheVisit,
        startTime: written('02:00'),
        endTime: written('03:30'),
        duration: 90,
        subtotal: 8000,
        totalAmount: 7700,
      })
    })

    it('tells the day of the visit again by the line it then begins with', async () => {
      const entered = await created({
        // Half past eleven in the evening of the 19th in Tokyo, and ten the morning after.
        services: [free({ startTime: at('14:30', '19') }), line()],
      })
      const id: string = entered.id
      const dayBefore = (await summaryOf(id)).bookingDate

      await remove(id, entered.services[0].id)

      expect(dayBefore).toBe('2026-11-19')
      expect(await summaryOf(id)).toEqual(ofOneCut)
    })

    it('taxes the lines that stay by the rate the salon has at that moment', async () => {
      const { id, last } = await visit()
      await db
        .update(salons)
        .set({ taxRate: '8.00' })
        .where(eq(salons.id, salonId))

      await remove(id, last)

      // 8% of the 7,000 yen of the colouring.
      expect(await summaryOf(id)).toEqual({
        ...ofTheVisit,
        endTime: written('03:30'),
        duration: 150,
        subtotal: 14600,
        taxAmount: 560,
        totalAmount: 14160,
      })
    })

    it('keeps the last line of a booking: a booking that will not take place is cancelled', async () => {
      const entered = await created({
        services: [line(), free({ startTime: at('02:00') })],
      })
      const id: string = entered.id

      const first = await remove(id, entered.services[0].id)
      const before = await everythingOf(id)
      const last = await remove(id, entered.services[1].id)

      expect(first.status).toBe(204)
      expectProblem(last, notAllowed)
      expect(last.body.detail).toBe(LAST_LINE)
      expect(await everythingOf(id)).toEqual(before)
    })

    it.each(UNFINISHED)(
      'removes a line from a booking that is %s, and leaves the status',
      async (status) => {
        const { id, color } = await visit()
        await setStatus(id, status)

        const response = await remove(id, color)

        expect(response.status).toBe(204)
        expect((await stored(id)).status).toBe(status)
        expect(await storedLines(id)).toHaveLength(2)
      },
    )

    it.each(FINISHED)(
      'refuses to remove a line from a booking that is %s: what took place is not rewritten',
      async (status) => {
        const { id, color } = await visit()
        await setStatus(id, status)
        const before = await everythingOf(id)

        const response = await remove(id, color)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(settled(status))
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    it('frees the time the line took of its staff member', async () => {
      const { id, second, color } = await visit()
      const wanted = booking({
        staffId: second,
        services: [line({ staffId: second, startTime: at('02:30') })],
      })

      const refused = await create(wanted)
      await remove(id, color)
      const entered = await create(wanted)

      expect([refused, entered].map(statusAndCode)).toEqual(['409 3003', '201'])
    })

    it('hands a line to another staff member by adding a line and removing the old one, after which the first one can be deleted', async () => {
      const { id, second, color } = await visit()
      const third = await staffMember()
      const deleteSecond = () =>
        authorized(
          request(app).delete(`/api/v1/salons/${salonId}/staff/${second}`),
          asAdmin,
        )

      const kept = await deleteSecond()
      await added(id, {
        serviceId: colorId,
        staffId: third,
        startTime: at('02:00'),
      })
      const removed = await remove(id, color)
      const gone = await deleteSecond()

      expect([kept, removed, gone].map(statusAndCode)).toEqual([
        '409 3003',
        '204',
        '204',
      ])
      expect(await summaryOf(id)).toEqual(ofTheVisit)
      expect((await storedLines(id)).map((row) => row.staffId)).toEqual([
        staffId,
        null,
        third,
      ])
    })

    it('answers a line of another booking, a line nothing has and a booking nothing has with 404, and removes nothing', async () => {
      const { id, cut } = await visit()
      const other = await created({
        services: [
          free({ startTime: at('05:00') }),
          free({ startTime: at('06:00') }),
        ],
      })

      const responses = [
        await remove(id, other.services[0].id),
        await remove(other.id, cut),
        await remove(id, UNKNOWN_ID),
        await remove(UNKNOWN_ID, cut),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses.map((response) => response.body.detail)).toEqual([
        `Booking service ${other.services[0].id} was not found`,
        `Booking service ${cut} was not found`,
        `Booking service ${UNKNOWN_ID} was not found`,
        `Booking ${UNKNOWN_ID} was not found`,
      ])
      expect(await db.$count(bookingServices)).toBe(5)
      expect(await summaryOf(id)).toEqual(ofTheVisit)
    })

    it('answers what is not an ID with 400, the booking before the line', async () => {
      const { id, cut } = await visit()

      const responses = [
        await remove('latest', 'first'),
        await remove(`${UNKNOWN_ID}0`, cut),
        await remove(id, 'first'),
        await remove(UNKNOWN_ID, `${cut}0`),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toHaveLength(1)
      }
      expect(
        responses.map((response) => [
          response.body.detail,
          response.body.errors[0].field,
        ]),
      ).toEqual([
        ['Invalid booking ID', 'bookingId'],
        ['Invalid booking ID', 'bookingId'],
        ['Invalid booking service ID', 'id'],
        ['Invalid booking service ID', 'id'],
      ])
      expect(await db.$count(bookingServices)).toBe(3)
    })

    it('refuses to remove a line while the time zone of the salon is not known', async () => {
      const { id, color } = await visit()
      await db
        .update(salons)
        .set({ timezone: 'Mars/Olympus' })
        .where(eq(salons.id, salonId))
      const before = await everythingOf(id)

      const response = await remove(id, color)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(TIME_ZONE_UNKNOWN)
      expect(await everythingOf(id)).toEqual(before)
    })

    it('refuses to remove a line when the tax of the lines that stay has become more than a booking can hold', async () => {
      const dear = await insertService({
        price: 1_900_000_000,
        taxIncluded: false,
      })
      const entered = await created({
        services: [line({ serviceId: dear, staffId: null }), free()],
      })
      const id: string = entered.id
      await db
        .update(salons)
        .set({ taxRate: '20.00' })
        .where(eq(salons.id, salonId))
      const before = await everythingOf(id)

      const response = await remove(id, entered.services[1].id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(AMOUNTS_TOO_BIG)
      expect(await everythingOf(id)).toEqual(before)
    })

    it('finds the line by IDs in capitals, and does not look at a body', async () => {
      const { id, color } = await visit()

      const response = await authorized(
        request(app).delete(
          `/API/V1/Bookings/${id.toUpperCase()}/Services/${color.toUpperCase()}`,
        ),
        asAdmin,
      ).send({ serviceId: 'cut' })

      expect(response.status).toBe(204)
      expect(await storedLines(id)).toHaveLength(2)
    })
  })

  describe('what the contract does not have', () => {
    /** A method and a path below the lines of a booking, `:line` standing for a line that is there. */
    const outside: [
      string,
      'get' | 'put' | 'patch' | 'delete' | 'post',
      string,
    ][] = [
      ['GET on the lines', 'get', ''],
      ['PUT on the lines', 'put', ''],
      ['PATCH on the lines', 'patch', ''],
      ['DELETE on the lines', 'delete', ''],
      ['POST on a line', 'post', '/:line'],
      ['PUT on a line', 'put', '/:line'],
      ['PATCH on a line', 'patch', '/:line'],
      ['GET below a line', 'get', '/:line/complete'],
      ['POST below a line', 'post', '/:line/complete'],
      ['DELETE below a line', 'delete', '/:line/notes'],
    ]

    it.each(outside)(
      'answers %s with 404, whatever is sent',
      async (_case, method, path) => {
        const { id, color } = await visit()
        const address = `${linesOf(id)}${path.replace(':line', color)}`
        const before = await everythingOf(id)

        const responses = [
          await authorized(request(app)[method](address), asAdmin),
          await authorized(request(app)[method](address), asAdmin).send(
            free({ startTime: at('05:00') }),
          ),
        ]

        expect(responses.map(statusAndCode)).toEqual(['404 3001', '404 3001'])
        expect(await everythingOf(id)).toEqual(before)
      },
    )
  })

  describe('who changes the lines of a booking', () => {
    it.each(unauthenticated)(
      'answers %s with 401 before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const { id, color } = await visit()
        const before = await everythingOf(id)
        const authorization = await tokenOf()

        const responses = [
          await add(id, free(), authorization),
          await get(id, color, authorization),
          await remove(id, color, authorization),
          await add('not-an-id', {}, authorization),
          await get('not-an-id', 'not-an-id', authorization),
          await remove(UNKNOWN_ID, 'not-an-id', authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    it.each(keepers)(
      'lets %s add a line to a booking of the salon, read it and remove it',
      async (_case, signInAs) => {
        const authorization = await signInAs()
        const { id, cut } = await visit()

        const addition = await add(
          id,
          free({ startTime: at('05:00') }),
          authorization,
        )
        const responses = [
          addition,
          await get(id, addition.body.data?.id, authorization),
          await remove(id, addition.body.data?.id, authorization),
          await remove(id, cut, authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '201',
          '200',
          '204',
          '204',
        ])
        expect(await storedLines(id)).toHaveLength(2)
      },
    )

    it.each(notKeepers)(
      'forbids %s the lines, before looking at the IDs or the body',
      async (_case, signInAs) => {
        const { id, color } = await visit()
        const before = await everythingOf(id)
        const authorization = await signInAs()

        const responses = [
          await add(id, free(), authorization),
          await get(id, color, authorization),
          await remove(id, color, authorization),
          await add(UNKNOWN_ID, free(), authorization),
          await get(UNKNOWN_ID, color, authorization),
          await remove(id, UNKNOWN_ID, authorization),
          await add('not-an-id', {}, authorization),
          await get('not-an-id', 'not-an-id', authorization),
          await remove(id, 'not-an-id', authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    it('forbids a customer the lines also of a booking of their own', async () => {
      const ownCustomerId = await insertCustomer(db)
      const { authorization } = await signedInUser(app, db, {
        customerId: ownCustomerId,
      })
      const entered = await created({
        customerId: ownCustomerId,
        services: [line(), free()],
      })
      const before = await everythingOf(entered.id)

      const responses = [
        await add(entered.id, free(), authorization),
        await get(entered.id, entered.services[0].id, authorization),
        await remove(entered.id, entered.services[1].id, authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await everythingOf(entered.id)).toEqual(before)
    })

    it.each<[string, SignInAs]>([
      ['the owner of another salon', member('owner', salon)],
      ['a manager of another salon', member('manager', salon)],
      ['a staff member of another salon', member('staff', salon)],
    ])(
      'answers %s like a booking that is not there, whatever status it has',
      async (_case, signInAs) => {
        const authorization = await signInAs()
        const pending = await visit()
        const completed = await created({
          services: [
            free({ startTime: at('05:00') }),
            free({ startTime: at('06:00') }),
          ],
        })
        await setStatus(completed.id, 'completed')
        const ofCompleted: string = completed.services[0].id
        const before = [
          await everythingOf(pending.id),
          await everythingOf(completed.id),
        ]

        const responses = [
          await add(pending.id, free(), authorization),
          await get(pending.id, pending.color, authorization),
          await remove(pending.id, pending.color, authorization),
          await add(completed.id, free(), authorization),
          await get(completed.id, ofCompleted, authorization),
          await remove(completed.id, ofCompleted, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, notFound)
        }
        expect(responses.map((response) => response.body.detail)).toEqual([
          `Booking ${pending.id} was not found`,
          `Booking service ${pending.color} was not found`,
          `Booking ${pending.id} was not found`,
          `Booking ${completed.id} was not found`,
          `Booking service ${ofCompleted} was not found`,
          `Booking ${completed.id} was not found`,
        ])
        expect([
          await everythingOf(pending.id),
          await everythingOf(completed.id),
        ]).toEqual(before)
      },
    )

    it('lets an administrator change the lines of a booking of any salon, and a member those of their salon alone, with what is of the salon of the booking', async () => {
      const elsewhere = await salon()
      const there = await staffMember({}, elsewhere)
      const cutThere = await insertService({}, elsewhere)
      const ofThere = await member('owner', async () => elsewhere)()
      const entered = await created({
        salonId: elsewhere,
        staffId: there,
        services: [line({ serviceId: cutThere, staffId: there })],
      })
      const id: string = entered.id
      const here = await visit()
      const lineThere = free({ serviceId: cutThere })

      const responses = [
        await add(here.id, free(), ofThere),
        await add(here.id, lineThere, ofThere),
        await get(here.id, here.color, ofThere),
        await remove(here.id, here.color, ofThere),
        await add(id, lineThere, ofThere),
        await get(id, entered.services[0].id, ofThere),
        await remove(id, entered.services[0].id, ofThere),
        await add(id, { ...lineThere, staffId: there }),
      ]
      // The service and the staff member are of the salon of the tests.
      const ofAnotherSalon = await add(id, line({ startTime: at('05:00') }))

      expect(responses.map(statusAndCode)).toEqual([
        '404 3001',
        '404 3001',
        '404 3001',
        '404 3001',
        '201',
        '200',
        '204',
        '201',
      ])
      expectProblem(ofAnotherSalon, badRequest)
      expect(brokenRules(ofAnotherSalon)).toEqual([
        'serviceId:not_found',
        'staffId:not_found',
      ])
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const { id, color } = await visit()
      const before = await everythingOf(id)
      const notJson = (call: Test, authorization: string | null): Test =>
        authorized(call, authorization)
          .set('Content-Type', 'application/json')
          .send('{"serviceId": ')

      const responses = [
        await notJson(request(app).post(linesOf(id)), null),
        await notJson(request(app).delete(`${linesOf(id)}/${color}`), null),
        await notJson(request(app).post(linesOf(id)), asAdmin),
        await authorized(request(app).post(linesOf(id)), null)
          .set('Content-Type', 'text/plain')
          .send('a cut, please'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(await everythingOf(id)).toEqual(before)
    })

    it('checks an addition in order: the token, the account, the ID, the body, the booking', async () => {
      const { id } = await created()
      const asCustomer = (await signedInUser(app, db)).authorization
      const elsewhere = await member('owner', salon)()
      const invalid = free({ serviceId: 'cut' })

      const responses = [
        await add('not-an-id', invalid, null),
        await add('not-an-id', invalid, asCustomer),
        await add('not-an-id', invalid),
        await add(UNKNOWN_ID, invalid),
        await add(id, invalid, elsewhere),
        await add(UNKNOWN_ID, free()),
        await add(id, free(), elsewhere),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '400 2001',
        '400 2001',
        '404 3001',
        '404 3001',
      ])
      expect(
        responses.map((response) => response.body.detail).slice(2, 5),
      ).toEqual(['Invalid booking ID', INVALID_LINE, INVALID_LINE])
    })

    it('checks an addition to a booking in order: its status, the number of its lines, the time of the visit, what the line refers to, the time zone, the amounts, who is occupied', async () => {
      const full = await created({
        services: Array.from({ length: 20 }, () => line({ staffId: null })),
      })
      await setStatus(full.id, 'completed')
      const { id } = await created()
      const other = await staffMember()
      await cutAt('05:00', other)
      const dear = await insertService({ price: 2_147_480_000 })
      // Too late for the visit, of a service nothing has.
      const late = free({ serviceId: UNKNOWN_ID, startTime: at('01:01', '21') })
      // Of a staff member who is occupied then.
      const busy = { staffId: other, startTime: at('05:00') }
      const setTimeZone = (timezone: string) =>
        db.update(salons).set({ timezone }).where(eq(salons.id, salonId))

      const settledFirst = await add(full.id, late)
      await setStatus(full.id, 'pending')
      const responses = [
        settledFirst,
        await add(full.id, late),
        await add(id, late),
      ]
      await setTimeZone('Mars/Olympus')
      responses.push(
        await add(id, line({ ...busy, serviceId: UNKNOWN_ID })),
        await add(id, line({ ...busy, serviceId: dear })),
      )
      await setTimeZone('Asia/Tokyo')
      responses.push(
        await add(id, line({ ...busy, serviceId: dear })),
        await add(id, line(busy)),
      )

      expect(
        responses.map((response) => [
          statusAndCode(response),
          response.body.detail,
        ]),
      ).toEqual([
        ['409 3003', settled('completed')],
        ['409 3003', TOO_MANY],
        ['409 3003', TOO_LONG],
        ['400 2001', INVALID_LINE],
        ['409 3003', TIME_ZONE_UNKNOWN],
        ['409 3003', AMOUNTS_TOO_BIG],
        ['409 3003', occupied(other)],
      ])
    })

    it('checks a read in order: the token, the account, the ID of the booking, the ID of the line, the line', async () => {
      const { id, color } = await visit()
      const asCustomer = (await signedInUser(app, db)).authorization
      const elsewhere = await member('owner', salon)()

      const responses = [
        await get('not-an-id', 'not-an-id', null),
        await get('not-an-id', 'not-an-id', asCustomer),
        await get('not-an-id', 'not-an-id'),
        await get(UNKNOWN_ID, 'not-an-id'),
        await get(UNKNOWN_ID, color),
        await get(id, color, elsewhere),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '400 2001',
        '404 3001',
        '404 3001',
      ])
    })

    it('checks a removal in order: the token, the account, the IDs, the booking, the line, the status, the last line, the time zone', async () => {
      const { id, color } = await visit()
      const done = await created({
        services: [free({ startTime: at('05:00') })],
      })
      const asCustomer = (await signedInUser(app, db)).authorization
      const elsewhere = await member('owner', salon)()
      await setStatus(done.id, 'completed')
      const ofDone: string = done.services[0].id

      const responses = [
        await remove('not-an-id', 'not-an-id', null),
        await remove('not-an-id', 'not-an-id', asCustomer),
        await remove('not-an-id', 'not-an-id'),
        await remove(UNKNOWN_ID, 'not-an-id'),
        await remove(UNKNOWN_ID, color),
        await remove(id, color, elsewhere),
        await remove(done.id, UNKNOWN_ID),
        await remove(done.id, ofDone),
      ]
      await db
        .update(salons)
        .set({ timezone: 'Mars/Olympus' })
        .where(eq(salons.id, salonId))
      await setStatus(done.id, 'pending')
      responses.push(await remove(done.id, ofDone), await remove(id, color))

      expect(
        responses.map((response) => [
          statusAndCode(response),
          response.body.detail,
        ]),
      ).toEqual([
        ['401 1001', expect.any(String)],
        ['403 1005', expect.any(String)],
        ['400 2001', 'Invalid booking ID'],
        ['400 2001', 'Invalid booking service ID'],
        ['404 3001', `Booking ${UNKNOWN_ID} was not found`],
        ['404 3001', `Booking ${id} was not found`],
        ['404 3001', `Booking service ${UNKNOWN_ID} was not found`],
        ['409 3003', settled('completed')],
        ['409 3003', LAST_LINE],
        ['409 3003', TIME_ZONE_UNKNOWN],
      ])
    })
  })

  describe('requests at the same moment', () => {
    // A line holds its staff member before it looks at who is occupied, as
    // a new booking does: the bookings of a staff member are written one
    // after the other and each sees the ones before it.
    it('adds one of two lines that want the same time of a staff member', async () => {
      const pairs = await Promise.all(
        Array.from({ length: 4 }, async () => ({
          by: await staffMember(),
          first: await unassigned(),
          second: await unassigned(),
        })),
      )

      const rounds = await Promise.all(
        pairs.map(({ by, first, second }) =>
          Promise.all([
            add(first, line({ staffId: by, startTime: at('05:00') })),
            add(second, line({ staffId: by, startTime: at('05:30') })),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode).toSorted()).toEqual(['201', '409 3003'])
      }
    })

    it('adds a line at a time, or enters a booking or moves one there, and never both', async () => {
      const there = await Promise.all(
        Array.from({ length: 6 }, async (_unused, index) => {
          const by = await staffMember()
          return {
            by,
            id: await unassigned(),
            moved: index % 2 === 0 ? null : await cutAt('07:00', by),
          }
        }),
      )

      const rounds = await Promise.all(
        there.map(({ by, id, moved }) =>
          Promise.all([
            add(id, line({ staffId: by, startTime: at('05:00') })),
            moved === null
              ? create(
                  booking({
                    staffId: by,
                    services: [line({ staffId: by, startTime: at('05:30') })],
                  }),
                )
              : authorized(
                  request(app).post(`${BOOKINGS}/${moved}/reschedule`),
                  asAdmin,
                ).send({ startTime: at('05:30'), staffId: by }),
          ]),
        ),
      )

      for (const [addition, other] of rounds) {
        expect([
          ['201', '409 3003'],
          ['409 3003', '201'],
          ['409 3003', '200'],
        ]).toContainEqual([statusAndCode(addition), statusAndCode(other)])
      }
    })

    it('adds as many of six lines at a time as the staff member takes at once', async () => {
      const two = await staffMember({ maxConcurrentBookings: 2 })
      const ids: string[] = []
      for (let count = 0; count < 6; count += 1) {
        ids.push(await unassigned())
      }

      const responses = await Promise.all(
        ids.map((id) =>
          add(id, line({ staffId: two, startTime: at('05:00') })),
        ),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '201',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
    })

    // The staff member is held alone. Lines that held them together would
    // each look at who is occupied before any of them was written.
    it('adds one line when lines that waited for the staff member get to them together', async () => {
      const other = await staffMember()
      const ids = [await unassigned(), await unassigned(), await unassigned()]

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, other))
          .for('update')
        const underWay = Promise.all(
          ids.map((id) =>
            add(id, line({ staffId: other, startTime: at('05:00') })).then(
              (response) => response,
            ),
          ),
        )
        await pause(300)

        return { pending: underWay }
      })
      const responses = await pending

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
        '409 3003',
      ])
    })

    it('waits for a booking of the staff member that is being written, then finds the staff member occupied', async () => {
      const { id } = await created()
      const other = await staffMember()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, other))
          .for('update')
        await insertBooking(other, '05:00', '06:00', { executor: tx })
        const underWay = add(
          id,
          line({ staffId: other, startTime: at('05:30') }),
        ).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(occupied(other))
    })

    // Every change of a booking holds it first, so of two on one booking the
    // second meets what the first made of it.
    it('gives lines that are added to one booking at the same moment places of their own, and sums up all of them', async () => {
      const { id } = await created()

      const responses = await Promise.all(
        ['02:00', '03:00', '04:00', '05:00'].map((time) =>
          add(id, free({ serviceId: colorId, startTime: at(time) })),
        ),
      )

      expect(responses.map(statusAndCode)).toEqual(['201', '201', '201', '201'])
      expect(
        responses.map(({ body }) => body.data.sortOrder).toSorted(),
      ).toEqual([1, 2, 3, 4])
      expect(await summaryOf(id)).toEqual({
        ...ofOneCut,
        endTime: written('06:30'),
        duration: 330,
        subtotal: 38600,
        discountAmount: 4000,
        taxAmount: 2800,
        totalAmount: 37400,
      })
    })

    it('takes the twentieth line once of three times', async () => {
      const { id } = await created({
        services: Array.from({ length: 19 }, () => line({ staffId: null })),
      })

      const responses = await Promise.all([
        add(id, free()),
        add(id, free()),
        add(id, free()),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
        '409 3003',
      ])
      expect(await storedLines(id)).toHaveLength(20)
    })

    it('keeps one line of a booking when both of its lines are removed at the same moment', async () => {
      const entered = await Promise.all(
        ['11', '12', '13', '14'].map((day) =>
          created({
            services: [
              free({ startTime: at('01:00', day) }),
              free({ serviceId: colorId, startTime: at('02:00', day) }),
            ],
          }),
        ),
      )

      const rounds = await Promise.all(
        entered.map(({ id, services: [first, second] }) =>
          Promise.all([remove(id, first.id), remove(id, second.id)]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode).toSorted()).toEqual(['204', '409 3003'])
      }
      for (const { id } of entered) {
        const [left] = await storedLines(id)
        expect(await storedLines(id)).toHaveLength(1)
        expect(await summaryOf(id)).toMatchObject(
          left?.serviceId === cutId
            ? { duration: 60, subtotal: 6600, taxAmount: 0, totalAmount: 6600 }
            : {
                duration: 90,
                subtotal: 8000,
                taxAmount: 700,
                totalAmount: 7700,
              },
        )
      }
    })

    it('removes a line once of four times', async () => {
      const { id, color } = await visit()

      const responses = await Promise.all(
        Array.from({ length: 4 }, () => remove(id, color)),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '204',
        '404 3001',
        '404 3001',
        '404 3001',
      ])
      expect(await summaryOf(id)).toMatchObject({
        subtotal: 13200,
        taxAmount: 0,
      })
    })

    it('takes an addition and a removal of one booking at the same moment, and sums up what is there after both', async () => {
      const visits: { id: string; color: string; day: string }[] = []
      for (const day of ['11', '12', '13', '14']) {
        visits.push({ ...(await visit(day)), day })
      }

      const rounds = await Promise.all(
        visits.map(({ id, color, day }) =>
          Promise.all([
            add(id, free({ serviceId: colorId, startTime: at('05:00', day) })),
            remove(id, color),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode)).toEqual(['201', '204'])
      }
      for (const { id, day } of visits) {
        expect(await summaryOf(id)).toEqual({
          ...ofTheVisit,
          bookingDate: `2026-11-${day}`,
          startTime: written('01:00', day),
          endTime: written('06:30', day),
          duration: 330,
        })
        expect((await storedLines(id)).map((row) => row.sortOrder)).toEqual([
          0, 2, 3,
        ])
      }
    })

    it('waits for a change of the status that is being written, then meets what it made of the booking', async () => {
      const { id, color } = await visit()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set(inStatus('cancelled'))
          .where(eq(bookings.id, id))
        const underWay = Promise.all([
          add(id, free({ startTime: at('05:00') })).then(
            (response) => response,
          ),
          remove(id, color).then((response) => response),
        ])
        await pause(300)

        return { pending: underWay }
      })
      const responses = await pending

      for (const response of responses) {
        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(settled('cancelled'))
      }
      expect(await storedLines(id)).toHaveLength(3)
    })

    // The salon tells the day of the visit and the rate of the tax, so it
    // is held while a booking is summed up, as it is while one is entered.
    it('waits for a change of the salon that is being written, then sums the booking up by what the salon says', async () => {
      const id = await unassigned()
      const other = await visit()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(salons)
          .set({ timezone: 'America/New_York', taxRate: '8.00' })
          .where(eq(salons.id, salonId))
        const underWay = Promise.all([
          add(id, free({ serviceId: colorId })).then((response) => response),
          remove(other.id, other.last).then((response) => response),
        ])
        await pause(300)

        return { pending: underWay }
      })
      const responses = await pending

      // Ten in the morning in Tokyo is eight in the evening before in New York.
      expect(responses.map(statusAndCode)).toEqual(['201', '204'])
      expect(await summaryOf(id)).toMatchObject({
        bookingDate: '2026-11-19',
        taxAmount: 560,
        totalAmount: 14160,
      })
      expect(await summaryOf(other.id)).toMatchObject({
        bookingDate: '2026-11-19',
        taxAmount: 560,
        totalAmount: 14160,
      })
    })

    // The service is held while the line is planned from it: the line is a
    // copy of what the service says, not of what it said before a change
    // that was under way.
    it('waits for a change of the service that is being written, then copies what the service says', async () => {
      const { id } = await created()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(services)
          .set({ price: 7700, duration: 75 })
          .where(eq(services.id, cutId))
        const underWay = add(id, free()).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        price: 7700,
        duration: 75,
        endTime: written('03:15'),
      })
    })

    // What an unfinished booking refers to is not deleted. A line holds its
    // service and its staff member, so a delete of either waits for the
    // line and then finds it.
    it('makes a delete of the service wait for a line of it that is being added, and the delete then leaves the service to the line', async () => {
      const { id } = await created()
      const other = await staffMember()
      const treatment = await insertService({ name: 'Treatment' })

      const { pending } = await db.transaction(async (tx) => {
        // The line waits here, with the service already in its hands.
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, other))
          .for('update')
        const addition = add(
          id,
          line({
            serviceId: treatment,
            staffId: other,
            startTime: at('05:00'),
          }),
        ).then((response) => response)
        await pause(300)
        const deletion = authorized(
          request(app).delete(
            `/api/v1/salons/${salonId}/services/${treatment}`,
          ),
          asAdmin,
        ).then((response) => response)
        await pause(300)

        return { pending: Promise.all([addition, deletion]) }
      })
      const responses = await pending

      expect(responses.map(statusAndCode)).toEqual(['201', '409 3003'])
      const [service] = await db
        .select({ deletedAt: services.deletedAt })
        .from(services)
        .where(eq(services.id, treatment))
      expect(service).toEqual({ deletedAt: null })
    })

    it.each<[string, 'services' | 'staff']>([
      ['service', 'services'],
      ['staff member', 'staff'],
    ])(
      'never leaves an unfinished booking with a line of a %s that was deleted, when the line and the delete come together',
      async (_case, kind) => {
        const { id } = await created()
        for (let round = 0; round < 6; round += 1) {
          const named =
            kind === 'services'
              ? await insertService({ name: `Treatment ${round}` })
              : await staffMember()
          const startTime = at(`0${round + 2}:00`)
          const lines = (await storedLines(id)).length

          const [addition, deletion] = await Promise.all([
            add(
              id,
              kind === 'services'
                ? free({ serviceId: named, startTime })
                : line({ staffId: named, startTime }),
            ),
            authorized(
              request(app).delete(`/api/v1/salons/${salonId}/${kind}/${named}`),
              asAdmin,
            ),
          ])

          const [row] =
            kind === 'services'
              ? await db
                  .select({ deletedAt: services.deletedAt })
                  .from(services)
                  .where(eq(services.id, named))
              : await db
                  .select({ deletedAt: staff.deletedAt })
                  .from(staff)
                  .where(eq(staff.id, named))
          expect([
            statusAndCode(addition),
            statusAndCode(deletion),
            (await storedLines(id)).length - lines,
            row?.deletedAt === null,
          ]).toEqual(
            addition.status === 201
              ? ['201', '409 3003', 1, true]
              : ['400 2001', '204', 0, false],
          )
        }
      },
    )

    it('removes a booking while a line is added to it: the line is added or finds no booking, and nothing of the booking is left', async () => {
      const ids: string[] = []
      for (let count = 0; count < 6; count += 1) {
        ids.push(await unassigned())
      }

      const rounds = await Promise.all(
        ids.map((id) =>
          Promise.all([
            add(id, free()),
            authorized(request(app).delete(`${BOOKINGS}/${id}`), asAdmin),
          ]),
        ),
      )

      for (const [addition, removal] of rounds) {
        expect(['201', '404 3001']).toContain(statusAndCode(addition))
        expect(removal.status).toBe(204)
      }
      expect(await db.$count(bookings)).toBe(0)
      expect(await db.$count(bookingServices)).toBe(0)
    })

    // `now()` is the moment a transaction began, which is before what it
    // waited for: by it, a change that came second would be noted as the
    // earlier one.
    it('writes the times of the moment it got hold of the booking, not of the moment it began to wait', async () => {
      const id = await unassigned()
      const other = await visit()

      const { pending, until } = await db.transaction(async (tx) => {
        for (const held of [id, other.id]) {
          await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, held))
            .for('update')
        }
        const underWay = Promise.all([
          add(id, free()).then((response) => response),
          remove(other.id, other.color).then((response) => response),
        ])
        await pause(300)

        return { pending: underWay, until: await databaseClock() }
      })
      const [addition, removal] = await pending
      const after = await databaseClock()

      expect([addition, removal].map(statusAndCode)).toEqual(['201', '204'])
      const times = await lineTimesOf(addition.body.data.id)
      for (const time of [
        times.createdAt,
        times.updatedAt,
        await writtenAt(id),
        await writtenAt(other.id),
      ]) {
        expect(time).toBeGreaterThanOrEqual(until)
        expect(time).toBeLessThanOrEqual(after)
      }
    })
  })

  describe('BookingRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new BookingRepository(db)
    const everySalon: LedgerReach = { type: 'everySalon' }
    const salonOnly = (id: string): LedgerReach => ({
      type: 'salon',
      salonId: salonIdSchema.parse(id),
    })

    /** A line as a request that passed its rules asks for it: a cut nobody is named for from eleven in Tokyo. */
    const asked = (
      overrides: Partial<RequestedBookingService> = {},
    ): RequestedBookingService => ({
      serviceId: serviceIdSchema.parse(cutId),
      staffId: null,
      startTime: written('02:00'),
      notes: null,
      ...overrides,
    })

    describe('addService', () => {
      it('adds a line to a booking within the reach and returns its row', async () => {
        const { id } = await created()

        const ofEverySalon = dataOf(
          await repository().addService(
            bookingIdSchema.parse(id),
            everySalon,
            asked(),
          ),
        )
        const ofTheSalon = dataOf(
          await repository().addService(
            bookingIdSchema.parse(id),
            salonOnly(salonId),
            asked({ notes: '前髪のみ' }),
          ),
        )

        expect(ofEverySalon).toMatchObject({
          type: 'added',
          service: {
            bookingId: id,
            serviceId: cutId,
            staffId: null,
            notes: null,
            sortOrder: 1,
          },
        })
        expect(ofTheSalon).toMatchObject({
          type: 'added',
          service: { bookingId: id, notes: '前髪のみ', sortOrder: 2 },
        })
        expect((await storedLines(id)).map((row) => row.id)).toEqual([
          expect.any(String),
          ofEverySalon.type === 'added' ? ofEverySalon.service.id : '',
          ofTheSalon.type === 'added' ? ofTheSalon.service.id : '',
        ])
      })

      it('finds nothing outside the reach, and nothing for an ID no booking has', async () => {
        const { id } = await created()
        const before = await everythingOf(id)

        const outside = dataOf(
          await repository().addService(
            bookingIdSchema.parse(id),
            salonOnly(await salon()),
            asked(),
          ),
        )
        const unknown = dataOf(
          await repository().addService(
            bookingIdSchema.parse(UNKNOWN_ID),
            everySalon,
            asked(),
          ),
        )

        expect([outside, unknown]).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
        ])
        expect(await everythingOf(id)).toEqual(before)
      })

      it('says why a line is not added, and adds nothing', async () => {
        const { id } = await created()
        const done = await cutAt('05:00')
        await setStatus(done, 'completed')
        const before = await everythingOf(id)

        const results = [
          await repository().addService(
            bookingIdSchema.parse(done),
            everySalon,
            asked(),
          ),
          await repository().addService(
            bookingIdSchema.parse(id),
            everySalon,
            asked({ serviceId: serviceIdSchema.parse(UNKNOWN_ID) }),
          ),
          await repository().addService(
            bookingIdSchema.parse(id),
            everySalon,
            asked({
              staffId: staffIdSchema.parse(staffId),
              startTime: written('05:30'),
            }),
          ),
        ]

        expect(results.map(dataOf)).toEqual([
          {
            type: 'statusDoesNotAllow',
            status: 'completed',
            allowed: UNFINISHED,
          },
          {
            type: 'invalid',
            issues: [expect.objectContaining({ field: 'serviceId' })],
          },
          { type: 'staffOccupied', staffIds: [staffId] },
        ])
        expect(await everythingOf(id)).toEqual(before)
      })

      it('gives the first place to the line of a booking that has none, and sums the booking up from it alone', async () => {
        const id = await insertBooking(staffId, '01:00', '02:00', {
          withLine: false,
        })

        const result = dataOf(
          await repository().addService(
            bookingIdSchema.parse(id),
            everySalon,
            asked({ serviceId: serviceIdSchema.parse(colorId) }),
          ),
        )

        expect(result).toMatchObject({
          type: 'added',
          service: { sortOrder: 0 },
        })
        expect(await summaryOf(id)).toEqual({
          bookingDate: '2026-11-20',
          startTime: written('02:00'),
          endTime: written('03:30'),
          duration: 90,
          subtotal: 8000,
          discountAmount: 1000,
          taxAmount: 700,
          totalAmount: 7700,
        })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(
          connection.database,
        ).addService(bookingIdSchema.parse(UNKNOWN_ID), everySalon, asked())
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: 'Failed to add service to booking',
          },
        })
      })
    })

    describe('findService', () => {
      it('returns the row of a line of a booking within the reach', async () => {
        const { id, color } = await visit()

        const rows = [
          dataOf(
            await repository().findService(
              bookingIdSchema.parse(id),
              bookingServiceIdSchema.parse(color),
              everySalon,
            ),
          ),
          dataOf(
            await repository().findService(
              bookingIdSchema.parse(id),
              bookingServiceIdSchema.parse(color),
              salonOnly(salonId),
            ),
          ),
        ]

        const [stored] = (await storedLines(id)).filter(
          (row) => row.id === color,
        )
        expect(rows).toEqual([stored, stored])
        expect(stored).toMatchObject({ bookingId: id, serviceId: colorId })
      })

      it('finds nothing outside the reach, nothing of another booking, and nothing for IDs nothing has', async () => {
        const { id, color } = await visit()
        const other = await cutAt('05:00')
        const find = async (
          booking: string,
          service: string,
          reach: LedgerReach,
        ) =>
          dataOf(
            await repository().findService(
              bookingIdSchema.parse(booking),
              bookingServiceIdSchema.parse(service),
              reach,
            ),
          )

        expect([
          await find(id, color, salonOnly(await salon())),
          await find(other, color, everySalon),
          await find(id, UNKNOWN_ID, everySalon),
          await find(UNKNOWN_ID, color, everySalon),
        ]).toEqual([null, null, null, null])
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(
          connection.database,
        ).findService(
          bookingIdSchema.parse(UNKNOWN_ID),
          bookingServiceIdSchema.parse(UNKNOWN_ID),
          everySalon,
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: 'Failed to find service of booking',
          },
        })
      })
    })

    describe('removeService', () => {
      const removeFrom = async (
        booking: string,
        service: string,
        reach: LedgerReach,
      ) =>
        dataOf(
          await repository().removeService(
            bookingIdSchema.parse(booking),
            bookingServiceIdSchema.parse(service),
            reach,
          ),
        )

      it('removes a line from a booking within the reach, and no other', async () => {
        const { id, cut, color, last } = await visit()
        const other = await visit('21')

        const results = [
          await removeFrom(id, color, everySalon),
          await removeFrom(id, last, salonOnly(salonId)),
        ]

        expect(results).toEqual([{ type: 'removed' }, { type: 'removed' }])
        expect((await storedLines(id)).map((row) => row.id)).toEqual([cut])
        expect(await storedLines(other.id)).toHaveLength(3)
        expect(await summaryOf(id)).toEqual(ofOneCut)
        expect(await summaryOf(other.id)).toMatchObject({
          duration: 210,
          subtotal: 21200,
          totalAmount: 20900,
        })
      })

      it('says why a line is not removed, and removes nothing', async () => {
        const { id, color } = await visit()
        const single = await created({
          services: [free({ startTime: at('05:00') })],
        })

        const results = [
          await removeFrom(id, color, salonOnly(await salon())),
          await removeFrom(UNKNOWN_ID, color, everySalon),
          await removeFrom(single.id, color, everySalon),
          await removeFrom(id, UNKNOWN_ID, everySalon),
          await removeFrom(single.id, single.services[0].id, everySalon),
        ]

        expect(results).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
          { type: 'serviceNotFound' },
          { type: 'serviceNotFound' },
          { type: 'lastService' },
        ])
        expect(await db.$count(bookingServices)).toBe(4)
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(
          connection.database,
        ).removeService(
          bookingIdSchema.parse(UNKNOWN_ID),
          bookingServiceIdSchema.parse(UNKNOWN_ID),
          everySalon,
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: 'Failed to remove service from booking',
          },
        })
      })
    })
  })

  describe('the constraints of the database', () => {
    it('refuses a line that does not say whether its price includes the tax', async () => {
      const { id } = await created()

      await expect(
        getTestDbClient()`
          INSERT INTO booking_services
            ("bookingId", "serviceId", "startTime", "endTime", duration, price, "finalPrice", "sortOrder")
          VALUES
            (${id}, ${cutId}, ${at('02:00')}, ${at('03:00')}, 60, 6600, 6600, 1)
        `,
      ).rejects.toMatchObject({ code: '23502', column_name: 'taxIncluded' })
      expect(await storedLines(id)).toHaveLength(1)
    })
  })
})
