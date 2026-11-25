import {
  bookingServices,
  bookings,
  paymentMethods,
  paymentTransactions,
  sales,
  salesDetails,
  salons,
  services,
  type staff,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  type RequestedCalculation,
  salonIdSchema,
  serviceIdSchema,
} from '@beauty-salon-backend/domain'
import { SaleRepository } from '@beauty-salon-backend/infrastructure'
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
} from '../../../__tests__/_shared/auth-helpers'
import {
  type NewPayment,
  paymentColumns,
} from '../../../__tests__/_shared/payment-helpers'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  forbidden,
  getTestDb,
  ISO_TIMESTAMP,
  invalidToken,
  notAllowed,
  notFound,
  request,
  routeNotFound,
  tokenExpired,
} from '../../../__tests__/_shared/test-helpers'

const SALES = '/api/v1/sales'
const PAYMENTS = '/api/v1/payments'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const MAX_INTEGER = 2_147_483_647

/** What the sale of the receipts charges: a cut for 6,000 yen and 600 of tax. */
const TOTAL = 6600

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const INVALID_SALE_ID = 'Invalid sale ID'
const INVALID_CALCULATION = 'Invalid calculation'
const SALE_IS_VOID = 'The sale is void; a void sale has no receipt'
const NOT_PAID_IN_FULL =
  'The sale is not paid in full; a receipt is made once what was received comes to its total'
const NOTHING_TO_CALCULATE =
  'Must name a service when the booking has no service line'

/**
 * What the calculation of the tests comes to: the booking's cut, copied at
 * 5,000 yen less 500 and without tax, its treatment of 3,300 yen with tax,
 * and two treatments added at the 1,505 yen they cost now, without tax.
 * The tax is 10 % of 4,500 + 3,010 = 7,510 yen, once: 751 yen. Rounded for
 * every line it would be 450 + 150 + 150 = 750.
 */
const BREAKDOWN = {
  subtotal: 11310,
  discountAmount: 500,
  taxAmount: 751,
  totalAmount: 11561,
}

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

describe('Sale receipts and calculations API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests: in Tokyo, at the standard rate of 10 %. */
  let salonId: string
  let customerId: string
  /** A staff member of the salon. */
  let staffId: string
  /** A cut of the salon: 6,000 yen without tax. */
  let cutId: string
  /** A treatment of the salon: 1,505 yen without tax, 150.5 yen of tax on its own. */
  let treatmentId: string
  /** The till of the salon: cash, in use, without limits. */
  let cashId: string

  type NewSalon = typeof salons.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type NewService = typeof services.$inferInsert
  type NewBooking = typeof bookings.$inferInsert
  type NewLine = typeof bookingServices.$inferInsert
  type NewSale = typeof sales.$inferInsert
  type NewPaymentMethod = typeof paymentMethods.$inferInsert

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  const salon = (overrides: Partial<NewSalon> = {}): Promise<string> =>
    insertSalon(db, { timezone: 'Asia/Tokyo', ...overrides })

  /** A service of a salon as a row; returns its ID. */
  const insertService = async (
    overrides: Partial<NewService> = {},
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId: ofSalon,
        name: 'カット',
        duration: 60,
        price: 6000,
        taxIncluded: false,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
        ...overrides,
      })
      .returning({ id: services.id })
    if (service === undefined) {
      throw new Error('No service was inserted')
    }
    return service.id
  }

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

  /** The lines of the booking of the tests, with the amounts they copied. */
  const bookedLines = (): Partial<NewLine>[] => [
    {
      serviceId: cutId,
      startTime: at('01:00'),
      endTime: at('02:00'),
      duration: 60,
      price: 5000,
      discountAmount: 500,
      finalPrice: 4500,
      taxIncluded: false,
    },
    {
      serviceId: treatmentId,
      startTime: at('02:00'),
      endTime: at('02:30'),
      duration: 30,
      price: 3300,
      discountAmount: 0,
      finalPrice: 3300,
      taxIncluded: true,
    },
  ]

  /**
   * A booking of the customer at a salon, written directly with its lines;
   * the lines of the tests unless others are given. Returns its ID.
   */
  const insertBooking = async ({
    booking = {},
    lines = bookedLines(),
  }: {
    booking?: Partial<NewBooking>
    lines?: Partial<NewLine>[]
  } = {}): Promise<string> => {
    const [row] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-TEST-${nextRow()}`,
        salonId,
        customerId,
        staffId,
        bookingDate: '2026-11-20',
        startTime: at('01:00'),
        endTime: at('02:30'),
        duration: 90,
        subtotal: 8300,
        discountAmount: 500,
        taxAmount: 450,
        totalAmount: 8250,
        ...booking,
      })
      .returning({ id: bookings.id })
    if (row === undefined) {
      throw new Error('No booking was inserted')
    }
    for (const [sortOrder, line] of lines.entries()) {
      await db.insert(bookingServices).values(lineRow(row.id, sortOrder, line))
    }
    return row.id
  }

  /** A row of `booking_services` that keeps every constraint: a cut of an hour by the staff member. */
  const lineRow = (
    bookingId: string,
    sortOrder: number,
    overrides: Partial<NewLine>,
  ): NewLine => ({
    bookingId,
    serviceId: cutId,
    staffId,
    startTime: at('01:00'),
    endTime: at('02:00'),
    duration: 60,
    price: 6000,
    finalPrice: 6000,
    taxIncluded: false,
    sortOrder,
    ...overrides,
  })

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
  ): Promise<string> => {
    const [row] = await db
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

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await salon()
    customerId = await insertCustomer(db)
    staffId = await insertStaff(db, salonId)
    cutId = await insertService()
    treatmentId = await insertService({
      name: 'トリートメント',
      duration: 30,
      price: 1505,
    })
    cashId = await insertMethod()
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Enters a sale of a cut for the customer as the admin; anything but 201 fails the test. */
  const created = async () => {
    const response = await authorized(request(app).post(SALES), asAdmin).send({
      salonId,
      customerId,
      staffId,
      bookingId: null,
      saleTime: at('03:40'),
      pointsUsed: null,
      pointsEarned: null,
      notes: null,
      details: [
        {
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
        },
      ],
    })
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Records a payment of a sale in cash as the admin; anything but 200 fails the test. */
  const paid = async (
    saleId: string,
    amount: number = TOTAL,
    paymentMethodId: string = cashId,
  ) => {
    const response = await authorized(
      request(app).post(`${SALES}/${saleId}/process`),
      asAdmin,
    ).send({ paymentMethodId, amount, cardLastFour: null, cardBrand: null })
    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Reads a sale as the admin. */
  const read = (id: string) =>
    authorized(request(app).get(`${SALES}/${id}`), asAdmin)

  /** Makes the receipt of a sale; as the admin unless said otherwise. */
  const receipt = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${SALES}/${id}/receipt`), as)

  /** A request that keeps every rule: two treatments, without a booking. */
  const calculation = (overrides: Record<string, unknown> = {}) => ({
    salonId,
    bookingId: null,
    services: [treatmentId, treatmentId],
    ...overrides,
  })

  /** Calculates a sale; as the admin unless said otherwise. */
  const calculate = (body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(`${SALES}/calculate`), as).send(body)

  /** What a calculation comes to; anything but 200 fails the test. */
  const calculated = async (body: object, as: string = asAdmin) => {
    const response = await calculate(body, as)
    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Everything a receipt or a calculation could have written. */
  const everything = async () => ({
    sales: await db.select().from(sales).orderBy(asc(sales.id)),
    details: await db.select().from(salesDetails).orderBy(asc(salesDetails.id)),
    payments: await db
      .select()
      .from(paymentTransactions)
      .orderBy(asc(paymentTransactions.id)),
    bookings: await db.select().from(bookings).orderBy(asc(bookings.id)),
    lines: await db
      .select()
      .from(bookingServices)
      .orderBy(asc(bookingServices.id)),
    services: await db.select().from(services).orderBy(asc(services.id)),
    methods: await db
      .select()
      .from(paymentMethods)
      .orderBy(asc(paymentMethods.id)),
    salons: await db.select().from(salons).orderBy(asc(salons.id)),
  })

  /** Checks that a time of a response is of the milliseconds between two moments. */
  const expectBetween = (
    time: unknown,
    before: number,
    after: number,
  ): void => {
    expect(time).toEqual(expect.stringMatching(ISO_TIMESTAMP))
    const moment = Date.parse(String(time))
    expect(moment).toBeGreaterThanOrEqual(before)
    expect(moment).toBeLessThanOrEqual(after)
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

  describe('GET /api/v1/sales/:id/receipt', () => {
    it('makes the receipt of a sale that was paid in full: the sale under its number, at the moment it is made; and writes nothing', async () => {
      const { id } = await created()
      await paid(id)
      const sale = (await read(id)).body.data
      const stored = await everything()
      const before = Date.now()

      const response = await receipt(id)
      const after = Date.now()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          receiptNumber: sale.saleNumber,
          sale,
          issuedAt: expect.any(String),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${SALES}/${id}/receipt`, sale: `${SALES}/${id}` },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual([
        'issuedAt',
        'receiptNumber',
        'sale',
      ])
      expect(sale).toMatchObject({
        paymentStatus: 'completed',
        payments: [{ amount: TOTAL, status: 'completed' }],
      })
      expectBetween(response.body.data.issuedAt, before, after)
      expect(await everything()).toEqual(stored)
    })

    it('makes the receipt anew whenever it is asked for, under the same number and at the moment of each', async () => {
      const { id, saleNumber } = await created()
      await paid(id)

      const first = await receipt(id)
      await pause(5)
      const second = await receipt(id)

      expect([first, second].map(statusAndCode)).toEqual(['200', '200'])
      expect(first.body.data.receiptNumber).toBe(saleNumber)
      expect(second.body.data.receiptNumber).toBe(saleNumber)
      expect(Date.parse(second.body.data.issuedAt)).toBeGreaterThan(
        Date.parse(first.body.data.issuedAt),
      )
    })

    it('makes the receipt of a sale that was paid in parts, by more than one payment method', async () => {
      const { id } = await created()
      const eMoneyId = await insertMethod({
        method: 'e_money',
        displayName: '電子マネー',
      })
      await paid(id, 6000)
      await paid(id, 600, eMoneyId)

      const response = await receipt(id)

      expect(response.status).toBe(200)
      expect(response.body.data.sale).toMatchObject({
        paymentStatus: 'completed',
        payments: [
          { amount: 6000, paymentMethodId: cashId },
          { amount: 600, paymentMethodId: eMoneyId },
        ],
      })
    })

    it('makes the receipt of a sale of nothing, which takes no payment', async () => {
      const id = await insertSale({ subtotal: 0, taxAmount: 0, totalAmount: 0 })

      const response = await receipt(id)

      expect(response.status).toBe(200)
      expect(response.body.data.sale).toMatchObject({
        totalAmount: 0,
        payments: [],
      })
    })

    it('makes the receipt of a sale that was refunded after it was paid in full, showing the refund', async () => {
      const { id } = await created()
      const payment = await paid(id)
      const refunded = await authorized(
        request(app).post(`${PAYMENTS}/${payment.id}/refund`),
        asAdmin,
      ).send({ refundAmount: 1000, refundReason: '仕上がり不良' })

      const response = await receipt(id)

      expect(refunded.status).toBe(200)
      expect(response.status).toBe(200)
      expect(response.body.data.sale).toMatchObject({
        paymentStatus: 'partial_refund',
        payments: [
          {
            status: 'partial_refund',
            refundAmount: 1000,
            refundReason: '仕上がり不良',
          },
        ],
      })
    })

    it.each<[string, Partial<NewPayment>[]]>([
      ['received nothing', []],
      ['received a yen less than its total', [{ amount: TOTAL - 1 }]],
      [
        'received its total in parts but for a yen',
        [{ amount: 6000 }, { amount: 599 }],
      ],
      ['has a payment that failed', [{ status: 'failed' }]],
      ['has a payment that is pending', [{ status: 'pending' }]],
      ['has a payment that is being processed', [{ status: 'processing' }]],
    ])('refuses the receipt of a sale that %s', async (_case, payments) => {
      const id = await insertSale()
      for (const payment of payments) {
        await insertPayment(id, payment)
      }

      const response = await receipt(id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_PAID_IN_FULL)
    })

    it('refuses the receipt of a void sale, whether it was paid or not', async () => {
      const unpaid = await insertSale(voided)
      const refunded = await insertSale(voided)
      await insertPayment(refunded, { status: 'refunded' })

      const responses = [await receipt(unpaid), await receipt(refunded)]

      for (const response of responses) {
        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(SALE_IS_VOID)
      }
    })

    it('makes the receipt of a sale given by its ID in capitals, linked by its ID as it is', async () => {
      const { id } = await created()
      await paid(id)

      const response = await receipt(id.toUpperCase())

      expect(response.status).toBe(200)
      expect(response.body.data.sale.id).toBe(id)
      expect(response.body.links).toEqual({
        self: `${SALES}/${id}/receipt`,
        sale: `${SALES}/${id}`,
      })
    })

    it('links the receipt without the query string of the request', async () => {
      const { id } = await created()
      await paid(id)

      const response = await authorized(
        request(app).get(`${SALES}/${id}/receipt?format=pdf`),
        asAdmin,
      )

      expect(response.status).toBe(200)
      expect(response.body.links.self).toBe(`${SALES}/${id}/receipt`)
    })

    it.each([
      ['a text that is no ID', 'not-an-id'],
      ['a sale number', 'SL-7Z3K-0QXM'],
      ['an ID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
    ])('refuses %s', async (_case, id) => {
      const response = await receipt(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SALE_ID)
      expect(brokenRules(response)).toHaveLength(1)
      expect(brokenRules(response)[0]).toMatch(/^id:/)
    })

    it('answers 404 for an ID that no sale has, be it the ID of a booking or a payment', async () => {
      const { id } = await created()
      const payment = await paid(id)
      const bookingId = await insertBooking()

      const unknown = await receipt(UNKNOWN_ID)
      const ofBooking = await receipt(bookingId)
      const ofPayment = await receipt(payment.id)

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Sale ${UNKNOWN_ID} was not found`)
      expectProblem(ofBooking, notFound)
      expectProblem(ofPayment, notFound)
    })

    it.each<[string, 'post' | 'put' | 'patch' | 'delete']>([
      ['POST', 'post'],
      ['PUT', 'put'],
      ['PATCH', 'patch'],
      ['DELETE', 'delete'],
    ])(
      'answers %s on a receipt with 404 and writes nothing',
      async (_case, method) => {
        const { id } = await created()
        await paid(id)
        const stored = await everything()

        const response = await authorized(
          request(app)[method](`${SALES}/${id}/receipt`),
          asAdmin,
        ).send({})

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(stored)
      },
    )

    it('answers the receipts of a sale, and a part of a receipt, with 404', async () => {
      const { id } = await created()
      await paid(id)

      const responses = [
        await authorized(request(app).get(`${SALES}/${id}/receipts`), asAdmin),
        await authorized(
          request(app).get(`${SALES}/${id}/receipt/lines`),
          asAdmin,
        ),
      ]

      expect(responses.map(statusAndCode)).toEqual(['404 3001', '404 3001'])
    })

    it('answers at once while a payment of the sale is under way, with the sale as it was before', async () => {
      const id = await insertSale()
      await insertPayment(id)

      const response = await db.transaction(async (tx) => {
        await tx.select().from(sales).where(eq(sales.id, id)).for('update')
        await tx
          .update(paymentTransactions)
          .set(paymentColumns({ status: 'refunded' }))
          .where(eq(paymentTransactions.saleId, id))
        await tx.update(sales).set(voided).where(eq(sales.id, id))
        // Awaited inside: a receipt that waited for the rows would never come.
        return receipt(id)
      })
      const afterwards = await receipt(id)

      expect(response.status).toBe(200)
      expect(response.body.data.sale).toMatchObject({
        isVoid: false,
        payments: [{ status: 'completed', refundAmount: null }],
      })
      expectProblem(afterwards, notAllowed)
      expect(afterwards.body.detail).toBe(SALE_IS_VOID)
    })

    it('checks a receipt in order: the token, the account, the ID, the sale, the void, the payments', async () => {
      const customer = (await signedInUser(app, db)).authorization
      const voidSale = await insertSale(voided)
      const unpaid = await insertSale()
      const { id } = await created()
      await paid(id)

      const responses = [
        await receipt('not-an-id', null),
        await receipt('not-an-id', customer),
        await receipt('not-an-id'),
        await receipt(UNKNOWN_ID),
        await receipt(voidSale),
        await receipt(unpaid),
        await receipt(id),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '404 3001',
        '409 3003',
        '409 3003',
        '200',
      ])
      expect(responses[4]?.body.detail).toBe(SALE_IS_VOID)
      expect(responses[5]?.body.detail).toBe(NOT_PAID_IN_FULL)
    })
  })

  describe('POST /api/v1/sales/calculate', () => {
    it('tells what a booking and the services added to it come to, with the tax added once to their sum, and which kinds of payment method take it; and writes nothing', async () => {
      const bookingId = await insertBooking()
      const stored = await everything()

      const response = await calculate(calculation({ bookingId }))

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          salonId,
          bookingId,
          breakdown: BREAKDOWN,
          recommendedMethods: ['cash'],
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${SALES}/calculate`, list: SALES },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual([
        'bookingId',
        'breakdown',
        'recommendedMethods',
        'salonId',
      ])
      expect(await everything()).toEqual(stored)
    })

    it('counts the lines of the booking at the amounts they copied, and an added service at the price the menu has now', async () => {
      const bookingId = await insertBooking()
      await db
        .update(services)
        .set({ price: 9000 })
        .where(eq(services.id, cutId))
      await db
        .update(services)
        .set({ price: 2000, discountPrice: 1800 })
        .where(eq(services.id, treatmentId))

      const data = await calculated(calculation({ bookingId }))

      // 5,000 + 3,300 + 2 × 2,000; 500 + 2 × 200 off; 10 % of 4,500 + 3,600.
      expect(data.breakdown).toEqual({
        subtotal: 12300,
        discountAmount: 900,
        taxAmount: 810,
        totalAmount: 12210,
      })
    })

    it('adds the tax once to the sum and drops the fraction of a yen then, not for every line', async () => {
      const once = await calculated(calculation({ services: [treatmentId] }))
      const twice = await calculated(calculation())

      expect(once.breakdown).toEqual({
        subtotal: 1505,
        discountAmount: 0,
        taxAmount: 150,
        totalAmount: 1655,
      })
      expect(twice.breakdown).toEqual({
        subtotal: 3010,
        discountAmount: 0,
        taxAmount: 301,
        totalAmount: 3311,
      })
    })

    it('adds the tax at the rate the salon has now', async () => {
      const bookingId = await insertBooking()
      await db
        .update(salons)
        .set({ taxRate: '8.00' })
        .where(eq(salons.id, salonId))

      const data = await calculated(calculation({ bookingId }))

      // 8 % of 7,510 is 600.8 yen.
      expect(data.breakdown).toEqual({
        subtotal: 11310,
        discountAmount: 500,
        taxAmount: 600,
        totalAmount: 11410,
      })
    })

    it('calculates a booking with nothing added from its lines alone, and a visit without a booking from its services alone', async () => {
      const bookingId = await insertBooking()

      const booked = await calculated(calculation({ bookingId, services: [] }))
      const walkIn = await calculated(calculation())

      expect(booked).toMatchObject({
        bookingId,
        breakdown: {
          subtotal: 8300,
          discountAmount: 500,
          taxAmount: 450,
          totalAmount: 8250,
        },
      })
      expect(walkIn).toMatchObject({
        bookingId: null,
        breakdown: { subtotal: 3010 },
      })
    })

    it('calculates a booking whatever its status, and a service that the menu no longer offers', async () => {
      const bookingId = await insertBooking({
        booking: { status: 'cancelled', cancelledAt: at('00:30') },
      })
      await db
        .update(services)
        .set({ isActive: false })
        .where(eq(services.id, treatmentId))

      const data = await calculated(calculation({ bookingId }))

      expect(data.breakdown).toEqual(BREAKDOWN)
    })

    it('recommends the kinds of payment method of the salon that are in use and take the total, in their order, each once', async () => {
      const elsewhere = await salon()
      await db
        .update(paymentMethods)
        .set({ sortOrder: 1 })
        .where(eq(paymentMethods.id, cashId))
      await insertMethod({ method: 'e_money', displayName: '電子マネー' })
      await insertMethod({
        method: 'credit_card',
        displayName: 'カード（一万円まで）',
        maximumAmount: 10000,
        sortOrder: 2,
      })
      await insertMethod({
        method: 'qr_payment',
        displayName: 'QR',
        isActive: false,
        sortOrder: 3,
      })
      await insertMethod({
        method: 'credit_card',
        displayName: 'カード',
        minimumAmount: 11561,
        sortOrder: 4,
      })
      await insertMethod({ method: 'cash', displayName: 'レジ2', sortOrder: 5 })
      await insertMethod(
        { method: 'bank_transfer', displayName: '振込' },
        elsewhere,
      )
      const bookingId = await insertBooking()

      const data = await calculated(calculation({ bookingId }))

      expect(data.recommendedMethods).toEqual([
        'e_money',
        'cash',
        'credit_card',
      ])
    })

    it('recommends no payment method for a total of 0, and none when no payment method is in use', async () => {
      const freeId = await insertService({ name: '相談', price: 0 })

      const free = await calculated(calculation({ services: [freeId] }))
      await db
        .update(paymentMethods)
        .set({ isActive: false })
        .where(eq(paymentMethods.id, cashId))
      const noMethod = await calculated(calculation())

      expect(free).toMatchObject({
        breakdown: { subtotal: 0, totalAmount: 0 },
        recommendedMethods: [],
      })
      expect(noMethod.recommendedMethods).toEqual([])
    })

    it('refuses what the request refers to that is not of the salon, all of it at once and each service in its place', async () => {
      const elsewhere = await salon()
      const bookingElsewhere = await insertBooking({
        booking: { salonId: elsewhere },
        lines: [],
      })
      const serviceElsewhere = await insertService({}, elsewhere)
      const deletedService = await insertService({
        deletedAt: '2026-11-01T00:00:00.000Z',
      })

      const response = await calculate(
        calculation({
          bookingId: bookingElsewhere,
          services: [
            treatmentId,
            serviceElsewhere,
            deletedService,
            UNKNOWN_ID,
            cutId,
          ],
        }),
      )

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_CALCULATION)
      expect(response.body.errors).toEqual([
        issue('bookingId', 'not_found', 'Must name a booking of the salon'),
        issue('services.1', 'not_found', 'Must name a service of the salon'),
        issue('services.2', 'not_found', 'Must name a service of the salon'),
        issue('services.3', 'not_found', 'Must name a service of the salon'),
      ])
    })

    it.each([
      ['a salon that is not there', async () => UNKNOWN_ID],
      [
        'a salon that was deleted',
        () => salon({ deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ])(
      'refuses %s and tells nothing else, since nothing else could be of it',
      async (_case, salonOf) => {
        const bookingId = await insertBooking()

        const response = await calculate(
          calculation({ salonId: await salonOf(), bookingId }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('salonId', 'not_found', 'Must name a salon'),
        ])
      },
    )

    it('refuses a booking without service lines and no service: there is nothing to calculate', async () => {
      const bookingId = await insertBooking({ lines: [] })

      const responses = [
        await calculate(calculation({ bookingId, services: [] })),
        await calculate(calculation({ services: [] })),
      ]

      for (const response of responses) {
        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('services', 'too_small', NOTHING_TO_CALCULATE),
        ])
      }
    })

    it('refuses a sale that would come to more than an integer column holds, and takes one that comes to as much as it holds', async () => {
      const dearest = await insertService({
        name: '年間パス',
        price: MAX_INTEGER,
        taxIncluded: true,
      })
      const bookingId = await insertBooking()

      const most = await calculate(calculation({ services: [dearest] }))
      const more = await calculate(
        calculation({ bookingId, services: [dearest] }),
      )

      expect(most.status).toBe(200)
      expect(most.body.data.breakdown.totalAmount).toBe(MAX_INTEGER)
      expectProblem(more, badRequest)
      expect(more.body.errors).toEqual([
        issue(
          'services',
          'too_big',
          `The amounts of a sale must not exceed ${MAX_INTEGER}`,
        ),
      ])
    })

    it('takes as many services as a sale has lines, and no more', async () => {
      const hundred = Array.from({ length: 100 }, () => treatmentId)

      const most = await calculate(calculation({ services: hundred }))
      const more = await calculate(
        calculation({ services: [...hundred, treatmentId] }),
      )

      expect(most.status).toBe(200)
      expect(most.body.data.breakdown.subtotal).toBe(150500)
      expectProblem(more, badRequest)
      expect(brokenRules(more)).toEqual(['services:too_big'])
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      [
        'a request without the salon',
        { salonId: undefined },
        ['salonId:invalid_type'],
      ],
      [
        'a request without the booking',
        { bookingId: undefined },
        ['bookingId:invalid_type'],
      ],
      [
        'a request without the services',
        { services: undefined },
        ['services:invalid_type'],
      ],
      [
        'a salon that is no ID',
        { salonId: 'salon-1' },
        ['salonId:invalid_format'],
      ],
      [
        'a booking that is no ID',
        { bookingId: 'BK-7Z3K-0QXM' },
        ['bookingId:invalid_format'],
      ],
      [
        'a service that is no ID, among others',
        { services: [UNKNOWN_ID, 'cut'] },
        ['services.1:invalid_format'],
      ],
      [
        'a service for the list',
        { services: UNKNOWN_ID },
        ['services:invalid_type'],
      ],
      [
        'a discount code: there are no discount codes',
        { discountCode: 'WELCOME10' },
        ['discountCode:unrecognized_keys'],
      ],
      [
        'points to use',
        { pointsToUse: 100 },
        ['pointsToUse:unrecognized_keys'],
      ],
      [
        'a customer',
        { customerId: UNKNOWN_ID },
        ['customerId:unrecognized_keys'],
      ],
    ])(
      'refuses %s, without looking anything up',
      async (_case, change, rules) => {
        const response = await calculate({ ...calculation(), ...change })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_CALCULATION)
        expect(brokenRules(response)).toEqual(rules)
      },
    )

    it('refuses a request that is no object, and a body it cannot read before it looks at the token', async () => {
      const send = (body: string, authorization: string | null = asAdmin) =>
        authorized(request(app).post(`${SALES}/calculate`), authorization)
          .set('Content-Type', 'application/json')
          .send(body)

      const list = await send('[]')
      const responses = [
        list,
        await send('null'),
        await send('"calculate"'),
        await send('{"salonId": "0193a5b8"', null),
        await authorized(request(app).post(`${SALES}/calculate`), null)
          .set('Content-Type', 'text/plain')
          .send('a cut and two treatments'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2001',
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      expect(brokenRules(list)).toEqual([':invalid_type'])
    })

    it('links the calculation without the query string of the request', async () => {
      const response = await authorized(
        request(app).post(`${SALES}/calculate?salonId=${UNKNOWN_ID}`),
        asAdmin,
      ).send(calculation())

      expect(response.status).toBe(200)
      expect(response.body.data.salonId).toBe(salonId)
      expect(response.body.links).toEqual({
        self: `${SALES}/calculate`,
        list: SALES,
      })
    })

    it('answers a read of the address of a calculation as the read of a sale whose ID is no ID, and other methods with 404', async () => {
      const stored = await everything()

      const read = await authorized(
        request(app).get(`${SALES}/calculate`),
        asAdmin,
      )
      const others = [
        await authorized(request(app).put(`${SALES}/calculate`), asAdmin).send(
          calculation(),
        ),
        await authorized(
          request(app).delete(`${SALES}/calculate`),
          asAdmin,
        ).send(calculation()),
        await authorized(
          request(app).post(`${SALES}/calculate/receipt`),
          asAdmin,
        ).send(calculation()),
      ]

      expectProblem(read, badRequest)
      expect(read.body.detail).toBe(INVALID_SALE_ID)
      expect(others.map(statusAndCode)).toEqual([
        '404 3001',
        '404 3001',
        '404 3001',
      ])
      expect(await everything()).toEqual(stored)
    })

    it('answers at once while the booking, a service and a payment method are being changed, with them as they were before', async () => {
      const bookingId = await insertBooking()

      const response = await db.transaction(async (tx) => {
        await tx
          .select()
          .from(bookings)
          .where(eq(bookings.id, bookingId))
          .for('update')
        await tx
          .update(bookingServices)
          .set({ price: 9000, discountAmount: 0, finalPrice: 9000 })
          .where(eq(bookingServices.bookingId, bookingId))
        await tx
          .update(services)
          .set({ price: 9999 })
          .where(eq(services.id, treatmentId))
        await tx
          .update(paymentMethods)
          .set({ isActive: false })
          .where(eq(paymentMethods.id, cashId))
        await tx
          .update(salons)
          .set({ taxRate: '8.00' })
          .where(eq(salons.id, salonId))
        // Awaited inside: a calculation that waited for the rows would never come.
        return calculate(calculation({ bookingId }))
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        salonId,
        bookingId,
        breakdown: BREAKDOWN,
        recommendedMethods: ['cash'],
      })
    })

    it('checks a calculation in order: the token, the account, the request, the salon of the account, what the request refers to, the lines', async () => {
      const customer = (await signedInUser(app, db)).authorization
      const elsewhere = await member('owner', salon)()
      const empty = await insertBooking({ lines: [] })
      const invalid = calculation({ services: ['cut'], bookingId: UNKNOWN_ID })
      const unknownBooking = calculation({
        bookingId: UNKNOWN_ID,
        services: [],
      })

      const ofAnotherSalon = await calculate(invalid, elsewhere)
      const ofUnknownBooking = await calculate(unknownBooking)
      const responses = [
        await calculate(invalid, null),
        await calculate(invalid, customer),
        ofAnotherSalon,
        await calculate(unknownBooking, elsewhere),
        ofUnknownBooking,
        await calculate(calculation({ bookingId: empty, services: [] })),
        await calculate(calculation({ bookingId: empty })),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '403 1005',
        '400 2001',
        '400 2001',
        '200',
      ])
      expect(brokenRules(ofAnotherSalon)).toEqual(['services.0:invalid_format'])
      expect(brokenRules(ofUnknownBooking)).toEqual(['bookingId:not_found'])
    })
  })

  describe('who makes receipts and calculations', () => {
    it.each(unauthenticated)(
      'answers %s with 401 before looking at anything else',
      async (_case, tokenOf, problem, challenge) => {
        const { id } = await created()
        await paid(id)
        const authorization = await tokenOf()

        const responses = [
          await receipt(id, authorization),
          await receipt('not-an-id', authorization),
          await calculate(calculation(), authorization),
          await calculate({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
      },
    )

    it.each(keepers)(
      'lets %s make the receipt of a sale of the salon and calculate a sale of it',
      async (_case, signInAs) => {
        const { id } = await created()
        await paid(id)
        const authorization = await signInAs()

        const made = await receipt(id, authorization)
        const counted = await calculate(calculation(), authorization)

        expect([made, counted].map(statusAndCode)).toEqual(['200', '200'])
        expect(made.body.data.sale.id).toBe(id)
        expect(counted.body.data.breakdown.totalAmount).toBe(3311)
      },
    )

    it.each(notKeepers)(
      'forbids %s receipts and calculations, before looking at the ID or the body',
      async (_case, signInAs) => {
        const { id } = await created()
        await paid(id)
        const authorization = await signInAs()

        const responses = [
          await receipt(id, authorization),
          await receipt('not-an-id', authorization),
          await calculate(calculation(), authorization),
          await calculate({}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
      },
    )

    it.each(membersOfAnotherSalon)(
      'answers %s that a sale of the salon is not there, and forbids them to calculate for it',
      async (_case, signInAs) => {
        const { id } = await created()
        await paid(id)
        const authorization = await signInAs()

        const made = await receipt(id, authorization)
        const counted = await calculate(calculation(), authorization)
        const unknown = await calculate(
          calculation({ salonId: UNKNOWN_ID }),
          authorization,
        )

        expectProblem(made, notFound)
        expectProblem(counted, forbidden)
        // A salon that does not exist is not theirs either.
        expectProblem(unknown, forbidden)
      },
    )

    it('lets a member of another salon make the receipts of that salon and calculate for it', async () => {
      const elsewhere = await salon()
      const authorization = await member('manager', async () => elsewhere)()
      const theirService = await insertService({}, elsewhere)
      const theirTill = await insertMethod({}, elsewhere)
      const id = await insertSale({ salonId: elsewhere })
      await insertPayment(id, { paymentMethodId: theirTill })

      const made = await receipt(id, authorization)
      const counted = await calculate(
        calculation({ salonId: elsewhere, services: [theirService] }),
        authorization,
      )

      expect([made, counted].map(statusAndCode)).toEqual(['200', '200'])
      expect(counted.body.data).toMatchObject({
        salonId: elsewhere,
        breakdown: { subtotal: 6000, taxAmount: 600, totalAmount: 6600 },
        recommendedMethods: ['cash'],
      })
    })
  })

  describe('SaleRepository', () => {
    /** A request as the use case hands it on: two treatments, without a booking. */
    const requestOf = ({
      salonOf = salonId,
      bookingOf = null,
      servicesOf = [treatmentId, treatmentId],
    }: {
      salonOf?: string
      bookingOf?: string | null
      servicesOf?: string[]
    } = {}): RequestedCalculation => ({
      salonId: salonIdSchema.parse(salonOf),
      bookingId: bookingOf === null ? null : bookingIdSchema.parse(bookingOf),
      services: servicesOf.map((id) => serviceIdSchema.parse(id)),
    })

    describe('findCalculationReferences', () => {
      it('reads the rate of the salon, the lines of the booking in their order, each service once, and the payment methods of the salon in their order', async () => {
        const bookingId = await insertBooking()
        const elsewhere = await salon()
        await insertMethod({
          method: 'credit_card',
          displayName: 'カード',
          minimumAmount: 1000,
          maximumAmount: 50000,
          isActive: false,
        })
        await db
          .update(paymentMethods)
          .set({ sortOrder: 1 })
          .where(eq(paymentMethods.id, cashId))
        await insertMethod({}, elsewhere)
        await insertService({}, elsewhere)

        const result = await new SaleRepository(db).findCalculationReferences(
          requestOf({
            bookingOf: bookingId,
            servicesOf: [treatmentId, cutId, treatmentId, UNKNOWN_ID],
          }),
        )

        expect(result).toEqual({
          type: 'success',
          data: {
            salon: { taxRate: '10.00' },
            booking: {
              lines: [
                {
                  price: 5000,
                  discountAmount: 500,
                  finalPrice: 4500,
                  taxIncluded: false,
                },
                {
                  price: 3300,
                  discountAmount: 0,
                  finalPrice: 3300,
                  taxIncluded: true,
                },
              ],
            },
            services: [
              {
                id: cutId,
                price: 6000,
                discountPrice: null,
                taxIncluded: false,
              },
              {
                id: treatmentId,
                price: 1505,
                discountPrice: null,
                taxIncluded: false,
              },
            ].toSorted((a, b) => (a.id < b.id ? -1 : 1)),
            paymentMethods: [
              {
                method: 'credit_card',
                isActive: false,
                minimumAmount: 1000,
                maximumAmount: 50000,
              },
              {
                method: 'cash',
                isActive: true,
                minimumAmount: null,
                maximumAmount: null,
              },
            ],
          },
        })
      })

      it('reads the services in the order of their IDs, whatever they cost', async () => {
        // The dearer service has the lower ID: by price, they would come the other way round.
        const dearer = await insertService({
          id: '0193a5b8-0000-7000-8000-000000000001',
          price: 9000,
        })
        const cheaper = await insertService({
          id: '0193a5b8-0000-7000-8000-000000000002',
          price: 1000,
        })

        const result = await new SaleRepository(db).findCalculationReferences(
          requestOf({ servicesOf: [cheaper, dearer] }),
        )

        expect(result).toMatchObject({
          type: 'success',
          data: {
            services: [
              { id: dearer, price: 9000 },
              { id: cheaper, price: 1000 },
            ],
          },
        })
      })

      it('reads nothing else of a salon that is not there or was deleted', async () => {
        const deleted = await salon({ deletedAt: '2026-11-01T00:00:00.000Z' })
        const bookingId = await insertBooking({ booking: { salonId: deleted } })
        await insertMethod({}, deleted)
        const theirService = await insertService({}, deleted)

        const results = [
          await new SaleRepository(db).findCalculationReferences(
            requestOf({ salonOf: UNKNOWN_ID }),
          ),
          await new SaleRepository(db).findCalculationReferences(
            requestOf({
              salonOf: deleted,
              bookingOf: bookingId,
              servicesOf: [theirService],
            }),
          ),
        ]

        for (const result of results) {
          expect(result).toEqual({
            type: 'success',
            data: {
              salon: null,
              booking: null,
              services: [],
              paymentMethods: [],
            },
          })
        }
      })

      it('reads no booking when the request names none, or one of another salon; and the lines of a booking without lines as none', async () => {
        const elsewhere = await salon()
        const theirs = await insertBooking({ booking: { salonId: elsewhere } })
        const empty = await insertBooking({ lines: [] })
        const repository = new SaleRepository(db)

        const named = async (bookingId: string | null) => {
          const result = await repository.findCalculationReferences(
            requestOf({ bookingOf: bookingId }),
          )
          return result.type === 'success' ? result.data.booking : 'failed'
        }

        expect(await named(null)).toBeNull()
        expect(await named(theirs)).toBeNull()
        expect(await named(UNKNOWN_ID)).toBeNull()
        expect(await named(empty)).toEqual({ lines: [] })
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new SaleRepository(
          connection.database,
        ).findCalculationReferences(requestOf())
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: 'Failed to read what a calculation refers to',
          },
        })
      })
    })
  })
})
