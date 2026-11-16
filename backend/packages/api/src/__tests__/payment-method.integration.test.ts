import {
  paymentMethods,
  paymentTransactions,
  sales,
  salons,
} from '@beauty-salon-backend/database'
import {
  type DbNewPaymentMethod,
  type DomainError,
  paymentMethodIdSchema,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { PaymentMethodRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { asc, eq } from 'drizzle-orm'
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

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/**
 * UUIDs that come before every one the database makes up, in this order: a
 * row that is given one of them is the first of its table by ID, and not by
 * where it lies.
 */
const FIRST_ID = '00000000-0000-4000-8000-000000000001'
const SECOND_ID = '00000000-0000-4000-8000-000000000002'

const MAX_INTEGER = 2_147_483_647

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const unreadable = { status: 400, code: '2002', type: 'malformed-body' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID = 'Invalid payment method'
const INVALID_UPDATE = 'Invalid payment method update'
const INVALID_SEARCH = 'Invalid payment method search'
const INVALID_ID = 'Invalid payment method ID'
const IN_USE =
  'The payment method cannot be deleted: a payment refers to it; set isActive to false instead'
const ABOVE_THE_UPPER_LIMIT = 'Must not be more than maximumAmount'
const BELOW_THE_LOWER_LIMIT = 'Must not be less than minimumAmount'
const NO_SUCH_CURSOR = 'Must name a payment method of the salon'

/** The properties of a PaymentMethodResponse. */
const PROPERTIES = [
  'createdAt',
  'description',
  'displayName',
  'fee',
  'id',
  'isActive',
  'isOfflineEnabled',
  'isOnlineEnabled',
  'maximumAmount',
  'method',
  'minimumAmount',
  'processorName',
  'salonId',
  'sortOrder',
  'updatedAt',
]

type PaymentStatus = (typeof paymentTransactions.$inferInsert)['status']

const PAYMENT_STATUSES: PaymentStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partial_refund',
]

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('Payment methods API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string

  type NewSalon = typeof salons.$inferInsert
  type NewPaymentMethod = typeof paymentMethods.$inferInsert
  type NewPayment = typeof paymentTransactions.$inferInsert
  type Executor = Pick<typeof db, 'insert'>
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(db, overrides)

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await salon()
  })

  /** Where the payment methods of a salon are. */
  const pathOf = (ofSalon: string = salonId): string =>
    `/api/v1/salons/${ofSalon}/payment-methods`

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A request that keeps every rule: a card terminal with a fee and limits. */
  const paymentMethod = (overrides: Record<string, unknown> = {}) => ({
    method: 'credit_card',
    displayName: 'クレジットカード',
    description: 'Visa, Mastercard, JCB',
    processorName: 'Stripe',
    fee: 3.6,
    minimumAmount: 1000,
    maximumAmount: 500000,
    isOnlineEnabled: true,
    isOfflineEnabled: true,
    sortOrder: 2,
    isActive: true,
    ...overrides,
  })

  const create = (
    body: object = paymentMethod(),
    as: string | null = asAdmin,
    ofSalon: string = salonId,
  ): Test => authorized(request(app).post(pathOf(ofSalon)), as).send(body)

  const read = (
    id: string,
    as: string | null = asAdmin,
    ofSalon: string = salonId,
  ): Test => authorized(request(app).get(`${pathOf(ofSalon)}/${id}`), as)

  const list = (
    query: Record<string, unknown> = {},
    as: string | null = asAdmin,
    ofSalon: string = salonId,
  ): Test => authorized(request(app).get(pathOf(ofSalon)).query(query), as)

  const update = (
    id: string,
    body: object,
    as: string | null = asAdmin,
    ofSalon: string = salonId,
  ): Test =>
    authorized(request(app).patch(`${pathOf(ofSalon)}/${id}`), as).send(body)

  const remove = (
    id: string,
    as: string | null = asAdmin,
    ofSalon: string = salonId,
  ): Test => authorized(request(app).delete(`${pathOf(ofSalon)}/${id}`), as)

  /** A payment method of a salon as a row: cash, without anything that may be unset. Returns its ID. */
  const insertMethod = async (
    overrides: Partial<NewPaymentMethod> = {},
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [method] = await db
      .insert(paymentMethods)
      .values({
        salonId: ofSalon,
        method: 'cash',
        displayName: '現金',
        ...overrides,
      })
      .returning({ id: paymentMethods.id })
    if (method === undefined) {
      throw new Error('No payment method was inserted')
    }
    return method.id
  }

  /** The row of a payment method, or undefined when it is gone. */
  const stored = async (id: string) => {
    const [row] = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.id, id))
    return row
  }

  /** Every payment method that is stored, in the order of the IDs. */
  const everything = () =>
    db.select().from(paymentMethods).orderBy(asc(paymentMethods.id))

  /** A sale of the salon as a row, for a payment to be of; returns its ID. */
  const insertSale = async (): Promise<string> => {
    const [sale] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-TEST-${nextRow()}`,
        salonId,
        saleDate: '2026-11-20',
        saleTime: '2026-11-20T03:40:00Z',
        subtotal: 6000,
        taxAmount: 600,
        totalAmount: 6600,
      })
      .returning({ id: sales.id })
    if (sale === undefined) {
      throw new Error('No sale was inserted')
    }
    return sale.id
  }

  /** A payment made with a payment method, written directly; returns its ID. */
  const insertPayment = async (
    paymentMethodId: string,
    overrides: Partial<NewPayment> = {},
    executor: Executor = db,
  ): Promise<string> => {
    const [payment] = await executor
      .insert(paymentTransactions)
      .values({
        saleId: await insertSale(),
        paymentMethodId,
        transactionNumber: `TX-${nextRow()}`,
        amount: 6600,
        status: 'completed',
        ...overrides,
      })
      .returning({ id: paymentTransactions.id })
    if (payment === undefined) {
      throw new Error('No payment was inserted')
    }
    return payment.id
  }

  /** The moment of the clock that a change of a payment method writes by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  /** Checks that a time of a response is of the milliseconds between two moments. */
  const expectBetween = (
    time: unknown,
    before: number,
    after: number,
  ): void => {
    expect(time).toEqual(expect.stringMatching(ISO_TIMESTAMP))
    const moment = Date.parse(String(time))
    expect(moment).toBeGreaterThanOrEqual(Math.floor(before))
    expect(moment).toBeLessThanOrEqual(Math.ceil(after))
  }

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

  /** Everyone who reads the payment methods of the salon of the tests. */
  const readers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Those of them who set the payment methods up. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
  ]

  /** Accounts the payment methods of the salon of the tests are closed to. */
  const strangers: [string, SignInAs][] = [
    ['the owner of another salon', member('owner', salon)],
    ['a manager of another salon', member('manager', salon)],
    ['a staff member of another salon', member('staff', salon)],
    [
      'a customer with a profile',
      async () =>
        (
          await signedInUser(app, db, {
            customerId: await insertCustomer(db),
          })
        ).authorization,
    ],
    [
      'a customer account without a profile',
      async () => (await signedInUser(app, db)).authorization,
    ],
    [
      'an account of the salon whose staff record is deleted',
      member('owner', async () => salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      }),
    ],
  ]

  /** Who does not set them up: a staff member of the salon reads them and no more. */
  const notKeepers: [string, SignInAs][] = [
    ['a staff member of the salon', member('staff')],
    ...strangers,
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
  const operations: [string, (as: string | null, id: string) => Test][] = [
    ['the list', (as) => list({}, as)],
    ['a create', (as) => create(paymentMethod(), as)],
    ['a get', (as, id) => read(id, as)],
    ['an update', (as, id) => update(id, { isActive: false }, as)],
    ['a delete', (as, id) => remove(id, as)],
  ]

  /** The operations that set payment methods up. */
  const writes = operations.filter(([name]) =>
    ['a create', 'an update', 'a delete'].includes(name),
  )

  const deleted = { deletedAt: '2026-11-01T00:00:00.000Z' }

  /** IDs in a path that are not UUIDs. */
  const malformedIds = ['latest', '42', `${UNKNOWN_ID}0`]

  describe('POST /api/v1/salons/:salonId/payment-methods', () => {
    it('adds the payment method to the salon and answers 201 with it, where it is, and what the system set', async () => {
      const before = await databaseClock()

      const response = await create()
      const after = await databaseClock()

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      const { data } = response.body
      expect(Object.keys(response.body).toSorted()).toEqual([
        'data',
        'links',
        'meta',
      ])
      expect(Object.keys(data).toSorted()).toEqual(PROPERTIES)
      expect(data).toEqual({
        ...paymentMethod(),
        id: expect.stringMatching(UUID),
        salonId,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: data.createdAt,
      })
      expectBetween(data.createdAt, before, after)
      expect(response.headers['location']).toBe(`${pathOf()}/${data.id}`)
      expect(response.body.links).toEqual({
        self: `${pathOf()}/${data.id}`,
        list: pathOf(),
      })
      expect(response.body.meta.timestamp).toEqual(
        expect.stringMatching(ISO_TIMESTAMP),
      )
    })

    it('stores what the request states, the fee to two decimals, and nothing for the settings of a processor', async () => {
      const response = await create()

      expect(await everything()).toEqual([
        {
          id: response.body.data.id,
          salonId,
          method: 'credit_card',
          displayName: 'クレジットカード',
          description: 'Visa, Mastercard, JCB',
          processorName: 'Stripe',
          processorConfig: null,
          fee: '3.60',
          minimumAmount: 1000,
          maximumAmount: 500000,
          isOnlineEnabled: true,
          isOfflineEnabled: true,
          sortOrder: 2,
          isActive: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ])
    })

    it('keeps null for everything that may be unset: a fee that is not noted is not a fee of 0', async () => {
      const unset = {
        description: null,
        processorName: null,
        fee: null,
        minimumAmount: null,
        maximumAmount: null,
      }

      const response = await create(paymentMethod(unset))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(unset)
      expect(await stored(response.body.data.id)).toMatchObject(unset)
    })

    it.each([
      'cash',
      'credit_card',
      'debit_card',
      'e_money',
      'qr_payment',
      'bank_transfer',
      'point',
    ])('takes the method %s', async (method) => {
      const response = await create(paymentMethod({ method }))

      expect(response.status).toBe(201)
      expect(response.body.data.method).toBe(method)
    })

    it.each([
      ['a fee of 0', { fee: 0 }],
      ['a fee of 100 per cent', { fee: 100 }],
      ['a fee of a hundredth of a per cent', { fee: 0.01 }],
      ['equal limits', { minimumAmount: 5000, maximumAmount: 5000 }],
      ['the widest limits', { minimumAmount: 1, maximumAmount: MAX_INTEGER }],
      ['the largest sort order', { sortOrder: MAX_INTEGER }],
      ['a sort order of 0', { sortOrder: 0 }],
      ['a name of 100 characters', { displayName: '𠮷'.repeat(100) }],
      [
        'a payment method that is taken nowhere and is not active',
        { isOnlineEnabled: false, isOfflineEnabled: false, isActive: false },
      ],
    ])('takes %s and returns it as it was stated', async (_case, stated) => {
      const response = await create(paymentMethod(stated))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(stated)
      expect((await read(response.body.data.id)).body.data).toEqual(
        response.body.data,
      )
    })

    it('takes a second payment method of the same method, name and sort order: nothing of a payment method is unique', async () => {
      const first = await create()
      const second = await create()

      expect([first.status, second.status]).toEqual([201, 201])
      expect(second.body.data.id).not.toBe(first.body.data.id)
      expect(await everything()).toHaveLength(2)
    })

    it('adds to the salon of the path and to no other', async () => {
      const otherSalon = await salon()
      await insertMethod()

      const response = await create(paymentMethod(), asAdmin, otherSalon)

      expect(response.status).toBe(201)
      expect(response.body.data.salonId).toBe(otherSalon)
      expect(response.headers['location']).toBe(
        `${pathOf(otherSalon)}/${response.body.data.id}`,
      )
      expect((await list()).body.meta.total).toBe(1)
      expect((await list({}, asAdmin, otherSalon)).body.meta.total).toBe(1)
    })

    it('says where the payment method is by the path the request came on, without its query', async () => {
      const path = pathOf().replace('salons', 'SALONS')

      const response = await request(app)
        .post(`${path}?verbose=1`)
        .set('Authorization', asAdmin)
        .send(paymentMethod())

      expect(response.status).toBe(201)
      expect(response.headers['location']).toBe(
        `${path}/${response.body.data.id}`,
      )
      expect(response.body.links).toEqual({
        self: `${path}/${response.body.data.id}`,
        list: path,
      })
    })

    describe('what a request must be', () => {
      it.each([
        ['a blank name', { displayName: ' ' }, ['displayName:invalid_format']],
        [
          'a name of 101 characters',
          { displayName: 'あ'.repeat(101) },
          ['displayName:too_big'],
        ],
        [
          'an empty description',
          { description: '' },
          ['description:invalid_format'],
        ],
        [
          'a processor name of 101 characters',
          { processorName: 'a'.repeat(101) },
          ['processorName:too_big'],
        ],
        [
          'a method that is none',
          { method: 'paypal' },
          ['method:invalid_value'],
        ],
        ['a fee above 100 per cent', { fee: 100.01 }, ['fee:too_big']],
        ['a negative fee', { fee: -0.01 }, ['fee:too_small']],
        ['a fee with three decimals', { fee: 3.255 }, ['fee:not_multiple_of']],
        ['a fee that is text', { fee: '3.6' }, ['fee:invalid_type']],
        [
          'limits of 0',
          { minimumAmount: 0, maximumAmount: 0 },
          ['minimumAmount:too_small', 'maximumAmount:too_small'],
        ],
        [
          'an upper limit above what the column holds',
          { maximumAmount: MAX_INTEGER + 1 },
          ['maximumAmount:too_big'],
        ],
        ['a negative sort order', { sortOrder: -1 }, ['sortOrder:too_small']],
        [
          'text for the flags',
          { isOnlineEnabled: 'true', isOfflineEnabled: 1, isActive: 'yes' },
          [
            'isOnlineEnabled:invalid_type',
            'isOfflineEnabled:invalid_type',
            'isActive:invalid_type',
          ],
        ],
        [
          'the settings of a processor',
          { processorConfig: { apiKey: 'secret' } },
          ['processorConfig:unrecognized_keys'],
        ],
        [
          'a salon, an ID and times',
          {
            salonId: UNKNOWN_ID,
            id: UNKNOWN_ID,
            createdAt: '2026-11-14T09:00:00.000Z',
          },
          [
            'salonId:unrecognized_keys',
            'id:unrecognized_keys',
            'createdAt:unrecognized_keys',
          ],
        ],
      ])('refuses %s and stores nothing', async (_case, change, expected) => {
        const response = await create(paymentMethod(change))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID)
        expect(brokenRules(response)).toEqual(expected)
        expect(await everything()).toEqual([])
      })

      it.each(Object.keys(paymentMethod()))(
        'refuses a request without %s: every key has to be there',
        async (property) => {
          const body = Object.fromEntries(
            Object.entries(paymentMethod()).filter(
              ([name]) => name !== property,
            ),
          )

          const response = await create(body)

          expectProblem(response, badRequest)
          expect(
            brokenRules(response).map((rule) => rule.replace(/:.*$/, '')),
          ).toEqual([property])
          expect(await everything()).toEqual([])
        },
      )

      it('refuses a lower limit above the upper one, and says so of the upper limit', async () => {
        const response = await create(
          paymentMethod({ minimumAmount: 5001, maximumAmount: 5000 }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('maximumAmount', 'custom', BELOW_THE_LOWER_LIMIT),
        ])
        expect(await everything()).toEqual([])
      })

      it('reports everything that is wrong at once, the order of the limits with the rest', async () => {
        const response = await create(
          paymentMethod({
            displayName: '',
            fee: 101,
            minimumAmount: 9,
            maximumAmount: 8,
            sortOrder: -1,
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'displayName:invalid_format',
          'fee:too_big',
          'sortOrder:too_small',
          'maximumAmount:custom',
        ])
      })

      it('says of a request that does not have the form of one what is wrong with the form, before it compares the limits', async () => {
        const response = await create(
          paymentMethod({
            method: 'paypal',
            displayName: '',
            minimumAmount: 9,
            maximumAmount: 8,
            processorConfig: {},
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'method:invalid_value',
          'displayName:invalid_format',
          'processorConfig:unrecognized_keys',
        ])
      })

      it.each([
        ['a list of requests', [paymentMethod()]],
        ['an empty list', []],
      ])('refuses %s in place of the request', async (_case, body) => {
        const response = await create(body)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([':invalid_type'])
      })

      it.each([
        ['a body that is not JSON', '{"method":'],
        ['a body that is null', 'null'],
        ['a body that is text', '"cash"'],
      ])('refuses %s as a body that cannot be read', async (_case, body) => {
        const response = await request(app)
          .post(pathOf())
          .set('Authorization', asAdmin)
          .set('Content-Type', 'application/json')
          .send(body)

        expectProblem(response, unreadable)
        expect(await everything()).toEqual([])
      })

      it('refuses a body that is not sent as JSON', async () => {
        const response = await request(app)
          .post(pathOf())
          .set('Authorization', asAdmin)
          .set('Content-Type', 'text/plain')
          .send('method=cash')

        expect(response.status).toBe(415)
        expect(await everything()).toEqual([])
      })
    })

    describe('what is not there', () => {
      it.each([
        ['does not exist', async () => UNKNOWN_ID],
        ['is deleted', () => salon(deleted)],
      ])(
        'answers 404 for a salon that %s, and adds nothing',
        async (_case, salonOf) => {
          const ofSalon = await salonOf()

          const response = await create(paymentMethod(), asAdmin, ofSalon)

          expectProblem(response, notFound)
          expect(response.body.detail).toContain('Salon')
          expect(await everything()).toEqual([])
        },
      )

      it.each(malformedIds)(
        'refuses %s as the salon, to whoever asks',
        async (salonOfPath) => {
          const responses = [
            await create(paymentMethod(), asAdmin, salonOfPath),
            await create({}, await member('staff')(), salonOfPath),
          ]

          for (const response of responses) {
            expectProblem(response, badRequest)
            expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
          }
        },
      )
    })

    it('looks at the request before it looks for the salon', async () => {
      const response = await create(
        paymentMethod({ displayName: '' }),
        asAdmin,
        UNKNOWN_ID,
      )

      expectProblem(response, badRequest)
    })
  })

  describe('GET /api/v1/salons/:salonId/payment-methods', () => {
    it('lists the payment methods of the salon as the contract has them, with how many there are and where the list is', async () => {
      const id = await insertMethod({
        method: 'qr_payment',
        displayName: 'QR 決済',
        description: 'PayPay',
        processorName: 'PayPay',
        processorConfig: { apiKey: 'kept out of every response' },
        fee: '2.95',
        minimumAmount: 100,
        maximumAmount: 30000,
        isOnlineEnabled: true,
        isOfflineEnabled: false,
        sortOrder: 5,
        isActive: false,
      })

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [
          {
            id,
            salonId,
            method: 'qr_payment',
            displayName: 'QR 決済',
            description: 'PayPay',
            processorName: 'PayPay',
            fee: 2.95,
            minimumAmount: 100,
            maximumAmount: 30000,
            isOnlineEnabled: true,
            isOfflineEnabled: false,
            sortOrder: 5,
            isActive: false,
            createdAt: expect.stringMatching(ISO_TIMESTAMP),
            updatedAt: expect.stringMatching(ISO_TIMESTAMP),
          },
        ],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: pathOf(),
          first: pathOf(),
          next: null,
          prev: null,
          last: null,
        },
      })
    })

    it('returns a row that was written with nothing but what must be: the defaults of the columns, and null for the rest', async () => {
      await insertMethod()

      const response = await list()

      expect(response.body.data).toEqual([
        expect.objectContaining({
          method: 'cash',
          displayName: '現金',
          description: null,
          processorName: null,
          fee: null,
          minimumAmount: null,
          maximumAmount: null,
          isOnlineEnabled: false,
          isOfflineEnabled: true,
          sortOrder: 0,
          isActive: true,
        }),
      ])
    })

    it('answers with an empty list for a salon without payment methods', async () => {
      await insertMethod({}, await salon())

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    it('lists by sortOrder, and those of one sortOrder by ID, whatever the order they were written in', async () => {
      const third = await insertMethod({ sortOrder: 2 })
      const lastOfOne = await insertMethod({ sortOrder: 1 })
      const secondOfOne = await insertMethod({ id: SECOND_ID, sortOrder: 1 })
      const firstOfOne = await insertMethod({ id: FIRST_ID, sortOrder: 1 })
      const first = await insertMethod({ sortOrder: 0 })

      const response = await list()

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        first,
        firstOfOne,
        secondOfOne,
        lastOfOne,
        third,
      ])
    })

    it('lists the payment methods of the salon of the path only', async () => {
      const otherSalon = await salon()
      const mine = await insertMethod()
      const theirs = await insertMethod({}, otherSalon)

      const here = await list()
      const there = await list({}, asAdmin, otherSalon)

      expect(here.body.data.map(({ id }: { id: string }) => id)).toEqual([mine])
      expect(here.body.meta.total).toBe(1)
      expect(there.body.data.map(({ id }: { id: string }) => id)).toEqual([
        theirs,
      ])
    })

    describe('filters', () => {
      let cash: string
      let card: string
      let oldCard: string
      let oldCash: string

      beforeEach(async () => {
        cash = await insertMethod({ sortOrder: 1 })
        card = await insertMethod({ method: 'credit_card', sortOrder: 2 })
        oldCard = await insertMethod({
          method: 'credit_card',
          sortOrder: 3,
          isActive: false,
        })
        oldCash = await insertMethod({ sortOrder: 4, isActive: false })
        await insertMethod({ method: 'credit_card' }, await salon())
      })

      const idsOf = (response: Response): string[] =>
        response.body.data.map(({ id }: { id: string }) => id)

      it('returns all of them, active or not, without a filter', async () => {
        const response = await list()

        expect(idsOf(response)).toEqual([cash, card, oldCard, oldCash])
        expect(response.body.meta.total).toBe(4)
      })

      it('returns those of a method', async () => {
        const response = await list({ method: 'credit_card' })

        expect(idsOf(response)).toEqual([card, oldCard])
        expect(response.body.meta.total).toBe(2)
      })

      it('returns the active ones', async () => {
        const response = await list({ isActive: true })

        expect(idsOf(response)).toEqual([cash, card])
        expect(response.body.meta.total).toBe(2)
      })

      it('returns those that are not active', async () => {
        const response = await list({ isActive: false })

        expect(idsOf(response)).toEqual([oldCard, oldCash])
        expect(response.body.meta.total).toBe(2)
      })

      it('joins the filters: the active ones of a method', async () => {
        const response = await list({ method: 'cash', isActive: true })

        expect(idsOf(response)).toEqual([cash])
        expect(response.body.meta.total).toBe(1)
      })

      it('returns nothing for a method the salon does not take', async () => {
        const response = await list({ method: 'point' })

        expect(idsOf(response)).toEqual([])
        expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
      })

      it('counts what the filters match, not what the page holds, and keeps the filters in the link to the next page', async () => {
        const response = await list({ method: 'credit_card', limit: 1 })

        expect(idsOf(response)).toEqual([card])
        expect(response.body.meta).toMatchObject({
          total: 2,
          limit: 1,
          hasMore: true,
          nextCursor: card,
        })
        expect(response.body.links.next).toBe(
          `${pathOf()}?method=credit_card&limit=1&cursor=${card}`,
        )
      })

      it('pages within the filters', async () => {
        const response = await list({
          isActive: false,
          limit: 1,
          cursor: oldCard,
        })

        expect(idsOf(response)).toEqual([oldCash])
        expect(response.body.meta).toMatchObject({ total: 2, hasMore: false })
      })
    })

    describe('pages', () => {
      /** Seven payment methods: three share the sortOrder 1, and pages of two cut through them. */
      const seven = async (): Promise<string[]> => {
        const last = await insertMethod({ sortOrder: 3 })
        const sixth = await insertMethod({ sortOrder: 2 })
        const fourth = await insertMethod({ sortOrder: 1 })
        const third = await insertMethod({ id: SECOND_ID, sortOrder: 1 })
        const second = await insertMethod({ id: FIRST_ID, sortOrder: 1 })
        const first = await insertMethod({ sortOrder: 0 })
        const fifth = await insertMethod({ sortOrder: 2, id: UNKNOWN_ID })
        const ordered = [first, second, third, fourth, fifth, sixth, last]
        // The two of sortOrder 2 are in the order of their IDs.
        return fifth < sixth
          ? ordered
          : [first, second, third, fourth, sixth, fifth, last]
      }

      it('returns 20 payment methods unless the request says how many, and says that more follow', async () => {
        for (let count = 0; count < 21; count += 1) {
          await insertMethod({ sortOrder: count })
        }

        const response = await list()

        expect(response.body.data).toHaveLength(20)
        expect(response.body.meta).toMatchObject({
          total: 21,
          limit: 20,
          hasMore: true,
          nextCursor: response.body.data[19].id,
        })
      })

      it('says that nothing follows a page that is exactly full', async () => {
        await insertMethod({ sortOrder: 1 })
        await insertMethod({ sortOrder: 2 })

        const response = await list({ limit: 2 })

        expect(response.body.data).toHaveLength(2)
        expect(response.body.meta).toMatchObject({
          total: 2,
          hasMore: false,
          nextCursor: null,
        })
        expect(response.body.links.next).toBeNull()
      })

      it('walks every payment method once, in order, along the links to the next page', async () => {
        const ordered = await seven()
        const walked: string[] = []
        const sizes: number[] = []

        let next: string | null = `${pathOf()}?limit=2`
        while (next !== null) {
          const response: Response = await request(app)
            .get(next)
            .set('Authorization', asAdmin)
          expect(response.status).toBe(200)
          expect(response.body.meta.total).toBe(7)
          walked.push(...response.body.data.map(({ id }: { id: string }) => id))
          sizes.push(response.body.data.length)
          next = response.body.links.next
        }

        expect(walked).toEqual(ordered)
        expect(sizes).toEqual([2, 2, 2, 1])
      })

      it('starts a page after the payment method the cursor names, and names the cursor it was given', async () => {
        const ordered = await seven()

        const response = await list({ limit: 3, cursor: ordered[1] })

        expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual(
          ordered.slice(2, 5),
        )
        expect(response.body.meta).toMatchObject({
          cursor: ordered[1],
          nextCursor: ordered[4],
          hasMore: true,
          prevCursor: null,
        })
      })

      it('takes a limit of 100 and of 1', async () => {
        await insertMethod()

        expect((await list({ limit: 100 })).body.meta.limit).toBe(100)
        expect((await list({ limit: 1 })).body.meta.limit).toBe(1)
      })

      it.each([
        ['names nothing', async () => UNKNOWN_ID],
        [
          'names a payment method of another salon',
          async () => insertMethod({}, await salon()),
        ],
        [
          'names a payment method that was deleted',
          async () => {
            const id = await insertMethod()
            await db.delete(paymentMethods).where(eq(paymentMethods.id, id))
            return id
          },
        ],
      ])('refuses a cursor that %s', async (_case, cursorOf) => {
        await insertMethod()

        const response = await list({ cursor: await cursorOf() })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(response.body.errors).toEqual([
          issue('cursor', 'not_found', NO_SUCH_CURSOR),
        ])
      })
    })

    it.each([
      ['a limit of 0', { limit: 0 }, ['limit:too_small']],
      ['a limit of 101', { limit: 101 }, ['limit:too_big']],
      [
        'a limit that is no number',
        { limit: 'many' },
        ['limit:invalid_format'],
      ],
      [
        'a cursor that is no ID',
        { cursor: 'first' },
        ['cursor:invalid_format'],
      ],
      ['a method that is none', { method: 'paypal' }, ['method:invalid_value']],
      [
        'isActive that is neither true nor false',
        { isActive: 'yes' },
        ['isActive:invalid_value'],
      ],
      [
        'a filter the list does not have',
        { processorName: 'Stripe' },
        ['processorName:unrecognized_keys'],
      ],
      [
        'several of them',
        { limit: 0, method: 'paypal', salonId: UNKNOWN_ID },
        [
          'limit:too_small',
          'method:invalid_value',
          'salonId:unrecognized_keys',
        ],
      ],
    ])('refuses %s', async (_case, query, expected) => {
      const response = await list(query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(expected)
    })

    it.each([
      ['does not exist', async () => UNKNOWN_ID],
      ['is deleted', () => salon(deleted)],
    ])('answers 404 for a salon that %s', async (_case, salonOf) => {
      const ofSalon = await salonOf()
      await insertMethod({}, salonId)

      const response = await list({}, asAdmin, ofSalon)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Salon')
    })

    it('looks at the query before it looks for the salon', async () => {
      const response = await list({ limit: 0 }, asAdmin, UNKNOWN_ID)

      expectProblem(response, badRequest)
    })

    it('looks for the salon before it looks for what the cursor names', async () => {
      const response = await list({ cursor: UNKNOWN_ID }, asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
    })
  })

  describe('GET /api/v1/salons/:salonId/payment-methods/:id', () => {
    it('returns the payment method, where it is and where the list is, without the settings of a processor', async () => {
      const id = await insertMethod({
        method: 'e_money',
        displayName: '交通系 IC',
        processorConfig: { terminalId: 'kept out of every response' },
        fee: '3.25',
        maximumAmount: 20000,
        sortOrder: 4,
      })

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expect(response.body.data).toEqual({
        id,
        salonId,
        method: 'e_money',
        displayName: '交通系 IC',
        description: null,
        processorName: null,
        fee: 3.25,
        minimumAmount: null,
        maximumAmount: 20000,
        isOnlineEnabled: false,
        isOfflineEnabled: true,
        sortOrder: 4,
        isActive: true,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(response.body.links).toEqual({
        self: `${pathOf()}/${id}`,
        list: pathOf(),
      })
    })

    it('returns the one that was asked for, not another one of the salon', async () => {
      await insertMethod({ id: FIRST_ID })
      const id = await insertMethod({ displayName: 'これ' })
      await insertMethod()

      const response = await read(id)

      expect(response.body.data).toMatchObject({ id, displayName: 'これ' })
    })

    it('returns a payment method that is not active', async () => {
      const id = await insertMethod({ isActive: false })

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data.isActive).toBe(false)
    })

    it('takes an ID in upper case, and says where the payment method is by the path the request came on', async () => {
      const id = await insertMethod()
      const path = `${pathOf().replace('payment-methods', 'Payment-Methods')}`

      const response = await request(app)
        .get(`${path}/${id.toUpperCase()}?verbose=1`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
      expect(response.body.links).toEqual({ self: `${path}/${id}`, list: path })
    })

    it.each([
      ['does not exist', async () => UNKNOWN_ID],
      ['is of another salon', async () => insertMethod({}, await salon())],
    ])('answers 404 for a payment method that %s', async (_case, idOf) => {
      await insertMethod()
      const id = await idOf()

      const response = await read(id)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Payment method')
      expect(response.body.detail).toContain(id)
    })

    it('answers 404, of the salon, for a payment method of a salon that is deleted', async () => {
      const gone = await salon(deleted)
      const id = await insertMethod({}, gone)

      const response = await read(id, asAdmin, gone)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Salon')
    })

    it.each(malformedIds)('refuses %s as the ID', async (id) => {
      const response = await read(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('looks at the ID before it looks for the salon', async () => {
      const response = await read('latest', asAdmin, UNKNOWN_ID)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })
  })

  describe('PATCH /api/v1/salons/:salonId/payment-methods/:id', () => {
    it('writes the one property a request names and the time of the change, and leaves the rest and every other payment method', async () => {
      const id = await insertMethod({
        method: 'credit_card',
        description: 'Visa',
        processorName: 'Stripe',
        processorConfig: { terminalId: 't-1' },
        fee: '3.60',
        minimumAmount: 1000,
        maximumAmount: 50000,
        isOnlineEnabled: true,
        sortOrder: 2,
      })
      const other = await insertMethod()
      const elsewhere = await insertMethod({}, await salon())
      const before = await everything()
      const until = await databaseClock()

      const response = await update(id, { displayName: 'カード' })
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expect(response.body.data).toMatchObject({
        id,
        salonId,
        method: 'credit_card',
        displayName: 'カード',
        description: 'Visa',
        processorName: 'Stripe',
        fee: 3.6,
        minimumAmount: 1000,
        maximumAmount: 50000,
        isOnlineEnabled: true,
        isOfflineEnabled: true,
        sortOrder: 2,
        isActive: true,
      })
      expectBetween(response.body.data.updatedAt, until, after)
      expect(response.body.links).toEqual({
        self: `${pathOf()}/${id}`,
        list: pathOf(),
      })
      const rowOf = (rowId: string) => before.find((row) => row.id === rowId)
      expect(await stored(id)).toEqual({
        ...rowOf(id),
        displayName: 'カード',
        updatedAt: expect.any(String),
      })
      expect(await stored(other)).toEqual(rowOf(other))
      expect(await stored(elsewhere)).toEqual(rowOf(elsewhere))
      expect((await read(id)).body.data).toEqual(response.body.data)
    })

    it('writes everything a request can name at once', async () => {
      const id = await insertMethod({ method: 'qr_payment' })
      const everythingNamed = {
        displayName: 'QR 決済',
        description: 'PayPay と楽天ペイ',
        processorName: 'PayPay',
        fee: 2.95,
        minimumAmount: 100,
        maximumAmount: 30000,
        isOnlineEnabled: true,
        isOfflineEnabled: false,
        sortOrder: 7,
        isActive: false,
      }

      const response = await update(id, everythingNamed)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        ...everythingNamed,
        method: 'qr_payment',
      })
      expect(await stored(id)).toMatchObject({
        ...everythingNamed,
        fee: '2.95',
        method: 'qr_payment',
      })
    })

    it.each([
      ['displayName', 'カード'],
      ['description', '説明'],
      ['processorName', 'Square'],
      ['fee', 1.5],
      ['minimumAmount', 500],
      ['maximumAmount', 90000],
      ['isOnlineEnabled', true],
      ['isOfflineEnabled', false],
      ['sortOrder', 9],
      ['isActive', false],
    ])('writes %s alone', async (property, value) => {
      const id = await insertMethod()
      const before = (await read(id)).body.data

      const response = await update(id, { [property]: value })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...before,
        [property]: value,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
    })

    it('takes away what a request names as null', async () => {
      const id = await insertMethod({
        description: 'Visa',
        processorName: 'Stripe',
        fee: '3.60',
        minimumAmount: 1000,
        maximumAmount: 50000,
      })
      const unset = {
        description: null,
        processorName: null,
        fee: null,
        minimumAmount: null,
        maximumAmount: null,
      }

      const response = await update(id, unset)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject(unset)
      expect(await stored(id)).toMatchObject(unset)
    })

    it('writes the time of the change for a request that changes no value, and leaves the time the payment method was added', async () => {
      const id = await insertMethod({ displayName: '現金' })
      const before = (await read(id)).body.data
      await pause(5)

      const response = await update(id, { displayName: '現金' })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...before,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThan(
        Date.parse(before.updatedAt),
      )
    })

    it('changes a payment method that is not active, and one that payments were made with', async () => {
      const id = await insertMethod({ isActive: false })
      await insertPayment(id)

      const response = await update(id, { isActive: true, sortOrder: 1 })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ isActive: true, sortOrder: 1 })
    })

    describe('the limits of the amount', () => {
      it.each([
        [
          'a lower limit above the upper limit that is stored',
          { minimumAmount: 3001 },
          'minimumAmount',
          ABOVE_THE_UPPER_LIMIT,
        ],
        [
          'an upper limit below the lower limit that is stored',
          { maximumAmount: 999 },
          'maximumAmount',
          BELOW_THE_LOWER_LIMIT,
        ],
        [
          'an upper limit below the lower limit that is stored, with something else',
          { displayName: 'カード', maximumAmount: 999 },
          'maximumAmount',
          BELOW_THE_LOWER_LIMIT,
        ],
        [
          'both limits out of order',
          { minimumAmount: 2001, maximumAmount: 2000 },
          'maximumAmount',
          BELOW_THE_LOWER_LIMIT,
        ],
      ])(
        'refuses %s, and writes nothing',
        async (_case, body, field, message) => {
          const id = await insertMethod({
            minimumAmount: 1000,
            maximumAmount: 3000,
          })
          const before = await stored(id)

          const response = await update(id, body)

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_UPDATE)
          expect(response.body.errors).toEqual([
            issue(field, 'custom', message),
          ])
          expect(await stored(id)).toEqual(before)
        },
      )

      it.each([
        ['a lower limit equal to the upper one', { minimumAmount: 3000 }],
        ['an upper limit equal to the lower one', { maximumAmount: 1000 }],
        [
          'a lower limit above the old upper one, with a new upper one',
          { minimumAmount: 4000, maximumAmount: 5000 },
        ],
        [
          'an upper limit below the old lower one, with a new lower one',
          { minimumAmount: 100, maximumAmount: 500 },
        ],
        [
          'a lower limit above the old upper one, with the upper one taken away',
          { minimumAmount: 4000, maximumAmount: null },
        ],
        [
          'an upper limit below the old lower one, with the lower one taken away',
          { minimumAmount: null, maximumAmount: 500 },
        ],
        ['the lower limit taken away', { minimumAmount: null }],
        ['the upper limit taken away', { maximumAmount: null }],
      ])('takes %s', async (_case, body) => {
        const id = await insertMethod({
          minimumAmount: 1000,
          maximumAmount: 3000,
        })

        const response = await update(id, body)

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject(body)
        expect(await stored(id)).toMatchObject(body)
      })

      it.each([
        ['any lower limit', { minimumAmount: MAX_INTEGER }],
        ['any upper limit', { maximumAmount: 1 }],
      ])(
        'takes %s for a payment method without the other limit',
        async (_case, body) => {
          const id = await insertMethod()

          const response = await update(id, body)

          expect(response.status).toBe(200)
          expect(response.body.data).toMatchObject(body)
        },
      )

      it('holds a change that names neither limit to nothing: the limits stay', async () => {
        const id = await insertMethod({
          minimumAmount: 1000,
          maximumAmount: 3000,
        })

        const response = await update(id, { sortOrder: 5 })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          minimumAmount: 1000,
          maximumAmount: 3000,
          sortOrder: 5,
        })
      })
    })

    describe('what a request must be', () => {
      it.each([
        ['a request that names nothing', {}, [':custom']],
        [
          'the method, be it the one the payment method has',
          { method: 'cash' },
          ['method:unrecognized_keys'],
        ],
        [
          'a salon and the settings of a processor',
          { salonId: UNKNOWN_ID, processorConfig: {} },
          ['salonId:unrecognized_keys', 'processorConfig:unrecognized_keys'],
        ],
        ['a blank name', { displayName: ' ' }, ['displayName:invalid_format']],
        [
          'null as the name',
          { displayName: null },
          ['displayName:invalid_type'],
        ],
        [
          'null for the flags and the sort order',
          {
            isOnlineEnabled: null,
            isOfflineEnabled: null,
            sortOrder: null,
            isActive: null,
          },
          [
            'isOnlineEnabled:invalid_type',
            'isOfflineEnabled:invalid_type',
            'sortOrder:invalid_type',
            'isActive:invalid_type',
          ],
        ],
        ['a fee above 100 per cent', { fee: 100.01 }, ['fee:too_big']],
        ['a fee with three decimals', { fee: 0.001 }, ['fee:not_multiple_of']],
        [
          'a lower limit of 0',
          { minimumAmount: 0 },
          ['minimumAmount:too_small'],
        ],
        [
          'an upper limit above what the column holds',
          { maximumAmount: MAX_INTEGER + 1 },
          ['maximumAmount:too_big'],
        ],
        ['a negative sort order', { sortOrder: -1 }, ['sortOrder:too_small']],
        [
          'several of them',
          { displayName: '', fee: -1, isActive: 'no' },
          [
            'displayName:invalid_format',
            'fee:too_small',
            'isActive:invalid_type',
          ],
        ],
      ])('refuses %s and writes nothing', async (_case, body, expected) => {
        const id = await insertMethod()
        const before = await stored(id)

        const response = await update(id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(brokenRules(response)).toEqual(expected)
        expect(await stored(id)).toEqual(before)
      })

      it('says of a request that names nothing what is missing', async () => {
        const response = await update(await insertMethod(), {})

        expect(response.body.errors).toEqual([
          issue('', 'custom', 'At least one property must be specified'),
        ])
      })

      it('refuses a list in place of the request', async () => {
        const response = await update(await insertMethod(), [
          { isActive: false },
        ])

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([':invalid_type'])
      })

      it.each([
        ['a body that is not JSON', '{"fee":'],
        ['a body that is null', 'null'],
      ])('refuses %s as a body that cannot be read', async (_case, body) => {
        const id = await insertMethod()

        const response = await request(app)
          .patch(`${pathOf()}/${id}`)
          .set('Authorization', asAdmin)
          .set('Content-Type', 'application/json')
          .send(body)

        expectProblem(response, unreadable)
      })
    })

    describe('what is not there', () => {
      it.each([
        ['does not exist', async () => UNKNOWN_ID],
        ['is of another salon', async () => insertMethod({}, await salon())],
      ])(
        'answers 404 for a payment method that %s, and changes nothing',
        async (_case, idOf) => {
          await insertMethod()
          const id = await idOf()
          const before = await everything()

          const response = await update(id, { isActive: false })

          expectProblem(response, notFound)
          expect(response.body.detail).toContain('Payment method')
          expect(await everything()).toEqual(before)
        },
      )

      it('answers 404, of the salon, for a payment method of a salon that is deleted, and changes nothing', async () => {
        const gone = await salon(deleted)
        const id = await insertMethod({}, gone)

        const response = await update(id, { isActive: false }, asAdmin, gone)

        expectProblem(response, notFound)
        expect(response.body.detail).toContain('Salon')
        expect((await stored(id))?.isActive).toBe(true)
      })

      it.each(malformedIds)('refuses %s as the ID', async (id) => {
        const response = await update(id, { isActive: false })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_ID)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      })
    })

    describe('the order in which a request is looked at', () => {
      it('looks at the ID before the request', async () => {
        const response = await update('latest', {})

        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      })

      it('looks at the request before it looks for the salon', async () => {
        const response = await update(UNKNOWN_ID, {}, asAdmin, UNKNOWN_ID)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([':custom'])
      })

      it('looks for the salon before it looks for the payment method', async () => {
        const response = await update(
          UNKNOWN_ID,
          { isActive: false },
          asAdmin,
          UNKNOWN_ID,
        )

        expectProblem(response, notFound)
        expect(response.body.detail).toContain('Salon')
      })

      it('looks for the payment method before it compares the limits', async () => {
        const response = await update(UNKNOWN_ID, { minimumAmount: 1 })

        expectProblem(response, notFound)
      })
    })
  })

  describe('DELETE /api/v1/salons/:salonId/payment-methods/:id', () => {
    it('removes the payment method, answers 204 without a body, and leaves every other one', async () => {
      const id = await insertMethod()
      const other = await insertMethod({ id: FIRST_ID })
      const elsewhere = await insertMethod({}, await salon())

      const response = await remove(id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(await stored(id)).toBeUndefined()
      expect((await everything()).map((row) => row.id).toSorted()).toEqual(
        [other, elsewhere].toSorted(),
      )
    })

    it('leaves a payment method that is gone: it is not read, changed, listed or removed again', async () => {
      const id = await insertMethod()
      await remove(id)

      expectProblem(await read(id), notFound)
      expectProblem(await update(id, { isActive: false }), notFound)
      expectProblem(await remove(id), notFound)
      expect((await list()).body.data).toEqual([])
    })

    it('removes a payment method that is not active', async () => {
      const id = await insertMethod({ isActive: false })

      expect((await remove(id)).status).toBe(204)
      expect(await stored(id)).toBeUndefined()
    })

    it.each(PAYMENT_STATUSES)(
      'does not remove a payment method that a payment of the status %s was made with',
      async (status) => {
        const id = await insertMethod()
        await insertPayment(id, { status })
        const before = await stored(id)

        const response = await remove(id)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(IN_USE)
        expect(await stored(id)).toEqual(before)
      },
    )

    it('looks only at the payments of the payment method itself', async () => {
      const id = await insertMethod()
      await insertPayment(await insertMethod())

      expect((await remove(id)).status).toBe(204)
    })

    it('removes a payment method once the payments that were made with it are gone', async () => {
      const id = await insertMethod()
      const paymentId = await insertPayment(id)
      expectProblem(await remove(id), notAllowed)
      await db
        .delete(paymentTransactions)
        .where(eq(paymentTransactions.id, paymentId))

      expect((await remove(id)).status).toBe(204)
    })

    it('lets a payment method that payments were made with be set to not active instead', async () => {
      const id = await insertMethod()
      await insertPayment(id)

      const response = await update(id, { isActive: false })

      expect(response.status).toBe(200)
      expect((await list({ isActive: true })).body.data).toEqual([])
    })

    it.each([
      ['does not exist', async () => UNKNOWN_ID],
      ['is of another salon', async () => insertMethod({}, await salon())],
    ])(
      'answers 404 for a payment method that %s, and removes nothing',
      async (_case, idOf) => {
        await insertMethod()
        const id = await idOf()
        const before = await everything()

        const response = await remove(id)

        expectProblem(response, notFound)
        expect(response.body.detail).toContain('Payment method')
        expect(await everything()).toEqual(before)
      },
    )

    it('answers 404, of the salon, for a payment method of a salon that is deleted, and removes nothing', async () => {
      const gone = await salon(deleted)
      const id = await insertMethod({}, gone)

      const response = await remove(id, asAdmin, gone)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Salon')
      expect(await stored(id)).toBeDefined()
    })

    it.each(malformedIds)('refuses %s as the ID', async (id) => {
      const response = await remove(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('looks at the ID before it looks for the salon, and for the salon before the payment method', async () => {
      expectProblem(await remove('latest', asAdmin, UNKNOWN_ID), badRequest)
      const response = await remove(UNKNOWN_ID, asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Salon')
    })

    it('says that the payment method is not there before it says that payments refer to it', async () => {
      const otherSalon = await salon()
      const id = await insertMethod()
      await insertPayment(id)

      const response = await remove(id, asAdmin, otherSalon)

      expectProblem(response, notFound)
    })
  })

  describe('who reads and who sets up the payment methods of a salon', () => {
    it.each(readers)('lets %s list and read them', async (_who, signInAs) => {
      const id = await insertMethod()
      const as = await signInAs()

      const listed = await list({}, as)
      const one = await read(id, as)

      expect(listed.status).toBe(200)
      expect(listed.body.data).toHaveLength(1)
      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(listed.body.data[0])
    })

    it.each(keepers)(
      'lets %s add, change and remove one',
      async (_who, signInAs) => {
        const as = await signInAs()

        const added = await create(paymentMethod(), as)
        const changed = await update(
          added.body.data.id,
          { isActive: false },
          as,
        )
        const removed = await remove(added.body.data.id, as)

        expect([added.status, changed.status, removed.status]).toEqual([
          201, 200, 204,
        ])
        expect(await everything()).toEqual([])
      },
    )

    it.each(strangers)('refuses %s every operation', async (_who, signInAs) => {
      const id = await insertMethod()
      const before = await everything()
      const as = await signInAs()

      for (const [, call] of operations) {
        expectProblem(await call(as, id), forbidden)
      }
      expect(await everything()).toEqual(before)
    })

    it('lets a staff member of the salon read and refuses them every change, before anything of the request is looked at', async () => {
      const id = await insertMethod()
      const before = await everything()
      const as = await member('staff')()

      for (const [, call] of writes) {
        expectProblem(await call(as, id), forbidden)
      }
      expectProblem(await create({}, as), forbidden)
      expectProblem(await update('latest', {}, as), forbidden)
      expectProblem(await remove('latest', as), forbidden)
      expect(await everything()).toEqual(before)
    })

    it.each(notKeepers)(
      'refuses %s a change of a payment method that is not there as well: nothing tells them what is there',
      async (_who, signInAs) => {
        const as = await signInAs()

        expectProblem(
          await update(UNKNOWN_ID, { isActive: false }, as),
          forbidden,
        )
        expectProblem(await remove(UNKNOWN_ID, as), forbidden)
      },
    )

    it('refuses the members of a salon the payment methods of another salon, whether that salon exists or not', async () => {
      const otherSalon = await salon()
      const id = await insertMethod({}, otherSalon)

      for (const signInAs of [
        member('owner'),
        member('manager'),
        member('staff'),
      ]) {
        const as = await signInAs()

        for (const ofSalon of [otherSalon, UNKNOWN_ID]) {
          expectProblem(await list({}, as, ofSalon), forbidden)
          expectProblem(await list({ limit: 0 }, as, ofSalon), forbidden)
          expectProblem(await list({ limit: 'many' }, as, ofSalon), forbidden)
          expectProblem(await read(id, as, ofSalon), forbidden)
          expectProblem(await create(paymentMethod(), as, ofSalon), forbidden)
          expectProblem(
            await update(id, { isActive: false }, as, ofSalon),
            forbidden,
          )
          expectProblem(await remove(id, as, ofSalon), forbidden)
        }
      }
      expect((await stored(id))?.isActive).toBe(true)
    })

    it('does not show the owner of a salon a payment method of another salon under their own', async () => {
      const id = await insertMethod({}, await salon())
      const as = await member('owner')()

      expectProblem(await read(id, as), notFound)
      expectProblem(await update(id, { isActive: false }, as), notFound)
      expectProblem(await remove(id, as), notFound)
      expect((await stored(id))?.isActive).toBe(true)
    })

    it('tells an administrator that a salon does not exist, and the owner of another salon only that it is not theirs', async () => {
      const as = await member('owner')()

      expectProblem(await list({}, asAdmin, UNKNOWN_ID), notFound)
      expectProblem(await list({}, as, UNKNOWN_ID), forbidden)
    })

    describe.each(operations)('%s', (_name, call) => {
      it.each(unauthenticated)(
        'answers 401 to %s, before it looks at anything else',
        async (_case, tokenOf, problem, challenge) => {
          const id = await insertMethod()
          const before = await everything()

          const response = await call(await tokenOf(), id)

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
          expect(await everything()).toEqual(before)
        },
      )
    })

    it('answers 401 before it looks at the salon of the path', async () => {
      const response = await list({}, null, 'latest')

      expectProblem(response, authenticationRequired)
    })
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['PUT on a payment method', 'put', '/ID'],
      ['POST on a payment method', 'post', '/ID'],
      ['PATCH on the list', 'patch', ''],
      ['PUT on the list', 'put', ''],
      ['DELETE on the list', 'delete', ''],
      ['GET below a payment method', 'get', '/ID/payments'],
      ['POST below a payment method', 'post', '/ID/activate'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertMethod()
        const before = await everything()

        const response = await request(app)
          [method](`${pathOf()}${suffix.replace('ID', id)}`)
          .set('Authorization', asAdmin)
          .send(paymentMethod())

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )

    it('has no list of the payment methods of every salon', async () => {
      const response = await request(app)
        .get('/api/v1/payment-methods')
        .set('Authorization', asAdmin)

      expectProblem(response, routeNotFound)
    })
  })

  describe('requests at the same moment', () => {
    /** Holds a payment method as a change of it does. */
    const hold = (tx: Transaction, id: string) =>
      tx
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, id))
        .for('update')

    /** Whether a request is answered while what it may wait for is held. */
    const answersWithin = (
      call: Promise<Response>,
      milliseconds: number,
    ): Promise<boolean> =>
      Promise.race([
        call.then(() => true),
        pause(milliseconds).then(() => false),
      ])

    /** The answer of a request, or null when it has not come within two seconds. */
    const unlessItWaits = (call: Test): Promise<Response | null> =>
      Promise.race([
        call.then((response) => response),
        pause(2_000).then(() => null),
      ])

    it('holds an upper limit that waited for a change of the lower limit to that lower limit', async () => {
      const id = await insertMethod()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await tx
            .update(paymentMethods)
            .set({ minimumAmount: 5000 })
            .where(eq(paymentMethods.id, id))
          const underWay = update(id, { maximumAmount: 3000 }).then(
            (response) => response,
          )

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        issue('maximumAmount', 'custom', BELOW_THE_LOWER_LIMIT),
      ])
      expect(await stored(id)).toMatchObject({
        minimumAmount: 5000,
        maximumAmount: null,
      })
    })

    it('holds a lower limit that waited for a change of the upper limit to that upper limit', async () => {
      const id = await insertMethod()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(paymentMethods)
          .set({ maximumAmount: 3000 })
          .where(eq(paymentMethods.id, id))
        const underWay = update(id, { minimumAmount: 5000 }).then(
          (response) => response,
        )
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        issue('minimumAmount', 'custom', ABOVE_THE_UPPER_LIMIT),
      ])
      expect(await stored(id)).toMatchObject({
        minimumAmount: null,
        maximumAmount: 3000,
      })
    })

    it('takes a limit that waited for a change that was not written after all', async () => {
      const id = await insertMethod()
      let pending: Promise<Response> | undefined

      await db
        .transaction(async (tx) => {
          await tx
            .update(paymentMethods)
            .set({ minimumAmount: 5000 })
            .where(eq(paymentMethods.id, id))
          pending = update(id, { maximumAmount: 3000 }).then(
            (response) => response,
          )
          await pause(300)
          tx.rollback()
        })
        .catch(() => undefined)
      const response = await pending

      expect(response?.status).toBe(200)
      expect(await stored(id)).toMatchObject({
        minimumAmount: null,
        maximumAmount: 3000,
      })
    })

    it('never leaves the limits out of order, whichever of two changes comes first', async () => {
      const id = await insertMethod()

      for (let round = 0; round < 5; round += 1) {
        await update(id, { minimumAmount: null, maximumAmount: null })

        const responses = await Promise.all([
          update(id, { minimumAmount: 5000 }),
          update(id, { maximumAmount: 3000 }),
        ])

        expect(responses.map(statusAndCode).toSorted()).toEqual([
          '200',
          '400 2001',
        ])
        const row = await stored(id)
        expect([
          { minimumAmount: 5000, maximumAmount: null },
          { minimumAmount: null, maximumAmount: 3000 },
        ]).toContainEqual({
          minimumAmount: row?.minimumAmount,
          maximumAmount: row?.maximumAmount,
        })
      }
    })

    it('writes every one of several changes of one payment method', async () => {
      const id = await insertMethod()

      const responses = await Promise.all([
        update(id, { displayName: 'カード' }),
        update(id, { sortOrder: 7 }),
        update(id, { fee: 3.25 }),
        update(id, { isOnlineEnabled: true }),
        update(id, { description: '説明' }),
        update(id, { minimumAmount: 100 }),
      ])

      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200, 200, 200, 200,
      ])
      expect(await stored(id)).toMatchObject({
        displayName: 'カード',
        sortOrder: 7,
        fee: '3.25',
        isOnlineEnabled: true,
        description: '説明',
        minimumAmount: 100,
      })
    })

    it('writes the time of a change that waited as the time after the wait', async () => {
      const id = await insertMethod()

      const { pending, until } = await db.transaction(async (tx) => {
        await hold(tx, id)
        const underWay = update(id, { sortOrder: 3 }).then(
          (response) => response,
        )
        await pause(300)

        return { pending: underWay, until: await databaseClock() }
      })
      const response = await pending
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expectBetween(response.body.data.updatedAt, until, after)
    })

    it('holds neither the salon nor another payment method for a change or a removal', async () => {
      const toChange = await insertMethod()
      const toRemove = await insertMethod()
      const other = await insertMethod()

      const responses = await db.transaction(async (tx) => {
        await tx
          .select({ id: salons.id })
          .from(salons)
          .where(eq(salons.id, salonId))
          .for('update')
        await hold(tx, other)

        return [
          await unlessItWaits(update(toChange, { sortOrder: 3 })),
          await unlessItWaits(remove(toRemove)),
        ]
      })

      expect(responses.map((response) => response?.status)).toEqual([200, 204])
    })

    it('makes a removal wait for a payment that is being written with the payment method, and meet it', async () => {
      const id = await insertMethod()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await insertPayment(id, {}, tx)
          const underWay = remove(id).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(IN_USE)
      expect(await stored(id)).toBeDefined()
    })

    it('removes a payment method once a payment that was being written with it was not written after all', async () => {
      const id = await insertMethod()
      let pending: Promise<Response> | undefined

      await db
        .transaction(async (tx) => {
          await insertPayment(id, {}, tx)
          pending = remove(id).then((response) => response)
          await pause(300)
          tx.rollback()
        })
        .catch(() => undefined)
      const response = await pending

      expect(response?.status).toBe(204)
      expect(await stored(id)).toBeUndefined()
    })

    it('makes a removal wait for a change of the payment method', async () => {
      const id = await insertMethod()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await hold(tx, id)
          const underWay = remove(id).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expect((await pending).status).toBe(204)
    })

    it('removes a payment method once for several removals', async () => {
      const id = await insertMethod()

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => remove(id)),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '204',
        '404 3001',
        '404 3001',
        '404 3001',
        '404 3001',
        '404 3001',
      ])
    })

    it('answers a change that waited for a removal with 404', async () => {
      const id = await insertMethod()

      const { pending } = await db.transaction(async (tx) => {
        await tx.delete(paymentMethods).where(eq(paymentMethods.id, id))
        const underWay = update(id, { sortOrder: 3 }).then(
          (response) => response,
        )
        await pause(300)

        return { pending: underWay }
      })

      expectProblem(await pending, notFound)
    })

    it('reads and lists a payment method while it is held', async () => {
      const id = await insertMethod()

      const responses = await db.transaction(async (tx) => {
        await hold(tx, id)

        return [await unlessItWaits(read(id)), await unlessItWaits(list())]
      })

      expect(responses.map((response) => response?.status)).toEqual([200, 200])
    })

    it('adds several payment methods at the same moment', async () => {
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => create()),
      )

      expect(responses.map((response) => response.status)).toEqual([
        201, 201, 201, 201, 201, 201,
      ])
      expect(await everything()).toHaveLength(6)
    })
  })

  describe('PaymentMethodRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new PaymentMethodRepository(db)
    const ofSalon = (id: string = salonId) => salonIdSchema.parse(id)
    const idOf = (id: string) => paymentMethodIdSchema.parse(id)

    /** A payment method as the use case hands it on. */
    const newMethod = (): DbNewPaymentMethod => ({
      method: 'debit_card',
      displayName: 'デビットカード',
      description: null,
      processorName: 'Stripe',
      fee: '2.9',
      minimumAmount: 1000,
      maximumAmount: null,
      isOnlineEnabled: false,
      isOfflineEnabled: true,
      sortOrder: 3,
      isActive: true,
    })

    /** What every method resolves to when the database does not answer. */
    const unanswered = async (
      call: (
        repositoryOf: PaymentMethodRepository,
      ) => Promise<Result<unknown, DomainError>>,
    ): Promise<Result<unknown, DomainError>> => {
      const connection = connectUnreachableDatabase()
      const result = await call(
        new PaymentMethodRepository(connection.database),
      )
      await connection.close()
      return result
    }

    it('creates a payment method in the salon it is given and returns the row', async () => {
      const created = dataOf(await repository().create(ofSalon(), newMethod()))

      expect(created).toEqual({
        ...newMethod(),
        id: expect.stringMatching(UUID),
        salonId,
        processorConfig: null,
        fee: '2.90',
        createdAt: expect.any(String),
        updatedAt: created.createdAt,
      })
      expect(await stored(created.id)).toEqual(created)
    })

    it('finds a payment method of the salon, and none of another salon', async () => {
      const id = await insertMethod()

      const found = dataOf(await repository().findById(ofSalon(), idOf(id)))
      const elsewhere = dataOf(
        await repository().findById(ofSalon(await salon()), idOf(id)),
      )
      const unknown = dataOf(
        await repository().findById(ofSalon(), idOf(UNKNOWN_ID)),
      )

      expect(found).toEqual(await stored(id))
      expect(elsewhere).toBeNull()
      expect(unknown).toBeNull()
    })

    it('lists a page with how many match and whether more follow, and null for a cursor of another salon', async () => {
      const first = await insertMethod({ sortOrder: 1 })
      const second = await insertMethod({ sortOrder: 2 })
      await insertMethod({ sortOrder: 3, isActive: false })
      const elsewhere = await insertMethod({}, await salon())
      const criteria = {
        salonId: ofSalon(),
        limit: 1,
        after: null,
        method: null,
        isActive: true,
      }

      const page = dataOf(await repository().list(criteria))
      const next = dataOf(
        await repository().list({ ...criteria, after: idOf(first) }),
      )
      const lost = dataOf(
        await repository().list({ ...criteria, after: idOf(elsewhere) }),
      )

      expect(page).toMatchObject({
        paymentMethods: [{ id: first }],
        total: 2,
        hasMore: true,
      })
      expect(next).toMatchObject({
        paymentMethods: [{ id: second }],
        total: 2,
        hasMore: false,
      })
      expect(lost).toBeNull()
    })

    it('updates a payment method of the salon, and says of one of another salon that it is not found', async () => {
      const id = await insertMethod()

      const updated = dataOf(
        await repository().update(ofSalon(), idOf(id), { fee: '1.5' }),
      )
      const elsewhere = dataOf(
        await repository().update(ofSalon(await salon()), idOf(id), {
          fee: '9',
        }),
      )

      expect(updated).toMatchObject({
        type: 'updated',
        paymentMethod: { id, fee: '1.50' },
      })
      expect(elsewhere).toEqual({ type: 'notFound' })
      expect((await stored(id))?.fee).toBe('1.50')
    })

    it('does not write limits that would be out of order, and says so', async () => {
      const id = await insertMethod({ minimumAmount: 1000 })

      const outcome = dataOf(
        await repository().update(ofSalon(), idOf(id), {
          maximumAmount: 999,
          displayName: 'カード',
        }),
      )

      expect(outcome).toEqual({ type: 'limitsOutOfOrder' })
      expect(await stored(id)).toMatchObject({
        maximumAmount: null,
        displayName: '現金',
      })
    })

    it('deletes a payment method of the salon, not one of another salon and not one that a payment refers to', async () => {
      const free = await insertMethod()
      const used = await insertMethod()
      await insertPayment(used)

      const elsewhere = dataOf(
        await repository().delete(ofSalon(await salon()), idOf(free)),
      )
      const inUse = dataOf(await repository().delete(ofSalon(), idOf(used)))
      const removed = dataOf(await repository().delete(ofSalon(), idOf(free)))
      const again = dataOf(await repository().delete(ofSalon(), idOf(free)))

      expect(elsewhere).toEqual({ type: 'notFound' })
      expect(inUse).toEqual({ type: 'inUse' })
      expect(removed).toEqual({ type: 'deleted' })
      expect(again).toEqual({ type: 'notFound' })
      expect((await everything()).map((row) => row.id)).toEqual([used])
    })

    it.each([
      [
        'create',
        'Failed to create payment method',
        (repositoryOf: PaymentMethodRepository) =>
          repositoryOf.create(ofSalon(), newMethod()),
      ],
      [
        'findById',
        'Failed to find payment method',
        (repositoryOf: PaymentMethodRepository) =>
          repositoryOf.findById(ofSalon(), idOf(UNKNOWN_ID)),
      ],
      [
        'list',
        'Failed to list payment methods',
        (repositoryOf: PaymentMethodRepository) =>
          repositoryOf.list({
            salonId: ofSalon(),
            limit: 20,
            after: null,
            method: null,
            isActive: null,
          }),
      ],
      [
        'update',
        'Failed to update payment method',
        (repositoryOf: PaymentMethodRepository) =>
          repositoryOf.update(ofSalon(), idOf(UNKNOWN_ID), { isActive: false }),
      ],
      [
        'delete',
        'Failed to delete payment method',
        (repositoryOf: PaymentMethodRepository) =>
          repositoryOf.delete(ofSalon(), idOf(UNKNOWN_ID)),
      ],
    ])(
      'resolves %s to a database error when the database does not answer',
      async (_method, message, call) => {
        expect(await unanswered(call)).toMatchObject({
          type: 'error',
          error: { type: 'database', message },
        })
      },
    )
  })

  describe('what the database holds a payment method to', () => {
    it.each([
      [
        'a fee above 100',
        { fee: '100.01' },
        'payment_methods_fee_is_a_percentage',
      ],
      [
        'a negative fee',
        { fee: '-0.01' },
        'payment_methods_fee_is_a_percentage',
      ],
      [
        'a lower limit of 0',
        { minimumAmount: 0 },
        'payment_methods_amount_limits',
      ],
      [
        'an upper limit of 0',
        { maximumAmount: 0 },
        'payment_methods_amount_limits',
      ],
      [
        'a lower limit above the upper one',
        { minimumAmount: 2, maximumAmount: 1 },
        'payment_methods_amount_limits',
      ],
      [
        'a negative sort order',
        { sortOrder: -1 },
        'payment_methods_sort_order_not_negative',
      ],
    ])('refuses %s', async (_case, overrides, constraint) => {
      const failure = await insertMethod(overrides).then(
        () => null,
        (error: unknown) => error,
      )

      expect(failure).toMatchObject({
        cause: { constraint_name: constraint },
      })
      expect(await everything()).toEqual([])
    })

    it.each([
      ['a fee of 0 and of 100', [{ fee: '0' }, { fee: '100' }]],
      [
        'limits of 1, equal limits and one limit alone',
        [
          { minimumAmount: 1, maximumAmount: 1 },
          { minimumAmount: 5000 },
          { maximumAmount: 5000 },
        ],
      ],
      ['a sort order of 0', [{ sortOrder: 0 }]],
    ])('takes %s', async (_case, rowsOf) => {
      for (const overrides of rowsOf) {
        await insertMethod(overrides)
      }

      expect(await everything()).toHaveLength(rowsOf.length)
    })

    it('has no default for the fee: a fee that is not written is not noted', async () => {
      const id = await insertMethod()

      expect((await stored(id))?.fee).toBeNull()
    })

    it('keeps a payment method that a payment refers to, whoever deletes it', async () => {
      const id = await insertMethod()
      await insertPayment(id)

      const failure = await db
        .delete(paymentMethods)
        .where(eq(paymentMethods.id, id))
        .then(
          () => null,
          (error: unknown) => error,
        )

      expect(failure).toMatchObject({
        cause: { constraint_name: 'payment_transactions_payment_method_id_fk' },
      })
      expect(await stored(id)).toBeDefined()
    })
  })
})
