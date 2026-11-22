import {
  bookingServices,
  bookings,
  customers,
  paymentMethods,
  paymentTransactions,
  sales,
  services,
} from '@beauty-salon-backend/database'
import { customerIdSchema, salonIdSchema } from '@beauty-salon-backend/domain'
import { CustomerStatisticsRepository } from '@beauty-salon-backend/infrastructure'
import { count, eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Test } from 'supertest'
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
  type NewPayment,
  paymentColumns,
} from '../../../__tests__/_shared/payment-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  request,
} from '../../../__tests__/_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }

/** November 2026, the period of most tests. */
const NOVEMBER = { startDate: '2026-11-01', endDate: '2026-11-30' }

/** An ID that sorts by its last number. */
const idOf = (last: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-${String(last).padStart(12, '0')}`

describe('Customer statistics API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let asAdmin: string
  let asOwner: string
  let asManager: string
  let asStaff: string
  let asOwnerOfAnotherSalon: string
  let asCustomer: string
  let salonId: string
  let otherSalonId: string
  /** The customer whose statistics the tests read. */
  let customerId: string
  let otherCustomerId: string
  let aoiId: string
  let renId: string
  let cutId: string
  let colorId: string
  let cashId: string

  type NewBooking = typeof bookings.$inferInsert
  type BookingStatus = NonNullable<NewBooking['status']>
  type NewSale = typeof sales.$inferInsert

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A service of a salon; returns its ID. */
  const insertService = async (
    name: string,
    overrides: Partial<typeof services.$inferInsert> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(services)
      .values({
        salonId,
        name,
        duration: 60,
        price: 6000,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
        ...overrides,
      })
      .returning({ id: services.id })
    if (row === undefined) {
      throw new Error('No service was inserted')
    }
    return row.id
  }

  /** The times a booking of a status has besides it, on its day. */
  const timesOf = (
    status: BookingStatus,
    day: string,
  ): Partial<NewBooking> => ({
    cancelledAt: status === 'cancelled' ? `${day}T00:30:00Z` : null,
    completedAt: status === 'completed' ? `${day}T02:00:00Z` : null,
    actualStartTime:
      status === 'in_progress' || status === 'completed'
        ? `${day}T01:00:00Z`
        : null,
  })

  /**
   * A booking of the customer at the salon from 10:00 to 11:00 in Tokyo on
   * a day, written directly with a line of each service; returns its ID.
   */
  const insertBooking = async ({
    day,
    status,
    staffId = aoiId,
    serviceIds = [cutId],
    startHour = '01',
    ...overrides
  }: {
    day: string
    status: BookingStatus
    staffId?: string
    serviceIds?: string[]
    startHour?: string
  } & Partial<NewBooking>): Promise<string> => {
    const startTime = `${day}T${startHour}:00:00Z`
    const endTime = `${day}T${startHour}:59:00Z`
    const [row] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-TEST-${nextRow()}`,
        salonId,
        customerId,
        staffId,
        bookingDate: day,
        startTime,
        endTime,
        duration: 59,
        subtotal: 6600,
        totalAmount: 6600,
        status,
        ...timesOf(status, day),
        ...overrides,
      })
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    for (const [sortOrder, serviceId] of serviceIds.entries()) {
      await db.insert(bookingServices).values({
        bookingId: row.id,
        serviceId,
        staffId,
        startTime,
        endTime,
        duration: 59,
        price: 6600,
        finalPrice: 6600,
        taxIncluded: true,
        sortOrder,
      })
    }
    return row.id
  }

  /** A sale of the customer at the salon, written directly; returns its ID. */
  const insertSale = async (
    totalAmount: number,
    overrides: Partial<NewSale> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-TEST-${nextRow()}`,
        salonId,
        customerId,
        saleDate: '2026-11-20',
        saleTime: '2026-11-20T03:40:00Z',
        subtotal: totalAmount,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount,
        ...overrides,
      })
      .returning({ id: sales.id })
    if (row === undefined) {
      throw new Error('No sale was inserted')
    }
    return row.id
  }

  /** A payment of a sale, written directly: received in full in cash, unless said otherwise. */
  const insertPayment = async (
    saleId: string,
    overrides: Partial<NewPayment> = {},
  ): Promise<void> => {
    await db.insert(paymentTransactions).values({
      saleId,
      paymentMethodId: cashId,
      transactionNumber: `TX-${nextRow()}`,
      ...paymentColumns(overrides),
    })
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    otherSalonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    customerId = await insertCustomer(db)
    otherCustomerId = await insertCustomer(db)
    const signedInMember = async (
      role: 'owner' | 'manager' | 'staff',
      ofSalon: string = salonId,
    ) =>
      (await signIn(app, (await insertMember(db, role, ofSalon)).email))
        .authorization
    asOwner = await signedInMember('owner')
    asManager = await signedInMember('manager')
    asStaff = await signedInMember('staff')
    asOwnerOfAnotherSalon = await signedInMember('owner', otherSalonId)
    asCustomer = (await signedInUser(app, db)).authorization
    aoiId = await insertStaff(db, salonId, { displayName: 'Aoi' })
    renId = await insertStaff(db, salonId, { displayName: 'Ren' })
    cutId = await insertService('カット')
    colorId = await insertService('カラー')
    const [method] = await db
      .insert(paymentMethods)
      .values({ salonId, method: 'cash', displayName: '現金' })
      .returning({ id: paymentMethods.id })
    if (method === undefined) {
      throw new Error('No payment method was inserted')
    }
    cashId = method.id
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Asks for the statistics of a customer; of the customer of the tests, as the admin, unless said otherwise. */
  const statistics = (
    query: Record<string, string>,
    as: string | null = asAdmin,
    id: string = customerId,
  ) =>
    authorized(
      request(app).get(`/api/v1/customers/${id}/statistics`).query(query),
      as,
    )

  /** November at the salon of the tests. */
  const november = (overrides: Record<string, string> = {}) => ({
    salonId,
    ...NOVEMBER,
    ...overrides,
  })

  /** The rows the statistics could write to, counted. */
  const counts = async () => ({
    bookings: (await db.select({ n: count() }).from(bookings))[0]?.n,
    sales: (await db.select({ n: count() }).from(sales))[0]?.n,
    customers: (await db.select({ n: count() }).from(customers))[0]?.n,
  })

  describe('GET /api/v1/customers/:id/statistics', () => {
    it('counts November at the salon: every booking, the rates, the sales less their refunds, the last visit and the favorites; and writes nothing', async () => {
      await db
        .update(customers)
        .set({
          loyaltyPoints: 120,
          createdAt: '2025-04-01 09:30:00.123456+09',
        })
        .where(eq(customers.id, customerId))
      // The bookings of the customer at the salon in November.
      const first = await insertBooking({
        day: '2026-11-01',
        status: 'completed',
        serviceIds: [cutId, cutId],
      })
      const second = await insertBooking({
        day: '2026-11-10',
        status: 'completed',
        serviceIds: [cutId, colorId],
      })
      await insertBooking({
        day: '2026-11-15',
        status: 'completed',
        serviceIds: [cutId],
      })
      await insertBooking({
        day: '2026-11-20',
        status: 'completed',
        staffId: renId,
        serviceIds: [colorId],
        startHour: '05',
      })
      await insertBooking({
        day: '2026-11-25',
        status: 'cancelled',
        staffId: renId,
      })
      await insertBooking({ day: '2026-11-28', status: 'no_show' })
      await insertBooking({ day: '2026-11-30', status: 'confirmed' })
      // Those it leaves out: the days just before and after November, the
      // booking of another customer, and one at another salon.
      await insertBooking({
        day: '2026-10-31',
        status: 'completed',
        staffId: renId,
        serviceIds: [colorId],
      })
      await insertBooking({
        day: '2026-12-01',
        status: 'completed',
        staffId: renId,
        serviceIds: [colorId],
        startHour: '09',
      })
      await insertBooking({
        day: '2026-11-20',
        status: 'completed',
        customerId: otherCustomerId,
        startHour: '07',
      })
      const theirStaff = await insertStaff(db, otherSalonId)
      const theirService = await insertService('カット', {
        salonId: otherSalonId,
      })
      await insertBooking({
        day: '2026-11-20',
        status: 'completed',
        salonId: otherSalonId,
        staffId: theirStaff,
        serviceIds: [theirService],
        startHour: '08',
      })

      // The sales: of the first booking, paid; of the second, with 3,000
      // yen of 17,600 refunded; and a product without a booking, not paid.
      await insertPayment(
        await insertSale(6_600, { bookingId: first, saleDate: '2026-11-01' }),
        { amount: 6_600 },
      )
      await insertPayment(
        await insertSale(17_600, { bookingId: second, saleDate: '2026-11-10' }),
        { amount: 17_600, status: 'partial_refund', refundAmount: 3_000 },
      )
      await insertSale(2_200)
      // Those it leaves out: a void sale, the days just before and after
      // November, a sale of another customer, and one at another salon.
      await insertSale(9_999, {
        isVoid: true,
        voidedAt: '2026-11-20T05:00:00Z',
        voidReason: '二重登録',
      })
      await insertSale(9_999, { saleDate: '2026-10-31' })
      await insertSale(9_999, { saleDate: '2026-12-01' })
      await insertSale(9_999, { customerId: otherCustomerId })
      await insertSale(9_999, { salonId: otherSalonId })
      const before = await counts()

      const response = await statistics(november(), asStaff)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          customerId,
          salonId,
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          totalBookings: 7,
          totalSpent: 23_400,
          averageBookingValue: 10_600,
          lastVisit: '2026-11-20T05:00:00.000Z',
          favoriteServices: [
            { serviceId: cutId, name: 'カット', bookingCount: 3 },
            { serviceId: colorId, name: 'カラー', bookingCount: 2 },
          ],
          favoriteStaff: [
            { staffId: aoiId, displayName: 'Aoi', bookingCount: 3 },
            { staffId: renId, displayName: 'Ren', bookingCount: 1 },
          ],
          loyaltyPoints: 120,
          customerSince: '2025-04-01T00:30:00.123Z',
          cancellationRate: 14.3,
          noShowRate: 14.3,
        },
        meta: expect.objectContaining({ correlationId: expect.any(String) }),
        links: {
          self: `/api/v1/customers/${customerId}/statistics?${new URLSearchParams(november())}`,
        },
      })
      expect(await counts()).toEqual(before)
    })

    it('gives a customer without bookings or sales in the period zeros, no visit and no favorites', async () => {
      await insertBooking({ day: '2026-10-31', status: 'completed' })
      await insertSale(6_600, { saleDate: '2026-12-01' })

      const response = await statistics(november())

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        totalBookings: 0,
        totalSpent: 0,
        averageBookingValue: 0,
        lastVisit: null,
        favoriteServices: [],
        favoriteStaff: [],
        cancellationRate: 0,
        noShowRate: 0,
      })
    })

    it('counts a sale refunded in full as nothing spent, and a sale without a payment in full', async () => {
      const visit = await insertBooking({
        day: '2026-11-03',
        status: 'completed',
      })
      await insertPayment(await insertSale(6_600, { bookingId: visit }), {
        amount: 6_600,
        status: 'refunded',
        refundAmount: 6_600,
      })
      await insertSale(4_400)

      const response = await statistics(november())

      expect(response.body.data).toMatchObject({
        totalSpent: 4_400,
        averageBookingValue: 0,
      })
    })

    it('counts a service, a staff member and a booking that were deleted, and only completed bookings for the favorites', async () => {
      const perm = await insertService('パーマ', {
        deletedAt: '2026-11-25T00:00:00Z',
      })
      const mei = await insertStaff(db, salonId, {
        displayName: 'Mei',
        isActive: false,
        deletedAt: '2026-11-25T00:00:00Z',
      })
      await insertBooking({
        day: '2026-11-05',
        status: 'completed',
        staffId: mei,
        serviceIds: [perm],
      })
      await insertBooking({ day: '2026-11-06', status: 'in_progress' })
      await insertBooking({ day: '2026-11-07', status: 'pending' })

      const response = await statistics(november())

      expect(response.body.data).toMatchObject({
        totalBookings: 3,
        favoriteServices: [
          { serviceId: perm, name: 'パーマ', bookingCount: 1 },
        ],
        favoriteStaff: [{ staffId: mei, displayName: 'Mei', bookingCount: 1 }],
      })
    })

    it('names five services at most, the most booked first and by ID among those booked as often', async () => {
      const ids = [6, 2, 5, 1, 4, 3].map(idOf)
      for (const [n, id] of ids.entries()) {
        await insertService(`Menu ${n}`, { id })
      }
      await insertBooking({
        day: '2026-11-02',
        status: 'completed',
        serviceIds: ids,
      })
      await insertBooking({
        day: '2026-11-03',
        status: 'completed',
        serviceIds: [idOf(6)],
      })

      const response = await statistics(november())

      expect(
        response.body.data.favoriteServices.map(
          ({ serviceId }: { serviceId: string }) => serviceId,
        ),
      ).toEqual([idOf(6), idOf(1), idOf(2), idOf(3), idOf(4)])
    })

    it('lets the admin and every member of the salon read them, with the IDs in lower case', async () => {
      for (const as of [asAdmin, asOwner, asManager, asStaff]) {
        const response = await statistics(
          november({ salonId: salonId.toUpperCase() }),
          as,
          customerId.toUpperCase(),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({ customerId, salonId })
      }
    })

    it('lets the owner of another salon read the statistics of their salon', async () => {
      const response = await statistics(
        november({ salonId: otherSalonId }),
        asOwnerOfAnotherSalon,
      )

      expect(response.status).toBe(200)
      expect(response.body.data.salonId).toBe(otherSalonId)
    })

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

    it.each(unauthenticated)(
      'answers %s with 401 before looking at the ID and the query',
      async (_case, tokenOf, problem, challenge) => {
        const authorization = await tokenOf()

        const asked: [Record<string, string>, string][] = [
          [november(), customerId],
          [{}, 'abc'],
        ]
        for (const [query, id] of asked) {
          const response = await statistics(query, authorization, id)

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
      },
    )

    it('refuses a customer with 403, before the ID and the query are read', async () => {
      const responses = [
        await statistics(november(), asCustomer),
        await statistics({}, asCustomer, 'abc'),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it('refuses the owner of another salon with 403, whether the salon is there or not', async () => {
      const responses = [
        await statistics(november(), asOwnerOfAnotherSalon),
        await statistics(
          november({ salonId: UNKNOWN_ID }),
          asOwnerOfAnotherSalon,
        ),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it('refuses an ID that is not one with 400, before the query', async () => {
      const response = await statistics({}, asAdmin, 'abc')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it.each<[string, Record<string, string>, string[]]>([
      ['without a salon', { ...NOVEMBER }, ['salonId:invalid_type']],
      [
        'without a period',
        { salonId: UNKNOWN_ID },
        ['startDate:invalid_type', 'endDate:invalid_type'],
      ],
      [
        'with an end before the start',
        { salonId: UNKNOWN_ID, startDate: '2026-11-20', endDate: '2026-11-19' },
        ['endDate:custom'],
      ],
      [
        'with a period of 367 days',
        { salonId: UNKNOWN_ID, startDate: '2025-11-01', endDate: '2026-11-02' },
        ['endDate:custom'],
      ],
      [
        'with a day that does not exist',
        { salonId: UNKNOWN_ID, startDate: '2026-02-29', endDate: '2026-03-01' },
        ['startDate:invalid_format'],
      ],
      [
        'with the period of the old contract',
        { salonId: UNKNOWN_ID, ...NOVEMBER, period: '1y' },
        ['period:unrecognized_keys'],
      ],
    ])(
      'refuses a query %s with 400, even to the owner of another salon',
      async (_case, query, rules) => {
        const response = await statistics(query, asOwnerOfAnotherSalon)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid customer statistics')
        expect(brokenRules(response)).toEqual(rules)
      },
    )

    it('refuses a parameter given twice with 400', async () => {
      const response = await authorized(
        request(app).get(
          `/api/v1/customers/${customerId}/statistics?${new URLSearchParams(november())}&salonId=${salonId}`,
        ),
        asAdmin,
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['salonId:invalid_type'])
    })

    it('refuses a salon that is not there, or was deleted, with 400', async () => {
      const deleted = await insertSalon(db, {
        deletedAt: '2026-11-01T00:00:00Z',
      })

      for (const salon of [UNKNOWN_ID, deleted]) {
        const response = await statistics(november({ salonId: salon }))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid customer statistics')
        expect(brokenRules(response)).toEqual(['salonId:not_found'])
      }
    })

    it('answers a customer that is not there, or was deleted, with 404', async () => {
      await db
        .update(customers)
        .set({ deletedAt: '2026-11-01T00:00:00Z' })
        .where(eq(customers.id, otherCustomerId))

      for (const id of [UNKNOWN_ID, otherCustomerId]) {
        const response = await statistics(november(), asAdmin, id)

        expectProblem(response, notFound)
      }
    })

    it('answers the other methods with 404', async () => {
      const url = `/api/v1/customers/${customerId}/statistics?${new URLSearchParams(november())}`
      const responses = [
        await authorized(request(app).post(url).send({}), asAdmin),
        await authorized(request(app).patch(url).send({}), asAdmin),
        await authorized(request(app).delete(url), asAdmin),
      ]

      for (const response of responses) {
        expectProblem(response, routeNotFound)
      }
    })
  })

  describe('CustomerStatisticsRepository', () => {
    it('looks for the salon before the customer', async () => {
      const result = await new CustomerStatisticsRepository(db).findStatistics(
        customerIdSchema.parse(UNKNOWN_ID),
        {
          salonId: salonIdSchema.parse(UNKNOWN_ID),
          ...NOVEMBER,
        },
      )

      expect(result).toEqual({
        type: 'success',
        data: { type: 'salonNotFound' },
      })
    })

    it('resolves to a database error when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()

      const result = await new CustomerStatisticsRepository(
        connection.database,
      ).findStatistics(customerIdSchema.parse(customerId), {
        salonId: salonIdSchema.parse(salonId),
        ...NOVEMBER,
      })
      await connection.close()

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: 'Failed to read the statistics of a customer',
        },
      })
    })
  })
})
