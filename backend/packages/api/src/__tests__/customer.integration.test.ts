import { randomUUID } from 'node:crypto'
import { customers, users } from '@beauty-salon-backend/database'
import {
  type CustomerListCriteria,
  customerIdSchema,
  type DbNewCustomer,
  type DomainError,
} from '@beauty-salon-backend/domain'
import { CustomerRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
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

const CUSTOMERS = '/api/v1/customers'

/** A UUID that no customer has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** Another UUID that no customer has. */
const ANOTHER_UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const malformedBody = { status: 400, code: '2002', type: 'malformed-body' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const conflict = { status: 409, code: '3002', type: 'already-exists' }
const databaseProblem = { status: 500, code: '4003', type: 'database' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

/** A customer as the API returns it. */
type Customer = {
  id: string
  userId: string | null
  firstName: string
  lastName: string
  firstNameKana: string | null
  lastNameKana: string | null
  email: string
  phoneNumber: string
  alternativePhone: string | null
  postalCode: string | null
  prefecture: string | null
  city: string | null
  address: string | null
  building: string | null
  birthDate: string | null
  gender: string | null
  occupation: string | null
  membershipTier: string
  loyaltyPoints: number
  preferences: { preferredServices: string[]; notes: string | null } | null
  notes: string | null
  internalNotes: string | null
  tags: string[]
  referredBy: string | null
  referralCode: string | null
  allowMarketing: boolean
  allowSms: boolean
  allowEmail: boolean
  firstVisitDate: string | null
  lastVisitDate: string | null
  visitCount: number
  noShowCount: number
  cancellationCount: number
  isActive: boolean
  hairType: string | null
  hairThickness: string | null
  scalpCondition: string | null
  customerStatus: string
  createdAt: string
  updatedAt: string
}

/** Exactly the properties of CustomerResponse. */
const RESPONSE_PROPERTIES = [
  'id',
  'userId',
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
  'loyaltyPoints',
  'preferences',
  'notes',
  'internalNotes',
  'tags',
  'referredBy',
  'referralCode',
  'allowMarketing',
  'allowSms',
  'allowEmail',
  'firstVisitDate',
  'lastVisitDate',
  'visitCount',
  'noShowCount',
  'cancellationCount',
  'isActive',
  'hairType',
  'hairThickness',
  'scalpCondition',
  'customerStatus',
  'createdAt',
  'updatedAt',
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

/** What the server assigns to a new customer, apart from its ID and times. */
const assignedToNewCustomer = {
  userId: null,
  loyaltyPoints: 0,
  firstVisitDate: null,
  lastVisitDate: null,
  visitCount: 0,
  noShowCount: 0,
  cancellationCount: 0,
}

/** The properties that may be unset, all unset. */
const unset = {
  firstNameKana: null,
  lastNameKana: null,
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
  notes: null,
  internalNotes: null,
  referredBy: null,
  referralCode: null,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
}

/** IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a UUID with a character too many', `${UNKNOWN_ID}0`],
]

/** A response in a word: its status and, for a validation problem, the broken rules. */
const outcomeOf = (response: Response): string =>
  response.status === 400 && response.body.code === '2001'
    ? `400 ${brokenRules(response).join(',')}`
    : String(response.status)

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: Customer) => id)

/** The IDs in the order of the list: newest first, then the greater ID first. */
const newestFirst = (rows: { id: string; createdAt: string }[]): string[] =>
  rows
    .toSorted(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        (left.id < right.id ? 1 : -1),
    )
    .map(({ id }) => id)

describe('Customer API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** How many customers the test has created through the API. */
  let createdSoFar: number

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    createdSoFar = 0
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const list = (query = '', as: string | null = asAdmin) =>
    authorized(
      request(app).get(query === '' ? CUSTOMERS : `${CUSTOMERS}?${query}`),
      as,
    )

  const post = (body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(CUSTOMERS), as).send(body)

  const get = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${CUSTOMERS}/${id}`), as)

  const patch = (id: string, body: object, as: string | null = asAdmin) =>
    authorized(request(app).patch(`${CUSTOMERS}/${id}`), as).send(body)

  const remove = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).delete(`${CUSTOMERS}/${id}`), as)

  /**
   * Creates a customer through the API as the admin. The email and the
   * referral code are the test's own unless the overrides name them.
   */
  const createCustomer = async (
    overrides: Record<string, unknown> = {},
  ): Promise<Customer> => {
    createdSoFar += 1
    const response = await post(
      customerRequest({
        email: `customer-${createdSoFar}@example.com`,
        referralCode: `CODE-${createdSoFar}`,
        ...overrides,
      }),
    )
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Deletes a customer through the API as the admin. */
  const deleteCustomer = async (id: string): Promise<void> => {
    const response = await remove(id)
    expect(response.status).toBe(204)
  }

  /** Every stored customer, deleted or not, as its row. */
  const storedCustomers = () =>
    db.select().from(customers).orderBy(asc(customers.id))

  /** The stored row of one customer. */
  const storedCustomer = async (id: string) => {
    const [row] = await db.select().from(customers).where(eq(customers.id, id))
    if (row === undefined) {
      throw new Error(`No customer ${id} is stored`)
    }
    return row
  }

  /** How many customers that are not deleted have the email. */
  const liveCustomersWithEmail = (email: string) =>
    db.$count(
      customers,
      and(eq(customers.email, email), isNull(customers.deletedAt)),
    )

  /** Whether the stored `updatedAt` of the customer lies after its `createdAt`. */
  const hasMoved = async (id: string): Promise<boolean | undefined> => {
    const [row] = await db
      .select({
        moved: sql<boolean>`${customers.updatedAt} > ${customers.createdAt}`,
      })
      .from(customers)
      .where(eq(customers.id, id))
    return row?.moved
  }

  type NewCustomerRow = typeof customers.$inferInsert

  /** A customer as a row, inserted directly; returns its ID. */
  const insertCustomerRow = async (
    overrides: Partial<NewCustomerRow> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(customers)
      .values({
        firstName: 'Taro',
        lastName: 'Suzuki',
        email: `row-${randomUUID()}@example.com`,
        phoneNumber: '03-0000-0000',
        tags: [],
        ...overrides,
      })
      .returning({ id: customers.id })
    if (row === undefined) {
      throw new Error('No customer was inserted')
    }
    return row.id
  }

  /**
   * Five customers of the ledger, inserted directly a day apart, and a
   * deleted one that would come first. `all` lists them newest first.
   */
  const insertLedger = async () => {
    const percent = await insertCustomerRow({
      firstName: '100%',
      lastName: 'Kato_Ito',
      email: 'kato@example.com',
      phoneNumber: '0120-000-000',
      tags: ['vip', 'color', 'new'],
      customerStatus: 'vip',
      membershipTier: 'gold',
      createdAt: '2026-11-01T09:00:00.000Z',
    })
    const tanaka = await insertCustomerRow({
      firstName: 'Yuki',
      lastName: 'Tanaka',
      email: 'yuki@example.com',
      phoneNumber: '+81 90-1234-5679',
      tags: ['vip'],
      customerStatus: 'inactive',
      membershipTier: 'platinum',
      createdAt: '2026-11-02T09:00:00.000Z',
    })
    const sato = await insertCustomerRow({
      firstName: 'Jiro',
      lastName: 'Sato',
      email: 'tel090@example.com',
      phoneNumber: '080-1111-2222',
      tags: ['VIP'],
      customerStatus: 'blacklisted',
      membershipTier: 'gold',
      createdAt: '2026-11-03T09:00:00.000Z',
    })
    const suzuki = await insertCustomerRow({
      firstName: 'Taro',
      lastName: 'Suzuki',
      firstNameKana: 'タロウ',
      lastNameKana: 'スズキ',
      email: 'taro@example.com',
      phoneNumber: '03-5555-6666',
      alternativePhone: '090-1234-5678',
      tags: ['new'],
      customerStatus: 'active',
      membershipTier: 'regular',
      isActive: false,
      createdAt: '2026-11-04T09:00:00.000Z',
    })
    const yamada = await insertCustomerRow({
      firstName: 'Hanako',
      lastName: 'Yamada',
      firstNameKana: 'ハナコ',
      lastNameKana: 'ヤマダ',
      email: 'hanako@example.com',
      phoneNumber: '090-1234-5678',
      tags: ['vip', 'color'],
      customerStatus: 'vip',
      membershipTier: 'gold',
      createdAt: '2026-11-05T09:00:00.000Z',
    })
    const deleted = await insertCustomerRow({
      firstName: 'Hanako',
      lastName: 'Deleted',
      firstNameKana: 'ハナコ',
      email: 'hanako.deleted@example.com',
      phoneNumber: '090-1234-5678',
      tags: ['vip', 'color'],
      customerStatus: 'vip',
      membershipTier: 'gold',
      createdAt: '2026-11-06T09:00:00.000Z',
      deletedAt: '2026-11-07T09:00:00.000Z',
    })
    return {
      yamada,
      suzuki,
      sato,
      tanaka,
      percent,
      deleted,
      all: [yamada, suzuki, sato, tanaka, percent],
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

  describe('POST /api/v1/customers', () => {
    it('creates the customer, returns it with what the server assigned and stores it as returned', async () => {
      const body = customerRequest({ email: 'Hanako.Yamada@Example.COM' })

      const response = await post(body)

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const { data, meta, links } = response.body
      expect(data).toEqual({
        ...body,
        ...assignedToNewCustomer,
        email: 'hanako.yamada@example.com',
        id: expect.stringMatching(UUID),
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
        self: `${CUSTOMERS}/${data.id}`,
        list: CUSTOMERS,
      })
      expect(response.headers['location']).toBe(links.self)
      expect((await get(data.id)).body.data).toEqual(data)
      expect(await storedCustomer(data.id)).toMatchObject({
        email: 'hanako.yamada@example.com',
        deletedAt: null,
      })
    })

    it('stores null as it is given for every property that may be unset, and an empty list of tags', async () => {
      const body = customerRequest({ ...unset, tags: [] })

      const response = await post(body)

      expect(response.status).toBe(201)
      expect(response.body.data).toEqual({
        ...body,
        ...assignedToNewCustomer,
        id: response.body.data.id,
        createdAt: response.body.data.createdAt,
        updatedAt: response.body.data.updatedAt,
      })
      expect(await storedCustomer(response.body.data.id)).toMatchObject({
        ...unset,
        tags: [],
      })
    })

    it('stores preferences without services and without notes as they are given', async () => {
      const preferences = { preferredServices: [], notes: null }

      const created = await createCustomer({ preferences })

      expect(created.preferences).toEqual(preferences)
      expect((await storedCustomer(created.id)).preferences).toEqual(
        preferences,
      )
    })

    it('stores every combination of isActive and customerStatus as it is sent', async () => {
      const combinations = [true, false].flatMap((isActive) =>
        ['active', 'inactive', 'vip', 'blacklisted'].map((customerStatus) => ({
          isActive,
          customerStatus,
        })),
      )

      const created: Customer[] = []
      for (const combination of combinations) {
        created.push(await createCustomer(combination))
      }

      expect(
        created.map(({ isActive, customerStatus }) => ({
          isActive,
          customerStatus,
        })),
      ).toEqual(combinations)
    })

    it('lets two customers share a phone number and a name', async () => {
      const first = await createCustomer()

      const second = await post(
        customerRequest({
          email: 'another@example.com',
          referralCode: 'ANOTHER',
        }),
      )

      expect(second.status).toBe(201)
      expect(second.body.data).toMatchObject({
        firstName: first.firstName,
        lastName: first.lastName,
        phoneNumber: first.phoneNumber,
      })
      expect(await db.$count(customers)).toBe(2)
    })

    it('accepts a customer that is not deleted as the referrer', async () => {
      const referrer = await createCustomer()

      const response = await post(customerRequest({ referredBy: referrer.id }))

      expect(response.status).toBe(201)
      expect(response.body.data.referredBy).toBe(referrer.id)
    })

    it('accepts the earliest birth date, 1900-01-01', async () => {
      const response = await post(customerRequest({ birthDate: '1900-01-01' }))

      expect(response.status).toBe(201)
      expect(response.body.data.birthDate).toBe('1900-01-01')
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
        'a tier that does not exist',
        { membershipTier: 'diamond' },
        ['membershipTier:invalid_value'],
      ],
      ['a missing email', { email: undefined }, ['email:invalid_type']],
      ['null as the tags', { tags: null }, ['tags:invalid_type']],
      [
        'a property the server manages',
        { loyaltyPoints: 100 },
        ['loyaltyPoints:unrecognized_keys'],
      ],
      [
        'a property that does not exist',
        { salonId: UNKNOWN_ID },
        ['salonId:unrecognized_keys'],
      ],
      [
        'a blank tag and a repeated one',
        { tags: ['vip', ' ', 'vip'] },
        ['tags.1:invalid_format', 'tags.2:custom'],
      ],
      [
        'preferences without their properties',
        { preferences: {} },
        [
          'preferences.notes:invalid_type',
          'preferences.preferredServices:invalid_type',
        ],
      ],
      [
        'preferences with a service that does not exist and a property that does not exist',
        {
          preferences: {
            preferredServices: ['cut', 'nails'],
            notes: null,
            colour: 'red',
          },
        },
        [
          'preferences.colour:unrecognized_keys',
          'preferences.preferredServices.1:invalid_value',
        ],
      ],
      [
        'a phone number with letters and too few digits',
        { phoneNumber: '090-abcd-5678' },
        ['phoneNumber:custom', 'phoneNumber:invalid_format'],
      ],
      [
        'an email that is not an address',
        { email: 'hanako' },
        ['email:invalid_format'],
      ],
      [
        'a referrer that is not a UUID',
        { referredBy: 'hanako' },
        ['referredBy:invalid_format'],
      ],
      [
        'a birth date that does not exist',
        { birthDate: '2023-02-30' },
        ['birthDate:invalid_format'],
      ],
      [
        'a birth date before 1900',
        { birthDate: '1899-12-31' },
        ['birthDate:too_small'],
      ],
      [
        'a birth date in the future',
        { birthDate: '2999-01-01' },
        ['birthDate:too_big'],
      ],
    ])('rejects %s and stores nothing', async (_case, change, expected) => {
      const response = await post(customerRequest(change))

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected)
      expect(await db.$count(customers)).toBe(0)
    })

    it('reports several broken rules together', async () => {
      const response = await post(
        customerRequest({
          firstName: '',
          gender: 'unknown',
          allowSms: 'yes',
          id: UNKNOWN_ID,
        }),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual([
        'allowSms:invalid_type',
        'firstName:invalid_format',
        'gender:invalid_value',
        'id:unrecognized_keys',
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
      const asList = await post([customerRequest()])
      const text = await request(app)
        .post(CUSTOMERS)
        .set('Authorization', asAdmin)
        .set('Content-Type', 'application/json')
        .send('{"firstName": "Hanako"')

      expectProblem(asList, badRequest)
      expect(brokenRules(asList)).toEqual([':invalid_type'])
      expectProblem(text, malformedBody)
      expect(await db.$count(customers)).toBe(0)
    })

    it('rejects the email of a customer that is not deleted, also written in another case, and stores nothing', async () => {
      const existing = await createCustomer({ email: 'hanako@example.com' })

      const same = await post(
        customerRequest({ email: 'hanako@example.com', referralCode: null }),
      )
      const otherCase = await post(
        customerRequest({ email: 'HANAKO@Example.com', referralCode: null }),
      )

      for (const response of [same, otherCase]) {
        expectProblem(response, conflict)
        expect(response.body.detail).toBe(
          'Customer with email hanako@example.com already exists',
        )
      }
      expect((await storedCustomers()).map(({ id }) => id)).toEqual([
        existing.id,
      ])
    })

    it('accepts the email of a deleted customer', async () => {
      const deleted = await createCustomer({ email: 'hanako@example.com' })
      await deleteCustomer(deleted.id)

      const response = await post(
        customerRequest({ email: 'Hanako@Example.com', referralCode: null }),
      )

      expect(response.status).toBe(201)
      expect(response.body.data.email).toBe('hanako@example.com')
      expect(await liveCustomersWithEmail('hanako@example.com')).toBe(1)
    })

    it('rejects the referral code of any customer, deleted or not, and stores nothing', async () => {
      await createCustomer({ referralCode: 'LIVE' })
      const deleted = await createCustomer({ referralCode: 'GONE' })
      await deleteCustomer(deleted.id)

      const ofLive = await post(customerRequest({ referralCode: 'LIVE' }))
      const ofDeleted = await post(customerRequest({ referralCode: 'GONE' }))

      expectProblem(ofLive, conflict)
      expect(ofLive.body.detail).toBe(
        'Customer with referralCode LIVE already exists',
      )
      expectProblem(ofDeleted, conflict)
      expect(ofDeleted.body.detail).toBe(
        'Customer with referralCode GONE already exists',
      )
      expect(await db.$count(customers)).toBe(2)
    })

    it('refuses a referrer that no customer is, or that is deleted, as a broken rule of the referrer, and stores nothing', async () => {
      const deleted = await createCustomer()
      await deleteCustomer(deleted.id)

      const unknown = await post(customerRequest({ referredBy: UNKNOWN_ID }))
      const ofDeleted = await post(customerRequest({ referredBy: deleted.id }))

      for (const response of [unknown, ofDeleted]) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['referredBy:not_found'])
      }
      expect(await db.$count(customers)).toBe(1)
    })
  })

  describe('GET /api/v1/customers/:id', () => {
    it('returns the customer with its links', async () => {
      const created = await createCustomer()

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
          self: `${CUSTOMERS}/${created.id}`,
          list: CUSTOMERS,
        },
      })
    })

    it('returns the columns of a row with microseconds and a visit history in the representation of the API', async () => {
      const id = await insertCustomerRow({
        loyaltyPoints: 120,
        firstVisitDate: '2025-01-10',
        lastVisitDate: '2026-11-01',
        visitCount: 12,
        noShowCount: 1,
        cancellationCount: 2,
        createdAt: '2026-11-10 09:00:00.123456+09',
        updatedAt: '2026-11-11 00:00:00+00',
      })

      const response = await get(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id,
        loyaltyPoints: 120,
        firstVisitDate: '2025-01-10',
        lastVisitDate: '2026-11-01',
        visitCount: 12,
        noShowCount: 1,
        cancellationCount: 2,
        createdAt: '2026-11-10T00:00:00.123Z',
        updatedAt: '2026-11-11T00:00:00.000Z',
      })
    })

    it.each(malformedIds)('rejects %s as the ID', async (_case, id) => {
      const response = await get(id)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('reports an ID that no customer has as not found', async () => {
      await createCustomer()

      const response = await get(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${UNKNOWN_ID} was not found`)
    })

    it('reports a deleted customer as not found', async () => {
      const created = await createCustomer()
      await deleteCustomer(created.id)

      const response = await get(created.id)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${created.id} was not found`)
    })

    it('answers 500 without details when the stored customer has a time that is no instant', async () => {
      const created = await createCustomer()
      await db
        .update(customers)
        .set({ createdAt: 'infinity' })
        .where(eq(customers.id, created.id))

      const response = await get(created.id)

      expectProblem(response, databaseProblem)
      expect(response.body.detail).toBeNull()
      expect(JSON.stringify(response.body)).not.toContain('infinity')
    })
  })

  describe('GET /api/v1/customers', () => {
    it('returns an empty page when there are no customers', async () => {
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
          self: CUSTOMERS,
          first: CUSTOMERS,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('returns the customers that are not deleted, newest first, inactive ones and every status included', async () => {
      const first = await createCustomer({ customerStatus: 'blacklisted' })
      const deleted = await createCustomer()
      const second = await createCustomer({
        isActive: false,
        customerStatus: 'inactive',
      })
      const third = await createCustomer({ customerStatus: 'active' })
      await deleteCustomer(deleted.id)

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [third, second, first],
        meta: {
          total: 3,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: CUSTOMERS,
          first: CUSTOMERS,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('walks through the pages, returning every customer once and in order where customers share createdAt', async () => {
      const shared = '2026-11-10T00:00:00.000Z'
      const rows = [
        { createdAt: '2026-11-09T00:00:00.000Z' },
        { createdAt: shared },
        { createdAt: shared },
        { createdAt: '2026-11-11T00:00:00.000Z' },
        { createdAt: shared },
        { createdAt: shared },
        { createdAt: shared },
      ]
      const stored: { id: string; createdAt: string }[] = []
      for (const row of rows) {
        stored.push({ id: await insertCustomerRow(row), ...row })
      }
      const ids = newestFirst(stored)
      const firstPage = `${CUSTOMERS}?limit=2`

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

    it('walks through the customers with filters one at a time, keeping the query in every link and replacing only the cursor', async () => {
      const ledger = await insertLedger()
      const expected = [ledger.yamada, ledger.percent]
      const firstPage = `${CUSTOMERS}?tags=vip&tags=color&search=example&limit=1`

      const pages = await walk(firstPage)

      expect(pages.flatMap((page) => idsOf(page))).toEqual(expected)
      expect(pages.map((page) => page.body.meta.total)).toEqual([2, 2])
      expect(pages.map((page) => page.body.links.self)).toEqual([
        firstPage,
        `${firstPage}&cursor=${ledger.yamada}`,
      ])
      expect(pages.map((page) => page.body.links.first)).toEqual([
        firstPage,
        firstPage,
      ])
      expect(pages.at(-1)?.body.meta).toMatchObject({
        hasMore: false,
        nextCursor: null,
      })
    })

    it('says that no page follows a page that the last customers fill exactly', async () => {
      const ledger = await insertLedger()

      const whole = await list('limit=5')
      const rest = await list(`limit=3&cursor=${ledger.suzuki}`)

      expect(idsOf(whole)).toEqual(ledger.all)
      expect(whole.body.meta).toMatchObject({
        total: 5,
        hasMore: false,
        nextCursor: null,
      })
      expect(whole.body.links.next).toBeNull()
      expect(idsOf(rest)).toEqual(ledger.all.slice(2))
      expect(rest.body.meta).toMatchObject({
        total: 5,
        hasMore: false,
        nextCursor: null,
      })
      expect(rest.body.links.next).toBeNull()
    })

    it('gives pages of 20 customers unless another limit is asked for, and up to 100', async () => {
      for (let index = 0; index < 21; index += 1) {
        await insertCustomerRow()
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

    it('continues after a customer that was deleted since it ended a page: its row still says where the next page begins', async () => {
      const ledger = await insertLedger()
      const firstPage = await list('limit=2')
      expect(firstPage.body.meta.nextCursor).toBe(ledger.suzuki)
      await deleteCustomer(ledger.suzuki)

      const nextPage = await request(app)
        .get(firstPage.body.links.next)
        .set('Authorization', asAdmin)

      expect(nextPage.status).toBe(200)
      expect(idsOf(nextPage)).toEqual([ledger.sato, ledger.tanaka])
      expect(nextPage.body.meta).toEqual({
        total: 4,
        limit: 2,
        hasMore: true,
        cursor: ledger.suzuki,
        nextCursor: ledger.tanaka,
        prevCursor: null,
      })
    })

    it('starts the page after a cursor on a customer that the filters leave out', async () => {
      const ledger = await insertLedger()

      const response = await list(`customerStatus=vip&cursor=${ledger.suzuki}`)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([ledger.percent])
      expect(response.body.meta).toMatchObject({
        total: 2,
        hasMore: false,
        cursor: ledger.suzuki,
        nextCursor: null,
      })
    })

    it('refuses a cursor that names no customer as a broken rule of the cursor', async () => {
      await insertLedger()

      const response = await list(`cursor=${UNKNOWN_ID}`)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['cursor:not_found'])
    })

    it('finds the customers whose name, reading or email contains the keyword, ignoring case, and counts only them', async () => {
      const ledger = await insertLedger()
      const keywords = [
        'yamada',
        'HANAKO',
        'ヤマダ',
        'タロウ',
        'Sato',
        'TEL090@',
        'EXAMPLE.COM',
        'nobody',
      ]

      const found: Record<string, string[]> = {}
      const totals: Record<string, number> = {}
      for (const keyword of keywords) {
        const response = await list(`search=${encodeURIComponent(keyword)}`)
        expect(response.status).toBe(200)
        found[keyword] = idsOf(response)
        totals[keyword] = response.body.meta.total
      }

      expect(found).toEqual({
        yamada: [ledger.yamada],
        HANAKO: [ledger.yamada],
        ヤマダ: [ledger.yamada],
        タロウ: [ledger.suzuki],
        Sato: [ledger.sato],
        'TEL090@': [ledger.sato],
        'EXAMPLE.COM': ledger.all,
        nobody: [],
      })
      expect(totals).toEqual({
        yamada: 1,
        HANAKO: 1,
        ヤマダ: 1,
        タロウ: 1,
        Sato: 1,
        'TEL090@': 1,
        'EXAMPLE.COM': 5,
        nobody: 0,
      })
    })

    it('takes % and _ in a keyword as ordinary characters', async () => {
      const ledger = await insertLedger()

      const percent = await list(`search=${encodeURIComponent('%')}`)
      const underscore = await list('search=_')
      const both = await list(`search=${encodeURIComponent('o_I')}`)

      expect(idsOf(percent)).toEqual([ledger.percent])
      expect(idsOf(underscore)).toEqual([ledger.percent])
      expect(idsOf(both)).toEqual([ledger.percent])
      expect(percent.body.meta.total).toBe(1)
    })

    it('compares a keyword written like a phone number with the digits of the phone number, and with the text columns as well', async () => {
      const ledger = await insertLedger()
      const keywords = [
        '090-1234',
        '090 1234 5678',
        '09012345678',
        '(090)1234',
        '1234-5679',
        '+81 90',
        '090',
        '090-1234x',
        '5555-6666',
      ]

      const found: Record<string, string[]> = {}
      for (const keyword of keywords) {
        const response = await list(`search=${encodeURIComponent(keyword)}`)
        expect(response.status).toBe(200)
        found[keyword] = idsOf(response)
      }

      expect(found).toEqual({
        '090-1234': [ledger.yamada],
        '090 1234 5678': [ledger.yamada],
        '09012345678': [ledger.yamada],
        '(090)1234': [ledger.yamada],
        '1234-5679': [ledger.tanaka],
        '+81 90': [ledger.tanaka],
        '090': [ledger.yamada, ledger.sato],
        '090-1234x': [],
        '5555-6666': [ledger.suzuki],
      })
    })

    it('returns only the customers that have every given tag, compared exactly, and counts only them', async () => {
      const ledger = await insertLedger()

      const vip = await list('tags=vip')
      const vipAndColor = await list('tags=vip&tags=color')
      const upperCase = await list('tags=VIP')
      const part = await list('tags=vi')

      expect(idsOf(vip)).toEqual([ledger.yamada, ledger.tanaka, ledger.percent])
      expect(vip.body.meta.total).toBe(3)
      expect(idsOf(vipAndColor)).toEqual([ledger.yamada, ledger.percent])
      expect(vipAndColor.body.meta.total).toBe(2)
      expect(idsOf(upperCase)).toEqual([ledger.sato])
      expect(idsOf(part)).toEqual([])
      expect(part.body.meta.total).toBe(0)
    })

    it('stores, returns and matches tags with commas, quotes, braces and backslashes exactly as they are written', async () => {
      const written = ['a,b', 'say "hi"', '{x}', 'back\\slash']
      const special = await createCustomer({ tags: written })
      const plain = await createCustomer({ tags: ['a', 'b', 'x', 'slash'] })
      const byTag = (tag: string) => `tags=${encodeURIComponent(tag)}`

      const found: Record<string, string[]> = {}
      for (const query of [
        byTag('a,b'),
        `${byTag('a')}&${byTag('b')}`,
        byTag('say "hi"'),
        byTag('{x}'),
        byTag('x'),
        byTag('back\\slash'),
        written.map(byTag).join('&'),
      ]) {
        found[query] = idsOf(await list(query))
      }

      expect(special.tags).toEqual(written)
      expect((await storedCustomer(special.id)).tags).toEqual(written)
      expect(Object.values(found)).toEqual([
        [special.id],
        [plain.id],
        [special.id],
        [special.id],
        [plain.id],
        [special.id],
        [special.id],
      ])
    })

    it('returns only the customers of a status or of a tier, and combines every filter', async () => {
      const ledger = await insertLedger()

      const vip = await list('customerStatus=vip')
      const blacklisted = await list('customerStatus=blacklisted')
      const gold = await list('membershipTier=gold')
      const combined = await list(
        [
          'search=hanako',
          'tags=vip',
          'customerStatus=vip',
          'membershipTier=gold',
          'registeredFrom=2026-11-05T09:00:00Z',
          'registeredTo=2026-11-06T09:00:00Z',
        ].join('&'),
      )
      const contradicting = await list(
        'customerStatus=vip&membershipTier=platinum',
      )

      expect(idsOf(vip)).toEqual([ledger.yamada, ledger.percent])
      expect(vip.body.meta.total).toBe(2)
      expect(idsOf(blacklisted)).toEqual([ledger.sato])
      expect(idsOf(gold)).toEqual([ledger.yamada, ledger.sato, ledger.percent])
      expect(idsOf(combined)).toEqual([ledger.yamada])
      expect(combined.body.meta.total).toBe(1)
      expect(idsOf(contradicting)).toEqual([])
    })

    it('returns the customers registered from and until the given times, both included', async () => {
      const ledger = await insertLedger()

      const between = await list(
        'registeredFrom=2026-11-02T09:00:00Z&registeredTo=2026-11-04T09:00:00Z',
      )
      const from = await list('registeredFrom=2026-11-04T09:00:00.001Z')
      const until = await list('registeredTo=2026-11-01T09:00:00.000Z')

      expect(idsOf(between)).toEqual([
        ledger.suzuki,
        ledger.sato,
        ledger.tanaka,
      ])
      expect(between.body.meta.total).toBe(3)
      expect(idsOf(from)).toEqual([ledger.yamada])
      expect(idsOf(until)).toEqual([ledger.percent])
    })

    it('compares the registration time at the precision a response shows', async () => {
      const microseconds = await insertCustomerRow({
        createdAt: '2026-11-10 00:00:00.123456+00',
      })
      const lateInTheMillisecond = await insertCustomerRow({
        createdAt: '2026-11-10 00:00:01.123999+00',
      })
      const created = await createCustomer()
      const shown = [
        (await get(microseconds)).body.data.createdAt,
        (await get(lateInTheMillisecond)).body.data.createdAt,
        created.createdAt,
      ]

      const found: string[][] = []
      for (const createdAt of shown) {
        const at = encodeURIComponent(createdAt)
        found.push(
          idsOf(await list(`registeredTo=${at}`)),
          idsOf(await list(`registeredFrom=${at}&registeredTo=${at}`)),
        )
      }

      expect(shown.slice(0, 2)).toEqual([
        '2026-11-10T00:00:00.123Z',
        '2026-11-10T00:00:01.123Z',
      ])
      expect(found).toEqual([
        [microseconds],
        [microseconds],
        [lateInTheMillisecond, microseconds],
        [lateInTheMillisecond],
        [created.id, lateInTheMillisecond, microseconds],
        [created.id],
      ])
    })

    it('compares registeredFrom with registeredTo as times: accepts the same instant and a later end, and refuses an earlier end', async () => {
      await insertCustomerRow({ createdAt: '2026-11-10T00:00:00.200Z' })

      const laterEnd = await list(
        'registeredFrom=2026-11-10T00:00:00Z&registeredTo=2026-11-10T00:00:00.500Z',
      )
      const sameInstant = await list(
        'registeredFrom=2026-11-10T00:00:00Z&registeredTo=2026-11-10T00:00:00.000Z',
      )
      const earlierEnd = await list(
        'registeredFrom=2026-11-10T00:00:00.500Z&registeredTo=2026-11-10T00:00:00Z',
      )

      expect(laterEnd.status).toBe(200)
      expect(laterEnd.body.meta.total).toBe(1)
      expect(sameInstant.status).toBe(200)
      expect(sameInstant.body.meta.total).toBe(0)
      expectProblem(earlierEnd, badRequest)
      expect(brokenRules(earlierEnd)).toEqual(['registeredTo:custom'])
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
      ['a blank search', 'search=%20%20', ['search:invalid_format']],
      [
        'a search of 101 characters',
        `search=${'a'.repeat(101)}`,
        ['search:too_big'],
      ],
      ['a blank tag', 'tags=vip&tags=%20', ['tags.1:invalid_format']],
      [
        'a registration time that is a date only',
        'registeredFrom=2026-11-01',
        ['registeredFrom:invalid_format'],
      ],
      [
        'a registration time with an offset other than Z',
        `registeredTo=${encodeURIComponent('2026-11-01T00:00:00+09:00')}`,
        ['registeredTo:invalid_format'],
      ],
      [
        'a status that does not exist',
        'customerStatus=gone',
        ['customerStatus:invalid_value'],
      ],
      [
        'a tier that does not exist',
        'membershipTier=diamond',
        ['membershipTier:invalid_value'],
      ],
      ['a parameter that does not exist', 'page=2', ['page:unrecognized_keys']],
      [
        'several broken rules, all of which it reports',
        'limit=0&cursor=abc&page=2',
        ['cursor:invalid_format', 'limit:too_small', 'page:unrecognized_keys'],
      ],
    ])('rejects %s', async (_case, query, expected) => {
      await insertCustomerRow()

      const response = await list(query)

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected)
    })

    it('answers 500 without details when a stored customer of the page has preferences of another shape', async () => {
      await insertCustomerRow({ createdAt: '2026-11-01T00:00:00.000Z' })
      await insertCustomerRow({
        createdAt: '2026-11-02T00:00:00.000Z',
        preferences: { favouriteColour: 'teal' },
      })

      const response = await list()

      expectProblem(response, databaseProblem)
      expect(response.body.detail).toBeNull()
      expect(JSON.stringify(response.body)).not.toContain('teal')
    })
  })

  describe('PATCH /api/v1/customers/:id', () => {
    it('changes the given properties and nothing else, moves updatedAt, and keeps the ID and the creation time', async () => {
      const created = await createCustomer()
      const other = await createCustomer()
      const otherBefore = await storedCustomer(other.id)

      const response = await patch(created.id, {
        lastName: 'Sato',
        notes: 'Moved to Osaka',
        isActive: false,
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...created,
          lastName: 'Sato',
          notes: 'Moved to Osaka',
          isActive: false,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${CUSTOMERS}/${created.id}`,
          list: CUSTOMERS,
        },
      })
      expect(await hasMoved(created.id)).toBe(true)
      expect((await get(created.id)).body.data).toEqual(response.body.data)
      expect(await storedCustomer(other.id)).toEqual(otherBefore)
    })

    it('accepts a request that changes every property at once', async () => {
      const referrer = await createCustomer()
      const created = await createCustomer()
      const changes = customerRequest({
        ...unset,
        firstName: 'Yuki',
        lastName: 'Tanaka',
        email: 'Yuki.Tanaka@Example.com',
        phoneNumber: '080-1111-2222',
        membershipTier: 'platinum',
        tags: ['new'],
        referredBy: referrer.id,
        referralCode: 'YUKI',
        allowMarketing: false,
        allowSms: true,
        allowEmail: false,
        isActive: false,
        customerStatus: 'blacklisted',
      })

      const response = await patch(created.id, changes)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...changes,
        ...assignedToNewCustomer,
        email: 'yuki.tanaka@example.com',
        id: created.id,
        createdAt: created.createdAt,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
    })

    it('unsets a property that may be unset when it is given as null, which clears the referrer and the preferences', async () => {
      const referrer = await createCustomer()
      const created = await createCustomer({ referredBy: referrer.id })

      const response = await patch(created.id, {
        referredBy: null,
        preferences: null,
        birthDate: null,
        building: null,
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        referredBy: null,
        preferences: null,
        birthDate: null,
        building: null,
        firstNameKana: created.firstNameKana,
      })
      expect(await storedCustomer(created.id)).toMatchObject({
        referredBy: null,
        preferences: null,
      })
    })

    it('replaces the tags and the whole preferences when they are given, and empties the tags with an empty list', async () => {
      const created = await createCustomer({
        tags: ['vip', 'color'],
        preferences: { preferredServices: ['cut', 'color'], notes: 'Window' },
      })

      const replaced = await patch(created.id, {
        tags: ['new'],
        preferences: { preferredServices: ['spa'], notes: null },
      })
      const emptied = await patch(created.id, { tags: [] })

      expect(replaced.body.data).toMatchObject({
        tags: ['new'],
        preferences: { preferredServices: ['spa'], notes: null },
      })
      expect(emptied.body.data).toMatchObject({
        tags: [],
        preferences: { preferredServices: ['spa'], notes: null },
      })
    })

    it("accepts the customer's own email again, also in another case, and the email of a deleted customer", async () => {
      const created = await createCustomer({ email: 'hanako@example.com' })
      const deleted = await createCustomer({ email: 'former@example.com' })
      await deleteCustomer(deleted.id)

      const own = await patch(created.id, { email: 'HANAKO@example.com' })
      const ofDeleted = await patch(created.id, { email: 'former@example.com' })

      expect(own.status).toBe(200)
      expect(own.body.data.email).toBe('hanako@example.com')
      expect(ofDeleted.status).toBe(200)
      expect(ofDeleted.body.data.email).toBe('former@example.com')
    })

    it('rejects the email of another customer that is not deleted, and applies none of the request', async () => {
      const created = await createCustomer()
      await createCustomer({ email: 'taken@example.com' })
      const before = await storedCustomers()

      const response = await patch(created.id, {
        email: 'Taken@Example.com',
        lastName: 'Sato',
      })

      expectProblem(response, conflict)
      expect(response.body.detail).toBe(
        'Customer with email taken@example.com already exists',
      )
      expect(await storedCustomers()).toEqual(before)
    })

    it("accepts the customer's own referral code again, and rejects the code of another customer, deleted or not, applying none of the request", async () => {
      const created = await createCustomer({ referralCode: 'OWN' })
      await createCustomer({ referralCode: 'LIVE' })
      const deleted = await createCustomer({ referralCode: 'GONE' })
      await deleteCustomer(deleted.id)
      const before = await storedCustomers()

      const ofLive = await patch(created.id, {
        referralCode: 'LIVE',
        notes: 'Changed',
      })
      const ofDeleted = await patch(created.id, {
        referralCode: 'GONE',
        notes: 'Changed',
      })
      const unchanged = await storedCustomers()
      const own = await patch(created.id, { referralCode: 'OWN' })

      expectProblem(ofLive, conflict)
      expect(ofLive.body.detail).toBe(
        'Customer with referralCode LIVE already exists',
      )
      expectProblem(ofDeleted, conflict)
      expect(unchanged).toEqual(before)
      expect(own.status).toBe(200)
      expect(own.body.data.referralCode).toBe('OWN')
    })

    it('accepts a customer that is not deleted as the referrer, and refuses one that does not exist or is deleted, applying none of the request', async () => {
      const created = await createCustomer()
      const referrer = await createCustomer()
      const deleted = await createCustomer()
      await deleteCustomer(deleted.id)
      const before = await storedCustomers()

      const unknown = await patch(created.id, {
        referredBy: UNKNOWN_ID,
        notes: 'Changed',
      })
      const ofDeleted = await patch(created.id, {
        referredBy: deleted.id,
        notes: 'Changed',
      })
      const unchanged = await storedCustomers()
      const accepted = await patch(created.id, { referredBy: referrer.id })

      for (const response of [unknown, ofDeleted]) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['referredBy:not_found'])
      }
      expect(unchanged).toEqual(before)
      expect(accepted.status).toBe(200)
      expect(accepted.body.data.referredBy).toBe(referrer.id)
    })

    it('refuses the customer itself as its referrer, also written in upper case, before it looks for the customer', async () => {
      const created = await createCustomer()
      const before = await storedCustomers()

      const itself = await patch(created.id, { referredBy: created.id })
      const inUpperCase = await patch(created.id.toUpperCase(), {
        referredBy: created.id,
      })
      const upperCaseReferrer = await patch(created.id, {
        referredBy: created.id.toUpperCase(),
      })
      const unknown = await patch(UNKNOWN_ID, { referredBy: UNKNOWN_ID })

      for (const response of [
        itself,
        inUpperCase,
        upperCaseReferrer,
        unknown,
      ]) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['referredBy:circular'])
      }
      expect(await storedCustomers()).toEqual(before)
    })

    it('reports a birth date in the future and the customer itself as its referrer together', async () => {
      const created = await createCustomer()

      const response = await patch(created.id, {
        birthDate: '2999-01-01',
        referredBy: created.id,
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual([
        'birthDate:too_big',
        'referredBy:circular',
      ])
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['a blank first name', { firstName: ' ' }, ['firstName:invalid_format']],
      [
        'a last name of 101 characters',
        { lastName: 'a'.repeat(101) },
        ['lastName:too_big'],
      ],
      [
        'a gender that does not exist',
        { gender: 'unknown' },
        ['gender:invalid_value'],
      ],
      ['null as the tags', { tags: null }, ['tags:invalid_type']],
      [
        'null as the status',
        { customerStatus: null },
        ['customerStatus:invalid_value'],
      ],
      [
        'a property the server manages',
        { createdAt: '2026-01-01T00:00:00.000Z' },
        ['createdAt:unrecognized_keys'],
      ],
      [
        'a repeated service and blank notes in the preferences',
        { preferences: { preferredServices: ['cut', 'cut'], notes: ' ' } },
        [
          'preferences.notes:invalid_format',
          'preferences.preferredServices.1:custom',
        ],
      ],
      ['an empty tag', { tags: ['vip', ''] }, ['tags.1:invalid_format']],
      [
        'a birth date before 1900',
        { birthDate: '1899-12-31' },
        ['birthDate:too_small'],
      ],
    ])('rejects %s and changes nothing', async (_case, change, expected) => {
      const created = await createCustomer()
      const before = await storedCustomers()

      const response = await patch(created.id, change)

      expectProblem(response, badRequest)
      expect(brokenRules(response).toSorted()).toEqual(expected)
      expect(await storedCustomers()).toEqual(before)
    })

    it('rejects an empty request with one error for the request as a whole', async () => {
      const created = await createCustomer()

      const response = await patch(created.id, {})

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        expect.objectContaining({
          field: '',
          rule: 'custom',
          message: expect.any(String),
        }),
      ])
    })

    it('rejects a body that is not JSON and changes nothing', async () => {
      const created = await createCustomer()
      const before = await storedCustomers()

      const response = await request(app)
        .patch(`${CUSTOMERS}/${created.id}`)
        .set('Authorization', asAdmin)
        .set('Content-Type', 'application/json')
        .send('{"lastName": ')

      expectProblem(response, malformedBody)
      expect(await storedCustomers()).toEqual(before)
    })

    it.each(malformedIds)('rejects %s as the ID', async (_case, id) => {
      const response = await patch(id, { lastName: 'Sato' })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('reports an ID that no customer has as not found, also when the referrer does not exist either', async () => {
      await createCustomer()
      const before = await storedCustomers()

      const unknown = await patch(UNKNOWN_ID, { lastName: 'Sato' })
      const unknownReferrer = await patch(UNKNOWN_ID, {
        referredBy: ANOTHER_UNKNOWN_ID,
      })

      for (const response of [unknown, unknownReferrer]) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Customer ${UNKNOWN_ID} was not found`,
        )
      }
      expect(await storedCustomers()).toEqual(before)
    })

    it('reports a deleted customer as not found and changes nothing', async () => {
      const created = await createCustomer()
      await deleteCustomer(created.id)
      const before = await storedCustomers()

      const response = await patch(created.id, { lastName: 'Sato' })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${created.id} was not found`)
      expect(await storedCustomers()).toEqual(before)
    })
  })

  describe('DELETE /api/v1/customers/:id', () => {
    it('marks the customer as deleted and keeps its row, leaves the other customers and their referrer as they are, and takes the customer from the login account that has it, and from no other', async () => {
      const deleted = await createCustomer()
      const referred = await createCustomer({ referredBy: deleted.id })
      const other = await createCustomer()
      const account = await insertUser(db, { customerId: deleted.id })
      const otherAccount = await insertUser(db, { customerId: other.id })
      const before = await storedCustomer(deleted.id)
      const othersBefore = [
        await storedCustomer(referred.id),
        await storedCustomer(other.id),
      ]

      const response = await remove(deleted.id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(await storedCustomer(deleted.id)).toEqual({
        ...before,
        deletedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
      expect((await storedCustomer(deleted.id)).deletedAt).not.toBeNull()
      expect([
        await storedCustomer(referred.id),
        await storedCustomer(other.id),
      ]).toEqual(othersBefore)
      expect((await get(referred.id)).body.data.referredBy).toBe(deleted.id)
      const links = await db
        .select({ id: users.id, customerId: users.customerId })
        .from(users)
        .where(inArray(users.id, [account.id, otherAccount.id]))
      expect(
        links.toSorted((left, right) => (left.id < right.id ? -1 : 1)),
      ).toEqual(
        [
          { id: account.id, customerId: null },
          { id: otherAccount.id, customerId: other.id },
        ].toSorted((left, right) => (left.id < right.id ? -1 : 1)),
      )
    })

    it('hides the deleted customer from get, update, delete, the list and its total, and as a referrer', async () => {
      const deleted = await createCustomer()
      const other = await createCustomer()
      await deleteCustomer(deleted.id)

      const one = await get(deleted.id)
      const changed = await patch(deleted.id, { lastName: 'Sato' })
      const again = await remove(deleted.id)
      const listed = await list()
      const referredOnCreate = await post(
        customerRequest({ referralCode: null, referredBy: deleted.id }),
      )
      const referredOnUpdate = await patch(other.id, {
        referredBy: deleted.id,
      })

      for (const response of [one, changed, again]) {
        expectProblem(response, notFound)
      }
      expect(idsOf(listed)).toEqual([other.id])
      expect(listed.body.meta.total).toBe(1)
      for (const response of [referredOnCreate, referredOnUpdate]) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['referredBy:not_found'])
      }
    })

    it('lets another customer have the email of the deleted customer, through a creation and an update, but not the referral code', async () => {
      const first = await createCustomer({
        email: 'first@example.com',
        referralCode: 'FIRST',
      })
      const second = await createCustomer({
        email: 'second@example.com',
        referralCode: 'SECOND',
      })
      const other = await createCustomer()
      await deleteCustomer(first.id)
      await deleteCustomer(second.id)

      const created = await post(
        customerRequest({ email: 'first@example.com', referralCode: null }),
      )
      const changed = await patch(other.id, { email: 'second@example.com' })
      const codeOnCreate = await post(
        customerRequest({ email: 'new@example.com', referralCode: 'FIRST' }),
      )
      const codeOnUpdate = await patch(other.id, { referralCode: 'SECOND' })

      expect(created.status).toBe(201)
      expect(changed.status).toBe(200)
      expect(changed.body.data.email).toBe('second@example.com')
      expectProblem(codeOnCreate, conflict)
      expectProblem(codeOnUpdate, conflict)
    })

    it.each(malformedIds)(
      'rejects %s as the ID and deletes nothing',
      async (_case, id) => {
        await createCustomer()
        const before = await storedCustomers()

        const response = await remove(id)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
        expect(await storedCustomers()).toEqual(before)
      },
    )

    it('reports an ID that no customer has as not found and deletes nothing', async () => {
      await createCustomer()
      const before = await storedCustomers()

      const response = await remove(UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${UNKNOWN_ID} was not found`)
      expect(await storedCustomers()).toEqual(before)
    })

    it('answers a second DELETE of the same customer with 404', async () => {
      const created = await createCustomer()
      await deleteCustomer(created.id)
      const before = await storedCustomer(created.id)

      const response = await remove(created.id)

      expectProblem(response, notFound)
      expect(await storedCustomer(created.id)).toEqual(before)
    })
  })

  describe('IDs written in upper case', () => {
    it('name the same customer in the path, and the data and the links write it in lower case', async () => {
      const created = await createCustomer()
      const inUpperCase = created.id.toUpperCase()
      const links = { self: `${CUSTOMERS}/${created.id}`, list: CUSTOMERS }

      const one = await get(inUpperCase)
      const changed = await patch(inUpperCase, { lastName: 'Sato' })
      const removed = await remove(inUpperCase)

      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(created)
      expect(one.body.links).toEqual(links)
      expect(changed.status).toBe(200)
      expect(changed.body.data).toMatchObject({
        id: created.id,
        lastName: 'Sato',
      })
      expect(changed.body.links).toEqual(links)
      expect(removed.status).toBe(204)
      expect((await storedCustomer(created.id)).deletedAt).not.toBeNull()
    })

    it('name the same referrer when a customer is created or changed, which is stored and returned in lower case', async () => {
      const referrer = await createCustomer()
      const other = await createCustomer()

      const created = await post(
        customerRequest({ referredBy: referrer.id.toUpperCase() }),
      )
      const changed = await patch(other.id, {
        referredBy: referrer.id.toUpperCase(),
      })

      expect(created.status).toBe(201)
      expect(created.body.data.referredBy).toBe(referrer.id)
      expect(changed.status).toBe(200)
      expect(changed.body.data.referredBy).toBe(referrer.id)
      expect((await storedCustomer(other.id)).referredBy).toBe(referrer.id)
    })

    it('name the same customer as a cursor, and the page writes it in lower case', async () => {
      const ledger = await insertLedger()

      const page = await list(`limit=1&cursor=${ledger.suzuki.toUpperCase()}`)

      expect(page.status).toBe(200)
      expect(idsOf(page)).toEqual([ledger.sato])
      expect(page.body.meta.cursor).toBe(ledger.suzuki)
      expect(page.body.links.self).toBe(
        `${CUSTOMERS}?limit=1&cursor=${ledger.suzuki}`,
      )
    })
  })

  describe('who may keep the customer ledger', () => {
    /** Signs in and returns the Authorization header to send. */
    type SignInAs = () => Promise<string>

    const member =
      (
        role: 'owner' | 'manager' | 'staff',
        staffOverrides: Parameters<typeof insertMember>[3] = {},
      ): SignInAs =>
      async () => {
        const salonId = await insertSalon(db)
        const { email } = await insertMember(db, role, salonId, staffOverrides)
        return (await signIn(app, email)).authorization
      }

    const customer: SignInAs = async () =>
      (await signedInUser(app, db, { customerId: await insertCustomer(db) }))
        .authorization

    /** Who may list, add, read and change customers, besides an admin. */
    const salonMembers: [string, SignInAs][] = [
      ['the owner of a salon', member('owner')],
      ['a manager of a salon', member('manager')],
      ['a staff member of a salon', member('staff')],
    ]

    /** Who may do nothing with the ledger. The last three have a role without the record it needs. */
    const refusedEverywhere: [string, SignInAs][] = [
      ['a customer', customer],
      [
        'a registered user without a customer record',
        async () => (await signedInUser(app, db)).authorization,
      ],
      [
        'a staff member whose staff record is deleted',
        member('staff', { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
      [
        'an owner whose staff record is inactive',
        member('owner', { isActive: false }),
      ],
    ]

    it.each(unauthenticated)(
      'answers %s with 401 in every operation before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const created = await createCustomer()
        const authorization = await tokenOf()
        const before = await storedCustomers()

        const responses = [
          await list('', authorization),
          await list('limit=abc&page=2', authorization),
          await post(
            customerRequest({ email: 'new@example.com' }),
            authorization,
          ),
          await post({}, authorization),
          await get(created.id, authorization),
          await get('latest', authorization),
          await patch(created.id, { lastName: 'Sato' }, authorization),
          await patch('latest', {}, authorization),
          await patch(UNKNOWN_ID, { lastName: 'Sato' }, authorization),
          await remove(created.id, authorization),
          await remove('latest', authorization),
          await remove(UNKNOWN_ID, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedCustomers()).toEqual(before)
      },
    )

    it.each(salonMembers)(
      'lets %s list, add, read and change customers, whatever salon they belong to',
      async (_case, signInAs) => {
        const existing = await createCustomer()
        const authorization = await signInAs()

        const added = await post(
          customerRequest({ email: 'new@example.com', referralCode: null }),
          authorization,
        )
        const listed = await list('', authorization)
        const one = await get(existing.id, authorization)
        const changed = await patch(
          existing.id,
          { notes: 'Changed' },
          authorization,
        )

        expect(added.status).toBe(201)
        expect(listed.status).toBe(200)
        expect(idsOf(listed)).toEqual([added.body.data.id, existing.id])
        expect(one.status).toBe(200)
        expect(one.body.data).toEqual(existing)
        expect(changed.status).toBe(200)
        expect(changed.body.data.notes).toBe('Changed')
      },
    )

    it.each([
      ['the owner of a salon', member('owner')],
      ['a manager of a salon', member('manager')],
    ])('lets %s delete a customer', async (_case, signInAs) => {
      const created = await createCustomer()
      const authorization = await signInAs()

      const response = await remove(created.id, authorization)

      expect(response.status).toBe(204)
      expect((await storedCustomer(created.id)).deletedAt).not.toBeNull()
    })

    it('forbids a staff member of a salon to delete a customer before looking at the ID or for the customer, and deletes nothing', async () => {
      const created = await createCustomer()
      const deleted = await createCustomer()
      await deleteCustomer(deleted.id)
      const staff = await member('staff')()
      const before = await storedCustomers()

      const responses = [
        await remove(created.id, staff),
        await remove('latest', staff),
        await remove(UNKNOWN_ID, staff),
        await remove(deleted.id, staff),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await storedCustomers()).toEqual(before)
    })

    it.each(refusedEverywhere)(
      'forbids %s every operation, before looking at the ID, the query or the body, or for a customer, and changes nothing',
      async (_case, signInAs) => {
        const created = await createCustomer()
        const authorization = await signInAs()
        const before = await storedCustomers()

        const responses = [
          await list('', authorization),
          await list('limit=abc', authorization),
          await list('page=2', authorization),
          await list(`cursor=${UNKNOWN_ID}`, authorization),
          await post(
            customerRequest({ email: 'new@example.com', referralCode: null }),
            authorization,
          ),
          await post(customerRequest({ firstName: '' }), authorization),
          await post({}, authorization),
          await post(
            customerRequest({ referredBy: UNKNOWN_ID }),
            authorization,
          ),
          await get(created.id, authorization),
          await get('latest', authorization),
          await get(UNKNOWN_ID, authorization),
          await patch(created.id, { notes: 'Changed' }, authorization),
          await patch('latest', { notes: 'Changed' }, authorization),
          await patch(created.id, {}, authorization),
          await patch(created.id, { referredBy: created.id }, authorization),
          await patch(UNKNOWN_ID, { notes: 'Changed' }, authorization),
          await remove(created.id, authorization),
          await remove('latest', authorization),
          await remove(UNKNOWN_ID, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await storedCustomers()).toEqual(before)
      },
    )

    it('forbids a customer to read, change or delete the customer record that their own account is linked to', async () => {
      const own = await createCustomer()
      const { authorization } = await signedInUser(app, db, {
        customerId: own.id,
      })
      const before = await storedCustomers()

      const responses = [
        await get(own.id, authorization),
        await patch(own.id, { notes: 'Changed' }, authorization),
        await remove(own.id, authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await storedCustomers()).toEqual(before)
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
      const created = await createCustomer()
      const refused = await customer()

      const responses = [
        await notJson(request(app).post(CUSTOMERS), null),
        await notJson(request(app).patch(`${CUSTOMERS}/${created.id}`), null),
        await authorized(request(app).post(CUSTOMERS), null)
          .set('Content-Type', 'text/plain')
          .send('Hanako Yamada'),
        await notJson(request(app).post(CUSTOMERS), refused),
        await notJson(
          request(app).patch(`${CUSTOMERS}/${created.id}`),
          refused,
        ),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '415 2002',
        '400 2002',
        '400 2002',
      ])
    })

    it('checks an update in order: the token, the permission, the ID, the body, the rules of the request, the customer, the referrer, what is taken', async () => {
      const created = await createCustomer()
      const taken = await createCustomer()
      const refused = await customer()

      const outcomes = [
        await patch('latest', {}, null),
        await patch('latest', {}, refused),
        await patch('latest', {}),
        await patch(UNKNOWN_ID, {}),
        await patch(UNKNOWN_ID, { birthDate: '2999-01-01' }),
        await patch(UNKNOWN_ID, { referredBy: UNKNOWN_ID }),
        await patch(UNKNOWN_ID, {
          referredBy: ANOTHER_UNKNOWN_ID,
          email: taken.email,
        }),
        await patch(created.id, {
          referredBy: ANOTHER_UNKNOWN_ID,
          email: taken.email,
        }),
        await patch(created.id, { email: taken.email }),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '403',
        '400 id:invalid_format',
        '400 :custom',
        '400 birthDate:too_big',
        '400 referredBy:circular',
        '404',
        '400 referredBy:not_found',
        '409',
      ])
    })

    it('checks a creation in order: the token, the permission, the body, the rules of the request, the referrer, what is taken', async () => {
      const taken = await createCustomer()
      const refused = await customer()

      const outcomes = [
        await post({}, null),
        await post({}, refused),
        await post(customerRequest({ firstName: '', birthDate: '2999-01-01' })),
        await post(
          customerRequest({
            birthDate: '2999-01-01',
            referredBy: UNKNOWN_ID,
            email: taken.email,
          }),
        ),
        await post(
          customerRequest({ referredBy: UNKNOWN_ID, email: taken.email }),
        ),
        await post(customerRequest({ email: taken.email })),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '403',
        '400 firstName:invalid_format',
        '400 birthDate:too_big',
        '400 referredBy:not_found',
        '409',
      ])
    })

    it('checks a list, a read and a deletion in order: the token, the permission, the query or the ID, the customer', async () => {
      const refused = await customer()
      const staff = await member('staff')()

      const outcomes = [
        await list('limit=abc', null),
        await list('limit=abc', refused),
        await list(`limit=0&cursor=${UNKNOWN_ID}`),
        await list(`cursor=${UNKNOWN_ID}`),
        await get('latest', null),
        await get('latest', refused),
        await get('latest'),
        await get(UNKNOWN_ID),
        await remove('latest', null),
        await remove('latest', staff),
        await remove('latest'),
        await remove(UNKNOWN_ID),
      ].map(outcomeOf)

      expect(outcomes).toEqual([
        '401',
        '403',
        '400 limit:too_small',
        '400 cursor:not_found',
        '401',
        '403',
        '400 id:invalid_format',
        '404',
        '401',
        '403',
        '400 id:invalid_format',
        '404',
      ])
    })
  })

  describe('requests at the same moment', () => {
    it('lets exactly one of several creations with the same email succeed and answers the others with 409', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `race-${round}@example.com`

        const responses = await Promise.all(
          [0, 1, 2, 3].map((index) =>
            post(
              customerRequest({
                email,
                referralCode: `RACE-${round}-${index}`,
              }),
            ),
          ),
        )

        expect(responses.map(({ status }) => status).sort()).toEqual([
          201, 409, 409, 409,
        ])
        expect(await liveCustomersWithEmail(email)).toBe(1)
      }
    })

    it('lets exactly one of several creations with the same referral code succeed and answers the others with 409', async () => {
      for (let round = 0; round < 5; round += 1) {
        const referralCode = `RACE-${round}`

        const responses = await Promise.all(
          [0, 1, 2, 3].map((index) =>
            post(
              customerRequest({
                email: `race-${round}-${index}@example.com`,
                referralCode,
              }),
            ),
          ),
        )

        expect(responses.map(({ status }) => status).sort()).toEqual([
          201, 409, 409, 409,
        ])
        expect(
          await db.$count(customers, eq(customers.referralCode, referralCode)),
        ).toBe(1)
      }
    })

    it('lets exactly one of two customers take the same email', async () => {
      for (let round = 0; round < 5; round += 1) {
        const [first, second] = [await createCustomer(), await createCustomer()]
        const email = `wanted-${round}@example.com`

        const responses = await Promise.all([
          patch(first.id, { email }),
          patch(second.id, { email }),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([200, 409])
        expect(await liveCustomersWithEmail(email)).toBe(1)
      }
    })

    it('lets exactly one of several DELETEs of the same customer succeed and answers the others with 404', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createCustomer()

        const responses = await Promise.all([
          remove(created.id),
          remove(created.id),
          remove(created.id),
        ])

        expect(responses.map(({ status }) => status).sort()).toEqual([
          204, 404, 404,
        ])
        expect((await storedCustomer(created.id)).deletedAt).not.toBeNull()
      }
    })

    it('deletes a customer that is being changed: the update succeeds or is not found, and the customer is deleted afterwards', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createCustomer()

        const [changed, removed] = await Promise.all([
          patch(created.id, { notes: `Round ${round}` }),
          remove(created.id),
        ])

        expect(removed.status).toBe(204)
        expect([200, 404]).toContain(changed.status)
        expect((await storedCustomer(created.id)).deletedAt).not.toBeNull()
      }
    })

    it('lets a creation take the email of a customer that is being deleted, or refuses it, and never leaves two customers with the email', async () => {
      for (let round = 0; round < 5; round += 1) {
        const email = `handover-${round}@example.com`
        const leaving = await createCustomer({ email })

        const [removed, created] = await Promise.all([
          remove(leaving.id),
          post(customerRequest({ email, referralCode: null })),
        ])

        expect(removed.status).toBe(204)
        expect([201, 409]).toContain(created.status)
        expect(await liveCustomersWithEmail(email)).toBe(
          created.status === 201 ? 1 : 0,
        )
      }
    })

    it('keeps both of two changes of different properties of one customer', async () => {
      for (let round = 0; round < 5; round += 1) {
        const created = await createCustomer()

        const responses = await Promise.all([
          patch(created.id, { notes: `Notes ${round}` }),
          patch(created.id, { occupation: `Occupation ${round}` }),
        ])

        expect(responses.map(({ status }) => status)).toEqual([200, 200])
        expect(await storedCustomer(created.id)).toMatchObject({
          notes: `Notes ${round}`,
          occupation: `Occupation ${round}`,
        })
      }
    })
  })

  describe('CustomerRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new CustomerRepository(db)
    const customerId = (id: string) => customerIdSchema.parse(id)

    /** The values of a new customer with nothing that may be unset. */
    const newCustomer = (
      overrides: Partial<DbNewCustomer> = {},
    ): DbNewCustomer => ({
      firstName: 'Hanako',
      lastName: 'Yamada',
      firstNameKana: null,
      lastNameKana: null,
      email: `new-${randomUUID()}@example.com`,
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

    const criteria = (
      overrides: Partial<CustomerListCriteria> = {},
    ): CustomerListCriteria => ({
      limit: 10,
      after: null,
      search: null,
      phoneDigits: null,
      tags: [],
      registeredFrom: null,
      registeredTo: null,
      customerStatus: null,
      membershipTier: null,
      ...overrides,
    })

    /** Stores a customer through the repository and returns its row. */
    const stored = async (overrides: Partial<DbNewCustomer> = {}) => {
      const creation = dataOf(await repository().create(newCustomer(overrides)))
      if (creation.type !== 'created') {
        throw new Error(`Expected a customer, got ${creation.type}`)
      }
      return creation.customer
    }

    /** The IDs of the customers of a list, in its order. */
    const listedIds = (
      result: Result<{ customers: { id: string }[] } | null, DomainError>,
    ): string[] => dataOf(result)?.customers.map(({ id }) => id) ?? []

    describe('create', () => {
      it('stores the customer and resolves to its row, not deleted', async () => {
        const values = newCustomer({
          tags: ['vip'],
          preferences: { preferredServices: ['cut'], notes: null },
        })

        const creation = dataOf(await repository().create(values))

        expect(creation).toEqual({
          type: 'created',
          customer: {
            ...values,
            ...assignedToNewCustomer,
            id: expect.stringMatching(UUID),
            deletedAt: null,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
        })
      })

      it('resolves to referrerNotFound for a referrer that does not exist or is deleted, and stores nothing', async () => {
        const deleted = await stored()
        dataOf(await repository().delete(customerId(deleted.id)))

        const unknown = await repository().create(
          newCustomer({ referredBy: UNKNOWN_ID }),
        )
        const ofDeleted = await repository().create(
          newCustomer({ referredBy: deleted.id }),
        )

        expect(dataOf(unknown)).toEqual({ type: 'referrerNotFound' })
        expect(dataOf(ofDeleted)).toEqual({ type: 'referrerNotFound' })
        expect(await db.$count(customers)).toBe(1)
      })

      it('refuses the email of a customer that is not deleted and any referral code that is taken with alreadyExists, naming the field and the value, and stores nothing', async () => {
        await stored({ email: 'taken@example.com', referralCode: 'TAKEN' })

        const email = await repository().create(
          newCustomer({ email: 'taken@example.com' }),
        )
        const code = await repository().create(
          newCustomer({ referralCode: 'TAKEN' }),
        )

        expect(email).toEqual({
          type: 'error',
          error: {
            type: 'alreadyExists',
            entity: 'Customer',
            field: 'email',
            value: 'taken@example.com',
          },
        })
        expect(code).toEqual({
          type: 'error',
          error: {
            type: 'alreadyExists',
            entity: 'Customer',
            field: 'referralCode',
            value: 'TAKEN',
          },
        })
        expect(await db.$count(customers)).toBe(1)
      })
    })

    describe('findById', () => {
      it('finds a customer, and resolves to null for a deleted customer and an ID that no customer has', async () => {
        const kept = await stored()
        const deleted = await stored()
        dataOf(await repository().delete(customerId(deleted.id)))

        const found = await repository().findById(customerId(kept.id))
        const ofDeleted = await repository().findById(customerId(deleted.id))
        const unknown = await repository().findById(customerId(UNKNOWN_ID))

        expect(dataOf(found)).toEqual(kept)
        expect(dataOf(ofDeleted)).toBeNull()
        expect(dataOf(unknown)).toBeNull()
      })
    })

    describe('list', () => {
      it('lists newest first with the number of matching customers and whether more follow, starts after the customer the cursor names, deleted or not, and resolves to null for a cursor that names no customer', async () => {
        const ledger = await insertLedger()

        const first = await repository().list(criteria({ limit: 2 }))
        const afterDeleted = await repository().list(
          criteria({ limit: 2, after: customerId(ledger.deleted) }),
        )
        const rest = await repository().list(
          criteria({ limit: 3, after: customerId(ledger.suzuki) }),
        )
        const unknown = await repository().list(
          criteria({ after: customerId(UNKNOWN_ID) }),
        )

        expect(dataOf(first)).toMatchObject({ total: 5, hasMore: true })
        expect(listedIds(first)).toEqual(ledger.all.slice(0, 2))
        expect(listedIds(afterDeleted)).toEqual(ledger.all.slice(0, 2))
        expect(dataOf(rest)).toMatchObject({ total: 5, hasMore: false })
        expect(listedIds(rest)).toEqual(ledger.all.slice(2))
        expect(dataOf(unknown)).toBeNull()
      })

      it('applies every filter, all of them together, and counts only what they let through', async () => {
        const ledger = await insertLedger()

        const tags = await repository().list(criteria({ tags: ['vip', 'new'] }))
        const status = await repository().list(
          criteria({ customerStatus: 'blacklisted' }),
        )
        const tier = await repository().list(
          criteria({ membershipTier: 'platinum' }),
        )
        const registered = await repository().list(
          criteria({
            registeredFrom: '2026-11-03T09:00:00.000Z',
            registeredTo: '2026-11-04T09:00:00.000Z',
          }),
        )
        const all = await repository().list(
          criteria({
            tags: ['vip'],
            customerStatus: 'vip',
            membershipTier: 'gold',
            registeredFrom: '2026-11-01T09:00:00.000Z',
            registeredTo: '2026-11-01T09:00:00.000Z',
          }),
        )

        expect(listedIds(tags)).toEqual([ledger.percent])
        expect(listedIds(status)).toEqual([ledger.sato])
        expect(listedIds(tier)).toEqual([ledger.tanaka])
        expect(listedIds(registered)).toEqual([ledger.suzuki, ledger.sato])
        expect(dataOf(registered)?.total).toBe(2)
        expect(listedIds(all)).toEqual([ledger.percent])
        expect(dataOf(all)?.total).toBe(1)
      })

      it('matches the text of search and the digits of phoneDigits each on their own, and a customer that either matches when both are given', async () => {
        const ledger = await insertLedger()

        const searchOnly = await repository().list(
          criteria({ search: 'tanaka' }),
        )
        const digitsOnly = await repository().list(
          criteria({ phoneDigits: '55556666' }),
        )
        const digitsOfAlternative = await repository().list(
          criteria({ phoneDigits: '09012345678' }),
        )
        const either = await repository().list(
          criteria({ search: 'tanaka', phoneDigits: '55556666' }),
        )

        expect(listedIds(searchOnly)).toEqual([ledger.tanaka])
        expect(listedIds(digitsOnly)).toEqual([ledger.suzuki])
        expect(listedIds(digitsOfAlternative)).toEqual([ledger.yamada])
        expect(listedIds(either)).toEqual([ledger.suzuki, ledger.tanaka])
        expect(dataOf(either)?.total).toBe(2)
      })
    })

    describe('update', () => {
      it('changes the given columns, moves updatedAt and resolves to the updated row', async () => {
        const original = await stored({ notes: 'Before', tags: ['vip'] })

        const update = dataOf(
          await repository().update(customerId(original.id), {
            notes: 'After',
            tags: [],
          }),
        )

        expect(update).toEqual({
          type: 'updated',
          customer: {
            ...original,
            notes: 'After',
            tags: [],
            updatedAt: expect.any(String),
          },
        })
        expect(await hasMoved(original.id)).toBe(true)
      })

      it('resolves to notFound for a deleted customer and an ID that no customer has, and to referrerNotFound for a referrer that is deleted, changing nothing', async () => {
        const customer = await stored()
        const deleted = await stored()
        dataOf(await repository().delete(customerId(deleted.id)))
        const before = await storedCustomers()

        const ofDeleted = await repository().update(customerId(deleted.id), {
          notes: 'After',
        })
        const unknown = await repository().update(customerId(UNKNOWN_ID), {
          notes: 'After',
        })
        const deletedReferrer = await repository().update(
          customerId(customer.id),
          { notes: 'After', referredBy: deleted.id },
        )

        expect(dataOf(ofDeleted)).toEqual({ type: 'notFound' })
        expect(dataOf(unknown)).toEqual({ type: 'notFound' })
        expect(dataOf(deletedReferrer)).toEqual({ type: 'referrerNotFound' })
        expect(await storedCustomers()).toEqual(before)
      })

      it('refuses an email or a referral code of another customer with alreadyExists, naming the field and the value, and changes nothing', async () => {
        const customer = await stored()
        await stored({ email: 'taken@example.com', referralCode: 'TAKEN' })
        const before = await storedCustomers()

        const email = await repository().update(customerId(customer.id), {
          email: 'taken@example.com',
        })
        const code = await repository().update(customerId(customer.id), {
          referralCode: 'TAKEN',
        })

        expect(email).toMatchObject({
          type: 'error',
          error: {
            type: 'alreadyExists',
            field: 'email',
            value: 'taken@example.com',
          },
        })
        expect(code).toMatchObject({
          type: 'error',
          error: {
            type: 'alreadyExists',
            field: 'referralCode',
            value: 'TAKEN',
          },
        })
        expect(await storedCustomers()).toEqual(before)
      })
    })

    describe('delete', () => {
      it('deletes a customer that is there, and finds none the second time and for an ID that no customer has', async () => {
        const customer = await stored()

        const first = await repository().delete(customerId(customer.id))
        const second = await repository().delete(customerId(customer.id))
        const unknown = await repository().delete(customerId(UNKNOWN_ID))

        expect(dataOf(first)).toEqual({ type: 'deleted' })
        expect(dataOf(second)).toEqual({ type: 'notFound' })
        expect(dataOf(unknown)).toEqual({ type: 'notFound' })
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })

    it.each<[string, () => Partial<NewCustomerRow>, string]>([
      [
        'an email with an upper-case letter',
        () => ({ email: 'Hanako@example.com' }),
        'customers_email_lower_case',
      ],
      [
        'a gender outside the four values',
        () => ({ gender: 'unknown' }),
        'customers_gender_known',
      ],
      [
        'a customer that refers to itself',
        () => {
          const id = randomUUID()
          return { id, referredBy: id }
        },
        'customers_not_referred_by_itself',
      ],
      [
        'preferences that are a list',
        () => ({ preferences: [] }),
        'customers_preferences_is_an_object',
      ],
      [
        'preferences that are a text',
        () => ({ preferences: 'text' }),
        'customers_preferences_is_an_object',
      ],
    ])('refuses %s', async (_case, valuesOf, constraint) => {
      await expect(insertCustomerRow(valuesOf())).rejects.toMatchObject(
        violationOf('23514', constraint),
      )
      expect(await db.$count(customers)).toBe(0)
    })

    it.each(['tags', 'customerStatus'])(
      'refuses NULL as %s of a customer',
      async (column) => {
        const id = await insertCustomerRow()

        await expect(
          db.execute(
            sql`UPDATE ${customers} SET ${sql.identifier(column)} = NULL WHERE ${customers.id} = ${id}`,
          ),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({
            code: '23502',
            column_name: column,
          }),
        })
      },
    )

    it('keeps the email unique among the customers that are not deleted, and lets a deleted and a live customer share one', async () => {
      await insertCustomerRow({
        email: 'shared@example.com',
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await insertCustomerRow({ email: 'shared@example.com' })

      await expect(
        insertCustomerRow({ email: 'shared@example.com' }),
      ).rejects.toMatchObject(violationOf('23505', 'customers_email_unique'))
      expect(await db.$count(customers)).toBe(2)
    })

    it('keeps the referral code unique among all customers, the deleted ones included', async () => {
      await insertCustomerRow({
        referralCode: 'ONCE',
        deletedAt: '2026-11-01T00:00:00.000Z',
      })

      await expect(
        insertCustomerRow({ referralCode: 'ONCE' }),
      ).rejects.toMatchObject(
        violationOf('23505', 'customers_referral_code_unique'),
      )
      expect(await db.$count(customers)).toBe(1)
    })
  })
})
