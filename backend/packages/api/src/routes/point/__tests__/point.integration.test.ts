import {
  bookings,
  customerPoints,
  customers,
  sales,
  type salons,
  type staff,
} from '@beauty-salon-backend/database'
import {
  customerIdSchema,
  type LedgerReach,
  type PointMovement,
} from '@beauty-salon-backend/domain'
import { PointRepository } from '@beauty-salon-backend/infrastructure'
import { asc, eq } from 'drizzle-orm'
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
} from '../../../__tests__/_shared/auth-helpers'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  forbidden,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  invalidToken,
  notAllowed,
  notFound,
  request,
  routeNotFound,
  tokenExpired,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const POINTS = '/api/v1/points'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const MAX_INTEGER = 2_147_483_647

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const INVALID_CUSTOMER_ID = 'Invalid customer ID'
const INVALID_SEARCH = 'Invalid point transaction search'
const INVALID_EXPIRING_SEARCH = 'Invalid expiring points search'
const INVALID_EXPIRY = 'Invalid point expiry'
const SALE_IS_VOID =
  'The sale is void; points are not earned on or used for a void sale'
const BOOKING_IS_CLOSED =
  'The booking is a draft, cancelled or a no-show; points are not earned on or used for it'
const RECORD_TAKEN =
  'The record has a point transaction of this kind already; a record is earned on once and used for once'
const BALANCE_SHORT = 'The balance of the customer would fall below 0'
const BALANCE_OVER = 'The balance of the customer would go above 2147483647'

/** The properties of a PointTransactionResponse. */
const PROPERTIES = [
  'balance',
  'createdAt',
  'customerId',
  'description',
  'expiryDate',
  'id',
  'points',
  'referenceId',
  'referenceType',
  'transactionType',
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

/** A time of 20 November 2026 in UTC, `HH:MM`. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

/** A date in UTC, some days from today. */
const daysFromToday = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

/** How often each value comes, by the value. */
const tally = (values: string[]): Record<string, number> =>
  Object.fromEntries(
    [...Map.groupBy(values, (value) => value)].map(([value, same]) => [
      value,
      same.length,
    ]),
  )

/** The answer of a request, or null when it has not come within two seconds. */
const unlessItWaits = (call: Promise<Response>): Promise<Response | null> =>
  Promise.race([call, pause(2_000).then(() => null)])

/** Whether a request was answered within so many milliseconds. */
const answersWithin = (
  call: Promise<Response>,
  milliseconds: number,
): Promise<boolean> =>
  Promise.race([call.then(() => true), pause(milliseconds).then(() => false)])

describe('Points API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** A salon the members of the tests are not of. */
  let otherSalonId: string
  /** The customer of most tests, with no points. */
  let customerId: string
  let staffId: string

  type NewSalon = typeof salons.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type NewSale = typeof sales.$inferInsert
  type NewBooking = typeof bookings.$inferInsert
  type NewPointTransaction = typeof customerPoints.$inferInsert
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(db, { timezone: 'Asia/Tokyo', ...overrides })

  /** A row of `sales` of the customer at the salon: 6,000 yen and 600 of tax. */
  const insertSale = async (overrides: Partial<NewSale> = {}) => {
    const [row] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-TEST-${nextRow()}`,
        salonId,
        customerId,
        saleDate: '2026-11-20',
        saleTime: at('03:40'),
        subtotal: 6000,
        taxAmount: 600,
        totalAmount: 6600,
        ...overrides,
      })
      .returning({ id: sales.id })
    if (row === undefined) {
      throw new Error('No sale was inserted')
    }
    return row.id
  }

  /** What makes a row of `sales` a void one. */
  const voided: Partial<NewSale> = {
    isVoid: true,
    voidedAt: at('05:00'),
    voidReason: '二重登録',
  }

  /** What a booking of a status has besides it: the times the status needs. */
  const timesOf = (status: NewBooking['status']): Partial<NewBooking> => {
    if (status === 'completed') {
      return { actualStartTime: at('01:00'), completedAt: at('02:00') }
    }
    if (status === 'in_progress') {
      return { actualStartTime: at('01:00') }
    }
    return status === 'cancelled' ? { cancelledAt: at('00:30') } : {}
  }

  /** A booking of the customer at the salon, completed unless said otherwise, written directly; returns its ID. */
  const insertBooking = async ({
    status = 'completed',
    ...overrides
  }: Partial<NewBooking> = {}): Promise<string> => {
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-TEST-${nextRow()}`,
        salonId,
        customerId,
        staffId,
        bookingDate: '2026-11-20',
        startTime: at('01:00'),
        endTime: at('02:00'),
        duration: 60,
        subtotal: 6600,
        totalAmount: 6600,
        status,
        ...timesOf(status),
        ...overrides,
      })
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    return booking.id
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await salon()
    otherSalonId = await salon()
    customerId = await insertCustomer(db)
    staffId = await insertStaff(db, salonId)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A request that keeps every rule: 120 points without a record or an expiry date. */
  const earning = (overrides: Record<string, unknown> = {}) => ({
    customerId,
    points: 120,
    description: null,
    referenceType: null,
    referenceId: null,
    expiryDate: null,
    ...overrides,
  })

  /** A request that keeps every rule: 100 points without a record. */
  const using = (overrides: Record<string, unknown> = {}) => ({
    customerId,
    points: 100,
    description: null,
    referenceType: null,
    referenceId: null,
    ...overrides,
  })

  /** A request that keeps every rule: 50 points more, without a record. */
  const adjusting = (overrides: Record<string, unknown> = {}) => ({
    customerId,
    points: 50,
    description: '手動の調整',
    referenceType: null,
    referenceId: null,
    ...overrides,
  })

  /** A body of a request, whether it keeps the rules or not. */
  type Body = Record<string, unknown>

  const earn = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).post(`${POINTS}/earn`), as).send(body)
  const use = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).post(`${POINTS}/use`), as).send(body)
  const adjust = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).post(`${POINTS}/adjust`), as).send(body)
  const balanceOf = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${POINTS}/customer/${id}/balance`), as)
  const historyOf = (
    id: string,
    query: Record<string, string> = {},
    as: string | null = asAdmin,
  ) =>
    authorized(
      request(app).get(`${POINTS}/customer/${id}/transactions`).query(query),
      as,
    )

  const expiringPointsOf = (
    id: string,
    query: Record<string, string | string[]> = {},
    as: string | null = asAdmin,
  ) =>
    authorized(
      request(app).get(`${POINTS}/customer/${id}/expiring`).query(query),
      as,
    )
  const expirePoints = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).post(`${POINTS}/expire`), as).send(body)
  /** An expiry of every customer, before yesterday in UTC. */
  const everyCustomer: Body = { customerId: null, processBefore: null }

  /**
   * Writes the point transactions of a customer directly, as the ledger
   * writes them: each with the balance after it, at the second of
   * 1 January 2026 it names (its place unless said otherwise), with IDs
   * that fall as the rows are written, and the latest balance to the
   * customer. `[type, points, expiry date, second]` each; returns the IDs.
   */
  const writeLedger = async (
    rows: [
      NewPointTransaction['transactionType'],
      number,
      string | null,
      number?,
    ][],
    of: string = customerId,
  ): Promise<string[]> => {
    let balance = 0
    const ids: string[] = []
    for (const [
      index,
      [transactionType, points, expiryDate, second],
    ] of rows.entries()) {
      balance += points
      const id = `0193a5b8-7c2e-7d4f-8a1b-${String(1_000_000 - Number(nextRow())).padStart(12, '0')}`
      await db.insert(customerPoints).values({
        id,
        customerId: of,
        transactionType,
        points,
        balance,
        expiryDate,
        createdAt: `2026-01-01T00:00:${String(second ?? index).padStart(2, '0')}Z`,
      })
      ids.push(id)
    }
    await db
      .update(customers)
      .set({ loyaltyPoints: balance })
      .where(eq(customers.id, of))
    return ids
  }

  /** Gives the customer a balance by an adjustment of the admin; anything but 200 fails the test. */
  const withBalance = async (points: number, of: string = customerId) => {
    const response = await adjust(
      adjusting({ customerId: of, points, description: '開始残高' }),
    )
    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** The point transactions of a customer as stored, in the order they were written. */
  const storedTransactions = (of: string = customerId) =>
    db
      .select()
      .from(customerPoints)
      .where(eq(customerPoints.customerId, of))
      .orderBy(asc(customerPoints.createdAt), asc(customerPoints.id))

  /** The balance and the time of the change of a customer as stored. */
  const storedCustomer = async (of: string = customerId) => {
    const [row] = await db
      .select({
        loyaltyPoints: customers.loyaltyPoints,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(eq(customers.id, of))
    if (row === undefined) {
      throw new Error('No customer was found')
    }
    return row
  }

  /** The moment of the clock a movement writes by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  /** Checks that a time is of the milliseconds between two moments. */
  const expectBetween = (time: unknown, before: number, after: number) => {
    expect(time).toEqual(expect.stringMatching(ISO_TIMESTAMP))
    const moment = Date.parse(String(time))
    expect(moment).toBeGreaterThanOrEqual(Math.floor(before))
    expect(moment).toBeLessThanOrEqual(Math.ceil(after))
  }

  const deleteCustomer = (id: string) =>
    db
      .update(customers)
      .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
      .where(eq(customers.id, id))

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

  /** Everyone who reads, earns and uses points. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
    [
      'a staff member of another salon',
      member('staff', async () => otherSalonId),
    ],
  ]

  /** Those of them who adjust points. */
  const adjusters: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of another salon', member('manager', async () => otherSalonId)],
  ]

  /** Accounts the points ledger is closed to. */
  const notKeepers: [string, SignInAs][] = [
    [
      'a customer with a profile',
      async () => (await signedInUser(app, db, { customerId })).authorization,
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

  /** Tokens that every operation refuses, before anything else is looked at. */
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

  describe('GET /api/v1/points/customer/:customerId/balance', () => {
    it('answers 0 for a customer without a point transaction', async () => {
      const response = await balanceOf(customerId)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: { customerId, balance: 0 },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: {
          balance: `${POINTS}/customer/${customerId}/balance`,
          transactions: `${POINTS}/customer/${customerId}/transactions`,
        },
      })
    })

    it('answers the balance of the latest movement, of that customer only', async () => {
      const other = await insertCustomer(db)
      await withBalance(1000)
      await withBalance(70, other)
      await use(using({ points: 300 }))

      expect((await balanceOf(customerId)).body.data).toEqual({
        customerId,
        balance: 700,
      })
      expect((await balanceOf(other)).body.data).toEqual({
        customerId: other,
        balance: 70,
      })
    })

    it('answers loyaltyPoints, which a movement writes', async () => {
      await db
        .update(customers)
        .set({ loyaltyPoints: 4321 })
        .where(eq(customers.id, customerId))

      expect((await balanceOf(customerId)).body.data.balance).toBe(4321)
    })

    it('links the customer under the mount path the request used', async () => {
      const response = await authorized(
        request(app).get(`/API/V1/POINTS/customer/${customerId}/balance?x=1`),
        asAdmin,
      )

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        balance: `/API/V1/POINTS/customer/${customerId}/balance`,
        transactions: `/API/V1/POINTS/customer/${customerId}/transactions`,
      })
    })

    it.each(keepers)('answers %s', async (_, signInAs) => {
      const response = await balanceOf(customerId, await signInAs())

      expect(response.status).toBe(200)
    })

    it.each(notKeepers)('refuses %s, whatever the ID', async (_, signInAs) => {
      const as = await signInAs()

      expectProblem(await balanceOf(customerId, as), forbidden)
      expectProblem(await balanceOf('mine', as), forbidden)
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const response = await balanceOf('mine', await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it('refuses an ID that is not a UUID', async () => {
      const response = await balanceOf('mine')

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_CUSTOMER_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('answers 404 for a customer who is not there, or is deleted', async () => {
      expectProblem(await balanceOf(UNKNOWN_ID), notFound)
      await deleteCustomer(customerId)
      expectProblem(await balanceOf(customerId), notFound)
    })

    it('serves no other method on the path', async () => {
      for (const call of [
        request(app).post(`${POINTS}/customer/${customerId}/balance`),
        request(app).put(`${POINTS}/customer/${customerId}/balance`),
        request(app).patch(`${POINTS}/customer/${customerId}/balance`),
        request(app).delete(`${POINTS}/customer/${customerId}/balance`),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('GET /api/v1/points/customer/:customerId/transactions', () => {
    /** Writes a point transaction of the customer at a time, with a fixed ID; returns the ID. */
    const insertTransaction = async (
      createdAt: string,
      id: string,
      of: string = customerId,
    ) => {
      await db.insert(customerPoints).values({
        id,
        customerId: of,
        transactionType: 'adjusted',
        points: 10,
        balance: 10,
        createdAt,
      })
      return id
    }

    const idOf = (last: number) =>
      `0193a5b8-7c2e-7d4f-8a1b-${String(last).padStart(12, '0')}`

    it('lists the transactions of the customer latest first, with every property', async () => {
      const saleId = await insertSale()
      await withBalance(1000)
      await earn(
        earning({
          points: 120,
          description: 'お会計',
          referenceType: 'sale',
          referenceId: saleId,
          expiryDate: '2099-12-31',
        }),
      )
      await use(using({ points: 300 }))

      const response = await historyOf(customerId)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body.data).toEqual([
        {
          id: expect.stringMatching(UUID),
          customerId,
          transactionType: 'used',
          points: -300,
          balance: 820,
          description: null,
          referenceType: null,
          referenceId: null,
          expiryDate: null,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        {
          id: expect.stringMatching(UUID),
          customerId,
          transactionType: 'earned',
          points: 120,
          balance: 1120,
          description: 'お会計',
          referenceType: 'sale',
          referenceId: saleId,
          expiryDate: '2099-12-31',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        expect.objectContaining({
          transactionType: 'adjusted',
          points: 1000,
          balance: 1000,
          description: '開始残高',
        }),
      ])
      expect(Object.keys(response.body.data[0]).toSorted()).toEqual(PROPERTIES)
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('lists no transaction for a customer without one, and none of another customer', async () => {
      await withBalance(500, await insertCustomer(db))

      const response = await historyOf(customerId)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    it('walks the pages with the cursor, ties of time in the order of the IDs', async () => {
      const time = '2026-11-20T03:00:00.000Z'
      const written = [
        await insertTransaction(time, idOf(3)),
        await insertTransaction(time, idOf(5)),
        await insertTransaction('2026-11-20T04:00:00.000Z', idOf(1)),
        await insertTransaction(time, idOf(4)),
        await insertTransaction('2026-11-20T02:00:00.000Z', idOf(9)),
      ]
      await insertTransaction(time, idOf(6), await insertCustomer(db))

      const first = await historyOf(customerId, { limit: '2' })
      const second = await historyOf(customerId, {
        limit: '2',
        cursor: first.body.meta.nextCursor,
      })
      const third = await historyOf(customerId, {
        limit: '2',
        cursor: second.body.meta.nextCursor,
      })

      const ids = (response: Response) =>
        response.body.data.map(({ id }: { id: string }) => id)
      expect(written).toHaveLength(5)
      expect(ids(first)).toEqual([idOf(1), idOf(5)])
      expect(first.body.meta).toEqual({
        total: 5,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: idOf(5),
        prevCursor: null,
      })
      expect(ids(second)).toEqual([idOf(4), idOf(3)])
      expect(second.body.meta).toMatchObject({
        cursor: idOf(5),
        nextCursor: idOf(3),
        hasMore: true,
      })
      expect(ids(third)).toEqual([idOf(9)])
      expect(third.body.meta).toMatchObject({
        total: 5,
        hasMore: false,
        nextCursor: null,
        prevCursor: null,
      })
      expect(third.body.links).toMatchObject({ prev: null, last: null })
    })

    it('lists a page that is exactly full without another one', async () => {
      await insertTransaction('2026-11-20T03:00:00.000Z', idOf(1))
      await insertTransaction('2026-11-20T04:00:00.000Z', idOf(2))

      const response = await historyOf(customerId, { limit: '2' })

      expect(response.body.data).toHaveLength(2)
      expect(response.body.meta).toMatchObject({
        hasMore: false,
        nextCursor: null,
      })
    })

    it('keeps to the times from startDate to endDate, both included', async () => {
      await insertTransaction('2026-11-20T02:59:59.999Z', idOf(1))
      await insertTransaction('2026-11-20T03:00:00.000Z', idOf(2))
      await insertTransaction('2026-11-20T04:00:00.000Z', idOf(3))
      await insertTransaction('2026-11-20T05:00:00.000Z', idOf(4))
      await insertTransaction('2026-11-20T05:00:00.001Z', idOf(5))

      const response = await historyOf(customerId, {
        startDate: '2026-11-20T03:00:00Z',
        endDate: '2026-11-20T05:00:00Z',
      })

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        idOf(4),
        idOf(3),
        idOf(2),
      ])
      expect(response.body.meta.total).toBe(3)
      expect(
        (await historyOf(customerId, { startDate: '2026-11-20T05:00:00.001Z' }))
          .body.data,
      ).toHaveLength(1)
      expect(
        (await historyOf(customerId, { endDate: '2026-11-20T02:59:59.999Z' }))
          .body.data,
      ).toHaveLength(1)
    })

    it('compares the times as the responses show them, to the millisecond', async () => {
      // The column keeps microseconds and a response shows milliseconds:
      // this transaction is shown at 05:00:00.000.
      await insertTransaction('2026-11-20T05:00:00.000400Z', idOf(1))
      const [shown] = (await historyOf(customerId)).body.data
      const ids = async (query: Record<string, string>) =>
        (await historyOf(customerId, query)).body.data.map(
          ({ id }: { id: string }) => id,
        )

      expect(shown.createdAt).toBe('2026-11-20T05:00:00.000Z')
      expect(await ids({ endDate: shown.createdAt })).toEqual([idOf(1)])
      expect(await ids({ startDate: shown.createdAt })).toEqual([idOf(1)])
      expect(
        await ids({ startDate: shown.createdAt, endDate: shown.createdAt }),
      ).toEqual([idOf(1)])
      expect(await ids({ endDate: '2026-11-20T04:59:59.999Z' })).toEqual([])
      expect(await ids({ startDate: '2026-11-20T05:00:00.001Z' })).toEqual([])
      expect(
        (await historyOf(customerId, { endDate: shown.createdAt })).body.meta
          .total,
      ).toBe(1)
    })

    it('links the pages with the query of the request', async () => {
      await insertTransaction('2026-11-20T03:00:00.000Z', idOf(1))
      await insertTransaction('2026-11-20T04:00:00.000Z', idOf(2))

      const response = await historyOf(customerId, { limit: '1' })

      expect(response.body.links).toMatchObject({
        self: `${POINTS}/customer/${customerId}/transactions?limit=1`,
        next: `${POINTS}/customer/${customerId}/transactions?limit=1&cursor=${idOf(2)}`,
      })
    })

    it('links the pages under the mount path the request used', async () => {
      await insertTransaction('2026-11-20T03:00:00.000Z', idOf(1))
      await insertTransaction('2026-11-20T04:00:00.000Z', idOf(2))

      const response = await authorized(
        request(app).get(
          `/API/V1/POINTS/customer/${customerId}/transactions?limit=1`,
        ),
        asAdmin,
      )

      expect(response.status).toBe(200)
      expect(response.body.links).toMatchObject({
        self: `/API/V1/POINTS/customer/${customerId}/transactions?limit=1`,
        next: `/API/V1/POINTS/customer/${customerId}/transactions?limit=1&cursor=${idOf(2)}`,
      })
    })

    it.each(keepers)('answers %s', async (_, signInAs) => {
      expect((await historyOf(customerId, {}, await signInAs())).status).toBe(
        200,
      )
    })

    it.each(notKeepers)(
      'refuses %s, whatever the ID and the query',
      async (_, signInAs) => {
        const as = await signInAs()

        expectProblem(await historyOf(customerId, {}, as), forbidden)
        expectProblem(await historyOf('mine', { limit: 'many' }, as), forbidden)
      },
    )

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const response = await historyOf('mine', {}, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it('refuses an ID that is not a UUID before the query', async () => {
      const response = await historyOf('mine', { limit: 'many' })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_CUSTOMER_ID)
    })

    it('refuses a query that breaks a rule', async () => {
      const broken: [Record<string, string>, string[]][] = [
        [{ limit: 'many' }, ['limit:invalid_format']],
        [{ limit: '0' }, ['limit:too_small']],
        [{ limit: '101' }, ['limit:too_big']],
        [{ cursor: 'next' }, ['cursor:invalid_format']],
        [{ startDate: '2026-11-20' }, ['startDate:invalid_format']],
        [
          {
            startDate: '2026-11-20T03:00:00Z',
            endDate: '2026-11-20T02:59:59Z',
          },
          ['endDate:custom'],
        ],
        [{ customerId: UNKNOWN_ID }, ['customerId:unrecognized_keys']],
      ]
      for (const [query, rules] of broken) {
        const response = await historyOf(customerId, query)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(brokenRules(response)).toEqual(rules)
      }
    })

    it('refuses a cursor that names no transaction of the customer', async () => {
      const other = await insertCustomer(db)
      const ofAnother = await insertTransaction(
        '2026-11-20T03:00:00.000Z',
        idOf(7),
        other,
      )

      for (const cursor of [ofAnother, UNKNOWN_ID]) {
        const response = await historyOf(customerId, { cursor })

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'cursor',
            'not_found',
            'Must name a point transaction of the customer',
          ),
        ])
      }
    })

    it('answers 404 for a customer who is not there, or is deleted, before the cursor', async () => {
      expectProblem(
        await historyOf(UNKNOWN_ID, { cursor: UNKNOWN_ID }),
        notFound,
      )
      await deleteCustomer(customerId)
      expectProblem(await historyOf(customerId), notFound)
    })

    it('serves no other method on the path, and nothing below it', async () => {
      for (const call of [
        request(app).post(`${POINTS}/customer/${customerId}/transactions`),
        request(app).put(`${POINTS}/customer/${customerId}/transactions`),
        request(app).delete(`${POINTS}/customer/${customerId}/transactions`),
        request(app).get(
          `${POINTS}/customer/${customerId}/transactions/${UNKNOWN_ID}`,
        ),
        request(app).get(`${POINTS}/customer/${customerId}`),
        request(app).get(`${POINTS}/customer/${customerId}/expired`),
        request(app).get(POINTS),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('POST /api/v1/points/earn', () => {
    it('earns points, writes the balance to the customer and returns the transaction', async () => {
      const other = await insertCustomer(db)
      const otherBefore = await storedCustomer(other)
      const before = await databaseClock()

      const response = await earn(
        earning({ description: '来店ポイント', expiryDate: '2099-12-31' }),
      )
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          customerId,
          transactionType: 'earned',
          points: 120,
          balance: 120,
          description: '来店ポイント',
          referenceType: null,
          referenceId: null,
          expiryDate: '2099-12-31',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: {
          balance: `${POINTS}/customer/${customerId}/balance`,
          transactions: `${POINTS}/customer/${customerId}/transactions`,
        },
      })
      expectBetween(response.body.data.createdAt, before, after)
      const stored = await storedCustomer()
      expect(stored.loyaltyPoints).toBe(120)
      expectBetween(new Date(stored.updatedAt).toISOString(), before, after)
      expect(await storedTransactions()).toEqual([
        expect.objectContaining({
          id: response.body.data.id,
          transactionType: 'earned',
          points: 120,
          balance: 120,
        }),
      ])
      expect(await storedCustomer(other)).toEqual(otherBefore)
    })

    it('adds to the balance the customer has', async () => {
      await withBalance(2500)

      const response = await earn(earning({ points: 300 }))

      expect(response.body.data.balance).toBe(2800)
      expect((await storedCustomer()).loyaltyPoints).toBe(2800)
    })

    it('links the customer under the mount path the request used', async () => {
      const response = await authorized(
        request(app).post('/API/V1/POINTS/earn?x=1'),
        asAdmin,
      ).send(earning())

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        balance: `/API/V1/POINTS/customer/${customerId}/balance`,
        transactions: `/API/V1/POINTS/customer/${customerId}/transactions`,
      })
    })

    it('earns on a sale and on a booking of the customer', async () => {
      const saleId = await insertSale()
      const bookingId = await insertBooking()

      const onSale = await earn(
        earning({ referenceType: 'sale', referenceId: saleId }),
      )
      const onBooking = await earn(
        earning({ referenceType: 'booking', referenceId: bookingId }),
      )

      expect(onSale.body.data).toMatchObject({
        referenceType: 'sale',
        referenceId: saleId,
        balance: 120,
      })
      expect(onBooking.body.data).toMatchObject({
        referenceType: 'booking',
        referenceId: bookingId,
        balance: 240,
      })
    })

    const openStatuses: NewBooking['status'][] = [
      'pending',
      'confirmed',
      'in_progress',
      'completed',
    ]

    it.each(openStatuses)('earns on a booking that is %s', async (status) => {
      const bookingId = await insertBooking({ status })

      expect(
        (
          await earn(
            earning({ referenceType: 'booking', referenceId: bookingId }),
          )
        ).status,
      ).toBe(200)
    })

    it('takes an expiry date of yesterday in UTC', async () => {
      const response = await earn(earning({ expiryDate: daysFromToday(-1) }))

      expect(response.status).toBe(200)
      expect(response.body.data.expiryDate).toBe(daysFromToday(-1))
    })

    it.each(keepers)('earns as %s', async (_, signInAs) => {
      const response = await earn(earning(), await signInAs())

      expect(response.status).toBe(200)
      expect(response.body.data.balance).toBe(120)
    })

    it('lets a member of a salon earn on the records of their salon only', async () => {
      const ofOurs = await insertSale()
      const ofTheirs = await insertSale({ salonId: otherSalonId })
      const bookingOfTheirs = await insertBooking({
        salonId: otherSalonId,
        staffId: await insertStaff(db, otherSalonId),
      })
      const as = await member('staff')()

      expect(
        (
          await earn(
            earning({ referenceType: 'sale', referenceId: ofOurs }),
            as,
          )
        ).status,
      ).toBe(200)
      const ofTheirSalon: [string, string][] = [
        ['sale', ofTheirs],
        ['booking', bookingOfTheirs],
      ]
      for (const [referenceType, referenceId] of ofTheirSalon) {
        const response = await earn(earning({ referenceType, referenceId }), as)

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'referenceId',
            'not_found',
            `Must name a ${referenceType} of the customer`,
          ),
        ])
      }
      expect(
        (await earn(earning({ referenceType: 'sale', referenceId: ofTheirs })))
          .status,
      ).toBe(200)
    })

    it.each(notKeepers)(
      'refuses %s before the body is looked at',
      async (_, signInAs) => {
        const as = await signInAs()

        expectProblem(await earn(earning(), as), forbidden)
        expectProblem(await earn({ points: 'many' }, as), forbidden)
        expect(await storedTransactions()).toEqual([])
      },
    )

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const response = await earn(earning(), await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it('refuses a request that breaks a rule of its own, and writes nothing', async () => {
      const broken: [Record<string, unknown>, string[]][] = [
        [earning({ customerId: 'mine' }), ['customerId:invalid_format']],
        [earning({ points: 0 }), ['points:too_small']],
        [earning({ points: 1.5 }), ['points:invalid_type']],
        [earning({ description: '  ' }), ['description:invalid_format']],
        [
          earning({ referenceType: 'payment' }),
          ['referenceType:invalid_value'],
        ],
        [earning({ referenceId: UNKNOWN_ID }), ['referenceType:custom']],
        [earning({ expiryDate: '2027-02-30' }), ['expiryDate:invalid_format']],
        [earning({ balance: 120 }), ['balance:unrecognized_keys']],
      ]
      for (const [body, rules] of broken) {
        const response = await earn(body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid point earning')
        expect(brokenRules(response)).toEqual(rules)
      }
      expect(await storedTransactions()).toEqual([])
      expect((await storedCustomer()).loyaltyPoints).toBe(0)
    })

    it('refuses a customer as the record of an earning, a use or an adjustment: only a merge transfers points', async () => {
      const asCustomer = {
        referenceType: 'customer',
        referenceId: await insertCustomer(db),
      }

      const responses = [
        await earn(earning(asCustomer)),
        await use(using(asCustomer)),
        await adjust(adjusting(asCustomer)),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['referenceType:invalid_value'])
      }
      expect(await storedTransactions()).toEqual([])
    })

    it('refuses an expiry date before yesterday in UTC', async () => {
      const response = await earn(earning({ expiryDate: daysFromToday(-2) }))

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        issue(
          'expiryDate',
          'too_small',
          `Must not be earlier than ${daysFromToday(-1)}`,
        ),
      ])
    })

    it('refuses a customer who is not there, or is deleted', async () => {
      for (const body of [earning({ customerId: UNKNOWN_ID }), earning()]) {
        if (body.customerId === customerId) {
          await deleteCustomer(customerId)
        }
        const response = await earn(body)

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('customerId', 'not_found', 'Must name a customer'),
        ])
      }
      expect(await storedTransactions()).toEqual([])
    })

    it('refuses a record that is not one of the customer', async () => {
      const other = await insertCustomer(db)
      const notOfTheCustomer: [string, string][] = [
        ['sale', await insertSale({ customerId: other })],
        ['sale', await insertSale({ customerId: null })],
        ['sale', UNKNOWN_ID],
        ['sale', await insertBooking()],
        ['booking', await insertBooking({ customerId: other })],
        ['booking', await insertSale()],
      ]
      for (const [referenceType, referenceId] of notOfTheCustomer) {
        const response = await earn(earning({ referenceType, referenceId }))

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'referenceId',
            'not_found',
            `Must name a ${referenceType} of the customer`,
          ),
        ])
      }
      expect(await storedTransactions()).toEqual([])
    })

    it('refuses a void sale and a booking that is a draft, cancelled or a no-show', async () => {
      const saleId = await insertSale(voided)
      const response = await earn(
        earning({ referenceType: 'sale', referenceId: saleId }),
      )

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(SALE_IS_VOID)
      const closedStatuses: NewBooking['status'][] = [
        'draft',
        'cancelled',
        'no_show',
      ]
      for (const status of closedStatuses) {
        const bookingId = await insertBooking({ status })
        const refused = await earn(
          earning({ referenceType: 'booking', referenceId: bookingId }),
        )

        expectProblem(refused, notAllowed)
        expect(refused.body.detail).toBe(BOOKING_IS_CLOSED)
      }
      expect(await storedTransactions()).toEqual([])
    })

    it('earns on a record once, and uses for it apart from that', async () => {
      const saleId = await insertSale()
      const onSale = earning({ referenceType: 'sale', referenceId: saleId })
      await earn(onSale)

      const again = await earn({ ...onSale, points: 5 })
      const used = await use(
        using({ referenceType: 'sale', referenceId: saleId }),
      )

      expectProblem(again, notAllowed)
      expect(again.body.detail).toBe(RECORD_TAKEN)
      expect(used.status).toBe(200)
      expect((await storedTransactions()).map(({ points }) => points)).toEqual([
        120, -100,
      ])
    })

    it('refuses a balance above the largest integer', async () => {
      await withBalance(MAX_INTEGER - 100)

      expect((await earn(earning({ points: 100 }))).body.data?.balance).toBe(
        MAX_INTEGER,
      )
      const response = await earn(earning({ points: 1 }))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(BALANCE_OVER)
      expect((await storedCustomer()).loyaltyPoints).toBe(MAX_INTEGER)
    })

    it('serves no other method on the path', async () => {
      for (const call of [
        request(app).get(`${POINTS}/earn`),
        request(app).put(`${POINTS}/earn`),
        request(app).delete(`${POINTS}/earn`),
        request(app).post(`${POINTS}/expiry`),
        request(app).post(`${POINTS}/transfer`),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('POST /api/v1/points/use', () => {
    it('uses points as negative ones and takes them from the balance', async () => {
      await withBalance(1000)
      const saleId = await insertSale()

      const response = await use(
        using({
          points: 400,
          description: 'お会計で利用',
          referenceType: 'sale',
          referenceId: saleId,
        }),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        id: expect.stringMatching(UUID),
        customerId,
        transactionType: 'used',
        points: -400,
        balance: 600,
        description: 'お会計で利用',
        referenceType: 'sale',
        referenceId: saleId,
        expiryDate: null,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(response.body.links).toEqual({
        balance: `${POINTS}/customer/${customerId}/balance`,
        transactions: `${POINTS}/customer/${customerId}/transactions`,
      })
      expect((await storedCustomer()).loyaltyPoints).toBe(600)
    })

    it('links the customer under the mount path the request used', async () => {
      await withBalance(1000)

      const response = await authorized(
        request(app).post('/API/V1/POINTS/use?x=1'),
        asAdmin,
      ).send(using())

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        balance: `/API/V1/POINTS/customer/${customerId}/balance`,
        transactions: `/API/V1/POINTS/customer/${customerId}/transactions`,
      })
    })

    it('uses the whole balance and no more', async () => {
      await withBalance(300)

      const short = await use(using({ points: 301 }))
      const all = await use(using({ points: 300 }))

      expectProblem(short, notAllowed)
      expect(short.body.detail).toBe(BALANCE_SHORT)
      expect(all.body.data.balance).toBe(0)
      expect((await storedCustomer()).loyaltyPoints).toBe(0)
    })

    it('refuses a customer without points', async () => {
      const response = await use(using({ points: 1 }))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(BALANCE_SHORT)
      expect(await storedTransactions()).toEqual([])
    })

    it.each(keepers)('uses as %s', async (_, signInAs) => {
      await withBalance(100)

      expect((await use(using(), await signInAs())).status).toBe(200)
    })

    it.each(notKeepers)(
      'refuses %s before the body is looked at',
      async (_, signInAs) => {
        expectProblem(
          await use({ points: 'many' }, await signInAs()),
          forbidden,
        )
      },
    )

    it.each(unauthenticated)('refuses %s', async (_, tokenOf, problem) => {
      expectProblem(await use(using(), await tokenOf()), problem)
    })

    it('refuses a request that breaks a rule of its own', async () => {
      const broken: [Record<string, unknown>, string[]][] = [
        [using({ points: -100 }), ['points:too_small']],
        [using({ expiryDate: null }), ['expiryDate:unrecognized_keys']],
        [using({ referenceType: 'sale' }), ['referenceId:custom']],
      ]
      for (const [body, rules] of broken) {
        const response = await use(body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid point use')
        expect(brokenRules(response)).toEqual(rules)
      }
    })

    it('refuses a customer who is not there and a record of another customer', async () => {
      await withBalance(1000)
      const notThere = await use(using({ customerId: UNKNOWN_ID }))
      const ofAnother = await use(
        using({
          referenceType: 'sale',
          referenceId: await insertSale({
            customerId: await insertCustomer(db),
          }),
        }),
      )

      expect(brokenRules(notThere)).toEqual(['customerId:not_found'])
      expect(brokenRules(ofAnother)).toEqual(['referenceId:not_found'])
    })

    it('refuses a void sale, a cancelled booking and a record used for already', async () => {
      await withBalance(1000)
      const saleId = await insertSale()
      await use(using({ referenceType: 'sale', referenceId: saleId }))

      const refused = [
        await use(
          using({
            referenceType: 'sale',
            referenceId: await insertSale(voided),
          }),
        ),
        await use(
          using({
            referenceType: 'booking',
            referenceId: await insertBooking({ status: 'cancelled' }),
          }),
        ),
        await use(using({ referenceType: 'sale', referenceId: saleId })),
      ]

      expect(refused.map(statusAndCode)).toEqual([
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(refused.map(({ body }) => body.detail)).toEqual([
        SALE_IS_VOID,
        BOOKING_IS_CLOSED,
        RECORD_TAKEN,
      ])
      expect((await storedCustomer()).loyaltyPoints).toBe(900)
    })

    it('serves no other method on the path', async () => {
      for (const call of [
        request(app).get(`${POINTS}/use`),
        request(app).patch(`${POINTS}/use`),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('POST /api/v1/points/adjust', () => {
    it('moves points either way', async () => {
      const up = await adjust(adjusting({ points: 500 }))
      const down = await adjust(adjusting({ points: -200, description: null }))

      expect(up.status).toBe(200)
      expect(up.body.data).toMatchObject({
        transactionType: 'adjusted',
        points: 500,
        balance: 500,
        description: '手動の調整',
        expiryDate: null,
      })
      expect(down.body.data).toMatchObject({
        transactionType: 'adjusted',
        points: -200,
        balance: 300,
        description: null,
      })
      expect((await storedCustomer()).loyaltyPoints).toBe(300)
    })

    it('links the customer under the mount path the request used', async () => {
      const response = await authorized(
        request(app).post('/API/V1/POINTS/adjust?x=1'),
        asAdmin,
      ).send(adjusting())

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        balance: `/API/V1/POINTS/customer/${customerId}/balance`,
        transactions: `/API/V1/POINTS/customer/${customerId}/transactions`,
      })
    })

    it('refers to a void sale, a cancelled booking and a record adjusted for already', async () => {
      await withBalance(1000)
      const saleId = await insertSale(voided)
      const bookingId = await insertBooking({ status: 'cancelled' })

      const responses = [
        await adjust(
          adjusting({
            points: -120,
            referenceType: 'sale',
            referenceId: saleId,
          }),
        ),
        await adjust(
          adjusting({
            points: -10,
            referenceType: 'sale',
            referenceId: saleId,
          }),
        ),
        await adjust(
          adjusting({
            points: 30,
            referenceType: 'booking',
            referenceId: bookingId,
          }),
        ),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200'])
      expect((await storedCustomer()).loyaltyPoints).toBe(900)
    })

    it.each(adjusters)('adjusts as %s', async (_, signInAs) => {
      expect((await adjust(adjusting(), await signInAs())).status).toBe(200)
    })

    const notAdjusters: [string, SignInAs][] = [
      ...notKeepers,
      ['a staff member of the salon', member('staff')],
    ]

    it.each(notAdjusters)(
      'refuses %s before the body is looked at',
      async (_, signInAs) => {
        const as = await signInAs()

        expectProblem(await adjust(adjusting(), as), forbidden)
        expectProblem(await adjust({ points: 0 }, as), forbidden)
        expect(await storedTransactions()).toEqual([])
      },
    )

    it.each(unauthenticated)('refuses %s', async (_, tokenOf, problem) => {
      expectProblem(await adjust(adjusting(), await tokenOf()), problem)
    })

    it('refuses no points, and a request that breaks another rule', async () => {
      const broken: [Record<string, unknown>, string[]][] = [
        [adjusting({ points: 0 }), ['points:custom']],
        [adjusting({ points: MAX_INTEGER + 1 }), ['points:too_big']],
        [
          adjusting({ expiryDate: '2099-12-31' }),
          ['expiryDate:unrecognized_keys'],
        ],
        [adjusting({ customerId: null }), ['customerId:invalid_type']],
      ]
      for (const [body, rules] of broken) {
        const response = await adjust(body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid point adjustment')
        expect(brokenRules(response)).toEqual(rules)
      }
    })

    it('refuses a balance below 0 or above the largest integer', async () => {
      await withBalance(100)

      const below = await adjust(adjusting({ points: -101 }))
      const above = await adjust(adjusting({ points: MAX_INTEGER - 99 }))

      expectProblem(below, notAllowed)
      expect(below.body.detail).toBe(BALANCE_SHORT)
      expectProblem(above, notAllowed)
      expect(above.body.detail).toBe(BALANCE_OVER)
      expect((await storedCustomer()).loyaltyPoints).toBe(100)
    })

    it('refuses a customer who is not there and a record of another salon to its manager', async () => {
      const notThere = await adjust(adjusting({ customerId: UNKNOWN_ID }))
      const ofAnother = await adjust(
        adjusting({
          referenceType: 'sale',
          referenceId: await insertSale({ salonId: otherSalonId }),
        }),
        await member('manager')(),
      )

      expect(brokenRules(notThere)).toEqual(['customerId:not_found'])
      expect(brokenRules(ofAnother)).toEqual(['referenceId:not_found'])
    })
  })

  describe('GET /api/v1/points/customer/:customerId/expiring', () => {
    it('answers what is left of the earnings near their expiry date, the earliest first', async () => {
      const [inTenDays, lapsed] = await writeLedger([
        ['earned', 100, daysFromToday(10)],
        ['earned', 200, daysFromToday(-5)],
        ['earned', 300, daysFromToday(40)],
        ['adjusted', 400, null],
        ['used', -50, null],
      ])

      const response = await expiringPointsOf(customerId)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          customerId,
          expiringPoints: 250,
          expirationDate: daysFromToday(-5),
          transactions: [
            {
              id: lapsed,
              customerId,
              transactionType: 'earned',
              points: 200,
              balance: 300,
              description: null,
              referenceType: null,
              referenceId: null,
              expiryDate: daysFromToday(-5),
              createdAt: '2026-01-01T00:00:01.000Z',
            },
            expect.objectContaining({ id: inTenDays, points: 100 }),
          ],
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: {
          self: `${POINTS}/customer/${customerId}/expiring`,
          balance: `${POINTS}/customer/${customerId}/balance`,
          transactions: `${POINTS}/customer/${customerId}/transactions`,
        },
      })
      expect(Object.keys(response.body.data.transactions[1]).sort()).toEqual(
        PROPERTIES,
      )
    })

    it('counts 30 days from today in UTC without days, and the days of the query, the last day included', async () => {
      await writeLedger([
        ['earned', 100, daysFromToday(10)],
        ['earned', 50, daysFromToday(30)],
        ['earned', 20, daysFromToday(31)],
      ])

      const pointsWithin = async (query: Record<string, string>) =>
        (await expiringPointsOf(customerId, query)).body.data.expiringPoints

      expect(await pointsWithin({})).toBe(150)
      expect(await pointsWithin({ days: '9' })).toBe(0)
      expect(await pointsWithin({ days: '10' })).toBe(100)
      expect(await pointsWithin({ days: '365' })).toBe(170)
    })

    it('reads the transactions in the order they were written, by the ID within one moment', async () => {
      // The use is written before the earning, with the larger ID, at the
      // same moment: it comes after the earning, and takes it.
      await writeLedger([
        ['adjusted', 100, null, 0],
        ['used', -100, null, 1],
        ['earned', 100, daysFromToday(5), 1],
      ])

      expect((await expiringPointsOf(customerId)).body.data).toEqual({
        customerId,
        expiringPoints: 0,
        expirationDate: null,
        transactions: [],
      })
    })

    it('answers nothing near for a customer without points', async () => {
      const response = await expiringPointsOf(customerId)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        customerId,
        expiringPoints: 0,
        expirationDate: null,
        transactions: [],
      })
    })

    it('links the customer under the mount path the request used', async () => {
      const response = await authorized(
        request(app).get(
          `/API/V1/POINTS/customer/${customerId}/expiring?days=7`,
        ),
        asAdmin,
      )

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: `/API/V1/POINTS/customer/${customerId}/expiring?days=7`,
        balance: `/API/V1/POINTS/customer/${customerId}/balance`,
        transactions: `/API/V1/POINTS/customer/${customerId}/transactions`,
      })
    })

    it.each(keepers)('answers %s', async (_, signInAs) => {
      expect(
        (await expiringPointsOf(customerId, {}, await signInAs())).status,
      ).toBe(200)
    })

    it.each(notKeepers)(
      'refuses %s, whatever the ID and the query',
      async (_, signInAs) => {
        const as = await signInAs()

        expectProblem(await expiringPointsOf(customerId, {}, as), forbidden)
        expectProblem(
          await expiringPointsOf('mine', { days: 'many' }, as),
          forbidden,
        )
      },
    )

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const response = await expiringPointsOf('mine', {}, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it('refuses an ID that is not a UUID before the query', async () => {
      const response = await expiringPointsOf('mine', { days: 'many' })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_CUSTOMER_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('refuses a query that breaks a rule, before the customer is looked for', async () => {
      const broken: [Record<string, string | string[]>, string[]][] = [
        [{ days: 'many' }, ['days:invalid_format']],
        [{ days: '' }, ['days:invalid_format']],
        [{ days: ['1', '2'] }, ['days:invalid_type']],
        [{ days: '0' }, ['days:too_small']],
        [{ days: '366' }, ['days:too_big']],
        [{ days: '1.5' }, ['days:invalid_type']],
        [{ limit: '10' }, ['limit:unrecognized_keys']],
      ]

      for (const [query, rules] of broken) {
        const response = await expiringPointsOf(UNKNOWN_ID, query)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_EXPIRING_SEARCH)
        expect(brokenRules(response)).toEqual(rules)
      }
    })

    it('answers 404 for a customer who is not there, or is deleted', async () => {
      expectProblem(await expiringPointsOf(UNKNOWN_ID), notFound)
      await writeLedger([['earned', 100, daysFromToday(5)]])
      await deleteCustomer(customerId)
      expectProblem(await expiringPointsOf(customerId), notFound)
    })

    it('serves no other method on the path', async () => {
      for (const call of [
        request(app).post(`${POINTS}/customer/${customerId}/expiring`),
        request(app).put(`${POINTS}/customer/${customerId}/expiring`),
        request(app).delete(`${POINTS}/customer/${customerId}/expiring`),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('POST /api/v1/points/expire', () => {
    /** Those who do not expire points: everybody but the administrators. */
    const notExpirers: [string, SignInAs][] = [
      ...notKeepers,
      ['the owner of the salon', member('owner')],
      ['a manager of the salon', member('manager')],
      ['a staff member of the salon', member('staff')],
    ]

    /** The types of the point transactions of a customer, in the order written. */
    const typesOf = async (of: string = customerId) =>
      (await storedTransactions(of)).map(
        ({ transactionType }) => transactionType,
      )

    it('expires what is left of the lapsed earnings of every customer, one transaction each', async () => {
      const other = await insertCustomer(db)
      const notYet = await insertCustomer(db)
      const deleted = await insertCustomer(db)
      const usedUp = await insertCustomer(db)
      await writeLedger([
        ['earned', 100, daysFromToday(-10)],
        ['earned', 50, daysFromToday(-3)],
        ['adjusted', 200, null],
        ['used', -30, null],
        ['earned', 80, daysFromToday(5)],
      ])
      await writeLedger([['earned', 40, daysFromToday(-2)]], other)
      await writeLedger([['earned', 60, daysFromToday(-1)]], notYet)
      await writeLedger([['earned', 70, daysFromToday(-9)]], deleted)
      await deleteCustomer(deleted)
      await writeLedger(
        [
          ['earned', 90, daysFromToday(-9)],
          ['used', -90, null],
        ],
        usedUp,
      )
      const before = await databaseClock()

      const response = await expirePoints(everyCustomer)
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: { processedCount: 2, totalPoints: 160 },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: null,
      })
      const expired = (await storedTransactions()).at(-1)
      expect(expired).toMatchObject({
        customerId,
        transactionType: 'expired',
        points: -120,
        balance: 280,
        description: null,
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      })
      expectBetween(
        new Date(String(expired?.createdAt)).toISOString(),
        before,
        after,
      )
      const stored = await storedCustomer()
      expect(stored.loyaltyPoints).toBe(280)
      expectBetween(new Date(stored.updatedAt).toISOString(), before, after)
      expect((await storedTransactions(other)).at(-1)).toMatchObject({
        transactionType: 'expired',
        points: -40,
        balance: 0,
      })
      expect((await storedCustomer(other)).loyaltyPoints).toBe(0)
      const untouchedOnes: [string, number][] = [
        [notYet, 60],
        [deleted, 70],
        [usedUp, 0],
      ]
      for (const [untouched, balance] of untouchedOnes) {
        expect(await typesOf(untouched)).not.toContain('expired')
        expect((await storedCustomer(untouched)).loyaltyPoints).toBe(balance)
      }
    })

    it('writes nothing on a second run, and the expired points are no longer near their expiry', async () => {
      await writeLedger([
        ['earned', 100, daysFromToday(-10)],
        ['adjusted', 50, null],
      ])

      const first = await expirePoints(everyCustomer)
      const second = await expirePoints(everyCustomer)

      expect(first.body.data).toEqual({ processedCount: 1, totalPoints: 100 })
      expect(second.body.data).toEqual({ processedCount: 0, totalPoints: 0 })
      expect(await typesOf()).toEqual(['earned', 'adjusted', 'expired'])
      expect((await balanceOf(customerId)).body.data.balance).toBe(50)
      expect((await expiringPointsOf(customerId)).body.data).toMatchObject({
        expiringPoints: 0,
        transactions: [],
      })
    })

    it('expires the customer of the request alone', async () => {
      const other = await insertCustomer(db)
      await writeLedger([['earned', 100, daysFromToday(-10)]])
      await writeLedger([['earned', 40, daysFromToday(-10)]], other)

      const response = await expirePoints({ customerId, processBefore: null })

      expect(response.body.data).toEqual({
        processedCount: 1,
        totalPoints: 100,
      })
      expect((await storedCustomer()).loyaltyPoints).toBe(0)
      expect(await typesOf(other)).toEqual(['earned'])
      expect((await storedCustomer(other)).loyaltyPoints).toBe(40)
    })

    it('answers nothing expired for a customer of the request without lapsed points', async () => {
      await writeLedger([['earned', 100, daysFromToday(3)]])

      const response = await expirePoints({ customerId, processBefore: null })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ processedCount: 0, totalPoints: 0 })
      expect(await typesOf()).toEqual(['earned'])
    })

    it('expires the earnings whose expiry date is before the day of the request', async () => {
      await writeLedger([
        ['earned', 100, daysFromToday(-10)],
        ['earned', 50, daysFromToday(-5)],
        ['earned', 20, daysFromToday(-4)],
      ])

      const response = await expirePoints({
        customerId: null,
        processBefore: daysFromToday(-5),
      })

      expect(response.body.data).toEqual({
        processedCount: 1,
        totalPoints: 100,
      })
      expect((await storedCustomer()).loyaltyPoints).toBe(70)
    })

    it('takes yesterday in UTC, and refuses today before the customer is looked for', async () => {
      await writeLedger([
        ['earned', 100, daysFromToday(-2)],
        ['earned', 50, daysFromToday(-1)],
      ])

      const yesterday = await expirePoints({
        customerId,
        processBefore: daysFromToday(-1),
      })
      const today = await expirePoints({
        customerId: UNKNOWN_ID,
        processBefore: daysFromToday(0),
      })

      expect(yesterday.body.data).toEqual({
        processedCount: 1,
        totalPoints: 100,
      })
      expectProblem(today, badRequest)
      expect(today.body.detail).toBe(INVALID_EXPIRY)
      expect(today.body.errors).toEqual([
        issue(
          'processBefore',
          'too_big',
          `Must not be later than ${daysFromToday(-1)}`,
        ),
      ])
      expect((await storedCustomer()).loyaltyPoints).toBe(50)
    })

    it.each(notExpirers)(
      'refuses %s, whatever the request',
      async (_, signInAs) => {
        await writeLedger([['earned', 100, daysFromToday(-10)]])
        const as = await signInAs()

        expectProblem(await expirePoints(everyCustomer, as), forbidden)
        expectProblem(await expirePoints({}, as), forbidden)
        expect(await typesOf()).toEqual(['earned'])
      },
    )

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const response = await expirePoints({}, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it('refuses a request that breaks a rule', async () => {
      const broken: [Body, string[]][] = [
        [{}, ['customerId:invalid_type', 'processBefore:invalid_type']],
        [
          { customerId: 'everyone', processBefore: null },
          ['customerId:invalid_format'],
        ],
        [
          { customerId: null, processBefore: '2026-02-30' },
          ['processBefore:invalid_format'],
        ],
        [
          { customerId: null, processBefore: '2026-11-01T00:00:00Z' },
          ['processBefore:invalid_format'],
        ],
        [
          { customerId: null, processBefore: null, salonId },
          ['salonId:unrecognized_keys'],
        ],
      ]

      for (const [body, rules] of broken) {
        const response = await expirePoints(body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_EXPIRY)
        expect(brokenRules(response)).toEqual(rules)
      }
    })

    it('refuses a customer who is not there, or is deleted, as a property of the request', async () => {
      await writeLedger([['earned', 100, daysFromToday(-10)]])
      await deleteCustomer(customerId)

      for (const id of [UNKNOWN_ID, customerId]) {
        const response = await expirePoints({
          customerId: id,
          processBefore: null,
        })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_EXPIRY)
        expect(response.body.errors).toEqual([
          issue('customerId', 'not_found', 'Must name a customer'),
        ])
      }
      expect(await typesOf()).toEqual(['earned'])
    })

    it('serves no other method on the path', async () => {
      for (const call of [
        request(app).get(`${POINTS}/expire`),
        request(app).put(`${POINTS}/expire`),
        request(app).delete(`${POINTS}/expire`),
        request(app).post(`${POINTS}/expire/${customerId}`),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('expiries at the same time', () => {
    it('expires each customer once when expiries come at the same time', async () => {
      const other = await insertCustomer(db)
      await writeLedger([['earned', 100, daysFromToday(-10)]])
      await writeLedger([['earned', 40, daysFromToday(-10)]], other)

      const responses = await Promise.all(
        Array.from({ length: 4 }, () => expirePoints(everyCustomer)),
      )

      expect(responses.map(({ status }) => status)).toEqual([
        200, 200, 200, 200,
      ])
      const sum = (key: 'processedCount' | 'totalPoints') =>
        responses.reduce((total, { body }) => total + body.data[key], 0)
      expect(sum('processedCount')).toBe(2)
      expect(sum('totalPoints')).toBe(140)
      expect(await storedTransactions()).toHaveLength(2)
      expect(await storedTransactions(other)).toHaveLength(2)
    })

    it('makes an expiry wait for a change of the customer, and count the transactions it left', async () => {
      await writeLedger([
        ['earned', 100, daysFromToday(-10)],
        ['adjusted', 300, null],
      ])

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          // A use of the lapsed points, written as the ledger writes one.
          await tx
            .update(customers)
            .set({ loyaltyPoints: 300 })
            .where(eq(customers.id, customerId))
          await tx.insert(customerPoints).values({
            customerId,
            transactionType: 'used',
            points: -100,
            balance: 300,
            createdAt: '2026-01-01T00:01:00Z',
          })
          const underWay = expirePoints({
            customerId,
            processBefore: null,
          }).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.body.data).toEqual({ processedCount: 0, totalPoints: 0 })
      expect((await storedCustomer()).loyaltyPoints).toBe(300)
    })

    it('writes an expiry that waited for the customer at the time it is written', async () => {
      await writeLedger([['earned', 100, daysFromToday(-10)]])

      const { pending, answeredWhileHeld, released } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .update(customers)
            .set({ loyaltyPoints: 100 })
            .where(eq(customers.id, customerId))
          const underWay = expirePoints({
            customerId,
            processBefore: null,
          }).then((response) => response)
          const answered = await answersWithin(underWay, 300)

          return {
            pending: underWay,
            answeredWhileHeld: answered,
            released: await databaseClock(),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.body.data).toEqual({
        processedCount: 1,
        totalPoints: 100,
      })
      const expired = (await storedTransactions()).at(-1)
      expect(expired?.transactionType).toBe('expired')
      expect(
        new Date(String(expired?.createdAt)).getTime(),
      ).toBeGreaterThanOrEqual(Math.floor(released))
      expect(
        new Date((await storedCustomer()).updatedAt).getTime(),
      ).toBeGreaterThanOrEqual(Math.floor(released))
    })

    it('lets an expiry past a row that refers to the customer while it is written', async () => {
      await writeLedger([['earned', 100, daysFromToday(-10)]])

      const response = await db.transaction(async (tx: Transaction) => {
        // The lock a foreign key to the customer takes.
        await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, customerId))
          .for('key share')
        return unlessItWaits(expirePoints({ customerId, processBefore: null }))
      })

      expect(response?.body.data).toEqual({
        processedCount: 1,
        totalPoints: 100,
      })
    })

    it('leaves the balance of the latest transaction when a use and an expiry come at once', async () => {
      await writeLedger([
        ['earned', 100, daysFromToday(-10)],
        ['adjusted', 300, null],
      ])

      const [used, expired] = await Promise.all([
        use(using({ points: 350 })),
        expirePoints({ customerId, processBefore: null }),
      ])

      // The use first takes the lapsed points, which leaves nothing to
      // expire; the expiry first leaves too little to use.
      expect([
        [200, 0],
        [409, 1],
      ]).toContainEqual([used.status, expired.body.data.processedCount])
      const stored = await storedTransactions()
      const balance = (await storedCustomer()).loyaltyPoints
      expect(stored.at(-1)?.balance).toBe(balance)
      expect(balance).toBe(used.status === 200 ? 50 : 300)
    })
  })

  describe('movements at the same time', () => {
    it('writes the movements of one customer one after the other, each from the balance the one before left', async () => {
      await withBalance(1000)

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => use(using({ points: 300 }))),
      )

      expect(tally(responses.map(statusAndCode))).toEqual({
        '200': 3,
        '409 3003': 3,
      })
      const stored = await storedTransactions()
      expect(stored.map(({ balance }) => balance)).toEqual([
        1000, 700, 400, 100,
      ])
      expect((await storedCustomer()).loyaltyPoints).toBe(100)
      expect((await balanceOf(customerId)).body.data.balance).toBe(100)
    })

    it('earns on a record once when it is asked for at the same time', async () => {
      const saleId = await insertSale()

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          earn(earning({ referenceType: 'sale', referenceId: saleId })),
        ),
      )

      expect(tally(responses.map(statusAndCode))).toEqual({
        '200': 1,
        '409 3003': 4,
      })
      expect((await storedCustomer()).loyaltyPoints).toBe(120)
    })

    it('makes a movement wait for a change of the customer, and meet the balance it left', async () => {
      const { pending, answeredWhileHeld, released } = await db.transaction(
        async (tx) => {
          await tx
            .update(customers)
            .set({ loyaltyPoints: 500 })
            .where(eq(customers.id, customerId))
          const underWay = use(using({ points: 200 })).then(
            (response) => response,
          )
          const answered = await answersWithin(underWay, 300)

          return {
            pending: underWay,
            answeredWhileHeld: answered,
            released: await databaseClock(),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
      expect(response.body.data.balance).toBe(300)
      expect(Date.parse(response.body.data.createdAt)).toBeGreaterThanOrEqual(
        Math.floor(released),
      )
    })

    it('lets a movement past a row that refers to the customer while it is written', async () => {
      const response = await db.transaction(async (tx: Transaction) => {
        // The lock a foreign key to the customer takes.
        await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, customerId))
          .for('key share')
        return unlessItWaits(earn(earning()))
      })

      expect(response?.status).toBe(200)
    })

    it('makes an earning wait for the void of its sale, and meet the sale as void', async () => {
      const saleId = await insertSale()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx.update(sales).set(voided).where(eq(sales.id, saleId))
          const underWay = earn(
            earning({ referenceType: 'sale', referenceId: saleId }),
          ).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(SALE_IS_VOID)
    })

    it('makes a use wait for a change of the status of its booking, and meet it', async () => {
      await withBalance(1000)
      const bookingId = await insertBooking({ status: 'confirmed' })

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .update(bookings)
            .set({ status: 'cancelled', cancelledAt: at('00:30') })
            .where(eq(bookings.id, bookingId))
          const underWay = use(
            using({ referenceType: 'booking', referenceId: bookingId }),
          ).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(BOOKING_IS_CLOSED)
    })
  })

  describe('PointRepository', () => {
    const everySalon: LedgerReach = { type: 'everySalon' }
    const movement = (): PointMovement => ({
      type: 'earned',
      request: {
        customerId: customerIdSchema.parse(UNKNOWN_ID),
        points: 1,
        description: null,
        referenceType: null,
        referenceId: null,
        expiryDate: null,
      },
    })

    it('writes nothing of a refused movement', async () => {
      const outcome = await new PointRepository(db).record(everySalon, {
        type: 'used',
        request: {
          customerId: customerIdSchema.parse(customerId),
          points: 1,
          description: null,
          referenceType: null,
          referenceId: null,
        },
      })

      expect(outcome).toEqual({
        type: 'success',
        data: { type: 'balanceShort' },
      })
      expect(await storedTransactions()).toEqual([])
    })

    it('resolves every method to a database error when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()
      const repository = new PointRepository(connection.database)
      const id = customerIdSchema.parse(UNKNOWN_ID)

      const results = [
        await repository.balanceOf(id),
        await repository.list({
          customerId: id,
          limit: 20,
          after: null,
          startDate: null,
          endDate: null,
        }),
        await repository.record(everySalon, movement()),
        await repository.transactionsOf(id),
        await repository.expire(null, '2026-11-01'),
      ]
      await connection.close()

      expect(results).toEqual([
        {
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to read the balance of points',
          }),
        },
        {
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to list point transactions',
          }),
        },
        {
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to record points',
          }),
        },
        {
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to read point transactions',
          }),
        },
        {
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to expire points',
          }),
        },
      ])
    })
  })
})
