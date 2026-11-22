import {
  customerAllergies,
  customers,
  medicalCharts,
} from '@beauty-salon-backend/database'
import {
  customerIdSchema,
  type DomainError,
  medicalChartIdSchema,
} from '@beauty-salon-backend/domain'
import { MedicalChartRepository } from '@beauty-salon-backend/infrastructure'
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
} from '../../../__tests__/_shared/auth-helpers'
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
} from '../../../__tests__/_shared/test-helpers'

const PATH = '/api/v1/medical-charts'

/** Where the chart of a customer is read. */
const chartPathOf = (customerId: string): string =>
  `${PATH}/customer/${customerId}`

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

const INVALID_CHART = 'Invalid medical chart'
const INVALID_SEARCH = 'Invalid medical chart search'

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

/** A previous treatment at another salon. */
const treatmentOf = (overrides: Record<string, unknown> = {}) => ({
  treatment: 'color',
  date: '2026-03-14',
  salonName: 'Hair Studio Ginza',
  notes: 'ブリーチ 1 回',
  ...overrides,
})

/** A request that creates the chart of the customer, with every item stated. */
const chartBodyOf = (
  customerId: string,
  overrides: Record<string, unknown> = {},
) => ({
  customerId,
  previousTreatments: [treatmentOf(), treatmentOf({ treatment: 'perm' })],
  medicalConditions: '頭皮が乾燥しやすい',
  preferredProducts: ['Aveda', 'オーガニックシャンプー'],
  avoidProducts: ['強い香料の整髪料'],
  notes: 'ぬるめのお湯を希望',
  ...overrides,
})

type NewChartRow = typeof medicalCharts.$inferInsert

describe('Medical chart API', () => {
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

  const create = (body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(PATH), as).send(body)

  const get = (customer: string, as: string | null = asAdmin) =>
    authorized(request(app).get(chartPathOf(customer)), as)

  const update = (id: string, body: object, as: string | null = asAdmin) =>
    authorized(request(app).patch(`${PATH}/${id}`), as).send(body)

  const list = (query: Record<string, string>, as: string | null = asAdmin) =>
    authorized(request(app).get(PATH).query(query), as)

  /** A chart written directly; the customer of the tests unless another is given. */
  const insertChart = async (
    overrides: Partial<NewChartRow> = {},
  ): Promise<string> => {
    const [chart] = await db
      .insert(medicalCharts)
      .values({
        customerId,
        previousTreatments: [],
        medicalConditions: null,
        preferredProducts: [],
        avoidProducts: [],
        notes: null,
        ...overrides,
      })
      .returning({ id: medicalCharts.id })
    if (chart === undefined) {
      throw new Error('No chart was inserted')
    }
    return chart.id
  }

  /** A customer who is not deleted, with a chart; returns the customer and the chart. */
  const customerWithChart = async (
    overrides: Partial<NewChartRow> = {},
  ): Promise<{ customer: string; chart: string }> => {
    const customer = await insertCustomer(db)
    return {
      customer,
      chart: await insertChart({ customerId: customer, ...overrides }),
    }
  }

  const deleteCustomer = async (id: string): Promise<void> => {
    await db
      .update(customers)
      .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
      .where(eq(customers.id, id))
  }

  const storedChart = async (id: string) => {
    const [chart] = await db
      .select()
      .from(medicalCharts)
      .where(eq(medicalCharts.id, id))
    return chart
  }

  /** Every chart, to tell that nothing was written. */
  const everything = () =>
    db.select().from(medicalCharts).orderBy(asc(medicalCharts.id))

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

  /** Everyone who keeps the charts: the customer ledger is one for every salon. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of a salon', member('owner')],
    ['a manager of a salon', member('manager')],
    ['a staff member of a salon', member('staff')],
    ['a staff member of another salon', member('staff', () => insertSalon(db))],
  ]

  /** Accounts that reach no charts at all. */
  const outsiders: [string, SignInAs][] = [
    [
      'the customer of the chart',
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
    chart: { customer: string; chart: string },
  ) => Promise<Response>)[] = [
    async (as) => list({}, as),
    async (as, { customer }) => get(customer, as),
    async (as) => create(chartBodyOf(await insertCustomer(db)), as),
    async (as, { chart }) => update(chart, { notes: '変更' }, as),
  ]

  describe('POST /api/v1/medical-charts', () => {
    it('writes the chart with the previous treatments in the order of the request, and answers 201 as the contract has it', async () => {
      const body = chartBodyOf(customerId)

      const response = await create(body)

      expect(response.status).toBe(201)
      // One reading of the clock stamps the new row, to the microsecond
      const [stamps] = await db
        .select({
          createdAt: medicalCharts.createdAt,
          updatedAt: medicalCharts.updatedAt,
        })
        .from(medicalCharts)
        .where(eq(medicalCharts.id, response.body.data.id))
      expect(stamps?.updatedAt).toBe(stamps?.createdAt)
      expect(response.headers['location']).toBe(chartPathOf(customerId))
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
        links: { self: chartPathOf(customerId), list: PATH },
      })
      expect(await storedChart(response.body.data.id)).toMatchObject({
        customerId,
        previousTreatments: body.previousTreatments,
        medicalConditions: body.medicalConditions,
        preferredProducts: body.preferredProducts,
        avoidProducts: body.avoidProducts,
        notes: body.notes,
      })
      expect((await get(customerId)).body.data).toEqual(response.body.data)
    })

    it.each(keepers)('lets %s write a chart', async (_who, signInAs) => {
      const response = await create(chartBodyOf(customerId), await signInAs())

      expect(response.status).toBe(201)
      expect(response.body.data.customerId).toBe(customerId)
    })

    it('writes a chart with nothing in it: empty lists and nulls', async () => {
      const body = chartBodyOf(customerId, {
        previousTreatments: [],
        medicalConditions: null,
        preferredProducts: [],
        avoidProducts: [],
        notes: null,
      })

      const response = await create(body)

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(body)
    })

    it('takes what the limits allow: 50 treatments, 50 names of 100 characters, a salon name of 255, and a treatment of the UTC day after today', async () => {
      const names = (prefix: string) =>
        Array.from({ length: 50 }, (_, index) =>
          `${prefix}${index}`.padEnd(100, 'x'),
        )
      const body = chartBodyOf(customerId, {
        previousTreatments: Array.from({ length: 50 }, (_, index) =>
          treatmentOf({
            date: index === 0 ? dayFromToday(1) : '1900-01-01',
            salonName: 's'.repeat(255),
          }),
        ),
        preferredProducts: names('p'),
        avoidProducts: names('a'),
      })

      const response = await create(body)

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(body)
    })

    it('refuses a second chart of a customer with 409, and keeps the first as it was', async () => {
      const first = await create(chartBodyOf(customerId))
      const before = await everything()

      const response = await create(
        chartBodyOf(customerId, { notes: '二つ目' }),
      )

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        'The customer has a medical chart already; a customer has one',
      )
      expect(await everything()).toEqual(before)
      expect((await get(customerId)).body.data).toEqual(first.body.data)
    })

    it.each<[string, () => Promise<string>]>([
      ['that is not there', async () => UNKNOWN_ID],
      [
        'who was deleted',
        async () => {
          const deleted = await insertCustomer(db)
          await deleteCustomer(deleted)
          return deleted
        },
      ],
    ])(
      'refuses a customer %s as one the request names wrongly, and writes nothing',
      async (_case, customerOf) => {
        const response = await create(chartBodyOf(await customerOf()))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_CHART)
        expect(brokenRules(response)).toEqual(['customerId:not_found'])
        expect(await everything()).toEqual([])
      },
    )

    it.each<[string, Record<string, unknown>, string[]]>([
      ['a missing item', { notes: undefined }, ['notes:invalid_type']],
      [
        'the allergies of the old model',
        { allergies: null },
        ['allergies:unrecognized_keys'],
      ],
      [
        'the scalp condition of the old model',
        { scalpCondition: null },
        ['scalpCondition:unrecognized_keys'],
      ],
      [
        'a list as null',
        { preferredProducts: null },
        ['preferredProducts:invalid_type'],
      ],
      [
        'a blank name and a name too long',
        { preferredProducts: [' ', 'x'.repeat(101)] },
        ['preferredProducts.0:invalid_format', 'preferredProducts.1:too_big'],
      ],
      [
        'a name twice',
        { avoidProducts: ['A', 'B', 'A'] },
        ['avoidProducts.2:custom'],
      ],
      [
        'too many names',
        { avoidProducts: Array.from({ length: 51 }, (_, index) => `${index}`) },
        ['avoidProducts:too_big'],
      ],
      [
        'too many treatments',
        {
          previousTreatments: Array.from({ length: 51 }, () => treatmentOf()),
        },
        ['previousTreatments:too_big'],
      ],
      [
        'a treatment of a kind that is not one, on no day, at a salon whose name is too long, with blank notes',
        {
          previousTreatments: [
            treatmentOf({
              treatment: 'massage',
              date: '2026-02-30',
              salonName: 's'.repeat(256),
              notes: '',
            }),
          ],
        },
        [
          'previousTreatments.0.treatment:invalid_value',
          'previousTreatments.0.date:invalid_format',
          'previousTreatments.0.salonName:too_big',
          'previousTreatments.0.notes:invalid_format',
        ],
      ],
      [
        'a treatment of a moment rather than a day, one before 1900, and one at a salon of a blank name',
        {
          previousTreatments: [
            treatmentOf({ date: '2026-03-14T10:00:00Z' }),
            treatmentOf({ date: '1899-12-31' }),
            treatmentOf({ salonName: ' ' }),
          ],
        },
        [
          'previousTreatments.0.date:invalid_format',
          'previousTreatments.1.date:too_small',
          'previousTreatments.2.salonName:invalid_format',
        ],
      ],
      [
        'a treatment with a key of its own',
        { previousTreatments: [{ ...treatmentOf(), staff: 'Hanako' }] },
        ['previousTreatments.0.staff:unrecognized_keys'],
      ],
      [
        'blank conditions and notes',
        { medicalConditions: '', notes: ' \n' },
        ['medicalConditions:invalid_format', 'notes:invalid_format'],
      ],
      [
        'a customer ID that is no UUID',
        { customerId: 'customer-1' },
        ['customerId:invalid_format'],
      ],
    ])('refuses %s, and writes nothing', async (_case, overrides, rules) => {
      const response = await create(chartBodyOf(customerId, overrides))

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_CHART)
      expect(brokenRules(response)).toEqual(rules)
      expect(await everything()).toEqual([])
    })

    it('refuses treatments after the UTC day after today, each under its place, and writes nothing', async () => {
      const response = await create(
        chartBodyOf(customerId, {
          previousTreatments: [
            treatmentOf({ date: dayFromToday(2) }),
            treatmentOf({ date: dayFromToday(1) }),
            treatmentOf({ date: '2999-12-31' }),
          ],
        }),
      )

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        {
          field: 'previousTreatments.0.date',
          rule: 'too_big',
          message: 'Must not be in the future',
          value: null,
          constraint: null,
        },
        {
          field: 'previousTreatments.2.date',
          rule: 'too_big',
          message: 'Must not be in the future',
          value: null,
          constraint: null,
        },
      ])
      expect(await everything()).toEqual([])
    })

    it('looks at the dates before it looks for the customer, and at the shape before the dates', async () => {
      const future = treatmentOf({ date: dayFromToday(2) })

      const dates = await create(
        chartBodyOf(UNKNOWN_ID, { previousTreatments: [future] }),
      )
      const shape = await create(
        chartBodyOf(UNKNOWN_ID, { previousTreatments: [future], notes: '' }),
      )

      expect(brokenRules(dates)).toEqual(['previousTreatments.0.date:too_big'])
      expect(brokenRules(shape)).toEqual(['notes:invalid_format'])
    })

    it('refuses a body that is no object', async () => {
      expectProblem(await create(['a chart']), badRequest)
      expect(await everything()).toEqual([])
    })

    it('links the chart under the path it was asked by', async () => {
      const response = await request(app)
        .post('/API/V1/MEDICAL-CHARTS')
        .set('Authorization', asAdmin)
        .send(chartBodyOf(customerId))

      expect(response.status).toBe(201)
      expect(response.headers['location']).toBe(
        `/API/V1/MEDICAL-CHARTS/customer/${customerId}`,
      )
      expect(response.body.links).toEqual({
        self: `/API/V1/MEDICAL-CHARTS/customer/${customerId}`,
        list: '/API/V1/MEDICAL-CHARTS',
      })
    })
  })

  describe('GET /api/v1/medical-charts/customer/:customerId', () => {
    it.each(keepers)(
      'lets %s read the chart of a customer, linked by the customer',
      async (_who, signInAs) => {
        const id = await insertChart({
          previousTreatments: [treatmentOf()],
          medicalConditions: '腰痛',
          preferredProducts: ['Aveda'],
          avoidProducts: ['B'],
          notes: 'メモ',
        })

        const response = await get(customerId, await signInAs())

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
          data: {
            id,
            customerId,
            previousTreatments: [treatmentOf()],
            medicalConditions: '腰痛',
            preferredProducts: ['Aveda'],
            avoidProducts: ['B'],
            notes: 'メモ',
            createdAt: expect.stringMatching(ISO_TIMESTAMP),
            updatedAt: expect.stringMatching(ISO_TIMESTAMP),
          },
          meta: {
            correlationId: expect.any(String),
            timestamp: expect.stringMatching(ISO_TIMESTAMP),
            version: 'v1',
          },
          links: { self: chartPathOf(customerId), list: PATH },
        })
      },
    )

    it.each<[string, () => Promise<string>, string]>([
      ['a customer without a chart', async () => customerId, 'MedicalChart'],
      ['a customer who is not there', async () => UNKNOWN_ID, 'Customer'],
      [
        'a customer who was deleted, with a chart',
        async () => {
          const { customer } = await customerWithChart()
          await deleteCustomer(customer)
          return customer
        },
        'Customer',
      ],
    ])('answers 404 for %s', async (_case, customerOf, entity) => {
      const customer = await customerOf()

      const response = await get(customer)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`${entity} ${customer} was not found`)
    })

    it('refuses a customer ID that is no UUID, by the name of the path', async () => {
      const response = await get('customer-1')

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid customer ID')
      expect(brokenRules(response)).toEqual(['customerId:invalid_format'])
    })

    it('takes a customer ID in upper case, and links under the path it was asked by', async () => {
      await insertChart()

      const response = await request(app)
        .get(`/API/V1/MEDICAL-CHARTS/customer/${customerId.toUpperCase()}`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.customerId).toBe(customerId)
      expect(response.body.links).toEqual({
        self: `/API/V1/MEDICAL-CHARTS/customer/${customerId}`,
        list: '/API/V1/MEDICAL-CHARTS',
      })
    })

    it('answers 500 for a stored chart that does not match the model', async () => {
      await insertChart({
        previousTreatments: [{ treatment: 'massage', date: '2026-03-14' }],
      })

      expectProblem(await get(customerId), databaseProblem)
      expectProblem(await list({}), databaseProblem)
    })
  })

  describe('PATCH /api/v1/medical-charts/:id', () => {
    it('changes only what the request names, at a later moment, and replaces a list whole', async () => {
      const created = (await create(chartBodyOf(customerId))).body.data

      const response = await update(created.id, {
        previousTreatments: [treatmentOf({ treatment: 'cut', notes: null })],
        medicalConditions: null,
        avoidProducts: [],
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          ...created,
          previousTreatments: [treatmentOf({ treatment: 'cut', notes: null })],
          medicalConditions: null,
          avoidProducts: [],
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: chartPathOf(customerId), list: PATH },
      })
      expect(response.body.data.updatedAt > created.updatedAt).toBe(true)
      expect((await get(customerId)).body.data).toEqual(response.body.data)
    })

    it.each(keepers)('lets %s change a chart', async (_who, signInAs) => {
      const id = await insertChart()

      const response = await update(
        id,
        { preferredProducts: ['Aveda'] },
        await signInAs(),
      )

      expect(response.status).toBe(200)
      expect(response.body.data.preferredProducts).toEqual(['Aveda'])
    })

    it.each<[string, object, string[]]>([
      ['nothing to change', {}, [':custom']],
      [
        'the customer of the chart',
        { customerId: UNKNOWN_ID },
        ['customerId:unrecognized_keys'],
      ],
      [
        'a list as null',
        { previousTreatments: null },
        ['previousTreatments:invalid_type'],
      ],
      [
        'a name twice',
        { preferredProducts: ['A', 'A'] },
        ['preferredProducts.1:custom'],
      ],
      [
        'a treatment of the day after tomorrow in UTC',
        { previousTreatments: [treatmentOf({ date: dayFromToday(2) })] },
        ['previousTreatments.0.date:too_big'],
      ],
      ['blank notes', { notes: '  ' }, ['notes:invalid_format']],
      [
        'blank conditions',
        { medicalConditions: '' },
        ['medicalConditions:invalid_format'],
      ],
    ])('refuses %s, and changes nothing', async (_case, body, rules) => {
      const id = await insertChart()
      const before = await everything()

      const response = await update(id, body)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_CHART)
      expect(brokenRules(response)).toEqual(rules)
      expect(await everything()).toEqual(before)
    })

    it.each<[string, () => Promise<string>]>([
      ['a chart that is not there', async () => UNKNOWN_ID],
      [
        'the chart of a customer who was deleted',
        async () => {
          const { customer, chart } = await customerWithChart()
          await deleteCustomer(customer)
          return chart
        },
      ],
    ])('answers 404 for %s, and changes nothing', async (_case, chartOf) => {
      const id = await chartOf()
      const before = await everything()

      const response = await update(id, { notes: '変更' })

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(`MedicalChart ${id} was not found`)
      expect(await everything()).toEqual(before)
    })

    it('refuses an ID that is no UUID before the request', async () => {
      const response = await update('chart-1', { notes: '' })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid medical chart ID')
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('takes an ID in upper case, and links under the path it was asked by', async () => {
      const id = await insertChart()

      const response = await request(app)
        .patch(`/API/V1/MEDICAL-CHARTS/${id.toUpperCase()}`)
        .set('Authorization', asAdmin)
        .send({ notes: '変更' })

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
      expect(response.body.links).toEqual({
        self: `/API/V1/MEDICAL-CHARTS/customer/${customerId}`,
        list: '/API/V1/MEDICAL-CHARTS',
      })
    })
  })

  describe('GET /api/v1/medical-charts', () => {
    /** Charts of new customers, created one after the other, oldest first. */
    const chartsInTurn = async (count: number): Promise<string[]> => {
      const ids: string[] = []
      for (let index = 0; index < count; index += 1) {
        ids.push((await customerWithChart()).chart)
      }
      return ids
    }

    it('lists the latest charts first, and pages forwards with a cursor', async () => {
      const [first, second, third] = await chartsInTurn(3)

      const page = await list({ limit: '2' })
      const next = await list({
        limit: '2',
        cursor: page.body.meta.nextCursor,
      })

      expect(page.status).toBe(200)
      expect(page.body.data.map(({ id }: { id: string }) => id)).toEqual([
        third,
        second,
      ])
      expect(page.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: second,
        prevCursor: null,
      })
      expect(page.body.links).toEqual({
        self: `${PATH}?limit=2`,
        first: `${PATH}?limit=2`,
        next: `${PATH}?limit=2&cursor=${second}`,
        prev: null,
        last: null,
      })
      expect(next.body.data.map(({ id }: { id: string }) => id)).toEqual([
        first,
      ])
      expect(next.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: false,
        cursor: second,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('orders the charts of one moment by their IDs, downwards, across pages', async () => {
      const moment = '2026-11-01T00:00:00.000Z'
      const ids = [
        (await customerWithChart({ createdAt: moment })).chart,
        (await customerWithChart({ createdAt: moment })).chart,
        (await customerWithChart({ createdAt: moment })).chart,
      ].toSorted()
      const seen: string[] = []

      let cursor: string | null = null
      for (let page = 0; page < 3; page += 1) {
        const response: Response = await list({
          limit: '1',
          ...(cursor === null ? {} : { cursor }),
        })
        seen.push(...response.body.data.map(({ id }: { id: string }) => id))
        cursor = response.body.meta.nextCursor
      }

      expect(seen).toEqual(ids.toReversed())
      expect(cursor).toBeNull()
    })

    it.each<[string, string, string[]]>([
      ['the conditions, in another case', 'KANSOU', ['conditions']],
      ['the notes, in another case', 'memo', ['notes']],
      [
        'a preferred product, and not the name of a previous salon',
        'aveda',
        ['preferred'],
      ],
      ['an avoided product', 'Silicone', ['avoided']],
      [
        'every place, latest first',
        'O',
        ['percent', 'avoided', 'notes', 'conditions'],
      ],
      ['a % as a character, not as any text', '%', ['percent']],
      ['an _ as a character, not as any character', '_', []],
    ])('finds a keyword in %s', async (_case, keyword, expected) => {
      const named = new Map<string, string>()
      const write = async (name: string, overrides: Partial<NewChartRow>) => {
        named.set((await customerWithChart(overrides)).chart, name)
      }
      await write('conditions', { medicalConditions: 'Kansou ぎみ' })
      await write('notes', { notes: 'MEMO of the staff' })
      await write('preferred', { preferredProducts: ['x', 'Aveda'] })
      await write('avoided', { avoidProducts: ['y', 'silicone oil'] })
      await write('percent', { notes: '100% cotton' })
      await write('treatments', {
        previousTreatments: [treatmentOf({ salonName: 'Aveda Salon' })],
      })

      const response = await list({ search: keyword })

      expect(response.status).toBe(200)
      expect(
        response.body.data.map(({ id }: { id: string }) => named.get(id)),
      ).toEqual(expected)
      expect(response.body.meta.total).toBe(expected.length)
    })

    it('filters by whether the customer has an allergy', async () => {
      const allergic = await customerWithChart()
      const free = await customerWithChart()
      await db.insert(customerAllergies).values([
        {
          customerId: allergic.customer,
          allergyType: 'chemical',
          allergenName: 'PPD',
          severityType: 'moderate',
        },
        {
          customerId: allergic.customer,
          allergyType: 'metal',
          allergenName: 'ニッケル',
          severityType: 'moderate',
        },
      ])

      const withAllergy = await list({ hasAllergies: 'true' })
      const without = await list({ hasAllergies: 'false' })

      expect(withAllergy.body.data.map(({ id }: { id: string }) => id)).toEqual(
        [allergic.chart],
      )
      expect(withAllergy.body.meta.total).toBe(1)
      expect(without.body.data.map(({ id }: { id: string }) => id)).toEqual([
        free.chart,
      ])
    })

    it('leaves out the charts of the customers who were deleted, from the list and from its count, and refuses one as a cursor', async () => {
      const kept = await customerWithChart()
      const gone = await customerWithChart()
      await deleteCustomer(gone.customer)

      const response = await list({})
      const cursor = await list({ cursor: gone.chart })

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        kept.chart,
      ])
      expect(response.body.meta).toMatchObject({ total: 1, limit: 20 })
      expectProblem(cursor, badRequest)
      expect(brokenRules(cursor)).toEqual(['cursor:not_found'])
    })

    it.each<[string, Record<string, string>, string[]]>([
      ['a limit of 0', { limit: '0' }, ['limit:too_small']],
      ['a limit of 101', { limit: '101' }, ['limit:too_big']],
      ['a limit that is no number', { limit: 'ten' }, ['limit:invalid_format']],
      [
        'a limit that is no whole number',
        { limit: '1.5' },
        ['limit:invalid_type'],
      ],
      [
        'a cursor that is no UUID',
        { cursor: 'chart-1' },
        ['cursor:invalid_format'],
      ],
      [
        'a cursor that names no chart',
        { cursor: UNKNOWN_ID },
        ['cursor:not_found'],
      ],
      ['a blank keyword', { search: ' ' }, ['search:invalid_format']],
      ['a keyword too long', { search: 'x'.repeat(101) }, ['search:too_big']],
      [
        'an allergy filter that is no boolean',
        { hasAllergies: 'yes' },
        ['hasAllergies:invalid_value'],
      ],
      [
        'a parameter of its own',
        { customerId: UNKNOWN_ID },
        ['customerId:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, rules) => {
      await insertChart()

      const response = await list(query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(rules)
    })
  })

  describe('who may', () => {
    it.each(outsiders)(
      'refuses %s every operation, and changes nothing',
      async (_who, signInAs) => {
        const chart = await insertChart()
        const authorization = await signInAs()
        const before = await everything()

        const responses: Response[] = []
        for (const call of operations) {
          responses.push(
            await call(authorization, { customer: customerId, chart }),
          )
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
        await list({ limit: 'ten' }, authorization),
        await get('customer-1', authorization),
        await create({ notes: '' }, authorization),
        await update('chart-1', {}, authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it.each(unauthenticated)(
      'refuses %s every operation with 401, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const chart = await insertChart()
        const token = await tokenOf()
        const before = await everything()

        for (const call of operations) {
          const response = await call(token, { customer: customerId, chart })
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['GET on a chart by its ID', 'get', '/ID'],
      ['DELETE on a chart', 'delete', '/ID'],
      ['PUT on a chart', 'put', '/ID'],
      ['PATCH on the chart of a customer', 'patch', '/customer/CUSTOMER'],
      ['DELETE on the list', 'delete', ''],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const chart = await insertChart()
        const before = await everything()

        const response = await request(app)
          [method](
            `${PATH}${suffix.replace('ID', chart).replace('CUSTOMER', customerId)}`,
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

    it('writes one chart of a customer when two creations arrive together', async () => {
      const responses = await Promise.all([
        create(chartBodyOf(customerId, { notes: 'one' })),
        create(chartBodyOf(customerId, { notes: 'two' })),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
      ])
      expect(await everything()).toHaveLength(1)
    })

    it('makes a creation wait for a removal of the customer in progress, and refuses the removed customer', async () => {
      const { response, answeredWhileHeld } = await whileHeld(
        (tx) =>
          tx
            .update(customers)
            .set({ deletedAt: '2026-11-01T00:00:00.000Z' })
            .where(eq(customers.id, customerId)),
        () => create(chartBodyOf(customerId)),
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['customerId:not_found'])
      expect(await everything()).toEqual([])
    })

    it('makes a creation wait for a change of the customer in progress, and writes the chart at the moment it is let through', async () => {
      const { response, answeredWhileHeld, releasedAt } = await whileHeld(
        (tx) =>
          tx
            .update(customers)
            .set({ notes: '変更' })
            .where(eq(customers.id, customerId)),
        () => create(chartBodyOf(customerId)),
      )

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(201)
      expect(Date.parse(response.body.data.createdAt)).toBeGreaterThanOrEqual(
        releasedAt,
      )
      expect(response.body.data.updatedAt).toBe(response.body.data.createdAt)
    })

    /** A chart of the customer of the tests, as another writer writes it. */
    const otherWriterChart = (tx: Transaction) =>
      tx.insert(medicalCharts).values({
        customerId,
        previousTreatments: [],
        medicalConditions: null,
        preferredProducts: [],
        avoidProducts: [],
        notes: 'other writer',
      })

    it('makes a creation wait for a chart of the customer that another writer has not committed, and refuses it once it is written', async () => {
      const { response, answeredWhileHeld } = await whileHeld(
        otherWriterChart,
        () => create(chartBodyOf(customerId)),
      )

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notAllowed)
      expect(await everything()).toEqual([
        expect.objectContaining({ notes: 'other writer' }),
      ])
    })

    it('makes a creation wait for a chart of the customer that another writer has not committed, and writes its own once that is taken back', async () => {
      const held: { call?: Promise<Response>; answered?: boolean } = {}

      await db
        .transaction(async (tx) => {
          await otherWriterChart(tx)
          held.call = create(chartBodyOf(customerId)).then(
            (response) => response,
          )
          held.answered = await answersWithin(held.call, 300)
          tx.rollback()
        })
        .catch(() => undefined)
      const response = await held.call

      expect(held.answered).toBe(false)
      expect(response?.status).toBe(201)
      expect(await everything()).toEqual([
        expect.objectContaining({ notes: 'ぬるめのお湯を希望' }),
      ])
    })

    it('keeps both of two changes of different items that arrive together', async () => {
      const id = await insertChart()

      const responses = await Promise.all([
        update(id, { notes: 'one' }),
        update(id, { medicalConditions: 'two' }),
      ])

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(await storedChart(id)).toMatchObject({
        notes: 'one',
        medicalConditions: 'two',
      })
    })

    it('makes a change wait for another change of the chart in progress, writes over what it left, at the moment it is let through', async () => {
      const id = await insertChart()

      const { response, answeredWhileHeld, releasedAt } = await whileHeld(
        (tx) =>
          tx
            .update(medicalCharts)
            .set({ notes: 'first', avoidProducts: ['X'] })
            .where(eq(medicalCharts.id, id)),
        () => update(id, { notes: 'second' }),
      )

      expect(answeredWhileHeld).toBe(false)
      expect(response.body.data).toMatchObject({
        notes: 'second',
        avoidProducts: ['X'],
      })
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThanOrEqual(
        releasedAt,
      )
    })

    it('lists from one moment: a chart written while the list waits is in neither the page nor the count', async () => {
      const allergic = async () => {
        const chart = await customerWithChart()
        await db.insert(customerAllergies).values({
          customerId: chart.customer,
          allergyType: 'chemical',
          allergenName: 'PPD',
          severityType: 'moderate',
        })
        return chart
      }
      const older = await allergic()
      const cursor = await allergic()
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
        const underWay = list({
          hasAllergies: 'true',
          cursor: cursor.chart,
        }).then((response) => response)
        // The list has found its cursor and waits to look at the allergies;
        // an older chart of a customer with an allergy is written meanwhile.
        const blocked = await waitedFor()
        const [customer] = await tx
          .insert(customers)
          .values({
            firstName: 'Late',
            lastName: 'Writer',
            email: 'late-writer@example.com',
            phoneNumber: '090-0000-0000',
            tags: [],
          })
          .returning({ id: customers.id })
        if (customer === undefined) {
          throw new Error('No customer was inserted')
        }
        await tx.insert(medicalCharts).values({
          customerId: customer.id,
          previousTreatments: [],
          medicalConditions: null,
          preferredProducts: [],
          avoidProducts: [],
          notes: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        await tx.insert(customerAllergies).values({
          customerId: customer.id,
          allergyType: 'metal',
          allergenName: 'ニッケル',
          severityType: 'moderate',
        })
        return { pending: underWay, waited: blocked }
      })
      const response = await pending

      expect(waited).toBe(true)
      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        older.chart,
      ])
      expect(response.body.meta.total).toBe(2)
      expect((await list({ hasAllergies: 'true' })).body.meta.total).toBe(3)
    })
  })

  describe('MedicalChartRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new MedicalChartRepository(db)

    const newChart = () => ({
      customerId: customerIdSchema.parse(customerId),
      previousTreatments: [],
      medicalConditions: null,
      preferredProducts: [],
      avoidProducts: [],
      notes: null,
    })

    it.each<[string, ReturnType<typeof sql>]>([
      [
        'a list of names that holds a null',
        sql`UPDATE medical_charts SET "avoidProducts" = ARRAY['A', NULL]::text[]`,
      ],
      [
        'previous treatments that are no list',
        sql`UPDATE medical_charts SET "previousTreatments" = '{}'::jsonb`,
      ],
    ])('lets the database refuse %s', async (_case, statement) => {
      await insertChart()
      const before = await everything()

      const outcome = await db.execute(statement).then(
        () => 'written',
        () => 'refused',
      )

      expect(outcome).toBe('refused')
      expect(await everything()).toEqual(before)
    })

    it('reads what it wrote', async () => {
      const created = dataOf(await repository().create(newChart()))

      expect(created.type).toBe('created')
      expect(
        dataOf(
          await repository().findByCustomer(customerIdSchema.parse(customerId)),
        ),
      ).toEqual(
        created.type === 'created'
          ? { type: 'found', chart: created.chart }
          : null,
      )
    })

    it('tells the database could not be reached, for every method', async () => {
      const connection = connectUnreachableDatabase()
      const unreachable = new MedicalChartRepository(connection.database)
      const id = medicalChartIdSchema.parse(UNKNOWN_ID)

      const results = [
        await unreachable.create(newChart()),
        await unreachable.findByCustomer(customerIdSchema.parse(UNKNOWN_ID)),
        await unreachable.update(id, { notes: null }),
        await unreachable.list({
          limit: 1,
          after: null,
          search: null,
          hasAllergies: null,
        }),
      ]
      await connection.close()

      expect(
        results.map((result) =>
          result.type === 'error' && result.error.type === 'database'
            ? result.error.message
            : 'not an error',
        ),
      ).toEqual([
        'Failed to create medical chart',
        'Failed to find medical chart',
        'Failed to update medical chart',
        'Failed to list medical charts',
      ])
    })
  })
})
