import { randomUUID } from 'node:crypto'
import { salons, staff } from '@beauty-salon-backend/database'
import {
  type DomainError,
  type StaffProfileListCriteria,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { StaffProfileRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { eq } from 'drizzle-orm'
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
  connectUnreachableDatabase,
  createTestApp,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
} from '../../../__tests__/_shared/test-helpers'

const SALONS = '/api/v1/salons'
const STAFF_PROFILES = '/api/v1/staff-profiles'

/** Where the staff ledger of a salon is. */
const staffOf = (salonId: string): string => `${SALONS}/${salonId}/staff`

/** A UUID that neither a salon nor a staff member has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const databaseProblem = { status: 500, code: '4003', type: 'database' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

/** A staff profile as the API returns it. */
type StaffProfile = {
  id: string
  salonId: string
  displayName: string
  level: string
  position: string | null
  specialties: string[]
  bio: string | null
  imageUrl: string | null
  yearsOfExperience: number | null
  certifications: string[]
  canReceiveBookings: boolean
}

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

/**
 * What the ledger keeps of a staff member and customers are not shown, with
 * values that appear nowhere else in a response.
 */
const keptToTheSalon = {
  firstName: 'Private-First',
  lastName: 'Private-Last',
  firstNameKana: 'ヒミツノメイ',
  lastNameKana: 'ヒミツノセイ',
  email: 'private-address@salon.example',
  phoneNumber: '090-5555-0001',
  alternativePhone: '03-5555-0002',
  staffCode: 'PRIVATE-CODE',
  hireDate: '2019-07-08',
  employmentType: 'part-time',
  baseSalary: 987654,
  commissionRate: 34.56,
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

/** What customers are shown of the staff member the ledger request below registers. */
const shownToCustomers = {
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

/** A request to the ledger that satisfies every rule, with a value for every property. */
const staffRequest = (overrides: Record<string, unknown> = {}) => ({
  ...keptToTheSalon,
  ...shownToCustomers,
  isActive: true,
  ...overrides,
})

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
  ['a UUID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
]

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: StaffProfile) => id)

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

describe('Staff profile API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin, for the ledger. */
  let asAdmin: string
  /** The salon whose staff most tests are about. */
  let salonId: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Lists profiles; without a token unless one is given. */
  const list = (query = '', as: string | null = null) =>
    authorized(
      request(app).get(
        query === '' ? STAFF_PROFILES : `${STAFF_PROFILES}?${query}`,
      ),
      as,
    )

  /** Reads a profile; without a token unless one is given. */
  const get = (id: string, as: string | null = null) =>
    authorized(request(app).get(`${STAFF_PROFILES}/${id}`), as)

  /** Registers a staff member through the ledger as the admin; returns its ID. */
  const registerStaff = async (
    overrides: Record<string, unknown> = {},
    salon: string = salonId,
  ): Promise<string> => {
    const response = await request(app)
      .post(staffOf(salon))
      .set('Authorization', asAdmin)
      .send(
        staffRequest({
          email: `staff-${randomUUID()}@example.com`,
          staffCode: null,
          ...overrides,
        }),
      )
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data.id
  }

  /** Changes a staff member through the ledger as the admin. */
  const changeStaff = async (
    id: string,
    body: object,
    salon: string = salonId,
  ): Promise<void> => {
    const response = await request(app)
      .patch(`${staffOf(salon)}/${id}`)
      .set('Authorization', asAdmin)
      .send(body)
    expect(response.status).toBe(200)
  }

  /** Deletes a staff member through the ledger as the admin. */
  const deleteStaff = async (
    id: string,
    salon: string = salonId,
  ): Promise<void> => {
    const response = await request(app)
      .delete(`${staffOf(salon)}/${id}`)
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
   * Staff members of three salons, inserted directly a day apart: of the
   * salon under test two who are shown, one who does not work there any more
   * and a deleted one; of another salon in another city one who is shown;
   * of a deleted salon one. `shown` lists the three customers are shown, in
   * the order of their registration.
   */
  const insertStaffOfThreeSalons = async () => {
    const otherSalonId = await insertSalon(db, { city: '渋谷区' })
    const deletedSalonId = await insertSalon(db, {
      deletedAt: '2026-11-08T09:00:00.000Z',
    })
    const first = await insertStaffRow({
      specialties: ['cut', 'color'],
      createdAt: '2026-11-01T09:00:00.000Z',
    })
    const inactive = await insertStaffRow({
      isActive: false,
      canReceiveBookings: false,
      specialties: ['cut'],
      createdAt: '2026-11-02T09:00:00.000Z',
    })
    const elsewhere = await insertStaffRow(
      { specialties: ['cut', 'perm'], createdAt: '2026-11-03T09:00:00.000Z' },
      otherSalonId,
    )
    const deleted = await insertStaffRow({
      specialties: ['cut'],
      createdAt: '2026-11-04T09:00:00.000Z',
      deletedAt: '2026-11-07T09:00:00.000Z',
    })
    const ofDeletedSalon = await insertStaffRow(
      { specialties: ['cut'], createdAt: '2026-11-05T09:00:00.000Z' },
      deletedSalonId,
    )
    const last = await insertStaffRow({
      specialties: ['perm'],
      createdAt: '2026-11-06T09:00:00.000Z',
    })
    return {
      otherSalonId,
      deletedSalonId,
      first,
      inactive,
      elsewhere,
      deleted,
      ofDeletedSalon,
      last,
      shown: [first, elsewhere, last],
    }
  }

  /** Follows `links.next` from the first page to the last, without a token. */
  const walk = async (firstPage: string): Promise<Response[]> => {
    const pages: Response[] = []
    let next: string | null = firstPage
    while (next !== null) {
      if (pages.length === 50) {
        throw new Error('The pages do not end')
      }
      const page: Response = await request(app).get(next)
      expect(page.status).toBe(200)
      pages.push(page)
      next = page.body.links.next
    }
    return pages
  }

  describe('GET /api/v1/staff-profiles/:id', () => {
    it('returns what customers are shown of the staff member, to a request without an access token', async () => {
      const id = await registerStaff()

      const response = await get(id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.headers).not.toHaveProperty('www-authenticate')
      expect(response.body).toEqual({
        data: { id, salonId, ...shownToCustomers },
        meta: {
          correlationId: response.headers['x-request-id'],
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${STAFF_PROFILES}/${id}`,
          list: STAFF_PROFILES,
        },
      })
    })

    it('returns the 11 properties of the profile and nothing else of the ledger: no name, no contact, nothing of the employment', async () => {
      const id = await registerStaff({
        email: keptToTheSalon.email,
        staffCode: keptToTheSalon.staffCode,
      })
      const ledger = await request(app)
        .get(`${staffOf(salonId)}/${id}`)
        .set('Authorization', asAdmin)

      const response = await get(id)
      const body = JSON.stringify(response.body)

      expect(Object.keys(response.body.data).toSorted()).toEqual(
        PROFILE_PROPERTIES,
      )
      expect(ledger.body.data).toMatchObject(keptToTheSalon)
      for (const property of Object.keys(keptToTheSalon)) {
        expect(response.body.data).not.toHaveProperty(property)
      }
      for (const value of privateValues) {
        expect(body).not.toContain(value)
      }
      for (const property of ['userId', 'isActive', 'createdAt', 'updatedAt']) {
        expect(response.body.data).not.toHaveProperty(property)
      }
    })

    it('says what the ledger says of every property it shows', async () => {
      const id = await registerStaff({
        displayName: 'Mika',
        level: 'director',
        position: 'Salon director',
        specialties: ['perm', 'cut', 'color'],
        bio: 'カットとパーマが得意です。',
        imageUrl: 'https://cdn.example.com/staff/mika.png',
        yearsOfExperience: 0,
        certifications: ['b', 'a'],
        canReceiveBookings: false,
      })
      const ledger = await request(app)
        .get(`${staffOf(salonId)}/${id}`)
        .set('Authorization', asAdmin)

      const response = await get(id)

      expect(response.status).toBe(200)
      for (const property of PROFILE_PROPERTIES) {
        expect(response.body.data[property]).toEqual(ledger.body.data[property])
      }
      expect(response.body.data).toMatchObject({
        specialties: ['perm', 'cut', 'color'],
        certifications: ['b', 'a'],
        yearsOfExperience: 0,
        canReceiveBookings: false,
      })
    })

    it('returns null and empty lists for what the staff member has not set', async () => {
      const id = await insertStaffRow({ yearsOfExperience: null })

      const response = await get(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        id,
        salonId,
        displayName: 'Taro',
        level: 'stylist',
        position: null,
        specialties: [],
        bio: null,
        imageUrl: null,
        yearsOfExperience: null,
        certifications: [],
        canReceiveBookings: true,
      })
    })

    it('shows a staff member who takes no bookings, and one of a salon that takes none at the moment', async () => {
      const closedSalonId = await insertSalon(db, { isActive: false })
      const takesNone = await registerStaff({ canReceiveBookings: false })
      const ofClosedSalon = await registerStaff({}, closedSalonId)

      const first = await get(takesNone)
      const second = await get(ofClosedSalon)

      expect(first.status).toBe(200)
      expect(first.body.data.canReceiveBookings).toBe(false)
      expect(second.status).toBe(200)
      expect(second.body.data.salonId).toBe(closedSalonId)
    })

    it('shows a change of the ledger at once', async () => {
      const id = await registerStaff()

      await changeStaff(id, {
        displayName: 'Hana',
        bio: null,
        specialties: ['perm'],
      })
      const response = await get(id)

      expect(response.body.data).toEqual({
        id,
        salonId,
        ...shownToCustomers,
        displayName: 'Hana',
        bio: null,
        specialties: ['perm'],
      })
    })

    it('returns the profile for its ID written in upper case, with the ID in lower case', async () => {
      const id = await registerStaff()

      const response = await get(id.toUpperCase())

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
      expect(response.body.links.self).toBe(`${STAFF_PROFILES}/${id}`)
    })

    it('reports an ID that no staff member has as not found', async () => {
      await registerStaff()

      const response = await get(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Staff member ${UNKNOWN_ID} was not found`,
      )
    })

    it('reports a staff member who does not work at the salon any more as not found, and shows them again when they are back', async () => {
      const id = await registerStaff()

      await changeStaff(id, { isActive: false })
      const gone = await get(id)
      await changeStaff(id, { isActive: true })
      const back = await get(id)

      expectProblem(gone, notFound)
      expect(gone.body.detail).toBe(`Staff member ${id} was not found`)
      expect(back.status).toBe(200)
      expect(back.body.data).toEqual({ id, salonId, ...shownToCustomers })
    })

    it('reports a deleted staff member as not found', async () => {
      const id = await registerStaff()
      await deleteStaff(id)

      const response = await get(id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Staff member ${id} was not found`)
    })

    it('reports a staff member of a deleted salon as not found', async () => {
      const id = await registerStaff()
      await deleteSalon(salonId)

      const response = await get(id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Staff member ${id} was not found`)
    })

    it('answers the same for every staff member customers are not shown as for one that never existed, apart from the ID', async () => {
      const rows = await insertStaffOfThreeSalons()
      const hidden = [rows.inactive, rows.deleted, rows.ofDeletedSalon]

      const never = await get(UNKNOWN_ID)
      const responses = await Promise.all(hidden.map((id) => get(id)))

      const shape = (response: Response, id: string) => ({
        status: response.status,
        headers: Object.keys(response.headers)
          .filter((name) => name !== 'x-request-id')
          .toSorted(),
        body: {
          ...response.body,
          detail: response.body.detail.replace(id, '<id>'),
          instance: response.body.instance.replace(id, '<id>'),
          correlationId: '<request>',
          timestamp: '<now>',
        },
      })
      for (const [index, response] of responses.entries()) {
        expect(shape(response, hidden[index] ?? '')).toEqual(
          shape(never, UNKNOWN_ID),
        )
      }
    })

    it.each(malformedIds)('rejects %s as the ID', async (_case, id) => {
      await registerStaff()

      const response = await get(id)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
      expect(response.body.detail).toBe('Invalid staff ID')
    })

    it('shows a staff member whose row has a time that is no instant: the profile reads no time', async () => {
      const id = await registerStaff()
      await db
        .update(staff)
        .set({ createdAt: 'infinity', updatedAt: 'infinity' })
        .where(eq(staff.id, id))

      const one = await get(id)
      const listed = await list()

      expect(one.status).toBe(200)
      expect(idsOf(listed)).toEqual([id])
    })

    it('answers 500 without the cause when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()
      const logs: unknown[] = []
      const failing = createTestApp({ database: connection.database, logs })

      const one = await request(failing).get(`${STAFF_PROFILES}/${UNKNOWN_ID}`)
      const listed = await request(failing).get(STAFF_PROFILES)
      await connection.close()

      for (const response of [one, listed]) {
        expectProblem(response, databaseProblem)
        expect(response.body.detail).toBeNull()
        expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED')
      }
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'error',
          msg: 'Failed to find staff profile',
        }),
      )
      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'error',
          msg: 'Failed to list staff profiles',
        }),
      )
    })
  })

  describe('GET /api/v1/staff-profiles', () => {
    it('returns an empty page when no staff member is registered', async () => {
      const response = await list()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.headers).not.toHaveProperty('www-authenticate')
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
          self: STAFF_PROFILES,
          first: STAFF_PROFILES,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('returns the staff members of every salon in the order of their registration, and leaves out who does not work there any more, deleted ones and those of deleted salons', async () => {
      const rows = await insertStaffOfThreeSalons()

      const response = await list()

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual(rows.shown)
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
      expect(
        response.body.data.map(({ salonId: salon }: StaffProfile) => salon),
      ).toEqual([salonId, rows.otherSalonId, salonId])
    })

    it('returns every staff member as the profile that reading it returns', async () => {
      await registerStaff()
      await registerStaff({ canReceiveBookings: false, position: null })
      await insertStaffRow()

      const response = await list()

      expect(response.body.data).toHaveLength(3)
      for (const profile of response.body.data) {
        expect(Object.keys(profile).toSorted()).toEqual(PROFILE_PROPERTIES)
        expect(profile).toEqual((await get(profile.id)).body.data)
      }
    })

    it('shows nothing the ledger keeps to the salon', async () => {
      const sameAsTheLedger = {
        email: keptToTheSalon.email,
        staffCode: keptToTheSalon.staffCode,
      }
      await registerStaff(sameAsTheLedger)
      await registerStaff(sameAsTheLedger, await insertSalon(db))

      const response = await list()
      const body = JSON.stringify(response.body)

      expect(response.body.data).toHaveLength(2)
      for (const value of privateValues) {
        expect(body).not.toContain(value)
      }
    })

    it('adds a new staff member at the end of the list, takes out one who leaves and puts them back where they were', async () => {
      const rows = await insertStaffOfThreeSalons()

      const added = await registerStaff()
      const withAdded = await list()
      await changeStaff(rows.first, { isActive: false })
      const withoutFirst = await list()
      await changeStaff(rows.first, { isActive: true })
      const withFirstBack = await list()

      expect(idsOf(withAdded)).toEqual([...rows.shown, added])
      expect(idsOf(withoutFirst)).toEqual([...rows.shown.slice(1), added])
      expect(withoutFirst.body.meta.total).toBe(3)
      expect(idsOf(withFirstBack)).toEqual([...rows.shown, added])
    })

    it('leaves out the staff of a salon from the moment the salon is deleted', async () => {
      const rows = await insertStaffOfThreeSalons()

      await deleteSalon(rows.otherSalonId)
      const response = await list()

      expect(idsOf(response)).toEqual([rows.first, rows.last])
      expect(response.body.meta.total).toBe(2)
    })

    describe('salonId', () => {
      it('leaves the staff members of that salon, and counts only them', async () => {
        const rows = await insertStaffOfThreeSalons()

        const mine = await list(`salonId=${salonId}`)
        const others = await list(`salonId=${rows.otherSalonId}`)

        expect(idsOf(mine)).toEqual([rows.first, rows.last])
        expect(mine.body.meta.total).toBe(2)
        expect(idsOf(others)).toEqual([rows.elsewhere])
        expect(others.body.meta.total).toBe(1)
      })

      it('names the same salon when it is written in upper case', async () => {
        const rows = await insertStaffOfThreeSalons()

        const response = await list(`salonId=${salonId.toUpperCase()}`)

        expect(idsOf(response)).toEqual([rows.first, rows.last])
      })

      it('returns an empty page for a salon that does not exist, a deleted salon and a salon without staff', async () => {
        const rows = await insertStaffOfThreeSalons()
        const emptySalonId = await insertSalon(db)

        for (const salon of [UNKNOWN_ID, rows.deletedSalonId, emptySalonId]) {
          const response = await list(`salonId=${salon}`)

          expect(response.status).toBe(200)
          expect(response.body.data).toEqual([])
          expect(response.body.meta).toMatchObject({
            total: 0,
            hasMore: false,
            nextCursor: null,
          })
        }
      })
    })

    describe('specialty', () => {
      it('leaves the staff members of every salon who name it among their specialties', async () => {
        const rows = await insertStaffOfThreeSalons()

        const cut = await list('specialty=cut')
        const perm = await list('specialty=perm')
        const color = await list('specialty=color')

        expect(idsOf(cut)).toEqual([rows.first, rows.elsewhere])
        expect(cut.body.meta.total).toBe(2)
        expect(idsOf(perm)).toEqual([rows.elsewhere, rows.last])
        expect(idsOf(color)).toEqual([rows.first])
      })

      it('is the whole specialty as it is written: no part of it, no other case, no spaces around it', async () => {
        const id = await insertStaffRow({ specialties: ['Hair color', 'cut'] })

        const exact = await list(
          `specialty=${encodeURIComponent('Hair color')}`,
        )
        const others = await Promise.all(
          [
            'hair color',
            'Hair',
            'color',
            'Hair colors',
            ' Hair color',
            'cu',
          ].map((specialty) =>
            list(`specialty=${encodeURIComponent(specialty)}`),
          ),
        )

        expect(idsOf(exact)).toEqual([id])
        for (const response of others) {
          expect(response.status).toBe(200)
          expect(response.body.data).toEqual([])
        }
      })

      it.each([
        ['a comma', 'cut, color'],
        ['a double quote', 'the "bob"'],
        ['a single quote', "men's cut"],
        ['a backslash', 'cut\\color'],
        ['braces', '{cut}'],
        ['a percent sign', '100%'],
        ['an underscore', 'cut_color'],
        ['the word NULL', 'NULL'],
        ['Japanese', 'ヘッドスパ'],
      ])(
        'finds a specialty with %s as it is written, and nothing else by it',
        async (_case, specialty) => {
          const id = await insertStaffRow({ specialties: ['perm', specialty] })
          await insertStaffRow({ specialties: ['cut', 'color', 'cutXcolor'] })

          const response = await list(
            `specialty=${encodeURIComponent(specialty)}`,
          )

          expect(response.status).toBe(200)
          expect(idsOf(response)).toEqual([id])
          expect(response.body.data[0].specialties).toEqual(['perm', specialty])
        },
      )
    })

    describe('city', () => {
      it('leaves the staff members of the salons in that city', async () => {
        const rows = await insertStaffOfThreeSalons()

        const minato = await list(`city=${encodeURIComponent('港区')}`)
        const shibuya = await list(`city=${encodeURIComponent('渋谷区')}`)

        expect(idsOf(minato)).toEqual([rows.first, rows.last])
        expect(minato.body.meta.total).toBe(2)
        expect(idsOf(shibuya)).toEqual([rows.elsewhere])
      })

      it('is the whole city as the salon writes it: no part of it, no pattern', async () => {
        await insertStaffOfThreeSalons()

        for (const city of ['港', '区', '港区 ', '%', '__', '東京都']) {
          const response = await list(`city=${encodeURIComponent(city)}`)

          expect(response.status).toBe(200)
          expect(response.body.data).toEqual([])
        }
      })

      it('follows the salon when it moves to another city', async () => {
        const rows = await insertStaffOfThreeSalons()

        await db
          .update(salons)
          .set({ city: '渋谷区' })
          .where(eq(salons.id, salonId))
        const response = await list(`city=${encodeURIComponent('渋谷区')}`)

        expect(idsOf(response)).toEqual(rows.shown)
      })
    })

    it('leaves the staff members who pass every filter that is given', async () => {
      const rows = await insertStaffOfThreeSalons()
      const shibuya = encodeURIComponent('渋谷区')
      const minato = encodeURIComponent('港区')

      const outcomes = await Promise.all(
        [
          `salonId=${salonId}&specialty=cut`,
          `salonId=${salonId}&specialty=perm`,
          `salonId=${rows.otherSalonId}&specialty=color`,
          `specialty=cut&city=${shibuya}`,
          `specialty=cut&city=${minato}`,
          `salonId=${salonId}&city=${shibuya}`,
          `salonId=${salonId}&specialty=perm&city=${minato}`,
        ].map(async (query) => {
          const response = await list(query)
          return [idsOf(response), response.body.meta.total]
        }),
      )

      expect(outcomes).toEqual([
        [[rows.first], 1],
        [[rows.last], 1],
        [[], 0],
        [[rows.elsewhere], 1],
        [[rows.first], 1],
        [[], 0],
        [[rows.last], 1],
      ])
    })

    it('walks through the pages, returning every staff member once and in order where staff members share createdAt, with the filter in every link', async () => {
      const otherSalonId = await insertSalon(db)
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
      for (const [index, row] of rows.entries()) {
        const id = await insertStaffRow(
          { ...row, specialties: ['cut'] },
          index % 2 === 0 ? salonId : otherSalonId,
        )
        stored.push({ id, ...row })
      }
      await insertStaffRow({ createdAt: shared, specialties: ['perm'] })
      const ids = inOrderOfRegistration(stored)
      const firstPage = `${STAFF_PROFILES}?specialty=cut&limit=2`

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
      const rows = await insertStaffOfThreeSalons()

      const whole = await list('limit=3')
      const rest = await list(`limit=2&cursor=${rows.first}`)

      expect(idsOf(whole)).toEqual(rows.shown)
      expect(whole.body.meta).toMatchObject({
        total: 3,
        hasMore: false,
        nextCursor: null,
      })
      expect(whole.body.links.next).toBeNull()
      expect(idsOf(rest)).toEqual(rows.shown.slice(1))
      expect(rest.body.meta).toMatchObject({
        total: 3,
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

    it('counts every staff member the filters leave on every page, not those after the cursor', async () => {
      const rows = await insertStaffOfThreeSalons()

      const response = await list(`limit=1&cursor=${rows.elsewhere}`)

      expect(idsOf(response)).toEqual([rows.last])
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 1,
        hasMore: false,
        cursor: rows.elsewhere,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('continues after a staff member who is not shown any more: one who left, a deleted one and one of a deleted salon still say where the next page begins', async () => {
      const rows = await insertStaffOfThreeSalons()

      const afterInactive = await list(`cursor=${rows.inactive}`)
      const afterDeleted = await list(`cursor=${rows.deleted}`)
      const afterOneOfDeletedSalon = await list(`cursor=${rows.ofDeletedSalon}`)

      expect(afterInactive.status).toBe(200)
      expect(idsOf(afterInactive)).toEqual([rows.elsewhere, rows.last])
      expect(afterInactive.body.meta.cursor).toBe(rows.inactive)
      expect(idsOf(afterDeleted)).toEqual([rows.last])
      expect(idsOf(afterOneOfDeletedSalon)).toEqual([rows.last])
    })

    it('continues after the staff member who ended a page and left since', async () => {
      const rows = await insertStaffOfThreeSalons()
      const firstPage = await list('limit=1')
      expect(firstPage.body.meta.nextCursor).toBe(rows.first)
      await changeStaff(rows.first, { isActive: false })

      const nextPage = await request(app).get(firstPage.body.links.next)

      expect(nextPage.status).toBe(200)
      expect(idsOf(nextPage)).toEqual([rows.elsewhere])
      expect(nextPage.body.meta).toEqual({
        total: 2,
        limit: 1,
        hasMore: true,
        cursor: rows.first,
        nextCursor: rows.elsewhere,
        prevCursor: null,
      })
    })

    it('continues after a staff member the filters leave out: the cursor says where, the filters say who', async () => {
      const rows = await insertStaffOfThreeSalons()

      const response = await list(`salonId=${salonId}&cursor=${rows.elsewhere}`)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([rows.last])
      expect(response.body.meta.total).toBe(2)
    })

    it('names the same staff member with a cursor in upper case, and the page writes it in lower case', async () => {
      const rows = await insertStaffOfThreeSalons()

      const response = await list(`cursor=${rows.first.toUpperCase()}`)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual(rows.shown.slice(1))
      expect(response.body.meta.cursor).toBe(rows.first)
    })

    it('refuses a cursor that names no staff member as a broken rule of the cursor', async () => {
      await insertStaffOfThreeSalons()

      const unknown = await list(`cursor=${UNKNOWN_ID}`)
      const aSalon = await list(`cursor=${salonId}`)

      for (const response of [unknown, aSalon]) {
        expectProblem(response, badRequest)
        expect(response.body.detail).toBe('Invalid staff profile search')
        expect(brokenRules(response)).toEqual(['cursor:not_found'])
        expect(response.body.errors[0].message).toBe('Must name a staff member')
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
      ['a limit given twice', 'limit=1&limit=2', ['limit:invalid_type']],
      ['a cursor that is not a UUID', 'cursor=abc', ['cursor:invalid_format']],
      ['a salon that is not a UUID', 'salonId=abc', ['salonId:invalid_format']],
      ['an empty salon', 'salonId=', ['salonId:invalid_format']],
      ['an empty specialty', 'specialty=', ['specialty:invalid_format']],
      [
        'a specialty of spaces only',
        'specialty=%20%20',
        ['specialty:invalid_format'],
      ],
      [
        'two specialties',
        'specialty=cut&specialty=color',
        ['specialty:invalid_type'],
      ],
      ['an empty city', 'city=', ['city:invalid_format']],
      ['a city of 101 characters', `city=${'a'.repeat(101)}`, ['city:too_big']],
      ['a parameter that does not exist', 'page=2', ['page:unrecognized_keys']],
      [
        'isActive: who does not work at the salon is never shown',
        'isActive=false',
        ['isActive:unrecognized_keys'],
      ],
      [
        'a filter of the salon list',
        'prefecture=Tokyo',
        ['prefecture:unrecognized_keys'],
      ],
      [
        'several broken rules, all of which it reports',
        'limit=0&cursor=abc&salonId=abc&city=&page=2',
        [
          'city:invalid_format',
          'cursor:invalid_format',
          'limit:too_small',
          'page:unrecognized_keys',
          'salonId:invalid_format',
        ],
      ],
    ])('rejects %s', async (_case, query, expected) => {
      await insertStaffRow()

      const response = await list(query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid staff profile search')
      expect(brokenRules(response).toSorted()).toEqual(expected)
    })

    it('accepts a city of 100 characters', async () => {
      const longCity = 'a'.repeat(100)
      const id = await insertStaffRow(
        {},
        await insertSalon(db, { city: longCity }),
      )

      const response = await list(`city=${longCity}`)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([id])
    })
  })

  describe('who may read staff profiles', () => {
    /** Signs in and returns the Authorization header to send, or none. */
    type SignInAs = (elsewhere: string) => Promise<string | null>

    const member =
      (role: 'owner' | 'manager' | 'staff'): SignInAs =>
      async (elsewhere) => {
        const { email } = await insertMember(db, role, elsewhere)
        return (await signIn(app, email)).authorization
      }

    /** Everyone: a token is neither needed nor looked at. */
    const anyone: [string, SignInAs][] = [
      ['a request without an access token', async () => null],
      [
        'a request with a token that names no session',
        async () => `Bearer ${'t'.repeat(43)}`,
      ],
      [
        'a request with an access token that has run out',
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
      ],
      [
        'a request with something that is no bearer token',
        async () => 'Basic abc',
      ],
      [
        'a customer',
        async () =>
          (
            await signedInUser(app, db, {
              customerId: await insertCustomer(db),
            })
          ).authorization,
      ],
      [
        'a user without a customer record',
        async () => (await signedInUser(app, db)).authorization,
      ],
      ['a staff member of another salon', member('staff')],
      ['a manager of another salon', member('manager')],
      ['the owner of another salon', member('owner')],
      ['an admin', async () => asAdmin],
    ]

    it.each(anyone)('shows %s the profiles', async (_who, signInAs) => {
      const id = await registerStaff()
      const authorization = await signInAs(await insertSalon(db))

      const listed = await list(`salonId=${salonId}`, authorization)
      const one = await get(id, authorization)
      const withoutToken = await get(id)

      expect(listed.status).toBe(200)
      expect(idsOf(listed)).toEqual([id])
      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(withoutToken.body.data)
      expect(one.headers).not.toHaveProperty('www-authenticate')
    })

    it.each(anyone)(
      'tells %s what is wrong with a request and what is not there, as it tells everyone',
      async (_who, signInAs) => {
        const authorization = await signInAs(await insertSalon(db))

        const badQuery = await list('limit=0', authorization)
        const badId = await get('latest', authorization)
        const unknown = await get(UNKNOWN_ID, authorization)

        expectProblem(badQuery, badRequest)
        expectProblem(badId, badRequest)
        expectProblem(unknown, notFound)
      },
    )

    it.each<[string, 'manager' | 'staff']>([
      ['a manager', 'manager'],
      ['a staff member', 'staff'],
    ])(
      'shows %s of the salon the profiles of the colleagues, whose ledger they may not read',
      async (_who, role) => {
        const colleague = await registerStaff()
        const self = await insertMember(db, role, salonId)
        const { authorization } = await signIn(app, self.email)

        const ledger = await request(app)
          .get(staffOf(salonId))
          .set('Authorization', authorization)
        const listed = await list(`salonId=${salonId}`, authorization)
        const own = await get(self.staffId, authorization)

        expectProblem(ledger, forbidden)
        expect(idsOf(listed).toSorted()).toEqual(
          [colleague, self.staffId].toSorted(),
        )
        expect(own.status).toBe(200)
        expect(Object.keys(own.body.data).toSorted()).toEqual(
          PROFILE_PROPERTIES,
        )
      },
    )
  })

  describe('what the profiles do not have', () => {
    it.each<[string, 'post' | 'put' | 'patch' | 'delete', boolean]>([
      ['registering', 'post', false],
      ['replacing', 'put', true],
      ['changing', 'patch', true],
      ['deleting', 'delete', true],
      ['deleting all', 'delete', false],
    ])(
      'has no operation for %s: the ledger of the salon is where staff members are kept',
      async (_case, method, one) => {
        const id = await registerStaff()
        const path = one ? `${STAFF_PROFILES}/${id}` : STAFF_PROFILES

        const response = await request(app)
          [method](path)
          .set('Authorization', asAdmin)
          .send({ displayName: 'Changed' })

        expectProblem(response, routeNotFound)
        expect(response.body.detail).toBe(
          `${method.toUpperCase()} ${path} is not part of the API`,
        )
        expect((await get(id)).body.data.displayName).toBe('Hanako')
      },
    )

    it.each([
      [
        'the search across salons that the contract used to name',
        '/api/v1/staff/search',
      ],
      ['a list of staff outside a salon', '/api/v1/staff'],
      ['profiles below a salon', `${SALONS}/${UNKNOWN_ID}/staff-profiles`],
      ['something below a profile', `${STAFF_PROFILES}/${UNKNOWN_ID}/schedule`],
    ])('has no route for %s', async (_case, path) => {
      const response = await request(app)
        .get(path)
        .set('Authorization', asAdmin)

      expectProblem(response, routeNotFound)
    })
  })

  describe('StaffProfileRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new StaffProfileRepository(db)
    const salon = (id: string) => salonIdSchema.parse(id)
    const member = (id: string) => staffIdSchema.parse(id)

    const criteria = (
      overrides: Partial<StaffProfileListCriteria> = {},
    ): StaffProfileListCriteria => ({
      limit: 10,
      after: null,
      salonId: null,
      specialty: null,
      city: null,
      ...overrides,
    })

    /** The IDs of the profiles of a list, in its order. */
    const listedIds = (
      result: Result<{ profiles: { id: string }[] } | null, DomainError>,
    ): string[] => dataOf(result)?.profiles.map(({ id }) => id) ?? []

    describe('findById', () => {
      it('resolves to the columns customers are shown, and to no other column of the row', async () => {
        const id = await insertStaffRow({
          firstNameKana: 'タロウ',
          staffCode: 'STF-001',
          level: 'expert',
          position: 'Colorist',
          specialties: ['color', 'cut'],
          bio: 'Colours hair.',
          imageUrl: 'https://cdn.example.com/taro.jpg',
          yearsOfExperience: 12,
          certifications: ['美容師免許'],
          baseSalary: 300000,
          commissionRate: '12.50',
          canReceiveBookings: false,
        })

        const profile = dataOf(await repository().findById(member(id)))

        expect(profile).toEqual({
          id,
          salonId,
          displayName: 'Taro',
          level: 'expert',
          position: 'Colorist',
          specialties: ['color', 'cut'],
          bio: 'Colours hair.',
          imageUrl: 'https://cdn.example.com/taro.jpg',
          yearsOfExperience: 12,
          certifications: ['美容師免許'],
          canReceiveBookings: false,
        })
      })

      it('resolves to null for an ID that no staff member has, a staff member who does not work at the salon any more, a deleted one and one of a deleted salon', async () => {
        const rows = await insertStaffOfThreeSalons()

        const outcomes = await Promise.all(
          [UNKNOWN_ID, rows.inactive, rows.deleted, rows.ofDeletedSalon].map(
            async (id) => dataOf(await repository().findById(member(id))),
          ),
        )

        expect(outcomes).toEqual([null, null, null, null])
      })

      it('finds a staff member of a salon that takes no bookings at the moment', async () => {
        const closedSalonId = await insertSalon(db, { isActive: false })
        const id = await insertStaffRow({}, closedSalonId)

        const profile = dataOf(await repository().findById(member(id)))

        expect(profile).toMatchObject({ id, salonId: closedSalonId })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new StaffProfileRepository(
          connection.database,
        ).findById(member(UNKNOWN_ID))
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to find staff profile' },
        })
      })
    })

    describe('list', () => {
      it('resolves to the profiles customers are shown in the order of their registration, with their number and whether more follow', async () => {
        const rows = await insertStaffOfThreeSalons()

        const result = dataOf(await repository().list(criteria()))

        expect(result?.profiles.map(({ id }) => id)).toEqual(rows.shown)
        expect(result).toMatchObject({ total: 3, hasMore: false })
        expect(Object.keys(result?.profiles.at(0) ?? {}).toSorted()).toEqual(
          PROFILE_PROPERTIES,
        )
      })

      it('resolves to an empty list when nobody is shown', async () => {
        await insertStaffRow({ isActive: false })

        expect(dataOf(await repository().list(criteria()))).toEqual({
          profiles: [],
          total: 0,
          hasMore: false,
        })
      })

      it('returns as many profiles as the limit says and tells whether more follow', async () => {
        const rows = await insertStaffOfThreeSalons()

        const two = dataOf(await repository().list(criteria({ limit: 2 })))
        const three = dataOf(await repository().list(criteria({ limit: 3 })))

        expect(two?.profiles.map(({ id }) => id)).toEqual(
          rows.shown.slice(0, 2),
        )
        expect(two).toMatchObject({ total: 3, hasMore: true })
        expect(three?.profiles.map(({ id }) => id)).toEqual(rows.shown)
        expect(three).toMatchObject({ total: 3, hasMore: false })
      })

      it('filters by salon, by specialty, by city and by all of them together, and counts what the filters leave', async () => {
        const rows = await insertStaffOfThreeSalons()

        const outcomes = await Promise.all(
          [
            criteria({ salonId: salon(salonId) }),
            criteria({ salonId: salon(rows.deletedSalonId) }),
            criteria({ salonId: salon(UNKNOWN_ID) }),
            criteria({ specialty: 'cut' }),
            criteria({ specialty: 'Cut' }),
            criteria({ city: '渋谷区' }),
            criteria({ city: '渋谷' }),
            criteria({
              salonId: salon(salonId),
              specialty: 'perm',
              city: '港区',
            }),
            criteria({
              salonId: salon(salonId),
              specialty: 'perm',
              city: '渋谷区',
            }),
          ].map(async (given) => {
            const result = dataOf(await repository().list(given))
            return [result?.profiles.map(({ id }) => id), result?.total]
          }),
        )

        expect(outcomes).toEqual([
          [[rows.first, rows.last], 2],
          [[], 0],
          [[], 0],
          [[rows.first, rows.elsewhere], 2],
          [[], 0],
          [[rows.elsewhere], 1],
          [[], 0],
          [[rows.last], 1],
          [[], 0],
        ])
      })

      it('starts after the staff member the cursor names, shown or not, and counts all the same', async () => {
        const rows = await insertStaffOfThreeSalons()

        const outcomes = await Promise.all(
          [
            rows.first,
            rows.inactive,
            rows.elsewhere,
            rows.deleted,
            rows.ofDeletedSalon,
            rows.last,
          ].map(async (after) => {
            const result = dataOf(
              await repository().list(criteria({ after: member(after) })),
            )
            return [result?.profiles.map(({ id }) => id), result?.total]
          }),
        )

        expect(outcomes).toEqual([
          [[rows.elsewhere, rows.last], 3],
          [[rows.elsewhere, rows.last], 3],
          [[rows.last], 3],
          [[rows.last], 3],
          [[rows.last], 3],
          [[], 3],
        ])
      })

      it('resolves to null for a cursor that names no staff member, whatever the filters', async () => {
        await insertStaffOfThreeSalons()

        const plain = await repository().list(
          criteria({ after: member(UNKNOWN_ID) }),
        )
        const filtered = await repository().list(
          criteria({
            after: member(UNKNOWN_ID),
            salonId: salon(UNKNOWN_ID),
            specialty: 'nothing',
          }),
        )

        expect(dataOf(plain)).toBeNull()
        expect(dataOf(filtered)).toBeNull()
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

      it('orders staff members who were registered at the same moment by their ID', async () => {
        const createdAt = '2026-11-10T09:00:00.000Z'
        const ids = [
          await insertStaffRow({ createdAt }),
          await insertStaffRow({ createdAt }),
          await insertStaffRow({ createdAt }),
        ].toSorted()

        const whole = await repository().list(criteria())
        const afterFirst = await repository().list(
          criteria({ after: member(ids[0] ?? '') }),
        )

        expect(listedIds(whole)).toEqual(ids)
        expect(listedIds(afterFirst)).toEqual(ids.slice(1))
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new StaffProfileRepository(
          connection.database,
        ).list(criteria())
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to list staff profiles' },
        })
      })
    })
  })
})
