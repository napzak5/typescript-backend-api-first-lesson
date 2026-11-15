import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  services,
} from '@beauty-salon-backend/database'
import {
  type BookingReach,
  bookingIdSchema,
  type DomainError,
  salonIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { BookingRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { asc, eq, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertStaff,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
} from './_shared/auth-helpers'
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
} from './_shared/test-helpers'

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

type Status = (typeof bookings.status.enumValues)[number]
type Action = 'confirm' | 'cancel' | 'start' | 'complete' | 'no-show'

const STATUSES: Status[] = [
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]

/**
 * The actions on the status of a booking: the body that keeps every rule
 * (null for an action without one), the statuses it leads on from, the one
 * it leads to, and what a refusal calls it.
 */
const ACTIONS: Record<
  Action,
  { body: object | null; from: Status[]; to: Status; done: string }
> = {
  confirm: {
    body: null,
    from: ['draft', 'pending'],
    to: 'confirmed',
    done: 'confirmed',
  },
  cancel: {
    body: { cancellationReason: null },
    from: ['draft', 'pending', 'confirmed'],
    to: 'cancelled',
    done: 'cancelled',
  },
  start: {
    body: null,
    from: ['confirmed'],
    to: 'in_progress',
    done: 'started',
  },
  complete: {
    body: { actualStartTime: null, actualEndTime: null },
    from: ['confirmed', 'in_progress'],
    to: 'completed',
    done: 'completed',
  },
  'no-show': {
    body: null,
    from: ['pending', 'confirmed'],
    to: 'no_show',
    done: 'noted as one the customer did not come to',
  },
}

const ACTION_NAMES: Action[] = [
  'confirm',
  'cancel',
  'start',
  'complete',
  'no-show',
]

/** Every action with a status it leads on from, and the status it leads to. */
const TAKEN: [Action, Status, Status][] = ACTION_NAMES.flatMap((action) =>
  ACTIONS[action].from.map((from): [Action, Status, Status] => [
    action,
    from,
    ACTIONS[action].to,
  ]),
)

/** Every action with a status it does not lead on from. */
const REFUSED: [Action, Status][] = ACTION_NAMES.flatMap((action) =>
  STATUSES.filter((status) => !ACTIONS[action].from.includes(status)).map(
    (status): [Action, Status] => [action, status],
  ),
)

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/**
 * A time of a day of October 2026 in UTC, `HH:MM`; ten in the morning in
 * Tokyo is 01:00. The days have passed, whenever the tests run.
 */
const at = (time: string, day = '20'): string => `2026-10-${day}T${time}:00Z`

/** The same time as a response writes it. */
const written = (time: string, day = '20'): string =>
  `2026-10-${day}T${time}:00.000Z`

const MINUTE = 60_000

describe('Booking status API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** A signed-in admin. */
  let admin: { id: string; authorization: string }
  /** The Authorization header of the admin. */
  let asAdmin: string
  /** The salon of most tests, in Tokyo. */
  let salonId: string
  let customerId: string
  /** A staff member of the salon who takes one booking at a time and keeps no time free. */
  let staffId: string
  /** A cut of the salon: 60 minutes, 6,600 yen with the tax in it. */
  let cutId: string

  type NewBooking = typeof bookings.$inferInsert
  type NewBookingService = typeof bookingServices.$inferInsert
  type NewCustomer = typeof customers.$inferInsert
  type Executor = Pick<typeof db, 'insert'>

  const salon = (): Promise<string> =>
    insertSalon(db, { timezone: 'Asia/Tokyo', taxRate: '10.00' })

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    admin = await signedInUser(app, db, { role: 'admin' })
    asAdmin = admin.authorization
    salonId = await salon()
    customerId = await insertCustomer(db)
    staffId = await insertStaff(db, salonId, {
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
    })
    const [cut] = await db
      .insert(services)
      .values({
        salonId,
        name: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
      })
      .returning({ id: services.id })
    if (cut === undefined) {
      throw new Error('No service was inserted')
    }
    cutId = cut.id
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Takes an action on a booking, with the body that keeps every rule; as the admin unless said otherwise. */
  const act = (
    id: string,
    action: Action,
    as: string | null = asAdmin,
    body: object | null = ACTIONS[action].body,
  ): Test => {
    const call = authorized(
      request(app).post(`${BOOKINGS}/${id}/${action}`),
      as,
    )
    return body === null ? call : call.send(body)
  }

  /** Reads a booking; as the admin unless said otherwise. */
  const read = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${BOOKINGS}/${id}`), as)

  /** The moment of the clock that the status actions write by. */
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

  let rows = 0

  /** A row of `bookings` that keeps every constraint: pending, an hour from ten in Tokyo, on a day that has passed. */
  const bookingRow = (overrides: Partial<NewBooking> = {}): NewBooking => {
    rows += 1
    return {
      bookingNumber: `BK-TEST-${String(rows).padStart(4, '0')}`,
      salonId,
      customerId,
      staffId,
      bookingDate: '2026-10-20',
      startTime: at('01:00'),
      endTime: at('02:00'),
      duration: 60,
      status: 'pending',
      subtotal: 6600,
      totalAmount: 6600,
      ...overrides,
    }
  }

  /** A row of `booking_services` that keeps every constraint: the cut of the row above. */
  const lineRow = (
    bookingId: string,
    overrides: Partial<NewBookingService> = {},
  ): NewBookingService => ({
    bookingId,
    serviceId: cutId,
    staffId,
    startTime: at('01:00'),
    endTime: at('02:00'),
    duration: 60,
    price: 6600,
    finalPrice: 6600,
    ...overrides,
  })

  /** A status with the times the table wants a booking in that status to have, and no others. */
  const inStatus = (status: Status): Partial<NewBooking> => ({
    status,
    cancelledAt: status === 'cancelled' ? at('00:30') : null,
    completedAt: status === 'completed' ? at('02:00') : null,
    actualStartTime: status === 'in_progress' ? at('01:05') : null,
  })

  /** Inserts a booking with one service line directly; returns the ID of the booking. */
  const insertBooking = async (
    overrides: Partial<NewBooking> = {},
    lineOverrides: Partial<NewBookingService> = {},
    executor: Executor = db,
  ): Promise<string> => {
    const [row] = await executor
      .insert(bookings)
      .values(bookingRow(overrides))
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    await executor
      .insert(bookingServices)
      .values(lineRow(row.id, lineOverrides))
    return row.id
  }

  /** A booking in a status, written directly. */
  const bookingIn = (
    status: Status,
    overrides: Partial<NewBooking> = {},
  ): Promise<string> => insertBooking({ ...inStatus(status), ...overrides })

  /** The times of a booking that begins so many minutes from now, on a whole minute. */
  const beginning = (minutes: number): Partial<NewBooking> => {
    const start = Math.floor(Date.now() / MINUTE) * MINUTE + minutes * MINUTE
    return {
      bookingDate: new Date(start).toISOString().slice(0, 10),
      startTime: new Date(start).toISOString(),
      endTime: new Date(start + 60 * MINUTE).toISOString(),
    }
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

  /** The status history of a booking, oldest first. */
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

  /** What a customer has of visits, cancellations and no-shows. */
  const countsOf = async (id: string = customerId) => {
    const [row] = await db
      .select({
        visitCount: customers.visitCount,
        cancellationCount: customers.cancellationCount,
        noShowCount: customers.noShowCount,
        firstVisitDate: customers.firstVisitDate,
        lastVisitDate: customers.lastVisitDate,
      })
      .from(customers)
      .where(eq(customers.id, id))
    if (row === undefined) {
      throw new Error(`Customer ${id} is not stored`)
    }
    return row
  }

  const noCounts = {
    visitCount: 0,
    cancellationCount: 0,
    noShowCount: 0,
    firstVisitDate: null,
    lastVisitDate: null,
  }

  /** A signed-in member of a salon; of the salon of the tests unless another is given. */
  const member = async (
    role: 'owner' | 'manager' | 'staff',
    salonOf: () => Promise<string> = async () => salonId,
  ): Promise<{ authorization: string; userId: string }> => {
    const { id, email } = await insertMember(db, role, await salonOf())
    return {
      authorization: (await signIn(app, email)).authorization,
      userId: id,
    }
  }

  /** Signs in and returns the Authorization header to send and the ID of the user. */
  type SignInAs = () => Promise<{ authorization: string; userId: string }>

  /** Everyone who keeps the ledger of the salon of the tests. */
  const keepers: [string, SignInAs][] = [
    [
      'an administrator',
      async () => ({ authorization: asAdmin, userId: admin.id }),
    ],
    ['the owner of the salon', () => member('owner')],
    ['a manager of the salon', () => member('manager')],
    ['a staff member of the salon', () => member('staff')],
  ]

  /** The members of another salon than the one of the tests. */
  const membersOfAnotherSalon: [string, SignInAs][] = [
    ['the owner of another salon', () => member('owner', salon)],
    ['a manager of another salon', () => member('manager', salon)],
    ['a staff member of another salon', () => member('staff', salon)],
  ]

  /** Accounts the ledger is closed to. */
  const notKeepers: [string, () => Promise<string>][] = [
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
      async () => {
        const { email } = await insertMember(db, 'staff', salonId, {
          deletedAt: '2026-10-01T00:00:00.000Z',
        })
        return (await signIn(app, email)).authorization
      },
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

  describe('every action', () => {
    it.each(TAKEN)(
      '%s moves a booking that is %s to %s, notes it in the history and returns the booking as it is then',
      async (action, from, to) => {
        const id = await bookingIn(from)
        // Another booking, whose lines the response does not have.
        await bookingIn('pending')
        const before = await databaseClock()

        const response = await act(id, action)
        const after = await databaseClock()

        expect(response.status).toBe(200)
        expect(response.headers['content-type']).toBe(JSON_UTF8)
        expect(response.body).toEqual({
          data: expect.objectContaining({ id, status: to }),
          meta: {
            correlationId: expect.any(String),
            timestamp: expect.stringMatching(ISO_TIMESTAMP),
            version: 'v1',
          },
          links: { self: `${BOOKINGS}/${id}`, list: BOOKINGS },
        })
        expectBetween(response.body.data.updatedAt, before, after)
        expect((await read(id)).body.data).toEqual(response.body.data)
        expect(await historyOf(id)).toEqual([
          {
            fromStatus: from,
            toStatus: to,
            changedBy: admin.id,
            reason: null,
            metadata: null,
          },
        ])
      },
    )

    it.each(REFUSED)(
      '%s refuses a booking that is %s with 409, and changes nothing',
      async (action, status) => {
        const id = await bookingIn(status)
        const before = await stored(id)

        const response = await act(id, action)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `A booking that is ${status} cannot be ${ACTIONS[action].done}; its status has to be ${ACTIONS[action].from.join(' or ')}`,
        )
        expect(await stored(id)).toEqual(before)
        expect(await storedLines(id)).toEqual([
          expect.objectContaining({ isCompleted: false, completedAt: null }),
        ])
        expect(await historyOf(id)).toEqual([])
        expect(await countsOf()).toEqual(noCounts)
      },
    )

    it.each(ACTION_NAMES)(
      '%s answers an ID that no booking has with 404',
      async (action) => {
        const response = await act(UNKNOWN_ID, action)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
      },
    )

    it.each(ACTION_NAMES)(
      '%s answers what is not an ID with 400, before it looks at the body',
      async (action) => {
        const responses = [
          await act('latest', action),
          await act('BK-TEST-0001', action),
          await act(`${UNKNOWN_ID}0`, action),
          await act('latest', action, asAdmin, { unknown: true }),
        ]

        for (const response of responses) {
          expectProblem(response, badRequest)
          expect(response.body.detail).toBe('Invalid booking ID')
          expect(brokenRules(response)).toHaveLength(1)
          expect(brokenRules(response)[0]).toMatch(/^id:/)
        }
      },
    )

    it.each(ACTION_NAMES)(
      '%s finds the booking by its ID in capitals, and says where it is by the path it was asked at',
      async (action) => {
        const id = await bookingIn(
          action === 'confirm' ? 'pending' : 'confirmed',
        )
        const call = authorized(
          request(app).post(`/API/V1/Bookings/${id.toUpperCase()}/${action}`),
          asAdmin,
        )
        const { body } = ACTIONS[action]

        const response = await (body === null ? call : call.send(body))

        expect(response.status).toBe(200)
        expect(response.body.data.id).toBe(id)
        expect(response.body.links).toEqual({
          self: `/API/V1/Bookings/${id}`,
          list: '/API/V1/Bookings',
        })
      },
    )

    it.each(ACTION_NAMES)(
      '%s is there for POST alone, and nothing is below it',
      async (action) => {
        const id = await bookingIn('confirmed')
        const address = `${BOOKINGS}/${id}/${action}`

        const responses = [
          await authorized(request(app).get(address), asAdmin),
          await authorized(request(app).put(address), asAdmin).send({}),
          await authorized(request(app).patch(address), asAdmin).send({}),
          await authorized(request(app).delete(address), asAdmin),
          await authorized(request(app).post(`${address}/again`), asAdmin),
          // Without a booking, the name of an action is an ID that is none.
          await authorized(
            request(app).post(`${BOOKINGS}/${action}`),
            asAdmin,
          ).send(ACTIONS[action].body ?? {}),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '404 3001',
          '404 3001',
          '404 3001',
          '404 3001',
          '404 3001',
          '404 3001',
        ])
        expect((await stored(id)).status).toBe('confirmed')
      },
    )

    it('changes the status when a booking is confirmed, and nothing else of it', async () => {
      const id = await insertBooking({
        depositAmount: 1000,
        customerRequest: '前回と同じ長さで',
        internalNotes: '電話で受付',
        source: 'phone',
      })
      const { status: _status, updatedAt, ...before } = await stored(id)

      await act(id, 'confirm')

      const { status, updatedAt: changedAt, ...after } = await stored(id)
      expect(status).toBe('confirmed')
      expect(changedAt).not.toBe(updatedAt)
      expect(after).toEqual(before)
      expect(await countsOf()).toEqual(noCounts)
    })

    it('takes no body for the actions that have none: what is sent is not looked at', async () => {
      const responses = [
        await act(await bookingIn('pending'), 'confirm', asAdmin, {
          status: 'cancelled',
        }),
        await act(await bookingIn('confirmed'), 'start', asAdmin, {
          actualStartTime: at('01:00'),
        }),
        await act(await bookingIn('confirmed'), 'no-show', asAdmin, {
          cancellationReason: 'x',
        }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200'])
      expect(responses.map((response) => response.body.data.status)).toEqual([
        'confirmed',
        'in_progress',
        'no_show',
      ])
    })
  })

  describe('POST /api/v1/bookings/:id/cancel', () => {
    it('notes when, by whom and why, and a fee of 0', async () => {
      const id = await bookingIn('confirmed')
      const manager = await member('manager')
      const before = await databaseClock()

      const response = await act(id, 'cancel', manager.authorization, {
        cancellationReason: 'お客様のご都合',
      })
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        status: 'cancelled',
        cancelledBy: manager.userId,
        cancellationReason: 'お客様のご都合',
        cancellationFee: 0,
        completedAt: null,
        actualStartTime: null,
        actualEndTime: null,
      })
      expectBetween(response.body.data.cancelledAt, before, after)
      expect(await historyOf(id)).toEqual([
        {
          fromStatus: 'confirmed',
          toStatus: 'cancelled',
          changedBy: manager.userId,
          reason: 'お客様のご都合',
          metadata: null,
        },
      ])
      expect(await storedLines(id)).toEqual([
        expect.objectContaining({ isCompleted: false, completedAt: null }),
      ])
    })

    it('takes null for a cancellation without a reason', async () => {
      const id = await bookingIn('pending')

      const response = await act(id, 'cancel')

      expect(response.body.data).toMatchObject({
        status: 'cancelled',
        cancelledBy: admin.id,
        cancellationReason: null,
        cancellationFee: 0,
      })
    })

    it('cancels a booking whose time has passed and one that is still to come', async () => {
      const responses = [
        await act(await bookingIn('confirmed', beginning(-600)), 'cancel'),
        await act(await bookingIn('confirmed', beginning(600)), 'cancel'),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
    })

    it.each<[string, object | null, string[]]>([
      ['no body', null, [':invalid_type']],
      ['a body without the reason', {}, ['cancellationReason:invalid_type']],
      [
        'an empty reason',
        { cancellationReason: '' },
        ['cancellationReason:invalid_format'],
      ],
      [
        'a reason of spaces',
        { cancellationReason: ' \n' },
        ['cancellationReason:invalid_format'],
      ],
      [
        'a reason that is not text',
        { cancellationReason: 5 },
        ['cancellationReason:invalid_type'],
      ],
      [
        'a fee, which the system sets',
        { cancellationReason: null, cancellationFee: 500 },
        ['cancellationFee:unrecognized_keys'],
      ],
      [
        'who cancelled, which the system notes',
        { cancellationReason: null, cancelledBy: UNKNOWN_ID },
        ['cancelledBy:unrecognized_keys'],
      ],
    ])(
      'answers %s with 400, and cancels nothing',
      async (_case, body, rules) => {
        const id = await bookingIn('pending')

        const response = await act(id, 'cancel', asAdmin, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid booking cancellation')
        expect(brokenRules(response)).toEqual(rules)
        expect((await stored(id)).status).toBe('pending')
        expect(await historyOf(id)).toEqual([])
      },
    )

    it('frees the staff member: another booking takes the time', async () => {
      const id = await bookingIn('confirmed')
      const again = () =>
        authorized(request(app).post(BOOKINGS), asAdmin).send({
          salonId,
          customerId,
          staffId,
          depositAmount: null,
          customerRequest: null,
          internalNotes: null,
          source: null,
          services: [
            { serviceId: cutId, staffId, startTime: at('01:00'), notes: null },
          ],
        })

      const whileBooked = await again()
      await act(id, 'cancel')
      const afterwards = await again()

      expect([whileBooked, afterwards].map(statusAndCode)).toEqual([
        '409 3003',
        '201',
      ])
    })
  })

  describe('POST /api/v1/bookings/:id/start', () => {
    it('notes the moment as the actual start of the visit', async () => {
      const id = await bookingIn('confirmed')
      const before = await databaseClock()

      const response = await act(id, 'start')
      const after = await databaseClock()

      expect(response.body.data).toMatchObject({
        status: 'in_progress',
        actualEndTime: null,
        completedAt: null,
        cancelledAt: null,
      })
      expectBetween(response.body.data.actualStartTime, before, after)
    })

    it('begins a visit before and after the time it was booked for', async () => {
      const responses = [
        await act(await bookingIn('confirmed', beginning(600)), 'start'),
        await act(await bookingIn('confirmed', beginning(-600)), 'start'),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
    })
  })

  describe('POST /api/v1/bookings/:id/complete', () => {
    it('completes every service line that is not, at the moment the booking is completed', async () => {
      const id = await bookingIn('confirmed')
      await db.insert(bookingServices).values([
        lineRow(id, {
          sortOrder: 1,
          isCompleted: true,
          completedAt: at('01:30'),
        }),
        lineRow(id, { sortOrder: 2, staffId: null }),
      ])
      const before = await databaseClock()

      const response = await act(id, 'complete')
      const after = await databaseClock()

      const { completedAt, services: lines } = response.body.data
      expect(response.body.data.status).toBe('completed')
      expectBetween(completedAt, before, after)
      expect(lines).toEqual([
        expect.objectContaining({
          sortOrder: 0,
          isCompleted: true,
          completedAt,
        }),
        expect.objectContaining({
          sortOrder: 1,
          isCompleted: true,
          completedAt: written('01:30'),
        }),
        expect.objectContaining({
          sortOrder: 2,
          isCompleted: true,
          completedAt,
        }),
      ])
    })

    it('leaves the lines of other bookings as they are', async () => {
      const id = await bookingIn('confirmed')
      const other = await bookingIn('confirmed', {
        startTime: at('03:00'),
        endTime: at('04:00'),
      })

      await act(id, 'complete')

      expect(await storedLines(other)).toEqual([
        expect.objectContaining({ isCompleted: false, completedAt: null }),
      ])
    })

    it('notes the actual times the request states, to the millisecond and in one spelling', async () => {
      const id = await bookingIn('confirmed')

      const response = await act(id, 'complete', asAdmin, {
        actualStartTime: '2026-10-20T01:02:03Z',
        actualEndTime: '2026-10-20T02:04:05.6789Z',
      })

      expect(response.body.data).toMatchObject({
        status: 'completed',
        actualStartTime: '2026-10-20T01:02:03.000Z',
        actualEndTime: '2026-10-20T02:04:05.678Z',
      })
    })

    it('notes no actual time that the request leaves null and the booking does not have', async () => {
      const id = await bookingIn('confirmed')

      const response = await act(id, 'complete')

      expect(response.body.data).toMatchObject({
        status: 'completed',
        actualStartTime: null,
        actualEndTime: null,
      })
    })

    it('keeps the start that was noted when the visit began, when the request leaves it null', async () => {
      const id = await bookingIn('in_progress')

      const response = await act(id, 'complete', asAdmin, {
        actualStartTime: null,
        actualEndTime: at('02:10'),
      })

      expect(response.body.data).toMatchObject({
        status: 'completed',
        actualStartTime: written('01:05'),
        actualEndTime: written('02:10'),
      })
    })

    it('replaces the start that was noted when the visit began with the one the request states', async () => {
      const id = await bookingIn('in_progress')

      const response = await act(id, 'complete', asAdmin, {
        actualStartTime: at('00:55'),
        actualEndTime: null,
      })

      expect(response.body.data).toMatchObject({
        actualStartTime: written('00:55'),
        actualEndTime: null,
      })
    })

    it.each<[string, object | null, string[]]>([
      ['no body', null, [':invalid_type']],
      [
        'a body without the times',
        {},
        ['actualStartTime:invalid_type', 'actualEndTime:invalid_type'],
      ],
      [
        'a body without the end',
        { actualStartTime: null },
        ['actualEndTime:invalid_type'],
      ],
      [
        'an end that is the start',
        { actualStartTime: at('01:00'), actualEndTime: at('01:00') },
        ['actualEndTime:custom'],
      ],
      [
        'an end that is the start in another spelling',
        {
          actualStartTime: '2026-10-20T01:00:00.000Z',
          actualEndTime: '2026-10-20T01:00:00Z',
        },
        ['actualEndTime:custom'],
      ],
      [
        'an end before the start',
        { actualStartTime: at('01:00'), actualEndTime: at('00:59') },
        ['actualEndTime:custom'],
      ],
      [
        'a time that is none',
        { actualStartTime: 'this morning', actualEndTime: null },
        ['actualStartTime:invalid_format'],
      ],
      [
        'a time with an offset instead of UTC',
        { actualStartTime: null, actualEndTime: '2026-10-20T11:00:00+09:00' },
        ['actualEndTime:invalid_format'],
      ],
      [
        'a time without a zone',
        { actualStartTime: '2026-10-20T10:00:00', actualEndTime: null },
        ['actualStartTime:invalid_format'],
      ],
      [
        'a time as a number',
        { actualStartTime: 1792458000000, actualEndTime: null },
        ['actualStartTime:invalid_type'],
      ],
      [
        'the time of completion, which the system notes',
        {
          actualStartTime: null,
          actualEndTime: null,
          completedAt: at('02:00'),
        },
        ['completedAt:unrecognized_keys'],
      ],
    ])(
      'answers %s with 400, and completes nothing',
      async (_case, body, rules) => {
        const id = await bookingIn('confirmed')

        const response = await act(id, 'complete', asAdmin, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid booking completion')
        expect(brokenRules(response)).toEqual(rules)
        expect((await stored(id)).status).toBe('confirmed')
        expect(await historyOf(id)).toEqual([])
      },
    )

    it.each<[string, Partial<NewBooking>, object]>([
      [
        'an end that is the start the booking has',
        { ...inStatus('in_progress') },
        { actualStartTime: null, actualEndTime: at('01:05') },
      ],
      [
        'an end before the start the booking has',
        { ...inStatus('in_progress') },
        { actualStartTime: null, actualEndTime: at('01:04') },
      ],
      [
        'a start that is not before the end the booking has',
        { ...inStatus('confirmed'), actualEndTime: at('02:00') },
        { actualStartTime: at('02:00'), actualEndTime: null },
      ],
    ])(
      'refuses %s with 409, and completes nothing',
      async (_case, columns, body) => {
        const id = await insertBooking(columns)
        const before = await stored(id)

        const response = await act(id, 'complete', asAdmin, body)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          'The actual end has to be after the actual start, and one of the two is a time the booking already has; send both times',
        )
        expect(await stored(id)).toEqual(before)
        expect(await historyOf(id)).toEqual([])
        expect(await countsOf()).toEqual(noCounts)
      },
    )

    it('completes a booking whose noted start the request moves before the end it states', async () => {
      const id = await bookingIn('in_progress')

      const response = await act(id, 'complete', asAdmin, {
        actualStartTime: at('00:50'),
        actualEndTime: at('01:00'),
      })

      expect(response.body.data).toMatchObject({
        status: 'completed',
        actualStartTime: written('00:50'),
        actualEndTime: written('01:00'),
      })
    })

    it('still occupies the staff member: what took place is not booked again', async () => {
      const id = await bookingIn('confirmed')
      await act(id, 'complete')

      const response = await authorized(
        request(app).post(BOOKINGS),
        asAdmin,
      ).send({
        salonId,
        customerId,
        staffId,
        depositAmount: null,
        customerRequest: null,
        internalNotes: null,
        source: null,
        services: [
          { serviceId: cutId, staffId, startTime: at('01:30'), notes: null },
        ],
      })

      expectProblem(response, notAllowed)
    })
  })

  describe('POST /api/v1/bookings/:id/no-show', () => {
    it.each<[Status]>([['pending'], ['confirmed']])(
      'refuses a %s booking that has not begun yet with 409: nobody failed to come to it',
      async (status) => {
        const id = await bookingIn(status, beginning(60))
        const before = await stored(id)

        const response = await act(id, 'no-show')

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          'The booking has not begun yet, so nobody failed to come to it; a booking that will not take place is cancelled',
        )
        expect(await stored(id)).toEqual(before)
        expect(await historyOf(id)).toEqual([])
        expect(await countsOf()).toEqual(noCounts)
      },
    )

    it('notes that the customer did not come once the booking has begun, also while it would still be under way', async () => {
      const id = await bookingIn('confirmed', beginning(-5))

      const response = await act(id, 'no-show')

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        status: 'no_show',
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        cancellationFee: null,
        completedAt: null,
        actualStartTime: null,
        actualEndTime: null,
      })
      expect(await storedLines(id)).toEqual([
        expect.objectContaining({ isCompleted: false, completedAt: null }),
      ])
    })

    it('says that the status does not allow it before it says that the booking has not begun', async () => {
      const id = await bookingIn('cancelled', beginning(60))

      const response = await act(id, 'no-show')

      expectProblem(response, notAllowed)
      expect(response.body.detail).toMatch(/^A booking that is cancelled /)
    })

    it('frees the staff member: another booking takes the time', async () => {
      const id = await bookingIn('confirmed')
      await act(id, 'no-show')

      const response = await authorized(
        request(app).post(BOOKINGS),
        asAdmin,
      ).send({
        salonId,
        customerId,
        staffId,
        depositAmount: null,
        customerRequest: null,
        internalNotes: null,
        source: null,
        services: [
          { serviceId: cutId, staffId, startTime: at('01:00'), notes: null },
        ],
      })

      expect(response.status).toBe(201)
    })
  })

  describe('what a customer has of visits, cancellations and no-shows', () => {
    const onDay = (day: string): Partial<NewBooking> => ({
      bookingDate: `2026-10-${day}`,
      startTime: at('01:00', day),
      endTime: at('02:00', day),
    })

    it('counts the completed bookings as visits, and takes the first and the last day from them', async () => {
      const second = await bookingIn('confirmed', onDay('22'))
      const first = await bookingIn('confirmed', onDay('18'))
      const third = await bookingIn('confirmed', onDay('25'))
      const counts: object[] = []

      for (const id of [second, first, third]) {
        await act(id, 'complete')
        counts.push(await countsOf())
      }

      expect(counts).toEqual([
        {
          ...noCounts,
          visitCount: 1,
          firstVisitDate: '2026-10-22',
          lastVisitDate: '2026-10-22',
        },
        {
          ...noCounts,
          visitCount: 2,
          firstVisitDate: '2026-10-18',
          lastVisitDate: '2026-10-22',
        },
        {
          ...noCounts,
          visitCount: 3,
          firstVisitDate: '2026-10-18',
          lastVisitDate: '2026-10-25',
        },
      ])
    })

    it('counts the cancelled bookings and those the customer did not come to, each by itself', async () => {
      await act(await bookingIn('pending', onDay('18')), 'cancel')
      await act(await bookingIn('confirmed', onDay('19')), 'cancel')
      await act(await bookingIn('confirmed', onDay('21')), 'no-show')
      await bookingIn('pending', onDay('22'))
      await bookingIn('confirmed', onDay('23'))

      expect(await countsOf()).toEqual({
        ...noCounts,
        cancellationCount: 2,
        noShowCount: 1,
      })
    })

    it('says when the customer was last changed', async () => {
      const id = await bookingIn('confirmed')
      const [before] = await db
        .select({ updatedAt: customers.updatedAt })
        .from(customers)
        .where(eq(customers.id, customerId))

      await act(id, 'complete')

      const [after] = await db
        .select({ updatedAt: customers.updatedAt })
        .from(customers)
        .where(eq(customers.id, customerId))
      expect(after?.updatedAt).not.toBe(before?.updatedAt)
    })

    it('counts the bookings again and does not add to what is stored; a status that is not counted leaves the customer alone', async () => {
      const unfounded: Partial<NewCustomer> = {
        visitCount: 7,
        cancellationCount: 3,
        noShowCount: 2,
        firstVisitDate: '2025-01-10',
        lastVisitDate: '2026-09-30',
      }
      await db
        .update(customers)
        .set(unfounded)
        .where(eq(customers.id, customerId))
      const [before] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))

      await act(await bookingIn('pending', onDay('18')), 'confirm')
      await act(await bookingIn('confirmed', onDay('19')), 'start')
      const [untouched] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
      await act(await bookingIn('pending', onDay('21')), 'cancel')

      expect(untouched).toEqual(before)
      expect(await countsOf()).toEqual({ ...noCounts, cancellationCount: 1 })
    })

    it('counts the bookings of that customer, in whichever salon they are', async () => {
      const someoneElse = await insertCustomer(db)
      const elsewhere = await salon()
      await insertBooking({
        ...inStatus('completed'),
        ...onDay('10'),
        salonId: elsewhere,
        staffId: await insertStaff(db, elsewhere),
      })
      await insertBooking({
        ...inStatus('completed'),
        ...onDay('05'),
        customerId: someoneElse,
      })
      await insertBooking({
        ...inStatus('cancelled'),
        ...onDay('06'),
        customerId: someoneElse,
      })

      await act(await bookingIn('confirmed', onDay('22')), 'complete')

      expect(await countsOf()).toEqual({
        ...noCounts,
        visitCount: 2,
        firstVisitDate: '2026-10-10',
        lastVisitDate: '2026-10-22',
      })
      expect(await countsOf(someoneElse)).toEqual(noCounts)
    })

    it('changes the booking of a customer who was deleted, and counts for them', async () => {
      await db
        .update(customers)
        .set({ deletedAt: '2026-10-01T00:00:00.000Z' })
        .where(eq(customers.id, customerId))

      const response = await act(await bookingIn('confirmed'), 'no-show')

      expect(response.status).toBe(200)
      expect(await countsOf()).toEqual({ ...noCounts, noShowCount: 1 })
    })
  })

  describe('who changes the status of a booking', () => {
    it.each(unauthenticated)(
      'answers %s with 401 in every action before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const id = await bookingIn('confirmed')
        const authorization = await tokenOf()

        const responses = [
          ...(await Promise.all(
            ACTION_NAMES.map((action) => act(id, action, authorization)),
          )),
          await act('not-an-id', 'confirm', authorization),
          await act(id, 'cancel', authorization, {}),
          await act(UNKNOWN_ID, 'complete', authorization, {}),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect((await stored(id)).status).toBe('confirmed')
      },
    )

    it.each(keepers)(
      'lets %s take every action on the bookings of the salon, and notes them as the one who did',
      async (_case, signInAs) => {
        const { authorization, userId } = await signInAs()
        const visited = await bookingIn('pending')
        const calledOff = await bookingIn('pending')
        const missed = await bookingIn('confirmed')

        const responses = [
          await act(visited, 'confirm', authorization),
          await act(visited, 'start', authorization),
          await act(visited, 'complete', authorization),
          await act(calledOff, 'cancel', authorization),
          await act(missed, 'no-show', authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '200',
          '200',
          '200',
          '200',
          '200',
        ])
        expect((await stored(calledOff)).cancelledBy).toBe(userId)
        expect(
          (
            await Promise.all([visited, calledOff, missed].map(historyOf))
          ).flatMap((changes) =>
            changes.map(({ toStatus, changedBy }) => [toStatus, changedBy]),
          ),
        ).toEqual([
          ['confirmed', userId],
          ['in_progress', userId],
          ['completed', userId],
          ['cancelled', userId],
          ['no_show', userId],
        ])
      },
    )

    it.each(notKeepers)(
      'forbids %s every action, before looking at the ID or the body',
      async (_case, signInAs) => {
        const id = await bookingIn('confirmed')
        const authorization = await signInAs()

        const responses = [
          ...(await Promise.all(
            ACTION_NAMES.map((action) => act(id, action, authorization)),
          )),
          ...(await Promise.all(
            ACTION_NAMES.map((action) =>
              act(UNKNOWN_ID, action, authorization),
            ),
          )),
          ...(await Promise.all(
            ACTION_NAMES.map((action) =>
              act('not-an-id', action, authorization, { unknown: true }),
            ),
          )),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect((await stored(id)).status).toBe('confirmed')
        expect(await historyOf(id)).toEqual([])
      },
    )

    it('forbids a customer the actions also on a booking of their own', async () => {
      const ownCustomerId = await insertCustomer(db)
      const { authorization } = await signedInUser(app, db, {
        customerId: ownCustomerId,
      })
      const id = await bookingIn('confirmed', { customerId: ownCustomerId })

      const responses = await Promise.all(
        ACTION_NAMES.map((action) => act(id, action, authorization)),
      )

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect((await stored(id)).status).toBe('confirmed')
    })

    it.each(membersOfAnotherSalon)(
      'answers %s like a booking that is not there, whatever status it has',
      async (_case, signInAs) => {
        const { authorization } = await signInAs()
        const confirmed = await bookingIn('confirmed')
        const completed = await bookingIn('completed')

        const responses = [
          ...(await Promise.all(
            ACTION_NAMES.map((action) => act(confirmed, action, authorization)),
          )),
          ...(await Promise.all(
            ACTION_NAMES.map((action) => act(completed, action, authorization)),
          )),
        ]

        for (const response of responses) {
          expectProblem(response, notFound)
        }
        expect(responses[0]?.body.detail).toBe(
          `Booking ${confirmed} was not found`,
        )
        expect((await stored(confirmed)).status).toBe('confirmed')
        expect(await historyOf(confirmed)).toEqual([])
        expect(await countsOf()).toEqual(noCounts)
      },
    )

    it('lets an administrator act on a booking of any salon, and a member on those of their salon alone', async () => {
      const elsewhere = await salon()
      const there = await bookingIn('pending', {
        salonId: elsewhere,
        staffId: await insertStaff(db, elsewhere),
      })
      const here = await bookingIn('pending')
      const ofThere = await member('staff', async () => elsewhere)

      const responses = [
        await act(here, 'confirm', ofThere.authorization),
        await act(there, 'confirm', ofThere.authorization),
        await act(there, 'cancel'),
      ]

      expect(responses.map(statusAndCode)).toEqual(['404 3001', '200', '200'])
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const id = await bookingIn('confirmed')
      const notJson = (action: Action, authorization: string | null): Test =>
        authorized(
          request(app).post(`${BOOKINGS}/${id}/${action}`),
          authorization,
        )
          .set('Content-Type', 'application/json')
          .send('{"cancellationReason": ')

      const responses = [
        await notJson('cancel', null),
        await notJson('complete', null),
        await notJson('cancel', asAdmin),
        await notJson('confirm', asAdmin),
        await authorized(request(app).post(`${BOOKINGS}/${id}/cancel`), null)
          .set('Content-Type', 'text/plain')
          .send('the customer is ill'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect((await stored(id)).status).toBe('confirmed')
    })

    it('checks an action in order: the token, the account, the ID, the body, the booking, its status', async () => {
      const completed = await bookingIn('completed')
      const { authorization: asCustomer } = await signedInUser(app, db)
      const { authorization: elsewhere } = await member('owner', salon)
      const invalid = { cancellationReason: '' }

      const responses = [
        await act('not-an-id', 'cancel', null, invalid),
        await act('not-an-id', 'cancel', asCustomer, invalid),
        await act('not-an-id', 'cancel', asAdmin, invalid),
        await act(UNKNOWN_ID, 'cancel', asAdmin, invalid),
        await act(completed, 'cancel', elsewhere, invalid),
        await act(UNKNOWN_ID, 'cancel'),
        await act(completed, 'cancel', elsewhere),
        await act(completed, 'cancel'),
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
      ).toEqual([
        'Invalid booking ID',
        'Invalid booking cancellation',
        'Invalid booking cancellation',
      ])
    })
  })

  describe('requests at the same moment', () => {
    // An action holds the booking from the moment it reads its status, so
    // of two on one booking the second meets what the first made of it.
    it('takes one of six confirmations of a booking', async () => {
      const id = await bookingIn('pending')

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => act(id, 'confirm')),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(await historyOf(id)).toHaveLength(1)
    })

    it('takes a confirmation and a cancellation of a booking one after the other, in either order', async () => {
      const ids = await Promise.all(
        Array.from({ length: 6 }, () => bookingIn('pending')),
      )

      const rounds = await Promise.all(
        ids.map((id) =>
          Promise.all([act(id, 'confirm'), act(id, 'cancel')]).then(
            async ([confirmed, cancelled]) => ({
              answers: [confirmed, cancelled].map(statusAndCode),
              status: (await stored(id)).status,
              history: (await historyOf(id)).map(
                ({ fromStatus, toStatus }) => `${fromStatus} to ${toStatus}`,
              ),
            }),
          ),
        ),
      )

      const confirmedFirst = {
        answers: ['200', '200'],
        status: 'cancelled',
        history: ['pending to confirmed', 'confirmed to cancelled'],
      }
      const cancelledFirst = {
        answers: ['409 3003', '200'],
        status: 'cancelled',
        history: ['pending to cancelled'],
      }
      for (const round of rounds) {
        expect([confirmedFirst, cancelledFirst]).toContainEqual(round)
      }
    })

    it('waits for a change of the booking that is being written, then meets what it made of it', async () => {
      const id = await bookingIn('pending')

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set(inStatus('cancelled'))
          .where(eq(bookings.id, id))
        const underWay = act(id, 'confirm').then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(response.body.detail).toMatch(/^A booking that is cancelled /)
      expect((await stored(id)).status).toBe('cancelled')
    })

    it('waits for a change of the booking that is being written, then goes ahead when the other is given up', async () => {
      const id = await bookingIn('pending')
      const held: { pending: Promise<Response> | null } = { pending: null }

      await expect(
        db.transaction(async (tx) => {
          await tx
            .update(bookings)
            .set(inStatus('cancelled'))
            .where(eq(bookings.id, id))
          held.pending = act(id, 'confirm').then((response) => response)
          await pause(300)
          throw new Error('given up')
        }),
      ).rejects.toThrow('given up')
      const response = await held.pending

      expect(response?.status).toBe(200)
      expect((await stored(id)).status).toBe('confirmed')
    })

    // `now()` is the moment a transaction began, which is before what it
    // waited for: by it, a change that came second would be noted as the
    // earlier one.
    it.each<[Action, Status]>([
      ['confirm', 'pending'],
      ['cancel', 'confirmed'],
      ['start', 'confirmed'],
      ['complete', 'confirmed'],
      ['no-show', 'confirmed'],
    ])(
      '%s writes the times of the moment it got hold of the booking, not of the moment it began to wait',
      async (action, from) => {
        const id = await bookingIn(from)

        const { pending, until } = await db.transaction(async (tx) => {
          await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, id))
            .for('update')
          const underWay = act(id, action).then((response) => response)
          await pause(300)

          return { pending: underWay, until: await databaseClock() }
        })
        const response = await pending
        const after = await databaseClock()

        expect(response.status).toBe(200)
        const booking = response.body.data
        const lines: { completedAt: string | null }[] = booking.services
        const times: unknown[] = [
          booking.updatedAt,
          ...(action === 'cancel' ? [booking.cancelledAt] : []),
          ...(action === 'start' ? [booking.actualStartTime] : []),
          ...(action === 'complete'
            ? [booking.completedAt, ...lines.map((line) => line.completedAt)]
            : []),
        ]
        for (const time of times) {
          expectBetween(time, until, after)
        }
        const noted = await db
          .select({
            at: sql<number>`(extract(epoch from ${bookingStatusHistories.createdAt}) * 1000)`.mapWith(
              Number,
            ),
          })
          .from(bookingStatusHistories)
          .where(eq(bookingStatusHistories.bookingId, id))
        expect(noted).toEqual([{ at: expect.any(Number) }])
        expect(noted[0]?.at).toBeGreaterThanOrEqual(until)
        expect(noted[0]?.at).toBeLessThanOrEqual(after)
        // The customer is written by the actions that count their bookings.
        const [counted] = await db
          .select({
            at: sql<number>`(extract(epoch from ${customers.updatedAt}) * 1000)`.mapWith(
              Number,
            ),
          })
          .from(customers)
          .where(eq(customers.id, customerId))
        expect((counted?.at ?? 0) >= until).toBe(
          ['cancel', 'complete', 'no-show'].includes(action),
        )
        // The lines are written by the action that completes them.
        const lineTimes = await db
          .select({
            at: sql<number>`(extract(epoch from ${bookingServices.updatedAt}) * 1000)`.mapWith(
              Number,
            ),
          })
          .from(bookingServices)
          .where(eq(bookingServices.bookingId, id))
        expect(lineTimes.map(({ at }) => at >= until)).toEqual([
          action === 'complete',
        ])
      },
    )

    // Were a reader to wait, the transaction below would wait for the
    // reader and neither would end.
    it('reads a booking that is being changed without waiting, as it was before the change', async () => {
      const id = await bookingIn('pending')

      const { got, listed } = await db.transaction(async (tx) => {
        await tx
          .update(bookings)
          .set(inStatus('cancelled'))
          .where(eq(bookings.id, id))

        return {
          got: await read(id),
          listed: await authorized(request(app).get(BOOKINGS), asAdmin).query({
            customerId,
          }),
        }
      })

      expect(got.status).toBe(200)
      expect(got.body.data).toMatchObject({
        status: 'pending',
        cancelledAt: null,
      })
      expect(listed.status).toBe(200)
      expect(listed.body.data).toEqual([got.body.data])
      expect((await read(id)).body.data.status).toBe('cancelled')
    })

    // The customer is held before their bookings are counted, so a count
    // never misses what another change is about to commit.
    it('counts the bookings of a customer after a change to another of their bookings that is being written', async () => {
      const visited = await bookingIn('confirmed', {
        startTime: at('03:00'),
        endTime: at('04:00'),
      })
      const calledOff = await bookingIn('confirmed')

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, customerId))
          .for('update')
        await tx
          .update(bookings)
          .set(inStatus('completed'))
          .where(eq(bookings.id, visited))
        const underWay = act(calledOff, 'cancel').then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expect(response.status).toBe(200)
      expect(await countsOf()).toEqual({
        ...noCounts,
        visitCount: 1,
        cancellationCount: 1,
        firstVisitDate: '2026-10-20',
        lastVisitDate: '2026-10-20',
      })
    })

    it('counts every one of nine changes to bookings of one customer', async () => {
      const actions: Action[] = [
        'complete',
        'cancel',
        'no-show',
        'complete',
        'cancel',
        'complete',
        'no-show',
        'cancel',
        'complete',
      ]
      const changes: [Action, string][] = await Promise.all(
        actions.map(
          async (action, position): Promise<[Action, string]> => [
            action,
            await bookingIn('confirmed', {
              bookingDate: `2026-10-${10 + position}`,
              startTime: at('01:00', String(10 + position)),
              endTime: at('02:00', String(10 + position)),
            }),
          ],
        ),
      )

      const responses = await Promise.all(
        changes.map(([action, id]) => act(id, action)),
      )

      expect(responses.map(statusAndCode)).toEqual(Array(9).fill('200'))
      expect(await countsOf()).toEqual({
        visitCount: 4,
        cancellationCount: 3,
        noShowCount: 2,
        firstVisitDate: '2026-10-10',
        lastVisitDate: '2026-10-18',
      })
    })

    it('enters bookings for a customer while others of theirs are cancelled, and neither waits for the other for ever', async () => {
      const ids = await Promise.all(
        ['11', '12', '13', '14'].map((day) =>
          bookingIn('confirmed', {
            bookingDate: `2026-10-${day}`,
            startTime: at('01:00', day),
            endTime: at('02:00', day),
          }),
        ),
      )

      const responses = await Promise.all(
        ids.flatMap((id, position) => [
          act(id, 'cancel'),
          authorized(request(app).post(BOOKINGS), asAdmin).send({
            salonId,
            customerId,
            staffId,
            depositAmount: null,
            customerRequest: null,
            internalNotes: null,
            source: null,
            services: [
              {
                serviceId: cutId,
                staffId,
                startTime: at('05:00', String(21 + position)),
                notes: null,
              },
            ],
          }),
        ]),
      )

      expect(responses.map(statusAndCode)).toEqual([
        '200',
        '201',
        '200',
        '201',
        '200',
        '201',
        '200',
        '201',
      ])
      expect((await countsOf()).cancellationCount).toBe(4)
    })

    it('keeps what the ledger changes of a customer while their bookings are counted, and every count', async () => {
      const ids = await Promise.all(
        ['11', '12', '13', '14'].map((day) =>
          bookingIn('confirmed', {
            bookingDate: `2026-10-${day}`,
            startTime: at('01:00', day),
            endTime: at('02:00', day),
          }),
        ),
      )

      const responses = await Promise.all(
        ids.flatMap((id, position) => [
          act(id, 'cancel'),
          authorized(
            request(app).patch(`/api/v1/customers/${customerId}`),
            asAdmin,
          ).send({ notes: `note ${position}` }),
        ]),
      )

      expect(responses.map(statusAndCode)).toEqual(Array(8).fill('200'))
      const [customer] = await db
        .select({ notes: customers.notes })
        .from(customers)
        .where(eq(customers.id, customerId))
      expect(customer?.notes).toMatch(/^note [0-3]$/)
      expect((await countsOf()).cancellationCount).toBe(4)
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
    const everySalon: BookingReach = { type: 'everySalon' }
    const salonOnly = (id: string): BookingReach => ({
      type: 'salon',
      salonId: salonIdSchema.parse(id),
    })
    const by = () => userIdSchema.parse(admin.id)

    describe('changeStatus', () => {
      it('changes a booking within the reach and returns it with its lines in their order', async () => {
        const id = await bookingIn('pending')
        await db.insert(bookingServices).values(lineRow(id, { sortOrder: 2 }))
        await db.insert(bookingServices).values(lineRow(id, { sortOrder: 1 }))

        const ofEverySalon = dataOf(
          await repository().changeStatus(
            bookingIdSchema.parse(id),
            everySalon,
            { type: 'confirm' },
            by(),
          ),
        )
        const ofTheSalon = dataOf(
          await repository().changeStatus(
            bookingIdSchema.parse(id),
            salonOnly(salonId),
            { type: 'cancel', cancellationReason: 'x' },
            by(),
          ),
        )

        expect(ofEverySalon).toMatchObject({
          type: 'changed',
          booking: {
            booking: { id, status: 'confirmed' },
            services: [{ sortOrder: 0 }, { sortOrder: 1 }, { sortOrder: 2 }],
          },
        })
        expect(ofTheSalon).toMatchObject({
          type: 'changed',
          booking: {
            booking: { id, status: 'cancelled', cancellationReason: 'x' },
            services: [{ sortOrder: 0 }, { sortOrder: 1 }, { sortOrder: 2 }],
          },
        })
      })

      it('finds nothing outside the reach, and nothing for an ID no booking has', async () => {
        const id = await bookingIn('pending')

        const outside = dataOf(
          await repository().changeStatus(
            bookingIdSchema.parse(id),
            salonOnly(await salon()),
            { type: 'confirm' },
            by(),
          ),
        )
        const unknown = dataOf(
          await repository().changeStatus(
            bookingIdSchema.parse(UNKNOWN_ID),
            everySalon,
            { type: 'confirm' },
            by(),
          ),
        )

        expect([outside, unknown]).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
        ])
        expect((await stored(id)).status).toBe('pending')
      })

      it('says why the status was not changed', async () => {
        const id = await bookingIn('completed')
        const later = await bookingIn('confirmed', beginning(60))

        expect(
          dataOf(
            await repository().changeStatus(
              bookingIdSchema.parse(id),
              everySalon,
              { type: 'confirm' },
              by(),
            ),
          ),
        ).toEqual({
          type: 'statusDoesNotAllow',
          action: 'confirm',
          status: 'completed',
          allowed: ['draft', 'pending'],
        })
        expect(
          dataOf(
            await repository().changeStatus(
              bookingIdSchema.parse(later),
              everySalon,
              { type: 'noShow' },
              by(),
            ),
          ),
        ).toEqual({ type: 'notBegunYet' })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(
          connection.database,
        ).changeStatus(
          bookingIdSchema.parse(UNKNOWN_ID),
          everySalon,
          { type: 'confirm' },
          by(),
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: 'Failed to change the status of booking',
          },
        })
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (constraint: string) => ({
      cause: expect.objectContaining({
        code: '23514',
        constraint_name: constraint,
      }),
    })

    it.each<[string, Partial<NewBooking>, string]>([
      [
        'a cancelled booking without the time it was cancelled at',
        { status: 'cancelled' },
        'bookings_cancelled_has_time',
      ],
      [
        'the time of a cancellation on a booking that is not cancelled',
        { status: 'confirmed', cancelledAt: at('00:30') },
        'bookings_cancelled_has_time',
      ],
      [
        'who cancelled a booking that is not cancelled',
        { status: 'pending', cancelledBy: UNKNOWN_ID },
        'bookings_cancellation_only_when_cancelled',
      ],
      [
        'the reason of a cancellation on a booking that is not cancelled',
        { ...inStatus('completed'), cancellationReason: 'x' },
        'bookings_cancellation_only_when_cancelled',
      ],
      [
        'a cancellation fee on a booking that is not cancelled',
        { ...inStatus('no_show'), cancellationFee: 0 },
        'bookings_cancellation_only_when_cancelled',
      ],
      [
        'a completed booking without the time it was completed at',
        { status: 'completed' },
        'bookings_completed_has_time',
      ],
      [
        'the time of a completion on a booking that is not completed',
        { ...inStatus('in_progress'), completedAt: at('02:00') },
        'bookings_completed_has_time',
      ],
      [
        'a booking in progress without the time it began at',
        { status: 'in_progress' },
        'bookings_in_progress_has_start',
      ],
      [
        'an actual end that is the actual start',
        { actualStartTime: at('01:00'), actualEndTime: at('01:00') },
        'bookings_actual_end_after_start',
      ],
      [
        'an actual end before the actual start',
        { actualStartTime: at('01:00'), actualEndTime: at('00:59') },
        'bookings_actual_end_after_start',
      ],
    ])('refuses %s', async (_case, columns, constraint) => {
      await expect(
        db.insert(bookings).values(bookingRow(columns)),
      ).rejects.toMatchObject(violationOf(constraint))
      expect(await db.$count(bookings)).toBe(0)
    })

    it.each<[string, Partial<NewBooking>]>([
      [
        'a cancelled booking that nobody is noted to have cancelled, without a reason or a fee',
        inStatus('cancelled'),
      ],
      [
        'a cancelled booking with all that is noted of a cancellation',
        {
          ...inStatus('cancelled'),
          cancelledBy: UNKNOWN_ID,
          cancellationReason: 'x',
          cancellationFee: 0,
        },
      ],
      [
        'a completed booking with its actual times',
        {
          ...inStatus('completed'),
          actualStartTime: at('01:00'),
          actualEndTime: at('01:01'),
        },
      ],
      ['an actual end without an actual start', { actualEndTime: at('02:00') }],
      [
        'an actual start on a booking that is not in progress',
        { actualStartTime: at('01:00') },
      ],
    ])('accepts %s', async (_case, columns) => {
      await db.insert(bookings).values(bookingRow(columns))

      expect(await db.$count(bookings)).toBe(1)
    })

    it.each<[string, Partial<NewCustomer>, string]>([
      [
        'a negative number of visits',
        { visitCount: -1 },
        'customers_counts_not_negative',
      ],
      [
        'a negative number of no-shows',
        { noShowCount: -1 },
        'customers_counts_not_negative',
      ],
      [
        'a negative number of cancellations',
        { cancellationCount: -1 },
        'customers_counts_not_negative',
      ],
      [
        'visits without the days of the first and the last',
        { visitCount: 1 },
        'customers_visit_days_go_with_visits',
      ],
      [
        'the days of visits without a visit',
        { firstVisitDate: '2026-10-01', lastVisitDate: '2026-10-01' },
        'customers_visit_days_go_with_visits',
      ],
      [
        'a first visit without a last',
        { visitCount: 1, firstVisitDate: '2026-10-01' },
        'customers_visit_days_go_with_visits',
      ],
      [
        'a last visit without a first',
        { visitCount: 1, lastVisitDate: '2026-10-01' },
        'customers_visit_days_go_with_visits',
      ],
      [
        'a first visit after the last',
        {
          visitCount: 2,
          firstVisitDate: '2026-10-02',
          lastVisitDate: '2026-10-01',
        },
        'customers_visit_days_go_with_visits',
      ],
    ])('refuses a customer with %s', async (_case, columns, constraint) => {
      await expect(
        db.update(customers).set(columns).where(eq(customers.id, customerId)),
      ).rejects.toMatchObject(violationOf(constraint))
      expect(await countsOf()).toEqual(noCounts)
    })

    it('accepts a customer with one visit on one day, and with visits on two', async () => {
      await db
        .update(customers)
        .set({
          visitCount: 1,
          firstVisitDate: '2026-10-01',
          lastVisitDate: '2026-10-01',
        })
        .where(eq(customers.id, customerId))
      await db
        .update(customers)
        .set({ visitCount: 2, lastVisitDate: '2026-10-02' })
        .where(eq(customers.id, customerId))

      expect((await countsOf()).visitCount).toBe(2)
    })
  })
})
