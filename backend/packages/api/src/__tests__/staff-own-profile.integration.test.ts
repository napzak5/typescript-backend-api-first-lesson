import { salons, staff } from '@beauty-salon-backend/database'
import { type DomainError, staffIdSchema } from '@beauty-salon-backend/domain'
import { StaffProfileRepository } from '@beauty-salon-backend/infrastructure'
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
  minutesFromNow,
  signedInUser,
  signIn,
  signInAsAdmin,
  updateUser,
} from './_shared/auth-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
} from './_shared/test-helpers'

const SALONS = '/api/v1/salons'
const STAFF_PROFILES = '/api/v1/staff-profiles'
const ME = `${STAFF_PROFILES}/me`

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

type Role = 'owner' | 'manager' | 'staff'
type NewStaff = typeof staff.$inferInsert

const ROLES: [Role][] = [['owner'], ['manager'], ['staff']]

/** Exactly the properties of StaffProfileResponse. */
const PROFILE_PROPERTIES = [
  'bio',
  'canReceiveBookings',
  'certifications',
  'displayName',
  'id',
  'imageUrl',
  'level',
  'position',
  'salonId',
  'specialties',
  'yearsOfExperience',
]

/** What customers are shown of the staff member of the account under test. */
const shown: Partial<NewStaff> = {
  displayName: 'Hanako',
  level: 'senior',
  position: 'Top stylist',
  specialties: ['cut', 'color'],
  bio: 'Ten years of cutting.',
  imageUrl: 'https://aoyama.example.com/staff/hanako.jpg',
  yearsOfExperience: 10,
  certifications: ['美容師免許'],
  canReceiveBookings: true,
}

/**
 * What the ledger keeps of that staff member and no profile shows, with
 * values that appear nowhere else in a response.
 */
const keptToTheSalon: Partial<NewStaff> = {
  firstName: 'Private-First',
  lastName: 'Private-Last',
  firstNameKana: 'ヒミツノメイ',
  lastNameKana: 'ヒミツノセイ',
  phoneNumber: '090-5555-0001',
  alternativePhone: '03-5555-0002',
  hireDate: '2019-07-08',
  employmentType: 'part-time',
  baseSalary: 987654,
  commissionRate: '34.56',
  maxConcurrentBookings: 7,
  bufferTimeBefore: 13,
  bufferTimeAfter: 17,
}

/**
 * The values above that are long enough to appear nowhere else in a
 * response by chance: a short number is part of many IDs.
 */
const privateValues = Object.values(keptToTheSalon)
  .map(String)
  .filter((text) => text.length >= 5)

/** A value for every property a staff member writes, other than what `shown` has. */
const everything = {
  specialties: ['cut', 'perm', 'ヘッドスパ'],
  bio: 'Fifteen years of cutting.\nLoves short hair.',
  imageUrl: 'https://aoyama.example.com/staff/hanako-2.jpg',
  yearsOfExperience: 15,
  certifications: ['美容師免許', '管理美容師'],
}

const urlOfLength = (length: number): string =>
  `https://example.com/${'a'.repeat(length - 'https://example.com/'.length)}`

/** Requests that break a rule of the ledger, with the rules they break. */
const violations: [string, object, string[]][] = [
  ['a blank biography', { bio: ' ' }, ['bio:invalid_format']],
  ['a biography that is no text', { bio: 3 }, ['bio:invalid_type']],
  [
    'an image that is no URL',
    { imageUrl: 'hanako.jpg' },
    ['imageUrl:invalid_format'],
  ],
  [
    'an image URL that is not http or https',
    { imageUrl: 'ftp://aoyama.example.com/hanako.jpg' },
    ['imageUrl:invalid_format'],
  ],
  [
    'an image URL of 501 characters',
    { imageUrl: urlOfLength(501) },
    ['imageUrl:too_big'],
  ],
  [
    'a specialty twice',
    { specialties: ['cut', 'cut'] },
    ['specialties.1:custom'],
  ],
  [
    'a blank specialty',
    { specialties: [' '] },
    ['specialties.0:invalid_format'],
  ],
  [
    'null for the specialties',
    { specialties: null },
    ['specialties:invalid_type'],
  ],
  [
    'a blank certification',
    { certifications: [''] },
    ['certifications.0:invalid_format'],
  ],
  [
    'null for the certifications',
    { certifications: null },
    ['certifications:invalid_type'],
  ],
  [
    'negative experience',
    { yearsOfExperience: -1 },
    ['yearsOfExperience:too_small'],
  ],
  [
    'more experience than 100 years',
    { yearsOfExperience: 101 },
    ['yearsOfExperience:too_big'],
  ],
  [
    'experience as text',
    { yearsOfExperience: '10' },
    ['yearsOfExperience:invalid_type'],
  ],
  ['a request that names no property', {}, [':custom']],
  ['a list in place of a request', [{ bio: null }], [':invalid_type']],
]

/** What the salon writes in the ledger, and what no request writes. */
const notTheStaffMembers: [string, unknown][] = [
  ['displayName', 'Hana'],
  ['level', 'master'],
  ['position', 'Director'],
  ['canReceiveBookings', false],
  ['isActive', false],
  ['email', 'hanako@elsewhere.example'],
  ['baseSalary', 1],
  ['id', UNKNOWN_ID],
  ['salonId', UNKNOWN_ID],
  ['userId', null],
  ['awards', []],
  ['deletedAt', null],
]

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('Staff own profile API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of the staff members most tests are about. */
  let salonId: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Reads the own profile; without a token if none is given. */
  const me = (as: string | null) => authorized(request(app).get(ME), as)

  /** Changes the own profile; without a token if none is given. */
  const change = (body: object, as: string | null) =>
    authorized(request(app).patch(ME), as).send(body)

  /** Reads a profile as customers do, without a token. */
  const shownToCustomers = (id: string) =>
    request(app).get(`${STAFF_PROFILES}/${id}`)

  /**
   * A staff member of a salon with an account of the role, linked both ways
   * and signed in. The staff member has a value in every column.
   */
  const memberOf = async (
    role: Role = 'staff',
    overrides: Partial<NewStaff> = {},
    salon: string = salonId,
  ) => {
    const user = await insertMember(db, role, salon, {
      ...keptToTheSalon,
      ...shown,
      ...overrides,
    })
    await db
      .update(staff)
      .set({ userId: user.id })
      .where(eq(staff.id, user.staffId))
    const { authorization } = await signIn(app, user.email)
    return { ...user, authorization }
  }

  const storedStaff = async (id: string) => {
    const [row] = await db.select().from(staff).where(eq(staff.id, id))
    if (row === undefined) {
      throw new Error(`No staff member ${id} is stored`)
    }
    return row
  }

  /** Every staff member as it is stored, in the order of the IDs. */
  const storedStaffRows = () => db.select().from(staff).orderBy(asc(staff.id))

  /** Whether the stored `updatedAt` of the staff member lies after its `createdAt`. */
  const hasMoved = async (id: string): Promise<boolean | undefined> => {
    const [row] = await db
      .select({ moved: sql<boolean>`${staff.updatedAt} > ${staff.createdAt}` })
      .from(staff)
      .where(eq(staff.id, id))
    return row?.moved
  }

  /** Changes a staff member through the ledger as the admin. */
  const changeInLedger = async (
    id: string,
    body: object,
    salon: string = salonId,
  ): Promise<void> => {
    const response = await request(app)
      .patch(`${SALONS}/${salon}/staff/${id}`)
      .set('Authorization', asAdmin)
      .send(body)
    expect(response.status).toBe(200)
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** Accounts that are signed in and are not the account of a staff member who works at a salon. */
  const withoutOwnProfile: [string, SignInAs][] = [
    ['an admin', async () => asAdmin],
    [
      'a customer',
      async () =>
        (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
          .authorization,
    ],
    [
      'a user without a customer record',
      async () => (await signedInUser(app, db)).authorization,
    ],
    [
      'an account of the staff role that belongs to no staff member',
      async () =>
        (await signedInUser(app, db, { role: 'staff' })).authorization,
    ],
    [
      'an account of the owner role that belongs to no staff member',
      async () =>
        (await signedInUser(app, db, { role: 'owner' })).authorization,
    ],
    [
      'a staff member who does not work at the salon any more',
      async () => (await memberOf('staff', { isActive: false })).authorization,
    ],
    [
      'a manager whose staff record is deleted',
      async () =>
        (await memberOf('manager', { deletedAt: '2026-11-01T00:00:00.000Z' }))
          .authorization,
    ],
    [
      'the owner of a deleted salon',
      async () =>
        (
          await memberOf(
            'owner',
            {},
            await insertSalon(db, { deletedAt: '2026-11-01T00:00:00.000Z' }),
          )
        ).authorization,
    ],
  ]

  /**
   * Tokens that both operations refuse, before anything else is looked at:
   * none, one that names no session, one that has run out.
   */
  const unauthenticated: [
    string,
    (userId: string) => Promise<string | null>,
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
      'an access token of the staff member that has run out',
      async (userId) =>
        (await insertSession(db, userId, { expiresAt: minutesFromNow(-1) }))
          .authorization,
      tokenExpired,
      INVALID_TOKEN_CHALLENGE,
    ],
  ]

  describe('GET /api/v1/staff-profiles/me', () => {
    it('returns what customers are shown of the staff member of the account, with a link to where customers read it', async () => {
      const self = await memberOf()

      const response = await me(self.authorization)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: { id: self.staffId, salonId, ...shown },
        meta: {
          correlationId: response.headers['x-request-id'],
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: ME, profile: `${STAFF_PROFILES}/${self.staffId}` },
      })
    })

    it('returns the profile that the link names, as customers read it', async () => {
      const self = await memberOf()

      const own = await me(self.authorization)
      const linked = await request(app).get(own.body.links.profile)

      expect(linked.status).toBe(200)
      expect(linked.body.data).toEqual(own.body.data)
    })

    it('returns the 11 properties of the profile and nothing else of the ledger, also to the staff member', async () => {
      const self = await memberOf('staff', { staffCode: 'PRIVATE-CODE' })

      const response = await me(self.authorization)

      expect(Object.keys(response.body.data).toSorted()).toEqual(
        PROFILE_PROPERTIES,
      )
      for (const value of [...privateValues, 'PRIVATE-CODE', self.email]) {
        expect(response.text).not.toContain(value)
      }
    })

    it.each(ROLES)(
      'returns the %s of a salon the profile of their own staff record',
      async (role) => {
        const self = await memberOf(role)
        await memberOf(role)

        const response = await me(self.authorization)

        expect(response.status).toBe(200)
        expect(response.body.data.id).toBe(self.staffId)
      },
    )

    it('returns each account its own profile', async () => {
      const first = await memberOf('staff', { displayName: 'First' })
      const colleague = await memberOf('manager', { displayName: 'Second' })
      const elsewhere = await memberOf(
        'staff',
        { displayName: 'Third' },
        await insertSalon(db),
      )

      const names = []
      for (const { authorization } of [first, colleague, elsewhere]) {
        names.push((await me(authorization)).body.data.displayName)
      }

      expect(names).toEqual(['First', 'Second', 'Third'])
    })

    it('returns null and empty lists for what is not set', async () => {
      const self = await memberOf('staff', {
        position: null,
        specialties: [],
        bio: null,
        imageUrl: null,
        yearsOfExperience: null,
        certifications: [],
      })

      const response = await me(self.authorization)

      expect(response.body.data).toMatchObject({
        position: null,
        specialties: [],
        bio: null,
        imageUrl: null,
        yearsOfExperience: null,
        certifications: [],
      })
    })

    it('shows what the salon changed in the ledger at once', async () => {
      const self = await memberOf()

      await changeInLedger(self.staffId, {
        displayName: 'Hana',
        level: 'expert',
        canReceiveBookings: false,
      })

      expect((await me(self.authorization)).body.data).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
        displayName: 'Hana',
        level: 'expert',
        canReceiveBookings: false,
      })
    })

    it('returns the profile of a staff member of a salon that takes no bookings at the moment', async () => {
      const closedSalonId = await insertSalon(db, { isActive: false })
      const self = await memberOf('staff', {}, closedSalonId)

      const response = await me(self.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id: self.staffId,
        salonId: closedSalonId,
      })
    })

    it('writes the links below the path as the request wrote it', async () => {
      const self = await memberOf()

      const response = await authorized(
        request(app).get('/API/v1/Staff-Profiles/ME'),
        self.authorization,
      )

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: '/API/v1/Staff-Profiles/me',
        profile: `/API/v1/Staff-Profiles/${self.staffId}`,
      })
    })

    it('reads nothing of the query', async () => {
      const self = await memberOf()
      const other = await memberOf()

      const response = await authorized(
        request(app).get(`${ME}?id=${other.staffId}&salonId=${UNKNOWN_ID}`),
        self.authorization,
      )

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(self.staffId)
    })
  })

  describe('PATCH /api/v1/staff-profiles/me', () => {
    it('changes the properties of the request, leaves every other column of the staff member, and returns the profile', async () => {
      const self = await memberOf('staff', { staffCode: 'STF-001' })
      const before = await storedStaff(self.staffId)

      const response = await change(
        { bio: 'Fifteen years of cutting.', yearsOfExperience: 15 },
        self.authorization,
      )

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          id: self.staffId,
          salonId,
          ...shown,
          bio: 'Fifteen years of cutting.',
          yearsOfExperience: 15,
        },
        meta: {
          correlationId: response.headers['x-request-id'],
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: ME, profile: `${STAFF_PROFILES}/${self.staffId}` },
      })
      expect(await storedStaff(self.staffId)).toEqual({
        ...before,
        bio: 'Fifteen years of cutting.',
        yearsOfExperience: 15,
        updatedAt: expect.any(String),
      })
      expect(await hasMoved(self.staffId)).toBe(true)
    })

    it.each(Object.entries(everything))(
      'changes %s alone',
      async (property, value) => {
        const self = await memberOf()
        const before = await storedStaff(self.staffId)

        const response = await change({ [property]: value }, self.authorization)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          id: self.staffId,
          salonId,
          ...shown,
          [property]: value,
        })
        expect(await storedStaff(self.staffId)).toEqual({
          ...before,
          [property]: value,
          updatedAt: expect.any(String),
        })
      },
    )

    it('changes the five properties at once', async () => {
      const self = await memberOf()
      const before = await storedStaff(self.staffId)

      const response = await change(everything, self.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
        ...everything,
      })
      expect(await storedStaff(self.staffId)).toEqual({
        ...before,
        ...everything,
        updatedAt: expect.any(String),
      })
    })

    it('clears what may be cleared with null, and the lists with an empty list', async () => {
      const cleared = {
        specialties: [],
        bio: null,
        imageUrl: null,
        yearsOfExperience: null,
        certifications: [],
      }
      const self = await memberOf()

      const response = await change(cleared, self.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
        ...cleared,
      })
      expect(await storedStaff(self.staffId)).toMatchObject(cleared)
    })

    it('accepts the largest values the ledger accepts', async () => {
      const largest = { imageUrl: urlOfLength(500), yearsOfExperience: 100 }
      const self = await memberOf()

      const response = await change(largest, self.authorization)

      expect(response.status).toBe(200)
      expect(await storedStaff(self.staffId)).toMatchObject(largest)
    })

    it('stores a value that the profile has already, and says when', async () => {
      const self = await memberOf()

      const response = await change({ bio: shown.bio }, self.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
      })
      expect(await hasMoved(self.staffId)).toBe(true)
    })

    it.each(ROLES)(
      'lets the %s of a salon change their own profile, and no other staff member of the salon',
      async (role) => {
        const self = await memberOf(role)
        const colleague = await memberOf(role)
        const elsewhere = await memberOf(role, {}, await insertSalon(db))
        const others = [
          await storedStaff(colleague.staffId),
          await storedStaff(elsewhere.staffId),
        ]

        const response = await change(everything, self.authorization)

        expect(response.status).toBe(200)
        expect(response.body.data.id).toBe(self.staffId)
        expect(await storedStaff(self.staffId)).toMatchObject(everything)
        expect([
          await storedStaff(colleague.staffId),
          await storedStaff(elsewhere.staffId),
        ]).toEqual(others)
      },
    )

    it('shows the change at once: to the staff member, to customers and in the ledger', async () => {
      const self = await memberOf()

      await change(everything, self.authorization)

      const own = await me(self.authorization)
      const toCustomers = await shownToCustomers(self.staffId)
      const inLedger = await request(app)
        .get(`${SALONS}/${salonId}/staff/${self.staffId}`)
        .set('Authorization', asAdmin)
      expect(own.body.data).toMatchObject(everything)
      expect(toCustomers.body.data).toEqual(own.body.data)
      expect(inLedger.body.data).toMatchObject(everything)
    })

    it('leaves what the salon changes in the ledger afterwards, and the salon leaves the change', async () => {
      const self = await memberOf()

      await change({ bio: 'Mine.' }, self.authorization)
      await changeInLedger(self.staffId, { displayName: 'Hana' })
      await change({ yearsOfExperience: 11 }, self.authorization)

      expect((await me(self.authorization)).body.data).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
        displayName: 'Hana',
        bio: 'Mine.',
        yearsOfExperience: 11,
      })
    })

    it.each(violations)(
      'rejects %s with 400 and changes nothing',
      async (_case, body, expected) => {
        const self = await memberOf()
        const before = await storedStaffRows()

        const response = await change(body, self.authorization)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff profile update')
        expect(brokenRules(response)).toEqual(expected)
        expect(await storedStaffRows()).toEqual(before)
      },
    )

    it.each(notTheStaffMembers)(
      'rejects %s, which is not the staff member’s to write, and changes nothing of a request that is fine otherwise',
      async (property, value) => {
        const self = await memberOf('owner')
        const before = await storedStaffRows()

        const response = await change(
          { ...everything, [property]: value },
          self.authorization,
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([`${property}:unrecognized_keys`])
        expect(await storedStaffRows()).toEqual(before)
      },
    )

    it('writes the links of the answer below the path as the request wrote it', async () => {
      const self = await memberOf()

      const response = await authorized(
        request(app).patch('/API/v1/Staff-Profiles/ME'),
        self.authorization,
      ).send({ bio: null })

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: '/API/v1/Staff-Profiles/me',
        profile: `/API/v1/Staff-Profiles/${self.staffId}`,
      })
    })

    it('reports every broken rule of a request at once', async () => {
      const self = await memberOf()

      const response = await change(
        {
          specialties: [''],
          bio: ' ',
          imageUrl: 'x',
          yearsOfExperience: -1,
          certifications: 'none',
          displayName: 'Hana',
        },
        self.authorization,
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual([
        'bio:invalid_format',
        'certifications:invalid_type',
        'displayName:unrecognized_keys',
        'imageUrl:invalid_format',
        'specialties.0:invalid_format',
        'yearsOfExperience:too_small',
      ])
    })
  })

  describe('who has a profile of their own', () => {
    it.each(unauthenticated)(
      'answers %s with 401 in both operations before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const self = await memberOf()
        const authorization = await tokenOf(self.id)
        const before = await storedStaffRows()

        const responses = [
          await me(authorization),
          await change(everything, authorization),
          await change({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedStaffRows()).toEqual(before)
      },
    )

    it.each(withoutOwnProfile)(
      'forbids %s both operations, before looking at the body, and writes nothing',
      async (_case, signInAs) => {
        await memberOf()
        const authorization = await signInAs()
        const before = await storedStaffRows()

        const responses = [
          await me(authorization),
          await change(everything, authorization),
          await change({ bio: ' ' }, authorization),
          await change({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await storedStaffRows()).toEqual(before)
      },
    )

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const self = await memberOf()
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).patch(ME), authorization)
          .set('Content-Type', 'application/json')
          .send('{"bio": "Fifteen years"')

      const responses = [
        await notJson(null),
        await notJson(asAdmin),
        await notJson(self.authorization),
        await authorized(request(app).patch(ME), null)
          .set('Content-Type', 'text/plain')
          .send('Fifteen years of cutting.'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
    })

    it('checks a change in order: the token, the account, the request', async () => {
      const self = await memberOf()

      const responses = [
        await change({}, null),
        await change({}, asAdmin),
        await change({}, self.authorization),
        await change({ bio: null }, self.authorization),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '200',
      ])
    })

    it('does not take "me" for the ID of a staff member: without a token it is 401, not a malformed ID', async () => {
      await memberOf()

      const own = await me(null)
      const byWord = await request(app).get(`${STAFF_PROFILES}/mine`)

      expectProblem(own, authenticationRequired)
      expectProblem(byWord, badRequest)
      expect(brokenRules(byWord)).toEqual(['id:invalid_format'])
    })

    it.each<[string, 'put' | 'post' | 'delete']>([
      ['replacing', 'put'],
      ['creating', 'post'],
      ['deleting', 'delete'],
    ])('has no operation for %s the own profile', async (_case, method) => {
      const self = await memberOf()
      const before = await storedStaffRows()

      const responses = [
        await request(app)
          [method](ME)
          .set('Authorization', self.authorization)
          .send(everything),
        await request(app)[method](ME).send(everything),
      ]

      for (const response of responses) {
        expectProblem(response, routeNotFound)
        expect(response.body.detail).toBe(
          `${method.toUpperCase()} ${ME} is not part of the API`,
        )
      }
      expect(await storedStaffRows()).toEqual(before)
    })

    it('has no operation for changing a profile by its ID, the own one included', async () => {
      const self = await memberOf('owner')
      const colleague = await memberOf()
      const before = await storedStaffRows()

      const responses = []
      for (const id of [self.staffId, colleague.staffId]) {
        responses.push(
          await request(app)
            .patch(`${STAFF_PROFILES}/${id}`)
            .set('Authorization', self.authorization)
            .send(everything),
        )
      }

      for (const response of responses) {
        expectProblem(response, routeNotFound)
      }
      expect(await storedStaffRows()).toEqual(before)
    })
  })

  describe('the account and its staff member change', () => {
    it('forbids both operations from the request after the staff member stops working at the salon, and allows them again when they are back', async () => {
      const self = await memberOf()

      await changeInLedger(self.staffId, { isActive: false })
      const gone = [
        await me(self.authorization),
        await change({ bio: 'Gone.' }, self.authorization),
      ]
      await changeInLedger(self.staffId, { isActive: true })
      const back = [
        await me(self.authorization),
        await change({ bio: 'Back.' }, self.authorization),
      ]

      expect(gone.map(statusAndCode)).toEqual(['403 1005', '403 1005'])
      expect(back.map(statusAndCode)).toEqual(['200', '200'])
      expect((await storedStaff(self.staffId)).bio).toBe('Back.')
    })

    it('forbids both operations once the account is unlinked from the staff member, whose profile stays', async () => {
      const self = await memberOf()

      const unlinked = await request(app)
        .delete(`${SALONS}/${salonId}/staff/${self.staffId}/account`)
        .set('Authorization', asAdmin)
      const responses = [
        await me(self.authorization),
        await change({ bio: 'Unlinked.' }, self.authorization),
      ]

      expect(unlinked.status).toBe(204)
      expect(responses.map(statusAndCode)).toEqual(['403 1005', '403 1005'])
      expect((await shownToCustomers(self.staffId)).body.data).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
      })
    })

    it('keeps the profile with the account when its role changes', async () => {
      const self = await memberOf('staff')

      const promoted = await request(app)
        .patch(`${SALONS}/${salonId}/staff/${self.staffId}/account`)
        .set('Authorization', asAdmin)
        .send({ role: 'manager' })
      const response = await change({ bio: 'Promoted.' }, self.authorization)

      expect(promoted.status).toBe(200)
      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id: self.staffId,
        bio: 'Promoted.',
      })
    })

    it('reads and writes the staff member that the account belongs to now, and the former one no more', async () => {
      const self = await memberOf('staff', { displayName: 'Before' })
      const next = await memberOf(
        'staff',
        { displayName: 'After' },
        await insertSalon(db),
      )
      const former = await storedStaff(self.staffId)

      await updateUser(db, next.id, { staffId: null })
      await updateUser(db, self.id, { staffId: next.staffId })
      const read = await me(self.authorization)
      const written = await change({ bio: 'Moved.' }, self.authorization)

      expect(read.body.data).toMatchObject({
        id: next.staffId,
        displayName: 'After',
      })
      expect(written.body.data).toMatchObject({
        id: next.staffId,
        bio: 'Moved.',
      })
      expect(await storedStaff(self.staffId)).toEqual(former)
    })

    it('forbids both operations once the salon is deleted', async () => {
      const self = await memberOf('owner')

      const deleted = await request(app)
        .delete(`${SALONS}/${salonId}`)
        .set('Authorization', asAdmin)
      const responses = [
        await me(self.authorization),
        await change({ bio: 'Closed.' }, self.authorization),
      ]

      expect(deleted.status).toBe(204)
      expect(responses.map(statusAndCode)).toEqual(['403 1005', '403 1005'])
      expect((await storedStaff(self.staffId)).bio).toBe(shown.bio)
    })
  })

  describe('requests at the same moment', () => {
    // The change is one statement that writes only a staff member who is
    // shown. It waits for the row while another transaction holds it, and
    // then looks at the row as that transaction left it.
    it.each<[string, Partial<NewStaff>]>([
      ['stops working at the salon', { isActive: false }],
      ['is deleted', { deletedAt: '2026-11-15T09:00:00.000Z' }],
    ])(
      'lets a change wait while the staff member %s, then answers 404 and writes nothing',
      async (_case, leaving) => {
        const self = await memberOf()

        const { pending } = await db.transaction(async (tx) => {
          await tx.update(staff).set(leaving).where(eq(staff.id, self.staffId))
          const underWay = change(
            { bio: 'Too late.' },
            self.authorization,
          ).then((response) => response)
          await pause(300)

          return { pending: underWay }
        })
        const response = await pending

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Staff member ${self.staffId} was not found`,
        )
        expect((await storedStaff(self.staffId)).bio).toBe(shown.bio)
        expect(await hasMoved(self.staffId)).toBe(false)
      },
    )

    it('lets a change wait for a change of the ledger that is under way, and keeps both', async () => {
      const self = await memberOf()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(staff)
          .set({ displayName: 'Hana', bio: 'By the salon.' })
          .where(eq(staff.id, self.staffId))
        const underWay = change(
          { yearsOfExperience: 11 },
          self.authorization,
        ).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
        displayName: 'Hana',
        bio: 'By the salon.',
        yearsOfExperience: 11,
      })
      expect(await storedStaff(self.staffId)).toMatchObject({
        displayName: 'Hana',
        bio: 'By the salon.',
        yearsOfExperience: 11,
      })
    })

    it('does not wait for the salon: a change that arrives while the salon is being deleted is written', async () => {
      const self = await memberOf()

      const response = await db.transaction(async (tx) => {
        await tx
          .update(salons)
          .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
          .where(eq(salons.id, salonId))

        return change({ bio: 'Just in time.' }, self.authorization)
      })

      expect(response.status).toBe(200)
      expect((await storedStaff(self.staffId)).bio).toBe('Just in time.')
      expectProblem(await me(self.authorization), forbidden)
    })

    it('keeps every change when several of different properties arrive together', async () => {
      const self = await memberOf()

      const responses = await Promise.all(
        Object.entries(everything).map(([property, value]) =>
          change({ [property]: value }, self.authorization),
        ),
      )

      expect(responses.map(({ status }) => status)).toEqual([
        200, 200, 200, 200, 200,
      ])
      expect(await storedStaff(self.staffId)).toMatchObject(everything)
    })
  })

  describe('StaffProfileRepository.update', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new StaffProfileRepository(db)
    const member = (id: string) => staffIdSchema.parse(id)

    it('writes the given columns and the time of the change, and resolves to the columns customers are shown', async () => {
      const self = await memberOf('staff', {
        staffCode: 'STF-001',
        awards: [{ name: 'Cut of the year', year: 2024 }],
      })
      const before = await storedStaff(self.staffId)

      const profile = dataOf(
        await repository().update(member(self.staffId), {
          bio: 'Colours hair.',
          certifications: [],
        }),
      )

      expect(profile).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
        bio: 'Colours hair.',
        certifications: [],
      })
      expect(await storedStaff(self.staffId)).toEqual({
        ...before,
        bio: 'Colours hair.',
        certifications: [],
        updatedAt: expect.any(String),
      })
      expect(await hasMoved(self.staffId)).toBe(true)
    })

    it('writes every column it may be given', async () => {
      const self = await memberOf()

      const profile = dataOf(
        await repository().update(member(self.staffId), everything),
      )

      expect(profile).toEqual({
        id: self.staffId,
        salonId,
        ...shown,
        ...everything,
      })
    })

    it('writes the staff member it is given and no other, of the same salon or of another', async () => {
      const self = await memberOf()
      const colleague = await memberOf()
      const elsewhere = await memberOf('staff', {}, await insertSalon(db))
      const others = [
        await storedStaff(colleague.staffId),
        await storedStaff(elsewhere.staffId),
      ]

      await repository().update(member(self.staffId), { bio: 'Mine.' })

      expect([
        await storedStaff(colleague.staffId),
        await storedStaff(elsewhere.staffId),
      ]).toEqual(others)
    })

    it.each<[string, Partial<NewStaff>, Partial<typeof salons.$inferInsert>]>([
      ['who does not work at the salon any more', { isActive: false }, {}],
      ['who is deleted', { deletedAt: '2026-11-01T00:00:00.000Z' }, {}],
      ['of a deleted salon', {}, { deletedAt: '2026-11-01T00:00:00.000Z' }],
    ])(
      'resolves to null and writes nothing for a staff member %s, while other salons have staff who are shown',
      async (_case, staffOverrides, salonOverrides) => {
        await memberOf()
        await memberOf('staff', {}, await insertSalon(db))
        const hidden = await memberOf(
          'staff',
          staffOverrides,
          await insertSalon(db, salonOverrides),
        )
        const before = await storedStaffRows()

        const result = await repository().update(
          member(hidden.staffId),
          everything,
        )

        expect(result).toEqual({ type: 'success', data: null })
        expect(await storedStaffRows()).toEqual(before)
      },
    )

    it('resolves to null and writes nothing for an ID that no staff member has', async () => {
      await memberOf()
      const before = await storedStaffRows()

      const result = await repository().update(member(UNKNOWN_ID), everything)

      expect(result).toEqual({ type: 'success', data: null })
      expect(await storedStaffRows()).toEqual(before)
    })

    it('writes a staff member of a salon that takes no bookings at the moment', async () => {
      const closedSalonId = await insertSalon(db, { isActive: false })
      const self = await memberOf('staff', {}, closedSalonId)

      const profile = dataOf(
        await repository().update(member(self.staffId), { bio: 'Closed.' }),
      )

      expect(profile).toMatchObject({
        id: self.staffId,
        salonId: closedSalonId,
        bio: 'Closed.',
      })
    })

    it('resolves to a database error when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()

      const result = await new StaffProfileRepository(
        connection.database,
      ).update(member(UNKNOWN_ID), { bio: null })
      await connection.close()

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'database', message: 'Failed to update staff profile' },
      })
    })
  })
})
