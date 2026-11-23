import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  reviews,
  sales,
  salons,
  services,
  staff,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  type DomainError,
  type LedgerReach,
  type RequestedBookingMove,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { BookingRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
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

const INVALID_UPDATE = 'Invalid booking update'
const INVALID_RESCHEDULE = 'Invalid booking reschedule'

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

/** A booking is moved until the visit begins. */
const MOVABLE: Status[] = ['draft', 'pending', 'confirmed']
const NOT_MOVABLE: Status[] = [
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]

/** The statuses a customer's bookings are counted by. */
const COUNTED: Status[] = ['completed', 'cancelled', 'no_show']
const NOT_COUNTED: Status[] = ['draft', 'pending', 'confirmed', 'in_progress']

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

/** What a salon notes of a booking. */
const noted = {
  depositAmount: 3000,
  customerRequest: '短めに',
  internalNotes: 'お子様連れ',
  source: 'web',
}

describe('Booking changes API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** A signed-in admin. */
  let admin: { id: string; authorization: string }
  /** The Authorization header of the admin. */
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
    admin = await signedInUser(app, db, { role: 'admin' })
    asAdmin = admin.authorization
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

  /** Reads a booking; as the admin unless said otherwise. */
  const read = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${BOOKINGS}/${id}`), as)

  /** Changes what is noted of a booking; as the admin unless said otherwise. */
  const update = (
    id: string,
    body: object | undefined,
    as: string | null = asAdmin,
  ) => {
    const call = authorized(request(app).patch(`${BOOKINGS}/${id}`), as)
    return body === undefined ? call : call.send(body)
  }

  /** Moves a booking; as the admin unless said otherwise. */
  const move = (
    id: string,
    body: object | undefined,
    as: string | null = asAdmin,
  ) => {
    const call = authorized(
      request(app).post(`${BOOKINGS}/${id}/reschedule`),
      as,
    )
    return body === undefined ? call : call.send(body)
  }

  /** Removes a booking; as the admin unless said otherwise. */
  const remove = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).delete(`${BOOKINGS}/${id}`), as)

  /** A request that moves a booking to a time; to the staff member of the tests unless another is given. */
  const to = (time: string, member: string = staffId, day = '20') => ({
    startTime: at(time, day),
    staffId: member,
  })

  /** Confirms a booking through the API. */
  const confirm = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).post(`${BOOKINGS}/${id}/confirm`), as)

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

  /** A booking with its lines and its history as they are stored. */
  const everythingOf = async (id: string) => ({
    booking: await stored(id),
    lines: await storedLines(id),
    history: await storedHistory(id),
  })

  /** The time a booking begins at, as the API writes it. */
  const startOf = async (id: string): Promise<unknown> =>
    (await read(id)).body.data.startTime

  /** The moment the customer of the tests was last written at. */
  const customerWrittenAt = async (): Promise<number> => {
    const [row] = await db
      .select({ at: epochMs(customers.updatedAt) })
      .from(customers)
      .where(eq(customers.id, customerId))
    if (row === undefined) {
      throw new Error('The customer is not stored')
    }
    return row.at
  }

  /** The staff members of the lines of a booking, in the order of the lines. */
  const staffOfLines = async (id: string): Promise<(string | null)[]> =>
    (await storedLines(id)).map((row) => row.staffId)

  const storedCustomer = async (id: string = customerId) => {
    const [row] = await db.select().from(customers).where(eq(customers.id, id))
    if (row === undefined) {
      throw new Error(`Customer ${id} is not stored`)
    }
    return row
  }

  /** What a customer has of visits, cancellations and no-shows. */
  const countsOf = async (id: string = customerId) => {
    const row = await storedCustomer(id)
    return {
      visitCount: row.visitCount,
      cancellationCount: row.cancellationCount,
      noShowCount: row.noShowCount,
      firstVisitDate: row.firstVisitDate,
      lastVisitDate: row.lastVisitDate,
    }
  }

  const noCounts = {
    visitCount: 0,
    cancellationCount: 0,
    noShowCount: 0,
    firstVisitDate: null,
    lastVisitDate: null,
  }

  /** A sale that refers to a booking, written directly. */
  const insertSale = async (bookingId: string | null): Promise<void> => {
    await db.insert(sales).values({
      saleNumber: `SL-${bookingId ?? 'none'}`.slice(0, 50),
      salonId,
      customerId,
      bookingId,
      saleDate: '2026-11-20',
      saleTime: at('02:00'),
      subtotal: 6000,
      taxAmount: 600,
      totalAmount: 6600,
    })
  }

  /** A treatment record that refers to a booking, written directly. */
  const insertTreatmentRecord = async (bookingId: string): Promise<void> => {
    await db
      .insert(treatmentRecords)
      .values({ bookingId, customerId, staffId, services: [cutId] })
  }

  /** A review of a booking by the customer, written directly. */
  const insertReview = async (bookingId: string): Promise<void> => {
    await db
      .insert(reviews)
      .values({ salonId, customerId, bookingId, overallRating: 5 })
  }

  /**
   * A visit of three services: a cut by the staff member of the tests from
   * 01:00, a colouring by a second one from 02:00, and a cut nobody is named
   * for from 03:30 to 04:30. The staff member of the tests is in charge.
   */
  const visit = async () => {
    const second = await staffMember()
    const data = await created({
      services: [
        line(),
        line({ serviceId: colorId, staffId: second, startTime: at('02:00') }),
        line({ staffId: null, startTime: at('03:30') }),
      ],
    })
    const id: string = data.id
    return { id, data, second }
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

  /** Those who remove bookings from the ledger of the salon of the tests. */
  const removers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
  ]

  /** Everyone who keeps the ledger of the salon of the tests. */
  const keepers: [string, SignInAs][] = [
    ...removers,
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

  describe('PATCH /api/v1/bookings/:id', () => {
    it('writes what the request states and returns the booking as it is then', async () => {
      const data = await created()
      const before = await databaseClock()

      const response = await update(data.id, noted)
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...data,
          ...noted,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${BOOKINGS}/${data.id}`, list: BOOKINGS },
      })
      expectBetween(response.body.data.updatedAt, before, after)
      expect((await read(data.id)).body.data).toEqual(response.body.data)
    })

    it.each([
      ['the deposit', 'depositAmount', 0],
      ['the deposit, up to what its column holds', 'depositAmount', 2147483647],
      ['what the customer asked for', 'customerRequest', '  前髪は長めに  '],
      ['what the salon notes', 'internalNotes', 'x'.repeat(10_000)],
      ['where the booking came from', 'source', 'a'.repeat(50)],
      ['the deposit to none', 'depositAmount', null],
      ['what the customer asked for to nothing', 'customerRequest', null],
      ['what the salon notes to nothing', 'internalNotes', null],
      ['where the booking came from to nowhere', 'source', null],
    ])(
      'changes %s, and nothing else of the booking but the time of the change',
      async (_case, property, value) => {
        const { id } = await created({
          depositAmount: 1000,
          customerRequest: '前回と同じ長さで',
          internalNotes: '電話で受付',
          source: 'phone',
        })
        const { updatedAt, ...before } = await stored(id)

        const response = await update(id, { [property]: value })

        expect(response.status).toBe(200)
        expect(response.body.data[property]).toBe(value)
        const { updatedAt: changedAt, ...after } = await stored(id)
        expect(after).toEqual({ ...before, [property]: value })
        expect(changedAt).not.toBe(updatedAt)
      },
    )

    it('leaves the service lines, the status history and the customer as they are', async () => {
      const { id } = await visit()
      const { lines, history } = await everythingOf(id)
      const customer = await storedCustomer()

      const response = await update(id, noted)

      expect(response.status).toBe(200)
      expect(await storedLines(id)).toEqual(lines)
      expect(await storedHistory(id)).toEqual(history)
      expect(await storedCustomer()).toEqual(customer)
    })

    it('changes the booking it is asked for, and no other', async () => {
      const first = await cutAt('01:00')
      const other = await cutAt('03:00')
      const before = await stored(other)

      await update(first, noted)

      expect(await stored(first)).toMatchObject(noted)
      expect(await stored(other)).toEqual(before)
    })

    it.each(STATUSES)(
      'notes on a booking that is %s, and leaves its status',
      async (status) => {
        const { id } = await created()
        await setStatus(id, status)

        const response = await update(id, noted)

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({ ...noted, status })
        expect(await stored(id)).toMatchObject({ ...noted, status })
        expect(await storedHistory(id)).toHaveLength(1)
        expect(await countsOf()).toEqual(noCounts)
      },
    )

    it.each<[string, object | undefined, string[]]>([
      ['states nothing', {}, [':custom']],
      ['is a list', [noted], [':invalid_type']],
      ['is not there', undefined, [':invalid_type']],
      [
        'has a deposit below zero',
        { depositAmount: -1 },
        ['depositAmount:too_small'],
      ],
      [
        'has a deposit of a fraction of a yen',
        { depositAmount: 0.5 },
        ['depositAmount:invalid_type'],
      ],
      [
        'has a deposit that its column does not hold',
        { depositAmount: 2147483648 },
        ['depositAmount:too_big'],
      ],
      [
        'has a deposit as text',
        { depositAmount: '3000' },
        ['depositAmount:invalid_type'],
      ],
      [
        'has a request of the customer that says nothing',
        { customerRequest: '' },
        ['customerRequest:invalid_format'],
      ],
      [
        'has notes that are spaces',
        { internalNotes: '   ' },
        ['internalNotes:invalid_format'],
      ],
      [
        'has a source of 51 characters',
        { source: 'a'.repeat(51) },
        ['source:too_big'],
      ],
      [
        'names the status, which the actions change',
        { ...noted, status: 'confirmed' },
        ['status:unrecognized_keys'],
      ],
      [
        'names the time, which a reschedule changes',
        { ...noted, startTime: at('05:00') },
        ['startTime:unrecognized_keys'],
      ],
      [
        'names the staff member, whom a reschedule changes',
        { staffId: UNKNOWN_ID },
        ['staffId:unrecognized_keys'],
      ],
      [
        'names the total',
        { ...noted, totalAmount: 0 },
        ['totalAmount:unrecognized_keys'],
      ],
      [
        'names the service lines',
        { ...noted, services: [] },
        ['services:unrecognized_keys'],
      ],
      [
        'breaks several rules',
        { depositAmount: -1, source: '', bookingNumber: 'BK-0000-0001' },
        [
          'bookingNumber:unrecognized_keys',
          'depositAmount:too_small',
          'source:invalid_format',
        ],
      ],
    ])(
      'answers a request that %s with 400, and changes nothing',
      async (_case, body, rules) => {
        const { id } = await created({ internalNotes: '電話で受付' })
        const before = await stored(id)

        const response = await update(id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(brokenRules(response).toSorted()).toEqual(rules)
        expect(await stored(id)).toEqual(before)
      },
    )

    it('answers an ID that no booking has with 404', async () => {
      const response = await update(UNKNOWN_ID, noted)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
    })

    it('answers what is not an ID with 400, before it looks at the body', async () => {
      const responses = [
        await update('latest', noted),
        await update('BK-TEST-0001', noted),
        await update(`${UNKNOWN_ID}0`, noted),
        await update('latest', {}),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid booking ID')
        expect(brokenRules(response)).toHaveLength(1)
        expect(brokenRules(response)[0]).toMatch(/^id:/)
      }
    })

    it('finds the booking by its ID in capitals, and says where it is by the path it was asked at', async () => {
      const { id } = await created()

      const response = await authorized(
        request(app).patch(`/API/V1/Bookings/${id.toUpperCase()}`),
        asAdmin,
      ).send(noted)

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
      expect(response.body.links).toEqual({
        self: `/API/V1/Bookings/${id}`,
        list: '/API/V1/Bookings',
      })
    })
  })

  describe('POST /api/v1/bookings/:id/reschedule', () => {
    it('begins the booking at the time of the request, moves its end and its lines by as much, and returns it as it is then', async () => {
      const { id, data, second } = await visit()
      const before = await databaseClock()

      // Four and a half hours later.
      const response = await move(id, to('05:30'))
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...data,
          startTime: written('05:30'),
          endTime: written('09:00'),
          services: [
            {
              ...data.services[0],
              staffId,
              startTime: written('05:30'),
              endTime: written('06:30'),
            },
            {
              ...data.services[1],
              staffId: second,
              startTime: written('06:30'),
              endTime: written('08:00'),
            },
            {
              ...data.services[2],
              staffId: null,
              startTime: written('08:00'),
              endTime: written('09:00'),
            },
          ],
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${BOOKINGS}/${id}`, list: BOOKINGS },
      })
      expectBetween(response.body.data.updatedAt, before, after)
      expect((await read(id)).body.data).toEqual(response.body.data)
    })

    it('changes the times, the day and the staff members of the booking and of its lines, and nothing else of them', async () => {
      const { id } = await visit()
      const third = await staffMember()
      const { booking: was, lines, history } = await everythingOf(id)
      const customer = await storedCustomer()

      const response = await move(id, to('16:00', third))

      expect(response.status).toBe(200)
      const now = await everythingOf(id)
      const changed = ({
        staffId: _staffId,
        bookingDate: _bookingDate,
        startTime: _startTime,
        endTime: _endTime,
        updatedAt: _updatedAt,
        ...rest
      }: typeof was) => rest
      expect(changed(now.booking)).toEqual(changed(was))
      // One in the morning of the next day in Tokyo.
      expect(now.booking).toMatchObject({
        staffId: third,
        bookingDate: '2026-11-21',
      })
      expect(now.booking.updatedAt).not.toBe(was.updatedAt)
      expect(
        now.lines.map(
          ({
            staffId: _staffId,
            startTime: _startTime,
            endTime: _endTime,
            updatedAt: _updatedAt,
            ...rest
          }) => rest,
        ),
      ).toEqual(
        lines.map(
          ({
            staffId: _staffId,
            startTime: _startTime,
            endTime: _endTime,
            updatedAt: _updatedAt,
            ...rest
          }) => rest,
        ),
      )
      expect(now.lines.map((row) => row.updatedAt)).not.toContain(
        lines[0]?.updatedAt,
      )
      // A move is no change of the status, and none of what the customer has.
      expect(now.history).toEqual(history)
      expect(await storedCustomer()).toEqual(customer)
    })

    it('moves a booking to an earlier time, over the end of a day', async () => {
      const { id } = await visit()

      const response = await move(id, to('14:30', staffId, '19'))

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        bookingDate: '2026-11-19',
        startTime: written('14:30', '19'),
        endTime: written('18:00', '19'),
      })
      expect(
        response.body.data.services.map(
          (service: { startTime: string; endTime: string }) => [
            service.startTime,
            service.endTime,
          ],
        ),
      ).toEqual([
        [written('14:30', '19'), written('15:30', '19')],
        [written('15:30', '19'), written('17:00', '19')],
        [written('17:00', '19'), written('18:00', '19')],
      ])
    })

    it('moves the booking it is asked for, and no other', async () => {
      const first = await cutAt('01:00')
      const other = await cutAt('03:00')
      const before = await everythingOf(other)

      await move(first, to('05:00'))

      expect(await everythingOf(other)).toEqual(before)
    })

    it.each(MOVABLE)(
      'moves a booking that is %s, and leaves its status',
      async (status) => {
        const { id } = await created()
        await setStatus(id, status)

        const response = await move(id, to('05:00'))

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          status,
          startTime: written('05:00'),
        })
        expect(await storedHistory(id)).toHaveLength(1)
      },
    )

    it.each(NOT_MOVABLE)(
      'answers a booking that is %s with 409, and changes nothing',
      async (status) => {
        const { id } = await created()
        await setStatus(id, status)
        const before = await everythingOf(id)

        const response = await move(id, to('05:00'))

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `A booking that is ${status} cannot be rescheduled; its status has to be draft or pending or confirmed`,
        )
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    describe('the staff member in charge', () => {
      it('takes over the lines of the one who was, and leaves the others with whom they were', async () => {
        const { id, second } = await visit()
        const third = await staffMember()

        const response = await move(id, to('01:00', third))

        expect(response.status).toBe(200)
        expect(response.body.data.staffId).toBe(third)
        expect((await stored(id)).staffId).toBe(third)
        expect(await staffOfLines(id)).toEqual([third, second, null])
        // The times stay what they were.
        expect(response.body.data).toMatchObject({
          startTime: written('01:00'),
          endTime: written('04:30'),
        })
      })

      it('may be one who has lines of the booking already', async () => {
        const { id, second } = await visit()

        const response = await move(id, to('01:00', second))

        expect(response.status).toBe(200)
        expect(response.body.data.staffId).toBe(second)
        expect(await staffOfLines(id)).toEqual([second, second, null])
      })

      it('takes over no line when the one who was in charge had none', async () => {
        const inCharge = await staffMember()
        const third = await staffMember()
        const { id } = await created({ staffId: inCharge })

        const response = await move(id, to('01:00', third))

        expect(response.status).toBe(200)
        expect((await stored(id)).staffId).toBe(third)
        expect(await staffOfLines(id)).toEqual([staffId])
      })

      it.each<[string, () => Promise<string>]>([
        ['is no staff member at all', async () => UNKNOWN_ID],
        ['is of another salon', async () => staffMember({}, await salon())],
        [
          'was deleted',
          () => staffMember({ deletedAt: '2026-11-01T00:00:00.000Z' }),
        ],
        // An ID of something else than a staff member.
        ['is the customer', async () => customerId],
      ])(
        'is refused with 400 when the one the request names %s, and nothing changes',
        async (_case, memberOf) => {
          const { id } = await visit()
          const before = await everythingOf(id)

          const response = await move(id, to('05:30', await memberOf()))

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_RESCHEDULE)
          expect(response.body.errors).toEqual([
            expect.objectContaining({
              field: 'staffId',
              rule: 'not_found',
              message: 'Must name a staff member of the salon',
            }),
          ])
          expect(await everythingOf(id)).toEqual(before)
        },
      )

      it('is refused when it is the one in charge already, who was deleted since', async () => {
        const { id } = await created()
        await db
          .update(staff)
          .set({ deletedAt: '2026-11-15T00:00:00.000Z' })
          .where(eq(staff.id, staffId))

        const response = await move(id, to('05:00'))

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['staffId:not_found'])
      })

      it('leaves a line with a staff member who was deleted since: the request does not name them', async () => {
        const { id, second } = await visit()
        await db
          .update(staff)
          .set({ deletedAt: '2026-11-15T00:00:00.000Z' })
          .where(eq(staff.id, second))

        const response = await move(id, to('05:30'))

        expect(response.status).toBe(200)
        expect(await staffOfLines(id)).toEqual([staffId, second, null])
      })

      it('is of the salon of the booking for an administrator as well', async () => {
        const elsewhere = await salon()
        const there = await staffMember({}, elsewhere)
        const { id } = await created({
          salonId: elsewhere,
          staffId: there,
          services: [
            line({
              serviceId: await insertService({}, elsewhere),
              staffId: there,
            }),
          ],
        })

        const responses = [
          await move(id, to('05:00')),
          await move(id, to('05:00', there)),
        ]

        expect(responses.map(statusAndCode)).toEqual(['400 2001', '200'])
      })
    })

    describe('the day of the visit', () => {
      /** A booking of a cut in a salon of that time zone. */
      const bookingIn = async (timezone: string) => {
        const where = await salon({ timezone })
        const there = await staffMember({}, where)
        const { id } = await created({
          salonId: where,
          staffId: there,
          services: [
            line({ serviceId: await insertService({}, where), staffId: there }),
          ],
        })
        return { id, there }
      }

      it.each([
        ['Asia/Tokyo', '14:59', '2026-11-20'],
        ['Asia/Tokyo', '15:00', '2026-11-21'],
        ['America/New_York', '04:59', '2026-11-19'],
        ['America/New_York', '05:00', '2026-11-20'],
        ['UTC', '23:59', '2026-11-20'],
        ['+09:00', '15:00', '2026-11-21'],
      ])(
        'is told in the time zone of the salon: in %s, %s UTC of the 20th is on %s',
        async (timezone, time, bookingDate) => {
          const { id, there } = await bookingIn(timezone)

          const response = await move(id, to(time, there))

          expect(response.status).toBe(200)
          expect(response.body.data.bookingDate).toBe(bookingDate)
          expect((await stored(id)).bookingDate).toBe(bookingDate)
        },
      )

      it.each(['Mars/Olympus', 'Tokyo', 'JST+9'])(
        'cannot be told in a salon whose time zone, %s, is not known: 409, and nothing changes',
        async (timezone) => {
          const { id } = await created()
          await db
            .update(salons)
            .set({ timezone })
            .where(eq(salons.id, salonId))
          const before = await everythingOf(id)

          const response = await move(id, to('05:00'))

          expectProblem(response, notAllowed)
          expect(response.body.detail).toBe(
            'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first',
          )
          expect(await everythingOf(id)).toEqual(before)
        },
      )
    })

    describe('a staff member who is occupied', () => {
      it('refuses a move to a time the staff member has another booking, names them, and changes nothing', async () => {
        const id = await cutAt('01:00')
        await cutAt('05:00')
        const before = await everythingOf(id)

        const response = await move(id, to('05:30'))

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `Other bookings occupy staff member ${staffId} at a time of this booking`,
        )
        expect(await everythingOf(id)).toEqual(before)
      })

      it('names every staff member who is occupied, also one whose line stays theirs, and none who has no line of the booking', async () => {
        const { id, second } = await visit()
        const third = await staffMember()
        // The visit moved to 07:00 has the cut until 08:00 and the colouring until 09:30.
        await cutAt('07:30')
        await cutAt('09:00', second)
        await cutAt('07:00', third)

        const responses = [
          await move(id, to('07:00')),
          // The third one takes the cut over: the one who was in charge has no line then.
          await move(id, to('07:00', third)),
        ]

        for (const response of responses) {
          expectProblem(response, notAllowed)
        }
        expect(responses.map((response) => response.body.detail)).toEqual([
          `Other bookings occupy staff members ${[staffId, second].toSorted().join(', ')} at a time of this booking`,
          `Other bookings occupy staff members ${[second, third].toSorted().join(', ')} at a time of this booking`,
        ])
      })

      it('does not count the lines the booking has where it was', async () => {
        const { id } = await visit()

        const responses = [
          // Half an hour later: every line meets where it or another was.
          await move(id, to('01:30')),
          await move(id, to('01:00')),
          await move(id, to('01:00')),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200', '200'])
      })

      it.each([
        ['ends when the other begins', '04:00', 200],
        ['begins when the other ends', '06:00', 200],
        ['ends a minute into the other', '04:01', 409],
        ['begins a minute before the other ends', '05:59', 409],
        ['is at the same time', '05:00', 409],
      ])(
        'answers a move to a time that %s with %i',
        async (_case, time, status) => {
          const id = await cutAt('01:00')
          await cutAt('05:00')

          const response = await move(id, to(time))

          expect(response.status).toBe(status)
        },
      )

      it.each([
        // The other is kept free until 06:15, the moved one from ten minutes before it begins.
        ['25 minutes after the other ends', '06:25', 200],
        ['24 minutes after the other ends', '06:24', 409],
        ['an hour that ends 25 minutes before the other begins', '03:35', 200],
        ['an hour that ends 24 minutes before the other begins', '03:36', 409],
      ])(
        'keeps the time a staff member keeps free before and after a service: %s',
        async (_case, time, status) => {
          const careful = await staffMember({
            bufferTimeBefore: 10,
            bufferTimeAfter: 15,
          })
          const id = await cutAt('01:00', careful)
          await cutAt('05:00', careful)

          const response = await move(id, to(time, careful))

          expect(response.status).toBe(status)
        },
      )

      it('moves a booking to a time the staff member has as many others as they take at once, less one', async () => {
        const two = await staffMember({ maxConcurrentBookings: 2 })
        const first = await cutAt('01:00', two)
        const second = await cutAt('03:00', two)
        await cutAt('05:00', two)

        const responses = [
          await move(first, to('05:00', two)),
          await move(second, to('05:00', two)),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '409 3003'])
      })

      it.each<Status>(['cancelled', 'no_show'])(
        'moves a booking to the time of one that is %s: it occupies nobody',
        async (status) => {
          const id = await cutAt('01:00')
          await setStatus(await cutAt('05:00'), status)

          expect((await move(id, to('05:00'))).status).toBe(200)
        },
      )

      it.each<Status>([
        'draft',
        'pending',
        'confirmed',
        'in_progress',
        'completed',
      ])(
        'does not move a booking to the time of one that is %s',
        async (status) => {
          const id = await cutAt('01:00')
          await setStatus(await cutAt('05:00'), status)

          expect(statusAndCode(await move(id, to('05:00')))).toBe('409 3003')
        },
      )

      it('hands a booking over to a staff member who is free at its time, and to none who is occupied', async () => {
        const id = await cutAt('01:00')
        const free = await staffMember()
        const occupied = await staffMember()
        await cutAt('01:30', occupied)

        const responses = [
          await move(id, to('01:00', occupied)),
          await move(id, to('01:00', free)),
        ]

        expect(responses.map(statusAndCode)).toEqual(['409 3003', '200'])
        expect(responses[0]?.body.detail).toBe(
          `Other bookings occupy staff member ${occupied} at a time of this booking`,
        )
        expect(await staffOfLines(id)).toEqual([free])
      })

      it('asks nobody to be free for a line nobody is named for, nor the one in charge who has no line', async () => {
        const inCharge = await staffMember()
        const { id } = await created({
          staffId: inCharge,
          services: [line({ staffId: null })],
        })
        await cutAt('05:00', inCharge)
        await cutAt('05:00')

        const responses = [
          await move(id, to('05:00', inCharge)),
          await move(id, to('05:00')),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      })

      it('is free again where the booking was', async () => {
        const id = await cutAt('01:00')

        await move(id, to('05:00'))

        expect((await create(booking())).status).toBe(201)
        expect(
          statusAndCode(
            await create(
              booking({ services: [line({ startTime: at('05:00') })] }),
            ),
          ),
        ).toBe('409 3003')
      })
    })

    it('holds a move to what keeps the ledger sound, and to nothing else: a time that has passed, any hour, the same time again', async () => {
      const { id } = await created()

      const responses = [
        await move(id, { startTime: '2020-01-01T18:30:00Z', staffId }),
        await move(id, { startTime: '2020-01-01T18:30:00.000Z', staffId }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(responses[1]?.body.data).toMatchObject({
        bookingDate: '2020-01-02',
        startTime: '2020-01-01T18:30:00.000Z',
        endTime: '2020-01-01T19:30:00.000Z',
      })
    })

    it.each<[string, object | undefined, string[]]>([
      [
        'states nothing',
        {},
        ['staffId:invalid_type', 'startTime:invalid_type'],
      ],
      ['is a list', [], [':invalid_type']],
      ['is not there', undefined, [':invalid_type']],
      ['names no time', { staffId: UNKNOWN_ID }, ['startTime:invalid_type']],
      [
        'names no staff member',
        { startTime: at('05:00') },
        ['staffId:invalid_type'],
      ],
      [
        'names nobody for the staff member',
        { startTime: at('05:00'), staffId: null },
        ['staffId:invalid_type'],
      ],
      [
        'names a staff member by what is no ID',
        { startTime: at('05:00'), staffId: 'somebody' },
        ['staffId:invalid_format'],
      ],
      [
        'names a time with seconds',
        { startTime: '2026-11-20T05:00:30Z', staffId: UNKNOWN_ID },
        ['startTime:custom'],
      ],
      [
        'names a time with an offset',
        { startTime: '2026-11-20T14:00:00+09:00', staffId: UNKNOWN_ID },
        ['startTime:invalid_format'],
      ],
      [
        'names a day without a time',
        { startTime: '2026-11-20', staffId: UNKNOWN_ID },
        ['startTime:invalid_format'],
      ],
      [
        'names the end, which follows from the start',
        { startTime: at('05:00'), staffId: UNKNOWN_ID, endTime: at('06:00') },
        ['endTime:unrecognized_keys'],
      ],
      [
        'names the status',
        { startTime: at('05:00'), staffId: UNKNOWN_ID, status: 'confirmed' },
        ['status:unrecognized_keys'],
      ],
      [
        'names service lines',
        { startTime: at('05:00'), staffId: UNKNOWN_ID, services: [] },
        ['services:unrecognized_keys'],
      ],
    ])(
      'answers a request that %s with 400, and changes nothing',
      async (_case, body, rules) => {
        const { id } = await created()
        const before = await everythingOf(id)

        const response = await move(id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_RESCHEDULE)
        expect(brokenRules(response).toSorted()).toEqual(rules)
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    it('says what is wrong with a time that is not on a whole minute', async () => {
      const { id } = await created()

      const response = await move(id, {
        startTime: '2026-11-20T05:00:00.500Z',
        staffId,
      })

      expect(response.body.errors).toEqual([
        expect.objectContaining({
          field: 'startTime',
          rule: 'custom',
          message: 'Must be on a whole minute',
        }),
      ])
    })

    it('answers an ID that no booking has with 404', async () => {
      const response = await move(UNKNOWN_ID, to('05:00'))

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
    })

    it('answers what is not an ID with 400, before it looks at the body', async () => {
      const responses = [
        await move('latest', to('05:00')),
        await move('BK-TEST-0001', to('05:00')),
        await move(`${UNKNOWN_ID}0`, to('05:00')),
        await move('latest', {}),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid booking ID')
        expect(brokenRules(response)).toHaveLength(1)
        expect(brokenRules(response)[0]).toMatch(/^id:/)
      }
    })

    it('finds the booking by its ID in capitals, takes the staff member in capitals, and says where the booking is by the path it was asked at', async () => {
      const { id } = await created()

      const response = await authorized(
        request(app).post(`/API/V1/Bookings/${id.toUpperCase()}/reschedule`),
        asAdmin,
      ).send(to('05:00', staffId.toUpperCase()))

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ id, staffId })
      expect(response.body.links).toEqual({
        self: `/API/V1/Bookings/${id}`,
        list: '/API/V1/Bookings',
      })
    })

    it('is there for POST alone, and nothing is below it', async () => {
      const { id } = await created()
      const address = `${BOOKINGS}/${id}/reschedule`
      const before = await everythingOf(id)

      const responses = [
        await authorized(request(app).get(address), asAdmin),
        await authorized(request(app).put(address), asAdmin).send(to('05:00')),
        await authorized(request(app).patch(address), asAdmin).send(
          to('05:00'),
        ),
        await authorized(request(app).delete(address), asAdmin),
        await authorized(request(app).post(`${address}/again`), asAdmin).send(
          to('05:00'),
        ),
        // A move is of a booking: without an ID there is no such address.
        await authorized(
          request(app).post(`${BOOKINGS}/reschedule`),
          asAdmin,
        ).send(to('05:00')),
      ]

      expect(responses.map(statusAndCode)).toEqual(Array(6).fill('404 3001'))
      expect(await everythingOf(id)).toEqual(before)
    })

    it('checks a move in order: the status, the staff member, the time zone, who is occupied', async () => {
      const id = await cutAt('01:00')
      await cutAt('05:00')
      const stranger = await staffMember({}, await salon())
      const zone = (timezone: string) =>
        db.update(salons).set({ timezone }).where(eq(salons.id, salonId))

      await zone('Mars/Olympus')
      await setStatus(id, 'completed')
      const closed = await move(id, to('05:00', stranger))
      await setStatus(id, 'confirmed')
      const ofAnotherSalon = await move(id, to('05:00', stranger))
      const nowhere = await move(id, to('05:00'))
      await zone('Asia/Tokyo')
      const occupied = await move(id, to('05:00'))

      expect(
        [closed, ofAnotherSalon, nowhere, occupied].map(statusAndCode),
      ).toEqual(['409 3003', '400 2001', '409 3003', '409 3003'])
      expect(closed.body.detail).toMatch(/^A booking that is completed /)
      expect(nowhere.body.detail).toMatch(/^The time zone of the salon /)
      expect(occupied.body.detail).toMatch(/^Other bookings occupy /)
    })
  })

  describe('DELETE /api/v1/bookings/:id', () => {
    it('removes the booking with its service lines and its status history, and answers 204 with nothing', async () => {
      const { id } = await visit()
      await confirm(id)
      expect(await storedHistory(id)).toHaveLength(2)

      const response = await remove(id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(response.headers['content-type']).toBeUndefined()
      expect(await db.$count(bookings)).toBe(0)
      expect(await db.$count(bookingServices)).toBe(0)
      expect(await db.$count(bookingStatusHistories)).toBe(0)
    })

    it('answers for a removed booking like for one that never was', async () => {
      const { id } = await created()
      await remove(id)

      const responses = [
        await read(id),
        await update(id, noted),
        await move(id, to('05:00')),
        await confirm(id),
        await remove(id),
        await authorized(request(app).get(BOOKINGS), asAdmin),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '404 3001',
        '404 3001',
        '404 3001',
        '404 3001',
        '404 3001',
        '200',
      ])
      expect(responses[5]?.body.data).toEqual([])
    })

    it('removes the booking it is asked for, and nothing of another', async () => {
      const first = await cutAt('01:00')
      const other = await cutAt('03:00')
      const before = await everythingOf(other)

      const response = await remove(first)

      expect(response.status).toBe(204)
      expect(await everythingOf(other)).toEqual(before)
      expect(await db.$count(bookings)).toBe(1)
      expect(await db.$count(bookingServices)).toBe(1)
      expect(await db.$count(bookingStatusHistories)).toBe(1)
    })

    it('frees the staff member at the time of the booking', async () => {
      const id = await cutAt('01:00')
      expect(statusAndCode(await create(booking()))).toBe('409 3003')

      await remove(id)

      expect((await create(booking())).status).toBe(201)
    })

    it.each(STATUSES)('removes a booking that is %s', async (status) => {
      const { id } = await created()
      await setStatus(id, status)

      const response = await remove(id)

      expect(response.status).toBe(204)
      expect(await db.$count(bookings)).toBe(0)
    })

    describe('what the customer has of visits, cancellations and no-shows', () => {
      /**
       * Four bookings of the customer on four days, written directly: of
       * what they have, nothing is counted yet.
       */
      const ledger = async () => {
        const days = ['21', '22', '23', '24']
        const ids = await Promise.all(
          days.map((day) => cutAt('01:00', staffId, day)),
        )
        const [first = '', second = '', third = '', fourth = ''] = ids
        await setStatus(first, 'completed')
        await setStatus(second, 'completed')
        await setStatus(third, 'cancelled')
        await setStatus(fourth, 'no_show')
        return { first, second, third, fourth }
      }

      it.each(COUNTED)(
        'is counted again from their bookings when one that is %s is removed',
        async (status) => {
          const { id } = await created()
          await setStatus(id, status)
          await ledger()
          const before = await databaseClock()

          const response = await remove(id)
          const after = await databaseClock()

          expect(response.status).toBe(204)
          expect(await countsOf()).toEqual({
            visitCount: 2,
            cancellationCount: 1,
            noShowCount: 1,
            firstVisitDate: '2026-11-21',
            lastVisitDate: '2026-11-22',
          })
          const countedAt = await customerWrittenAt()
          expect(countedAt).toBeGreaterThanOrEqual(before)
          expect(countedAt).toBeLessThanOrEqual(after)
        },
      )

      it.each(NOT_COUNTED)(
        'is left as it is when a booking that is %s is removed: it was not among what is counted',
        async (status) => {
          const { id } = await created()
          await setStatus(id, status)
          await ledger()
          const customer = await storedCustomer()

          const response = await remove(id)

          expect(response.status).toBe(204)
          expect(await storedCustomer()).toEqual(customer)
          expect(await countsOf()).toEqual(noCounts)
        },
      )

      it('is without the visit, the cancellation and the no-show that are removed', async () => {
        const { first, second, third, fourth } = await ledger()

        await remove(first)
        const withoutTheFirstVisit = await countsOf()
        await remove(third)
        await remove(fourth)
        const withOneVisit = await countsOf()
        await remove(second)

        expect(withoutTheFirstVisit).toEqual({
          visitCount: 1,
          cancellationCount: 1,
          noShowCount: 1,
          firstVisitDate: '2026-11-22',
          lastVisitDate: '2026-11-22',
        })
        expect(withOneVisit).toEqual({
          ...noCounts,
          visitCount: 1,
          firstVisitDate: '2026-11-22',
          lastVisitDate: '2026-11-22',
        })
        expect(await countsOf()).toEqual(noCounts)
      })

      it('is counted for the customer of the booking, and for no other', async () => {
        const other = await insertCustomer(db)
        const ofOther = await Promise.all(
          ['01:00', '03:00'].map(async (time) => {
            const { id } = await created({
              customerId: other,
              services: [line({ startTime: at(time) })],
            })
            await setStatus(id, 'completed')
            return id
          }),
        )
        await ledger()
        const customer = await storedCustomer()

        await remove(ofOther[0] ?? '')

        expect(await storedCustomer()).toEqual(customer)
        expect(await countsOf(other)).toEqual({
          ...noCounts,
          visitCount: 1,
          firstVisitDate: '2026-11-20',
          lastVisitDate: '2026-11-20',
        })
      })
    })

    describe('a booking that a record of what took place, or a review, refers to', () => {
      it.each<[string, (id: string) => Promise<void>, string]>([
        ['a sale', insertSale, 'a sale refers to it'],
        [
          'a treatment record',
          insertTreatmentRecord,
          'a treatment record refers to it',
        ],
        ['a review', insertReview, 'a review refers to it'],
        [
          'a sale and a treatment record',
          async (id) => {
            await insertTreatmentRecord(id)
            await insertSale(id)
          },
          'a sale and a treatment record refer to it',
        ],
        [
          'a sale, a treatment record and a review',
          async (id) => {
            await insertReview(id)
            await insertTreatmentRecord(id)
            await insertSale(id)
          },
          'a sale, a treatment record and a review refer to it',
        ],
      ])(
        'stays when %s refers to it: 409, and nothing is removed',
        async (_case, refer, what) => {
          const { id } = await visit()
          await setStatus(id, 'completed')
          await refer(id)
          const before = await everythingOf(id)

          const response = await remove(id)

          expectProblem(response, notAllowed)
          expect(response.body.detail).toBe(
            `The booking cannot be deleted: ${what}`,
          )
          expect(await everythingOf(id)).toEqual(before)
          expect(await countsOf()).toEqual(noCounts)
        },
      )

      it('stays when the sale that refers to it is void', async () => {
        const { id } = await created()
        await insertSale(id)
        await db
          .update(sales)
          .set({ isVoid: true, voidedAt: at('03:00') })
          .where(eq(sales.bookingId, id))

        expect(statusAndCode(await remove(id))).toBe('409 3003')
      })

      it('is removed when a sale, a treatment record and a review refer to other bookings, or to none', async () => {
        const id = await cutAt('01:00')
        const other = await cutAt('03:00')
        await insertSale(other)
        await insertSale(null)
        await insertTreatmentRecord(other)
        await insertReview(other)

        expect((await remove(id)).status).toBe(204)
        expect(statusAndCode(await remove(other))).toBe('409 3003')
        expect(
          await db.select({ bookingId: reviews.bookingId }).from(reviews),
        ).toEqual([{ bookingId: other }])
      })
    })

    it('answers an ID that no booking has with 404, and removes nothing', async () => {
      await created()

      const response = await remove(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
      expect(await db.$count(bookings)).toBe(1)
    })

    it('answers what is not an ID with 400, and removes nothing', async () => {
      await created()

      const responses = [
        await remove('latest'),
        await remove('BK-TEST-0001'),
        await remove(`${UNKNOWN_ID}0`),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid booking ID')
        expect(brokenRules(response)).toHaveLength(1)
        expect(brokenRules(response)[0]).toMatch(/^id:/)
      }
      expect(await db.$count(bookings)).toBe(1)
    })

    it('finds the booking by its ID in capitals, and does not look at a body', async () => {
      const first = await cutAt('01:00')
      const second = await cutAt('03:00')

      const responses = [
        await authorized(
          request(app).delete(`/API/V1/Bookings/${first.toUpperCase()}`),
          asAdmin,
        ),
        await remove(second).send({ id: first, reason: 'entered twice' }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['204', '204'])
      expect(await db.$count(bookings)).toBe(0)
    })

    it('does not remove the ledger, nor what is below a booking', async () => {
      const { id } = await created()

      const responses = [
        await authorized(request(app).delete(BOOKINGS), asAdmin),
        await authorized(request(app).delete(`${BOOKINGS}/`), asAdmin),
        await authorized(
          request(app).delete(`${BOOKINGS}/${id}/services`),
          asAdmin,
        ),
        await authorized(
          request(app).delete(`${BOOKINGS}/${id}/confirm`),
          asAdmin,
        ),
      ]

      expect(responses.map(statusAndCode)).toEqual(Array(4).fill('404 3001'))
      expect(await db.$count(bookings)).toBe(1)
    })
  })

  describe('what the contract does not have', () => {
    it.each<[string, 'put' | 'post']>([
      ['PUT on a booking', 'put'],
      ['POST on a booking', 'post'],
    ])('answers %s with 404, whatever is sent', async (_case, method) => {
      const { id } = await created()
      const before = await everythingOf(id)

      const responses = [
        await authorized(request(app)[method](`${BOOKINGS}/${id}`), asAdmin),
        await authorized(
          request(app)[method](`${BOOKINGS}/${id}`),
          asAdmin,
        ).send(noted),
      ]

      expect(responses.map(statusAndCode)).toEqual(['404 3001', '404 3001'])
      expect(await everythingOf(id)).toEqual(before)
    })

    // The operations are where the contract puts them: a move has no other
    // name, and what PATCH and DELETE do is no action.
    it.each(['move', 'rescheduled', 'update', 'delete', 'remove'])(
      'has no action at %s',
      async (name) => {
        const { id } = await created()
        const before = await everythingOf(id)

        const response = await authorized(
          request(app).post(`${BOOKINGS}/${id}/${name}`),
          asAdmin,
        ).send(to('05:00'))

        expect(statusAndCode(response)).toBe('404 3001')
        expect(await everythingOf(id)).toEqual(before)
      },
    )
  })

  describe('who changes a booking', () => {
    it.each(unauthenticated)(
      'answers %s with 401 before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const { id } = await created()
        const before = await everythingOf(id)
        const authorization = await tokenOf()

        const responses = [
          await update(id, noted, authorization),
          await move(id, to('05:00'), authorization),
          await remove(id, authorization),
          await update('not-an-id', {}, authorization),
          await move(UNKNOWN_ID, {}, authorization),
          await remove('not-an-id', authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    it.each(keepers)(
      'lets %s note on the bookings of the salon and move them',
      async (_case, signInAs) => {
        const authorization = await signInAs()
        const { id } = await created()

        const responses = [
          await update(id, noted, authorization),
          await move(id, to('05:00'), authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200'])
        expect(await stored(id)).toMatchObject(noted)
        expect(await startOf(id)).toBe(written('05:00'))
      },
    )

    it.each(removers)(
      'lets %s remove a booking of the salon',
      async (_case, signInAs) => {
        const authorization = await signInAs()
        const { id } = await created()

        const response = await remove(id, authorization)

        expect(response.status).toBe(204)
        expect(await db.$count(bookings)).toBe(0)
      },
    )

    it('forbids a staff member of the salon to remove a booking, before looking at the ID: they cancel what will not take place', async () => {
      const authorization = await member('staff')()
      const { id } = await created()
      await insertSale(id)

      const responses = [
        await remove(id, authorization),
        await remove(UNKNOWN_ID, authorization),
        await remove('not-an-id', authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await db.$count(bookings)).toBe(1)
    })

    it.each(notKeepers)(
      'forbids %s every change, before looking at the ID or the body',
      async (_case, signInAs) => {
        const { id } = await created()
        const before = await everythingOf(id)
        const authorization = await signInAs()

        const responses = [
          await update(id, noted, authorization),
          await move(id, to('05:00'), authorization),
          await remove(id, authorization),
          await update(UNKNOWN_ID, noted, authorization),
          await move(UNKNOWN_ID, to('05:00'), authorization),
          await remove(UNKNOWN_ID, authorization),
          await update('not-an-id', {}, authorization),
          await move('not-an-id', {}, authorization),
          await remove('not-an-id', authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await everythingOf(id)).toEqual(before)
      },
    )

    it('forbids a customer the changes also of a booking of their own', async () => {
      const ownCustomerId = await insertCustomer(db)
      const { authorization } = await signedInUser(app, db, {
        customerId: ownCustomerId,
      })
      const { id } = await created({ customerId: ownCustomerId })
      const before = await everythingOf(id)

      const responses = [
        await update(id, { customerRequest: '短めに' }, authorization),
        await move(id, to('05:00'), authorization),
        await remove(id, authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await everythingOf(id)).toEqual(before)
    })

    it.each<[string, SignInAs, string]>([
      ['the owner of another salon', member('owner', salon), '404 3001'],
      ['a manager of another salon', member('manager', salon), '404 3001'],
      // A staff member removes no booking, wherever it is.
      ['a staff member of another salon', member('staff', salon), '403 1005'],
    ])(
      'answers %s like a booking that is not there, whatever status it has',
      async (_case, signInAs, removal) => {
        const authorization = await signInAs()
        const pending = (await created()).id
        const completed = await cutAt('03:00')
        await setStatus(completed, 'completed')
        const before = [
          await everythingOf(pending),
          await everythingOf(completed),
        ]

        const responses = [
          await update(pending, noted, authorization),
          await move(pending, to('05:00'), authorization),
          await update(completed, noted, authorization),
          await move(completed, to('05:00'), authorization),
          await remove(pending, authorization),
          await remove(completed, authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '404 3001',
          '404 3001',
          '404 3001',
          '404 3001',
          removal,
          removal,
        ])
        expect(responses[0]?.body.detail).toBe(
          `Booking ${pending} was not found`,
        )
        expect([
          await everythingOf(pending),
          await everythingOf(completed),
        ]).toEqual(before)
        expect(await countsOf()).toEqual(noCounts)
      },
    )

    it('lets an administrator change a booking of any salon, and a member those of their salon alone', async () => {
      const elsewhere = await salon()
      const there = await staffMember({}, elsewhere)
      const ofThere = await member('owner', async () => elsewhere)()
      const { id } = await created({
        salonId: elsewhere,
        staffId: there,
        services: [
          line({
            serviceId: await insertService({}, elsewhere),
            staffId: there,
          }),
        ],
      })
      const here = (await created()).id

      const responses = [
        await update(here, noted, ofThere),
        await move(here, to('05:00'), ofThere),
        await remove(here, ofThere),
        await update(id, noted, ofThere),
        await move(id, to('05:00', there)),
        await remove(id, ofThere),
        await remove(here),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '404 3001',
        '404 3001',
        '404 3001',
        '200',
        '200',
        '204',
        '204',
      ])
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const { id } = await created()
      const before = await everythingOf(id)
      const notJson = (call: Test, authorization: string | null): Test =>
        authorized(call, authorization)
          .set('Content-Type', 'application/json')
          .send('{"internalNotes": ')

      const responses = [
        await notJson(request(app).patch(`${BOOKINGS}/${id}`), null),
        await notJson(request(app).post(`${BOOKINGS}/${id}/reschedule`), null),
        await notJson(request(app).delete(`${BOOKINGS}/${id}`), null),
        await notJson(request(app).patch(`${BOOKINGS}/${id}`), asAdmin),
        await notJson(
          request(app).post(`${BOOKINGS}/${id}/reschedule`),
          asAdmin,
        ),
        await authorized(request(app).patch(`${BOOKINGS}/${id}`), null)
          .set('Content-Type', 'text/plain')
          .send('the customer will be late'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(await everythingOf(id)).toEqual(before)
    })

    it('checks an update in order: the token, the account, the ID, the body, the booking', async () => {
      const { id } = await created()
      const asCustomer = (await signedInUser(app, db)).authorization
      const elsewhere = await member('owner', salon)()
      const invalid = { depositAmount: -1 }

      const responses = [
        await update('not-an-id', invalid, null),
        await update('not-an-id', invalid, asCustomer),
        await update('not-an-id', invalid),
        await update(UNKNOWN_ID, invalid),
        await update(id, invalid, elsewhere),
        await update(UNKNOWN_ID, noted),
        await update(id, noted, elsewhere),
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
      ).toEqual(['Invalid booking ID', INVALID_UPDATE, INVALID_UPDATE])
    })

    it('checks a move in order: the token, the account, the ID, the body, the booking, its status', async () => {
      const { id } = await created()
      await setStatus(id, 'completed')
      const asCustomer = (await signedInUser(app, db)).authorization
      const elsewhere = await member('owner', salon)()
      const invalid = { startTime: at('05:00') }
      // The staff member is no one's: that is found after the status.
      const valid = to('05:00', UNKNOWN_ID)

      const responses = [
        await move('not-an-id', invalid, null),
        await move('not-an-id', invalid, asCustomer),
        await move('not-an-id', invalid),
        await move(UNKNOWN_ID, invalid),
        await move(id, invalid, elsewhere),
        await move(UNKNOWN_ID, valid),
        await move(id, valid, elsewhere),
        await move(id, valid),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '400 2001',
        '400 2001',
        '404 3001',
        '404 3001',
        '409 3003',
      ])
      expect(
        responses.map((response) => response.body.detail).slice(2, 5),
      ).toEqual(['Invalid booking ID', INVALID_RESCHEDULE, INVALID_RESCHEDULE])
    })

    it('checks a removal in order: the token, the account, the ID, the booking, what refers to it', async () => {
      const { id } = await created()
      await insertSale(id)
      const asCustomer = (await signedInUser(app, db)).authorization
      const asStaff = await member('staff')()
      const elsewhere = await member('owner', salon)()

      const responses = [
        await remove('not-an-id', null),
        await remove('not-an-id', asCustomer),
        await remove('not-an-id', asStaff),
        await remove('not-an-id'),
        await remove(UNKNOWN_ID),
        await remove(id, elsewhere),
        await remove(id),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '403 1005',
        '400 2001',
        '404 3001',
        '404 3001',
        '409 3003',
      ])
    })
  })

  describe('requests at the same moment', () => {
    // A move locks the staff members of the booking before it looks at who
    // is occupied, as a new booking does: the bookings of a staff member
    // are written one after the other and each sees the ones before it.
    it('moves one of two bookings to a time both want of the same staff member', async () => {
      const members = await Promise.all(
        Array.from({ length: 4 }, () => staffMember()),
      )
      const pairs = await Promise.all(
        members.map(async (id) => ({
          member: id,
          first: await cutAt('01:00', id),
          second: await cutAt('03:00', id),
        })),
      )

      const rounds = await Promise.all(
        pairs.map(({ member: id, first, second }) =>
          Promise.all([
            move(first, to('05:00', id)),
            move(second, to('05:30', id)),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode).toSorted()).toEqual(['200', '409 3003'])
      }
    })

    it('enters a booking at a time or moves another one there, not both', async () => {
      const members = await Promise.all(
        Array.from({ length: 4 }, () => staffMember()),
      )
      const there = await Promise.all(
        members.map(async (id) => ({
          member: id,
          id: await cutAt('01:00', id),
        })),
      )

      const rounds = await Promise.all(
        there.map(({ member: by, id }) =>
          Promise.all([
            move(id, to('05:00', by)),
            create(
              booking({
                staffId: by,
                services: [line({ staffId: by, startTime: at('05:30') })],
              }),
            ),
          ]),
        ),
      )

      for (const round of rounds) {
        expect([
          ['200', '409 3003'],
          ['409 3003', '201'],
        ]).toContainEqual(round.map(statusAndCode))
      }
    })

    it('moves as many of six bookings to a time as the staff member takes at once', async () => {
      const two = await staffMember({ maxConcurrentBookings: 2 })
      const ids = await Promise.all(
        ['10', '11', '12', '13', '14', '15'].map((day) =>
          cutAt('01:00', two, day),
        ),
      )

      const responses = await Promise.all(
        ids.map((id) => move(id, to('05:00', two))),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
    })

    it('moves one of two bookings that want two staff members in opposite orders, and neither waits for the other for ever', async () => {
      const other = await staffMember()
      const both = async (first: string, second: string, day: string) =>
        (
          await created({
            services: [
              line({ staffId: first, startTime: at('01:00', day) }),
              line({ staffId: second, startTime: at('01:00', day) }),
            ],
          })
        ).id
      const pairs = await Promise.all(
        ['11', '13', '15', '17'].map(async (day) => ({
          day,
          one: await both(staffId, other, day),
          two: await both(other, staffId, String(Number(day) + 1)),
        })),
      )

      const rounds = await Promise.all(
        pairs.map(({ day, one, two }) =>
          Promise.all([
            move(one, to('07:00', staffId, day)),
            move(two, to('07:00', staffId, day)),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode).toSorted()).toEqual(['200', '409 3003'])
      }
    })

    // Every change of a booking holds it first, so of two on one booking the
    // second meets what the first made of it.
    it('waits for a change of the status that is being written, then meets what it made of the booking', async () => {
      const { id } = await created()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set(inStatus('cancelled'))
          .where(eq(bookings.id, id))
        const underWay = move(id, to('05:00')).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(response.body.detail).toMatch(/^A booking that is cancelled /)
      expect(await startOf(id)).toBe(written('01:00'))
    })

    // The time zone of the salon tells the day of the visit, so the salon is
    // held while a booking is moved, as it is while one is entered.
    it('waits for a change of the salon that is being written, then tells the day of the visit by the time zone it has', async () => {
      const { id } = await created()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(salons)
          .set({ timezone: 'America/New_York' })
          .where(eq(salons.id, salonId))
        const underWay = move(id, to('02:00')).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      // Eleven in the morning in Tokyo is nine in the evening before in New York.
      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        startTime: written('02:00'),
        bookingDate: '2026-11-19',
      })
    })

    it('takes a note, a move and a confirmation of a booking at the same moment, and loses none of them', async () => {
      const members = await Promise.all(
        Array.from({ length: 4 }, () => staffMember()),
      )
      const there = await Promise.all(
        members.map(async (by) => ({ by, id: await cutAt('01:00', by) })),
      )

      const rounds = await Promise.all(
        there.map(({ by, id }) =>
          Promise.all([
            update(id, noted),
            move(id, to('05:00', by)),
            confirm(id),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode)).toEqual(['200', '200', '200'])
      }
      for (const { id } of there) {
        expect(await stored(id)).toMatchObject({
          ...noted,
          status: 'confirmed',
        })
        expect(await startOf(id)).toBe(written('05:00'))
        expect(await storedHistory(id)).toHaveLength(2)
      }
    })

    it('removes a booking once of six times', async () => {
      const { id } = await visit()

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => remove(id)),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '204',
        '404 3001',
        '404 3001',
        '404 3001',
        '404 3001',
        '404 3001',
      ])
    })

    it('removes a booking that is being changed: the change succeeds or finds no booking, and nothing of the booking is left', async () => {
      const changes: ((id: string, by: string) => Test)[] = [
        (id) => update(id, noted),
        (id, by) => move(id, to('05:00', by)),
        (id) => confirm(id),
        (id) => update(id, noted),
        (id, by) => move(id, to('05:00', by)),
        (id) => confirm(id),
      ]
      const there = await Promise.all(
        changes.map(async (change) => {
          const by = await staffMember()
          return { change, by, id: await cutAt('01:00', by) }
        }),
      )

      const rounds = await Promise.all(
        there.map(({ change, by, id }) =>
          Promise.all([change(id, by), remove(id)]),
        ),
      )

      for (const [change, removal] of rounds) {
        expect(['200', '404 3001']).toContain(statusAndCode(change))
        expect(removal.status).toBe(204)
      }
      expect(await db.$count(bookings)).toBe(0)
      expect(await db.$count(bookingServices)).toBe(0)
      expect(await db.$count(bookingStatusHistories)).toBe(0)
    })

    it('waits for a sale that is being written for the booking, then leaves the booking to it', async () => {
      const { id } = await created()

      const { pending } = await db.transaction(async (tx) => {
        await tx.insert(sales).values({
          saleNumber: 'SL-UNDER-WAY',
          salonId,
          bookingId: id,
          saleDate: '2026-11-20',
          saleTime: at('02:00'),
          subtotal: 6000,
          taxAmount: 600,
          totalAmount: 6600,
        })
        const underWay = remove(id).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        'The booking cannot be deleted: a sale refers to it',
      )
      expect(await db.$count(bookings)).toBe(1)
    })

    // The customer is held before their bookings are counted, so a count
    // never misses what another change is about to commit.
    it('counts what a customer has without the bookings that are removed while others of theirs are completed', async () => {
      const days = ['11', '12', '13', '14']
      const visited = await Promise.all(
        days.map((day) => cutAt('01:00', staffId, day)),
      )
      const toVisit = await Promise.all(
        days.map((day) => cutAt('05:00', staffId, day)),
      )
      for (const id of visited) {
        await setStatus(id, 'completed')
      }
      for (const id of toVisit) {
        await setStatus(id, 'confirmed')
      }

      const responses = await Promise.all([
        ...visited.map((id) => remove(id)),
        ...toVisit.map((id) =>
          authorized(
            request(app).post(`${BOOKINGS}/${id}/complete`),
            asAdmin,
          ).send({ actualStartTime: null, actualEndTime: null }),
        ),
      ])

      expect(responses.map(statusAndCode)).toEqual([
        '204',
        '204',
        '204',
        '204',
        '200',
        '200',
        '200',
        '200',
      ])
      expect(await countsOf()).toEqual({
        ...noCounts,
        visitCount: 4,
        firstVisitDate: '2026-11-11',
        lastVisitDate: '2026-11-14',
      })
    })

    // `now()` is the moment a transaction began, which is before what it
    // waited for: by it, a change that came second would be noted as the
    // earlier one.
    it('writes the times of the moment it got hold of the booking, not of the moment it began to wait', async () => {
      const ids = await Promise.all(
        ['11', '12', '13'].map((day) => cutAt('01:00', staffId, day)),
      )
      const [noting = '', moving = '', removing = ''] = ids
      await setStatus(removing, 'completed')

      const { pending, until } = await db.transaction(async (tx) => {
        for (const id of ids) {
          await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, id))
            .for('update')
        }
        const underWay = Promise.all([
          update(noting, noted),
          move(moving, to('05:00', staffId, '12')),
          remove(removing),
        ])
        await pause(300)

        return { pending: underWay, until: await databaseClock() }
      })
      const [updated, moved, removed] = await pending
      const after = await databaseClock()

      expect([updated, moved, removed].map(statusAndCode)).toEqual([
        '200',
        '200',
        '204',
      ])
      expectBetween(updated.body.data.updatedAt, until, after)
      expectBetween(moved.body.data.updatedAt, until, after)
      const lineTimes = await db
        .select({ at: epochMs(bookingServices.updatedAt) })
        .from(bookingServices)
        .where(eq(bookingServices.bookingId, moving))
      expect(lineTimes).toEqual([{ at: expect.any(Number) }])
      expect(lineTimes[0]?.at).toBeGreaterThanOrEqual(until)
      expect(lineTimes[0]?.at).toBeLessThanOrEqual(after)
      // The customer is written by the removal of a booking that was counted.
      const countedAt = await customerWrittenAt()
      expect(countedAt).toBeGreaterThanOrEqual(until)
      expect(countedAt).toBeLessThanOrEqual(after)
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
    const moving = (
      time: string,
      member: string = staffId,
    ): RequestedBookingMove => ({
      startTime: written(time),
      staffId: staffIdSchema.parse(member),
    })

    /**
     * Gives a booking two more lines, stored in another order than their
     * own, and the ledger a booking of another staff member: what a reader
     * of the lines of one booking neither mixes up nor takes along.
     */
    const withMoreLines = async (id: string): Promise<void> => {
      for (const sortOrder of [4, 3]) {
        await db.insert(bookingServices).values({
          bookingId: id,
          serviceId: cutId,
          staffId: null,
          startTime: at('03:30'),
          endTime: at('04:30'),
          duration: 60,
          price: 6600,
          finalPrice: 6600,
          taxIncluded: true,
          sortOrder,
        })
      }
      await cutAt('01:00', await staffMember())
    }

    describe('update', () => {
      it('writes the notes of a booking within the reach and returns it with its lines, and no others, in their order', async () => {
        const { id } = await visit()
        await withMoreLines(id)

        const ofEverySalon = dataOf(
          await repository().update(bookingIdSchema.parse(id), everySalon, {
            internalNotes: 'お子様連れ',
          }),
        )
        const ofTheSalon = dataOf(
          await repository().update(
            bookingIdSchema.parse(id),
            salonOnly(salonId),
            { depositAmount: 500, source: null },
          ),
        )

        expect(ofEverySalon).toMatchObject({
          booking: { id, internalNotes: 'お子様連れ', depositAmount: null },
          services: [
            { sortOrder: 0 },
            { sortOrder: 1 },
            { sortOrder: 2 },
            { sortOrder: 3 },
            { sortOrder: 4 },
          ],
        })
        expect(ofTheSalon).toMatchObject({
          booking: { id, internalNotes: 'お子様連れ', depositAmount: 500 },
          services: [
            { sortOrder: 0 },
            { sortOrder: 1 },
            { sortOrder: 2 },
            { sortOrder: 3 },
            { sortOrder: 4 },
          ],
        })
      })

      it('finds nothing outside the reach, and nothing for an ID no booking has', async () => {
        const { id } = await created()
        const before = await stored(id)

        const outside = dataOf(
          await repository().update(
            bookingIdSchema.parse(id),
            salonOnly(await salon()),
            noted,
          ),
        )
        const unknown = dataOf(
          await repository().update(
            bookingIdSchema.parse(UNKNOWN_ID),
            everySalon,
            noted,
          ),
        )

        expect([outside, unknown]).toEqual([null, null])
        expect(await stored(id)).toEqual(before)
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(connection.database).update(
          bookingIdSchema.parse(UNKNOWN_ID),
          everySalon,
          noted,
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to update booking' },
        })
      })
    })

    describe('reschedule', () => {
      it('moves a booking within the reach and returns it with its lines, and no others, in their order', async () => {
        const { id, second } = await visit()
        await withMoreLines(id)

        const ofEverySalon = dataOf(
          await repository().reschedule(
            bookingIdSchema.parse(id),
            everySalon,
            moving('05:30'),
          ),
        )
        const ofTheSalon = dataOf(
          await repository().reschedule(
            bookingIdSchema.parse(id),
            salonOnly(salonId),
            moving('01:00', second),
          ),
        )

        expect(ofEverySalon).toMatchObject({
          type: 'rescheduled',
          booking: {
            booking: { id, staffId, bookingDate: '2026-11-20' },
            services: [
              { sortOrder: 0, staffId },
              { sortOrder: 1, staffId: second },
              { sortOrder: 2, staffId: null },
              { sortOrder: 3, staffId: null },
              { sortOrder: 4, staffId: null },
            ],
          },
        })
        expect(ofTheSalon).toMatchObject({
          type: 'rescheduled',
          booking: {
            booking: { id, staffId: second },
            services: [
              { sortOrder: 0, staffId: second },
              { sortOrder: 1, staffId: second },
              { sortOrder: 2, staffId: null },
              { sortOrder: 3, staffId: null },
              { sortOrder: 4, staffId: null },
            ],
          },
        })
      })

      it('finds nothing outside the reach, and nothing for an ID no booking has', async () => {
        const { id } = await created()
        const before = await everythingOf(id)

        const outside = dataOf(
          await repository().reschedule(
            bookingIdSchema.parse(id),
            salonOnly(await salon()),
            moving('05:00'),
          ),
        )
        const unknown = dataOf(
          await repository().reschedule(
            bookingIdSchema.parse(UNKNOWN_ID),
            everySalon,
            moving('05:00'),
          ),
        )

        expect([outside, unknown]).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
        ])
        expect(await everythingOf(id)).toEqual(before)
      })

      it('says why the booking was not moved', async () => {
        const closed = await cutAt('01:00')
        await setStatus(closed, 'completed')
        const open = await cutAt('03:00')
        const reschedule = (id: string, time: string, member?: string) =>
          repository()
            .reschedule(
              bookingIdSchema.parse(id),
              everySalon,
              moving(time, member),
            )
            .then(dataOf)

        expect(await reschedule(closed, '05:00')).toEqual({
          type: 'statusDoesNotAllow',
          status: 'completed',
          allowed: ['draft', 'pending', 'confirmed'],
        })
        expect(await reschedule(open, '05:00', UNKNOWN_ID)).toEqual({
          type: 'invalid',
          issues: [
            {
              field: 'staffId',
              rule: 'not_found',
              message: ruleMessages.aStaffMemberOfSalon,
            },
          ],
        })
        expect(await reschedule(open, '01:30')).toEqual({
          type: 'staffOccupied',
          staffIds: [staffId],
        })
        await db
          .update(salons)
          .set({ timezone: 'Mars/Olympus' })
          .where(eq(salons.id, salonId))
        expect(await reschedule(open, '05:00')).toEqual({
          type: 'timeZoneUnknown',
        })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(
          connection.database,
        ).reschedule(
          bookingIdSchema.parse(UNKNOWN_ID),
          everySalon,
          moving('05:00'),
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to reschedule booking' },
        })
      })
    })

    describe('delete', () => {
      it('removes a booking within the reach', async () => {
        const first = await cutAt('01:00')
        const second = await cutAt('03:00')

        const results = [
          dataOf(
            await repository().delete(bookingIdSchema.parse(first), everySalon),
          ),
          dataOf(
            await repository().delete(
              bookingIdSchema.parse(second),
              salonOnly(salonId),
            ),
          ),
        ]

        expect(results).toEqual([{ type: 'deleted' }, { type: 'deleted' }])
        expect(await db.$count(bookings)).toBe(0)
      })

      it('finds nothing outside the reach, and nothing for an ID no booking has', async () => {
        const { id } = await created()

        const outside = dataOf(
          await repository().delete(
            bookingIdSchema.parse(id),
            salonOnly(await salon()),
          ),
        )
        const unknown = dataOf(
          await repository().delete(
            bookingIdSchema.parse(UNKNOWN_ID),
            everySalon,
          ),
        )

        expect([outside, unknown]).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
        ])
        expect(await db.$count(bookings)).toBe(1)
      })

      it('says what refers to a booking that stays, the sale first and the review last', async () => {
        const { id } = await created()
        await insertReview(id)
        await insertTreatmentRecord(id)
        await insertSale(id)

        expect(
          dataOf(
            await repository().delete(bookingIdSchema.parse(id), everySalon),
          ),
        ).toEqual({
          type: 'referredTo',
          by: ['sale', 'treatmentRecord', 'review'],
        })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(connection.database).delete(
          bookingIdSchema.parse(UNKNOWN_ID),
          everySalon,
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to delete booking' },
        })
      })
    })
  })
})
