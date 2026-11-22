import { randomUUID } from 'node:crypto'
import {
  bookings,
  customerAllergies,
  customerPoints,
  customerPreferences,
  customers,
  customerVersions,
  medicalCharts,
  reviewHelpfulVotes,
  reviews,
  sales,
  treatmentRecords,
  users,
} from '@beauty-salon-backend/database'
import { customerIdSchema, userIdSchema } from '@beauty-salon-backend/domain'
import { CustomerRepository } from '@beauty-salon-backend/infrastructure'
import { asc, desc, eq, inArray } from 'drizzle-orm'
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

const CUSTOMERS = '/api/v1/customers'
const MERGE = `${CUSTOMERS}/merge`

/** A UUID that no customer has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

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

/** A request that satisfies every rule, with a value for every property. */
const customerRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Hanako',
  lastName: 'Yamada',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  email: `customer-${randomUUID()}@example.com`,
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: null,
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: 'Designer',
  membershipTier: 'gold',
  preferences: { preferredServices: ['cut'], notes: null },
  notes: 'Likes to talk about films',
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: 'medium',
  scalpCondition: 'sensitive',
  customerStatus: 'active',
  ...overrides,
})

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('Customer merge API', () => {
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

  const merge = (body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(MERGE), as).send(body)
  const read = (id: string) =>
    request(app).get(`${CUSTOMERS}/${id}`).set('Authorization', asAdmin)
  const restore = (id: string) =>
    request(app)
      .post(`${CUSTOMERS}/${id}/restore`)
      .set('Authorization', asAdmin)

  const merging = (
    primaryCustomerId: string,
    secondaryCustomerId: string,
    conflictResolution = 'keep_primary',
  ) => ({ primaryCustomerId, secondaryCustomerId, conflictResolution })

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

  /** Two customers created through the API: the primary first. */
  const pair = async () => {
    const primary = await created()
    const secondary = await created()
    return { primaryId: primary.id, secondaryId: secondary.id }
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

  /** Which write each version of a customer was, oldest first, with its writer. */
  const writesOf = async (customerId: string): Promise<string[]> =>
    (
      await db
        .select()
        .from(customerVersions)
        .where(eq(customerVersions.customerId, customerId))
        .orderBy(asc(customerVersions.version))
    ).map(
      ({ version, operation, changedBy }) =>
        `${version} ${operation} ${changedBy === adminId ? 'admin' : changedBy}`,
    )

  /** Every row a merge may write, to tell that nothing was written. */
  const everything = async () => ({
    customers: await db.select().from(customers).orderBy(asc(customers.id)),
    versions: await db
      .select()
      .from(customerVersions)
      .orderBy(asc(customerVersions.id)),
    bookings: await db.select().from(bookings).orderBy(asc(bookings.id)),
    points: await db
      .select()
      .from(customerPoints)
      .orderBy(asc(customerPoints.id)),
    preferences: await db
      .select()
      .from(customerPreferences)
      .orderBy(asc(customerPreferences.id)),
    charts: await db
      .select()
      .from(medicalCharts)
      .orderBy(asc(medicalCharts.id)),
    allergies: await db
      .select()
      .from(customerAllergies)
      .orderBy(asc(customerAllergies.id)),
    users: await db.select().from(users).orderBy(asc(users.id)),
  })

  /** A booking of a customer, written directly; returns its ID. */
  const insertBooking = async (
    customerId: string,
    status: 'completed' | 'cancelled' | 'confirmed' = 'completed',
    bookingDate = '2026-11-20',
  ): Promise<string> => {
    const row = nextRow()
    const hour = String(row % 20).padStart(2, '0')
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-MERGE-${row}`,
        salonId,
        customerId,
        staffId: await insertStaff(db, salonId),
        bookingDate,
        startTime: `${bookingDate}T${hour}:00:00Z`,
        endTime: `${bookingDate}T${hour}:30:00Z`,
        duration: 30,
        subtotal: 6600,
        totalAmount: 6600,
        status,
        cancelledAt: status === 'cancelled' ? `${bookingDate}T00:00:00Z` : null,
        completedAt:
          status === 'completed' ? `${bookingDate}T${hour}:30:00Z` : null,
        actualStartTime:
          status === 'completed' ? `${bookingDate}T${hour}:00:00Z` : null,
      })
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    return booking.id
  }

  /** A sale, a treatment record and a review of a completed booking of a customer. */
  const insertVisit = async (
    customerId: string,
    bookingDate = '2026-11-20',
  ) => {
    const bookingId = await insertBooking(customerId, 'completed', bookingDate)
    const [sale] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-MERGE-${nextRow()}`,
        salonId,
        customerId,
        bookingId,
        saleDate: bookingDate,
        saleTime: `${bookingDate}T12:00:00Z`,
        subtotal: 6000,
        taxAmount: 600,
        totalAmount: 6600,
      })
      .returning({ id: sales.id })
    const [record] = await db
      .insert(treatmentRecords)
      .values({ bookingId, customerId, staffId, services: [randomUUID()] })
      .returning({ id: treatmentRecords.id })
    const [review] = await db
      .insert(reviews)
      .values({ salonId, customerId, bookingId, overallRating: 5 })
      .returning({ id: reviews.id })
    if (sale === undefined || record === undefined || review === undefined) {
      throw new Error('No visit was inserted')
    }
    return {
      bookingId,
      saleId: sale.id,
      recordId: record.id,
      reviewId: review.id,
    }
  }

  /** Marks of customers on a review as helpful, with the count the review keeps. */
  const insertMarks = async (reviewId: string, customerIds: string[]) => {
    for (const customerId of customerIds) {
      await db.insert(reviewHelpfulVotes).values({ reviewId, customerId })
    }
    await db
      .update(reviews)
      .set({ helpfulCount: customerIds.length })
      .where(eq(reviews.id, reviewId))
  }

  /**
   * Point transactions of a customer, a month apart from January 2026, each
   * with the balance after it, and the balance on the customer.
   */
  const insertPoints = async (
    customerId: string,
    entries: [
      'earned' | 'used' | 'adjusted' | 'expired',
      number,
      string | null,
    ][],
  ): Promise<void> => {
    let balance = 0
    for (const [
      index,
      [transactionType, points, expiryDate],
    ] of entries.entries()) {
      balance += points
      await db.insert(customerPoints).values({
        customerId,
        transactionType,
        points,
        balance,
        expiryDate,
        createdAt: `2026-${String(index + 1).padStart(2, '0')}-01T00:00:00Z`,
      })
    }
    await db
      .update(customers)
      .set({ loyaltyPoints: balance })
      .where(eq(customers.id, customerId))
  }

  const pointsOf = (customerId: string) =>
    db
      .select()
      .from(customerPoints)
      .where(eq(customerPoints.customerId, customerId))
      .orderBy(asc(customerPoints.createdAt), asc(customerPoints.id))

  /** Links an account to a customer, both ways, as a profile claim does. */
  const linkAccount = async (customerId: string) => {
    const user = await insertUser(db, { customerId })
    await db
      .update(customers)
      .set({ userId: user.id })
      .where(eq(customers.id, customerId))
    return user
  }

  /** A chart of a customer, written directly. */
  const insertChart = async (
    customerId: string,
    values: Partial<typeof medicalCharts.$inferInsert> = {},
  ) => {
    await db.insert(medicalCharts).values({
      customerId,
      previousTreatments: [],
      medicalConditions: null,
      preferredProducts: [],
      avoidProducts: [],
      notes: null,
      ...values,
    })
  }

  const chartOf = async (customerId: string) => {
    const [chart] = await db
      .select()
      .from(medicalCharts)
      .where(eq(medicalCharts.customerId, customerId))
    return chart
  }

  /** Preferences of a customer, written directly. */
  const insertPreferences = async (
    customerId: string,
    values: Partial<typeof customerPreferences.$inferInsert> = {},
  ) => {
    await db.insert(customerPreferences).values({
      customerId,
      preferredTimeSlots: [],
      avoidStaffIds: [],
      ...values,
    })
  }

  const preferencesOf = (customerId: string) =>
    db
      .select()
      .from(customerPreferences)
      .where(eq(customerPreferences.customerId, customerId))

  /** An allergy of a customer, written directly; returns its ID. */
  const insertAllergy = async (
    customerId: string,
    allergenName: string,
    severityType: 'mild' | 'moderate' | 'severe' | 'life_threatening',
    symptoms: string | null = null,
  ): Promise<string> => {
    const [allergy] = await db
      .insert(customerAllergies)
      .values({
        customerId,
        allergyType: 'chemical',
        allergenName,
        severityType,
        symptoms,
      })
      .returning({ id: customerAllergies.id })
    if (allergy === undefined) {
      throw new Error('No allergy was inserted')
    }
    return allergy.id
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
    ): SignInAs =>
    async () => {
      const { email } = await insertMember(db, role, await salonOf())
      return (await signIn(app, email)).authorization
    }

  describe('who may merge', () => {
    const keepers: [string, SignInAs][] = [
      ['an administrator', async () => asAdmin],
      ['the owner of a salon', member('owner')],
      ['a manager of a salon', member('manager')],
      ['a manager of another salon', member('manager', () => insertSalon(db))],
    ]

    it.each(keepers)('lets %s merge two customers', async (_, signInAs) => {
      const { primaryId, secondaryId } = await pair()

      const response = await merge(
        merging(primaryId, secondaryId),
        await signInAs(),
      )

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(primaryId)
    })

    const outsiders: [string, SignInAs][] = [
      ['a staff member of a salon', member('staff')],
      [
        'a customer account with a profile',
        async () =>
          (
            await signedInUser(app, db, {
              customerId: await insertCustomer(db),
            })
          ).authorization,
      ],
      [
        'a customer account without a profile',
        async () => (await signedInUser(app, db)).authorization,
      ],
    ]

    it.each(outsiders)(
      'refuses %s with 403, before the request is read, and changes nothing',
      async (_, signInAs) => {
        const { primaryId, secondaryId } = await pair()
        const as = await signInAs()
        const before = await everything()

        const responses = [
          await merge(merging(primaryId, secondaryId), as),
          await merge({ what: 'ever' }, as),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await everything()).toEqual(before)
      },
    )

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
      'refuses %s with 401, and changes nothing',
      async (_, tokenOf, problem, challenge) => {
        const { primaryId, secondaryId } = await pair()
        const token = await tokenOf()
        const before = await everything()

        const response = await merge(merging(primaryId, secondaryId), token)

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('a request it refuses', () => {
    it('refuses a request that breaks a rule of its own, and changes nothing', async () => {
      const { primaryId, secondaryId } = await pair()
      const before = await everything()
      const broken: [object, string[]][] = [
        [merging(primaryId, primaryId), ['secondaryCustomerId:custom']],
        [
          merging(primaryId, primaryId.toUpperCase()),
          ['secondaryCustomerId:custom'],
        ],
        [merging('first', secondaryId), ['primaryCustomerId:invalid_format']],
        [
          merging(primaryId, secondaryId, 'keep_both'),
          ['conflictResolution:invalid_value'],
        ],
        [
          { primaryCustomerId: primaryId, secondaryCustomerId: secondaryId },
          ['conflictResolution:invalid_value'],
        ],
        [
          { ...merging(primaryId, secondaryId), mergedBy: adminId },
          ['mergedBy:unrecognized_keys'],
        ],
        [[merging(primaryId, secondaryId)], [':invalid_type']],
      ]

      for (const [body, rules] of broken) {
        const response = await merge(body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid customer merge')
        expect(brokenRules(response)).toEqual(rules)
      }
      expect(await everything()).toEqual(before)
    })

    it('tells each customer that is not there, or is deleted, at the field that names it, and changes nothing', async () => {
      const { primaryId, secondaryId } = await pair()
      const deleted = await created()
      expect(
        (
          await request(app)
            .delete(`${CUSTOMERS}/${deleted.id}`)
            .set('Authorization', asAdmin)
        ).status,
      ).toBe(204)
      const before = await everything()
      const cases: [object, string[]][] = [
        [merging(UNKNOWN_ID, secondaryId), ['primaryCustomerId:not_found']],
        [merging(primaryId, deleted.id), ['secondaryCustomerId:not_found']],
        [
          merging(deleted.id, UNKNOWN_ID),
          ['primaryCustomerId:not_found', 'secondaryCustomerId:not_found'],
        ],
      ]

      for (const [body, rules] of cases) {
        const response = await merge(body)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(rules)
      }
      expect(await everything()).toEqual(before)
    })

    it('refuses two customers who are the profiles of two accounts with 409, and changes nothing', async () => {
      const { primaryId, secondaryId } = await pair()
      await linkAccount(primaryId)
      await linkAccount(secondaryId)
      const before = await everything()

      const response = await merge(merging(primaryId, secondaryId))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toContain('accounts')
      expect(await everything()).toEqual(before)
    })

    it('refuses points of both beyond what a balance can hold with 409, and takes as many as it can hold', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertPoints(primaryId, [['adjusted', 2_147_483_640, null]])
      await insertPoints(secondaryId, [['earned', 8, null]])
      const before = await everything()

      const beyond = await merge(merging(primaryId, secondaryId))

      expectProblem(beyond, notAllowed)
      expect(beyond.body.detail).toContain('points')
      expect(await everything()).toEqual(before)

      await db.insert(customerPoints).values({
        customerId: secondaryId,
        transactionType: 'used',
        points: -1,
        balance: 7,
      })
      await db
        .update(customers)
        .set({ loyaltyPoints: 7 })
        .where(eq(customers.id, secondaryId))

      const largest = await merge(merging(primaryId, secondaryId))

      expect(largest.status).toBe(200)
      expect(largest.body.data.loyaltyPoints).toBe(2_147_483_647)
    })

    it('refuses two charts that together list more than a chart can with 409, and changes nothing', async () => {
      const { primaryId, secondaryId } = await pair()
      const products = (prefix: string, count: number) =>
        Array.from({ length: count }, (_, index) => `${prefix}${index}`)
      await insertChart(primaryId, { preferredProducts: products('a', 26) })
      await insertChart(secondaryId, { preferredProducts: products('b', 25) })
      const before = await everything()

      const response = await merge(merging(primaryId, secondaryId))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toContain('preferredProducts')
      expect(await everything()).toEqual(before)
    })
  })

  describe('the ledger', () => {
    /** The primary and the secondary, of values that differ, that only one has, and that both have. */
    const twoRegistrations = async (
      firstCreated: 'primary' | 'secondary' = 'primary',
    ) => {
      const primaryValues = {
        email: `primary-${randomUUID()}@example.com`,
        phoneNumber: '090-1111-1111',
        alternativePhone: null,
        occupation: 'Designer',
        tags: [],
        notes: 'Likes to talk about films',
        referralCode: `P-${randomUUID()}`,
        membershipTier: 'gold',
      }
      const secondaryValues = {
        email: `secondary-${randomUUID()}@example.com`,
        phoneNumber: '090-2222-2222',
        alternativePhone: '03-2222-2222',
        occupation: null,
        tags: ['regular'],
        notes: 'Likes to talk about films',
        referralCode: `S-${randomUUID()}`,
        membershipTier: 'silver',
      }
      if (firstCreated === 'primary') {
        const primary = await created(primaryValues)
        const secondary = await created(secondaryValues)
        return { primary, secondary, primaryValues, secondaryValues }
      }
      const secondary = await created(secondaryValues)
      const primary = await created(primaryValues)
      return { primary, secondary, primaryValues, secondaryValues }
    }

    it('answers with the primary as the merge leaves it: a value both have, the value of the one that has one, and the primary’s where they differ', async () => {
      const { primary, secondary, primaryValues, secondaryValues } =
        await twoRegistrations()

      const response = await merge(merging(primary.id, secondary.id))

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          ...primary,
          ...primaryValues,
          alternativePhone: secondaryValues.alternativePhone,
          tags: secondaryValues.tags,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
        links: {
          self: `${CUSTOMERS}/${primary.id}`,
          list: CUSTOMERS,
        },
      })
      expect((await read(primary.id)).body.data).toEqual(response.body.data)
      expectProblem(await read(secondary.id), notFound)
      expect((await storedCustomer(secondary.id)).deletedAt).not.toBeNull()
      expect((await storedCustomer(secondary.id)).referralCode).toBe(
        secondaryValues.referralCode,
      )
    })

    it('takes the values of the secondary where they differ, and its email and referral code, which the deleted secondary gives up', async () => {
      const { primary, secondary, secondaryValues } = await twoRegistrations()

      const response = await merge(
        merging(primary.id, secondary.id, 'keep_secondary'),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        ...secondaryValues,
        occupation: 'Designer',
      })
      expect((await storedCustomer(secondary.id)).referralCode).toBeNull()
      const again = await request(app)
        .post(CUSTOMERS)
        .set('Authorization', asAdmin)
        .send(customerRequest({ email: secondaryValues.email }))
      expect(statusAndCode(again)).toBe('409 3002')
    })

    it.each<['primary' | 'secondary', 'primary' | 'secondary']>([
      ['primary', 'secondary'],
      ['secondary', 'primary'],
    ])(
      'takes the values of the newer with keep_newest: the %s created first, the %s newer',
      async (first, newer) => {
        const { primary, secondary, primaryValues, secondaryValues } =
          await twoRegistrations(first)

        const response = await merge(
          merging(primary.id, secondary.id, 'keep_newest'),
        )

        expect(response.body.data.phoneNumber).toBe(
          newer === 'primary'
            ? primaryValues.phoneNumber
            : secondaryValues.phoneNumber,
        )
      },
    )

    it('takes the primary’s values with keep_newest when both were written at the same moment', async () => {
      const { primary, secondary, primaryValues } = await twoRegistrations()
      await db
        .update(customers)
        .set({ updatedAt: '2026-11-18T00:00:00Z' })
        .where(inArray(customers.id, [primary.id, secondary.id]))

      const response = await merge(
        merging(primary.id, secondary.id, 'keep_newest'),
      )

      expect(response.body.data.phoneNumber).toBe(primaryValues.phoneNumber)
    })

    it('refers the customers the secondary referred to the primary, keeps a deleted one as it was, and takes a referrer that is one of the two for none', async () => {
      const primary = await created()
      const secondary = await created({ referredBy: primary.id })
      await db
        .update(customers)
        .set({ referredBy: secondary.id })
        .where(eq(customers.id, primary.id))
      const referred = await created({ referredBy: secondary.id })
      const gone = await created({ referredBy: secondary.id })
      await request(app)
        .delete(`${CUSTOMERS}/${gone.id}`)
        .set('Authorization', asAdmin)

      const response = await merge(merging(primary.id, secondary.id))

      expect(response.body.data.referredBy).toBeNull()
      expect((await read(referred.id)).body.data.referredBy).toBe(primary.id)
      expect((await storedCustomer(gone.id)).referredBy).toBe(secondary.id)
      expect(await writesOf(referred.id)).toEqual([
        '1 create admin',
        '2 merge admin',
      ])
      expect(await writesOf(gone.id)).toEqual([
        '1 create admin',
        '2 delete admin',
      ])
    })

    it('keeps a version of the merge for both: the primary’s with what changed, the secondary’s as it was deleted', async () => {
      const { primary, secondary, secondaryValues } = await twoRegistrations()

      await merge(merging(primary.id, secondary.id))

      expect(await writesOf(primary.id)).toEqual([
        '1 create admin',
        '2 merge admin',
      ])
      expect(await writesOf(secondary.id)).toEqual([
        '1 create admin',
        '2 merge admin',
      ])
      const history = await request(app)
        .get(`${CUSTOMERS}/${primary.id}/history`)
        .set('Authorization', asAdmin)
      expect(history.body.data[0]).toMatchObject({
        version: 2,
        operation: 'merge',
        changedBy: adminId,
        changes: [
          {
            field: 'alternativePhone',
            oldValue: null,
            newValue: secondaryValues.alternativePhone,
          },
          { field: 'tags', oldValue: [], newValue: secondaryValues.tags },
        ],
      })
    })

    it('refuses to restore the secondary with 409: the primary has what it had', async () => {
      const { primaryId, secondaryId } = await pair()
      await merge(merging(primaryId, secondaryId))
      const before = await everything()

      const response = await restore(secondaryId)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toContain('merged')
      expect(await everything()).toEqual(before)
    })
  })

  describe('what names the secondary', () => {
    it('gives the primary the bookings, sales, treatment records and reviews of the secondary, and counts the visits of both again', async () => {
      const { primaryId, secondaryId } = await pair()
      const ofThePrimary = await insertVisit(primaryId, '2026-11-20')
      const ofTheSecondary = await insertVisit(secondaryId, '2026-10-01')
      const cancelled = await insertBooking(
        secondaryId,
        'cancelled',
        '2026-09-01',
      )
      await db
        .update(customers)
        .set({
          visitCount: 1,
          firstVisitDate: '2026-10-01',
          lastVisitDate: '2026-10-01',
        })
        .where(eq(customers.id, secondaryId))

      const response = await merge(merging(primaryId, secondaryId))

      expect(response.body.data).toMatchObject({
        visitCount: 2,
        cancellationCount: 1,
        noShowCount: 0,
        firstVisitDate: '2026-10-01',
        lastVisitDate: '2026-11-20',
      })
      const owners = async () => ({
        bookings: (
          await db
            .select({ customerId: bookings.customerId })
            .from(bookings)
            .where(
              inArray(bookings.id, [
                ofThePrimary.bookingId,
                ofTheSecondary.bookingId,
                cancelled,
              ]),
            )
        ).map(({ customerId }) => customerId),
        sales: (
          await db
            .select({ customerId: sales.customerId })
            .from(sales)
            .where(
              inArray(sales.id, [ofThePrimary.saleId, ofTheSecondary.saleId]),
            )
        ).map(({ customerId }) => customerId),
        records: (
          await db
            .select({ customerId: treatmentRecords.customerId })
            .from(treatmentRecords)
            .where(
              inArray(treatmentRecords.id, [
                ofThePrimary.recordId,
                ofTheSecondary.recordId,
              ]),
            )
        ).map(({ customerId }) => customerId),
        reviews: (
          await db
            .select({ customerId: reviews.customerId })
            .from(reviews)
            .where(
              inArray(reviews.id, [
                ofThePrimary.reviewId,
                ofTheSecondary.reviewId,
              ]),
            )
        ).map(({ customerId }) => customerId),
      })
      expect(await owners()).toEqual({
        bookings: [primaryId, primaryId, primaryId],
        sales: [primaryId, primaryId],
        records: [primaryId, primaryId],
        reviews: [primaryId, primaryId],
      })
      expect(await storedCustomer(secondaryId)).toMatchObject({
        visitCount: 0,
        cancellationCount: 0,
        firstVisitDate: null,
        lastVisitDate: null,
      })
    })

    it('keeps one mark of the primary on a review, and none on a review that becomes the primary’s own', async () => {
      const { primaryId, secondaryId } = await pair()
      const third = await insertCustomer(db)
      const ownReview = (await insertVisit(primaryId)).reviewId
      const reviewOfTheSecondary = (await insertVisit(secondaryId)).reviewId
      const markedByBoth = (await insertVisit(third)).reviewId
      const markedBySecondary = (await insertVisit(third)).reviewId
      await insertMarks(ownReview, [secondaryId, third])
      await insertMarks(reviewOfTheSecondary, [primaryId])
      await insertMarks(markedByBoth, [primaryId, secondaryId])
      await insertMarks(markedBySecondary, [secondaryId])

      await merge(merging(primaryId, secondaryId))

      const marks = await db
        .select({
          reviewId: reviewHelpfulVotes.reviewId,
          customerId: reviewHelpfulVotes.customerId,
        })
        .from(reviewHelpfulVotes)
      const markersOf = (reviewId: string) =>
        marks
          .filter((mark) => mark.reviewId === reviewId)
          .map(({ customerId }) => customerId)
      expect(markersOf(ownReview)).toEqual([third])
      expect(markersOf(reviewOfTheSecondary)).toEqual([])
      expect(markersOf(markedByBoth)).toEqual([primaryId])
      expect(markersOf(markedBySecondary)).toEqual([primaryId])
      const counts = await db
        .select({ id: reviews.id, helpfulCount: reviews.helpfulCount })
        .from(reviews)
      const countOf = (id: string) =>
        counts.find((review) => review.id === id)?.helpfulCount
      expect(
        [ownReview, reviewOfTheSecondary, markedByBoth, markedBySecondary].map(
          countOf,
        ),
      ).toEqual([1, 0, 1, 1])
    })

    it('gives the primary the account of the secondary, which then signs in to the primary', async () => {
      const { primaryId, secondaryId } = await pair()
      const account = await linkAccount(secondaryId)

      const response = await merge(merging(primaryId, secondaryId))

      expect(response.status).toBe(200)
      expect((await storedCustomer(primaryId)).userId).toBe(account.id)
      expect((await storedCustomer(secondaryId)).userId).toBe(account.id)
      const [user] = await db
        .select({ customerId: users.customerId })
        .from(users)
        .where(eq(users.id, account.id))
      expect(user?.customerId).toBe(primaryId)
      const { authorization } = await signIn(app, account.email)
      const profile = await request(app)
        .get(`${CUSTOMERS}/me`)
        .set('Authorization', authorization)
      expect(profile.body.data.id).toBe(primaryId)
    })

    it('keeps the account of the primary, when the secondary has none', async () => {
      const { primaryId, secondaryId } = await pair()
      const account = await linkAccount(primaryId)

      await merge(merging(primaryId, secondaryId))

      expect((await storedCustomer(primaryId)).userId).toBe(account.id)
      expect((await storedCustomer(secondaryId)).userId).toBeNull()
    })
  })

  describe('the points', () => {
    it('transfers what is left of each increase of the secondary with its expiry date, and leaves the secondary none', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertPoints(primaryId, [['earned', 100, null]])
      await insertPoints(secondaryId, [
        ['earned', 100, '2027-03-31'],
        ['adjusted', 50, null],
        ['used', -40, null],
        ['earned', 20, '2027-01-31'],
      ])

      const response = await merge(merging(primaryId, secondaryId))

      expect(response.body.data.loyaltyPoints).toBe(230)
      expect((await storedCustomer(secondaryId)).loyaltyPoints).toBe(0)
      const transfer = {
        transactionType: 'transferred',
        description: null,
        referenceType: 'customer',
      }
      expect((await pointsOf(secondaryId)).at(-1)).toMatchObject({
        ...transfer,
        points: -130,
        balance: 0,
        referenceId: primaryId,
        expiryDate: null,
      })
      expect((await pointsOf(primaryId)).slice(1)).toEqual([
        expect.objectContaining({
          ...transfer,
          points: 60,
          balance: 160,
          referenceId: secondaryId,
          expiryDate: '2027-03-31',
        }),
        expect.objectContaining({
          ...transfer,
          points: 50,
          balance: 210,
          referenceId: secondaryId,
          expiryDate: null,
        }),
        expect.objectContaining({
          ...transfer,
          points: 20,
          balance: 230,
          referenceId: secondaryId,
          expiryDate: '2027-01-31',
        }),
      ])
      const listed = await request(app)
        .get(`/api/v1/points/customer/${primaryId}/transactions`)
        .set('Authorization', asAdmin)
      expect(listed.status).toBe(200)
      expect(listed.body.data[0]).toMatchObject({
        transactionType: 'transferred',
        points: 20,
        referenceType: 'customer',
        referenceId: secondaryId,
        expiryDate: '2027-01-31',
      })
    })

    it('writes the transfers one moment after the other, so that the last one has the balance of the primary', async () => {
      const { primaryId, secondaryId } = await pair()
      const lots = 40
      for (let index = 0; index < lots; index += 1) {
        await db.insert(customerPoints).values({
          customerId: secondaryId,
          transactionType: 'earned',
          points: 1,
          balance: index + 1,
          expiryDate: null,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
        })
      }
      await db
        .update(customers)
        .set({ loyaltyPoints: lots })
        .where(eq(customers.id, secondaryId))

      const response = await merge(merging(primaryId, secondaryId))

      expect(response.body.data.loyaltyPoints).toBe(lots)
      const transfers = await pointsOf(primaryId)
      expect(transfers.map(({ balance }) => balance)).toEqual(
        Array.from({ length: lots }, (_, index) => index + 1),
      )
      expect(new Set(transfers.map(({ createdAt }) => createdAt)).size).toBe(
        lots,
      )
    })

    it('tells a transferred lot as expiring on the expiry date it had', async () => {
      const { primaryId, secondaryId } = await pair()
      const inAMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
      await insertPoints(primaryId, [['earned', 100, null]])
      await insertPoints(secondaryId, [['earned', 30, inAMonth]])
      await merge(merging(primaryId, secondaryId))

      const expiring = await request(app)
        .get(`/api/v1/points/customer/${primaryId}/expiring`)
        .query({ days: '60' })
        .set('Authorization', asAdmin)

      expect(expiring.status).toBe(200)
      expect(expiring.body.data).toMatchObject({
        expiringPoints: 30,
        expirationDate: inAMonth,
      })
    })

    it('expires a transferred lot that has lapsed in a run for every customer, as the earning it was left of', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertPoints(primaryId, [['earned', 100, null]])
      await insertPoints(secondaryId, [['earned', 30, '2026-01-31']])
      await merge(merging(primaryId, secondaryId))

      const response = await request(app)
        .post('/api/v1/points/expire')
        .set('Authorization', asAdmin)
        .send({ customerId: null, processBefore: null })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ processedCount: 1, totalPoints: 30 })
      expect((await storedCustomer(primaryId)).loyaltyPoints).toBe(100)
      expect((await pointsOf(primaryId)).at(-1)).toMatchObject({
        transactionType: 'expired',
        points: -30,
        balance: 100,
      })
    })

    it('writes no transfer for a secondary without points', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertPoints(primaryId, [['earned', 100, null]])
      await insertPoints(secondaryId, [
        ['earned', 50, null],
        ['used', -50, null],
      ])

      await merge(merging(primaryId, secondaryId))

      expect(await pointsOf(primaryId)).toHaveLength(1)
      expect(await pointsOf(secondaryId)).toHaveLength(2)
      expect((await storedCustomer(primaryId)).loyaltyPoints).toBe(100)
    })
  })

  describe('the preferences, the chart and the allergies', () => {
    it('moves the preferences of the secondary when the primary has none', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertPreferences(secondaryId, { specialRequests: '静かに' })

      await merge(merging(primaryId, secondaryId))

      expect(await preferencesOf(primaryId)).toEqual([
        expect.objectContaining({ specialRequests: '静かに' }),
      ])
      expect(await preferencesOf(secondaryId)).toEqual([])
    })

    it.each<[string, string, 'primary' | 'secondary']>([
      ['keep_primary', 'the primary', 'primary'],
      ['keep_secondary', 'the secondary', 'secondary'],
      ['keep_newest', 'the newer', 'secondary'],
    ])(
      'keeps the whole row of preferences of the side %s takes: %s',
      async (conflictResolution, _, side) => {
        const { primaryId, secondaryId } = await pair()
        await insertPreferences(primaryId, {
          communicationStyle: 'quiet',
          specialRequests: '窓際の席',
          updatedAt: '2026-11-01T00:00:00Z',
        })
        await insertPreferences(secondaryId, {
          communicationStyle: null,
          specialRequests: '静かに',
          updatedAt: '2026-11-02T00:00:00Z',
        })

        await merge(merging(primaryId, secondaryId, conflictResolution))

        expect(await preferencesOf(primaryId)).toEqual([
          expect.objectContaining(
            side === 'primary'
              ? { communicationStyle: 'quiet', specialRequests: '窓際の席' }
              : { communicationStyle: null, specialRequests: '静かに' },
          ),
        ])
      },
    )

    it('moves the chart of the secondary when the primary has none', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertChart(secondaryId, { notes: 'ぬるめのお湯' })

      await merge(merging(primaryId, secondaryId))

      expect(await chartOf(primaryId)).toMatchObject({ notes: 'ぬるめのお湯' })
      expect(await chartOf(secondaryId)).toBeUndefined()
    })

    it('puts two charts together, dropping nothing of either', async () => {
      const { primaryId, secondaryId } = await pair()
      const treatment = (date: string) => ({
        treatment: 'color',
        date,
        salonName: null,
        notes: null,
      })
      await insertChart(primaryId, {
        previousTreatments: [treatment('2026-03-14')],
        medicalConditions: '頭皮が乾燥しやすい',
        preferredProducts: ['Aveda'],
        notes: 'ぬるめのお湯',
      })
      await insertChart(secondaryId, {
        previousTreatments: [treatment('2026-03-14'), treatment('2025-01-10')],
        medicalConditions: '金属アレルギーの疑い',
        preferredProducts: ['Aveda', 'Kerastase'],
        avoidProducts: ['強い香料'],
        notes: 'ぬるめのお湯',
      })

      await merge(merging(primaryId, secondaryId, 'keep_secondary'))

      expect(await chartOf(primaryId)).toMatchObject({
        previousTreatments: [treatment('2026-03-14'), treatment('2025-01-10')],
        medicalConditions: '頭皮が乾燥しやすい\n\n金属アレルギーの疑い',
        preferredProducts: ['Aveda', 'Kerastase'],
        avoidProducts: ['強い香料'],
        notes: 'ぬるめのお湯',
      })
      const read = await request(app)
        .get(`/api/v1/medical-charts/customer/${primaryId}`)
        .set('Authorization', asAdmin)
      expect(read.status).toBe(200)
    })

    it('moves the allergies only the secondary has, and keeps the severer record of one both have', async () => {
      const { primaryId, secondaryId } = await pair()
      const ppd = await insertAllergy(primaryId, 'PPD', 'moderate', 'かゆみ')
      const latex = await insertAllergy(primaryId, 'ラテックス', 'severe')
      await insertAllergy(secondaryId, 'PPD', 'life_threatening', '呼吸困難')
      await insertAllergy(secondaryId, 'ラテックス', 'mild')
      const nickel = await insertAllergy(secondaryId, 'ニッケル', 'mild')

      await merge(merging(primaryId, secondaryId))

      const allergies = await db
        .select()
        .from(customerAllergies)
        .where(eq(customerAllergies.customerId, primaryId))
      expect(
        allergies
          .map(({ id, allergenName, severityType, symptoms }) => ({
            id,
            allergenName,
            severityType,
            symptoms,
          }))
          .toSorted((a, b) => (a.allergenName < b.allergenName ? -1 : 1)),
      ).toEqual(
        [
          {
            id: ppd,
            allergenName: 'PPD',
            severityType: 'life_threatening',
            symptoms: '呼吸困難',
          },
          {
            id: latex,
            allergenName: 'ラテックス',
            severityType: 'severe',
            symptoms: null,
          },
          {
            id: nickel,
            allergenName: 'ニッケル',
            severityType: 'mild',
            symptoms: null,
          },
        ].toSorted((a, b) => (a.allergenName < b.allergenName ? -1 : 1)),
      )
    })
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

    it('merges once of two same merges that arrive together, and refuses the other', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertPoints(secondaryId, [['earned', 30, null]])

      const responses = await Promise.all([
        merge(merging(primaryId, secondaryId)),
        merge(merging(primaryId, secondaryId)),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '400 2001',
      ])
      expect((await storedCustomer(primaryId)).loyaltyPoints).toBe(30)
      expect(await pointsOf(primaryId)).toHaveLength(1)
    })

    it('merges one way of two merges of the same two in opposite ways, without a deadlock', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertVisit(primaryId)
      await insertVisit(secondaryId)

      const responses = await Promise.all([
        merge(merging(primaryId, secondaryId)),
        merge(merging(secondaryId, primaryId)),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '400 2001',
      ])
      const kept = responses.find(({ status }) => status === 200)?.body.data
      expect(kept.visitCount).toBe(2)
    })

    it('waits for a change of a booking of the secondary that is under way, which then writes the customer, without a deadlock, and then gives the booking to the primary', async () => {
      const { primaryId, secondaryId } = await pair()
      const bookingId = await insertBooking(secondaryId, 'confirmed')
      const client = getTestDbClient()
      const held = Promise.withResolvers<void>()
      const mayGoOn = Promise.withResolvers<void>()
      // As a change of the status of a booking does: the booking first, and
      // then its customer, whose visits it counts again.
      const holder = client.begin(async (tx) => {
        await tx`SELECT id FROM bookings WHERE id = ${bookingId} FOR UPDATE`
        await tx`UPDATE bookings SET "internalNotes" = 'changed' WHERE id = ${bookingId}`
        held.resolve()
        await mayGoOn.promise
        await tx`UPDATE customers SET "updatedAt" = clock_timestamp() WHERE id = ${secondaryId}`
      })
      await held.promise

      const pending = merge(merging(primaryId, secondaryId)).then(
        (response) => response,
      )
      await untilWaiting(client)
      mayGoOn.resolve()
      await holder

      expect((await pending).status).toBe(200)
      const [booking] = await db
        .select({
          customerId: bookings.customerId,
          internalNotes: bookings.internalNotes,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
      expect(booking).toEqual({
        customerId: primaryId,
        internalNotes: 'changed',
      })
    })

    it('makes a change of the chart or of an allergy of the primary that arrives during the merge wait for it, and writes it over what the merge left', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertChart(primaryId, { notes: 'ぬるめのお湯' })
      await insertChart(secondaryId, {
        medicalConditions: '金属アレルギーの疑い',
      })
      const ppd = await insertAllergy(primaryId, 'PPD', 'moderate', 'かゆみ')
      await insertAllergy(secondaryId, 'PPD', 'life_threatening', '呼吸困難')
      const account = await linkAccount(secondaryId)
      const chartId = (await chartOf(primaryId))?.id
      const client = getTestDbClient()
      const held = Promise.withResolvers<void>()
      const mayCommit = Promise.withResolvers<void>()
      // The merge gives the account of the secondary to the primary: holding
      // the account stops it after it has read the charts and the
      // allergies, and before it writes them.
      const holder = client.begin(async (tx) => {
        await tx`SELECT id FROM users WHERE id = ${account.id} FOR UPDATE`
        held.resolve()
        await mayCommit.promise
      })
      await held.promise

      const pending = merge(merging(primaryId, secondaryId)).then(
        (response) => response,
      )
      await untilWaiting(client)
      const changes = Promise.all([
        request(app)
          .patch(`/api/v1/medical-charts/${chartId}`)
          .set('Authorization', asAdmin)
          .send({ notes: '熱めのお湯' })
          .then((response) => response),
        request(app)
          .patch(
            `/api/v1/medical-charts/customer/${primaryId}/allergies/${ppd}`,
          )
          .set('Authorization', asAdmin)
          .send({ symptoms: '腫れ' })
          .then((response) => response),
      ])
      await untilWaiting(client, 3)
      mayCommit.resolve()
      await holder

      expect((await pending).status).toBe(200)
      expect((await changes).map(({ status }) => status)).toEqual([200, 200])
      expect(await chartOf(primaryId)).toMatchObject({
        medicalConditions: '金属アレルギーの疑い',
        notes: '熱めのお湯',
      })
      const [allergy] = await db
        .select()
        .from(customerAllergies)
        .where(eq(customerAllergies.id, ppd))
      expect(allergy).toMatchObject({
        severityType: 'life_threatening',
        symptoms: '腫れ',
      })
    })

    it('keeps the points of both whole when points are earned by the secondary as it is merged', async () => {
      const { primaryId, secondaryId } = await pair()
      await insertPoints(secondaryId, [['earned', 30, null]])

      const [earned, merged] = await Promise.all([
        request(app)
          .post('/api/v1/points/earn')
          .set('Authorization', asAdmin)
          .send({
            customerId: secondaryId,
            points: 20,
            description: null,
            referenceType: null,
            referenceId: null,
            expiryDate: null,
          }),
        merge(merging(primaryId, secondaryId)),
      ])

      expect(merged.status).toBe(200)
      const both = [
        await storedCustomer(primaryId),
        await storedCustomer(secondaryId),
      ]
      const lastBalances = [
        (await pointsOf(primaryId)).at(-1)?.balance ?? 0,
        (await pointsOf(secondaryId)).at(-1)?.balance ?? 0,
      ]
      expect(both.map(({ loyaltyPoints }) => loyaltyPoints)).toEqual(
        lastBalances,
      )
      expect(lastBalances).toEqual([earned.status === 200 ? 50 : 30, 0])
    })
  })

  it('tells the database could not be reached', async () => {
    const connection = connectUnreachableDatabase()
    const ledger = new CustomerRepository(connection.database)

    const result = await ledger.merge(
      {
        primaryCustomerId: customerIdSchema.parse(UNKNOWN_ID),
        secondaryCustomerId: customerIdSchema.parse(randomUUID()),
        conflictResolution: 'keep_primary',
      },
      userIdSchema.parse(UNKNOWN_ID),
    )
    await connection.close()

    expect(
      result.type === 'error' && result.error.type === 'database'
        ? result.error.message
        : 'not an error',
    ).toBe('Failed to merge customers')
  })

  it('writes the time of the merge after the locks it waited for', async () => {
    const { primaryId, secondaryId } = await pair()
    const client = getTestDbClient()
    const held = Promise.withResolvers<void>()
    const mayCommit = Promise.withResolvers<void>()
    const holder = client.begin(async (tx) => {
      await tx`SELECT id FROM customers WHERE id = ${secondaryId} FOR UPDATE`
      held.resolve()
      await mayCommit.promise
    })
    await held.promise

    const pending = merge(merging(primaryId, secondaryId)).then(
      (response) => response,
    )
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [activity] = await client<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `
      if ((activity?.waiting ?? 0) > 0) {
        break
      }
      await pause(10)
    }
    const [moment] = await client<{ ms: number }[]>`
      SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms
    `
    mayCommit.resolve()
    await holder
    const response = await pending

    expect(response.status).toBe(200)
    const letGoAt = Math.floor(moment?.ms ?? 0)
    expect(
      new Date(response.body.data.updatedAt).getTime(),
    ).toBeGreaterThanOrEqual(letGoAt)
    const [version] = await db
      .select({ changedAt: customerVersions.changedAt })
      .from(customerVersions)
      .where(eq(customerVersions.customerId, primaryId))
      .orderBy(desc(customerVersions.version))
      .limit(1)
    expect(new Date(version?.changedAt ?? 0).getTime()).toBeGreaterThanOrEqual(
      letGoAt,
    )
  })
})
