import {
  customerAllergies,
  customers,
  medicalCharts,
} from '@beauty-salon-backend/database'
import {
  customerAllergyIdSchema,
  customerIdSchema,
  type DbNewCustomerAllergy,
  type DomainError,
} from '@beauty-salon-backend/domain'
import { CustomerAllergyRepository } from '@beauty-salon-backend/infrastructure'
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
  databaseMoment,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
  UUID,
} from './_shared/test-helpers'

const PATH = '/api/v1/medical-charts'

/** Where the allergies of a customer are listed and added. */
const allergiesPathOf = (customerId: string): string =>
  `${PATH}/customer/${customerId}/allergies`

const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
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

const INVALID_ALLERGY = 'Invalid customer allergy'
const INVALID_SEARCH = 'Invalid customer allergy search'

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** Whether a request is answered while what it may wait for is held. */
const answersWithin = (
  call: Promise<unknown>,
  milliseconds: number,
): Promise<boolean> =>
  Promise.race([call.then(() => true), pause(milliseconds).then(() => false)])

/** A day of the calendar, `days` after today in UTC. */
const dayFromToday = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

/** A request that adds an allergy, with every item stated. */
const allergyBody = (overrides: Record<string, unknown> = {}) => ({
  allergyType: 'chemical',
  allergenName: 'パラフェニレンジアミン（PPD）',
  severityType: 'severe',
  symptoms: '頭皮に赤みとかゆみ',
  notes: 'ジアミンを含まないカラー剤を使う',
  confirmedDate: '2025-06-10',
  ...overrides,
})

type NewAllergyRow = typeof customerAllergies.$inferInsert

describe('Customer allergy API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of the members of the tests, and the customer of most tests. */
  let salonId: string
  let customerId: string

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = await signInAsAdmin(app, db)
    salonId = await insertSalon(db)
    customerId = await insertCustomer(db)
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const add = (customer: string, body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(allergiesPathOf(customer)), as).send(body)

  const update = (
    customer: string,
    id: string,
    body: object,
    as: string | null = asAdmin,
  ) =>
    authorized(
      request(app).patch(`${allergiesPathOf(customer)}/${id}`),
      as,
    ).send(body)

  const remove = (customer: string, id: string, as: string | null = asAdmin) =>
    authorized(request(app).delete(`${allergiesPathOf(customer)}/${id}`), as)

  const list = (
    customer: string,
    query: Record<string, string> = {},
    as: string | null = asAdmin,
  ) => authorized(request(app).get(allergiesPathOf(customer)).query(query), as)

  /** An allergy written directly; of the customer of the tests unless another is given. */
  const insertAllergy = async (
    overrides: Partial<NewAllergyRow> = {},
  ): Promise<string> => {
    const [allergy] = await db
      .insert(customerAllergies)
      .values({
        customerId,
        allergyType: 'metal',
        allergenName: 'ニッケル',
        severityType: 'moderate',
        symptoms: null,
        notes: null,
        confirmedDate: null,
        ...overrides,
      })
      .returning({ id: customerAllergies.id })
    if (allergy === undefined) {
      throw new Error('No allergy was inserted')
    }
    return allergy.id
  }

  const deleteCustomer = async (id: string): Promise<void> => {
    await db
      .update(customers)
      .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
      .where(eq(customers.id, id))
  }

  /** A customer who was deleted. */
  const deletedCustomer = async (): Promise<string> => {
    const deleted = await insertCustomer(db)
    await deleteCustomer(deleted)
    return deleted
  }

  const storedAllergy = async (id: string) => {
    const [allergy] = await db
      .select()
      .from(customerAllergies)
      .where(eq(customerAllergies.id, id))
    return allergy
  }

  /** Every allergy, to tell that nothing was written. */
  const everything = () =>
    db.select().from(customerAllergies).orderBy(asc(customerAllergies.id))

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** A member of a salon; of the salon of the tests unless another is given. */
  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
      staffOverrides: Parameters<typeof insertMember>[3] = {},
    ): SignInAs =>
    async () => {
      const { email } = await insertMember(
        db,
        role,
        await salonOf(),
        staffOverrides,
      )
      return (await signIn(app, email)).authorization
    }

  /** Everyone who keeps the allergies: the customer ledger is one for every salon. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of a salon', member('owner')],
    ['a manager of a salon', member('manager')],
    ['a staff member of a salon', member('staff')],
    ['a staff member of another salon', member('staff', () => insertSalon(db))],
  ]

  /** Accounts that reach no allergies at all. */
  const outsiders: [string, SignInAs][] = [
    [
      'the customer of the allergies',
      async () => (await signedInUser(app, db, { customerId })).authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
    [
      'an account of a salon whose staff record is deleted',
      member('owner', async () => salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      }),
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
  const operations: ((
    as: string | null,
    allergy: string,
  ) => Promise<Response>)[] = [
    async (as) => list(customerId, {}, as),
    async (as) => add(customerId, allergyBody(), as),
    async (as, allergy) =>
      update(customerId, allergy, { severityType: 'mild' }, as),
    async (as, allergy) => remove(customerId, allergy, as),
  ]

  describe('POST /api/v1/medical-charts/customer/:customerId/allergies', () => {
    it('writes the allergy of the customer and answers 201 as the contract has it, without a Location', async () => {
      const body = allergyBody()

      const response = await add(customerId, body)

      expect(response.status).toBe(201)
      // One reading of the clock stamps the new row, to the microsecond
      const [stamps] = await db
        .select({
          createdAt: customerAllergies.createdAt,
          updatedAt: customerAllergies.updatedAt,
        })
        .from(customerAllergies)
        .where(eq(customerAllergies.id, response.body.data.id))
      expect(stamps?.updatedAt).toBe(stamps?.createdAt)
      expect(response.headers['location']).toBeUndefined()
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          ...body,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: response.body.data.createdAt,
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { list: allergiesPathOf(customerId) },
      })
      expect(await storedAllergy(response.body.data.id)).toMatchObject({
        customerId,
        ...body,
      })
      expect((await list(customerId)).body.data).toEqual([response.body.data])
    })

    it.each(keepers)('lets %s add an allergy', async (_who, signInAs) => {
      const response = await add(customerId, allergyBody(), await signInAs())

      expect(response.status).toBe(201)
      expect(await everything()).toEqual([
        expect.objectContaining({ id: response.body.data.id, customerId }),
      ])
    })

    it('writes an allergy with nothing but its kind, allergen and level', async () => {
      const body = allergyBody({
        allergyType: 'latex',
        severityType: 'life_threatening',
        symptoms: null,
        notes: null,
        confirmedDate: null,
      })

      const response = await add(customerId, body)

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(body)
    })

    it('takes what the limits allow: an allergen of 255 characters, a day of 1900-01-01, and the UTC day after today', async () => {
      const responses = [
        await add(
          customerId,
          allergyBody({
            allergenName: '漢'.repeat(255),
            confirmedDate: '1900-01-01',
          }),
        ),
        await add(
          customerId,
          allergyBody({ allergenName: 'PPD', confirmedDate: dayFromToday(1) }),
        ),
      ]

      expect(responses.map(statusAndCode)).toEqual(['201', '201'])
    })

    it('refuses a second allergy of one allergen with 409, and keeps the first as it was', async () => {
      const first = await add(customerId, allergyBody())
      const before = await everything()

      const response = await add(
        customerId,
        allergyBody({ allergyType: 'other', severityType: 'mild' }),
      )

      expectProblem(response, notAllowed)
      expect(await everything()).toEqual(before)
      expect(before).toEqual([
        expect.objectContaining({
          id: first.body.data.id,
          severityType: 'severe',
        }),
      ])
    })

    it('takes an allergen that differs in case, and one of another customer', async () => {
      await add(customerId, allergyBody({ allergenName: 'PPD' }))

      const responses = [
        await add(customerId, allergyBody({ allergenName: 'ppd' })),
        await add(
          await insertCustomer(db),
          allergyBody({ allergenName: 'PPD' }),
        ),
      ]

      expect(responses.map(statusAndCode)).toEqual(['201', '201'])
      expect(await everything()).toHaveLength(3)
    })

    it.each<[string, () => Promise<string>]>([
      ['that is not there', async () => UNKNOWN_ID],
      ['who was deleted', deletedCustomer],
    ])(
      'answers 404 for a customer %s, and writes nothing',
      async (_case, customerOf) => {
        const customer = await customerOf()

        const response = await add(customer, allergyBody())

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(`Customer ${customer} was not found`)
        expect(await everything()).toEqual([])
      },
    )

    it.each<[string, Record<string, unknown>, string[]]>([
      ['a missing item', { notes: undefined }, ['notes:invalid_type']],
      [
        'the severity of the old model',
        { severity: 3 },
        ['severity:unrecognized_keys'],
      ],
      [
        'the customer',
        { customerId: UNKNOWN_ID },
        ['customerId:unrecognized_keys'],
      ],
      ['no level', { severityType: null }, ['severityType:invalid_value']],
      [
        'a level that is not one',
        { severityType: 'critical' },
        ['severityType:invalid_value'],
      ],
      [
        'a kind that is not one',
        { allergyType: 'food' },
        ['allergyType:invalid_value'],
      ],
      [
        'a blank allergen',
        { allergenName: ' ' },
        ['allergenName:invalid_format'],
      ],
      [
        'an allergen too long',
        { allergenName: '漢'.repeat(256) },
        ['allergenName:too_big'],
      ],
      ['blank symptoms', { symptoms: '\t' }, ['symptoms:invalid_format']],
      ['blank notes', { notes: '' }, ['notes:invalid_format']],
      [
        'a day that is not one',
        { confirmedDate: '2026-02-30' },
        ['confirmedDate:invalid_format'],
      ],
      [
        'a day before 1900',
        { confirmedDate: '1899-12-31' },
        ['confirmedDate:too_small'],
      ],
      [
        'the day after tomorrow in UTC',
        { confirmedDate: dayFromToday(2) },
        ['confirmedDate:too_big'],
      ],
    ])('refuses %s, and writes nothing', async (_case, overrides, rules) => {
      const response = await add(customerId, allergyBody(overrides))

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_ALLERGY)
      expect(brokenRules(response)).toEqual(rules)
      expect(await everything()).toEqual([])
    })

    it('looks at the day before it looks for the customer, and at the shape before the day', async () => {
      const future = await add(
        UNKNOWN_ID,
        allergyBody({ confirmedDate: dayFromToday(2) }),
      )
      const blank = await add(
        UNKNOWN_ID,
        allergyBody({ allergenName: '', confirmedDate: dayFromToday(2) }),
      )

      expect(brokenRules(future)).toEqual(['confirmedDate:too_big'])
      expect(brokenRules(blank)).toEqual(['allergenName:invalid_format'])
    })

    it('refuses a customer ID that is no UUID before the request, by the name of the path', async () => {
      const response = await add('customer-1', { notes: '' })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer ID')
      expect(brokenRules(response)).toEqual(['customerId:invalid_format'])
    })

    it('refuses a body that is no object', async () => {
      expectProblem(await add(customerId, ['an allergy']), badRequest)
      expect(await everything()).toEqual([])
    })

    it('takes a customer ID in upper case, and links the list under the path it was asked by', async () => {
      const response = await request(app)
        .post(
          `/API/V1/MEDICAL-CHARTS/customer/${customerId.toUpperCase()}/allergies`,
        )
        .set('Authorization', asAdmin)
        .send(allergyBody())

      expect(response.status).toBe(201)
      expect(response.body.links).toEqual({
        list: `/API/V1/MEDICAL-CHARTS/customer/${customerId.toUpperCase()}/allergies`,
      })
      expect(await everything()).toEqual([
        expect.objectContaining({ customerId }),
      ])
    })
  })

  describe('PATCH /api/v1/medical-charts/customer/:customerId/allergies/:allergyId', () => {
    it('changes only what the request names, at a later moment, and answers the allergy', async () => {
      const id = await insertAllergy({
        allergyType: 'chemical',
        allergenName: 'PPD',
        severityType: 'severe',
        symptoms: 'かゆみ',
        notes: 'メモ',
        confirmedDate: '2025-06-10',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      })

      const response = await update(customerId, id, {
        severityType: 'life_threatening',
        symptoms: null,
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          id,
          allergyType: 'chemical',
          allergenName: 'PPD',
          severityType: 'life_threatening',
          symptoms: null,
          notes: 'メモ',
          confirmedDate: '2025-06-10',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { list: allergiesPathOf(customerId) },
      })
      expect(
        Date.parse(response.body.data.updatedAt) -
          Date.parse('2026-11-01T00:00:00.000Z'),
      ).toBeGreaterThan(0)
      expect(await storedAllergy(id)).toMatchObject({
        customerId,
        severityType: 'life_threatening',
        symptoms: null,
        notes: 'メモ',
      })
    })

    it.each(keepers)('lets %s change an allergy', async (_who, signInAs) => {
      const id = await insertAllergy()

      const response = await update(
        customerId,
        id,
        { notes: '変更' },
        await signInAs(),
      )

      expect(response.status).toBe(200)
      expect((await storedAllergy(id))?.notes).toBe('変更')
    })

    it('clears what can be null, and renames the allergen to a free name and to its own', async () => {
      const id = await insertAllergy({
        symptoms: 'かゆみ',
        notes: 'メモ',
        confirmedDate: '2025-06-10',
      })
      await insertAllergy({
        customerId: await insertCustomer(db),
        allergenName: 'コバルト',
      })

      const responses = [
        await update(customerId, id, {
          symptoms: null,
          notes: null,
          confirmedDate: null,
        }),
        await update(customerId, id, { allergenName: 'コバルト' }),
        await update(customerId, id, { allergenName: 'コバルト' }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200'])
      expect(await storedAllergy(id)).toMatchObject({
        allergenName: 'コバルト',
        symptoms: null,
        notes: null,
        confirmedDate: null,
      })
    })

    it('refuses the allergen of another allergy of the customer with 409, and changes nothing', async () => {
      const id = await insertAllergy({ allergenName: 'ニッケル' })
      await insertAllergy({ allergenName: 'コバルト' })
      const before = await everything()

      const response = await update(customerId, id, {
        allergenName: 'コバルト',
        notes: '変更',
      })

      expectProblem(response, notAllowed)
      expect(await everything()).toEqual(before)
    })

    it.each<[string, object, string[]]>([
      ['nothing to change', {}, [':custom']],
      [
        'the customer of the allergy',
        { customerId: UNKNOWN_ID },
        ['customerId:unrecognized_keys'],
      ],
      [
        'an allergen as null',
        { allergenName: null },
        ['allergenName:invalid_type'],
      ],
      [
        'a level as null',
        { severityType: null },
        ['severityType:invalid_value'],
      ],
      ['blank notes', { notes: '  ' }, ['notes:invalid_format']],
      [
        'the day after tomorrow in UTC',
        { confirmedDate: dayFromToday(2) },
        ['confirmedDate:too_big'],
      ],
    ])('refuses %s, and changes nothing', async (_case, body, rules) => {
      const id = await insertAllergy()
      const before = await everything()

      const response = await update(customerId, id, body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_ALLERGY)
      expect(brokenRules(response)).toEqual(rules)
      expect(await everything()).toEqual(before)
    })

    it.each<[string, () => Promise<[string, string]>, 'Customer' | 'Allergy']>([
      [
        'an allergy that is not there',
        async () => [customerId, UNKNOWN_ID],
        'Allergy',
      ],
      [
        'an allergy of another customer',
        async () => [
          customerId,
          await insertAllergy({ customerId: await insertCustomer(db) }),
        ],
        'Allergy',
      ],
      [
        'a customer who is not there',
        async () => [UNKNOWN_ID, await insertAllergy()],
        'Customer',
      ],
      [
        'an allergy of a customer who was deleted',
        async () => {
          const deleted = await insertCustomer(db)
          const allergy = await insertAllergy({ customerId: deleted })
          await deleteCustomer(deleted)
          return [deleted, allergy]
        },
        'Customer',
      ],
    ])(
      'answers 404 for %s, and changes nothing',
      async (_case, idsOf, missing) => {
        const [customer, allergy] = await idsOf()
        const before = await everything()

        const response = await update(customer, allergy, { notes: '変更' })

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          missing === 'Customer'
            ? `Customer ${customer} was not found`
            : `CustomerAllergy ${allergy} was not found`,
        )
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses IDs that are no UUIDs before the request, each by its name', async () => {
      const response = await update('customer-1', 'allergy-1', { notes: '' })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer allergy ID')
      expect(brokenRules(response)).toEqual([
        'customerId:invalid_format',
        'allergyId:invalid_format',
      ])
    })

    it('takes IDs in upper case, and links the list under the path it was asked by', async () => {
      const id = await insertAllergy()

      const response = await request(app)
        .patch(
          `/API/V1/MEDICAL-CHARTS/customer/${customerId.toUpperCase()}/allergies/${id.toUpperCase()}?from=ledger`,
        )
        .set('Authorization', asAdmin)
        .send({ notes: '変更' })

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
      expect(response.body.links).toEqual({
        list: `/API/V1/MEDICAL-CHARTS/customer/${customerId.toUpperCase()}/allergies`,
      })
    })
  })

  describe('DELETE /api/v1/medical-charts/customer/:customerId/allergies/:allergyId', () => {
    it('removes the allergy and answers 204 without a body, and leaves the others', async () => {
      const id = await insertAllergy({ allergenName: 'PPD' })
      const kept = await insertAllergy({ allergenName: 'ニッケル' })
      const other = await insertAllergy({
        customerId: await insertCustomer(db),
        allergenName: 'PPD',
      })

      const response = await remove(customerId, id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(
        (await everything()).map((allergy) => allergy.id).toSorted(),
      ).toEqual([kept, other].toSorted())
      expectProblem(await remove(customerId, id), notFound)
    })

    it.each<[string, SignInAs]>([
      ['an administrator', async () => asAdmin],
      ['the owner of a salon', member('owner')],
      ['a manager of a salon', member('manager')],
      ['a manager of another salon', member('manager', () => insertSalon(db))],
    ])('lets %s remove an allergy', async (_who, signInAs) => {
      const id = await insertAllergy()

      const response = await remove(customerId, id, await signInAs())

      expect(response.status).toBe(204)
      expect(await everything()).toEqual([])
    })

    it('refuses a staff member before the IDs are read, and removes nothing', async () => {
      const id = await insertAllergy()
      const staff = await member('staff')()

      expectProblem(await remove(customerId, id, staff), forbidden)
      expectProblem(await remove('customer-1', 'allergy-1', staff), forbidden)
      expect(await everything()).toEqual([expect.objectContaining({ id })])
    })

    it.each<[string, () => Promise<[string, string]>, 'Customer' | 'Allergy']>([
      [
        'an allergy that is not there',
        async () => [customerId, UNKNOWN_ID],
        'Allergy',
      ],
      [
        'an allergy of another customer',
        async () => [
          customerId,
          await insertAllergy({ customerId: await insertCustomer(db) }),
        ],
        'Allergy',
      ],
      [
        'a customer who is not there',
        async () => [UNKNOWN_ID, await insertAllergy()],
        'Customer',
      ],
      [
        'an allergy of a customer who was deleted',
        async () => {
          const deleted = await insertCustomer(db)
          const allergy = await insertAllergy({ customerId: deleted })
          await deleteCustomer(deleted)
          return [deleted, allergy]
        },
        'Customer',
      ],
    ])(
      'answers 404 for %s, and removes nothing',
      async (_case, idsOf, missing) => {
        const [customer, allergy] = await idsOf()
        const before = await everything()

        const response = await remove(customer, allergy)

        expectProblem(response, notFound)
        expect(response.body.detail).toBe(
          missing === 'Customer'
            ? `Customer ${customer} was not found`
            : `CustomerAllergy ${allergy} was not found`,
        )
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses an allergy ID that is no UUID', async () => {
      const response = await remove(customerId, 'allergy-1')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['allergyId:invalid_format'])
    })

    it('moves the chart of a customer whose last allergy is removed to the charts without allergies', async () => {
      const id = await insertAllergy()
      await db.insert(medicalCharts).values({
        customerId,
        previousTreatments: [],
        medicalConditions: null,
        preferredProducts: [],
        avoidProducts: [],
        notes: null,
      })
      const chartsWithout = async () =>
        (
          await authorized(
            request(app).get(PATH).query({ hasAllergies: 'false' }),
            asAdmin,
          )
        ).body.meta.total

      expect(await chartsWithout()).toBe(0)
      await remove(customerId, id)
      expect(await chartsWithout()).toBe(1)
    })
  })

  describe('GET /api/v1/medical-charts/customer/:customerId/allergies', () => {
    const allergyId = (last: string): string =>
      `0193a5b8-7c2e-7d4f-8a1b-0000000000${last}`

    /**
     * Allergies of the customer, stored in another order than they are
     * listed and than their IDs: B is the severest; D, F and C are severe,
     * D recorded first and F and C at one moment (of microseconds) with F
     * the lower ID; then E, and A the mildest.
     */
    const storeOrdered = async (): Promise<string[]> => {
      const at = (time: string) => `2026-11-01T00:00:${time}Z`
      const rows: [string, NewAllergyRow['severityType'], string][] = [
        ['0a', 'mild', at('01')],
        ['0f', 'severe', at('02.123456')],
        ['0e', 'moderate', at('02')],
        ['0b', 'life_threatening', at('03')],
        ['0c', 'severe', at('02.123456')],
        ['0d', 'severe', at('01')],
      ]
      for (const [last, severityType, createdAt] of rows) {
        await insertAllergy({
          id: allergyId(last),
          allergenName: `allergen ${last}`,
          severityType,
          createdAt,
        })
      }
      // An allergy of another customer, which no page shows or counts.
      await insertAllergy({
        customerId: await insertCustomer(db),
        severityType: 'life_threatening',
        createdAt: at('00'),
      })
      return ['0b', '0d', '0c', '0f', '0e', '0a'].map(allergyId)
    }

    it('lists the severest first, then in the order of their records, one page after another', async () => {
      const expected = await storeOrdered()

      const seen: string[] = []
      let cursor: string | null = null
      for (let page = 0; page < expected.length; page += 1) {
        const query: Record<string, string> =
          cursor === null ? { limit: '1' } : { limit: '1', cursor }
        const response = await list(customerId, query)
        expect(response.status).toBe(200)
        expect(response.body.meta).toEqual({
          total: 6,
          limit: 1,
          hasMore: page < expected.length - 1,
          cursor,
          nextCursor:
            page < expected.length - 1 ? response.body.data[0].id : null,
          prevCursor: null,
        })
        seen.push(...response.body.data.map(({ id }: { id: string }) => id))
        cursor = response.body.meta.nextCursor
      }

      expect(seen).toEqual(expected)
      expect(cursor).toBeNull()
    })

    it('shows the allergies as the contract has them, in a page with links', async () => {
      const id = await insertAllergy({
        allergyType: 'fragrance',
        allergenName: '香料',
        severityType: 'mild',
        symptoms: 'くしゃみ',
        notes: null,
        confirmedDate: '2024-01-31',
        createdAt: '2026-11-01T00:00:00.123456Z',
        updatedAt: '2026-11-02T00:00:00Z',
      })

      const response = await list(customerId, { limit: '2' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [
          {
            id,
            allergyType: 'fragrance',
            allergenName: '香料',
            severityType: 'mild',
            symptoms: 'くしゃみ',
            notes: null,
            confirmedDate: '2024-01-31',
            createdAt: '2026-11-01T00:00:00.123Z',
            updatedAt: '2026-11-02T00:00:00.000Z',
          },
        ],
        meta: {
          total: 1,
          limit: 2,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: `${allergiesPathOf(customerId)}?limit=2`,
          first: `${allergiesPathOf(customerId)}?limit=2`,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('ends with a page that holds what is left exactly', async () => {
      const expected = await storeOrdered()

      const first = await list(customerId, { limit: '3' })
      const last = await list(customerId, {
        limit: '3',
        cursor: first.body.meta.nextCursor,
      })

      expect(first.body.meta).toMatchObject({ hasMore: true })
      expect(last.body.data.map(({ id }: { id: string }) => id)).toEqual(
        expected.slice(3),
      )
      expect(last.body.meta).toMatchObject({ hasMore: false, nextCursor: null })
    })

    it('gives 20 a page unless the query says otherwise', async () => {
      for (let index = 0; index < 21; index += 1) {
        await insertAllergy({ allergenName: `allergen ${index}` })
      }

      const response = await list(customerId)

      expect(response.body.data).toHaveLength(20)
      expect(response.body.meta).toMatchObject({
        total: 21,
        limit: 20,
        hasMore: true,
      })
    })

    it('answers an empty page for a customer without allergies', async () => {
      await insertAllergy({ customerId: await insertCustomer(db) })

      const response = await list(customerId)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    it.each<[string, () => Promise<string>]>([
      ['that is not there', async () => UNKNOWN_ID],
      [
        'who was deleted, with allergies',
        async () => {
          const deleted = await insertCustomer(db)
          await insertAllergy({ customerId: deleted })
          await deleteCustomer(deleted)
          return deleted
        },
      ],
    ])('answers 404 for a customer %s', async (_case, customerOf) => {
      const customer = await customerOf()

      const response = await list(customer)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`Customer ${customer} was not found`)
    })

    it.each<[string, () => Promise<Record<string, string>>, string[]]>([
      ['a limit of 0', async () => ({ limit: '0' }), ['limit:too_small']],
      ['a limit of 101', async () => ({ limit: '101' }), ['limit:too_big']],
      [
        'a limit that is no number',
        async () => ({ limit: 'ten' }),
        ['limit:invalid_format'],
      ],
      [
        'a limit that is no whole number',
        async () => ({ limit: '1.5' }),
        ['limit:invalid_type'],
      ],
      [
        'a cursor that is no UUID',
        async () => ({ cursor: 'allergy-1' }),
        ['cursor:invalid_format'],
      ],
      [
        'a cursor that names no allergy',
        async () => ({ cursor: UNKNOWN_ID }),
        ['cursor:not_found'],
      ],
      [
        'a cursor that names an allergy of another customer',
        async () => ({
          cursor: await insertAllergy({ customerId: await insertCustomer(db) }),
        }),
        ['cursor:not_found'],
      ],
      [
        'a parameter of its own',
        async () => ({ search: 'PPD' }),
        ['search:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, queryOf, rules) => {
      await insertAllergy()

      const response = await list(customerId, await queryOf())

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(rules)
    })

    it('refuses a limit given twice', async () => {
      const response = await request(app)
        .get(`${allergiesPathOf(customerId)}?limit=1&limit=2`)
        .set('Authorization', asAdmin)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['limit:invalid_type'])
    })

    it('refuses a customer ID that is no UUID before the query, by the name of the path', async () => {
      const response = await list('customer-1', { limit: 'ten' })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer ID')
      expect(brokenRules(response)).toEqual(['customerId:invalid_format'])
    })

    it('links the pages under the path it was asked by, with the query it was asked with', async () => {
      const expected = await storeOrdered()
      const path = `/API/V1/MEDICAL-CHARTS/customer/${customerId.toUpperCase()}/allergies`

      const response = await request(app)
        .get(`${path}?limit=2&cursor=${expected[0]}`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.links).toEqual({
        self: `${path}?limit=2&cursor=${expected[0]}`,
        first: `${path}?limit=2`,
        last: null,
        next: `${path}?limit=2&cursor=${expected[2]}`,
        prev: null,
      })
    })

    it('answers 500 for a stored allergy that does not match the model', async () => {
      await insertAllergy()
      await db.execute(
        sql`UPDATE customer_allergies SET "updatedAt" = 'infinity'`,
      )

      expectProblem(await list(customerId), databaseProblem)
    })
  })

  describe('who may', () => {
    it.each(outsiders)(
      'refuses %s every operation, and changes nothing',
      async (_who, signInAs) => {
        const allergy = await insertAllergy()
        const authorization = await signInAs()
        const before = await everything()

        const responses: Response[] = []
        for (const call of operations) {
          responses.push(await call(authorization, allergy))
        }

        expect(responses.map(statusAndCode)).toEqual(
          Array.from({ length: 4 }, () => '403 1005'),
        )
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses an outsider before it looks at the request', async () => {
      const { authorization } = await signedInUser(app, db, { customerId })

      const responses = [
        await list('customer-1', { limit: 'ten' }, authorization),
        await add('customer-1', { notes: '' }, authorization),
        await update('customer-1', 'allergy-1', {}, authorization),
        await remove('customer-1', 'allergy-1', authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it.each(unauthenticated)(
      'refuses %s every operation with 401, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const allergy = await insertAllergy()
        const token = await tokenOf()
        const before = await everything()

        for (const call of operations) {
          const response = await call(token, allergy)
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['GET on one allergy', 'get', '/ID'],
      ['PUT on one allergy', 'put', '/ID'],
      ['POST on one allergy', 'post', '/ID'],
      ['PUT on the list', 'put', ''],
      ['PATCH on the list', 'patch', ''],
      ['DELETE on the list', 'delete', ''],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const allergy = await insertAllergy()
        const before = await everything()

        const response = await request(app)
          [method](
            `${allergiesPathOf(customerId)}${suffix.replace('ID', allergy)}`,
          )
          .set('Authorization', asAdmin)
          .send({ notes: '変更' })

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('requests at the same moment', () => {
    type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

    /**
     * Holds a row as another writer does, and sends the request meanwhile.
     * Tells the moment of the database at which the hold ended: the request
     * was let through after it.
     */
    const whileHeld = async (
      hold: (tx: Transaction) => Promise<unknown>,
      call: () => Promise<Response>,
    ): Promise<{
      response: Response
      answeredWhileHeld: boolean
      releasedAt: number
    }> => {
      const { pending, answeredWhileHeld, releasedAt } = await db.transaction(
        async (tx) => {
          await hold(tx)
          const underWay = call().then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            releasedAt: await databaseMoment(tx),
          }
        },
      )
      return { response: await pending, answeredWhileHeld, releasedAt }
    }

    /** An allergy of the customer of the tests, as another writer writes it. */
    const otherWriterAllergy = (allergenName: string) => (tx: Transaction) =>
      tx.insert(customerAllergies).values({
        customerId,
        allergyType: 'chemical',
        allergenName,
        severityType: 'mild',
        notes: 'other writer',
      })

    it('writes one allergy of an allergen when two additions arrive together', async () => {
      const responses = await Promise.all([
        add(customerId, allergyBody({ notes: 'one' })),
        add(customerId, allergyBody({ notes: 'two' })),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
      ])
      expect(await everything()).toHaveLength(1)
    })

    it('makes an addition wait for a removal of the customer in progress, and answers that the customer is not there', async () => {
      const { response, answeredWhileHeld } = await whileHeld(
        (tx) =>
          tx
            .update(customers)
            .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
            .where(eq(customers.id, customerId)),
        () => add(customerId, allergyBody()),
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notFound)
      expect(await everything()).toEqual([])
    })

    it('makes an addition wait for a change of the customer in progress, and writes the allergy at the moment it is let through', async () => {
      const { response, answeredWhileHeld, releasedAt } = await whileHeld(
        (tx) =>
          tx
            .update(customers)
            .set({ notes: '変更' })
            .where(eq(customers.id, customerId)),
        () => add(customerId, allergyBody()),
      )

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(201)
      expect(Date.parse(response.body.data.createdAt)).toBeGreaterThanOrEqual(
        releasedAt,
      )
      expect(response.body.data.updatedAt).toBe(response.body.data.createdAt)
    })

    it('makes an addition wait for an allergy of the same allergen that another writer has not committed, and refuses it once it is written', async () => {
      const { response, answeredWhileHeld } = await whileHeld(
        otherWriterAllergy('PPD'),
        () => add(customerId, allergyBody({ allergenName: 'PPD' })),
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notAllowed)
      expect(await everything()).toEqual([
        expect.objectContaining({ notes: 'other writer' }),
      ])
    })

    it('makes an addition wait for an allergy of the same allergen that another writer has not committed, and writes its own once that is taken back', async () => {
      const held: { call?: Promise<Response>; answered?: boolean } = {}

      await db
        .transaction(async (tx) => {
          await otherWriterAllergy('PPD')(tx)
          held.call = add(
            customerId,
            allergyBody({ allergenName: 'PPD' }),
          ).then((response) => response)
          held.answered = await answersWithin(held.call, 300)
          tx.rollback()
        })
        .catch(() => undefined)
      const response = await held.call

      expect(held.answered).toBe(false)
      expect(response?.status).toBe(201)
      expect(await everything()).toEqual([
        expect.objectContaining({ notes: allergyBody().notes }),
      ])
    })

    it('does not make an addition wait for an allergy of another allergen that another writer has not committed', async () => {
      const { response, answeredWhileHeld } = await whileHeld(
        otherWriterAllergy('ニッケル'),
        () => add(customerId, allergyBody({ allergenName: 'PPD' })),
      )

      expect(answeredWhileHeld).toBe(true)
      expect(response.status).toBe(201)
    })

    it('keeps both of two changes of different items that arrive together', async () => {
      const id = await insertAllergy()

      const responses = await Promise.all([
        update(customerId, id, { notes: 'one' }),
        update(customerId, id, { symptoms: 'two' }),
      ])

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(await storedAllergy(id)).toMatchObject({
        notes: 'one',
        symptoms: 'two',
      })
    })

    it('makes a change wait for another change of the allergy in progress, writes over what it left, at the moment it is let through', async () => {
      const id = await insertAllergy()

      const { response, answeredWhileHeld, releasedAt } = await whileHeld(
        (tx) =>
          tx
            .update(customerAllergies)
            .set({ notes: 'first', severityType: 'severe' })
            .where(eq(customerAllergies.id, id)),
        () => update(customerId, id, { notes: 'second' }),
      )

      expect(answeredWhileHeld).toBe(false)
      expect(response.body.data).toMatchObject({
        notes: 'second',
        severityType: 'severe',
      })
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThanOrEqual(
        releasedAt,
      )
    })

    it('makes a rename wait for an allergy of that allergen that another writer has not committed, and refuses it once it is written', async () => {
      const id = await insertAllergy({ allergenName: 'PPD' })

      const { response, answeredWhileHeld } = await whileHeld(
        otherWriterAllergy('コバルト'),
        () => update(customerId, id, { allergenName: 'コバルト' }),
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notAllowed)
      expect((await storedAllergy(id))?.allergenName).toBe('PPD')
    })

    it('lists from one moment: an allergy written while the list waits is in neither the page nor the count', async () => {
      const first = await insertAllergy({ allergenName: 'PPD' })
      const waitedFor = async (): Promise<boolean> => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const [locks] = await db.execute(
            sql`SELECT count(*)::int AS "waiting" FROM pg_locks WHERE NOT granted AND relation = 'customer_allergies'::regclass`,
          )
          if (Number(locks?.['waiting']) > 0) {
            return true
          }
          await pause(20)
        }
        return false
      }

      const { pending, waited } = await db.transaction(async (tx) => {
        await tx.execute(
          sql`LOCK TABLE ${customerAllergies} IN ACCESS EXCLUSIVE MODE`,
        )
        const underWay = list(customerId).then((response) => response)
        // The list has found the customer and waits to look at the
        // allergies; a severer allergy is written meanwhile.
        const blocked = await waitedFor()
        await tx.insert(customerAllergies).values({
          customerId,
          allergyType: 'latex',
          allergenName: 'ラテックス',
          severityType: 'life_threatening',
        })
        return { pending: underWay, waited: blocked }
      })
      const response = await pending

      expect(waited).toBe(true)
      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        first,
      ])
      expect(response.body.meta.total).toBe(1)
      expect((await list(customerId)).body.meta.total).toBe(2)
    })
  })

  describe('CustomerAllergyRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new CustomerAllergyRepository(db)

    const newAllergy = (): DbNewCustomerAllergy => ({
      allergyType: 'metal',
      allergenName: 'ニッケル',
      severityType: 'moderate',
      symptoms: null,
      notes: null,
      confirmedDate: null,
    })

    it.each<[string, ReturnType<typeof sql>]>([
      [
        'an allergy without a level',
        sql`UPDATE customer_allergies SET "severityType" = NULL`,
      ],
      [
        'a second allergy of one allergen',
        sql`INSERT INTO customer_allergies ("customerId", "allergyType", "allergenName", "severityType") SELECT "customerId", 'other', "allergenName", 'mild' FROM customer_allergies`,
      ],
    ])('lets the database refuse %s', async (_case, statement) => {
      await insertAllergy()
      const before = await everything()

      const outcome = await db.execute(statement).then(
        () => 'written',
        () => 'refused',
      )

      expect(outcome).toBe('refused')
      expect(await everything()).toEqual(before)
    })

    it('reads what it wrote', async () => {
      const customer = customerIdSchema.parse(customerId)
      const added = dataOf(await repository().add(customer, newAllergy()))

      expect(added.type).toBe('added')
      expect(
        dataOf(
          await repository().list({
            customerId: customer,
            limit: 1,
            after: null,
          }),
        ),
      ).toEqual({
        type: 'listed',
        allergies: added.type === 'added' ? [added.allergy] : [],
        total: 1,
        hasMore: false,
      })
    })

    it('tells the database could not be reached, for every method', async () => {
      const connection = connectUnreachableDatabase()
      const unreachable = new CustomerAllergyRepository(connection.database)
      const customer = customerIdSchema.parse(UNKNOWN_ID)
      const id = customerAllergyIdSchema.parse(UNKNOWN_ID)

      const results = [
        await unreachable.add(customer, newAllergy()),
        await unreachable.update(customer, id, { notes: null }),
        await unreachable.remove(customer, id),
        await unreachable.list({ customerId: customer, limit: 1, after: null }),
      ]
      await connection.close()

      expect(
        results.map((result) =>
          result.type === 'error' && result.error.type === 'database'
            ? result.error.message
            : 'not an error',
        ),
      ).toEqual([
        'Failed to add customer allergy',
        'Failed to update customer allergy',
        'Failed to remove customer allergy',
        'Failed to list customer allergies',
      ])
    })
  })
})
