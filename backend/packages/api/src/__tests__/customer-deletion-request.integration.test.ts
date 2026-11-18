import { randomUUID } from 'node:crypto'
import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customerAllergies,
  customerDeletionRequests,
  customerPoints,
  customerPreferences,
  customers,
  customerVersions,
  medicalCharts,
  reviewHelpfulVotes,
  reviewReports,
  reviews,
  sales,
  salons,
  services,
  sessions,
  treatmentPhotos,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import { customerIdSchema, userIdSchema } from '@beauty-salon-backend/domain'
import { CustomerDeletionRequestRepository } from '@beauty-salon-backend/infrastructure'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type postgres from 'postgres'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertStaff,
  insertUser,
  loginBody,
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
  UUID,
} from './_shared/test-helpers'

const CUSTOMERS = '/api/v1/customers'
const EXECUTE = `${CUSTOMERS}/deletion-requests/execute`
const deletionRequestOf = (id: string) => `${CUSTOMERS}/${id}/deletion-request`

/** A UUID that no customer has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const REASON = '退会したため、本人から電話で依頼'
const GRACE_PERIOD_MS = 14 * 24 * 60 * 60 * 1000

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

/** A request that satisfies every rule, with a value for every property. */
const customerRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Hanako',
  lastName: 'Yamada',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  email: `customer-${randomUUID()}@example.com`,
  phoneNumber: '090-1234-5678',
  alternativePhone: '03-1234-5678',
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: 'アオヤマビル 5F',
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: 'Designer',
  membershipTier: 'gold',
  preferences: { preferredServices: ['cut'], notes: '静かな席を希望' },
  notes: 'Likes to talk about films',
  internalNotes: 'Allergic to some dyes',
  tags: ['regular'],
  referredBy: null,
  referralCode: null,
  allowMarketing: true,
  allowSms: true,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: 'medium',
  scalpCondition: 'sensitive',
  customerStatus: 'active',
  ...overrides,
})

/** What an account sends to make its profile. */
const profileRequest = {
  firstName: 'Hanako',
  lastName: 'Yamada',
  firstNameKana: null,
  lastNameKana: null,
  phoneNumber: '090-1111-2222',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  preferences: null,
  allowMarketing: false,
  allowSms: false,
  allowEmail: true,
}

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

type SignInAs = () => Promise<string>

describe('Customer deletion request API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin, and the admin's user. */
  let asAdmin: string
  let adminId: string
  let salonId: string
  let staffId: string
  /** A number no other row of a test has. */
  let rows = 0

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    const admin = await signedInUser(app, db, { role: 'admin' })
    asAdmin = admin.authorization
    adminId = admin.id
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    staffId = await insertStaff(db, salonId)
  })

  const nextRow = (): number => {
    rows += 1
    return rows
  }

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const take = (
    id: string,
    body: object = { reason: REASON },
    as: string | null = asAdmin,
  ) => authorized(request(app).post(deletionRequestOf(id)), as).send(body)
  const latest = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(deletionRequestOf(id)), as)
  const cancel = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).delete(deletionRequestOf(id)), as)
  const execute = (as: string | null = asAdmin) =>
    authorized(request(app).post(EXECUTE), as)

  /** A customer created through the API, by the admin; returns it as the API does. */
  const created = async (
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> & { id: string }> => {
    const response = await request(app)
      .post(CUSTOMERS)
      .set('Authorization', asAdmin)
      .send(customerRequest(overrides))
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** A request taken through the API; returns it as the API does. */
  const taken = async (
    customerId: string,
  ): Promise<Record<string, unknown> & { id: string }> => {
    const response = await take(customerId)
    if (response.status !== 202) {
      throw new Error(
        `Expected 202, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Moves a request back in time, so that it fell due an hour ago. */
  const makeDue = async (requestId: string): Promise<void> => {
    // `now()` is one moment through the statement, so the request stays due
    // exactly the grace period after it was taken.
    await db
      .update(customerDeletionRequests)
      .set({
        requestedAt: sql`now() - interval '337 hours'`,
        scheduledAt: sql`now() - interval '1 hour'`,
      })
      .where(eq(customerDeletionRequests.id, requestId))
  }

  /** A customer with a request that is due; returns both IDs. */
  const dueCustomer = async (overrides: Record<string, unknown> = {}) => {
    const customer = await created(overrides)
    const { id } = await taken(customer.id)
    await makeDue(id)
    return { customerId: customer.id, requestId: id }
  }

  const storedCustomer = async (id: string) => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
    if (customer === undefined) {
      throw new Error(`No customer ${id}`)
    }
    return customer
  }

  const requestsOf = (customerId: string) =>
    db
      .select()
      .from(customerDeletionRequests)
      .where(eq(customerDeletionRequests.customerId, customerId))
      .orderBy(asc(customerDeletionRequests.requestedAt))

  /** Every row a request, a cancelling or an erasure may write. */
  const everything = async () => ({
    customers: await db.select().from(customers).orderBy(asc(customers.id)),
    requests: await db
      .select()
      .from(customerDeletionRequests)
      .orderBy(asc(customerDeletionRequests.id)),
    versions: await db
      .select()
      .from(customerVersions)
      .orderBy(asc(customerVersions.id)),
    users: await db.select().from(users).orderBy(asc(users.id)),
    bookings: await db.select().from(bookings).orderBy(asc(bookings.id)),
  })

  /** Links an account to a customer, both ways, as a profile claim does. */
  const linkAccount = async (customerId: string) => {
    const user = await insertUser(db, { customerId })
    await db
      .update(customers)
      .set({ userId: user.id })
      .where(eq(customers.id, customerId))
    return user
  }

  /**
   * What a salon keeps of a customer besides the visits: preferences, a
   * chart, an allergy, and 120 points with what they were given for.
   */
  const insertKept = async (customerId: string): Promise<void> => {
    await db.insert(customerPreferences).values({
      customerId,
      preferredTimeSlots: [],
      avoidStaffIds: [],
      specialRequests: '静かな席',
    })
    await db.insert(medicalCharts).values({
      customerId,
      previousTreatments: [],
      medicalConditions: '金属アレルギー',
      preferredProducts: [],
      avoidProducts: [],
      notes: null,
    })
    await db.insert(customerAllergies).values({
      customerId,
      allergyType: 'chemical',
      allergenName: 'PPD',
      severityType: 'severe',
    })
    await db.insert(customerPoints).values({
      customerId,
      transactionType: 'earned',
      points: 120,
      balance: 120,
      description: '誕生日のお祝い',
      createdAt: '2026-01-01T00:00:00Z',
    })
    await db
      .update(customers)
      .set({ loyaltyPoints: 120, referralCode: `HANAKO-${nextRow()}` })
      .where(eq(customers.id, customerId))
  }

  /**
   * Every row that names a customer, but the reviews and the marks, which
   * the erasure of another customer counts again or removes.
   */
  const everythingOf = async (customerId: string) => {
    const ofBookings = db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.customerId, customerId))
    const ofRecords = db
      .select({ id: treatmentRecords.id })
      .from(treatmentRecords)
      .where(eq(treatmentRecords.customerId, customerId))
    const ofAccounts = db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.customerId, customerId))
    return {
      customer: await storedCustomer(customerId),
      versions: await db
        .select()
        .from(customerVersions)
        .where(eq(customerVersions.customerId, customerId))
        .orderBy(asc(customerVersions.version)),
      accounts: await db
        .select()
        .from(users)
        .where(eq(users.customerId, customerId)),
      sessions: await db
        .select()
        .from(sessions)
        .where(inArray(sessions.userId, ofAccounts)),
      preferences: await db
        .select()
        .from(customerPreferences)
        .where(eq(customerPreferences.customerId, customerId)),
      charts: await db
        .select()
        .from(medicalCharts)
        .where(eq(medicalCharts.customerId, customerId)),
      allergies: await db
        .select()
        .from(customerAllergies)
        .where(eq(customerAllergies.customerId, customerId)),
      points: await db
        .select()
        .from(customerPoints)
        .where(eq(customerPoints.customerId, customerId))
        .orderBy(asc(customerPoints.createdAt)),
      bookings: await db
        .select()
        .from(bookings)
        .where(eq(bookings.customerId, customerId))
        .orderBy(asc(bookings.id)),
      lines: await db
        .select()
        .from(bookingServices)
        .where(inArray(bookingServices.bookingId, ofBookings))
        .orderBy(asc(bookingServices.id)),
      statusChanges: await db
        .select()
        .from(bookingStatusHistories)
        .where(inArray(bookingStatusHistories.bookingId, ofBookings))
        .orderBy(asc(bookingStatusHistories.id)),
      sales: await db
        .select()
        .from(sales)
        .where(eq(sales.customerId, customerId))
        .orderBy(asc(sales.id)),
      records: await db
        .select()
        .from(treatmentRecords)
        .where(eq(treatmentRecords.customerId, customerId))
        .orderBy(asc(treatmentRecords.id)),
      photos: await db
        .select()
        .from(treatmentPhotos)
        .where(inArray(treatmentPhotos.treatmentRecordId, ofRecords))
        .orderBy(asc(treatmentPhotos.id)),
    }
  }

  /** A booking of a customer with what the customer and the staff wrote of it. */
  const insertBooking = async (
    customerId: string,
    status: 'completed' | 'cancelled' | 'confirmed' = 'completed',
  ): Promise<string> => {
    const row = nextRow()
    const hour = String(row % 20).padStart(2, '0')
    const bookingDate = '2026-11-20'
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-ERASE-${row}`,
        salonId,
        customerId,
        staffId,
        bookingDate,
        startTime: `${bookingDate}T${hour}:00:00Z`,
        endTime: `${bookingDate}T${hour}:30:00Z`,
        duration: 30,
        subtotal: 6600,
        totalAmount: 6600,
        status,
        customerRequest: '前髪を短めに',
        internalNotes: '話好き',
        cancellationReason: status === 'cancelled' ? '体調不良' : null,
        cancelledAt: status === 'cancelled' ? `${bookingDate}T00:00:00Z` : null,
        completedAt:
          status === 'completed' ? `${bookingDate}T${hour}:30:00Z` : null,
        actualStartTime:
          status === 'completed' ? `${bookingDate}T${hour}:00:00Z` : null,
        ipAddress: '198.51.100.23',
        userAgent: 'CustomerPhone/1.0',
      })
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    return booking.id
  }

  /** A service of the salon, to put on a line of a booking. */
  const insertService = async (): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId,
        name: `カット ${nextRow()}`,
        duration: 30,
        price: 6000,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
      })
      .returning({ id: services.id })
    if (service === undefined) {
      throw new Error('No service was inserted')
    }
    return service.id
  }

  /**
   * Everything of a visit of a customer: a completed booking with a line
   * and a change of its status, a sale, a treatment record with a photo,
   * and a review of the salon with a report on it.
   */
  const insertVisit = async (customerId: string) => {
    const bookingId = await insertBooking(customerId)
    await db.insert(bookingServices).values({
      bookingId,
      serviceId: await insertService(),
      staffId,
      startTime: '2026-11-20T01:00:00Z',
      endTime: '2026-11-20T01:30:00Z',
      duration: 30,
      price: 6000,
      finalPrice: 6000,
      taxIncluded: false,
      notes: '襟足は刈り上げない',
    })
    await db.insert(bookingStatusHistories).values({
      bookingId,
      fromStatus: 'confirmed',
      toStatus: 'cancelled',
      changedBy: adminId,
      reason: '本人の都合で取り消し',
    })
    const [sale] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-ERASE-${nextRow()}`,
        salonId,
        customerId,
        bookingId,
        saleDate: '2026-11-20',
        saleTime: '2026-11-20T12:00:00Z',
        subtotal: 6000,
        taxAmount: 600,
        totalAmount: 6600,
      })
      .returning()
    const [record] = await db
      .insert(treatmentRecords)
      .values({
        bookingId,
        customerId,
        staffId,
        services: [randomUUID()],
        consultationNotes: '乾燥が気になる',
        colorFormula: '7レベル アッシュ',
        resultNotes: '満足',
        nextRecommendedDate: '2027-01-20',
        nextRecommendedServices: ['color'],
      })
      .returning({ id: treatmentRecords.id })
    if (sale === undefined || record === undefined) {
      throw new Error('No visit was inserted')
    }
    await db.insert(treatmentPhotos).values({
      treatmentRecordId: record.id,
      photoType: 'after',
      photoUrl: 'https://cdn.example/photos/after.jpg',
      description: '仕上がり',
    })
    const [review] = await db
      .insert(reviews)
      .values({ salonId, customerId, bookingId, overallRating: 2 })
      .returning({ id: reviews.id })
    if (review === undefined) {
      throw new Error('No review was inserted')
    }
    await db.insert(reviewReports).values({
      reviewId: review.id,
      reportedBy: adminId,
      reason: 'personal_information',
      details: '本名が書かれている',
    })
    return { bookingId, sale, recordId: record.id, reviewId: review.id }
  }

  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
    ): SignInAs =>
    async () => {
      const { email } = await insertMember(db, role, await salonOf())
      return (await signIn(app, email)).authorization
    }

  /** Who may take, read and cancel requests: those who may delete a customer. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of a salon', member('owner')],
    ['a manager of a salon', member('manager')],
    ['a manager of another salon', member('manager', () => insertSalon(db))],
  ]

  /** Who may not, although some of them keep the ledger. */
  const outsiders: [string, SignInAs][] = [
    ['a staff member of a salon', member('staff')],
    [
      'a customer account with a profile',
      async () =>
        (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
          .authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
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

  /** The four operations, each as the given user, on a customer. */
  const operations: ((
    authorization: string | null,
    id: string,
  ) => Promise<Response>)[] = [
    async (as, id) => await take(id, { reason: REASON }, as),
    async (as, id) => await latest(id, as),
    async (as, id) => await cancel(id, as),
    async (as) => await execute(as),
  ]

  describe('POST /api/v1/customers/:id/deletion-request', () => {
    it('takes the request, due 14 days after it, by the user who took it, and answers 202 as the contract has it', async () => {
      const customer = await created()

      const response = await take(customer.id)

      expect(response.status).toBe(202)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          customerId: customer.id,
          reason: REASON,
          status: 'pending',
          requestedBy: adminId,
          requestedAt: expect.stringMatching(ISO_TIMESTAMP),
          scheduledAt: expect.stringMatching(ISO_TIMESTAMP),
          cancelledBy: null,
          cancelledAt: null,
          completedBy: null,
          completedAt: null,
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: {
          self: deletionRequestOf(customer.id),
          customer: `${CUSTOMERS}/${customer.id}`,
        },
      })
      const { requestedAt, scheduledAt } = response.body.data
      expect(
        new Date(scheduledAt).getTime() - new Date(requestedAt).getTime(),
      ).toBe(GRACE_PERIOD_MS)
      const read = await latest(customer.id)
      expect(read.body.data).toEqual(response.body.data)
    })

    it('changes nothing of the customer until the request is carried out', async () => {
      const customer = await created()
      const before = await storedCustomer(customer.id)

      await taken(customer.id)

      expect(await storedCustomer(customer.id)).toEqual(before)
    })

    it.each(keepers)('lets %s take a request', async (_who, signInAs) => {
      const customer = await created()
      const authorization = await signInAs()

      const response = await take(
        customer.id,
        { reason: REASON },
        authorization,
      )

      expect(response.status).toBe(202)
    })

    it.each<[string, object, string[]]>([
      ['no reason', {}, ['reason:invalid_type']],
      ['an empty reason', { reason: '' }, ['reason:invalid_format']],
      ['a blank reason', { reason: ' \n' }, ['reason:invalid_format']],
      [
        'a reason of 1,001 characters',
        { reason: 'あ'.repeat(1001) },
        ['reason:too_big'],
      ],
      ['a reason that is no string', { reason: 1 }, ['reason:invalid_type']],
      [
        'a property of no request',
        { reason: REASON, confirmed: true },
        ['confirmed:unrecognized_keys'],
      ],
    ])('refuses %s with 400, and takes nothing', async (_case, body, rules) => {
      const customer = await created()

      const response = await take(customer.id, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(rules)
      expect(await requestsOf(customer.id)).toEqual([])
    })

    it('takes a reason of 1,000 characters as it is written', async () => {
      const customer = await created()
      const reason = ` ${'あ'.repeat(998)} `

      const response = await take(customer.id, { reason })

      expect(response.status).toBe(202)
      expect(response.body.data.reason).toBe(reason)
    })

    it('refuses a customer ID that is no UUID before the request, and an unknown customer only after the request', async () => {
      const malformed = await take('customer-1', { reason: ' ' })
      const unknownWithBadBody = await take(UNKNOWN_ID, { reason: ' ' })

      expectProblem(malformed, badRequest)
      expect(brokenRules(malformed)).toEqual(['id:invalid_format'])
      expect(brokenRules(unknownWithBadBody)).toEqual(['reason:invalid_format'])
    })

    it('answers 404 for a customer that is not there, and for a deleted customer', async () => {
      const deleted = await created()
      await request(app)
        .delete(`${CUSTOMERS}/${deleted.id}`)
        .set('Authorization', asAdmin)

      expectProblem(await take(UNKNOWN_ID), notFound)
      expectProblem(await take(deleted.id), notFound)
      expect(await requestsOf(deleted.id)).toEqual([])
    })

    it('answers 409 while a request is pending, naming it, and takes no second one', async () => {
      const customer = await created()
      const pending = await taken(customer.id)

      const response = await take(customer.id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toContain(pending.id)
      expect(await requestsOf(customer.id)).toHaveLength(1)
    })

    it('takes a new request once the pending one is cancelled', async () => {
      const customer = await created()
      await taken(customer.id)
      await cancel(customer.id)

      const response = await take(customer.id)

      expect(response.status).toBe(202)
      expect(
        (await requestsOf(customer.id)).map(({ status }) => status),
      ).toEqual(['cancelled', 'pending'])
    })
  })

  describe('GET /api/v1/customers/:id/deletion-request', () => {
    it('answers the request taken last, whatever became of the ones before', async () => {
      const customer = await created()
      await taken(customer.id)
      await cancel(customer.id)
      const second = await taken(customer.id)

      const response = await latest(customer.id)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: second,
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: {
          self: deletionRequestOf(customer.id),
          customer: `${CUSTOMERS}/${customer.id}`,
        },
      })
    })

    it('reads the request of a customer deleted since', async () => {
      const customer = await created()
      const pending = await taken(customer.id)
      await request(app)
        .delete(`${CUSTOMERS}/${customer.id}`)
        .set('Authorization', asAdmin)

      const response = await latest(customer.id)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(pending)
    })

    it('answers 404 for a customer without a request, and for a customer that is not there', async () => {
      const customer = await created()

      const none = await latest(customer.id)
      const unknown = await latest(UNKNOWN_ID)

      expectProblem(none, notFound)
      expect(none.body.detail).toBe(
        `Deletion request of customer ${customer.id} was not found`,
      )
      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Customer ${UNKNOWN_ID} was not found`)
    })

    it('refuses a customer ID that is no UUID', async () => {
      const response = await latest('customer-1')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('takes a customer ID in upper case, and links under the ID the request has', async () => {
      const customer = await created()
      await taken(customer.id)

      const response = await latest(customer.id.toUpperCase())

      expect(response.status).toBe(200)
      expect(response.body.links.self).toBe(deletionRequestOf(customer.id))
    })
  })

  describe('DELETE /api/v1/customers/:id/deletion-request', () => {
    it('cancels the pending request, by the user who cancels it, and keeps the data', async () => {
      const customer = await created()
      const pending = await taken(customer.id)
      const before = await storedCustomer(customer.id)

      const response = await cancel(customer.id)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          ...pending,
          status: 'cancelled',
          cancelledBy: adminId,
          cancelledAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: {
          self: deletionRequestOf(customer.id),
          customer: `${CUSTOMERS}/${customer.id}`,
        },
      })
      expect((await latest(customer.id)).body.data).toEqual(response.body.data)
      expect(await storedCustomer(customer.id)).toEqual(before)
    })

    it('cancels a request that is due but not carried out, which then is not carried out', async () => {
      const { customerId } = await dueCustomer()
      const before = await storedCustomer(customerId)

      const cancelled = await cancel(customerId)
      const executed = await execute()

      expect(cancelled.status).toBe(200)
      expect(executed.body.data).toEqual([])
      expect(await storedCustomer(customerId)).toEqual(before)
    })

    it('cancels the request of a customer deleted since', async () => {
      const customer = await created()
      await taken(customer.id)
      await request(app)
        .delete(`${CUSTOMERS}/${customer.id}`)
        .set('Authorization', asAdmin)

      expect((await cancel(customer.id)).status).toBe(200)
    })

    it('answers 404 for a customer without a pending request: none, cancelled or carried out', async () => {
      const none = await created()
      const cancelled = await created()
      await taken(cancelled.id)
      await cancel(cancelled.id)
      const { customerId: erased } = await dueCustomer()
      await execute()

      for (const id of [none.id, cancelled.id, erased]) {
        const response = await cancel(id)
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Pending deletion request of customer ${id} was not found`,
        )
      }
    })

    it('answers 404 for a customer that is not there, and 400 for an ID that is no UUID', async () => {
      expectProblem(await cancel(UNKNOWN_ID), notFound)
      const malformed = await cancel('customer-1')
      expectProblem(malformed, badRequest)
      expect(brokenRules(malformed)).toEqual(['id:invalid_format'])
    })
  })

  describe('POST /api/v1/customers/deletion-requests/execute', () => {
    it('erases everything that says who the customer was, keeps what the books need, and answers with the request carried out', async () => {
      const { customerId, requestId } = await dueCustomer()
      const account = await linkAccount(customerId)
      const session = await signIn(app, account.email)
      const other = await created()
      const othersAccount = await linkAccount(other.id)
      const othersSession = await signIn(app, othersAccount.email)
      const visit = await insertVisit(customerId)
      const othersVisit = await insertVisit(other.id)
      await db.insert(reviewHelpfulVotes).values([
        { reviewId: othersVisit.reviewId, customerId },
        { reviewId: visit.reviewId, customerId: other.id },
      ])
      await db
        .update(reviews)
        .set({ helpfulCount: 1 })
        .where(inArray(reviews.id, [othersVisit.reviewId, visit.reviewId]))
      await insertKept(customerId)
      await insertKept(other.id)
      await db
        .update(salons)
        .set({ rating: '3.50', reviewCount: 2 })
        .where(eq(salons.id, salonId))
      const before = await storedCustomer(customerId)
      const othersBefore = await everythingOf(other.id)

      const response = await execute()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [
          expect.objectContaining({
            id: requestId,
            customerId,
            status: 'completed',
            completedBy: adminId,
            completedAt: expect.stringMatching(ISO_TIMESTAMP),
          }),
        ],
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: null,
      })

      const erased = await storedCustomer(customerId)
      expect(erased).toEqual({
        ...before,
        userId: null,
        firstName: '顧客',
        lastName: '消去済み',
        firstNameKana: null,
        lastNameKana: null,
        email: `${customerId}@erased.invalid`,
        phoneNumber: '0000000000',
        alternativePhone: null,
        postalCode: null,
        prefecture: null,
        city: null,
        address: null,
        building: null,
        birthDate: null,
        gender: null,
        occupation: null,
        loyaltyPoints: 0,
        preferences: null,
        notes: null,
        internalNotes: null,
        tags: [],
        referralCode: null,
        allowMarketing: false,
        allowSms: false,
        allowEmail: false,
        isActive: false,
        hairType: null,
        hairThickness: null,
        scalpCondition: null,
        deletedAt: expect.any(String),
        updatedAt: expect.any(String),
      })

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, account.id))
      expect(user).toMatchObject({
        email: `${account.id}@erased.invalid`,
        passwordHash: 'erased',
        status: 'deleted',
        emailVerified: false,
        customerId: null,
        lastLoginAt: null,
        lastLoginIp: null,
        deletedAt: expect.any(String),
      })
      expect(
        await db.select().from(sessions).where(eq(sessions.userId, account.id)),
      ).toEqual([])
      expectProblem(
        await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', session.authorization),
        invalidToken,
      )
      expect(
        (
          await request(app)
            .post('/api/v1/auth/login')
            .send(loginBody(account.email))
        ).status,
      ).toBe(401)

      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, visit.bookingId))
      expect(booking).toMatchObject({
        customerId,
        customerRequest: null,
        internalNotes: null,
        cancellationReason: null,
        ipAddress: null,
        userAgent: null,
        totalAmount: 6600,
        status: 'completed',
      })
      expect(
        await db
          .select({
            notes: bookingServices.notes,
            price: bookingServices.price,
          })
          .from(bookingServices)
          .where(eq(bookingServices.bookingId, visit.bookingId)),
      ).toEqual([{ notes: null, price: 6000 }])
      expect(
        await db
          .select({
            toStatus: bookingStatusHistories.toStatus,
            reason: bookingStatusHistories.reason,
          })
          .from(bookingStatusHistories)
          .where(eq(bookingStatusHistories.bookingId, visit.bookingId)),
      ).toEqual([{ toStatus: 'cancelled', reason: null }])
      expect(
        await db.select().from(sales).where(eq(sales.id, visit.sale.id)),
      ).toEqual([visit.sale])

      const [record] = await db
        .select()
        .from(treatmentRecords)
        .where(eq(treatmentRecords.id, visit.recordId))
      expect(record).toMatchObject({
        customerId,
        consultationNotes: null,
        colorFormula: null,
        resultNotes: null,
        nextRecommendedDate: null,
        nextRecommendedServices: [],
      })
      expect(
        await db
          .select()
          .from(treatmentPhotos)
          .where(eq(treatmentPhotos.treatmentRecordId, visit.recordId)),
      ).toEqual([])

      expect(
        await db
          .select()
          .from(reviews)
          .where(eq(reviews.customerId, customerId)),
      ).toEqual([])
      expect(
        await db
          .select()
          .from(reviewReports)
          .where(eq(reviewReports.reviewId, visit.reviewId)),
      ).toEqual([])
      expect(
        await db
          .select()
          .from(reviewHelpfulVotes)
          .where(eq(reviewHelpfulVotes.customerId, customerId)),
      ).toEqual([])
      const [marked] = await db
        .select({ helpfulCount: reviews.helpfulCount })
        .from(reviews)
        .where(eq(reviews.id, othersVisit.reviewId))
      expect(marked?.helpfulCount).toBe(0)
      const [salon] = await db
        .select({ rating: salons.rating, reviewCount: salons.reviewCount })
        .from(salons)
        .where(eq(salons.id, salonId))
      expect(salon).toEqual({ rating: '2.00', reviewCount: 1 })

      for (const table of [
        customerPreferences,
        medicalCharts,
        customerAllergies,
      ]) {
        expect(
          await db.select().from(table).where(eq(table.customerId, customerId)),
        ).toEqual([])
      }

      expect(
        (
          await db
            .select()
            .from(customerPoints)
            .where(eq(customerPoints.customerId, customerId))
            .orderBy(asc(customerPoints.createdAt))
        ).map(({ transactionType, points, balance, description }) => ({
          transactionType,
          points,
          balance,
          description,
        })),
      ).toEqual([
        {
          transactionType: 'earned',
          points: 120,
          balance: 120,
          description: null,
        },
        {
          transactionType: 'expired',
          points: -120,
          balance: 0,
          description: 'データの消去による失効',
        },
      ])

      const versions = await db
        .select()
        .from(customerVersions)
        .where(eq(customerVersions.customerId, customerId))
      expect(versions).toEqual([
        expect.objectContaining({
          version: 1,
          operation: 'erase',
          changedBy: adminId,
          firstName: '顧客',
          email: `${customerId}@erased.invalid`,
        }),
      ])

      // Of the other customer nothing changed but the count of the marks
      // on their review, and their account still signs in.
      expect(await everythingOf(other.id)).toEqual(othersBefore)
      expect(
        (
          await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', othersSession.authorization)
        ).status,
      ).toBe(200)
    })

    it('carries out only the requests that are due and pending, each once', async () => {
      const due = await dueCustomer()
      const notYet = await created()
      await taken(notYet.id)
      const cancelled = await dueCustomer()
      await cancel(cancelled.customerId)
      const notYetBefore = await storedCustomer(notYet.id)
      const cancelledBefore = await storedCustomer(cancelled.customerId)

      const first = await execute()
      const second = await execute()

      expect(first.body.data.map(({ id }: { id: string }) => id)).toEqual([
        due.requestId,
      ])
      expect(second.status).toBe(200)
      expect(second.body.data).toEqual([])
      expect(await storedCustomer(notYet.id)).toEqual(notYetBefore)
      expect(await storedCustomer(cancelled.customerId)).toEqual(
        cancelledBefore,
      )
      expect((await requestsOf(notYet.id)).map(({ status }) => status)).toEqual(
        ['pending'],
      )
    })

    it('carries out the requests in the order they fell due', async () => {
      const later = await dueCustomer()
      const earlier = await dueCustomer()
      await db
        .update(customerDeletionRequests)
        .set({
          requestedAt: sql`now() - interval '340 hours'`,
          scheduledAt: sql`now() - interval '4 hours'`,
        })
        .where(eq(customerDeletionRequests.id, earlier.requestId))

      const response = await execute()

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        earlier.requestId,
        later.requestId,
      ])
    })

    it('keeps the moment a customer deleted before was deleted, and forfeits nothing of a customer without points', async () => {
      const { customerId } = await dueCustomer()
      await request(app)
        .delete(`${CUSTOMERS}/${customerId}`)
        .set('Authorization', asAdmin)
      const { deletedAt } = await storedCustomer(customerId)

      await execute()

      expect((await storedCustomer(customerId)).deletedAt).toBe(deletedAt)
      expect(
        await db
          .select()
          .from(customerPoints)
          .where(eq(customerPoints.customerId, customerId)),
      ).toEqual([])
    })

    it('erases the account that a customer deleted before still names, when it has no profile since', async () => {
      const { customerId } = await dueCustomer()
      const account = await linkAccount(customerId)
      await signIn(app, account.email)
      await request(app)
        .delete(`${CUSTOMERS}/${customerId}`)
        .set('Authorization', asAdmin)

      await execute()

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, account.id))
      expect(user).toMatchObject({
        email: `${account.id}@erased.invalid`,
        status: 'deleted',
        customerId: null,
      })
      expect(
        await db.select().from(sessions).where(eq(sessions.userId, account.id)),
      ).toEqual([])
    })

    it('leaves the account of a customer deleted before when the account has made a profile again', async () => {
      const { customerId } = await dueCustomer()
      const account = await linkAccount(customerId)
      const session = await signIn(app, account.email)
      await request(app)
        .delete(`${CUSTOMERS}/${customerId}`)
        .set('Authorization', asAdmin)
      const profile = await request(app)
        .post(`${CUSTOMERS}/me`)
        .set('Authorization', session.authorization)
        .send(profileRequest)
      expect(profile.status).toBe(201)
      const accountBefore = await db
        .select()
        .from(users)
        .where(eq(users.id, account.id))
      const profileBefore = await storedCustomer(profile.body.data.id)

      const response = await execute()

      expect(response.body.data).toHaveLength(1)
      expect((await storedCustomer(customerId)).userId).toBeNull()
      expect(
        await db.select().from(users).where(eq(users.id, account.id)),
      ).toEqual(accountBefore)
      expect(await storedCustomer(profile.body.data.id)).toEqual(profileBefore)
      expect(
        (
          await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', session.authorization)
        ).status,
      ).toBe(200)
    })

    it('keeps the moment an account deleted before was deleted', async () => {
      const { customerId } = await dueCustomer()
      const account = await insertUser(db, {
        customerId,
        status: 'deleted',
        deletedAt: '2026-10-01T09:00:00Z',
      })
      const [before] = await db
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, account.id))

      await execute()

      const [user] = await db
        .select({ email: users.email, deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, account.id))
      expect(before?.deletedAt).toEqual(expect.any(String))
      expect(user).toEqual({
        email: `${account.id}@erased.invalid`,
        deletedAt: before?.deletedAt,
      })
    })

    it('leaves the erased customer out of the ledger, refuses to restore it, and keeps the erasure as its one version', async () => {
      const { customerId } = await dueCustomer()
      await execute()

      expectProblem(
        await request(app)
          .get(`${CUSTOMERS}/${customerId}`)
          .set('Authorization', asAdmin),
        notFound,
      )
      const restored = await request(app)
        .post(`${CUSTOMERS}/${customerId}/restore`)
        .set('Authorization', asAdmin)
      expectProblem(restored, notAllowed)
      expect(restored.body.detail).toContain('erased at their request')
      const history = await request(app)
        .get(`${CUSTOMERS}/${customerId}/history`)
        .set('Authorization', asAdmin)
      expect(
        history.body.data.map(
          ({ version, operation }: { version: number; operation: string }) =>
            `${version} ${operation}`,
        ),
      ).toEqual(['1 erase'])
    })

    it('answers with none when none is due', async () => {
      const response = await execute()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([])
    })

    it.each<[string, SignInAs]>([
      ['the owner of a salon', member('owner')],
      ['a manager of a salon', member('manager')],
      ...outsiders,
    ])('refuses %s with 403, and erases nothing', async (_who, signInAs) => {
      const { customerId } = await dueCustomer()
      const authorization = await signInAs()
      const before = await storedCustomer(customerId)

      expectProblem(await execute(authorization), forbidden)
      expect(await storedCustomer(customerId)).toEqual(before)
    })
  })

  describe('merging a customer with a pending request', () => {
    it.each(['primary', 'secondary'])(
      'answers 409 when the %s has a pending request, naming it, and merges nothing',
      async (side) => {
        const primary = await created()
        const secondary = await created()
        const requested = side === 'primary' ? primary.id : secondary.id
        await taken(requested)
        const before = await everything()

        const response = await request(app)
          .post(`${CUSTOMERS}/merge`)
          .set('Authorization', asAdmin)
          .send({
            primaryCustomerId: primary.id,
            secondaryCustomerId: secondary.id,
            conflictResolution: 'keep_primary',
          })

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `Customer ${requested} asked for their data to be erased; cancel the deletion request first`,
        )
        expect(await everything()).toEqual(before)
      },
    )

    it('merges once the request is cancelled', async () => {
      const primary = await created()
      const secondary = await created()
      await taken(secondary.id)
      await cancel(secondary.id)

      const response = await request(app)
        .post(`${CUSTOMERS}/merge`)
        .set('Authorization', asAdmin)
        .send({
          primaryCustomerId: primary.id,
          secondaryCustomerId: secondary.id,
          conflictResolution: 'keep_primary',
        })

      expect(response.status).toBe(200)
    })
  })

  describe('who may', () => {
    it.each(outsiders)(
      'refuses %s every operation, and changes nothing',
      async (_who, signInAs) => {
        const { customerId } = await dueCustomer()
        const authorization = await signInAs()
        const before = await everything()

        const responses: Response[] = []
        for (const call of operations) {
          responses.push(await call(authorization, customerId))
        }

        expect(responses.map(statusAndCode)).toEqual([
          '403 1005',
          '403 1005',
          '403 1005',
          '403 1005',
        ])
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses an outsider before it looks at the request', async () => {
      const authorization = await member('staff')()

      const responses = [
        await take('customer-1', { reason: ' ' }, authorization),
        await latest('customer-1', authorization),
        await cancel('customer-1', authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it.each(keepers)(
      'lets %s read and cancel a request',
      async (_who, signInAs) => {
        const customer = await created()
        await taken(customer.id)
        const authorization = await signInAs()

        const responses = [
          await latest(customer.id, authorization),
          await cancel(customer.id, authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      },
    )

    it.each(unauthenticated)(
      'refuses %s every operation with 401, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const { customerId } = await dueCustomer()
        const token = await tokenOf()
        const before = await everything()

        for (const call of operations) {
          const response = await call(token, customerId)
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['PUT on a request', 'put', '/:id/deletion-request'],
      ['PATCH on a request', 'patch', '/:id/deletion-request'],
      ['GET on the execution', 'get', '/deletion-requests/execute'],
      ['DELETE on the execution', 'delete', '/deletion-requests/execute'],
      ['PUT on the execution', 'put', '/deletion-requests/execute'],
      ['POST on the requests of a customer', 'post', '/:id/deletion-requests'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, path) => {
        const { customerId } = await dueCustomer()
        const before = await everything()

        const response = await request(app)
          [method](`${CUSTOMERS}${path.replace(':id', customerId)}`)
          .set('Authorization', asAdmin)
          .send({ reason: REASON })

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('requests at the same moment', () => {
    /** Waits until `count` statements of other connections wait for a lock. */
    const untilWaiting = async (
      client: ReturnType<typeof getTestDbClient>,
      count = 1,
    ): Promise<void> => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        const [activity] = await client<{ waiting: number }[]>`
          SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
        `
        if ((activity?.waiting ?? 0) >= count) {
          return
        }
        await pause(10)
      }
      throw new Error(`Fewer than ${count} statements waited for a lock`)
    }

    type Holding = (tx: postgres.TransactionSql) => Promise<unknown>

    /**
     * Holds rows in a transaction of another connection, by `hold`, until
     * `release` is called, and then runs `then` in it and commits. A test
     * releases it whether or not anything waited, so that a failure leaves
     * no lock held.
     */
    const holding = async (
      hold: Holding,
      then: Holding = async () => undefined,
    ) => {
      const client = getTestDbClient()
      const held = Promise.withResolvers<void>()
      const mayGoOn = Promise.withResolvers<void>()
      const holder = client.begin(async (tx) => {
        await hold(tx)
        held.resolve()
        await mayGoOn.promise
        await then(tx)
      })
      await held.promise
      return {
        client,
        release: async () => {
          mayGoOn.resolve()
          await holder
        },
      }
    }

    it('takes one of two requests that arrive together, and answers the other with 409', async () => {
      const customer = await created()

      const responses = await Promise.all([
        take(customer.id),
        take(customer.id),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '202',
        '409 3003',
      ])
      expect(await requestsOf(customer.id)).toHaveLength(1)
    })

    it('makes a request wait for a deletion of the customer in progress, and then answers 404', async () => {
      const customer = await created()
      const { client, release } = await holding(
        (tx) =>
          tx`SELECT id FROM customers WHERE id = ${customer.id} FOR UPDATE`,
        (tx) =>
          tx`UPDATE customers SET "deletedAt" = clock_timestamp() WHERE id = ${customer.id}`,
      )

      const pending = take(customer.id).then((response) => response)
      await untilWaiting(client).finally(release)

      expectProblem(await pending, notFound)
      expect(await requestsOf(customer.id)).toEqual([])
    })

    it('stamps a request with the moment it is let through, and makes it due the grace period after that', async () => {
      const customer = await created()
      const { client, release } = await holding(
        (tx) =>
          tx`SELECT id FROM customers WHERE id = ${customer.id} FOR UPDATE`,
      )

      const pending = take(customer.id).then((response) => response)
      const [moment] = await untilWaiting(client)
        .then(
          () => client<{ ms: number }[]>`
            SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms
          `,
        )
        .finally(release)
      const response = await pending

      expect(response.status).toBe(202)
      const requestedAt = new Date(response.body.data.requestedAt).getTime()
      expect(requestedAt).toBeGreaterThanOrEqual(Math.floor(moment?.ms ?? 0))
      expect(new Date(response.body.data.scheduledAt).getTime()).toBe(
        requestedAt + GRACE_PERIOD_MS,
      )
    })

    it('makes a cancelling wait for a change of the request under the customer in progress, and then sees what it left', async () => {
      const customer = await created()
      await taken(customer.id)
      const { client, release } = await holding(
        (tx) =>
          tx`SELECT id FROM customers WHERE id = ${customer.id} FOR UPDATE`,
        (tx) =>
          tx`UPDATE customer_deletion_requests SET status = 'cancelled', "cancelledBy" = ${adminId}, "cancelledAt" = clock_timestamp() WHERE "customerId" = ${customer.id}`,
      )

      const pending = cancel(customer.id).then((response) => response)
      await untilWaiting(client).finally(release)

      expectProblem(await pending, notFound)
    })

    it('carries out a request once of two executions that arrive together', async () => {
      const { customerId, requestId } = await dueCustomer()
      await insertVisit(customerId)

      const responses = await Promise.all([execute(), execute()])

      expect(responses.map(({ status }) => status)).toEqual([200, 200])
      expect(
        responses.flatMap(({ body }) =>
          body.data.map(({ id }: { id: string }) => id),
        ),
      ).toEqual([requestId])
      expect(
        (
          await db
            .select({ operation: customerVersions.operation })
            .from(customerVersions)
            .where(eq(customerVersions.customerId, customerId))
        ).map(({ operation }) => operation),
      ).toEqual(['erase'])
    })

    it('either cancels or carries out a request when a cancelling and an execution arrive together, never both', async () => {
      const { customerId } = await dueCustomer()

      const [cancelled, executed] = await Promise.all([
        cancel(customerId),
        execute(),
      ])

      const [stored] = await requestsOf(customerId)
      const erased = (await storedCustomer(customerId)).firstName === '顧客'
      if (cancelled.status === 200) {
        expect(executed.body.data).toEqual([])
        expect(stored?.status).toBe('cancelled')
        expect(erased).toBe(false)
      } else {
        expectProblem(cancelled, notFound)
        expect(executed.body.data).toHaveLength(1)
        expect(stored?.status).toBe('completed')
        expect(erased).toBe(true)
      }
    })

    it('makes an erasure wait for a change of a booking of the customer in progress, and erases what it wrote', async () => {
      const { customerId } = await dueCustomer()
      const bookingId = await insertBooking(customerId, 'confirmed')
      const { client, release } = await holding(
        (tx) => tx`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`,
        async (tx) => {
          await tx`UPDATE bookings SET "internalNotes" = '書き足した' WHERE id = ${bookingId}`
          await tx`UPDATE customers SET "updatedAt" = clock_timestamp() WHERE id = ${customerId}`
        },
      )

      const pending = execute().then((response) => response)
      await untilWaiting(client).finally(release)

      expect((await pending).body.data).toHaveLength(1)
      const [booking] = await db
        .select({ internalNotes: bookings.internalNotes })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      expect(booking).toEqual({ internalNotes: null })
    })

    it('makes an erasure wait for a writer that holds a treatment record of the customer and then the customer, as a merge does, and erases what it wrote', async () => {
      const { customerId } = await dueCustomer()
      const { recordId } = await insertVisit(customerId)
      const { client, release } = await holding(
        (tx) =>
          tx`SELECT id FROM treatment_records WHERE id = ${recordId} FOR UPDATE`,
        async (tx) => {
          await tx`UPDATE treatment_records SET "consultationNotes" = '書き足した' WHERE id = ${recordId}`
          await tx`UPDATE customers SET "updatedAt" = clock_timestamp() WHERE id = ${customerId}`
        },
      )

      const pending = execute().then((response) => response)
      await untilWaiting(client).finally(release)

      expect((await pending).body.data).toHaveLength(1)
      const [record] = await db
        .select({ consultationNotes: treatmentRecords.consultationNotes })
        .from(treatmentRecords)
        .where(eq(treatmentRecords.id, recordId))
      expect(record).toEqual({ consultationNotes: null })
    })

    it('makes an erasure wait for a mark in progress on a review the customer marked, and counts the marks after it', async () => {
      const { customerId } = await dueCustomer()
      const other = await created()
      const third = await created()
      const { reviewId } = await insertVisit(other.id)
      await db.insert(reviewHelpfulVotes).values({ reviewId, customerId })
      await db
        .update(reviews)
        .set({ helpfulCount: 1 })
        .where(eq(reviews.id, reviewId))
      const { client, release } = await holding(
        (tx) => tx`SELECT id FROM reviews WHERE id = ${reviewId} FOR UPDATE`,
        async (tx) => {
          await tx`INSERT INTO review_helpful_votes ("reviewId", "customerId") VALUES (${reviewId}, ${third.id})`
          await tx`UPDATE reviews SET "helpfulCount" = 2 WHERE id = ${reviewId}`
        },
      )

      const pending = execute().then((response) => response)
      await untilWaiting(client).finally(release)

      expect((await pending).body.data).toHaveLength(1)
      const [review] = await db
        .select({ helpfulCount: reviews.helpfulCount })
        .from(reviews)
        .where(eq(reviews.id, reviewId))
      expect(review).toEqual({ helpfulCount: 1 })
    })

    it('makes an erasure wait for points being given to the customer in progress, erases what was written of them and forfeits them too', async () => {
      const { customerId } = await dueCustomer()
      const { client, release } = await holding(
        (tx) =>
          tx`SELECT id FROM customers WHERE id = ${customerId} FOR NO KEY UPDATE`,
        async (tx) => {
          await tx`INSERT INTO customer_points ("customerId", "transactionType", points, balance, description) VALUES (${customerId}, 'earned', 50, 50, '来店のお礼')`
          await tx`UPDATE customers SET "loyaltyPoints" = 50, notes = '書き足した' WHERE id = ${customerId}`
        },
      )

      const pending = execute().then((response) => response)
      await untilWaiting(client).finally(release)

      expect((await pending).body.data).toHaveLength(1)
      expect(await storedCustomer(customerId)).toMatchObject({
        notes: null,
        loyaltyPoints: 0,
      })
      expect(
        (
          await db
            .select()
            .from(customerPoints)
            .where(eq(customerPoints.customerId, customerId))
            .orderBy(asc(customerPoints.createdAt))
        ).map(
          ({ transactionType, points, balance, description }) =>
            `${transactionType} ${points} ${balance} ${description}`,
        ),
      ).toEqual(['earned 50 50 null', 'expired -50 0 データの消去による失効'])
    })

    it('makes an erasure of a customer deleted before wait for a profile that its account is making, and then leaves the account', async () => {
      const { customerId } = await dueCustomer()
      const account = await linkAccount(customerId)
      await request(app)
        .delete(`${CUSTOMERS}/${customerId}`)
        .set('Authorization', asAdmin)
      const again = await created()
      const { client, release } = await holding(
        (tx) => tx`SELECT id FROM users WHERE id = ${account.id} FOR UPDATE`,
        async (tx) => {
          await tx`UPDATE customers SET "userId" = ${account.id} WHERE id = ${again.id}`
          await tx`UPDATE users SET "customerId" = ${again.id} WHERE id = ${account.id}`
        },
      )

      const pending = execute().then((response) => response)
      await untilWaiting(client).finally(release)

      expect((await pending).body.data).toHaveLength(1)
      const [user] = await db
        .select({
          email: users.email,
          status: users.status,
          customerId: users.customerId,
        })
        .from(users)
        .where(eq(users.id, account.id))
      expect(user).toEqual({
        email: account.email,
        status: 'active',
        customerId: again.id,
      })
    })

    it('makes an erasure wait for a cancelling of the request in progress, and then erases nothing', async () => {
      const { customerId, requestId } = await dueCustomer()
      const before = await storedCustomer(customerId)
      const { client, release } = await holding(
        (tx) =>
          tx`SELECT id FROM customer_deletion_requests WHERE id = ${requestId} FOR UPDATE`,
        (tx) =>
          tx`UPDATE customer_deletion_requests SET status = 'cancelled', "cancelledBy" = ${adminId}, "cancelledAt" = clock_timestamp() WHERE id = ${requestId}`,
      )

      const pending = execute().then((response) => response)
      await untilWaiting(client).finally(release)

      expect((await pending).body.data).toEqual([])
      expect(await storedCustomer(customerId)).toEqual(before)
    })

    it('makes an erasure wait for a sign-in of the account of the customer in progress, and erases what it wrote', async () => {
      const { customerId } = await dueCustomer()
      const account = await linkAccount(customerId)
      const { client, release } = await holding(
        (tx) => tx`SELECT id FROM users WHERE id = ${account.id} FOR UPDATE`,
        (tx) =>
          tx`UPDATE users SET "lastLoginAt" = clock_timestamp(), "lastLoginIp" = '203.0.113.9' WHERE id = ${account.id}`,
      )

      const pending = execute().then((response) => response)
      await untilWaiting(client).finally(release)

      expect((await pending).body.data).toHaveLength(1)
      const [user] = await db
        .select({
          lastLoginAt: users.lastLoginAt,
          lastLoginIp: users.lastLoginIp,
        })
        .from(users)
        .where(eq(users.id, account.id))
      expect(user).toEqual({ lastLoginAt: null, lastLoginIp: null })
    })

    it('makes a merge wait for a request of the customer in progress, and then refuses it', async () => {
      const primary = await created()
      const secondary = await created()
      const { client, release } = await holding(
        (tx) =>
          tx`SELECT id FROM customers WHERE id = ${secondary.id} FOR UPDATE`,
        (tx) =>
          tx`INSERT INTO customer_deletion_requests ("customerId", reason, "requestedBy", "requestedAt", "scheduledAt") VALUES (${secondary.id}, ${REASON}, ${adminId}, now(), now() + interval '336 hours')`,
      )

      const pending = request(app)
        .post(`${CUSTOMERS}/merge`)
        .set('Authorization', asAdmin)
        .send({
          primaryCustomerId: primary.id,
          secondaryCustomerId: secondary.id,
          conflictResolution: 'keep_primary',
        })
        .then((response) => response)
      await untilWaiting(client).finally(release)

      expectProblem(await pending, notAllowed)
      expect((await storedCustomer(secondary.id)).deletedAt).toBeNull()
    })
  })

  describe('the repository', () => {
    it.each<
      [
        string,
        (repository: CustomerDeletionRequestRepository) => Promise<unknown>,
        string,
      ]
    >([
      [
        'request',
        (repository) =>
          repository.request(
            customerIdSchema.parse(UNKNOWN_ID),
            REASON,
            userIdSchema.parse(UNKNOWN_ID),
          ),
        'Failed to take the deletion request',
      ],
      [
        'latestOf',
        (repository) => repository.latestOf(customerIdSchema.parse(UNKNOWN_ID)),
        'Failed to read the deletion request',
      ],
      [
        'cancel',
        (repository) =>
          repository.cancel(
            customerIdSchema.parse(UNKNOWN_ID),
            userIdSchema.parse(UNKNOWN_ID),
          ),
        'Failed to cancel the deletion request',
      ],
      [
        'dueRequests',
        (repository) => repository.dueRequests(),
        'Failed to find the deletion requests that are due',
      ],
      [
        'erase',
        (repository) =>
          repository.erase(UNKNOWN_ID, userIdSchema.parse(UNKNOWN_ID)),
        'Failed to erase the data of the customer',
      ],
    ])(
      'tells of %s that the database could not be reached',
      async (_method, call, message) => {
        const connection = connectUnreachableDatabase()

        const result = await call(
          new CustomerDeletionRequestRepository(connection.database),
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message },
        })
      },
    )

    it('finds the pending requests that are due, the one that fell due first before the others', async () => {
      const later = await dueCustomer()
      const earlier = await dueCustomer()
      await db
        .update(customerDeletionRequests)
        .set({
          requestedAt: sql`now() - interval '340 hours'`,
          scheduledAt: sql`now() - interval '4 hours'`,
        })
        .where(eq(customerDeletionRequests.id, earlier.requestId))
      await taken((await created()).id)
      await cancel((await dueCustomer()).customerId)

      expect(
        await new CustomerDeletionRequestRepository(db).dueRequests(),
      ).toEqual({
        type: 'success',
        data: [earlier.requestId, later.requestId],
      })
    })

    it('erases nothing for a request that is not there', async () => {
      const repository = new CustomerDeletionRequestRepository(db)

      expect(
        await repository.erase(UNKNOWN_ID, userIdSchema.parse(adminId)),
      ).toEqual({ type: 'success', data: { type: 'notDue' } })
    })

    it('erases nothing for a request that is not due yet', async () => {
      const customer = await created()
      const { id } = await taken(customer.id)
      const before = await storedCustomer(customer.id)
      const repository = new CustomerDeletionRequestRepository(db)

      expect(await repository.erase(id, userIdSchema.parse(adminId))).toEqual({
        type: 'success',
        data: { type: 'notDue' },
      })
      expect(await storedCustomer(customer.id)).toEqual(before)
    })
  })
})
