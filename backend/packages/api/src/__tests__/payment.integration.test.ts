import {
  customers,
  paymentMethods,
  paymentTransactions,
  sales,
  type salons,
  services,
  type staff,
} from '@beauty-salon-backend/database'
import {
  type DomainError,
  type LedgerReach,
  paymentIdSchema,
  paymentMethodIdSchema,
  saleIdSchema,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { PaymentRepository } from '@beauty-salon-backend/infrastructure'
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
  insertStaff,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
} from './_shared/auth-helpers'
import {
  type NewPayment,
  PAYMENT_STATUSES,
  type PaymentStatus,
  paymentColumns,
} from './_shared/payment-helpers'
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
} from './_shared/test-helpers'

const SALES = '/api/v1/sales'
const PAYMENTS = '/api/v1/payments'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

/** PT and two groups of four of the 32 symbols a record number is made of. */
const PAYMENT_NUMBER = /^PT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

const MAX_INTEGER = 2_147_483_647

/** What the sale of the tests charges: a cut for 6,000 yen and 600 of tax. */
const TOTAL = 6600

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
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

const INVALID_SALE_ID = 'Invalid sale ID'
const INVALID_PAYMENT_ID = 'Invalid payment ID'
const INVALID_PAYMENT = 'Invalid payment'
const INVALID_REFUND = 'Invalid refund'
const SALE_IS_VOID = 'The sale is void; a void sale takes no payment'
const REFUND_MADE =
  'A payment of the sale was refunded; a sale with a refund takes no further payment'
const NOTHING_LEFT = 'Nothing is left to pay of the sale'
const NOT_COMPLETED =
  'Only a payment that is completed is refunded; a payment is refunded once'
const NOT_A_PAYMENT_METHOD =
  'Must name a payment method of the salon of the sale that is active'
const NOT_A_CARD =
  'Must be null unless the payment method is a credit card or a debit card'
const PAYMENT_HAS_BEGUN =
  'The lines of a sale are replaced only while its payment status is pending'
const NOT_REFUNDED =
  'The sale has a payment that was not refunded; refund it before the sale is voided'
const METHOD_IN_USE =
  'The payment method cannot be deleted: a payment refers to it; set isActive to false instead'

/** The properties of a PaymentResponse. */
const PROPERTIES = [
  'amount',
  'cardBrand',
  'cardLastFour',
  'createdAt',
  'errorCode',
  'errorMessage',
  'failedAt',
  'id',
  'paymentMethodId',
  'processedAt',
  'processorTransactionId',
  'refundAmount',
  'refundReason',
  'refundedAt',
  'saleId',
  'status',
  'transactionNumber',
  'updatedAt',
]

type MethodKind = (typeof paymentMethods.$inferInsert)['method']

/** The kinds of payment method that are a card. */
const CARDS: MethodKind[] = ['credit_card', 'debit_card']

/** The kinds of payment method that are no card. */
const NOT_CARDS: MethodKind[] = [
  'cash',
  'e_money',
  'qr_payment',
  'bank_transfer',
  'point',
]

/** The statuses of a payment whose money the salon received. */
const RECEIVED: PaymentStatus[] = ['completed', 'partial_refund', 'refunded']

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

/** A time of 20 November 2026 in UTC, `HH:MM`; 03:40 is twenty to one in Tokyo. */
const at = (time: string): string => `2026-11-20T${time}:00Z`

/** How often each value comes, by the value. */
const tally = (values: string[]): Record<string, number> =>
  Object.fromEntries(
    [...Map.groupBy(values, (value) => value)].map(([value, same]) => [
      value,
      same.length,
    ]),
  )

describe('Payments API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests: in Tokyo. */
  let salonId: string
  let customerId: string
  /** A staff member of the salon. */
  let staffId: string
  /** A cut of the salon. */
  let cutId: string
  /** The till of the salon: cash, in use, without limits. */
  let cashId: string

  type NewSalon = typeof salons.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type NewSale = typeof sales.$inferInsert
  type NewPaymentMethod = typeof paymentMethods.$inferInsert
  type StoredPayment = typeof paymentTransactions.$inferSelect
  type Executor = Pick<typeof db, 'insert'>
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(db, { timezone: 'Asia/Tokyo', ...overrides })

  /** A way of paying at a salon, written directly; returns its ID. */
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

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await salon()
    customerId = await insertCustomer(db)
    staffId = await insertStaff(db, salonId)
    const [cut] = await db
      .insert(services)
      .values({
        salonId,
        name: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
      })
      .returning({ id: services.id })
    if (cut === undefined) {
      throw new Error('No service was inserted')
    }
    cutId = cut.id
    cashId = await insertMethod()
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A line that keeps every rule: a cut of the salon for 6,000 yen and 600 of tax. */
  const line = (overrides: Record<string, unknown> = {}) => ({
    itemType: 'service',
    itemId: cutId,
    itemName: 'カット',
    quantity: 1,
    unitPrice: 6000,
    discountAmount: 0,
    taxAmount: 600,
    totalAmount: TOTAL,
    staffId,
    commissionRate: null,
    commissionAmount: null,
    notes: null,
    sortOrder: 0,
    ...overrides,
  })

  /** A line of no record and of nobody: a fee of 500 yen and 50 of tax. */
  const fee = () =>
    line({
      itemType: 'fee',
      itemId: null,
      itemName: '指名料',
      unitPrice: 500,
      taxAmount: 50,
      totalAmount: 550,
      staffId: null,
    })

  /** Enters a sale of a cut for the customer as the admin; anything but 201 fails the test. */
  const created = async (overrides: Record<string, unknown> = {}) => {
    const response = await authorized(request(app).post(SALES), asAdmin).send({
      salonId,
      customerId,
      staffId,
      bookingId: null,
      saleTime: at('03:40'),
      pointsUsed: null,
      pointsEarned: null,
      notes: null,
      details: [line()],
      ...overrides,
    })
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** A request that keeps every rule: the whole of the sale of the tests, in cash. */
  const payment = (overrides: Record<string, unknown> = {}) => ({
    paymentMethodId: cashId,
    amount: TOTAL,
    cardLastFour: null,
    cardBrand: null,
    ...overrides,
  })

  /** A request that keeps every rule: all of a payment of the whole sale, without a reason. */
  const refundOf = (overrides: Record<string, unknown> = {}) => ({
    refundAmount: TOTAL,
    refundReason: null,
    ...overrides,
  })

  /** Reads a sale; as the admin unless said otherwise. */
  const read = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${SALES}/${id}`), as)

  /** Records a payment of a sale; as the admin unless said otherwise. */
  const process = (
    id: string,
    body: object = payment(),
    as: string | null = asAdmin,
  ) => authorized(request(app).post(`${SALES}/${id}/process`), as).send(body)

  /** Refunds a payment; as the admin unless said otherwise. */
  const refund = (
    id: string,
    body: object = refundOf(),
    as: string | null = asAdmin,
  ) => authorized(request(app).post(`${PAYMENTS}/${id}/refund`), as).send(body)

  /** Corrects a sale as the admin. */
  const update = (id: string, body: object) =>
    authorized(request(app).patch(`${SALES}/${id}`), asAdmin).send(body)

  /** Voids a sale as the admin, without a reason. */
  const voidSale = (id: string) =>
    authorized(request(app).post(`${SALES}/${id}/void`), asAdmin).send({
      voidReason: null,
    })

  /** The payment a request recorded; anything but 200 fails the test. */
  const paid = async (id: string, overrides: Record<string, unknown> = {}) => {
    const response = await process(id, payment(overrides))
    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** The row of a sale; a sale that is not there fails the test. */
  const storedSale = async (id: string) => {
    const [row] = await db.select().from(sales).where(eq(sales.id, id))
    if (row === undefined) {
      throw new Error(`No sale ${id} is stored`)
    }
    return row
  }

  /** The payments of a sale as they are stored, in the order they were made. */
  const paymentsOf = (saleId: string): Promise<StoredPayment[]> =>
    db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.saleId, saleId))
      .orderBy(asc(paymentTransactions.createdAt), asc(paymentTransactions.id))

  /** The row of a payment; a payment that is not there fails the test. */
  const storedPayment = async (id: string): Promise<StoredPayment> => {
    const [row] = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, id))
    if (row === undefined) {
      throw new Error(`No payment ${id} is stored`)
    }
    return row
  }

  /** Everything a payment or a refund could write. */
  const everything = async () => ({
    sales: await db.select().from(sales).orderBy(asc(sales.id)),
    payments: await db
      .select()
      .from(paymentTransactions)
      .orderBy(asc(paymentTransactions.id)),
    customers: await db.select().from(customers).orderBy(asc(customers.id)),
  })

  /** What the payments of a sale say its payment status is. */
  const statusBy = (total: number, payments: StoredPayment[]): string => {
    const received = payments.filter(({ status }) => RECEIVED.includes(status))
    const taken = received.reduce((sum, { amount }) => sum + amount, 0)
    const returned = received.reduce(
      (sum, { refundAmount }) => sum + (refundAmount ?? 0),
      0,
    )
    if (returned > 0) {
      return returned === taken ? 'refunded' : 'partial_refund'
    }
    if (taken === 0) {
      return 'pending'
    }
    return taken < total ? 'processing' : 'completed'
  }

  /** The moment of the clock that a payment and a refund write by. */
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

  /** A row of `sales` that keeps every constraint: 6,000 yen and 600 of tax. */
  const insertSale = async (overrides: Partial<NewSale> = {}) => {
    const [row] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-TEST-${nextRow()}`,
        salonId,
        customerId,
        saleDate: '2026-11-20',
        saleTime: at('03:40'),
        subtotal: 6000,
        taxAmount: 600,
        totalAmount: TOTAL,
        ...overrides,
      })
      .returning({ id: sales.id })
    if (row === undefined) {
      throw new Error('No sale was inserted')
    }
    return row.id
  }

  /** What makes a row of `sales` a void one. */
  const voided: Partial<NewSale> = {
    isVoid: true,
    voidedAt: at('05:00'),
    voidReason: '二重登録',
  }

  /** A payment of a sale in cash, written directly; returns its ID. */
  const insertPayment = async (
    saleId: string,
    overrides: Partial<NewPayment> = {},
    executor: Executor = db,
  ): Promise<string> => {
    const [row] = await executor
      .insert(paymentTransactions)
      .values({
        saleId,
        paymentMethodId: cashId,
        transactionNumber: `TX-${nextRow()}`,
        ...paymentColumns(overrides),
      })
      .returning({ id: paymentTransactions.id })
    if (row === undefined) {
      throw new Error('No payment was inserted')
    }
    return row.id
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  /** A member of a salon; of the salon of the tests unless another is given. */
  const member =
    (
      role: 'owner' | 'manager' | 'staff',
      salonOf: () => Promise<string> = async () => salonId,
      staffOverrides: Partial<NewStaff> = {},
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

  /** Everyone who keeps the sales ledger of the salon of the tests. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Those of them who give money back. */
  const refunders: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
  ]

  /** The members of another salon than the one of the tests. */
  const membersOfAnotherSalon: [string, SignInAs][] = [
    ['the owner of another salon', member('owner', salon)],
    ['a manager of another salon', member('manager', salon)],
    ['a staff member of another salon', member('staff', salon)],
  ]

  /** Accounts the ledger is closed to. */
  const notKeepers: [string, SignInAs][] = [
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
      'an account of a salon whose staff record is deleted',
      member('staff', async () => salonId, {
        deletedAt: '2026-11-01T00:00:00.000Z',
      }),
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

  describe('POST /api/v1/sales/:id/process', () => {
    it('records the payment of a whole sale in cash and returns it', async () => {
      const entered = await created()
      const other = await created()
      const otherBefore = await storedSale(other.id)
      const before = await databaseClock()

      const response = await process(entered.id)
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          saleId: entered.id,
          paymentMethodId: cashId,
          transactionNumber: expect.stringMatching(PAYMENT_NUMBER),
          amount: TOTAL,
          status: 'completed',
          processorTransactionId: null,
          cardLastFour: null,
          cardBrand: null,
          errorCode: null,
          errorMessage: null,
          processedAt: expect.stringMatching(ISO_TIMESTAMP),
          failedAt: null,
          refundedAt: null,
          refundAmount: null,
          refundReason: null,
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { sale: `${SALES}/${entered.id}` },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expectBetween(response.body.data.processedAt, before, after)
      expectBetween(response.body.data.createdAt, before, after)
      expectBetween(response.body.data.updatedAt, before, after)
      expect(await storedSale(other.id)).toEqual(otherBefore)
      expect(await paymentsOf(other.id)).toEqual([])
    })

    it('tells the sale that it is paid, and the sale shows the payment', async () => {
      const entered = await created()
      const before = await databaseClock()

      const { data } = (await process(entered.id)).body
      const after = await databaseClock()
      const sale = (await read(entered.id)).body.data

      expect(sale).toEqual({
        ...entered,
        paymentStatus: 'completed',
        payments: [data],
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expectBetween(sale.updatedAt, before, after)
    })

    it('stores nothing of a payment processor: none is connected', async () => {
      const entered = await created()

      const { data } = (await process(entered.id)).body

      expect(await storedPayment(data.id)).toMatchObject({
        status: 'completed',
        processorTransactionId: null,
        processorResponse: null,
        metadata: null,
        errorCode: null,
        errorMessage: null,
        failedAt: null,
        refundedAt: null,
        refundAmount: null,
        refundReason: null,
      })
    })

    it('records a sale that is paid in parts, each part as a payment of its own', async () => {
      const entered = await created()
      const cardId = await insertMethod({
        method: 'credit_card',
        displayName: 'クレジットカード',
      })

      const first = await process(entered.id, payment({ amount: 2000 }))
      const afterFirst = (await read(entered.id)).body.data
      const second = await process(
        entered.id,
        payment({
          paymentMethodId: cardId,
          amount: 4599,
          cardLastFour: '4242',
          cardBrand: 'visa',
        }),
      )
      const afterSecond = (await read(entered.id)).body.data
      const third = await process(entered.id, payment({ amount: 1 }))
      const afterThird = (await read(entered.id)).body.data

      expect([first, second, third].map(statusAndCode)).toEqual([
        '200',
        '200',
        '200',
      ])
      expect([
        afterFirst.paymentStatus,
        afterSecond.paymentStatus,
        afterThird.paymentStatus,
      ]).toEqual(['processing', 'processing', 'completed'])
      expect(afterThird.payments).toEqual([
        first.body.data,
        second.body.data,
        third.body.data,
      ])
      expect(
        afterThird.payments.map((one: { status: string }) => one.status),
      ).toEqual(['completed', 'completed', 'completed'])
    })

    it('gives every payment a number of its own', async () => {
      const entered = await created()

      const numbers = [
        (await paid(entered.id, { amount: 1000 })).transactionNumber,
        (await paid(entered.id, { amount: 1000 })).transactionNumber,
        (await paid(entered.id, { amount: 1000 })).transactionNumber,
      ]

      expect(new Set(numbers).size).toBe(3)
      for (const number of numbers) {
        expect(number).toMatch(PAYMENT_NUMBER)
      }
    })

    it.each(CARDS)(
      'keeps the digits and the brand of the card of a payment by %s',
      async (method) => {
        const entered = await created()
        const cardId = await insertMethod({ method, displayName: 'カード' })

        const response = await process(
          entered.id,
          payment({
            paymentMethodId: cardId,
            cardLastFour: '0042',
            cardBrand: 'JCB',
          }),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          paymentMethodId: cardId,
          cardLastFour: '0042',
          cardBrand: 'JCB',
        })
        expect(await storedPayment(response.body.data.id)).toMatchObject({
          cardLastFour: '0042',
          cardBrand: 'JCB',
        })
      },
    )

    it.each(CARDS)(
      'records a payment by %s of which no card is kept',
      async (method) => {
        const entered = await created()
        const cardId = await insertMethod({ method, displayName: 'カード' })

        const response = await process(
          entered.id,
          payment({ paymentMethodId: cardId }),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          cardLastFour: null,
          cardBrand: null,
        })
      },
    )

    it.each(NOT_CARDS)(
      'records a payment by %s like any other, and moves nothing of the customer',
      async (method) => {
        const entered = await created()
        const methodId = await insertMethod({ method, displayName: '支払い' })
        const customersBefore = (await everything()).customers

        const response = await process(
          entered.id,
          payment({ paymentMethodId: methodId }),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          paymentMethodId: methodId,
          status: 'completed',
          amount: TOTAL,
        })
        expect((await everything()).customers).toEqual(customersBefore)
      },
    )

    it('takes a payment by a payment method that is offered neither online nor at the salon: a request does not say where the money was taken', async () => {
      const entered = await created()
      const methodId = await insertMethod({
        isOnlineEnabled: false,
        isOfflineEnabled: false,
      })

      const response = await process(
        entered.id,
        payment({ paymentMethodId: methodId }),
      )

      expect(response.status).toBe(200)
    })

    it('takes the amounts at the limits of the payment method', async () => {
      const entered = await created()
      const methodId = await insertMethod({
        minimumAmount: 1000,
        maximumAmount: 5600,
      })

      const atLower = await process(
        entered.id,
        payment({ paymentMethodId: methodId, amount: 1000 }),
      )
      const atUpper = await process(
        entered.id,
        payment({ paymentMethodId: methodId, amount: 5600 }),
      )

      expect([atLower, atUpper].map(statusAndCode)).toEqual(['200', '200'])
      expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
    })

    it('takes the IDs in upper case, and answers with them as they are stored', async () => {
      const entered = await created()

      const response = await process(
        entered.id.toUpperCase(),
        payment({ paymentMethodId: cashId.toUpperCase() }),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        saleId: entered.id,
        paymentMethodId: cashId,
      })
      expect(response.body.links).toEqual({ sale: `${SALES}/${entered.id}` })
    })

    it.each<[PaymentStatus]>([['pending'], ['processing'], ['failed']])(
      'takes the whole of a sale next to a payment that is %s: nothing was received with it',
      async (status) => {
        const entered = await created()
        await insertPayment(entered.id, { status })

        const response = await process(entered.id)

        expect(response.status).toBe(200)
        expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
      },
    )

    it('takes a payment for a sale without a customer', async () => {
      const entered = await created({ customerId: null })

      const response = await process(entered.id)

      expect(response.status).toBe(200)
      expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
    })

    describe('what a request must be', () => {
      it.each([
        ['paymentMethodId'],
        ['amount'],
        ['cardLastFour'],
        ['cardBrand'],
      ])(
        'refuses a request without %s: every key has to be there',
        async (key) => {
          const entered = await created()
          const before = await everything()

          const response = await process(
            entered.id,
            Object.fromEntries(
              Object.entries(payment()).filter(([name]) => name !== key),
            ),
          )

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_PAYMENT)
          expect(brokenRules(response)).toHaveLength(1)
          expect(brokenRules(response)[0]).toMatch(
            new RegExp(`^${key}:invalid_`),
          )
          expect(await everything()).toEqual(before)
        },
      )

      it.each<[string, Record<string, unknown>, string[]]>([
        [
          'a payment method that is no ID',
          { paymentMethodId: 'cash' },
          ['paymentMethodId:invalid_format'],
        ],
        [
          'null for the payment method',
          { paymentMethodId: null },
          ['paymentMethodId:invalid_type'],
        ],
        ['an amount of nothing', { amount: 0 }, ['amount:too_small']],
        ['a negative amount', { amount: -100 }, ['amount:too_small']],
        ['an amount with a fraction', { amount: 0.5 }, ['amount:invalid_type']],
        [
          'an amount beyond the column',
          { amount: MAX_INTEGER + 1 },
          ['amount:too_big'],
        ],
        ['an amount that is text', { amount: '6600' }, ['amount:invalid_type']],
        ['null for the amount', { amount: null }, ['amount:invalid_type']],
        [
          'three digits of a card',
          { cardLastFour: '424' },
          ['cardLastFour:invalid_format'],
        ],
        [
          'five digits of a card',
          { cardLastFour: '42424' },
          ['cardLastFour:invalid_format'],
        ],
        [
          'letters for the digits of a card',
          { cardLastFour: '42a2' },
          ['cardLastFour:invalid_format'],
        ],
        [
          'the digits of a card as a number',
          { cardLastFour: 4242 },
          ['cardLastFour:invalid_type'],
        ],
        ['an empty brand', { cardBrand: '' }, ['cardBrand:invalid_format']],
        [
          'a brand of only spaces',
          { cardBrand: '  ' },
          ['cardBrand:invalid_format'],
        ],
        [
          'a brand of 51 characters',
          { cardBrand: 'a'.repeat(51) },
          ['cardBrand:too_big'],
        ],
        [
          'the status of the payment',
          { status: 'failed' },
          ['status:unrecognized_keys'],
        ],
        [
          'the number of the payment',
          { transactionNumber: 'PT-0000-0001' },
          ['transactionNumber:unrecognized_keys'],
        ],
        [
          'the time of the payment',
          { processedAt: at('03:42') },
          ['processedAt:unrecognized_keys'],
        ],
        [
          'what a payment processor answered',
          { processorTransactionId: 'ch_3Q' },
          ['processorTransactionId:unrecognized_keys'],
        ],
      ])('refuses %s, and writes nothing', async (_case, overrides, rules) => {
        const entered = await created()
        const before = await everything()

        const response = await process(entered.id, payment(overrides))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_PAYMENT)
        expect(brokenRules(response)).toEqual(rules)
        expect(await everything()).toEqual(before)
      })

      it.each<[string, unknown]>([
        ['a list', []],
        ['a text', '"cash"'],
        ['null', 'null'],
      ])('refuses %s for the request', async (_case, body) => {
        const entered = await created()

        const response = await authorized(
          request(app).post(`${SALES}/${entered.id}/process`),
          asAdmin,
        )
          .set('Content-Type', 'application/json')
          .send(typeof body === 'string' ? body : JSON.stringify(body))

        expect(response.status).toBe(400)
        expect(await paymentsOf(entered.id)).toEqual([])
      })

      it('reports every broken rule of a request at once', async () => {
        const entered = await created()

        const response = await process(entered.id, {
          paymentMethodId: 'cash',
          amount: 0,
          cardLastFour: 'abcd',
          cardBrand: ' ',
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'paymentMethodId:invalid_format',
          'amount:too_small',
          'cardLastFour:invalid_format',
          'cardBrand:invalid_format',
        ])
      })

      it.each([
        ['a text that is no ID', 'not-an-id'],
        ['a sale number', 'SL-7Z3K-0QXM'],
      ])('refuses %s for the ID of the sale', async (_case, id) => {
        const response = await process(id)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SALE_ID)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      })
    })

    describe('what is not there', () => {
      it('answers a sale that does not exist with 404', async () => {
        const before = await everything()

        const response = await process(UNKNOWN_ID)

        expectProblem(response, notFound)
        expect(await everything()).toEqual(before)
      })

      it.each(membersOfAnotherSalon)(
        'answers %s as if the sale did not exist, also when the sale takes no payment',
        async (_case, signInAs) => {
          const entered = await created()
          const voidId = await insertSale(voided)
          const before = await everything()
          const authorization = await signInAs()

          const responses = [
            await process(entered.id, payment(), authorization),
            await process(voidId, payment(), authorization),
            await process(
              entered.id,
              payment({ paymentMethodId: UNKNOWN_ID }),
              authorization,
            ),
          ]

          for (const response of responses) {
            expectProblem(response, notFound)
          }
          expect(await everything()).toEqual(before)
        },
      )

      it('lets an administrator record a payment of a sale of any salon, with a payment method of that salon', async () => {
        const elsewhere = await salon()
        const id = await insertSale({ salonId: elsewhere })
        const methodElsewhere = await insertMethod({}, elsewhere)

        const withMethodOfThisSalon = await process(id)
        const response = await process(
          id,
          payment({ paymentMethodId: methodElsewhere }),
        )

        // The payment method of a payment is one of the salon of the sale.
        expectProblem(withMethodOfThisSalon, badRequest)
        expect(brokenRules(withMethodOfThisSalon)).toEqual([
          'paymentMethodId:not_found',
        ])
        expect(response.status).toBe(200)
      })
    })

    describe('what the sale does not take', () => {
      it('refuses a payment of a void sale', async () => {
        const id = await insertSale(voided)
        const before = await everything()

        const response = await process(id)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(SALE_IS_VOID)
        expect(await everything()).toEqual(before)
      })

      it('refuses a payment of a sale that is paid', async () => {
        const entered = await created()
        await paid(entered.id)
        const before = await everything()

        const response = await process(entered.id, payment({ amount: 1 }))

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOTHING_LEFT)
        expect(await everything()).toEqual(before)
      })

      it('refuses a payment of a sale that charges nothing, which stays pending', async () => {
        const id = await insertSale({
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
        })

        const response = await process(id, payment({ amount: 1 }))

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOTHING_LEFT)
        expect((await storedSale(id)).paymentStatus).toBe('pending')
      })

      it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
        ['all of the only payment', {}, {}],
        ['a part of the only payment', {}, { refundAmount: 1 }],
        [
          'all of a payment that left something to pay',
          { amount: 2000 },
          { refundAmount: 2000 },
        ],
        [
          'a part of a payment that left something to pay',
          { amount: 2000 },
          { refundAmount: 500 },
        ],
      ])(
        'refuses a payment of a sale that gave back %s',
        async (_case, paidWith, refundedWith) => {
          const entered = await created()
          const first = await paid(entered.id, paidWith)
          expect((await refund(first.id, refundOf(refundedWith))).status).toBe(
            200,
          )
          const before = await everything()

          const response = await process(entered.id, payment({ amount: 1 }))

          expectProblem(response, notAllowed)
          expect(response.body.detail).toBe(REFUND_MADE)
          expect(await everything()).toEqual(before)
        },
      )

      it('goes by the payments of the sale itself, and not by its payment status', async () => {
        const saidToBePaid = await insertSale({ paymentStatus: 'completed' })
        const saidToBeOpen = await insertSale({ paymentStatus: 'pending' })
        await insertPayment(saidToBeOpen)

        const responses = [
          await process(saidToBePaid),
          await process(saidToBeOpen, payment({ amount: 1 })),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '409 3003'])
        expect(responses[1]?.body.detail).toBe(NOTHING_LEFT)
      })
    })

    describe('what the payment method and what is left do not take', () => {
      const notOfTheSalon: [string, () => Promise<string>][] = [
        ['an ID that no payment method has', async () => UNKNOWN_ID],
        [
          'a payment method of another salon',
          async () => insertMethod({}, await salon()),
        ],
        [
          'a payment method that is not in use',
          () => insertMethod({ isActive: false }),
        ],
      ]

      it.each(notOfTheSalon)(
        'refuses %s, and writes nothing',
        async (_case, methodOf) => {
          const entered = await created()
          const paymentMethodId = await methodOf()
          const before = await everything()

          const response = await process(
            entered.id,
            payment({ paymentMethodId }),
          )

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_PAYMENT)
          expect(response.body.errors).toEqual([
            issue('paymentMethodId', 'not_found', NOT_A_PAYMENT_METHOD),
          ])
          expect(await everything()).toEqual(before)
        },
      )

      it('asks nothing else of a payment method that is not in use', async () => {
        const entered = await created()
        const paymentMethodId = await insertMethod({
          isActive: false,
          minimumAmount: 10000,
        })

        const response = await process(
          entered.id,
          payment({ paymentMethodId, cardLastFour: '4242' }),
        )

        expect(brokenRules(response)).toEqual(['paymentMethodId:not_found'])
      })

      it.each(NOT_CARDS)(
        'refuses the digits and the brand of a card for a payment by %s',
        async (method) => {
          const entered = await created()
          const paymentMethodId = await insertMethod({
            method,
            displayName: '支払い',
          })
          const before = await everything()

          const response = await process(
            entered.id,
            payment({
              paymentMethodId,
              cardLastFour: '4242',
              cardBrand: 'visa',
            }),
          )

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue('cardLastFour', 'custom', NOT_A_CARD),
            issue('cardBrand', 'custom', NOT_A_CARD),
          ])
          expect(await everything()).toEqual(before)
        },
      )

      it('refuses more than the sale charges', async () => {
        const entered = await created()
        const before = await everything()

        const response = await process(
          entered.id,
          payment({ amount: TOTAL + 1 }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'amount',
            'too_big',
            `Must not be more than what is left to pay (${TOTAL})`,
          ),
        ])
        expect(await everything()).toEqual(before)
      })

      it('refuses more than the payments before it left, and takes what they left', async () => {
        const entered = await created()
        await paid(entered.id, { amount: 6000 })

        const tooMuch = await process(entered.id, payment({ amount: 601 }))
        const theRest = await process(entered.id, payment({ amount: 600 }))

        expectProblem(tooMuch, badRequest)
        expect(tooMuch.body.errors).toEqual([
          issue(
            'amount',
            'too_big',
            'Must not be more than what is left to pay (600)',
          ),
        ])
        expect(theRest.status).toBe(200)
        expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
      })

      it('refuses an amount outside the limits of the payment method', async () => {
        const entered = await created()
        const paymentMethodId = await insertMethod({
          minimumAmount: 1000,
          maximumAmount: 5000,
        })
        const before = await everything()

        const below = await process(
          entered.id,
          payment({ paymentMethodId, amount: 999 }),
        )
        const above = await process(
          entered.id,
          payment({ paymentMethodId, amount: 5001 }),
        )

        expectProblem(below, badRequest)
        expect(below.body.errors).toEqual([
          issue(
            'amount',
            'too_small',
            'Must not be less than the minimumAmount of the payment method (1000)',
          ),
        ])
        expectProblem(above, badRequest)
        expect(above.body.errors).toEqual([
          issue(
            'amount',
            'too_big',
            'Must not be more than the maximumAmount of the payment method (5000)',
          ),
        ])
        expect(await everything()).toEqual(before)
      })

      it('holds the last payment of a sale to the lower limit as well', async () => {
        const entered = await created()
        const paymentMethodId = await insertMethod({ minimumAmount: 1000 })
        await paid(entered.id, { amount: 6000 })

        const response = await process(
          entered.id,
          payment({ paymentMethodId, amount: 600 }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['amount:too_small'])
      })
    })

    describe('the order in which a request is looked at', () => {
      it('says what is wrong with the ID before it reads the request', async () => {
        const response = await process('not-an-id', {})

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SALE_ID)
      })

      it('says what is wrong with the request before it looks for the sale', async () => {
        const response = await process(UNKNOWN_ID, payment({ amount: 0 }))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_PAYMENT)
      })

      it('says that the sale is not there before it looks at the payment method', async () => {
        const response = await process(
          UNKNOWN_ID,
          payment({ paymentMethodId: UNKNOWN_ID }),
        )

        expectProblem(response, notFound)
      })

      it('says that the sale is void before anything else of it, and before the payment method', async () => {
        const id = await insertSale(voided)
        await insertPayment(id, { status: 'refunded' })

        const response = await process(
          id,
          payment({ paymentMethodId: UNKNOWN_ID, amount: TOTAL + 1 }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(SALE_IS_VOID)
      })

      it('says that a refund was made before it says that nothing is left', async () => {
        const entered = await created()
        const first = await paid(entered.id)
        await refund(first.id, refundOf({ refundAmount: 1 }))

        const response = await process(
          entered.id,
          payment({ paymentMethodId: UNKNOWN_ID }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(REFUND_MADE)
      })

      it('says that nothing is left before it looks at the payment method', async () => {
        const entered = await created()
        await paid(entered.id)

        const response = await process(
          entered.id,
          payment({ paymentMethodId: UNKNOWN_ID, cardLastFour: '4242' }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOTHING_LEFT)
      })

      it('reports the payment method, the card and the amount together, in that order', async () => {
        const entered = await created()
        const paymentMethodId = await insertMethod({
          minimumAmount: 20000,
          maximumAmount: 30000,
        })

        const withoutMethod = await process(
          entered.id,
          payment({
            paymentMethodId: UNKNOWN_ID,
            cardBrand: 'visa',
            amount: TOTAL + 1,
          }),
        )
        const withCash = await process(
          entered.id,
          payment({
            paymentMethodId,
            cardLastFour: '4242',
            cardBrand: 'visa',
            amount: TOTAL + 1,
          }),
        )

        expect(brokenRules(withoutMethod)).toEqual([
          'paymentMethodId:not_found',
          'amount:too_big',
        ])
        expect(brokenRules(withCash)).toEqual([
          'cardLastFour:custom',
          'cardBrand:custom',
          'amount:too_small',
          'amount:too_big',
        ])
      })
    })
  })

  describe('POST /api/v1/payments/:id/refund', () => {
    it('refunds all of a payment and returns the payment as it is then', async () => {
      const entered = await created()
      const other = await created()
      const recorded = await paid(entered.id)
      const untouched = await paid(other.id)
      const before = await databaseClock()

      const response = await refund(
        recorded.id,
        refundOf({ refundReason: 'お客様都合' }),
      )
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...recorded,
          status: 'refunded',
          refundedAt: expect.stringMatching(ISO_TIMESTAMP),
          refundAmount: TOTAL,
          refundReason: 'お客様都合',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { sale: `${SALES}/${entered.id}` },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expectBetween(response.body.data.refundedAt, before, after)
      expectBetween(response.body.data.updatedAt, before, after)
      expect((await read(other.id)).body.data).toMatchObject({
        paymentStatus: 'completed',
        payments: [untouched],
      })
    })

    it('tells the sale that it is refunded, and the sale shows the refund', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)
      const before = await databaseClock()

      const { data } = (await refund(recorded.id)).body
      const after = await databaseClock()
      const sale = (await read(entered.id)).body.data

      expect(sale).toMatchObject({
        paymentStatus: 'refunded',
        payments: [data],
        isVoid: false,
      })
      expectBetween(sale.updatedAt, before, after)
    })

    it('refunds a part of a payment, of the payment and of the sale', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)

      const response = await refund(
        recorded.id,
        refundOf({ refundAmount: 600, refundReason: '消費税の返金' }),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id: recorded.id,
        amount: TOTAL,
        status: 'partial_refund',
        refundAmount: 600,
        refundReason: '消費税の返金',
      })
      expect((await storedSale(entered.id)).paymentStatus).toBe(
        'partial_refund',
      )
    })

    it.each<[string, number, string]>([
      ['one yen', 1, 'partial_refund'],
      ['all but one yen', TOTAL - 1, 'partial_refund'],
      ['all of it', TOTAL, 'refunded'],
    ])(
      'tells a payment of which %s is given back so',
      async (_case, refundAmount, status) => {
        const entered = await created()
        const recorded = await paid(entered.id)

        const response = await refund(recorded.id, refundOf({ refundAmount }))

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({ status, refundAmount })
        expect((await storedSale(entered.id)).paymentStatus).toBe(status)
      },
    )

    it('keeps a refund of which no reason is given without one', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)

      const response = await refund(recorded.id)

      expect(response.body.data.refundReason).toBeNull()
      expect((await storedPayment(recorded.id)).refundReason).toBeNull()
    })

    it('tells a sale with two payments what it gave back of both', async () => {
      const entered = await created()
      const first = await paid(entered.id, { amount: 2000 })
      const second = await paid(entered.id, { amount: 4600 })

      const firstBack = await refund(first.id, refundOf({ refundAmount: 2000 }))
      const afterFirst = (await read(entered.id)).body.data
      const secondBack = await refund(
        second.id,
        refundOf({ refundAmount: 4600 }),
      )
      const afterSecond = (await read(entered.id)).body.data

      expect([firstBack, secondBack].map(statusAndCode)).toEqual(['200', '200'])
      expect(afterFirst.paymentStatus).toBe('partial_refund')
      expect(
        afterFirst.payments.map((one: { status: string }) => one.status),
      ).toEqual(['refunded', 'completed'])
      expect(afterSecond.paymentStatus).toBe('refunded')
      expect(afterSecond.payments).toEqual([
        firstBack.body.data,
        secondBack.body.data,
      ])
    })

    it('tells a sale of which a part was paid and given back that it is refunded', async () => {
      const entered = await created()
      const recorded = await paid(entered.id, { amount: 2000 })

      const response = await refund(
        recorded.id,
        refundOf({ refundAmount: 2000 }),
      )

      expect(response.status).toBe(200)
      expect((await storedSale(entered.id)).paymentStatus).toBe('refunded')
    })

    it('refunds a completed payment of a void sale: giving money back is not refused', async () => {
      const id = await insertSale(voided)
      const paymentId = await insertPayment(id)

      const response = await refund(paymentId)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe('refunded')
      expect(await storedSale(id)).toMatchObject({
        isVoid: true,
        paymentStatus: 'refunded',
      })
    })

    it('moves nothing of the customer', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)
      const customersBefore = (await everything()).customers

      await refund(recorded.id)

      expect((await everything()).customers).toEqual(customersBefore)
    })

    it('takes the ID in upper case', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)

      const response = await refund(recorded.id.toUpperCase())

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(recorded.id)
    })

    describe('what a request must be', () => {
      it.each([['refundAmount'], ['refundReason']])(
        'refuses a request without %s: every key has to be there',
        async (key) => {
          const entered = await created()
          const recorded = await paid(entered.id)
          const before = await everything()

          const response = await refund(
            recorded.id,
            Object.fromEntries(
              Object.entries(refundOf()).filter(([name]) => name !== key),
            ),
          )

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_REFUND)
          expect(brokenRules(response)).toEqual([`${key}:invalid_type`])
          expect(await everything()).toEqual(before)
        },
      )

      it.each<[string, Record<string, unknown>, string[]]>([
        [
          'a refund of nothing',
          { refundAmount: 0 },
          ['refundAmount:too_small'],
        ],
        ['a negative refund', { refundAmount: -1 }, ['refundAmount:too_small']],
        [
          'a refund with a fraction',
          { refundAmount: 0.5 },
          ['refundAmount:invalid_type'],
        ],
        [
          'a refund beyond the column',
          { refundAmount: MAX_INTEGER + 1 },
          ['refundAmount:too_big'],
        ],
        [
          'a refund that is text',
          { refundAmount: '6600' },
          ['refundAmount:invalid_type'],
        ],
        [
          'an empty reason',
          { refundReason: '' },
          ['refundReason:invalid_format'],
        ],
        [
          'a reason of only whitespace',
          { refundReason: ' \n' },
          ['refundReason:invalid_format'],
        ],
        [
          'a reason that is not text',
          { refundReason: 42 },
          ['refundReason:invalid_type'],
        ],
        [
          'the status of the payment',
          { status: 'refunded' },
          ['status:unrecognized_keys'],
        ],
        [
          'the time of the refund',
          { refundedAt: at('05:00') },
          ['refundedAt:unrecognized_keys'],
        ],
      ])('refuses %s, and writes nothing', async (_case, overrides, rules) => {
        const entered = await created()
        const recorded = await paid(entered.id)
        const before = await everything()

        const response = await refund(recorded.id, refundOf(overrides))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_REFUND)
        expect(brokenRules(response)).toEqual(rules)
        expect(await everything()).toEqual(before)
      })

      it.each([
        ['a text that is no ID', 'not-an-id'],
        ['a payment number', 'PT-4H8N-2VWC'],
      ])('refuses %s for the ID of the payment', async (_case, id) => {
        const response = await refund(id)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_PAYMENT_ID)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      })

      it('refuses more than the payment received, and writes nothing', async () => {
        const entered = await created()
        const first = await paid(entered.id, { amount: 2000 })
        await paid(entered.id, { amount: 4600 })
        const before = await everything()

        const response = await refund(
          first.id,
          refundOf({ refundAmount: 2001 }),
        )

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_REFUND)
        expect(response.body.errors).toEqual([
          issue(
            'refundAmount',
            'too_big',
            'Must not be more than the amount of the payment (2000)',
          ),
        ])
        expect(await everything()).toEqual(before)
      })
    })

    describe('what is not there', () => {
      it('answers a payment that does not exist with 404', async () => {
        const response = await refund(UNKNOWN_ID)

        expectProblem(response, notFound)
      })

      it('does not take the ID of a sale for the ID of a payment', async () => {
        const entered = await created()
        await paid(entered.id)

        const response = await refund(entered.id)

        expectProblem(response, notFound)
        expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
      })

      it.each<[string, SignInAs]>([
        ['the owner of another salon', member('owner', salon)],
        ['a manager of another salon', member('manager', salon)],
      ])(
        'answers %s as if the payment did not exist, also when it cannot be refunded',
        async (_case, signInAs) => {
          const entered = await created()
          const recorded = await paid(entered.id)
          const other = await created()
          const failedId = await insertPayment(other.id, { status: 'failed' })
          const before = await everything()
          const authorization = await signInAs()

          const responses = [
            await refund(recorded.id, refundOf(), authorization),
            await refund(
              recorded.id,
              refundOf({ refundAmount: TOTAL + 1 }),
              authorization,
            ),
            await refund(failedId, refundOf(), authorization),
          ]

          for (const response of responses) {
            expectProblem(response, notFound)
          }
          expect(await everything()).toEqual(before)
        },
      )

      it('lets an administrator refund a payment of a sale of any salon', async () => {
        const elsewhere = await salon()
        const id = await insertSale({ salonId: elsewhere })
        const methodElsewhere = await insertMethod({}, elsewhere)
        const paymentId = await insertPayment(id, {
          paymentMethodId: methodElsewhere,
        })

        const response = await refund(paymentId)

        expect(response.status).toBe(200)
        expect((await storedSale(id)).paymentStatus).toBe('refunded')
      })
    })

    describe('what cannot be refunded', () => {
      it.each(PAYMENT_STATUSES.filter((status) => status !== 'completed'))(
        'refuses the refund of a payment that is %s, and writes nothing',
        async (status) => {
          const entered = await created()
          const paymentId = await insertPayment(entered.id, { status })
          const before = await everything()

          const response = await refund(
            paymentId,
            refundOf({ refundAmount: 1 }),
          )

          expectProblem(response, notAllowed)
          expect(response.body.detail).toBe(NOT_COMPLETED)
          expect(await everything()).toEqual(before)
        },
      )

      it.each<[string, Record<string, unknown>]>([
        ['in full', {}],
        ['in part', { refundAmount: 100 }],
      ])(
        'refunds a payment once: a payment that was refunded %s is not refunded again',
        async (_case, first) => {
          const entered = await created()
          const recorded = await paid(entered.id)
          expect((await refund(recorded.id, refundOf(first))).status).toBe(200)
          const before = await everything()

          const response = await refund(
            recorded.id,
            refundOf({ refundAmount: 1 }),
          )

          expectProblem(response, notAllowed)
          expect(response.body.detail).toBe(NOT_COMPLETED)
          expect(await everything()).toEqual(before)
        },
      )
    })

    describe('the order in which a request is looked at', () => {
      it('says what is wrong with the ID before it reads the request', async () => {
        const response = await refund('not-an-id', {})

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_PAYMENT_ID)
      })

      it('says what is wrong with the request before it looks for the payment', async () => {
        const response = await refund(UNKNOWN_ID, refundOf({ refundAmount: 0 }))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_REFUND)
      })

      it('says that the payment is not there before anything of the amount', async () => {
        const response = await refund(
          UNKNOWN_ID,
          refundOf({ refundAmount: MAX_INTEGER }),
        )

        expectProblem(response, notFound)
      })

      it('says that a payment is not completed before it looks at the amount', async () => {
        const entered = await created()
        const paymentId = await insertPayment(entered.id, {
          status: 'refunded',
        })

        const response = await refund(
          paymentId,
          refundOf({ refundAmount: TOTAL + 1 }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_COMPLETED)
      })
    })
  })

  describe('a sale and its payments', () => {
    it('keeps the lines of a sale of which a part is paid, and lets the rest of it be corrected', async () => {
      const entered = await created()
      await paid(entered.id, { amount: 1000 })

      const relined = await update(entered.id, { details: [fee()] })
      const noted = await update(entered.id, { notes: '内金あり' })

      expectProblem(relined, notAllowed)
      expect(relined.body.detail).toBe(PAYMENT_HAS_BEGUN)
      expect(noted.status).toBe(200)
      expect(noted.body.data).toMatchObject({
        totalAmount: TOTAL,
        paymentStatus: 'processing',
        notes: '内金あり',
      })
    })

    it('does not void a sale that holds money, and voids it once the money is given back', async () => {
      const entered = await created()
      const first = await paid(entered.id, { amount: 2000 })
      const second = await paid(entered.id, { amount: 4600 })

      const whilePaid = await voidSale(entered.id)
      await refund(first.id, refundOf({ refundAmount: 2000 }))
      const whileHalfBack = await voidSale(entered.id)
      await refund(second.id, refundOf({ refundAmount: 4600 }))
      const whenAllBack = await voidSale(entered.id)

      expectProblem(whilePaid, notAllowed)
      expect(whilePaid.body.detail).toBe(NOT_REFUNDED)
      expectProblem(whileHalfBack, notAllowed)
      expect(whenAllBack.status).toBe(200)
      expect(whenAllBack.body.data).toMatchObject({
        isVoid: true,
        paymentStatus: 'refunded',
      })
    })

    it('does not void a sale a part of whose payment was given back: the rest is held', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)
      await refund(recorded.id, refundOf({ refundAmount: 600 }))

      const response = await voidSale(entered.id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_REFUNDED)
    })

    it('does not delete a payment method a payment was recorded with, and no longer takes payments by one that is set aside', async () => {
      const entered = await created()
      await paid(entered.id, { amount: 1000 })
      const methodPath = `/api/v1/salons/${salonId}/payment-methods/${cashId}`

      const removal = await authorized(request(app).delete(methodPath), asAdmin)
      const setAside = await authorized(
        request(app).patch(methodPath),
        asAdmin,
      ).send({ isActive: false })
      const response = await process(entered.id, payment({ amount: 1000 }))

      expectProblem(removal, notAllowed)
      expect(removal.body.detail).toBe(METHOD_IN_USE)
      expect(setAside.status).toBe(200)
      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['paymentMethodId:not_found'])
    })

    it('refunds a payment whose payment method was set aside afterwards', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)
      await db
        .update(paymentMethods)
        .set({ isActive: false })
        .where(eq(paymentMethods.id, cashId))

      const response = await refund(recorded.id)

      expect(response.status).toBe(200)
    })
  })

  describe('who records and who refunds a payment', () => {
    it.each(unauthenticated)(
      'answers %s with 401 before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const entered = await created()
        const recorded = await paid(entered.id, { amount: 1000 })
        const before = await everything()
        const authorization = await tokenOf()

        const responses = [
          await process(entered.id, payment({ amount: 1000 }), authorization),
          await process('not-an-id', {}, authorization),
          await refund(
            recorded.id,
            refundOf({ refundAmount: 1 }),
            authorization,
          ),
          await refund('not-an-id', {}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everything()).toEqual(before)
      },
    )

    it.each(keepers)(
      'lets %s record a payment of a sale of the salon',
      async (_case, signInAs) => {
        const entered = await created()

        const response = await process(entered.id, payment(), await signInAs())

        expect(response.status).toBe(200)
        expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
      },
    )

    it.each(refunders)(
      'lets %s refund a payment of a sale of the salon',
      async (_case, signInAs) => {
        const entered = await created()
        const recorded = await paid(entered.id)

        const response = await refund(recorded.id, refundOf(), await signInAs())

        expect(response.status).toBe(200)
        expect(response.body.data.status).toBe('refunded')
      },
    )

    it('forbids a staff member of the salon the refund, before looking at the ID or the request, and lets them record a payment', async () => {
      const entered = await created()
      const recorded = await paid(entered.id, { amount: 1000 })
      const asStaff = await member('staff')()
      const before = await everything()

      const responses = [
        await refund(recorded.id, refundOf({ refundAmount: 1000 }), asStaff),
        await refund(UNKNOWN_ID, refundOf(), asStaff),
        await refund('not-an-id', refundOf(), asStaff),
        await refund(recorded.id, {}, asStaff),
      ]
      const unchanged = await everything()
      const recordedByStaff = await process(
        entered.id,
        payment({ amount: 1000 }),
        asStaff,
      )

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(unchanged).toEqual(before)
      expect(recordedByStaff.status).toBe(200)
    })

    it('forbids a staff member of another salon the refund', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)

      const response = await refund(
        recorded.id,
        refundOf(),
        await member('staff', salon)(),
      )

      expectProblem(response, forbidden)
      expect((await storedPayment(recorded.id)).status).toBe('completed')
    })

    it.each(notKeepers)(
      'forbids %s both, before looking at the ID or the request',
      async (_case, signInAs) => {
        const entered = await created()
        const recorded = await paid(entered.id, { amount: 1000 })
        const authorization = await signInAs()
        const before = await everything()

        const responses = [
          await process(entered.id, payment({ amount: 1000 }), authorization),
          await process(UNKNOWN_ID, payment(), authorization),
          await process('not-an-id', payment(), authorization),
          await process(entered.id, {}, authorization),
          await refund(
            recorded.id,
            refundOf({ refundAmount: 1 }),
            authorization,
          ),
          await refund(UNKNOWN_ID, refundOf(), authorization),
          await refund('not-an-id', refundOf(), authorization),
          await refund(recorded.id, {}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await everything()).toEqual(before)
      },
    )

    it('does not let the customer of a sale pay it or take the money back through the ledger', async () => {
      const entered = await created()
      const recorded = await paid(entered.id, { amount: 1000 })
      const asCustomer = (await signedInUser(app, db, { customerId }))
        .authorization

      const responses = [
        await process(entered.id, payment({ amount: 1000 }), asCustomer),
        await refund(recorded.id, refundOf({ refundAmount: 1000 }), asCustomer),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['GET on the payments', 'get', `${PAYMENTS}`],
      ['POST on the payments', 'post', `${PAYMENTS}`],
      ['GET on a payment', 'get', `${PAYMENTS}/PAYMENT`],
      ['PATCH on a payment', 'patch', `${PAYMENTS}/PAYMENT`],
      ['DELETE on a payment', 'delete', `${PAYMENTS}/PAYMENT`],
      ['GET on the refund of a payment', 'get', `${PAYMENTS}/PAYMENT/refund`],
      ['PUT on the refund of a payment', 'put', `${PAYMENTS}/PAYMENT/refund`],
      ['POST below the refund', 'post', `${PAYMENTS}/PAYMENT/refund/again`],
      ['POST on the void of a payment', 'post', `${PAYMENTS}/PAYMENT/void`],
      ['GET on the payment of a sale', 'get', `${SALES}/SALE/process`],
      ['PUT on the payment of a sale', 'put', `${SALES}/SALE/process`],
      ['GET on the payments of a sale', 'get', `${SALES}/SALE/payments`],
      ['POST on the payments of a sale', 'post', `${SALES}/SALE/payments`],
      ['POST on the refund of a sale', 'post', `${SALES}/SALE/refund`],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, path) => {
        const entered = await created()
        const recorded = await paid(entered.id, { amount: 1000 })
        const before = await everything()

        const response = await request(app)
          [method](
            path.replace('PAYMENT', recorded.id).replace('SALE', entered.id),
          )
          .set('Authorization', asAdmin)
          .send(refundOf({ refundAmount: 1000 }))

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const entered = await created()
      const recorded = await paid(entered.id, { amount: 1000 })
      const notJson = (call: Test, authorization: string | null): Test =>
        authorized(call, authorization)
          .set('Content-Type', 'application/json')
          .send('{"amount": ')

      const responses = [
        await notJson(
          request(app).post(`${SALES}/${entered.id}/process`),
          null,
        ),
        await notJson(
          request(app).post(`${PAYMENTS}/${recorded.id}/refund`),
          null,
        ),
        await notJson(
          request(app).post(`${PAYMENTS}/${recorded.id}/refund`),
          asAdmin,
        ),
        await authorized(
          request(app).post(`${SALES}/${entered.id}/process`),
          null,
        )
          .set('Content-Type', 'text/plain')
          .send('6600'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
    })
  })

  describe('requests at the same moment', () => {
    /** Whether a transaction can take hold of a row at once; whoever holds it is not waited for. */
    const isFree = (
      tx: Transaction,
      hold: (nested: Transaction) => Promise<unknown>,
    ) =>
      tx.transaction(hold).then(
        () => true,
        () => false,
      )

    const holdSale = (tx: Transaction, id: string) =>
      tx
        .select({ id: sales.id })
        .from(sales)
        .where(eq(sales.id, id))
        .for('update')

    /** Holds a payment method as a change or the removal of it does. */
    const holdMethod = (tx: Transaction, id: string) =>
      tx
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, id))
        .for('update')

    /** Holds a payment method as a payment that is being recorded does. */
    const shareMethod = (tx: Transaction, id: string) =>
      tx
        .select({ id: paymentMethods.id })
        .from(paymentMethods)
        .where(eq(paymentMethods.id, id))
        .for('share')

    /**
     * The response of a request that is sent while the test holds rows it
     * must not wait for; null when it waits for them after all.
     */
    const unlessItWaits = (call: Test): Promise<Response | null> =>
      Promise.race([
        call.then((response) => response),
        pause(2_000).then(() => null),
      ])

    /** Checks that the sale is told what its payments say, and received no more than it charges. */
    const expectConsistent = async (saleId: string): Promise<void> => {
      const sale = await storedSale(saleId)
      const payments = await paymentsOf(saleId)

      expect(sale.paymentStatus).toBe(statusBy(sale.totalAmount, payments))
      expect(
        payments
          .filter(({ status }) => RECEIVED.includes(status))
          .reduce((sum, { amount }) => sum + amount, 0),
      ).toBeLessThanOrEqual(sale.totalAmount)
    }

    it('records the whole of a sale once when six payments of it arrive together', async () => {
      const entered = await created()

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => process(entered.id)),
      )

      expect(tally(responses.map(statusAndCode))).toEqual({
        '200': 1,
        '409 3003': 5,
      })
      for (const response of responses.filter(({ status }) => status === 409)) {
        expect(response.body.detail).toBe(NOTHING_LEFT)
      }
      expect(await paymentsOf(entered.id)).toHaveLength(1)
      await expectConsistent(entered.id)
      expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
    })

    it('records six parts that make up the sale when they arrive together', async () => {
      const entered = await created()

      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          process(entered.id, payment({ amount: 1100 })),
        ),
      )
      const payments = await paymentsOf(entered.id)

      expect(responses.map(statusAndCode)).toEqual([
        '200',
        '200',
        '200',
        '200',
        '200',
        '200',
      ])
      expect(
        new Set(payments.map(({ transactionNumber }) => transactionNumber))
          .size,
      ).toBe(6)
      await expectConsistent(entered.id)
      expect((await storedSale(entered.id)).paymentStatus).toBe('completed')
    })

    it('takes no more than the sale charges when six parts that exceed it arrive together', async () => {
      const entered = await created()

      const responses = await Promise.all(
        Array.from({ length: 6 }, () =>
          process(entered.id, payment({ amount: 1500 })),
        ),
      )
      const payments = await paymentsOf(entered.id)

      // Four parts of 1,500 fit into 6,600; the fifth and the sixth meet 600 that are left.
      expect(tally(responses.map(statusAndCode))).toEqual({
        '200': 4,
        '400 2001': 2,
      })
      for (const response of responses.filter(({ status }) => status === 400)) {
        expect(response.body.errors).toEqual([
          issue(
            'amount',
            'too_big',
            'Must not be more than what is left to pay (600)',
          ),
        ])
      }
      expect(payments).toHaveLength(4)
      await expectConsistent(entered.id)
      expect((await storedSale(entered.id)).paymentStatus).toBe('processing')
    })

    it('refunds a payment once when six refunds of it arrive together', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)

      const responses = await Promise.all(
        [100, 200, 300, 400, 500, 600].map((refundAmount) =>
          refund(recorded.id, refundOf({ refundAmount })),
        ),
      )
      const refunded = responses.find(({ status }) => status === 200)

      expect(tally(responses.map(statusAndCode))).toEqual({
        '200': 1,
        '409 3003': 5,
      })
      expect(await storedPayment(recorded.id)).toMatchObject({
        status: 'partial_refund',
        refundAmount: refunded?.body.data.refundAmount,
      })
      await expectConsistent(entered.id)
    })

    it('ends with a paid sale or a void one, and never both, when a payment and a void arrive together', async () => {
      const entered = await created()

      const [recorded, voidedNow] = await Promise.all([
        process(entered.id),
        voidSale(entered.id),
      ])
      const sale = await storedSale(entered.id)

      // The payment came first and the void met it, or the payment met a void sale.
      expect([
        ['200', '409 3003'],
        ['409 3003', '200'],
      ]).toContainEqual([recorded, voidedNow].map(statusAndCode))
      expect(sale.isVoid).toBe(voidedNow.status === 200)
      expect(await paymentsOf(entered.id)).toHaveLength(
        recorded.status === 200 ? 1 : 0,
      )
      expect(
        recorded.status === 200 ? voidedNow.body.detail : recorded.body.detail,
      ).toBe(recorded.status === 200 ? NOT_REFUNDED : SALE_IS_VOID)
    })

    it('tells the sale what its payments say when payments and a refund of the sale arrive together', async () => {
      const entered = await created()
      const first = await paid(entered.id, { amount: 1100 })

      const responses = await Promise.all([
        ...Array.from({ length: 5 }, () =>
          process(entered.id, payment({ amount: 1100 })),
        ),
        refund(first.id, refundOf({ refundAmount: 1100 })),
      ])
      const refunded = responses.at(-1)

      expect(refunded?.status).toBe(200)
      // A payment came before the refund, or it met a sale with a refund.
      for (const response of responses.slice(0, 5)) {
        expect(['200', '409 3003']).toContain(statusAndCode(response))
      }
      for (const response of responses.filter(({ status }) => status === 409)) {
        expect(response.body.detail).toBe(REFUND_MADE)
      }
      await expectConsistent(entered.id)
    })

    it('makes a payment wait for whoever holds the sale, and meet what they left', async () => {
      const entered = await created()

      const { pending, paymentsWhileWaiting } = await db.transaction(
        async (tx) => {
          await holdSale(tx, entered.id)
          const underWay = process(entered.id).then((response) => response)
          await pause(300)
          await tx.update(sales).set(voided).where(eq(sales.id, entered.id))

          return {
            pending: underWay,
            paymentsWhileWaiting: await paymentsOf(entered.id),
          }
        },
      )
      const response = await pending

      expect(paymentsWhileWaiting).toEqual([])
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(SALE_IS_VOID)
      expect(await paymentsOf(entered.id)).toEqual([])
    })

    it('makes a payment meet a payment that was being written when it arrived', async () => {
      const entered = await created()

      const { pending } = await db.transaction(async (tx) => {
        await holdSale(tx, entered.id)
        await insertPayment(entered.id, { amount: 6000 }, tx)
        const underWay = process(entered.id).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        issue(
          'amount',
          'too_big',
          'Must not be more than what is left to pay (600)',
        ),
      ])
    })

    it('makes a refund wait for whoever holds the sale, and meet what they left', async () => {
      const entered = await created()
      const recorded = await paid(entered.id)

      const { pending, statusWhileWaiting } = await db.transaction(
        async (tx) => {
          await holdSale(tx, entered.id)
          const underWay = refund(recorded.id).then((response) => response)
          await pause(300)
          await tx
            .update(paymentTransactions)
            .set(paymentColumns({ status: 'refunded' }))
            .where(eq(paymentTransactions.id, recorded.id))

          return {
            pending: underWay,
            statusWhileWaiting: (await storedPayment(recorded.id)).status,
          }
        },
      )
      const response = await pending

      expect(statusWhileWaiting).toBe('completed')
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_COMPLETED)
    })

    it('writes the times of a payment and of a refund that waited as the times after the wait', async () => {
      const toPay = await created()
      const toRefund = await created()
      const recorded = await paid(toRefund.id)

      const { pending, until } = await db.transaction(async (tx) => {
        await holdSale(tx, toPay.id)
        await holdSale(tx, toRefund.id)
        const underWay = Promise.all([process(toPay.id), refund(recorded.id)])
        await pause(300)

        return { pending: underWay, until: await databaseClock() }
      })
      const [paidNow, refundedNow] = await pending
      const after = await databaseClock()

      expect([paidNow, refundedNow].map(statusAndCode)).toEqual(['200', '200'])
      expectBetween(paidNow.body.data.processedAt, until, after)
      expectBetween(paidNow.body.data.createdAt, until, after)
      expectBetween(paidNow.body.data.updatedAt, until, after)
      expectBetween(refundedNow.body.data.refundedAt, until, after)
      expectBetween(refundedNow.body.data.updatedAt, until, after)
      expectBetween((await read(toPay.id)).body.data.updatedAt, until, after)
    })

    it('makes a payment wait for a change of its payment method, and meet the payment method as it is then', async () => {
      const entered = await created()

      const { pending, paymentsWhileWaiting } = await db.transaction(
        async (tx) => {
          await holdMethod(tx, cashId)
          const underWay = process(entered.id).then((response) => response)
          await pause(300)
          await tx
            .update(paymentMethods)
            .set({ isActive: false })
            .where(eq(paymentMethods.id, cashId))

          return {
            pending: underWay,
            paymentsWhileWaiting: await paymentsOf(entered.id),
          }
        },
      )
      const response = await pending

      expect(paymentsWhileWaiting).toEqual([])
      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['paymentMethodId:not_found'])
      expect(await paymentsOf(entered.id)).toEqual([])
      expect((await storedSale(entered.id)).paymentStatus).toBe('pending')
    })

    it('meets the limits of a payment method as a change that was under way left them', async () => {
      const entered = await created()

      const { pending } = await db.transaction(async (tx) => {
        await holdMethod(tx, cashId)
        const underWay = process(entered.id).then((response) => response)
        await pause(300)
        await tx
          .update(paymentMethods)
          .set({ maximumAmount: 5000 })
          .where(eq(paymentMethods.id, cashId))

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['amount:too_big'])
    })

    it('makes a payment wait for a change of its payment method that holds the row no more than an update of a column that is no key does', async () => {
      const entered = await created()

      const { pending, paymentsWhileWaiting } = await db.transaction(
        async (tx) => {
          await tx
            .update(paymentMethods)
            .set({ isActive: false })
            .where(eq(paymentMethods.id, cashId))
          const underWay = process(entered.id).then((response) => response)
          await pause(300)

          return {
            pending: underWay,
            paymentsWhileWaiting: await paymentsOf(entered.id),
          }
        },
      )
      const response = await pending

      expect(paymentsWhileWaiting).toEqual([])
      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['paymentMethodId:not_found'])
      expect(await paymentsOf(entered.id)).toEqual([])
    })

    it('records a payment by a payment method whose change was given up', async () => {
      const entered = await created()
      const abandoned = new Error('The payment method is not changed')

      let pending: Promise<Response> | undefined
      await db
        .transaction(async (tx) => {
          await holdMethod(tx, cashId)
          await tx
            .update(paymentMethods)
            .set({ isActive: false })
            .where(eq(paymentMethods.id, cashId))
          pending = process(entered.id).then((response) => response)
          await pause(300)
          throw abandoned
        })
        .catch((error: unknown) => {
          if (error !== abandoned) {
            throw error
          }
        })
      const response = await pending

      expect(response?.status).toBe(200)
    })

    it('holds the sale before the payment method: a payment that waits for its payment method has hold of its sale', async () => {
      const entered = await created()

      const { pending, saleWasFree } = await db.transaction(async (tx) => {
        await holdMethod(tx, cashId)
        const underWay = process(entered.id).then((response) => response)
        await pause(300)
        const free = await isFree(tx, (nested) =>
          nested
            .select({ id: sales.id })
            .from(sales)
            .where(eq(sales.id, entered.id))
            .for('update', { noWait: true }),
        )

        return { pending: underWay, saleWasFree: free }
      })
      const response = await pending

      expect(saleWasFree).toBe(false)
      expect(response.status).toBe(200)
    })

    it('does not make the payments by one payment method wait for one another', async () => {
      const entered = await created()

      const response = await db.transaction(async (tx) => {
        // As a payment of another sale that is being recorded holds it.
        await shareMethod(tx, cashId)

        return unlessItWaits(process(entered.id))
      })

      expect(response?.status).toBe(200)
    })

    it('makes a change of a payment method wait for a payment that is being recorded with it', async () => {
      const methodPath = `/api/v1/salons/${salonId}/payment-methods/${cashId}`
      const storedMethod = async () => {
        const [row] = await db
          .select()
          .from(paymentMethods)
          .where(eq(paymentMethods.id, cashId))
        return row
      }

      const { pending, activeWhileWaiting } = await db.transaction(
        async (tx) => {
          await shareMethod(tx, cashId)
          const underWay = authorized(request(app).patch(methodPath), asAdmin)
            .send({ isActive: false })
            .then((response) => response)
          await pause(300)

          return {
            pending: underWay,
            activeWhileWaiting: (await storedMethod())?.isActive,
          }
        },
      )
      const response = await pending

      expect(activeWhileWaiting).toBe(true)
      expect(response.status).toBe(200)
      expect((await storedMethod())?.isActive).toBe(false)
    })

    it('answers a payment and the removal of its payment method that arrive together: the payment is recorded and the payment method stays, or it is gone and the payment is refused', async () => {
      const pairs = await Promise.all(
        Array.from({ length: 6 }, async () => ({
          saleId: (await created()).id,
          methodId: await insertMethod(),
        })),
      )

      const responses = await Promise.all(
        pairs.flatMap(({ saleId, methodId }) => [
          process(saleId, payment({ paymentMethodId: methodId })),
          authorized(
            request(app).delete(
              `/api/v1/salons/${salonId}/payment-methods/${methodId}`,
            ),
            asAdmin,
          ).then((response) => response),
        ]),
      )

      for (const [index, { saleId, methodId }] of pairs.entries()) {
        const outcome = responses
          .slice(index * 2, index * 2 + 2)
          .map(statusAndCode)
        expect([
          ['200', '409 3003'],
          ['400 2001', '204'],
        ]).toContainEqual(outcome)
        expect(await paymentsOf(saleId)).toHaveLength(
          outcome[0] === '200' ? 1 : 0,
        )
        expect(
          await db.$count(paymentMethods, eq(paymentMethods.id, methodId)),
        ).toBe(outcome[0] === '200' ? 1 : 0)
        await expectConsistent(saleId)
      }
    })

    it('answers every one of six payments and six voids of those sales, and neither waits for the other for ever', async () => {
      const saleIds = await Promise.all(
        Array.from({ length: 6 }, async () => (await created()).id),
      )

      const responses = await Promise.all(
        saleIds.flatMap((saleId) => [process(saleId), voidSale(saleId)]),
      )

      for (const [index, saleId] of saleIds.entries()) {
        expect([
          ['200', '409 3003'],
          ['409 3003', '200'],
        ]).toContainEqual(
          responses.slice(index * 2, index * 2 + 2).map(statusAndCode),
        )
        await expectConsistent(saleId)
      }
    })
  })

  describe('PaymentRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new PaymentRepository(db)
    const everySalon: LedgerReach = { type: 'everySalon' }
    const salonOnly = (id: string): LedgerReach => ({
      type: 'salon',
      salonId: salonIdSchema.parse(id),
    })

    /** A payment as the use case hands it on: in cash, without a card. */
    const paymentOf = (amount: number = TOTAL, methodId: string = cashId) => ({
      paymentMethodId: paymentMethodIdSchema.parse(methodId),
      amount,
      cardLastFour: null,
      cardBrand: null,
    })

    const recordedBy = (
      id: string,
      reach: LedgerReach,
      request: ReturnType<typeof paymentOf> = paymentOf(),
      transactionNumber = `PT-TEST-${nextRow()}`,
    ) =>
      repository()
        .record(saleIdSchema.parse(id), reach, request, { transactionNumber })
        .then(dataOf)

    const refundedBy = (
      id: string,
      reach: LedgerReach,
      refundAmount: number = TOTAL,
    ) =>
      repository()
        .refund(paymentIdSchema.parse(id), reach, {
          refundAmount,
          refundReason: null,
        })
        .then(dataOf)

    describe('record', () => {
      it('records a payment of a sale within the reach under the number it is given, and tells the sale', async () => {
        const entered = await created()

        const outcome = await recordedBy(
          entered.id,
          salonOnly(salonId),
          paymentOf(1000),
          'PT-0000-0001',
        )

        expect(outcome).toMatchObject({
          type: 'recorded',
          payment: {
            saleId: entered.id,
            paymentMethodId: cashId,
            transactionNumber: 'PT-0000-0001',
            amount: 1000,
            status: 'completed',
          },
        })
        expect(await paymentsOf(entered.id)).toHaveLength(1)
        expect((await storedSale(entered.id)).paymentStatus).toBe('processing')
      })

      it('finds no sale outside the reach, and says why a sale takes no payment', async () => {
        const entered = await created()
        const paidUp = await created()
        await paid(paidUp.id)
        const refunded = await created()
        await refund((await paid(refunded.id)).id)

        const outcomes = [
          await recordedBy(entered.id, salonOnly(await salon())),
          await recordedBy(UNKNOWN_ID, everySalon),
          await recordedBy(await insertSale(voided), everySalon),
          await recordedBy(refunded.id, everySalon),
          await recordedBy(paidUp.id, everySalon),
        ]

        expect(outcomes).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
          { type: 'void' },
          { type: 'refundMade' },
          { type: 'nothingLeft' },
        ])
        expect(await paymentsOf(entered.id)).toEqual([])
      })

      it('says what the payment method and what is left do not take, and writes nothing', async () => {
        const entered = await created()

        const outcomes = [
          await recordedBy(
            entered.id,
            everySalon,
            paymentOf(TOTAL, UNKNOWN_ID),
          ),
          await recordedBy(entered.id, everySalon, paymentOf(TOTAL + 1)),
        ]

        expect(outcomes).toEqual([
          {
            type: 'invalid',
            issues: [
              {
                field: 'paymentMethodId',
                rule: 'not_found',
                message: NOT_A_PAYMENT_METHOD,
              },
            ],
          },
          {
            type: 'invalid',
            issues: [
              {
                field: 'amount',
                rule: 'too_big',
                message: `Must not be more than what is left to pay (${TOTAL})`,
              },
            ],
          },
        ])
        expect(await paymentsOf(entered.id)).toEqual([])
      })

      it('says that the number is taken, and records the payment under another one', async () => {
        const entered = await created()
        const other = await created()
        await recordedBy(other.id, everySalon, paymentOf(), 'PT-0000-0001')

        const outcome = await recordedBy(
          entered.id,
          everySalon,
          paymentOf(),
          'PT-0000-0001',
        )
        const again = await recordedBy(
          entered.id,
          everySalon,
          paymentOf(),
          'PT-0000-0002',
        )

        expect(outcome).toEqual({ type: 'transactionNumberTaken' })
        expect(again.type).toBe('recorded')
        expect(await paymentsOf(entered.id)).toMatchObject([
          { transactionNumber: 'PT-0000-0002' },
        ])
      })

      it('leaves the sale untouched when the number is taken', async () => {
        const entered = await created()
        await insertPayment(await insertSale(), {
          transactionNumber: 'PT-0000-0009',
        })
        const before = await storedSale(entered.id)

        const outcome = await recordedBy(
          entered.id,
          everySalon,
          paymentOf(),
          'PT-0000-0009',
        )

        expect(outcome).toEqual({ type: 'transactionNumberTaken' })
        expect(await storedSale(entered.id)).toEqual(before)
        expect(await paymentsOf(entered.id)).toEqual([])
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new PaymentRepository(connection.database).record(
          saleIdSchema.parse(UNKNOWN_ID),
          everySalon,
          paymentOf(),
          { transactionNumber: 'PT-0000-0001' },
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to record payment' },
        })
      })
    })

    describe('refund', () => {
      it('refunds a payment of a sale within the reach, and tells the sale', async () => {
        const entered = await created()
        const recorded = await paid(entered.id)

        const outcome = await refundedBy(recorded.id, salonOnly(salonId), 600)

        expect(outcome).toMatchObject({
          type: 'refunded',
          payment: {
            id: recorded.id,
            status: 'partial_refund',
            refundAmount: 600,
            refundReason: null,
          },
        })
        expect((await storedSale(entered.id)).paymentStatus).toBe(
          'partial_refund',
        )
      })

      it('finds no payment outside the reach, and says why a payment is not refunded', async () => {
        const entered = await created()
        const recorded = await paid(entered.id, { amount: 1000 })
        const failedId = await insertPayment(entered.id, { status: 'failed' })

        const outcomes = [
          await refundedBy(recorded.id, salonOnly(await salon()), 1000),
          await refundedBy(UNKNOWN_ID, everySalon),
          await refundedBy(failedId, everySalon),
          await refundedBy(recorded.id, everySalon, 1001),
        ]

        expect(outcomes).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
          { type: 'notCompleted' },
          {
            type: 'invalid',
            issues: [
              {
                field: 'refundAmount',
                rule: 'too_big',
                message:
                  'Must not be more than the amount of the payment (1000)',
              },
            ],
          },
        ])
        expect((await storedPayment(recorded.id)).status).toBe('completed')
        expect((await storedSale(entered.id)).paymentStatus).toBe('processing')
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new PaymentRepository(connection.database).refund(
          paymentIdSchema.parse(UNKNOWN_ID),
          everySalon,
          { refundAmount: 1, refundReason: null },
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to refund payment' },
        })
      })
    })
  })

  describe('what the database holds a payment to', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })
    const CHECK = '23514'
    const UNIQUE = '23505'
    const A_TIME = '2026-11-20 12:42:10+09'

    it.each(PAYMENT_STATUSES)(
      'takes a payment that is %s with what its status asks for',
      async (status) => {
        const id = await insertSale()

        const paymentId = await insertPayment(id, { status })

        expect((await storedPayment(paymentId)).status).toBe(status)
      },
    )

    it.each<[string, Partial<NewPayment>, string]>([
      [
        'an amount of nothing',
        { amount: 0 },
        'payment_transactions_amount_positive',
      ],
      [
        'a negative amount',
        { amount: -1 },
        'payment_transactions_amount_positive',
      ],
      [
        'a completed payment without the time it was received at',
        { processedAt: null },
        'payment_transactions_received_has_time',
      ],
      [
        'a refunded payment without the time it was received at',
        { status: 'refunded', processedAt: null },
        'payment_transactions_received_has_time',
      ],
      [
        'a pending payment with a time it was received at',
        { status: 'pending', processedAt: A_TIME },
        'payment_transactions_received_has_time',
      ],
      [
        'a failed payment with a time it was received at',
        { status: 'failed', processedAt: A_TIME },
        'payment_transactions_received_has_time',
      ],
      [
        'a failed payment without the time it failed at',
        { status: 'failed', failedAt: null },
        'payment_transactions_failure_of_failed',
      ],
      [
        'a completed payment with a time it failed at',
        { failedAt: A_TIME },
        'payment_transactions_failure_of_failed',
      ],
      [
        'an error code of a payment that did not fail',
        { errorCode: 'card_declined' },
        'payment_transactions_failure_of_failed',
      ],
      [
        'an error message of a payment that did not fail',
        { status: 'pending', errorMessage: 'The card was declined' },
        'payment_transactions_failure_of_failed',
      ],
      [
        'a refunded payment without the time of the refund',
        { status: 'refunded', refundedAt: null },
        'payment_transactions_refund_of_refunded',
      ],
      [
        'a refunded payment without the amount of the refund',
        { status: 'refunded', refundAmount: null },
        'payment_transactions_refund_of_refunded',
      ],
      [
        'a completed payment with the time of a refund',
        { refundedAt: A_TIME },
        'payment_transactions_refund_of_refunded',
      ],
      [
        'a completed payment with the amount of a refund',
        { refundAmount: 100 },
        'payment_transactions_refund_of_refunded',
      ],
      [
        'a reason for the refund of a payment that was not refunded',
        { refundReason: '商品の返品' },
        'payment_transactions_refund_of_refunded',
      ],
      [
        'a refund in full of less than the amount',
        { status: 'refunded', refundAmount: 6599 },
        'payment_transactions_refund_amount',
      ],
      [
        'a refund in full of more than the amount',
        { status: 'refunded', refundAmount: 6601 },
        'payment_transactions_refund_amount',
      ],
      [
        'a refund in part of the whole amount',
        { status: 'partial_refund', refundAmount: 6600 },
        'payment_transactions_refund_amount',
      ],
      [
        'a refund in part of nothing',
        { status: 'partial_refund', refundAmount: 0 },
        'payment_transactions_refund_amount',
      ],
      [
        'a refund in part of more than the amount',
        { status: 'partial_refund', refundAmount: 6601 },
        'payment_transactions_refund_amount',
      ],
      [
        'letters for the digits of a card',
        { cardLastFour: '42a2' },
        'payment_transactions_card_last_four_digits',
      ],
      [
        'three digits of a card',
        { cardLastFour: '424' },
        'payment_transactions_card_last_four_digits',
      ],
      [
        'full-width digits of a card',
        { cardLastFour: '４２４２' },
        'payment_transactions_card_last_four_digits',
      ],
    ])('refuses %s', async (_case, overrides, constraint) => {
      const id = await insertSale()

      await expect(insertPayment(id, overrides)).rejects.toMatchObject(
        violationOf(CHECK, constraint),
      )
      expect(await paymentsOf(id)).toEqual([])
    })

    it('takes a refunded payment with a reason, and the digits of a card', async () => {
      const id = await insertSale()

      const paymentId = await insertPayment(id, {
        status: 'partial_refund',
        refundAmount: 6599,
        refundReason: '商品の返品',
        cardLastFour: '0000',
      })

      expect(await storedPayment(paymentId)).toMatchObject({
        refundAmount: 6599,
        refundReason: '商品の返品',
        cardLastFour: '0000',
      })
    })

    it('refuses a second payment under one number', async () => {
      const id = await insertSale()
      await insertPayment(id, { transactionNumber: 'PT-0000-0001' })

      await expect(
        insertPayment(await insertSale(), {
          transactionNumber: 'PT-0000-0001',
        }),
      ).rejects.toMatchObject(
        violationOf(UNIQUE, 'payment_transactions_transaction_number_unique'),
      )
    })
  })
})
