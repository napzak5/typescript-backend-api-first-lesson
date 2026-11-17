import { randomUUID } from 'node:crypto'
import {
  customers,
  customerVersions,
  users,
} from '@beauty-salon-backend/database'
import {
  customerIdSchema,
  customerVersionIdSchema,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import {
  CustomerRepository,
  CustomerVersionRepository,
} from '@beauty-salon-backend/infrastructure'
import { asc, eq, sql } from 'drizzle-orm'
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
} from './_shared/auth-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  getTestDbClient,
  ISO_TIMESTAMP,
  request,
  UUID,
} from './_shared/test-helpers'

const CUSTOMERS = '/api/v1/customers'

/** A UUID that no customer and no version has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
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

/** The values of the ledger: what a version keeps of a customer. */
const LEDGER = [
  'firstName',
  'lastName',
  'firstNameKana',
  'lastNameKana',
  'email',
  'phoneNumber',
  'alternativePhone',
  'postalCode',
  'prefecture',
  'city',
  'address',
  'building',
  'birthDate',
  'gender',
  'occupation',
  'membershipTier',
  'preferences',
  'notes',
  'internalNotes',
  'tags',
  'referredBy',
  'referralCode',
  'allowMarketing',
  'allowSms',
  'allowEmail',
  'isActive',
  'hairType',
  'hairThickness',
  'scalpCondition',
  'customerStatus',
]

/** A request that satisfies every rule, with a value for every property. */
const customerRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Hanako',
  lastName: 'Yamada',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: '03-1234-5678',
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: 'Aoyama Tower 5F',
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: 'Designer',
  membershipTier: 'gold',
  preferences: {
    preferredServices: ['cut', 'color'],
    notes: 'Prefers a seat by the window',
  },
  notes: 'Likes to talk about films',
  internalNotes: 'Pays in cash',
  tags: ['vip', 'color'],
  referredBy: null,
  referralCode: 'HANAKO2026',
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: 'medium',
  scalpCondition: 'sensitive',
  customerStatus: 'vip',
  ...overrides,
})

/** A profile as a customer writes it. */
const profileRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Hanako',
  lastName: 'Yamada',
  firstNameKana: null,
  lastNameKana: null,
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
  preferences: null,
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  ...overrides,
})

/** The values of the ledger of a customer as the API returns it. */
const ledgerOf = (customer: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(LEDGER.map((name) => [name, customer[name]]))

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('Customer history, versions and restore API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin, and the admin's user. */
  let asAdmin: string
  let adminId: string
  let salonId: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    const admin = await signedInUser(app, db, { role: 'admin' })
    asAdmin = admin.authorization
    adminId = admin.id
    salonId = await insertSalon(db)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const create = (body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(CUSTOMERS), as).send(body)
  const update = (id: string, body: object, as: string | null = asAdmin) =>
    authorized(request(app).patch(`${CUSTOMERS}/${id}`), as).send(body)
  const remove = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).delete(`${CUSTOMERS}/${id}`), as)
  const restore = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).post(`${CUSTOMERS}/${id}/restore`), as)
  const history = (
    id: string,
    query: Record<string, string> = {},
    as: string | null = asAdmin,
  ) =>
    authorized(request(app).get(`${CUSTOMERS}/${id}/history`).query(query), as)
  const version = (id: string, number: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${CUSTOMERS}/${id}/versions/${number}`), as)

  /** A customer created through the API, by the admin; returns it as the API does. */
  const created = async (
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> & { id: string; updatedAt: string }> => {
    const response = await create(
      customerRequest({
        email: `customer-${randomUUID()}@example.com`,
        referralCode: null,
        ...overrides,
      }),
    )
    if (response.status !== 201) {
      throw new Error(`Expected 201, got ${response.status}`)
    }
    return response.body.data
  }

  /** A customer created through the API and then deleted; returns its ID. */
  const deletedCustomer = async (
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const { id } = await created(overrides)
    const response = await remove(id)
    if (response.status !== 204) {
      throw new Error(`Expected 204, got ${response.status}`)
    }
    return id
  }

  /** The versions of a customer as they are stored, oldest first. */
  const versionsOf = (customerId: string) =>
    db
      .select()
      .from(customerVersions)
      .where(eq(customerVersions.customerId, customerId))
      .orderBy(asc(customerVersions.version))

  /** Which write each version of a customer was, oldest first, with its writer. */
  const writesOf = async (customerId: string): Promise<string[]> =>
    (await versionsOf(customerId)).map(
      ({ version, operation, changedBy }) =>
        `${version} ${operation} ${changedBy === adminId ? 'admin' : changedBy}`,
    )

  /** Every version, to tell that nothing was written. */
  const everyVersion = () =>
    db.select().from(customerVersions).orderBy(asc(customerVersions.id))

  const storedCustomer = async (id: string) => {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
    return customer
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
    ): SignInAs =>
    async () => {
      const { email } = await insertMember(db, role, await salonOf())
      return (await signIn(app, email)).authorization
    }

  /** Who may: those who may delete a customer. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of a salon', member('owner')],
    ['a manager of a salon', member('manager')],
    ['a manager of another salon', member('manager', () => insertSalon(db))],
  ]

  /** Who may not, although some of them keep the ledger. */
  const outsiders: [string, SignInAs][] = [
    ['a staff member of a salon', member('staff')],
    [
      'a customer account with a profile',
      async () =>
        (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
          .authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
  ]

  /** Tokens that every operation refuses, before anything else is looked at. */
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

  /** Every operation, as a request that would succeed for an administrator. */
  const operations: ((as: string | null, id: string) => Promise<Response>)[] = [
    async (as, id) => history(id, {}, as),
    async (as, id) => version(id, '1', as),
    async (as, id) => restore(id, as),
  ]

  describe('the versions every write of the ledger keeps', () => {
    it('keeps a version of each create, update, delete and restore, by the user who wrote it, at the moment of the write, with the values of the ledger after it', async () => {
      const customer = await created()
      const changed = await update(customer.id, {
        notes: null,
        tags: ['vip'],
      })
      await remove(customer.id)
      const restored = await restore(customer.id)

      const versions = await versionsOf(customer.id)
      expect(await writesOf(customer.id)).toEqual([
        '1 create admin',
        '2 update admin',
        '3 delete admin',
        '4 restore admin',
      ])
      const stored = await storedCustomer(customer.id)
      expect(versions[0]).toMatchObject({
        ...ledgerOf(customer),
        changedAt: expect.any(String),
      })
      expect(new Date(versions[0]?.changedAt ?? '').toISOString()).toBe(
        customer.updatedAt,
      )
      expect(versions[1]).toMatchObject(ledgerOf(changed.body.data))
      expect(new Date(versions[1]?.changedAt ?? '').toISOString()).toBe(
        changed.body.data.updatedAt,
      )
      expect(versions[2]).toMatchObject(ledgerOf(changed.body.data))
      expect(versions[3]).toMatchObject(ledgerOf(restored.body.data))
      expect(versions[3]?.changedAt).toBe(stored?.updatedAt)
    })

    it('keeps one version of each customer a bulk create, update and delete writes', async () => {
      const createdInBulk = await request(app)
        .post(`${CUSTOMERS}/bulk`)
        .set('Authorization', asAdmin)
        .send({
          items: [
            customerRequest({ email: 'first@example.com', referralCode: null }),
            customerRequest({
              email: 'second@example.com',
              referralCode: null,
            }),
          ],
        })
      const [first, second] = createdInBulk.body.data.created
      await request(app)
        .patch(`${CUSTOMERS}/bulk`)
        .set('Authorization', asAdmin)
        .send({
          items: [
            { id: first, updates: { notes: 'one' } },
            { id: second, updates: { notes: 'two' } },
          ],
        })
      await request(app)
        .delete(`${CUSTOMERS}/bulk`)
        .set('Authorization', asAdmin)
        .send({ ids: [second, first] })

      for (const [id, notes] of [
        [first, 'one'],
        [second, 'two'],
      ]) {
        expect(await writesOf(id)).toEqual([
          '1 create admin',
          '2 update admin',
          '3 delete admin',
        ])
        expect((await versionsOf(id))[1]).toMatchObject({ notes })
      }
    })

    it('keeps the versions the customer writes of their own profile: a create, a take of the ledger entry of their email, and an update', async () => {
      const newcomer = await signedInUser(app, db)
      await request(app)
        .post(`${CUSTOMERS}/me`)
        .set('Authorization', newcomer.authorization)
        .send(profileRequest())
      const regular = await signedInUser(app, db)
      const entry = await created({ email: regular.email })
      await request(app)
        .post(`${CUSTOMERS}/me`)
        .set('Authorization', regular.authorization)
        .send(profileRequest({ firstName: 'Mika' }))
      await request(app)
        .patch(`${CUSTOMERS}/me`)
        .set('Authorization', regular.authorization)
        .send({ lastName: 'Sato' })

      const [profile] = await db
        .select({ customerId: users.customerId })
        .from(users)
        .where(eq(users.id, newcomer.id))
      expect(await writesOf(profile?.customerId ?? '')).toEqual([
        `1 create ${newcomer.id}`,
      ])
      expect(await writesOf(entry.id)).toEqual([
        '1 create admin',
        `2 update ${regular.id}`,
        `3 update ${regular.id}`,
      ])
      expect(await versionsOf(entry.id)).toMatchObject([
        { firstName: 'Hanako', lastName: 'Yamada' },
        { firstName: 'Mika', lastName: 'Yamada' },
        { firstName: 'Mika', lastName: 'Sato' },
      ])
    })

    it('keeps no version of a write that is refused', async () => {
      const customer = await created({ email: 'taken@example.com' })
      const before = await everyVersion()

      const responses = [
        await create(customerRequest({ email: 'taken@example.com' })),
        await update(customer.id, { firstName: '' }),
        await update(UNKNOWN_ID, { notes: 'x' }),
        await remove(UNKNOWN_ID),
        await restore(customer.id),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '409 3002',
        '400 2001',
        '404 3001',
        '404 3001',
        '409 3003',
      ])
      expect(await everyVersion()).toEqual(before)
    })
  })

  describe('GET /api/v1/customers/:id/history', () => {
    it('lists the versions newest first as the contract has them, and tells of an update what changed', async () => {
      const customer = await created()
      await update(customer.id, {
        email: 'hanako@example.com',
        birthDate: null,
        tags: ['vip'],
      })
      await remove(customer.id)
      const [one, two, three] = await versionsOf(customer.id)

      const response = await history(customer.id)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [
          {
            id: three?.id,
            customerId: customer.id,
            version: 3,
            operation: 'delete',
            changedBy: adminId,
            changedAt: expect.stringMatching(ISO_TIMESTAMP),
            changes: null,
          },
          {
            id: two?.id,
            customerId: customer.id,
            version: 2,
            operation: 'update',
            changedBy: adminId,
            changedAt: expect.stringMatching(ISO_TIMESTAMP),
            changes: [
              {
                field: 'email',
                oldValue: customer['email'],
                newValue: 'hanako@example.com',
              },
              { field: 'birthDate', oldValue: '1990-04-01', newValue: null },
              { field: 'tags', oldValue: ['vip', 'color'], newValue: ['vip'] },
            ],
          },
          {
            id: one?.id,
            customerId: customer.id,
            version: 1,
            operation: 'create',
            changedBy: adminId,
            changedAt: customer.updatedAt,
            changes: null,
          },
        ],
        meta: {
          total: 3,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: `${CUSTOMERS}/${customer.id}/history`,
          first: `${CUSTOMERS}/${customer.id}/history`,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('tells of an update that wrote the values it found that nothing changed', async () => {
      const customer = await created()
      await update(customer.id, { notes: customer['notes'] })

      const response = await history(customer.id, { limit: '1' })

      expect(response.body.data[0]).toMatchObject({
        operation: 'update',
        changes: [],
      })
    })

    it('pages from the newest, one page after another, and ends with what is left', async () => {
      const customer = await created()
      for (const notes of ['a', 'b', 'c', 'd']) {
        await update(customer.id, { notes })
      }
      const ids = (await versionsOf(customer.id)).map(({ id }) => id).reverse()

      const first = await history(customer.id, { limit: '2' })
      const second = await history(customer.id, {
        limit: '2',
        cursor: first.body.meta.nextCursor,
      })
      const last = await history(customer.id, {
        limit: '2',
        cursor: second.body.meta.nextCursor,
      })

      const idsOf = (response: Response) =>
        response.body.data.map(({ id }: { id: string }) => id)
      expect([idsOf(first), idsOf(second), idsOf(last)]).toEqual([
        ids.slice(0, 2),
        ids.slice(2, 4),
        ids.slice(4),
      ])
      expect(first.body.meta).toMatchObject({
        total: 5,
        hasMore: true,
        nextCursor: ids[1],
      })
      expect(last.body.meta).toMatchObject({ hasMore: false, nextCursor: null })
    })

    it('gives 20 a page unless the query says otherwise', async () => {
      const customer = await created()
      for (let index = 0; index < 20; index += 1) {
        await update(customer.id, { notes: `note ${index}` })
      }

      const response = await history(customer.id)

      expect(response.body.data).toHaveLength(20)
      expect(response.body.meta).toMatchObject({
        total: 21,
        limit: 20,
        hasMore: true,
      })
    })

    it('reads the history of a deleted customer, and answers an empty page for a customer whose versions were never kept', async () => {
      const deleted = await deletedCustomer()
      const unkept = await insertCustomer(db)

      const ofDeleted = await history(deleted)
      const ofUnkept = await history(unkept)

      expect(ofDeleted.status).toBe(200)
      expect(ofDeleted.body.meta).toMatchObject({ total: 2 })
      expect(ofUnkept.status).toBe(200)
      expect(ofUnkept.body.data).toEqual([])
      expect(ofUnkept.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    it('answers 404 for a customer that is not there', async () => {
      const response = await history(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${UNKNOWN_ID} was not found`)
    })

    it.each<[string, Record<string, string>, string[]]>([
      ['a limit of 0', { limit: '0' }, ['limit:too_small']],
      ['a limit of 101', { limit: '101' }, ['limit:too_big']],
      [
        'a limit that is not a number',
        { limit: 'ten' },
        ['limit:invalid_format'],
      ],
      [
        'a cursor that is no UUID',
        { cursor: 'next' },
        ['cursor:invalid_format'],
      ],
      [
        'a parameter it does not know',
        { page: '2' },
        ['page:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, rules) => {
      const customer = await created()

      const response = await history(customer.id, query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer history search')
      expect(brokenRules(response)).toEqual(rules)
    })

    it('refuses a cursor that names no version of the customer: one of another customer, or none at all', async () => {
      const customer = await created()
      const other = await created()
      const [ofOther] = await versionsOf(other.id)

      const responses = [
        await history(customer.id, { cursor: ofOther?.id ?? '' }),
        await history(customer.id, { cursor: UNKNOWN_ID }),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['cursor:not_found'])
      }
    })

    it('refuses a customer ID that is no UUID before the query, and an unknown customer only after the query', async () => {
      const malformed = await history('customer-1', { limit: 'ten' })
      const unknown = await history(UNKNOWN_ID, { limit: '0' })

      expectProblem(malformed, badRequest)
      expect(brokenRules(malformed)).toEqual(['id:invalid_format'])
      expect(brokenRules(unknown)).toEqual(['limit:too_small'])
    })

    it('links the pages under the path it was asked by, with the query it was asked with', async () => {
      const customer = await created()
      await update(customer.id, { notes: 'a' })
      await update(customer.id, { notes: 'b' })
      const ids = (await versionsOf(customer.id)).map(({ id }) => id).reverse()
      const path = `/API/V1/CUSTOMERS/${customer.id.toUpperCase()}/history`

      const response = await request(app)
        .get(`${path}?limit=1&cursor=${ids[0]?.toUpperCase()}`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        ids[1],
      ])
      expect(response.body.links).toEqual({
        self: `${path}?limit=1&cursor=${ids[0]}`,
        first: `${path}?limit=1`,
        last: null,
        next: `${path}?limit=1&cursor=${ids[1]}`,
        prev: null,
      })
    })

    it('answers 500 for a stored version that does not match the model', async () => {
      const customer = await created()
      await db.execute(
        sql`UPDATE customer_versions SET preferences = '{"preferredServices": "cut"}'::jsonb WHERE "customerId" = ${customer.id}`,
      )

      expectProblem(await history(customer.id), databaseProblem)
    })
  })

  describe('GET /api/v1/customers/:id/versions/:version', () => {
    it('answers the values of the ledger of the version as the contract has them, with links to it and to the history', async () => {
      const customer = await created()
      await update(customer.id, { notes: 'changed', customerStatus: 'active' })
      const [first] = await versionsOf(customer.id)

      const response = await version(customer.id, '1')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          id: first?.id,
          customerId: customer.id,
          version: 1,
          operation: 'create',
          changedBy: adminId,
          changedAt: customer.updatedAt,
          ...ledgerOf(customer),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: {
          self: `${CUSTOMERS}/${customer.id}/versions/1`,
          history: `${CUSTOMERS}/${customer.id}/history`,
        },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(
        [
          'id',
          'customerId',
          'version',
          'operation',
          'changedBy',
          'changedAt',
          ...LEDGER,
        ].toSorted(),
      )
    })

    it('reads a version of a deleted customer, and the baseline of a customer from before versions were kept', async () => {
      const deleted = await deletedCustomer()
      const unkept = await insertCustomer(db)
      await db.execute(sql`
        INSERT INTO customer_versions (
          "customerId", version, operation, "changedBy", "firstName",
          "lastName", email, "phoneNumber", "membershipTier", tags,
          "allowMarketing", "allowSms", "allowEmail", "isActive",
          "customerStatus"
        )
        SELECT id, 1, 'baseline', NULL, "firstName", "lastName", email,
          "phoneNumber", "membershipTier", tags, "allowMarketing", "allowSms",
          "allowEmail", "isActive", "customerStatus"
        FROM customers WHERE id = ${unkept}
      `)

      const ofDeleted = await version(deleted, '2')
      const baseline = await version(unkept, '1')

      expect(ofDeleted.body.data).toMatchObject({ operation: 'delete' })
      expect(baseline.body.data).toMatchObject({
        operation: 'baseline',
        changedBy: null,
        firstName: 'Taro',
      })
    })

    it('answers 404 for a customer that is not there, and for a number the customer has no version of', async () => {
      const customer = await created()

      const unknown = await version(UNKNOWN_ID, '1')
      const beyond = await version(customer.id, '2')

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Customer ${UNKNOWN_ID} was not found`)
      expectProblem(beyond, notFound)
      expect(beyond.body.detail).toBe(
        `Version 2 of customer ${customer.id} was not found`,
      )
    })

    it.each<[string, string, string[]]>([
      ['a word', 'first', ['version:invalid_format']],
      ['a negative number', '-1', ['version:invalid_format']],
      ['a fraction', '1.5', ['version:invalid_format']],
      ['0', '0', ['version:too_small']],
      ['a number beyond an int32', '2147483648', ['version:too_big']],
    ])('refuses %s as the number', async (_case, number, rules) => {
      const customer = await created()

      const response = await version(customer.id, number)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer version')
      expect(brokenRules(response)).toEqual(rules)
    })

    it('refuses a customer ID that is no UUID before the number', async () => {
      const response = await version('customer-1', 'first')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('takes a customer ID in upper case, and links under the path it was asked by', async () => {
      const customer = await created()
      const path = `/API/V1/CUSTOMERS/${customer.id.toUpperCase()}`

      const response = await request(app)
        .get(`${path}/versions/1`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.customerId).toBe(customer.id)
      expect(response.body.links).toEqual({
        self: `${path}/versions/1`,
        history: `${path}/history`,
      })
    })

    it('answers 500 for a stored version that does not match the model', async () => {
      const customer = await created()
      await db.execute(
        sql`UPDATE customer_versions SET preferences = '{"preferredServices": "cut"}'::jsonb WHERE "customerId" = ${customer.id}`,
      )

      expectProblem(await version(customer.id, '1'), databaseProblem)
    })
  })

  describe('POST /api/v1/customers/:id/restore', () => {
    it('brings the deleted customer back to the ledger and answers it as the contract has it', async () => {
      const id = await deletedCustomer()

      const response = await restore(id)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: expect.objectContaining({
          id,
          userId: null,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        }),
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: expect.any(String),
        },
        links: { self: `${CUSTOMERS}/${id}`, list: CUSTOMERS },
      })
      expect(response.body.data).not.toHaveProperty('deletedAt')
      expect(await storedCustomer(id)).toMatchObject({ deletedAt: null })
      const read = await request(app)
        .get(`${CUSTOMERS}/${id}`)
        .set('Authorization', asAdmin)
      expect(read.status).toBe(200)
      expect(read.body.data).toEqual(response.body.data)
    })

    it.each(keepers)('lets %s restore a customer', async (_who, signInAs) => {
      const id = await deletedCustomer()

      const response = await restore(id, await signInAs())

      expect(response.status).toBe(200)
    })

    it('answers 409 for a customer who is not deleted, and changes nothing', async () => {
      const customer = await created()
      const before = await storedCustomer(customer.id)

      const response = await restore(customer.id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        `Customer ${customer.id} is not deleted, so there is nothing to restore`,
      )
      expect(await storedCustomer(customer.id)).toEqual(before)
    })

    it('answers 404 for a customer that is not there', async () => {
      const response = await restore(UNKNOWN_ID)

      expectProblem(response, notFound)
    })

    it('answers 409 when another customer has taken the email since, and keeps the customer deleted', async () => {
      const id = await deletedCustomer({ email: 'hanako@example.com' })
      await created({ email: 'hanako@example.com' })

      const response = await restore(id)

      expectProblem(response, alreadyExists)
      expect(response.body.detail).toContain('email')
      expect((await storedCustomer(id))?.deletedAt).not.toBeNull()
      expect(await writesOf(id)).toEqual(['1 create admin', '2 delete admin'])
    })

    it('restores a customer without the account it was the profile of, which takes it again by creating its profile', async () => {
      const owner = await signedInUser(app, db)
      const profile = await request(app)
        .post(`${CUSTOMERS}/me`)
        .set('Authorization', owner.authorization)
        .send(profileRequest())
      const id = profile.body.data.id
      await remove(id)

      const restored = await restore(id)
      const [link] = await db
        .select({ customerId: users.customerId })
        .from(users)
        .where(eq(users.id, owner.id))
      const taken = await request(app)
        .post(`${CUSTOMERS}/me`)
        .set('Authorization', owner.authorization)
        .send(profileRequest({ lastName: 'Sato' }))

      expect(restored.body.data.userId).toBeNull()
      expect(link?.customerId).toBeNull()
      expect(taken.status).toBe(201)
      expect(taken.body.data.id).toBe(id)
      expect((await storedCustomer(id))?.userId).toBe(owner.id)
      expect(await writesOf(id)).toEqual([
        `1 create ${owner.id}`,
        '2 delete admin',
        '3 restore admin',
        `4 update ${owner.id}`,
      ])
    })

    it('refuses a customer ID that is no UUID', async () => {
      const response = await restore('customer-1')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('takes a customer ID in upper case, and links under the path it was asked by', async () => {
      const id = await deletedCustomer()

      const response = await request(app)
        .post(`/API/V1/CUSTOMERS/${id.toUpperCase()}/restore`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: `/API/V1/CUSTOMERS/${id}`,
        list: '/API/V1/CUSTOMERS',
      })
    })
  })

  describe('who may', () => {
    it.each(outsiders)(
      'refuses %s every operation, and changes nothing',
      async (_who, signInAs) => {
        const id = await deletedCustomer()
        const authorization = await signInAs()
        const before = await everyVersion()

        const responses: Response[] = []
        for (const call of operations) {
          responses.push(await call(authorization, id))
        }

        expect(responses.map(statusAndCode)).toEqual([
          '403 1005',
          '403 1005',
          '403 1005',
        ])
        expect(await everyVersion()).toEqual(before)
        expect((await storedCustomer(id))?.deletedAt).not.toBeNull()
      },
    )

    it('refuses an outsider before it looks at the request', async () => {
      const authorization = await member('staff')()

      const responses = [
        await history('customer-1', { limit: 'ten' }, authorization),
        await version('customer-1', 'first', authorization),
        await restore('customer-1', authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it.each(keepers)(
      'lets %s read the history and a version',
      async (_who, signInAs) => {
        const customer = await created()
        const authorization = await signInAs()

        const responses = [
          await history(customer.id, {}, authorization),
          await version(customer.id, '1', authorization),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      },
    )

    it.each(unauthenticated)(
      'refuses %s every operation with 401, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const id = await deletedCustomer()
        const token = await tokenOf()
        const before = await everyVersion()

        for (const call of operations) {
          const response = await call(token, id)
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everyVersion()).toEqual(before)
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['POST on the history', 'post', '/history'],
      ['DELETE on the history', 'delete', '/history'],
      ['PUT on a version', 'put', '/versions/1'],
      ['DELETE on a version', 'delete', '/versions/1'],
      ['GET on the versions', 'get', '/versions'],
      ['GET on the restore', 'get', '/restore'],
      ['PATCH on the restore', 'patch', '/restore'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await deletedCustomer()
        const before = await everyVersion()

        const response = await request(app)
          [method](`${CUSTOMERS}/${id}${suffix}`)
          .set('Authorization', asAdmin)
          .send({ notes: '変更' })

        expectProblem(response, routeNotFound)
        expect(await everyVersion()).toEqual(before)
        expect((await storedCustomer(id))?.deletedAt).not.toBeNull()
      },
    )
  })

  describe('requests at the same moment', () => {
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

    it('numbers the versions of changes that arrive together one after another, without a gap or a repeat, and the last is what the customer holds', async () => {
      const customer = await created()

      const responses = await Promise.all(
        ['a', 'b', 'c', 'd', 'e'].map((notes) =>
          update(customer.id, { notes }),
        ),
      )

      expect(responses.map(statusAndCode)).toEqual(
        Array.from({ length: 5 }, () => '200'),
      )
      const versions = await versionsOf(customer.id)
      expect(versions.map(({ version }) => version)).toEqual([1, 2, 3, 4, 5, 6])
      expect(versions.at(-1)?.notes).toBe(
        (await storedCustomer(customer.id))?.notes,
      )
      expect(
        versions.map(({ changedAt }) => new Date(changedAt).getTime()),
      ).toEqual(
        versions
          .map(({ changedAt }) => new Date(changedAt).getTime())
          .toSorted((left, right) => left - right),
      )
    })

    it('lets one of two restores that arrive together restore the customer, and answers the other with 409', async () => {
      const id = await deletedCustomer()

      const responses = await Promise.all([restore(id), restore(id)])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
      ])
      expect(await writesOf(id)).toEqual([
        '1 create admin',
        '2 delete admin',
        '3 restore admin',
      ])
    })

    /**
     * Holds the row of a customer as another writer does, sends the request
     * meanwhile, and lets the row go once the request waits for it. Tells
     * the clock of the database just before the row was let go.
     */
    const whileHeld = async (
      id: string,
      send: () => Promise<Response>,
    ): Promise<{ response: Response; letGoAt: number }> => {
      const client = getTestDbClient()
      const held = Promise.withResolvers<void>()
      const mayCommit = Promise.withResolvers<void>()
      const holder = client.begin(async (tx) => {
        await tx`SELECT id FROM customers WHERE id = ${id} FOR UPDATE`
        held.resolve()
        await mayCommit.promise
      })
      await held.promise

      const pending = send().then((response) => response)
      await untilSomeoneWaits(client)
      const [moment] = await client<{ ms: number }[]>`
        SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms
      `
      mayCommit.resolve()
      await holder
      return { response: await pending, letGoAt: Math.floor(moment?.ms ?? 0) }
    }

    /** When the customer was last written, as the API tells it, in milliseconds. */
    const writtenAt = async (id: string): Promise<number> =>
      new Date(
        (
          await request(app)
            .get(`${CUSTOMERS}/${id}`)
            .set('Authorization', asAdmin)
        ).body.data.updatedAt,
      ).getTime()

    /** The version a write kept last is at the time the write gave the customer. */
    const expectLastVersionAtTheWrite = async (
      id: string,
      operation: string,
    ): Promise<void> => {
      const last = (await versionsOf(id)).at(-1)
      expect(last?.operation).toBe(operation)
      expect(last?.changedAt).toBe((await storedCustomer(id))?.updatedAt)
    }

    it('makes a change wait for a change of the customer in progress, and stamps it, and its version, with the moment it is let through', async () => {
      const { id } = await created()

      const { response, letGoAt } = await whileHeld(id, () =>
        update(id, { notes: 'after the wait' }),
      )

      expect(response.status).toBe(200)
      expect(await writtenAt(id)).toBeGreaterThanOrEqual(letGoAt)
      await expectLastVersionAtTheWrite(id, 'update')
    })

    it('makes a bulk update wait for a change of one of its customers in progress, and stamps it with the moment it is let through', async () => {
      const { id } = await created()

      const { response, letGoAt } = await whileHeld(id, () =>
        request(app)
          .patch(`${CUSTOMERS}/bulk`)
          .set('Authorization', asAdmin)
          .send({ items: [{ id, updates: { notes: 'after the wait' } }] }),
      )

      expect(response.status).toBe(200)
      expect(await writtenAt(id)).toBeGreaterThanOrEqual(letGoAt)
      await expectLastVersionAtTheWrite(id, 'update')
    })

    it('makes a profile that takes the entry of its email wait for a change of the entry in progress, and stamps it with the moment it is let through', async () => {
      const owner = await signedInUser(app, db)
      const { id } = await created({ email: owner.email })

      const { response, letGoAt } = await whileHeld(id, () =>
        request(app)
          .post(`${CUSTOMERS}/me`)
          .set('Authorization', owner.authorization)
          .send(profileRequest()),
      )

      expect(response.status).toBe(201)
      expect(response.body.data.id).toBe(id)
      expect(await writtenAt(id)).toBeGreaterThanOrEqual(letGoAt)
      await expectLastVersionAtTheWrite(id, 'update')
    })

    it('makes a restore wait for a change of the customer in progress, and restores it at the moment it is let through', async () => {
      const id = await deletedCustomer()

      const { response, letGoAt } = await whileHeld(id, () => restore(id))

      expect(response.status).toBe(200)
      expect(
        new Date(response.body.data.updatedAt).getTime(),
      ).toBeGreaterThanOrEqual(letGoAt)
      await expectLastVersionAtTheWrite(id, 'restore')
    })
  })

  describe('the repositories', () => {
    it('reads what the customer repository wrote, through the version repository', async () => {
      const writer = userIdSchema.parse(adminId)
      const customer = customerIdSchema.parse(await insertCustomer(db))
      const changes = await new CustomerRepository(db).update(
        customer,
        { notes: 'written' },
        writer,
      )
      expect(changes.type).toBe('success')

      const listed = await new CustomerVersionRepository(db).list({
        customerId: customer,
        limit: 1,
        after: null,
      })
      const found = await new CustomerVersionRepository(db).find(customer, 1)

      expect(listed).toMatchObject({
        type: 'success',
        data: {
          type: 'listed',
          versions: [
            {
              version: { version: 1, operation: 'update', notes: 'written' },
              previous: null,
            },
          ],
          total: 1,
          hasMore: false,
        },
      })
      expect(found).toMatchObject({
        type: 'success',
        data: { type: 'found', version: { changedBy: adminId } },
      })
    })

    it('tells the database could not be reached, for every method', async () => {
      const connection = connectUnreachableDatabase()
      const versions = new CustomerVersionRepository(connection.database)
      const ledger = new CustomerRepository(connection.database)
      const customer = customerIdSchema.parse(UNKNOWN_ID)

      const results = [
        await versions.list({
          customerId: customer,
          limit: 1,
          after: customerVersionIdSchema.parse(UNKNOWN_ID),
        }),
        await versions.find(customer, 1),
        await ledger.restore(customer, userIdSchema.parse(UNKNOWN_ID)),
      ]
      await connection.close()

      expect(
        results.map((result) =>
          result.type === 'error' && result.error.type === 'database'
            ? result.error.message
            : 'not an error',
        ),
      ).toEqual([
        'Failed to list customer versions',
        'Failed to find customer version',
        'Failed to restore customer',
      ])
    })
  })

  it('assigns version IDs that are UUIDs', async () => {
    const customer = await created()

    const [first] = await versionsOf(customer.id)

    expect(first?.id).toMatch(UUID)
  })
})
