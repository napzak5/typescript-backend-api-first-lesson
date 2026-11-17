import { randomUUID } from 'node:crypto'
import { salons, staff, staffSchedules } from '@beauty-salon-backend/database'
import {
  type DbNewStaff,
  type DomainError,
  type StaffListCriteria,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { StaffRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
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
const ME = '/api/v1/auth/me'

/** Where the staff ledger of a salon is. */
const staffOf = (salonId: string): string => `${SALONS}/${salonId}/staff`

/** A UUID that neither a salon nor a staff member has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const malformedBody = { status: 400, code: '2002', type: 'malformed-body' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const alreadyExists = { status: 409, code: '3002', type: 'already-exists' }
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

/** A staff member as the API returns it. */
type StaffMember = {
  id: string
  salonId: string
  userId: string | null
  firstName: string
  lastName: string
  firstNameKana: string | null
  lastNameKana: string | null
  displayName: string
  email: string
  phoneNumber: string
  alternativePhone: string | null
  staffCode: string | null
  level: string
  position: string | null
  specialties: string[]
  bio: string | null
  imageUrl: string | null
  yearsOfExperience: number | null
  certifications: string[]
  hireDate: string | null
  employmentType: string | null
  baseSalary: number | null
  commissionRate: number | null
  canReceiveBookings: boolean
  maxConcurrentBookings: number
  bufferTimeBefore: number
  bufferTimeAfter: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Exactly the properties of StaffResponse. */
const RESPONSE_PROPERTIES = [
  'id',
  'salonId',
  'userId',
  'firstName',
  'lastName',
  'firstNameKana',
  'lastNameKana',
  'displayName',
  'email',
  'phoneNumber',
  'alternativePhone',
  'staffCode',
  'level',
  'position',
  'specialties',
  'bio',
  'imageUrl',
  'yearsOfExperience',
  'certifications',
  'hireDate',
  'employmentType',
  'baseSalary',
  'commissionRate',
  'canReceiveBookings',
  'maxConcurrentBookings',
  'bufferTimeBefore',
  'bufferTimeAfter',
  'isActive',
  'createdAt',
  'updatedAt',
]

/** A request that satisfies every rule, with a value for every property. */
const staffRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  displayName: 'Hanako',
  email: 'hanako@aoyama.example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: '03-1234-5678',
  staffCode: 'STF-001',
  level: 'senior',
  position: 'Top stylist',
  specialties: ['cut', 'color'],
  bio: 'Ten years of cutting.',
  imageUrl: 'https://aoyama.example.com/staff/hanako.jpg',
  yearsOfExperience: 10,
  certifications: ['美容師免許'],
  hireDate: '2020-04-01',
  employmentType: 'full-time',
  baseSalary: 300000,
  commissionRate: 12.5,
  canReceiveBookings: true,
  maxConcurrentBookings: 2,
  bufferTimeBefore: 10,
  bufferTimeAfter: 15,
  isActive: true,
  ...overrides,
})

/** The properties that may be unset, all unset. */
const unset = {
  firstNameKana: null,
  lastNameKana: null,
  alternativePhone: null,
  staffCode: null,
  position: null,
  bio: null,
  imageUrl: null,
  yearsOfExperience: null,
  hireDate: null,
  employmentType: null,
  baseSalary: null,
  commissionRate: null,
}

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
  return response.status === 404 || response.status === 409
    ? `${response.status} ${response.body.detail}`
    : String(response.status)
}

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: StaffMember) => id)

/** The IDs in the order of the list: by registration, then by ID. */
const inOrderOfRegistration = (
  rows: { id: string; createdAt: string }[],
): string[] =>
  rows
    .toSorted(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        (left.id < right.id ? -1 : 1),
    )
    .map(({ id }) => id)

describe('Staff API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon whose staff the tests are about. */
  let salonId: string
  /** How many staff members the test has created through the API. */
  let createdSoFar: number

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
    createdSoFar = 0
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const list = (
    query = '',
    as: string | null = asAdmin,
    salon: string = salonId,
  ) =>
    authorized(
      request(app).get(
        query === '' ? staffOf(salon) : `${staffOf(salon)}?${query}`,
      ),
      as,
    )

  const post = (
    body: object,
    as: string | null = asAdmin,
    salon: string = salonId,
  ) => authorized(request(app).post(staffOf(salon)), as).send(body)

  const get = (
    id: string,
    as: string | null = asAdmin,
    salon: string = salonId,
  ) => authorized(request(app).get(`${staffOf(salon)}/${id}`), as)

  const patch = (
    id: string,
    body: object,
    as: string | null = asAdmin,
    salon: string = salonId,
  ) => authorized(request(app).patch(`${staffOf(salon)}/${id}`), as).send(body)

  const remove = (
    id: string,
    as: string | null = asAdmin,
    salon: string = salonId,
  ) => authorized(request(app).delete(`${staffOf(salon)}/${id}`), as)

  const me = (authorization: string) =>
    request(app).get(ME).set('Authorization', authorization)

  /**
   * Registers a staff member through the API as the admin. The email and the
   * staff code are the test's own unless the overrides name them.
   */
  const createStaff = async (
    overrides: Record<string, unknown> = {},
    salon: string = salonId,
  ): Promise<StaffMember> => {
    createdSoFar += 1
    const response = await post(
      staffRequest({
        email: `staff-${createdSoFar}@example.com`,
        staffCode: `CODE-${createdSoFar}`,
        ...overrides,
      }),
      asAdmin,
      salon,
    )
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Deletes a staff member through the API as the admin. */
  const deleteStaff = async (
    id: string,
    salon: string = salonId,
  ): Promise<void> => {
    const response = await remove(id, asAdmin, salon)
    expect(response.status).toBe(204)
  }

  /** Hides a salon as `DELETE /api/v1/salons/:id` does; its rows stay. */
  const deleteSalon = async (id: string): Promise<void> => {
    const response = await request(app)
      .delete(`${SALONS}/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  /** Every stored staff member of every salon, deleted or not, as its row. */
  const storedStaff = () => db.select().from(staff).orderBy(asc(staff.id))

  /** The stored row of one staff member. */
  const storedStaffMember = async (id: string) => {
    const [row] = await db.select().from(staff).where(eq(staff.id, id))
    if (row === undefined) {
      throw new Error(`No staff member ${id} is stored`)
    }
    return row
  }

  /** How many staff members of the salon that are not deleted have the email. */
  const liveStaffWithEmail = (email: string, salon: string = salonId) =>
    db.$count(
      staff,
      and(
        eq(staff.salonId, salon),
        eq(staff.email, email),
        isNull(staff.deletedAt),
      ),
    )

  /** Whether the stored `updatedAt` of the staff member lies after its `createdAt`. */
  const hasMoved = async (id: string): Promise<boolean | undefined> => {
    const [row] = await db
      .select({
        moved: sql<boolean>`${staff.updatedAt} > ${staff.createdAt}`,
      })
      .from(staff)
      .where(eq(staff.id, id))
    return row?.moved
  }

  type NewStaffRow = typeof staff.$inferInsert

  /** A staff member as a row, inserted directly; returns its ID. */
  const insertStaffRow = async (
    overrides: Partial<NewStaffRow> = {},
    salon: string = salonId,
  ): Promise<string> => {
    const [row] = await db
      .insert(staff)
      .values({
        salonId: salon,
        firstName: 'Taro',
        lastName: 'Suzuki',
        displayName: 'Taro',
        email: `row-${randomUUID()}@example.com`,
        phoneNumber: '03-0000-0000',
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

  /**
   * Four staff members of the salon, inserted directly a day apart, a
   * deleted one between them and one of another salon. `all` lists the four
   * in the order of their registration.
   */
  const insertLedger = async () => {
    const otherSalonId = await insertSalon(db)
    const elsewhere = await insertStaffRow(
      { createdAt: '2026-10-31T09:00:00.000Z' },
      otherSalonId,
    )
    const first = await insertStaffRow({
      createdAt: '2026-11-01T09:00:00.000Z',
    })
    const inactive = await insertStaffRow({
      isActive: false,
      canReceiveBookings: false,
      createdAt: '2026-11-02T09:00:00.000Z',
    })
    const deleted = await insertStaffRow({
      createdAt: '2026-11-03T09:00:00.000Z',
      deletedAt: '2026-11-07T09:00:00.000Z',
    })
    const third = await insertStaffRow({
      createdAt: '2026-11-04T09:00:00.000Z',
    })
    const fourth = await insertStaffRow({
      createdAt: '2026-11-05T09:00:00.000Z',
    })
    return {
      otherSalonId,
      elsewhere,
      first,
      inactive,
      deleted,
      third,
      fourth,
      all: [first, inactive, third, fourth],
    }
  }

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

  /** A user with a role at a salon, signed in. */
  const signedInMember = async (
    role: 'owner' | 'manager' | 'staff',
    salon: string = salonId,
  ) => {
    const member = await insertMember(db, role, salon)
    const { authorization } = await signIn(app, member.email)
    return { ...member, authorization }
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

  describe('POST /api/v1/salons/:salonId/staff', () => {
    it('registers the staff member with the salon of the path, returns it with what the server assigned and stores it as returned', async () => {
      const body = staffRequest({ email: 'Hanako@Aoyama.Example.COM' })

      const response = await post(body)

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const { data, meta, links } = response.body
      expect(data).toEqual({
        ...body,
        email: 'hanako@aoyama.example.com',
        id: expect.stringMatching(UUID),
        salonId,
        userId: null,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(Object.keys(data).toSorted()).toEqual(
        RESPONSE_PROPERTIES.toSorted(),
      )
      expect(meta).toEqual({
        correlationId: expect.stringMatching(UUID),
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
        version: 'v1',
      })
      expect(links).toEqual({
        self: `${staffOf(salonId)}/${data.id}`,
        list: staffOf(salonId),
      })
      expect(response.headers['location']).toBe(links.self)
      expect((await get(data.id)).body.data).toEqual(data)
      expect(await storedStaffMember(data.id)).toMatchObject({
        salonId,
        userId: null,
        email: 'hanako@aoyama.example.com',
        specialties: ['cut', 'color'],
        certifications: ['美容師免許'],
        commissionRate: '12.50',
        deletedAt: null,
      })
    })

    it('stores null as it is given for every property that may be unset, and empty lists', async () => {
      const body = staffRequest({
        ...unset,
        specialties: [],
        certifications: [],
      })

      const response = await post(body)

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(body)
      expect(await storedStaffMember(response.body.data.id)).toMatchObject({
        ...unset,
        specialties: [],
        certifications: [],
      })
    })

    it.each<[string, Record<string, unknown>]>([
      [
        'the smallest values',
        {
          yearsOfExperience: 0,
          baseSalary: 0,
          commissionRate: 0,
          maxConcurrentBookings: 1,
          bufferTimeBefore: 0,
          bufferTimeAfter: 0,
        },
      ],
      [
        'the largest values',
        {
          firstName: 'a'.repeat(100),
          lastName: 'a'.repeat(100),
          displayName: 'a'.repeat(255),
          staffCode: 'a'.repeat(50),
          yearsOfExperience: 100,
          baseSalary: MAX_INTEGER,
          commissionRate: 100,
          maxConcurrentBookings: 10,
          bufferTimeBefore: 120,
          bufferTimeAfter: 120,
        },
      ],
      ['a commission rate with two decimal places', { commissionRate: 99.99 }],
      [
        'a staff member who is inactive and takes no bookings',
        { isActive: false, canReceiveBookings: false },
      ],
    ])('stores %s as they are sent', async (_case, change) => {
      const response = await post(staffRequest(change))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(change)
      expect((await get(response.body.data.id)).body.data).toEqual(
        response.body.data,
      )
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      [
        'a blank first name',
        { firstName: '   ' },
        ['firstName:invalid_format'],
      ],
      [
        'a last name of 101 characters',
        { lastName: 'a'.repeat(101) },
        ['lastName:too_big'],
      ],
      [
        'a display name of 256 characters',
        { displayName: 'a'.repeat(256) },
        ['displayName:too_big'],
      ],
      ['a missing email', { email: undefined }, ['email:invalid_type']],
      [
        'an email that is not an address',
        { email: 'hanako' },
        ['email:invalid_format'],
      ],
      [
        'a phone number with letters and too few digits',
        { phoneNumber: '090-abcd-5678' },
        ['phoneNumber:custom', 'phoneNumber:invalid_format'],
      ],
      [
        'a level that does not exist',
        { level: 'master' },
        ['level:invalid_value'],
      ],
      [
        'null as the specialties',
        { specialties: null },
        ['specialties:invalid_type'],
      ],
      [
        'a blank certification and a repeated one',
        { certifications: ['美容師免許', ' ', '美容師免許'] },
        ['certifications.1:invalid_format', 'certifications.2:custom'],
      ],
      [
        'an image URL that is not an http URL',
        { imageUrl: 'ftp://aoyama.example.com/hanako.jpg' },
        ['imageUrl:invalid_format'],
      ],
      [
        'a hire date that does not exist',
        { hireDate: '2023-02-30' },
        ['hireDate:invalid_format'],
      ],
      ['a negative base salary', { baseSalary: -1 }, ['baseSalary:too_small']],
      [
        'a base salary that is not a whole number',
        { baseSalary: 1000.5 },
        ['baseSalary:invalid_type'],
      ],
      [
        'a commission rate above 100',
        { commissionRate: 100.01 },
        ['commissionRate:too_big'],
      ],
      [
        'a commission rate with three decimal places',
        { commissionRate: 12.345 },
        ['commissionRate:not_multiple_of'],
      ],
      [
        'no booking at a time',
        { maxConcurrentBookings: 0 },
        ['maxConcurrentBookings:too_small'],
      ],
      [
        'eleven bookings at a time',
        { maxConcurrentBookings: 11 },
        ['maxConcurrentBookings:too_big'],
      ],
      [
        'a buffer time of 121 minutes',
        { bufferTimeAfter: 121 },
        ['bufferTimeAfter:too_big'],
      ],
      [
        'null as a buffer time',
        { bufferTimeBefore: null },
        ['bufferTimeBefore:invalid_type'],
      ],
      ['a login account', { userId: null }, ['userId:unrecognized_keys']],
      ['a salon', { salonId: UNKNOWN_ID }, ['salonId:unrecognized_keys']],
      ['schedules', { schedules: [] }, ['schedules:unrecognized_keys']],
      ['awards', { awards: [] }, ['awards:unrecognized_keys']],
    ])('rejects %s and stores nothing', async (_case, change, expected) => {
      const response = await post(staffRequest(change))

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected)
      expect(await db.$count(staff)).toBe(0)
    })

    it('reports several broken rules together, each with its field, its rule and a message', async () => {
      const response = await post(
        staffRequest({
          firstName: '',
          level: 'master',
          isActive: 'yes',
          id: UNKNOWN_ID,
        }),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual([
        'firstName:invalid_format',
        'id:unrecognized_keys',
        'isActive:invalid_type',
        'level:invalid_value',
      ])
      for (const error of response.body.errors) {
        expect(error).toMatchObject({
          field: expect.any(String),
          rule: expect.any(String),
          message: expect.any(String),
        })
      }
    })

    it('rejects a body that is not an object, and one that is not JSON', async () => {
      const asList = await post([staffRequest()])
      const text = await request(app)
        .post(staffOf(salonId))
        .set('Authorization', asAdmin)
        .set('Content-Type', 'application/json')
        .send('{"firstName": "Hanako"')

      expectProblem(asList, badRequest)
      expect(brokenRules(asList)).toEqual([':invalid_type'])
      expectProblem(text, malformedBody)
      expect(await db.$count(staff)).toBe(0)
    })

    it('rejects the email of a staff member of the salon who is not deleted, also written in another case, and stores nothing', async () => {
      const existing = await createStaff({ email: 'hanako@example.com' })

      const same = await post(
        staffRequest({ email: 'hanako@example.com', staffCode: null }),
      )
      const otherCase = await post(
        staffRequest({ email: 'HANAKO@Example.com', staffCode: null }),
      )

      for (const response of [same, otherCase]) {
        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(
          'Staff member with email hanako@example.com already exists',
        )
      }
      expect((await storedStaff()).map(({ id }) => id)).toEqual([existing.id])
    })

    it('accepts the email of a staff member of another salon: a salon is told nothing about the staff of another', async () => {
      const otherSalonId = await insertSalon(db)
      await createStaff({ email: 'hanako@example.com' }, otherSalonId)

      const response = await post(
        staffRequest({ email: 'Hanako@Example.com', staffCode: null }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        salonId,
        email: 'hanako@example.com',
      })
      expect(await liveStaffWithEmail('hanako@example.com')).toBe(1)
      expect(await liveStaffWithEmail('hanako@example.com', otherSalonId)).toBe(
        1,
      )
    })

    it('accepts the email of a deleted staff member of the salon', async () => {
      const deleted = await createStaff({ email: 'hanako@example.com' })
      await deleteStaff(deleted.id)

      const response = await post(
        staffRequest({ email: 'hanako@example.com', staffCode: null }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data.id).not.toBe(deleted.id)
      expect(await liveStaffWithEmail('hanako@example.com')).toBe(1)
      expect(await db.$count(staff)).toBe(2)
    })

    it('rejects the staff code of any staff member of the salon, deleted or not, and stores nothing', async () => {
      await createStaff({ staffCode: 'LIVE' })
      const deleted = await createStaff({ staffCode: 'GONE' })
      await deleteStaff(deleted.id)

      const ofLive = await post(
        staffRequest({ email: 'new@example.com', staffCode: 'LIVE' }),
      )
      const ofDeleted = await post(
        staffRequest({ email: 'new@example.com', staffCode: 'GONE' }),
      )

      expectProblem(ofLive, alreadyExists)
      expect(ofLive.body.detail).toBe(
        'Staff member with staffCode LIVE already exists',
      )
      expectProblem(ofDeleted, alreadyExists)
      expect(ofDeleted.body.detail).toBe(
        'Staff member with staffCode GONE already exists',
      )
      expect(await db.$count(staff)).toBe(2)
    })

    it('accepts the staff code of a staff member of another salon, a code that differs in case only, and any number of staff members without a code', async () => {
      const otherSalonId = await insertSalon(db)
      await createStaff({ staffCode: 'STF-001' }, otherSalonId)

      const responses = [
        await post(
          staffRequest({ email: 'one@example.com', staffCode: 'STF-001' }),
        ),
        await post(
          staffRequest({ email: 'two@example.com', staffCode: 'stf-001' }),
        ),
        await post(
          staffRequest({ email: 'three@example.com', staffCode: null }),
        ),
        await post(
          staffRequest({ email: 'four@example.com', staffCode: null }),
        ),
      ]

      expect(responses.map(({ status }) => status)).toEqual([
        201, 201, 201, 201,
      ])
      expect(responses.map((response) => response.body.data.staffCode)).toEqual(
        ['STF-001', 'stf-001', null, null],
      )
    })

    it.each(malformedIds)(
      'rejects %s as the ID of the salon',
      async (_case, salon) => {
        const response = await post(staffRequest(), asAdmin, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect(await db.$count(staff)).toBe(0)
      },
    )

    it('reports a salon that does not exist as not found and stores nothing', async () => {
      const response = await post(staffRequest(), asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect(await db.$count(staff)).toBe(0)
    })

    it('validates the body before it looks for the salon', async () => {
      const response = await post(
        staffRequest({ firstName: '' }),
        asAdmin,
        UNKNOWN_ID,
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['firstName:invalid_format'])
    })
  })

  describe('GET /api/v1/salons/:salonId/staff/:id', () => {
    it('returns the staff member with its links', async () => {
      const created = await createStaff()

      const response = await get(created.id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: created,
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${staffOf(salonId)}/${created.id}`,
          list: staffOf(salonId),
        },
      })
    })

    it('returns the columns of a row in the representation of the API: the rate as a number, the times in milliseconds, and not the deletion', async () => {
      const userId = (await insertUser(db, { role: 'staff' })).id
      const id = await insertStaffRow({
        userId,
        commissionRate: '7.50',
        hireDate: '2020-04-01',
        createdAt: '2026-11-10 09:00:00.123456+09',
        updatedAt: '2026-11-11 00:00:00+00',
      })

      const response = await get(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id,
        salonId,
        userId,
        commissionRate: 7.5,
        hireDate: '2020-04-01',
        createdAt: '2026-11-10T00:00:00.123Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(
        RESPONSE_PROPERTIES.toSorted(),
      )
    })

    it.each(malformedIds)(
      'rejects %s as the ID of the staff member',
      async (_case, id) => {
        const response = await get(id)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      },
    )

    it.each(malformedIds)(
      'rejects %s as the ID of the salon',
      async (_case, salon) => {
        const created = await createStaff()

        const response = await get(created.id, asAdmin, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
      },
    )

    it('reports an ID that no staff member has as not found', async () => {
      await createStaff()

      const response = await get(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${UNKNOWN_ID} was not found`,
      )
    })

    it('reports a staff member of another salon as not found, like an ID that no staff member has', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createStaff({}, otherSalonId)

      const response = await get(elsewhere.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${elsewhere.id} was not found`,
      )
      expect((await get(elsewhere.id, asAdmin, otherSalonId)).status).toBe(200)
    })

    it('reports a deleted staff member as not found', async () => {
      const created = await createStaff()
      await deleteStaff(created.id)

      const response = await get(created.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${created.id} was not found`,
      )
    })

    it('reports a salon that does not exist as not found', async () => {
      const created = await createStaff()

      const response = await get(created.id, asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
    })

    it('answers 500 without details when the stored staff member has a time that is no instant', async () => {
      const created = await createStaff()
      await db
        .update(staff)
        .set({ createdAt: 'infinity' })
        .where(eq(staff.id, created.id))

      const one = await get(created.id)
      const listed = await list()

      for (const response of [one, listed]) {
        expectProblem(response, databaseProblem)
        expect(response.body.detail).toBeNull()
        expect(JSON.stringify(response.body)).not.toContain('infinity')
      }
    })
  })

  describe('GET /api/v1/salons/:salonId/staff', () => {
    it('returns an empty page when the salon has no staff', async () => {
      await createStaff({}, await insertSalon(db))

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
          self: staffOf(salonId),
          first: staffOf(salonId),
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('returns the staff members of the salon only, in the order of their registration, inactive ones included and deleted ones left out', async () => {
      const ledger = await insertLedger()

      const response = await list()
      const ofOtherSalon = await list('', asAdmin, ledger.otherSalonId)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual(ledger.all)
      expect(response.body.meta).toEqual({
        total: 4,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
      for (const member of response.body.data) {
        expect(member).toEqual((await get(member.id)).body.data)
      }
      expect(idsOf(ofOtherSalon)).toEqual([ledger.elsewhere])
      expect(ofOtherSalon.body.meta.total).toBe(1)
    })

    it('adds a new staff member at the end of the list', async () => {
      const ledger = await insertLedger()

      const added = await createStaff()

      expect(idsOf(await list())).toEqual([...ledger.all, added.id])
    })

    it('walks through the pages, returning every staff member once and in order where staff members share createdAt', async () => {
      const shared = '2026-11-10T00:00:00.000Z'
      const rows = [
        { createdAt: '2026-11-11T00:00:00.000Z' },
        { createdAt: shared },
        { createdAt: shared },
        { createdAt: '2026-11-09T00:00:00.000Z' },
        { createdAt: shared },
        { createdAt: shared },
        { createdAt: shared },
      ]
      const stored: { id: string; createdAt: string }[] = []
      for (const row of rows) {
        stored.push({ id: await insertStaffRow(row), ...row })
      }
      const ids = inOrderOfRegistration(stored)
      const firstPage = `${staffOf(salonId)}?limit=2`

      const pages = await walk(firstPage)

      expect(pages.flatMap((page) => idsOf(page))).toEqual(ids)
      expect(pages.map((page) => page.body.meta)).toEqual([
        {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: ids[1],
          prevCursor: null,
        },
        {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: ids[1],
          nextCursor: ids[3],
          prevCursor: null,
        },
        {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: ids[3],
          nextCursor: ids[5],
          prevCursor: null,
        },
        {
          total: 7,
          limit: 2,
          hasMore: false,
          cursor: ids[5],
          nextCursor: null,
          prevCursor: null,
        },
      ])
      expect(pages.map((page) => page.body.links)).toEqual([
        {
          self: firstPage,
          first: firstPage,
          last: null,
          next: `${firstPage}&cursor=${ids[1]}`,
          prev: null,
        },
        {
          self: `${firstPage}&cursor=${ids[1]}`,
          first: firstPage,
          last: null,
          next: `${firstPage}&cursor=${ids[3]}`,
          prev: null,
        },
        {
          self: `${firstPage}&cursor=${ids[3]}`,
          first: firstPage,
          last: null,
          next: `${firstPage}&cursor=${ids[5]}`,
          prev: null,
        },
        {
          self: `${firstPage}&cursor=${ids[5]}`,
          first: firstPage,
          last: null,
          next: null,
          prev: null,
        },
      ])
    })

    it('says that no page follows a page that the last staff members fill exactly', async () => {
      const ledger = await insertLedger()

      const whole = await list('limit=4')
      const rest = await list(`limit=2&cursor=${ledger.inactive}`)

      expect(idsOf(whole)).toEqual(ledger.all)
      expect(whole.body.meta).toMatchObject({
        total: 4,
        hasMore: false,
        nextCursor: null,
      })
      expect(whole.body.links.next).toBeNull()
      expect(idsOf(rest)).toEqual(ledger.all.slice(2))
      expect(rest.body.meta).toMatchObject({
        total: 4,
        hasMore: false,
        nextCursor: null,
      })
      expect(rest.body.links.next).toBeNull()
    })

    it('gives pages of 20 staff members unless another limit is asked for, and up to 100', async () => {
      for (let index = 0; index < 21; index += 1) {
        await insertStaffRow()
      }

      const byDefault = await list()
      const largest = await list('limit=100')
      const smallest = await list('limit=1')

      expect(byDefault.body.data).toHaveLength(20)
      expect(byDefault.body.meta).toMatchObject({
        total: 21,
        limit: 20,
        hasMore: true,
        nextCursor: byDefault.body.data[19].id,
      })
      expect(largest.body.data).toHaveLength(21)
      expect(largest.body.meta).toMatchObject({
        total: 21,
        limit: 100,
        hasMore: false,
      })
      expect(smallest.body.data).toHaveLength(1)
      expect(smallest.body.meta).toMatchObject({ limit: 1, hasMore: true })
    })

    it('continues after a staff member who was deleted since they ended a page: the row still says where the next page begins', async () => {
      const ledger = await insertLedger()
      const firstPage = await list('limit=2')
      expect(firstPage.body.meta.nextCursor).toBe(ledger.inactive)
      await deleteStaff(ledger.inactive)

      const nextPage = await request(app)
        .get(firstPage.body.links.next)
        .set('Authorization', asAdmin)
      const afterLongDeleted = await list(`cursor=${ledger.deleted}`)

      expect(nextPage.status).toBe(200)
      expect(idsOf(nextPage)).toEqual([ledger.third, ledger.fourth])
      expect(nextPage.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: false,
        cursor: ledger.inactive,
        nextCursor: null,
        prevCursor: null,
      })
      expect(idsOf(afterLongDeleted)).toEqual([ledger.third, ledger.fourth])
    })

    it('refuses a cursor that names no staff member of the salon as a broken rule of the cursor: an ID that nobody has, and a staff member of another salon', async () => {
      const ledger = await insertLedger()

      const unknown = await list(`cursor=${UNKNOWN_ID}`)
      const ofOtherSalon = await list(`cursor=${ledger.elsewhere}`)

      for (const response of [unknown, ofOtherSalon]) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['cursor:not_found'])
        expect(response.body.errors[0].message).toBe(
          'Must name a staff member of the salon',
        )
      }
    })

    it.each([
      ['a limit that is not a number', 'limit=abc', ['limit:invalid_format']],
      ['a limit of 0', 'limit=0', ['limit:too_small']],
      ['a limit of 101', 'limit=101', ['limit:too_big']],
      [
        'a limit that is not a whole number',
        'limit=1.5',
        ['limit:invalid_type'],
      ],
      ['a cursor that is not a UUID', 'cursor=abc', ['cursor:invalid_format']],
      ['a parameter that does not exist', 'page=2', ['page:unrecognized_keys']],
      [
        'a filter that the list does not have',
        'isActive=true',
        ['isActive:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        'limit=0&cursor=abc&page=2',
        ['cursor:invalid_format', 'limit:too_small', 'page:unrecognized_keys'],
      ],
    ])('rejects %s', async (_case, query, expected) => {
      await insertStaffRow()

      const response = await list(query)

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected)
    })

    it.each(malformedIds)(
      'rejects %s as the ID of the salon',
      async (_case, salon) => {
        const response = await list('', asAdmin, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
      },
    )

    it('reports a salon that does not exist as not found', async () => {
      await insertLedger()

      const response = await list('', asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
    })
  })

  describe('PATCH /api/v1/salons/:salonId/staff/:id', () => {
    /** A value for every property of an update, each different from `staffRequest`. */
    const everything = {
      firstName: '太郎',
      lastName: '鈴木',
      firstNameKana: 'タロウ',
      lastNameKana: 'スズキ',
      displayName: 'Taro',
      email: 'taro@aoyama.example.com',
      phoneNumber: '080-1111-2222',
      alternativePhone: '03-9999-8888',
      staffCode: 'STF-999',
      level: 'director',
      position: 'Director',
      specialties: ['perm'],
      bio: 'Twenty years of perms.',
      imageUrl: 'https://aoyama.example.com/staff/taro.jpg',
      yearsOfExperience: 20,
      certifications: ['管理美容師'],
      hireDate: '2010-10-01',
      employmentType: 'part-time',
      baseSalary: 450000,
      commissionRate: 30.25,
      canReceiveBookings: false,
      maxConcurrentBookings: 3,
      bufferTimeBefore: 0,
      bufferTimeAfter: 30,
      isActive: false,
    }

    it('changes the given properties and nothing else, moves updatedAt, and keeps the ID, the salon and the creation time', async () => {
      const created = await createStaff()

      const response = await patch(created.id, {
        position: 'Director',
        level: 'director',
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...created,
          position: 'Director',
          level: 'director',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${staffOf(salonId)}/${created.id}`,
          list: staffOf(salonId),
        },
      })
      expect(await hasMoved(created.id)).toBe(true)
      expect((await get(created.id)).body.data).toEqual(response.body.data)
    })

    it('accepts a request that changes every property at once', async () => {
      const created = await createStaff()

      const response = await patch(created.id, {
        ...everything,
        email: 'Taro@Aoyama.Example.COM',
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        ...everything,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(Object.keys(everything).toSorted()).toEqual(
        Object.keys(staffRequest()).toSorted(),
      )
    })

    it.each(Object.entries(everything))(
      'changes %s alone and leaves every other property as it was',
      async (property, value) => {
        const created = await createStaff()

        const response = await patch(created.id, { [property]: value })

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...created,
          [property]: value,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
      },
    )

    it('unsets a property that may be unset when it is given as null', async () => {
      const created = await createStaff()

      const response = await patch(created.id, unset)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        ...unset,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(await storedStaffMember(created.id)).toMatchObject(unset)
    })

    it('replaces the lists as a whole when they are given, and empties them with an empty list', async () => {
      const created = await createStaff({
        specialties: ['cut', 'color'],
        certifications: ['美容師免許'],
      })

      const replaced = await patch(created.id, { specialties: ['perm'] })
      const emptied = await patch(created.id, {
        specialties: [],
        certifications: [],
      })

      expect(replaced.body.data).toMatchObject({
        specialties: ['perm'],
        certifications: ['美容師免許'],
      })
      expect(emptied.body.data).toMatchObject({
        specialties: [],
        certifications: [],
      })
    })

    it("accepts the staff member's own email again, also in another case, the email of a deleted staff member of the salon and the email of a staff member of another salon", async () => {
      const created = await createStaff({ email: 'hanako@example.com' })
      const deleted = await createStaff({ email: 'gone@example.com' })
      await deleteStaff(deleted.id)
      await createStaff(
        { email: 'elsewhere@example.com' },
        await insertSalon(db),
      )

      const responses = [
        await patch(created.id, { email: 'hanako@example.com' }),
        await patch(created.id, { email: 'HANAKO@example.com' }),
        await patch(created.id, { email: 'gone@example.com' }),
        await patch(created.id, { email: 'Elsewhere@example.com' }),
      ]

      expect(responses.map(({ status }) => status)).toEqual([
        200, 200, 200, 200,
      ])
      expect(responses.map((response) => response.body.data.email)).toEqual([
        'hanako@example.com',
        'hanako@example.com',
        'gone@example.com',
        'elsewhere@example.com',
      ])
    })

    it('rejects the email of another staff member of the salon who is not deleted, and applies none of the request', async () => {
      const created = await createStaff()
      const taken = await createStaff({ email: 'taken@example.com' })
      const before = await storedStaff()

      const response = await patch(created.id, {
        position: 'Changed',
        email: 'Taken@Example.com',
      })

      expectProblem(response, alreadyExists)
      expect(response.body.detail).toBe(
        'Staff member with email taken@example.com already exists',
      )
      expect(await storedStaff()).toEqual(before)
      expect((await get(taken.id)).body.data).toEqual(taken)
    })

    it("accepts the staff member's own staff code again and the code of a staff member of another salon, and rejects the code of another staff member of the salon, deleted or not, applying none of the request", async () => {
      const created = await createStaff({ staffCode: 'MINE' })
      await createStaff({ staffCode: 'LIVE' })
      const deleted = await createStaff({ staffCode: 'GONE' })
      await deleteStaff(deleted.id)
      await createStaff({ staffCode: 'ELSEWHERE' }, await insertSalon(db))

      const own = await patch(created.id, { staffCode: 'MINE' })
      const ofOtherSalon = await patch(created.id, { staffCode: 'ELSEWHERE' })
      const before = await storedStaff()
      const ofLive = await patch(created.id, {
        position: 'Changed',
        staffCode: 'LIVE',
      })
      const ofDeleted = await patch(created.id, {
        position: 'Changed',
        staffCode: 'GONE',
      })

      expect(own.status).toBe(200)
      expect(ofOtherSalon.status).toBe(200)
      expect(ofOtherSalon.body.data.staffCode).toBe('ELSEWHERE')
      expectProblem(ofLive, alreadyExists)
      expect(ofLive.body.detail).toBe(
        'Staff member with staffCode LIVE already exists',
      )
      expectProblem(ofDeleted, alreadyExists)
      expect(ofDeleted.body.detail).toBe(
        'Staff member with staffCode GONE already exists',
      )
      expect(await storedStaff()).toEqual(before)
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['a blank last name', { lastName: ' ' }, ['lastName:invalid_format']],
      [
        'null for a property that is always set',
        { displayName: null },
        ['displayName:invalid_type'],
      ],
      [
        'null as the certifications',
        { certifications: null },
        ['certifications:invalid_type'],
      ],
      [
        'a specialty given twice',
        { specialties: ['cut', 'cut'] },
        ['specialties.1:custom'],
      ],
      [
        'a level that does not exist',
        { level: 'master' },
        ['level:invalid_value'],
      ],
      [
        'a commission rate above 100',
        { commissionRate: 100.01 },
        ['commissionRate:too_big'],
      ],
      [
        'a negative buffer time',
        { bufferTimeBefore: -1 },
        ['bufferTimeBefore:too_small'],
      ],
      [
        'a valid property next to an invalid one',
        { position: 'Changed', email: 'hanako' },
        ['email:invalid_format'],
      ],
      ['a login account', { userId: null }, ['userId:unrecognized_keys']],
      ['a salon', { salonId: UNKNOWN_ID }, ['salonId:unrecognized_keys']],
      ['an ID', { id: UNKNOWN_ID }, ['id:unrecognized_keys']],
      [
        'a deletion',
        { deletedAt: '2026-11-01T00:00:00.000Z' },
        ['deletedAt:unrecognized_keys'],
      ],
    ])('rejects %s and changes nothing', async (_case, body, expected) => {
      const created = await createStaff()
      const before = await storedStaff()

      const response = await patch(created.id, body)

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected)
      expect(await storedStaff()).toEqual(before)
    })

    it('rejects an empty request with one error for the request as a whole', async () => {
      const created = await createStaff()

      const response = await patch(created.id, {})

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          field: '',
          rule: 'custom',
          message: 'At least one property must be specified',
        }),
      ])
      expect(await hasMoved(created.id)).toBe(false)
    })

    it('rejects a body that is not JSON and changes nothing', async () => {
      const created = await createStaff()

      const response = await request(app)
        .patch(`${staffOf(salonId)}/${created.id}`)
        .set('Authorization', asAdmin)
        .set('Content-Type', 'application/json')
        .send('{"position": "Changed"')

      expectProblem(response, malformedBody)
      expect((await get(created.id)).body.data).toEqual(created)
    })

    it.each(malformedIds)(
      'rejects %s as the ID of the staff member',
      async (_case, id) => {
        const response = await patch(id, { position: 'Changed' })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      },
    )

    it.each(malformedIds)(
      'rejects %s as the ID of the salon and changes nothing',
      async (_case, salon) => {
        const created = await createStaff()

        const response = await patch(
          created.id,
          { position: 'Changed' },
          asAdmin,
          salon,
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect((await get(created.id)).body.data).toEqual(created)
      },
    )

    it('reports an ID that no staff member has as not found', async () => {
      await createStaff()

      const response = await patch(UNKNOWN_ID, { position: 'Changed' })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${UNKNOWN_ID} was not found`,
      )
    })

    it('reports a staff member of another salon as not found, like an ID that no staff member has, and leaves them untouched', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createStaff({}, otherSalonId)
      const before = await storedStaff()

      const response = await patch(elsewhere.id, { position: 'Changed' })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${elsewhere.id} was not found`,
      )
      expect(await storedStaff()).toEqual(before)
    })

    it('reports a deleted staff member as not found and changes nothing: an update does not bring them back', async () => {
      const created = await createStaff()
      await deleteStaff(created.id)
      const before = await storedStaff()

      const response = await patch(created.id, { isActive: true })

      expectProblem(response, notFound)
      expect(await storedStaff()).toEqual(before)
    })

    it('reports a salon that does not exist as not found, once the body is valid, and changes nothing', async () => {
      const created = await createStaff()

      const invalid = await patch(created.id, {}, asAdmin, UNKNOWN_ID)
      const valid = await patch(
        created.id,
        { position: 'Changed' },
        asAdmin,
        UNKNOWN_ID,
      )

      expectProblem(invalid, badRequest)
      expectProblem(valid, notFound)
      expect(valid.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect((await get(created.id)).body.data).toEqual(created)
    })
  })

  describe('DELETE /api/v1/salons/:salonId/staff/:id', () => {
    /** A working day of a staff member, as a row; returns its ID. */
    const insertSchedule = async (staffId: string): Promise<string> => {
      const [schedule] = await db
        .insert(staffSchedules)
        .values({
          staffId,
          dayOfWeek: 'monday',
          startTime: '10:00',
          endTime: '19:00',
        })
        .returning({ id: staffSchedules.id })
      if (schedule === undefined) {
        throw new Error('No schedule was inserted')
      }
      return schedule.id
    }

    it('marks the staff member as deleted and keeps the row and the schedules, and leaves the other staff members as they are', async () => {
      const leaving = await createStaff()
      const staying = await createStaff()
      const elsewhere = await createStaff({}, await insertSalon(db))
      const scheduleId = await insertSchedule(leaving.id)
      const before = await storedStaff()

      const response = await remove(leaving.id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      const after = await storedStaff()
      expect(after.filter(({ id }) => id !== leaving.id)).toEqual(
        before.filter(({ id }) => id !== leaving.id),
      )
      expect(after.map(({ id }) => id).toSorted()).toEqual(
        [leaving.id, staying.id, elsewhere.id].toSorted(),
      )
      const row = await storedStaffMember(leaving.id)
      expect(row.deletedAt).not.toBeNull()
      expect(row).toMatchObject({
        email: leaving.email,
        staffCode: leaving.staffCode,
        isActive: true,
      })
      expect(await hasMoved(leaving.id)).toBe(true)
      expect(
        await db
          .select({ id: staffSchedules.id })
          .from(staffSchedules)
          .where(eq(staffSchedules.staffId, leaving.id)),
      ).toEqual([{ id: scheduleId }])
    })

    it('hides the deleted staff member from get, update, delete, the list and its total', async () => {
      const leaving = await createStaff()
      const staying = await createStaff()
      await deleteStaff(leaving.id)

      const responses = [
        await get(leaving.id),
        await patch(leaving.id, { position: 'Changed' }),
        await remove(leaving.id),
      ]
      const listed = await list()

      for (const response of responses) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Staff member ${leaving.id} was not found`,
        )
      }
      expect(idsOf(listed)).toEqual([staying.id])
      expect(listed.body.meta.total).toBe(1)
    })

    it('lets another staff member of the salon have the email of the deleted one, through a registration and an update, but not the staff code', async () => {
      const first = await createStaff({ email: 'first@example.com' })
      const second = await createStaff({ email: 'second@example.com' })
      const other = await createStaff()
      await deleteStaff(first.id)
      await deleteStaff(second.id)

      const registered = await post(
        staffRequest({ email: 'first@example.com', staffCode: null }),
      )
      const changed = await patch(other.id, { email: 'second@example.com' })
      const withCode = await patch(other.id, { staffCode: first.staffCode })

      expect(registered.status).toBe(201)
      expect(changed.status).toBe(200)
      expectProblem(withCode, alreadyExists)
      expect(await liveStaffWithEmail('first@example.com')).toBe(1)
      expect(await liveStaffWithEmail('second@example.com')).toBe(1)
    })

    it.each(malformedIds)(
      'rejects %s as the ID of the staff member and deletes nothing',
      async (_case, id) => {
        await createStaff()

        const response = await remove(id)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
        expect(await db.$count(staff, isNull(staff.deletedAt))).toBe(1)
      },
    )

    it.each(malformedIds)(
      'rejects %s as the ID of the salon and deletes nothing',
      async (_case, salon) => {
        const created = await createStaff()

        const response = await remove(created.id, asAdmin, salon)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        expect(await db.$count(staff, isNull(staff.deletedAt))).toBe(1)
      },
    )

    it('reports an ID that no staff member has as not found and deletes nothing', async () => {
      await createStaff()

      const response = await remove(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${UNKNOWN_ID} was not found`,
      )
      expect(await db.$count(staff, isNull(staff.deletedAt))).toBe(1)
    })

    it('reports a staff member of another salon as not found, like an ID that no staff member has, and leaves them untouched', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createStaff({}, otherSalonId)

      const response = await remove(elsewhere.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${elsewhere.id} was not found`,
      )
      expect(
        (await get(elsewhere.id, asAdmin, otherSalonId)).body.data,
      ).toEqual(elsewhere)
    })

    it('answers a second DELETE of the same staff member with 404', async () => {
      const created = await createStaff()
      await deleteStaff(created.id)
      const before = await storedStaff()

      const response = await remove(created.id)

      expectProblem(response, notFound)
      expect(await storedStaff()).toEqual(before)
    })

    it('reports a salon that does not exist as not found and deletes nothing', async () => {
      const created = await createStaff()

      const response = await remove(created.id, asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
      expect((await get(created.id)).body.data).toEqual(created)
    })
  })

  describe('a salon that is deleted and still has its staff', () => {
    let member: StaffMember

    beforeEach(async () => {
      member = await createStaff()
      await deleteSalon(salonId)
    })

    const expectSalonNotFound = (response: Response): void => {
      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${salonId} was not found`)
    }

    it('is not found by the list', async () => {
      expectSalonNotFound(await list())
    })

    it('is not found when one of its staff members is asked for', async () => {
      expectSalonNotFound(await get(member.id))
    })

    it('is not found when a staff member is registered with it, and nothing is stored', async () => {
      const response = await post(
        staffRequest({ email: 'new@example.com', staffCode: null }),
      )

      expectSalonNotFound(response)
      expect(await db.$count(staff)).toBe(1)
    })

    it('is not found when one of its staff members is changed or deleted, and the staff member stays as they are', async () => {
      const before = await storedStaff()

      const changed = await patch(member.id, { position: 'Changed' })
      const removed = await remove(member.id)

      expectSalonNotFound(changed)
      expectSalonNotFound(removed)
      expect(await storedStaff()).toEqual(before)
    })

    it('is not found either when deletedAt was set in its row and not through the API', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createStaff({}, otherSalonId)
      await db
        .update(salons)
        .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
        .where(eq(salons.id, otherSalonId))

      const responses = [
        await list('', asAdmin, otherSalonId),
        await get(elsewhere.id, asAdmin, otherSalonId),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Salon ${otherSalonId} was not found`)
      }
    })
  })

  describe('IDs written in upper case', () => {
    it('name the same salon and the same staff member in the path, and the data writes them in lower case', async () => {
      const created = await createStaff()
      const salonInUpperCase = salonId.toUpperCase()
      const idInUpperCase = created.id.toUpperCase()

      const listed = await list('', asAdmin, salonInUpperCase)
      const one = await get(idInUpperCase, asAdmin, salonInUpperCase)
      const added = await post(
        staffRequest({ email: 'new@example.com', staffCode: null }),
        asAdmin,
        salonInUpperCase,
      )
      const changed = await patch(
        idInUpperCase,
        { position: 'Changed' },
        asAdmin,
        salonInUpperCase,
      )
      const removed = await remove(idInUpperCase, asAdmin, salonInUpperCase)

      expect(listed.status).toBe(200)
      expect(listed.body.data).toEqual([created])
      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(created)
      expect(added.status).toBe(201)
      expect(added.body.data.salonId).toBe(salonId)
      expect(changed.status).toBe(200)
      expect(changed.body.data).toMatchObject({ id: created.id, salonId })
      expect(removed.status).toBe(204)
      expect((await storedStaffMember(created.id)).deletedAt).not.toBeNull()
    })

    it('name the same staff member as a cursor, and the page writes it in lower case', async () => {
      const ledger = await insertLedger()

      const response = await list(`cursor=${ledger.first.toUpperCase()}`)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual(ledger.all.slice(1))
      expect(response.body.meta.cursor).toBe(ledger.first)
    })
  })

  describe('who may keep the staff ledger of a salon', () => {
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

    /** Who may list, register, read, change and delete the staff of the salon under test. */
    const mayKeep: [string, SignInAs][] = [
      ['an admin', async () => asAdmin],
      ['the owner of the salon', member('owner')],
    ]

    /** Who may not. The last four have a role without the record it needs. */
    const mayNotKeep: [string, SignInAs][] = [
      ['a manager of the salon', member('manager')],
      ['a staff member of the salon', member('staff')],
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
        'an owner whose staff member is inactive',
        member('owner', { isActive: false }),
      ],
      [
        'an owner whose staff member is deleted',
        member('owner', { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ]

    it.each(unauthenticated)(
      'answers %s with 401 in every operation before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const created = await createStaff()
        const authorization = await tokenOf()
        const before = await storedStaff()

        const responses = [
          await list('', authorization),
          await list('limit=abc&page=2', authorization),
          await list('', authorization, 'latest'),
          await post(
            staffRequest({ email: 'new@example.com', staffCode: null }),
            authorization,
          ),
          await post({}, authorization),
          await post(staffRequest(), authorization, UNKNOWN_ID),
          await get(created.id, authorization),
          await get('latest', authorization),
          await patch(created.id, { position: 'Changed' }, authorization),
          await patch('latest', {}, authorization, 'latest'),
          await patch(UNKNOWN_ID, { position: 'Changed' }, authorization),
          await remove(created.id, authorization),
          await remove('latest', authorization, 'latest'),
          await remove(UNKNOWN_ID, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedStaff()).toEqual(before)
      },
    )

    it.each(mayKeep)(
      'lets %s list, register, read, change and delete the staff members of the salon',
      async (_case, signInAs) => {
        const existing = await createStaff()
        const leaving = await createStaff()
        const authorization = await signInAs(salonId, await insertSalon(db))

        const added = await post(
          staffRequest({ email: 'new@example.com', staffCode: null }),
          authorization,
        )
        const listed = await list('', authorization)
        const one = await get(existing.id, authorization)
        const changed = await patch(
          existing.id,
          { position: 'Changed' },
          authorization,
        )
        const removed = await remove(leaving.id, authorization)

        expect(added.status).toBe(201)
        expect(added.body.data.salonId).toBe(salonId)
        expect(listed.status).toBe(200)
        expect(idsOf(listed)).toEqual(
          expect.arrayContaining([existing.id, leaving.id, added.body.data.id]),
        )
        expect(one.status).toBe(200)
        expect(one.body.data).toEqual(existing)
        expect(changed.status).toBe(200)
        expect(changed.body.data.position).toBe('Changed')
        expect(removed.status).toBe(204)
        expect((await storedStaffMember(leaving.id)).deletedAt).not.toBeNull()
      },
    )

    it.each(mayNotKeep)(
      'forbids %s every operation, before looking at the ID, the query or the body, or for the salon or a staff member, and changes nothing',
      async (_case, signInAs) => {
        const created = await createStaff()
        const authorization = await signInAs(salonId, await insertSalon(db))
        const before = await storedStaff()

        const responses = [
          await list('', authorization),
          await list('limit=abc', authorization),
          await list('page=2', authorization),
          await list(`cursor=${UNKNOWN_ID}`, authorization),
          await list('', authorization, UNKNOWN_ID),
          await post(
            staffRequest({ email: 'new@example.com', staffCode: null }),
            authorization,
          ),
          await post(staffRequest({ firstName: '' }), authorization),
          await post({}, authorization),
          await post(staffRequest({ email: created.email }), authorization),
          await post(staffRequest(), authorization, UNKNOWN_ID),
          await get(created.id, authorization),
          await get('latest', authorization),
          await get(UNKNOWN_ID, authorization),
          await get(created.id, authorization, UNKNOWN_ID),
          await patch(created.id, { position: 'Changed' }, authorization),
          await patch('latest', { position: 'Changed' }, authorization),
          await patch(created.id, {}, authorization),
          await patch(created.id, { firstName: '' }, authorization),
          await patch(UNKNOWN_ID, { position: 'Changed' }, authorization),
          await patch(
            created.id,
            { position: 'Changed' },
            authorization,
            UNKNOWN_ID,
          ),
          await remove(created.id, authorization),
          await remove('latest', authorization),
          await remove(UNKNOWN_ID, authorization),
          await remove(created.id, authorization, UNKNOWN_ID),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await storedStaff()).toEqual(before)
      },
    )

    it.each([...mayKeep, ...mayNotKeep])(
      'rejects a salon ID that is not a UUID from %s as invalid, whatever else is wrong',
      async (_case, signInAs) => {
        const created = await createStaff()
        const authorization = await signInAs(salonId, await insertSalon(db))
        const before = await storedStaff()

        const responses = [
          await list('limit=abc', authorization, 'latest'),
          await post(staffRequest({ firstName: '' }), authorization, 'latest'),
          await get('latest', authorization, 'latest'),
          await patch('latest', {}, authorization, 'latest'),
          await patch(created.id, { position: 'Changed' }, authorization, '42'),
          await remove('latest', authorization, 'latest'),
          await remove(created.id, authorization, `${salonId}0`),
        ]

        for (const response of responses) {
          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
        }
        expect(await storedStaff()).toEqual(before)
      },
    )

    it('lets the owner of a salon keep the ledger of that salon only', async () => {
      const otherSalonId = await insertSalon(db)
      const elsewhere = await createStaff({}, otherSalonId)
      const owner = await member('owner')(salonId, otherSalonId)
      const before = await storedStaff()

      const inAnotherSalon = [
        await list('', owner, otherSalonId),
        await post(
          staffRequest({ email: 'new@example.com', staffCode: null }),
          owner,
          otherSalonId,
        ),
        await get(elsewhere.id, owner, otherSalonId),
        await patch(elsewhere.id, { position: 'Changed' }, owner, otherSalonId),
        await remove(elsewhere.id, owner, otherSalonId),
      ]
      const inTheirSalon = await post(
        staffRequest({ email: 'new@example.com', staffCode: null }),
        owner,
      )

      for (const response of inAnotherSalon) {
        expectProblem(response, forbidden)
      }
      expect(inTheirSalon.status).toBe(201)
      expect(
        (await storedStaff()).filter(
          ({ id }) => id !== inTheirSalon.body.data.id,
        ),
      ).toEqual(before)
    })

    it('lets the owner of the salon keep its ledger when the path writes the ID of the salon in upper case', async () => {
      const created = await createStaff()
      const owner = await member('owner')(salonId, salonId)
      const inUpperCase = salonId.toUpperCase()

      const responses = [
        await list('', owner, inUpperCase),
        await post(
          staffRequest({ email: 'new@example.com', staffCode: null }),
          owner,
          inUpperCase,
        ),
        await get(created.id, owner, inUpperCase),
        await patch(created.id, { position: 'Changed' }, owner, inUpperCase),
        await remove(created.id, owner, inUpperCase),
      ]

      expect(responses.map(({ status }) => status)).toEqual([
        200, 201, 200, 200, 204,
      ])
    })

    it.each<['manager' | 'staff']>([['manager'], ['staff']])(
      'forbids a %s of the salon to read, change or delete the staff member that their own account belongs to',
      async (role) => {
        const own = await signedInMember(role)
        const before = await storedStaff()

        const responses = [
          await get(own.staffId, own.authorization),
          await patch(own.staffId, { bio: 'About me' }, own.authorization),
          await patch(own.staffId, { isActive: false }, own.authorization),
          await remove(own.staffId, own.authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await storedStaff()).toEqual(before)
      },
    )

    it('forbids the owner of a deleted salon to keep its ledger, where an admin is told the salon is not found', async () => {
      const created = await createStaff()
      const owner = await member('owner')(salonId, salonId)
      await deleteSalon(salonId)
      const before = await storedStaff()

      const fromOwner = [
        await list('', owner),
        await post(staffRequest({ email: 'new@example.com' }), owner),
        await get(created.id, owner),
        await patch(created.id, { position: 'Changed' }, owner),
        await remove(created.id, owner),
      ]
      const fromAdmin = [
        await list(),
        await post(staffRequest({ email: 'new@example.com' })),
        await get(created.id),
        await patch(created.id, { position: 'Changed' }),
        await remove(created.id),
      ]

      for (const response of fromOwner) {
        expectProblem(response, forbidden)
      }
      for (const response of fromAdmin) {
        expectProblem(response, notFound)
      }
      expect(await storedStaff()).toEqual(before)
    })

    /** Sends a body that says it is JSON but is not. */
    const notJson = (call: Test, authorization: string | null): Test =>
      authorized(call, authorization)
        .set('Content-Type', 'application/json')
        .send('{"firstName": "Hanako"')

    /** The status and the code of a problem. */
    const statusAndCode = (response: Response): string =>
      `${response.status} ${response.body.code}`

    it('answers a body it cannot read before it looks at the token or the permission, as every route does', async () => {
      const created = await createStaff()
      const refused = await member('manager')(salonId, salonId)
      const one = `${staffOf(salonId)}/${created.id}`

      const responses = [
        await notJson(request(app).post(staffOf(salonId)), null),
        await notJson(request(app).patch(one), null),
        await authorized(request(app).post(staffOf(salonId)), null)
          .set('Content-Type', 'text/plain')
          .send('Hanako Yamada'),
        await notJson(request(app).post(staffOf(salonId)), refused),
        await notJson(request(app).patch(one), refused),
        await notJson(request(app).post(staffOf('latest')), refused),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '415 2002',
        '400 2002',
        '400 2002',
        '400 2002',
      ])
    })

    it('checks an update in order: the token, the salon ID, the permission, the staff ID, the body, the own record, the salon, the staff member, what is taken', async () => {
      const created = await createStaff()
      const taken = await createStaff()
      const refused = await member('manager')(salonId, salonId)
      const owner = await signedInMember('owner')

      const outcomes = [
        await patch('latest', {}, null, 'latest'),
        await patch('latest', {}, refused, 'latest'),
        await patch('latest', {}, refused, UNKNOWN_ID),
        await patch('latest', {}, asAdmin, UNKNOWN_ID),
        await patch(UNKNOWN_ID, {}, asAdmin, UNKNOWN_ID),
        await patch(
          owner.staffId,
          { isActive: false, displayName: ' ' },
          owner.authorization,
        ),
        await patch(owner.staffId, { isActive: false }, owner.authorization),
        await patch(UNKNOWN_ID, { email: taken.email }, asAdmin, UNKNOWN_ID),
        await patch(UNKNOWN_ID, { email: taken.email }),
        await patch(created.id, { email: taken.email }),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '400 id:invalid_format',
        '400 :custom',
        '400 displayName:invalid_format',
        '409 You cannot deactivate your own staff record',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        `409 Staff member with email ${taken.email} already exists`,
      ])
    })

    it('checks a registration in order: the token, the salon ID, the permission, the body, the salon, what is taken', async () => {
      const taken = await createStaff()
      const refused = await member('manager')(salonId, salonId)
      const body = staffRequest({ email: taken.email, staffCode: null })

      const outcomes = [
        await post({}, null, 'latest'),
        await post({}, refused, 'latest'),
        await post({}, refused, UNKNOWN_ID),
        await post({ ...body, firstName: '' }, asAdmin, UNKNOWN_ID),
        await post(body, asAdmin, UNKNOWN_ID),
        await post(body),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '400 firstName:invalid_format',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `409 Staff member with email ${taken.email} already exists`,
      ])
    })

    it('checks a list, a read and a deletion in order: the token, the salon ID, the permission, the query or the staff ID, the own record, the salon, the staff member', async () => {
      const refused = await member('manager')(salonId, salonId)
      const owner = await signedInMember('owner')

      const outcomes = [
        await list('limit=abc', null, 'latest'),
        await list('limit=abc', refused, 'latest'),
        await list('limit=abc', refused),
        await list(`limit=0&cursor=${UNKNOWN_ID}`, asAdmin, UNKNOWN_ID),
        await list(`cursor=${UNKNOWN_ID}`, asAdmin, UNKNOWN_ID),
        await list(`cursor=${UNKNOWN_ID}`),
        await get('latest', null, 'latest'),
        await get('latest', refused, 'latest'),
        await get('latest', refused),
        await get('latest', asAdmin, UNKNOWN_ID),
        await get(UNKNOWN_ID, asAdmin, UNKNOWN_ID),
        await get(UNKNOWN_ID),
        await remove('latest', null, 'latest'),
        await remove('latest', refused, 'latest'),
        await remove('latest', refused),
        await remove('latest', asAdmin, UNKNOWN_ID),
        await remove(owner.staffId, owner.authorization),
        await remove(UNKNOWN_ID, asAdmin, UNKNOWN_ID),
        await remove(UNKNOWN_ID),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '400 salonId:invalid_format',
        '403',
        '400 limit:too_small',
        `404 Salon ${UNKNOWN_ID} was not found`,
        '400 cursor:not_found',
        '401',
        '400 salonId:invalid_format',
        '403',
        '400 id:invalid_format',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
        '401',
        '400 salonId:invalid_format',
        '403',
        '400 id:invalid_format',
        '409 You cannot delete your own staff record',
        `404 Salon ${UNKNOWN_ID} was not found`,
        `404 Staff member ${UNKNOWN_ID} was not found`,
      ])
    })
  })

  describe('the staff member that an account belongs to', () => {
    /** The status of a change of the salon, which its owner and its managers may make. */
    const changeSalonAs = async (authorization: string): Promise<number> =>
      (
        await request(app)
          .patch(`${SALONS}/${salonId}`)
          .set('Authorization', authorization)
          .send({ description: 'Changed by a member of the salon' })
      ).status

    it('is not deactivated and not deleted by the account itself, and stays as it is', async () => {
      const owner = await signedInMember('owner')
      const before = await storedStaff()

      const deactivated = [
        await patch(owner.staffId, { isActive: false }, owner.authorization),
        await patch(
          owner.staffId,
          { position: 'Owner', isActive: false },
          owner.authorization,
        ),
        await patch(
          owner.staffId.toUpperCase(),
          { isActive: false },
          owner.authorization,
          salonId.toUpperCase(),
        ),
      ]
      const removed = [
        await remove(owner.staffId, owner.authorization),
        await remove(
          owner.staffId.toUpperCase(),
          owner.authorization,
          salonId.toUpperCase(),
        ),
      ]

      for (const response of deactivated) {
        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          'You cannot deactivate your own staff record',
        )
      }
      for (const response of removed) {
        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(
          'You cannot delete your own staff record',
        )
      }
      expect(await storedStaff()).toEqual(before)
      expect((await list('', owner.authorization)).status).toBe(200)
    })

    it('has its other properties changed by the account itself, which may also state that it is active', async () => {
      const owner = await signedInMember('owner')

      const changed = await patch(
        owner.staffId,
        { position: 'Owner', canReceiveBookings: false },
        owner.authorization,
      )
      const stillActive = await patch(
        owner.staffId,
        { isActive: true },
        owner.authorization,
      )

      expect(changed.status).toBe(200)
      expect(changed.body.data).toMatchObject({
        id: owner.staffId,
        position: 'Owner',
        canReceiveBookings: false,
        isActive: true,
      })
      expect(stillActive.status).toBe(200)
      expect((await list('', owner.authorization)).status).toBe(200)
    })

    it('answers an invalid request of the account itself with the broken rules, not with the conflict', async () => {
      const owner = await signedInMember('owner')

      const response = await patch(
        owner.staffId,
        { isActive: false, displayName: ' ' },
        owner.authorization,
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['displayName:invalid_format'])
    })

    it('may be deactivated and deleted by an administrator and by another owner of the salon, also when it is the one of an owner', async () => {
      const first = await signedInMember('owner')
      const second = await signedInMember('owner')

      const byOtherOwner = await patch(
        second.staffId,
        { isActive: false },
        first.authorization,
      )
      const refusedMeanwhile = await list('', second.authorization)
      const reactivated = await patch(second.staffId, { isActive: true })
      const allowedAgain = await list('', second.authorization)
      const removedByOtherOwner = await remove(
        first.staffId,
        second.authorization,
      )
      const removedByAdmin = await remove(second.staffId)

      expect(byOtherOwner.status).toBe(200)
      expectProblem(refusedMeanwhile, forbidden)
      expect(reactivated.status).toBe(200)
      expect(allowedAgain.status).toBe(200)
      expect(removedByOtherOwner.status).toBe(204)
      expect(removedByAdmin.status).toBe(204)
      expectProblem(await list('', first.authorization), forbidden)
      expectProblem(await list('', second.authorization), forbidden)
    })

    it('takes the salon from the account when it is deactivated, from the next request on, and gives it back when it is active again; the account stays signed in', async () => {
      const manager = await signedInMember('manager')
      expect(await changeSalonAs(manager.authorization)).toBe(200)

      const deactivated = await patch(manager.staffId, { isActive: false })
      const whileInactive = await changeSalonAs(manager.authorization)
      const signedInMeanwhile = await me(manager.authorization)
      const reactivated = await patch(manager.staffId, { isActive: true })
      const afterwards = await changeSalonAs(manager.authorization)

      expect(deactivated.status).toBe(200)
      expect(whileInactive).toBe(403)
      expect(signedInMeanwhile.status).toBe(200)
      expect(signedInMeanwhile.body.data.email).toBe(manager.email)
      expect(reactivated.status).toBe(200)
      expect(afterwards).toBe(200)
    })

    it('takes the salon from the account when it is deleted: the account still signs in, to nothing of the salon', async () => {
      const owner = await signedInMember('owner')
      const manager = await signedInMember('manager')
      expect(await changeSalonAs(manager.authorization)).toBe(200)

      const removed = await remove(manager.staffId, owner.authorization)
      const withTheOldSession = await changeSalonAs(manager.authorization)
      const signedInMeanwhile = await me(manager.authorization)
      const again = await signIn(app, manager.email)
      const withANewSession = await changeSalonAs(again.authorization)

      expect(removed.status).toBe(204)
      expect(withTheOldSession).toBe(403)
      expect(signedInMeanwhile.status).toBe(200)
      expect(withANewSession).toBe(403)
      expect(await changeSalonAs(owner.authorization)).toBe(200)
    })

    it('does not concern a staff member of another salon with the same account holder: the conflict is about the record of the account only', async () => {
      const owner = await signedInMember('owner')
      const other = await createStaff({ email: owner.email })

      const deactivated = await patch(
        other.id,
        { isActive: false },
        owner.authorization,
      )
      const removed = await remove(other.id, owner.authorization)

      expect(deactivated.status).toBe(200)
      expect(removed.status).toBe(204)
      expect((await list('', owner.authorization)).status).toBe(200)
    })
  })

  describe('requests at the same moment', () => {
    it('lets exactly one of several registrations with the same email in one salon succeed and answers the others with 409', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `race-${round}@example.com`

        const responses = await Promise.all(
          [0, 1, 2, 3].map(() =>
            post(staffRequest({ email, staffCode: null })),
          ),
        )

        expect(responses.map(({ status }) => status).sort()).toEqual([
          201, 409, 409, 409,
        ])
        expect(await liveStaffWithEmail(email)).toBe(1)
      }
    })

    it('lets registrations with the same email in different salons all succeed', async () => {
      const salonIds = [salonId, await insertSalon(db), await insertSalon(db)]
      for (let round = 0; round < 5; round += 1) {
        const email = `shared-${round}@example.com`

        const responses = await Promise.all(
          salonIds.map((salon) =>
            post(staffRequest({ email, staffCode: null }), asAdmin, salon),
          ),
        )

        expect(responses.map(({ status }) => status)).toEqual([201, 201, 201])
      }
    })

    it('lets exactly one of several registrations with the same staff code in one salon succeed and answers the others with 409', async () => {
      for (let round = 0; round < 5; round += 1) {
        const staffCode = `RACE-${round}`

        const responses = await Promise.all(
          [0, 1, 2, 3].map((index) =>
            post(
              staffRequest({
                email: `race-${round}-${index}@example.com`,
                staffCode,
              }),
            ),
          ),
        )

        expect(responses.map(({ status }) => status).sort()).toEqual([
          201, 409, 409, 409,
        ])
        expect(await db.$count(staff, eq(staff.staffCode, staffCode))).toBe(1)
      }
    })

    it('lets exactly one of two staff members of a salon take the same email', async () => {
      for (let round = 0; round < 5; round += 1) {
        const [first, second] = [await createStaff(), await createStaff()]
        const email = `wanted-${round}@example.com`

        const responses = await Promise.all([
          patch(first.id, { email }),
          patch(second.id, { email }),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([200, 409])
        expect(await liveStaffWithEmail(email)).toBe(1)
      }
    })

    it('lets exactly one of several DELETEs of the same staff member succeed and answers the others with 404', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createStaff()

        const responses = await Promise.all([
          remove(created.id),
          remove(created.id),
          remove(created.id),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([
          204, 404, 404,
        ])
        expect((await storedStaffMember(created.id)).deletedAt).not.toBeNull()
      }
    })

    it('deletes a staff member who is being changed: the update succeeds or is not found, and the staff member is deleted afterwards', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createStaff()

        const [changed, removed] = await Promise.all([
          patch(created.id, { position: `Round ${round}` }),
          remove(created.id),
        ])

        expect(removed.status).toBe(204)
        expect([200, 404]).toContain(changed.status)
        expect((await storedStaffMember(created.id)).deletedAt).not.toBeNull()
      }
    })

    it('lets a registration take the email of a staff member who is being deleted, or refuses it, and never leaves two staff members of the salon with the email', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `handover-${round}@example.com`
        const leaving = await createStaff({ email })

        const [removed, created] = await Promise.all([
          remove(leaving.id),
          post(staffRequest({ email, staffCode: null })),
        ])

        expect(removed.status).toBe(204)
        expect([201, 409]).toContain(created.status)
        expect(await liveStaffWithEmail(email)).toBe(
          created.status === 201 ? 1 : 0,
        )
      }
    })

    it('keeps both of two changes of different properties of one staff member', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createStaff()

        const responses = await Promise.all([
          patch(created.id, { position: `Position ${round}` }),
          patch(created.id, { bio: `Bio ${round}` }),
        ])

        expect(responses.map(({ status }) => status)).toEqual([200, 200])
        expect(await storedStaffMember(created.id)).toMatchObject({
          position: `Position ${round}`,
          bio: `Bio ${round}`,
        })
      }
    })

    it('does not keep two owners of a salon from deactivating each other at the same moment; an administrator gives the salon back', async () => {
      for (let round = 0; round < 3; round += 1) {
        const first = await signedInMember('owner')
        const second = await signedInMember('owner')

        const responses = await Promise.all([
          patch(second.staffId, { isActive: false }, first.authorization),
          patch(first.staffId, { isActive: false }, second.authorization),
        ])

        const statuses = responses.map(({ status }) => status)
        expect(statuses).toContain(200)
        for (const status of statuses) {
          expect([200, 403]).toContain(status)
        }
        const restored = [
          await patch(first.staffId, { isActive: true }),
          await patch(second.staffId, { isActive: true }),
        ]
        expect(restored.map(({ status }) => status)).toEqual([200, 200])
        expect((await list('', first.authorization)).status).toBe(200)
        expect((await list('', second.authorization)).status).toBe(200)
      }
    })
  })

  describe('StaffRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new StaffRepository(db)
    const salon = (id: string) => salonIdSchema.parse(id)
    const member = (id: string) => staffIdSchema.parse(id)

    /** The values of a new staff member with nothing that may be unset. */
    const newStaff = (overrides: Partial<DbNewStaff> = {}): DbNewStaff => ({
      firstName: 'Hanako',
      lastName: 'Yamada',
      firstNameKana: null,
      lastNameKana: null,
      displayName: 'Hanako',
      email: `new-${randomUUID()}@example.com`,
      phoneNumber: '090-1234-5678',
      alternativePhone: null,
      staffCode: null,
      level: 'stylist',
      position: null,
      specialties: [],
      bio: null,
      imageUrl: null,
      yearsOfExperience: null,
      certifications: [],
      hireDate: null,
      employmentType: null,
      baseSalary: null,
      commissionRate: null,
      canReceiveBookings: true,
      maxConcurrentBookings: 1,
      bufferTimeBefore: 0,
      bufferTimeAfter: 0,
      isActive: true,
      ...overrides,
    })

    const criteria = (
      overrides: Partial<StaffListCriteria> = {},
    ): StaffListCriteria => ({
      salonId: salon(salonId),
      limit: 10,
      after: null,
      ...overrides,
    })

    /** Stores a staff member through the repository and returns the row. */
    const stored = async (
      overrides: Partial<DbNewStaff> = {},
      ofSalon: string = salonId,
    ) => dataOf(await repository().create(salon(ofSalon), newStaff(overrides)))

    /** The IDs of the staff members of a list, in its order. */
    const listedIds = (
      result: Result<{ staff: { id: string }[] } | null, DomainError>,
    ): string[] => dataOf(result)?.staff.map(({ id }) => id) ?? []

    describe('create', () => {
      it('stores the staff member in the salon it is given and resolves to the row, not deleted and without a login account', async () => {
        const values = newStaff({
          staffCode: 'STF-001',
          specialties: ['cut', 'color'],
          certifications: ['美容師免許'],
          hireDate: '2020-04-01',
          baseSalary: 300000,
          commissionRate: '12.50',
        })

        const row = dataOf(await repository().create(salon(salonId), values))

        expect(row).toEqual({
          ...values,
          id: expect.stringMatching(UUID),
          salonId,
          userId: null,
          deletedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        })
        expect(await storedStaff()).toEqual([row])
      })

      it('refuses the email of a staff member of the salon who is not deleted and any staff code of the salon with alreadyExists, naming the field and the value, and stores nothing', async () => {
        await stored({ email: 'taken@example.com', staffCode: 'LIVE' })
        const deleted = await stored({ staffCode: 'GONE' })
        dataOf(await repository().delete(salon(salonId), member(deleted.id)))

        const results = [
          await repository().create(
            salon(salonId),
            newStaff({ email: 'taken@example.com' }),
          ),
          await repository().create(
            salon(salonId),
            newStaff({ staffCode: 'LIVE' }),
          ),
          await repository().create(
            salon(salonId),
            newStaff({ staffCode: 'GONE' }),
          ),
        ]

        expect(results).toEqual([
          {
            type: 'error',
            error: {
              type: 'alreadyExists',
              entity: 'Staff member',
              field: 'email',
              value: 'taken@example.com',
            },
          },
          {
            type: 'error',
            error: {
              type: 'alreadyExists',
              entity: 'Staff member',
              field: 'staffCode',
              value: 'LIVE',
            },
          },
          {
            type: 'error',
            error: {
              type: 'alreadyExists',
              entity: 'Staff member',
              field: 'staffCode',
              value: 'GONE',
            },
          },
        ])
        expect(await db.$count(staff)).toBe(2)
      })

      it('lets another salon have the email and the staff code, and the salon itself the email of a deleted staff member', async () => {
        const otherSalonId = await insertSalon(db)
        const first = await stored({
          email: 'shared@example.com',
          staffCode: 'STF-001',
        })
        const deleted = await stored({ email: 'gone@example.com' })
        dataOf(await repository().delete(salon(salonId), member(deleted.id)))

        const elsewhere = await stored(
          { email: 'shared@example.com', staffCode: 'STF-001' },
          otherSalonId,
        )
        const again = await stored({ email: 'gone@example.com' })

        expect(elsewhere).toMatchObject({
          salonId: otherSalonId,
          email: first.email,
          staffCode: first.staffCode,
        })
        expect(again.id).not.toBe(deleted.id)
      })

      it('resolves to a database error for a salon that does not exist', async () => {
        const result = await repository().create(salon(UNKNOWN_ID), newStaff())

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to create staff member' },
        })
        expect(await db.$count(staff)).toBe(0)
      })
    })

    describe('findById', () => {
      it('finds a staff member of the salon, and resolves to null for a deleted one, one of another salon and an ID that no staff member has', async () => {
        const otherSalonId = await insertSalon(db)
        const row = await stored()
        const deleted = await stored()
        const elsewhere = await stored({}, otherSalonId)
        dataOf(await repository().delete(salon(salonId), member(deleted.id)))

        const results = [
          await repository().findById(salon(salonId), member(row.id)),
          await repository().findById(salon(salonId), member(deleted.id)),
          await repository().findById(salon(salonId), member(elsewhere.id)),
          await repository().findById(salon(otherSalonId), member(row.id)),
          await repository().findById(salon(salonId), member(UNKNOWN_ID)),
        ]

        expect(results.map(dataOf)).toEqual([row, null, null, null, null])
      })
    })

    describe('list', () => {
      it('lists the staff members of the salon in the order of their registration, with their number and whether more follow', async () => {
        const ledger = await insertLedger()

        const whole = await repository().list(criteria())
        const firstTwo = await repository().list(criteria({ limit: 2 }))
        const exactly = await repository().list(criteria({ limit: 4 }))

        expect(listedIds(whole)).toEqual(ledger.all)
        expect(dataOf(whole)).toMatchObject({ total: 4, hasMore: false })
        expect(listedIds(firstTwo)).toEqual(ledger.all.slice(0, 2))
        expect(dataOf(firstTwo)).toMatchObject({ total: 4, hasMore: true })
        expect(dataOf(exactly)).toMatchObject({ total: 4, hasMore: false })
      })

      it('starts after the staff member the cursor names, deleted or not, and resolves to null for a cursor that names no staff member of the salon', async () => {
        const ledger = await insertLedger()

        const afterFirst = await repository().list(
          criteria({ after: member(ledger.first), limit: 2 }),
        )
        const afterDeleted = await repository().list(
          criteria({ after: member(ledger.deleted) }),
        )
        const afterLast = await repository().list(
          criteria({ after: member(ledger.fourth) }),
        )
        const ofOtherSalon = await repository().list(
          criteria({ after: member(ledger.elsewhere) }),
        )
        const unknown = await repository().list(
          criteria({ after: member(UNKNOWN_ID) }),
        )

        expect(listedIds(afterFirst)).toEqual([ledger.inactive, ledger.third])
        expect(dataOf(afterFirst)).toMatchObject({ total: 4, hasMore: true })
        expect(listedIds(afterDeleted)).toEqual([ledger.third, ledger.fourth])
        expect(dataOf(afterLast)).toEqual({
          staff: [],
          total: 4,
          hasMore: false,
        })
        expect(dataOf(ofOtherSalon)).toBeNull()
        expect(dataOf(unknown)).toBeNull()
      })

      it('resolves to an empty list for a salon without staff', async () => {
        await stored({}, await insertSalon(db))

        expect(dataOf(await repository().list(criteria()))).toEqual({
          staff: [],
          total: 0,
          hasMore: false,
        })
      })

      it('tells staff members apart whose registration times differ by a microsecond', async () => {
        const later = await insertStaffRow({
          createdAt: '2026-11-10 09:00:00.000002+00',
        })
        const earlier = await insertStaffRow({
          createdAt: '2026-11-10 09:00:00.000001+00',
        })

        const whole = await repository().list(criteria())
        const afterEarlier = await repository().list(
          criteria({ after: member(earlier) }),
        )
        const afterLater = await repository().list(
          criteria({ after: member(later) }),
        )

        expect(listedIds(whole)).toEqual([earlier, later])
        expect(listedIds(afterEarlier)).toEqual([later])
        expect(listedIds(afterLater)).toEqual([])
      })
    })

    describe('update', () => {
      it('changes the given columns of the staff member, moves updatedAt and resolves to the updated row', async () => {
        const row = await stored({ position: 'Stylist' })
        const other = await stored()

        const updated = dataOf(
          await repository().update(salon(salonId), member(row.id), {
            position: null,
            specialties: ['perm'],
            commissionRate: '7.25',
            isActive: false,
          }),
        )

        expect(updated).toEqual({
          ...row,
          position: null,
          specialties: ['perm'],
          commissionRate: '7.25',
          isActive: false,
          updatedAt: expect.any(String),
        })
        expect(await hasMoved(row.id)).toBe(true)
        expect(await storedStaffMember(other.id)).toEqual(other)
      })

      it('resolves to null for a deleted staff member, one of another salon and an ID that no staff member has, changing nothing', async () => {
        const otherSalonId = await insertSalon(db)
        const deleted = await stored()
        const elsewhere = await stored({}, otherSalonId)
        dataOf(await repository().delete(salon(salonId), member(deleted.id)))
        const before = await storedStaff()

        const results = [
          await repository().update(salon(salonId), member(deleted.id), {
            isActive: false,
          }),
          await repository().update(salon(salonId), member(elsewhere.id), {
            isActive: false,
          }),
          await repository().update(salon(salonId), member(UNKNOWN_ID), {
            isActive: false,
          }),
        ]

        expect(results.map(dataOf)).toEqual([null, null, null])
        expect(await storedStaff()).toEqual(before)
      })

      it('refuses an email or a staff code of another staff member of the salon with alreadyExists, naming the field and the value, and changes nothing', async () => {
        const row = await stored()
        await stored({ email: 'taken@example.com', staffCode: 'TAKEN' })
        const before = await storedStaff()

        const results = [
          await repository().update(salon(salonId), member(row.id), {
            position: 'Changed',
            email: 'taken@example.com',
          }),
          await repository().update(salon(salonId), member(row.id), {
            position: 'Changed',
            staffCode: 'TAKEN',
          }),
        ]

        expect(results).toEqual([
          {
            type: 'error',
            error: {
              type: 'alreadyExists',
              entity: 'Staff member',
              field: 'email',
              value: 'taken@example.com',
            },
          },
          {
            type: 'error',
            error: {
              type: 'alreadyExists',
              entity: 'Staff member',
              field: 'staffCode',
              value: 'TAKEN',
            },
          },
        ])
        expect(await storedStaff()).toEqual(before)
      })
    })

    describe('delete', () => {
      it('deletes a staff member of the salon, and finds none the second time, for one of another salon and for an ID that no staff member has', async () => {
        const otherSalonId = await insertSalon(db)
        const row = await stored()
        const elsewhere = await stored({}, otherSalonId)

        const results = [
          await repository().delete(salon(salonId), member(row.id)),
          await repository().delete(salon(salonId), member(row.id)),
          await repository().delete(salon(salonId), member(elsewhere.id)),
          await repository().delete(salon(otherSalonId), member(row.id)),
          await repository().delete(salon(salonId), member(UNKNOWN_ID)),
        ]

        expect(results.map(dataOf)).toEqual([
          { type: 'deleted' },
          { type: 'notFound' },
          { type: 'notFound' },
          { type: 'notFound' },
          { type: 'notFound' },
        ])
        expect((await storedStaffMember(row.id)).deletedAt).not.toBeNull()
        expect(await storedStaffMember(elsewhere.id)).toEqual(elsewhere)
      })

      it('keeps the time of the first deletion', async () => {
        const row = await stored()
        dataOf(await repository().delete(salon(salonId), member(row.id)))
        const afterFirst = await storedStaffMember(row.id)

        dataOf(await repository().delete(salon(salonId), member(row.id)))

        expect(await storedStaffMember(row.id)).toEqual(afterFirst)
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })

    it.each<[string, Partial<NewStaffRow>, string]>([
      [
        'an email with an upper-case letter',
        { email: 'Hanako@example.com' },
        'staff_email_lower_case',
      ],
      [
        'a negative buffer time before a booking',
        { bufferTimeBefore: -1 },
        'staff_buffer_times_not_negative',
      ],
      [
        'a negative buffer time after a booking',
        { bufferTimeAfter: -1 },
        'staff_buffer_times_not_negative',
      ],
      [
        'no booking at a time',
        { maxConcurrentBookings: 0 },
        'staff_max_concurrent_bookings_positive',
      ],
      [
        'negative years of experience',
        { yearsOfExperience: -1 },
        'staff_years_of_experience_not_negative',
      ],
      [
        'a negative base salary',
        { baseSalary: -1 },
        'staff_base_salary_not_negative',
      ],
      [
        'a negative commission rate',
        { commissionRate: '-0.01' },
        'staff_commission_rate_is_a_percentage',
      ],
      [
        'a commission rate above 100',
        { commissionRate: '100.01' },
        'staff_commission_rate_is_a_percentage',
      ],
    ])('refuses %s', async (_case, values, constraint) => {
      await expect(insertStaffRow(values)).rejects.toMatchObject(
        violationOf('23514', constraint),
      )
      expect(await db.$count(staff)).toBe(0)
    })

    it('accepts the values at the edges of the constraints, and no value where one may be unset', async () => {
      await insertStaffRow({
        bufferTimeBefore: 0,
        bufferTimeAfter: 0,
        maxConcurrentBookings: 1,
        yearsOfExperience: 0,
        baseSalary: 0,
        commissionRate: '0',
      })
      await insertStaffRow({ commissionRate: '100' })
      await insertStaffRow({
        yearsOfExperience: null,
        baseSalary: null,
        commissionRate: null,
      })

      expect(await db.$count(staff)).toBe(3)
    })

    it.each([
      'specialties',
      'certifications',
      'bufferTimeBefore',
      'bufferTimeAfter',
    ])('refuses NULL as %s of a staff member', async (column) => {
      const id = await insertStaffRow()

      await expect(
        db.execute(
          sql`UPDATE ${staff} SET ${sql.identifier(column)} = NULL WHERE ${staff.id} = ${id}`,
        ),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({
          code: '23502',
          column_name: column,
        }),
      })
    })

    it('has no default for the lists: a row that does not state them is refused', async () => {
      await expect(
        db.execute(
          sql`INSERT INTO ${staff} ("salonId", "firstName", "lastName", "displayName", "email", "phoneNumber") VALUES (${salonId}, 'Taro', 'Suzuki', 'Taro', 'taro@example.com', '03-0000-0000')`,
        ),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({ code: '23502' }),
      })
      expect(await db.$count(staff)).toBe(0)
    })

    it('keeps the email unique among the staff members of one salon who are not deleted: a deleted staff member and another salon may share it', async () => {
      const otherSalonId = await insertSalon(db)
      await insertStaffRow({
        email: 'shared@example.com',
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await insertStaffRow({ email: 'shared@example.com' })
      await insertStaffRow({ email: 'shared@example.com' }, otherSalonId)

      await expect(
        insertStaffRow({ email: 'shared@example.com' }),
      ).rejects.toMatchObject(violationOf('23505', 'staff_email_salon_unique'))
      expect(await db.$count(staff)).toBe(3)
    })

    it('keeps the staff code unique within a salon, the deleted staff members included, and lets another salon and staff members without a code be', async () => {
      const otherSalonId = await insertSalon(db)
      await insertStaffRow({
        staffCode: 'ONCE',
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await insertStaffRow({ staffCode: 'ONCE' }, otherSalonId)
      await insertStaffRow({ staffCode: null })
      await insertStaffRow({ staffCode: null })

      await expect(insertStaffRow({ staffCode: 'ONCE' })).rejects.toMatchObject(
        violationOf('23505', 'staff_code_salon_unique'),
      )
      expect(await db.$count(staff)).toBe(4)
    })
  })
})
