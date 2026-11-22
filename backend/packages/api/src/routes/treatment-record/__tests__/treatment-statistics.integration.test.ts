import {
  bookings,
  salons,
  serviceCategories,
  services,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import { eq, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Test } from 'supertest'
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
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  request,
} from '../../../__tests__/_shared/test-helpers'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID_STATISTICS = 'Invalid treatment statistics'

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** An ID that sorts by its last number. */
const idOf = (last: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-${String(last).padStart(12, '0')}`

/** The statistics of no records. */
const NOTHING = {
  totalTreatments: 0,
  treatmentsByCategory: [],
  averageProcessingTime: null,
  topServices: [],
}

describe('Treatment statistics API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests, its customer and a staff member. */
  let salonId: string
  let customerId: string
  let staffId: string

  type NewService = typeof services.$inferInsert
  type NewRecord = typeof treatmentRecords.$inferInsert
  type CategoryKind = typeof serviceCategories.$inferInsert.category

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A category of the salon of a kind; returns its ID. */
  const insertCategory = async (category: CategoryKind): Promise<string> => {
    const [row] = await db
      .insert(serviceCategories)
      .values({ salonId, name: `${category} ${nextRow()}`, category })
      .returning({ id: serviceCategories.id })
    if (row === undefined) {
      throw new Error('No category was inserted')
    }
    return row.id
  }

  /** A service of the salon; returns its ID. */
  const insertService = async (
    overrides: Partial<NewService> = {},
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId,
        name: `Service ${nextRow()}`,
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

  /** A booking in progress of a salon; returns its ID. */
  const insertBooking = async (
    ofSalon: string,
    ofStaff: string,
  ): Promise<string> => {
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-STAT-${nextRow()}`,
        salonId: ofSalon,
        customerId,
        staffId: ofStaff,
        bookingDate: '2026-11-20',
        startTime: '2026-11-20T01:00:00Z',
        endTime: '2026-11-20T02:00:00Z',
        duration: 60,
        subtotal: 6600,
        totalAmount: 6600,
        status: 'in_progress',
        actualStartTime: '2026-11-20T01:00:00Z',
      })
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    return booking.id
  }

  /** A record of a booking of the salon, of a salon given, or of the transaction given; returns its ID. */
  const insertRecord = async (
    overrides: Omit<Partial<NewRecord>, 'bookingId'> & {
      services: string[]
    },
    ofSalon: { salonId: string; staffId: string } = { salonId, staffId },
    executor: Pick<typeof db, 'insert'> = db,
  ): Promise<string> => {
    const bookingId = await insertBooking(ofSalon.salonId, ofSalon.staffId)
    const [record] = await executor
      .insert(treatmentRecords)
      .values({
        bookingId,
        customerId,
        staffId: ofSalon.staffId,
        ...overrides,
      })
      .returning({ id: treatmentRecords.id })
    if (record === undefined) {
      throw new Error('No treatment record was inserted')
    }
    return record.id
  }

  /** Another salon with a staff member of its own. */
  const anotherSalon = async (): Promise<{
    salonId: string
    staffId: string
  }> => {
    const other = await insertSalon(db)
    return { salonId: other, staffId: await insertStaff(db, other) }
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db)
    customerId = await insertCustomer(db)
    staffId = await insertStaff(db, salonId)
  })

  const PATH = '/api/v1/treatments/statistics'

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const statistics = (
    query: Record<string, unknown> = { salonId },
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(PATH).query(query), as)

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

  /** Everyone who reads the records of the salon of the tests. */
  const readers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  describe('GET /api/v1/treatments/statistics', () => {
    it.each(readers)(
      'counts the records of the salon by the kinds of their services and by their services, for %s',
      async (_who, signInAs) => {
        const authorization = await signInAs()
        const cutKind = await insertCategory('cut')
        const otherKind = await insertCategory('other')
        const cut = await insertService({ id: idOf(1), categoryId: cutKind })
        const fade = await insertService({
          id: idOf(2),
          categoryId: await insertCategory('cut'),
        })
        const colour = await insertService({
          id: idOf(3),
          categoryId: await insertCategory('color'),
          deletedAt: '2026-11-01T00:00:00.000Z',
        })
        const uncategorised = await insertService({ id: idOf(4) })
        const extra = await insertService({
          id: idOf(5),
          categoryId: otherKind,
        })
        // Two services of one kind count the record once for that kind.
        await insertRecord({ services: [cut, fade], processingTime: 61 })
        await insertRecord({ services: [colour, cut], processingTime: 90 })
        await insertRecord({ services: [uncategorised, extra] })
        await insertRecord({ services: [colour], processingTime: 45 })
        await insertRecord({ services: [uncategorised] })
        // A record written directly that names a service twice counts once
        // for it.
        await insertRecord({ services: [uncategorised, uncategorised] })
        // A record of another salon is not counted.
        await insertRecord({ services: [cut] }, await anotherSalon())

        const response = await statistics({ salonId }, authorization)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          totalTreatments: 6,
          treatmentsByCategory: [
            { category: 'other', count: 3 },
            { category: 'color', count: 2 },
            { category: 'cut', count: 2 },
          ],
          averageProcessingTime: 65.3,
          topServices: [
            { serviceId: uncategorised, count: 3 },
            { serviceId: cut, count: 2 },
            { serviceId: colour, count: 2 },
            { serviceId: fade, count: 1 },
            { serviceId: extra, count: 1 },
          ],
        })
        expect(response.body.meta).toMatchObject({ version: 'v1' })
        expect(response.body.links).toEqual({
          self: `${PATH}?salonId=${salonId}`,
        })
      },
    )

    it('answers the statistics of no records for a salon without any', async () => {
      await insertRecord(
        { services: [await insertService()] },
        await anotherSalon(),
      )

      const response = await statistics()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(NOTHING)
    })

    it('lists the ten services of the most records, those of the same count in the order of their IDs', async () => {
      const ids: string[] = []
      for (let last = 12; last >= 1; last -= 1) {
        ids.push(await insertService({ id: idOf(last) }))
      }
      await insertRecord({ services: ids })
      await insertRecord({ services: [idOf(12)] })

      const response = await statistics()

      expect(response.body.data.topServices).toEqual([
        { serviceId: idOf(12), count: 2 },
        ...Array.from({ length: 9 }, (_, index) => ({
          serviceId: idOf(index + 1),
          count: 1,
        })),
      ])
      expect(response.body.data.treatmentsByCategory).toEqual([
        { category: 'other', count: 2 },
      ])
    })

    it('counts the records written in the period, to the millisecond, both ends included', async () => {
      const service = await insertService()
      const write = (createdAt: string) =>
        insertRecord({ services: [service], createdAt, processingTime: 10 })
      await write('2026-11-09T23:59:59.999900Z')
      await write('2026-11-10T00:00:00.000400Z')
      await write('2026-11-10T00:00:00.001000Z')
      const moment = '2026-11-10T00:00:00.000Z'
      const counted = async (query: Record<string, string>) =>
        (await statistics({ salonId, ...query })).body.data.totalTreatments

      expect(await counted({ startDate: moment, endDate: moment })).toBe(1)
      expect(await counted({ startDate: moment })).toBe(2)
      expect(await counted({ endDate: moment })).toBe(2)
      expect(await counted({})).toBe(3)
      expect(
        await counted({
          startDate: '2026-11-10T00:00:00.002Z',
          endDate: '2026-11-30T00:00:00Z',
        }),
      ).toBe(0)
    })

    it('counts the records of another salon for an administrator, and links under the path and the query as they were written', async () => {
      const elsewhere = await anotherSalon()
      await insertRecord({ services: [await insertService()] }, elsewhere)
      const path = `/API/V1/TREATMENTS/STATISTICS?salonId=${elsewhere.salonId.toUpperCase()}&endDate=2999-12-31T00:00:00Z`

      const response = await request(app)
        .get(path)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.totalTreatments).toBe(1)
      expect(response.body.links).toEqual({ self: path })
    })

    it.each<[string, () => Promise<string>]>([
      ['that is not there', async () => idOf(999)],
      [
        'that was deleted',
        async () => {
          const gone = await anotherSalon()
          await insertRecord({ services: [await insertService()] }, gone)
          await db
            .update(salons)
            .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
            .where(eq(salons.id, gone.salonId))
          return gone.salonId
        },
      ],
    ])('refuses a salon %s as the salon named', async (_case, salonOf) => {
      const response = await statistics({ salonId: await salonOf() })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_STATISTICS)
      expect(response.body.errors).toEqual([
        issue('salonId', 'not_found', 'Must name a salon'),
      ])
    })

    it.each<[string, string, string[]]>([
      ['no salon', '', ['salonId']],
      ['a salon that is no UUID', 'salonId=salon-1', ['salonId']],
      ['two salons', `salonId=${idOf(1)}&salonId=${idOf(2)}`, ['salonId']],
      ['a moment that is no moment', 'startDate=yesterday', ['startDate']],
      [
        'an end before the start',
        'startDate=2026-11-02T00:00:00Z&endDate=2026-11-01T23:59:59.999Z',
        ['endDate'],
      ],
      [
        'a parameter the statistics do not have',
        'staffId=staff-1',
        ['staffId'],
      ],
    ])('refuses %s', async (_case, extra, fields) => {
      const named = extra.startsWith('salonId') || extra === ''
      const query = named ? extra : `salonId=${salonId}&${extra}`

      const response = await request(app)
        .get(query === '' ? PATH : `${PATH}?${query}`)
        .set('Authorization', asAdmin)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_STATISTICS)
      expect(
        response.body.errors.map(({ field }: { field: string }) => field),
      ).toEqual(fields)
    })
  })

  describe('who may', () => {
    it.each<[string, SignInAs]>([
      ['the owner of another salon', member('owner', () => insertSalon(db))],
      [
        'a staff member of another salon',
        member('staff', () => insertSalon(db)),
      ],
    ])(
      'refuses %s who names the salon, and tells a query that breaks a rule first',
      async (_who, signInAs) => {
        const authorization = await signInAs()

        expectProblem(await statistics({ salonId }, authorization), forbidden)
        expectProblem(
          await statistics({ salonId, startDate: 'yesterday' }, authorization),
          badRequest,
        )
      },
    )

    it.each<[string, SignInAs]>([
      [
        'a customer with a profile',
        async () => (await signedInUser(app, db, { customerId })).authorization,
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
    ])(
      'refuses %s, even a query that breaks a rule',
      async (_who, signInAs) => {
        const authorization = await signInAs()

        expectProblem(await statistics({ salonId }, authorization), forbidden)
        expectProblem(
          await statistics({ salonId: 'salon-1' }, authorization),
          forbidden,
        )
      },
    )

    it.each<[string, () => Promise<string | null>, ExpectedProblem, string]>([
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
    ])('refuses %s with 401', async (_case, tokenOf, problem, challenge) => {
      const response = await statistics({ salonId }, await tokenOf())

      expectProblem(response, problem)
      expect(response.headers['www-authenticate']).toBe(challenge)
    })
  })

  describe('requests at the same moment', () => {
    it('counts the records at one moment, though one is written while it counts', async () => {
      const service = await insertService({
        categoryId: await insertCategory('cut'),
      })
      await insertRecord({ services: [service], processingTime: 30 })
      /** Whether the count came to wait for the table of the categories. */
      const waitedFor = async (): Promise<boolean> => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const [locks] = await db.execute(
            sql`SELECT count(*)::int AS "waiting" FROM pg_locks WHERE NOT granted AND relation = 'service_categories'::regclass`,
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
          sql`LOCK TABLE ${serviceCategories} IN ACCESS EXCLUSIVE MODE`,
        )
        const underWay = statistics().then((response) => response)
        // The count has counted the records and waits to count them by
        // their kinds; one is written meanwhile.
        const blocked = await waitedFor()
        await insertRecord(
          { services: [service], processingTime: 60 },
          { salonId, staffId },
          tx,
        )
        return { pending: underWay, waited: blocked }
      })
      const response = await pending

      expect(waited).toBe(true)
      expect(response.body.data).toEqual({
        totalTreatments: 1,
        treatmentsByCategory: [{ category: 'cut', count: 1 }],
        averageProcessingTime: 30,
        topServices: [{ serviceId: service, count: 1 }],
      })
      expect((await statistics()).body.data.totalTreatments).toBe(2)
    })
  })
})
