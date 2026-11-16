import { openingHours, salons } from '@beauty-salon-backend/database'
import { eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertCustomer,
  insertMember,
  insertSalon,
  signedInUser,
  signIn,
  signInAsAdmin,
} from './_shared/auth-helpers'
import {
  brokenRules,
  createTestApp,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from './_shared/test-helpers'

const SALONS = '/api/v1/salons'
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

// 2026-11-16 and 2026-11-23 are Mondays.
const workingMonday = {
  dayOfWeek: 'monday',
  date: '2026-11-16',
  openTime: '10:00',
  closeTime: '19:00',
  isHoliday: false,
  holidayName: null,
  notes: null,
}

const holidayMonday = {
  dayOfWeek: 'monday',
  date: '2026-11-23',
  openTime: null,
  closeTime: null,
  isHoliday: true,
  holidayName: '勤労感謝の日',
  notes: 'Closed all day',
}

/** The weekly hours of a Monday, in the time zone of the salon. */
const weeklyMonday = {
  dayOfWeek: 'monday',
  operatingSlots: [{ startTime: '10:00', endTime: '19:00' }],
  breakSlots: null,
  isClosed: false,
  effectivePeriod: null,
}

/** A request that satisfies every rule. */
const salonRequest = (overrides: Record<string, unknown> = {}) => ({
  name: 'Hair Studio Aoyama',
  nameKana: 'ヘアスタジオアオヤマ',
  description: 'A calm salon near Omotesando',
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: 'Aoyama Building 2F',
  latitude: 35.6654,
  longitude: 139.7121,
  phoneNumber: '03-1234-5678',
  alternativePhone: null,
  email: 'aoyama@example.com',
  websiteUrl: 'https://aoyama.example.com',
  logoUrl: null,
  imageUrls: ['https://aoyama.example.com/front.jpg'],
  features: ['color', 'kids'],
  amenities: ['wifi'],
  businessHours: [weeklyMonday],
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: true,
  openingHours: [workingMonday, holidayMonday],
  ...overrides,
})

/** The calendar of `salonRequest` as the API returns it: times get seconds. */
const storedCalendar = [
  { ...workingMonday, openTime: '10:00:00', closeTime: '19:00:00' },
  holidayMonday,
]

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const conflict = { status: 409, code: '3002', type: 'already-exists' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

describe('Salon API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
  })

  const createSalon = async (overrides: Record<string, unknown> = {}) => {
    const response = await request(app)
      .post(SALONS)
      .set('Authorization', asAdmin)
      .send(salonRequest(overrides))
    expect(response.status).toBe(201)
    return response.body.data
  }

  const deleteSalon = async (id: string) => {
    const response = await request(app)
      .delete(`${SALONS}/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  describe('POST /api/v1/salons', () => {
    it('creates the salon and returns it with what the server assigned', async () => {
      const response = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send(salonRequest())

      expect(response.status).toBe(201)
      const { data, meta, links } = response.body
      expect(data).toEqual({
        ...salonRequest(),
        openingHours: storedCalendar,
        id: expect.stringMatching(UUID),
        rating: null,
        reviewCount: 0,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(response.headers['location']).toBe(`${SALONS}/${data.id}`)
      expect(links).toEqual({ self: `${SALONS}/${data.id}`, list: SALONS })
      expect(meta).toEqual({
        correlationId: expect.stringMatching(UUID),
        timestamp: expect.stringMatching(ISO_TIMESTAMP),
        version: 'v1',
      })

      const stored = await request(app).get(`${SALONS}/${data.id}`)
      expect(stored.body.data).toEqual(data)
    })

    it('stores null and empty lists as they are given', async () => {
      const unset = {
        nameKana: null,
        description: null,
        postalCode: null,
        building: null,
        latitude: null,
        longitude: null,
        alternativePhone: null,
        websiteUrl: null,
        logoUrl: null,
        imageUrls: [],
        features: [],
        amenities: [],
        businessHours: null,
        openingHours: [],
      }

      const response = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send(salonRequest(unset))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(unset)
    })

    it.each([
      ['a missing property', { city: undefined }, ['city:invalid_type']],
      [
        'a property the client may not set',
        { rating: 5 },
        ['rating:unrecognized_keys'],
      ],
      ['null for a NOT NULL column', { name: null }, ['name:invalid_type']],
      [
        'a value longer than its column',
        { postalCode: '123-4567-890' },
        ['postalCode:too_big'],
      ],
      [
        'several invalid values',
        { email: 'nope', taxRate: 101 },
        ['email:invalid_format', 'taxRate:too_big'],
      ],
      [
        'a calendar entry on the wrong day of the week',
        {
          openingHours: [{ ...workingMonday, dayOfWeek: 'sunday' }],
        },
        ['openingHours.0.dayOfWeek:custom'],
      ],
      [
        'a calendar that repeats a date',
        {
          openingHours: [workingMonday, workingMonday],
        },
        ['openingHours.1.date:custom'],
      ],
      [
        'weekly hours with a time zone of their own',
        { businessHours: [{ ...weeklyMonday, timezone: 'Asia/Tokyo' }] },
        ['businessHours.0.timezone:unrecognized_keys'],
      ],
    ])('rejects %s and stores nothing', async (_case, change, expected) => {
      const response = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send(salonRequest(change))

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await db.$count(salons)).toBe(0)
    })

    it('rejects a body that is not an object', async () => {
      const response = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send([salonRequest()])

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([':invalid_type'])
    })

    it('rejects an email that another salon uses', async () => {
      await createSalon()

      const response = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send(salonRequest({ name: 'Second salon' }))

      expectProblem(response, conflict)
      expect(response.body.detail).toBe(
        'Salon with email aoyama@example.com already exists',
      )
      expect(await db.$count(salons)).toBe(1)
    })

    it('accepts the email of a deleted salon', async () => {
      const deleted = await createSalon()
      await deleteSalon(deleted.id)

      const response = await request(app)
        .post(SALONS)
        .set('Authorization', asAdmin)
        .send(salonRequest())

      expect(response.status).toBe(201)
      expect(response.body.data.email).toBe(deleted.email)
      expect(await db.$count(salons)).toBe(2)
    })
  })

  describe('GET /api/v1/salons/:id', () => {
    it('returns the salon with its calendar in date order', async () => {
      const created = await createSalon({
        openingHours: [holidayMonday, workingMonday],
      })

      const response = await request(app).get(`${SALONS}/${created.id}`)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        openingHours: storedCalendar,
      })
      expect(response.body.links).toEqual({
        self: `${SALONS}/${created.id}`,
        list: SALONS,
      })
    })

    it('returns the salon for its ID written in upper case, with the ID in lower case', async () => {
      const created = await createSalon()

      const response = await request(app).get(
        `${SALONS}/${created.id.toUpperCase()}`,
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(created)
      expect(response.body.links).toEqual({
        self: `${SALONS}/${created.id}`,
        list: SALONS,
      })
    })

    it.each([
      ['a word', 'latest'],
      ['a number', '42'],
      ['a UUID with something appended', `${UNKNOWN_ID}0`],
    ])('rejects %s as the ID', async (_case, id) => {
      const response = await request(app).get(`${SALONS}/${id}`)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('reports an ID that no salon has as not found', async () => {
      const response = await request(app).get(`${SALONS}/${UNKNOWN_ID}`)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Salon ${UNKNOWN_ID} was not found`)
    })

    it('reports a deleted salon as not found', async () => {
      const created = await createSalon()
      await deleteSalon(created.id)

      const response = await request(app).get(`${SALONS}/${created.id}`)

      expectProblem(response, notFound)
    })

    it('answers 500 without details when the stored salon is corrupt', async () => {
      const created = await createSalon()
      await db
        .update(salons)
        .set({ businessHours: { monday: 'ten to seven' } })
        .where(eq(salons.id, created.id))

      const response = await request(app).get(`${SALONS}/${created.id}`)

      expectProblem(response, { status: 500, code: '4003', type: 'database' })
      expect(response.body.detail).toBeNull()
      expect(JSON.stringify(response.body)).not.toContain('ten to seven')
    })
  })

  describe('GET /api/v1/salons', () => {
    /** Three salons, created in the order A, B, C; lists return newest first. */
    const createThreeSalons = async () => {
      const a = await createSalon({
        name: 'A Aoyama Hair',
        description: 'Quiet, 100% organic',
        email: 'a@example.com',
        prefecture: '東京都',
        city: '港区',
        features: ['color', 'kids'],
        isActive: true,
      })
      const b = await createSalon({
        name: 'B Namba Cuts',
        description: null,
        email: 'b@example.com',
        prefecture: '大阪府',
        city: '大阪市',
        features: ['color'],
        isActive: false,
      })
      const c = await createSalon({
        name: 'C Shibuya Style',
        description: 'Stylists trained in aoyama',
        email: 'c@example.com',
        prefecture: '東京都',
        city: '渋谷区',
        features: [],
        isActive: true,
      })
      // A rating is that of reviews, which the salons do not have here.
      await db
        .update(salons)
        .set({ rating: '4.50', reviewCount: 2 })
        .where(eq(salons.id, a.id))
      await db
        .update(salons)
        .set({ rating: '3.00', reviewCount: 1 })
        .where(eq(salons.id, b.id))
      return { a, b, c }
    }

    const namesOf = (response: Response): string[] =>
      response.body.data.map(({ name }: { name: string }) => name.slice(0, 1))

    it('returns an empty page when there are no salons', async () => {
      const response = await request(app).get(SALONS)

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
          self: SALONS,
          first: SALONS,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('returns salons newest first, each with its calendar', async () => {
      const { a, c } = await createThreeSalons()

      const response = await request(app).get(SALONS)

      expect(namesOf(response)).toEqual(['C', 'B', 'A'])
      expect(response.body.meta).toMatchObject({ total: 3, hasMore: false })
      expect(response.body.data[0]).toEqual(c)
      expect(response.body.data[2]).toEqual({
        ...a,
        rating: 4.5,
        reviewCount: 2,
      })
    })

    it('walks through the pages with the cursor of the previous page', async () => {
      const { b } = await createThreeSalons()

      const first = await request(app).get(`${SALONS}?limit=2`)

      expect(namesOf(first)).toEqual(['C', 'B'])
      expect(first.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: b.id,
        prevCursor: null,
      })
      expect(first.body.links).toEqual({
        self: `${SALONS}?limit=2`,
        first: `${SALONS}?limit=2`,
        last: null,
        next: `${SALONS}?limit=2&cursor=${b.id}`,
        prev: null,
      })

      const second = await request(app).get(first.body.links.next)

      expect(namesOf(second)).toEqual(['A'])
      expect(second.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: false,
        cursor: b.id,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('keeps a page stable when a salon is added while walking', async () => {
      const { b } = await createThreeSalons()
      await createSalon({ name: 'D Newcomer', email: 'd@example.com' })

      const second = await request(app).get(`${SALONS}?limit=2&cursor=${b.id}`)

      expect(namesOf(second)).toEqual(['A'])
    })

    it.each([
      [
        'a keyword in the name or description, ignoring case',
        'keyword=AOYAMA',
        ['C', 'A'],
      ],
      ['a keyword with % taken literally', 'keyword=100%25', ['A']],
      ['a keyword with _ taken literally', 'keyword=A_yama', []],
      [
        'a prefecture',
        `prefecture=${encodeURIComponent('東京都')}`,
        ['C', 'A'],
      ],
      ['a city', `city=${encodeURIComponent('大阪市')}`, ['B']],
      ['inactive salons', 'isActive=false', ['B']],
      [
        'a minimum rating, leaving out unrated salons',
        'minRating=3',
        ['B', 'A'],
      ],
      ['one feature', 'features=color', ['B', 'A']],
      ['every feature listed', 'features=color&features=kids', ['A']],
      [
        'all filters together',
        'isActive=true&features=color&minRating=4',
        ['A'],
      ],
      ['filters that match nothing', 'keyword=nowhere', []],
    ])('filters by %s', async (_case, query, expected) => {
      await createThreeSalons()

      const response = await request(app).get(`${SALONS}?${query}`)

      expect(response.status).toBe(200)
      expect(namesOf(response)).toEqual(expected)
      expect(response.body.meta.total).toBe(expected.length)
    })

    it('leaves out deleted salons', async () => {
      const { b } = await createThreeSalons()
      await deleteSalon(b.id)

      const response = await request(app).get(SALONS)

      expect(namesOf(response)).toEqual(['C', 'A'])
      expect(response.body.meta.total).toBe(2)
    })

    it('returns an empty page for a cursor that names no salon', async () => {
      await createThreeSalons()

      const response = await request(app).get(`${SALONS}?cursor=${UNKNOWN_ID}`)

      expect(response.status).toBe(200)
      expect(namesOf(response)).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 3, hasMore: false })
    })

    it.each([
      ['a limit of 0', 'limit=0', ['limit:too_small']],
      ['a limit over 100', 'limit=101', ['limit:too_big']],
      ['a limit that is not a number', 'limit=ten', ['limit:invalid_format']],
      [
        'a boolean that is not true or false',
        'isActive=yes',
        ['isActive:invalid_value'],
      ],
      [
        'a cursor that is not an ID',
        'cursor=offset:20',
        ['cursor:invalid_format'],
      ],
      ['a rating above 5', 'minRating=6', ['minRating:too_big']],
      ['an empty keyword', 'keyword=', ['keyword:invalid_format']],
      ['a parameter that does not exist', 'page=2', ['page:unrecognized_keys']],
    ])('rejects %s', async (_case, query, expected) => {
      const response = await request(app).get(`${SALONS}?${query}`)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
    })
  })

  describe('PATCH /api/v1/salons/:id', () => {
    it('changes the given properties and nothing else', async () => {
      const created = await createSalon()

      const response = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send({ name: 'Renamed', taxRate: 8.5 })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...created,
        name: 'Renamed',
        taxRate: 8.5,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      const [row] = await db
        .select({ createdAt: salons.createdAt, updatedAt: salons.updatedAt })
        .from(salons)
      expect(row?.updatedAt).not.toBe(row?.createdAt)
    })

    it('clears a nullable property that is given as null', async () => {
      const created = await createSalon()
      const cleared = {
        description: null,
        building: null,
        latitude: null,
        longitude: null,
        websiteUrl: null,
        businessHours: null,
      }

      const response = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send(cleared)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        ...cleared,
        name: created.name,
        openingHours: storedCalendar,
      })
    })

    it('replaces the whole calendar when openingHours is given', async () => {
      const created = await createSalon()
      const tuesday = {
        dayOfWeek: 'tuesday',
        date: '2026-11-17',
        openTime: '09:00:00',
        closeTime: '18:00:00',
        isHoliday: false,
        holidayName: null,
        notes: 'New schedule',
      }

      const replaced = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send({ openingHours: [tuesday] })
      expect(replaced.body.data.openingHours).toEqual([tuesday])

      const emptied = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send({ openingHours: [] })
      expect(emptied.body.data.openingHours).toEqual([])
      expect(await db.$count(openingHours)).toBe(0)
    })

    it('accepts the email the salon already has', async () => {
      const created = await createSalon()

      const response = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send({ email: created.email })

      expect(response.status).toBe(200)
    })

    it('accepts the email of a deleted salon', async () => {
      const deleted = await createSalon({ email: 'former@example.com' })
      await deleteSalon(deleted.id)
      const created = await createSalon()

      const response = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send({ email: 'former@example.com' })

      expect(response.status).toBe(200)
      expect(response.body.data.email).toBe('former@example.com')
    })

    it.each([
      [
        'an ID that is not a UUID',
        'latest',
        { name: 'Renamed' },
        ['id:invalid_format'],
      ],
      ['an empty request', null, {}, [':custom']],
      [
        'null for a NOT NULL column',
        null,
        { prefecture: null },
        ['prefecture:invalid_type'],
      ],
      [
        'a property the client may not set',
        null,
        { reviewCount: 99 },
        ['reviewCount:unrecognized_keys'],
      ],
      [
        'an invalid calendar',
        null,
        {
          openingHours: [{ ...workingMonday, closeTime: '09:00' }],
        },
        ['openingHours.0.closeTime:custom'],
      ],
      [
        'weekly hours with a time zone of their own',
        null,
        { businessHours: [{ ...weeklyMonday, timezone: null }] },
        ['businessHours.0.timezone:unrecognized_keys'],
      ],
    ])('rejects %s and changes nothing', async (_case, id, body, expected) => {
      const created = await createSalon()

      const response = await request(app)
        .patch(`${SALONS}/${id ?? created.id}`)
        .set('Authorization', asAdmin)
        .send(body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      const stored = await request(app).get(`${SALONS}/${created.id}`)
      expect(stored.body.data).toEqual(created)
    })

    it('reports an ID that no salon has as not found', async () => {
      const response = await request(app)
        .patch(`${SALONS}/${UNKNOWN_ID}`)
        .set('Authorization', asAdmin)
        .send({ name: 'Renamed' })

      expectProblem(response, notFound)
    })

    it('reports a deleted salon as not found', async () => {
      const created = await createSalon()
      await deleteSalon(created.id)

      const response = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send({ name: 'Renamed' })

      expectProblem(response, notFound)
    })

    it('rejects the email of another salon and applies none of the request', async () => {
      await createSalon({ email: 'taken@example.com' })
      const created = await createSalon()

      const response = await request(app)
        .patch(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)
        .send({ name: 'Renamed', email: 'taken@example.com', openingHours: [] })

      expectProblem(response, conflict)
      expect(response.body.detail).toBe(
        'Salon with email taken@example.com already exists',
      )
      const stored = await request(app).get(`${SALONS}/${created.id}`)
      expect(stored.body.data).toEqual(created)
    })
  })

  describe('DELETE /api/v1/salons/:id', () => {
    it('hides the salon and keeps its row and calendar', async () => {
      const created = await createSalon()

      const response = await request(app)
        .delete(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      const [row] = await db
        .select({ deletedAt: salons.deletedAt })
        .from(salons)
        .where(eq(salons.id, created.id))
      expect(row?.deletedAt).not.toBeNull()
      expect(await db.$count(openingHours)).toBe(2)
    })

    it.each([
      ['a word', 'all'],
      ['a number', '1'],
      ['a UUID with something appended', `${UNKNOWN_ID}-1`],
    ])('rejects %s as the ID', async (_case, id) => {
      const created = await createSalon()

      const response = await request(app)
        .delete(`${SALONS}/${id}`)
        .set('Authorization', asAdmin)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
      const stored = await request(app).get(`${SALONS}/${created.id}`)
      expect(stored.status).toBe(200)
    })

    it('reports an ID that no salon has as not found', async () => {
      const response = await request(app)
        .delete(`${SALONS}/${UNKNOWN_ID}`)
        .set('Authorization', asAdmin)

      expectProblem(response, notFound)
    })

    it('reports a salon that is already deleted as not found', async () => {
      const created = await createSalon()
      await deleteSalon(created.id)

      const response = await request(app)
        .delete(`${SALONS}/${created.id}`)
        .set('Authorization', asAdmin)

      expectProblem(response, notFound)
    })
  })

  describe('who may change salons', () => {
    /** Signs in and returns the Authorization header to send. */
    type SignInAs = (salonId: string, otherSalonId: string) => Promise<string>

    const member =
      (
        role: 'owner' | 'manager' | 'staff',
        staffOverrides: Parameters<typeof insertMember>[3] = {},
      ) =>
      async (salonId: string): Promise<string> =>
        (
          await signIn(
            app,
            (
              await insertMember(db, role, salonId, staffOverrides)
            ).email,
          )
        ).authorization

    const memberOfOther =
      (role: 'owner' | 'manager') =>
      async (_salonId: string, otherSalonId: string): Promise<string> =>
        member(role)(otherSalonId)

    const customer: SignInAs = async () =>
      (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
        .authorization

    const staffUserWithoutStaffMember: SignInAs = async () =>
      (await signedInUser(app, db, { role: 'staff' })).authorization

    /** Everybody but an admin: the owner of the salon included. */
    const nonAdmins: [string, SignInAs][] = [
      ['the owner of a salon', member('owner')],
      ['the manager of a salon', member('manager')],
      ['a staff member', member('staff')],
      ['a customer', customer],
      ['a staff user without a staff member', staffUserWithoutStaffMember],
    ]

    /** Who may not change the salon under test. */
    const mayNotUpdate: [string, SignInAs][] = [
      ['the owner of another salon', memberOfOther('owner')],
      ['a manager of another salon', memberOfOther('manager')],
      ['a staff member of the salon', member('staff')],
      ['a customer', customer],
      ['a staff user without a staff member', staffUserWithoutStaffMember],
      [
        'an owner whose staff member is inactive',
        member('owner', { isActive: false }),
      ],
      [
        'an owner whose staff member is deleted',
        member('owner', { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ]

    const patchAs = (authorization: string, id: string, body: object) =>
      request(app)
        .patch(`${SALONS}/${id}`)
        .set('Authorization', authorization)
        .send(body)

    describe('POST /api/v1/salons', () => {
      it('asks for an access token and stores nothing without one', async () => {
        const response = await request(app).post(SALONS).send(salonRequest())

        expectProblem(response, authenticationRequired)
        expect(response.headers['www-authenticate']).toBe(
          'Bearer realm="beauty-salon-api"',
        )
        expect(await db.$count(salons)).toBe(0)
      })

      it('refuses a token that names no session and stores nothing', async () => {
        const response = await request(app)
          .post(SALONS)
          .set('Authorization', `Bearer ${'t'.repeat(43)}`)
          .send(salonRequest())

        expectProblem(response, invalidToken)
        expect(await db.$count(salons)).toBe(0)
      })

      it.each(nonAdmins)(
        'forbids %s to create a salon and stores nothing',
        async (_case, signInAs) => {
          const salonId = await insertSalon(db)
          const authorization = await signInAs(salonId, salonId)

          const response = await request(app)
            .post(SALONS)
            .set('Authorization', authorization)
            .send(salonRequest())

          expectProblem(response, forbidden)
          expect(await db.$count(salons)).toBe(1)
        },
      )

      it('forbids an owner even a body it would reject, while an admin gets the validation error', async () => {
        const salonId = await insertSalon(db)
        const owner = await member('owner')(salonId)
        const invalid = salonRequest({ email: 'nope' })

        const fromOwner = await request(app)
          .post(SALONS)
          .set('Authorization', owner)
          .send(invalid)
        const fromAdmin = await request(app)
          .post(SALONS)
          .set('Authorization', asAdmin)
          .send(invalid)

        expectProblem(fromOwner, forbidden)
        expectProblem(fromAdmin, badRequest)
      })
    })

    describe('PATCH /api/v1/salons/:id', () => {
      it('asks for an access token and changes nothing without one', async () => {
        const created = await createSalon()

        const response = await request(app)
          .patch(`${SALONS}/${created.id}`)
          .send({ name: 'Renamed' })

        expectProblem(response, authenticationRequired)
        const stored = await request(app).get(`${SALONS}/${created.id}`)
        expect(stored.body.data).toEqual(created)
      })

      it.each<[string, SignInAs]>([
        ['the owner of the salon', member('owner')],
        ['a manager of the salon', member('manager')],
      ])('lets %s change the salon', async (_case, signInAs) => {
        const created = await createSalon()
        const authorization = await signInAs(created.id, await insertSalon(db))

        const response = await patchAs(authorization, created.id, {
          name: 'Renamed',
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...created,
          name: 'Renamed',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
      })

      it.each<[string, SignInAs]>([
        ['the owner of the salon', member('owner')],
        ['a manager of the salon', member('manager')],
      ])(
        'lets %s change the salon when the path writes its ID in upper case',
        async (_case, signInAs) => {
          const created = await createSalon()
          const authorization = await signInAs(
            created.id,
            await insertSalon(db),
          )

          const response = await patchAs(
            authorization,
            created.id.toUpperCase(),
            { name: 'Renamed' },
          )

          expect(response.status).toBe(200)
          expect(response.body.data).toMatchObject({
            id: created.id,
            name: 'Renamed',
          })
          expect(response.body.links.self).toBe(`${SALONS}/${created.id}`)
        },
      )

      it.each(mayNotUpdate)(
        'forbids %s to change the salon and changes nothing',
        async (_case, signInAs) => {
          const created = await createSalon()
          const authorization = await signInAs(
            created.id,
            await insertSalon(db),
          )

          const response = await patchAs(authorization, created.id, {
            name: 'Renamed',
          })

          expectProblem(response, forbidden)
          const stored = await request(app).get(`${SALONS}/${created.id}`)
          expect(stored.body.data).toEqual(created)
        },
      )

      it.each(mayNotUpdate)(
        'forbids %s to change a salon that does not exist',
        async (_case, signInAs) => {
          const salonId = await insertSalon(db)
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await patchAs(authorization, UNKNOWN_ID, {
            name: 'Renamed',
          })

          expectProblem(response, forbidden)
        },
      )

      it('forbids the owner of a deleted salon to change it, where an admin is told it is not found', async () => {
        const created = await createSalon()
        const owner = await member('owner')(created.id)
        await deleteSalon(created.id)

        const fromOwner = await patchAs(owner, created.id, { name: 'Renamed' })
        const fromAdmin = await patchAs(asAdmin, created.id, {
          name: 'Renamed',
        })

        expectProblem(fromOwner, forbidden)
        expectProblem(fromAdmin, notFound)
      })

      it.each<[string, SignInAs]>([
        ['the owner of the salon', member('owner')],
        ['the owner of another salon', memberOfOther('owner')],
        ['a staff member', member('staff')],
        ['a customer', customer],
        ['a staff user without a staff member', staffUserWithoutStaffMember],
      ])(
        'rejects an ID that is not a UUID from %s',
        async (_case, signInAs) => {
          const salonId = await insertSalon(db)
          const authorization = await signInAs(salonId, await insertSalon(db))

          const response = await patchAs(authorization, 'latest', {
            name: 'Renamed',
          })

          expectProblem(response, badRequest)
          expect(brokenRules(response)).toEqual(['id:invalid_format'])
        },
      )
    })

    describe('DELETE /api/v1/salons/:id', () => {
      it('asks for an access token and deletes nothing without one', async () => {
        const created = await createSalon()

        const response = await request(app).delete(`${SALONS}/${created.id}`)

        expectProblem(response, authenticationRequired)
        expect((await request(app).get(`${SALONS}/${created.id}`)).status).toBe(
          200,
        )
      })

      it('lets the owner of the salon delete it', async () => {
        const created = await createSalon()
        const owner = await member('owner')(created.id)

        const response = await request(app)
          .delete(`${SALONS}/${created.id}`)
          .set('Authorization', owner)

        expect(response.status).toBe(204)
        expectProblem(
          await request(app).get(`${SALONS}/${created.id}`),
          notFound,
        )
      })

      it('lets the owner of the salon delete it when the path writes its ID in upper case', async () => {
        const created = await createSalon()
        const owner = await member('owner')(created.id)

        const response = await request(app)
          .delete(`${SALONS}/${created.id.toUpperCase()}`)
          .set('Authorization', owner)

        expect(response.status).toBe(204)
        expectProblem(
          await request(app).get(`${SALONS}/${created.id}`),
          notFound,
        )
      })

      it.each<[string, SignInAs]>([
        ['a manager of the salon', member('manager')],
        ['the owner of another salon', memberOfOther('owner')],
        ['a staff member of the salon', member('staff')],
        ['a customer', customer],
        ['a staff user without a staff member', staffUserWithoutStaffMember],
      ])(
        'forbids %s to delete the salon and deletes nothing',
        async (_case, signInAs) => {
          const created = await createSalon()
          const authorization = await signInAs(
            created.id,
            await insertSalon(db),
          )

          const response = await request(app)
            .delete(`${SALONS}/${created.id}`)
            .set('Authorization', authorization)

          expectProblem(response, forbidden)
          expect(
            (await request(app).get(`${SALONS}/${created.id}`)).status,
          ).toBe(200)
        },
      )
    })
  })
})
