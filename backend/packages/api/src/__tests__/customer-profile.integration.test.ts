import { randomUUID } from 'node:crypto'
import { customers, users } from '@beauty-salon-backend/database'
import {
  type CustomerProfileWrite,
  type DomainError,
  userIdSchema,
} from '@beauty-salon-backend/domain'
import { CustomerRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response, Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  epochMs,
  insertMember,
  insertSalon,
  insertSession,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
  signInAsAdmin,
  type TestUser,
} from './_shared/auth-helpers'
import {
  brokenRules,
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
const ME = `${CUSTOMERS}/me`

/** A UUID that no user has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
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

const ALREADY_HAS_PROFILE = 'This account already has a customer profile'
const EMAIL_NOT_CONFIRMED =
  'Confirm the email address of the account before creating a customer profile'
const ENTRY_OF_ANOTHER_ACCOUNT =
  'The customer with the email address of this account belongs to another account'

/** Exactly the properties of CustomerProfileResponse. */
const PROFILE_PROPERTIES = [
  'id',
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
  'referralCode',
  'firstVisitDate',
  'lastVisitDate',
  'visitCount',
  'allowMarketing',
  'allowSms',
  'allowEmail',
  'hairType',
  'hairThickness',
  'scalpCondition',
  'createdAt',
  'updatedAt',
]

/** What the ledger holds of a customer and the customer is never shown. */
const STAFF_ONLY_PROPERTIES = [
  'userId',
  'notes',
  'internalNotes',
  'tags',
  'referredBy',
  'isActive',
  'customerStatus',
  'lifetimeValue',
  'noShowCount',
  'cancellationCount',
  'deletedAt',
]

/** A request that satisfies every rule, with a value for every property. */
const profileRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Hanako',
  lastName: 'Yamada',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
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
  preferences: {
    preferredServices: ['cut', 'color'],
    notes: 'Prefers a seat by the window',
  },
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  ...overrides,
})

/** The properties of a profile that may be unset, all unset. */
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
}

/** What a new entry has that the customer did not state and is shown. */
const assignedToNewProfile = {
  membershipTier: 'regular',
  loyaltyPoints: 0,
  referralCode: null,
  firstVisitDate: null,
  lastVisitDate: null,
  visitCount: 0,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
}

/** What a new entry has that the customer did not state and is not shown. */
const staffSideOfNewEntry = {
  notes: null,
  internalNotes: null,
  tags: [],
  referredBy: null,
  isActive: true,
  customerStatus: 'active',
  lifetimeValue: 0,
  noShowCount: 0,
  cancellationCount: 0,
  deletedAt: null,
}

/** Requests that break a rule, in a creation and, where they can be sent, in an update. */
const violations: [string, Record<string, unknown>, string[]][] = [
  ['a blank first name', { firstName: ' ' }, ['firstName:invalid_format']],
  [
    'a last name of 101 characters',
    { lastName: 'a'.repeat(101) },
    ['lastName:too_big'],
  ],
  [
    'a phone number of nine digits',
    { phoneNumber: '031234567' },
    ['phoneNumber:custom'],
  ],
  ['an unknown gender', { gender: 'unknown' }, ['gender:invalid_value']],
  [
    'a birth date that is no date',
    { birthDate: '1990-02-30' },
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
  [
    'a preferred service named twice',
    { preferences: { preferredServices: ['cut', 'cut'], notes: null } },
    ['preferences.preferredServices.1:custom'],
  ],
  ['a consent that is text', { allowSms: 'yes' }, ['allowSms:invalid_type']],
  [
    'a first name that is unset',
    { firstName: null },
    ['firstName:invalid_type'],
  ],
  [
    'the email, which is the one of the account',
    { email: 'someone.else@example.com' },
    ['email:unrecognized_keys'],
  ],
  [
    'a membership tier',
    { membershipTier: 'vip' },
    ['membershipTier:unrecognized_keys'],
  ],
  ['points', { loyaltyPoints: 100_000 }, ['loyaltyPoints:unrecognized_keys']],
  [
    'a status and tags',
    { customerStatus: 'vip', tags: ['vip'] },
    ['customerStatus:unrecognized_keys', 'tags:unrecognized_keys'],
  ],
  [
    'internal notes',
    { internalNotes: 'Nothing to see' },
    ['internalNotes:unrecognized_keys'],
  ],
  ['an account', { userId: UNKNOWN_ID }, ['userId:unrecognized_keys']],
  ['an ID', { id: UNKNOWN_ID }, ['id:unrecognized_keys']],
]

/** The status of a response and, for a problem, its code. */
const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

describe('Customer profile API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const get = (as: string | null) => authorized(request(app).get(ME), as)

  const post = (body: object, as: string | null) =>
    authorized(request(app).post(ME), as).send(body)

  const patch = (body: object, as: string | null) =>
    authorized(request(app).patch(ME), as).send(body)

  const removeFromLedger = (id: string, as: string = asAdmin) =>
    authorized(request(app).delete(`${CUSTOMERS}/${id}`), as)

  type Account = TestUser & { authorization: string }

  /** A signed-in customer account that has confirmed its address and has no profile. */
  const account = async (
    overrides: Parameters<typeof insertUser>[1] = {},
  ): Promise<Account> => signedInUser(app, db, overrides)

  /** A signed-in customer account with a profile created through the API. */
  const accountWithProfile = async (
    overrides: Record<string, unknown> = {},
  ): Promise<
    Account & { profile: Record<string, unknown> & { id: string } }
  > => {
    const owner = await account()
    const response = await post(profileRequest(overrides), owner.authorization)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return { ...owner, profile: response.body.data }
  }

  type NewCustomerRow = typeof customers.$inferInsert

  /** A customer of the ledger as a row, inserted directly; returns its ID. */
  const insertLedgerEntry = async (
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

  /** The customers that are not deleted and have the email. */
  const liveCustomersWithEmail = (email: string) =>
    db
      .select()
      .from(customers)
      .where(and(eq(customers.email, email), isNull(customers.deletedAt)))

  /** What the account says of its customer, and when the account's row was written last. */
  const linkOf = async (userId: string) => {
    const [row] = await db
      .select({
        customerId: users.customerId,
        writtenAt: epochMs(users.updatedAt),
      })
      .from(users)
      .where(eq(users.id, userId))
    if (row === undefined) {
      throw new Error(`No user ${userId} is stored`)
    }
    return row
  }

  /** Every link between an account and a customer, as the accounts state it. */
  const storedLinks = () =>
    db
      .select({ id: users.id, customerId: users.customerId })
      .from(users)
      .orderBy(asc(users.id))

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

  /** Everyone who is signed in and has no profile to speak of: they keep the ledger, or nothing. */
  const notCustomers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of a salon', member('owner')],
    ['a manager of a salon', member('manager')],
    ['a staff member of a salon', member('staff')],
    [
      'a staff member whose staff record is deleted',
      member('staff', { deletedAt: '2026-11-01T00:00:00.000Z' }),
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
      'an access token of a customer that has run out',
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

  describe('POST /api/v1/customers/me', () => {
    it('creates the profile as a new customer of the ledger with the email of the account, and links the two', async () => {
      const owner = await account({ email: 'hanako.yamada@example.com' })
      const linkBefore = await linkOf(owner.id)

      const response = await post(profileRequest(), owner.authorization)

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.headers['location']).toBe(ME)
      expect(response.body).toEqual({
        data: {
          ...profileRequest(),
          ...assignedToNewProfile,
          id: expect.stringMatching(UUID),
          email: 'hanako.yamada@example.com',
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: ME },
      })
      expect(Object.keys(response.body.data).sort()).toEqual(
        PROFILE_PROPERTIES.toSorted(),
      )
      const rows = await storedCustomers()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        ...profileRequest(),
        ...assignedToNewProfile,
        ...staffSideOfNewEntry,
        id: response.body.data.id,
        email: 'hanako.yamada@example.com',
        userId: owner.id,
      })
      const link = await linkOf(owner.id)
      expect(link.customerId).toBe(response.body.data.id)
      expect(link.writtenAt).toBeGreaterThan(linkBefore.writtenAt)
    })

    it('stores null for what the customer leaves unset', async () => {
      const owner = await account()

      const response = await post(profileRequest(unset), owner.authorization)

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(unset)
      expect(await storedCustomer(response.body.data.id)).toMatchObject(unset)
    })

    it('shows the new profile to the staff as a customer of the ledger, linked to the account', async () => {
      const owner = await account()
      const created = await post(profileRequest(), owner.authorization)

      const inLedger = await authorized(
        request(app).get(`${CUSTOMERS}/${created.body.data.id}`),
        await member('staff')(),
      )

      expect(inLedger.status).toBe(200)
      expect(inLedger.body.data).toEqual({
        ...created.body.data,
        notes: null,
        internalNotes: null,
        tags: [],
        referredBy: null,
        isActive: true,
        customerStatus: 'active',
        lifetimeValue: 0,
        noShowCount: 0,
        cancellationCount: 0,
        userId: owner.id,
      })
    })

    it('makes the customer that the ledger has under the email of the account the profile: what the request states replaces the entry, what it leaves null stays', async () => {
      const owner = await account()
      const entry = await insertLedgerEntry({
        email: owner.email,
        firstName: 'Ledger',
        lastName: 'Entry',
        firstNameKana: 'レジャー',
        phoneNumber: '03-1111-2222',
        alternativePhone: '03-3333-4444',
        birthDate: '1985-05-05',
        gender: 'other',
        occupation: 'Baker',
        preferences: { preferredServices: ['spa'], notes: 'Likes tea' },
        allowMarketing: false,
        allowSms: true,
        allowEmail: false,
        membershipTier: 'gold',
        loyaltyPoints: 120,
        lifetimeValue: 54_000,
        visitCount: 12,
        firstVisitDate: '2025-01-10',
        lastVisitDate: '2026-11-01',
        notes: 'Regular since 2020',
        internalNotes: 'Pays in cash',
        tags: ['vip'],
        referralCode: 'LEDGER2020',
        hairType: 'wavy',
        customerStatus: 'vip',
        createdAt: '2026-11-01T09:00:00.000Z',
        updatedAt: '2026-11-01T09:00:00.000Z',
      })

      const response = await post(
        profileRequest({
          ...unset,
          lastNameKana: 'ヤマダ',
          city: '港区',
        }),
        owner.authorization,
      )

      expect(response.status).toBe(201)
      expect(response.body.data).toEqual({
        id: entry,
        email: owner.email,
        // stated by the request
        firstName: 'Hanako',
        lastName: 'Yamada',
        lastNameKana: 'ヤマダ',
        phoneNumber: '090-1234-5678',
        city: '港区',
        allowMarketing: true,
        allowSms: false,
        allowEmail: true,
        // null in the request: the entry's
        firstNameKana: 'レジャー',
        alternativePhone: '03-3333-4444',
        birthDate: '1985-05-05',
        gender: 'other',
        occupation: 'Baker',
        preferences: { preferredServices: ['spa'], notes: 'Likes tea' },
        // null in both
        postalCode: null,
        prefecture: null,
        address: null,
        building: null,
        // never the customer's to state
        membershipTier: 'gold',
        loyaltyPoints: 120,
        referralCode: 'LEDGER2020',
        firstVisitDate: '2025-01-10',
        lastVisitDate: '2026-11-01',
        visitCount: 12,
        hairType: 'wavy',
        hairThickness: null,
        scalpCondition: null,
        createdAt: '2026-11-01T09:00:00.000Z',
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      const rows = await storedCustomers()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        id: entry,
        userId: owner.id,
        lifetimeValue: 54_000,
        notes: 'Regular since 2020',
        internalNotes: 'Pays in cash',
        tags: ['vip'],
        customerStatus: 'vip',
        isActive: true,
        deletedAt: null,
      })
      expect(await hasMoved(entry)).toBe(true)
      expect(await linkOf(owner.id)).toMatchObject({ customerId: entry })
    })

    it('takes a customer of the ledger whatever the staff say of it: inactive and blacklisted stay as they are', async () => {
      const owner = await account()
      const entry = await insertLedgerEntry({
        email: owner.email,
        isActive: false,
        customerStatus: 'blacklisted',
      })

      const response = await post(profileRequest(), owner.authorization)

      expect(response.status).toBe(201)
      expect(response.body.data.id).toBe(entry)
      expect(await storedCustomer(entry)).toMatchObject({
        userId: owner.id,
        isActive: false,
        customerStatus: 'blacklisted',
      })
    })

    it('takes an entry that names the account already', async () => {
      const owner = await account()
      const entry = await insertLedgerEntry({
        email: owner.email,
        userId: owner.id,
      })

      const response = await post(profileRequest(), owner.authorization)

      expect(response.status).toBe(201)
      expect(response.body.data.id).toBe(entry)
      expect(await linkOf(owner.id)).toMatchObject({ customerId: entry })
    })

    it('does not take a deleted customer with the email of the account: the profile is a new customer', async () => {
      const owner = await account()
      const deleted = await insertLedgerEntry({
        email: owner.email,
        notes: 'Left in 2024',
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      const before = await storedCustomer(deleted)

      const response = await post(profileRequest(), owner.authorization)

      expect(response.status).toBe(201)
      expect(response.body.data.id).not.toBe(deleted)
      expect(response.body.data).toMatchObject(assignedToNewProfile)
      expect(await storedCustomer(deleted)).toEqual(before)
      expect(await liveCustomersWithEmail(owner.email)).toHaveLength(1)
      expect(await linkOf(owner.id)).toMatchObject({
        customerId: response.body.data.id,
      })
    })

    it('leaves the customers of other emails alone, whoever they belong to', async () => {
      const other = await accountWithProfile()
      const unclaimed = await insertLedgerEntry()
      const before = await storedCustomers()
      const owner = await account()

      const response = await post(profileRequest(), owner.authorization)

      expect(response.status).toBe(201)
      const after = await storedCustomers()
      expect(after).toHaveLength(before.length + 1)
      expect(after.filter(({ id }) => id !== response.body.data.id)).toEqual(
        before,
      )
      expect(await linkOf(other.id)).toMatchObject({
        customerId: other.profile.id,
      })
      expect((await storedCustomer(unclaimed)).userId).toBeNull()
    })

    it.each([
      ['a request that is fine', profileRequest()],
      ['a request that is not', { firstName: '' }],
    ])(
      'answers an account that has a profile with 409, given %s, and changes nothing',
      async (_case, body) => {
        const owner = await accountWithProfile()
        const before = await storedCustomers()

        const response = await post(body, owner.authorization)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(ALREADY_HAS_PROFILE)
        expect(await storedCustomers()).toEqual(before)
        expect(await linkOf(owner.id)).toMatchObject({
          customerId: owner.profile.id,
        })
      },
    )

    it.each([
      ['the ledger has no customer with its email', false],
      ['the ledger has a customer with its email', true],
    ])(
      'answers an account that has not confirmed its email address with 409 when %s, and writes nothing',
      async (_case, withEntry) => {
        const owner = await account({ emailVerified: false })
        if (withEntry) {
          await insertLedgerEntry({ email: owner.email })
        }
        const before = await storedCustomers()
        const linkBefore = await linkOf(owner.id)

        const response = await post(profileRequest(), owner.authorization)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(EMAIL_NOT_CONFIRMED)
        expect(await storedCustomers()).toEqual(before)
        expect(await linkOf(owner.id)).toEqual({
          ...linkBefore,
          customerId: null,
        })
      },
    )

    it('answers with 409 when the customer with the email of the account belongs to another account, and changes nothing', async () => {
      const other = await accountWithProfile()
      const owner = await account()
      await db
        .update(customers)
        .set({ email: owner.email })
        .where(eq(customers.id, other.profile.id))
      const before = await storedCustomers()

      const response = await post(profileRequest(), owner.authorization)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(ENTRY_OF_ANOTHER_ACCOUNT)
      expect(await storedCustomers()).toEqual(before)
      expect(await linkOf(owner.id)).toMatchObject({ customerId: null })
      expect(await linkOf(other.id)).toMatchObject({
        customerId: other.profile.id,
      })
    })

    it.each(violations)(
      'rejects %s with 400 and writes nothing',
      async (_case, change, expected) => {
        const owner = await account()

        const response = await post(profileRequest(change), owner.authorization)

        expectProblem(response, badRequest)
        expect(brokenRules(response).sort()).toEqual(expected.toSorted())
        expect(await storedCustomers()).toEqual([])
        expect(await linkOf(owner.id)).toMatchObject({ customerId: null })
      },
    )

    it.each(Object.keys(profileRequest()))(
      'rejects a request that leaves %s out',
      async (property) => {
        const owner = await account()
        const body = Object.fromEntries(
          Object.entries(profileRequest()).filter(
            ([name]) => name !== property,
          ),
        )

        const response = await post(body, owner.authorization)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toHaveLength(1)
        expect(brokenRules(response)[0]).toMatch(
          new RegExp(`^${property}:invalid_`),
        )
        expect(await storedCustomers()).toEqual([])
      },
    )

    it('reports every broken rule of a request at once', async () => {
      const owner = await account()

      const response = await post(
        profileRequest({
          firstName: '',
          gender: 'unknown',
          membershipTier: 'vip',
        }),
        owner.authorization,
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response).sort()).toEqual([
        'firstName:invalid_format',
        'gender:invalid_value',
        'membershipTier:unrecognized_keys',
      ])
    })
  })

  describe('GET /api/v1/customers/me', () => {
    it('returns the profile with its link, as the creation returned it', async () => {
      const owner = await accountWithProfile()

      const response = await get(owner.authorization)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: owner.profile,
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: ME },
      })
    })

    it('shows what the salon decided and counted, and nothing of what the staff keep to themselves', async () => {
      const owner = await accountWithProfile()
      await db
        .update(customers)
        .set({
          email: 'changed.by.staff@example.com',
          membershipTier: 'platinum',
          loyaltyPoints: 350,
          lifetimeValue: 98_000,
          referralCode: 'HANAKO2026',
          firstVisitDate: '2025-01-10',
          lastVisitDate: '2026-11-01',
          visitCount: 12,
          noShowCount: 1,
          cancellationCount: 2,
          hairType: 'curly',
          hairThickness: 'thick',
          scalpCondition: 'oily',
          notes: 'Talks a lot',
          internalNotes: 'Complained twice',
          tags: ['difficult'],
          isActive: false,
          customerStatus: 'blacklisted',
        })
        .where(eq(customers.id, owner.profile.id))

      const response = await get(owner.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...owner.profile,
        email: 'changed.by.staff@example.com',
        membershipTier: 'platinum',
        loyaltyPoints: 350,
        referralCode: 'HANAKO2026',
        firstVisitDate: '2025-01-10',
        lastVisitDate: '2026-11-01',
        visitCount: 12,
        hairType: 'curly',
        hairThickness: 'thick',
        scalpCondition: 'oily',
      })
      for (const property of STAFF_ONLY_PROPERTIES) {
        expect(Object.keys(response.body.data)).not.toContain(property)
      }
      for (const kept of ['Talks a lot', 'Complained twice', 'difficult']) {
        expect(JSON.stringify(response.body)).not.toContain(kept)
      }
    })

    it('returns the customer that the account names, when the customer does not name the account', async () => {
      const entry = await insertLedgerEntry({ firstName: 'Linked' })
      const owner = await account({ customerId: entry })

      const response = await get(owner.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id: entry,
        firstName: 'Linked',
      })
    })

    it('returns each account its own profile', async () => {
      const first = await accountWithProfile({ firstName: 'First' })
      const second = await accountWithProfile({ firstName: 'Second' })

      const responses = [
        await get(first.authorization),
        await get(second.authorization),
      ]

      expect(responses.map(({ body }) => body.data)).toEqual([
        first.profile,
        second.profile,
      ])
    })

    it('answers an account without a profile with 404 that names the account', async () => {
      const owner = await account()

      const response = await get(owner.authorization)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Customer profile of user ${owner.id} was not found`,
      )
    })

    it('answers with the same 404 when the customer was deleted behind the link of the account', async () => {
      const owner = await accountWithProfile()
      await db
        .update(customers)
        .set({ deletedAt: sql`now()` })
        .where(eq(customers.id, owner.profile.id))

      const response = await get(owner.authorization)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Customer profile of user ${owner.id} was not found`,
      )
    })

    it('answers 500 without details when the stored customer has a time that is no instant', async () => {
      const owner = await accountWithProfile()
      await db
        .update(customers)
        .set({ createdAt: 'infinity' })
        .where(eq(customers.id, owner.profile.id))

      const response = await get(owner.authorization)

      expectProblem(response, databaseProblem)
      expect(response.body.detail).toBeNull()
      expect(JSON.stringify(response.body)).not.toContain('infinity')
    })
  })

  describe('PATCH /api/v1/customers/me', () => {
    it('changes the properties of the request, leaves the others and what the staff keep, and returns the profile', async () => {
      const owner = await accountWithProfile()
      await db
        .update(customers)
        .set({
          notes: 'Talks a lot',
          tags: ['vip'],
          membershipTier: 'gold',
          customerStatus: 'vip',
        })
        .where(eq(customers.id, owner.profile.id))
      const before = await storedCustomer(owner.profile.id)

      const response = await patch(
        { lastName: 'Sato', building: null, allowSms: true },
        owner.authorization,
      )

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...owner.profile,
          lastName: 'Sato',
          building: null,
          allowSms: true,
          membershipTier: 'gold',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.stringMatching(UUID),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: ME },
      })
      expect(await storedCustomer(owner.profile.id)).toEqual({
        ...before,
        lastName: 'Sato',
        building: null,
        allowSms: true,
        updatedAt: expect.any(String),
      })
      expect(await hasMoved(owner.profile.id)).toBe(true)
      expect((await get(owner.authorization)).body.data).toEqual(
        response.body.data,
      )
    })

    it('unsets every property that may be unset', async () => {
      const owner = await accountWithProfile()

      const response = await patch(unset, owner.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject(unset)
      expect(await storedCustomer(owner.profile.id)).toMatchObject(unset)
    })

    it('changes every property at once', async () => {
      const owner = await accountWithProfile()
      const changes = {
        firstName: 'Yuki',
        lastName: 'Tanaka',
        firstNameKana: 'ユキ',
        lastNameKana: 'タナカ',
        phoneNumber: '080-1111-2222',
        alternativePhone: null,
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        address: '神宮前1-1-1',
        building: null,
        birthDate: '1988-12-31',
        gender: 'prefer_not_to_say',
        occupation: null,
        preferences: { preferredServices: ['perm'], notes: null },
        allowMarketing: false,
        allowSms: true,
        allowEmail: false,
      }

      const response = await patch(changes, owner.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject(changes)
      expect(await storedCustomer(owner.profile.id)).toMatchObject(changes)
    })

    it('changes the profile of the account and no other customer', async () => {
      const other = await accountWithProfile()
      const unclaimed = await insertLedgerEntry()
      const owner = await accountWithProfile()
      const before = await storedCustomers()

      const response = await patch(
        { occupation: 'Changed' },
        owner.authorization,
      )

      expect(response.status).toBe(200)
      const after = await storedCustomers()
      expect(after.filter(({ id }) => id !== owner.profile.id)).toEqual(
        before.filter(({ id }) => id !== owner.profile.id),
      )
      expect(
        after
          .filter(({ occupation }) => occupation === 'Changed')
          .map(({ id }) => id),
      ).toEqual([owner.profile.id])
      expect([other.profile.id, unclaimed]).not.toContain(owner.profile.id)
    })

    it.each([
      ['a request that changes nothing', {}, [':custom']],
      ...violations,
    ])(
      'rejects %s with 400 and changes nothing',
      async (_case, body, expected) => {
        const owner = await accountWithProfile()
        const before = await storedCustomers()

        const response = await patch(body, owner.authorization)

        expectProblem(response, badRequest)
        expect(brokenRules(response).sort()).toEqual(expected.toSorted())
        expect(await storedCustomers()).toEqual(before)
      },
    )

    it.each([
      ['a request that is fine', { lastName: 'Sato' }],
      ['a request that is not', {}],
    ])(
      'answers an account without a profile with 404, given %s',
      async (_case, body) => {
        const owner = await account()

        const response = await patch(body, owner.authorization)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Customer profile of user ${owner.id} was not found`,
        )
        expect(await storedCustomers()).toEqual([])
      },
    )

    it('answers with 404 and changes nothing when the customer was deleted behind the link of the account', async () => {
      const owner = await accountWithProfile()
      await db
        .update(customers)
        .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
        .where(eq(customers.id, owner.profile.id))
      const before = await storedCustomers()

      const response = await patch({ lastName: 'Sato' }, owner.authorization)

      expectProblem(response, notFound)
      expect(await storedCustomers()).toEqual(before)
    })
  })

  describe('who has a profile', () => {
    it.each(unauthenticated)(
      'answers %s with 401 in every operation before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const owner = await accountWithProfile()
        const authorization = await tokenOf()
        const before = await storedCustomers()

        const responses = [
          await get(authorization),
          await post(profileRequest(), authorization),
          await post({}, authorization),
          await patch({ lastName: 'Sato' }, authorization),
          await patch({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedCustomers()).toEqual(before)
        expect(await linkOf(owner.id)).toMatchObject({
          customerId: owner.profile.id,
        })
      },
    )

    it.each(notCustomers)(
      'forbids %s every operation, before looking at the body, and writes nothing',
      async (_case, signInAs) => {
        const authorization = await signInAs()
        const links = await storedLinks()

        const responses = [
          await get(authorization),
          await post(profileRequest(), authorization),
          await post({ firstName: '' }, authorization),
          await patch({ lastName: 'Sato' }, authorization),
          await patch({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await storedCustomers()).toEqual([])
        expect(await storedLinks()).toEqual(links)
      },
    )

    it("forbids an administrator even when the ledger has a customer with the administrator's email", async () => {
      const admin = await signedInUser(app, db, { role: 'admin' })
      const entry = await insertLedgerEntry({ email: admin.email })

      const response = await post(profileRequest(), admin.authorization)

      expectProblem(response, forbidden)
      expect((await storedCustomer(entry)).userId).toBeNull()
      expect(await linkOf(admin.id)).toMatchObject({ customerId: null })
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const owner = await accountWithProfile()
      const notJson = (call: Test, authorization: string | null): Test =>
        authorized(call, authorization)
          .set('Content-Type', 'application/json')
          .send('{"firstName": "Hanako"')

      const responses = [
        await notJson(request(app).post(ME), null),
        await notJson(request(app).patch(ME), null),
        await authorized(request(app).post(ME), null)
          .set('Content-Type', 'text/plain')
          .send('Hanako Yamada'),
        await notJson(request(app).post(ME), asAdmin),
        await notJson(request(app).patch(ME), owner.authorization),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '415 2002',
        '400 2002',
        '400 2002',
      ])
    })

    it('checks a creation in order: the token, the account, the profile it has, the request, the email of the account', async () => {
      const withProfile = await accountWithProfile()
      const unconfirmed = await account({ emailVerified: false })

      const responses = [
        await post({}, null),
        await post({}, asAdmin),
        await post({}, withProfile.authorization),
        await post({}, unconfirmed.authorization),
        await post(profileRequest(), unconfirmed.authorization),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '409 3003',
        '400 2001',
        '409 3003',
      ])
    })

    it('does not take "me" for anything but the profile: the other methods on it are the ledger\'s, with "me" as an ID that is none', async () => {
      const owner = await accountWithProfile()

      const responses = [
        await authorized(request(app).delete(ME), owner.authorization),
        await authorized(request(app).delete(ME), asAdmin),
        await authorized(request(app).put(ME), owner.authorization).send({}),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '403 1005',
        '400 2001',
        '404 3001',
      ])
      expect(await linkOf(owner.id)).toMatchObject({
        customerId: owner.profile.id,
      })
    })
  })

  describe('a customer of the ledger who has an account is deleted', () => {
    it('takes the profile from the account: the account is without one, the deleted customer keeps naming the account', async () => {
      const owner = await accountWithProfile()
      const other = await accountWithProfile()
      const linkBefore = await linkOf(owner.id)
      const otherBefore = await linkOf(other.id)

      const deleted = await removeFromLedger(owner.profile.id)

      expect(deleted.status).toBe(204)
      const link = await linkOf(owner.id)
      expect(link.customerId).toBeNull()
      expect(link.writtenAt).toBeGreaterThan(linkBefore.writtenAt)
      expect(await linkOf(other.id)).toEqual(otherBefore)
      expect(await storedCustomer(owner.profile.id)).toMatchObject({
        userId: owner.id,
        deletedAt: expect.any(String),
      })
      expect(await linkOf(other.id)).toMatchObject({
        customerId: other.profile.id,
      })
      expectProblem(await get(owner.authorization), notFound)
      expectProblem(
        await patch({ lastName: 'Sato' }, owner.authorization),
        notFound,
      )
      expect((await get(other.authorization)).status).toBe(200)
    })

    it('lets the account create a profile again: a new customer with the same email', async () => {
      const owner = await accountWithProfile()
      await removeFromLedger(owner.profile.id)

      const response = await post(
        profileRequest({ firstName: 'Again' }),
        owner.authorization,
      )

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject({
        ...assignedToNewProfile,
        firstName: 'Again',
        email: owner.email,
      })
      expect(response.body.data.id).not.toBe(owner.profile.id)
      expect(await liveCustomersWithEmail(owner.email)).toHaveLength(1)
      expect(await linkOf(owner.id)).toMatchObject({
        customerId: response.body.data.id,
      })
      expect((await get(owner.authorization)).body.data).toEqual(
        response.body.data,
      )
    })

    it('says no longer who the customer of the account is', async () => {
      const owner = await accountWithProfile()
      const me = () =>
        authorized(request(app).get('/api/v1/auth/me'), owner.authorization)
      const before = await me()

      await removeFromLedger(owner.profile.id)
      const after = await me()

      expect(before.body.data.customerId).toBe(owner.profile.id)
      expect(after.status).toBe(200)
      expect(after.body.data.customerId).toBeNull()
    })

    it('changes no account when the customer has none, and none a second time', async () => {
      const owner = await accountWithProfile()
      const unclaimed = await insertLedgerEntry()
      const links = await storedLinks()

      const responses = [
        await removeFromLedger(unclaimed),
        await removeFromLedger(unclaimed),
      ]

      expect(responses.map(({ status }) => status)).toEqual([204, 404])
      expect(await storedLinks()).toEqual(links)
      expect((await linkOf(owner.id)).customerId).toBe(owner.profile.id)
    })
  })

  describe('requests at the same moment', () => {
    it('gives an account one profile when it creates several at once, and answers the others with 409', async () => {
      for (let round = 0; round < 5; round += 1) {
        const owner = await account()

        const responses = await Promise.all(
          [0, 1, 2, 3].map(() => post(profileRequest(), owner.authorization)),
        )

        expect(responses.map(statusAndCode).sort()).toEqual([
          '201',
          '409 3003',
          '409 3003',
          '409 3003',
        ])
        const rows = await liveCustomersWithEmail(owner.email)
        expect(rows.map(({ userId }) => userId)).toEqual([owner.id])
        expect(await linkOf(owner.id)).toMatchObject({
          customerId: rows[0]?.id,
        })
      }
    })

    it('lets an account take a customer of the ledger over once when it creates several profiles at once, and answers the others with 409', async () => {
      for (let round = 0; round < 5; round += 1) {
        const owner = await account()
        const entry = await insertLedgerEntry({ email: owner.email })

        const responses = await Promise.all(
          [0, 1, 2, 3].map((index) =>
            post(
              profileRequest({ occupation: `Request ${index}` }),
              owner.authorization,
            ),
          ),
        )

        expect(responses.map(statusAndCode).sort()).toEqual([
          '201',
          '409 3003',
          '409 3003',
          '409 3003',
        ])
        const taken = responses.find(({ status }) => status === 201)
        expect(taken?.body.data.id).toBe(entry)
        // The customer is as the one request that succeeded wrote it.
        expect((await storedCustomer(entry)).occupation).toBe(
          taken?.body.data.occupation,
        )
        expect(await linkOf(owner.id)).toMatchObject({ customerId: entry })
      }
    })

    it('leaves one customer with the email when an account creates its profile while the staff add a customer with that email', async () => {
      for (let round = 0; round < 5; round += 1) {
        const owner = await account()

        const [profile, entry] = await Promise.all([
          post(profileRequest(), owner.authorization),
          authorized(request(app).post(CUSTOMERS), asAdmin).send({
            ...profileRequest(),
            email: owner.email,
            membershipTier: 'gold',
            notes: null,
            internalNotes: null,
            tags: [],
            referredBy: null,
            referralCode: null,
            isActive: true,
            hairType: null,
            hairThickness: null,
            scalpCondition: null,
            customerStatus: 'active',
          }),
        ])

        expect(['201 / 201', '201 / 409 3002', '409 3003 / 201']).toContain(
          `${statusAndCode(profile)} / ${statusAndCode(entry)}`,
        )
        const rows = await liveCustomersWithEmail(owner.email)
        expect(rows).toHaveLength(1)
        expect(await linkOf(owner.id)).toMatchObject({
          customerId: profile.status === 201 ? (rows[0]?.id ?? '') : null,
        })
        expect(rows[0]?.userId).toBe(profile.status === 201 ? owner.id : null)
      }
    })

    it('leaves the account without a profile, or with a new customer, when a customer is claimed and deleted at once', async () => {
      for (let round = 0; round < 5; round += 1) {
        const owner = await account()
        const entry = await insertLedgerEntry({ email: owner.email })

        const [profile, deletion] = await Promise.all([
          post(profileRequest(), owner.authorization),
          removeFromLedger(entry),
        ])

        expect(statusAndCode(profile)).toBe('201')
        expect(statusAndCode(deletion)).toBe('204')
        const rows = await liveCustomersWithEmail(owner.email)
        const link = await linkOf(owner.id)
        expect((await storedCustomer(entry)).deletedAt).not.toBeNull()
        expect(rows.map(({ id }) => id)).toEqual(
          link.customerId === null ? [] : [link.customerId],
        )
        expect(link.customerId).not.toBe(entry)
      }
    })
  })

  describe('CustomerRepository.createProfile', () => {
    const repository = () => new CustomerRepository(db)
    const userId = (id: string) => userIdSchema.parse(id)

    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    /** What the creation of a profile writes: a new entry, or these changes of an entry that is there. */
    const write = (): CustomerProfileWrite => ({
      newEntry: {
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
      },
      claim: { firstName: 'Hanako', lastName: 'Yamada' },
    })

    it('inserts the new entry with the email of the account when the ledger has none, and returns the row', async () => {
      const user = await insertUser(db)

      const creation = dataOf(
        await repository().createProfile(userId(user.id), write()),
      )

      expect(creation).toEqual({
        type: 'created',
        customer: await storedCustomer(
          creation.type === 'created' ? creation.customer.id : '',
        ),
      })
      expect(await storedCustomers()).toEqual([
        expect.objectContaining({
          ...write().newEntry,
          email: user.email,
          userId: user.id,
        }),
      ])
    })

    it('writes the claim, and not the new entry, to the entry the ledger has', async () => {
      const user = await insertUser(db)
      const entry = await insertLedgerEntry({
        email: user.email,
        firstName: 'Ledger',
        phoneNumber: '03-1111-2222',
        membershipTier: 'gold',
        tags: ['vip'],
        allowSms: false,
      })

      const creation = dataOf(
        await repository().createProfile(userId(user.id), write()),
      )

      expect(creation).toMatchObject({
        type: 'created',
        customer: {
          id: entry,
          userId: user.id,
          firstName: 'Hanako',
          lastName: 'Yamada',
          phoneNumber: '03-1111-2222',
          membershipTier: 'gold',
          tags: ['vip'],
          allowSms: false,
        },
      })
      expect(await storedCustomers()).toHaveLength(1)
    })

    it.each<[string, () => Promise<string>]>([
      ['a user that does not exist', async () => UNKNOWN_ID],
      [
        'an administrator',
        async () => (await insertUser(db, { role: 'admin' })).id,
      ],
      [
        'a staff user',
        async () => (await insertMember(db, 'staff', await insertSalon(db))).id,
      ],
      [
        'a deleted customer account',
        async () =>
          (await insertUser(db, { deletedAt: '2026-11-01T00:00:00.000Z' })).id,
      ],
    ])(
      'refuses %s as no customer account and writes nothing',
      async (_case, idOf) => {
        const id = await idOf()
        const links = await storedLinks()

        const creation = dataOf(
          await repository().createProfile(userId(id), write()),
        )

        expect(creation).toEqual({ type: 'notACustomerAccount' })
        expect(await storedCustomers()).toEqual([])
        expect(await storedLinks()).toEqual(links)
      },
    )

    it("refuses an account that has a customer, one that has not confirmed its address, and one whose entry is another account's, in that order", async () => {
      const linked = await insertUser(db, {
        emailVerified: false,
        customerId: await insertLedgerEntry(),
      })
      const unconfirmed = await insertUser(db, { emailVerified: false })
      await insertLedgerEntry({
        email: unconfirmed.email,
        userId: (await insertUser(db)).id,
      })
      const confirmed = await insertUser(db)
      await insertLedgerEntry({
        email: confirmed.email,
        userId: (await insertUser(db)).id,
      })
      const before = await storedCustomers()
      const links = await storedLinks()

      const creations = [
        dataOf(await repository().createProfile(userId(linked.id), write())),
        dataOf(
          await repository().createProfile(userId(unconfirmed.id), write()),
        ),
        dataOf(await repository().createProfile(userId(confirmed.id), write())),
      ]

      expect(creations).toEqual([
        { type: 'alreadyHasProfile' },
        { type: 'emailNotVerified' },
        { type: 'entryOfAnotherAccount' },
      ])
      expect(await storedCustomers()).toEqual(before)
      expect(await storedLinks()).toEqual(links)
    })

    it('reports a customer with the email that is added at the same moment as a conflict, and links nothing', async () => {
      const user = await insertUser(db)
      const linkBefore = await linkOf(user.id)
      const client = getTestDbClient()
      const added = Promise.withResolvers<void>()
      const mayCommit = Promise.withResolvers<void>()
      // Another connection adds a customer with the email and does not
      // commit yet: the creation of the profile sees no entry, inserts one
      // and has to wait for the outcome of the other insert.
      const adding = client.begin(async (transaction) => {
        await transaction`
          INSERT INTO customers ("firstName", "lastName", email, "phoneNumber", tags)
          VALUES ('Taro', 'Suzuki', ${user.email}, '03-0000-0000', '{}')
        `
        added.resolve()
        await mayCommit.promise
      })
      await added.promise

      const pending = repository().createProfile(userId(user.id), write())
      const isWaiting = async (): Promise<boolean> => {
        const [activity] = await client<{ waiting: number }[]>`
          SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'
        `
        return (activity?.waiting ?? 0) > 0
      }
      for (
        let attempt = 0;
        attempt < 200 && !(await isWaiting());
        attempt += 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      mayCommit.resolve()
      await adding
      const result = await pending

      expect(result).toEqual({
        type: 'error',
        error: {
          type: 'conflict',
          message:
            'A customer with the email address of this account was registered at the same moment; try again',
        },
      })
      expect(
        (await liveCustomersWithEmail(user.email)).map(({ userId: id }) => id),
      ).toEqual([null])
      expect(await linkOf(user.id)).toEqual(linkBefore)
    })
  })

  describe('the constraints of the database', () => {
    it('keeps the account unique among the customers that are not deleted, and lets deleted customers and a live one name one account', async () => {
      const user = await insertUser(db)
      await insertLedgerEntry({
        userId: user.id,
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await insertLedgerEntry({
        userId: user.id,
        deletedAt: '2026-11-02T00:00:00.000Z',
      })
      await insertLedgerEntry({ userId: user.id })

      await expect(
        insertLedgerEntry({ userId: user.id }),
      ).rejects.toMatchObject({
        cause: expect.objectContaining({
          code: '23505',
          constraint_name: 'customers_user_unique',
        }),
      })
      expect(await db.$count(customers)).toBe(3)
    })

    it('lets any number of customers name no account', async () => {
      await insertLedgerEntry()
      await insertLedgerEntry()

      expect(await db.$count(customers, isNull(customers.userId))).toBe(2)
    })
  })
})
