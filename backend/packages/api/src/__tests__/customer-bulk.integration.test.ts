import { randomUUID } from 'node:crypto'
import { bookings, customers, users } from '@beauty-salon-backend/database'
import { customerIdSchema } from '@beauty-salon-backend/domain'
import { CustomerRepository } from '@beauty-salon-backend/infrastructure'
import { asc, eq, inArray } from 'drizzle-orm'
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
  signInAsAdmin,
} from './_shared/auth-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  getTestDbClient,
  request,
} from './_shared/test-helpers'

const CUSTOMERS = '/api/v1/customers'
const BATCH = `${CUSTOMERS}/batch/get`
const BULK = `${CUSTOMERS}/bulk`

/** A UUID that no customer has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const malformedBody = { status: 400, code: '2002', type: 'malformed-body' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const alreadyExists = { status: 409, code: '3002', type: 'already-exists' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** A request to create a customer with nothing that may be unset. */
const customerRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: '花子',
  lastName: '山田',
  firstNameKana: null,
  lastNameKana: null,
  email: 'hanako@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  membershipTier: 'regular',
  preferences: null,
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: true,
  allowSms: true,
  allowEmail: true,
  isActive: true,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  ...overrides,
})

describe('Customer bulk API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  let asAdmin: string
  let asOwner: string
  let asManager: string
  let asStaff: string
  let asCustomer: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    const salonId = await insertSalon(db)
    const member = async (role: 'owner' | 'manager' | 'staff') =>
      (await signIn(app, (await insertMember(db, role, salonId)).email))
        .authorization
    asOwner = await member('owner')
    asManager = await member('manager')
    asStaff = await member('staff')
    asCustomer = (await signedInUser(app, db)).authorization
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  type Body = string | object

  const batchGet = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).post(BATCH), as).send(body)
  const bulkCreate = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).post(BULK), as).send(body)
  const bulkUpdate = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).patch(BULK), as).send(body)
  const bulkDelete = (body: Body, as: string | null = asAdmin) =>
    authorized(request(app).delete(BULK), as).send(body)

  /** Waits until a statement of another connection waits for a lock. */
  const untilSomeoneWaits = async (
    client: ReturnType<typeof getTestDbClient>,
  ): Promise<void> => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [activity] = await client<{ waiting: number }[]>`
        SELECT count(*)::int AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `
      if ((activity?.waiting ?? 0) > 0) {
        return
      }
      await pause(10)
    }
    throw new Error('Nobody waited for a lock')
  }

  /** A customer written directly, with an email and a referral code of its own; returns its ID. */
  const stored = async (
    overrides: Partial<typeof customers.$inferInsert> = {},
  ) => {
    const id = await insertCustomer(db)
    if (Object.keys(overrides).length > 0) {
      await db.update(customers).set(overrides).where(eq(customers.id, id))
    }
    return id
  }

  /** The stored rows of the customers, by ID. */
  const rowsOf = (ids: string[]) =>
    db
      .select()
      .from(customers)
      .where(inArray(customers.id, ids))
      .orderBy(asc(customers.id))

  const countCustomers = () => db.$count(customers)

  /** A booking of a customer in a status, written directly. */
  const insertBooking = async (
    customerId: string,
    status: (typeof bookings.status.enumValues)[number],
  ): Promise<void> => {
    const salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    const staffId = await insertStaff(db, salonId)
    await db.insert(bookings).values({
      bookingNumber: `BK-${customerId.slice(0, 8)}-${status}`,
      salonId,
      customerId,
      staffId,
      bookingDate: '2026-12-01',
      startTime: '2026-12-01T01:00:00Z',
      endTime: '2026-12-01T02:00:00Z',
      duration: 60,
      subtotal: 6600,
      totalAmount: 6600,
      status,
      cancelledAt: status === 'cancelled' ? '2026-11-30T00:00:00Z' : null,
      completedAt: status === 'completed' ? '2026-12-01T02:00:00Z' : null,
      actualStartTime:
        status === 'completed' || status === 'in_progress'
          ? '2026-12-01T01:00:00Z'
          : null,
    })
  }

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

  describe('POST /api/v1/customers/batch/get', () => {
    it('answers the customers in the order of the IDs, as a get answers each', async () => {
      const [first, second, third] = [
        await stored(),
        await stored(),
        await stored(),
      ]

      const response = await batchGet({
        ids: [third, first.toUpperCase(), second],
      })
      const single = await authorized(
        request(app).get(`${CUSTOMERS}/${first}`),
        asAdmin,
      )

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        third,
        first,
        second,
      ])
      expect(response.body.data[1]).toEqual(single.body.data)
      expect(response.body.links).toEqual({ list: CUSTOMERS })
      expect(response.body.meta).toEqual(
        expect.objectContaining({ correlationId: expect.any(String) }),
      )
    })

    it.each([
      ['the admin', () => asAdmin],
      ['an owner', () => asOwner],
      ['a manager', () => asManager],
      ['a staff member', () => asStaff],
    ])('lets %s read them', async (_who, as) => {
      const id = await stored()

      const response = await batchGet({ ids: [id] }, as())

      expect(response.status).toBe(200)
    })

    it('answers 404 with the first customer of the request that is missing or deleted', async () => {
      const there = await stored()
      const deleted = await stored({ deletedAt: '2026-11-01T00:00:00Z' })

      const responses = [
        await batchGet({ ids: [there, deleted, UNKNOWN_ID] }),
        await batchGet({ ids: [there, UNKNOWN_ID, deleted] }),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses.map(({ body }) => body.detail)).toEqual([
        `Customer ${deleted} was not found`,
        `Customer ${UNKNOWN_ID} was not found`,
      ])
    })

    it.each<[string, object, string[]]>([
      ['no IDs', {}, ['ids:invalid_type']],
      ['an empty list', { ids: [] }, ['ids:too_small']],
      ['an ID that is no UUID', { ids: ['abc'] }, ['ids.0:invalid_format']],
      [
        'an ID twice',
        { ids: [UNKNOWN_ID, UNKNOWN_ID.toUpperCase()] },
        ['ids.1:custom'],
      ],
    ])('refuses a request with %s with 400', async (_case, body, rules) => {
      const response = await batchGet(body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer batch')
      expect(brokenRules(response)).toEqual(rules)
    })

    it('refuses a customer with 403, even with a body that is not valid', async () => {
      const responses = [
        await batchGet({ ids: [await stored()] }, asCustomer),
        await batchGet({ ids: 'x' }, asCustomer),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it.each(unauthenticated)(
      'answers %s with 401',
      async (_case, tokenOf, problem, challenge) => {
        const response = await batchGet({ ids: [UNKNOWN_ID] }, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )
  })

  describe('POST /api/v1/customers/bulk', () => {
    it('adds every customer and answers their IDs in the order of the request', async () => {
      const referrer = await stored()
      const before = await countCustomers()

      const response = await bulkCreate({
        items: [
          customerRequest({
            email: 'First@Example.com',
            referralCode: 'FIRST',
          }),
          customerRequest({
            email: 'second@example.com',
            referredBy: referrer,
          }),
        ],
      })

      expect(response.status).toBe(201)
      expect(response.headers['location']).toBeUndefined()
      expect(response.body.links).toEqual({ list: CUSTOMERS })
      const created: string[] = response.body.data.created
      expect(created).toHaveLength(2)
      expect(await countCustomers()).toBe(before + 2)
      const [first, second] = await Promise.all(
        created.map(
          async (id) =>
            (await authorized(request(app).get(`${CUSTOMERS}/${id}`), asAdmin))
              .body.data,
        ),
      )
      expect(first).toMatchObject({
        email: 'first@example.com',
        referralCode: 'FIRST',
        referredBy: null,
      })
      expect(second).toMatchObject({
        email: 'second@example.com',
        referredBy: referrer,
      })
    })

    it.each([
      ['an owner', () => asOwner],
      ['a manager', () => asManager],
      ['a staff member', () => asStaff],
    ])('lets %s add customers', async (_who, as) => {
      const response = await bulkCreate(
        { items: [customerRequest({ email: `${randomUUID()}@example.com` })] },
        as(),
      )

      expect(response.status).toBe(201)
    })

    it('adds none when the email of an item is taken, whether by a customer who is there or by an earlier item', async () => {
      await stored({ email: 'taken@example.com' })
      const before = await countCustomers()

      const responses = [
        await bulkCreate({
          items: [
            customerRequest({ email: 'one@example.com' }),
            customerRequest({ email: 'Taken@example.com' }),
          ],
        }),
        await bulkCreate({
          items: [
            customerRequest({ email: 'twice@example.com' }),
            customerRequest({ email: 'other@example.com' }),
            customerRequest({ email: 'TWICE@example.com' }),
          ],
        }),
      ]

      for (const response of responses) {
        expectProblem(response, alreadyExists)
      }
      expect(responses.map(({ body }) => body.detail)).toEqual([
        'Customer with email taken@example.com already exists',
        'Customer with email twice@example.com already exists',
      ])
      expect(await countCustomers()).toBe(before)
    })

    it('adds none when a referral code is taken, also by a deleted customer or an earlier item', async () => {
      await stored({ referralCode: 'GONE', deletedAt: '2026-11-01T00:00:00Z' })
      const before = await countCustomers()

      const responses = [
        await bulkCreate({
          items: [
            customerRequest({ email: 'a@example.com' }),
            customerRequest({ email: 'b@example.com', referralCode: 'GONE' }),
          ],
        }),
        await bulkCreate({
          items: [
            customerRequest({ email: 'c@example.com', referralCode: 'SAME' }),
            customerRequest({ email: 'd@example.com', referralCode: 'SAME' }),
          ],
        }),
      ]

      for (const response of responses) {
        expectProblem(response, alreadyExists)
      }
      expect(await countCustomers()).toBe(before)
    })

    it('refuses every item whose referrer is missing or deleted with 400, before a taken email', async () => {
      await stored({ email: 'taken@example.com' })
      const deleted = await stored({ deletedAt: '2026-11-01T00:00:00Z' })
      const there = await stored()
      const before = await countCustomers()

      const response = await bulkCreate({
        items: [
          customerRequest({ email: 'taken@example.com', referredBy: there }),
          customerRequest({ email: 'b@example.com', referredBy: deleted }),
          customerRequest({ email: 'c@example.com' }),
          customerRequest({ email: 'd@example.com', referredBy: UNKNOWN_ID }),
        ],
      })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customers')
      expect(brokenRules(response)).toEqual([
        'items.1.referredBy:not_found',
        'items.3.referredBy:not_found',
      ])
      expect(await countCustomers()).toBe(before)
    })

    it.each<[string, object, string[]]>([
      ['no items', {}, ['items:invalid_type']],
      ['an empty list', { items: [] }, ['items:too_small']],
      [
        'an item that breaks a rule',
        {
          items: [
            customerRequest({ email: 'a@example.com' }),
            customerRequest({
              email: 'b@example.com',
              birthDate: '2999-01-01',
            }),
          ],
        },
        ['items.1.birthDate:too_big'],
      ],
      [
        'an item that writes the points',
        { items: [{ ...customerRequest(), loyaltyPoints: 100 }] },
        ['items.0.loyaltyPoints:unrecognized_keys'],
      ],
    ])('refuses a request with %s with 400', async (_case, body, rules) => {
      const before = await countCustomers()

      const response = await bulkCreate(body)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(rules)
      expect(await countCustomers()).toBe(before)
    })

    it('refuses a body that is no JSON with 400 and a customer with 403', async () => {
      const malformed = await authorized(request(app).post(BULK), asAdmin)
        .set('Content-Type', 'application/json')
        .send('{"items": [')
      const asTheCustomer = await bulkCreate(
        { items: [customerRequest()] },
        asCustomer,
      )

      expectProblem(malformed, malformedBody)
      expectProblem(asTheCustomer, forbidden)
    })

    it.each(unauthenticated)(
      'answers %s with 401',
      async (_case, tokenOf, problem, challenge) => {
        const response = await bulkCreate({ items: [] }, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )
  })

  describe('PATCH /api/v1/customers/bulk', () => {
    it('changes every customer as its item says, marks the time of the change, and answers the IDs in the order of the request', async () => {
      const longAgo = '2026-01-01T00:00:00+00:00'
      const [first, second] = [
        await stored({ updatedAt: longAgo }),
        await stored({ updatedAt: longAgo }),
      ]
      const referrer = await stored({ updatedAt: longAgo })

      const response = await bulkUpdate({
        items: [
          { id: second, updates: { notes: 'Window seat', tags: ['vip'] } },
          {
            id: first.toUpperCase(),
            updates: { email: 'New@Example.com', referredBy: referrer },
          },
        ],
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ updated: [second, first] })
      expect(response.body.links).toEqual({ list: CUSTOMERS })
      const [one, two] = await rowsOf([first, second]).then((rows) =>
        [first, second].map((id) => rows.find((row) => row.id === id)),
      )
      expect(one).toMatchObject({
        email: 'new@example.com',
        referredBy: referrer,
        notes: null,
      })
      expect(two).toMatchObject({ notes: 'Window seat', tags: ['vip'] })
      const times = Object.fromEntries(
        (await rowsOf([first, second, referrer])).map(({ id, updatedAt }) => [
          id,
          Date.parse(updatedAt) > Date.parse(longAgo),
        ]),
      )
      expect(times).toEqual({
        [first]: true,
        [second]: true,
        [referrer]: false,
      })
    })

    it('changes none when a customer is missing or deleted, and answers 404 with the first of the request', async () => {
      const there = await stored()
      const deleted = await stored({ deletedAt: '2026-11-01T00:00:00Z' })
      const before = await rowsOf([there])

      const response = await bulkUpdate({
        items: [
          { id: there, updates: { notes: 'changed' } },
          { id: deleted, updates: { notes: 'changed' } },
          { id: UNKNOWN_ID, updates: { notes: 'changed' } },
        ],
      })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${deleted} was not found`)
      expect(await rowsOf([there])).toEqual(before)
    })

    it('changes none when a later email is taken, and refuses two customers swapping their emails', async () => {
      const first = await stored({ email: 'first@example.com' })
      const second = await stored({ email: 'second@example.com' })
      const before = await rowsOf([first, second])

      const responses = [
        await bulkUpdate({
          items: [
            { id: first, updates: { notes: 'changed' } },
            { id: second, updates: { email: 'first@example.com' } },
          ],
        }),
        await bulkUpdate({
          items: [
            { id: first, updates: { email: 'second@example.com' } },
            { id: second, updates: { email: 'first@example.com' } },
          ],
        }),
      ]

      for (const response of responses) {
        expectProblem(response, alreadyExists)
      }
      expect(responses.map(({ body }) => body.detail)).toEqual([
        'Customer with email first@example.com already exists',
        'Customer with email second@example.com already exists',
      ])
      expect(await rowsOf([first, second])).toEqual(before)
    })

    it('refuses a referrer that is missing, and one that is the customer, with 400 at the place of the item', async () => {
      const [first, second] = [await stored(), await stored()]
      const before = await rowsOf([first, second])

      const missing = await bulkUpdate({
        items: [
          { id: first, updates: { notes: 'changed' } },
          { id: second, updates: { referredBy: UNKNOWN_ID } },
        ],
      })
      const itself = await bulkUpdate({
        items: [{ id: first, updates: { referredBy: first.toUpperCase() } }],
      })

      expectProblem(missing, badRequest)
      expect(brokenRules(missing)).toEqual([
        'items.1.updates.referredBy:not_found',
      ])
      expectProblem(itself, badRequest)
      expect(brokenRules(itself)).toEqual([
        'items.0.updates.referredBy:circular',
      ])
      expect(await rowsOf([first, second])).toEqual(before)
    })

    it.each<[string, (id: string) => object, string[]]>([
      ['an empty list', () => ({ items: [] }), ['items:too_small']],
      [
        'a customer twice',
        (id) => ({
          items: [
            { id, updates: { notes: null } },
            { id: id.toUpperCase(), updates: { tags: [] } },
          ],
        }),
        ['items.1.id:custom'],
      ],
      [
        'an item without changes',
        (id) => ({ items: [{ id, updates: {} }] }),
        ['items.0.updates:custom'],
      ],
      [
        'a change of a counted value',
        (id) => ({ items: [{ id, updates: { visitCount: 3 } }] }),
        ['items.0.updates.visitCount:unrecognized_keys'],
      ],
    ])('refuses a request with %s with 400', async (_case, bodyOf, rules) => {
      const response = await bulkUpdate(bodyOf(await stored()))

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer updates')
      expect(brokenRules(response)).toEqual(rules)
    })

    it('refuses a customer with 403, before the body is read', async () => {
      const responses = [
        await bulkUpdate(
          { items: [{ id: await stored(), updates: { notes: null } }] },
          asCustomer,
        ),
        await bulkUpdate({ items: 'x' }, asCustomer),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it.each(unauthenticated)(
      'answers %s with 401',
      async (_case, tokenOf, problem, challenge) => {
        const response = await bulkUpdate({ items: [] }, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )
  })

  describe('DELETE /api/v1/customers/bulk', () => {
    it('deletes every customer, unlinks their accounts, and answers the IDs in the order of the request', async () => {
      const [first, second, other] = [
        await stored(),
        await stored(),
        await stored(),
      ]
      const account = await insertUser(db, { customerId: first })
      await db
        .update(customers)
        .set({ userId: account.id })
        .where(eq(customers.id, first))
      await insertBooking(second, 'completed')

      const response = await bulkDelete({ ids: [second, first.toUpperCase()] })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ deleted: [second, first] })
      expect(response.body.links).toEqual({ list: CUSTOMERS })
      const rows = await rowsOf([first, second, other])
      expect(
        Object.fromEntries(
          rows.map(({ id, deletedAt }) => [id, deletedAt !== null]),
        ),
      ).toEqual({ [first]: true, [second]: true, [other]: false })
      const [linked] = await db
        .select({ customerId: users.customerId })
        .from(users)
        .where(eq(users.id, account.id))
      expect(linked?.customerId).toBeNull()
      expect(rows.find(({ id }) => id === first)?.userId).toBe(account.id)
    })

    it.each([
      ['an owner', () => asOwner],
      ['a manager', () => asManager],
    ])('lets %s delete customers', async (_who, as) => {
      const response = await bulkDelete({ ids: [await stored()] }, as())

      expect(response.status).toBe(200)
    })

    it('refuses a staff member and a customer with 403, before the body is read', async () => {
      const id = await stored()

      const responses = [
        await bulkDelete({ ids: [id] }, asStaff),
        await bulkDelete({ ids: [id] }, asCustomer),
        await bulkDelete({ ids: 'x' }, asStaff),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect((await rowsOf([id]))[0]?.deletedAt).toBeNull()
    })

    it('deletes none when a customer is missing or deleted, and answers 404 with the first of the request', async () => {
      const there = await stored()
      const deleted = await stored({ deletedAt: '2026-11-01T00:00:00Z' })

      const response = await bulkDelete({ ids: [there, UNKNOWN_ID, deleted] })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${UNKNOWN_ID} was not found`)
      expect((await rowsOf([there]))[0]?.deletedAt).toBeNull()
    })

    it('deletes none while a booking that is not finished refers to one of them, and names the first of the request', async () => {
      const [first, second, third] = [
        await stored(),
        await stored(),
        await stored(),
      ]
      const account = await insertUser(db, { customerId: first })
      await insertBooking(third, 'confirmed')
      await insertBooking(second, 'in_progress')

      const response = await bulkDelete({ ids: [first, third, second] })

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        `Customer ${third} cannot be deleted: bookings that are not finished refer to it`,
      )
      expect(
        (await rowsOf([first, second, third])).map(
          ({ deletedAt }) => deletedAt,
        ),
      ).toEqual([null, null, null])
      const [linked] = await db
        .select({ customerId: users.customerId })
        .from(users)
        .where(eq(users.id, account.id))
      expect(linked?.customerId).toBe(first)
    })

    it.each<[string, object, string[]]>([
      ['no IDs', {}, ['ids:invalid_type']],
      ['an ID twice', { ids: [UNKNOWN_ID, UNKNOWN_ID] }, ['ids.1:custom']],
    ])('refuses a request with %s with 400', async (_case, body, rules) => {
      const response = await bulkDelete(body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer deletion')
      expect(brokenRules(response)).toEqual(rules)
    })

    it.each(unauthenticated)(
      'answers %s with 401',
      async (_case, tokenOf, problem, challenge) => {
        const response = await bulkDelete({ ids: [] }, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )
  })

  describe('routes', () => {
    it('leaves the single customer routes as they were', async () => {
      const id = await stored()

      const get = await authorized(
        request(app).get(`${CUSTOMERS}/${id}`),
        asAdmin,
      )
      const patch = await authorized(
        request(app).patch(`${CUSTOMERS}/${id}`),
        asAdmin,
      ).send({ notes: 'single' })
      const remove = await authorized(
        request(app).delete(`${CUSTOMERS}/${id}`),
        asAdmin,
      )

      expect([get.status, patch.status, remove.status]).toEqual([200, 200, 204])
    })

    it('answers the other methods and paths of the bulk routes with 404', async () => {
      const responses: Response[] = [
        await authorized(request(app).put(BULK), asAdmin).send({}),
        await authorized(request(app).get(BATCH), asAdmin),
        await authorized(request(app).post(`${CUSTOMERS}/batch`), asAdmin).send(
          {},
        ),
        await authorized(
          request(app).post(`${CUSTOMERS}/bulk/get`),
          asAdmin,
        ).send({}),
      ]

      for (const response of responses) {
        expectProblem(response, routeNotFound)
      }
    })
  })

  describe('requests at the same moment', () => {
    it('lets two bulk updates of the same customers, named in opposite orders, both succeed', async () => {
      const ids = [await stored(), await stored(), await stored()]

      for (let round = 0; round < 5; round += 1) {
        const responses = await Promise.all([
          bulkUpdate({
            items: ids.map((id) => ({ id, updates: { notes: `a${round}` } })),
          }),
          bulkUpdate({
            items: ids
              .toReversed()
              .map((id) => ({ id, updates: { tags: [`b${round}`] } })),
          }),
        ])

        expect(responses.map(({ status }) => status)).toEqual([200, 200])
      }
      expect(
        (await rowsOf(ids)).map(({ notes, tags }) => ({ notes, tags })),
      ).toEqual(ids.map(() => ({ notes: 'a4', tags: ['b4'] })))
    })

    it('waits for a booking that is being entered for a customer, and then deletes none', async () => {
      const [first, second] = [await stored(), await stored()]
      const salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
      const staffId = await insertStaff(db, salonId)
      const client = getTestDbClient()
      const written = Promise.withResolvers<void>()
      const mayCommit = Promise.withResolvers<void>()
      // An entry of a booking holds its customer and writes the booking; it
      // has not committed when the delete comes.
      const entry = client.begin(async (tx) => {
        await tx`SELECT id FROM customers WHERE id = ${second} FOR SHARE`
        await tx`
          INSERT INTO bookings (
            "bookingNumber", "salonId", "customerId", "staffId", "bookingDate",
            "startTime", "endTime", duration, subtotal, "totalAmount", status
          ) VALUES (
            'BK-HELD-0001', ${salonId}, ${second}, ${staffId}, '2026-12-01',
            '2026-12-01T01:00:00Z', '2026-12-01T02:00:00Z', 60, 6600, 6600,
            'pending'
          )
        `
        written.resolve()
        await mayCommit.promise
      })
      await written.promise

      const pending = bulkDelete({ ids: [first, second] }).then(
        (response) => response,
      )
      await untilSomeoneWaits(client)
      mayCommit.resolve()
      await entry
      const response = await pending

      expectProblem(response, notAllowed)
      expect(
        (await rowsOf([first, second])).map(({ deletedAt }) => deletedAt),
      ).toEqual([null, null])
    })

    it('makes a bulk update wait for a delete of one of its customers, and then answers 404', async () => {
      const [first, second] = [await stored(), await stored()]
      const client = getTestDbClient()
      const deleted = Promise.withResolvers<void>()
      const mayCommit = Promise.withResolvers<void>()
      // A delete of the second customer holds its row and has not committed.
      const removal = client.begin(async (tx) => {
        await tx`SELECT id FROM customers WHERE id = ${second} FOR UPDATE`
        await tx`UPDATE customers SET "deletedAt" = now() WHERE id = ${second}`
        deleted.resolve()
        await mayCommit.promise
      })
      await deleted.promise

      const pending = bulkUpdate({
        items: [
          { id: first, updates: { notes: 'changed' } },
          { id: second, updates: { notes: 'changed' } },
        ],
      }).then((response) => response)
      await untilSomeoneWaits(client)
      mayCommit.resolve()
      await removal
      const response = await pending

      expectProblem(response, notFound)
      expect((await rowsOf([first]))[0]?.notes).toBeNull()
    })
  })

  describe('CustomerRepository', () => {
    const repository = () => new CustomerRepository(db)
    const customerId = (id: string) => customerIdSchema.parse(id)

    it('finds no deleted customer by its ID', async () => {
      const there = await stored()
      const deleted = await stored({ deletedAt: '2026-11-01T00:00:00Z' })

      const result = await repository().findByIds([
        customerId(there),
        customerId(deleted),
      ])

      expect(
        result.type === 'success' && result.data.map(({ id }) => id),
      ).toEqual([there])
    })

    it.each<[string, (repository: CustomerRepository) => Promise<unknown>]>([
      ['findByIds', (r) => r.findByIds([customerId(UNKNOWN_ID)])],
      [
        'updateMany',
        (r) =>
          r.updateMany([
            { id: customerId(UNKNOWN_ID), changes: { notes: null } },
          ]),
      ],
      ['deleteMany', (r) => r.deleteMany([customerId(UNKNOWN_ID)])],
    ])(
      'resolves %s to a database error when the database does not answer',
      async (_method, call) => {
        const connection = connectUnreachableDatabase()

        const result = await call(new CustomerRepository(connection.database))
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database' },
        })
      },
    )
  })
})
