import {
  bookings,
  customers,
  reviews,
  salons,
  staff,
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
} from '../../../__tests__/_shared/auth-helpers'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  forbidden,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  invalidToken,
  notFound,
  request,
  routeNotFound,
  tokenExpired,
} from '../../../__tests__/_shared/test-helpers'

const REVIEWS = '/api/v1/reviews'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const INVALID_UPDATE = 'Invalid review update'
const IMAGE_URL = 'https://images.example.com/reviews/after.jpg'

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

describe('Review changes API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** Another salon, with reviews of its own. */
  let otherSalonId: string
  /** The customer of most tests, who wrote the reviews. */
  let customerId: string
  /** The Authorization header of the customer. */
  let asCustomer: string
  /** Another customer, with an account of their own. */
  let otherCustomerId: string
  let asOtherCustomer: string
  /** The staff member in charge of the bookings of the tests. */
  let staffId: string

  type NewBooking = typeof bookings.$inferInsert
  type NewReview = typeof reviews.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A completed booking of the customer at the salon. */
  const bookingRow = (overrides: Partial<NewBooking> = {}): NewBooking => ({
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
    status: 'completed',
    actualStartTime: at('01:00'),
    completedAt: at('02:00'),
    ...overrides,
  })

  /** A completed booking of the customer at the salon, written directly; returns its ID. */
  const insertBooking = async (
    overrides: Partial<NewBooking> = {},
  ): Promise<string> => {
    const [booking] = await db
      .insert(bookings)
      .values(bookingRow(overrides))
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    return booking.id
  }

  /**
   * A review written directly, of a booking of its own: four stars at the
   * salon of the tests, by the customer, naming the staff member, written
   * an hour ago, unless said otherwise. The salon is counted as a review
   * written through the API counts it. Returns its ID.
   */
  const insertReview = async (
    overrides: Partial<NewReview> = {},
  ): Promise<string> => {
    const of = overrides.salonId ?? salonId
    const by = overrides.customerId ?? customerId
    const bookingId =
      overrides.bookingId ??
      (await insertBooking({ salonId: of, customerId: by }))
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const [review] = await db
      .insert(reviews)
      .values({
        salonId: of,
        customerId: by,
        bookingId,
        staffId,
        overallRating: 4,
        serviceRating: 5,
        staffRating: 4,
        title: '丁寧なカット',
        comment: '仕上がりに満足しています。',
        imageUrls: [IMAGE_URL],
        isVerified: true,
        createdAt: hourAgo,
        updatedAt: hourAgo,
        ...overrides,
      })
      .returning({ id: reviews.id })
    if (review === undefined) {
      throw new Error('No review was inserted')
    }
    await countSalon(of)
    return review.id
  }

  /**
   * Gives a salon the figures of its reviews and a time of change an hour
   * ago, as if the API had written its reviews then.
   */
  const countSalon = async (of: string): Promise<void> => {
    await getTestDbClient()`
      UPDATE salons s
      SET rating = (SELECT round(avg(r."overallRating"), 2) FROM reviews r WHERE r."salonId" = s.id),
          "reviewCount" = (SELECT count(*) FROM reviews r WHERE r."salonId" = s.id),
          "updatedAt" = now() - interval '1 hour'
      WHERE s.id = ${of}
    `
  }

  /** What a salon says of its reviews, and the moment it was last written. */
  const storedSalon = async (of: string = salonId) => {
    const [row] = await db
      .select({
        rating: salons.rating,
        reviewCount: salons.reviewCount,
        writtenAt: epochMs(salons.updatedAt),
      })
      .from(salons)
      .where(eq(salons.id, of))
    if (row === undefined) {
      throw new Error('No salon was found')
    }
    return row
  }

  /** A review as it is stored, with its times as epoch milliseconds; undefined when it is gone. */
  const storedReview = async (id: string) => {
    const [row] = await db
      .select({
        id: reviews.id,
        salonId: reviews.salonId,
        customerId: reviews.customerId,
        bookingId: reviews.bookingId,
        staffId: reviews.staffId,
        overallRating: reviews.overallRating,
        serviceRating: reviews.serviceRating,
        staffRating: reviews.staffRating,
        atmosphereRating: reviews.atmosphereRating,
        cleanlinessRating: reviews.cleanlinessRating,
        valueRating: reviews.valueRating,
        title: reviews.title,
        comment: reviews.comment,
        imageUrls: reviews.imageUrls,
        isVerified: reviews.isVerified,
        helpfulCount: reviews.helpfulCount,
        reportCount: reviews.reportCount,
        ownerResponse: reviews.ownerResponse,
        createdAt: epochMs(reviews.createdAt),
        updatedAt: epochMs(reviews.updatedAt),
      })
      .from(reviews)
      .where(eq(reviews.id, id))
    return row
  }

  const DELETED = { deletedAt: '2026-11-01T00:00:00.000Z' }

  const deleteSalon = (id: string) =>
    db.update(salons).set(DELETED).where(eq(salons.id, id))
  const deleteCustomer = (id: string) =>
    db.update(customers).set(DELETED).where(eq(customers.id, id))

  /** The moment of the clock a change is written by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    otherSalonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    customerId = await insertCustomer(db)
    asCustomer = (await signedInUser(app, db, { customerId })).authorization
    otherCustomerId = await insertCustomer(db)
    asOtherCustomer = (
      await signedInUser(app, db, { customerId: otherCustomerId })
    ).authorization
    staffId = await insertStaff(db, salonId)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A body of a request, whether it keeps the rules or not. */
  type Body = Record<string, unknown>

  const update = (id: string, body: Body, as: string | null = asCustomer) =>
    authorized(request(app).patch(`${REVIEWS}/${id}`), as).send(body)
  const remove = (id: string, as: string | null = asCustomer) =>
    authorized(request(app).delete(`${REVIEWS}/${id}`), as)
  const create = (body: Body, as: string | null = asCustomer) =>
    authorized(request(app).post(REVIEWS), as).send(body)

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

  /** The members of a salon, and accounts that are no customers with a profile. */
  const membersAndProfileless: [string, SignInAs][] = [
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

  /** Tokens that a change and a removal refuse, before anything else is looked at. */
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

  describe('PATCH /api/v1/reviews/:id', () => {
    it('changes what the request names and nothing else: 200, with the review', async () => {
      const id = await insertReview({
        helpfulCount: 3,
        reportCount: 1,
        ownerResponse: 'ご来店ありがとうございました。',
        ownerRespondedAt: '2026-11-21T00:30:00Z',
      })
      const before = await storedReview(id)

      const response = await update(id, {
        overallRating: 2,
        title: '二度目は残念でした',
        comment: null,
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body.data).toEqual({
        ...(await request(app).get(`${REVIEWS}/${id}`)).body.data,
        overallRating: 2,
        title: '二度目は残念でした',
        comment: null,
      })
      expect(response.body.data).toMatchObject({
        id,
        salonId,
        customerId,
        staffId,
        serviceRating: 5,
        staffRating: 4,
        imageUrls: [IMAGE_URL],
        isVerified: true,
        helpfulCount: 3,
        reportCount: 1,
        ownerResponse: 'ご来店ありがとうございました。',
        ownerRespondedAt: '2026-11-21T00:30:00.000Z',
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(response.body.meta).toEqual({
        correlationId: expect.any(String),
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
        version: expect.any(String),
      })
      expect(response.body.links).toEqual({
        self: `${REVIEWS}/${id}`,
        list: REVIEWS,
      })
      const after = await storedReview(id)
      expect(after).toEqual({
        ...before,
        overallRating: 2,
        title: '二度目は残念でした',
        comment: null,
        updatedAt: expect.any(Number),
      })
      expect(after?.updatedAt).toBeGreaterThan(before?.updatedAt ?? Infinity)
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThan(
        Date.parse(response.body.data.createdAt),
      )
    })

    it('changes every rating, clears what may be null, and replaces the images', async () => {
      const id = await insertReview({ imageUrls: [IMAGE_URL] })
      const images = [
        'https://images.example.com/reviews/1.jpg',
        'http://images.example.com/reviews/2.jpg',
      ]

      const changed = await update(id, {
        overallRating: 5,
        serviceRating: null,
        staffRating: 1,
        atmosphereRating: 2,
        cleanlinessRating: 3,
        valueRating: null,
        imageUrls: images,
      })
      const cleared = await update(id, { imageUrls: [], title: null })

      expect(changed.body.data).toMatchObject({
        overallRating: 5,
        serviceRating: null,
        staffRating: 1,
        atmosphereRating: 2,
        cleanlinessRating: 3,
        valueRating: null,
        imageUrls: images,
      })
      expect(cleared.status).toBe(200)
      expect(await storedReview(id)).toMatchObject({
        overallRating: 5,
        staffRating: 1,
        imageUrls: [],
        title: null,
        comment: '仕上がりに満足しています。',
      })
    })

    it('counts the rating of the salon again when the overall rating changes', async () => {
      await insertReview({ overallRating: 5 })
      await insertReview({ overallRating: 5 })
      const id = await insertReview({ overallRating: 4 })
      await insertReview({ salonId: otherSalonId, overallRating: 1 })
      const before = await storedSalon()
      const otherBefore = await storedSalon(otherSalonId)

      const response = await update(id, { overallRating: 1 })

      expect(response.status).toBe(200)
      const after = await storedSalon()
      expect(before).toMatchObject({ rating: '4.67', reviewCount: 3 })
      // 11 stars of 3 reviews: 3.666…
      expect(after).toMatchObject({ rating: '3.67', reviewCount: 3 })
      expect(after.writtenAt).toBeGreaterThan(before.writtenAt)
      expect(await storedSalon(otherSalonId)).toEqual(otherBefore)
      expect(
        (await request(app).get(`/api/v1/salons/${salonId}/reviews/summary`))
          .body.data,
      ).toMatchObject({ averageRating: 3.67, totalReviews: 3 })
    })

    it.each<[string, Body]>([
      ['names no overall rating', { title: '追記', serviceRating: 1 }],
      ['gives the overall rating it has', { overallRating: 4 }],
    ])('does not write the salon when the change %s', async (_, change) => {
      const id = await insertReview({ overallRating: 4 })
      const before = await storedSalon()

      expect((await update(id, change)).status).toBe(200)

      expect(await storedSalon()).toEqual(before)
    })

    it('takes a staff rating of a review that names a staff member, who may be deleted since', async () => {
      const id = await insertReview({ staffId, staffRating: 4 })
      await db.update(staff).set(DELETED).where(eq(staff.id, staffId))

      const response = await update(id, { staffRating: 2 })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ staffId, staffRating: 2 })
    })

    it('refuses a staff rating of a review that names no staff member: 400, and changes nothing', async () => {
      const id = await insertReview({ staffId: null, staffRating: null })
      const before = await storedReview(id)

      const response = await update(id, { staffRating: 4, title: '追記' })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_UPDATE)
      expect(response.body.errors).toMatchObject([
        {
          field: 'staffRating',
          rule: 'custom',
          message: 'Must be null when the review names no staff member',
        },
      ])
      expect(await storedReview(id)).toEqual(before)
      expect((await update(id, { staffRating: null })).status).toBe(200)
    })

    it.each<[string, Body, string[]]>([
      ['a change that names nothing', {}, [':custom']],
      [
        'what a change does not write',
        { title: '追記', salonId: UNKNOWN_ID, isVerified: false },
        ['salonId:unrecognized_keys', 'isVerified:unrecognized_keys'],
      ],
      [
        'an overall rating of null',
        { overallRating: null },
        ['overallRating:invalid_type'],
      ],
      ['a rating of 6', { valueRating: 6 }, ['valueRating:too_big']],
      ['a blank comment', { comment: ' ' }, ['comment:invalid_format']],
      [
        'a title of 256 characters',
        { title: 'あ'.repeat(256) },
        ['title:too_big'],
      ],
      ['images that are null', { imageUrls: null }, ['imageUrls:invalid_type']],
      [
        'an image that is not of http or https, and one twice',
        { imageUrls: ['ftp://images.example.com/a.jpg', IMAGE_URL, IMAGE_URL] },
        ['imageUrls.0:invalid_format', 'imageUrls.2:custom'],
      ],
    ])('refuses %s: 400, and changes nothing', async (_, body, rules) => {
      const id = await insertReview()
      const before = await storedReview(id)

      const response = await update(id, body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_UPDATE)
      expect(brokenRules(response)).toEqual(rules)
      expect(await storedReview(id)).toEqual(before)
    })

    it.each(membersAndProfileless)(
      'refuses %s: 403, and changes nothing',
      async (_, signInAs) => {
        const id = await insertReview()
        const before = await storedReview(id)

        expectProblem(
          await update(id, { overallRating: 1 }, await signInAs()),
          forbidden,
        )
        expect(await storedReview(id)).toEqual(before)
      },
    )

    it('refuses an administrator: 403, a review is changed by its author alone', async () => {
      const id = await insertReview()

      expectProblem(await update(id, { overallRating: 1 }, asAdmin), forbidden)
      expect(await storedReview(id)).toMatchObject({ overallRating: 4 })
    })

    it('refuses a review of another customer: 403, and changes nothing', async () => {
      const theirs = await insertReview({ customerId: otherCustomerId })
      const before = await storedReview(theirs)
      const salonBefore = await storedSalon()

      expectProblem(await update(theirs, { overallRating: 1 }), forbidden)
      expect(await storedReview(theirs)).toEqual(before)
      expect(await storedSalon()).toEqual(salonBefore)
    })

    it('refuses a customer who was deleted behind the link of the account, even for their own review', async () => {
      const id = await insertReview()
      await deleteCustomer(customerId)

      expectProblem(await update(id, { overallRating: 1 }), forbidden)
      expect(await storedReview(id)).toMatchObject({ overallRating: 4 })
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const id = await insertReview()

        const response = await update(id, { overallRating: 1 }, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await storedReview(id)).toMatchObject({ overallRating: 4 })
      },
    )

    it('answers 404 for a review that is not there, or of a deleted salon', async () => {
      const id = await insertReview()

      const unknown = await update(UNKNOWN_ID, { overallRating: 1 })
      await deleteSalon(salonId)
      const ofDeletedSalon = await update(id, { overallRating: 1 })

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Review ${UNKNOWN_ID} was not found`)
      expectProblem(ofDeletedSalon, notFound)
      expect(ofDeletedSalon.body.detail).toBe(`Review ${id} was not found`)
      expect(await storedReview(id)).toMatchObject({ overallRating: 4 })
    })

    it('finds the review by its ID in capitals, and refuses an ID that is not a UUID', async () => {
      const id = await insertReview()

      const found = await update(id.toUpperCase(), { overallRating: 3 })
      const notAnId = await update('latest', { overallRating: 3 })

      expect(found.body.data).toMatchObject({ id, overallRating: 3 })
      expectProblem(notAnId, badRequest)
      expect(notAnId.body.detail).toBe('Invalid review ID')
      expect(brokenRules(notAnId)).toEqual(['id:invalid_format'])
    })

    it('answers a body it cannot read before it looks at the token or the account', async () => {
      const id = await insertReview()
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).patch(`${REVIEWS}/${id}`), authorization)
          .set('Content-Type', 'application/json')
          .send('{"overallRating": 1')

      const responses = [
        await notJson(null),
        await notJson(asAdmin),
        await notJson(asCustomer),
        await authorized(request(app).patch(`${REVIEWS}/${id}`), asCustomer)
          .set('Content-Type', 'text/plain')
          .send('one star'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(await storedReview(id)).toMatchObject({ overallRating: 4 })
    })

    it('checks a change in order: the token, the account, the ID, the request, the review, its author, the staff rating', async () => {
      const ownWithoutStaff = await insertReview({
        staffId: null,
        staffRating: null,
      })
      const theirs = await insertReview({
        customerId: otherCustomerId,
        staffId: null,
        staffRating: null,
      })
      const invalid = { overallRating: 0, salonId }

      const responses = [
        await update('latest', invalid, null),
        await update('latest', invalid, asAdmin),
        await update('latest', invalid),
        await update(UNKNOWN_ID, invalid),
        await update(UNKNOWN_ID, { staffRating: 4 }),
        await update(theirs, { staffRating: 4 }),
        await update(ownWithoutStaff, { staffRating: 4 }),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '400 id:invalid_format',
        '400 overallRating:too_small salonId:unrecognized_keys',
        '404 3001',
        '403 1005',
        '400 staffRating:custom',
      ])
    })

    it('links to the review at the spelling of the mount path', async () => {
      const id = await insertReview()

      const response = await authorized(
        request(app).patch(`/API/V1/REVIEWS/${id}?x=1`),
        asCustomer,
      ).send({ overallRating: 5 })

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: `/API/V1/REVIEWS/${id}`,
        list: '/API/V1/REVIEWS',
      })
    })
  })

  describe('DELETE /api/v1/reviews/:id', () => {
    it('removes a review of the customer for its author: 204, and counts the salon again', async () => {
      await insertReview({ overallRating: 5 })
      const id = await insertReview({ overallRating: 2 })
      await insertReview({ salonId: otherSalonId, overallRating: 1 })
      const before = await storedSalon()
      const otherBefore = await storedSalon(otherSalonId)

      const response = await remove(id)

      expect(response.status).toBe(204)
      expect(response.body).toEqual({})
      expect(response.headers['content-type']).toBeUndefined()
      expect(await storedReview(id)).toBeUndefined()
      expect(await db.$count(reviews)).toBe(2)
      const after = await storedSalon()
      expect(before).toMatchObject({ rating: '3.50', reviewCount: 2 })
      expect(after).toMatchObject({ rating: '5.00', reviewCount: 1 })
      expect(after.writtenAt).toBeGreaterThan(before.writtenAt)
      expect(await storedSalon(otherSalonId)).toEqual(otherBefore)
      expectProblem(await request(app).get(`${REVIEWS}/${id}`), notFound)
    })

    it('counts the salon again when the average stays and the count does not', async () => {
      await insertReview({ overallRating: 4 })
      const id = await insertReview({ overallRating: 4 })

      expect((await remove(id)).status).toBe(204)

      expect(await storedSalon()).toMatchObject({
        rating: '4.00',
        reviewCount: 1,
      })
    })

    it('leaves a salon without reviews without a rating', async () => {
      const id = await insertReview({ overallRating: 3 })

      expect((await remove(id)).status).toBe(204)

      expect(await storedSalon()).toMatchObject({
        rating: null,
        reviewCount: 0,
      })
      expect(
        (await request(app).get(`/api/v1/salons/${salonId}/reviews/summary`))
          .body.data,
      ).toMatchObject({ averageRating: null, totalReviews: 0 })
    })

    it('removes a review of any customer for an administrator, whatever became of its author', async () => {
      const theirs = await insertReview({ customerId: otherCustomerId })
      const own = await insertReview()
      await deleteCustomer(customerId)

      expect((await remove(theirs, asAdmin)).status).toBe(204)
      expect((await remove(own, asAdmin)).status).toBe(204)

      expect(await db.$count(reviews)).toBe(0)
      expect(await storedSalon()).toMatchObject({
        rating: null,
        reviewCount: 0,
      })
    })

    it('frees the booking: it may be deleted, or reviewed again', async () => {
      const deletedAfter = await insertBooking()
      const reviewedAgain = await insertBooking()
      const first = await insertReview({ bookingId: deletedAfter })
      const second = await insertReview({ bookingId: reviewedAgain })
      const deleteBooking = () =>
        authorized(
          request(app).delete(`/api/v1/bookings/${deletedAfter}`),
          asAdmin,
        )
      expect((await deleteBooking()).status).toBe(409)

      await remove(first)
      await remove(second)
      const again = await create({
        salonId,
        customerId,
        bookingId: reviewedAgain,
        staffId,
        overallRating: 5,
        serviceRating: null,
        staffRating: null,
        atmosphereRating: null,
        cleanlinessRating: null,
        valueRating: null,
        title: null,
        comment: null,
        imageUrls: [],
      })

      expect((await deleteBooking()).status).toBe(204)
      expect(again.status).toBe(201)
      expect(await storedSalon()).toMatchObject({
        rating: '5.00',
        reviewCount: 1,
      })
    })

    it.each(membersAndProfileless)(
      'refuses %s: 403, and removes nothing',
      async (_, signInAs) => {
        const id = await insertReview()
        const before = await storedSalon()

        expectProblem(await remove(id, await signInAs()), forbidden)
        expect(await storedReview(id)).toBeDefined()
        expect(await storedSalon()).toEqual(before)
      },
    )

    it('refuses a review of another customer: 403, and removes nothing', async () => {
      const theirs = await insertReview({ customerId: otherCustomerId })

      expectProblem(await remove(theirs), forbidden)
      expect(await storedReview(theirs)).toBeDefined()
      expect((await remove(theirs, asOtherCustomer)).status).toBe(204)
    })

    it('refuses a customer who was deleted behind the link of the account, even for their own review', async () => {
      const id = await insertReview()
      await deleteCustomer(customerId)

      expectProblem(await remove(id), forbidden)
      expect(await storedReview(id)).toBeDefined()
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const id = await insertReview()

        const response = await remove(id, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await storedReview(id)).toBeDefined()
      },
    )

    it('answers 404 for a review that is not there, removed already, or of a deleted salon', async () => {
      const removed = await insertReview()
      const ofDeletedSalon = await insertReview()
      expect((await remove(removed)).status).toBe(204)
      await deleteSalon(salonId)

      const responses = [
        await remove(UNKNOWN_ID, asAdmin),
        await remove(removed),
        await remove(ofDeletedSalon),
        await remove(ofDeletedSalon, asAdmin),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses[1]?.body.detail).toBe(`Review ${removed} was not found`)
      expect(await storedReview(ofDeletedSalon)).toBeDefined()
    })

    it('finds the review by its ID in capitals, and refuses an ID that is not a UUID', async () => {
      const id = await insertReview()

      const notAnId = await remove(`${UNKNOWN_ID}0`, asAdmin)
      const found = await remove(id.toUpperCase())

      expectProblem(notAnId, badRequest)
      expect(notAnId.body.detail).toBe('Invalid review ID')
      expect(brokenRules(notAnId)).toEqual(['id:invalid_format'])
      expect(found.status).toBe(204)
      expect(await storedReview(id)).toBeUndefined()
    })

    it('checks a removal in order: the token, the account, the ID, the review, its author', async () => {
      const theirs = await insertReview({ customerId: otherCustomerId })

      const responses = [
        await remove('latest', null),
        await remove('latest', await member('owner')()),
        await remove('latest'),
        await remove(UNKNOWN_ID),
        await remove(theirs),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '400 id:invalid_format',
        '404 3001',
        '403 1005',
      ])
    })

    it('serves no other method on a review', async () => {
      const id = await insertReview()

      for (const call of [
        request(app).post(`${REVIEWS}/${id}`),
        request(app).put(`${REVIEWS}/${id}`).send({ overallRating: 1 }),
        request(app).delete(REVIEWS),
        request(app).patch(REVIEWS).send({ overallRating: 1 }),
      ]) {
        expectProblem(await authorized(call, asCustomer), routeNotFound)
      }
      expect(await storedReview(id)).toMatchObject({ overallRating: 4 })
    })
  })

  describe('requests at the same time', () => {
    it('waits for the review while it is held, and checks it as the one it waited for left it', async () => {
      const id = await insertReview({ staffId, staffRating: 4 })

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          // As a staff member whose row is removed sets the review's to null.
          await tx
            .update(reviews)
            .set({ staffId: null, staffRating: null })
            .where(eq(reviews.id, id))
          const underWay = update(id, { staffRating: 5 }).then(
            (response) => response,
          )
          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(outcomeOf(response)).toBe('400 staffRating:custom')
      expect(await storedReview(id)).toMatchObject({
        staffId: null,
        staffRating: null,
      })
    })

    it.each<[string, (id: string) => Promise<Response>]>([
      ['a change', (id) => update(id, { overallRating: 1 })],
      ['a removal', (id) => remove(id)],
    ])('holds no salon while %s waits for its review', async (_, write) => {
      const id = await insertReview()
      const bookingId = await insertBooking()

      const { waiting, written } = await db.transaction(
        async (tx: Transaction) => {
          // Held for share, the review is still written by no one else: a
          // write that held it so would hold the salon while it waits to
          // write the review.
          await tx
            .select({ id: reviews.id })
            .from(reviews)
            .where(eq(reviews.id, id))
            .for('share')
          const underWay = write(id).then((response) => response)
          await pause(300)
          // Another review of the salon goes on meanwhile.
          const other = create({
            salonId,
            customerId,
            bookingId,
            staffId,
            overallRating: 5,
            serviceRating: null,
            staffRating: null,
            atmosphereRating: null,
            cleanlinessRating: null,
            valueRating: null,
            title: null,
            comment: null,
            imageUrls: [],
          }).then((response) => response)
          return {
            waiting: underWay,
            written: await answersWithin(other, 2000),
          }
        },
      )

      expect(written).toBe(true)
      expect((await waiting).status).toBeLessThan(300)
      const [counted] = await getTestDbClient()<
        { rating: string | null; reviews: number }[]
      >`
          SELECT round(avg("overallRating"), 2)::text AS rating, count(*)::int AS reviews
          FROM reviews WHERE "salonId" = ${salonId}
        `
      expect(await storedSalon()).toMatchObject({
        rating: counted?.rating ?? null,
        reviewCount: counted?.reviews,
      })
    })

    it.each<
      [string, (id: string) => Promise<Response>, number, string, number]
    >([
      // 5, 1 and the 4 of meanwhile: 3.333…
      ['a change', (id) => update(id, { overallRating: 1 }), 4, '3.33', 3],
      // 5 and the 3 of meanwhile.
      ['a removal', (id) => remove(id), 3, '4.00', 2],
    ])(
      'waits for the salon while it is held, and counts it with what was written meanwhile, at the time %s is written',
      async (_, write, written, rating, reviewCount) => {
        await insertReview({ overallRating: 5 })
        const id = await insertReview({ overallRating: 4 })
        const meanwhile = await insertBooking()

        const { pending, answeredWhileHeld, released } = await db.transaction(
          async (tx: Transaction) => {
            // As a review that is being written holds it.
            await tx
              .select({ id: salons.id })
              .from(salons)
              .where(eq(salons.id, salonId))
              .for('no key update')
            const underWay = write(id).then((response) => response)
            const answered = await answersWithin(underWay, 300)
            await tx.insert(reviews).values({
              salonId,
              customerId,
              bookingId: meanwhile,
              overallRating: written,
            })
            return {
              pending: underWay,
              answeredWhileHeld: answered,
              released: await databaseClock(),
            }
          },
        )
        const response = await pending

        expect(answeredWhileHeld).toBe(false)
        expect(response.status).toBeLessThan(300)
        const salon = await storedSalon()
        expect(salon).toMatchObject({ rating, reviewCount })
        expect(salon.writtenAt).toBeGreaterThanOrEqual(Math.floor(released))
      },
    )

    it('writes a change that waited for its review at the time it is written', async () => {
      const id = await insertReview()

      const { pending, released } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .update(reviews)
            .set({ comment: '店員による追記' })
            .where(eq(reviews.id, id))
          const underWay = update(id, { title: '追記' }).then(
            (response) => response,
          )
          await pause(300)
          return { pending: underWay, released: await databaseClock() }
        },
      )
      const response = await pending

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        title: '追記',
        comment: '店員による追記',
      })
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThanOrEqual(
        Math.floor(released),
      )
    })

    it('counts every change and removal of a salon that come at the same time', async () => {
      const ids = []
      for (const overallRating of [5, 4, 3, 2, 1]) {
        ids.push(await insertReview({ overallRating }))
      }
      const [first, second, third, fourth, fifth] = ids
      const bookingId = await insertBooking()

      const responses = await Promise.all([
        update(first ?? '', { overallRating: 1 }),
        update(second ?? '', { overallRating: 5 }),
        remove(third ?? ''),
        remove(fourth ?? '', asAdmin),
        update(fifth ?? '', { overallRating: 3 }),
        create({
          salonId,
          customerId,
          bookingId,
          staffId,
          overallRating: 2,
          serviceRating: null,
          staffRating: null,
          atmosphereRating: null,
          cleanlinessRating: null,
          valueRating: null,
          title: null,
          comment: null,
          imageUrls: [],
        }),
      ])

      expect(responses.map(statusAndCode)).toEqual([
        '200',
        '200',
        '204',
        '204',
        '200',
        '201',
      ])
      // 1 + 5 + 3 + 2 stars of 4 reviews.
      expect(await storedSalon()).toMatchObject({
        rating: '2.75',
        reviewCount: 4,
      })
    })

    it.each<[string, (id: string) => Promise<Response>]>([
      ['a change', (id) => update(id, { overallRating: 1 })],
      ['a removal', (id) => remove(id)],
    ])('lets %s past a salon held by a foreign key', async (_, write) => {
      const id = await insertReview()

      const answered = await db.transaction(async (tx: Transaction) => {
        // A booking of the salon that is not committed yet holds the
        // salon FOR KEY SHARE.
        await tx.insert(bookings).values(bookingRow())
        return answersWithin(write(id), 2000)
      })

      expect(answered).toBe(true)
    })

    it('removes a review once when it is changed and removed at the same time', async () => {
      const id = await insertReview()

      const [changed, removed] = await Promise.all([
        update(id, { overallRating: 1 }),
        remove(id),
      ])

      expect(removed.status).toBe(204)
      expect(['200', '404 3001']).toContain(statusAndCode(changed))
      expect(await storedReview(id)).toBeUndefined()
      expect(await storedSalon()).toMatchObject({
        rating: null,
        reviewCount: 0,
      })
    })
  })
})
