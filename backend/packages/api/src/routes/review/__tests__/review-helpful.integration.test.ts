import {
  bookings,
  customers,
  reviewHelpfulVotes,
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
} from '../../../__tests__/_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  request,
} from '../../../__tests__/_shared/test-helpers'

const REVIEWS = '/api/v1/reviews'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
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
  call: Promise<Response>,
  milliseconds: number,
): Promise<boolean> =>
  Promise.race([call.then(() => true), pause(milliseconds).then(() => false)])

/** A time of 20 November 2026 in UTC, `HH:MM`. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

describe('Review helpful API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** The customer who wrote the reviews of most tests. */
  let authorId: string
  /** The Authorization header of the author. */
  let asAuthor: string
  /** The customer who marks the reviews in most tests. */
  let customerId: string
  /** The Authorization header of the customer. */
  let asCustomer: string
  /** The staff member in charge of the bookings of the tests. */
  let staffId: string

  type NewReview = typeof reviews.$inferInsert
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
        overallRating: 4,
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
   * A review as it is stored: its helpful count, the moment it was last
   * changed, and the transaction that last wrote its row. Undefined when it
   * is gone.
   */
  const storedReview = async (id: string) => {
    const [row] = await getTestDbClient()<
      { helpfulCount: number; updatedAt: number; writtenBy: string }[]
    >`
      SELECT "helpfulCount",
             (extract(epoch from "updatedAt") * 1000)::float8 AS "updatedAt",
             xmin::text AS "writtenBy"
      FROM reviews
      WHERE id = ${id}
    `
    return row
  }

  /** The marks of a review, oldest first, with their times as epoch milliseconds. */
  const marksOf = (id: string) =>
    db
      .select({
        customerId: reviewHelpfulVotes.customerId,
        createdAt: epochMs(reviewHelpfulVotes.createdAt),
      })
      .from(reviewHelpfulVotes)
      .where(eq(reviewHelpfulVotes.reviewId, id))
      .orderBy(asc(reviewHelpfulVotes.createdAt))

  /** What a salon was last written by, which a mark leaves as it is. */
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

  /** The moment of the clock a mark is written by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  /** A customer of their own, signed in: their ID and Authorization header. */
  const signedInCustomer = async (): Promise<{
    id: string
    authorization: string
  }> => {
    const id = await insertCustomer(db)
    return {
      id,
      authorization: (await signedInUser(app, db, { customerId: id }))
        .authorization,
    }
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    const author = await signedInCustomer()
    authorId = author.id
    asAuthor = author.authorization
    const customer = await signedInCustomer()
    customerId = customer.id
    asCustomer = customer.authorization
    staffId = await insertStaff(db, salonId)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const mark = (id: string, as: string | null = asCustomer) =>
    authorized(request(app).post(`${REVIEWS}/${id}/helpful`), as)

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** A member of the salon of the tests. */
  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      staffOverrides: Partial<NewStaff> = {},
    ): SignInAs =>
    async () => {
      const { email } = await insertMember(db, role, salonId, staffOverrides)
      return (await signIn(app, email)).authorization
    }

  /** The accounts that are no customers with a profile. */
  const notCustomers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
    [
      'an account of a salon whose staff record is deleted',
      member('staff', DELETED),
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
  ]

  /** Tokens that a mark refuses, before anything else is looked at. */
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

  describe('POST /api/v1/reviews/:id/helpful', () => {
    it('marks a review of another customer: 200, with how many customers marked it, and nothing else changes', async () => {
      const id = await insertReview()
      const other = await insertReview()
      const before = await storedReview(id)
      const otherBefore = await storedReview(other)
      const salonBefore = await storedSalon()
      const start = await databaseClock()

      const response = await mark(id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: { helpfulCount: 1 },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: null,
      })
      expect(await storedReview(id)).toMatchObject({
        helpfulCount: 1,
        updatedAt: before?.updatedAt,
      })
      const marks = await marksOf(id)
      expect(marks).toEqual([{ customerId, createdAt: expect.any(Number) }])
      expect(marks[0]?.createdAt).toBeGreaterThanOrEqual(Math.floor(start))
      expect(await storedReview(other)).toEqual(otherBefore)
      expect(await storedSalon()).toEqual(salonBefore)
      expect(
        (await request(app).get(`${REVIEWS}/${id}`)).body.data,
      ).toMatchObject({ helpfulCount: 1, updatedAt: expect.any(String) })
    })

    it('counts every customer who marked the review, and no mark of another review', async () => {
      const id = await insertReview()
      const other = await insertReview()
      const second = await signedInCustomer()
      const third = await signedInCustomer()
      await mark(other, third.authorization)

      const responses = [
        await mark(id),
        await mark(id, second.authorization),
        await mark(id, third.authorization),
      ]

      expect(responses.map((response) => response.body.data)).toEqual([
        { helpfulCount: 1 },
        { helpfulCount: 2 },
        { helpfulCount: 3 },
      ])
      expect((await marksOf(id)).map((marked) => marked.customerId)).toEqual([
        customerId,
        second.id,
        third.id,
      ])
    })

    it('counts a second mark of the customer once: 200, with the count as it is, and writes nothing', async () => {
      const id = await insertReview()
      await mark(id, (await signedInCustomer()).authorization)
      await mark(id)
      const before = await storedReview(id)
      const marksBefore = await marksOf(id)

      const again = await mark(id)

      expect(again.status).toBe(200)
      expect(again.body.data).toEqual({ helpfulCount: 2 })
      expect(await storedReview(id)).toEqual(before)
      expect(await marksOf(id)).toEqual(marksBefore)
    })

    it('counts the marks of the review, not the number it was stored with', async () => {
      const id = await insertReview({ helpfulCount: 12 })

      const response = await mark(id)

      expect(response.body.data).toEqual({ helpfulCount: 1 })
      expect(await storedReview(id)).toMatchObject({ helpfulCount: 1 })
    })

    it('reads no body', async () => {
      const id = await insertReview()

      const response = await mark(id).send({ helpfulCount: 100, customerId })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ helpfulCount: 1 })
    })

    it('puts the marked review first in the helpful order', async () => {
      const first = await insertReview()
      const marked = await insertReview()
      const order = async () =>
        (
          await request(app).get(REVIEWS).query({ salonId, sortBy: 'helpful' })
        ).body.data.map((review: { id: string }) => review.id)
      const before = await order()

      await mark(marked)

      expect(before).toHaveLength(2)
      expect(await order()).toEqual([marked, first])
    })

    it('takes the marks of a review away with it when it is removed', async () => {
      const id = await insertReview()
      await mark(id)

      expect(
        (await authorized(request(app).delete(`${REVIEWS}/${id}`), asAuthor))
          .status,
      ).toBe(204)

      expect(await marksOf(id)).toEqual([])
    })

    it.each(notCustomers)(
      'refuses %s: 403, and writes nothing',
      async (_, signInAs) => {
        const id = await insertReview()
        const before = await storedReview(id)

        expectProblem(await mark(id, await signInAs()), forbidden)
        expect(await storedReview(id)).toEqual(before)
        expect(await marksOf(id)).toEqual([])
      },
    )

    it('refuses the review of the customer: 403, and writes nothing', async () => {
      const own = await insertReview({ customerId })
      const before = await storedReview(own)

      expectProblem(await mark(own), forbidden)
      expect(await storedReview(own)).toEqual(before)
      expect(await marksOf(own)).toEqual([])
      expect((await mark(own, asAuthor)).status).toBe(200)
    })

    it('refuses a customer who was deleted behind the link of the account', async () => {
      const id = await insertReview()
      await deleteCustomer(customerId)

      expectProblem(await mark(id), forbidden)
      expect(await marksOf(id)).toEqual([])
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const id = await insertReview()

        const response = await mark(id, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await marksOf(id)).toEqual([])
      },
    )

    it('answers 404 for a review that is not there, removed already, or of a deleted salon', async () => {
      const removed = await insertReview()
      const ofDeletedSalon = await insertReview()
      await authorized(request(app).delete(`${REVIEWS}/${removed}`), asAuthor)
      await deleteSalon(salonId)
      const before = await storedReview(ofDeletedSalon)

      const responses = [
        await mark(UNKNOWN_ID),
        await mark(removed),
        await mark(ofDeletedSalon),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses[1]?.body.detail).toBe(`Review ${removed} was not found`)
      expect(await storedReview(ofDeletedSalon)).toEqual(before)
      expect(await marksOf(ofDeletedSalon)).toEqual([])
    })

    it('finds the review by its ID in capitals, and refuses an ID that is not a UUID', async () => {
      const id = await insertReview()

      const notAnId = await mark(`${UNKNOWN_ID}0`)
      const found = await mark(id.toUpperCase())

      expectProblem(notAnId, badRequest)
      expect(notAnId.body.detail).toBe('Invalid review ID')
      expect(brokenRules(notAnId)).toEqual(['id:invalid_format'])
      expect(found.status).toBe(200)
      expect(await marksOf(id)).toHaveLength(1)
    })

    it('checks a mark in order: the token, the account, the ID, the review, its author', async () => {
      const own = await insertReview({ customerId })

      const responses = [
        await mark('latest', null),
        await mark('latest', await member('owner')()),
        await mark('latest'),
        await mark(UNKNOWN_ID),
        await mark(own),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '400 id:invalid_format',
        '404 3001',
        '403 1005',
      ])
    })

    it('serves no other method on the marks of a review', async () => {
      const id = await insertReview()

      for (const call of [
        request(app).get(`${REVIEWS}/${id}/helpful`),
        request(app).put(`${REVIEWS}/${id}/helpful`),
        request(app).patch(`${REVIEWS}/${id}/helpful`),
        request(app).delete(`${REVIEWS}/${id}/helpful`),
        request(app).post(`${REVIEWS}/helpful`),
      ]) {
        expectProblem(await authorized(call, asCustomer), routeNotFound)
      }
      expect(await marksOf(id)).toEqual([])
    })
  })

  describe('requests at the same time', () => {
    it('counts every customer who marks the review at the same time, one after the other', async () => {
      const id = await insertReview()
      const markers = []
      for (let marker = 0; marker < 5; marker += 1) {
        markers.push(await signedInCustomer())
      }

      const responses = await Promise.all(
        markers.map(({ authorization }) => mark(id, authorization)),
      )

      expect(responses.map(statusAndCode)).toEqual(Array(5).fill('200'))
      expect(
        responses
          .map((response) => response.body.data.helpfulCount)
          .toSorted((left, right) => left - right),
      ).toEqual([1, 2, 3, 4, 5])
      expect(await storedReview(id)).toMatchObject({ helpfulCount: 5 })
    })

    it('writes one mark of a customer who marks the review at the same time again', async () => {
      const id = await insertReview()

      const responses = await Promise.all([mark(id), mark(id), mark(id)])

      expect(responses.map((response) => response.body.data)).toEqual(
        Array(3).fill({ helpfulCount: 1 }),
      )
      expect(await marksOf(id)).toHaveLength(1)
    })

    it('waits for the review while it is held, and counts the mark it waited for, at the time it is written', async () => {
      const id = await insertReview()
      const first = await insertCustomer(db)

      const { pending, answeredWhileHeld, released } = await db.transaction(
        async (tx: Transaction) => {
          // As a mark of another customer that is under way holds it.
          await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.id, id))
            .for('no key update')
          await tx
            .insert(reviewHelpfulVotes)
            .values({ reviewId: id, customerId: first })
          await tx
            .update(reviews)
            .set({ helpfulCount: 1 })
            .where(eq(reviews.id, id))
          const underWay = mark(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            released: await databaseClock(),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.body.data).toEqual({ helpfulCount: 2 })
      expect(await storedReview(id)).toMatchObject({ helpfulCount: 2 })
      const [, waited] = await marksOf(id)
      expect(waited?.customerId).toBe(customerId)
      expect(waited?.createdAt).toBeGreaterThanOrEqual(Math.floor(released))
    })

    it('waits for a change of the review under way, and keeps what it wrote', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          // As a change holds it, FOR UPDATE.
          await tx
            .update(reviews)
            .set({ comment: '追記しました' })
            .where(eq(reviews.id, id))
          const underWay = mark(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expect((await pending).body.data).toEqual({ helpfulCount: 1 })
      expect(
        (await request(app).get(`${REVIEWS}/${id}`)).body.data,
      ).toMatchObject({ comment: '追記しました', helpfulCount: 1 })
    })

    it('answers 404 to a mark that waited for the removal of its review', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx.delete(reviews).where(eq(reviews.id, id))
          const underWay = mark(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(await pending, notFound)
      expect(await db.$count(reviewHelpfulVotes)).toBe(0)
    })

    it('removes a review and its marks when it is marked and removed at the same time', async () => {
      const id = await insertReview()

      const [marked, removed] = await Promise.all([
        mark(id),
        authorized(request(app).delete(`${REVIEWS}/${id}`), asAuthor),
      ])

      expect(removed.status).toBe(204)
      expect(['200', '404 3001']).toContain(statusAndCode(marked))
      expect(await db.$count(reviewHelpfulVotes)).toBe(0)
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
            .where(eq(customers.id, customerId)),
      ],
      [
        'its review, held FOR KEY SHARE by a row that names it and is not committed yet',
        async (tx, id) =>
          tx
            .insert(reviewHelpfulVotes)
            .values({ reviewId: id, customerId: await insertCustomer(db) }),
      ],
    ])('goes past %s', async (_, hold) => {
      const id = await insertReview()

      const answered = await db.transaction(async (tx: Transaction) => {
        await hold(tx, id)
        return answersWithin(mark(id), 2000)
      })

      expect(answered).toBe(true)
      expect((await marksOf(id)).map((marked) => marked.customerId)).toContain(
        customerId,
      )
    })
  })
})
