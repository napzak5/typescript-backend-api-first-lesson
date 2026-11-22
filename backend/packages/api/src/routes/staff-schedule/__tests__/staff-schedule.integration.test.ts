import { randomUUID } from 'node:crypto'
import { salons, staff, staffSchedules } from '@beauty-salon-backend/database'
import {
  type DbNewStaffSchedule,
  type DomainError,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { StaffScheduleRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { asc, desc, eq, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertMember,
  insertSalon,
  insertSession,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
  signInAsAdmin,
} from '../../../__tests__/_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

const SALONS = '/api/v1/salons'

/** Where the schedule of a staff member of a salon is. */
const schedulesOf = (salonId: string, staffId: string): string =>
  `${SALONS}/${salonId}/staff/${staffId}/schedules`

/** A UUID that neither a salon nor a staff member has. */
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

/** An entry of a schedule as the API takes and returns it. */
type Entry = {
  dayOfWeek: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  breakStartTime: string | null
  breakEndTime: string | null
  isRecurring: boolean
  isAvailable: boolean
  notes: string | null
}

type NewScheduleRow = typeof staffSchedules.$inferInsert

/** Exactly the properties of StaffSchedule. */
const ENTRY_PROPERTIES = [
  'dayOfWeek',
  'date',
  'startTime',
  'endTime',
  'breakStartTime',
  'breakEndTime',
  'isRecurring',
  'isAvailable',
  'notes',
]

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** A weekly entry of a working day with a break. */
const weekly = (
  dayOfWeek: string | null = 'monday',
  overrides: Partial<Entry> = {},
): Entry => ({
  dayOfWeek,
  date: null,
  startTime: '09:00:00',
  endTime: '18:00:00',
  breakStartTime: '12:00:00',
  breakEndTime: '13:00:00',
  isRecurring: true,
  isAvailable: true,
  notes: null,
  ...overrides,
})

/** An entry of a working day on a single date, without a break. */
const single = (
  date: string | null = '2026-12-31',
  overrides: Partial<Entry> = {},
): Entry => ({
  dayOfWeek: null,
  date,
  startTime: '10:00:00',
  endTime: '15:00:00',
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: false,
  isAvailable: true,
  notes: null,
  ...overrides,
})

/** An entry of a day off: on a date, or weekly when a day of the week is given. */
const dayOff = (
  day: { date?: string; dayOfWeek?: string },
  overrides: Partial<Entry> = {},
): Entry => ({
  dayOfWeek: day.dayOfWeek ?? null,
  date: day.date ?? null,
  startTime: null,
  endTime: null,
  breakStartTime: null,
  breakEndTime: null,
  isRecurring: day.dayOfWeek !== undefined,
  isAvailable: false,
  notes: null,
  ...overrides,
})

/** Entries for `count` consecutive dates from 2027-01-01 on. */
const singleDays = (count: number): Entry[] =>
  Array.from({ length: count }, (_, index) =>
    single(new Date(Date.UTC(2027, 0, 1 + index)).toISOString().slice(0, 10)),
  )

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
  ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
]

/**
 * A response in a few words: its status and, for a validation problem, the
 * broken rules, or else what the problem says.
 */
const outcomeOf = (response: Response): string => {
  if (response.status === 400 && response.body.code === '2001') {
    return `400 ${brokenRules(response).join(',')}`
  }
  return response.status === 404
    ? `404 ${response.body.detail}`
    : String(response.status)
}

/** The status and the code of a problem. */
const statusAndCode = (response: Response): string =>
  `${response.status} ${response.body.code}`

/** The days of the entries of a response, in its order. */
const daysOf = (response: Response): (string | null)[] =>
  response.body.data.map(({ dayOfWeek, date }: Entry) => dayOfWeek ?? date)

describe('Staff schedule API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of the staff member the tests are about. */
  let salonId: string
  /** The staff member whose schedule the tests are about. */
  let staffId: string

  /** Inserts a staff member as a row and returns its ID. */
  const insertStaffRow = async (
    salon: string = salonId,
    overrides: Partial<typeof staff.$inferInsert> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(staff)
      .values({
        salonId: salon,
        firstName: 'Hanako',
        lastName: 'Yamada',
        displayName: 'Hanako',
        email: `staff-${randomUUID()}@example.com`,
        phoneNumber: '090-1234-5678',
        specialties: [],
        certifications: [],
        ...overrides,
      })
      .returning({ id: staff.id })
    if (row === undefined) {
      throw new Error('No staff member was inserted')
    }
    return row.id
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
    staffId = await insertStaffRow()
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const get = (
    query = '',
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) =>
    authorized(
      request(app).get(
        query === ''
          ? schedulesOf(salon, id)
          : `${schedulesOf(salon, id)}?${query}`,
      ),
      as,
    )

  const put = (
    body: unknown,
    as: string | null = asAdmin,
    id: string = staffId,
    salon: string = salonId,
  ) =>
    authorized(request(app).put(schedulesOf(salon, id)), as)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(body))

  /** Replaces a schedule through the API as the admin and returns what is stored. */
  const replace = async (
    entries: Entry[],
    id: string = staffId,
    salon: string = salonId,
  ): Promise<Entry[]> => {
    const response = await put(entries, asAdmin, id, salon)
    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Inserts rows of a schedule as they are, without the API. */
  const insertRows = async (
    rows: Partial<NewScheduleRow>[],
    id: string = staffId,
  ): Promise<void> => {
    await db.insert(staffSchedules).values(
      rows.map((row) => ({
        staffId: id,
        startTime: '09:00',
        endTime: '18:00',
        ...row,
      })),
    )
  }

  /** Every stored row of every schedule, with its ID and timestamps. */
  const storedRows = () =>
    db.select().from(staffSchedules).orderBy(asc(staffSchedules.id))

  /** The stored rows of one staff member as entries, in the order of the API. */
  const storedEntries = async (id: string = staffId): Promise<Entry[]> =>
    (
      await db
        .select()
        .from(staffSchedules)
        .where(eq(staffSchedules.staffId, id))
        .orderBy(
          desc(staffSchedules.isRecurring),
          asc(staffSchedules.dayOfWeek),
          asc(staffSchedules.date),
        )
    ).map(
      ({
        id: _id,
        staffId: _staffId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...entry
      }) => entry,
    )

  const deleteStaff = async (id: string = staffId): Promise<void> => {
    const response = await request(app)
      .delete(`${SALONS}/${salonId}/staff/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  /** Hides a salon as `DELETE /api/v1/salons/:id` does; its rows stay. */
  const deleteSalon = async (id: string): Promise<void> => {
    const response = await request(app)
      .delete(`${SALONS}/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

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
            {
              expiresAt: minutesFromNow(-1),
            },
          )
        ).authorization,
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  /** A whole schedule, written out of order: three weekly entries and three single days. */
  const plan = (): Entry[] => [
    single('2026-12-31', { notes: '年末の短縮営業' }),
    weekly('sunday', { startTime: '10:00', endTime: '17:00:30' }),
    dayOff({ date: '2026-12-24' }, { notes: '通院' }),
    weekly('monday'),
    dayOff({ dayOfWeek: 'wednesday' }),
    single('2026-01-05', { startTime: '08:00', endTime: '12:00' }),
  ]

  /** The schedule above as it is stored and returned. */
  const storedPlan = (): Entry[] => [
    weekly('monday'),
    dayOff({ dayOfWeek: 'wednesday' }),
    weekly('sunday', { startTime: '10:00:00', endTime: '17:00:30' }),
    single('2026-01-05', { startTime: '08:00:00', endTime: '12:00:00' }),
    dayOff({ date: '2026-12-24' }, { notes: '通院' }),
    single('2026-12-31', { notes: '年末の短縮営業' }),
  ]

  describe('GET /api/v1/salons/:salonId/staff/:id/schedules', () => {
    it('returns an empty list for a staff member without a schedule', async () => {
      const response = await get()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: [],
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: schedulesOf(salonId, staffId),
          list: schedulesOf(salonId, staffId),
        },
      })
    })

    it('returns the rows of the staff member as entries: the weekly ones from Monday to Sunday, then the single days from the earliest on', async () => {
      await insertRows([
        { isRecurring: false, date: '2026-12-31' },
        { dayOfWeek: 'sunday' },
        { isRecurring: false, date: '2026-01-05' },
        { dayOfWeek: 'saturday' },
        { dayOfWeek: 'monday' },
        { isRecurring: false, date: '2027-01-01' },
        { dayOfWeek: 'friday' },
        { dayOfWeek: 'wednesday' },
        { dayOfWeek: 'tuesday' },
        { dayOfWeek: 'thursday' },
      ])

      const response = await get()

      expect(response.status).toBe(200)
      expect(daysOf(response)).toEqual([
        ...DAYS,
        '2026-01-05',
        '2026-12-31',
        '2027-01-01',
      ])
    })

    it('returns exactly the properties of an entry, the times with their seconds', async () => {
      await insertRows([
        {
          dayOfWeek: 'monday',
          startTime: '09:00',
          endTime: '18:30',
          breakStartTime: '12:00',
          breakEndTime: '13:15:30',
          notes: '早番',
        },
        {
          isRecurring: false,
          isAvailable: false,
          date: '2026-12-24',
          startTime: null,
          endTime: null,
          notes: '通院',
        },
      ])

      const response = await get()

      expect(response.body.data).toEqual([
        {
          dayOfWeek: 'monday',
          date: null,
          startTime: '09:00:00',
          endTime: '18:30:00',
          breakStartTime: '12:00:00',
          breakEndTime: '13:15:30',
          isRecurring: true,
          isAvailable: true,
          notes: '早番',
        },
        {
          dayOfWeek: null,
          date: '2026-12-24',
          startTime: null,
          endTime: null,
          breakStartTime: null,
          breakEndTime: null,
          isRecurring: false,
          isAvailable: false,
          notes: '通院',
        },
      ])
      for (const entry of response.body.data) {
        expect(Object.keys(entry).toSorted()).toEqual(
          ENTRY_PROPERTIES.toSorted(),
        )
      }
      expect(JSON.stringify(response.body.data)).not.toContain(staffId)
    })

    it('returns the schedule of the staff member of the path alone', async () => {
      const colleague = await insertStaffRow()
      const elsewhere = await insertStaffRow(await insertSalon(db))
      await insertRows([{ dayOfWeek: 'monday' }])
      await insertRows([{ dayOfWeek: 'tuesday' }], colleague)
      await insertRows([{ dayOfWeek: 'wednesday' }], elsewhere)

      const own = await get()
      const ofColleague = await get('', asAdmin, colleague)

      expect(daysOf(own)).toEqual(['monday'])
      expect(daysOf(ofColleague)).toEqual(['tuesday'])
    })

    it('returns the schedule of a staff member who is not active', async () => {
      const inactive = await insertStaffRow(salonId, { isActive: false })
      await insertRows([{ dayOfWeek: 'monday' }], inactive)

      const response = await get('', asAdmin, inactive)

      expect(response.status).toBe(200)
      expect(daysOf(response)).toEqual(['monday'])
    })

    describe('for a date', () => {
      // 2026-12-28 is a Monday, 2026-12-30 a Wednesday, 2026-12-31 a Thursday.
      beforeEach(async () => {
        await replace([
          weekly('monday'),
          dayOff({ dayOfWeek: 'wednesday' }, { notes: '定休' }),
          weekly('sunday'),
          single('2026-12-31'),
          dayOff({ date: '2027-01-04' }, { notes: '通院' }),
          single('2026-12-30', { notes: '振替出勤' }),
        ])
      })

      it.each([
        ['the weekly entry of its day of the week', '2026-12-28', [weekly()]],
        [
          'the same weekly entry on any other such day',
          '2031-03-03',
          [weekly()],
        ],
        ['the weekly entry in the past as well', '2020-01-06', [weekly()]],
        ['the weekly entry of a Sunday', '2027-01-03', [weekly('sunday')]],
        [
          'a weekly day off as the entry it is',
          '2026-12-23',
          [dayOff({ dayOfWeek: 'wednesday' }, { notes: '定休' })],
        ],
        ['the entry of that single day', '2026-12-31', [single('2026-12-31')]],
        [
          'the day off of that single day in place of the weekly entry',
          '2027-01-04',
          [dayOff({ date: '2027-01-04' }, { notes: '通院' })],
        ],
        [
          'the working day of that single day in place of the weekly day off',
          '2026-12-30',
          [single('2026-12-30', { notes: '振替出勤' })],
        ],
        ['nothing on a day of the week without an entry', '2026-12-29', []],
        [
          'nothing on the same day of the week as a single day, a week later',
          '2027-01-07',
          [],
        ],
      ])('returns %s', async (_case, date, entries) => {
        const response = await get(`date=${date}`)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(entries)
      })

      it('links the response to the request and to the whole schedule', async () => {
        const response = await get('date=2026-12-28')

        expect(response.body.links).toEqual({
          self: `${schedulesOf(salonId, staffId)}?date=2026-12-28`,
          list: schedulesOf(salonId, staffId),
        })
      })

      it('returns nothing for a staff member without a schedule', async () => {
        const response = await get(
          'date=2026-12-28',
          asAdmin,
          await insertStaffRow(),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual([])
      })
    })

    it.each([
      ['a date that is not one', 'date=abc', ['date:invalid_format']],
      [
        'a date that does not exist',
        'date=2026-02-30',
        ['date:invalid_format'],
      ],
      [
        'a date with a time',
        'date=2026-12-31T09:00:00Z',
        ['date:invalid_format'],
      ],
      ['a date without a value', 'date=', ['date:invalid_format']],
      [
        'a date that is given twice',
        'date=2026-12-30&date=2026-12-31',
        ['date:invalid_type'],
      ],
      [
        'a parameter of the lists with pages',
        'limit=20',
        ['limit:unrecognized_keys'],
      ],
      [
        'a valid date and an unknown parameter',
        'date=2026-12-31&isAvailable=true',
        ['isAvailable:unrecognized_keys'],
      ],
    ])('answers %s with 400', async (_case, query, rules) => {
      await insertRows([{ dayOfWeek: 'monday' }])

      const response = await get(query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid staff schedule search')
      expect(brokenRules(response)).toEqual(rules)
    })

    it.each(malformedIds)(
      'answers %s as the salon with 400',
      async (_case, salon) => {
        const response = await get('', asAdmin, staffId, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
      },
    )

    it.each(malformedIds)(
      'answers %s as the staff member with 400',
      async (_case, id) => {
        const response = await get('', asAdmin, id)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff ID')
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      },
    )

    it('reports a staff member that does not exist, one of another salon and a deleted one as not found, in the same words', async () => {
      const elsewhere = await insertStaffRow(await insertSalon(db))
      const leaving = await insertStaffRow()
      await insertRows([{ dayOfWeek: 'monday' }], elsewhere)
      await insertRows([{ dayOfWeek: 'monday' }], leaving)
      await deleteStaff(leaving)

      for (const id of [UNKNOWN_ID, elsewhere, leaving]) {
        for (const query of ['', 'date=2026-12-28']) {
          const response = await get(query, asAdmin, id)

          expectProblem(response, notFound)
          expect(response.body.detail).toBe(`Staff member ${id} was not found`)
        }
      }
    })

    it('reports a salon that does not exist, and a deleted one, as not found', async () => {
      const gone = await insertSalon(db)
      const ofGone = await insertStaffRow(gone)
      await deleteSalon(gone)

      const unknown = await get('', asAdmin, staffId, UNKNOWN_ID)
      const deleted = await get('', asAdmin, ofGone, gone)

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expectProblem(deleted, notFound)
      expect(deleted.body.detail).toBe(`Salon ${gone} was not found`)
    })
  })

  describe('PUT /api/v1/salons/:salonId/staff/:id/schedules', () => {
    it('stores the entries as the schedule of the staff member and returns them as stored: in the order of the list, the times with their seconds', async () => {
      const response = await put(plan())

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: storedPlan(),
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: schedulesOf(salonId, staffId),
          list: schedulesOf(salonId, staffId),
        },
      })
      expect(await storedEntries()).toEqual(storedPlan())
      expect((await get()).body.data).toEqual(storedPlan())
      for (const row of await storedRows()) {
        expect(row.staffId).toBe(staffId)
      }
    })

    it('names the schedule in its links, without a query that the request carried', async () => {
      const response = await authorized(
        request(app).put(`${schedulesOf(salonId, staffId)}?date=2026-12-31`),
        asAdmin,
      )
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(plan()))

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(storedPlan())
      expect(response.body.links).toEqual({
        self: schedulesOf(salonId, staffId),
        list: schedulesOf(salonId, staffId),
      })
    })

    it('puts the entries in the place of everything that was there, and leaves no row of the old schedule', async () => {
      await insertRows([
        { dayOfWeek: 'monday', notes: 'old' },
        { dayOfWeek: 'tuesday', notes: 'old' },
        { isRecurring: false, date: '2026-12-31', notes: 'old' },
      ])
      const before = (await storedRows()).map(({ id }) => id)

      const response = await put([weekly('tuesday', { notes: 'new' })])

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([weekly('tuesday', { notes: 'new' })])
      const after = await storedRows()
      expect(after).toHaveLength(1)
      expect(before).not.toContain(after[0]?.id)
      expect(await storedEntries()).toEqual([
        weekly('tuesday', { notes: 'new' }),
      ])
    })

    it('leaves a staff member without a schedule for an empty list', async () => {
      await replace(plan())

      const response = await put([])

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([])
      expect(await storedRows()).toEqual([])
      expect((await get('date=2026-12-28')).body.data).toEqual([])
    })

    it('accepts what a read returned, and stores the same schedule again', async () => {
      await replace(plan())
      const read = await get()

      const response = await put(read.body.data)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(read.body.data)
      expect(await storedEntries()).toEqual(storedPlan())
    })

    it('leaves the schedules of the other staff members, and the staff member itself, as they are', async () => {
      const colleague = await insertStaffRow()
      const elsewhere = await insertStaffRow(await insertSalon(db))
      await insertRows([{ dayOfWeek: 'monday' }], colleague)
      await insertRows([{ dayOfWeek: 'monday' }], elsewhere)
      const others = await storedRows()
      const members = await db.select().from(staff).orderBy(asc(staff.id))

      await replace(plan())
      await replace([])

      expect(await storedRows()).toEqual(others)
      expect(await db.select().from(staff).orderBy(asc(staff.id))).toEqual(
        members,
      )
    })

    it('replaces the schedule of a staff member who is not active', async () => {
      const inactive = await insertStaffRow(salonId, { isActive: false })

      const response = await put([weekly()], asAdmin, inactive)

      expect(response.status).toBe(200)
      expect(await storedEntries(inactive)).toEqual([weekly()])
    })

    it('accepts a weekly entry for every day of the week and an entry of a single day on one of them', async () => {
      const entries = [...DAYS.map((day) => weekly(day)), single('2026-12-28')]

      const response = await put(entries)

      expect(response.status).toBe(200)
      expect(daysOf(response)).toEqual([...DAYS, '2026-12-28'])
    })

    it('accepts 373 entries, the seven weekly ones and one for every day of a year, and no more', async () => {
      const weeklyEntries = DAYS.map((day) => weekly(day))

      const full = await put([...weeklyEntries, ...singleDays(366)])
      const tooMany = await put([...weeklyEntries, ...singleDays(367)])

      expect(full.status).toBe(200)
      expect(full.body.data).toHaveLength(373)
      expectProblem(tooMany, badRequest)
      expect(brokenRules(tooMany)).toEqual([':too_big'])
      expect(await storedRows()).toHaveLength(373)
    })

    it.each<[string, unknown, string[]]>([
      ['an object', { schedules: [] }, [':invalid_type']],
      ['one entry that is not in a list', weekly(), [':invalid_type']],
      ['a list of text', ['monday'], ['0:invalid_type']],
      ['a list with null', [weekly(), null], ['1:invalid_type']],
      [
        'an entry without notes',
        [{ ...weekly(), notes: undefined }],
        ['0.notes:invalid_type'],
      ],
      [
        'an entry with the ID of a row',
        [{ ...weekly(), id: UNKNOWN_ID }],
        ['0.id:unrecognized_keys'],
      ],
      [
        'an entry that names a staff member',
        [{ ...weekly(), staffId: UNKNOWN_ID }],
        ['0.staffId:unrecognized_keys'],
      ],
      [
        'a weekly entry without a day of the week',
        [weekly(null)],
        ['0.dayOfWeek:custom'],
      ],
      [
        'a weekly entry with a date',
        [weekly('monday', { date: '2026-12-28' })],
        ['0.date:custom'],
      ],
      [
        'an entry of a single day without a date',
        [single(null)],
        ['0.date:custom'],
      ],
      [
        'an entry of a single day with a day of the week',
        [single('2026-12-28', { dayOfWeek: 'monday' })],
        ['0.dayOfWeek:custom'],
      ],
      [
        'an unknown day of the week',
        [weekly('holiday')],
        ['0.dayOfWeek:invalid_value'],
      ],
      [
        'a date that does not exist',
        [single('2026-02-30')],
        ['0.date:invalid_format'],
      ],
      [
        'a working day without a start',
        [weekly('monday', { startTime: null })],
        ['0.startTime:custom'],
      ],
      [
        'a working day without an end',
        [weekly('monday', { endTime: null })],
        ['0.endTime:custom'],
      ],
      [
        'a day off with working hours',
        [
          dayOff(
            { dayOfWeek: 'monday' },
            { startTime: '09:00', endTime: '18:00' },
          ),
        ],
        ['0.startTime:custom', '0.endTime:custom'],
      ],
      [
        'a day off with a break',
        [
          dayOff(
            { date: '2026-12-24' },
            { breakStartTime: '12:00', breakEndTime: '13:00' },
          ),
        ],
        ['0.breakStartTime:custom', '0.breakEndTime:custom'],
      ],
      [
        'an end before the start',
        [single('2026-12-31', { startTime: '18:00', endTime: '09:00' })],
        ['0.endTime:custom'],
      ],
      [
        'an end at the start',
        [single('2026-12-31', { startTime: '09:00', endTime: '09:00:00' })],
        ['0.endTime:custom'],
      ],
      [
        'an end of 24:00',
        [single('2026-12-31', { endTime: '24:00' })],
        ['0.endTime:invalid_format'],
      ],
      [
        'a start of 9:00',
        [single('2026-12-31', { startTime: '9:00' })],
        ['0.startTime:invalid_format'],
      ],
      [
        'a break without an end',
        [weekly('monday', { breakEndTime: null })],
        ['0.breakEndTime:custom'],
      ],
      [
        'a break without a start',
        [weekly('monday', { breakStartTime: null })],
        ['0.breakStartTime:custom'],
      ],
      [
        'a break that starts with the working hours',
        [weekly('monday', { breakStartTime: '09:00' })],
        ['0.breakStartTime:custom'],
      ],
      [
        'a break that ends with the working hours',
        [weekly('monday', { breakEndTime: '18:00' })],
        ['0.breakEndTime:custom'],
      ],
      [
        'a break that ends before it starts',
        [weekly('monday', { breakStartTime: '13:00', breakEndTime: '12:00' })],
        ['0.breakEndTime:custom'],
      ],
      [
        'blank notes',
        [weekly('monday', { notes: '  ' })],
        ['0.notes:invalid_format'],
      ],
      [
        'isRecurring as text',
        [{ ...weekly(), isRecurring: 'true' }],
        ['0.isRecurring:invalid_type'],
      ],
      [
        'two weekly entries for one day of the week',
        [weekly('monday'), weekly('tuesday'), dayOff({ dayOfWeek: 'monday' })],
        ['2.dayOfWeek:custom'],
      ],
      [
        'two entries for one date',
        [single('2026-12-28'), dayOff({ date: '2026-12-28' })],
        ['1.date:custom'],
      ],
      [
        'a valid entry followed by an invalid one',
        [
          weekly('friday'),
          single('2026-12-31', { startTime: '18:00', endTime: '09:00' }),
        ],
        ['1.endTime:custom'],
      ],
    ])(
      'answers %s with 400 and changes nothing',
      async (_case, body, rules) => {
        await replace(plan())
        const before = await storedRows()

        const response = await put(body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff schedule update')
        expect(brokenRules(response)).toEqual(rules)
        expect(await storedRows()).toEqual(before)
      },
    )

    it('names the entry, the property and the rule of every broken rule', async () => {
      const response = await put([
        weekly('monday', { breakStartTime: '09:00' }),
        weekly('monday'),
      ])

      expect(response.body.errors).toEqual([
        expect.objectContaining({
          field: '0.breakStartTime',
          rule: 'custom',
          message: 'Must be later than startTime',
        }),
        expect.objectContaining({
          field: '1.dayOfWeek',
          rule: 'custom',
          message: 'Must not repeat the day of the week of an earlier entry',
        }),
      ])
    })

    it.each(malformedIds)(
      'answers %s as the salon with 400',
      async (_case, salon) => {
        const response = await put([], asAdmin, staffId, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
      },
    )

    it.each(malformedIds)(
      'answers %s as the staff member with 400',
      async (_case, id) => {
        const response = await put([], asAdmin, id)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      },
    )

    it('reports a staff member that does not exist, one of another salon and a deleted one as not found, and writes nothing for them', async () => {
      const elsewhere = await insertStaffRow(await insertSalon(db))
      const leaving = await insertStaffRow()
      await insertRows([{ dayOfWeek: 'monday', notes: 'kept' }], elsewhere)
      await insertRows([{ dayOfWeek: 'monday', notes: 'kept' }], leaving)
      await deleteStaff(leaving)
      const before = await storedRows()

      for (const id of [UNKNOWN_ID, elsewhere, leaving]) {
        const response = await put([weekly('tuesday')], asAdmin, id)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Staff member ${id} was not found`)
      }
      expect(await storedRows()).toEqual(before)
    })

    it('reports a salon that does not exist, and a deleted one, as not found, and writes nothing', async () => {
      const gone = await insertSalon(db)
      const ofGone = await insertStaffRow(gone)
      await deleteSalon(gone)

      const unknown = await put([weekly()], asAdmin, staffId, UNKNOWN_ID)
      const deleted = await put([weekly()], asAdmin, ofGone, gone)

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expectProblem(deleted, notFound)
      expect(deleted.body.detail).toBe(`Salon ${gone} was not found`)
      expect(await storedRows()).toEqual([])
    })
  })

  describe('what a schedule does not have', () => {
    it.each<['post' | 'patch' | 'delete']>([['post'], ['patch'], ['delete']])(
      'has no %s: a schedule is read and replaced as a whole',
      async (method) => {
        const stored = await replace(plan())
        const path = schedulesOf(salonId, staffId)

        const response = await request(app)
          [method](path)
          .set('Authorization', asAdmin)
          .send([weekly()])

        expectProblem(response, routeNotFound)
        expect(response.body.detail).toBe(
          `${method.toUpperCase()} ${path} is not part of the API`,
        )
        expect(await storedEntries()).toEqual(stored)
      },
    )

    it('has no route for one entry', async () => {
      await replace(plan())
      const [row] = await storedRows()
      const path = `${schedulesOf(salonId, staffId)}/${row?.id}`

      const response = await request(app)
        .get(path)
        .set('Authorization', asAdmin)

      expectProblem(response, routeNotFound)
      expect(response.body.detail).toBe(`GET ${path} is not part of the API`)
    })
  })

  describe('IDs written in upper case', () => {
    it('name the same salon and the same staff member', async () => {
      const salonInUpperCase = salonId.toUpperCase()
      const idInUpperCase = staffId.toUpperCase()

      const replaced = await put(
        [weekly()],
        asAdmin,
        idInUpperCase,
        salonInUpperCase,
      )
      const read = await get('', asAdmin, idInUpperCase, salonInUpperCase)

      expect(replaced.status).toBe(200)
      expect(read.status).toBe(200)
      expect(read.body.data).toEqual([weekly()])
      expect(await storedEntries()).toEqual([weekly()])
    })
  })

  describe('who may read and plan the schedules of a salon', () => {
    /** Signs in and returns the Authorization header to send. */
    type SignInAs = (salon: string, otherSalon: string) => Promise<string>

    const member =
      (
        role: 'owner' | 'manager' | 'staff',
        staffOverrides: Parameters<typeof insertMember>[3] = {},
      ): SignInAs =>
      async (salon) => {
        const { email } = await insertMember(db, role, salon, staffOverrides)
        return (await signIn(app, email)).authorization
      }

    const memberOfOther =
      (role: 'owner' | 'manager' | 'staff'): SignInAs =>
      async (salon, otherSalon) =>
        member(role)(otherSalon, salon)

    const customer: SignInAs = async () =>
      (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
        .authorization

    /** A signed-in user with a role at the salon under test, and the staff member they are. */
    const signedInMember = async (role: 'owner' | 'manager' | 'staff') => {
      const { email, staffId: ownStaffId } = await insertMember(
        db,
        role,
        salonId,
      )
      return {
        staffId: ownStaffId,
        authorization: (await signIn(app, email)).authorization,
      }
    }

    /** Who reads and replaces the schedule of any staff member of the salon under test. */
    const planners: [string, SignInAs][] = [
      ['an admin', async () => asAdmin],
      ['the owner of the salon', member('owner')],
      ['a manager of the salon', member('manager')],
    ]

    /** Who reads and replaces none. The last five have a role without the record it needs. */
    const outsiders: [string, SignInAs][] = [
      ['the owner of another salon', memberOfOther('owner')],
      ['a manager of another salon', memberOfOther('manager')],
      ['a staff member of another salon', memberOfOther('staff')],
      ['a customer', customer],
      [
        'an owner user without a staff member',
        async () =>
          (await signedInUser(app, db, { role: 'owner' })).authorization,
      ],
      [
        'a customer user without a customer',
        async () => (await signedInUser(app, db)).authorization,
      ],
      [
        'a manager whose staff member is inactive',
        member('manager', { isActive: false }),
      ],
      [
        'a manager whose staff member is deleted',
        member('manager', { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
      [
        'a staff member whose staff member is inactive',
        member('staff', { isActive: false }),
      ],
    ]

    it.each(unauthenticated)(
      'answers %s with 401 in both operations before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        await replace(plan())
        const authorization = await tokenOf()
        const before = await storedRows()

        const responses = [
          await get('', authorization),
          await get('date=abc&limit=5', authorization),
          await get('', authorization, 'latest', 'latest'),
          await get('', authorization, UNKNOWN_ID, UNKNOWN_ID),
          await put([], authorization),
          await put({ schedules: [] }, authorization),
          await put([], authorization, 'latest', 'latest'),
          await put([], authorization, UNKNOWN_ID, UNKNOWN_ID),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedRows()).toEqual(before)
      },
    )

    it.each(planners)(
      'lets %s read and replace the schedule of any staff member of the salon',
      async (_case, signInAs) => {
        const colleague = await insertStaffRow()
        const authorization = await signInAs(salonId, await insertSalon(db))

        const replaced = await put(plan(), authorization)
        const read = await get('', authorization)
        const onADate = await get('date=2026-12-28', authorization)
        const ofColleague = await put(
          [weekly('friday')],
          authorization,
          colleague,
        )
        const emptied = await put([], authorization)

        expect(replaced.status).toBe(200)
        expect(read.status).toBe(200)
        expect(read.body.data).toEqual(storedPlan())
        expect(onADate.body.data).toEqual([weekly()])
        expect(ofColleague.status).toBe(200)
        expect(emptied.status).toBe(200)
        expect(await storedEntries()).toEqual([])
        expect(await storedEntries(colleague)).toEqual([weekly('friday')])
      },
    )

    it.each<[string, 'owner' | 'manager']>([
      ['the owner', 'owner'],
      ['a manager', 'manager'],
    ])(
      'lets %s of the salon replace their own schedule and the one of the owner',
      async (_case, role) => {
        const actor = await signedInMember(role)
        const owner = await signedInMember('owner')

        const own = await put([weekly()], actor.authorization, actor.staffId)
        const ofOwner = await put(
          [weekly('tuesday')],
          actor.authorization,
          owner.staffId,
        )

        expect(own.status).toBe(200)
        expect(ofOwner.status).toBe(200)
        expect(await storedEntries(actor.staffId)).toEqual([weekly()])
        expect(await storedEntries(owner.staffId)).toEqual([weekly('tuesday')])
      },
    )

    it('lets a staff member of the salon read their own schedule, whole and for a date', async () => {
      const actor = await signedInMember('staff')
      await replace(plan(), actor.staffId)

      const whole = await get('', actor.authorization, actor.staffId)
      const onADate = await get(
        'date=2026-12-24',
        actor.authorization,
        actor.staffId,
      )
      const inUpperCase = await get(
        '',
        actor.authorization,
        actor.staffId.toUpperCase(),
      )

      expect(whole.status).toBe(200)
      expect(whole.body.data).toEqual(storedPlan())
      expect(onADate.body.data).toEqual([
        dayOff({ date: '2026-12-24' }, { notes: '通院' }),
      ])
      expect(inUpperCase.status).toBe(200)
    })

    it('forbids a staff member of the salon the schedules of the others, existing or not, before looking at the query', async () => {
      const actor = await signedInMember('staff')
      const colleague = await signedInMember('staff')
      const owner = await signedInMember('owner')
      await replace(plan(), colleague.staffId)

      const responses = [
        await get('', actor.authorization, colleague.staffId),
        await get('date=2026-12-28', actor.authorization, colleague.staffId),
        await get('date=abc&limit=5', actor.authorization, colleague.staffId),
        await get('', actor.authorization, owner.staffId),
        await get('', actor.authorization),
        await get('', actor.authorization, UNKNOWN_ID),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
        expect(response.headers['www-authenticate']).toBeUndefined()
      }
    })

    it('forbids a staff member of the salon every replacement, their own schedule too, before looking at the staff ID or the body, and changes nothing', async () => {
      const actor = await signedInMember('staff')
      await replace(plan(), actor.staffId)
      await replace(plan())
      const before = await storedRows()

      const responses = [
        await put([], actor.authorization, actor.staffId),
        await put([weekly()], actor.authorization, actor.staffId),
        await put({ schedules: [] }, actor.authorization, actor.staffId),
        await put([], actor.authorization),
        await put([], actor.authorization, 'latest'),
        await put([], actor.authorization, UNKNOWN_ID),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await storedRows()).toEqual(before)
    })

    it.each(outsiders)(
      'forbids %s both operations, before looking at the staff ID, the query or the body, or for the salon or the staff member, and changes nothing',
      async (_case, signInAs) => {
        await replace(plan())
        const authorization = await signInAs(salonId, await insertSalon(db))
        const before = await storedRows()

        const responses = [
          await get('', authorization),
          await get('date=2026-12-28', authorization),
          await get('date=abc&limit=5', authorization),
          await get('', authorization, 'latest'),
          await get('', authorization, UNKNOWN_ID),
          await get('', authorization, staffId, UNKNOWN_ID),
          await put([], authorization),
          await put([weekly()], authorization),
          await put({ schedules: [] }, authorization),
          await put([], authorization, 'latest'),
          await put([], authorization, UNKNOWN_ID),
          await put([], authorization, staffId, UNKNOWN_ID),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
          expect(response.body.detail).toBe(
            'This account is not allowed to do this',
          )
          expect(response.headers['www-authenticate']).toBeUndefined()
        }
        expect(await storedRows()).toEqual(before)
      },
    )

    it('forbids a member of a salon their own staff ID in the path of another salon', async () => {
      const actor = await signedInMember('staff')
      const manager = await signedInMember('manager')
      const otherSalon = await insertSalon(db)

      const responses = [
        await get('', actor.authorization, actor.staffId, otherSalon),
        await get('', manager.authorization, manager.staffId, otherSalon),
        await put([], manager.authorization, manager.staffId, otherSalon),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it('answers a member of a salon that is deleted with 403, and an admin with 404', async () => {
      const owner = await signedInMember('owner')
      await deleteSalon(salonId)

      const fromOwner = [
        await get('', owner.authorization),
        await put([], owner.authorization),
      ]
      const fromAdmin = [await get(), await put([])]

      for (const response of fromOwner) {
        expectProblem(response, forbidden)
      }
      for (const response of fromAdmin) {
        expectProblem(response, notFound)
      }
    })

    /** Sends a body that says it is JSON but is not. */
    const notJson = (call: Test, authorization: string | null): Test =>
      authorized(call, authorization)
        .set('Content-Type', 'application/json')
        .send('[{"dayOfWeek": "monday"')

    it('answers a body it cannot read before it looks at the token or the permission, as every route does', async () => {
      const refused = await member('staff')(salonId, salonId)
      const schedules = schedulesOf(salonId, staffId)

      const responses = [
        await notJson(request(app).put(schedules), null),
        await authorized(request(app).put(schedules), null)
          .set('Content-Type', 'text/plain')
          .send('monday 9-18'),
        await notJson(request(app).put(schedules), refused),
        await notJson(
          request(app).put(schedulesOf('latest', 'latest')),
          refused,
        ),
        await authorized(request(app).put(schedules), asAdmin)
          .set('Content-Type', 'application/json')
          .send(
            JSON.stringify(
              singleDays(300).map((entry) => ({
                ...entry,
                notes: 'n'.repeat(400),
              })),
            ),
          ),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '415 2002',
        '400 2002',
        '400 2002',
        '413 2004',
      ])
      expect(await storedRows()).toEqual([])
    })

    it('checks a read in order: the token, the salon ID, the permission for the salon, the staff ID, whose schedule it is, the query, the salon, the staff member', async () => {
      const outsider = await customer(salonId, salonId)
      const actor = await signedInMember('staff')

      const outcomes = [
        await get('date=abc', null, 'latest', 'latest'),
        await get('date=abc', outsider, 'latest', 'latest'),
        await get('date=abc', outsider, 'latest', UNKNOWN_ID),
        await get('date=abc', actor.authorization, 'latest'),
        await get('date=abc', actor.authorization, UNKNOWN_ID),
        await get('date=abc', actor.authorization, actor.staffId),
        await get('date=abc', asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await get('', asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await get('', asAdmin, UNKNOWN_ID),
        await get('', asAdmin),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '400 id:invalid_format',
        '403',
        '400 date:invalid_format',
        '400 date:invalid_format',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        '200',
      ])
    })

    it('checks a replacement in order: the token, the salon ID, the permission, the staff ID, the body, the salon, the staff member', async () => {
      const refused = await member('staff')(salonId, salonId)
      const invalid = { schedules: [] }

      const outcomes = [
        await put(invalid, null, 'latest', 'latest'),
        await put(invalid, refused, 'latest', 'latest'),
        await put(invalid, refused, 'latest', UNKNOWN_ID),
        await put(invalid, asAdmin, 'latest', UNKNOWN_ID),
        await put(invalid, asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await put([], asAdmin, UNKNOWN_ID, UNKNOWN_ID),
        await put([], asAdmin, UNKNOWN_ID),
        await put([], asAdmin),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '400 id:invalid_format',
        '400 :invalid_type',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        '200',
      ])
    })
  })

  describe('a staff member who is deleted and still has a schedule', () => {
    it('keeps the rows, and neither returns nor replaces them', async () => {
      await replace(plan())
      const before = await storedRows()
      await deleteStaff()

      const responses = [
        await get(),
        await get('date=2026-12-28'),
        await put([]),
        await put([weekly('friday')]),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Staff member ${staffId} was not found`,
        )
      }
      expect(await storedRows()).toEqual(before)
    })
  })

  describe('requests at the same moment', () => {
    /** A whole schedule that names its writer in every entry. */
    const planOf = (writer: number): Entry[] => [
      ...DAYS.map((day) =>
        weekly(day, {
          startTime: `0${writer}:00:00`,
          notes: `writer ${writer}`,
        }),
      ),
      ...singleDays(20).map((entry) => ({
        ...entry,
        notes: `writer ${writer}`,
      })),
    ]

    it('stores the schedule of one of several replacements that arrive together, whole, and answers each with its own', async () => {
      const writers = [1, 2, 3, 4, 5, 6]

      for (let round = 0; round < 5; round += 1) {
        const responses = await Promise.all(
          writers.map((writer) => put(planOf(writer))),
        )

        expect(responses.map(({ status }) => status)).toEqual(
          writers.map(() => 200),
        )
        for (const [index, response] of responses.entries()) {
          const writer = writers[index] ?? 0
          expect(response.body.data).toEqual(
            planOf(writer).map((entry) => ({ ...entry })),
          )
        }
        const stored = await storedEntries()
        expect(stored).toHaveLength(27)
        expect(new Set(stored.map(({ notes }) => notes)).size).toBe(1)
      }
    })

    it('answers a read during replacements with one whole schedule', async () => {
      await replace(planOf(1))

      for (let round = 0; round < 5; round += 1) {
        const [first, second, ...reads] = await Promise.all([
          put(planOf(2 + (round % 2))),
          put(planOf(4 + (round % 2))),
          get(),
          get(),
          get(),
          get(),
        ])

        expect(first?.status).toBe(200)
        expect(second?.status).toBe(200)
        for (const read of reads) {
          expect(read.status).toBe(200)
          expect(read.body.data).toHaveLength(27)
          expect(
            new Set(read.body.data.map(({ notes }: Entry) => notes)).size,
          ).toBe(1)
        }
      }
    })

    it('answers a replacement that meets the deletion of the staff member with 200 or 404, and the schedule is not found afterwards', async () => {
      for (let round = 0; round < 5; round += 1) {
        const leaving = await insertStaffRow()

        const [replaced, deleted] = await Promise.all([
          put(planOf(1), asAdmin, leaving),
          request(app)
            .delete(`${SALONS}/${salonId}/staff/${leaving}`)
            .set('Authorization', asAdmin),
        ])

        expect([200, 404]).toContain(replaced.status)
        expect(deleted.status).toBe(204)
        expect((await get('', asAdmin, leaving)).status).toBe(404)
      }
    })

    it('waits for a deletion of the staff member that is under way, then writes nothing and answers 404', async () => {
      const leaving = await insertStaffRow()
      await insertRows([{ dayOfWeek: 'monday', notes: 'before' }], leaving)

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(staff)
          .set({ deletedAt: sql`now()` })
          .where(eq(staff.id, leaving))
        // The request is under way while the deletion is not committed yet.
        const underWay = put(plan(), asAdmin, leaving).then(
          (response) => response,
        )
        await new Promise((resolve) => setTimeout(resolve, 300))

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Staff member ${leaving} was not found`)
      expect((await storedEntries(leaving)).map(({ notes }) => notes)).toEqual([
        'before',
      ])
    })
  })

  describe('StaffScheduleRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new StaffScheduleRepository(db)
    const salon = (id: string) => salonIdSchema.parse(id)
    const member = (id: string) => staffIdSchema.parse(id)

    /** The values of a weekly row of a working day without a break. */
    const newRow = (
      overrides: Partial<DbNewStaffSchedule> = {},
    ): DbNewStaffSchedule => ({
      dayOfWeek: 'monday',
      date: null,
      startTime: '09:00',
      endTime: '18:00',
      breakStartTime: null,
      breakEndTime: null,
      isRecurring: true,
      isAvailable: true,
      notes: null,
      ...overrides,
    })

    const daysOfRows = (
      rows: { dayOfWeek: string | null; date: string | null }[] | null,
    ): (string | null)[] =>
      (rows ?? []).map(({ dayOfWeek, date }) => dayOfWeek ?? date)

    describe('findByStaff', () => {
      it('resolves to the rows of the staff member, whole and in the order of the schedule', async () => {
        await insertRows([
          { isRecurring: false, date: '2026-12-31' },
          { dayOfWeek: 'sunday' },
          { dayOfWeek: 'monday', notes: '早番' },
          { isRecurring: false, date: '2026-01-05' },
        ])

        const rows = dataOf(
          await repository().findByStaff(salon(salonId), member(staffId)),
        )

        expect(daysOfRows(rows)).toEqual([
          'monday',
          'sunday',
          '2026-01-05',
          '2026-12-31',
        ])
        expect(rows?.[0]).toEqual({
          id: expect.stringMatching(UUID),
          staffId,
          dayOfWeek: 'monday',
          date: null,
          startTime: '09:00:00',
          endTime: '18:00:00',
          breakStartTime: null,
          breakEndTime: null,
          isRecurring: true,
          isAvailable: true,
          notes: '早番',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
      })

      it('resolves to no rows for a staff member without a schedule', async () => {
        expect(
          dataOf(
            await repository().findByStaff(salon(salonId), member(staffId)),
          ),
        ).toEqual([])
      })

      it('resolves to null for a staff member that does not exist, one of another salon and a deleted one', async () => {
        const otherSalon = await insertSalon(db)
        const leaving = await insertStaffRow()
        await insertRows([{ dayOfWeek: 'monday' }])
        await insertRows([{ dayOfWeek: 'monday' }], leaving)
        await deleteStaff(leaving)

        const results = [
          await repository().findByStaff(salon(salonId), member(UNKNOWN_ID)),
          await repository().findByStaff(salon(otherSalon), member(staffId)),
          await repository().findByStaff(salon(UNKNOWN_ID), member(staffId)),
          await repository().findByStaff(salon(salonId), member(leaving)),
        ]

        expect(results.map(dataOf)).toEqual([null, null, null, null])
      })

      it('does not look at whether the salon is deleted', async () => {
        await insertRows([{ dayOfWeek: 'monday' }])
        await db
          .update(salons)
          .set({ deletedAt: sql`now()` })
          .where(eq(salons.id, salonId))

        const rows = dataOf(
          await repository().findByStaff(salon(salonId), member(staffId)),
        )

        expect(daysOfRows(rows)).toEqual(['monday'])
      })
    })

    describe('replace', () => {
      it('writes the rows for the staff member and resolves to them as stored, in the order of the schedule', async () => {
        await insertRows([{ dayOfWeek: 'friday', notes: 'old' }])

        const rows = dataOf(
          await repository().replace(salon(salonId), member(staffId), [
            newRow({ isRecurring: false, dayOfWeek: null, date: '2026-12-31' }),
            newRow({ dayOfWeek: 'tuesday' }),
            newRow({
              isAvailable: false,
              startTime: null,
              endTime: null,
              notes: '定休',
            }),
          ]),
        )

        expect(daysOfRows(rows)).toEqual(['monday', 'tuesday', '2026-12-31'])
        expect(rows?.[0]).toMatchObject({
          staffId,
          startTime: null,
          endTime: null,
          isAvailable: false,
          notes: '定休',
        })
        expect(rows?.[1]).toMatchObject({
          startTime: '09:00:00',
          endTime: '18:00:00',
        })
        expect(await storedRows()).toEqual(
          (rows ?? []).toSorted((left, right) => (left.id < right.id ? -1 : 1)),
        )
      })

      it('removes every row for no rows', async () => {
        await insertRows([{ dayOfWeek: 'friday' }, { dayOfWeek: 'monday' }])

        const rows = dataOf(
          await repository().replace(salon(salonId), member(staffId), []),
        )

        expect(rows).toEqual([])
        expect(await storedRows()).toEqual([])
      })

      it('resolves to null and writes nothing for a staff member that does not exist, one of another salon and a deleted one', async () => {
        const otherSalon = await insertSalon(db)
        const leaving = await insertStaffRow()
        await insertRows([{ dayOfWeek: 'monday', notes: 'kept' }])
        await insertRows([{ dayOfWeek: 'monday', notes: 'kept' }], leaving)
        await deleteStaff(leaving)
        const before = await storedRows()

        const results = [
          await repository().replace(salon(salonId), member(UNKNOWN_ID), [
            newRow(),
          ]),
          await repository().replace(salon(otherSalon), member(staffId), [
            newRow(),
          ]),
          await repository().replace(salon(otherSalon), member(staffId), []),
          await repository().replace(salon(salonId), member(leaving), []),
        ]

        expect(results.map(dataOf)).toEqual([null, null, null, null])
        expect(await storedRows()).toEqual(before)
      })

      it.each<[string, DbNewStaffSchedule[]]>([
        [
          'a row that breaks a rule of the table',
          [newRow({ dayOfWeek: 'tuesday' }), newRow({ endTime: '08:00' })],
        ],
        ['two rows for one day of the week', [newRow(), newRow()]],
      ])(
        'resolves to a database error for %s and keeps the schedule that was there',
        async (_case, rows) => {
          await insertRows([{ dayOfWeek: 'friday', notes: 'kept' }])
          const before = await storedRows()

          const result = await repository().replace(
            salon(salonId),
            member(staffId),
            rows,
          )

          expect(result).toMatchObject({
            type: 'error',
            error: {
              type: 'database',
              message: 'Failed to replace staff schedules',
            },
          })
          expect(await storedRows()).toEqual(before)
        },
      )
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })

    it.each<[string, Partial<NewScheduleRow>, string]>([
      [
        'a weekly row without a day of the week',
        { dayOfWeek: null },
        'staff_schedules_weekly_or_single_day',
      ],
      [
        'a weekly row with a date',
        { dayOfWeek: 'monday', date: '2026-12-28' },
        'staff_schedules_weekly_or_single_day',
      ],
      [
        'a row for a single day without a date',
        { isRecurring: false },
        'staff_schedules_weekly_or_single_day',
      ],
      [
        'a row for a single day with a day of the week',
        { isRecurring: false, dayOfWeek: 'monday', date: '2026-12-28' },
        'staff_schedules_weekly_or_single_day',
      ],
      [
        'a working day without a start',
        { dayOfWeek: 'monday', startTime: null },
        'staff_schedules_times_when_available',
      ],
      [
        'a working day without an end',
        { dayOfWeek: 'monday', endTime: null },
        'staff_schedules_times_when_available',
      ],
      [
        'a day off with working hours',
        { dayOfWeek: 'monday', isAvailable: false },
        'staff_schedules_times_when_available',
      ],
      [
        'a day off with a start alone',
        { dayOfWeek: 'monday', isAvailable: false, endTime: null },
        'staff_schedules_times_when_available',
      ],
      [
        'a day off with a break',
        {
          dayOfWeek: 'monday',
          isAvailable: false,
          startTime: null,
          endTime: null,
          breakStartTime: '12:00',
          breakEndTime: '13:00',
        },
        'staff_schedules_times_when_available',
      ],
      [
        'an end before the start',
        { dayOfWeek: 'monday', startTime: '18:00', endTime: '09:00' },
        'staff_schedules_end_after_start',
      ],
      [
        'an end at the start',
        { dayOfWeek: 'monday', startTime: '09:00', endTime: '09:00' },
        'staff_schedules_end_after_start',
      ],
      [
        'a break without an end',
        { dayOfWeek: 'monday', breakStartTime: '12:00' },
        'staff_schedules_break_has_both_times',
      ],
      [
        'a break without a start',
        { dayOfWeek: 'monday', breakEndTime: '13:00' },
        'staff_schedules_break_has_both_times',
      ],
      [
        'a break that starts with the working hours',
        { dayOfWeek: 'monday', breakStartTime: '09:00', breakEndTime: '10:00' },
        'staff_schedules_break_inside_working_hours',
      ],
      [
        'a break that ends with the working hours',
        { dayOfWeek: 'monday', breakStartTime: '17:00', breakEndTime: '18:00' },
        'staff_schedules_break_inside_working_hours',
      ],
      [
        'a break that ends when it starts',
        { dayOfWeek: 'monday', breakStartTime: '12:00', breakEndTime: '12:00' },
        'staff_schedules_break_inside_working_hours',
      ],
    ])('refuses %s', async (_case, values, constraint) => {
      await expect(insertRows([values])).rejects.toMatchObject(
        violationOf('23514', constraint),
      )
      expect(await storedRows()).toEqual([])
    })

    it.each<[string, Partial<NewScheduleRow>[], string]>([
      [
        'a second weekly row for a day of the week',
        [
          { dayOfWeek: 'monday' },
          {
            dayOfWeek: 'monday',
            isAvailable: false,
            startTime: null,
            endTime: null,
          },
        ],
        'staff_schedules_weekly_unique',
      ],
      [
        'a second row for a date',
        [
          { isRecurring: false, date: '2026-12-28' },
          { isRecurring: false, date: '2026-12-28', startTime: '10:00' },
        ],
        'staff_schedules_single_day_unique',
      ],
    ])('refuses %s of one staff member', async (_case, rows, constraint) => {
      await expect(insertRows(rows)).rejects.toMatchObject(
        violationOf('23505', constraint),
      )
      expect(await storedRows()).toEqual([])
    })

    it('accepts the same day of the week and the same date for two staff members, and a weekly row and a row for a single day on one day of the week', async () => {
      const colleague = await insertStaffRow()

      await insertRows([
        { dayOfWeek: 'monday' },
        { isRecurring: false, date: '2026-12-28' },
      ])
      await insertRows(
        [{ dayOfWeek: 'monday' }, { isRecurring: false, date: '2026-12-28' }],
        colleague,
      )

      expect(await storedRows()).toHaveLength(4)
    })

    it('accepts the rows at the edges of the constraints', async () => {
      await insertRows([
        { dayOfWeek: 'monday', startTime: '00:00', endTime: '00:00:01' },
        {
          dayOfWeek: 'tuesday',
          startTime: '09:00',
          endTime: '18:00',
          breakStartTime: '09:00:01',
          breakEndTime: '17:59:59',
        },
        {
          dayOfWeek: 'wednesday',
          isAvailable: false,
          startTime: null,
          endTime: null,
        },
        {
          isRecurring: false,
          isAvailable: false,
          date: '2026-12-24',
          startTime: null,
          endTime: null,
        },
      ])

      expect(await storedRows()).toHaveLength(4)
    })

    it('removes the rows of a staff member whose row is removed from the table', async () => {
      const colleague = await insertStaffRow()
      await insertRows([{ dayOfWeek: 'monday' }])
      await insertRows([{ dayOfWeek: 'tuesday' }], colleague)

      await db.delete(staff).where(eq(staff.id, staffId))

      expect((await storedRows()).map(({ staffId: owner }) => owner)).toEqual([
        colleague,
      ])
    })
  })
})
