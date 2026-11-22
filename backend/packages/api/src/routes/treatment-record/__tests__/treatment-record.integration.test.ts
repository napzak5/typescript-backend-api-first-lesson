import {
  bookings,
  customers,
  products,
  salons,
  services,
  staff,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  customerIdSchema,
  type DomainError,
  type LedgerReach,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
  treatmentRecordIdSchema,
} from '@beauty-salon-backend/domain'
import { TreatmentRecordRepository } from '@beauty-salon-backend/infrastructure'
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
} from '../../../__tests__/_shared/auth-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  databaseMoment,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

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

const INVALID_RECORD = 'Invalid treatment record'
const INVALID_SEARCH = 'Invalid treatment record search'
const INVALID_ID = 'Invalid treatment record ID'
const NO_SUCH_BOOKING = 'Must name a booking of a salon'
const NO_SUCH_CUSTOMER = 'Must name the customer of the booking'
const NO_SUCH_STAFF = 'Must name a staff member of the salon of the booking'
const NO_SUCH_SERVICE = 'Must name a service of the salon of the booking'
const NO_SUCH_PRODUCT = 'Must name a product of the salon of the booking'
const NO_SUCH_CURSOR = 'Must name a treatment record of the list'
const LOT_NEEDED = 'Must name the lot: the product is kept by lots'
const NO_LOT = 'Must be null: the product is not kept by lots'
const BEFORE_BOOKING = 'Must not be before the date of the booking, 2026-11-20'
const RECORD_EXISTS =
  'The booking has a treatment record already; a booking has one'
const notTreated = (status: string): string =>
  `The booking is ${status}; a treatment is recorded once it has begun`

/** The properties of a TreatmentRecordResponse. */
const RECORD_PROPERTIES = [
  'bookingId',
  'colorFormula',
  'consultationNotes',
  'createdAt',
  'customerId',
  'customerSatisfaction',
  'hairCondition',
  'homeCareSuggestions',
  'id',
  'materials',
  'nextRecommendedDate',
  'nextRecommendedServices',
  'photos',
  'processingTime',
  'resultNotes',
  'scalpCondition',
  'services',
  'staffEvaluation',
  'staffId',
  'techniques',
  'updatedAt',
]

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

/** Checks a refusal of the request: its message and, when given, what it broke. */
const expectRefused = (
  response: Response,
  detail: string,
  errors?: unknown[],
): void => {
  expectProblem(response, badRequest)
  expect(response.body.detail).toBe(detail)
  if (errors !== undefined) {
    expect(response.body.errors).toEqual(errors)
  }
}

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** Whether a request is answered while what it may wait for is held. */
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

const salonIdOf = (id: string) => salonIdSchema.parse(id)
const serviceIdOf = (id: string) => serviceIdSchema.parse(id)

const ids = (response: Response): string[] =>
  response.body.data.map(({ id }: { id: string }) => id)

describe('Treatment record API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests, its customer and the staff member of its bookings. */
  let salonId: string
  let customerId: string
  let staffId: string
  /** Two services of the salon. */
  let cutId: string
  let colourId: string
  /** Two products of the salon: a treatment that is not kept by lots, and a colour that is. */
  let treatmentId: string
  let colourCreamId: string

  type NewBooking = typeof bookings.$inferInsert
  type BookingStatus = NonNullable<NewBooking['status']>
  type NewRecord = typeof treatmentRecords.$inferInsert
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A service of a salon as a row; returns its ID. */
  const insertService = async (
    overrides: Partial<typeof services.$inferInsert> = {},
  ): Promise<string> => {
    const [service] = await db
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
        ...overrides,
      })
      .returning({ id: services.id })
    if (service === undefined) {
      throw new Error('No service was inserted')
    }
    return service.id
  }

  /** A product of a salon as a row; returns its ID. */
  const insertProduct = async (
    overrides: Partial<typeof products.$inferInsert> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(products)
      .values({
        salonId,
        productCode: `P${nextRow()}`,
        name: 'トリートメント',
        unit: 'g',
        ...overrides,
      })
      .returning({ id: products.id })
    if (row === undefined) {
      throw new Error('No product was inserted')
    }
    return row.id
  }

  /** What a booking of a status has besides it: the times the status needs. */
  const timesOf = (status: BookingStatus): Partial<NewBooking> => {
    if (status === 'completed') {
      return { actualStartTime: at('01:00'), completedAt: at('02:00') }
    }
    if (status === 'in_progress') {
      return { actualStartTime: at('01:00') }
    }
    return status === 'cancelled' ? { cancelledAt: at('00:30') } : {}
  }

  /** A booking of the customer at the salon on 20 November 2026, in progress unless said otherwise; returns its ID. */
  const insertBooking = async ({
    status = 'in_progress',
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

  /** A record of a booking of the salon written directly; returns its ID. */
  const insertRecord = async (
    overrides: Partial<NewRecord> = {},
  ): Promise<string> => {
    const [record] = await db
      .insert(treatmentRecords)
      .values({
        bookingId: overrides.bookingId ?? (await insertBooking()),
        customerId,
        staffId,
        services: [cutId],
        ...overrides,
      })
      .returning({ id: treatmentRecords.id })
    if (record === undefined) {
      throw new Error('No treatment record was inserted')
    }
    return record.id
  }

  /** A record of a booking of another salon, with a customer and a staff member of its own; returns its ID. */
  const insertRecordElsewhere = async (otherSalon: string): Promise<string> => {
    const theirStaff = await insertStaff(db, otherSalon)
    const theirCustomer = await insertCustomer(db)
    return insertRecord({
      bookingId: await insertBooking({
        salonId: otherSalon,
        customerId: theirCustomer,
        staffId: theirStaff,
      }),
      customerId: theirCustomer,
      staffId: theirStaff,
    })
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db)
    customerId = await insertCustomer(db)
    staffId = await insertStaff(db, salonId)
    cutId = await insertService()
    colourId = await insertService({ name: 'Colour', price: 8800 })
    treatmentId = await insertProduct({
      productCode: 'TREAT001',
      name: 'Repair Treatment',
      unit: 'g',
    })
    colourCreamId = await insertProduct({
      productCode: 'COLOR001',
      name: 'Color Cream 1L',
      unit: 'g',
      requiresLotTracking: true,
    })
  })

  const PATH = '/api/v1/treatments'

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A material of a product: 1.5 of it in grams, without a lot or notes. */
  const materialOf = (
    productId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    productId,
    quantity: 1.5,
    unit: 'g',
    lotNumber: null,
    notes: null,
    ...overrides,
  })

  /** A record of the booking of a cut, with nothing else written down. */
  const recordOf = (
    bookingId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    bookingId,
    customerId,
    staffId,
    services: [cutId],
    techniques: [],
    consultationNotes: null,
    scalpCondition: null,
    hairCondition: null,
    colorFormula: null,
    processingTime: null,
    resultNotes: null,
    nextRecommendedDate: null,
    nextRecommendedServices: [],
    homeCareSuggestions: null,
    customerSatisfaction: null,
    staffEvaluation: null,
    materials: [],
    ...overrides,
  })

  const create = (body: object, as: string | null = asAdmin): Test =>
    authorized(request(app).post(PATH), as).send(body)

  const get = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).get(`${PATH}/${id}`), as)

  const list = (
    query: Record<string, unknown> = {},
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(PATH).query(query), as)

  const update = (
    id: string,
    body: object,
    as: string | null = asAdmin,
  ): Test => authorized(request(app).patch(`${PATH}/${id}`), as).send(body)

  const remove = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).delete(`${PATH}/${id}`), as)

  /** The materials of a record as stored, in their order. */
  const storedMaterials = (id: string) =>
    db
      .select()
      .from(treatmentMaterials)
      .where(eq(treatmentMaterials.treatmentRecordId, id))
      .orderBy(asc(treatmentMaterials.sortOrder))

  /** Every record, material and photo, to tell that nothing was written. */
  const everything = async () => ({
    records: await db
      .select()
      .from(treatmentRecords)
      .orderBy(asc(treatmentRecords.id)),
    materials: await db
      .select()
      .from(treatmentMaterials)
      .orderBy(asc(treatmentMaterials.id)),
    photos: await db
      .select()
      .from(treatmentPhotos)
      .orderBy(asc(treatmentPhotos.id)),
  })

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** A member of a salon; of the salon of the tests unless another is given. */
  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
      staffOverrides: Parameters<typeof insertMember>[3] = {},
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

  /** Everyone who writes and reads the records of the salon of the tests. */
  const writers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Accounts that reach no records at all. */
  const outsiders: [string, SignInAs][] = [
    [
      'a customer with a profile',
      async () =>
        (
          await signedInUser(app, db, {
            customerId,
          })
        ).authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
    [
      'an account of the salon whose staff record is deleted',
      member('owner', async () => salonId, {
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

  /** Every operation, as a request that would succeed for an administrator. */
  const operations: ((as: string | null, id: string) => Promise<Response>)[] = [
    async (as) => list({}, as),
    async (as, id) => get(id, as),
    async (as) => create(recordOf(await insertBooking()), as),
    async (as, id) => update(id, { resultNotes: '仕上がり良好' }, as),
    async (as, id) => remove(id, as),
  ]

  describe('POST /api/v1/treatments', () => {
    it('writes the record with its materials in the order of the request, and answers 201 as the contract has it', async () => {
      const bookingId = await insertBooking()

      const response = await create(
        recordOf(bookingId, {
          services: [colourId, cutId],
          techniques: ['リタッチ', 'グラデーションカット'],
          consultationNotes: '根元の白髪が気になる',
          scalpCondition: '乾燥ぎみ',
          hairCondition: '毛先にダメージ',
          colorFormula: '7N:7Ash = 1:1、6%',
          processingTime: 95,
          resultNotes: '色むらなし',
          nextRecommendedDate: '2026-12-18',
          nextRecommendedServices: [colourId],
          homeCareSuggestions: 'カラー用シャンプー',
          customerSatisfaction: 5,
          staffEvaluation: '次回はトーンを一段落とす',
          materials: [
            materialOf(colourCreamId, {
              quantity: 80,
              lotNumber: 'LOT-2026-11',
              notes: '根元',
            }),
            materialOf(treatmentId, { quantity: 12.25 }),
            materialOf(colourCreamId, {
              quantity: 40,
              lotNumber: 'LOT-2026-10',
            }),
          ],
        }),
      )

      expect(response.status).toBe(201)
      // One reading of the clock stamps the new row, to the microsecond
      const [stamps] = await db
        .select({
          createdAt: treatmentRecords.createdAt,
          updatedAt: treatmentRecords.updatedAt,
        })
        .from(treatmentRecords)
        .where(eq(treatmentRecords.id, response.body.data.id))
      expect(stamps?.updatedAt).toBe(stamps?.createdAt)
      const { data } = response.body
      expect(Object.keys(data).toSorted()).toEqual(RECORD_PROPERTIES)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          bookingId,
          customerId,
          staffId,
          services: [colourId, cutId],
          techniques: ['リタッチ', 'グラデーションカット'],
          consultationNotes: '根元の白髪が気になる',
          scalpCondition: '乾燥ぎみ',
          hairCondition: '毛先にダメージ',
          colorFormula: '7N:7Ash = 1:1、6%',
          processingTime: 95,
          resultNotes: '色むらなし',
          nextRecommendedDate: '2026-12-18',
          nextRecommendedServices: [colourId],
          homeCareSuggestions: 'カラー用シャンプー',
          customerSatisfaction: 5,
          staffEvaluation: '次回はトーンを一段落とす',
          materials: [
            {
              productId: colourCreamId,
              quantity: 80,
              unit: 'g',
              lotNumber: 'LOT-2026-11',
              notes: '根元',
            },
            {
              productId: treatmentId,
              quantity: 12.25,
              unit: 'g',
              lotNumber: null,
              notes: null,
            },
            {
              productId: colourCreamId,
              quantity: 40,
              unit: 'g',
              lotNumber: 'LOT-2026-10',
              notes: null,
            },
          ],
          photos: [],
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: data.createdAt,
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
        links: { self: `${PATH}/${data.id}`, list: PATH },
      })
      expect(response.headers['location']).toBe(`${PATH}/${data.id}`)
      expect((await get(data.id)).body.data).toEqual(data)
      expect(
        (await storedMaterials(data.id)).map(({ sortOrder, quantity }) => [
          sortOrder,
          quantity,
        ]),
      ).toEqual([
        [0, '80.00'],
        [1, '12.25'],
        [2, '40.00'],
      ])
    })

    it.each(writers)(
      'writes a record of a booking of the salon for %s',
      async (_who, signInAs) => {
        const authorization = await signInAs()

        const response = await create(
          recordOf(await insertBooking()),
          authorization,
        )

        expect(response.status).toBe(201)
      },
    )

    it('writes the record of a completed visit, by a staff member of the salon other than the one of the booking, of services the booking does not have', async () => {
      const assistant = await insertStaff(db, salonId)
      const added = await insertService({ name: 'Head spa' })
      const bookingId = await insertBooking({ status: 'completed' })

      const response = await create(
        recordOf(bookingId, {
          staffId: assistant,
          services: [added],
          nextRecommendedDate: '2026-11-20',
        }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        staffId: assistant,
        services: [added],
        nextRecommendedDate: '2026-11-20',
      })
    })

    it('takes what the limits allow: 20 services, techniques and recommendations, 50 materials, a day of treatment and the largest quantity', async () => {
      const many = await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          insertService({ name: `Service ${index}` }),
        ),
      )

      const response = await create(
        recordOf(await insertBooking(), {
          services: many,
          techniques: Array.from({ length: 20 }, (_, index) => `技法${index}`),
          nextRecommendedServices: many,
          processingTime: 1440,
          customerSatisfaction: 1,
          materials: Array.from({ length: 50 }, (_, index) =>
            materialOf(treatmentId, {
              quantity: index === 0 ? 99_999_999.99 : 0.01,
            }),
          ),
        }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data.materials).toHaveLength(50)
      expect(response.body.data.materials[0].quantity).toBe(99_999_999.99)
      expect(response.body.data.processingTime).toBe(1440)
    })

    it.each<[BookingStatus]>([
      ['draft'],
      ['pending'],
      ['confirmed'],
      ['cancelled'],
      ['no_show'],
    ])(
      'refuses the record of a booking that is %s with 409, and writes nothing',
      async (status) => {
        const bookingId = await insertBooking({ status })

        const response = await create(recordOf(bookingId))

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(notTreated(status))
        expect(await everything()).toEqual({
          records: [],
          materials: [],
          photos: [],
        })
      },
    )

    it('refuses a second record of a booking with 409, and keeps the first as it was', async () => {
      const bookingId = await insertBooking()
      const first = await create(
        recordOf(bookingId, { materials: [materialOf(treatmentId)] }),
      )
      const before = await everything()

      const response = await create(
        recordOf(bookingId, { resultNotes: '二度目' }),
      )

      expect(first.status).toBe(201)
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(RECORD_EXISTS)
      expect(await everything()).toEqual(before)
    })

    it.each<[string, () => Promise<string>, (() => SignInAs) | null]>([
      ['a booking that is not there', async () => UNKNOWN_ID, null],
      [
        'a booking of another salon, to a member of the salon',
        async () => {
          const otherSalon = await insertSalon(db)
          return insertBooking({
            salonId: otherSalon,
            staffId: await insertStaff(db, otherSalon),
          })
        },
        () => member('staff'),
      ],
      [
        'a booking of a salon that was deleted',
        async () => {
          const id = await insertBooking()
          await db
            .update(salons)
            .set({ deletedAt: at('00:00') })
            .where(eq(salons.id, salonId))
          return id
        },
        null,
      ],
    ])(
      'refuses %s as the booking named, and writes nothing',
      async (_case, bookingOf, signInAs) => {
        const bookingId = await bookingOf()
        const authorization = signInAs === null ? asAdmin : await signInAs()()

        expectRefused(
          await create(recordOf(bookingId), authorization),
          INVALID_RECORD,
          [issue('bookingId', 'not_found', NO_SUCH_BOOKING)],
        )
        expect((await everything()).records).toEqual([])
      },
    )

    it('refuses everything the record names that is not of the booking or its salon, each of it in the order of the request, and writes nothing', async () => {
      const otherSalon = await insertSalon(db)
      const theirService = await insertService({ salonId: otherSalon })
      const deletedService = await insertService({ deletedAt: at('00:00') })
      const theirProduct = await insertProduct({ salonId: otherSalon })
      const deletedProduct = await insertProduct({ deletedAt: at('00:00') })
      const otherCustomer = await insertCustomer(db)
      const theirStaff = await insertStaff(db, otherSalon)
      const bookingId = await insertBooking()

      const response = await create(
        recordOf(bookingId, {
          customerId: otherCustomer,
          staffId: theirStaff,
          services: [cutId, theirService, deletedService],
          nextRecommendedDate: '2026-11-19',
          nextRecommendedServices: [UNKNOWN_ID, colourId],
          materials: [
            materialOf(theirProduct),
            materialOf(treatmentId),
            materialOf(deletedProduct),
            materialOf(colourCreamId),
            materialOf(treatmentId, { lotNumber: 'LOT-1' }),
          ],
        }),
      )

      expectRefused(response, INVALID_RECORD, [
        issue('customerId', 'not_found', NO_SUCH_CUSTOMER),
        issue('staffId', 'not_found', NO_SUCH_STAFF),
        issue('services.1', 'not_found', NO_SUCH_SERVICE),
        issue('services.2', 'not_found', NO_SUCH_SERVICE),
        issue('nextRecommendedDate', 'too_small', BEFORE_BOOKING),
        issue('nextRecommendedServices.0', 'not_found', NO_SUCH_SERVICE),
        issue('materials.0.productId', 'not_found', NO_SUCH_PRODUCT),
        issue('materials.2.productId', 'not_found', NO_SUCH_PRODUCT),
        issue('materials.3.lotNumber', 'custom', LOT_NEEDED),
        issue('materials.4.lotNumber', 'custom', NO_LOT),
      ])
      expect(await everything()).toEqual({
        records: [],
        materials: [],
        photos: [],
      })
    })

    it.each<[string, () => Promise<Record<string, unknown>>]>([
      [
        'a customer who was deleted',
        async () => {
          await db
            .update(customers)
            .set({ deletedAt: at('00:00') })
            .where(eq(customers.id, customerId))
          return {}
        },
      ],
      [
        'a staff member who was deleted',
        async () => ({
          staffId: await insertStaff(db, salonId, { deletedAt: at('00:00') }),
        }),
      ],
    ])('refuses %s', async (_case, overridesOf) => {
      const bookingId = await insertBooking()
      const overrides = await overridesOf()

      const response = await create(recordOf(bookingId, overrides))

      expectRefused(response, INVALID_RECORD)
      expect(brokenRules(response)).toEqual([
        'staffId' in overrides ? 'staffId:not_found' : 'customerId:not_found',
      ])
    })

    it('refuses what does not fit the booking before it looks at the status of the booking', async () => {
      const bookingId = await insertBooking({ status: 'confirmed' })

      const response = await create(
        recordOf(bookingId, { services: [UNKNOWN_ID] }),
      )

      expectRefused(response, INVALID_RECORD, [
        issue('services.0', 'not_found', NO_SUCH_SERVICE),
      ])
    })

    it.each<[string, (bookingId: string) => object, string[]]>([
      [
        'no services',
        (id) => recordOf(id, { services: [] }),
        ['services:too_small'],
      ],
      [
        'a service twice',
        (id) => recordOf(id, { services: [cutId, cutId] }),
        ['services.1:custom'],
      ],
      [
        '21 services',
        (id) =>
          recordOf(id, {
            services: Array.from({ length: 21 }, (_, index) => idOf(index)),
          }),
        ['services:too_big'],
      ],
      [
        'a technique that is blank, and one that is too long',
        (id) => recordOf(id, { techniques: ['  ', 'あ'.repeat(101)] }),
        ['techniques.0:invalid_format', 'techniques.1:too_big'],
      ],
      [
        'a recommendation twice',
        (id) => recordOf(id, { nextRecommendedServices: [colourId, colourId] }),
        ['nextRecommendedServices.1:custom'],
      ],
      [
        '51 materials',
        (id) =>
          recordOf(id, {
            materials: Array.from({ length: 51 }, () =>
              materialOf(treatmentId),
            ),
          }),
        ['materials:too_big'],
      ],
      [
        'a quantity of none, one finer than a hundredth, and one too large',
        (id) =>
          recordOf(id, {
            materials: [
              materialOf(treatmentId, { quantity: 0 }),
              materialOf(treatmentId, { quantity: 0.001 }),
              materialOf(treatmentId, { quantity: 100_000_000 }),
            ],
          }),
        [
          'materials.0.quantity:too_small',
          'materials.1.quantity:not_multiple_of',
          'materials.2.quantity:too_big',
        ],
      ],
      [
        'a material without its unit',
        (id) =>
          recordOf(id, {
            materials: [
              {
                productId: treatmentId,
                quantity: 1,
                lotNumber: null,
                notes: null,
              },
            ],
          }),
        ['materials.0.unit:invalid_type'],
      ],
      [
        'a treatment longer than a day, and a satisfaction out of the scale',
        (id) => recordOf(id, { processingTime: 1441, customerSatisfaction: 6 }),
        ['processingTime:too_big', 'customerSatisfaction:too_big'],
      ],
      [
        'a date that is not a day of the calendar',
        (id) => recordOf(id, { nextRecommendedDate: '2026-02-30' }),
        ['nextRecommendedDate:invalid_format'],
      ],
      [
        'a property that is left out',
        (id) => {
          const { techniques: _left, ...rest } = recordOf(id)
          return rest
        },
        ['techniques:invalid_type'],
      ],
      [
        'a property the record does not have',
        (id) => recordOf(id, { beforePhotos: [] }),
        ['beforePhotos:unrecognized_keys'],
      ],
      [
        'a booking that is no UUID',
        () => recordOf('booking-1'),
        ['bookingId:invalid_format'],
      ],
    ])('refuses %s, and writes nothing', async (_case, bodyOf, expected) => {
      const response = await create(bodyOf(await insertBooking()))

      expectRefused(response, INVALID_RECORD)
      expect(brokenRules(response)).toEqual(expected)
      expect((await everything()).records).toEqual([])
    })
  })

  describe('GET /api/v1/treatments/:id', () => {
    it.each(writers)(
      'reads a record of the salon with its materials and its photos in their order, for %s',
      async (_who, signInAs) => {
        const authorization = await signInAs()
        const id = await insertRecord({ techniques: ['カット'] })
        await db.insert(treatmentMaterials).values([
          {
            treatmentRecordId: id,
            productId: treatmentId,
            quantity: '2.50',
            unit: 'g',
            sortOrder: 1,
          },
          {
            treatmentRecordId: id,
            productId: colourCreamId,
            quantity: '30.00',
            unit: 'g',
            lotNumber: 'LOT-A',
            sortOrder: 0,
          },
        ])
        const [after, before] = await db
          .insert(treatmentPhotos)
          .values([
            {
              treatmentRecordId: id,
              photoType: 'after',
              photoUrl: 'https://images.example.com/after.jpg',
              sortOrder: 1,
            },
            {
              treatmentRecordId: id,
              photoType: 'before',
              photoUrl: 'https://images.example.com/before.jpg',
              thumbnailUrl: 'https://images.example.com/before-s.jpg',
              angle: 'front',
              description: '施術前',
              isPublic: true,
              customerConsent: true,
              sortOrder: 0,
            },
          ])
          .returning({ id: treatmentPhotos.id })

        const response = await get(id, authorization)

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          id,
          techniques: ['カット'],
          materials: [
            {
              productId: colourCreamId,
              quantity: 30,
              unit: 'g',
              lotNumber: 'LOT-A',
              notes: null,
            },
            {
              productId: treatmentId,
              quantity: 2.5,
              unit: 'g',
              lotNumber: null,
              notes: null,
            },
          ],
          photos: [
            {
              id: before?.id,
              photoType: 'before',
              photoUrl: 'https://images.example.com/before.jpg',
              thumbnailUrl: 'https://images.example.com/before-s.jpg',
              angle: 'front',
              description: '施術前',
              isPublic: true,
              customerConsent: true,
              sortOrder: 0,
            },
            {
              id: after?.id,
              photoType: 'after',
              photoUrl: 'https://images.example.com/after.jpg',
              thumbnailUrl: null,
              angle: null,
              description: null,
              isPublic: false,
              customerConsent: false,
              sortOrder: 1,
            },
          ],
        })
        expect(response.body.links).toEqual({
          self: `${PATH}/${id}`,
          list: PATH,
        })
      },
    )

    it('answers 404 for a record of another salon to its members, for one that is not there, and for one whose salon was deleted', async () => {
      const otherSalon = await insertSalon(db)
      const ofOther = await insertRecordElsewhere(otherSalon)
      const manager = await member('manager')()
      const gone = await insertRecordElsewhere(await insertSalon(db))
      const [goneRecord] = await db
        .select({ salonId: bookings.salonId })
        .from(treatmentRecords)
        .innerJoin(bookings, eq(bookings.id, treatmentRecords.bookingId))
        .where(eq(treatmentRecords.id, gone))
      await db
        .update(salons)
        .set({ deletedAt: at('00:00') })
        .where(eq(salons.id, goneRecord?.salonId ?? ''))

      expectProblem(await get(ofOther, manager), notFound)
      expectProblem(await get(UNKNOWN_ID), notFound)
      expectProblem(await get(gone), notFound)
      expect((await get(ofOther)).status).toBe(200)
    })

    it('refuses an ID that is no UUID', async () => {
      expectRefused(await get('record-1'), INVALID_ID)
    })

    it('takes an ID in upper case', async () => {
      const id = await insertRecord()

      const response = await get(id.toUpperCase())

      expect(response.body.data.id).toBe(id)
    })
  })

  describe('GET /api/v1/treatments', () => {
    it('lists the latest records first, and pages forwards with a cursor', async () => {
      const first = await insertRecord({ createdAt: '2026-11-01T00:00:00Z' })
      const second = await insertRecord({ createdAt: '2026-11-02T00:00:00Z' })
      const third = await insertRecord({ createdAt: '2026-11-03T00:00:00Z' })

      const page = await list({ limit: 2 })
      const next = await list({ limit: 2, cursor: page.body.meta.nextCursor })

      expect(ids(page)).toEqual([third, second])
      expect(page.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: second,
        prevCursor: null,
      })
      expect(page.body.links).toEqual({
        self: `${PATH}?limit=2`,
        first: `${PATH}?limit=2`,
        last: null,
        next: `${PATH}?limit=2&cursor=${second}`,
        prev: null,
      })
      expect(ids(next)).toEqual([first])
      expect(next.body.meta).toMatchObject({ hasMore: false, nextCursor: null })
      // A page that holds every record that is left is the last one.
      const whole = await list({ limit: 3 })
      expect(ids(whole)).toEqual([third, second, first])
      expect(whole.body.meta).toMatchObject({
        total: 3,
        hasMore: false,
        nextCursor: null,
      })
    })

    it('orders the records of one moment by their IDs, downwards, across pages', async () => {
      const moment = '2026-11-01T00:00:00Z'
      const made = [
        await insertRecord({ id: idOf(2), createdAt: moment }),
        await insertRecord({ id: idOf(3), createdAt: moment }),
        await insertRecord({ id: idOf(1), createdAt: moment }),
      ]

      const page = await list({ limit: 2 })
      const next = await list({ limit: 2, cursor: page.body.meta.nextCursor })

      expect([...ids(page), ...ids(next)]).toEqual(made.toSorted().toReversed())
    })

    it('lists each record with its materials and photos', async () => {
      const id = await insertRecord()
      await db.insert(treatmentMaterials).values({
        treatmentRecordId: id,
        productId: treatmentId,
        quantity: '3.00',
        unit: 'g',
        sortOrder: 0,
      })
      await db.insert(treatmentPhotos).values({
        treatmentRecordId: id,
        photoType: 'after',
        photoUrl: 'https://images.example.com/after.jpg',
      })
      const bare = await insertRecord()

      const response = await list()

      const byId = new Map(
        response.body.data.map((record: { id: string }) => [record.id, record]),
      )
      expect(byId.get(id)).toMatchObject({
        materials: [{ productId: treatmentId, quantity: 3 }],
        photos: [{ photoType: 'after' }],
      })
      expect(byId.get(bare)).toMatchObject({ materials: [], photos: [] })
    })

    it('filters by the customer, the staff member and the moments of creation, both in, to the millisecond', async () => {
      const otherCustomer = await insertCustomer(db)
      const assistant = await insertStaff(db, salonId)
      const early = await insertRecord({
        createdAt: '2026-11-01T00:00:00.123456Z',
      })
      const late = await insertRecord({
        createdAt: '2026-11-02T00:00:00.123456Z',
      })
      await insertRecord({ createdAt: '2026-11-03T00:00:00Z' })
      await insertRecord({
        bookingId: await insertBooking({ customerId: otherCustomer }),
        customerId: otherCustomer,
        createdAt: '2026-11-01T12:00:00Z',
      })
      await insertRecord({
        staffId: assistant,
        createdAt: '2026-11-01T12:00:00Z',
      })

      const response = await list({
        customerId,
        staffId,
        startDate: '2026-11-01T00:00:00.123Z',
        endDate: '2026-11-02T00:00:00.123Z',
      })

      expect(ids(response)).toEqual([late, early])
      expect(response.body.meta.total).toBe(2)
      expect(
        ids(await list({ startDate: '2026-11-01T00:00:00.124Z', customerId })),
      ).not.toContain(early)
      expect(
        ids(await list({ endDate: '2026-11-02T00:00:00.122Z', customerId })),
      ).not.toContain(late)
    })

    it('lists an administrator the records of the salon named, and of every salon without one', async () => {
      const otherSalon = await insertSalon(db)
      const ofOther = await insertRecordElsewhere(otherSalon)
      const own = await insertRecord()

      const named = await list({ salonId })
      const every = await list()

      expect(ids(named)).toEqual([own])
      expect(named.body.meta.total).toBe(1)
      expect(ids(every).toSorted()).toEqual([own, ofOther].toSorted())
    })

    it('lists a member of a salon the records of the salon only, and refuses one who names another', async () => {
      const otherSalon = await insertSalon(db)
      await insertRecordElsewhere(otherSalon)
      const own = await insertRecord()
      const authorization = await member('staff')()

      const response = await list({}, authorization)

      expect(ids(response)).toEqual([own])
      expect((await list({ salonId }, authorization)).status).toBe(200)
      expectProblem(
        await list({ salonId: otherSalon }, authorization),
        forbidden,
      )
    })

    it('leaves out the records of a salon that was deleted, from the list and from its count', async () => {
      const otherSalon = await insertSalon(db)
      await insertRecordElsewhere(otherSalon)
      const own = await insertRecord()
      await db
        .update(salons)
        .set({ deletedAt: at('00:00') })
        .where(eq(salons.id, otherSalon))

      const response = await list()

      expect(ids(response)).toEqual([own])
      expect(response.body.meta.total).toBe(1)
      expect(ids(await list({ salonId: otherSalon }))).toEqual([])
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      [
        'a cursor that names no record',
        { cursor: UNKNOWN_ID },
        ['cursor:not_found'],
      ],
      ['a limit of none', { limit: 0 }, ['limit:too_small']],
      ['a limit over 100', { limit: 101 }, ['limit:too_big']],
      ['a limit that is no number', { limit: 'all' }, ['limit:invalid_format']],
      [
        'an end before the start',
        { startDate: '2026-11-02T00:00:00Z', endDate: '2026-11-01T00:00:00Z' },
        ['endDate:custom'],
      ],
      [
        'a start that is no moment',
        { startDate: '2026-11-01' },
        ['startDate:invalid_format'],
      ],
      [
        'a customer that is no UUID',
        { customerId: 'c-1' },
        ['customerId:invalid_format'],
      ],
      [
        'a filter it does not know',
        { bookingId: UNKNOWN_ID },
        ['bookingId:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, expected) => {
      const response = await list(query)

      expectRefused(response, INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(expected)
    })

    it('refuses a cursor that names a record of another salon to its members', async () => {
      const ofOther = await insertRecordElsewhere(await insertSalon(db))
      const authorization = await member('manager')()

      expectRefused(
        await list({ cursor: ofOther }, authorization),
        INVALID_SEARCH,
        [issue('cursor', 'not_found', NO_SUCH_CURSOR)],
      )
    })
  })

  describe('PATCH /api/v1/treatments/:id', () => {
    it('changes only what the request names, at a later moment, and keeps the materials it does not name', async () => {
      const created = await create(
        recordOf(await insertBooking(), {
          resultNotes: '初回',
          customerSatisfaction: 4,
          materials: [materialOf(treatmentId)],
        }),
      )
      const before = created.body.data

      const response = await update(before.id, {
        resultNotes: '色が落ち着いた',
        colorFormula: null,
        techniques: ['ハイライト'],
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...before,
        resultNotes: '色が落ち着いた',
        colorFormula: null,
        techniques: ['ハイライト'],
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(response.body.data.updatedAt > before.updatedAt).toBe(true)
      expect(response.body.links).toEqual({
        self: `${PATH}/${before.id}`,
        list: PATH,
      })
      expect((await get(before.id)).body.data).toEqual(response.body.data)
    })

    it('replaces the materials with those the request names, in its order, and with none', async () => {
      const created = await create(
        recordOf(await insertBooking(), {
          materials: [materialOf(treatmentId), materialOf(treatmentId)],
        }),
      )
      const { id } = created.body.data

      const replaced = await update(id, {
        materials: [
          materialOf(colourCreamId, { lotNumber: 'LOT-B', quantity: 20 }),
        ],
      })
      const cleared = await update(id, { materials: [] })

      expect(replaced.body.data.materials).toEqual([
        {
          productId: colourCreamId,
          quantity: 20,
          unit: 'g',
          lotNumber: 'LOT-B',
          notes: null,
        },
      ])
      expect(cleared.body.data.materials).toEqual([])
      expect(await storedMaterials(id)).toEqual([])
    })

    it.each(writers)(
      'changes a record of the salon for %s',
      async (_who, signInAs) => {
        const authorization = await signInAs()
        const id = await insertRecord()

        const response = await update(
          id,
          { services: [colourId, cutId], nextRecommendedDate: '2026-11-20' },
          authorization,
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          services: [colourId, cutId],
          nextRecommendedDate: '2026-11-20',
        })
      },
    )

    it('refuses what the request names that is not of the salon of the booking, and changes nothing', async () => {
      const otherSalon = await insertSalon(db)
      const theirService = await insertService({ salonId: otherSalon })
      const id = await insertRecord()
      const before = await everything()

      const response = await update(id, {
        services: [theirService],
        nextRecommendedDate: '2026-11-01',
        nextRecommendedServices: [cutId],
        materials: [materialOf(colourCreamId)],
      })

      expectRefused(response, INVALID_RECORD, [
        issue('services.0', 'not_found', NO_SUCH_SERVICE),
        issue(
          'nextRecommendedDate',
          'too_small',
          'Must not be before the date of the booking, 2026-11-20',
        ),
        issue('materials.0.lotNumber', 'custom', LOT_NEEDED),
      ])
      expect(await everything()).toEqual(before)
    })

    it('looks only at what the request names: a service the record has that was deleted since stays', async () => {
      const gone = await insertService()
      const id = await insertRecord({ services: [gone] })
      await db
        .update(services)
        .set({ deletedAt: at('00:00') })
        .where(eq(services.id, gone))

      const response = await update(id, { resultNotes: '問題なし' })

      expect(response.status).toBe(200)
      expect(response.body.data.services).toEqual([gone])
    })

    it.each<[string, object, string[]]>([
      ['nothing to change', {}, [':custom']],
      ['a booking', { bookingId: UNKNOWN_ID }, ['bookingId:unrecognized_keys']],
      [
        'a customer',
        { customerId: UNKNOWN_ID },
        ['customerId:unrecognized_keys'],
      ],
      [
        'a staff member',
        { staffId: UNKNOWN_ID },
        ['staffId:unrecognized_keys'],
      ],
      ['services that are null', { services: null }, ['services:invalid_type']],
      ['no services', { services: [] }, ['services:too_small']],
      [
        'a satisfaction of none',
        { customerSatisfaction: 0 },
        ['customerSatisfaction:too_small'],
      ],
      [
        'a material without its product',
        {
          materials: [{ quantity: 1, unit: 'g', lotNumber: null, notes: null }],
        },
        ['materials.0.productId:invalid_type'],
      ],
    ])('refuses %s, and changes nothing', async (_case, body, expected) => {
      const id = await insertRecord()
      const before = await everything()

      const response = await update(id, body)

      expectRefused(response, INVALID_RECORD)
      expect(brokenRules(response)).toEqual(expected)
      expect(await everything()).toEqual(before)
    })

    it('answers 404 for a record of another salon to its members, for one that is not there, and for one whose salon was deleted, and changes nothing', async () => {
      const otherSalon = await insertSalon(db)
      const ofOther = await insertRecordElsewhere(otherSalon)
      const gone = await insertRecordElsewhere(await insertSalon(db))
      await db
        .update(salons)
        .set({ deletedAt: at('00:00') })
        .where(
          eq(
            salons.id,
            (
              await db
                .select({ salonId: bookings.salonId })
                .from(treatmentRecords)
                .innerJoin(
                  bookings,
                  eq(bookings.id, treatmentRecords.bookingId),
                )
                .where(eq(treatmentRecords.id, gone))
            )[0]?.salonId ?? '',
          ),
        )
      const staffMember = await member('staff')()
      const before = await everything()

      expectProblem(
        await update(ofOther, { resultNotes: '他店' }, staffMember),
        notFound,
      )
      expectProblem(await update(UNKNOWN_ID, { resultNotes: 'なし' }), notFound)
      expectProblem(await update(gone, { resultNotes: '削除済み' }), notFound)
      expect(await everything()).toEqual(before)
    })

    it('refuses an ID that is no UUID before the request', async () => {
      expectRefused(await update('record-1', {}), INVALID_ID)
    })
  })

  describe('DELETE /api/v1/treatments/:id', () => {
    it.each<[string, SignInAs]>([
      ['an administrator', async () => asAdmin],
      ['the owner of the salon', member('owner')],
      ['a manager of the salon', member('manager')],
    ])(
      'removes a record with its materials and photos for %s, and answers 204',
      async (_who, signInAs) => {
        const authorization = await signInAs()
        const created = await create(
          recordOf(await insertBooking(), {
            materials: [materialOf(treatmentId)],
          }),
        )
        const { id } = created.body.data
        await db.insert(treatmentPhotos).values({
          treatmentRecordId: id,
          photoType: 'before',
          photoUrl: 'https://images.example.com/before.jpg',
        })
        const kept = await insertRecord()

        const response = await remove(id, authorization)

        expect(response.status).toBe(204)
        expect(response.body).toEqual({})
        expect(await everything()).toMatchObject({
          records: [expect.objectContaining({ id: kept })],
          materials: [],
          photos: [],
        })
        expectProblem(await get(id), notFound)
      },
    )

    it('lets the booking of the record be deleted once the record is removed', async () => {
      const bookingId = await insertBooking({ status: 'completed' })
      const id = await insertRecord({ bookingId })
      const deleteBooking = () =>
        request(app)
          .delete(`/api/v1/bookings/${bookingId}`)
          .set('Authorization', asAdmin)

      const kept = await deleteBooking()
      await remove(id)
      const removed = await deleteBooking()

      expect(statusAndCode(kept)).toBe('409 3003')
      expect(removed.status).toBe(204)
    })

    it('refuses a staff member of the salon, who writes records but does not remove them, and keeps the record', async () => {
      const id = await insertRecord()
      const before = await everything()

      expectProblem(await remove(id, await member('staff')()), forbidden)
      expect(await everything()).toEqual(before)
    })

    it('answers 404 for a record of another salon to its members and for one that is not there, and refuses an ID that is no UUID, removing nothing', async () => {
      const ofOther = await insertRecordElsewhere(await insertSalon(db))
      const owner = await member('owner')()
      const before = await everything()

      expectProblem(await remove(ofOther, owner), notFound)
      expectProblem(await remove(UNKNOWN_ID), notFound)
      expectRefused(await remove('record-1'), INVALID_ID)
      expect(await everything()).toEqual(before)
    })
  })

  describe('who may', () => {
    it.each(outsiders)(
      'refuses %s every operation, and changes nothing',
      async (_who, signInAs) => {
        const id = await insertRecord()
        const authorization = await signInAs()
        const before = await everything()

        const responses: Response[] = []
        for (const call of operations) {
          responses.push(await call(authorization, id))
        }

        expect(responses.map(statusAndCode)).toEqual(
          Array.from({ length: 5 }, () => '403 1005'),
        )
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses a customer the record of their own visit', async () => {
      const id = await insertRecord()
      const { authorization } = await signedInUser(app, db, { customerId })

      expectProblem(await get(id, authorization), forbidden)
      expectProblem(await list({ customerId }, authorization), forbidden)
    })

    it.each(unauthenticated)(
      'refuses %s every operation with 401, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const id = await insertRecord()
        const token = await tokenOf()
        const before = await everything()

        for (const call of operations) {
          const response = await call(token, id)
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['GET below a record', 'get', '/ID/materials'],
      ['PUT on a record', 'put', '/ID'],
      ['POST on a record', 'post', '/ID'],
      ['PATCH on the list', 'patch', ''],
      ['DELETE on the list', 'delete', ''],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertRecord()
        const before = await everything()

        const response = await request(app)
          [method](`${PATH}${suffix.replace('ID', id)}`)
          .set('Authorization', asAdmin)
          .send({ resultNotes: '変更' })

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('requests at the same moment', () => {
    /** Holds a row as a change or a removal of it does, and runs the change. */
    const whileHeld = async (
      hold: (tx: Transaction) => Promise<unknown>,
      call: () => Promise<Response>,
    ): Promise<{ response: Response; answeredWhileHeld: boolean }> => {
      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await hold(tx)
          const underWay = call()

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      return { response: await pending, answeredWhileHeld }
    }

    it('writes one record of a booking when two creations arrive together', async () => {
      const bookingId = await insertBooking()
      const staffMember = await member('staff')()

      const responses = await Promise.all([
        create(recordOf(bookingId, { materials: [materialOf(treatmentId)] })),
        create(recordOf(bookingId), staffMember),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
      ])
      const { records, materials } = await everything()
      expect(records).toHaveLength(1)
      expect(materials).toHaveLength(
        responses.find(({ status }) => status === 201)?.body.data.materials
          .length,
      )
    })

    it('makes a creation wait for a cancellation of the booking in progress, and refuses the cancelled booking', async () => {
      const bookingId = await insertBooking()

      const { response, answeredWhileHeld } = await whileHeld(
        async (tx) => {
          await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .for('update')
          await tx
            .update(bookings)
            .set({ status: 'cancelled', cancelledAt: at('01:30') })
            .where(eq(bookings.id, bookingId))
        },
        () => create(recordOf(bookingId)).then((answer) => answer),
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(notTreated('cancelled'))
    })

    it('makes a creation wait for a completion of the booking in progress, and writes the record when the wait is over', async () => {
      const bookingId = await insertBooking()

      const { pending, answeredWhileHeld, releasedAt } = await db.transaction(
        async (tx) => {
          await tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, bookingId))
            .for('update')
          await tx
            .update(bookings)
            .set({ status: 'completed', completedAt: at('02:00') })
            .where(eq(bookings.id, bookingId))
          const underWay = create(recordOf(bookingId)).then(
            (response) => response,
          )

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            releasedAt: await databaseMoment(tx),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(201)
      // Written when the wait was over, not when the creation began.
      expect(
        new Date(response.body.data.createdAt).getTime(),
      ).toBeGreaterThanOrEqual(releasedAt)
      expect(
        new Date(response.body.data.updatedAt).getTime(),
      ).toBeGreaterThanOrEqual(releasedAt)
    })

    it.each<
      [
        string,
        (id: string) => Test,
        (response: Response, id: string) => unknown,
      ]
    >([
      [
        'the list',
        () => list(),
        (response, id) =>
          response.body.data.find((record: { id: string }) => record.id === id)
            ?.materials,
      ],
      ['the get', (id) => get(id), (response) => response.body.data.materials],
    ])(
      'reads a record and its materials at one moment: %s',
      async (_case, read, materialsIn) => {
        const id = await insertRecord()
        /** Whether the read came to wait for the table of the materials. */
        const waitedFor = async (): Promise<boolean> => {
          for (let attempt = 0; attempt < 100; attempt += 1) {
            const [locks] = await db.execute(
              sql`SELECT count(*)::int AS "waiting" FROM pg_locks WHERE NOT granted AND relation = 'treatment_materials'::regclass`,
            )
            if (Number(locks?.['waiting']) > 0) {
              return true
            }
            await pause(20)
          }
          return false
        }

        const { pending, waited } = await db.transaction(async (tx) => {
          await tx.execute(
            sql`LOCK TABLE ${treatmentMaterials} IN ACCESS EXCLUSIVE MODE`,
          )
          const underWay = read(id).then((response) => response)
          // The read has read the record and waits to read its materials;
          // one is written meanwhile.
          const blocked = await waitedFor()
          await tx.insert(treatmentMaterials).values({
            treatmentRecordId: id,
            productId: treatmentId,
            quantity: '3.00',
            unit: 'g',
            sortOrder: 0,
          })

          return { pending: underWay, waited: blocked }
        })
        const response = await pending

        expect(waited).toBe(true)
        expect(response.status).toBe(200)
        // The record as it was when the read began, without the material.
        expect(materialsIn(response, id)).toEqual([])
        expect((await get(id)).body.data.materials).toHaveLength(1)
      },
    )

    /** Holds a row as its removal does, and marks it deleted. */
    const removing =
      (
        table:
          | typeof services
          | typeof staff
          | typeof products
          | typeof customers,
        id: string,
      ) =>
      async (tx: Transaction) => {
        await tx
          .select({ id: table.id })
          .from(table)
          .where(eq(table.id, id))
          .for('update')
        await tx
          .update(table)
          .set({ deletedAt: at('01:30') })
          .where(eq(table.id, id))
      }

    it.each<
      [
        string,
        () => Promise<{
          overrides: Record<string, unknown>
          hold: (tx: Transaction) => Promise<unknown>
        }>,
        string,
      ]
    >([
      [
        'a service',
        async () => {
          const id = await insertService({ name: 'Head spa' })
          return {
            overrides: { services: [cutId, id] },
            hold: removing(services, id),
          }
        },
        'services.1:not_found',
      ],
      [
        'the staff member',
        async () => {
          const id = await insertStaff(db, salonId)
          return { overrides: { staffId: id }, hold: removing(staff, id) }
        },
        'staffId:not_found',
      ],
      [
        'a product',
        async () => {
          const id = await insertProduct()
          return {
            overrides: {
              materials: [materialOf(treatmentId), materialOf(id)],
            },
            hold: removing(products, id),
          }
        },
        'materials.1.productId:not_found',
      ],
      [
        'the customer',
        async () => ({
          overrides: {},
          hold: removing(customers, customerId),
        }),
        'customerId:not_found',
      ],
    ])(
      'makes a creation wait for the removal of %s in progress, and refuses it as one that is not there',
      async (_case, setUp, expected) => {
        const bookingId = await insertBooking()
        const { overrides, hold } = await setUp()

        const { response, answeredWhileHeld } = await whileHeld(hold, () =>
          create(recordOf(bookingId, overrides)).then((answer) => answer),
        )

        expect(answeredWhileHeld).toBe(false)
        expectRefused(response, INVALID_RECORD)
        expect(brokenRules(response)).toEqual([expected])
        expect((await everything()).records).toEqual([])
      },
    )

    it('takes two changes of the materials of a record in turns: the record has those of one of them, whole', async () => {
      const id = await insertRecord()
      const first = [materialOf(treatmentId), materialOf(treatmentId)]
      const second = [
        materialOf(colourCreamId, { lotNumber: 'LOT-C' }),
        materialOf(colourCreamId, { lotNumber: 'LOT-D' }),
        materialOf(colourCreamId, { lotNumber: 'LOT-E' }),
      ]

      const responses = await Promise.all([
        update(id, { materials: first }),
        update(id, { materials: second }),
      ])

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      const stored = (await storedMaterials(id)).map(
        ({ productId, lotNumber, sortOrder }) => ({
          productId,
          lotNumber,
          sortOrder,
        }),
      )
      const expected = (materials: typeof second) =>
        materials.map(({ productId, lotNumber }, sortOrder) => ({
          productId,
          lotNumber,
          sortOrder,
        }))
      expect([expected(first), expected(second)]).toContainEqual(stored)
      expect((await get(id)).body.data.materials).toHaveLength(stored.length)
    })

    it('makes a change wait for the removal of its record in progress, and answers 404', async () => {
      const id = await insertRecord()

      const { response, answeredWhileHeld } = await whileHeld(
        (tx) => tx.delete(treatmentRecords).where(eq(treatmentRecords.id, id)),
        () =>
          update(id, { resultNotes: '遅れた変更' }).then((answer) => answer),
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notFound)
      expect(await everything()).toEqual({
        records: [],
        materials: [],
        photos: [],
      })
    })

    it('makes a change wait for the removal of a product it names, and refuses the product as one that is not there', async () => {
      const id = await insertRecord()
      const gone = await insertProduct()

      const { response, answeredWhileHeld } = await whileHeld(
        removing(products, gone),
        () =>
          update(id, { materials: [materialOf(gone)] }).then(
            (answer) => answer,
          ),
      )

      expect(answeredWhileHeld).toBe(false)
      expectRefused(response, INVALID_RECORD, [
        issue('materials.0.productId', 'not_found', NO_SUCH_PRODUCT),
      ])
      expect(await storedMaterials(id)).toEqual([])
    })
  })

  describe('TreatmentRecordRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new TreatmentRecordRepository(db)
    const everySalon: LedgerReach = { type: 'everySalon' }

    it('lets the database refuse a record without services and an out-of-range satisfaction, and writes nothing', async () => {
      const bookingId = bookingIdSchema.parse(await insertBooking())
      const record = {
        bookingId,
        customerId: customerIdSchema.parse(customerId),
        staffId: staffIdSchema.parse(staffId),
        services: [],
        techniques: [],
        consultationNotes: null,
        scalpCondition: null,
        hairCondition: null,
        colorFormula: null,
        processingTime: null,
        resultNotes: null,
        nextRecommendedDate: null,
        nextRecommendedServices: [],
        homeCareSuggestions: null,
        customerSatisfaction: null,
        staffEvaluation: null,
      }

      const results = [
        await repository().create({
          reach: everySalon,
          record,
          materials: [],
        }),
        await repository().create({
          reach: everySalon,
          record: {
            ...record,
            services: [serviceIdOf(cutId)],
            customerSatisfaction: 6,
          },
          materials: [],
        }),
      ]

      expect(results).toEqual([
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to create treatment record',
          }),
        }),
        expect.objectContaining({
          type: 'error',
          error: expect.objectContaining({ type: 'database' }),
        }),
      ])
      expect(await everything()).toEqual({
        records: [],
        materials: [],
        photos: [],
      })
    })

    it('reads what it wrote, as one record', async () => {
      const bookingId = bookingIdSchema.parse(await insertBooking())

      const created = dataOf(
        await repository().create({
          reach: { type: 'salon', salonId: salonIdOf(salonId) },
          record: {
            bookingId,
            customerId: customerIdSchema.parse(customerId),
            staffId: staffIdSchema.parse(staffId),
            services: [serviceIdOf(cutId)],
            techniques: [],
            consultationNotes: null,
            scalpCondition: null,
            hairCondition: null,
            colorFormula: null,
            processingTime: null,
            resultNotes: null,
            nextRecommendedDate: null,
            nextRecommendedServices: [],
            homeCareSuggestions: null,
            customerSatisfaction: null,
            staffEvaluation: null,
          },
          materials: [],
        }),
      )

      expect(created.type).toBe('created')
      const id = treatmentRecordIdSchema.parse(
        (await everything()).records[0]?.id,
      )
      expect(dataOf(await repository().findById(everySalon, id))).toEqual(
        created.type === 'created' ? created.record : null,
      )
    })

    it('tells the database could not be reached, for every method', async () => {
      const connection = connectUnreachableDatabase()
      const unreachable = new TreatmentRecordRepository(connection.database)
      const id = treatmentRecordIdSchema.parse(UNKNOWN_ID)

      const results = [
        await unreachable.create({
          reach: everySalon,
          record: {
            bookingId: bookingIdSchema.parse(UNKNOWN_ID),
            customerId: customerIdSchema.parse(UNKNOWN_ID),
            staffId: staffIdSchema.parse(UNKNOWN_ID),
            services: [serviceIdOf(UNKNOWN_ID)],
            techniques: [],
            consultationNotes: null,
            scalpCondition: null,
            hairCondition: null,
            colorFormula: null,
            processingTime: null,
            resultNotes: null,
            nextRecommendedDate: null,
            nextRecommendedServices: [],
            homeCareSuggestions: null,
            customerSatisfaction: null,
            staffEvaluation: null,
          },
          materials: [],
        }),
        await unreachable.findById(everySalon, id),
        await unreachable.list({
          reach: everySalon,
          limit: 1,
          after: null,
          salonId: null,
          customerId: null,
          staffId: null,
          startDate: null,
          endDate: null,
        }),
        await unreachable.update(everySalon, id, {
          changes: { resultNotes: null },
          materials: null,
        }),
        await unreachable.delete(everySalon, id),
      ]
      await connection.close()

      expect(
        results.map((result) =>
          result.type === 'error' && result.error.type === 'database'
            ? result.error.message
            : 'not an error',
        ),
      ).toEqual([
        'Failed to create treatment record',
        'Failed to find treatment record',
        'Failed to list treatment records',
        'Failed to update treatment record',
        'Failed to delete treatment record',
      ])
    })
  })
})
