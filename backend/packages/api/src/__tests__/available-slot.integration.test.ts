import {
  bookingServices,
  bookings,
  openingHours,
  salons,
  services,
  staff,
  staffSchedules,
} from '@beauty-salon-backend/database'
import {
  salonIdSchema,
  serviceIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { AvailableSlotRepository } from '@beauty-salon-backend/infrastructure'
import { eq } from 'drizzle-orm'
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
} from './_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from './_shared/test-helpers'

const SALONS = '/api/v1/salons'

/** Where the available slots of a salon are. */
const slotsOf = (salonId: string): string =>
  `${SALONS}/${salonId}/available-slots`

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
const databaseProblem = { status: 500, code: '4003', type: 'database' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID_SEARCH = 'Invalid available slot search'
const INVALID_CHECK = 'Invalid available slot check'
const TIME_ZONE_UNKNOWN =
  'The time zone of the salon is not one that is known, so the times of its hours cannot be told; correct the time zone of the salon first'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY_LENGTH = 24 * HOUR

type NewOpeningHours = typeof openingHours.$inferInsert
type NewSchedule = typeof staffSchedules.$inferInsert
type NewSalon = typeof salons.$inferInsert
type NewStaff = typeof staff.$inferInsert
type NewService = typeof services.$inferInsert
type NewBooking = typeof bookings.$inferInsert
type DayOfWeek = NewOpeningHours['dayOfWeek']

/** The days of the week in the order `getUTCDay` counts them. */
const DAYS: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

/** The day of the week of a date (`YYYY-MM-DD`). */
const dayOfWeekOf = (date: string): DayOfWeek =>
  DAYS.at(new Date(`${date}T00:00:00Z`).getUTCDay()) ?? 'sunday'

/** The date the clocks of Tokyo show at a moment (`YYYY-MM-DD`). */
const dateInTokyo = (moment: Date): string =>
  new Date(moment.getTime() + 9 * HOUR).toISOString().slice(0, 10)

/** The date in Tokyo so many days from today; before today when negative. */
const dateIn = (days: number): string =>
  dateInTokyo(new Date(Date.now() + days * DAY_LENGTH))

/** The date so many days after another. */
const daysAfter = (date: string, days: number): string =>
  new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_LENGTH)
    .toISOString()
    .slice(0, 10)

/** The first date, a week from today or later, that is on a day of the week. */
const nextOn = (dayOfWeek: DayOfWeek): string => {
  const candidates = Array.from({ length: 7 }, (_, days) => dateIn(7 + days))
  return candidates.find((date) => dayOfWeekOf(date) === dayOfWeek) ?? ''
}

/**
 * The day most tests are about: a month from now, so that every slot of it
 * is still to come whenever the tests run.
 */
const DAY = dateIn(30)

/** The moment at which the clocks of Tokyo show a time (HH:mm) on a date. */
const jst = (time: string, date: string = DAY): Date =>
  new Date(`${date}T${time}:00+09:00`)

/** That moment as the API writes it. */
const iso = (time: string, date: string = DAY): string =>
  jst(time, date).toISOString()

/** The time the clocks of Tokyo show at a moment written in UTC (HH:mm). */
const inTokyo = (moment: string): string =>
  new Date(new Date(moment).getTime() + 9 * HOUR).toISOString().slice(11, 16)

/** The weekly hours of the day of the week of a date: open from 10:00 to 19:00. */
const weeklyHours = (
  date: string = DAY,
  overrides: Record<string, unknown> = {},
) => ({
  dayOfWeek: dayOfWeekOf(date),
  operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
  breakSlots: null,
  isClosed: false,
  effectivePeriod: null,
  ...overrides,
})

/**
 * When the staff member of the tests can begin the cut of an hour on the
 * day: the salon is open from 10:00 to 19:00, and they work from 09:00 to
 * 18:00 with a break from 12:00 to 13:00.
 */
const STARTS = [
  ...['10:00', '10:30', '11:00'],
  ...['13:00', '13:30', '14:00', '14:30', '15:00'],
  ...['15:30', '16:00', '16:30', '17:00'],
]

const NEW_YORK = 'America/New_York'

/** How many hours the clocks of New York are behind UTC at noon in UTC of a date. */
const hoursBehindOn = (date: string): number =>
  12 -
  Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: NEW_YORK,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date(`${date}T12:00:00Z`)),
  )

/**
 * The next nights on which the clocks of New York are put forward and put
 * back, told from what the runtime knows of the time zone. Each comes with
 * the hours the clocks are behind UTC before and after the change.
 */
const clockChanges = () => {
  const dates = Array.from({ length: 400 }, (_, days) => dateIn(2 + days))
  const changes = dates.flatMap((date) => {
    const before = hoursBehindOn(daysAfter(date, -1))
    const after = hoursBehindOn(date)
    return before === after ? [] : [{ date, before, after }]
  })
  const forward = changes.find(({ before, after }) => after < before)
  const back = changes.find(({ before, after }) => after > before)
  if (forward === undefined || back === undefined) {
    throw new Error('The clocks of New York do not change within 400 days')
  }
  return { forward, back }
}

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'aoyama'],
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

/** The status and the code of a problem. */
const statusAndCode = (response: Response): string =>
  `${response.status} ${response.body.code}`

/**
 * A response in a few words: its status and, for a validation problem, the
 * broken rules, or else the code of the problem.
 */
const outcomeOf = (response: Response): string =>
  response.status === 400 && response.body.code === '2001'
    ? `400 ${brokenRules(response).join(',')}`
    : response.status === 200
      ? '200'
      : statusAndCode(response)

/** When the slots of a response begin, as the clocks of Tokyo show it. */
const startsOf = (response: Response): string[] =>
  response.body.data.map(({ startTime }: { startTime: string }) =>
    inTokyo(startTime),
  )

describe('Available slot API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The Authorization header of a signed-in customer with a profile. */
  let asCustomer: string
  let salonId: string
  let customerId: string
  /** A staff member who works on the day of the tests. */
  let staffId: string
  /** A cut of an hour. */
  let cutId: string

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(db, {
      timezone: 'Asia/Tokyo',
      businessHours: [weeklyHours()],
      ...overrides,
    })

  /** A staff member of a salon who takes one booking at a time and keeps no time free, unless stated otherwise. */
  const staffMember = (
    overrides: Partial<NewStaff> = {},
    of: string = salonId,
  ): Promise<string> =>
    insertStaff(db, of, {
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      ...overrides,
    })

  /** A service of a salon as a row; returns its ID. */
  const insertService = async (
    overrides: Partial<NewService> = {},
    of: string = salonId,
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId: of,
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

  /**
   * A row of the schedule of a staff member for a date: from 09:00 to
   * 18:00 with a break from 12:00 to 13:00 unless stated otherwise.
   */
  const works = async (
    date: string = DAY,
    by: string = staffId,
    overrides: Partial<NewSchedule> = {},
  ): Promise<void> => {
    await db.insert(staffSchedules).values({
      staffId: by,
      date,
      dayOfWeek: null,
      isRecurring: false,
      isAvailable: true,
      startTime: '09:00',
      endTime: '18:00',
      breakStartTime: '12:00',
      breakEndTime: '13:00',
      ...overrides,
    })
  }

  /** A day off of a staff member on a date. */
  const isOff = (date: string = DAY, by: string = staffId): Promise<void> =>
    works(date, by, {
      isAvailable: false,
      startTime: null,
      endTime: null,
      breakStartTime: null,
      breakEndTime: null,
    })

  /** A row of the calendar of a salon for a date: open from 10:00 to 19:00 unless stated otherwise. */
  const opens = async (
    date: string = DAY,
    overrides: Partial<NewOpeningHours> = {},
    of: string = salonId,
  ): Promise<void> => {
    await db.insert(openingHours).values({
      salonId: of,
      dayOfWeek: dayOfWeekOf(date),
      date,
      openTime: '10:00',
      closeTime: '19:00',
      ...overrides,
    })
  }

  /** A date on which the salon is open and the staff member works from 00:00 to 23:59. */
  const allDay = async (date: string, by: string = staffId): Promise<void> => {
    await opens(date, { openTime: '00:00', closeTime: '23:59' })
    await works(date, by, {
      startTime: '00:00',
      endTime: '23:59',
      breakStartTime: null,
      breakEndTime: null,
    })
  }

  let rows = 0

  /**
   * Writes a booking with one service line directly: of the cut, by the
   * staff member of the tests, pending and an hour long unless stated
   * otherwise. `lineBy` is the staff member of the line, which is nobody
   * when null. Returns the ID of the booking.
   */
  const insertBooking = async (
    from: Date,
    {
      by = staffId,
      lineBy = by,
      minutes = 60,
      service = cutId,
      of = salonId,
      ...columns
    }: Partial<NewBooking> & {
      by?: string
      lineBy?: string | null
      minutes?: number
      service?: string
      of?: string
    } = {},
  ): Promise<string> => {
    rows += 1
    const times = {
      startTime: from.toISOString(),
      endTime: new Date(from.getTime() + minutes * MINUTE).toISOString(),
      duration: minutes,
    }
    const [row] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-SLOTS-${String(rows).padStart(4, '0')}`,
        salonId: of,
        customerId,
        staffId: by,
        bookingDate: dateInTokyo(from),
        status: 'pending',
        subtotal: 6600,
        totalAmount: 6600,
        ...times,
        ...columns,
      })
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    await db.insert(bookingServices).values({
      bookingId: row.id,
      serviceId: service,
      staffId: lineBy,
      price: 6600,
      finalPrice: 6600,
      taxIncluded: true,
      ...times,
    })
    return row.id
  }

  /** What a booking in a status has to have beside it. */
  const inStatus = (status: NewBooking['status']): Partial<NewBooking> => ({
    status,
    ...(status === 'cancelled'
      ? { cancelledAt: new Date().toISOString() }
      : {}),
    ...(status === 'completed'
      ? { completedAt: new Date().toISOString() }
      : {}),
    ...(status === 'in_progress'
      ? { actualStartTime: new Date().toISOString() }
      : {}),
  })

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    customerId = await insertCustomer(db)
    asCustomer = (await signedInUser(app, db, { customerId })).authorization
    salonId = await salon()
    staffId = await staffMember()
    await works()
    cutId = await insertService()
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** The query of a search for the slots of the cut on the day, with more. */
  const searching = (more: Record<string, string> = {}): string =>
    new URLSearchParams({ serviceId: cutId, date: DAY, ...more }).toString()

  /** Lists slots; as the customer and in the salon of the tests unless stated otherwise. */
  const list = (
    query: string = searching(),
    as: string | null = asCustomer,
    of: string = salonId,
  ) =>
    authorized(
      request(app).get(query === '' ? slotsOf(of) : `${slotsOf(of)}?${query}`),
      as,
    )

  /** A question about the staff member and the cut at ten on the day, with more. */
  const asking = (more: Record<string, unknown> = {}) => ({
    staffId,
    serviceId: cutId,
    startTime: iso('10:00'),
    ...more,
  })

  /** Asks whether a time is free; as the admin and in the salon of the tests unless stated otherwise. */
  const check = (
    body: unknown = asking(),
    as: string | null = asAdmin,
    of: string = salonId,
  ) =>
    authorized(request(app).post(`${slotsOf(of)}/check`), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))

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

  /** Everyone who keeps the ledger of the salon of the tests. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Accounts the ledger of the salon of the tests is closed to. */
  const notKeepers: [string, SignInAs][] = [
    ['a customer with a profile', async () => asCustomer],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
    ['the owner of another salon', member('owner', () => salon())],
    ['a manager of another salon', member('manager', () => salon())],
    ['a staff member of another salon', member('staff', () => salon())],
    [
      'an account of the salon whose staff record is deleted',
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
      'an access token of an admin that has run out',
      async () =>
        (
          await insertSession(
            db,
            (
              await insertUser(db, { role: 'admin' })
            ).id,
            { expiresAt: minutesFromNow(-1) },
          )
        ).authorization,
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  /** Hides a salon as `DELETE /api/v1/salons/:id` does; its rows stay. */
  const deleteSalon = async (id: string): Promise<void> => {
    await db
      .update(salons)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(salons.id, id))
  }

  const deleteStaff = async (id: string): Promise<void> => {
    await db
      .update(staff)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(staff.id, id))
  }

  const deleteService = async (id: string): Promise<void> => {
    await db
      .update(services)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(services.id, id))
  }

  describe('GET /api/v1/salons/:salonId/available-slots', () => {
    it('returns the times at which the staff member can begin the service on the date, with a page and its links', async () => {
      const response = await list()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: STARTS.map((start) => ({
          staffId,
          startTime: iso(start),
          endTime: new Date(jst(start).getTime() + HOUR).toISOString(),
        })),
        meta: {
          total: 12,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: `${slotsOf(salonId)}?${searching()}`,
          first: `${slotsOf(salonId)}?${searching()}`,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('returns a slot with its three properties and nothing of the bookings around it', async () => {
      await insertBooking(jst('14:00'))

      const response = await list()

      expect(response.body.data).toHaveLength(9)
      expect(
        response.body.data.map((slot: Record<string, unknown>) =>
          Object.keys(slot),
        ),
      ).toEqual(
        Array.from({ length: 9 }, () => ['staffId', 'startTime', 'endTime']),
      )
    })

    describe('who may read', () => {
      it.each([...keepers, ...notKeepers])(
        'lets %s read the slots',
        async (_who, signInAs) => {
          const response = await list(searching(), await signInAs())

          expect(response.status).toBe(200)
          expect(startsOf(response)).toEqual(STARTS)
        },
      )

      it.each(unauthenticated)(
        'refuses %s',
        async (_case, token, problem, challenge) => {
          const response = await list(searching(), await token())

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        },
      )

      it('refuses a request without a token before it looks at the path or the query', async () => {
        const response = await list('limit=0', null, 'aoyama')

        expectProblem(response, authenticationRequired)
      })
    })

    describe('the staff of the salon', () => {
      /** A second staff member, who works from 10:30 to 12:30 on the day. */
      const second = async (overrides: Partial<NewStaff> = {}) => {
        const id = await staffMember(overrides)
        await works(DAY, id, {
          startTime: '10:30',
          endTime: '12:30',
          breakStartTime: null,
          breakEndTime: null,
        })
        return id
      }

      it('lists the slots of every staff member by when they begin and then by the ID of the staff member', async () => {
        const other = await second()
        const [first, last] = [staffId, other].toSorted()

        const response = await list()

        expect(
          response.body.data
            .slice(0, 6)
            .map(
              ({ staffId: by, startTime }: Record<string, string>) =>
                `${inTokyo(startTime ?? '')} ${by}`,
            ),
        ).toEqual([
          `10:00 ${staffId}`,
          `10:30 ${first}`,
          `10:30 ${last}`,
          `11:00 ${first}`,
          `11:00 ${last}`,
          `11:30 ${other}`,
        ])
        expect(response.body.meta.total).toBe(15)
      })

      it('lists the slots of the one staff member the search names', async () => {
        const other = await second()

        const response = await list(searching({ staffId: other }))

        expect(response.body.data).toEqual(
          ['10:30', '11:00', '11:30'].map((start) => ({
            staffId: other,
            startTime: iso(start),
            endTime: new Date(jst(start).getTime() + HOUR).toISOString(),
          })),
        )
        expect(response.body.meta.total).toBe(3)
      })

      it('finds the staff member, the service and the salon by IDs in capitals', async () => {
        const response = await list(
          searching({
            staffId: staffId.toUpperCase(),
            serviceId: cutId.toUpperCase(),
          }),
          asCustomer,
          salonId.toUpperCase(),
        )

        expect(response.status).toBe(200)
        expect(startsOf(response)).toEqual(STARTS)
      })

      it.each<[string, Partial<NewStaff>]>([
        ['is not active', { isActive: false }],
        ['does not take bookings', { canReceiveBookings: false }],
        ['is deleted', { deletedAt: '2026-11-01T00:00:00.000Z' }],
      ])(
        'has no slot for a staff member who %s, and the slots of the others',
        async (_what, overrides) => {
          const other = await second(overrides)

          const response = await list()

          expect(startsOf(response)).toEqual(STARTS)
          expect(
            response.body.data.filter(
              ({ staffId: by }: { staffId: string }) => by === other,
            ),
          ).toEqual([])
        },
      )

      it('returns an empty page, and no error, for a staff member the search names who does not take bookings', async () => {
        const other = await second({ canReceiveBookings: false })

        const response = await list(searching({ staffId: other }))

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
        expect(response.body.meta.total).toBe(0)
      })

      it('has no slot for a staff member of a level below the one the service asks for', async () => {
        const junior = await second({ level: 'junior' })
        const senior = await second({ level: 'senior' })
        const perm = await insertService({
          name: 'Digital perm',
          requiredStaffLevel: 'senior',
        })
        await db
          .update(staff)
          .set({ level: 'director' })
          .where(eq(staff.id, staffId))

        const response = await list(
          searching({ serviceId: perm, limit: '100' }),
        )

        const byStaff = new Set(
          response.body.data.map(({ staffId: by }: { staffId: string }) => by),
        )
        expect(byStaff.has(junior)).toBe(false)
        expect([...byStaff].toSorted()).toEqual([staffId, senior].toSorted())
      })

      it('has no slot in a salon without staff', async () => {
        const empty = await salon()
        const service = await insertService({}, empty)

        const response = await list(
          searching({ serviceId: service }),
          asCustomer,
          empty,
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
      })
    })

    describe('the length of the treatment', () => {
      it('is the duration of the service', async () => {
        const color = await insertService({ name: 'Colour', duration: 120 })

        const response = await list(searching({ serviceId: color }))

        expect(startsOf(response)).toEqual([
          ...['10:00', '13:00', '13:30', '14:00'],
          ...['14:30', '15:00', '15:30', '16:00'],
        ])
        expect(response.body.data.at(0)).toEqual({
          staffId,
          startTime: iso('10:00'),
          endTime: iso('12:00'),
        })
      })

      it('is the duration the search names, whatever the service takes', async () => {
        const response = await list(searching({ duration: '300' }))

        expect(response.body.data).toEqual([
          { staffId, startTime: iso('13:00'), endTime: iso('18:00') },
        ])
      })

      it('leaves no slot for a treatment longer than every stretch of the day', async () => {
        const response = await list(searching({ duration: '301' }))

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
      })
    })

    describe('the hours of the salon', () => {
      it('has no slot in a salon that has said no hours', async () => {
        const silent = await salon({ businessHours: null })
        const by = await staffMember({}, silent)
        await works(DAY, by)
        const service = await insertService({}, silent)

        const response = await list(
          searching({ serviceId: service }),
          asCustomer,
          silent,
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
      })

      /** A salon with these weekly hours, in which a staff member works on the day; lists the slots of a cut. */
      const withHours = async (businessHours: unknown, date: string = DAY) => {
        const of = await salon({ businessHours })
        const by = await staffMember({}, of)
        await works(date, by)
        const service = await insertService({}, of)

        return list(searching({ serviceId: service, date }), asCustomer, of)
      }

      it('has no slot on a day of the week the weekly hours have no entry for', async () => {
        const response = await withHours([weeklyHours(daysAfter(DAY, 1))])

        expect(response.body.data).toEqual([])
      })

      it('has no slot on a day of the week the salon is closed', async () => {
        const response = await withHours([
          weeklyHours(DAY, { isClosed: true, operatingSlots: [] }),
        ])

        expect(response.body.data).toEqual([])
      })

      it('has slots within each operating slot of the day, and none during its breaks', async () => {
        const response = await withHours([
          weeklyHours(daysAfter(DAY, 1)),
          weeklyHours(DAY, {
            operatingSlots: [
              { startTime: '14:00', endTime: '20:00' },
              { startTime: '08:00', endTime: '11:30' },
            ],
            breakSlots: [{ startTime: '15:00', endTime: '16:30' }],
          }),
        ])

        expect(startsOf(response)).toEqual([
          ...['09:00', '09:30', '10:00', '10:30'],
          ...['14:00', '16:30', '17:00'],
        ])
      })

      it('has slots on a date within the period the weekly hours are for, and none outside of it', async () => {
        const hours = [
          weeklyHours(DAY, {
            effectivePeriod: {
              startDate: `${daysAfter(DAY, -3)}T00:00:00Z`,
              endDate: `${daysAfter(DAY, 3)}T00:00:00Z`,
            },
          }),
        ]

        const within = await withHours(hours)
        const after = await withHours(hours, daysAfter(DAY, 7))

        expect(startsOf(within)).toEqual(STARTS)
        expect(after.body.data).toEqual([])
      })

      it('is open at the times of the row of the calendar for the date, whatever the weekly hours say', async () => {
        await opens(DAY, { openTime: '11:00', closeTime: '16:00' })

        const response = await list()

        expect(startsOf(response)).toEqual([
          ...['11:00', '13:00', '13:30'],
          ...['14:00', '14:30', '15:00'],
        ])
      })

      it('is closed on a date whose row of the calendar has no times', async () => {
        await opens(DAY, {
          openTime: null,
          closeTime: null,
          isHoliday: true,
          holidayName: '臨時休業',
        })

        const response = await list()

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
      })

      it('is open on a holiday whose row of the calendar has times', async () => {
        await opens(DAY, {
          openTime: '13:00',
          closeTime: '15:00',
          isHoliday: true,
          holidayName: '祝日',
        })

        const response = await list()

        expect(startsOf(response)).toEqual(['13:00', '13:30', '14:00'])
      })

      it('reads the row of the calendar of the date and of the salon, not another', async () => {
        const other = await salon()
        await opens(DAY, { openTime: null, closeTime: null }, other)
        await opens(daysAfter(DAY, 1), { openTime: null, closeTime: null })
        await opens(daysAfter(DAY, -1), { openTime: null, closeTime: null })

        const response = await list()

        expect(startsOf(response)).toEqual(STARTS)
      })

      it('is open on a day of the week the weekly hours close, when the calendar has a row with times for the date', async () => {
        const of = await salon({
          businessHours: [
            weeklyHours(DAY, { isClosed: true, operatingSlots: [] }),
          ],
        })
        const by = await staffMember({}, of)
        await works(DAY, by)
        const service = await insertService({}, of)
        await opens(DAY, {}, of)

        const response = await list(
          searching({ serviceId: service }),
          asCustomer,
          of,
        )

        expect(startsOf(response)).toEqual(STARTS)
      })
    })

    describe('the schedule of the staff member', () => {
      it('has no slot for a staff member without a row for the day', async () => {
        const response = await list(searching({ date: daysAfter(DAY, 1) }))

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
      })

      it('has the slots of the weekly row of the day of the week of the date', async () => {
        const nextWeek = daysAfter(DAY, 7)
        await db.insert(staffSchedules).values({
          staffId,
          dayOfWeek: dayOfWeekOf(DAY),
          isRecurring: true,
          startTime: '15:00',
          endTime: '21:00',
        })

        const response = await list(searching({ date: nextWeek }))

        expect(startsOf(response)).toEqual([
          ...['15:00', '15:30', '16:00', '16:30'],
          ...['17:00', '17:30', '18:00'],
        ])
        expect(response.body.data.at(0).startTime).toBe(iso('15:00', nextWeek))
      })

      it('reads the row of the date before the weekly row of its day of the week', async () => {
        await db.insert(staffSchedules).values({
          staffId,
          dayOfWeek: dayOfWeekOf(DAY),
          isRecurring: true,
          startTime: '15:00',
          endTime: '21:00',
        })

        const response = await list()

        expect(startsOf(response)).toEqual(STARTS)
      })

      it('has no slot on a date that is a day off, although the staff member works on that day of the week', async () => {
        const nextWeek = daysAfter(DAY, 7)
        await db.insert(staffSchedules).values({
          staffId,
          dayOfWeek: dayOfWeekOf(DAY),
          isRecurring: true,
          startTime: '15:00',
          endTime: '21:00',
        })
        await isOff(nextWeek)

        const response = await list(searching({ date: nextWeek }))

        expect(response.body.data).toEqual([])
      })

      it('does not read the rows of other dates or of other staff members', async () => {
        const other = await staffMember()
        await isOff(DAY, other)
        await isOff(daysAfter(DAY, 1))
        await isOff(daysAfter(DAY, -1))

        const response = await list()

        expect(startsOf(response)).toEqual(STARTS)
      })
    })

    describe('what the salon and the service take', () => {
      it('has no slot in a salon that is not active', async () => {
        await db
          .update(salons)
          .set({ isActive: false })
          .where(eq(salons.id, salonId))

        const response = await list()

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
        expect(response.body.meta.total).toBe(0)
      })

      it.each<[string, Partial<NewService>]>([
        ['is not active', { isActive: false }],
        ['is inactive by its status', { serviceStatus: 'inactive' }],
        ['is still to come', { serviceStatus: 'coming_soon' }],
        ['is discontinued', { serviceStatus: 'discontinued' }],
        ['is not booked online', { allowOnlineBooking: false }],
      ])('has no slot for a service that %s', async (_what, overrides) => {
        const service = await insertService(overrides)

        const response = await list(searching({ serviceId: service }))

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
      })

      it.each<[string, Partial<NewService>]>([
        ['is by appointment only', { availability: 'by_appointment_only' }],
        ['is seasonal', { availability: 'seasonal' }],
        ['needs a consultation', { requiresConsultation: true }],
        [
          'has requirements the server cannot check',
          {
            bookingRequirements: [
              'consultation_required',
              'patch_test_required',
              'deposit_required',
            ],
          },
        ],
      ])('has the slots of a service that %s', async (_what, overrides) => {
        const service = await insertService(overrides)

        const response = await list(searching({ serviceId: service }))

        expect(startsOf(response)).toEqual(STARTS)
      })

      describe('a service of some days of the week', () => {
        const saturday = nextOn('saturday')
        const sunday = nextOn('sunday')
        const monday = nextOn('monday')
        const friday = nextOn('friday')

        /** How many slots a service of an availability has on each of the four days. */
        const slotsOn = async (availability: NewService['availability']) => {
          const service = await insertService({ availability })
          const counts: number[] = []
          for (const date of [friday, saturday, sunday, monday]) {
            await opens(date)
            await works(date)
            const response = await list(searching({ serviceId: service, date }))
            counts.push(response.body.meta.total)
          }
          return counts
        }

        it('has slots from Monday to Friday for a service of weekdays only', async () => {
          expect(await slotsOn('weekdays_only')).toEqual([12, 0, 0, 12])
        })

        it('has slots on Saturday and Sunday for a service of weekends only', async () => {
          expect(await slotsOn('weekends_only')).toEqual([0, 12, 12, 0])
        })

        it('has slots on every day for a service that is always offered', async () => {
          expect(await slotsOn('always')).toEqual([12, 12, 12, 12])
        })
      })

      describe('a service that is booked so many times a day at most', () => {
        let limited: string

        beforeEach(async () => {
          limited = await insertService({
            name: 'Head spa',
            maxBookingsPerDay: 2,
          })
        })

        const slots = async (): Promise<number> =>
          (await list(searching({ serviceId: limited }))).body.meta.total

        it('has slots while fewer bookings of the service begin on the date', async () => {
          const other = await staffMember()
          await insertBooking(jst('20:00'), { by: other, service: limited })

          expect(await slots()).toBe(12)
        })

        it('has no slot once as many begin on the date, whoever they are with', async () => {
          const other = await staffMember()
          await insertBooking(jst('20:00'), { by: other, service: limited })
          await insertBooking(jst('21:00'), {
            by: other,
            lineBy: null,
            service: limited,
          })

          expect(await slots()).toBe(0)
        })

        it.each<[string, NewBooking['status'], number]>([
          ['a draft', 'draft', 0],
          ['a pending booking', 'pending', 0],
          ['a confirmed booking', 'confirmed', 0],
          ['a booking in progress', 'in_progress', 0],
          ['a completed booking', 'completed', 0],
          ['a cancelled booking', 'cancelled', 12],
          ['a booking the customer did not come to', 'no_show', 12],
        ])('counts %s accordingly', async (_what, status, left) => {
          const other = await staffMember()
          await insertBooking(jst('20:00'), { by: other, service: limited })
          await insertBooking(jst('21:00'), {
            by: other,
            service: limited,
            ...inStatus(status),
          })

          expect(await slots()).toBe(left)
        })

        it('counts the lines that begin on the date as the clocks of the salon show it', async () => {
          const other = await staffMember()
          // The first moment of the day in Tokyo is 15:00 of the day before in UTC.
          await insertBooking(jst('00:00'), { by: other, service: limited })
          await insertBooking(jst('23:59'), {
            by: other,
            service: limited,
            minutes: 1,
          })

          expect(await slots()).toBe(0)
        })

        it('does not count the lines of the days before and after, of other services or of other salons', async () => {
          const other = await staffMember()
          const elsewhere = await salon()
          const there = await staffMember({}, elsewhere)
          await insertBooking(jst('23:00', daysAfter(DAY, -1)), {
            by: other,
            service: limited,
          })
          await insertBooking(jst('00:00', daysAfter(DAY, 1)), {
            by: other,
            service: limited,
          })
          await insertBooking(jst('20:00'), { by: other })
          await insertBooking(jst('20:00'), { by: other })
          await insertBooking(jst('10:00'), {
            by: there,
            of: elsewhere,
            service: await insertService({ maxBookingsPerDay: 2 }, elsewhere),
          })
          await insertBooking(jst('21:00'), { by: other, service: limited })

          expect(await slots()).toBe(12)
        })
      })
    })

    describe('the bookings of the staff member', () => {
      it('has no slot during which another booking occupies the staff member', async () => {
        await insertBooking(jst('14:00'))

        const response = await list()

        expect(startsOf(response)).toEqual([
          ...['10:00', '10:30', '11:00', '13:00'],
          ...['15:00', '15:30', '16:00', '16:30', '17:00'],
        ])
      })

      it.each<[string, NewBooking['status'], number]>([
        ['a draft', 'draft', 9],
        ['a confirmed booking', 'confirmed', 9],
        ['a booking in progress', 'in_progress', 9],
        ['a completed booking', 'completed', 9],
        ['a cancelled booking', 'cancelled', 12],
        ['a booking the customer did not come to', 'no_show', 12],
      ])('reads %s accordingly', async (_what, status, left) => {
        await insertBooking(jst('14:00'), inStatus(status))

        const response = await list()

        expect(response.body.meta.total).toBe(left)
      })

      it('reads the staff member of the service line, not the one in charge of the booking', async () => {
        const other = await staffMember()
        await insertBooking(jst('14:00'), { by: other, lineBy: staffId })
        await insertBooking(jst('10:00'), { by: staffId, lineBy: other })
        await insertBooking(jst('16:00'), { by: staffId, lineBy: null })

        const response = await list()

        expect(startsOf(response)).toEqual([
          ...['10:00', '10:30', '11:00', '13:00'],
          ...['15:00', '15:30', '16:00', '16:30', '17:00'],
        ])
      })

      it('keeps the time free that the staff member keeps around a booking and around the slot', async () => {
        const careful = await staffMember({
          bufferTimeBefore: 10,
          bufferTimeAfter: 20,
        })
        await works(DAY, careful)
        await insertBooking(jst('14:00'), { by: careful })

        const response = await list(searching({ staffId: careful }))

        expect(startsOf(response)).toEqual([
          ...['10:00', '10:30', '11:00'],
          ...['15:30', '16:00', '16:30', '17:00'],
        ])
      })

      it('has the slots beside one booking, and none beside two, for a staff member who takes two at once', async () => {
        const double = await staffMember({ maxConcurrentBookings: 2 })
        await works(DAY, double)
        await insertBooking(jst('14:00'), { by: double })

        const besideOne = await list(searching({ staffId: double }))
        await insertBooking(jst('14:30'), { by: double, minutes: 90 })
        const besideTwo = await list(searching({ staffId: double }))

        expect(startsOf(besideOne)).toEqual(STARTS)
        expect(startsOf(besideTwo)).toEqual([
          ...['10:00', '10:30', '11:00', '13:00', '13:30'],
          ...['15:00', '15:30', '16:00', '16:30', '17:00'],
        ])
      })

      it('reads a booking that began the day before and one that the time kept free reaches from the next day', async () => {
        const late = await staffMember({ bufferTimeAfter: 30 })
        await works(DAY, late, {
          startTime: '00:00',
          endTime: '23:59',
          breakStartTime: null,
          breakEndTime: null,
        })
        await opens(DAY, { openTime: '00:00', closeTime: '23:59' })
        await insertBooking(jst('23:30', daysAfter(DAY, -1)), {
          by: late,
          minutes: 60,
        })
        await insertBooking(jst('00:10', daysAfter(DAY, 1)), { by: late })

        const response = await list(
          searching({ staffId: late, limit: '100', duration: '30' }),
        )
        const starts = startsOf(response)

        // The booking of the night before ends at 00:30 and keeps half an
        // hour; the one after midnight begins ten minutes into the next day.
        expect(starts.at(0)).toBe('01:00')
        expect(starts.at(-1)).toBe('23:00')
        expect(starts).toHaveLength(45)
      })

      it('has the slot again once the booking in the way is cancelled', async () => {
        const id = await insertBooking(jst('10:00'))
        const before = await list()
        await db
          .update(bookings)
          .set(inStatus('cancelled'))
          .where(eq(bookings.id, id))

        const after = await list()

        expect(startsOf(before).at(0)).toBe('11:00')
        expect(startsOf(after)).toEqual(STARTS)
      })

      it('offers what the ledger takes: a booking entered at a slot succeeds, and the slot is gone', async () => {
        const before = await list()
        const [slot] = before.body.data

        const entered = await request(app)
          .post('/api/v1/bookings')
          .set('Authorization', asAdmin)
          .send({
            salonId,
            customerId,
            staffId: slot.staffId,
            depositAmount: null,
            customerRequest: null,
            internalNotes: null,
            source: null,
            services: [
              {
                serviceId: cutId,
                staffId: slot.staffId,
                startTime: slot.startTime,
                notes: null,
              },
            ],
          })
        const after = await list()

        expect(entered.status).toBe(201)
        expect(startsOf(after)).toEqual(STARTS.slice(2))
      })

      it('does not wait for rows that a booking under way holds', async () => {
        const responses = await db.transaction(async (tx) => {
          await tx
            .select({ id: salons.id })
            .from(salons)
            .where(eq(salons.id, salonId))
            .for('update')
          await tx
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, staffId))
            .for('update')
          await tx
            .select({ id: services.id })
            .from(services)
            .where(eq(services.id, cutId))
            .for('update')

          return [await list(), await check()]
        })

        expect(responses.map(outcomeOf)).toEqual(['200', '200'])
      })
    })

    describe('the present moment', () => {
      /**
       * Runs with today's date in Tokyo, again when the date changed
       * while it ran.
       */
      const today = async <T>(
        run: (date: string) => Promise<T>,
      ): Promise<T> => {
        const date = dateIn(0)
        const result = await run(date)
        return dateIn(0) === date ? result : today(run)
      }

      /** Every half hour of a day that is open from 00:00 to 23:59, for a treatment of half an hour. */
      const halfHours = (date: string): string[] =>
        Array.from({ length: 47 }, (_, step) =>
          new Date(
            jst('00:00', date).getTime() + step * 30 * MINUTE,
          ).toISOString(),
        )

      it('has the slots of today that begin after the moment of the request', async () => {
        const { starts, date, before, after } = await today(async (date) => {
          await db.delete(openingHours).where(eq(openingHours.salonId, salonId))
          await db
            .delete(staffSchedules)
            .where(eq(staffSchedules.staffId, staffId))
          await allDay(date)
          const before = new Date()
          const response = await list(
            searching({ date, duration: '30', limit: '100' }),
          )
          return {
            starts: response.body.data.map(
              ({ startTime }: { startTime: string }) => startTime,
            ),
            date,
            before,
            after: new Date(),
          }
        })

        const laterThan = (moment: Date): string[] =>
          halfHours(date).filter((start) => new Date(start) > moment)
        expect([laterThan(before), laterThan(after)]).toContainEqual(starts)
      })

      it('has no slot on a date that has passed', async () => {
        const yesterday = dateIn(-1)
        await allDay(yesterday)

        const response = await list(searching({ date: yesterday }))

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
        expect(response.body.meta.total).toBe(0)
      })

      it('has no slot today for a service that has to be booked in advance, and slots tomorrow', async () => {
        const service = await insertService({
          bookingRequirements: ['advance_booking_required'],
        })

        const [onTheDay, theDayAfter, withoutRequirement] = await today(
          async (date) => {
            await db
              .delete(openingHours)
              .where(eq(openingHours.salonId, salonId))
            await db
              .delete(staffSchedules)
              .where(eq(staffSchedules.staffId, staffId))
            const tomorrow = daysAfter(date, 1)
            await allDay(date)
            await allDay(tomorrow)
            const totalOf = async (query: Record<string, string>) =>
              (await list(searching({ duration: '30', ...query }))).body.meta
                .total

            return [
              await totalOf({ serviceId: service, date }),
              await totalOf({ serviceId: service, date: tomorrow }),
              await totalOf({ date: tomorrow }),
            ]
          },
        )

        expect(onTheDay).toBe(0)
        expect(theDayAfter).toBe(47)
        expect(withoutRequirement).toBe(47)
      })
    })

    describe('a salon whose clocks change', () => {
      /**
       * A salon in New York that is open from 00:00 to 06:00 on a date,
       * with a staff member who works then; lists the slots of a service
       * of an hour as the moments they begin at.
       */
      const nightOf = async (date: string): Promise<string[]> => {
        const of = await salon({ timezone: NEW_YORK, businessHours: null })
        await opens(date, { openTime: '00:00', closeTime: '06:00' }, of)
        const by = await staffMember({}, of)
        await works(date, by, {
          startTime: '00:00',
          endTime: '06:00',
          breakStartTime: null,
          breakEndTime: null,
        })
        const service = await insertService({}, of)

        const response = await list(
          searching({ serviceId: service, date }),
          asCustomer,
          of,
        )
        return response.body.data.map(
          ({ startTime }: { startTime: string }) => startTime,
        )
      }

      /** Every half hour from midnight of a date, the clocks so many hours behind UTC, as long as an hour fits before a moment. */
      const halfHoursOf = (
        date: string,
        behindAtMidnight: number,
        behindAtSix: number,
      ): string[] => {
        const midnight =
          new Date(`${date}T00:00:00Z`).getTime() + behindAtMidnight * HOUR
        const six = new Date(`${date}T06:00:00Z`).getTime() + behindAtSix * HOUR
        const count = Math.floor((six - midnight - HOUR) / (30 * MINUTE)) + 1

        return Array.from({ length: count }, (_, step) =>
          new Date(midnight + step * 30 * MINUTE).toISOString(),
        )
      }

      it('has an hour of slots less on the night the clocks are put forward', async () => {
        const { date, before, after } = clockChanges().forward

        const starts = await nightOf(date)

        expect(starts).toEqual(halfHoursOf(date, before, after))
        expect(starts).toHaveLength(9)
      })

      it('has an hour of slots more on the night the clocks are put back', async () => {
        const { date, before, after } = clockChanges().back

        const starts = await nightOf(date)

        expect(starts).toEqual(halfHoursOf(date, before, after))
        expect(starts).toHaveLength(13)
      })

      it('has eleven slots on the night after the change', async () => {
        const { date, after } = clockChanges().forward
        const next = daysAfter(date, 1)

        const starts = await nightOf(next)

        expect(starts).toEqual(halfHoursOf(next, after, after))
        expect(starts).toHaveLength(11)
      })
    })

    describe('pages', () => {
      it('walks through all slots along the links, each page as long as the limit', async () => {
        const pages: Response[] = []
        let next: string | null =
          `${slotsOf(salonId)}?${searching({ limit: '5' })}`
        while (next !== null && pages.length < 10) {
          const response: Response = await authorized(
            request(app).get(next),
            asCustomer,
          )
          pages.push(response)
          next = response.body.links.next
        }

        expect(pages.map(startsOf)).toEqual([
          STARTS.slice(0, 5),
          STARTS.slice(5, 10),
          STARTS.slice(10),
        ])
        expect(pages.map(({ body }) => body.meta)).toEqual([
          {
            total: 12,
            limit: 5,
            hasMore: true,
            cursor: null,
            nextCursor: `${iso('13:30')}_${staffId}`,
            prevCursor: null,
          },
          {
            total: 12,
            limit: 5,
            hasMore: true,
            cursor: `${iso('13:30')}_${staffId}`,
            nextCursor: `${iso('16:00')}_${staffId}`,
            prevCursor: null,
          },
          {
            total: 12,
            limit: 5,
            hasMore: false,
            cursor: `${iso('16:00')}_${staffId}`,
            nextCursor: null,
            prevCursor: null,
          },
        ])
      })

      it('links a page to itself, to the first page and to the next, with the parameters of the request', async () => {
        const cursor = `${iso('10:30')}_${staffId}`
        const query = searching({ limit: '2', duration: '45', cursor })

        const response = await list(query)

        const page = (at: string | null): string =>
          `${slotsOf(salonId)}?${new URLSearchParams({
            serviceId: cutId,
            date: DAY,
            limit: '2',
            duration: '45',
            ...(at === null ? {} : { cursor: at }),
          }).toString()}`
        expect(startsOf(response)).toEqual(['11:00', '13:00'])
        expect(response.body.links).toEqual({
          self: page(cursor),
          first: page(null),
          last: null,
          next: page(`${iso('13:00')}_${staffId}`),
          prev: null,
        })
      })

      it('repeats the path as the request wrote it in the links', async () => {
        const path = `/API/V1/Salons/${salonId.toUpperCase()}/Available-Slots`

        const response = await authorized(
          request(app).get(`${path}?${searching({ limit: '1' })}`),
          asCustomer,
        )

        expect(response.status).toBe(200)
        expect(response.body.links).toMatchObject({
          self: `${path}?${searching({ limit: '1' })}`,
          first: `${path}?${searching({ limit: '1' })}`,
          next: `${path}?${searching({
            limit: '1',
            cursor: `${iso('10:00')}_${staffId}`,
          })}`,
        })
      })

      it('has no next page when the slots are exactly as many as the limit, and one when they are one more', async () => {
        const exact = await list(searching({ limit: '12' }))
        const oneMore = await list(searching({ limit: '11' }))

        expect(exact.body.data).toHaveLength(12)
        expect(exact.body.meta).toMatchObject({
          hasMore: false,
          nextCursor: null,
        })
        expect(exact.body.links.next).toBeNull()
        expect(oneMore.body.data).toHaveLength(11)
        expect(oneMore.body.meta).toMatchObject({
          hasMore: true,
          nextCursor: `${iso('16:30')}_${staffId}`,
        })
      })

      it('goes on after a cursor whose slot was taken meanwhile', async () => {
        const first = await list(searching({ limit: '3' }))
        await insertBooking(jst('11:00'))

        const second = await list(
          searching({ limit: '3', cursor: first.body.meta.nextCursor }),
        )

        expect(startsOf(first)).toEqual(['10:00', '10:30', '11:00'])
        expect(startsOf(second)).toEqual(['13:00', '13:30', '14:00'])
        expect(second.body.meta.total).toBe(10)
      })

      it('goes on with the next staff member among the slots that begin with the cursor', async () => {
        const other = await staffMember()
        await works(DAY, other)
        const [first, last] = [staffId, other].toSorted()

        const response = await list(
          searching({ limit: '2', cursor: `${iso('10:00')}_${first}` }),
        )

        expect(
          response.body.data.map(
            ({ staffId: by, startTime }: Record<string, string>) =>
              `${inTokyo(startTime ?? '')} ${by}`,
          ),
        ).toEqual([`10:00 ${last}`, `10:30 ${first}`])
      })

      it('returns an empty page after the last slot', async () => {
        const response = await list(
          searching({ cursor: `${iso('17:00')}_${staffId}` }),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
        expect(response.body.meta).toMatchObject({
          total: 12,
          hasMore: false,
          nextCursor: null,
        })
      })
    })

    describe('what is refused', () => {
      it.each(malformedIds)(
        'refuses %s in place of the ID of the salon',
        async (_case, id) => {
          const response = await list(searching(), asCustomer, id)

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        },
      )

      it.each<[string, () => string, string[]]>([
        [
          'no parameter at all',
          () => '',
          ['serviceId:invalid_type', 'date:invalid_type'],
        ],
        ['no service', () => `date=${DAY}`, ['serviceId:invalid_type']],
        ['no date', () => `serviceId=${cutId}`, ['date:invalid_type']],
        [
          'a service that is not a UUID',
          () => searching({ serviceId: 'cut' }),
          ['serviceId:invalid_format'],
        ],
        [
          'a staff member that is not a UUID',
          () => searching({ staffId: 'hanako' }),
          ['staffId:invalid_format'],
        ],
        [
          'an empty staff member',
          () => searching({ staffId: '' }),
          ['staffId:invalid_format'],
        ],
        [
          'a date that does not exist',
          () => searching({ date: '2027-02-30' }),
          ['date:invalid_format'],
        ],
        [
          'a date with a time',
          () => searching({ date: `${DAY}T00:00:00Z` }),
          ['date:invalid_format'],
        ],
        [
          'a date that is given twice',
          () => `${searching()}&date=${DAY}`,
          ['date:invalid_type'],
        ],
        [
          'a limit that is not a number',
          () => searching({ limit: 'many' }),
          ['limit:invalid_format'],
        ],
        [
          'a page of nothing',
          () => searching({ limit: '0' }),
          ['limit:too_small'],
        ],
        ['a page of 101', () => searching({ limit: '101' }), ['limit:too_big']],
        [
          'a page of a half',
          () => searching({ limit: '1.5' }),
          ['limit:invalid_type'],
        ],
        [
          'a duration that is not a number',
          () => searching({ duration: 'long' }),
          ['duration:invalid_format'],
        ],
        [
          'a treatment of no time',
          () => searching({ duration: '0' }),
          ['duration:too_small'],
        ],
        [
          'a treatment of more than a day',
          () => searching({ duration: '1441' }),
          ['duration:too_big'],
        ],
        [
          'a cursor of another list',
          () => searching({ cursor: UNKNOWN_ID }),
          ['cursor:custom'],
        ],
        [
          'parameters the list does not have',
          () => searching({ salonId: UNKNOWN_ID, sortBy: 'startTime' }),
          ['salonId:unrecognized_keys', 'sortBy:unrecognized_keys'],
        ],
        [
          'everything that is wrong at once',
          () => 'serviceId=cut&date=today&limit=0&duration=0&cursor=-',
          [
            'limit:too_small',
            'cursor:custom',
            'serviceId:invalid_format',
            'date:invalid_format',
            'duration:too_small',
          ],
        ],
      ])('refuses %s', async (_case, query, rules) => {
        const response = await list(query())

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(brokenRules(response)).toEqual(rules)
      })

      it('reports the two numbers together when neither is one', async () => {
        const response = await list(
          searching({ limit: 'many', duration: 'long', date: 'today' }),
        )

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(brokenRules(response)).toEqual([
          'limit:invalid_format',
          'duration:invalid_format',
        ])
      })

      it('answers 404 for a salon that does not exist, and for one that is deleted', async () => {
        const deleted = await salon()
        await deleteSalon(deleted)

        const responses = [
          await list(searching(), asCustomer, UNKNOWN_ID),
          await list(searching(), asCustomer, deleted),
        ]

        for (const response of responses) {
          expectProblem(response, notFound)
        }
        expect(responses.map(({ body }) => body.detail)).toEqual([
          `Salon ${UNKNOWN_ID} was not found`,
          `Salon ${deleted} was not found`,
        ])
      })

      it.each<[string, () => Promise<string>]>([
        ['does not exist', async () => UNKNOWN_ID],
        ['is of another salon', async () => insertService({}, await salon())],
        [
          'is deleted',
          async () => {
            const id = await insertService()
            await deleteService(id)
            return id
          },
        ],
      ])('refuses a service that %s', async (_case, service) => {
        const response = await list(searching({ serviceId: await service() }))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(response.body.errors).toEqual([
          issue('serviceId', 'not_found', 'Must name a service of the salon'),
        ])
      })

      it.each<[string, () => Promise<string>]>([
        ['does not exist', async () => UNKNOWN_ID],
        ['is of another salon', async () => staffMember({}, await salon())],
        [
          'is deleted',
          async () => {
            const id = await staffMember()
            await deleteStaff(id)
            return id
          },
        ],
      ])('refuses a staff member that %s', async (_case, by) => {
        const response = await list(searching({ staffId: await by() }))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(response.body.errors).toEqual([
          issue(
            'staffId',
            'not_found',
            'Must name a staff member of the salon',
          ),
        ])
      })

      it('refuses a staff member and a service that are not the salon’s at once', async () => {
        const response = await list(
          searching({ staffId: UNKNOWN_ID, serviceId: UNKNOWN_ID }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'staffId:not_found',
          'serviceId:not_found',
        ])
      })

      it('answers 409 for a salon whose time zone the runtime does not know', async () => {
        const lost = await salon({ timezone: 'Mars/Olympus' })
        const service = await insertService({}, lost)

        const response = await list(
          searching({ serviceId: service }),
          asCustomer,
          lost,
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(TIME_ZONE_UNKNOWN)
      })

      it('answers 500 for a salon whose stored weekly hours do not have the shape of the model', async () => {
        const broken = await salon({
          businessHours: [{ ...weeklyHours(), timezone: 'Asia/Tokyo' }],
        })
        const service = await insertService({}, broken)

        const response = await list(
          searching({ serviceId: service }),
          asCustomer,
          broken,
        )

        expectProblem(response, databaseProblem)
      })

      it('looks at the path, the query, the salon, what the query names and the time zone, in that order', async () => {
        const lost = await salon({ timezone: 'Mars/Olympus' })
        const deleted = await salon({ timezone: 'Mars/Olympus' })
        await deleteSalon(deleted)

        const responses = [
          await list('limit=0', asCustomer, 'aoyama'),
          await list(searching({ limit: '0' }), asCustomer, UNKNOWN_ID),
          await list(searching(), asCustomer, deleted),
          await list(searching(), asCustomer, lost),
          await list(
            searching({ serviceId: await insertService({}, lost) }),
            asCustomer,
            lost,
          ),
        ]

        expect(responses.map(outcomeOf)).toEqual([
          '400 salonId:invalid_format',
          '400 limit:too_small',
          '404 3001',
          '400 serviceId:not_found',
          '409 3003',
        ])
      })
    })
  })

  describe('POST /api/v1/salons/:salonId/available-slots/check', () => {
    it('says that a staff member nothing is booked for is free, with the links of the question', async () => {
      const response = await check()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: { isAvailable: true, conflicts: [] },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${slotsOf(salonId)}/check`,
          list: slotsOf(salonId),
        },
      })
    })

    it('says that the staff member is not free during another booking, and names it', async () => {
      const id = await insertBooking(jst('10:30'))

      const response = await check()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        isAvailable: false,
        conflicts: [id],
      })
    })

    it.each<[string, string, string, boolean]>([
      ['ends as the wanted time begins', '09:00', '10:00', true],
      ['ends a minute into the wanted time', '09:01', '10:00', false],
      ['begins as the wanted time ends', '11:00', '10:00', true],
      ['begins a minute before the wanted time ends', '10:59', '10:00', false],
    ])(
      'reads a booking that %s accordingly',
      async (_case, from, wanted, isAvailable) => {
        const id = await insertBooking(jst(from))

        const response = await check(asking({ startTime: iso(wanted) }))

        expect(response.body.data).toEqual({
          isAvailable,
          conflicts: isAvailable ? [] : [id],
        })
      },
    )

    it('takes the time of the service for the wanted time', async () => {
      const short = await insertService({ name: 'Fringe trim', duration: 30 })
      const long = await insertService({ name: 'Colour', duration: 120 })
      const id = await insertBooking(jst('10:30'))

      const responses = [
        await check(asking({ serviceId: short })),
        await check(asking({ serviceId: long, startTime: iso('08:30') })),
        await check(asking({ serviceId: long, startTime: iso('08:31') })),
      ]

      expect(responses.map(({ body }) => body.data)).toEqual([
        { isAvailable: true, conflicts: [] },
        { isAvailable: true, conflicts: [] },
        { isAvailable: false, conflicts: [id] },
      ])
    })

    it.each<[string, NewBooking['status'], boolean]>([
      ['a draft', 'draft', false],
      ['a pending booking', 'pending', false],
      ['a confirmed booking', 'confirmed', false],
      ['a booking in progress', 'in_progress', false],
      ['a completed booking', 'completed', false],
      ['a cancelled booking', 'cancelled', true],
      ['a booking the customer did not come to', 'no_show', true],
    ])('reads %s accordingly', async (_what, status, isAvailable) => {
      const id = await insertBooking(jst('10:00'), inStatus(status))

      const response = await check()

      expect(response.body.data).toEqual({
        isAvailable,
        conflicts: isAvailable ? [] : [id],
      })
    })

    it('reads the staff member of the service line, not the one in charge of the booking', async () => {
      const other = await staffMember()
      const theirs = await insertBooking(jst('10:00'), {
        by: other,
        lineBy: staffId,
      })
      await insertBooking(jst('10:00'), { by: staffId, lineBy: other })
      await insertBooking(jst('10:00'), { by: staffId, lineBy: null })

      const response = await check()

      expect(response.body.data).toEqual({
        isAvailable: false,
        conflicts: [theirs],
      })
    })

    it('counts the time the staff member keeps free around a booking and around the wanted time', async () => {
      const careful = await staffMember({
        bufferTimeBefore: 10,
        bufferTimeAfter: 20,
      })
      const before = await insertBooking(jst('08:31'), { by: careful })
      const after = await insertBooking(jst('11:29'), { by: careful })
      await insertBooking(jst('07:30'), { by: careful })
      await insertBooking(jst('12:30'), { by: careful })

      const tight = await check(asking({ staffId: careful }))
      await db
        .update(bookings)
        .set(inStatus('cancelled'))
        .where(eq(bookings.id, before))
      await db
        .update(bookings)
        .set(inStatus('no_show'))
        .where(eq(bookings.id, after))
      const exact = await check(asking({ staffId: careful }))

      expect(tight.body.data).toEqual({
        isAvailable: false,
        conflicts: [before, after],
      })
      expect(exact.body.data).toEqual({ isAvailable: true, conflicts: [] })
    })

    it('says that a staff member who takes two bookings at once is free beside one and not beside two, and names them', async () => {
      const double = await staffMember({ maxConcurrentBookings: 2 })
      const later = await insertBooking(jst('10:30'), { by: double })

      const besideOne = await check(asking({ staffId: double }))
      const earlier = await insertBooking(jst('09:30'), { by: double })
      const besideTwoInTurn = await check(asking({ staffId: double }))
      const together = await insertBooking(jst('10:15'), {
        by: double,
        minutes: 30,
      })
      const besideTwoAtOnce = await check(asking({ staffId: double }))

      expect(besideOne.body.data).toEqual({
        isAvailable: true,
        conflicts: [later],
      })
      // The two do not occupy the staff member at one moment.
      expect(besideTwoInTurn.body.data).toEqual({
        isAvailable: true,
        conflicts: [earlier, later],
      })
      expect(besideTwoAtOnce.body.data).toEqual({
        isAvailable: false,
        conflicts: [earlier, together, later],
      })
    })

    it('names a booking once that has several lines in the way', async () => {
      const id = await insertBooking(jst('09:30'))
      await db.insert(bookingServices).values({
        bookingId: id,
        serviceId: cutId,
        staffId,
        startTime: iso('10:30'),
        endTime: iso('11:30'),
        duration: 60,
        price: 6600,
        finalPrice: 6600,
        taxIncluded: true,
        sortOrder: 1,
      })

      const response = await check()

      expect(response.body.data).toEqual({
        isAvailable: false,
        conflicts: [id],
      })
    })

    it('does not read the bookings of other staff members or of other times', async () => {
      const other = await staffMember()
      await insertBooking(jst('10:00'), { by: other })
      await insertBooking(jst('10:00', daysAfter(DAY, 1)))
      await insertBooking(jst('10:00', daysAfter(DAY, -1)))
      await insertBooking(jst('08:00'))
      await insertBooking(jst('12:00'))

      const response = await check()

      expect(response.body.data).toEqual({ isAvailable: true, conflicts: [] })
    })

    it('asks what the ledger asks and nothing else: not the hours, the schedule, what the salon takes or the clock', async () => {
      const closed = await salon({ businessHours: null, isActive: false })
      const idle = await staffMember(
        { isActive: false, canReceiveBookings: false, level: 'junior' },
        closed,
      )
      const hidden = await insertService(
        {
          isActive: false,
          serviceStatus: 'discontinued',
          allowOnlineBooking: false,
          requiredStaffLevel: 'director',
          maxBookingsPerDay: 1,
          bookingRequirements: ['advance_booking_required'],
        },
        closed,
      )

      const responses = [
        await check(
          { staffId: idle, serviceId: hidden, startTime: iso('03:00') },
          asAdmin,
          closed,
        ),
        await check(
          {
            staffId: idle,
            serviceId: hidden,
            startTime: '2020-01-01T01:00:00.000Z',
          },
          asAdmin,
          closed,
        ),
      ]

      expect(responses.map(({ body }) => body.data)).toEqual([
        { isAvailable: true, conflicts: [] },
        { isAvailable: true, conflicts: [] },
      ])
    })

    it('answers as the ledger does: a booking entered at a time that is free succeeds, and one at a time that is not is refused', async () => {
      const enter = (startTime: string) =>
        request(app)
          .post('/api/v1/bookings')
          .set('Authorization', asAdmin)
          .send({
            salonId,
            customerId,
            staffId,
            depositAmount: null,
            customerRequest: null,
            internalNotes: null,
            source: null,
            services: [{ serviceId: cutId, staffId, startTime, notes: null }],
          })

      const free = await check()
      const entered = await enter(iso('10:00'))
      const taken = await check(asking({ startTime: iso('10:30') }))
      const refused = await enter(iso('10:30'))

      expect(free.body.data.isAvailable).toBe(true)
      expect(entered.status).toBe(201)
      expect(taken.body.data).toEqual({
        isAvailable: false,
        conflicts: [entered.body.data.id],
      })
      expect(statusAndCode(refused)).toBe('409 3003')
    })

    it('finds the salon, the staff member and the service by IDs in capitals, and repeats the path as it was written in the links', async () => {
      const path = `/API/V1/Salons/${salonId.toUpperCase()}/Available-Slots`

      const response = await authorized(
        request(app).post(`${path}/Check`),
        asAdmin,
      ).send(
        asking({
          staffId: staffId.toUpperCase(),
          serviceId: cutId.toUpperCase(),
        }),
      )

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: `${path}/check`,
        list: path,
      })
    })

    it('writes nothing', async () => {
      await insertBooking(jst('10:00'))
      const stored = async () => ({
        bookings: await db.select().from(bookings),
        lines: await db.select().from(bookingServices),
        staff: await db.select().from(staff),
        services: await db.select().from(services),
      })
      const before = await stored()

      await check()
      await list()

      expect(await stored()).toEqual(before)
    })

    describe('who may ask', () => {
      it.each(keepers)('lets %s ask', async (_who, signInAs) => {
        const id = await insertBooking(jst('10:00'))

        const response = await check(asking(), await signInAs())

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          isAvailable: false,
          conflicts: [id],
        })
      })

      it.each(notKeepers)('does not let %s ask', async (_who, signInAs) => {
        const response = await check(asking(), await signInAs())

        expectProblem(response, forbidden)
      })

      it('refuses them before it reads the body, and for a salon that does not exist as for one that does', async () => {
        const responses = [
          await check({ startTime: 'now' }, asCustomer),
          await check(asking(), asCustomer, UNKNOWN_ID),
          await check(asking(), await member('owner')(), UNKNOWN_ID),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '403 1005',
          '403 1005',
          '403 1005',
        ])
      })

      it.each(unauthenticated)(
        'refuses %s',
        async (_case, token, problem, challenge) => {
          const response = await check(asking(), await token())

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        },
      )
    })

    describe('what is refused', () => {
      it.each(malformedIds)(
        'refuses %s in place of the ID of the salon, whoever asks',
        async (_case, id) => {
          const responses = [
            await check(asking(), asAdmin, id),
            await check(asking(), asCustomer, id),
          ]

          for (const response of responses) {
            expectProblem(response, badRequest)
            expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
          }
        },
      )

      it.each<[string, () => unknown, string[]]>([
        [
          'no property at all',
          () => ({}),
          [
            'staffId:invalid_type',
            'serviceId:invalid_type',
            'startTime:invalid_type',
          ],
        ],
        [
          'a staff member that is null',
          () => asking({ staffId: null }),
          ['staffId:invalid_type'],
        ],
        [
          'IDs that are not UUIDs',
          () => asking({ staffId: 'hanako', serviceId: 'cut' }),
          ['staffId:invalid_format', 'serviceId:invalid_format'],
        ],
        [
          'a time with seconds',
          () => asking({ startTime: iso('10:00').replace(':00.000Z', ':30Z') }),
          ['startTime:custom'],
        ],
        [
          'a time with an offset',
          () => asking({ startTime: `${DAY}T10:00:00+09:00` }),
          ['startTime:invalid_format'],
        ],
        [
          'a date in place of a time',
          () => asking({ startTime: DAY }),
          ['startTime:invalid_format'],
        ],
        [
          'properties the question does not have',
          () => asking({ duration: 60, date: DAY }),
          ['duration:unrecognized_keys', 'date:unrecognized_keys'],
        ],
        ['a list', () => [asking()], [':invalid_type']],
      ])('refuses %s', async (_case, body, rules) => {
        const response = await check(body())

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_CHECK)
        expect(brokenRules(response)).toEqual(rules)
      })

      it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
        const notJson = (
          authorization: string | null,
          body = '{"staffId": ',
        ): Test =>
          authorized(
            request(app).post(`${slotsOf(salonId)}/check`),
            authorization,
          )
            .set('Content-Type', 'application/json')
            .send(body)

        const responses = [
          await notJson(null),
          await notJson(asCustomer),
          await notJson(asAdmin),
          await notJson(asAdmin, 'null'),
          await authorized(request(app).post(`${slotsOf(salonId)}/check`), null)
            .set('Content-Type', 'text/plain')
            .send('is Hanako free at ten?'),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '400 2002',
          '400 2002',
          '400 2002',
          '400 2002',
          '415 2002',
        ])
      })

      it('answers 404 for a salon that does not exist, and for one that is deleted', async () => {
        const deleted = await salon()
        const by = await staffMember({}, deleted)
        const service = await insertService({}, deleted)
        await deleteSalon(deleted)

        const responses = [
          await check(asking(), asAdmin, UNKNOWN_ID),
          await check(
            { staffId: by, serviceId: service, startTime: iso('10:00') },
            asAdmin,
            deleted,
          ),
        ]

        for (const response of responses) {
          expectProblem(response, notFound)
        }
        expect(responses.map(({ body }) => body.detail)).toEqual([
          `Salon ${UNKNOWN_ID} was not found`,
          `Salon ${deleted} was not found`,
        ])
      })

      it.each<[string, () => Promise<string>]>([
        ['does not exist', async () => UNKNOWN_ID],
        ['is of another salon', async () => insertService({}, await salon())],
        [
          'is deleted',
          async () => {
            const id = await insertService()
            await deleteService(id)
            return id
          },
        ],
      ])('refuses a service that %s', async (_case, service) => {
        const response = await check(asking({ serviceId: await service() }))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_CHECK)
        expect(response.body.errors).toEqual([
          issue('serviceId', 'not_found', 'Must name a service of the salon'),
        ])
      })

      it.each<[string, () => Promise<string>]>([
        ['does not exist', async () => UNKNOWN_ID],
        ['is of another salon', async () => staffMember({}, await salon())],
        [
          'is deleted',
          async () => {
            const id = await staffMember()
            await deleteStaff(id)
            return id
          },
        ],
      ])('refuses a staff member that %s', async (_case, by) => {
        const response = await check(asking({ staffId: await by() }))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_CHECK)
        expect(response.body.errors).toEqual([
          issue(
            'staffId',
            'not_found',
            'Must name a staff member of the salon',
          ),
        ])
      })

      it('refuses a staff member and a service that are not the salon’s at once', async () => {
        const response = await check(
          asking({ staffId: UNKNOWN_ID, serviceId: UNKNOWN_ID }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'staffId:not_found',
          'serviceId:not_found',
        ])
      })

      it('looks at the path, the account, the body, the salon and what the body names, in that order', async () => {
        const responses = [
          await check({}, asCustomer, 'aoyama'),
          await check({}, asCustomer, UNKNOWN_ID),
          await check({}, asAdmin, UNKNOWN_ID),
          await check(asking({ serviceId: UNKNOWN_ID }), asAdmin, UNKNOWN_ID),
          await check(asking({ serviceId: UNKNOWN_ID })),
        ]

        expect(responses.map(outcomeOf)).toEqual([
          '400 salonId:invalid_format',
          '403 1005',
          '400 staffId:invalid_type,serviceId:invalid_type,startTime:invalid_type',
          '404 3001',
          '400 serviceId:not_found',
        ])
      })
    })
  })

  describe('what the contract does not have', () => {
    /** A method and a path below the slots of the salon. */
    const outside: [
      string,
      'get' | 'put' | 'patch' | 'delete' | 'post',
      string,
    ][] = [
      ['POST on the slots', 'post', ''],
      ['PUT on the slots', 'put', ''],
      ['PATCH on the slots', 'patch', ''],
      ['DELETE on the slots', 'delete', ''],
      ['GET on the check', 'get', '/check'],
      ['PUT on the check', 'put', '/check'],
      ['PATCH on the check', 'patch', '/check'],
      ['DELETE on the check', 'delete', '/check'],
      ['GET on one slot', 'get', `/${UNKNOWN_ID}`],
      ['POST below the check', 'post', '/check/again'],
      ['POST on another name of the check', 'post', '/checks'],
      ['POST on another name of the check', 'post', '/verify'],
    ]

    it.each(outside)('has no %s', async (_case, method, below) => {
      const path = `${slotsOf(salonId)}${below}`

      const response = await request(app)
        [method](path)
        .set('Authorization', asAdmin)
        .send(asking())

      expectProblem(response, routeNotFound)
      expect(response.body.detail).toBe(
        `${method.toUpperCase()} ${path} is not part of the API`,
      )
    })
  })

  describe('AvailableSlotRepository', () => {
    const repository = () => new AvailableSlotRepository(db)

    const dayOf = async (
      query: {
        salon?: string
        service?: string
        by?: string | null
        date?: string
      } = {},
    ) => {
      const result = await repository().findDay({
        salonId: salonIdSchema.parse(query.salon ?? salonId),
        serviceId: serviceIdSchema.parse(query.service ?? cutId),
        staffId:
          query.by === undefined || query.by === null
            ? null
            : staffIdSchema.parse(query.by),
        date: query.date ?? DAY,
      })
      if (result.type === 'error') {
        throw new Error(`findDay failed: ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const occupancyOf = async (
      query: {
        salon?: string
        service?: string
        by?: string
        from?: Date
      } = {},
    ) => {
      const result = await repository().findOccupancy({
        salonId: salonIdSchema.parse(query.salon ?? salonId),
        serviceId: serviceIdSchema.parse(query.service ?? cutId),
        staffId: staffIdSchema.parse(query.by ?? staffId),
        startTime: query.from ?? jst('10:00'),
      })
      if (result.type === 'error') {
        throw new Error(`findOccupancy failed: ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    /** The first moment of the day in UTC, which the widest day is counted from. */
    const utcMidnight = new Date(`${DAY}T00:00:00Z`).getTime()

    describe('findDay', () => {
      it('resolves to null for a salon that does not exist, and for one that is deleted', async () => {
        const deleted = await salon()
        await deleteSalon(deleted)

        expect(await dayOf({ salon: UNKNOWN_ID })).toBeNull()
        expect(await dayOf({ salon: deleted })).toBeNull()
      })

      it('reads what of the salon, the service and the staff decides the slots', async () => {
        const day = await dayOf()

        expect(day).toEqual({
          salon: {
            id: salonId,
            isActive: true,
            timezone: 'Asia/Tokyo',
            businessHours: [weeklyHours()],
          },
          calendarDay: null,
          service: {
            duration: 60,
            isActive: true,
            serviceStatus: 'active',
            allowOnlineBooking: true,
            availability: 'always',
            bookingRequirements: [],
            maxBookingsPerDay: null,
            requiredStaffLevel: null,
          },
          serviceLineStarts: [],
          staff: [
            {
              id: staffId,
              level: 'stylist',
              isActive: true,
              canReceiveBookings: true,
              bufferTimeBefore: 0,
              bufferTimeAfter: 0,
              maxConcurrentBookings: 1,
              schedules: [
                expect.objectContaining({
                  staffId,
                  date: DAY,
                  startTime: '09:00:00',
                  endTime: '18:00:00',
                  breakStartTime: '12:00:00',
                  breakEndTime: '13:00:00',
                }),
              ],
              taken: [],
            },
          ],
        })
      })

      it('reads the row of the calendar for the date as it says when the salon is open', async () => {
        await opens(DAY, { openTime: '11:00', closeTime: '16:00' })
        await opens(daysAfter(DAY, 1), { openTime: null, closeTime: null })

        expect((await dayOf())?.calendarDay).toEqual({
          openTime: '11:00:00',
          closeTime: '16:00:00',
        })
        expect((await dayOf({ date: daysAfter(DAY, 1) }))?.calendarDay).toEqual(
          { openTime: null, closeTime: null },
        )
        expect(
          (await dayOf({ date: daysAfter(DAY, 2) }))?.calendarDay,
        ).toBeNull()
      })

      it('reads no service that is not the salon’s or is deleted, and still the rest', async () => {
        const deleted = await insertService()
        await deleteService(deleted)
        const elsewhere = await insertService({}, await salon())

        const days = [
          await dayOf({ service: UNKNOWN_ID }),
          await dayOf({ service: deleted }),
          await dayOf({ service: elsewhere }),
        ]

        expect(days.map((day) => day?.service)).toEqual([null, null, null])
        expect(days.map((day) => day?.staff.map(({ id }) => id))).toEqual([
          [staffId],
          [staffId],
          [staffId],
        ])
      })

      it('reads the staff members of the salon that are not deleted, by their IDs, or the one that is asked for', async () => {
        const other = await staffMember({ isActive: false })
        const gone = await staffMember()
        await deleteStaff(gone)
        const elsewhere = await staffMember({}, await salon())

        expect((await dayOf())?.staff.map(({ id }) => id)).toEqual(
          [staffId, other].toSorted(),
        )
        expect((await dayOf({ by: other }))?.staff.map(({ id }) => id)).toEqual(
          [other],
        )
        expect((await dayOf({ by: gone }))?.staff).toEqual([])
        expect((await dayOf({ by: elsewhere }))?.staff).toEqual([])
        expect((await dayOf({ by: UNKNOWN_ID }))?.staff).toEqual([])
      })

      it('reads, of the schedule of each staff member, the row of the date and the weekly rows', async () => {
        const other = await staffMember()
        await works(daysAfter(DAY, 1))
        await works(daysAfter(DAY, -1))
        await db.insert(staffSchedules).values([
          {
            staffId,
            dayOfWeek: 'monday',
            isRecurring: true,
            startTime: '10:00',
            endTime: '15:00',
          },
          {
            staffId: other,
            dayOfWeek: 'tuesday',
            isRecurring: true,
            startTime: '11:00',
            endTime: '16:00',
          },
        ])

        const day = await dayOf()
        const rowsOf = (id: string) =>
          day?.staff
            .find((member) => member.id === id)
            ?.schedules.map(
              ({ date, dayOfWeek, startTime }) =>
                `${date ?? dayOfWeek} ${startTime}`,
            )
            .toSorted()

        expect(rowsOf(staffId)).toEqual(
          [`${DAY} 09:00:00`, 'monday 10:00:00'].toSorted(),
        )
        expect(rowsOf(other)).toEqual(['tuesday 11:00:00'])
      })

      it('reads the service lines that bookings have for each staff member, as moments', async () => {
        const other = await staffMember()
        const mine = await insertBooking(jst('14:00'))
        const theirs = await insertBooking(jst('15:00'), {
          by: other,
          minutes: 90,
        })
        await insertBooking(jst('16:00'), { lineBy: null })
        await insertBooking(jst('10:00'), inStatus('cancelled'))
        await insertBooking(jst('11:00'), inStatus('no_show'))

        const day = await dayOf()
        const takenOf = (id: string) =>
          day?.staff.find((member) => member.id === id)?.taken

        expect(takenOf(staffId)).toEqual([
          { bookingId: mine, startTime: jst('14:00'), endTime: jst('15:00') },
        ])
        expect(takenOf(other)).toEqual([
          { bookingId: theirs, startTime: jst('15:00'), endTime: jst('16:30') },
        ])
      })

      it('reads the lines that meet the date in any time zone, and none beyond', async () => {
        // The date begins 14 hours before midnight in UTC where the clocks
        // are furthest ahead, and ends 12 hours after the next midnight
        // where they are furthest behind.
        const first = utcMidnight - 14 * HOUR
        const end = utcMidnight + 36 * HOUR
        const ids = [
          await insertBooking(new Date(first - HOUR)),
          await insertBooking(new Date(first - HOUR + MINUTE)),
          await insertBooking(new Date(end - MINUTE)),
          await insertBooking(new Date(end)),
        ]

        const day = await dayOf()

        expect(
          day?.staff
            .at(0)
            ?.taken.map(({ bookingId }) => bookingId)
            .toSorted(),
        ).toEqual([ids.at(1), ids.at(2)].toSorted())
      })

      it('reads further by the longest time a staff member of the salon keeps free around a booking', async () => {
        await staffMember({ bufferTimeBefore: 10, bufferTimeAfter: 20 })
        const first = utcMidnight - 14 * HOUR - 30 * MINUTE
        const end = utcMidnight + 36 * HOUR + 30 * MINUTE
        const ids = [
          await insertBooking(new Date(first - HOUR)),
          await insertBooking(new Date(first - HOUR + MINUTE)),
          await insertBooking(new Date(end - MINUTE)),
          await insertBooking(new Date(end)),
        ]

        const day = await dayOf()

        expect(
          day?.staff
            .find(({ id }) => id === staffId)
            ?.taken.map(({ bookingId }) => bookingId)
            .toSorted(),
        ).toEqual([ids.at(1), ids.at(2)].toSorted())
      })

      it('reads when the lines of the service begin around the date, whoever they are with', async () => {
        const other = await staffMember()
        const color = await insertService({ name: 'Colour' })
        const first = utcMidnight - 14 * HOUR
        const end = utcMidnight + 36 * HOUR
        await insertBooking(new Date(first - MINUTE), { by: other })
        await insertBooking(new Date(first), { by: other })
        await insertBooking(jst('10:00'), { lineBy: null })
        await insertBooking(new Date(end - MINUTE), { by: other })
        await insertBooking(new Date(end), { by: other })
        await insertBooking(jst('11:00'), { service: color })
        await insertBooking(jst('12:00'), {
          by: other,
          ...inStatus('cancelled'),
        })
        await insertBooking(jst('13:00'), { by: other, ...inStatus('no_show') })

        const day = await dayOf()

        expect(
          day?.serviceLineStarts.map((start) => start.toISOString()).toSorted(),
        ).toEqual(
          [
            new Date(first).toISOString(),
            iso('10:00'),
            new Date(end - MINUTE).toISOString(),
          ].toSorted(),
        )
      })

      it('reads no line of a service that is deleted or of another salon, and still the lines of the staff', async () => {
        const deleted = await insertService()
        const mine = await insertBooking(jst('14:00'), { service: deleted })
        await deleteService(deleted)
        const elsewhere = await salon()
        const theirs = await insertService({}, elsewhere)
        await insertBooking(jst('15:00'), {
          of: elsewhere,
          by: await staffMember({}, elsewhere),
          service: theirs,
        })

        const days = [
          await dayOf({ service: deleted }),
          await dayOf({ service: theirs }),
        ]

        expect(days.map((day) => day?.service)).toEqual([null, null])
        expect(days.map((day) => day?.serviceLineStarts)).toEqual([[], []])
        expect(
          days.map((day) =>
            day?.staff.at(0)?.taken.map(({ bookingId }) => bookingId),
          ),
        ).toEqual([[mine], [mine]])
      })
    })

    describe('findOccupancy', () => {
      it('reads how long the service takes, what the staff member takes at once and nothing that is booked', async () => {
        const careful = await staffMember({
          bufferTimeBefore: 10,
          bufferTimeAfter: 20,
          maxConcurrentBookings: 3,
        })
        const color = await insertService({ name: 'Colour', duration: 90 })

        expect(await occupancyOf({ by: careful, service: color })).toEqual({
          service: { duration: 90 },
          staff: {
            bufferTimeBefore: 10,
            bufferTimeAfter: 20,
            maxConcurrentBookings: 3,
          },
          taken: [],
        })
      })

      it('reads no service and no staff member that is not the salon’s or is deleted, and no lines then', async () => {
        const elsewhere = await salon()
        const gone = await staffMember()
        await insertBooking(jst('10:00'), { by: gone })
        await deleteStaff(gone)
        const deleted = await insertService()
        await deleteService(deleted)
        await insertBooking(jst('10:00'))

        const occupancies = [
          await occupancyOf({ service: UNKNOWN_ID }),
          await occupancyOf({ service: deleted }),
          await occupancyOf({ service: await insertService({}, elsewhere) }),
          await occupancyOf({ by: UNKNOWN_ID }),
          await occupancyOf({ by: gone }),
          await occupancyOf({ by: await staffMember({}, elsewhere) }),
        ]

        expect(
          occupancies.map(
            ({ service, staff: member, taken }) =>
              `${service === null ? 'no service' : 'service'}, ${member === null ? 'no staff' : 'staff'}, ${taken.length}`,
          ),
        ).toEqual([
          'no service, staff, 0',
          'no service, staff, 0',
          'no service, staff, 0',
          'service, no staff, 0',
          'service, no staff, 0',
          'service, no staff, 0',
        ])
      })

      it('reads the lines of the staff member that can be in the way of the wanted time, as moments', async () => {
        const other = await staffMember()
        const before = await insertBooking(jst('09:01'))
        const after = await insertBooking(jst('10:59'), { minutes: 30 })
        await insertBooking(jst('09:00'))
        await insertBooking(jst('11:00'))
        await insertBooking(jst('10:00'), { by: other })
        await insertBooking(jst('10:00'), { lineBy: null })
        await insertBooking(jst('10:00'), inStatus('cancelled'))
        await insertBooking(jst('10:00'), inStatus('no_show'))

        const { taken } = await occupancyOf()

        expect(
          taken.toSorted(
            (one, other) => one.startTime.getTime() - other.startTime.getTime(),
          ),
        ).toEqual([
          { bookingId: before, startTime: jst('09:01'), endTime: jst('10:01') },
          { bookingId: after, startTime: jst('10:59'), endTime: jst('11:29') },
        ])
      })

      it('reads further by the time the staff member keeps free, on both sides', async () => {
        const careful = await staffMember({
          bufferTimeBefore: 10,
          bufferTimeAfter: 20,
        })
        // Half an hour lies between two services of this staff member.
        const ids = [
          await insertBooking(jst('08:30'), { by: careful }),
          await insertBooking(jst('08:31'), { by: careful }),
          await insertBooking(jst('11:29'), { by: careful }),
          await insertBooking(jst('11:30'), { by: careful }),
        ]

        const { taken } = await occupancyOf({ by: careful })

        expect(taken.map(({ bookingId }) => bookingId).toSorted()).toEqual(
          [ids.at(1), ids.at(2)].toSorted(),
        )
      })

      it('reads by the duration of the service that is asked about', async () => {
        const long = await insertService({ name: 'Colour', duration: 120 })
        const id = await insertBooking(jst('11:30'))

        expect((await occupancyOf()).taken).toEqual([])
        expect(
          (await occupancyOf({ service: long })).taken.map(
            ({ bookingId }) => bookingId,
          ),
        ).toEqual([id])
      })
    })
  })
})
