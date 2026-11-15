import {
  bookingServices,
  bookingStatusHistories,
  bookings,
  customers,
  salons,
  services,
  staff,
  staffSchedules,
  users,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  type CustomerBookingCreateRequest,
  type CustomerReach,
  customerIdSchema,
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { BookingRepository } from '@beauty-salon-backend/infrastructure'
import { asc, eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertMember,
  signedInUser,
  signIn,
  type TestUser,
} from './_shared/auth-helpers'
import {
  DAY,
  dateIn,
  dayOfWeekOf,
  daysAfter,
  inStatus,
  inTokyo,
  iso,
  jst,
  type NewBooking,
  type NewService,
  type NewStaff,
  STARTS,
  slotFixtures,
  weeklyHours,
} from './_shared/slot-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from './_shared/test-helpers'

const OWN_BOOKINGS = '/api/v1/customers/me/bookings'
const LEDGER = '/api/v1/bookings'
const SALONS = '/api/v1/salons'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const BOOKING_NUMBER = /^BK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const databaseProblem = { status: 500, code: '4003', type: 'database' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID_BOOKING = 'Invalid booking'
const INVALID_SEARCH = 'Invalid booking search'
const INVALID_CANCELLATION = 'Invalid booking cancellation'
const NOT_A_SLOT =
  'The staff member has no available slot for the service at that time; choose one of the available slots of the salon'
const CUSTOMER_OCCUPIED =
  'The customer has another booking at that time; cancel it first or choose another time'
const NOT_ACCEPTED =
  'This customer profile does not take bookings online; contact the salon to book'
const TIME_ZONE_UNKNOWN =
  'The time zone of the salon is not one that is known, so the times of its hours cannot be told; correct the time zone of the salon first'
const ALREADY_BEGUN =
  'The time of the booking has come, so the customer cannot cancel it any more; the salon notes what became of the visit'

type NewCustomer = typeof customers.$inferInsert

/** An availability of a service that leaves the day of the tests out. */
const OTHER_DAYS: NewService['availability'] = ['saturday', 'sunday'].includes(
  dayOfWeekOf(DAY) ?? '',
)
  ? 'weekdays_only'
  : 'weekends_only'

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'haircut'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
  ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
]

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

/** The status and the code of a problem; the status alone of a success. */
const statusAndCode = (response: Response): string =>
  response.status < 400
    ? `${response.status}`
    : `${response.status} ${response.body.code}`

/**
 * A response in a few words: its status and, for a validation problem, the
 * broken rules, or else the code of the problem.
 */
const outcomeOf = (response: Response): string =>
  response.status === 400 && response.body.code === '2001'
    ? `400 ${brokenRules(response).join(',')}`
    : statusAndCode(response)

/** What every response with one booking has around it. */
const meta = {
  correlationId: expect.any(String),
  timestamp: expect.stringMatching(ISO_TIMESTAMP),
  version: 'v1',
}

describe('Customer booking API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let admin: TestUser
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The account of the customer of the tests. */
  let customer: TestUser
  /** The Authorization header of that customer. */
  let asCustomer: string
  let salonId: string
  let customerId: string
  /** A staff member who works on the day of the tests. */
  let staffId: string
  /** A cut of an hour. */
  let cutId: string

  const { salon, staffMember, insertService, works, opens, insertBooking } =
    slotFixtures(() => ({ db, salonId, customerId, staffId, cutId }))

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    const signedInAdmin = await signedInUser(app, db, { role: 'admin' })
    admin = signedInAdmin
    asAdmin = signedInAdmin.authorization
    customerId = await insertCustomer(db)
    const signedInCustomer = await signedInUser(app, db, { customerId })
    customer = signedInCustomer
    asCustomer = signedInCustomer.authorization
    salonId = await salon()
    staffId = await staffMember()
    await works()
    cutId = await insertService()
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Another customer with an account and a profile. */
  const otherCustomer = async () => {
    const id = await insertCustomer(db)
    const account = await signedInUser(app, db, { customerId: id })
    return { ...account, customerId: id }
  }

  /** A customer account that has not created its profile. */
  const withoutProfile = () => signedInUser(app, db)

  /** A member of a salon, signed in. */
  const member = async (
    role: 'owner' | 'manager' | 'staff',
    of: string = salonId,
  ) => {
    const account = await insertMember(db, role, of)
    return { ...account, ...(await signIn(app, account.email)) }
  }

  const changeCustomer = async (
    changes: Partial<NewCustomer>,
    id: string = customerId,
  ): Promise<void> => {
    await db.update(customers).set(changes).where(eq(customers.id, id))
  }

  /** What the customer of the tests sends to book the cut at ten on the day, with more. */
  const wanting = (more: Record<string, unknown> = {}) => ({
    salonId,
    serviceId: cutId,
    staffId,
    startTime: iso('10:00'),
    customerRequest: null,
    ...more,
  })

  /** Books; the cut at ten and as the customer of the tests unless stated otherwise. */
  const book = (body: unknown = wanting(), as: string | null = asCustomer) =>
    authorized(request(app).post(OWN_BOOKINGS), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))

  /** Lists bookings; as the customer of the tests unless stated otherwise. */
  const list = (query = '', as: string | null = asCustomer) =>
    authorized(
      request(app).get(
        query === '' ? OWN_BOOKINGS : `${OWN_BOOKINGS}?${query}`,
      ),
      as,
    )

  const read = (id: string, as: string | null = asCustomer) =>
    authorized(request(app).get(`${OWN_BOOKINGS}/${id}`), as)

  const cancel = (
    id: string,
    body: unknown = { cancellationReason: null },
    as: string | null = asCustomer,
  ) =>
    authorized(request(app).post(`${OWN_BOOKINGS}/${id}/cancel`), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))

  /** The slots the list of available slots offers for the cut, as Tokyo's clocks show them. */
  const offered = async (
    date: string = DAY,
    service: string = cutId,
  ): Promise<string[]> => {
    const response = await authorized(
      request(app).get(
        `${SALONS}/${salonId}/available-slots?${new URLSearchParams({ serviceId: service, date, limit: '100' })}`,
      ),
      asCustomer,
    )
    expect(response.status).toBe(200)
    return response.body.data.map(({ startTime }: { startTime: string }) =>
      inTokyo(startTime),
    )
  }

  const storedBookings = () =>
    db.select().from(bookings).orderBy(asc(bookings.createdAt))

  const storedBooking = async (id: string) => {
    const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
    if (row === undefined) {
      throw new Error(`No booking ${id} is stored`)
    }
    return row
  }

  const historyOf = (id: string) =>
    db
      .select({
        fromStatus: bookingStatusHistories.fromStatus,
        toStatus: bookingStatusHistories.toStatus,
        changedBy: bookingStatusHistories.changedBy,
        reason: bookingStatusHistories.reason,
        metadata: bookingStatusHistories.metadata,
      })
      .from(bookingStatusHistories)
      .where(eq(bookingStatusHistories.bookingId, id))
      .orderBy(
        asc(bookingStatusHistories.createdAt),
        asc(bookingStatusHistories.id),
      )

  const expectNothingStored = async (): Promise<void> => {
    expect(await db.$count(bookings)).toBe(0)
    expect(await db.$count(bookingServices)).toBe(0)
    expect(await db.$count(bookingStatusHistories)).toBe(0)
  }

  /** The cut at a time of the day as the customer is shown the booking of it. */
  const shown = (time = '10:00', more: Record<string, unknown> = {}) => {
    const [hours = '', minutes = ''] = time.split(':')
    const end = `${String(Number(hours) + 1).padStart(2, '0')}:${minutes}`

    return {
      id: expect.stringMatching(UUID),
      bookingNumber: expect.stringMatching(BOOKING_NUMBER),
      salonId,
      staffId,
      bookingDate: DAY,
      startTime: iso(time),
      endTime: iso(end),
      duration: 60,
      status: 'pending',
      subtotal: 6600,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 6600,
      depositAmount: null,
      pointsUsed: null,
      pointsEarned: null,
      customerRequest: null,
      cancelledAt: null,
      cancellationFee: null,
      completedAt: null,
      services: [
        {
          id: expect.stringMatching(UUID),
          serviceId: cutId,
          staffId,
          startTime: iso(time),
          endTime: iso(end),
          duration: 60,
          price: 6600,
          discountAmount: 0,
          finalPrice: 6600,
          taxIncluded: true,
          sortOrder: 0,
        },
      ],
      createdAt: expect.stringMatching(ISO_TIMESTAMP),
      updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      ...more,
    }
  }

  describe('POST /api/v1/customers/me/bookings', () => {
    it('books a slot and returns the booking as the customer is shown it, with where it is', async () => {
      const response = await book(
        wanting({ customerRequest: '前回と同じ長さで' }),
      )

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      const { id } = response.body.data
      expect(response.headers['location']).toBe(`${OWN_BOOKINGS}/${id}`)
      expect(response.body).toEqual({
        data: shown('10:00', { customerRequest: '前回と同じ長さで' }),
        meta,
        links: { self: `${OWN_BOOKINGS}/${id}`, list: OWN_BOOKINGS },
      })
    })

    it('returns what a GET of the booking returns', async () => {
      const created = await book()

      const fetched = await read(created.body.data.id)

      expect(fetched.status).toBe(200)
      expect(fetched.body.data).toEqual(created.body.data)
    })

    describe('what the system sets', () => {
      it('writes the booking for the customer of the account as pending, made online, with nothing the salon notes', async () => {
        const response = await book()

        expect(await storedBooking(response.body.data.id)).toMatchObject({
          salonId,
          customerId,
          staffId,
          bookingDate: DAY,
          status: 'pending',
          source: 'online',
          depositAmount: null,
          internalNotes: null,
          customerRequest: null,
          pointsUsed: null,
          pointsEarned: null,
          reminderSent: false,
          reminderSentAt: null,
          cancelledAt: null,
          cancelledBy: null,
          cancellationReason: null,
          cancellationFee: null,
          completedAt: null,
          actualStartTime: null,
          actualEndTime: null,
        })
        expect(await db.$count(bookings)).toBe(1)
      })

      it('writes one service line: the service with the staff member, with no note', async () => {
        const response = await book()

        const lines = await db.select().from(bookingServices)

        expect(lines).toHaveLength(1)
        expect(lines[0]).toMatchObject({
          bookingId: response.body.data.id,
          serviceId: cutId,
          staffId,
          duration: 60,
          price: 6600,
          discountAmount: 0,
          finalPrice: 6600,
          taxIncluded: true,
          isCompleted: false,
          completedAt: null,
          notes: null,
          sortOrder: 0,
        })
      })

      it('begins the history of the booking with the customer as the one who made it', async () => {
        const response = await book()

        expect(await historyOf(response.body.data.id)).toEqual([
          {
            fromStatus: null,
            toStatus: 'pending',
            changedBy: customer.id,
            reason: null,
            metadata: null,
          },
        ])
      })

      it('keeps where the request came from, which no response shows', async () => {
        const response = await book().set('User-Agent', 'SalonApp/2.0')

        const stored = await storedBooking(response.body.data.id)

        expect(stored.userAgent).toBe('SalonApp/2.0')
        expect(stored.ipAddress).toEqual(expect.any(String))
        expect(Object.keys(response.body.data)).not.toContain('userAgent')
        expect(Object.keys(response.body.data)).not.toContain('ipAddress')
      })

      it('takes the time and the amounts from the service as it is, and adds the tax of the salon to a price without it', async () => {
        await db
          .update(salons)
          .set({ taxRate: '10.00' })
          .where(eq(salons.id, salonId))
        const colorId = await insertService({
          name: 'Colour',
          duration: 90,
          price: 8000,
          discountPrice: 7000,
          taxIncluded: false,
        })

        const response = await book(
          wanting({ serviceId: colorId, startTime: iso('13:00') }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data).toMatchObject({
          startTime: iso('13:00'),
          endTime: iso('14:30'),
          duration: 90,
          subtotal: 8000,
          discountAmount: 1000,
          taxAmount: 700,
          totalAmount: 7700,
          services: [
            {
              serviceId: colorId,
              startTime: iso('13:00'),
              endTime: iso('14:30'),
              duration: 90,
              price: 8000,
              discountAmount: 1000,
              finalPrice: 7000,
              taxIncluded: false,
            },
          ],
        })
      })

      it('gives every booking a number of its own', async () => {
        const first = await book(wanting({ startTime: iso('10:00') }))
        const second = await book(wanting({ startTime: iso('13:00') }))

        expect(first.body.data.bookingNumber).toMatch(BOOKING_NUMBER)
        expect(second.body.data.bookingNumber).toMatch(BOOKING_NUMBER)
        expect(second.body.data.bookingNumber).not.toBe(
          first.body.data.bookingNumber,
        )
      })

      it('shows the customer nothing of what the salon notes and records', async () => {
        const response = await book()

        expect(Object.keys(response.body.data).toSorted()).toEqual(
          [
            'id',
            'bookingNumber',
            'salonId',
            'staffId',
            'bookingDate',
            'startTime',
            'endTime',
            'duration',
            'status',
            'subtotal',
            'discountAmount',
            'taxAmount',
            'totalAmount',
            'depositAmount',
            'pointsUsed',
            'pointsEarned',
            'customerRequest',
            'cancelledAt',
            'cancellationFee',
            'completedAt',
            'services',
            'createdAt',
            'updatedAt',
          ].toSorted(),
        )
        expect(Object.keys(response.body.data.services[0]).toSorted()).toEqual(
          [
            'id',
            'serviceId',
            'staffId',
            'startTime',
            'endTime',
            'duration',
            'price',
            'discountAmount',
            'finalPrice',
            'taxIncluded',
            'sortOrder',
          ].toSorted(),
        )
      })

      it('enters the booking into the ledger of the salon, which confirms it', async () => {
        const owner = await member('owner')
        const created = await book()
        const { id } = created.body.data

        const inLedger = await authorized(
          request(app).get(`${LEDGER}/${id}`),
          owner.authorization,
        )
        const confirmed = await authorized(
          request(app).post(`${LEDGER}/${id}/confirm`),
          owner.authorization,
        )
        const seen = await read(id)

        expect(inLedger.status).toBe(200)
        expect(inLedger.body.data).toMatchObject({
          id,
          customerId,
          source: 'online',
          status: 'pending',
          internalNotes: null,
        })
        expect(confirmed.status).toBe(200)
        expect(seen.body.data.status).toBe('confirmed')
      })
    })

    describe('what a request may be', () => {
      it.each<[string, Record<string, unknown>, string[]]>([
        ['no salon', { salonId: undefined }, ['salonId:invalid_type']],
        ['no service', { serviceId: undefined }, ['serviceId:invalid_type']],
        ['no staff member', { staffId: undefined }, ['staffId:invalid_type']],
        ['no time', { startTime: undefined }, ['startTime:invalid_type']],
        [
          'no word about a request of the customer',
          { customerRequest: undefined },
          ['customerRequest:invalid_type'],
        ],
        [
          'a salon that is no ID',
          { salonId: 'aoyama' },
          ['salonId:invalid_format'],
        ],
        [
          'a service that is null',
          { serviceId: null },
          ['serviceId:invalid_type'],
        ],
        [
          'a staff member that is a number',
          { staffId: 7 },
          ['staffId:invalid_type'],
        ],
        [
          'a time with an offset',
          { startTime: `${DAY}T10:00:00+09:00` },
          ['startTime:invalid_format'],
        ],
        [
          'a time without a zone',
          { startTime: `${DAY}T10:00:00` },
          ['startTime:invalid_format'],
        ],
        ['a date for a time', { startTime: DAY }, ['startTime:invalid_format']],
        [
          'a time with seconds',
          { startTime: iso('10:00').replace(':00.000Z', ':30.000Z') },
          ['startTime:custom'],
        ],
        [
          'a request of spaces',
          { customerRequest: '   ' },
          ['customerRequest:invalid_format'],
        ],
        [
          'a request that is a number',
          { customerRequest: 5 },
          ['customerRequest:invalid_type'],
        ],
        [
          'a customer, which is the account',
          { customerId: UNKNOWN_ID },
          ['customerId:unrecognized_keys'],
        ],
        [
          'a second service',
          { services: [{ serviceId: UNKNOWN_ID }] },
          ['services:unrecognized_keys'],
        ],
        [
          'what the salon notes',
          { internalNotes: 'VIP', source: 'phone', depositAmount: 1000 },
          [
            'internalNotes:unrecognized_keys',
            'source:unrecognized_keys',
            'depositAmount:unrecognized_keys',
          ],
        ],
        ['a status', { status: 'confirmed' }, ['status:unrecognized_keys']],
        [
          'several things wrong at once',
          { salonId: 'aoyama', startTime: 'ten', customerRequest: '' },
          [
            'salonId:invalid_format',
            'startTime:invalid_format',
            'customerRequest:invalid_format',
          ],
        ],
      ])('refuses a request with %s', async (_case, more, rules) => {
        const response = await book(wanting(more))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_BOOKING)
        expect(brokenRules(response)).toEqual(rules)
        await expectNothingStored()
      })

      it.each<[string, unknown]>([
        ['a list', [wanting()]],
        ['an empty object', {}],
      ])('refuses a body that is %s', async (_case, body) => {
        const response = await book(body)

        expectProblem(response, badRequest)
        await expectNothingStored()
      })

      it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
        const notJson = (authorization: string | null): Test =>
          authorized(request(app).post(OWN_BOOKINGS), authorization)
            .set('Content-Type', 'application/json')
            .send('{"salonId": "0193a5b8"')

        const responses = [
          await notJson(null),
          await notJson(asCustomer),
          await notJson(asAdmin),
          await authorized(request(app).post(OWN_BOOKINGS), asCustomer)
            .set('Content-Type', 'application/json')
            .send('null'),
          await authorized(request(app).post(OWN_BOOKINGS), null)
            .set('Content-Type', 'text/plain')
            .send('a cut at ten'),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '400 2002',
          '400 2002',
          '400 2002',
          '400 2002',
          '415 2002',
        ])
        await expectNothingStored()
      })

      it('takes a time in whatever spelling of the moment, and a request of the customer', async () => {
        const response = await book(
          wanting({
            startTime: iso('10:00').replace('.000Z', 'Z'),
            customerRequest: '静かな席で',
          }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data).toMatchObject({
          startTime: iso('10:00'),
          customerRequest: '静かな席で',
        })
      })
    })

    describe('what a request refers to', () => {
      const deleted = { deletedAt: new Date().toISOString() }

      it('reports a salon that does not exist, and nothing of what would be of it', async () => {
        const response = await book(
          wanting({ salonId: UNKNOWN_ID, serviceId: UNKNOWN_ID }),
        )

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_BOOKING)
        expect(response.body.errors).toEqual([
          issue('salonId', 'not_found', 'Must name a salon'),
        ])
        await expectNothingStored()
      })

      it('reports a salon that is deleted like one that does not exist', async () => {
        await db.update(salons).set(deleted).where(eq(salons.id, salonId))

        const response = await book()

        expect(outcomeOf(response)).toBe('400 salonId:not_found')
        await expectNothingStored()
      })

      it.each<[string, () => Promise<Record<string, unknown>>, string]>([
        [
          'a service that does not exist',
          async () => ({ serviceId: UNKNOWN_ID }),
          '400 serviceId:not_found',
        ],
        [
          'a service of another salon',
          async () => ({
            serviceId: await insertService({}, await salon()),
          }),
          '400 serviceId:not_found',
        ],
        [
          'a service that is deleted',
          async () => ({ serviceId: await insertService(deleted) }),
          '400 serviceId:not_found',
        ],
        [
          'a staff member who does not exist',
          async () => ({ staffId: UNKNOWN_ID }),
          '400 staffId:not_found',
        ],
        [
          'a staff member of another salon',
          async () => ({ staffId: await staffMember({}, await salon()) }),
          '400 staffId:not_found',
        ],
        [
          'a staff member who is deleted',
          async () => ({ staffId: await staffMember(deleted) }),
          '400 staffId:not_found',
        ],
        [
          'neither a service nor a staff member of the salon',
          async () => ({ serviceId: UNKNOWN_ID, staffId: UNKNOWN_ID }),
          '400 serviceId:not_found,staffId:not_found',
        ],
      ])('reports %s', async (_case, more, outcome) => {
        const response = await book(wanting(await more()))

        expect(outcomeOf(response)).toBe(outcome)
        expect(response.body.detail).toBe(INVALID_BOOKING)
        await expectNothingStored()
      })

      it('says what the service and the staff member have to be', async () => {
        const response = await book(
          wanting({ serviceId: UNKNOWN_ID, staffId: UNKNOWN_ID }),
        )

        expect(response.body.errors).toEqual([
          issue('serviceId', 'not_found', 'Must name a service of the salon'),
          issue(
            'staffId',
            'not_found',
            'Must name a staff member of the salon',
          ),
        ])
      })
    })

    describe('only an available slot', () => {
      it('books every slot the list of available slots offers, with a staff member who takes two customers at once', async () => {
        // A cut takes an hour and the slots begin half an hour apart: two
        // that follow each other meet.
        await db
          .update(staff)
          .set({ maxConcurrentBookings: 2 })
          .where(eq(staff.id, staffId))
        expect(await offered()).toEqual(STARTS)

        const responses = []
        for (const time of STARTS) {
          responses.push(
            await book(
              wanting({ startTime: iso(time) }),
              (await otherCustomer()).authorization,
            ),
          )
        }

        expect(responses.map(statusAndCode)).toEqual(STARTS.map(() => '201'))
        expect(await offered()).toEqual([])
      })

      it('takes a slot off the list once it is booked, and the slots the treatment reaches into', async () => {
        const response = await book(wanting({ startTime: iso('13:30') }))

        expect(response.status).toBe(201)
        // The cut takes an hour: from 13:00 it would reach into the booking.
        expect(await offered()).toEqual(
          STARTS.filter((time) => !['13:00', '13:30', '14:00'].includes(time)),
        )
      })

      it.each<[string, string]>([
        ['before the salon opens, though the staff member works', '09:00'],
        ['between two slots', '10:15'],
        ['too late for the treatment to end before the break', '11:30'],
        ['in the break of the staff member', '12:00'],
        [
          'too late for the treatment to end before the staff member leaves',
          '17:30',
        ],
        ['after the staff member has left, though the salon is open', '18:00'],
        ['in the night', '03:00'],
      ])('refuses a time %s', async (_case, time) => {
        const response = await book(wanting({ startTime: iso(time) }))

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_A_SLOT)
        await expectNothingStored()
      })

      it('refuses a time that has passed, on a day the salon was open and the staff member worked', async () => {
        const yesterday = dateIn(-1)
        await db
          .update(salons)
          .set({ businessHours: [weeklyHours(yesterday)] })
          .where(eq(salons.id, salonId))
        await works(yesterday)

        const response = await book(
          wanting({ startTime: iso('10:00', yesterday) }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_A_SLOT)
        await expectNothingStored()
      })

      it.each<[string, () => Promise<unknown>]>([
        [
          'the salon does not take bookings',
          () =>
            db
              .update(salons)
              .set({ isActive: false })
              .where(eq(salons.id, salonId)),
        ],
        [
          'the calendar of the salon says it is closed that day',
          () => opens(DAY, { openTime: null, closeTime: null }),
        ],
        [
          'the calendar of the salon opens it later that day',
          () => opens(DAY, { openTime: '11:00', closeTime: '19:00' }),
        ],
        [
          'the staff member has the day off',
          () =>
            db
              .update(staffSchedules)
              .set({
                isAvailable: false,
                startTime: null,
                endTime: null,
                breakStartTime: null,
                breakEndTime: null,
              })
              .where(eq(staffSchedules.staffId, staffId)),
        ],
        [
          'the staff member has no schedule for the day',
          () =>
            db
              .delete(staffSchedules)
              .where(eq(staffSchedules.staffId, staffId)),
        ],
        [
          'the staff member comes later that day',
          () =>
            db
              .update(staffSchedules)
              .set({ startTime: '10:30' })
              .where(eq(staffSchedules.staffId, staffId)),
        ],
      ])('refuses the slot at ten when %s', async (_case, arrange) => {
        await arrange()

        const response = await book()

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_A_SLOT)
        await expectNothingStored()
      })

      it.each<[string, Partial<NewService>]>([
        ['is not active', { isActive: false }],
        ['is suspended', { serviceStatus: 'inactive' }],
        ['is not booked online', { allowOnlineBooking: false }],
        [
          'is not offered on that day of the week',
          { availability: OTHER_DAYS },
        ],
      ])('refuses a service that %s', async (_case, columns) => {
        await db.update(services).set(columns).where(eq(services.id, cutId))
        expect(await offered()).toEqual([])

        const response = await book()

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_A_SLOT)
        await expectNothingStored()
      })

      it.each<[string, Partial<NewStaff>, Partial<NewService>]>([
        ['is not active', { isActive: false }, {}],
        ['does not take bookings', { canReceiveBookings: false }, {}],
        [
          'is below the rank the service asks for',
          { level: 'junior' },
          { requiredStaffLevel: 'senior' },
        ],
      ])('refuses a staff member who %s', async (_case, ofStaff, ofService) => {
        await db.update(staff).set(ofStaff).where(eq(staff.id, staffId))
        if (Object.keys(ofService).length > 0) {
          await db.update(services).set(ofService).where(eq(services.id, cutId))
        }
        expect(await offered()).toEqual([])

        const response = await book()

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_A_SLOT)
        await expectNothingStored()
      })

      it('refuses a staff member who is occupied at the time, by a booking of another customer', async () => {
        const other = await otherCustomer()
        await insertBooking(jst('10:30'), { customerId: other.customerId })

        const responses = [
          await book(wanting({ startTime: iso('10:00') })),
          await book(wanting({ startTime: iso('10:30') })),
          await book(wanting({ startTime: iso('11:00') })),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '409 3003',
          '409 3003',
          '409 3003',
        ])
        expect(responses.map(({ body }) => body.detail)).toEqual([
          NOT_A_SLOT,
          NOT_A_SLOT,
          NOT_A_SLOT,
        ])
        expect(await db.$count(bookings)).toBe(1)
      })

      it('refuses a slot within the time the staff member keeps free around another booking', async () => {
        const other = await otherCustomer()
        await db
          .update(staff)
          .set({ bufferTimeBefore: 30, bufferTimeAfter: 30 })
          .where(eq(staff.id, staffId))
        await insertBooking(jst('14:00'), { customerId: other.customerId })

        const responses = [
          // 13:00 to 14:00, and half an hour after it: into the other booking.
          await book(wanting({ startTime: iso('13:00') })),
          // The other booking ends at 15:00, and half an hour is kept free.
          await book(wanting({ startTime: iso('15:00') })),
          await book(wanting({ startTime: iso('15:30') })),
          await book(wanting({ startTime: iso('16:00') })),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '409 3003',
          '409 3003',
          '409 3003',
          '201',
        ])
      })

      it.each<[string, NewBooking['status'], string]>([
        ['is cancelled', 'cancelled', '201'],
        ['the customer did not come to', 'no_show', '201'],
        ['is a draft', 'draft', '409 3003'],
        ['is confirmed', 'confirmed', '409 3003'],
        ['is under way', 'in_progress', '409 3003'],
        ['is completed', 'completed', '409 3003'],
      ])(
        'answers a slot at which the staff member has a booking that %s with %s',
        async (_case, status, outcome) => {
          const other = await otherCustomer()
          await insertBooking(jst('10:00'), {
            customerId: other.customerId,
            ...inStatus(status),
          })

          const response = await book()

          expect(statusAndCode(response)).toBe(outcome)
        },
      )

      it('books as many customers into one slot as the staff member takes at once', async () => {
        await db
          .update(staff)
          .set({ maxConcurrentBookings: 2 })
          .where(eq(staff.id, staffId))

        const responses = [
          await book(wanting(), (await otherCustomer()).authorization),
          await book(wanting(), (await otherCustomer()).authorization),
          await book(wanting(), (await otherCustomer()).authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual(['201', '201', '409 3003'])
        expect(responses[2]?.body.detail).toBe(NOT_A_SLOT)
      })

      it('refuses a service that has been booked as often as it is on a day, with whatever staff member', async () => {
        const other = await staffMember()
        await works(DAY, other)
        const tomorrow = daysAfter(DAY, 1)
        await db
          .update(salons)
          .set({ businessHours: [weeklyHours(), weeklyHours(tomorrow)] })
          .where(eq(salons.id, salonId))
        await works(tomorrow)
        await db
          .update(services)
          .set({ maxBookingsPerDay: 1 })
          .where(eq(services.id, cutId))
        const first = await book(
          wanting({ startTime: iso('10:00') }),
          (await otherCustomer()).authorization,
        )

        const sameDay = await book(
          wanting({ staffId: other, startTime: iso('15:00') }),
        )
        const nextDay = await book(
          wanting({ startTime: iso('10:00', tomorrow) }),
        )

        expect(first.status).toBe(201)
        expectProblem(sameDay, notAllowed)
        expect(sameDay.body.detail).toBe(NOT_A_SLOT)
        expect(nextDay.status).toBe(201)
      })

      it('reads the calendar and the schedule of the date the time is on in the time zone of the salon', async () => {
        // 08:30 in Tokyo is the day before in UTC, a day for which the
        // salon has no hours.
        await opens(DAY, { openTime: '08:00', closeTime: '19:00' })
        await db
          .update(staffSchedules)
          .set({ startTime: '08:00' })
          .where(eq(staffSchedules.staffId, staffId))

        const response = await book(wanting({ startTime: iso('08:30') }))

        expect(response.status).toBe(201)
        expect(response.body.data).toMatchObject({
          bookingDate: DAY,
          startTime: iso('08:30'),
        })
        expect(response.body.data.startTime.slice(0, 10)).toBe(
          daysAfter(DAY, -1),
        )
      })

      it.each<[string, number, string]>([
        // 08:30 in Tokyo on the day: the day before in UTC.
        ['early on the day', 0, '409 3003'],
        // 08:30 in Tokyo the day after: the day itself in UTC.
        ['early on the day after', 1, '201'],
      ])(
        'counts a booking of the service %s by the day of the salon, which answers %s',
        async (_case, days, outcome) => {
          const other = await otherCustomer()
          await db
            .update(services)
            .set({ maxBookingsPerDay: 1 })
            .where(eq(services.id, cutId))
          await insertBooking(jst('08:30', daysAfter(DAY, days)), {
            by: await staffMember(),
            customerId: other.customerId,
          })

          const response = await book(wanting({ startTime: iso('15:00') }))

          expect(statusAndCode(response)).toBe(outcome)
        },
      )
    })

    describe('the customer who books', () => {
      it.each<[string, Partial<NewCustomer>, string]>([
        ['is active', { customerStatus: 'active' }, '201'],
        ['is a VIP', { customerStatus: 'vip' }, '201'],
        [
          'is set aside as inactive',
          { customerStatus: 'inactive' },
          '409 3003',
        ],
        ['is blacklisted', { customerStatus: 'blacklisted' }, '409 3003'],
        ['is not active', { isActive: false }, '409 3003'],
        [
          'is a VIP who is not active',
          { customerStatus: 'vip', isActive: false },
          '409 3003',
        ],
      ])(
        'answers a customer who %s with %s',
        async (_case, columns, outcome) => {
          await changeCustomer(columns)

          const response = await book()

          expect(statusAndCode(response)).toBe(outcome)
          expect(await db.$count(bookings)).toBe(outcome === '201' ? 1 : 0)
        },
      )

      it('does not tell a customer why the salons do not take their bookings', async () => {
        await changeCustomer({ customerStatus: 'blacklisted' })

        const response = await book()

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_ACCEPTED)
        expect(JSON.stringify(response.body)).not.toContain('blacklisted')
      })

      it('lets the salon enter a booking for a customer who does not book by themself', async () => {
        await changeCustomer({ customerStatus: 'blacklisted', isActive: false })

        const entered = await authorized(
          request(app).post(LEDGER),
          asAdmin,
        ).send({
          salonId,
          customerId,
          staffId,
          depositAmount: null,
          customerRequest: null,
          internalNotes: null,
          source: 'phone',
          services: [
            { serviceId: cutId, staffId, startTime: iso('10:00'), notes: null },
          ],
        })

        expect(entered.status).toBe(201)
      })

      it.each<[string, string, number, string]>([
        ['at the same time', '10:00', 60, '409 3003'],
        ['that begins during it', '10:30', 60, '409 3003'],
        ['that ends during it', '09:30', 60, '409 3003'],
        ['that lasts all morning', '09:00', 180, '409 3003'],
        ['that ends when it begins', '09:00', 60, '201'],
        ['that begins when it ends', '11:00', 60, '201'],
      ])(
        'answers a slot for which the customer has another booking %s with %s',
        async (_case, from, minutes, outcome) => {
          // At another salon, with another staff member: nothing but the
          // customer is the same.
          const elsewhere = await salon()
          const there = await staffMember({}, elsewhere)
          const perm = await insertService({}, elsewhere)
          await insertBooking(jst(from), {
            of: elsewhere,
            by: there,
            service: perm,
            minutes,
          })

          const response = await book()

          expect(statusAndCode(response)).toBe(outcome)
          if (outcome !== '201') {
            expect(response.body.detail).toBe(CUSTOMER_OCCUPIED)
          }
          expect(await db.$count(bookings)).toBe(outcome === '201' ? 2 : 1)
        },
      )

      it.each<[string, NewBooking['status'], string]>([
        ['is cancelled', 'cancelled', '201'],
        ['they did not come to', 'no_show', '201'],
        ['is a draft', 'draft', '409 3003'],
        ['is pending', 'pending', '409 3003'],
        ['is confirmed', 'confirmed', '409 3003'],
        ['is under way', 'in_progress', '409 3003'],
        ['is completed', 'completed', '409 3003'],
      ])(
        'answers a slot for which the customer has another booking that %s with %s',
        async (_case, status, outcome) => {
          const elsewhere = await salon()
          await insertBooking(jst('10:00'), {
            of: elsewhere,
            by: await staffMember({}, elsewhere),
            service: await insertService({}, elsewhere),
            ...inStatus(status),
          })

          const response = await book()

          expect(statusAndCode(response)).toBe(outcome)
        },
      )

      it('does not let a customer book one slot twice with a staff member who takes several at once', async () => {
        await db
          .update(staff)
          .set({ maxConcurrentBookings: 3 })
          .where(eq(staff.id, staffId))

        const first = await book()
        const second = await book()

        expect(first.status).toBe(201)
        expectProblem(second, notAllowed)
        expect(second.body.detail).toBe(CUSTOMER_OCCUPIED)
      })

      it('does not look at the bookings of other customers at that time', async () => {
        const other = await otherCustomer()
        const elsewhere = await salon()
        await insertBooking(jst('10:00'), {
          of: elsewhere,
          by: await staffMember({}, elsewhere),
          service: await insertService({}, elsewhere),
          customerId: other.customerId,
        })

        const response = await book()

        expect(response.status).toBe(201)
      })

      it('lets the customer book the slot again once they have cancelled', async () => {
        const first = await book()
        await cancel(first.body.data.id)

        const again = await book()

        expect(again.status).toBe(201)
        expect(again.body.data.id).not.toBe(first.body.data.id)
      })
    })

    describe('the order in which a request is looked at', () => {
      it('looks at the account before the request', async () => {
        const responses = [
          await book({ nothing: 'right' }, null),
          await book({ nothing: 'right' }, asAdmin),
          await book(
            { nothing: 'right' },
            (await member('owner')).authorization,
          ),
          await book(
            { nothing: 'right' },
            (await withoutProfile()).authorization,
          ),
          await book({ nothing: 'right' }),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '401 1001',
          '403 1005',
          '403 1005',
          '404 3001',
          '400 2001',
        ])
      })

      it('looks at the request before the customer, the salon and what is of it', async () => {
        await changeCustomer({ deletedAt: new Date().toISOString() })

        const response = await book(
          wanting({ salonId: UNKNOWN_ID, startTime: 'ten' }),
        )

        expect(outcomeOf(response)).toBe('400 startTime:invalid_format')
      })

      it('answers a customer who was deleted behind the link of the account like an account without a profile', async () => {
        await changeCustomer({ deletedAt: new Date().toISOString() })

        const response = await book(wanting({ salonId: UNKNOWN_ID }))

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Customer profile of user ${customer.id} was not found`,
        )
        await expectNothingStored()
      })

      it('looks at what the request refers to before the time zone, the customer and the slot', async () => {
        const lost = await salon({ timezone: 'Mars/Olympus' })
        await changeCustomer({ customerStatus: 'blacklisted' })

        const response = await book(
          wanting({ salonId: lost, startTime: iso('03:00') }),
        )

        expect(outcomeOf(response)).toBe(
          '400 serviceId:not_found,staffId:not_found',
        )
      })

      it('answers 409 for a salon whose time zone the runtime does not know, before it looks at the customer', async () => {
        const lost = await salon({ timezone: 'Mars/Olympus' })
        await changeCustomer({ customerStatus: 'blacklisted' })

        const response = await book(
          wanting({
            salonId: lost,
            serviceId: await insertService({}, lost),
            staffId: await staffMember({}, lost),
          }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(TIME_ZONE_UNKNOWN)
        await expectNothingStored()
      })

      it('looks at the customer before the slot', async () => {
        await changeCustomer({ customerStatus: 'inactive' })

        const response = await book(wanting({ startTime: iso('03:00') }))

        expect(response.body.detail).toBe(NOT_ACCEPTED)
      })

      it('looks at the slot before the other bookings of the customer', async () => {
        await insertBooking(jst('10:00'))

        const response = await book()

        // Their own booking occupies the staff member, who takes one at once.
        expect(response.body.detail).toBe(NOT_A_SLOT)
      })

      it('answers 500 for a salon whose stored weekly hours do not have the shape of the model', async () => {
        await db
          .update(salons)
          .set({
            businessHours: [{ ...weeklyHours(), timezone: 'Asia/Tokyo' }],
          })
          .where(eq(salons.id, salonId))

        const response = await book()

        expectProblem(response, databaseProblem)
        await expectNothingStored()
      })
    })
  })

  describe('requests at the same moment', () => {
    const six = () =>
      Promise.all(Array.from({ length: 6 }, () => otherCustomer()))

    // A booking holds the staff member before it reads who occupies them,
    // so the bookings of a staff member are written one after the other.
    it('books one of six customers who want the same slot', async () => {
      const customersOfSlot = await six()

      const responses = await Promise.all(
        customersOfSlot.map(({ authorization }) =>
          book(wanting(), authorization),
        ),
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

    it('books as many of six customers as the staff member takes at once', async () => {
      await db
        .update(staff)
        .set({ maxConcurrentBookings: 2 })
        .where(eq(staff.id, staffId))
      const customersOfSlot = await six()

      const responses = await Promise.all(
        customersOfSlot.map(({ authorization }) =>
          book(wanting(), authorization),
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

    // A booking holds the service, so the bookings of a service are
    // counted one after the other.
    it('books one of six customers who want the last booking a service takes that day, each with another staff member', async () => {
      await db
        .update(services)
        .set({ maxBookingsPerDay: 1 })
        .where(eq(services.id, cutId))
      const members = await Promise.all(
        Array.from({ length: 6 }, async () => {
          const id = await staffMember()
          await works(DAY, id)
          return id
        }),
      )
      const customersOfDay = await six()

      const responses = await Promise.all(
        customersOfDay.map(({ authorization }, index) =>
          book(wanting({ staffId: members[index] }), authorization),
        ),
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
    })

    // A booking holds the customer, so the bookings of a customer are
    // written one after the other.
    it('books one of six requests of one customer for the same time, each with another staff member', async () => {
      const members = await Promise.all(
        Array.from({ length: 6 }, async () => {
          const id = await staffMember()
          await works(DAY, id)
          return id
        }),
      )

      const responses = await Promise.all(
        members.map((id) => book(wanting({ staffId: id }))),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(
        responses
          .filter(({ status }) => status === 409)
          .map(({ body }) => body.detail),
      ).toEqual(Array.from({ length: 5 }, () => CUSTOMER_OCCUPIED))
      expect(await db.$count(bookings)).toBe(1)
    })

    it('books every one of six customers who want six slots of one staff member that do not meet', async () => {
      const times = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00']
      const customersOfDay = await six()

      const responses = await Promise.all(
        customersOfDay.map(({ authorization }, index) =>
          book(wanting({ startTime: iso(times[index] ?? '') }), authorization),
        ),
      )

      expect(responses.map(statusAndCode)).toEqual(times.map(() => '201'))
      expect(
        new Set(responses.map(({ body }) => body.data.bookingNumber)).size,
      ).toBe(6)
    })

    it('writes one of a booking the customer makes and one the salon enters for the same slot', async () => {
      const other = await otherCustomer()
      const entering = (time: string) =>
        authorized(request(app).post(LEDGER), asAdmin).send({
          salonId,
          customerId: other.customerId,
          staffId,
          depositAmount: null,
          customerRequest: null,
          internalNotes: null,
          source: 'phone',
          services: [
            { serviceId: cutId, staffId, startTime: iso(time), notes: null },
          ],
        })

      const rounds = await Promise.all(
        ['10:00', '13:00', '15:00'].map((time) =>
          Promise.all([
            book(wanting({ startTime: iso(time) })),
            entering(time),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode).toSorted()).toEqual(['201', '409 3003'])
      }
      expect(await db.$count(bookings)).toBe(3)
    })
  })

  describe('GET /api/v1/customers/me/bookings', () => {
    it('answers a customer without bookings with an empty page', async () => {
      const response = await list()

      expect(response.status).toBe(200)
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
          self: OWN_BOOKINGS,
          first: OWN_BOOKINGS,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('lists the bookings of the customer by the time they begin, earliest first, each as a GET of it returns it', async () => {
      const afternoon = await book(wanting({ startTime: iso('15:00') }))
      const morning = await book(wanting({ startTime: iso('10:00') }))
      const noon = await book(wanting({ startTime: iso('13:00') }))

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        morning.body.data.id,
        noon.body.data.id,
        afternoon.body.data.id,
      ])
      expect(response.body.data[0]).toEqual(
        (await read(morning.body.data.id)).body.data,
      )
      expect(response.body.data[0]).toEqual(shown('10:00'))
      expect(response.body.meta.total).toBe(3)
    })

    it('lists the bookings a salon entered for the customer, at whatever salon and in whatever status', async () => {
      const elsewhere = await salon()
      const entered = [
        await insertBooking(jst('10:00'), inStatus('draft')),
        await insertBooking(jst('11:00'), inStatus('confirmed')),
        await insertBooking(jst('13:00'), inStatus('in_progress')),
        await insertBooking(jst('14:00'), inStatus('completed')),
        await insertBooking(jst('15:00'), inStatus('cancelled')),
        await insertBooking(jst('16:00'), inStatus('no_show')),
        await insertBooking(jst('17:00'), {
          of: elsewhere,
          by: await staffMember({}, elsewhere),
          service: await insertService({}, elsewhere),
        }),
      ]

      const response = await list()

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual(
        entered,
      )
      expect(
        response.body.data.map(({ status }: { status: string }) => status),
      ).toEqual([
        'draft',
        'confirmed',
        'in_progress',
        'completed',
        'cancelled',
        'no_show',
        'pending',
      ])
      expect(response.body.data[6].salonId).toBe(elsewhere)
    })

    it('shows what the salon entered as the customer is shown a booking: without what the salon notes', async () => {
      await insertBooking(jst('10:00'), {
        ...inStatus('cancelled'),
        internalNotes: '遅刻が多い',
        source: 'phone',
        cancelledBy: admin.id,
        cancellationReason: 'スタッフの都合',
        cancellationFee: 0,
      })

      const response = await list()

      expect(response.body.data).toEqual([
        shown('10:00', {
          bookingNumber: expect.stringMatching(/^BK-SLOTS-/),
          status: 'cancelled',
          cancelledAt: expect.stringMatching(ISO_TIMESTAMP),
          cancellationFee: 0,
        }),
      ])
      expect(JSON.stringify(response.body)).not.toContain('遅刻')
      expect(JSON.stringify(response.body)).not.toContain('スタッフの都合')
    })

    it('does not list the bookings of other customers', async () => {
      const other = await otherCustomer()
      const own = await insertBooking(jst('10:00'))
      const theirs = await insertBooking(jst('13:00'), {
        customerId: other.customerId,
      })

      const responses = [await list(), await list('', other.authorization)]

      expect(
        responses.map(({ body }) =>
          body.data.map(({ id }: { id: string }) => id),
        ),
      ).toEqual([[own], [theirs]])
      expect(responses.map(({ body }) => body.meta.total)).toEqual([1, 1])
    })

    it('lists bookings that begin at the same time by their IDs', async () => {
      const elsewhere = await salon()
      const there = await staffMember({}, elsewhere)
      const perm = await insertService({}, elsewhere)
      const ids = [
        await insertBooking(jst('10:00'), inStatus('cancelled')),
        await insertBooking(jst('10:00'), inStatus('cancelled')),
        await insertBooking(jst('10:00'), {
          of: elsewhere,
          by: there,
          service: perm,
        }),
      ]

      const response = await list()

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual(
        ids.toSorted(),
      )
    })

    describe('the pages', () => {
      const five = async (): Promise<string[]> => {
        const ids = []
        for (const time of ['10:00', '11:00', '13:00', '14:00', '15:00']) {
          ids.push(await insertBooking(jst(time)))
        }
        return ids
      }

      it('walks the pages by the cursor of the page before', async () => {
        const ids = await five()

        const first = await list('limit=2')
        const second = await list(`limit=2&cursor=${ids[1]}`)
        const third = await list(`limit=2&cursor=${ids[3]}`)

        expect(
          [first, second, third].map(({ body }) =>
            body.data.map(({ id }: { id: string }) => id),
          ),
        ).toEqual([ids.slice(0, 2), ids.slice(2, 4), ids.slice(4)])
        expect([first, second, third].map(({ body }) => body.meta)).toEqual([
          {
            total: 5,
            limit: 2,
            hasMore: true,
            cursor: null,
            nextCursor: ids[1],
            prevCursor: null,
          },
          {
            total: 5,
            limit: 2,
            hasMore: true,
            cursor: ids[1],
            nextCursor: ids[3],
            prevCursor: null,
          },
          {
            total: 5,
            limit: 2,
            hasMore: false,
            cursor: ids[3],
            nextCursor: null,
            prevCursor: null,
          },
        ])
        expect(first.body.links).toEqual({
          self: `${OWN_BOOKINGS}?limit=2`,
          first: `${OWN_BOOKINGS}?limit=2`,
          last: null,
          next: `${OWN_BOOKINGS}?limit=2&cursor=${ids[1]}`,
          prev: null,
        })
      })

      it('lists 20 bookings on a page unless the request says how many', async () => {
        for (let hour = 0; hour < 21; hour += 1) {
          await insertBooking(
            jst(`${String(hour).padStart(2, '0')}:00`),
            inStatus('cancelled'),
          )
        }

        const response = await list()

        expect(response.body.data).toHaveLength(20)
        expect(response.body.meta).toMatchObject({
          total: 21,
          limit: 20,
          hasMore: true,
        })
      })

      it.each([1, 100])('takes a limit of %s', async (limit) => {
        await five()

        const response = await list(`limit=${limit}`)

        expect(response.status).toBe(200)
        expect(response.body.meta.limit).toBe(limit)
      })
    })

    describe('the conditions of a search', () => {
      it('lists the bookings in a status', async () => {
        const pending = await insertBooking(jst('10:00'))
        await insertBooking(jst('13:00'), inStatus('cancelled'))
        const alsoPending = await insertBooking(jst('15:00'))

        const response = await list('status=pending')

        expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
          pending,
          alsoPending,
        ])
        expect(response.body.meta.total).toBe(2)
      })

      it('lists the bookings of the days from one date to another, both included', async () => {
        const before = daysAfter(DAY, -1)
        const after = daysAfter(DAY, 1)
        const ids = {
          before: await insertBooking(jst('10:00', before)),
          on: await insertBooking(jst('10:00', DAY)),
          after: await insertBooking(jst('10:00', after)),
        }

        const responses = [
          await list(`bookingDateFrom=${DAY}`),
          await list(`bookingDateTo=${DAY}`),
          await list(`bookingDateFrom=${DAY}&bookingDateTo=${DAY}`),
          await list(`bookingDateFrom=${before}&bookingDateTo=${after}`),
        ]

        expect(
          responses.map(({ body }) =>
            body.data.map(({ id }: { id: string }) => id),
          ),
        ).toEqual([
          [ids.on, ids.after],
          [ids.before, ids.on],
          [ids.on],
          [ids.before, ids.on, ids.after],
        ])
      })

      it('keeps the conditions of a search in the links of its pages', async () => {
        const first = await insertBooking(jst('10:00'))
        await insertBooking(jst('13:00'))

        const response = await list(
          `status=pending&bookingDateFrom=${DAY}&limit=1`,
        )

        expect(response.body.links.next).toBe(
          `${OWN_BOOKINGS}?status=pending&bookingDateFrom=${DAY}&limit=1&cursor=${first}`,
        )
      })

      it.each<[string, string, string[]]>([
        ['a limit of 0', 'limit=0', ['limit:too_small']],
        ['a limit of 101', 'limit=101', ['limit:too_big']],
        ['a limit that is no number', 'limit=many', ['limit:invalid_format']],
        ['a limit with a fraction', 'limit=1.5', ['limit:invalid_type']],
        ['a cursor that is no ID', 'cursor=first', ['cursor:invalid_format']],
        ['a status there is not', 'status=waiting', ['status:invalid_value']],
        [
          'a first day that is no date',
          'bookingDateFrom=today',
          ['bookingDateFrom:invalid_format'],
        ],
        [
          'a last day that is a time',
          `bookingDateTo=${DAY}T10:00:00Z`,
          ['bookingDateTo:invalid_format'],
        ],
        [
          'a last day before the first',
          `bookingDateFrom=${DAY}&bookingDateTo=${daysAfter(DAY, -1)}`,
          ['bookingDateTo:custom'],
        ],
        [
          'a salon, which the ledger is searched by',
          `salonId=${UNKNOWN_ID}`,
          ['salonId:unrecognized_keys'],
        ],
        [
          'a customer, which is the account',
          `customerId=${UNKNOWN_ID}`,
          ['customerId:unrecognized_keys'],
        ],
        [
          'a staff member, which the ledger is searched by',
          `staffId=${UNKNOWN_ID}`,
          ['staffId:unrecognized_keys'],
        ],
        [
          'a parameter there is not',
          'sort=startTime',
          ['sort:unrecognized_keys'],
        ],
        [
          'a parameter twice',
          'status=pending&status=cancelled',
          ['status:invalid_value'],
        ],
      ])('refuses %s', async (_case, query, rules) => {
        await insertBooking(jst('10:00'))

        const response = await list(query)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(brokenRules(response)).toEqual(rules)
      })

      it.each<[string, () => Promise<string>]>([
        ['no booking', async () => UNKNOWN_ID],
        [
          'a booking of another customer',
          async () =>
            insertBooking(jst('13:00'), {
              customerId: (await otherCustomer()).customerId,
            }),
        ],
      ])(
        'refuses a cursor that names %s, and does not tell the two apart',
        async (_case, cursorOf) => {
          await insertBooking(jst('10:00'))

          const response = await list(`cursor=${await cursorOf()}`)

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_SEARCH)
          expect(response.body.errors).toEqual([
            issue('cursor', 'not_found', 'Must name a booking'),
          ])
        },
      )

      it('looks at the account before the search', async () => {
        const responses = [
          await list('limit=0', null),
          await list('limit=0', asAdmin),
          await list('limit=0', (await member('manager')).authorization),
          await list('limit=0', (await withoutProfile()).authorization),
          await list('limit=0'),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '401 1001',
          '403 1005',
          '403 1005',
          '404 3001',
          '400 2001',
        ])
      })
    })
  })

  describe('GET /api/v1/customers/me/bookings/:id', () => {
    it('returns a booking of the customer with its service line', async () => {
      const created = await book(wanting({ customerRequest: '静かな席で' }))
      const { id } = created.body.data

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(response.body).toEqual({
        data: shown('10:00', { id, customerRequest: '静かな席で' }),
        meta,
        links: { self: `${OWN_BOOKINGS}/${id}`, list: OWN_BOOKINGS },
      })
    })

    it('returns a booking a salon entered for the customer, with every line in its order', async () => {
      const id = await insertBooking(jst('10:00'), {
        ...inStatus('confirmed'),
        internalNotes: '電話で受付',
      })
      const colorId = await insertService({ name: 'Colour' })
      await db.insert(bookingServices).values({
        bookingId: id,
        serviceId: colorId,
        staffId: null,
        startTime: iso('11:00'),
        endTime: iso('12:00'),
        duration: 60,
        price: 8000,
        finalPrice: 8000,
        taxIncluded: true,
        notes: '明るめ',
        sortOrder: 1,
      })

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('confirmed')
      expect(response.body.data.services).toEqual([
        expect.objectContaining({ serviceId: cutId, staffId, sortOrder: 0 }),
        {
          id: expect.stringMatching(UUID),
          serviceId: colorId,
          staffId: null,
          startTime: iso('11:00'),
          endTime: iso('12:00'),
          duration: 60,
          price: 8000,
          discountAmount: 0,
          finalPrice: 8000,
          taxIncluded: true,
          sortOrder: 1,
        },
      ])
      expect(JSON.stringify(response.body)).not.toContain('電話で受付')
      expect(JSON.stringify(response.body)).not.toContain('明るめ')
    })

    it.each(malformedIds)('refuses %s for an ID', async (_case, id) => {
      const response = await read(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid booking ID')
      expect(brokenRules(response)).toHaveLength(1)
      expect(brokenRules(response)[0]).toMatch(/^id:/)
    })

    it('answers 404 for an ID that no booking has', async () => {
      const response = await read(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
    })

    it('answers a booking of another customer like one that does not exist', async () => {
      const other = await otherCustomer()
      const theirs = await book(wanting(), other.authorization)
      const { id } = theirs.body.data

      const response = await read(id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${id} was not found`)
      expect((await read(id, other.authorization)).status).toBe(200)
    })

    it('looks at the account before the ID', async () => {
      const responses = [
        await read('haircut', null),
        await read('haircut', asAdmin),
        await read('haircut', (await member('staff')).authorization),
        await read('haircut', (await withoutProfile()).authorization),
        await read('haircut'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '403 1005',
        '404 3001',
        '400 2001',
      ])
    })

    it('does not show the booking any more once the customer is deleted from the ledger of customers', async () => {
      const created = await book()
      await db
        .update(users)
        .set({ customerId: null })
        .where(eq(users.id, customer.id))

      const response = await read(created.body.data.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Customer profile of user ${customer.id} was not found`,
      )
    })
  })

  describe('POST /api/v1/customers/me/bookings/:id/cancel', () => {
    const counted = async (id: string = customerId) => {
      const [row] = await db
        .select({
          visitCount: customers.visitCount,
          cancellationCount: customers.cancellationCount,
          noShowCount: customers.noShowCount,
        })
        .from(customers)
        .where(eq(customers.id, id))
      return row
    }

    it('cancels a booking and returns it as the customer is shown it', async () => {
      const created = await book()
      const { id } = created.body.data

      const response = await cancel(id, {
        cancellationReason: '都合が悪くなった',
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          ...created.body.data,
          status: 'cancelled',
          cancelledAt: expect.stringMatching(ISO_TIMESTAMP),
          cancellationFee: 0,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta,
        links: { self: `${OWN_BOOKINGS}/${id}`, list: OWN_BOOKINGS },
      })
      expect(JSON.stringify(response.body)).not.toContain('都合が悪くなった')
    })

    it('writes who cancelled and why, a line of the history, and counts the cancellations of the customer', async () => {
      const created = await book()
      const { id } = created.body.data
      const before = Date.now()

      await cancel(id, { cancellationReason: '都合が悪くなった' })

      const stored = await storedBooking(id)
      expect(stored).toMatchObject({
        status: 'cancelled',
        cancelledBy: customer.id,
        cancellationReason: '都合が悪くなった',
        cancellationFee: 0,
      })
      expect(
        new Date(stored.cancelledAt ?? '').getTime(),
      ).toBeGreaterThanOrEqual(before - 1000)
      expect(await historyOf(id)).toEqual([
        {
          fromStatus: null,
          toStatus: 'pending',
          changedBy: customer.id,
          reason: null,
          metadata: null,
        },
        {
          fromStatus: 'pending',
          toStatus: 'cancelled',
          changedBy: customer.id,
          reason: '都合が悪くなった',
          metadata: null,
        },
      ])
      expect(await counted()).toEqual({
        visitCount: 0,
        cancellationCount: 1,
        noShowCount: 0,
      })
    })

    it('takes no reason', async () => {
      const created = await book()

      const response = await cancel(created.body.data.id)

      expect(response.status).toBe(200)
      expect(await storedBooking(created.body.data.id)).toMatchObject({
        cancellationReason: null,
      })
    })

    it('gives the slot back to the list of available slots', async () => {
      const created = await book()
      expect(await offered()).not.toContain('10:00')

      await cancel(created.body.data.id)

      expect(await offered()).toEqual(STARTS)
    })

    it('cancels a booking the salon entered for the customer', async () => {
      const id = await insertBooking(jst('10:00'), inStatus('confirmed'))

      const response = await cancel(id)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('cancelled')
      expect(await storedBooking(id)).toMatchObject({
        status: 'cancelled',
        cancelledBy: customer.id,
      })
    })

    it.each<[NewBooking['status'], string]>([
      ['draft', '200'],
      ['pending', '200'],
      ['confirmed', '200'],
      ['in_progress', '409 3003'],
      ['completed', '409 3003'],
      ['cancelled', '409 3003'],
      ['no_show', '409 3003'],
    ])(
      'answers the cancellation of a booking that is %s with %s',
      async (status, outcome) => {
        const id = await insertBooking(jst('10:00'), inStatus(status))

        const response = await cancel(id)

        expect(statusAndCode(response)).toBe(outcome)
        if (outcome !== '200') {
          expect(response.body.detail).toBe(
            `A booking that is ${status} cannot be cancelled; its status has to be draft or pending or confirmed`,
          )
          expect((await storedBooking(id)).status).toBe(status)
        }
      },
    )

    it.each<[string, number, string]>([
      ['began a minute ago', -1, '409 3003'],
      ['was yesterday', -24 * 60, '409 3003'],
      ['begins in two minutes', 2, '200'],
    ])(
      'answers the cancellation of a booking that %s with %s',
      async (_case, minutes, outcome) => {
        const id = await insertBooking(
          new Date(Date.now() + minutes * 60_000),
          inStatus('confirmed'),
        )

        const response = await cancel(id)

        expect(statusAndCode(response)).toBe(outcome)
        if (outcome !== '200') {
          expect(response.body.detail).toBe(ALREADY_BEGUN)
          expect(await storedBooking(id)).toMatchObject({
            status: 'confirmed',
            cancelledAt: null,
          })
          expect(await historyOf(id)).toEqual([])
        }
      },
    )

    it('leaves a booking that has begun to the salon, which still cancels it', async () => {
      const id = await insertBooking(
        new Date(Date.now() - 60_000),
        inStatus('confirmed'),
      )

      const own = await cancel(id)
      const bySalon = await authorized(
        request(app).post(`${LEDGER}/${id}/cancel`),
        asAdmin,
      ).send({ cancellationReason: null })

      expectProblem(own, notAllowed)
      expect(bySalon.status).toBe(200)
    })

    it('looks at the status before the time', async () => {
      const id = await insertBooking(
        new Date(Date.now() - 60 * 60_000),
        inStatus('completed'),
      )

      const response = await cancel(id)

      expect(response.body.detail).toBe(
        'A booking that is completed cannot be cancelled; its status has to be draft or pending or confirmed',
      )
    })

    it.each<[string, unknown, string]>([
      ['no reason at all', {}, '400 cancellationReason:invalid_type'],
      [
        'a reason of spaces',
        { cancellationReason: '  ' },
        '400 cancellationReason:invalid_format',
      ],
      [
        'a reason that is a number',
        { cancellationReason: 3 },
        '400 cancellationReason:invalid_type',
      ],
      [
        'a fee',
        { cancellationReason: null, cancellationFee: 0 },
        '400 cancellationFee:unrecognized_keys',
      ],
      ['a list', [], '400 :invalid_type'],
    ])('refuses a request with %s', async (_case, body, outcome) => {
      const created = await book()

      const response = await cancel(created.body.data.id, body)

      expect(outcomeOf(response)).toBe(outcome)
      expect(response.body.detail).toBe(INVALID_CANCELLATION)
      expect((await storedBooking(created.body.data.id)).status).toBe('pending')
    })

    it.each(malformedIds)('refuses %s for an ID', async (_case, id) => {
      const response = await cancel(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid booking ID')
      expect(brokenRules(response)[0]).toMatch(/^id:/)
    })

    it('answers 404 for an ID that no booking has', async () => {
      const response = await cancel(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${UNKNOWN_ID} was not found`)
    })

    it('answers a booking of another customer like one that does not exist, and leaves it as it is', async () => {
      const other = await otherCustomer()
      const theirs = await book(wanting(), other.authorization)
      const { id } = theirs.body.data

      const response = await cancel(id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Booking ${id} was not found`)
      expect((await storedBooking(id)).status).toBe('pending')
      expect(await counted(other.customerId)).toMatchObject({
        cancellationCount: 0,
      })
    })

    it('looks at the account, then at the ID, then at the request, then for the booking', async () => {
      const wrong = { reason: 'none' }
      const responses = [
        await cancel('haircut', wrong, null),
        await cancel('haircut', wrong, asAdmin),
        await cancel('haircut', wrong, (await member('owner')).authorization),
        await cancel('haircut', wrong, (await withoutProfile()).authorization),
        await cancel('haircut', wrong),
        await cancel(UNKNOWN_ID, wrong),
        await cancel(UNKNOWN_ID),
      ]

      expect(responses.map(outcomeOf)).toEqual([
        '401 1001',
        '403 1005',
        '403 1005',
        '404 3001',
        expect.stringMatching(/^400 id:/),
        '400 cancellationReason:invalid_type,reason:unrecognized_keys',
        '404 3001',
      ])
    })

    it('cancels once when the customer cancels six times at the same moment', async () => {
      const created = await book()
      const { id } = created.body.data

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => cancel(id)),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(await historyOf(id)).toHaveLength(2)
      expect(await counted()).toMatchObject({ cancellationCount: 1 })
    })

    it('lets one of the customer who cancels and the salon that confirms come first, and the other meet what it made', async () => {
      const owner = await member('owner')
      const ids = []
      for (const time of ['10:00', '13:00', '15:00']) {
        ids.push((await book(wanting({ startTime: iso(time) }))).body.data.id)
      }

      const rounds = await Promise.all(
        ids.map((id) =>
          Promise.all([
            cancel(id),
            authorized(
              request(app).post(`${LEDGER}/${id}/confirm`),
              owner.authorization,
            ),
          ]),
        ),
      )

      for (const [index, [cancelled, confirmed]] of rounds.entries()) {
        // Confirmed and then cancelled, or cancelled and not confirmed.
        expect(cancelled?.status).toBe(200)
        expect(['200', '409 3003']).toContain(
          confirmed === undefined ? '' : statusAndCode(confirmed),
        )
        expect((await storedBooking(ids[index] ?? '')).status).toBe('cancelled')
      }
    })
  })

  describe('who has bookings of their own', () => {
    type Route = [string, (as: string | null) => Test]

    const routes = (id: string): Route[] => [
      ['list', (as) => list('', as)],
      ['create', (as) => book(wanting({ startTime: iso('13:00') }), as)],
      ['get', (as) => read(id, as)],
      ['cancel', (as) => cancel(id, { cancellationReason: null }, as)],
    ]

    it('answers a request without a token with 401, whatever it asks for', async () => {
      const id = await insertBooking(jst('10:00'))

      const responses = []
      for (const [, call] of routes(id)) {
        responses.push(await call(null))
      }

      for (const response of responses) {
        expectProblem(response, authenticationRequired)
      }
      expect((await storedBooking(id)).status).toBe('pending')
    })

    it.each<[string, () => Promise<string>]>([
      ['an administrator', async () => asAdmin],
      [
        'the owner of the salon',
        async () => (await member('owner')).authorization,
      ],
      [
        'a manager of the salon',
        async () => (await member('manager')).authorization,
      ],
      [
        'a staff member of the salon',
        async () => (await member('staff')).authorization,
      ],
    ])(
      'answers %s with 403, whatever they ask for: they keep the ledger',
      async (_case, signInAs) => {
        const id = await insertBooking(jst('10:00'))
        const authorization = await signInAs()

        const responses = []
        for (const [, call] of routes(id)) {
          responses.push(await call(authorization))
        }

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await db.$count(bookings)).toBe(1)
        expect((await storedBooking(id)).status).toBe('pending')
      },
    )

    it('answers a customer account without a profile with 404 that names the account, whatever it asks for', async () => {
      const id = await insertBooking(jst('10:00'))
      const account = await withoutProfile()

      const responses = []
      for (const [, call] of routes(id)) {
        responses.push(await call(account.authorization))
      }

      for (const response of responses) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Customer profile of user ${account.id} was not found`,
        )
      }
      expect(await db.$count(bookings)).toBe(1)
    })

    it('does not let a customer into the ledger with what they booked', async () => {
      const created = await book()
      const { id } = created.body.data

      const responses = [
        await authorized(request(app).get(LEDGER), asCustomer),
        await authorized(request(app).get(`${LEDGER}/${id}`), asCustomer),
        await authorized(
          request(app).post(`${LEDGER}/${id}/confirm`),
          asCustomer,
        ),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '403 1005',
        '403 1005',
        '403 1005',
      ])
      expect((await storedBooking(id)).status).toBe('pending')
    })
  })

  describe('what the contract does not have', () => {
    it.each<[string, (id: string) => Test]>([
      [
        'PATCH of a booking',
        (id) => request(app).patch(`${OWN_BOOKINGS}/${id}`),
      ],
      ['PUT of a booking', (id) => request(app).put(`${OWN_BOOKINGS}/${id}`)],
      [
        'DELETE of a booking',
        (id) => request(app).delete(`${OWN_BOOKINGS}/${id}`),
      ],
      [
        'the confirmation of a booking',
        (id) => request(app).post(`${OWN_BOOKINGS}/${id}/confirm`),
      ],
      [
        'the reschedule of a booking',
        (id) => request(app).post(`${OWN_BOOKINGS}/${id}/reschedule`),
      ],
      [
        'the service lines of a booking',
        (id) => request(app).get(`${OWN_BOOKINGS}/${id}/services`),
      ],
      ['DELETE of the list', () => request(app).delete(OWN_BOOKINGS)],
    ])('answers %s with 404', async (_case, call) => {
      const created = await book()
      const { id } = created.body.data

      const response = await authorized(call(id), asCustomer).send({})

      expectProblem(response, routeNotFound)
      expect((await storedBooking(id)).status).toBe('pending')
    })
  })

  describe('BookingRepository', () => {
    const repository = () => new BookingRepository(db)
    const origin = (bookingNumber: string) => ({
      bookingNumber,
      createdBy: userIdSchema.parse(customer.id),
      client: { ipAddress: '203.0.113.7', userAgent: 'SalonTest/1.0' },
    })
    const booker = (now: Date = new Date()) => ({
      customerId: customerIdSchema.parse(customerId),
      now,
    })
    /** A request as the use case hands it on: the cut at ten on the day. */
    const requestOf = (
      overrides: Partial<CustomerBookingCreateRequest> = {},
    ): CustomerBookingCreateRequest => ({
      salonId: salonIdSchema.parse(salonId),
      serviceId: serviceIdSchema.parse(cutId),
      staffId: staffIdSchema.parse(staffId),
      startTime: iso('10:00'),
      customerRequest: null,
      ...overrides,
    })

    describe('book', () => {
      it('writes the booking with the number it is given and returns the rows', async () => {
        const result = await repository().book(
          requestOf(),
          booker(),
          origin('BK-0000-0001'),
        )

        expect(result).toMatchObject({
          type: 'success',
          data: {
            type: 'created',
            booking: {
              booking: {
                bookingNumber: 'BK-0000-0001',
                customerId,
                source: 'online',
                ipAddress: '203.0.113.7',
                userAgent: 'SalonTest/1.0',
              },
              services: [{ serviceId: cutId, staffId }],
            },
          },
        })
        expect(await storedBookings()).toHaveLength(1)
      })

      it('writes nothing when another booking has the number, and says so', async () => {
        const other = await otherCustomer()
        await insertBooking(jst('15:00'), {
          bookingNumber: 'BK-0000-0001',
          customerId: other.customerId,
        })

        const result = await repository().book(
          requestOf(),
          booker(),
          origin('BK-0000-0001'),
        )

        expect(result).toEqual({
          type: 'success',
          data: { type: 'bookingNumberTaken' },
        })
        expect(await db.$count(bookings)).toBe(1)
        expect(await db.$count(bookingServices)).toBe(1)
        expect(await db.$count(bookingStatusHistories)).toBe(0)
      })

      it('decides by the moment it is given whether the slot is still to come', async () => {
        const afterIt = new Date(jst('10:00').getTime() + 1)

        const results = [
          await repository().book(
            requestOf(),
            booker(jst('10:00')),
            origin('BK-0000-0001'),
          ),
          await repository().book(
            requestOf(),
            booker(afterIt),
            origin('BK-0000-0002'),
          ),
          await repository().book(
            requestOf(),
            booker(new Date(jst('10:00').getTime() - 1)),
            origin('BK-0000-0003'),
          ),
        ]

        expect(
          results.map((result) =>
            result.type === 'success' ? result.data.type : result.error.type,
          ),
        ).toEqual(['notASlot', 'notASlot', 'created'])
      })

      it('resolves to what stands in the way, and writes nothing', async () => {
        await changeCustomer({ customerStatus: 'blacklisted' })

        const results = [
          await repository().book(
            requestOf({ salonId: salonIdSchema.parse(UNKNOWN_ID) }),
            booker(),
            origin('BK-0000-0001'),
          ),
          await repository().book(
            requestOf(),
            { ...booker(), customerId: customerIdSchema.parse(UNKNOWN_ID) },
            origin('BK-0000-0002'),
          ),
          await repository().book(
            requestOf(),
            booker(),
            origin('BK-0000-0003'),
          ),
        ]

        expect(results).toEqual([
          {
            type: 'success',
            data: {
              type: 'invalid',
              issues: [
                {
                  field: 'salonId',
                  rule: 'not_found',
                  message: 'Must name a salon',
                },
              ],
            },
          },
          { type: 'success', data: { type: 'profileNotFound' } },
          { type: 'success', data: { type: 'customerNotAccepted' } },
        ])
        await expectNothingStored()
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new BookingRepository(connection.database).book(
          requestOf(),
          booker(),
          origin('BK-0000-0001'),
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to book for customer' },
        })
      })
    })

    describe('the reach of a customer', () => {
      const reach = (): CustomerReach => ({
        type: 'customer',
        customerId: customerIdSchema.parse(customerId),
      })

      it('finds, lists and changes the bookings of that customer only', async () => {
        const other = await otherCustomer()
        const own = await insertBooking(jst('10:00'))
        const theirs = await insertBooking(jst('13:00'), {
          customerId: other.customerId,
        })
        const everything = {
          limit: 20,
          after: null,
          salonId: null,
          customerId: null,
          staffId: null,
          status: null,
          bookingDateFrom: null,
          bookingDateTo: null,
        }
        const theirId = bookingIdSchema.parse(theirs)

        const found = await repository().findById(theirId, reach())
        const listed = await repository().list({
          ...everything,
          reach: reach(),
        })
        const changed = await repository().changeStatus(
          theirId,
          reach(),
          { type: 'cancelAsCustomer', cancellationReason: null },
          userIdSchema.parse(customer.id),
        )

        expect(found).toEqual({ type: 'success', data: null })
        expect(listed).toMatchObject({
          type: 'success',
          data: { total: 1, bookings: [{ booking: { id: own } }] },
        })
        expect(changed).toEqual({ type: 'success', data: { type: 'notFound' } })
        expect((await storedBooking(theirs)).status).toBe('pending')
      })
    })
  })
})
