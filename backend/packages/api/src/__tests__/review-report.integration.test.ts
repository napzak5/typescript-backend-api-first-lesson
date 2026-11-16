import { randomUUID } from 'node:crypto'
import {
  bookings,
  customers,
  reviewHelpfulVotes,
  reviewReports,
  reviews,
  salons,
  type staff,
} from '@beauty-salon-backend/database'
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
} from './_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  request,
} from './_shared/test-helpers'

const REVIEWS = '/api/v1/reviews'
const REPORTS = '/api/v1/review-reports'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
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

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

/** The answer as the order tests compare it: the broken rules of a 400. */
const outcomeOf = (response: Response): string =>
  response.status === 400 && response.body.code === '2001'
    ? `400 ${brokenRules(response).join(' ')}`
    : statusAndCode(response)

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** Whether a request was answered within so many milliseconds. */
const answersWithin = (
  call: Promise<unknown>,
  milliseconds: number,
): Promise<boolean> =>
  Promise.race([call.then(() => true), pause(milliseconds).then(() => false)])

/** A time of 20 November 2026 in UTC, `HH:MM`. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

/** A report for a reason of the list, with what it is about. */
const REPORT = {
  reason: 'false_information',
  details: '担当したスタッフの名前が違います。',
}

const meta = {
  correlationId: expect.any(String),
  timestamp: expect.stringMatching(ISO_TIMESTAMP),
  version: expect.any(String),
}

describe('Review report API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The signed-in admin: their user ID and Authorization header. */
  let admin: { id: string; authorization: string }
  /** The salon of most tests. */
  let salonId: string
  /** The customer who wrote the reviews of most tests. */
  let authorId: string
  /** The Authorization header of the author. */
  let asAuthor: string
  /** The customer who reports the reviews in most tests. */
  let customer: { id: string; userId: string; authorization: string }
  /** The staff member in charge of the bookings of the tests. */
  let staffId: string

  type NewReview = typeof reviews.$inferInsert
  type NewReport = typeof reviewReports.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /**
   * A review written directly, of a completed booking of its own: four
   * stars at the salon of the tests by the author, written an hour ago,
   * unless said otherwise. Returns its ID.
   */
  const insertReview = async (
    overrides: Partial<NewReview> = {},
  ): Promise<string> => {
    const of = overrides.salonId ?? salonId
    const by = overrides.customerId ?? authorId
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-TEST-${nextRow()}`,
        salonId: of,
        customerId: by,
        staffId,
        bookingDate: '2026-11-20',
        startTime: at('01:00'),
        endTime: at('02:00'),
        duration: 60,
        subtotal: 6600,
        totalAmount: 6600,
        status: 'completed',
        actualStartTime: at('01:00'),
        completedAt: at('02:00'),
      })
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const [review] = await db
      .insert(reviews)
      .values({
        salonId: of,
        customerId: by,
        bookingId: booking.id,
        staffId,
        overallRating: 2,
        isVerified: true,
        createdAt: hourAgo,
        updatedAt: hourAgo,
        ...overrides,
      })
      .returning({ id: reviews.id })
    if (review === undefined) {
      throw new Error('No review was inserted')
    }
    return review.id
  }

  /**
   * A report written directly: pending, for spam, by an account of its
   * own, unless said otherwise. Returns its ID.
   */
  const insertReport = async (
    reviewId: string,
    overrides: Partial<NewReport> = {},
  ): Promise<string> => {
    const [report] = await db
      .insert(reviewReports)
      .values({
        reviewId,
        reportedBy: randomUUID(),
        reason: 'spam',
        ...overrides,
      })
      .returning({ id: reviewReports.id })
    if (report === undefined) {
      throw new Error('No report was inserted')
    }
    return report.id
  }

  /** What a dismissed report says of who dismissed it and when. */
  const DISMISSED: Partial<NewReport> = {
    status: 'dismissed',
    resolvedBy: UNKNOWN_ID,
    resolvedAt: '2026-11-17T03:00:00.000Z',
  }

  /**
   * A review as it is stored: its report count, the moment it was last
   * changed, and the transaction that last wrote its row. Undefined when it
   * is gone.
   */
  const storedReview = async (id: string) => {
    const [row] = await getTestDbClient()<
      { reportCount: number; updatedAt: number; writtenBy: string }[]
    >`
      SELECT "reportCount",
             (extract(epoch from "updatedAt") * 1000)::float8 AS "updatedAt",
             xmin::text AS "writtenBy"
      FROM reviews
      WHERE id = ${id}
    `
    return row
  }

  /** The reports of a review, oldest first, with their times as epoch milliseconds. */
  const reportsOf = (reviewId: string) =>
    db
      .select({
        id: reviewReports.id,
        reportedBy: reviewReports.reportedBy,
        reason: reviewReports.reason,
        details: reviewReports.details,
        status: reviewReports.status,
        resolvedBy: reviewReports.resolvedBy,
        resolvedAt: epochMs(reviewReports.resolvedAt),
        createdAt: epochMs(reviewReports.createdAt),
        updatedAt: epochMs(reviewReports.updatedAt),
      })
      .from(reviewReports)
      .where(eq(reviewReports.reviewId, reviewId))
      .orderBy(asc(reviewReports.createdAt), asc(reviewReports.id))

  /** A report as it is stored. */
  const storedReport = async (id: string) => {
    const [row] = await db
      .select({
        status: reviewReports.status,
        resolvedBy: reviewReports.resolvedBy,
        resolvedAt: epochMs(reviewReports.resolvedAt),
        updatedAt: epochMs(reviewReports.updatedAt),
      })
      .from(reviewReports)
      .where(eq(reviewReports.id, id))
    return row
  }

  /** What a salon was last written by, which a report leaves as it is. */
  const storedSalon = async (of: string = salonId) => {
    const [row] = await db
      .select({
        rating: salons.rating,
        reviewCount: salons.reviewCount,
        updatedAt: epochMs(salons.updatedAt),
      })
      .from(salons)
      .where(eq(salons.id, of))
    return row
  }

  const DELETED = { deletedAt: '2026-11-01T00:00:00.000Z' }

  const deleteSalon = (id: string) =>
    db.update(salons).set(DELETED).where(eq(salons.id, id))
  const deleteCustomer = (id: string) =>
    db.update(customers).set(DELETED).where(eq(customers.id, id))

  /** The moment of the clock a report is written by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  /** A customer of their own, signed in. */
  const signedInCustomer = async (): Promise<{
    id: string
    userId: string
    authorization: string
  }> => {
    const id = await insertCustomer(db)
    const user = await signedInUser(app, db, { customerId: id })
    return { id, userId: user.id, authorization: user.authorization }
  }

  /** A member of a salon, signed in: their user ID and Authorization header. */
  const signedInMember = async (
    role: 'owner' | 'manager' | 'staff',
    of: string = salonId,
    staffOverrides: Partial<NewStaff> = {},
  ): Promise<{ id: string; authorization: string }> => {
    const { id, email } = await insertMember(db, role, of, staffOverrides)
    return { id, authorization: (await signIn(app, email)).authorization }
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    const signedInAdmin = await signedInUser(app, db, { role: 'admin' })
    admin = { id: signedInAdmin.id, authorization: signedInAdmin.authorization }
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    const author = await signedInCustomer()
    authorId = author.id
    asAuthor = author.authorization
    customer = await signedInCustomer()
    staffId = await insertStaff(db, salonId)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const report = (
    id: string,
    as: string | null = customer.authorization,
    body: string | object = REPORT,
  ) => authorized(request(app).post(`${REVIEWS}/${id}/report`), as).send(body)

  const list = (
    query: Record<string, string | number> = {},
    as: string | null = admin.authorization,
  ) => authorized(request(app).get(REPORTS).query(query), as)

  const dismiss = (id: string, as: string | null = admin.authorization) =>
    authorized(request(app).post(`${REPORTS}/${id}/dismiss`), as)

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

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

  /** The accounts that report no review. */
  const notReporters: [string, SignInAs][] = [
    ['an administrator', async () => admin.authorization],
    [
      'a staff member of the salon',
      async () => (await signedInMember('staff')).authorization,
    ],
    [
      'an account of a salon whose staff record is deleted',
      async () =>
        (await signedInMember('owner', salonId, DELETED)).authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
  ]

  /** The accounts that do not handle the reports. */
  const notAdministrators: [string, SignInAs][] = [
    [
      'the owner of the salon',
      async () => (await signedInMember('owner')).authorization,
    ],
    [
      'a manager of the salon',
      async () => (await signedInMember('manager')).authorization,
    ],
    [
      'a staff member of the salon',
      async () => (await signedInMember('staff')).authorization,
    ],
    ['a customer', async () => customer.authorization],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
  ]

  describe('POST /api/v1/reviews/:id/report', () => {
    it('reports a review of another customer: 200, with the report, and counts the pending reports of the review; nothing else changes', async () => {
      const id = await insertReview()
      const other = await insertReview()
      const before = await storedReview(id)
      const otherBefore = await storedReview(other)
      const salonBefore = await storedSalon()
      const start = await databaseClock()

      const response = await report(id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          id: expect.any(String),
          reviewId: id,
          reportedBy: customer.userId,
          reason: 'false_information',
          details: '担当したスタッフの名前が違います。',
          status: 'pending',
          resolvedBy: null,
          resolvedAt: null,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta,
        links: { review: `${REVIEWS}/${id}` },
      })
      const stored = await reportsOf(id)
      expect(stored).toEqual([
        {
          id: response.body.data.id,
          reportedBy: customer.userId,
          reason: 'false_information',
          details: '担当したスタッフの名前が違います。',
          status: 'pending',
          resolvedBy: null,
          resolvedAt: null,
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      ])
      expect(stored[0]?.createdAt).toBeGreaterThanOrEqual(Math.floor(start))
      expect(stored[0]?.updatedAt).toBeGreaterThanOrEqual(Math.floor(start))
      expect(await storedReview(id)).toMatchObject({
        reportCount: 1,
        updatedAt: before?.updatedAt,
      })
      expect(await storedReview(other)).toEqual(otherBefore)
      expect(await storedSalon()).toEqual(salonBefore)
    })

    it.each(['owner', 'manager'] as const)(
      'reports a review of the salon for its %s, whoever wrote it',
      async (role) => {
        const id = await insertReview()
        const own = await insertReview({ customerId: customer.id })
        const member = await signedInMember(role)

        const responses = [
          await report(id, member.authorization),
          await report(own, member.authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200'])
        expect(responses[0]?.body.data).toMatchObject({
          reviewId: id,
          reportedBy: member.id,
        })
        expect(await storedReview(own)).toMatchObject({ reportCount: 1 })
      },
    )

    it('counts every account that reported the review, and no report of another review or a dismissed one', async () => {
      const id = await insertReview()
      const other = await insertReview()
      const second = await signedInCustomer()
      const owner = await signedInMember('owner')
      await insertReport(id, DISMISSED)
      await insertReport(other)

      const responses = [
        await report(id),
        await report(id, second.authorization),
        await report(id, owner.authorization),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200'])
      expect(await storedReview(id)).toMatchObject({ reportCount: 3 })
      expect(
        (await reportsOf(id))
          .filter(({ status }) => status === 'pending')
          .map(({ reportedBy }) => reportedBy),
      ).toEqual([customer.userId, second.userId, owner.id])
    })

    it('counts the pending reports of the review, not the number it was stored with', async () => {
      const id = await insertReview({ reportCount: 12 })

      expect((await report(id)).status).toBe(200)

      expect(await storedReview(id)).toMatchObject({ reportCount: 1 })
    })

    it.each([
      'inappropriate',
      'false_information',
      'personal_information',
      'spam',
      'other',
    ])('takes the reason %s', async (reason) => {
      const id = await insertReview()

      const response = await report(id, customer.authorization, {
        reason,
        details: 'お店と関係のない内容です。',
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        reason,
        details: 'お店と関係のない内容です。',
      })
    })

    it('takes a report for a reason of the list without details, and details of 2000 characters', async () => {
      const id = await insertReview()
      const other = await insertReview()
      const long = '𠮷'.repeat(2000)

      const responses = [
        await report(id, customer.authorization, {
          reason: 'spam',
          details: null,
        }),
        await report(other, customer.authorization, {
          reason: 'other',
          details: long,
        }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(responses[0]?.body.data.details).toBeNull()
      expect((await reportsOf(other))[0]?.details).toBe(long)
    })

    it('keeps the review where anyone reads it, with its report count', async () => {
      const id = await insertReview()

      await report(id)

      expect(
        (await request(app).get(`${REVIEWS}/${id}`)).body.data,
      ).toMatchObject({ id, reportCount: 1 })
      expect(
        (await request(app).get(REVIEWS).query({ salonId })).body.data,
      ).toEqual([expect.objectContaining({ id, reportCount: 1 })])
    })

    it('takes the reports of a review away with it when it is removed', async () => {
      const id = await insertReview()
      await report(id)

      expect(
        (await authorized(request(app).delete(`${REVIEWS}/${id}`), asAuthor))
          .status,
      ).toBe(204)

      expect(await reportsOf(id)).toEqual([])
    })

    it('links the review under the mount path as the request wrote it', async () => {
      const id = await insertReview()

      const response = await authorized(
        request(app).post(`/API/V1/REVIEWS/${id}/report?x=1`),
        customer.authorization,
      ).send(REPORT)

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({ review: `/API/V1/REVIEWS/${id}` })
    })

    it.each(notReporters)(
      'refuses %s: 403, and writes nothing',
      async (_, signInAs) => {
        const id = await insertReview()
        const before = await storedReview(id)

        expectProblem(await report(id, await signInAs()), forbidden)
        expect(await storedReview(id)).toEqual(before)
        expect(await reportsOf(id)).toEqual([])
      },
    )

    it('refuses the review of the customer: 403, and writes nothing', async () => {
      const own = await insertReview({ customerId: customer.id })
      const before = await storedReview(own)

      expectProblem(await report(own), forbidden)
      expect(await storedReview(own)).toEqual(before)
      expect(await reportsOf(own)).toEqual([])
    })

    it.each(['owner', 'manager'] as const)(
      'refuses the %s of another salon: 403, and writes nothing',
      async (role) => {
        const id = await insertReview()
        const otherSalon = await insertSalon(db)
        const member = await signedInMember(role, otherSalon)

        expectProblem(await report(id, member.authorization), forbidden)
        expect(await reportsOf(id)).toEqual([])
      },
    )

    it('refuses a customer who was deleted behind the link of the account', async () => {
      const id = await insertReview()
      await deleteCustomer(customer.id)

      expectProblem(await report(id), forbidden)
      expect(await reportsOf(id)).toEqual([])
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const id = await insertReview()

        const response = await report(id, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await reportsOf(id)).toEqual([])
      },
    )

    it('refuses a second report of the account, also once the first was dismissed: 409, and writes nothing', async () => {
      const id = await insertReview()
      const first = await report(id)
      expect((await dismiss(first.body.data.id)).status).toBe(200)
      const before = await storedReview(id)
      const reportsBefore = await reportsOf(id)

      const again = await report(id, customer.authorization, {
        reason: 'spam',
        details: null,
      })

      expectProblem(again, notAllowed)
      expect(again.body.detail).toBe(
        'The account has reported the review already; an account reports a review once',
      )
      expect(await storedReview(id)).toEqual(before)
      expect(await reportsOf(id)).toEqual(reportsBefore)
    })

    it.each<[string, object, string[]]>([
      [
        'a reason that is not one of the list',
        { reason: 'rude', details: null },
        ['reason:invalid_value'],
      ],
      [
        'a request without a reason',
        { details: null },
        ['reason:invalid_value'],
      ],
      [
        'a request without details',
        { reason: 'spam' },
        ['details:invalid_type'],
      ],
      [
        'blank details',
        { reason: 'spam', details: ' \n\t　' },
        ['details:invalid_format'],
      ],
      [
        'details of more than 2000 characters',
        { reason: 'spam', details: 'あ'.repeat(2001) },
        ['details:too_big'],
      ],
      [
        'another reason without details',
        { reason: 'other', details: null },
        ['details:custom'],
      ],
      [
        'a property the request does not have',
        { ...REPORT, status: 'dismissed' },
        ['status:unrecognized_keys'],
      ],
    ])('refuses %s: 400, and writes nothing', async (_, body, rules) => {
      const id = await insertReview()

      const response = await report(id, customer.authorization, body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid review report')
      expect(brokenRules(response)).toEqual(rules)
      expect(await reportsOf(id)).toEqual([])
      expect(await storedReview(id)).toMatchObject({ reportCount: 0 })
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const id = await insertReview()
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).post(`${REVIEWS}/${id}/report`), authorization)
          .set('Content-Type', 'application/json')
          .send('{"reason": "spam"')

      const responses = [
        await notJson(null),
        await notJson(admin.authorization),
        await notJson(customer.authorization),
        await authorized(request(app).post(`${REVIEWS}/${id}/report`), null)
          .set('Content-Type', 'text/plain')
          .send('spam'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(await reportsOf(id)).toEqual([])
    })

    it('answers 404 for a review that is not there, removed already, or of a deleted salon', async () => {
      const removed = await insertReview()
      const ofDeletedSalon = await insertReview()
      await authorized(request(app).delete(`${REVIEWS}/${removed}`), asAuthor)
      await deleteSalon(salonId)
      const before = await storedReview(ofDeletedSalon)

      const responses = [
        await report(UNKNOWN_ID),
        await report(removed),
        await report(ofDeletedSalon),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses[1]?.body.detail).toBe(`Review ${removed} was not found`)
      expect(await storedReview(ofDeletedSalon)).toEqual(before)
      expect(await reportsOf(ofDeletedSalon)).toEqual([])
    })

    it('finds the review by its ID in capitals, and refuses an ID that is not a UUID', async () => {
      const id = await insertReview()

      const notAnId = await report(`${UNKNOWN_ID}0`)
      const found = await report(id.toUpperCase())

      expectProblem(notAnId, badRequest)
      expect(notAnId.body.detail).toBe('Invalid review ID')
      expect(brokenRules(notAnId)).toEqual(['id:invalid_format'])
      expect(found.status).toBe(200)
      expect(found.body.data.reviewId).toBe(id)
      expect(await reportsOf(id)).toHaveLength(1)
    })

    it('checks a report in order: the token, the account, the ID, the request, the review, its author, an earlier report', async () => {
      const own = await insertReview({ customerId: customer.id })
      const reported = await insertReview()
      await insertReport(reported, { reportedBy: customer.userId })
      const broken = { reason: 'other', details: null }

      const responses = [
        await report('latest', null, broken),
        await report('latest', admin.authorization, broken),
        await report('latest', customer.authorization, broken),
        await report(UNKNOWN_ID, customer.authorization, broken),
        await report(UNKNOWN_ID),
        await report(own),
        await report(reported),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '400 id:invalid_format',
        '400 details:custom',
        '404 3001',
        '403 1005',
        '409 3003',
      ])
    })

    it('serves no other method on the reports of a review', async () => {
      const id = await insertReview()

      for (const call of [
        request(app).get(`${REVIEWS}/${id}/report`),
        request(app).put(`${REVIEWS}/${id}/report`),
        request(app).patch(`${REVIEWS}/${id}/report`),
        request(app).delete(`${REVIEWS}/${id}/report`),
        request(app).post(`${REVIEWS}/report`),
        request(app).post(`${REVIEWS}/${id}/reports`),
      ]) {
        expectProblem(
          await authorized(call, customer.authorization).send(REPORT),
          routeNotFound,
        )
      }
      expect(await reportsOf(id)).toEqual([])
    })
  })

  describe('GET /api/v1/review-reports', () => {
    /** IDs out of the order of the times of the reports below. */
    const reportId = (last: string): string =>
      `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0b0${last}`

    /**
     * Four reports of two reviews: the earliest has the ID 2, two of one
     * moment have the IDs 1 and 3, and the latest has the ID 0.
     */
    const insertFourReports = async (): Promise<{
      first: string
      second: string
    }> => {
      const first = await insertReview()
      const second = await insertReview()
      await insertReport(first, {
        id: reportId('3'),
        createdAt: '2026-11-17T02:00:00.000Z',
      })
      await insertReport(second, {
        id: reportId('0'),
        createdAt: '2026-11-17T03:00:00.000Z',
        ...DISMISSED,
      })
      await insertReport(first, {
        id: reportId('1'),
        createdAt: '2026-11-17T02:00:00.000Z',
        reason: 'other',
        details: '写真が別の店のものです。',
      })
      await insertReport(second, {
        id: reportId('2'),
        createdAt: '2026-11-17T01:00:00.000Z',
      })
      return { first, second }
    }

    const idsOf = (response: Response): string[] =>
      response.body.data.map((listed: { id: string }) => listed.id)

    it('lists the reports for an administrator, oldest first and in the order of their IDs at one moment, with everything a report says', async () => {
      const { first } = await insertFourReports()

      const response = await list()

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([
        reportId('2'),
        reportId('1'),
        reportId('3'),
        reportId('0'),
      ])
      expect(response.body.data[1]).toEqual({
        id: reportId('1'),
        reviewId: first,
        reportedBy: expect.any(String),
        reason: 'other',
        details: '写真が別の店のものです。',
        status: 'pending',
        resolvedBy: null,
        resolvedAt: null,
        createdAt: '2026-11-17T02:00:00.000Z',
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(response.body.data[3]).toMatchObject({
        status: 'dismissed',
        resolvedBy: UNKNOWN_ID,
        resolvedAt: '2026-11-17T03:00:00.000Z',
      })
      expect(response.body.meta).toEqual({
        total: 4,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
      expect(response.body.links).toEqual({
        self: REPORTS,
        first: REPORTS,
        last: null,
        next: null,
        prev: null,
      })
    })

    it('walks the pages one report a page, in the same order', async () => {
      await insertFourReports()
      const walked: string[] = []
      let cursor: string | null = null

      for (let page = 0; page < 4; page += 1) {
        const response: Response = await list(
          cursor === null ? { limit: 1 } : { limit: 1, cursor },
        )
        expect(response.body.meta).toMatchObject({ total: 4, limit: 1 })
        walked.push(...idsOf(response))
        cursor = response.body.meta.nextCursor
      }

      expect(walked).toEqual([
        reportId('2'),
        reportId('1'),
        reportId('3'),
        reportId('0'),
      ])
      expect(cursor).toBeNull()
    })

    it('filters the reports by status, by review and by the salon of the review', async () => {
      const { first, second } = await insertFourReports()
      const otherSalon = await insertSalon(db)
      const elsewhere = await insertReview({ salonId: otherSalon })
      await insertReport(elsewhere, {
        id: reportId('9'),
        createdAt: '2026-11-17T04:00:00.000Z',
      })

      const [pending, dismissed, ofFirst, ofSalon, ofOtherSalon, combined] =
        await Promise.all([
          list({ status: 'pending' }),
          list({ status: 'dismissed' }),
          list({ reviewId: first }),
          list({ salonId }),
          list({ salonId: otherSalon }),
          list({ status: 'pending', reviewId: second, salonId }),
        ])

      expect(idsOf(pending)).toEqual([
        reportId('2'),
        reportId('1'),
        reportId('3'),
        reportId('9'),
      ])
      expect(idsOf(dismissed)).toEqual([reportId('0')])
      expect(idsOf(ofFirst)).toEqual([reportId('1'), reportId('3')])
      expect(ofFirst.body.meta.total).toBe(2)
      expect(idsOf(ofSalon)).toHaveLength(4)
      expect(idsOf(ofOtherSalon)).toEqual([reportId('9')])
      expect(idsOf(combined)).toEqual([reportId('2')])
      expect(
        idsOf(await list({ reviewId: UNKNOWN_ID, salonId: UNKNOWN_ID })),
      ).toEqual([])
    })

    it('leaves out the reports of the reviews of a deleted salon, and refuses a cursor that names one', async () => {
      await insertFourReports()
      const otherSalon = await insertSalon(db)
      const elsewhere = await insertReview({ salonId: otherSalon })
      await insertReport(elsewhere, {
        id: reportId('9'),
        createdAt: '2026-11-17T04:00:00.000Z',
      })
      await deleteSalon(otherSalon)

      const response = await list()
      const named = await list({ cursor: reportId('9') })

      expect(idsOf(response)).not.toContain(reportId('9'))
      expect(response.body.meta.total).toBe(4)
      expectProblem(named, badRequest)
      expect(brokenRules(named)).toEqual(['cursor:not_found'])
      expect(named.body.errors[0].message).toBe(
        'Must name a review report that is listed',
      )
    })

    it('refuses a cursor that names no report: 400', async () => {
      const response = await list({ cursor: UNKNOWN_ID })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['cursor:not_found'])
    })

    it('links the pages under the mount path and with the query as the request wrote them', async () => {
      await insertFourReports()

      const response = await authorized(
        request(app).get('/API/V1/REVIEW-REPORTS?limit=1&status=pending'),
        admin.authorization,
      )

      expect(response.body.links).toEqual({
        self: '/API/V1/REVIEW-REPORTS?limit=1&status=pending',
        first: '/API/V1/REVIEW-REPORTS?limit=1&status=pending',
        last: null,
        next: `/API/V1/REVIEW-REPORTS?limit=1&status=pending&cursor=${reportId('2')}`,
        prev: null,
      })
    })

    it.each(notAdministrators)(
      'refuses %s: 403, even for a query it cannot read',
      async (_, signInAs) => {
        await insertFourReports()
        const as = await signInAs()

        expectProblem(await list({}, as), forbidden)
        expectProblem(await list({ limit: 'many' }, as), forbidden)
      },
    )

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const response = await list({}, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it.each<[string, Record<string, string | number>, string[]]>([
      ['a page of no reports', { limit: 0 }, ['limit:too_small']],
      ['a page of more than 100 reports', { limit: 101 }, ['limit:too_big']],
      [
        'a size of a page that is no number',
        { limit: 'many' },
        ['limit:invalid_format'],
      ],
      [
        'a cursor that is not an ID',
        { cursor: 'next' },
        ['cursor:invalid_format'],
      ],
      [
        'a status there is not',
        { status: 'resolved' },
        ['status:invalid_value'],
      ],
      [
        'a review ID that is not one',
        { reviewId: '42' },
        ['reviewId:invalid_format'],
      ],
      [
        'a salon ID that is not one',
        { salonId: '42' },
        ['salonId:invalid_format'],
      ],
      [
        'a parameter the list does not have',
        { sortBy: 'recent' },
        ['sortBy:unrecognized_keys'],
      ],
    ])('refuses %s: 400', async (_, query, rules) => {
      const response = await list(query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid review report search')
      expect(brokenRules(response)).toEqual(rules)
    })

    it('serves no other method on the reports', async () => {
      const id = await insertReport(await insertReview())

      for (const call of [
        request(app).post(REPORTS),
        request(app).get(`${REPORTS}/${id}`),
        request(app).put(`${REPORTS}/${id}`),
        request(app).patch(`${REPORTS}/${id}`),
        request(app).delete(`${REPORTS}/${id}`),
      ]) {
        expectProblem(
          await authorized(call, admin.authorization),
          routeNotFound,
        )
      }
      expect(await storedReport(id)).toMatchObject({ status: 'pending' })
    })
  })

  describe('POST /api/v1/review-reports/:id/dismiss', () => {
    it('dismisses a pending report: 200, with who dismissed it and when, and counts the pending reports of its review again; nothing else changes', async () => {
      const id = await insertReview({ reportCount: 2 })
      const dismissed = await insertReport(id)
      const kept = await insertReport(id)
      const other = await insertReview({ reportCount: 1 })
      await insertReport(other)
      const before = await storedReview(id)
      const otherBefore = await storedReview(other)
      const keptBefore = await storedReport(kept)
      const start = await databaseClock()

      const response = await dismiss(dismissed)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          id: dismissed,
          reviewId: id,
          reportedBy: expect.any(String),
          reason: 'spam',
          details: null,
          status: 'dismissed',
          resolvedBy: admin.id,
          resolvedAt: expect.stringMatching(ISO_TIMESTAMP),
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta,
        links: { review: `${REVIEWS}/${id}` },
      })
      const stored = await storedReport(dismissed)
      expect(stored).toMatchObject({
        status: 'dismissed',
        resolvedBy: admin.id,
      })
      expect(stored?.resolvedAt).toBeGreaterThanOrEqual(Math.floor(start))
      expect(stored?.updatedAt).toBeGreaterThanOrEqual(Math.floor(start))
      expect(await storedReview(id)).toMatchObject({
        reportCount: 1,
        updatedAt: before?.updatedAt,
      })
      expect(await storedReport(kept)).toEqual(keptBefore)
      expect(await storedReview(other)).toEqual(otherBefore)
    })

    it('counts the pending reports of the review, not the number it was stored with', async () => {
      const id = await insertReview({ reportCount: 7 })
      const dismissed = await insertReport(id)
      await insertReport(id)
      await insertReport(id, DISMISSED)

      expect((await dismiss(dismissed)).status).toBe(200)

      expect(await storedReview(id)).toMatchObject({ reportCount: 1 })
    })

    it('takes the report out of the pending ones of the list', async () => {
      const id = await insertReview()
      const dismissed = await insertReport(id)

      await dismiss(dismissed)

      expect((await list({ status: 'pending' })).body.data).toEqual([])
      expect((await list({ status: 'dismissed' })).body.data).toEqual([
        expect.objectContaining({ id: dismissed, resolvedBy: admin.id }),
      ])
    })

    it('reads no body', async () => {
      const id = await insertReview()
      const dismissed = await insertReport(id)

      const response = await dismiss(dismissed).send({
        status: 'pending',
        resolvedBy: UNKNOWN_ID,
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        status: 'dismissed',
        resolvedBy: admin.id,
      })
    })

    it('links the review next to the mount path as the request wrote it', async () => {
      const id = await insertReview()
      const dismissed = await insertReport(id)

      const response = await authorized(
        request(app).post(`/API/V1/REVIEW-REPORTS/${dismissed}/dismiss?x=1`),
        admin.authorization,
      )

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        review: `/API/V1/reviews/${id}`,
      })
    })

    it('refuses a report dismissed already: 409, and keeps who dismissed it and when', async () => {
      const id = await insertReview()
      const dismissed = await insertReport(id, DISMISSED)
      const before = await storedReport(dismissed)

      const response = await dismiss(dismissed)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        'The report is dismissed already; a report is dismissed once',
      )
      expect(await storedReport(dismissed)).toEqual(before)
    })

    it.each(notAdministrators)(
      'refuses %s: 403, and writes nothing',
      async (_, signInAs) => {
        const id = await insertReview()
        const pending = await insertReport(id)
        const before = await storedReport(pending)

        expectProblem(await dismiss(pending, await signInAs()), forbidden)
        expect(await storedReport(pending)).toEqual(before)
      },
    )

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const pending = await insertReport(await insertReview())

        const response = await dismiss(pending, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await storedReport(pending)).toMatchObject({ status: 'pending' })
      },
    )

    it('answers 404 for a report that is not there, of a removed review, or of a review of a deleted salon', async () => {
      const removed = await insertReview()
      const ofRemoved = await insertReport(removed)
      await authorized(request(app).delete(`${REVIEWS}/${removed}`), asAuthor)
      const ofDeletedSalon = await insertReport(await insertReview())
      await deleteSalon(salonId)
      const before = await storedReport(ofDeletedSalon)

      const responses = [
        await dismiss(UNKNOWN_ID),
        await dismiss(ofRemoved),
        await dismiss(ofDeletedSalon),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses[0]?.body.detail).toBe(
        `ReviewReport ${UNKNOWN_ID} was not found`,
      )
      expect(await storedReport(ofDeletedSalon)).toEqual(before)
    })

    it('finds the report by its ID in capitals, and refuses an ID that is not a UUID', async () => {
      const pending = await insertReport(await insertReview())

      const notAnId = await dismiss(`${UNKNOWN_ID}0`)
      const found = await dismiss(pending.toUpperCase())

      expectProblem(notAnId, badRequest)
      expect(notAnId.body.detail).toBe('Invalid review report ID')
      expect(brokenRules(notAnId)).toEqual(['id:invalid_format'])
      expect(found.status).toBe(200)
      expect(found.body.data.id).toBe(pending)
    })

    it('checks a dismissal in order: the token, the account, the ID, the report, its status', async () => {
      const dismissed = await insertReport(await insertReview(), DISMISSED)
      const owner = await signedInMember('owner')

      const responses = [
        await dismiss('latest', null),
        await dismiss('latest', owner.authorization),
        await dismiss('latest'),
        await dismiss(UNKNOWN_ID),
        await dismiss(dismissed),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '400 id:invalid_format',
        '404 3001',
        '409 3003',
      ])
    })

    it('serves no other method on the dismissal of a report', async () => {
      const pending = await insertReport(await insertReview())

      for (const call of [
        request(app).get(`${REPORTS}/${pending}/dismiss`),
        request(app).put(`${REPORTS}/${pending}/dismiss`),
        request(app).patch(`${REPORTS}/${pending}/dismiss`),
        request(app).delete(`${REPORTS}/${pending}/dismiss`),
        request(app).post(`${REPORTS}/dismiss`),
        request(app).post(`${REPORTS}/${pending}/resolve`),
      ]) {
        expectProblem(
          await authorized(call, admin.authorization),
          routeNotFound,
        )
      }
      expect(await storedReport(pending)).toMatchObject({ status: 'pending' })
    })
  })

  describe('requests at the same time', () => {
    it('counts every account that reports the review at the same time', async () => {
      const id = await insertReview()
      const reporters = []
      for (let reporter = 0; reporter < 5; reporter += 1) {
        reporters.push(await signedInCustomer())
      }

      const responses = await Promise.all(
        reporters.map(({ authorization }) => report(id, authorization)),
      )

      expect(responses.map(statusAndCode)).toEqual(Array(5).fill('200'))
      expect(await storedReview(id)).toMatchObject({ reportCount: 5 })
    })

    it('writes one report of an account that reports the review at the same time again', async () => {
      const id = await insertReview()

      const responses = await Promise.all([report(id), report(id), report(id)])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
        '409 3003',
      ])
      expect(await reportsOf(id)).toHaveLength(1)
      expect(await storedReview(id)).toMatchObject({ reportCount: 1 })
    })

    it('waits for the review while it is held, and counts the report it waited for, at the time it is written', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld, released } = await db.transaction(
        async (tx: Transaction) => {
          // As a report of another account that is under way holds it.
          await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.id, id))
            .for('no key update')
          await tx
            .insert(reviewReports)
            .values({ reviewId: id, reportedBy: randomUUID(), reason: 'spam' })
          await tx
            .update(reviews)
            .set({ reportCount: 1 })
            .where(eq(reviews.id, id))
          const underWay = report(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            released: await databaseClock(),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
      expect(await storedReview(id)).toMatchObject({ reportCount: 2 })
      const waited = (await reportsOf(id)).find(
        ({ reportedBy }) => reportedBy === customer.userId,
      )
      expect(waited?.createdAt).toBeGreaterThanOrEqual(Math.floor(released))
    })

    it('waits for a report of the account that is not committed yet, and answers 409', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          // A report of the account that holds nothing of what the request
          // holds: the request meets it at the unique constraint.
          await tx.insert(reviewReports).values({
            reviewId: id,
            reportedBy: customer.userId,
            reason: 'spam',
          })
          const underWay = report(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(await pending, notAllowed)
      expect(await reportsOf(id)).toHaveLength(1)
    })

    it('waits for a change of the review under way, and keeps what it wrote', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .update(reviews)
            .set({ comment: '追記しました' })
            .where(eq(reviews.id, id))
          const underWay = report(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expect((await pending).status).toBe(200)
      expect(
        (await request(app).get(`${REVIEWS}/${id}`)).body.data,
      ).toMatchObject({ comment: '追記しました', reportCount: 1 })
    })

    it('answers 404 to a report that waited for the removal of its review', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx.delete(reviews).where(eq(reviews.id, id))
          const underWay = report(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(await pending, notFound)
      expect(await db.$count(reviewReports)).toBe(0)
    })

    it.each<[string, (tx: Transaction, id: string) => Promise<unknown>]>([
      [
        'its salon, held as a review of the salon that is written holds it',
        (tx) =>
          tx
            .select({ id: salons.id })
            .from(salons)
            .where(eq(salons.id, salonId))
            .for('no key update'),
      ],
      [
        'the customer, whose profile is being changed',
        (tx) =>
          tx
            .update(customers)
            .set({ notes: '来店前に確認' })
            .where(eq(customers.id, customer.id)),
      ],
      [
        'its review, held FOR KEY SHARE by a row that names it and is not committed yet',
        async (tx, id) =>
          tx
            .insert(reviewHelpfulVotes)
            .values({ reviewId: id, customerId: await insertCustomer(db) }),
      ],
    ])('reports past %s', async (_, hold) => {
      const id = await insertReview()

      const answered = await db.transaction(async (tx: Transaction) => {
        await hold(tx, id)
        return answersWithin(report(id), 2000)
      })

      expect(answered).toBe(true)
      expect((await reportsOf(id)).map(({ reportedBy }) => reportedBy)).toEqual(
        [customer.userId],
      )
    })

    it('dismisses a report once when it is dismissed twice at the same time, once the review it waited for is released', async () => {
      const id = await insertReview({ reportCount: 1 })
      const pendingReport = await insertReport(id)

      const { pending, answeredWhileHeld, released } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.id, id))
            .for('no key update')
          const underWay = Promise.all([
            dismiss(pendingReport),
            dismiss(pendingReport),
          ])
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            released: await databaseClock(),
          }
        },
      )
      const responses = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
      ])
      const stored = await storedReport(pendingReport)
      expect(stored?.resolvedAt).toBeGreaterThanOrEqual(Math.floor(released))
      expect(await storedReview(id)).toMatchObject({ reportCount: 0 })
    })

    it('waits for a report of the review under way, and counts it', async () => {
      const id = await insertReview({ reportCount: 1 })
      const dismissed = await insertReport(id)

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          // As a report of another account that is under way holds it.
          await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.id, id))
            .for('no key update')
          await tx
            .insert(reviewReports)
            .values({ reviewId: id, reportedBy: randomUUID(), reason: 'spam' })
          await tx
            .update(reviews)
            .set({ reportCount: 2 })
            .where(eq(reviews.id, id))
          const underWay = dismiss(dismissed).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expect((await pending).status).toBe(200)
      expect(await storedReview(id)).toMatchObject({ reportCount: 1 })
    })

    it('answers 404 to a dismissal that waited for the removal of the review', async () => {
      const id = await insertReview()
      const pendingReport = await insertReport(id)

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx.delete(reviews).where(eq(reviews.id, id))
          const underWay = dismiss(pendingReport).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(await pending, notFound)
    })

    it.each<[string, (tx: Transaction, id: string) => Promise<unknown>]>([
      [
        'the salon of its review, held as a review of the salon that is written holds it',
        (tx) =>
          tx
            .select({ id: salons.id })
            .from(salons)
            .where(eq(salons.id, salonId))
            .for('no key update'),
      ],
      [
        'its review, held FOR KEY SHARE by a row that names it and is not committed yet',
        async (tx, id) =>
          tx
            .insert(reviewHelpfulVotes)
            .values({ reviewId: id, customerId: await insertCustomer(db) }),
      ],
    ])('dismisses past %s', async (_, hold) => {
      const id = await insertReview()
      const pendingReport = await insertReport(id)

      const answered = await db.transaction(async (tx: Transaction) => {
        await hold(tx, id)
        return answersWithin(dismiss(pendingReport), 2000)
      })

      expect(answered).toBe(true)
      expect(await storedReport(pendingReport)).toMatchObject({
        status: 'dismissed',
      })
    })
  })
})
