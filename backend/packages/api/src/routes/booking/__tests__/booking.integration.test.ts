import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  salons,
  services,
  staff,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  customerIdSchema,
  type DomainError,
  type LedgerReach,
  type RequestedBooking,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { BookingRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { ruleMessages } from '@beauty-salon-shared/i18n/messages/api'
import { asc, eq } from 'drizzle-orm'
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
  tokenExpired,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const BOOKINGS = '/api/v1/bookings'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** `BK-XXXX-XXXX` in the symbols of Crockford's Base32. */
const BOOKING_NUMBER = /^BK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/
const LOOPBACK = /^(::ffff:)?127\.0\.0\.1$|^::1$/

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const INVALID_BOOKING = 'Invalid booking'
const INVALID_SEARCH = 'Invalid booking search'

/** The properties of a BookingResponse. */
const PROPERTIES = [
  'actualEndTime',
  'actualStartTime',
  'bookingDate',
  'bookingNumber',
  'cancellationFee',
  'cancellationReason',
  'cancelledAt',
  'cancelledBy',
  'completedAt',
  'createdAt',
  'customerId',
  'customerRequest',
  'depositAmount',
  'discountAmount',
  'duration',
  'endTime',
  'id',
  'internalNotes',
  'pointsEarned',
  'pointsUsed',
  'reminderSent',
  'reminderSentAt',
  'salonId',
  'services',
  'source',
  'staffId',
  'startTime',
  'status',
  'subtotal',
  'taxAmount',
  'totalAmount',
  'updatedAt',
]

/** The properties of a BookingServiceResponse. */
const SERVICE_PROPERTIES = [
  'completedAt',
  'discountAmount',
  'duration',
  'endTime',
  'finalPrice',
  'id',
  'isCompleted',
  'notes',
  'price',
  'serviceId',
  'sortOrder',
  'staffId',
  'startTime',
  'taxIncluded',
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

/** A time of 20 November 2026 in UTC, `HH:MM`; ten in the morning in Tokyo is 01:00. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

/** The same time as a response writes it. */
const written = (time: string): string => `2026-11-20T${time}:00.000Z`

describe('Bookings API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** A signed-in admin. */
  let admin: { id: string; authorization: string }
  /** The Authorization header of the admin. */
  let asAdmin: string
  /** The salon of most tests: in Tokyo, with a tax of 10%. */
  let salonId: string
  let customerId: string
  /** A staff member of the salon who takes one booking at a time and keeps no time free. */
  let staffId: string
  /** A cut of the salon: 60 minutes, 6,600 yen with the tax in it. */
  let cutId: string
  /** A colouring of the salon: 90 minutes, 8,000 yen discounted to 7,000, the tax not in it. */
  let colorId: string

  type NewSalon = typeof salons.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type NewService = typeof services.$inferInsert
  type NewBooking = typeof bookings.$inferInsert
  type NewBookingService = typeof bookingServices.$inferInsert
  type Executor = Pick<typeof db, 'insert'>

  /** A service of a salon as a row; returns its ID. */
  const insertService = async (
    overrides: Partial<NewService> = {},
    salon: string = salonId,
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId: salon,
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

  /** A staff member of a salon who takes one booking at a time and keeps no time free, unless stated otherwise. */
  const staffMember = (
    overrides: Partial<NewStaff> = {},
    salon: string = salonId,
  ): Promise<string> =>
    insertStaff(db, salon, {
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      ...overrides,
    })

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(db, { timezone: 'Asia/Tokyo', taxRate: '10.00', ...overrides })

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    admin = await signedInUser(app, db, { role: 'admin' })
    asAdmin = admin.authorization
    salonId = await salon()
    customerId = await insertCustomer(db)
    staffId = await staffMember()
    cutId = await insertService()
    colorId = await insertService({
      name: 'Colour',
      duration: 90,
      price: 8000,
      discountPrice: 7000,
      taxIncluded: false,
    })
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A service line that keeps every rule: a cut by the staff member from ten in Tokyo. */
  const line = (overrides: Record<string, unknown> = {}) => ({
    serviceId: cutId,
    staffId,
    startTime: at('01:00'),
    notes: null,
    ...overrides,
  })

  /** A request that keeps every rule and states nothing that may be unset. */
  const booking = (overrides: Record<string, unknown> = {}) => ({
    salonId,
    customerId,
    staffId,
    depositAmount: null,
    customerRequest: null,
    internalNotes: null,
    source: null,
    services: [line()],
    ...overrides,
  })

  /** Enters a booking; as the admin unless said otherwise. */
  const create = (body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(BOOKINGS), as).send(body)

  /** Reads a booking; as the admin unless said otherwise. */
  const read = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${BOOKINGS}/${id}`), as)

  /** Lists bookings; as the admin unless said otherwise. */
  const list = (
    query: Record<string, string> = {},
    as: string | null = asAdmin,
  ) => authorized(request(app).get(BOOKINGS).query(query), as)

  /** The booking a request created; anything but 201 fails the test. */
  const created = async (
    overrides: Record<string, unknown> = {},
    as: string = asAdmin,
  ) => {
    const response = await create(booking(overrides), as)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** A booking of one cut by the staff member at that time. */
  const cutAt = (time: string, overrides: Record<string, unknown> = {}) =>
    created({ services: [line({ startTime: at(time) })], ...overrides })

  const storedBookings = () =>
    db
      .select()
      .from(bookings)
      .orderBy(asc(bookings.startTime), asc(bookings.id))

  const storedLines = () =>
    db
      .select()
      .from(bookingServices)
      .orderBy(asc(bookingServices.bookingId), asc(bookingServices.sortOrder))

  const storedHistory = () =>
    db
      .select()
      .from(bookingStatusHistories)
      .orderBy(asc(bookingStatusHistories.createdAt))

  /** Checks that nothing of a booking is stored. */
  const expectNothingStored = async (): Promise<void> => {
    expect(await db.$count(bookings)).toBe(0)
    expect(await db.$count(bookingServices)).toBe(0)
    expect(await db.$count(bookingStatusHistories)).toBe(0)
  }

  let rows = 0

  /** A row of `bookings` that keeps every constraint: an hour from ten in Tokyo. */
  const bookingRow = (overrides: Partial<NewBooking> = {}): NewBooking => {
    rows += 1
    return {
      bookingNumber: `BK-TEST-${String(rows).padStart(4, '0')}`,
      salonId,
      customerId,
      staffId,
      bookingDate: '2026-11-20',
      startTime: at('01:00'),
      endTime: at('02:00'),
      duration: 60,
      subtotal: 6600,
      totalAmount: 6600,
      ...overrides,
    }
  }

  /** A row of `booking_services` that keeps every constraint: the cut of the row above. */
  const lineRow = (
    bookingId: string,
    overrides: Partial<NewBookingService> = {},
  ): NewBookingService => ({
    bookingId,
    serviceId: cutId,
    staffId,
    startTime: at('01:00'),
    endTime: at('02:00'),
    duration: 60,
    price: 6600,
    finalPrice: 6600,
    taxIncluded: true,
    ...overrides,
  })

  /** Inserts a booking with one service line directly; returns the ID of the booking. */
  const insertBooking = async (
    executor: Executor,
    overrides: Partial<NewBooking> = {},
    lineOverrides: Partial<NewBookingService> = {},
  ): Promise<string> => {
    const [row] = await executor
      .insert(bookings)
      .values(bookingRow(overrides))
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    await executor
      .insert(bookingServices)
      .values(lineRow(row.id, lineOverrides))
    return row.id
  }

  /** A status with the times the table wants a booking in that status to have, and no others. */
  const inStatus = (status: NewBooking['status']): Partial<NewBooking> => ({
    status,
    cancelledAt: status === 'cancelled' ? at('00:30') : null,
    completedAt: status === 'completed' ? at('02:00') : null,
    actualStartTime: status === 'in_progress' ? at('01:00') : null,
  })

  const setStatus = async (
    id: string,
    status: NewBooking['status'],
  ): Promise<void> => {
    await db.update(bookings).set(inStatus(status)).where(eq(bookings.id, id))
  }

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

  /** Signs in as a new member of a salon; of the salon of the tests unless another is given. */
  const signedInMember = (
    role: 'owner' | 'manager' | 'staff',
    salonOf: () => Promise<string> = async () => salonId,
  ): Promise<string> => member(role, salonOf)()

  /** Everyone who keeps the ledger of the salon of the tests. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** The members of another salon than the one of the tests. */
  const membersOfAnotherSalon: [string, SignInAs][] = [
    ['the owner of another salon', member('owner', salon)],
    ['a manager of another salon', member('manager', salon)],
    ['a staff member of another salon', member('staff', salon)],
  ]

  /** A signed-in customer with a profile. */
  const customerAccount = async (): Promise<{
    authorization: string
    customerId: string
  }> => {
    const ownCustomerId = await insertCustomer(db)
    const { authorization } = await signedInUser(app, db, {
      customerId: ownCustomerId,
    })
    return { authorization, customerId: ownCustomerId }
  }

  /** Accounts the ledger is closed to. */
  const notKeepers: [string, SignInAs][] = [
    [
      'a customer with a profile',
      async () => (await customerAccount()).authorization,
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

  /**
   * Tokens that every operation refuses, before anything else is looked at:
   * none, one that names no session, one that has run out.
   */
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

  describe('POST /api/v1/bookings', () => {
    it('enters a booking and returns it with its service lines, what the system set, and where it is', async () => {
      const other = await staffMember()

      const response = await create(
        booking({
          depositAmount: 1000,
          customerRequest: '前回と同じ長さで',
          internalNotes: '電話で受付',
          source: 'phone',
          services: [
            line(),
            line({
              serviceId: colorId,
              staffId: other,
              startTime: at('02:00'),
              notes: '明るめ',
            }),
          ],
        }),
      )

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const { id } = response.body.data
      expect(response.headers['location']).toBe(`${BOOKINGS}/${id}`)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          bookingNumber: expect.stringMatching(BOOKING_NUMBER),
          salonId,
          customerId,
          staffId,
          bookingDate: '2026-11-20',
          startTime: written('01:00'),
          endTime: written('03:30'),
          duration: 150,
          status: 'pending',
          subtotal: 14600,
          discountAmount: 1000,
          taxAmount: 700,
          totalAmount: 14300,
          depositAmount: 1000,
          pointsUsed: null,
          pointsEarned: null,
          customerRequest: '前回と同じ長さで',
          internalNotes: '電話で受付',
          reminderSent: false,
          reminderSentAt: null,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          cancellationFee: null,
          completedAt: null,
          actualStartTime: null,
          actualEndTime: null,
          source: 'phone',
          services: [
            {
              id: expect.stringMatching(UUID),
              serviceId: cutId,
              staffId,
              startTime: written('01:00'),
              endTime: written('02:00'),
              duration: 60,
              price: 6600,
              discountAmount: 0,
              finalPrice: 6600,
              taxIncluded: true,
              isCompleted: false,
              completedAt: null,
              notes: null,
              sortOrder: 0,
            },
            {
              id: expect.stringMatching(UUID),
              serviceId: colorId,
              staffId: other,
              startTime: written('02:00'),
              endTime: written('03:30'),
              duration: 90,
              price: 8000,
              discountAmount: 1000,
              finalPrice: 7000,
              taxIncluded: false,
              isCompleted: false,
              completedAt: null,
              notes: '明るめ',
              sortOrder: 1,
            },
          ],
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${BOOKINGS}/${id}`, list: BOOKINGS },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
    })

    it('stores the booking, its lines, and the first entry of its history with who entered it', async () => {
      const { id, bookingNumber } = await created({ depositAmount: 500 })

      expect(await storedBookings()).toEqual([
        expect.objectContaining({
          id,
          bookingNumber,
          salonId,
          customerId,
          staffId,
          bookingDate: '2026-11-20',
          duration: 60,
          status: 'pending',
          subtotal: 6600,
          discountAmount: 0,
          taxAmount: 0,
          totalAmount: 6600,
          depositAmount: 500,
          pointsUsed: null,
          pointsEarned: null,
          reminderSent: false,
          cancellationFee: null,
        }),
      ])
      expect(await storedLines()).toEqual([
        expect.objectContaining({
          bookingId: id,
          serviceId: cutId,
          staffId,
          duration: 60,
          price: 6600,
          discountAmount: 0,
          finalPrice: 6600,
          taxIncluded: true,
          isCompleted: false,
          completedAt: null,
          sortOrder: 0,
        }),
      ])
      expect(await storedHistory()).toEqual([
        expect.objectContaining({
          bookingId: id,
          fromStatus: null,
          toStatus: 'pending',
          changedBy: admin.id,
          reason: null,
          metadata: null,
        }),
      ])
    })

    it('says where the booking is by the path alone, and takes nothing from a query', async () => {
      const response = await authorized(
        request(app).post(`${BOOKINGS}?source=online`),
        asAdmin,
      ).send(booking())

      expect(response.status).toBe(201)
      const { id } = response.body.data
      expect(response.headers['location']).toBe(`${BOOKINGS}/${id}`)
      expect(response.body.links).toEqual({
        self: `${BOOKINGS}/${id}`,
        list: BOOKINGS,
      })
      expect(response.body.data.source).toBeNull()
    })

    it('keeps where the request came from in the ledger, and shows it in no response', async () => {
      const response = await create(booking()).set(
        'User-Agent',
        'SalonDesk/2.0',
      )
      const read = await request(app)
        .get(`${BOOKINGS}/${response.body.data.id}`)
        .set('Authorization', asAdmin)

      expect(await storedBookings()).toEqual([
        expect.objectContaining({
          ipAddress: expect.stringMatching(LOOPBACK),
          userAgent: 'SalonDesk/2.0',
        }),
      ])
      for (const body of [response.body, read.body]) {
        expect(body.data).not.toHaveProperty('ipAddress')
        expect(body.data).not.toHaveProperty('userAgent')
      }
    })

    it('keeps that the client did not say what it is', async () => {
      await create(booking())

      expect(await storedBookings()).toEqual([
        expect.objectContaining({ userAgent: null }),
      ])
    })

    it('names a member of the salon who entered the booking in its history', async () => {
      const owner = await insertMember(db, 'owner', salonId)
      const { authorization } = await signIn(app, owner.email)

      await created({}, authorization)

      expect(await storedHistory()).toEqual([
        expect.objectContaining({ changedBy: owner.id }),
      ])
    })

    it('gives every booking a number of its own', async () => {
      const numbers = [
        (await cutAt('01:00')).bookingNumber,
        (await cutAt('03:00')).bookingNumber,
        (await cutAt('05:00')).bookingNumber,
      ]

      expect(new Set(numbers).size).toBe(3)
      for (const number of numbers) {
        expect(number).toMatch(BOOKING_NUMBER)
      }
    })

    describe('what the system sets', () => {
      it('takes the time and the amounts of a line from its service as it is now', async () => {
        await db
          .update(services)
          .set({ duration: 45, price: 5000, discountPrice: 4500 })
          .where(eq(services.id, cutId))

        const { services: lines } = await created()

        expect(lines).toMatchObject([
          {
            startTime: written('01:00'),
            endTime: written('01:45'),
            duration: 45,
            price: 5000,
            discountAmount: 500,
            finalPrice: 4500,
          },
        ])
      })

      it('lasts from the earliest start to the latest end, whatever the order of the lines', async () => {
        const data = await created({
          services: [
            line({ startTime: at('03:00') }),
            line({ serviceId: colorId, staffId: null, startTime: at('00:45') }),
          ],
        })

        expect(data).toMatchObject({
          startTime: written('00:45'),
          endTime: written('04:00'),
          duration: 195,
          services: [
            { sortOrder: 0, startTime: written('03:00') },
            { sortOrder: 1, startTime: written('00:45') },
          ],
        })
      })

      it.each([
        [
          'the day in Tokyo',
          'Asia/Tokyo',
          '2026-11-20T14:59:00Z',
          '2026-11-20',
        ],
        [
          'the next day in Tokyo, from midnight there',
          'Asia/Tokyo',
          '2026-11-20T15:00:00Z',
          '2026-11-21',
        ],
        [
          'the day before in New York',
          'America/New_York',
          '2026-11-20T01:00:00Z',
          '2026-11-19',
        ],
        ['the day in UTC', 'UTC', '2026-11-20T23:59:00Z', '2026-11-20'],
      ])(
        'has the day of the visit as it is in the salon: %s',
        async (_case, timezone, startTime, bookingDate) => {
          const elsewhere = await salon({ timezone })
          const member = await staffMember({}, elsewhere)
          const cut = await insertService({}, elsewhere)

          const response = await create(
            booking({
              salonId: elsewhere,
              staffId: member,
              services: [line({ serviceId: cut, staffId: member, startTime })],
            }),
          )

          expect(response.status).toBe(201)
          expect(response.body.data.bookingDate).toBe(bookingDate)
          expect(await storedBookings()).toEqual([
            expect.objectContaining({ bookingDate }),
          ])
        },
      )

      it.each([
        ['10% of 999 yen', '10.00', 999, 99],
        ['8% of 1,234 yen', '8.00', 1234, 98],
        ['10.5% of 1,000 yen', '10.50', 1000, 105],
        ['0% of 1,000 yen', '0.00', 1000, 0],
      ])(
        'adds the tax of the salon to a price without it and drops the fraction of a yen: %s',
        async (_case, taxRate, price, taxAmount) => {
          const taxed = await salon({ taxRate })
          const member = await staffMember({}, taxed)
          const service = await insertService(
            { price, taxIncluded: false },
            taxed,
          )

          const response = await create(
            booking({
              salonId: taxed,
              staffId: member,
              services: [line({ serviceId: service, staffId: member })],
            }),
          )

          expect(response.body.data).toMatchObject({
            subtotal: price,
            discountAmount: 0,
            taxAmount,
            totalAmount: price + taxAmount,
          })
        },
      )

      it('rounds the tax once for the booking and not for every line', async () => {
        const service = await insertService({ price: 15, taxIncluded: false })

        const data = await created({
          services: [
            line({ serviceId: service, staffId: null }),
            line({ serviceId: service, staffId: null }),
          ],
        })

        // 10% of 15 yen is 1.5 yen: 1 yen for each line, 3 yen for the two.
        expect(data).toMatchObject({
          subtotal: 30,
          taxAmount: 3,
          totalAmount: 33,
        })
      })

      it('adds no tax to a price that has it', async () => {
        expect(await created()).toMatchObject({
          subtotal: 6600,
          taxAmount: 0,
          totalAmount: 6600,
        })
      })
    })

    describe('what a request may be', () => {
      it('accepts every value that may be unset as null', async () => {
        const data = await created({ services: [line({ staffId: null })] })

        expect(data).toMatchObject({
          depositAmount: null,
          customerRequest: null,
          internalNotes: null,
          source: null,
          services: [{ staffId: null, notes: null }],
        })
      })

      it('accepts a visit that has passed, the same service twice, and services at the same time', async () => {
        const response = await create(
          booking({
            services: [
              line({ startTime: '2020-01-06T01:00:00Z' }),
              line({ staffId: null, startTime: '2020-01-06T01:00:00Z' }),
              line({ staffId: null, startTime: '2020-01-06T01:30:00Z' }),
            ],
          }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data).toMatchObject({
          bookingDate: '2020-01-06',
          duration: 90,
          subtotal: 19800,
        })
      })

      it('accepts a service that begins 24 hours after the earliest one, and no later one', async () => {
        const within = await create(
          booking({
            services: [
              line({ staffId: null }),
              line({ staffId: null, startTime: '2026-11-21T01:00:00Z' }),
            ],
          }),
        )
        const beyond = await create(
          booking({
            services: [
              line({ staffId: null }),
              line({ staffId: null, startTime: '2026-11-21T01:01:00Z' }),
            ],
          }),
        )

        expect(within.status).toBe(201)
        expectProblem(beyond, badRequest)
        expect(brokenRules(beyond)).toEqual(['services.1.startTime:custom'])
      })

      it.each<[string, () => Promise<Record<string, unknown>>]>([
        [
          'a staff member who does not work at the salon now',
          async () => {
            const id = await staffMember({ isActive: false })
            return { staffId: id, services: [line({ staffId: id })] }
          },
        ],
        [
          'a staff member who takes no bookings from customers',
          async () => {
            const id = await staffMember({ canReceiveBookings: false })
            return { staffId: id, services: [line({ staffId: id })] }
          },
        ],
        [
          'a service that is not offered now',
          async () => ({
            services: [
              line({
                serviceId: await insertService({
                  isActive: false,
                  serviceStatus: 'inactive',
                  allowOnlineBooking: false,
                }),
              }),
            ],
          }),
        ],
        [
          'a service that asks for a more senior staff member',
          async () => ({
            services: [
              line({
                serviceId: await insertService({
                  requiredStaffLevel: 'director',
                }),
              }),
            ],
          }),
        ],
        [
          'a customer who is not active',
          async () => {
            const id = await insertCustomer(db)
            await db
              .update(customers)
              .set({ isActive: false, customerStatus: 'blacklisted' })
              .where(eq(customers.id, id))
            return { customerId: id }
          },
        ],
        [
          'a time at night, outside any opening hours',
          async () => ({ services: [line({ startTime: at('18:00') })] }),
        ],
      ])(
        'accepts %s: what the salon enters is the salon’s to judge',
        async (_case, overridesOf) => {
          const response = await create(booking(await overridesOf()))

          expect(response.status).toBe(201)
        },
      )

      it('accepts a booking of a salon that is not active', async () => {
        const closed = await salon({ isActive: false })
        const member = await staffMember({}, closed)
        const cut = await insertService({}, closed)

        const response = await create(
          booking({
            salonId: closed,
            staffId: member,
            services: [line({ serviceId: cut, staffId: member })],
          }),
        )

        expect(response.status).toBe(201)
      })

      it.each<[string, Record<string, unknown>, string[]]>([
        [
          'a salon that is no ID',
          { salonId: 'aoyama' },
          ['salonId:invalid_format'],
        ],
        [
          'a customer that is no ID',
          { customerId: 7 },
          ['customerId:invalid_type'],
        ],
        [
          'no staff member in charge',
          { staffId: null },
          ['staffId:invalid_type'],
        ],
        [
          'a negative deposit',
          { depositAmount: -1 },
          ['depositAmount:too_small'],
        ],
        [
          'a deposit with a fraction of a yen',
          { depositAmount: 100.5 },
          ['depositAmount:invalid_type'],
        ],
        [
          'a deposit that is more than the column holds',
          { depositAmount: 2_147_483_648 },
          ['depositAmount:too_big'],
        ],
        [
          'a customer request that says nothing',
          { customerRequest: ' ' },
          ['customerRequest:invalid_format'],
        ],
        [
          'internal notes that say nothing',
          { internalNotes: '' },
          ['internalNotes:invalid_format'],
        ],
        [
          'a source of 51 characters',
          { source: 'a'.repeat(51) },
          ['source:too_big'],
        ],
        ['no services', { services: [] }, ['services:too_small']],
        [
          'services that are no list',
          { services: null },
          ['services:invalid_type'],
        ],
        ['a status', { status: 'confirmed' }, ['status:unrecognized_keys']],
        [
          'a booking number',
          { bookingNumber: 'BK-0000-0001' },
          ['bookingNumber:unrecognized_keys'],
        ],
        ['a total', { totalAmount: 0 }, ['totalAmount:unrecognized_keys']],
        [
          'a day of the visit',
          { bookingDate: '2026-11-20' },
          ['bookingDate:unrecognized_keys'],
        ],
      ])('refuses %s and stores nothing', async (_case, change, rules) => {
        const response = await create(booking(change))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_BOOKING)
        expect(brokenRules(response)).toEqual(rules)
        await expectNothingStored()
      })

      it.each<[string, Record<string, unknown>, string[]]>([
        [
          'a service that is no ID',
          { serviceId: 'cut' },
          ['services.0.serviceId:invalid_format'],
        ],
        [
          'a staff member that is no ID',
          { staffId: 'hanako' },
          ['services.0.staffId:invalid_format'],
        ],
        [
          'a time with an offset',
          { startTime: '2026-11-20T10:00:00+09:00' },
          ['services.0.startTime:invalid_format'],
        ],
        [
          'a time without seconds',
          { startTime: '2026-11-20T01:00Z' },
          ['services.0.startTime:invalid_format'],
        ],
        [
          'a time on half a minute',
          { startTime: '2026-11-20T01:00:30Z' },
          ['services.0.startTime:custom'],
        ],
        [
          'a day that does not exist',
          { startTime: '2026-02-30T01:00:00Z' },
          ['services.0.startTime:invalid_format'],
        ],
        [
          'notes that say nothing',
          { notes: ' ' },
          ['services.0.notes:invalid_format'],
        ],
        ['a price', { price: 0 }, ['services.0.price:unrecognized_keys']],
        [
          'an end',
          { endTime: at('01:30') },
          ['services.0.endTime:unrecognized_keys'],
        ],
        [
          'a duration',
          { duration: 5 },
          ['services.0.duration:unrecognized_keys'],
        ],
      ])(
        'refuses a service line with %s and stores nothing',
        async (_case, change, rules) => {
          const response = await create(booking({ services: [line(change)] }))

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(rules)
          await expectNothingStored()
        },
      )

      it.each([
        'salonId',
        'customerId',
        'staffId',
        'depositAmount',
        'customerRequest',
        'internalNotes',
        'source',
        'services',
      ])(
        'requires %s: nothing of a new booking is optional',
        async (property) => {
          const { [property]: _omitted, ...body }: Record<string, unknown> =
            booking()

          const response = await create(body)

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual([`${property}:invalid_type`])
        },
      )

      it('takes 20 services and refuses 21', async () => {
        const lines = (count: number) =>
          Array.from({ length: count }, () => line({ staffId: null }))

        const twenty = await create(booking({ services: lines(20) }))
        const twentyOne = await create(booking({ services: lines(21) }))

        expect(twenty.status).toBe(201)
        expect(twenty.body.data.services).toHaveLength(20)
        expect(
          twenty.body.data.services.map(
            ({ sortOrder }: { sortOrder: number }) => sortOrder,
          ),
        ).toEqual(Array.from({ length: 20 }, (_unused, index) => index))
        expectProblem(twentyOne, badRequest)
        expect(brokenRules(twentyOne)).toEqual(['services:too_big'])
      })

      it('reports every broken rule of a request at once', async () => {
        const response = await create(
          booking({
            depositAmount: -1,
            source: '',
            services: [
              line({ startTime: at('01:00').replace(':00Z', ':30Z') }),
            ],
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response).toSorted()).toEqual([
          'depositAmount:too_small',
          'services.0.startTime:custom',
          'source:invalid_format',
        ])
      })
    })

    describe('what a request refers to', () => {
      const deleted = { deletedAt: '2026-11-01T00:00:00.000Z' }

      it.each<[string, () => Promise<string>]>([
        ['an ID that no salon has', async () => UNKNOWN_ID],
        ['a deleted salon', () => salon(deleted)],
        ['the ID of a customer', () => insertCustomer(db)],
      ])(
        'refuses %s for the salon, and says nothing of what would belong to it',
        async (_case, salonOf) => {
          const response = await create(booking({ salonId: await salonOf() }))

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_BOOKING)
          expect(response.body.errors).toEqual([
            issue('salonId', 'not_found', 'Must name a salon'),
          ])
          await expectNothingStored()
        },
      )

      it('reports the customer next to a salon that is not there', async () => {
        const response = await create(
          booking({ salonId: UNKNOWN_ID, customerId: UNKNOWN_ID }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'salonId:not_found',
          'customerId:not_found',
        ])
      })

      it.each<[string, () => Promise<string>]>([
        ['an ID that no customer has', async () => UNKNOWN_ID],
        [
          'a deleted customer',
          async () => {
            const id = await insertCustomer(db)
            await db.update(customers).set(deleted).where(eq(customers.id, id))
            return id
          },
        ],
        ['the ID of a staff member', async () => staffId],
      ])('refuses %s for the customer', async (_case, customerOf) => {
        const response = await create(
          booking({ customerId: await customerOf() }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('customerId', 'not_found', 'Must name a customer'),
        ])
        await expectNothingStored()
      })

      const notStaffOfTheSalon: [string, () => Promise<string>][] = [
        ['an ID that no staff member has', async () => UNKNOWN_ID],
        ['a deleted staff member', () => staffMember(deleted)],
        [
          'a staff member of another salon',
          async () => staffMember({}, await salon()),
        ],
        ['the ID of a customer', async () => customerId],
      ]

      it.each(notStaffOfTheSalon)(
        'refuses %s for the staff member in charge',
        async (_case, staffOf) => {
          const response = await create(booking({ staffId: await staffOf() }))

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue(
              'staffId',
              'not_found',
              'Must name a staff member of the salon',
            ),
          ])
          await expectNothingStored()
        },
      )

      it.each(notStaffOfTheSalon)(
        'refuses %s for the staff member of a service, under its line',
        async (_case, staffOf) => {
          const response = await create(
            booking({
              services: [
                line({ staffId: null }),
                line({ staffId: await staffOf() }),
              ],
            }),
          )

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue(
              'services.1.staffId',
              'not_found',
              'Must name a staff member of the salon',
            ),
          ])
          await expectNothingStored()
        },
      )

      it.each<[string, () => Promise<string>]>([
        ['an ID that no service has', async () => UNKNOWN_ID],
        ['a deleted service', () => insertService(deleted)],
        [
          'a service of another salon',
          async () => insertService({}, await salon()),
        ],
        ['the ID of a staff member', async () => staffId],
      ])(
        'refuses %s for a service, under its line',
        async (_case, serviceOf) => {
          const response = await create(
            booking({
              services: [line(), line({ serviceId: await serviceOf() })],
            }),
          )

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue(
              'services.1.serviceId',
              'not_found',
              'Must name a service of the salon',
            ),
          ])
          await expectNothingStored()
        },
      )

      it('reports everything that is not there at once, in the order of the request', async () => {
        const response = await create(
          booking({
            customerId: UNKNOWN_ID,
            staffId: UNKNOWN_ID,
            services: [
              line({ serviceId: UNKNOWN_ID, staffId: UNKNOWN_ID }),
              line(),
              line({ serviceId: UNKNOWN_ID, staffId: null }),
            ],
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'customerId:not_found',
          'staffId:not_found',
          'services.0.serviceId:not_found',
          'services.0.staffId:not_found',
          'services.2.serviceId:not_found',
        ])
        await expectNothingStored()
      })

      it('refuses a booking whose prices are more than a booking can hold', async () => {
        const dear = await insertService({ price: 2_000_000_000 })

        const response = await create(
          booking({
            services: [
              line({ serviceId: dear, staffId: null }),
              line({ serviceId: dear, staffId: null }),
            ],
          }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'services',
            'too_big',
            'The amounts of a booking must not exceed 2147483647',
          ),
        ])
        await expectNothingStored()
      })

      it('refuses a booking of a salon whose time zone is not known, as a state the salon has to leave first', async () => {
        const lost = await salon({ timezone: 'Mars/Olympus' })
        const member = await staffMember({}, lost)
        const cut = await insertService({}, lost)

        const response = await create(
          booking({
            salonId: lost,
            staffId: member,
            services: [line({ serviceId: cut, staffId: member })],
          }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first',
        )
        await expectNothingStored()
      })
    })

    describe('a staff member who is occupied', () => {
      it('refuses a booking at a time the staff member has another one, names them, and stores nothing of it', async () => {
        await cutAt('01:00')

        const response = await create(
          booking({ services: [line({ startTime: at('01:30') })] }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `Other bookings occupy staff member ${staffId} at a time of this booking`,
        )
        expect(await db.$count(bookings)).toBe(1)
        expect(await db.$count(bookingServices)).toBe(1)
        expect(await db.$count(bookingStatusHistories)).toBe(1)
      })

      it('names every staff member who is occupied, and none who is free', async () => {
        const second = await staffMember()
        const third = await staffMember()
        await cutAt('01:00')
        await cutAt('01:00', {
          staffId: second,
          services: [line({ staffId: second })],
        })

        const response = await create(
          booking({
            services: [
              line({ startTime: at('01:30') }),
              line({ staffId: second, startTime: at('01:30') }),
              line({ staffId: third, startTime: at('01:30') }),
            ],
          }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          `Other bookings occupy staff members ${[staffId, second].toSorted().join(', ')} at a time of this booking`,
        )
      })

      it.each([
        ['ends when the other begins', '00:00', 201],
        ['begins when the other ends', '02:00', 201],
        ['ends a minute into the other', '00:01', 409],
        ['begins a minute before the other ends', '01:59', 409],
        ['is at the same time', '01:00', 409],
      ])('answers a booking that %s with %i', async (_case, time, status) => {
        await cutAt('01:00')

        const response = await create(
          booking({ services: [line({ startTime: at(time) })] }),
        )

        expect(response.status).toBe(status)
      })

      it.each([
        // The earlier one is kept free until 02:15, the later one from ten minutes before it begins.
        ['25 minutes after the other ends', '02:25', 201],
        ['24 minutes after the other ends', '02:24', 409],
        // An hour that ends 25 minutes before 01:00 begins at 23:35 the day before.
        [
          'an hour that ends 25 minutes before the other begins',
          '2026-11-19T23:35:00Z',
          201,
        ],
        [
          'an hour that ends 24 minutes before the other begins',
          '2026-11-19T23:36:00Z',
          409,
        ],
      ])(
        'keeps the time a staff member keeps free before and after a service: %s',
        async (_case, time, status) => {
          const careful = await staffMember({
            bufferTimeBefore: 10,
            bufferTimeAfter: 15,
          })
          const ofCareful = (startTime: string) =>
            booking({
              staffId: careful,
              services: [line({ staffId: careful, startTime })],
            })
          await create(ofCareful(at('01:00')))

          const response = await create(
            ofCareful(time.includes('T') ? time : at(time)),
          )

          expect(response.status).toBe(status)
        },
      )

      it('lets a staff member have as many bookings at once as they take, and no more', async () => {
        const two = await staffMember({ maxConcurrentBookings: 2 })
        const ofTwo = booking({
          staffId: two,
          services: [line({ staffId: two })],
        })

        const responses = [
          await create(ofTwo),
          await create(ofTwo),
          await create(ofTwo),
        ]

        expect(responses.map(statusAndCode)).toEqual(['201', '201', '409 3003'])
      })

      it.each<[string, NewBooking['status']]>([
        ['was cancelled', 'cancelled'],
        ['the customer did not come to', 'no_show'],
      ])('is free at the time of a booking that %s', async (_case, status) => {
        const { id } = await cutAt('01:00')
        await setStatus(id, status)

        const response = await create(booking())

        expect(response.status).toBe(201)
      })

      it.each<[string, NewBooking['status']]>([
        ['a draft', 'draft'],
        ['waiting to be confirmed', 'pending'],
        ['confirmed', 'confirmed'],
        ['under way', 'in_progress'],
        ['completed', 'completed'],
      ])(
        'is occupied at the time of a booking that is %s',
        async (_case, status) => {
          const { id } = await cutAt('01:00')
          await setStatus(id, status)

          const response = await create(booking())

          expectProblem(response, notAllowed)
        },
      )

      it('is not occupied by a booking they are in charge of while none of its services is theirs', async () => {
        const other = await staffMember()
        await created({ services: [line({ staffId: other })] })
        await created({ services: [line({ staffId: null })] })

        const response = await create(booking())

        expect(response.status).toBe(201)
      })

      it('lets services without a staff member be at any time', async () => {
        const responses = [
          await create(booking({ services: [line({ staffId: null })] })),
          await create(booking({ services: [line({ staffId: null })] })),
        ]

        expect(responses.map(statusAndCode)).toEqual(['201', '201'])
      })

      it('counts the services of one booking once, and lets a booking have two services of a staff member at once', async () => {
        const two = await staffMember({ maxConcurrentBookings: 2 })
        const double = booking({
          staffId: two,
          services: [line({ staffId: two }), line({ staffId: two })],
        })

        const responses = [await create(double), await create(double)]
        const third = await create(double)

        expect(responses.map(statusAndCode)).toEqual(['201', '201'])
        expectProblem(third, notAllowed)
      })

      it('lets the same customer have two bookings at the same time with different staff members', async () => {
        const other = await staffMember()

        const responses = [
          await create(booking()),
          await create(
            booking({ staffId: other, services: [line({ staffId: other })] }),
          ),
        ]

        expect(responses.map(statusAndCode)).toEqual(['201', '201'])
      })

      it('looks at what the request refers to before it looks at who is occupied', async () => {
        await cutAt('01:00')

        const response = await create(booking({ customerId: UNKNOWN_ID }))

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['customerId:not_found'])
      })
    })
  })

  describe('GET /api/v1/bookings/:id', () => {
    it('returns the booking with its service lines in their order, and where it is', async () => {
      const entered = await created({
        depositAmount: 1000,
        services: [
          line({
            startTime: at('03:00'),
            notes: 'second in time, first in order',
          }),
          line({ serviceId: colorId, staffId: null, startTime: at('01:00') }),
        ],
      })

      const response = await read(entered.id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: entered,
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${BOOKINGS}/${entered.id}`, list: BOOKINGS },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expect(
        response.body.data.services.map((service: object) =>
          Object.keys(service).toSorted(),
        ),
      ).toEqual([SERVICE_PROPERTIES, SERVICE_PROPERTIES])
      expect(
        response.body.data.services.map(
          ({ sortOrder }: { sortOrder: number }) => sortOrder,
        ),
      ).toEqual([0, 1])
    })

    it('returns a booking that was written with microseconds and values of later in its life', async () => {
      const id = await insertBooking(
        db,
        {
          status: 'completed',
          pointsUsed: 100,
          pointsEarned: 66,
          reminderSent: true,
          reminderSentAt: '2026-11-19 10:00:00.123456+09',
          completedAt: '2026-11-20 11:05:00+09',
          actualStartTime: '2026-11-20 10:02:00+09',
          actualEndTime: '2026-11-20 11:04:00+09',
        },
        { isCompleted: true, completedAt: '2026-11-20 11:04:00+09' },
      )

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        status: 'completed',
        pointsUsed: 100,
        pointsEarned: 66,
        reminderSent: true,
        reminderSentAt: '2026-11-19T01:00:00.123Z',
        completedAt: '2026-11-20T02:05:00.000Z',
        actualStartTime: '2026-11-20T01:02:00.000Z',
        actualEndTime: '2026-11-20T02:04:00.000Z',
        cancellationFee: null,
        services: [
          { isCompleted: true, completedAt: '2026-11-20T02:04:00.000Z' },
        ],
      })
    })

    it('answers an ID that no booking has with 404', async () => {
      const response = await read(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
    })

    it.each([
      ['a word', 'latest'],
      ['a booking number', 'BK-0000-0001'],
      ['a UUID with a character too many', `${UNKNOWN_ID}0`],
    ])('answers %s for the ID with 400', async (_case, id) => {
      const response = await read(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid booking ID')
      expect(brokenRules(response)).toHaveLength(1)
      expect(brokenRules(response)[0]).toMatch(/^id:/)
    })

    it('finds a booking by its ID in capitals', async () => {
      const { id } = await created()

      const response = await read(id.toUpperCase())

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
    })

    it('does not find a booking by its number', async () => {
      const { bookingNumber } = await created()

      expectProblem(await read(bookingNumber), badRequest)
    })

    // The API writes at least one line with a booking. A row that was
    // written before it did may have none, and is in the ledger all the same.
    it('returns and lists a booking that has no service lines, with none', async () => {
      const [row] = await db
        .insert(bookings)
        .values(bookingRow())
        .returning({ id: bookings.id })
      if (row === undefined) {
        throw new Error('No booking was inserted')
      }

      const response = await read(row.id)
      const listed = await list()

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ id: row.id, services: [] })
      expect(listed.status).toBe(200)
      expect(listed.body.data).toEqual([response.body.data])
    })

    // The service lines of a booking are read with the booking, or one by
    // one (`booking-services.integration.test.ts`).
    it('does not list the service lines of a booking on their own', async () => {
      const { id } = await created()

      const response = await authorized(
        request(app).get(`${BOOKINGS}/${id}/services`),
        asAdmin,
      )

      expect(statusAndCode(response)).toBe('404 3001')
    })
  })

  describe('what the contract does not have', () => {
    /** A method and a path below the ledger, `:id` standing for a booking that is there. */
    const outside: [
      string,
      'put' | 'patch' | 'delete' | 'post' | 'get',
      string,
    ][] = [
      ['PUT on the ledger', 'put', ''],
      ['PATCH on the ledger', 'patch', ''],
      ['DELETE on the ledger', 'delete', ''],
      ['POST on a booking', 'post', '/:id'],
      ['PUT on a booking', 'put', '/:id'],
      ['GET on an action', 'get', '/:id/confirm'],
      ['GET below a booking', 'get', '/:id/history'],
    ]

    it.each(outside)(
      'answers %s with 404, whatever is sent',
      async (_case, method, path) => {
        const { id } = await created()
        const address = `${BOOKINGS}${path.replace(':id', id)}`
        const later = booking({ services: [line({ startTime: at('05:00') })] })

        const responses = [
          await authorized(request(app)[method](address), asAdmin),
          await authorized(request(app)[method](address), asAdmin).send(later),
        ]

        expect(responses.map(statusAndCode)).toEqual(['404 3001', '404 3001'])
        expect((await storedBookings()).map((row) => row.id)).toEqual([id])
      },
    )
  })

  describe('GET /api/v1/bookings', () => {
    /** The IDs of the bookings of a page. */
    const idsOf = (response: Response): string[] =>
      response.body.data.map(({ id }: { id: string }) => id)

    /** Follows `links.next` from the first page to the last, as the admin. */
    const walk = async (firstPage: string): Promise<Response[]> => {
      const pages: Response[] = []
      let next: string | null = firstPage
      while (next !== null) {
        if (pages.length === 50) {
          throw new Error('The pages do not end')
        }
        const page: Response = await request(app)
          .get(next)
          .set('Authorization', asAdmin)
        expect(page.status).toBe(200)
        pages.push(page)
        next = page.body.links.next
      }
      return pages
    }

    it('returns an empty page when there is no booking', async () => {
      const response = await list()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: [],
        meta: {
          total: 0,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: BOOKINGS,
          first: BOOKINGS,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('lists the bookings by the time they begin, earliest first, each as a GET of it returns it', async () => {
      const five = await cutAt('05:00')
      const one = await cutAt('01:00')
      const three = await cutAt('03:00')

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([one, three, five])
      expect(response.body.data[0]).toEqual((await read(one.id)).body.data)
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('lists bookings that begin at the same time by their IDs', async () => {
      const ids = [
        (await created({ services: [line({ staffId: null })] })).id,
        (await created({ services: [line({ staffId: null })] })).id,
        (await created({ services: [line({ staffId: null })] })).id,
        (await created({ services: [line({ staffId: null })] })).id,
      ]

      const response = await list()

      expect(idsOf(response)).toEqual(ids.toSorted())
    })

    it('walks the pages from the first to the last without leaving out or repeating a booking', async () => {
      const times = ['09:00', '01:00', '07:00', '03:00', '05:00']
      const entered = []
      for (const time of times) {
        entered.push(await cutAt(time))
      }
      // Two more that begin when another does.
      entered.push(
        await created({
          services: [line({ staffId: null, startTime: at('03:00') })],
        }),
        await created({
          services: [line({ staffId: null, startTime: at('03:00') })],
        }),
      )
      // The order of the list: the start, then the ID, each as its text.
      const inOrder = entered
        .map(({ startTime, id }) => ({ key: `${startTime} ${id}`, id }))
        .toSorted((a, b) => (a.key < b.key ? -1 : 1))
        .map(({ id }) => id)

      const pages = await walk(`${BOOKINGS}?limit=3`)

      expect(pages.map((page) => idsOf(page))).toEqual([
        inOrder.slice(0, 3),
        inOrder.slice(3, 6),
        inOrder.slice(6),
      ])
      expect(pages.map((page) => page.body.meta)).toEqual([
        {
          total: 7,
          limit: 3,
          hasMore: true,
          cursor: null,
          nextCursor: inOrder[2],
          prevCursor: null,
        },
        {
          total: 7,
          limit: 3,
          hasMore: true,
          cursor: inOrder[2],
          nextCursor: inOrder[5],
          prevCursor: null,
        },
        {
          total: 7,
          limit: 3,
          hasMore: false,
          cursor: inOrder[5],
          nextCursor: null,
          prevCursor: null,
        },
      ])
      expect(pages[0]?.body.links).toEqual({
        self: `${BOOKINGS}?limit=3`,
        first: `${BOOKINGS}?limit=3`,
        last: null,
        next: `${BOOKINGS}?limit=3&cursor=${inOrder[2]}`,
        prev: null,
      })
    })

    it('says that no page follows a page that is exactly full', async () => {
      await cutAt('01:00')
      await cutAt('03:00')

      const response = await list({ limit: '2' })

      expect(response.body.meta).toMatchObject({
        total: 2,
        hasMore: false,
        nextCursor: null,
      })
    })

    // A booking with two lines is two rows of the query and one of the page.
    it('says that no page follows a page that is exactly full of bookings with several service lines', async () => {
      for (const [first, second] of [
        ['01:00', '02:00'],
        ['05:00', '06:00'],
      ]) {
        await created({
          services: [
            line({ staffId: null, startTime: at(first ?? '') }),
            line({ staffId: null, startTime: at(second ?? '') }),
          ],
        })
      }

      const response = await list({ limit: '2' })

      expect(idsOf(response)).toHaveLength(2)
      expect(response.body.meta).toMatchObject({
        total: 2,
        hasMore: false,
        nextCursor: null,
      })
    })

    it('keeps the conditions of a search in the links of its pages', async () => {
      await cutAt('01:00')
      await cutAt('03:00')

      const response = await list({
        limit: '1',
        status: 'pending',
        bookingDateFrom: '2026-11-20',
      })

      expect(response.body.meta.total).toBe(2)
      expect(response.body.links.next).toBe(
        `${BOOKINGS}?limit=1&status=pending&bookingDateFrom=2026-11-20&cursor=${response.body.data[0].id}`,
      )
    })

    describe('the conditions of a search', () => {
      it('lists the bookings of one salon', async () => {
        const elsewhere = await salon()
        const member = await staffMember({}, elsewhere)
        const cut = await insertService({}, elsewhere)
        const here = await created()
        const there = await created({
          salonId: elsewhere,
          staffId: member,
          services: [line({ serviceId: cut, staffId: member })],
        })

        expect(idsOf(await list({ salonId }))).toEqual([here.id])
        expect(idsOf(await list({ salonId: elsewhere }))).toEqual([there.id])
        expect(idsOf(await list()).toSorted()).toEqual(
          [here.id, there.id].toSorted(),
        )
        expect((await list({ salonId: UNKNOWN_ID })).body.data).toEqual([])
      })

      it('lists the bookings of one customer', async () => {
        const other = await insertCustomer(db)
        const ofOne = await cutAt('01:00')
        const ofOther = await cutAt('03:00', { customerId: other })

        expect(idsOf(await list({ customerId }))).toEqual([ofOne.id])
        expect(idsOf(await list({ customerId: other }))).toEqual([ofOther.id])
        expect((await list({ customerId: other })).body.meta.total).toBe(1)
      })

      it('lists the bookings a staff member is in charge of or has a service of', async () => {
        const other = await staffMember()
        const third = await staffMember()
        const inCharge = await created({
          services: [line({ staffId: null })],
        })
        const withService = await created({
          staffId: other,
          services: [
            line({ staffId: other, startTime: at('03:00') }),
            line({ startTime: at('04:00') }),
          ],
        })
        const neither = await created({
          staffId: other,
          services: [line({ staffId: other, startTime: at('06:00') })],
        })

        expect(idsOf(await list({ staffId }))).toEqual([
          inCharge.id,
          withService.id,
        ])
        expect(idsOf(await list({ staffId: other }))).toEqual([
          withService.id,
          neither.id,
        ])
        expect(idsOf(await list({ staffId: third }))).toEqual([])
        expect((await list({ staffId })).body.meta.total).toBe(2)
      })

      it('lists the bookings in one status', async () => {
        const pending = await cutAt('01:00')
        const cancelled = await cutAt('03:00')
        await setStatus(cancelled.id, 'cancelled')

        expect(idsOf(await list({ status: 'pending' }))).toEqual([pending.id])
        expect(idsOf(await list({ status: 'cancelled' }))).toEqual([
          cancelled.id,
        ])
        expect(idsOf(await list({ status: 'completed' }))).toEqual([])
      })

      it('lists the bookings whose day of the visit, as it is in the salon, lies between two days', async () => {
        // 14:00 UTC is the 20th in Tokyo; 15:00 UTC is the 21st there.
        const onThe20th = await cutAt('14:00')
        const onThe21st = await cutAt('15:00')
        const onThe22nd = await created({
          services: [line({ startTime: '2026-11-22T01:00:00Z' })],
        })

        const days = async (query: Record<string, string>) =>
          idsOf(await list(query))

        expect(await days({ bookingDateFrom: '2026-11-21' })).toEqual([
          onThe21st.id,
          onThe22nd.id,
        ])
        expect(await days({ bookingDateTo: '2026-11-20' })).toEqual([
          onThe20th.id,
        ])
        expect(
          await days({
            bookingDateFrom: '2026-11-21',
            bookingDateTo: '2026-11-21',
          }),
        ).toEqual([onThe21st.id])
        expect(
          await days({
            bookingDateFrom: '2026-11-20',
            bookingDateTo: '2026-11-22',
          }),
        ).toEqual([onThe20th.id, onThe21st.id, onThe22nd.id])
        expect(await days({ bookingDateFrom: '2026-11-23' })).toEqual([])
      })

      it('lists the bookings that meet every condition of a search', async () => {
        const other = await insertCustomer(db)
        const wanted = await cutAt('01:00')
        await cutAt('03:00', { customerId: other })
        const cancelled = await cutAt('05:00')
        await setStatus(cancelled.id, 'cancelled')

        const response = await list({
          salonId,
          customerId,
          staffId,
          status: 'pending',
          bookingDateFrom: '2026-11-20',
          bookingDateTo: '2026-11-20',
        })

        expect(idsOf(response)).toEqual([wanted.id])
        expect(response.body.meta.total).toBe(1)
      })

      it.each<[string, Record<string, string>, string[]]>([
        ['a limit of 0', { limit: '0' }, ['limit:too_small']],
        ['a limit of 101', { limit: '101' }, ['limit:too_big']],
        [
          'a limit that is no number',
          { limit: 'ten' },
          ['limit:invalid_format'],
        ],
        ['a limit with a fraction', { limit: '1.5' }, ['limit:invalid_type']],
        [
          'a cursor that is no ID',
          { cursor: 'next' },
          ['cursor:invalid_format'],
        ],
        [
          'a salon that is no ID',
          { salonId: 'aoyama' },
          ['salonId:invalid_format'],
        ],
        [
          'a customer that is no ID',
          { customerId: 'taro' },
          ['customerId:invalid_format'],
        ],
        [
          'a staff member that is no ID',
          { staffId: 'hanako' },
          ['staffId:invalid_format'],
        ],
        [
          'a status that does not exist',
          { status: 'done' },
          ['status:invalid_value'],
        ],
        [
          'a first day that is no date',
          { bookingDateFrom: '2026-02-30' },
          ['bookingDateFrom:invalid_format'],
        ],
        [
          'a last day with a time',
          { bookingDateTo: '2026-11-20T00:00:00Z' },
          ['bookingDateTo:invalid_format'],
        ],
        [
          'a last day before the first one',
          { bookingDateFrom: '2026-11-20', bookingDateTo: '2026-11-19' },
          ['bookingDateTo:custom'],
        ],
        ['a keyword', { search: 'yamada' }, ['search:unrecognized_keys']],
        ['a page number', { page: '2' }, ['page:unrecognized_keys']],
      ])('refuses %s', async (_case, query, rules) => {
        const response = await list(query)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(brokenRules(response)).toEqual(rules)
      })

      it('accepts limits of 1 and of 100', async () => {
        await cutAt('01:00')
        await cutAt('03:00')

        const one = await list({ limit: '1' })
        const hundred = await list({ limit: '100' })

        expect(one.body.data).toHaveLength(1)
        expect(one.body.meta).toMatchObject({ limit: 1, hasMore: true })
        expect(hundred.body.data).toHaveLength(2)
        expect(hundred.body.meta).toMatchObject({ limit: 100, hasMore: false })
      })

      it('refuses a cursor that names no booking', async () => {
        await cutAt('01:00')

        const response = await list({ cursor: UNKNOWN_ID })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(response.body.errors).toEqual([
          issue('cursor', 'not_found', 'Must name a booking'),
        ])
      })

      it('starts after the booking of the cursor also when the search does not list that booking', async () => {
        const first = await cutAt('01:00')
        const second = await cutAt('03:00')
        await setStatus(first.id, 'cancelled')

        const response = await list({ status: 'pending', cursor: first.id })

        expect(idsOf(response)).toEqual([second.id])
      })
    })
  })

  describe('who keeps the booking ledger', () => {
    it.each(unauthenticated)(
      'answers %s with 401 in every operation before looking at anything else, and stores nothing',
      async (_case, tokenOf, problem, challenge) => {
        const authorization = await tokenOf()

        const responses = [
          await create(booking(), authorization),
          await create({}, authorization),
          await read(UNKNOWN_ID, authorization),
          await read('not-an-id', authorization),
          await list({}, authorization),
          await list({ limit: '0' }, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        await expectNothingStored()
      },
    )

    it.each(keepers)(
      'lets %s enter, read and list the bookings of the salon',
      async (_case, signInAs) => {
        const authorization = await signInAs()

        const entered = await create(booking(), authorization)
        const got = await read(entered.body.data?.id, authorization)
        const listed = await list({}, authorization)
        const named = await list({ salonId }, authorization)

        expect([entered, got, listed, named].map(statusAndCode)).toEqual([
          '201',
          '200',
          '200',
          '200',
        ])
        expect(got.body.data).toEqual(entered.body.data)
        expect(listed.body.data).toEqual([entered.body.data])
        expect(named.body.data).toEqual([entered.body.data])
      },
    )

    it.each(notKeepers)(
      'forbids %s every operation, before looking at the ID, the search or the body',
      async (_case, signInAs) => {
        const { id } = await created()
        const authorization = await signInAs()

        const responses = [
          await create(booking({ staffId: null }), authorization),
          await create(
            booking({ services: [line({ staffId: null })] }),
            authorization,
          ),
          await create({}, authorization),
          await read(id, authorization),
          await read(UNKNOWN_ID, authorization),
          await read('not-an-id', authorization),
          await list({}, authorization),
          await list({ limit: '0' }, authorization),
          await list({ limit: 'ten' }, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await db.$count(bookings)).toBe(1)
      },
    )

    it('forbids a customer the ledger also for a booking of their own', async () => {
      const self = await customerAccount()
      const own = await created({ customerId: self.customerId })

      const responses = [
        await read(own.id, self.authorization),
        await list({ customerId: self.customerId }, self.authorization),
        await create(
          booking({
            customerId: self.customerId,
            services: [line({ staffId: null })],
          }),
          self.authorization,
        ),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await db.$count(bookings)).toBe(1)
    })

    describe.each(membersOfAnotherSalon)('%s', (_case, signInAs) => {
      it('may not enter a booking of the salon', async () => {
        const response = await create(booking(), await signInAs())

        expectProblem(response, forbidden)
        await expectNothingStored()
      })

      it('is answered as if a booking of the salon did not exist', async () => {
        const { id } = await created()
        const authorization = await signInAs()

        const existing = await read(id, authorization)
        const missing = await read(UNKNOWN_ID, authorization)

        expectProblem(existing, notFound)
        expect(existing.body.detail).toBe(`Booking ${id} was not found`)
        expectProblem(missing, notFound)
      })

      it('is listed no booking of the salon, and may not ask for them', async () => {
        const { id } = await created()
        const authorization = await signInAs()

        const own = await list({}, authorization)
        const others = await list({ salonId }, authorization)
        const afterOthers = await list({ cursor: id }, authorization)

        expect(own.status).toBe(200)
        expect(own.body.data).toEqual([])
        expect(own.body.meta.total).toBe(0)
        expectProblem(others, forbidden)
        expectProblem(afterOthers, badRequest)
        expect(afterOthers.body.errors).toEqual([
          issue('cursor', 'not_found', 'Must name a booking'),
        ])
      })
    })

    it('lists a member of a salon the bookings of their salon only, whatever else the search says', async () => {
      const elsewhere = await salon()
      const member = await staffMember({}, elsewhere)
      const cut = await insertService({}, elsewhere)
      const there = await created({
        salonId: elsewhere,
        staffId: member,
        services: [line({ serviceId: cut, staffId: member })],
      })
      const here = await created()
      const ofHere = await signedInMember('owner')
      const ofThere = await signIn(
        app,
        (await insertMember(db, 'manager', elsewhere)).email,
      )

      const listedHere = await list({ customerId }, ofHere)
      const listedThere = await list({ customerId }, ofThere.authorization)

      expect(listedHere.body.data).toEqual([here])
      expect(listedHere.body.meta.total).toBe(1)
      expect(listedThere.body.data).toEqual([there])
      expect(listedThere.body.meta.total).toBe(1)
    })

    it('lets a member of a salon enter a booking with a customer and a time of their choice, for their salon only', async () => {
      const elsewhere = await salon()
      const member = await staffMember({}, elsewhere)
      const cut = await insertService({}, elsewhere)
      const authorization = await signedInMember('staff')

      const own = await create(booking(), authorization)
      const others = await create(
        booking({
          salonId: elsewhere,
          staffId: member,
          services: [line({ serviceId: cut, staffId: member })],
        }),
        authorization,
      )
      const unknown = await create(
        booking({ salonId: UNKNOWN_ID }),
        authorization,
      )

      expect(own.status).toBe(201)
      expectProblem(others, forbidden)
      // A salon that does not exist is not theirs either.
      expectProblem(unknown, forbidden)
      expect(await db.$count(bookings)).toBe(1)
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const self = await customerAccount()
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).post(BOOKINGS), authorization)
          .set('Content-Type', 'application/json')
          .send('{"salonId": "0193a5b8"')

      const responses = [
        await notJson(null),
        await notJson(self.authorization),
        await notJson(asAdmin),
        await authorized(request(app).post(BOOKINGS), null)
          .set('Content-Type', 'text/plain')
          .send('a cut at ten'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      await expectNothingStored()
    })

    it('checks a new booking in order: the token, the account, the request, the salon of the account, what the request refers to, who is occupied', async () => {
      const self = await customerAccount()
      const elsewhere = await signedInMember('owner', salon)
      await cutAt('01:00')
      const invalid = booking({ depositAmount: -1, customerId: UNKNOWN_ID })
      const unknownCustomer = booking({ customerId: UNKNOWN_ID })

      const ofAnotherSalon = await create(invalid, elsewhere)
      const ofUnknownCustomer = await create(unknownCustomer)
      const responses = [
        await create(invalid, null),
        await create(invalid, self.authorization),
        ofAnotherSalon,
        await create(unknownCustomer, elsewhere),
        ofUnknownCustomer,
        await create(booking()),
        await create(booking({ services: [line({ startTime: at('03:00') })] })),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '403 1005',
        '400 2001',
        '409 3003',
        '201',
      ])
      expect(brokenRules(ofAnotherSalon)).toEqual(['depositAmount:too_small'])
      expect(brokenRules(ofUnknownCustomer)).toEqual(['customerId:not_found'])
    })

    it('checks a search in order: the token, the account, the search, the salon of the account, the cursor', async () => {
      const self = await customerAccount()
      const ofTheSalon = await signedInMember('manager')

      const responses = [
        await list({ limit: '0' }, null),
        await list({ limit: '0' }, self.authorization),
        await list({ limit: '0', salonId: UNKNOWN_ID }, ofTheSalon),
        await list({ salonId: UNKNOWN_ID, cursor: UNKNOWN_ID }, ofTheSalon),
        await list({ salonId, cursor: UNKNOWN_ID }, ofTheSalon),
        await list({ salonId }, ofTheSalon),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '403 1005',
        '400 2001',
        '200',
      ])
    })

    it('checks a read in order: the token, the account, the ID, the booking', async () => {
      const self = await customerAccount()
      const { id } = await created()

      const responses = [
        await read('not-an-id', null),
        await read('not-an-id', self.authorization),
        await read('not-an-id'),
        await read(UNKNOWN_ID),
        await read(id),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '404 3001',
        '200',
      ])
    })
  })

  describe('requests at the same moment', () => {
    // A booking locks the staff members of its services before it looks at
    // who is occupied, so the bookings of a staff member are written one
    // after the other and each sees the ones before it.
    it('enters one of six bookings that want the same staff member at the same time', async () => {
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => create(booking())),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(await db.$count(bookings)).toBe(1)
      expect(await db.$count(bookingServices)).toBe(1)
      expect(await db.$count(bookingStatusHistories)).toBe(1)
    })

    it('enters as many of six bookings as the staff member takes at once', async () => {
      const two = await staffMember({ maxConcurrentBookings: 2 })

      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          create(booking({ staffId: two, services: [line({ staffId: two })] })),
        ),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '201',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(await db.$count(bookings)).toBe(2)
    })

    it('enters one of two bookings that want two staff members in opposite orders, and neither waits for the other for ever', async () => {
      const other = await staffMember()
      const both = (first: string, second: string, time: string) =>
        booking({
          services: [
            line({ staffId: first, startTime: at(time) }),
            line({ staffId: second, startTime: at(time) }),
          ],
        })

      const rounds = await Promise.all(
        ['01:00', '04:00', '07:00', '10:00'].map((time) =>
          Promise.all([
            create(both(staffId, other, time)),
            create(both(other, staffId, time)),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode).toSorted()).toEqual(['201', '409 3003'])
      }
      expect(await db.$count(bookings)).toBe(4)
    })

    it('enters every one of six bookings of one customer and one service with six staff members', async () => {
      const members = await Promise.all(
        Array.from({ length: 6 }, () => staffMember()),
      )

      const responses = await Promise.all(
        members.map((id) =>
          create(booking({ staffId: id, services: [line({ staffId: id })] })),
        ),
      )

      expect(responses.map(statusAndCode)).toEqual([
        '201',
        '201',
        '201',
        '201',
        '201',
        '201',
      ])
      expect(
        new Set(responses.map(({ body }) => body.data.bookingNumber)).size,
      ).toBe(6)
    })

    it('waits for a booking of the staff member that is being written, then sees it', async () => {
      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, staffId))
          .for('update')
        await insertBooking(tx)
        const underWay = create(booking()).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(await db.$count(bookings)).toBe(1)
    })

    it('waits for a booking of the staff member that is being written, then enters its own when the other is given up', async () => {
      const held: { pending: Promise<Response> | null } = { pending: null }

      await expect(
        db.transaction(async (tx) => {
          await tx
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, staffId))
            .for('update')
          await insertBooking(tx)
          held.pending = create(booking()).then((response) => response)
          await pause(300)
          throw new Error('given up')
        }),
      ).rejects.toThrow('given up')
      const response = await held.pending

      expect(response?.status).toBe(201)
      expect(await db.$count(bookings)).toBe(1)
    })

    it.each<
      [string, (tx: Pick<typeof db, 'update'>) => Promise<unknown>, string]
    >([
      [
        'the service',
        (tx) =>
          tx
            .update(services)
            .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
            .where(eq(services.id, cutId)),
        'services.0.serviceId:not_found',
      ],
      [
        'the customer',
        (tx) =>
          tx
            .update(customers)
            .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
            .where(eq(customers.id, customerId)),
        'customerId:not_found',
      ],
      [
        'the salon',
        (tx) =>
          tx
            .update(salons)
            .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
            .where(eq(salons.id, salonId)),
        'salonId:not_found',
      ],
    ])(
      'waits while %s is being deleted, then refuses the booking and stores nothing',
      async (_case, remove, rule) => {
        const { pending } = await db.transaction(async (tx) => {
          await remove(tx)
          const underWay = create(booking()).then((response) => response)
          await pause(300)

          return { pending: underWay }
        })
        const response = await pending

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([rule])
        await expectNothingStored()
      },
    )

    it('waits while the staff member is being deleted, then refuses the booking under both of its references', async () => {
      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(staff)
          .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
          .where(eq(staff.id, staffId))
        const underWay = create(booking()).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([
        'staffId:not_found',
        'services.0.staffId:not_found',
      ])
      await expectNothingStored()
    })

    it('waits while the price of the service is being changed, then books the service at its new price', async () => {
      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(services)
          .set({ price: 7700, duration: 75 })
          .where(eq(services.id, cutId))
        const underWay = create(booking()).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        subtotal: 7700,
        duration: 75,
        services: [{ price: 7700, finalPrice: 7700, duration: 75 }],
      })
    })

    it.each<[string, (client: postgres.Sql) => Promise<unknown>]>([
      [
        'the service',
        (client) =>
          client`UPDATE services SET "deletedAt" = now() WHERE id = ${cutId}`,
      ],
      [
        'the customer',
        (client) =>
          client`UPDATE customers SET "deletedAt" = now() WHERE id = ${customerId}`,
      ],
      [
        'the salon',
        (client) =>
          client`UPDATE salons SET "deletedAt" = now() WHERE id = ${salonId}`,
      ],
    ])(
      'holds %s while it writes: a deletion waits until the booking is written',
      async (_case, remove) => {
        const client = getTestDbClient()

        const outcome = await db.transaction(async (tx) => {
          await tx
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, staffId))
            .for('update')
          // The request takes what it refers to and waits for the staff member.
          const underWay = create(booking()).then((response) => response)
          await pause(300)
          const deletion = remove(client).then(() => 'deleted')
          const first = await Promise.race([
            deletion,
            pause(300).then(() => 'still waiting'),
          ])

          return { first, holder: { underWay, deletion } }
        })

        expect(outcome.first).toBe('still waiting')
        expect((await outcome.holder.underWay).status).toBe(201)
        expect(await outcome.holder.deletion).toBe('deleted')
        expect(await db.$count(bookings)).toBe(1)
      },
    )
  })

  describe('BookingRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new BookingRepository(db)
    const everySalon: LedgerReach = { type: 'everySalon' }
    const salonOnly = (id: string): LedgerReach => ({
      type: 'salon',
      salonId: salonIdSchema.parse(id),
    })
    const origin = (bookingNumber: string) => ({
      bookingNumber,
      createdBy: userIdSchema.parse(admin.id),
      client: { ipAddress: '203.0.113.7', userAgent: 'SalonTest/1.0' },
    })
    const lineOf = (
      overrides: Partial<RequestedBooking['services'][number]> = {},
    ): RequestedBooking['services'][number] => ({
      serviceId: serviceIdSchema.parse(cutId),
      staffId: staffIdSchema.parse(staffId),
      startTime: written('01:00'),
      notes: null,
      ...overrides,
    })
    /** A request as the use case hands it on: a cut by the staff member from ten in Tokyo. */
    const requestOf = (
      overrides: Partial<RequestedBooking> = {},
    ): RequestedBooking => ({
      salonId: salonIdSchema.parse(salonId),
      customerId: customerIdSchema.parse(customerId),
      staffId: staffIdSchema.parse(staffId),
      depositAmount: null,
      customerRequest: null,
      internalNotes: null,
      source: null,
      services: [lineOf()],
      ...overrides,
    })
    const noConditions = {
      limit: 20,
      after: null,
      salonId: null,
      customerId: null,
      staffId: null,
      status: null,
      bookingDateFrom: null,
      bookingDateTo: null,
    }

    describe('create', () => {
      it('writes the booking with the number it is given and returns the rows', async () => {
        const result = dataOf(
          await repository().create(requestOf(), origin('BK-0000-0001')),
        )

        expect(result).toMatchObject({
          type: 'created',
          booking: {
            booking: {
              bookingNumber: 'BK-0000-0001',
              status: 'pending',
              ipAddress: '203.0.113.7',
              userAgent: 'SalonTest/1.0',
            },
            services: [{ serviceId: cutId, sortOrder: 0 }],
          },
        })
        expect(await storedBookings()).toEqual([
          expect.objectContaining({ bookingNumber: 'BK-0000-0001' }),
        ])
      })

      it('returns the service lines in their order', async () => {
        const result = dataOf(
          await repository().create(
            requestOf({
              services: Array.from({ length: 5 }, (_unused, index) =>
                lineOf({ staffId: null, notes: `line ${index}` }),
              ),
            }),
            origin('BK-0000-0001'),
          ),
        )

        expect(
          result.type === 'created'
            ? result.booking.services.map(({ sortOrder, notes }) => [
                sortOrder,
                notes,
              ])
            : [],
        ).toEqual([
          [0, 'line 0'],
          [1, 'line 1'],
          [2, 'line 2'],
          [3, 'line 3'],
          [4, 'line 4'],
        ])
      })

      it('writes nothing when another booking has the number, and says so', async () => {
        await insertBooking(
          db,
          {
            bookingNumber: 'BK-0000-0001',
            startTime: at('05:00'),
            endTime: at('06:00'),
          },
          { startTime: at('05:00'), endTime: at('06:00') },
        )

        const result = dataOf(
          await repository().create(requestOf(), origin('BK-0000-0001')),
        )

        expect(result).toEqual({ type: 'bookingNumberTaken' })
        expect(await db.$count(bookings)).toBe(1)
        expect(await db.$count(bookingServices)).toBe(1)
        expect(await db.$count(bookingStatusHistories)).toBe(0)
      })

      it('says who is occupied before it looks at the number', async () => {
        await insertBooking(db, { bookingNumber: 'BK-0000-0001' })

        const result = dataOf(
          await repository().create(requestOf(), origin('BK-0000-0001')),
        )

        expect(result).toEqual({ type: 'staffOccupied', staffIds: [staffId] })
      })

      it('says what the request refers to and is not there', async () => {
        const result = dataOf(
          await repository().create(
            requestOf({ customerId: customerIdSchema.parse(UNKNOWN_ID) }),
            origin('BK-0000-0001'),
          ),
        )

        expect(result).toEqual({
          type: 'invalid',
          issues: [
            {
              field: 'customerId',
              rule: 'not_found',
              message: ruleMessages.aCustomer,
            },
          ],
        })
        await expectNothingStored()
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(connection.database).create(
          requestOf(),
          origin('BK-0000-0001'),
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to create booking' },
        })
      })
    })

    describe('findById', () => {
      it('finds a booking within the reach, with its lines in their order', async () => {
        const { id } = await created({
          services: [line(), line({ staffId: null }), line({ staffId: null })],
        })
        const bookingId = bookingIdSchema.parse(id)

        const ofEverySalon = dataOf(
          await repository().findById(bookingId, everySalon),
        )
        const ofTheSalon = dataOf(
          await repository().findById(bookingId, salonOnly(salonId)),
        )

        expect(ofEverySalon?.booking.id).toBe(id)
        expect(
          ofEverySalon?.services.map(({ sortOrder }) => sortOrder),
        ).toEqual([0, 1, 2])
        expect(ofTheSalon).toEqual(ofEverySalon)
      })

      it('returns the lines in their order, whatever order they were written in', async () => {
        const id = await insertBooking(db, {}, { sortOrder: 2 })
        await db.insert(bookingServices).values(lineRow(id, { sortOrder: 1 }))
        await db.insert(bookingServices).values(lineRow(id, { sortOrder: 0 }))

        const found = dataOf(
          await repository().findById(bookingIdSchema.parse(id), everySalon),
        )
        const listed = dataOf(
          await repository().list({ reach: everySalon, ...noConditions }),
        )

        expect(found?.services.map(({ sortOrder }) => sortOrder)).toEqual([
          0, 1, 2,
        ])
        expect(
          listed?.bookings.map(({ services }) =>
            services.map(({ sortOrder }) => sortOrder),
          ),
        ).toEqual([[0, 1, 2]])
      })

      it('finds nothing outside the reach, and nothing for an ID no booking has', async () => {
        const { id } = await created()

        expect(
          dataOf(
            await repository().findById(
              bookingIdSchema.parse(id),
              salonOnly(await salon()),
            ),
          ),
        ).toBeNull()
        expect(
          dataOf(
            await repository().findById(
              bookingIdSchema.parse(UNKNOWN_ID),
              everySalon,
            ),
          ),
        ).toBeNull()
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(
          connection.database,
        ).findById(bookingIdSchema.parse(UNKNOWN_ID), everySalon)
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to find booking' },
        })
      })
    })

    describe('list', () => {
      it('lists the bookings within the reach with their lines', async () => {
        const { id } = await created({
          services: [line(), line({ staffId: null })],
        })

        const listed = dataOf(
          await repository().list({ reach: everySalon, ...noConditions }),
        )
        const elsewhere = dataOf(
          await repository().list({
            reach: salonOnly(await salon()),
            ...noConditions,
          }),
        )

        expect(listed).toMatchObject({
          bookings: [
            { booking: { id }, services: [{ sortOrder: 0 }, { sortOrder: 1 }] },
          ],
          total: 1,
          hasMore: false,
        })
        expect(elsewhere).toEqual({ bookings: [], total: 0, hasMore: false })
      })

      it('resolves to null for a cursor outside the reach', async () => {
        const { id } = await created()
        const after = bookingIdSchema.parse(id)

        expect(
          dataOf(
            await repository().list({
              reach: salonOnly(await salon()),
              ...noConditions,
              after,
            }),
          ),
        ).toBeNull()
        expect(
          dataOf(
            await repository().list({
              reach: salonOnly(salonId),
              ...noConditions,
              after,
            }),
          ),
        ).toEqual({ bookings: [], total: 1, hasMore: false })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(connection.database).list({
          reach: everySalon,
          ...noConditions,
        })
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to list bookings' },
        })
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })

    it.each<[string, Partial<NewBooking>, string]>([
      [
        'a booking that ends before it begins',
        { startTime: at('02:00'), endTime: at('01:00'), duration: -60 },
        'bookings_end_after_start',
      ],
      [
        'a booking that ends when it begins',
        { endTime: at('01:00'), duration: 0 },
        'bookings_end_after_start',
      ],
      [
        'a duration that is not the minutes from the start to the end',
        { duration: 59 },
        'bookings_duration_is_the_span',
      ],
      [
        'a negative deposit',
        { depositAmount: -1 },
        'bookings_amounts_not_negative',
      ],
      [
        'negative points used',
        { pointsUsed: -1 },
        'bookings_amounts_not_negative',
      ],
      [
        'negative points earned',
        { pointsEarned: -1 },
        'bookings_amounts_not_negative',
      ],
      [
        'a negative cancellation fee',
        { ...inStatus('cancelled'), cancellationFee: -1 },
        'bookings_amounts_not_negative',
      ],
      [
        'a negative tax',
        { taxAmount: -1, totalAmount: 6599 },
        'bookings_amounts_not_negative',
      ],
      [
        'a negative discount',
        { discountAmount: -1, totalAmount: 6601 },
        'bookings_amounts_not_negative',
      ],
      [
        'a discount that is more than the subtotal',
        { discountAmount: 6601, taxAmount: 1, totalAmount: 0 },
        'bookings_discount_within_subtotal',
      ],
      [
        'a total that is not the subtotal less the discount plus the tax',
        { totalAmount: 6601 },
        'bookings_total_is_the_sum',
      ],
    ])('refuses %s', async (_case, columns, constraint) => {
      await expect(
        db.insert(bookings).values(bookingRow(columns)),
      ).rejects.toMatchObject(violationOf('23514', constraint))
      expect(await db.$count(bookings)).toBe(0)
    })

    it.each<[string, Partial<NewBookingService>, string]>([
      [
        'a line that ends before it begins',
        { startTime: at('02:00'), endTime: at('01:00'), duration: -60 },
        'booking_services_end_after_start',
      ],
      [
        'a duration that is not the minutes from the start to the end',
        { duration: 61 },
        'booking_services_duration_is_the_span',
      ],
      [
        'a negative discount',
        { discountAmount: -1, finalPrice: 6601 },
        'booking_services_discount_within_price',
      ],
      [
        'a discount that is more than the price',
        { discountAmount: 6601, finalPrice: -1 },
        'booking_services_discount_within_price',
      ],
      [
        'a negative price',
        { price: -1, finalPrice: -1 },
        'booking_services_discount_within_price',
      ],
      [
        'a final price that is not the price less the discount',
        { finalPrice: 6599 },
        'booking_services_final_price_is_the_difference',
      ],
      [
        'a completed line without the time of its completion',
        { isCompleted: true },
        'booking_services_completed_has_time',
      ],
      [
        'a time of completion on a line that is not completed',
        { completedAt: at('02:00') },
        'booking_services_completed_has_time',
      ],
      [
        'a negative position',
        { sortOrder: -1 },
        'booking_services_sort_order_not_negative',
      ],
    ])('refuses a line with %s', async (_case, columns, constraint) => {
      const [row] = await db
        .insert(bookings)
        .values(bookingRow())
        .returning({ id: bookings.id })

      await expect(
        db.insert(bookingServices).values(lineRow(row?.id ?? '', columns)),
      ).rejects.toMatchObject(violationOf('23514', constraint))
      expect(await db.$count(bookingServices)).toBe(0)
    })

    it('refuses two lines of a booking at the same position, and lets two bookings have a line at it', async () => {
      const first = await insertBooking(db)
      const second = await insertBooking(db)

      await expect(
        db.insert(bookingServices).values(lineRow(first)),
      ).rejects.toMatchObject(
        violationOf('23505', 'booking_services_order_unique'),
      )
      await db.insert(bookingServices).values(lineRow(second, { sortOrder: 1 }))
      expect(await db.$count(bookingServices)).toBe(3)
    })

    it('refuses two bookings with the same number', async () => {
      await db
        .insert(bookings)
        .values(bookingRow({ bookingNumber: 'BK-0000-0001' }))

      await expect(
        db
          .insert(bookings)
          .values(bookingRow({ bookingNumber: 'BK-0000-0001' })),
      ).rejects.toMatchObject(
        violationOf('23505', 'bookings_booking_number_unique'),
      )
    })

    it('accepts a booking and a line whose amounts are all zero', async () => {
      const id = await insertBooking(
        db,
        {
          ...inStatus('cancelled'),
          subtotal: 0,
          totalAmount: 0,
          depositAmount: 0,
          cancellationFee: 0,
        },
        { price: 0, finalPrice: 0 },
      )

      expect(await read(id)).toMatchObject({ status: 200 })
    })

    it('leaves an amount that was not set null: no column of an amount that may be unset has a default', async () => {
      const columns = await getTestDbClient()<
        {
          table_name: string
          column_name: string
          column_default: string | null
        }[]
      >`
        SELECT table_name, column_name, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN ('bookings', 'booking_services')
          AND is_nullable = 'YES'
          AND column_default IS NOT NULL
      `
      const id = await insertBooking(db)

      expect(columns.map((column) => ({ ...column }))).toEqual([])
      expect(await storedBookings()).toEqual([
        expect.objectContaining({
          id,
          depositAmount: null,
          pointsUsed: null,
          pointsEarned: null,
          cancellationFee: null,
        }),
      ])
    })

    it('has the indexes the ledger is read by, each in place of the one on its first column alone', async () => {
      const indexes = await getTestDbClient()<{ indexname: string }[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename IN ('bookings', 'booking_services')
      `
      const names = indexes.map(({ indexname }) => indexname)

      expect(names).toEqual(
        expect.arrayContaining([
          'idx_bookings_salon_start',
          'idx_booking_services_staff_start',
        ]),
      )
      expect(names).not.toContain('idx_bookings_salon_id')
      expect(names).not.toContain('idx_booking_services_staff_id')
    })
  })
})
