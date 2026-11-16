import {
  bookingServices,
  bookings,
  customers,
  reviews,
  salons,
  services,
  staff,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  customerIdSchema,
  type ReviewCreateRequest,
  reviewIdSchema,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { ReviewRepository } from '@beauty-salon-backend/infrastructure'
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

const REVIEWS = '/api/v1/reviews'
const SALONS = '/api/v1/salons'
const STAFF = '/api/v1/staff'

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

const INVALID_REVIEW = 'Invalid review'
const INVALID_SEARCH = 'Invalid review search'
const NOT_COMPLETED =
  'The booking is not completed; a booking is reviewed once the visit took place'
const REVIEWED = 'The booking has a review already; a booking is reviewed once'

const IMAGE_URL = 'https://images.example.com/reviews/after.jpg'

/** The properties of a ReviewResponse. */
const PROPERTIES = [
  'atmosphereRating',
  'bookingId',
  'cleanlinessRating',
  'comment',
  'createdAt',
  'customerId',
  'helpfulCount',
  'id',
  'imageUrls',
  'isVerified',
  'overallRating',
  'ownerRespondedAt',
  'ownerResponse',
  'reportCount',
  'salonId',
  'serviceRating',
  'staffId',
  'staffRating',
  'title',
  'updatedAt',
  'valueRating',
]

/** The distribution of no reviews. */
const NO_RATINGS = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

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

/** An ID that sorts by its last number. */
const idOf = (last: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-${String(last).padStart(12, '0')}`

describe('Reviews API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** A salon the customer did not visit. */
  let otherSalonId: string
  /** The customer of most tests. */
  let customerId: string
  /** The Authorization header of the customer. */
  let asCustomer: string
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

  /**
   * A line of a booking with a staff member of its own, of a new service of
   * the salon, after the lines it has.
   */
  const insertLine = async (
    bookingId: string,
    lineStaffId: string | null,
  ): Promise<void> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId,
        name: 'Colour',
        duration: 60,
        price: 8800,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
      })
      .returning({ id: services.id })
    if (service === undefined) {
      throw new Error('No service was inserted')
    }
    await db.insert(bookingServices).values({
      bookingId,
      serviceId: service.id,
      staffId: lineStaffId,
      startTime: at('01:00'),
      endTime: at('02:00'),
      duration: 60,
      price: 8800,
      finalPrice: 8800,
      taxIncluded: true,
      sortOrder: await db.$count(
        bookingServices,
        eq(bookingServices.bookingId, bookingId),
      ),
    })
  }

  /**
   * A review written directly, four stars at the salon of the tests by the
   * customer unless said otherwise, of a booking of its own; returns its ID.
   */
  const insertReview = async (
    overrides: Partial<NewReview> = {},
  ): Promise<string> => {
    const of = overrides.salonId ?? salonId
    const by = overrides.customerId ?? customerId
    const bookingId =
      overrides.bookingId ??
      (await insertBooking({ salonId: of, customerId: by }))
    const [review] = await db
      .insert(reviews)
      .values({
        salonId: of,
        customerId: by,
        bookingId,
        overallRating: 4,
        isVerified: true,
        ...overrides,
      })
      .returning({ id: reviews.id })
    if (review === undefined) {
      throw new Error('No review was inserted')
    }
    return review.id
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

  const storedReviews = () =>
    db
      .select({
        id: reviews.id,
        bookingId: reviews.bookingId,
        overallRating: reviews.overallRating,
        createdAt: epochMs(reviews.createdAt),
      })
      .from(reviews)
      .orderBy(asc(reviews.createdAt))

  const DELETED = { deletedAt: '2026-11-01T00:00:00.000Z' }

  const deleteSalon = (id: string) =>
    db.update(salons).set(DELETED).where(eq(salons.id, id))
  const deleteStaff = (id: string) =>
    db.update(staff).set(DELETED).where(eq(staff.id, id))
  const deleteCustomer = (id: string) =>
    db.update(customers).set(DELETED).where(eq(customers.id, id))

  /** The moment of the clock a review is written by. */
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
    staffId = await insertStaff(db, salonId)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A review that keeps every rule, of the booking, by the customer of the tests. */
  const review = (
    bookingId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    salonId,
    customerId,
    bookingId,
    staffId,
    overallRating: 4,
    serviceRating: 5,
    staffRating: 5,
    atmosphereRating: 4,
    cleanlinessRating: null,
    valueRating: 3,
    title: '丁寧なカット',
    comment: '仕上がりに満足しています。',
    imageUrls: [IMAGE_URL],
    ...overrides,
  })

  /** A body of a request, whether it keeps the rules or not. */
  type Body = Record<string, unknown>

  const create = (body: Body, as: string | null = asCustomer) =>
    authorized(request(app).post(REVIEWS), as).send(body)
  const list = (query: Record<string, string> = {}, as: string | null = null) =>
    authorized(request(app).get(REVIEWS).query(query), as)
  const read = (id: string, as: string | null = null) =>
    authorized(request(app).get(`${REVIEWS}/${id}`), as)
  const salonSummary = (id: string, as: string | null = null) =>
    authorized(request(app).get(`${SALONS}/${id}/reviews/summary`), as)
  const staffSummary = (id: string, as: string | null = null) =>
    authorized(request(app).get(`${STAFF}/${id}/reviews/summary`), as)

  /** The IDs of a page, in its order. */
  const idsOf = (response: Response): string[] =>
    response.body.data.map(({ id }: { id: string }) => id)

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

  /** Accounts that write no review: a review is the voice of the customer. */
  const notReviewers: [string, SignInAs][] = [
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

  /** Tokens that writing refuses, before anything else is looked at. */
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

  /** Everyone who reads: a token is neither needed nor looked at. */
  const anyone: [string, () => Promise<string | null>][] = [
    ['a request without an access token', async () => null],
    [
      'a request with a token that names no session',
      async () => `Bearer ${'t'.repeat(43)}`,
    ],
    [
      'a request with an access token that has run out',
      async () =>
        (
          await insertSession(db, (await insertUser(db)).id, {
            expiresAt: minutesFromNow(-1),
          })
        ).authorization,
    ],
    [
      'a request with something that is no bearer token',
      async () => 'Basic abc',
    ],
    ['the customer', async () => asCustomer],
    ['an administrator', async () => asAdmin],
    ['a staff member of the salon', async () => member('staff')()],
  ]

  describe('POST /api/v1/reviews', () => {
    it('writes the review of a completed visit of the customer: 201, with every property', async () => {
      const bookingId = await insertBooking()

      const response = await create(review(bookingId))

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const { data } = response.body
      expect(Object.keys(data).sort()).toEqual(PROPERTIES)
      expect(data).toEqual({
        id: expect.stringMatching(UUID),
        salonId,
        customerId,
        bookingId,
        staffId,
        overallRating: 4,
        serviceRating: 5,
        staffRating: 5,
        atmosphereRating: 4,
        cleanlinessRating: null,
        valueRating: 3,
        title: '丁寧なカット',
        comment: '仕上がりに満足しています。',
        imageUrls: [IMAGE_URL],
        isVerified: true,
        helpfulCount: 0,
        reportCount: 0,
        ownerResponse: null,
        ownerRespondedAt: null,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: data.createdAt,
      })
      expect(response.headers['location']).toBe(`${REVIEWS}/${data.id}`)
      expect(response.body.meta).toEqual({
        correlationId: expect.any(String),
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
        version: expect.any(String),
      })
      expect(response.body.links).toEqual({
        self: `${REVIEWS}/${data.id}`,
        list: REVIEWS,
      })
      expect((await read(data.id)).body.data).toEqual(data)
    })

    it('counts the rating and the review count of the salon again from its reviews', async () => {
      await insertReview({ overallRating: 5 })
      await insertReview({ overallRating: 5 })
      await insertReview({ salonId: otherSalonId, overallRating: 1 })
      const before = await storedSalon()
      const otherBefore = await storedSalon(otherSalonId)

      const response = await create(
        review(await insertBooking(), { overallRating: 4 }),
      )

      expect(response.status).toBe(201)
      const after = await storedSalon()
      expect(before).toMatchObject({ rating: null, reviewCount: 0 })
      expect(after).toMatchObject({ rating: '4.67', reviewCount: 3 })
      expect(after.writtenAt).toBeGreaterThan(before.writtenAt)
      expect(await storedSalon(otherSalonId)).toEqual(otherBefore)
      // The salon and the summary of its reviews say the same.
      expect(
        (await request(app).get(`${SALONS}/${salonId}`)).body.data,
      ).toMatchObject({ rating: 4.67, reviewCount: 3 })
      expect((await salonSummary(salonId)).body.data).toEqual({
        averageRating: 4.67,
        totalReviews: 3,
        ratingDistribution: { ...NO_RATINGS, '4': 1, '5': 2 },
      })
    })

    it('rounds the rating of the salon half up to two decimals', async () => {
      for (const overallRating of [5, 5, 4, 4, 4, 4, 3]) {
        await insertReview({ overallRating })
      }

      await create(review(await insertBooking(), { overallRating: 4 }))

      // 33 stars of 8 reviews: 4.125.
      expect(await storedSalon()).toMatchObject({
        rating: '4.13',
        reviewCount: 8,
      })
      expect((await salonSummary(salonId)).body.data.averageRating).toBe(4.13)
    })

    it('writes the review of a staff member of a line of the booking, and one of no staff member', async () => {
      const second = await insertStaff(db, salonId)
      const bookingId = await insertBooking()
      await insertLine(bookingId, second)
      await insertLine(bookingId, null)

      const ofLine = await create(review(bookingId, { staffId: second }))
      const ofNone = await create(
        review(await insertBooking(), { staffId: null, staffRating: null }),
      )

      expect([ofLine.status, ofNone.status]).toEqual([201, 201])
      expect(ofLine.body.data).toMatchObject({
        staffId: second,
        staffRating: 5,
      })
      expect(ofNone.body.data).toMatchObject({
        staffId: null,
        staffRating: null,
      })
    })

    it('writes a review of the overall rating alone, without images, title or comment, the IDs in lower case', async () => {
      const bookingId = await insertBooking()

      const response = await create({
        salonId: salonId.toUpperCase(),
        customerId: customerId.toUpperCase(),
        bookingId: bookingId.toUpperCase(),
        staffId: staffId.toUpperCase(),
        overallRating: 1,
        serviceRating: null,
        staffRating: null,
        atmosphereRating: null,
        cleanlinessRating: null,
        valueRating: null,
        title: null,
        comment: null,
        imageUrls: [],
      })

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        salonId,
        customerId,
        bookingId,
        staffId,
        overallRating: 1,
        serviceRating: null,
        title: null,
        comment: null,
        imageUrls: [],
      })
    })

    it.each(notReviewers)(
      'refuses %s: 403, and writes nothing',
      async (_, signInAs) => {
        const bookingId = await insertBooking()

        expectProblem(
          await create(review(bookingId), await signInAs()),
          forbidden,
        )
        expect(await db.$count(reviews)).toBe(0)
      },
    )

    it('refuses a customer who was deleted behind the link of the account like an account without a profile', async () => {
      const bookingId = await insertBooking()
      await deleteCustomer(customerId)

      expectProblem(await create(review(bookingId)), forbidden)
      expect(await db.$count(reviews)).toBe(0)
      expect(await storedSalon()).toMatchObject({ reviewCount: 0 })
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_, tokenOf, problem, challenge) => {
        const response = await create(
          review(await insertBooking()),
          await tokenOf(),
        )

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await db.$count(reviews)).toBe(0)
      },
    )

    it('refuses a review written as another customer: 403', async () => {
      const other = await insertCustomer(db)
      const own = await insertBooking()
      const theirs = await insertBooking({ customerId: other })

      expectProblem(await create(review(own, { customerId: other })), forbidden)
      expectProblem(
        await create(review(theirs, { customerId: other })),
        forbidden,
      )
      expect(await db.$count(reviews)).toBe(0)
    })

    it.each<[string, Body, string[]]>([
      ['a rating above 5', { overallRating: 6 }, ['overallRating:too_big']],
      [
        'a rating of a staff member without one',
        { staffId: null },
        ['staffRating:custom'],
      ],
      [
        'a title and a comment that are blank',
        { title: ' ', comment: '' },
        ['title:invalid_format', 'comment:invalid_format'],
      ],
      [
        'a title of 256 characters',
        { title: 'あ'.repeat(256) },
        ['title:too_big'],
      ],
      [
        'an image twice',
        { imageUrls: [IMAGE_URL, IMAGE_URL] },
        ['imageUrls.1:custom'],
      ],
      [
        'an image that is not of http or https',
        { imageUrls: ['ftp://images.example.com/a.jpg'] },
        ['imageUrls.0:invalid_format'],
      ],
      [
        '11 images',
        {
          imageUrls: Array.from(
            { length: 11 },
            (_, index) => `https://images.example.com/${index}.jpg`,
          ),
        },
        ['imageUrls:too_big'],
      ],
      ['images that are null', { imageUrls: null }, ['imageUrls:invalid_type']],
      [
        'a property that is not of a review',
        { isVerified: false },
        ['isVerified:unrecognized_keys'],
      ],
      [
        'a booking that is not a UUID',
        { bookingId: 'BK-1' },
        ['bookingId:invalid_format'],
      ],
    ])('refuses %s: 400, and writes nothing', async (_, overrides, rules) => {
      const response = await create(review(await insertBooking(), overrides))

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_REVIEW)
      expect(brokenRules(response)).toEqual(rules)
      expect(await db.$count(reviews)).toBe(0)
    })

    it('refuses a booking that is not one of the customer: 400', async () => {
      const theirs = await insertBooking({
        customerId: await insertCustomer(db),
      })

      for (const bookingId of [UNKNOWN_ID, theirs]) {
        const response = await create(review(bookingId))

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          {
            field: 'bookingId',
            rule: 'not_found',
            message: 'Must name a booking of the customer',
            value: null,
            constraint: null,
          },
        ])
      }
      expect(await db.$count(reviews)).toBe(0)
    })

    it('refuses a salon that is not the one of the booking, and the salon of the booking once it is deleted: 400', async () => {
      const bookingId = await insertBooking()
      const responses = [
        await create(review(bookingId, { salonId: otherSalonId })),
        await create(review(bookingId, { salonId: UNKNOWN_ID })),
      ]
      await deleteSalon(salonId)
      responses.push(await create(review(bookingId)))

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          {
            field: 'salonId',
            rule: 'not_found',
            message: 'Must name the salon of the booking',
            value: null,
            constraint: null,
          },
        ])
      }
      expect(await db.$count(reviews)).toBe(0)
    })

    it('refuses a staff member who did not take the booking, or is deleted: 400', async () => {
      const other = await insertStaff(db, salonId)
      const ofLine = await insertStaff(db, salonId)
      const bookingId = await insertBooking()
      await insertLine(bookingId, ofLine)
      const responses = [
        await create(review(bookingId, { staffId: other })),
        await create(review(bookingId, { staffId: UNKNOWN_ID })),
      ]
      await deleteStaff(staffId)
      await deleteStaff(ofLine)
      responses.push(
        await create(review(bookingId)),
        await create(review(bookingId, { staffId: ofLine })),
      )

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['staffId:not_found'])
        expect(response.body.errors[0].message).toBe(
          'Must name a staff member who took the booking',
        )
      }
      expect(await db.$count(reviews)).toBe(0)
    })

    it.each<NewBooking['status']>([
      'draft',
      'pending',
      'confirmed',
      'in_progress',
      'cancelled',
      'no_show',
    ])('refuses a booking that is %s: 409', async (status) => {
      const response = await create(review(await insertBooking({ status })))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_COMPLETED)
      expect(await db.$count(reviews)).toBe(0)
    })

    it('refuses a second review of a booking: 409, and keeps the first and the count', async () => {
      const bookingId = await insertBooking()
      const first = await create(review(bookingId))

      const second = await create(review(bookingId, { overallRating: 1 }))

      expectProblem(second, notAllowed)
      expect(second.body.detail).toBe(REVIEWED)
      expect(await storedReviews()).toEqual([
        expect.objectContaining({ id: first.body.data.id, overallRating: 4 }),
      ])
      expect(await storedSalon()).toMatchObject({
        rating: '4.00',
        reviewCount: 1,
      })
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).post(REVIEWS), authorization)
          .set('Content-Type', 'application/json')
          .send('{"bookingId": "0193a5b8"')

      const responses = [
        await notJson(null),
        await notJson(asAdmin),
        await notJson(asCustomer),
        await authorized(request(app).post(REVIEWS), null)
          .set('Content-Type', 'text/plain')
          .send('five stars'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(await db.$count(reviews)).toBe(0)
    })

    it('checks a review in order: the token, the account, the request, the customer, the booking, the salon and the staff member, the status, an earlier review', async () => {
      const other = await insertCustomer(db)
      const pending = await insertBooking({ status: 'pending' })
      const done = await insertBooking()
      expect((await create(review(done))).status).toBe(201)
      const invalid = review(pending, { overallRating: 0, customerId: other })

      const responses = [
        await create(invalid, null),
        await create(invalid, asAdmin),
        await create(invalid),
        await create(review(UNKNOWN_ID, { customerId: other })),
        await create(review(UNKNOWN_ID, { salonId: otherSalonId })),
        await create(
          review(pending, { salonId: otherSalonId, staffId: UNKNOWN_ID }),
        ),
        await create(review(pending)),
        await create(review(done)),
      ]

      expect(
        responses.map((response) =>
          response.status === 400
            ? `400 ${brokenRules(response).join(' ')}`
            : statusAndCode(response),
        ),
      ).toEqual([
        '401 1001',
        '403 1005',
        '400 overallRating:too_small',
        '403 1005',
        '400 bookingId:not_found',
        '400 salonId:not_found staffId:not_found',
        '409 3003',
        '409 3003',
      ])
      expect(responses.at(-2)?.body.detail).toBe(NOT_COMPLETED)
      expect(responses.at(-1)?.body.detail).toBe(REVIEWED)
    })

    it('links to the review at the spelling of the mount path', async () => {
      const response = await authorized(
        request(app).post('/API/V1/REVIEWS?x=1'),
        asCustomer,
      ).send(review(await insertBooking()))

      expect(response.status).toBe(201)
      const { id } = response.body.data
      expect(response.headers['location']).toBe(`/API/V1/REVIEWS/${id}`)
      expect(response.body.links).toEqual({
        self: `/API/V1/REVIEWS/${id}`,
        list: '/API/V1/REVIEWS',
      })
    })

    it('serves no other method on the collection', async () => {
      for (const call of [
        request(app).put(REVIEWS),
        request(app).patch(REVIEWS),
        request(app).delete(REVIEWS),
      ]) {
        expectProblem(await authorized(call, asCustomer), routeNotFound)
      }
    })
  })

  describe('GET /api/v1/reviews/:id', () => {
    it.each(anyone)('answers %s with the review', async (_, tokenOf) => {
      const id = await insertReview({
        staffId,
        title: 'また来ます',
        imageUrls: [IMAGE_URL],
        helpfulCount: 3,
        ownerResponse: 'ご来店ありがとうございました。',
        ownerRespondedAt: '2026-11-21T00:30:00Z',
      })

      const response = await read(id, await tokenOf())

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body.data).toMatchObject({
        id,
        salonId,
        customerId,
        staffId,
        overallRating: 4,
        title: 'また来ます',
        imageUrls: [IMAGE_URL],
        helpfulCount: 3,
        ownerResponse: 'ご来店ありがとうございました。',
        ownerRespondedAt: '2026-11-21T00:30:00.000Z',
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(Object.keys(response.body.data).sort()).toEqual(PROPERTIES)
      expect(response.body.links).toEqual({
        self: `${REVIEWS}/${id}`,
        list: REVIEWS,
      })
    })

    it('keeps the review of a staff member and of a customer who were deleted', async () => {
      const id = await insertReview({ staffId })
      await deleteStaff(staffId)
      await deleteCustomer(customerId)

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ id, staffId, customerId })
    })

    it('answers 404 for a review that is not there, or of a deleted salon', async () => {
      const id = await insertReview()

      const unknown = await read(UNKNOWN_ID)
      await deleteSalon(salonId)
      const ofDeletedSalon = await read(id)

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Review ${UNKNOWN_ID} was not found`)
      expectProblem(ofDeletedSalon, notFound)
      expect(ofDeletedSalon.body.detail).toBe(`Review ${id} was not found`)
    })

    it('finds the review by its ID in capitals', async () => {
      const id = await insertReview()

      expect((await read(id.toUpperCase())).body.data.id).toBe(id)
    })

    it('refuses an ID that is not a UUID: 400', async () => {
      for (const id of ['latest', `${UNKNOWN_ID}0`]) {
        const response = await read(id)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid review ID')
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      }
    })

    it('links to the review at the spelling of the mount path', async () => {
      const id = await insertReview()

      const response = await request(app).get(`/API/V1/REVIEWS/${id}?x=1`)

      expect(response.body.links).toEqual({
        self: `/API/V1/REVIEWS/${id}`,
        list: '/API/V1/REVIEWS',
      })
    })

    it('serves no other method on a review, and none of the operations that are not implemented', async () => {
      const id = await insertReview()

      for (const call of [
        request(app).post(`${REVIEWS}/${id}`),
        request(app).put(`${REVIEWS}/${id}`),
        request(app)
          .post(`${REVIEWS}/${id}/report`)
          .send({ reason: 'spam', details: null }),
      ]) {
        expectProblem(await authorized(call, asCustomer), routeNotFound)
      }
      expect(await db.$count(reviews)).toBe(1)
    })
  })

  describe('GET /api/v1/reviews', () => {
    /**
     * Six reviews of the salon: the last number of their ID, their stars,
     * how many found each helpful and when it was written. The order of the
     * IDs is not that of the time, and every order has two reviews that
     * agree on its value and on the time.
     */
    const sixReviews = async () => {
      const written: [number, number, number, string][] = [
        [1, 3, 10, '2026-11-20T01:04:00Z'],
        [2, 5, 0, '2026-11-20T01:01:00Z'],
        [3, 4, 10, '2026-11-20T01:02:00Z'],
        [4, 5, 2, '2026-11-20T01:02:00Z'],
        [5, 1, 0, '2026-11-20T01:03:00Z'],
        [6, 5, 0, '2026-11-20T01:01:00Z'],
      ]
      for (const [last, overallRating, helpfulCount, createdAt] of written) {
        await insertReview({
          id: idOf(last),
          overallRating,
          helpfulCount,
          createdAt,
        })
      }
    }

    it('lists the reviews newest first, 20 a page, with the links of the page', async () => {
      await sixReviews()

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(idsOf(response)).toEqual([1, 5, 4, 3, 6, 2].map(idOf))
      expect(response.body.meta).toEqual({
        total: 6,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
      expect(response.body.links).toEqual({
        self: REVIEWS,
        first: REVIEWS,
        last: null,
        next: null,
        prev: null,
      })
      expect(Object.keys(response.body.data[0]).sort()).toEqual(PROPERTIES)
    })

    it('answers an empty page when there are no reviews', async () => {
      const response = await list()

      expect(response.body).toMatchObject({
        data: [],
        meta: { total: 0, hasMore: false, nextCursor: null },
      })
    })

    it.each(anyone)('answers %s', async (_, tokenOf) => {
      await insertReview()

      const response = await list({}, await tokenOf())

      expect(response.status).toBe(200)
      expect(response.body.meta.total).toBe(1)
    })

    it.each<[string, number[]]>([
      ['rating', [4, 6, 2, 3, 1, 5]],
      ['helpful', [1, 3, 4, 5, 6, 2]],
      ['recent', [1, 5, 4, 3, 6, 2]],
    ])(
      'orders by %s, then newest, then by the greater ID',
      async (sortBy, order) => {
        await sixReviews()

        expect(idsOf(await list({ sortBy }))).toEqual(order.map(idOf))
      },
    )

    it.each(['recent', 'rating', 'helpful'])(
      'walks through the pages of the order %s with the cursor of the previous page, one review a page',
      async (sortBy) => {
        await sixReviews()
        const all = idsOf(await list({ sortBy }))

        const walked: string[] = []
        let cursor: string | null = null
        let pages = 0
        do {
          const query: Record<string, string> = { sortBy, limit: '1' }
          if (cursor !== null) {
            query['cursor'] = cursor
          }
          const page: Response = await list(query)
          expect(page.body.meta).toMatchObject({ total: 6, limit: 1, cursor })
          walked.push(...idsOf(page))
          cursor = page.body.meta.nextCursor
          pages += 1
        } while (cursor !== null)

        expect(walked).toEqual(all)
        expect(pages).toBe(6)
      },
    )

    it('links to the next page with the query of the request', async () => {
      await sixReviews()

      const response = await list({ sortBy: 'rating', limit: '2' })

      expect(response.body.meta).toMatchObject({
        hasMore: true,
        nextCursor: idOf(6),
      })
      expect(response.body.links).toEqual({
        self: `${REVIEWS}?sortBy=rating&limit=2`,
        first: `${REVIEWS}?sortBy=rating&limit=2`,
        last: null,
        next: `${REVIEWS}?sortBy=rating&limit=2&cursor=${idOf(6)}`,
        prev: null,
      })
    })

    it('links the pages at the spelling of the mount path', async () => {
      await sixReviews()

      const response = await request(app).get('/API/V1/REVIEWS?limit=1')

      expect(response.body.links).toMatchObject({
        self: '/API/V1/REVIEWS?limit=1',
        next: `/API/V1/REVIEWS?limit=1&cursor=${idOf(1)}`,
      })
    })

    describe('filters', () => {
      /** The reviews of the filters, by name. */
      let named: Record<string, string>

      beforeEach(async () => {
        const other = await insertCustomer(db)
        const second = await insertStaff(db, salonId)
        named = {
          five: await insertReview({ overallRating: 5, staffId }),
          two: await insertReview({ overallRating: 2, staffId: second }),
          unverified: await insertReview({
            overallRating: 3,
            isVerified: false,
            customerId: other,
          }),
          elsewhere: await insertReview({
            salonId: otherSalonId,
            overallRating: 4,
          }),
        }
      })

      /** The names of the reviews of a response, in the order of the names. */
      const namesOf = (response: Response): string[] =>
        Object.entries(named)
          .filter(([, id]) => idsOf(response).includes(id))
          .map(([name]) => name)

      it('filters by the salon, the staff member, the customer and the booking', async () => {
        const [booking] = await db
          .select({ id: reviews.bookingId })
          .from(reviews)
          .where(eq(reviews.id, named['two'] ?? ''))

        expect(namesOf(await list({ salonId }))).toEqual([
          'five',
          'two',
          'unverified',
        ])
        expect(namesOf(await list({ staffId }))).toEqual(['five'])
        expect(namesOf(await list({ customerId }))).toEqual([
          'five',
          'two',
          'elsewhere',
        ])
        expect(namesOf(await list({ bookingId: booking?.id ?? '' }))).toEqual([
          'two',
        ])
      })

      it('filters by whether the visit was verified', async () => {
        expect(namesOf(await list({ isVerified: 'false' }))).toEqual([
          'unverified',
        ])
        expect(namesOf(await list({ isVerified: 'true' }))).toEqual([
          'five',
          'two',
          'elsewhere',
        ])
      })

      it('filters by the lowest and the highest overall rating, both included', async () => {
        expect(namesOf(await list({ minRating: '4' }))).toEqual([
          'five',
          'elsewhere',
        ])
        expect(namesOf(await list({ maxRating: '3' }))).toEqual([
          'two',
          'unverified',
        ])
        expect(namesOf(await list({ minRating: '3', maxRating: '4' }))).toEqual(
          ['unverified', 'elsewhere'],
        )
        expect(namesOf(await list({ minRating: '5', maxRating: '5' }))).toEqual(
          ['five'],
        )
      })

      it('combines the filters and counts what they leave', async () => {
        const response = await list({ salonId, minRating: '3', limit: '1' })

        expect(response.body.meta).toMatchObject({ total: 2, hasMore: true })
      })

      it('answers an empty page for an ID that nothing has', async () => {
        for (const filter of [
          'salonId',
          'staffId',
          'customerId',
          'bookingId',
        ]) {
          const response = await list({ [filter]: UNKNOWN_ID })

          expect(response.status).toBe(200)
          expect(response.body.meta.total).toBe(0)
        }
      })

      it('leaves out the reviews of a deleted salon, under every filter', async () => {
        await deleteSalon(otherSalonId)

        expect(namesOf(await list())).toEqual(['five', 'two', 'unverified'])
        expect((await list()).body.meta.total).toBe(3)
        expect((await list({ salonId: otherSalonId })).body.meta.total).toBe(0)
        expect(namesOf(await list({ customerId }))).toEqual(['five', 'two'])
      })

      it('keeps the reviews of deleted staff members and customers', async () => {
        await deleteStaff(staffId)
        await deleteCustomer(customerId)

        expect(namesOf(await list({ salonId }))).toEqual([
          'five',
          'two',
          'unverified',
        ])
      })
    })

    it('refuses a cursor that names no review that is listed: 400', async () => {
      const elsewhere = await insertReview({ salonId: otherSalonId })
      await insertReview()
      await deleteSalon(otherSalonId)

      for (const cursor of [UNKNOWN_ID, elsewhere]) {
        const response = await list({ cursor })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(response.body.errors).toEqual([
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a review that is listed',
            value: null,
            constraint: null,
          },
        ])
      }
    })

    it('takes as a cursor a review that the filters leave out', async () => {
      const elsewhere = await insertReview({
        salonId: otherSalonId,
        createdAt: '2026-11-20T01:30:00Z',
      })
      const older = await insertReview({ createdAt: '2026-11-20T01:00:00Z' })
      await insertReview({ createdAt: '2026-11-20T02:00:00Z' })

      const response = await list({ salonId, cursor: elsewhere })

      expect(idsOf(response)).toEqual([older])
    })

    it.each<[string, Record<string, string>, string[]]>([
      ['a limit of 0', { limit: '0' }, ['limit:too_small']],
      ['a limit of 101', { limit: '101' }, ['limit:too_big']],
      [
        'a limit that is not a number',
        { limit: 'ten' },
        ['limit:invalid_format'],
      ],
      [
        'a cursor that is not a UUID',
        { cursor: 'next' },
        ['cursor:invalid_format'],
      ],
      [
        'a salon that is not a UUID',
        { salonId: 'aoyama' },
        ['salonId:invalid_format'],
      ],
      [
        'a verification that is not true or false',
        { isVerified: 'yes' },
        ['isVerified:invalid_value'],
      ],
      ['a lowest rating of 0', { minRating: '0' }, ['minRating:too_small']],
      ['a highest rating of 6', { maxRating: '6' }, ['maxRating:too_big']],
      [
        'a lowest rating above the highest one',
        { minRating: '4', maxRating: '2' },
        ['minRating:custom'],
      ],
      [
        'an order it does not know',
        { sortBy: 'oldest' },
        ['sortBy:invalid_value'],
      ],
      [
        'a parameter it does not know',
        { status: 'published' },
        ['status:unrecognized_keys'],
      ],
    ])('refuses %s: 400', async (_, query, rules) => {
      const response = await list(query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(rules)
    })
  })

  describe('GET /api/v1/salons/:salonId/reviews/summary', () => {
    it('counts the reviews of the salon: the average to two decimals, the total and every rating', async () => {
      for (const overallRating of [5, 4, 4, 1]) {
        await insertReview({ overallRating })
      }
      await insertReview({ salonId: otherSalonId, overallRating: 5 })

      const response = await salonSummary(salonId)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          averageRating: 3.5,
          totalReviews: 4,
          ratingDistribution: { '1': 1, '2': 0, '3': 0, '4': 2, '5': 1 },
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: { self: `${SALONS}/${salonId}/reviews/summary` },
      })
    })

    it('answers no average and none of each rating for a salon without reviews', async () => {
      expect((await salonSummary(salonId)).body.data).toEqual({
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: NO_RATINGS,
      })
    })

    it('counts the reviews of deleted staff members and customers', async () => {
      await insertReview({ staffId, overallRating: 2 })
      await deleteStaff(staffId)
      await deleteCustomer(customerId)

      expect((await salonSummary(salonId)).body.data).toMatchObject({
        averageRating: 2,
        totalReviews: 1,
      })
    })

    it.each(anyone)('answers %s', async (_, tokenOf) => {
      await insertReview()

      const response = await salonSummary(salonId, await tokenOf())

      expect(response.status).toBe(200)
      expect(response.body.data.totalReviews).toBe(1)
    })

    it('answers 404 for a salon that is not there, or is deleted', async () => {
      await insertReview()
      const unknown = await salonSummary(UNKNOWN_ID)
      await deleteSalon(salonId)
      const deleted = await salonSummary(salonId)

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expectProblem(deleted, notFound)
      expect(deleted.body.detail).toBe(`Salon ${salonId} was not found`)
    })

    it('refuses a salon that is not a UUID: 400', async () => {
      const response = await salonSummary('aoyama')

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid salon ID')
      expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
    })

    it('finds the salon by its ID in capitals, and links at the spelling of the mount path', async () => {
      const response = await request(app).get(
        `/API/V1/SALONS/${salonId.toUpperCase()}/REVIEWS/summary`,
      )

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: `/API/V1/SALONS/${salonId.toUpperCase()}/REVIEWS/summary`,
      })
    })

    it('serves no other method on the path, and nothing else below the reviews of a salon', async () => {
      for (const call of [
        request(app).post(`${SALONS}/${salonId}/reviews/summary`),
        request(app).put(`${SALONS}/${salonId}/reviews/summary`),
        request(app).delete(`${SALONS}/${salonId}/reviews/summary`),
        request(app).get(`${SALONS}/${salonId}/reviews`),
        request(app).post(`${SALONS}/${salonId}/reviews`),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('GET /api/v1/staff/:staffId/reviews/summary', () => {
    it('counts the reviews that name the staff member', async () => {
      const second = await insertStaff(db, salonId)
      await insertReview({ staffId, overallRating: 5 })
      await insertReview({ staffId, overallRating: 4 })
      await insertReview({ staffId, overallRating: 4 })
      await insertReview({ staffId: second, overallRating: 1 })
      await insertReview({ staffId: null, overallRating: 2 })

      const response = await staffSummary(staffId)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          averageRating: 4.33,
          totalReviews: 3,
          ratingDistribution: { ...NO_RATINGS, '4': 2, '5': 1 },
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: { self: `${STAFF}/${staffId}/reviews/summary` },
      })
    })

    it('answers no average and none of each rating for a staff member without reviews', async () => {
      await insertReview({ staffId: null })

      expect((await staffSummary(staffId)).body.data).toEqual({
        averageRating: null,
        totalReviews: 0,
        ratingDistribution: NO_RATINGS,
      })
    })

    it.each(anyone)('answers %s', async (_, tokenOf) => {
      await insertReview({ staffId })

      const response = await staffSummary(staffId, await tokenOf())

      expect(response.status).toBe(200)
      expect(response.body.data.totalReviews).toBe(1)
    })

    it('answers 404 for a staff member who is not there, is deleted, or is of a deleted salon', async () => {
      const ofOtherSalon = await insertStaff(db, otherSalonId)
      await insertReview({ staffId })
      const unknown = await staffSummary(UNKNOWN_ID)
      await deleteStaff(staffId)
      await deleteSalon(otherSalonId)

      const answers: [Response, string][] = [
        [unknown, UNKNOWN_ID],
        [await staffSummary(staffId), staffId],
        [await staffSummary(ofOtherSalon), ofOtherSalon],
      ]
      for (const [response, id] of answers) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Staff member ${id} was not found`)
      }
    })

    it('refuses a staff member who is not a UUID: 400', async () => {
      const response = await staffSummary('hanako')

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid staff ID')
      expect(brokenRules(response)).toEqual(['staffId:invalid_format'])
    })

    it('links at the spelling of the mount path', async () => {
      const response = await request(app).get(
        `/API/V1/STAFF/${staffId}/REVIEWS/summary`,
      )

      expect(response.body.links).toEqual({
        self: `/API/V1/STAFF/${staffId}/REVIEWS/summary`,
      })
    })

    it('serves no other method on the path, and nothing else below the reviews of a staff member', async () => {
      for (const call of [
        request(app).post(`${STAFF}/${staffId}/reviews/summary`),
        request(app).patch(`${STAFF}/${staffId}/reviews/summary`),
        request(app).delete(`${STAFF}/${staffId}/reviews/summary`),
        request(app).get(`${STAFF}/${staffId}/reviews`),
        request(app).get(`${STAFF}/${staffId}`),
      ]) {
        expectProblem(await authorized(call, asAdmin), routeNotFound)
      }
    })
  })

  describe('DELETE /api/v1/bookings/:id of a booking with a review', () => {
    it('keeps the booking and its review: 409', async () => {
      const bookingId = await insertBooking()
      expect((await create(review(bookingId))).status).toBe(201)

      const response = await authorized(
        request(app).delete(`/api/v1/bookings/${bookingId}`),
        asAdmin,
      )

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        'The booking cannot be deleted: a review refers to it',
      )
      expect(await db.$count(bookings, eq(bookings.id, bookingId))).toBe(1)
      expect(await db.$count(reviews)).toBe(1)
      expect(await storedSalon()).toMatchObject({ reviewCount: 1 })
    })
  })

  describe('reviews at the same time', () => {
    it('writes one review of a booking that is reviewed four times at once', async () => {
      const bookingId = await insertBooking()

      const responses = await Promise.all(
        [5, 4, 3, 2].map((overallRating) =>
          create(review(bookingId, { overallRating })),
        ),
      )

      expect(responses.map(statusAndCode).sort()).toEqual([
        '201',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      const [written] = await storedReviews()
      expect(await db.$count(reviews)).toBe(1)
      expect(await storedSalon()).toMatchObject({
        rating: `${written?.overallRating}.00`,
        reviewCount: 1,
      })
    })

    it('counts every review of a salon that is written at the same time', async () => {
      const bookingIds = await Promise.all(
        [1, 2, 3, 4, 5].map(() => insertBooking()),
      )

      const responses = await Promise.all(
        bookingIds.map((bookingId, index) =>
          create(review(bookingId, { overallRating: index + 1 })),
        ),
      )

      expect(responses.map(statusAndCode)).toEqual([
        '201',
        '201',
        '201',
        '201',
        '201',
      ])
      expect(await storedSalon()).toMatchObject({
        rating: '3.00',
        reviewCount: 5,
      })
    })

    it('waits for a booking that is being deleted, and then finds none', async () => {
      const bookingId = await insertBooking()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .for('update')
          const underWay = create(review(bookingId)).then(
            (response) => response,
          )
          const answered = await answersWithin(underWay, 300)
          await tx.delete(bookings).where(eq(bookings.id, bookingId))
          return { pending: underWay, answeredWhileHeld: answered }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['bookingId:not_found'])
      expect(await db.$count(reviews)).toBe(0)
    })

    it('writes a review that waited for the salon at the time it is written, and counts the salon then', async () => {
      await insertReview({ overallRating: 2 })
      const waiting = await insertBooking()
      const meanwhile = await insertBooking()

      const { pending, answeredWhileHeld, released } = await db.transaction(
        async (tx: Transaction) => {
          // As a review that is being written holds it.
          await tx
            .select({ id: salons.id })
            .from(salons)
            .where(eq(salons.id, salonId))
            .for('no key update')
          const underWay = create(review(waiting, { overallRating: 5 })).then(
            (response) => response,
          )
          const answered = await answersWithin(underWay, 300)
          // A review the one that waits does not see when it begins.
          await tx.insert(reviews).values({
            salonId,
            customerId,
            bookingId: meanwhile,
            overallRating: 5,
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
      expect(response.status).toBe(201)
      expect(Date.parse(response.body.data.createdAt)).toBeGreaterThanOrEqual(
        Math.floor(released),
      )
      const salon = await storedSalon()
      expect(salon).toMatchObject({ rating: '4.00', reviewCount: 3 })
      expect(salon.writtenAt).toBeGreaterThanOrEqual(Math.floor(released))
    })

    it('waits neither for a booking that is held for share nor for a salon that a foreign key holds', async () => {
      const bookingId = await insertBooking()

      const { answered, written } = await db.transaction(
        async (tx: Transaction) => {
          // As a point transaction that names the booking holds it.
          await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .for('share')
          // As a row that refers to the salon, being written, holds it.
          await tx
            .select({ id: salons.id })
            .from(salons)
            .where(eq(salons.id, salonId))
            .for('key share')
          const underWay = create(review(bookingId)).then(
            (response) => response,
          )

          return {
            answered: await answersWithin(underWay, 2000),
            written: underWay,
          }
        },
      )

      expect(answered).toBe(true)
      expect((await written).status).toBe(201)
    })

    it('answers 409, and writes nothing, when the review it did not see is committed first', async () => {
      const bookingId = await insertBooking()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          // A review of the booking written by a transaction that holds
          // neither the booking nor the salon: the review that is sent
          // does not see it, and meets it at the unique constraint.
          await tx.insert(reviews).values({
            salonId,
            customerId,
            bookingId,
            overallRating: 2,
          })
          const underWay = create(review(bookingId)).then(
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
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(REVIEWED)
      expect(await db.$count(reviews)).toBe(1)
      expect(await storedSalon()).toMatchObject({
        rating: null,
        reviewCount: 0,
      })
    })

    it('keeps a booking that is deleted while its review is written', async () => {
      const bookingId = await insertBooking()

      const { written, removal, removedWhileHeld } = await db.transaction(
        async (tx: Transaction) => {
          await tx
            .select({ id: salons.id })
            .from(salons)
            .where(eq(salons.id, salonId))
            .for('no key update')
          const underWay = create(review(bookingId)).then(
            (response) => response,
          )
          // The review holds the booking and waits for the salon.
          await pause(300)
          const removing = authorized(
            request(app).delete(`/api/v1/bookings/${bookingId}`),
            asAdmin,
          ).then((response) => response)

          return {
            written: underWay,
            removal: removing,
            removedWhileHeld: await answersWithin(removing, 300),
          }
        },
      )

      expect(removedWhileHeld).toBe(false)
      expect((await written).status).toBe(201)
      expect(statusAndCode(await removal)).toBe('409 3003')
      expect(await db.$count(reviews)).toBe(1)
    })
  })

  describe('ReviewRepository', () => {
    it('resolves every method to a database error when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()
      const repository = new ReviewRepository(connection.database)
      const request: ReviewCreateRequest = {
        salonId: salonIdSchema.parse(UNKNOWN_ID),
        customerId: customerIdSchema.parse(UNKNOWN_ID),
        bookingId: bookingIdSchema.parse(UNKNOWN_ID),
        staffId: null,
        overallRating: 5,
        serviceRating: null,
        staffRating: null,
        atmosphereRating: null,
        cleanlinessRating: null,
        valueRating: null,
        title: null,
        comment: null,
        imageUrls: [],
      }

      const results = [
        await repository.list({
          limit: 20,
          after: null,
          sortBy: 'recent',
          salonId: null,
          staffId: null,
          customerId: null,
          bookingId: null,
          isVerified: null,
          minRating: null,
          maxRating: null,
        }),
        await repository.findById(reviewIdSchema.parse(UNKNOWN_ID)),
        await repository.create(request.customerId, request),
        await repository.salonTally(request.salonId),
        await repository.staffTally(staffIdSchema.parse(UNKNOWN_ID)),
      ]
      await connection.close()

      expect(results).toEqual(
        [
          'Failed to list reviews',
          'Failed to find review',
          'Failed to create review',
          'Failed to count the reviews of a salon',
          'Failed to count the reviews of a staff member',
        ].map((message) => ({
          type: 'error',
          error: expect.objectContaining({ type: 'database', message }),
        })),
      )
    })
  })
})
