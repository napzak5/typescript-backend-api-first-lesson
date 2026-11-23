import {
  customerPreferences,
  customers,
  staff,
} from '@beauty-salon-backend/database'
import {
  customerIdSchema,
  type DomainError,
} from '@beauty-salon-backend/domain'
import { CustomerPreferencesRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { customerPreferencesMessages } from '@beauty-salon-shared/i18n/messages/api'
import { asc, eq, sql } from 'drizzle-orm'
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
} from '../../../__tests__/_shared/auth-helpers'
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
} from '../../../__tests__/_shared/test-helpers'

const SALONS = '/api/v1/salons'
const CUSTOMERS = '/api/v1/customers'
const ME = `${CUSTOMERS}/me`
const OWN = `${ME}/preferences`

/** Where the ledger keeps the preferences of a customer. */
const preferencesOf = (customerId: string): string =>
  `${CUSTOMERS}/${customerId}/preferences`

/** A UUID that neither a customer nor a staff member has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/** Another UUID that neither a customer nor a staff member has. */
const ANOTHER_UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const databaseProblem = { status: 500, code: '4003', type: 'database' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID_UPDATE = 'Invalid customer preferences update'

/** The preferences of a customer who has stated none: exactly the properties of CustomerPreferencesResponse. */
const EMPTY = {
  preferredStaffId: null,
  preferredTimeSlots: [],
  avoidStaffIds: [],
  stylePreferences: null,
  communicationStyle: null,
  specialRequests: null,
}

const PROPERTIES = Object.keys(EMPTY)

const SLOTS = [
  { startTime: '10:00', endTime: '12:00' },
  { startTime: '18:00', endTime: '20:30' },
]

const STYLE = {
  preferredLength: 'ショート',
  preferredColors: ['アッシュ', 'ブラウン'],
  avoidStyles: ['パーマ'],
  inspirationImages: ['https://images.example.com/short.jpg'],
}

/** A value for every property, with the staff members given. */
const stated = (preferredStaffId: string | null, avoidStaffIds: string[]) => ({
  preferredStaffId,
  preferredTimeSlots: SLOTS,
  avoidStaffIds,
  stylePreferences: STYLE,
  communicationStyle: '静かに過ごしたい',
  specialRequests: 'ドリンクは不要です',
})

/** Another value for every property than `stated` has. */
const restated = (
  preferredStaffId: string | null,
  avoidStaffIds: string[],
) => ({
  preferredStaffId,
  preferredTimeSlots: [{ startTime: '09:00', endTime: '09:30' }],
  avoidStaffIds,
  stylePreferences: {
    preferredLength: null,
    preferredColors: [],
    avoidStyles: ['刈り上げ', 'ブリーチ'],
    inspirationImages: [],
  },
  communicationStyle: 'たくさん話したい',
  specialRequests: '車椅子で来店します',
})

const urlOfLength = (length: number): string =>
  `https://example.com/${'a'.repeat(length - 'https://example.com/'.length)}`

/** Requests that break a rule of the request alone, with the rules they break. */
const violations: [string, object, string[]][] = [
  [
    'a preferred staff member that is no ID',
    { preferredStaffId: 'hanako' },
    ['preferredStaffId:invalid_format'],
  ],
  [
    'a preferred staff member that is a number',
    { preferredStaffId: 7 },
    ['preferredStaffId:invalid_type'],
  ],
  [
    'null for the avoided staff members',
    { avoidStaffIds: null },
    ['avoidStaffIds:invalid_type'],
  ],
  [
    'an avoided staff member that is no ID',
    { avoidStaffIds: [UNKNOWN_ID, 'hanako'] },
    ['avoidStaffIds.1:invalid_format'],
  ],
  [
    'an avoided staff member twice, in two cases',
    { avoidStaffIds: [UNKNOWN_ID, UNKNOWN_ID.toUpperCase()] },
    ['avoidStaffIds.1:custom'],
  ],
  [
    'null for the time slots',
    { preferredTimeSlots: null },
    ['preferredTimeSlots:invalid_type'],
  ],
  [
    'a time slot with seconds',
    { preferredTimeSlots: [{ startTime: '10:00:00', endTime: '12:00' }] },
    ['preferredTimeSlots.0.startTime:invalid_format'],
  ],
  [
    'a time slot without an end',
    { preferredTimeSlots: [{ startTime: '10:00' }] },
    ['preferredTimeSlots.0.endTime:invalid_type'],
  ],
  [
    'a time slot that ends before it begins',
    { preferredTimeSlots: [{ startTime: '18:00', endTime: '17:00' }] },
    ['preferredTimeSlots.0.endTime:custom'],
  ],
  [
    'a time slot that ends when it begins',
    { preferredTimeSlots: [{ startTime: '10:00', endTime: '10:00' }] },
    ['preferredTimeSlots.0.endTime:custom'],
  ],
  [
    'time slots that overlap',
    {
      preferredTimeSlots: [
        { startTime: '10:00', endTime: '12:00' },
        { startTime: '11:30', endTime: '13:00' },
      ],
    },
    ['preferredTimeSlots.1:custom'],
  ],
  [
    'a time slot with a day of the week',
    {
      preferredTimeSlots: [
        { startTime: '10:00', endTime: '12:00', dayOfWeek: 'monday' },
      ],
    },
    ['preferredTimeSlots.0.dayOfWeek:unrecognized_keys'],
  ],
  [
    'a style preference without its lists',
    { stylePreferences: { preferredLength: 'ショート' } },
    [
      'stylePreferences.preferredColors:invalid_type',
      'stylePreferences.avoidStyles:invalid_type',
      'stylePreferences.inspirationImages:invalid_type',
    ],
  ],
  [
    'a blank preferred length',
    { stylePreferences: { ...STYLE, preferredLength: ' ' } },
    ['stylePreferences.preferredLength:invalid_format'],
  ],
  [
    'a preferred colour twice',
    {
      stylePreferences: { ...STYLE, preferredColors: ['アッシュ', 'アッシュ'] },
    },
    ['stylePreferences.preferredColors.1:custom'],
  ],
  [
    'a blank style to avoid',
    { stylePreferences: { ...STYLE, avoidStyles: [''] } },
    ['stylePreferences.avoidStyles.0:invalid_format'],
  ],
  [
    'an inspiration image that is no URL',
    { stylePreferences: { ...STYLE, inspirationImages: ['short.jpg'] } },
    ['stylePreferences.inspirationImages.0:invalid_format'],
  ],
  [
    'an inspiration image that is not http or https',
    {
      stylePreferences: {
        ...STYLE,
        inspirationImages: ['ftp://images.example.com/short.jpg'],
      },
    },
    ['stylePreferences.inspirationImages.0:invalid_format'],
  ],
  [
    'an inspiration image of 501 characters',
    { stylePreferences: { ...STYLE, inspirationImages: [urlOfLength(501)] } },
    ['stylePreferences.inspirationImages.0:too_big'],
  ],
  [
    'a style preference that is text',
    { stylePreferences: 'ショート' },
    ['stylePreferences:invalid_type'],
  ],
  [
    'a communication style of 101 characters',
    { communicationStyle: 'あ'.repeat(101) },
    ['communicationStyle:too_big'],
  ],
  [
    'a blank communication style',
    { communicationStyle: '  ' },
    ['communicationStyle:invalid_format'],
  ],
  [
    'a blank special request',
    { specialRequests: '' },
    ['specialRequests:invalid_format'],
  ],
  [
    'a special request that is a list',
    { specialRequests: ['ドリンクは不要です'] },
    ['specialRequests:invalid_type'],
  ],
  [
    'the services, which the ledger entry of the customer holds',
    { preferredServices: ['cut'] },
    ['preferredServices:unrecognized_keys'],
  ],
  [
    'a customer',
    { customerId: UNKNOWN_ID, specialRequests: null },
    ['customerId:unrecognized_keys'],
  ],
  [
    'an ID and a time',
    { id: UNKNOWN_ID, updatedAt: '2026-11-15T00:00:00.000Z' },
    ['id:unrecognized_keys', 'updatedAt:unrecognized_keys'],
  ],
  ['a request that names no property', {}, [':custom']],
  [
    'a list in place of a request',
    [{ specialRequests: null }],
    [':invalid_type'],
  ],
]

/** The status of a response and, for a problem, its code. */
const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** A request for a customer profile that satisfies every rule and states nothing that may be unset. */
const profileRequest = () => ({
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
  allowMarketing: false,
  allowSms: false,
  allowEmail: false,
})

describe('Customer preferences API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of the staff members most tests name. */
  let salonId: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
  })

  type NewStaff = typeof staff.$inferInsert
  type NewPreferencesRow = typeof customerPreferences.$inferInsert

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Reads the preferences of a customer in the ledger; as the admin unless said otherwise. */
  const read = (customerId: string, as: string | null = asAdmin) =>
    authorized(request(app).get(preferencesOf(customerId)), as)

  /** Changes the preferences of a customer in the ledger; as the admin unless said otherwise. */
  const change = (
    customerId: string,
    body: object,
    as: string | null = asAdmin,
  ) => authorized(request(app).patch(preferencesOf(customerId)), as).send(body)

  /** Reads the own preferences; without a token if none is given. */
  const readOwn = (as: string | null) => authorized(request(app).get(OWN), as)

  /** Changes the own preferences; without a token if none is given. */
  const changeOwn = (body: object, as: string | null) =>
    authorized(request(app).patch(OWN), as).send(body)

  /** A staff member who is not deleted, of the salon of the tests unless another is given. */
  const staffMember = (
    overrides: Partial<NewStaff> = {},
    salon: string = salonId,
  ): Promise<string> => insertStaff(db, salon, overrides)

  const removeCustomer = (id: string) =>
    request(app).delete(`${CUSTOMERS}/${id}`).set('Authorization', asAdmin)

  const removeStaff = (id: string, salon: string = salonId) =>
    request(app)
      .delete(`${SALONS}/${salon}/staff/${id}`)
      .set('Authorization', asAdmin)

  /** A row of preferences inserted directly: empty unless stated otherwise. */
  const insertRow = async (
    customerId: string,
    overrides: Partial<NewPreferencesRow> = {},
  ): Promise<void> => {
    await db.insert(customerPreferences).values({
      customerId,
      preferredTimeSlots: [],
      avoidStaffIds: [],
      ...overrides,
    })
  }

  /** Every stored row of preferences. */
  const storedRows = () =>
    db
      .select()
      .from(customerPreferences)
      .orderBy(asc(customerPreferences.customerId))

  /** The stored row of one customer. */
  const storedRowOf = async (customerId: string) => {
    const [row] = await db
      .select()
      .from(customerPreferences)
      .where(eq(customerPreferences.customerId, customerId))
    if (row === undefined) {
      throw new Error(`No preferences of customer ${customerId} are stored`)
    }
    return row
  }

  /** Whether the stored `updatedAt` of the row lies after its `createdAt`. */
  const hasMoved = async (customerId: string): Promise<boolean | undefined> => {
    const [row] = await db
      .select({
        moved: sql<boolean>`${customerPreferences.updatedAt} > ${customerPreferences.createdAt}`,
      })
      .from(customerPreferences)
      .where(eq(customerPreferences.customerId, customerId))
    return row?.moved
  }

  type Account = { id: string; authorization: string }

  /** A signed-in customer account without a profile. */
  const account = async (): Promise<Account> => signedInUser(app, db)

  /** Creates the profile of the account through the API and returns the ID of its customer. */
  const createProfile = async (authorization: string): Promise<string> => {
    const response = await request(app)
      .post(ME)
      .set('Authorization', authorization)
      .send(profileRequest())
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data.id
  }

  /** A signed-in customer account with a profile created through the API. */
  const accountWithProfile = async (): Promise<
    Account & { customerId: string }
  > => {
    const owner = await account()
    return { ...owner, customerId: await createProfile(owner.authorization) }
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      staffOverrides: Partial<NewStaff> = {},
    ): SignInAs =>
    async () => {
      const salon = await insertSalon(db)
      const { email } = await insertMember(db, role, salon, staffOverrides)
      return (await signIn(app, email)).authorization
    }

  /** Everyone who keeps the ledger: an administrator and the members of any salon. */
  const ledgerKeepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of a salon', member('owner')],
    ['a manager of a salon', member('manager')],
    ['a staff member of a salon', member('staff')],
  ]

  /** A member of a salon whose staff record is deleted: an account that reaches no salon. */
  const formerMember = member('staff', {
    deletedAt: '2026-11-01T00:00:00.000Z',
  })

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

  /** IDs that name no staff member a customer may prefer or avoid. */
  const notStaffMembers: [string, () => Promise<string>][] = [
    ['an ID that no staff member has', async () => UNKNOWN_ID],
    [
      'a deleted staff member',
      () => staffMember({ deletedAt: '2026-11-01T00:00:00.000Z' }),
    ],
    [
      'a staff member of a deleted salon',
      async () =>
        staffMember(
          {},
          await insertSalon(db, { deletedAt: '2026-11-01T00:00:00.000Z' }),
        ),
    ],
    ['the ID of a customer', () => insertCustomer(db)],
  ]

  /** Staff members a customer may prefer or avoid, whatever else is true of them. */
  const staffMembersOfAnyKind: [string, () => Promise<string>][] = [
    [
      'a staff member who does not work at the salon now',
      () => staffMember({ isActive: false }),
    ],
    [
      'a staff member who takes no bookings',
      () => staffMember({ canReceiveBookings: false }),
    ],
    [
      'a staff member of another salon',
      async () => staffMember({}, await insertSalon(db)),
    ],
    [
      'a staff member of a salon that is not active',
      async () => staffMember({}, await insertSalon(db, { isActive: false })),
    ],
  ]

  describe('GET /api/v1/customers/:id/preferences', () => {
    it('returns the empty preferences of a customer who has stated none, and stores nothing by reading', async () => {
      const customerId = await insertCustomer(db)

      const response = await read(customerId)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: EMPTY,
        meta: {
          correlationId: response.headers['x-request-id'],
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: preferencesOf(customerId),
          customer: `${CUSTOMERS}/${customerId}`,
        },
      })
      expect(await storedRows()).toEqual([])
    })

    it('returns what is stored of the customer, the six properties and nothing of the row', async () => {
      const customerId = await insertCustomer(db)
      const other = await insertCustomer(db)
      const preferred = await staffMember()
      const avoided = await staffMember()
      await insertRow(customerId, stated(preferred, [avoided]))
      await insertRow(other, restated(avoided, [preferred]))

      const response = await read(customerId)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(stated(preferred, [avoided]))
      expect(Object.keys(response.body.data).toSorted()).toEqual(
        PROPERTIES.toSorted(),
      )
    })

    it('returns a row that states nothing as the empty preferences, like no row', async () => {
      const customerId = await insertCustomer(db)
      await insertRow(customerId)

      const response = await read(customerId)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(EMPTY)
    })

    it.each(ledgerKeepers)(
      'lets %s read the preferences of any customer',
      async (_case, signInAs) => {
        const customerId = await insertCustomer(db)
        await insertRow(customerId, { communicationStyle: '静かに過ごしたい' })

        const response = await read(customerId, await signInAs())

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...EMPTY,
          communicationStyle: '静かに過ごしたい',
        })
      },
    )

    it('answers 404 for a customer that does not exist and for one that is deleted, alike', async () => {
      const deleted = await insertCustomer(db)
      await insertRow(deleted, { specialRequests: 'ドリンクは不要です' })
      expect((await removeCustomer(deleted)).status).toBe(204)

      const responses = [await read(UNKNOWN_ID), await read(deleted)]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses.map(({ body }) => body.detail)).toEqual([
        `Customer ${UNKNOWN_ID} was not found`,
        `Customer ${deleted} was not found`,
      ])
    })

    it('answers 400 for an ID that is no UUID', async () => {
      const response = await read('not-an-id')

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer ID')
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('takes the ID in any case and writes the links as the request wrote the path', async () => {
      const customerId = await insertCustomer(db)
      await insertRow(customerId, { specialRequests: 'ドリンクは不要です' })
      const path = preferencesOf(customerId).toUpperCase()

      const response = await request(app)
        .get(path)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.specialRequests).toBe('ドリンクは不要です')
      expect(response.body.links).toEqual({
        self: path,
        customer: `${CUSTOMERS}/${customerId}`.toUpperCase(),
      })
    })

    it('leaves the query of the request out of the links, in both operations', async () => {
      const customerId = await insertCustomer(db)
      const path = preferencesOf(customerId)
      const links = { self: path, customer: `${CUSTOMERS}/${customerId}` }

      const responses = [
        await request(app)
          .get(`${path}?fields=all`)
          .set('Authorization', asAdmin),
        await request(app)
          .patch(`${path}?fields=all`)
          .set('Authorization', asAdmin)
          .send({ specialRequests: 'ドリンクは不要です' }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(responses.map((response) => response.body.links)).toEqual([
        links,
        links,
      ])
    })

    it('returns the staff members as they are stored, also once they are deleted', async () => {
      const customerId = await insertCustomer(db)
      const preferred = await staffMember()
      const avoided = await staffMember()
      await insertRow(customerId, {
        preferredStaffId: preferred,
        avoidStaffIds: [avoided],
      })

      const deletions = [
        await removeStaff(preferred),
        await removeStaff(avoided),
      ]
      const response = await read(customerId)

      expect(deletions.map(({ status }) => status)).toEqual([204, 204])
      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...EMPTY,
        preferredStaffId: preferred,
        avoidStaffIds: [avoided],
      })
    })

    it.each<[string, Partial<NewPreferencesRow>, string]>([
      [
        'time slots that are no time slots',
        { preferredTimeSlots: [{ from: 'teal-o-clock' }] },
        'teal-o-clock',
      ],
      [
        'a time slot with seconds',
        { preferredTimeSlots: [{ startTime: '10:00:59', endTime: '12:00' }] },
        '10:00:59',
      ],
      [
        'a style preference of another shape',
        { stylePreferences: { favouriteColour: 'teal' } },
        'teal',
      ],
      [
        'a style preference with a list that is none',
        { stylePreferences: { ...STYLE, avoidStyles: 'teal-perm' } },
        'teal-perm',
      ],
    ])(
      'answers 500 without details when the stored preferences have %s',
      async (_case, columns, stored) => {
        const customerId = await insertCustomer(db)
        await insertRow(customerId, columns)

        const response = await read(customerId)

        expectProblem(response, databaseProblem)
        expect(response.body.detail).toBeNull()
        expect(JSON.stringify(response.body)).not.toContain(stored)
      },
    )
  })

  describe('PATCH /api/v1/customers/:id/preferences', () => {
    it('creates the preferences with the first change: what the request names is stored and the rest is empty', async () => {
      const customerId = await insertCustomer(db)
      await insertCustomer(db)

      const response = await change(customerId, {
        communicationStyle: '静かに過ごしたい',
      })

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: { ...EMPTY, communicationStyle: '静かに過ごしたい' },
        meta: {
          correlationId: response.headers['x-request-id'],
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: preferencesOf(customerId),
          customer: `${CUSTOMERS}/${customerId}`,
        },
      })
      expect(await storedRows()).toEqual([
        {
          ...EMPTY,
          communicationStyle: '静かに過ごしたい',
          id: expect.stringMatching(UUID),
          customerId,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ])
      expect(await hasMoved(customerId)).toBe(false)
      expect((await read(customerId)).body.data).toEqual(response.body.data)
    })

    it('changes what a later request names and nothing else, moves updatedAt, and keeps the row', async () => {
      const customerId = await insertCustomer(db)
      const other = await insertCustomer(db)
      const preferred = await staffMember()
      const avoided = await staffMember()
      await change(customerId, stated(preferred, [avoided]))
      await change(other, stated(preferred, [avoided]))
      const before = await storedRowOf(customerId)
      const otherBefore = await storedRowOf(other)

      const response = await change(customerId, { specialRequests: null })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...stated(preferred, [avoided]),
        specialRequests: null,
      })
      expect(await storedRowOf(customerId)).toEqual({
        ...before,
        specialRequests: null,
        updatedAt: expect.any(String),
      })
      expect(await hasMoved(customerId)).toBe(true)
      expect(await storedRowOf(other)).toEqual(otherBefore)
    })

    it.each(PROPERTIES)(
      'changes %s alone and leaves the other five as they are',
      async (property) => {
        const customerId = await insertCustomer(db)
        const first: Record<string, unknown> = stated(await staffMember(), [
          await staffMember(),
        ])
        const second: Record<string, unknown> = restated(await staffMember(), [
          await staffMember(),
        ])
        await change(customerId, first)

        const response = await change(customerId, {
          [property]: second[property],
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...first,
          [property]: second[property],
        })
        expect(await storedRowOf(customerId)).toMatchObject({
          ...first,
          [property]: second[property],
        })
      },
    )

    it('changes all six properties in one request', async () => {
      const customerId = await insertCustomer(db)
      const first = stated(await staffMember(), [await staffMember()])
      const second = restated(await staffMember(), [
        await staffMember(),
        await staffMember(),
      ])
      await change(customerId, first)

      const response = await change(customerId, second)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(second)
      expect(await storedRowOf(customerId)).toMatchObject(second)
    })

    it('clears every property with null or an empty list, and keeps the row', async () => {
      const customerId = await insertCustomer(db)
      await change(
        customerId,
        stated(await staffMember(), [await staffMember()]),
      )

      const response = await change(customerId, EMPTY)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(EMPTY)
      expect(await storedRowOf(customerId)).toMatchObject({
        ...EMPTY,
        customerId,
      })
      expect((await read(customerId)).body.data).toEqual(EMPTY)
    })

    it('takes the IDs of staff members in any case and stores them in lower case', async () => {
      const customerId = await insertCustomer(db)
      const preferred = await staffMember()
      const avoided = await staffMember()

      const response = await change(customerId, {
        preferredStaffId: preferred.toUpperCase(),
        avoidStaffIds: [avoided.toUpperCase()],
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...EMPTY,
        preferredStaffId: preferred,
        avoidStaffIds: [avoided],
      })
    })

    it('keeps the texts and the order of the lists as they are sent', async () => {
      const customerId = await insertCustomer(db)
      const avoided = [
        await staffMember(),
        await staffMember(),
        await staffMember(),
      ].toReversed()
      const body = {
        avoidStaffIds: avoided,
        preferredTimeSlots: [
          { startTime: '18:00', endTime: '20:30' },
          { startTime: '09:00', endTime: '12:00' },
          { startTime: '12:00', endTime: '13:00' },
        ],
        stylePreferences: {
          preferredLength: '  肩につくくらい ',
          preferredColors: ['ブラウン', 'アッシュ'],
          avoidStyles: ['パーマ', '刈り上げ'],
          inspirationImages: [
            'https://images.example.com/b.jpg',
            'http://images.example.com/a.jpg',
          ],
        },
        communicationStyle: 'あ'.repeat(100),
        specialRequests: `1 行目\n2 行目 ${'あ'.repeat(3000)}`,
      }

      const response = await change(customerId, body)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ ...body, preferredStaffId: null })
      expect((await read(customerId)).body.data).toEqual(response.body.data)
    })

    it.each(ledgerKeepers)(
      'lets %s change the preferences of any customer',
      async (_case, signInAs) => {
        const customerId = await insertCustomer(db)
        const preferred = await staffMember()

        const response = await change(
          customerId,
          { preferredStaffId: preferred },
          await signInAs(),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...EMPTY,
          preferredStaffId: preferred,
        })
      },
    )

    it.each(violations)(
      'answers 400 for %s, and stores nothing',
      async (_case, body, rules) => {
        const customerId = await insertCustomer(db)

        const response = await change(customerId, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(brokenRules(response)).toEqual(rules)
        expect(await storedRows()).toEqual([])
      },
    )

    it('reports every rule a request breaks', async () => {
      const customerId = await insertCustomer(db)

      const response = await change(customerId, {
        preferredStaffId: 'hanako',
        preferredTimeSlots: [{ startTime: '18:00', endTime: '17:00' }],
        avoidStaffIds: [UNKNOWN_ID, UNKNOWN_ID],
        stylePreferences: { ...STYLE, preferredLength: '' },
        communicationStyle: 'あ'.repeat(101),
        specialRequests: ' ',
        notes: 'x',
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([
        'preferredStaffId:invalid_format',
        'preferredTimeSlots.0.endTime:custom',
        'avoidStaffIds.1:custom',
        'stylePreferences.preferredLength:invalid_format',
        'communicationStyle:too_big',
        'specialRequests:invalid_format',
        'notes:unrecognized_keys',
      ])
    })

    it('answers 404 for a customer that does not exist and for one that is deleted, and writes nothing', async () => {
      const deleted = await insertCustomer(db)
      await insertRow(deleted, { specialRequests: 'ドリンクは不要です' })
      expect((await removeCustomer(deleted)).status).toBe(204)
      const before = await storedRows()

      const responses = [
        await change(UNKNOWN_ID, { specialRequests: null }),
        await change(deleted, { specialRequests: null }),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
      }
      expect(responses.map(({ body }) => body.detail)).toEqual([
        `Customer ${UNKNOWN_ID} was not found`,
        `Customer ${deleted} was not found`,
      ])
      expect(await storedRows()).toEqual(before)
    })

    it('takes the customer from the path alone: an ID in the body is a property the request does not have', async () => {
      const customerId = await insertCustomer(db)

      const response = await change(customerId, {
        id: 'another-customer',
        specialRequests: 'ドリンクは不要です',
      })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_UPDATE)
      expect(brokenRules(response)).toEqual(['id:unrecognized_keys'])
      expect(await storedRows()).toEqual([])
    })

    it('answers 400 for an ID that is no UUID', async () => {
      const response = await change('not-an-id', { specialRequests: null })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer ID')
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })
  })

  describe('the staff members a change names', () => {
    it.each(notStaffMembers)(
      'refuses %s as the preferred staff member and among the avoided ones, and stores nothing',
      async (_case, idOf) => {
        const customerId = await insertCustomer(db)
        const colleague = await staffMember()
        const id = await idOf()

        const asPreferred = await change(customerId, { preferredStaffId: id })
        const asAvoided = await change(customerId, {
          avoidStaffIds: [colleague, id],
        })

        expectProblem(asPreferred, badRequest)
        expect(asPreferred.body.detail).toBe(INVALID_UPDATE)
        expect(asPreferred.body.errors).toMatchObject([
          {
            field: 'preferredStaffId',
            rule: 'not_found',
            message: 'Must name a staff member',
          },
        ])
        expectProblem(asAvoided, badRequest)
        expect(asAvoided.body.errors).toMatchObject([
          {
            field: 'avoidStaffIds.1',
            rule: 'not_found',
            message: 'Must name a staff member',
          },
        ])
        expect(await storedRows()).toEqual([])
      },
    )

    it('names every staff member that is none, each where the request names it', async () => {
      const customerId = await insertCustomer(db)
      const colleague = await staffMember()
      const deleted = await staffMember({
        deletedAt: '2026-11-01T00:00:00.000Z',
      })

      const response = await change(customerId, {
        preferredStaffId: UNKNOWN_ID,
        avoidStaffIds: [colleague, ANOTHER_UNKNOWN_ID, deleted],
        specialRequests: 'ドリンクは不要です',
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([
        'preferredStaffId:not_found',
        'avoidStaffIds.1:not_found',
        'avoidStaffIds.2:not_found',
      ])
      expect(await storedRows()).toEqual([])
    })

    it.each(staffMembersOfAnyKind)(
      'accepts %s, as the preferred one and as an avoided one',
      async (_case, idOf) => {
        const customerId = await insertCustomer(db)
        const other = await insertCustomer(db)
        const id = await idOf()

        const responses = [
          await change(customerId, { preferredStaffId: id }),
          await change(other, { avoidStaffIds: [id] }),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200'])
        expect(await storedRowOf(customerId)).toMatchObject({
          preferredStaffId: id,
        })
        expect(await storedRowOf(other)).toMatchObject({ avoidStaffIds: [id] })
      },
    )

    it('refuses a request that names the preferred staff member among the avoided ones', async () => {
      const customerId = await insertCustomer(db)
      const one = await staffMember()
      const two = await staffMember()

      const response = await change(customerId, {
        preferredStaffId: one,
        avoidStaffIds: [two, one.toUpperCase()],
      })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_UPDATE)
      expect(response.body.errors).toMatchObject([
        {
          field: 'preferredStaffId',
          rule: 'avoided',
          message: 'Must not be a staff member the customer avoids',
        },
      ])
      expect(await storedRows()).toEqual([])
    })

    it('holds a change of one of the two to what is stored of the other', async () => {
      const prefers = await insertCustomer(db)
      const avoids = await insertCustomer(db)
      const one = await staffMember()
      const two = await staffMember()
      await change(prefers, { preferredStaffId: one })
      await change(avoids, { avoidStaffIds: [two, one] })
      const before = await storedRows()

      const responses = [
        await change(prefers, { avoidStaffIds: [two, one] }),
        await change(avoids, { preferredStaffId: one }),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['preferredStaffId:avoided'])
      }
      expect(await storedRows()).toEqual(before)
    })

    it('reports a staff member who was not found before it holds the change to what is stored', async () => {
      const customerId = await insertCustomer(db)
      const preferred = await staffMember()
      await change(customerId, { preferredStaffId: preferred })
      const before = await storedRows()

      const response = await change(customerId, {
        avoidStaffIds: [preferred, UNKNOWN_ID],
      })

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['avoidStaffIds.1:not_found'])
      expect(await storedRows()).toEqual(before)
    })

    it('accepts a request after which the two no longer meet, whatever was stored before', async () => {
      const swaps = await insertCustomer(db)
      const moves = await insertCustomer(db)
      const clears = await insertCustomer(db)
      const one = await staffMember()
      const two = await staffMember()
      for (const customerId of [swaps, moves, clears]) {
        await change(customerId, {
          preferredStaffId: one,
          avoidStaffIds: [two],
        })
      }

      const responses = [
        await change(swaps, { preferredStaffId: two, avoidStaffIds: [one] }),
        await change(moves, { preferredStaffId: null, avoidStaffIds: [one] }),
        await change(clears, { avoidStaffIds: [] }),
        await change(clears, { preferredStaffId: two }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200', '200'])
      expect(await storedRowOf(swaps)).toMatchObject({
        preferredStaffId: two,
        avoidStaffIds: [one],
      })
      expect(await storedRowOf(moves)).toMatchObject({
        preferredStaffId: null,
        avoidStaffIds: [one],
      })
      expect(await storedRowOf(clears)).toMatchObject({
        preferredStaffId: two,
        avoidStaffIds: [],
      })
    })

    it('keeps a staff member who is deleted afterwards while other properties change, and refuses to be sent the ID again', async () => {
      const customerId = await insertCustomer(db)
      const preferred = await staffMember()
      const stays = await staffMember()
      const leaves = await staffMember()
      await change(customerId, {
        preferredStaffId: preferred,
        avoidStaffIds: [stays, leaves],
      })
      expect((await removeStaff(preferred)).status).toBe(204)
      expect((await removeStaff(leaves)).status).toBe(204)

      const otherProperty = await change(customerId, {
        communicationStyle: '静かに過ごしたい',
      })
      const sentAgain = [
        await change(customerId, { avoidStaffIds: [stays, leaves] }),
        await change(customerId, { preferredStaffId: preferred }),
      ]
      const kept = await storedRowOf(customerId)
      const withoutThem = await change(customerId, {
        preferredStaffId: null,
        avoidStaffIds: [stays],
      })

      expect(otherProperty.status).toBe(200)
      expect(otherProperty.body.data).toEqual({
        ...EMPTY,
        preferredStaffId: preferred,
        avoidStaffIds: [stays, leaves],
        communicationStyle: '静かに過ごしたい',
      })
      expect(sentAgain.map(brokenRules)).toEqual([
        ['avoidStaffIds.1:not_found'],
        ['preferredStaffId:not_found'],
      ])
      expect(kept).toMatchObject({
        preferredStaffId: preferred,
        avoidStaffIds: [stays, leaves],
      })
      expect(withoutThem.status).toBe(200)
      expect(withoutThem.body.data).toMatchObject({
        preferredStaffId: null,
        avoidStaffIds: [stays],
      })
    })

    it('holds a change to a preferred staff member who is deleted, as long as they are stored', async () => {
      const customerId = await insertCustomer(db)
      const preferred = await staffMember()
      const colleague = await staffMember()
      await change(customerId, { preferredStaffId: preferred })
      expect((await removeStaff(preferred)).status).toBe(204)

      const response = await change(customerId, {
        avoidStaffIds: [colleague],
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        preferredStaffId: preferred,
        avoidStaffIds: [colleague],
      })
    })
  })

  describe('who keeps the preferences of the ledger', () => {
    it.each(unauthenticated)(
      'answers %s with 401 in both operations before looking at anything else, and writes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const customerId = await insertCustomer(db)
        const authorization = await tokenOf()

        const responses = [
          await read(customerId, authorization),
          await read('not-an-id', authorization),
          await change(customerId, { specialRequests: null }, authorization),
          await change('not-an-id', {}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedRows()).toEqual([])
      },
    )

    it('forbids a customer both operations, on the preferences of their own customer as on any other', async () => {
      const self = await accountWithProfile()
      const other = await insertCustomer(db)

      const responses = [
        await read(self.customerId, self.authorization),
        await read(other, self.authorization),
        await read('not-an-id', self.authorization),
        await change(
          self.customerId,
          { specialRequests: null },
          self.authorization,
        ),
        await change(other, { specialRequests: null }, self.authorization),
        await change(self.customerId, {}, self.authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await storedRows()).toEqual([])
    })

    it.each<[string, SignInAs]>([
      [
        'a customer account without a profile',
        async () => (await account()).authorization,
      ],
      ['an account of a salon whose staff record is deleted', formerMember],
    ])(
      'forbids %s both operations, before looking at the ID or the body',
      async (_case, signInAs) => {
        const customerId = await insertCustomer(db)
        const authorization = await signInAs()

        const responses = [
          await read(customerId, authorization),
          await read('not-an-id', authorization),
          await change(customerId, { specialRequests: null }, authorization),
          await change('not-an-id', {}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await storedRows()).toEqual([])
      },
    )

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const customerId = await insertCustomer(db)
      const self = await accountWithProfile()
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).patch(preferencesOf(customerId)), authorization)
          .set('Content-Type', 'application/json')
          .send('{"specialRequests": "ドリンクは不要です"')

      const responses = [
        await notJson(null),
        await notJson(self.authorization),
        await notJson(asAdmin),
        await authorized(request(app).patch(preferencesOf(customerId)), null)
          .set('Content-Type', 'text/plain')
          .send('ドリンクは不要です'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
    })

    it('checks a change in order: the token, the account, the ID, the request, the customer, the staff members', async () => {
      const customerId = await insertCustomer(db)
      const self = await accountWithProfile()
      const one = await staffMember()
      const both = { preferredStaffId: one, avoidStaffIds: [one] }
      const unknownStaff = { preferredStaffId: UNKNOWN_ID }

      const responses = [
        await change('not-an-id', {}, null),
        await change('not-an-id', {}, self.authorization),
        await change('not-an-id', {}),
        await change(UNKNOWN_ID, {}),
        await change(UNKNOWN_ID, both),
        await change(UNKNOWN_ID, unknownStaff),
        await change(customerId, unknownStaff),
        await change(customerId, { preferredStaffId: one }),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '400 2001',
        '400 2001',
        '404 3001',
        '400 2001',
        '200',
      ])
      expect(responses.slice(2, 5).map(brokenRules)).toEqual([
        ['id:invalid_format'],
        [':custom'],
        ['preferredStaffId:avoided'],
      ])
    })

    it('checks a read in order: the token, the account, the ID, the customer', async () => {
      const customerId = await insertCustomer(db)
      const self = await accountWithProfile()

      const responses = [
        await read('not-an-id', null),
        await read('not-an-id', self.authorization),
        await read('not-an-id'),
        await read(UNKNOWN_ID),
        await read(customerId),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '404 3001',
        '200',
      ])
    })

    it.each<[string, 'put' | 'post' | 'delete']>([
      ['replacing', 'put'],
      ['creating', 'post'],
      ['deleting', 'delete'],
    ])(
      'has no operation for %s the preferences, in the ledger or of the own profile',
      async (_case, method) => {
        const self = await accountWithProfile()
        await change(self.customerId, { specialRequests: 'ドリンクは不要です' })
        const before = await storedRows()
        const paths = [preferencesOf(self.customerId), OWN]

        const responses = []
        for (const path of paths) {
          for (const authorization of [asAdmin, self.authorization]) {
            responses.push(
              await request(app)
                [method](path)
                .set('Authorization', authorization)
                .send(EMPTY),
            )
          }
          responses.push(await request(app)[method](path).send(EMPTY))
        }

        for (const response of responses) {
          expectProblem(response, routeNotFound)
        }
        expect(responses.map(({ body }) => body.detail)).toEqual(
          paths.flatMap((path) =>
            Array.from(
              { length: 3 },
              () => `${method.toUpperCase()} ${path} is not part of the API`,
            ),
          ),
        )
        expect(await storedRows()).toEqual(before)
      },
    )

    it('has nothing below the preferences', async () => {
      const self = await accountWithProfile()

      const responses = [
        await request(app)
          .get(`${preferencesOf(self.customerId)}/style`)
          .set('Authorization', asAdmin),
        await request(app)
          .patch(`${preferencesOf(self.customerId)}/style`)
          .set('Authorization', asAdmin)
          .send(STYLE),
        await request(app)
          .get(`${OWN}/style`)
          .set('Authorization', self.authorization),
        await request(app)
          .patch(`${OWN}/style`)
          .set('Authorization', self.authorization)
          .send(STYLE),
      ]

      for (const response of responses) {
        expectProblem(response, routeNotFound)
      }
      expect(await storedRows()).toEqual([])
    })
  })

  describe('GET /api/v1/customers/me/preferences', () => {
    it('returns the empty preferences of a customer who has stated none, and stores nothing by reading', async () => {
      const self = await accountWithProfile()

      const response = await readOwn(self.authorization)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: EMPTY,
        meta: {
          correlationId: response.headers['x-request-id'],
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: OWN, customer: ME },
      })
      expect(await storedRows()).toEqual([])
    })

    it('returns what the ledger wrote of the customer of the account, and of no other customer', async () => {
      const self = await accountWithProfile()
      const other = await accountWithProfile()
      const preferred = await staffMember()
      const avoided = await staffMember()
      await change(self.customerId, stated(preferred, [avoided]))
      await change(other.customerId, restated(avoided, [preferred]))

      const response = await readOwn(self.authorization)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(stated(preferred, [avoided]))
      expect(Object.keys(response.body.data).toSorted()).toEqual(
        PROPERTIES.toSorted(),
      )
      expect((await readOwn(other.authorization)).body.data).toEqual(
        restated(avoided, [preferred]),
      )
    })

    it('writes the links as the request wrote the path', async () => {
      const self = await accountWithProfile()

      const response = await request(app)
        .get(OWN.toUpperCase())
        .set('Authorization', self.authorization)

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: OWN.toUpperCase(),
        customer: ME.toUpperCase(),
      })
    })

    it('leaves the query of the request out of the links, in both operations', async () => {
      const self = await accountWithProfile()
      const links = { self: OWN, customer: ME }

      const responses = [
        await request(app)
          .get(`${OWN}?fields=all`)
          .set('Authorization', self.authorization),
        await request(app)
          .patch(`${OWN}?fields=all`)
          .set('Authorization', self.authorization)
          .send({ specialRequests: 'ドリンクは不要です' }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(responses.map((response) => response.body.links)).toEqual([
        links,
        links,
      ])
    })
  })

  describe('PATCH /api/v1/customers/me/preferences', () => {
    it('creates the preferences of the customer of the account with the first change, and the ledger reads the same', async () => {
      const self = await accountWithProfile()
      const preferred = await staffMember()
      const avoided = await staffMember()

      const response = await changeOwn(
        stated(preferred, [avoided]),
        self.authorization,
      )

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: stated(preferred, [avoided]),
        meta: {
          correlationId: response.headers['x-request-id'],
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: OWN, customer: ME },
      })
      expect(await storedRows()).toEqual([
        expect.objectContaining({
          ...stated(preferred, [avoided]),
          customerId: self.customerId,
        }),
      ])
      expect((await read(self.customerId)).body.data).toEqual(
        response.body.data,
      )
      expect((await readOwn(self.authorization)).body.data).toEqual(
        response.body.data,
      )
    })

    it('changes what a later request names and nothing else, of the own customer alone', async () => {
      const self = await accountWithProfile()
      const other = await accountWithProfile()
      const preferred = await staffMember()
      const avoided = await staffMember()
      await changeOwn(stated(preferred, [avoided]), self.authorization)
      await changeOwn(stated(preferred, [avoided]), other.authorization)
      const otherBefore = await storedRowOf(other.customerId)

      const response = await changeOwn(
        { preferredStaffId: null, preferredTimeSlots: [] },
        self.authorization,
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...stated(null, [avoided]),
        preferredTimeSlots: [],
      })
      expect(await hasMoved(self.customerId)).toBe(true)
      expect(await storedRowOf(other.customerId)).toEqual(otherBefore)
    })

    it.each(violations)(
      'answers 400 for %s, and stores nothing',
      async (_case, body, rules) => {
        const self = await accountWithProfile()

        const response = await changeOwn(body, self.authorization)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(brokenRules(response)).toEqual(rules)
        expect(await storedRows()).toEqual([])
      },
    )

    it.each(notStaffMembers)(
      'refuses %s as the preferred staff member and among the avoided ones',
      async (_case, idOf) => {
        const self = await accountWithProfile()
        const id = await idOf()

        const responses = [
          await changeOwn({ preferredStaffId: id }, self.authorization),
          await changeOwn({ avoidStaffIds: [id] }, self.authorization),
        ]

        for (const response of responses) {
          expectProblem(response, badRequest)
        }
        expect(responses.map(brokenRules)).toEqual([
          ['preferredStaffId:not_found'],
          ['avoidStaffIds.0:not_found'],
        ])
        expect(await storedRows()).toEqual([])
      },
    )

    it('holds the preferred staff member and the avoided ones to each other, in one request and against what is stored', async () => {
      const self = await accountWithProfile()
      const one = await staffMember()
      const two = await staffMember()
      await changeOwn({ preferredStaffId: one }, self.authorization)
      const before = await storedRows()

      const responses = [
        await changeOwn(
          { preferredStaffId: two, avoidStaffIds: [two] },
          self.authorization,
        ),
        await changeOwn({ avoidStaffIds: [one] }, self.authorization),
      ]
      const swapped = await changeOwn(
        { preferredStaffId: two, avoidStaffIds: [one] },
        self.authorization,
      )

      expect(responses.map(brokenRules)).toEqual([
        ['preferredStaffId:avoided'],
        ['preferredStaffId:avoided'],
      ])
      expect(responses.map(statusAndCode)).toEqual(['400 2001', '400 2001'])
      expect(swapped.status).toBe(200)
      expect(await storedRows()).not.toEqual(before)
    })
  })

  describe('who has preferences of their own', () => {
    /** Everyone who is signed in and is no customer: they keep the ledger, or nothing. */
    const notCustomers: [string, SignInAs][] = [
      ...ledgerKeepers,
      ['an account of a salon whose staff record is deleted', formerMember],
    ]

    it.each(unauthenticated)(
      'answers %s with 401 in both operations before looking at anything else, and writes nothing',
      async (_case, tokenOf, problem, challenge) => {
        await accountWithProfile()
        const authorization = await tokenOf()

        const responses = [
          await readOwn(authorization),
          await changeOwn({ specialRequests: null }, authorization),
          await changeOwn({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await storedRows()).toEqual([])
      },
    )

    it.each(notCustomers)(
      'forbids %s both operations, before looking at the body, and writes nothing',
      async (_case, signInAs) => {
        await accountWithProfile()
        const authorization = await signInAs()

        const responses = [
          await readOwn(authorization),
          await changeOwn({ specialRequests: null }, authorization),
          await changeOwn({ specialRequests: ' ' }, authorization),
          await changeOwn({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await storedRows()).toEqual([])
      },
    )

    it('answers a customer account without a profile with 404 in both operations, before looking at the body', async () => {
      await accountWithProfile()
      const self = await account()

      const responses = [
        await readOwn(self.authorization),
        await changeOwn({ specialRequests: null }, self.authorization),
        await changeOwn({ specialRequests: ' ' }, self.authorization),
        await changeOwn({}, self.authorization),
      ]

      for (const response of responses) {
        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          `Customer profile of user ${self.id} was not found`,
        )
      }
      expect(await storedRows()).toEqual([])
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const self = await accountWithProfile()
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).patch(OWN), authorization)
          .set('Content-Type', 'application/json')
          .send('{"specialRequests": "ドリンクは不要です"')

      const responses = [
        await notJson(null),
        await notJson(asAdmin),
        await notJson(self.authorization),
        await authorized(request(app).patch(OWN), null)
          .set('Content-Type', 'text/plain')
          .send('ドリンクは不要です'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
    })

    it('checks a change in order: the token, the account, the profile, the request, the staff members', async () => {
      const self = await accountWithProfile()
      const withoutProfile = await account()
      const one = await staffMember()

      const responses = [
        await changeOwn({}, null),
        await changeOwn({}, asAdmin),
        await changeOwn({}, withoutProfile.authorization),
        await changeOwn({}, self.authorization),
        await changeOwn({ preferredStaffId: UNKNOWN_ID }, self.authorization),
        await changeOwn({ preferredStaffId: one }, self.authorization),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '404 3001',
        '400 2001',
        '400 2001',
        '200',
      ])
      expect(responses.slice(3, 5).map(brokenRules)).toEqual([
        [':custom'],
        ['preferredStaffId:not_found'],
      ])
    })

    it('does not take "me" for the ID of a customer: the own preferences answer, and another word is a malformed ID', async () => {
      const self = await accountWithProfile()

      const own = await readOwn(null)
      const ownAsAdmin = await readOwn(asAdmin)
      const byWord = await read('mine')
      const changedByWord = await change('mine', { specialRequests: null })

      expectProblem(own, authenticationRequired)
      expectProblem(ownAsAdmin, forbidden)
      for (const response of [byWord, changedByWord]) {
        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      }
      expect((await readOwn(self.authorization)).status).toBe(200)
    })
  })

  describe('the customer of the account changes', () => {
    it('keeps the preferences readable and writable while the ledger marks the customer inactive', async () => {
      const self = await accountWithProfile()
      await changeOwn(
        { specialRequests: 'ドリンクは不要です' },
        self.authorization,
      )
      await db
        .update(customers)
        .set({ isActive: false, customerStatus: 'inactive' })
        .where(eq(customers.id, self.customerId))

      const responses = [
        await readOwn(self.authorization),
        await changeOwn(
          { communicationStyle: '静かに過ごしたい' },
          self.authorization,
        ),
        await read(self.customerId),
        await change(self.customerId, { specialRequests: null }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200', '200'])
      expect(await storedRowOf(self.customerId)).toMatchObject({
        communicationStyle: '静かに過ごしたい',
        specialRequests: null,
      })
    })

    it('answers 404 once the ledger has deleted the customer, and a new profile begins with empty preferences', async () => {
      const self = await accountWithProfile()
      const preferred = await staffMember()
      await changeOwn({ preferredStaffId: preferred }, self.authorization)
      const before = await storedRows()

      expect((await removeCustomer(self.customerId)).status).toBe(204)
      const gone = [
        await readOwn(self.authorization),
        await changeOwn({ specialRequests: null }, self.authorization),
        await read(self.customerId),
      ]
      const next = await createProfile(self.authorization)
      const again = await readOwn(self.authorization)
      const written = await changeOwn(
        { specialRequests: 'ドリンクは不要です' },
        self.authorization,
      )

      expect(gone.map(statusAndCode)).toEqual([
        '404 3001',
        '404 3001',
        '404 3001',
      ])
      expect(gone.map(({ body }) => body.detail)).toEqual([
        `Customer profile of user ${self.id} was not found`,
        `Customer profile of user ${self.id} was not found`,
        `Customer ${self.customerId} was not found`,
      ])
      expect(next).not.toBe(self.customerId)
      expect(again.status).toBe(200)
      expect(again.body.data).toEqual(EMPTY)
      expect(written.status).toBe(200)
      expect(await storedRows()).toEqual(
        expect.arrayContaining([
          ...before,
          expect.objectContaining({
            customerId: next,
            preferredStaffId: null,
            specialRequests: 'ドリンクは不要です',
          }),
        ]),
      )
      expect(await db.$count(customerPreferences)).toBe(2)
    })
  })

  describe('requests at the same moment', () => {
    // A change locks the row of the customer before it reads what is
    // stored, so the changes of one customer are made one after the other
    // and a deletion of the customer is either before a change or after it.
    it('creates one row when two first changes arrive together, and keeps both', async () => {
      const customerId = await insertCustomer(db)

      const responses = await Promise.all([
        change(customerId, { communicationStyle: '静かに過ごしたい' }),
        change(customerId, { specialRequests: 'ドリンクは不要です' }),
      ])

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(await storedRows()).toEqual([
        expect.objectContaining({
          ...EMPTY,
          customerId,
          communicationStyle: '静かに過ごしたい',
          specialRequests: 'ドリンクは不要です',
        }),
      ])
    })

    it('keeps every change when the first changes of all six properties arrive together', async () => {
      const customerId = await insertCustomer(db)
      const all = stated(await staffMember(), [await staffMember()])

      const responses = await Promise.all(
        Object.entries(all).map(([property, value]) =>
          change(customerId, { [property]: value }),
        ),
      )

      expect(responses.map(statusAndCode)).toEqual([
        '200',
        '200',
        '200',
        '200',
        '200',
        '200',
      ])
      expect(await storedRows()).toEqual([
        expect.objectContaining({ ...all, customerId }),
      ])
    })

    it('accepts one of two changes that prefer and avoid the same staff member, whichever is first', async () => {
      const one = await staffMember()
      const customerIds = [
        await insertCustomer(db),
        await insertCustomer(db),
        await insertCustomer(db),
        await insertCustomer(db),
      ]

      const rounds = await Promise.all(
        customerIds.map((customerId) =>
          Promise.all([
            change(customerId, { preferredStaffId: one }),
            change(customerId, { avoidStaffIds: [one] }),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode).toSorted()).toEqual(['200', '400 2001'])
        expect(
          round.filter(({ status }) => status === 400).map(brokenRules),
        ).toEqual([['preferredStaffId:avoided']])
      }
      for (const row of await storedRows()) {
        expect(row.avoidStaffIds).not.toContain(row.preferredStaffId)
        expect([row.preferredStaffId, ...row.avoidStaffIds]).toContain(one)
      }
      expect(await db.$count(customerPreferences)).toBe(4)
    })

    it('lets a change wait while the customer is being deleted, then answers 404 and writes nothing', async () => {
      const customerId = await insertCustomer(db)
      await insertRow(customerId, { specialRequests: 'ドリンクは不要です' })
      const before = await storedRows()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(customers)
          .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
          .where(eq(customers.id, customerId))
        const underWay = change(customerId, {
          specialRequests: 'Too late.',
        }).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${customerId} was not found`)
      expect(await storedRows()).toEqual(before)
    })

    it('lets a change of the own preferences wait while the customer is being deleted, then answers 404 and writes nothing', async () => {
      const self = await accountWithProfile()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(customers)
          .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
          .where(eq(customers.id, self.customerId))
        const underWay = changeOwn(
          { specialRequests: 'Too late.' },
          self.authorization,
        ).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `Customer profile of user ${self.id} was not found`,
      )
      expect(await storedRows()).toEqual([])
    })

    it('writes a change that waited for a deletion that was taken back', async () => {
      const customerId = await insertCustomer(db)
      const waiting: Promise<Response>[] = []

      await expect(
        db.transaction(async (tx) => {
          await tx
            .update(customers)
            .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
            .where(eq(customers.id, customerId))
          waiting.push(
            change(customerId, { specialRequests: 'Just in time.' }).then(
              (response) => response,
            ),
          )
          await pause(300)
          tx.rollback()
        }),
      ).rejects.toThrow('Rollback')
      const responses = await Promise.all(waiting)

      expect(responses.map(statusAndCode)).toEqual(['200'])
      expect(await storedRowOf(customerId)).toMatchObject({
        specialRequests: 'Just in time.',
      })
    })

    it('lets a change wait for a change of the ledger entry that is under way, and keeps both', async () => {
      const customerId = await insertCustomer(db)

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(customers)
          .set({ notes: 'By the salon.' })
          .where(eq(customers.id, customerId))
        const underWay = change(customerId, {
          specialRequests: 'By the customer.',
        }).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending
      const [entry] = await db
        .select({ notes: customers.notes })
        .from(customers)
        .where(eq(customers.id, customerId))

      expect(response.status).toBe(200)
      expect(entry).toEqual({ notes: 'By the salon.' })
      expect(await storedRowOf(customerId)).toMatchObject({
        specialRequests: 'By the customer.',
      })
    })

    it('does not make a read wait for a change of the customer that is under way', async () => {
      const self = await accountWithProfile()
      await insertRow(self.customerId, {
        specialRequests: 'ドリンクは不要です',
      })

      const responses = await db.transaction(async (tx) => {
        await tx
          .update(customers)
          .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
          .where(eq(customers.id, self.customerId))

        return [await read(self.customerId), await readOwn(self.authorization)]
      })

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(responses.map(({ body }) => body.data.specialRequests)).toEqual([
        'ドリンクは不要です',
        'ドリンクは不要です',
      ])
    })

    it('answers a change and a deletion of the customer that arrive together without an error of the server', async () => {
      const customerIds = [
        await insertCustomer(db),
        await insertCustomer(db),
        await insertCustomer(db),
        await insertCustomer(db),
      ]

      const rounds = await Promise.all(
        customerIds.map((customerId) =>
          Promise.all([
            change(customerId, { specialRequests: 'ドリンクは不要です' }),
            removeCustomer(customerId),
          ]),
        ),
      )

      for (const [changed, removed] of rounds) {
        expect(['200', '404 3001']).toContain(statusAndCode(changed))
        expect(statusAndCode(removed)).toBe('204')
      }
      for (const customerId of customerIds) {
        expectProblem(await read(customerId), notFound)
      }
    })

    it('does not wait for a staff member: a change that names one who is being deleted is written', async () => {
      const customerId = await insertCustomer(db)
      const leaving = await staffMember()

      const response = await db.transaction(async (tx) => {
        await tx
          .update(staff)
          .set({ deletedAt: '2026-11-15T09:00:00.000Z' })
          .where(eq(staff.id, leaving))

        return change(customerId, { preferredStaffId: leaving })
      })

      expect(response.status).toBe(200)
      expect(await storedRowOf(customerId)).toMatchObject({
        preferredStaffId: leaving,
      })
      expect(
        brokenRules(await change(customerId, { preferredStaffId: leaving })),
      ).toEqual(['preferredStaffId:not_found'])
    })
  })

  describe('CustomerPreferencesRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new CustomerPreferencesRepository(db)
    const customer = (id: string) => customerIdSchema.parse(id)

    /** A deleted customer who had stated preferences. */
    const deletedCustomer = async (): Promise<string> => {
      const id = await insertCustomer(db)
      await insertRow(id, { specialRequests: 'ドリンクは不要です' })
      await db
        .update(customers)
        .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
        .where(eq(customers.id, id))
      return id
    }

    describe('findByCustomerId', () => {
      it('finds the empty preferences of a customer without a row', async () => {
        const id = await insertCustomer(db)

        const found = await repository().findByCustomerId(customer(id))

        expect(dataOf(found)).toEqual({ type: 'found', preferences: EMPTY })
      })

      it('finds the six columns of the row of the customer and nothing else of it', async () => {
        const id = await insertCustomer(db)
        const other = await insertCustomer(db)
        const preferred = await staffMember()
        const avoided = await staffMember()
        await insertRow(id, stated(preferred, [avoided]))
        await insertRow(other, restated(avoided, [preferred]))

        const found = await repository().findByCustomerId(customer(id))

        expect(dataOf(found)).toEqual({
          type: 'found',
          preferences: stated(preferred, [avoided]),
        })
      })

      it('finds a row whose first column is not set with its other columns', async () => {
        const id = await insertCustomer(db)
        const avoided = await staffMember()
        await insertRow(id, stated(null, [avoided]))

        const found = await repository().findByCustomerId(customer(id))

        expect(dataOf(found)).toEqual({
          type: 'found',
          preferences: stated(null, [avoided]),
        })
      })

      it('does not find a customer that does not exist or is deleted', async () => {
        const deleted = await deletedCustomer()

        const results = [
          await repository().findByCustomerId(customer(UNKNOWN_ID)),
          await repository().findByCustomerId(customer(deleted)),
        ]

        expect(results.map(dataOf)).toEqual([
          { type: 'customerNotFound' },
          { type: 'customerNotFound' },
        ])
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new CustomerPreferencesRepository(
          connection.database,
        ).findByCustomerId(customer(UNKNOWN_ID))
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: 'Failed to find customer preferences',
          },
        })
      })
    })

    describe('update', () => {
      it('creates the row of a customer who has none with the columns it names, and returns the six columns', async () => {
        const id = await insertCustomer(db)

        const updated = await repository().update(customer(id), {
          communicationStyle: '静かに過ごしたい',
        })

        expect(dataOf(updated)).toEqual({
          type: 'updated',
          preferences: { ...EMPTY, communicationStyle: '静かに過ごしたい' },
        })
        expect(await storedRows()).toEqual([
          expect.objectContaining({
            ...EMPTY,
            customerId: id,
            communicationStyle: '静かに過ごしたい',
          }),
        ])
      })

      it('writes the columns it names of the row that is there, and no other row', async () => {
        const id = await insertCustomer(db)
        const other = await insertCustomer(db)
        const preferred = await staffMember()
        const avoided = await staffMember()
        await insertRow(id, stated(preferred, [avoided]))
        await insertRow(other, stated(preferred, [avoided]))
        const before = await storedRowOf(id)
        const otherBefore = await storedRowOf(other)

        const updated = await repository().update(customer(id), {
          preferredStaffId: null,
          preferredTimeSlots: [],
        })

        expect(dataOf(updated)).toEqual({
          type: 'updated',
          preferences: { ...stated(null, [avoided]), preferredTimeSlots: [] },
        })
        expect(await storedRowOf(id)).toEqual({
          ...before,
          preferredStaffId: null,
          preferredTimeSlots: [],
          updatedAt: expect.any(String),
        })
        expect(await hasMoved(id)).toBe(true)
        expect(await storedRowOf(other)).toEqual(otherBefore)
      })

      it('refuses a customer that does not exist or is deleted, and writes nothing', async () => {
        const deleted = await deletedCustomer()
        const before = await storedRows()

        const results = [
          await repository().update(customer(UNKNOWN_ID), {
            specialRequests: null,
          }),
          await repository().update(customer(deleted), {
            specialRequests: null,
          }),
        ]

        expect(results.map(dataOf)).toEqual([
          { type: 'customerNotFound' },
          { type: 'customerNotFound' },
        ])
        expect(await storedRows()).toEqual(before)
      })

      it('refuses with the IDs that name no staff member, the preferred one first and the avoided ones in their order', async () => {
        const id = await insertCustomer(db)
        const colleague = await staffMember()
        const deleted = await staffMember({
          deletedAt: '2026-11-01T00:00:00.000Z',
        })

        const results = [
          await repository().update(customer(id), {
            preferredStaffId: UNKNOWN_ID,
            avoidStaffIds: [deleted, colleague, ANOTHER_UNKNOWN_ID],
          }),
          await repository().update(customer(id), {
            preferredStaffId: colleague,
            avoidStaffIds: [deleted],
          }),
        ]

        expect(results.map(dataOf)).toEqual([
          {
            type: 'staffNotFound',
            staffIds: [UNKNOWN_ID, deleted, ANOTHER_UNKNOWN_ID],
          },
          { type: 'staffNotFound', staffIds: [deleted] },
        ])
        expect(await storedRows()).toEqual([])
      })

      it('looks up the customer before the staff members', async () => {
        const updated = await repository().update(customer(UNKNOWN_ID), {
          preferredStaffId: ANOTHER_UNKNOWN_ID,
        })

        expect(dataOf(updated)).toEqual({ type: 'customerNotFound' })
      })

      it('refuses a change after which the preferred staff member is one of the avoided, and writes nothing', async () => {
        const id = await insertCustomer(db)
        const one = await staffMember()
        const two = await staffMember()
        await insertRow(id, { preferredStaffId: one, avoidStaffIds: [two] })
        const before = await storedRows()
        const avoided = {
          type: 'invalid',
          issues: [
            {
              field: 'preferredStaffId',
              rule: 'avoided',
              message: customerPreferencesMessages.notAvoidedStaffMember,
            },
          ],
        }

        const results = [
          await repository().update(customer(id), { preferredStaffId: two }),
          await repository().update(customer(id), { avoidStaffIds: [one] }),
          await repository().update(customer(id), {
            preferredStaffId: two,
            avoidStaffIds: [one, two],
          }),
        ]

        expect(results.map(dataOf)).toEqual([avoided, avoided, avoided])
        expect(await storedRows()).toEqual(before)
      })

      it('does not look at the stored staff members that a change replaces', async () => {
        const id = await insertCustomer(db)
        const one = await staffMember()
        const two = await staffMember()
        await insertRow(id, { preferredStaffId: one, avoidStaffIds: [two] })

        const updated = await repository().update(customer(id), {
          preferredStaffId: two,
          avoidStaffIds: [one],
        })

        expect(dataOf(updated)).toMatchObject({
          type: 'updated',
          preferences: { preferredStaffId: two, avoidStaffIds: [one] },
        })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new CustomerPreferencesRepository(
          connection.database,
        ).update(customer(UNKNOWN_ID), { specialRequests: null })
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: 'Failed to update customer preferences',
          },
        })
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })

    it.each<[string, (staffId: string) => Partial<NewPreferencesRow>, string]>([
      [
        'a preferred staff member who is among the avoided ones',
        (staffId) => ({
          preferredStaffId: staffId,
          avoidStaffIds: [UNKNOWN_ID, staffId],
        }),
        'customer_preferences_preferred_staff_not_avoided',
      ],
      [
        'time slots that are an object',
        () => ({ preferredTimeSlots: {} }),
        'customer_preferences_time_slots_is_an_array',
      ],
      [
        'time slots that are a text',
        () => ({ preferredTimeSlots: '10:00-12:00' }),
        'customer_preferences_time_slots_is_an_array',
      ],
      [
        'a style preference that is a list',
        () => ({ stylePreferences: [] }),
        'customer_preferences_style_is_an_object',
      ],
      [
        'a style preference that is a text',
        () => ({ stylePreferences: 'ショート' }),
        'customer_preferences_style_is_an_object',
      ],
    ])('refuses %s', async (_case, columnsOf, constraint) => {
      const customerId = await insertCustomer(db)
      const staffId = await staffMember()

      await expect(
        insertRow(customerId, columnsOf(staffId)),
      ).rejects.toMatchObject(violationOf('23514', constraint))
      expect(await db.$count(customerPreferences)).toBe(0)
    })

    it('accepts a row without a preferred staff member and without a style preference, whoever is avoided', async () => {
      const customerId = await insertCustomer(db)
      const staffId = await staffMember()

      await insertRow(customerId, {
        preferredStaffId: null,
        avoidStaffIds: [staffId, UNKNOWN_ID],
        stylePreferences: null,
      })

      expect(await storedRowOf(customerId)).toMatchObject({
        preferredStaffId: null,
        avoidStaffIds: [staffId, UNKNOWN_ID],
        stylePreferences: null,
      })
    })

    it.each(['preferredTimeSlots', 'avoidStaffIds'])(
      'refuses NULL as %s, and has no default for it',
      async (column) => {
        const customerId = await insertCustomer(db)
        await insertRow(customerId)
        const other = await insertCustomer(db)
        const emptyLists = {
          preferredTimeSlots: sql`'[]'::jsonb`,
          avoidStaffIds: sql`'{}'::uuid[]`,
        }
        const statedColumns = Object.entries(emptyLists).filter(
          ([name]) => name !== column,
        )

        await expect(
          db.execute(
            sql`UPDATE ${customerPreferences} SET ${sql.identifier(column)} = NULL WHERE ${customerPreferences.customerId} = ${customerId}`,
          ),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({
            code: '23502',
            column_name: column,
          }),
        })
        await expect(
          db.execute(
            sql`INSERT INTO ${customerPreferences} ("customerId", ${sql.join(
              statedColumns.map(([name]) => sql.identifier(name)),
              sql`, `,
            )}) VALUES (${other}, ${sql.join(
              statedColumns.map(([, value]) => value),
              sql`, `,
            )})`,
          ),
        ).rejects.toMatchObject({
          cause: expect.objectContaining({
            code: '23502',
            column_name: column,
          }),
        })
      },
    )

    it('keeps one row per customer', async () => {
      const customerId = await insertCustomer(db)
      await insertRow(customerId)

      await expect(insertRow(customerId)).rejects.toMatchObject(
        violationOf('23505', 'customer_preferences_unique'),
      )
      expect(await db.$count(customerPreferences)).toBe(1)
    })

    it('refuses a row of a customer and with a preferred staff member that do not exist', async () => {
      const customerId = await insertCustomer(db)

      await expect(insertRow(UNKNOWN_ID)).rejects.toMatchObject(
        violationOf('23503', 'customer_preferences_customer_id_fk'),
      )
      await expect(
        insertRow(customerId, { preferredStaffId: UNKNOWN_ID }),
      ).rejects.toMatchObject(
        violationOf('23503', 'customer_preferences_staff_id_fk'),
      )
    })

    it('removes the row with the row of its customer, and unsets a preferred staff member whose row is removed while an avoided one stays', async () => {
      const leaves = await insertCustomer(db)
      const stays = await insertCustomer(db)
      const preferred = await staffMember()
      const avoided = await staffMember()
      for (const customerId of [leaves, stays]) {
        await insertRow(customerId, {
          preferredStaffId: preferred,
          avoidStaffIds: [avoided],
        })
      }

      await db.delete(customers).where(eq(customers.id, leaves))
      await db.delete(staff).where(eq(staff.id, preferred))
      await db.delete(staff).where(eq(staff.id, avoided))

      expect(await storedRows()).toEqual([
        expect.objectContaining({
          customerId: stays,
          preferredStaffId: null,
          avoidStaffIds: [avoided],
        }),
      ])
    })

    it('has the columns of the preferences: a list of UUIDs, two JSON columns without a default, and no preferredServices', async () => {
      const columns = await getTestDbClient()<
        {
          column_name: string
          udt_name: string
          is_nullable: string
          column_default: string | null
        }[]
      >`
        SELECT column_name, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'customer_preferences'
        ORDER BY column_name
      `

      expect(
        columns
          .filter(({ column_name }) => PROPERTIES.includes(column_name))
          .map((column) => ({ ...column })),
      ).toEqual([
        {
          column_name: 'avoidStaffIds',
          udt_name: '_uuid',
          is_nullable: 'NO',
          column_default: null,
        },
        {
          column_name: 'communicationStyle',
          udt_name: 'varchar',
          is_nullable: 'YES',
          column_default: null,
        },
        {
          column_name: 'preferredStaffId',
          udt_name: 'uuid',
          is_nullable: 'YES',
          column_default: null,
        },
        {
          column_name: 'preferredTimeSlots',
          udt_name: 'jsonb',
          is_nullable: 'NO',
          column_default: null,
        },
        {
          column_name: 'specialRequests',
          udt_name: 'text',
          is_nullable: 'YES',
          column_default: null,
        },
        {
          column_name: 'stylePreferences',
          udt_name: 'jsonb',
          is_nullable: 'YES',
          column_default: null,
        },
      ])
      expect(columns.map(({ column_name }) => column_name).toSorted()).toEqual(
        [
          ...PROPERTIES,
          'id',
          'customerId',
          'createdAt',
          'updatedAt',
        ].toSorted(),
      )
    })
  })
})
