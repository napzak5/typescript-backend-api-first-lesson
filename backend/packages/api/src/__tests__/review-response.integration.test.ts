import {
  bookings,
  reviewHelpfulVotes,
  reviews,
  salons,
  type staff,
} from '@beauty-salon-backend/database'
import { eq } from 'drizzle-orm'
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
  call: Promise<unknown>,
  milliseconds: number,
): Promise<boolean> =>
  Promise.race([call.then(() => true), pause(milliseconds).then(() => false)])

/** A time of 20 November 2026 in UTC, `HH:MM`. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

/** The response of the salon in most tests. */
const RESPONSE =
  'ご来店ありがとうございました。またのお越しをお待ちしております。'

/** A response the salon wrote earlier, at a time of its own. */
const EARLIER = {
  ownerResponse: 'ご来店ありがとうございました。',
  ownerRespondedAt: '2026-11-17T03:00:00.000Z',
}
const EARLIER_AT = Date.parse(EARLIER.ownerRespondedAt)

const meta = {
  correlationId: expect.any(String),
  timestamp: expect.stringMatching(ISO_TIMESTAMP),
  version: expect.any(String),
}

describe('Review response API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of the signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** The customer who wrote the reviews of most tests. */
  let authorId: string
  /** The Authorization header of the author. */
  let asAuthor: string
  /** The Authorization header of the owner of the salon, who responds in most tests. */
  let asOwner: string
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
   * A review written directly, of a completed booking of its own: two
   * stars at the salon of the tests by the author, written an hour ago,
   * without a response, unless said otherwise. Returns its ID.
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
   * A review as it is stored: its response, the moment it was written, the
   * moment the review was last changed, and the transaction that last wrote
   * its row. Undefined when it is gone.
   */
  const storedReview = async (id: string) => {
    const [row] = await getTestDbClient()<
      {
        ownerResponse: string | null
        ownerRespondedAt: number | null
        updatedAt: number
        writtenBy: string
      }[]
    >`
      SELECT "ownerResponse",
             (extract(epoch from "ownerRespondedAt") * 1000)::float8 AS "ownerRespondedAt",
             (extract(epoch from "updatedAt") * 1000)::float8 AS "updatedAt",
             xmin::text AS "writtenBy"
      FROM reviews
      WHERE id = ${id}
    `
    return row
  }

  /** What a salon was last written by, which a response leaves as it is. */
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

  /** The moment of the clock a response is written by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  /** A member of a salon, signed in: their Authorization header. */
  const signedInMember = async (
    role: 'owner' | 'manager' | 'staff',
    of: string = salonId,
    staffOverrides: Partial<NewStaff> = {},
  ): Promise<string> => {
    const { email } = await insertMember(db, role, of, staffOverrides)
    return (await signIn(app, email)).authorization
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    authorId = await insertCustomer(db)
    asAuthor = (await signedInUser(app, db, { customerId: authorId }))
      .authorization
    asOwner = await signedInMember('owner')
    staffId = await insertStaff(db, salonId)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const respond = (
    id: string,
    as: string | null = asOwner,
    body: string | object = { ownerResponse: RESPONSE },
  ) => authorized(request(app).post(`${REVIEWS}/${id}/respond`), as).send(body)

  const takeDown = (id: string, as: string | null = asOwner) =>
    respond(id, as, { ownerResponse: null })

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** Tokens that the operation refuses, before anything else is looked at. */
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

  /** The accounts that respond to no review, whatever they say. */
  const notResponders: [string, SignInAs][] = [
    ['a staff member of the salon', () => signedInMember('staff')],
    [
      'an account of a salon whose staff record is deleted',
      () => signedInMember('owner', salonId, DELETED),
    ],
    ['the author of the review', async () => asAuthor],
    [
      'another customer',
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

  describe('POST /api/v1/reviews/:id/respond', () => {
    it('writes the response of the salon for its owner: 200, with the review as anyone reads it; the review and the salon are not changed otherwise', async () => {
      const id = await insertReview()
      const other = await insertReview()
      const before = await storedReview(id)
      const otherBefore = await storedReview(other)
      const salonBefore = await storedSalon()
      const start = await databaseClock()

      const response = await respond(id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: expect.objectContaining({
          id,
          salonId,
          customerId: authorId,
          overallRating: 2,
          ownerResponse: RESPONSE,
          ownerRespondedAt: expect.stringMatching(ISO_TIMESTAMP),
        }),
        meta,
        links: { self: `${REVIEWS}/${id}`, list: REVIEWS },
      })
      expect((await request(app).get(`${REVIEWS}/${id}`)).body.data).toEqual(
        response.body.data,
      )
      const stored = await storedReview(id)
      expect(stored).toMatchObject({
        ownerResponse: RESPONSE,
        updatedAt: before?.updatedAt,
      })
      expect(stored?.ownerRespondedAt).toBeGreaterThanOrEqual(Math.floor(start))
      expect(Date.parse(response.body.data.ownerRespondedAt)).toBe(
        Math.floor(stored?.ownerRespondedAt ?? 0),
      )
      expect(await storedReview(other)).toEqual(otherBefore)
      expect(await storedSalon()).toEqual(salonBefore)
    })

    it('writes the response for a manager of the salon', async () => {
      const id = await insertReview()

      const response = await respond(id, await signedInMember('manager'))

      expect(response.status).toBe(200)
      expect(response.body.data.ownerResponse).toBe(RESPONSE)
      expect(await storedReview(id)).toMatchObject({ ownerResponse: RESPONSE })
    })

    it('replaces the response the salon wrote earlier, and the time it was written', async () => {
      const id = await insertReview(EARLIER)
      const start = await databaseClock()

      const response = await respond(id)

      expect(response.status).toBe(200)
      expect(response.body.data.ownerResponse).toBe(RESPONSE)
      const stored = await storedReview(id)
      expect(stored?.ownerResponse).toBe(RESPONSE)
      expect(stored?.ownerRespondedAt).toBeGreaterThanOrEqual(Math.floor(start))
    })

    it('writes nothing when the response is the one the salon wrote already: the time it was written stays', async () => {
      const id = await insertReview(EARLIER)
      const before = await storedReview(id)

      const response = await respond(id, asOwner, {
        ownerResponse: EARLIER.ownerResponse,
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject(EARLIER)
      expect(await storedReview(id)).toEqual(before)
      expect(before?.ownerRespondedAt).toBe(EARLIER_AT)
    })

    it('takes the response down: 200, with the review without it, and the time it was written goes with it', async () => {
      const id = await insertReview(EARLIER)
      const before = await storedReview(id)

      const response = await takeDown(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id,
        ownerResponse: null,
        ownerRespondedAt: null,
      })
      expect(response.body.links).toEqual({
        self: `${REVIEWS}/${id}`,
        list: REVIEWS,
      })
      expect(await storedReview(id)).toMatchObject({
        ownerResponse: null,
        ownerRespondedAt: null,
        updatedAt: before?.updatedAt,
      })
    })

    it('writes nothing when a review without a response is taken down', async () => {
      const id = await insertReview()
      const before = await storedReview(id)

      const response = await takeDown(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        ownerResponse: null,
        ownerRespondedAt: null,
      })
      expect(await storedReview(id)).toEqual(before)
    })

    it('takes the response of any salon down for an administrator', async () => {
      const otherSalon = await insertSalon(db)
      const id = await insertReview(EARLIER)
      const ofOtherSalon = await insertReview({
        ...EARLIER,
        salonId: otherSalon,
      })

      const responses = [
        await takeDown(id, asAdmin),
        await takeDown(ofOtherSalon, asAdmin),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      for (const reviewId of [id, ofOtherSalon]) {
        expect(await storedReview(reviewId)).toMatchObject({
          ownerResponse: null,
          ownerRespondedAt: null,
        })
      }
    })

    it('refuses a response an administrator writes: 403, and writes nothing', async () => {
      const id = await insertReview()
      const responded = await insertReview(EARLIER)
      const before = await storedReview(id)
      const respondedBefore = await storedReview(responded)

      expectProblem(await respond(id, asAdmin), forbidden)
      expectProblem(await respond(responded, asAdmin), forbidden)
      expect(await storedReview(id)).toEqual(before)
      expect(await storedReview(responded)).toEqual(respondedBefore)
    })

    it('keeps the response where anyone reads the review', async () => {
      const id = await insertReview()

      await respond(id)

      expect(
        (await request(app).get(`${REVIEWS}/${id}`)).body.data,
      ).toMatchObject({ id, ownerResponse: RESPONSE })
      expect(
        (await request(app).get(REVIEWS).query({ salonId })).body.data,
      ).toEqual([expect.objectContaining({ id, ownerResponse: RESPONSE })])
    })

    it('keeps the response as it was written, at any length', async () => {
      const id = await insertReview()
      const other = await insertReview()
      const spaced = '  ご来店ありがとうございました。\n\n店長より  '
      const long = '𠮷'.repeat(10000)

      const responses = [
        await respond(id, asOwner, { ownerResponse: spaced }),
        await respond(other, asOwner, { ownerResponse: long }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(responses[0]?.body.data.ownerResponse).toBe(spaced)
      expect((await storedReview(id))?.ownerResponse).toBe(spaced)
      expect((await storedReview(other))?.ownerResponse).toBe(long)
    })

    it('links the review under the mount path as the request wrote it', async () => {
      const id = await insertReview()

      const response = await authorized(
        request(app).post(`/API/V1/REVIEWS/${id}/respond?x=1`),
        asOwner,
      ).send({ ownerResponse: RESPONSE })

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: `/API/V1/REVIEWS/${id}`,
        list: '/API/V1/REVIEWS',
      })
    })

    it.each(notResponders)(
      'refuses %s, whether it writes a response or takes one down: 403, and writes nothing',
      async (_, signInAs) => {
        const id = await insertReview(EARLIER)
        const before = await storedReview(id)
        const as = await signInAs()

        expectProblem(await respond(id, as), forbidden)
        expectProblem(await takeDown(id, as), forbidden)
        expect(await storedReview(id)).toEqual(before)
      },
    )

    it.each(['owner', 'manager'] as const)(
      'refuses the %s of another salon: 403, and writes nothing',
      async (role) => {
        const id = await insertReview(EARLIER)
        const before = await storedReview(id)
        const as = await signedInMember(role, await insertSalon(db))

        expectProblem(await respond(id, as), forbidden)
        expectProblem(await takeDown(id, as), forbidden)
        expect(await storedReview(id)).toEqual(before)
      },
    )

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const id = await insertReview()
        const before = await storedReview(id)

        const response = await respond(id, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await storedReview(id)).toEqual(before)
      },
    )

    it.each<[string, object, string[]]>([
      ['a request without the response', {}, ['ownerResponse:invalid_type']],
      [
        'a blank response',
        { ownerResponse: ' \n\t　' },
        ['ownerResponse:invalid_format'],
      ],
      [
        'an empty response',
        { ownerResponse: '' },
        ['ownerResponse:invalid_format'],
      ],
      [
        'a response that is not text',
        { ownerResponse: 1 },
        ['ownerResponse:invalid_type'],
      ],
      [
        'a property the request does not have',
        { ownerResponse: RESPONSE, ownerRespondedAt: '2026-11-17T03:00:00Z' },
        ['ownerRespondedAt:unrecognized_keys'],
      ],
      ['a request that is not an object', [RESPONSE], [':invalid_type']],
    ])('refuses %s: 400, and writes nothing', async (_, body, rules) => {
      const id = await insertReview(EARLIER)
      const before = await storedReview(id)

      const response = await respond(id, asOwner, body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid review response')
      expect(brokenRules(response)).toEqual(rules)
      expect(await storedReview(id)).toEqual(before)
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const id = await insertReview()
      const before = await storedReview(id)
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).post(`${REVIEWS}/${id}/respond`), authorization)
          .set('Content-Type', 'application/json')
          .send('{"ownerResponse": "ありがとう"')

      const responses = [
        await notJson(null),
        await notJson(asAuthor),
        await notJson(asOwner),
        await authorized(request(app).post(`${REVIEWS}/${id}/respond`), null)
          .set('Content-Type', 'text/plain')
          .send(RESPONSE),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(await storedReview(id)).toEqual(before)
    })

    it('answers 404 for a review that is not there, removed already, or of a deleted salon, to a salon and to an administrator', async () => {
      const removed = await insertReview()
      const ofDeletedSalon = await insertReview(EARLIER)
      await authorized(request(app).delete(`${REVIEWS}/${removed}`), asAuthor)
      const responses = [await respond(UNKNOWN_ID), await respond(removed)]
      // The members of a deleted salon reach no salon: an administrator asks.
      await deleteSalon(salonId)
      const before = await storedReview(ofDeletedSalon)

      responses.push(await takeDown(ofDeletedSalon, asAdmin))

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses[1]?.body.detail).toBe(`Review ${removed} was not found`)
      expect(await storedReview(ofDeletedSalon)).toEqual(before)
    })

    it('finds the review by its ID in capitals, and refuses an ID that is not a UUID', async () => {
      const id = await insertReview()

      const notAnId = await respond(`${UNKNOWN_ID}0`)
      const found = await respond(id.toUpperCase())

      expectProblem(notAnId, badRequest)
      expect(notAnId.body.detail).toBe('Invalid review ID')
      expect(brokenRules(notAnId)).toEqual(['id:invalid_format'])
      expect(found.status).toBe(200)
      expect(found.body.data.id).toBe(id)
      expect(await storedReview(id)).toMatchObject({ ownerResponse: RESPONSE })
    })

    it('checks a response in order: the token, the account, the ID, the request, what an administrator says, the review, its salon', async () => {
      const ofOtherSalon = await insertReview({
        salonId: await insertSalon(db),
      })
      const blank = { ownerResponse: ' ' }

      const responses = [
        await respond('latest', null, blank),
        await respond('latest', asAuthor, blank),
        await respond('latest', asAdmin, blank),
        await respond(UNKNOWN_ID, asAdmin, blank),
        await respond(UNKNOWN_ID, asAdmin),
        await takeDown(UNKNOWN_ID, asAdmin),
        await respond(UNKNOWN_ID),
        await respond(ofOtherSalon),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '400 id:invalid_format',
        '400 ownerResponse:invalid_format',
        '403 1005',
        '404 3001',
        '404 3001',
        '403 1005',
      ])
    })

    it('serves no other method on the response to a review', async () => {
      const id = await insertReview()
      const before = await storedReview(id)

      for (const call of [
        request(app).get(`${REVIEWS}/${id}/respond`),
        request(app).put(`${REVIEWS}/${id}/respond`),
        request(app).patch(`${REVIEWS}/${id}/respond`),
        request(app).delete(`${REVIEWS}/${id}/respond`),
        request(app).post(`${REVIEWS}/respond`),
        request(app).post(`${REVIEWS}/${id}/response`),
      ]) {
        expectProblem(
          await authorized(call, asOwner).send({ ownerResponse: RESPONSE }),
          routeNotFound,
        )
      }
      expect(await storedReview(id)).toEqual(before)
    })
  })

  describe('requests at the same time', () => {
    it('writes the responses of the owner and a manager one after the other: each gets the review with its own, and the later one stays', async () => {
      const id = await insertReview()
      const asManager = await signedInMember('manager')
      const fromOwner = 'オーナーより、ご来店ありがとうございました。'
      const fromManager = '店長より、ご来店ありがとうございました。'

      const responses = await Promise.all([
        respond(id, asOwner, { ownerResponse: fromOwner }),
        respond(id, asManager, { ownerResponse: fromManager }),
      ])

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(responses.map(({ body }) => body.data.ownerResponse)).toEqual([
        fromOwner,
        fromManager,
      ])
      const later = responses.toSorted((a, b) =>
        a.body.data.ownerRespondedAt.localeCompare(
          b.body.data.ownerRespondedAt,
        ),
      )[1]
      expect((await storedReview(id))?.ownerResponse).toBe(
        later?.body.data.ownerResponse,
      )
    })

    it('waits for the review while it is held, and writes the response at the time it is written', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld, released } = await db.transaction(
        async (tx: Transaction) => {
          // As a mark or a report that is under way holds it.
          await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.id, id))
            .for('no key update')
          const underWay = respond(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            released: await databaseClock(),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expect((await pending).status).toBe(200)
      expect((await storedReview(id))?.ownerRespondedAt).toBeGreaterThanOrEqual(
        Math.floor(released),
      )
    })

    it('compares the response with the one written while it waited, and writes nothing when they are the same', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          // As another response of the salon that is under way writes it.
          await tx.update(reviews).set(EARLIER).where(eq(reviews.id, id))
          const underWay = respond(id, asOwner, {
            ownerResponse: EARLIER.ownerResponse,
          }).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject(EARLIER)
      expect((await storedReview(id))?.ownerRespondedAt).toBe(EARLIER_AT)
    })

    it('waits for a change of the review under way, and keeps what it wrote', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .update(reviews)
            .set({ comment: '追記しました' })
            .where(eq(reviews.id, id))
          const underWay = respond(id).then((response) => response)
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        comment: '追記しました',
        ownerResponse: RESPONSE,
      })
    })

    it('answers 404 to a response that waited for the removal of its review', async () => {
      const id = await insertReview()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx.delete(reviews).where(eq(reviews.id, id))
          const underWay = respond(id).then((response) => response)
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
        'its salon, held as a review of the salon that is written holds it',
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
    ])('responds past %s', async (_, hold) => {
      const id = await insertReview()

      const answered = await db.transaction(async (tx: Transaction) => {
        await hold(tx, id)
        return answersWithin(respond(id), 2000)
      })

      expect(answered).toBe(true)
      expect(await storedReview(id)).toMatchObject({ ownerResponse: RESPONSE })
    })
  })
})
