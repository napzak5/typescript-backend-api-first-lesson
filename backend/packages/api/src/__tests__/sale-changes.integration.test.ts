import {
  bookings,
  customers,
  paymentMethods,
  paymentTransactions,
  products,
  sales,
  salesDetails,
  salons,
  services,
  staff,
} from '@beauty-salon-backend/database'
import {
  bookingIdSchema,
  type DomainError,
  type LedgerReach,
  type RequestedSaleChange,
  saleIdSchema,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { SaleRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { and, asc, eq, not } from 'drizzle-orm'
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
const BOOKINGS = '/api/v1/bookings'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/**
 * A UUID that comes before every one the database makes up: a row that is
 * given it is the first of its table by ID, and not by where it lies.
 */
const FIRST_ID = '00000000-0000-4000-8000-000000000001'

const MAX_INTEGER = 2_147_483_647

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID_ID = 'Invalid sale ID'
const INVALID_UPDATE = 'Invalid sale update'
const INVALID_VOID = 'Invalid sale void'
const SALE_IS_VOID = 'The sale is void; a void sale is not changed'
const PAYMENT_HAS_BEGUN =
  'The lines of a sale are replaced only while its payment status is pending'
const BOOKING_IS_BILLED =
  'The booking has a sale that is not void; a booking is billed once'
const TIME_ZONE_UNKNOWN =
  'The time zone of the salon is not one that is known, so the day of the sale cannot be told; correct the time zone of the salon first'
const VOID_ALREADY = 'The sale is void already'
const NOT_REFUNDED =
  'The sale has a payment that was not refunded; refund it before the sale is voided'
const NOT_THE_BOOKING =
  'Must name a booking of the salon that is of the customer of the sale'
const NOT_THE_CUSTOMER = 'Must name the customer of the booking of the sale'
const NOBODYS_POINTS = 'Must be null for a sale without a customer'
const NOT_STAFF = 'Must name a staff member of the salon'

/** The properties of a SaleResponse. */
const PROPERTIES = [
  'bookingId',
  'createdAt',
  'customerId',
  'details',
  'discountAmount',
  'id',
  'isVoid',
  'notes',
  'paymentStatus',
  'payments',
  'pointsEarned',
  'pointsUsed',
  'saleDate',
  'saleNumber',
  'saleTime',
  'salonId',
  'staffId',
  'subtotal',
  'taxAmount',
  'totalAmount',
  'updatedAt',
  'voidReason',
  'voidedAt',
]

/** The statuses of a payment that holds money of the customer. */
const HOLDING: PaymentStatus[] = ['completed', 'partial_refund']

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

/** The same time as a response writes it. */
const written = (time: string): string => `2026-11-20T${time}:00.000Z`

describe('Sale changes API', () => {
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
  /** A shampoo the salon sells. */
  let shampooId: string

  type NewSalon = typeof salons.$inferInsert
  type NewStaff = typeof staff.$inferInsert
  type NewService = typeof services.$inferInsert
  type NewProduct = typeof products.$inferInsert
  type NewBooking = typeof bookings.$inferInsert
  type NewSale = typeof sales.$inferInsert
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

  const staffMember = (
    overrides: Partial<NewStaff> = {},
    ofSalon: string = salonId,
  ): Promise<string> => insertStaff(db, ofSalon, overrides)

  /** A service of a salon as a row; returns its ID. */
  const insertService = async (
    overrides: Partial<NewService> = {},
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [service] = await db
      .insert(services)
      .values({
        salonId: ofSalon,
        name: 'Cut and blow-dry',
        duration: 60,
        price: 6600,
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

  /** A product of a salon as a row; returns its ID. */
  const insertProduct = async (
    overrides: Partial<NewProduct> = {},
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [product] = await db
      .insert(products)
      .values({
        salonId: ofSalon,
        productCode: `P-${nextRow()}`,
        name: 'シャンプー',
        unit: '本',
        retailPrice: 2800,
        isForSale: true,
        ...overrides,
      })
      .returning({ id: products.id })
    if (product === undefined) {
      throw new Error('No product was inserted')
    }
    return product.id
  }

  /** A booking of the customer at the salon, written directly; returns its ID. */
  const insertBooking = async (
    overrides: Partial<NewBooking> = {},
  ): Promise<string> => {
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-TEST-${nextRow()}`,
        salonId,
        customerId,
        staffId,
        bookingDate: '2026-11-20',
        startTime: at('01:00'),
        endTime: at('02:00'),
        duration: 60,
        subtotal: 6600,
        totalAmount: 6600,
        ...overrides,
      })
      .returning({ id: bookings.id })
    if (booking === undefined) {
      throw new Error('No booking was inserted')
    }
    return booking.id
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await salon()
    customerId = await insertCustomer(db)
    staffId = await staffMember()
    cutId = await insertService()
    shampooId = await insertProduct()
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
    totalAmount: 6600,
    staffId,
    commissionRate: null,
    commissionAmount: null,
    notes: null,
    sortOrder: 0,
    ...overrides,
  })

  /** A line of no record and of nobody: a fee of 500 yen and 50 of tax. */
  const fee = (overrides: Record<string, unknown> = {}) =>
    line({
      itemType: 'fee',
      itemId: null,
      itemName: '指名料',
      unitPrice: 500,
      taxAmount: 50,
      totalAmount: 550,
      staffId: null,
      ...overrides,
    })

  /** A request that keeps every rule: a cut for the customer, without a booking. */
  const sale = (overrides: Record<string, unknown> = {}) => ({
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

  /** Enters a sale; as the admin unless said otherwise. */
  const create = (body: object, as: string | null = asAdmin) =>
    authorized(request(app).post(SALES), as).send(body)

  /** Reads a sale; as the admin unless said otherwise. */
  const read = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${SALES}/${id}`), as)

  /** Corrects a sale; as the admin unless said otherwise. */
  const update = (id: string, body: object, as: string | null = asAdmin) =>
    authorized(request(app).patch(`${SALES}/${id}`), as).send(body)

  /** Voids a sale, without a reason unless one is given; as the admin unless said otherwise. */
  const voidSale = (
    id: string,
    body: object = { voidReason: null },
    as: string | null = asAdmin,
  ) => authorized(request(app).post(`${SALES}/${id}/void`), as).send(body)

  /** Deletes a booking as the admin. */
  const removeBooking = (id: string) =>
    authorized(request(app).delete(`${BOOKINGS}/${id}`), asAdmin)

  /** The sale a request created; anything but 201 fails the test. */
  const created = async (overrides: Record<string, unknown> = {}) => {
    const response = await create(sale(overrides))
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Everything that is stored of a sale. */
  const everythingOf = async (id: string) => ({
    sale: await db.select().from(sales).where(eq(sales.id, id)),
    details: await db
      .select()
      .from(salesDetails)
      .where(eq(salesDetails.saleId, id))
      .orderBy(asc(salesDetails.sortOrder)),
  })

  /** The row of a sale; a sale that is not there fails the test. */
  const storedSale = async (id: string) => {
    const [row] = await db.select().from(sales).where(eq(sales.id, id))
    if (row === undefined) {
      throw new Error(`No sale ${id} is stored`)
    }
    return row
  }

  /** The moment of the clock that the changes of a sale write by. */
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
  const saleRow = (overrides: Partial<NewSale> = {}): NewSale => ({
    saleNumber: `SL-TEST-${nextRow()}`,
    salonId,
    customerId,
    saleDate: '2026-11-20',
    saleTime: at('03:40'),
    subtotal: 6000,
    taxAmount: 600,
    totalAmount: 6600,
    ...overrides,
  })

  /** Inserts a sale directly; returns its ID. */
  const insertSale = async (
    overrides: Partial<NewSale> = {},
    executor: Executor = db,
  ): Promise<string> => {
    const [row] = await executor
      .insert(sales)
      .values(saleRow(overrides))
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

  /** A way of paying at the salon, written directly; returns its ID. */
  const insertPaymentMethod = async (): Promise<string> => {
    const [method] = await db
      .insert(paymentMethods)
      .values({ salonId, method: 'cash', displayName: '現金' })
      .returning({ id: paymentMethods.id })
    if (method === undefined) {
      throw new Error('No payment method was inserted')
    }
    return method.id
  }

  /** A payment of a sale, written directly; returns its ID. */
  const insertPayment = async (
    saleId: string,
    paymentMethodId: string,
    overrides: Partial<NewPayment> = {},
    executor: Executor = db,
  ): Promise<string> => {
    const [payment] = await executor
      .insert(paymentTransactions)
      .values({
        saleId,
        paymentMethodId,
        transactionNumber: `TX-${nextRow()}`,
        ...paymentColumns(overrides),
      })
      .returning({ id: paymentTransactions.id })
    if (payment === undefined) {
      throw new Error('No payment was inserted')
    }
    return payment.id
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

  /** Those of them who void a sale. */
  const voiders: [string, SignInAs][] = [
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

  const deleted = { deletedAt: '2026-11-01T00:00:00.000Z' }

  /** Deletes a customer as a delete of the customer leaves the row. */
  const deletedCustomer = async (): Promise<string> => {
    const id = await insertCustomer(db)
    await db.update(customers).set(deleted).where(eq(customers.id, id))
    return id
  }

  describe('PATCH /api/v1/sales/:id', () => {
    it('writes the one property a request names and returns the sale as it is then', async () => {
      const entered = await created()
      const other = await created()
      const otherBefore = await everythingOf(other.id)
      const before = await databaseClock()

      const response = await update(entered.id, { notes: 'レシート再発行' })
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...entered,
          notes: 'レシート再発行',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${SALES}/${entered.id}`, list: SALES },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expectBetween(response.body.data.updatedAt, before, after)
      expect((await read(entered.id)).body.data).toEqual(response.body.data)
      expect(await everythingOf(other.id)).toEqual(otherBefore)
    })

    it('corrects everything a request can name at once, and says what the new lines come to', async () => {
      const entered = await created()
      const otherCustomerId = await insertCustomer(db)
      const otherStaffId = await staffMember()
      const bookingId = await insertBooking({ customerId: otherCustomerId })
      const shampoo = line({
        itemType: 'product',
        itemId: shampooId,
        itemName: 'シャンプー',
        quantity: 2,
        unitPrice: 2800,
        discountAmount: 600,
        taxAmount: 500,
        totalAmount: 5500,
        staffId: otherStaffId,
        commissionRate: 10,
        commissionAmount: 500,
        notes: '2本セット',
        sortOrder: 1,
      })

      const response = await update(entered.id, {
        customerId: otherCustomerId,
        staffId: otherStaffId,
        bookingId,
        saleTime: at('16:00'),
        pointsUsed: 10,
        pointsEarned: 20,
        notes: 'お会計をやり直し',
        details: [fee({ sortOrder: 3 }), shampoo],
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...entered,
        customerId: otherCustomerId,
        staffId: otherStaffId,
        bookingId,
        saleTime: written('16:00'),
        // One in the morning of the next day in Tokyo.
        saleDate: '2026-11-21',
        pointsUsed: 10,
        pointsEarned: 20,
        notes: 'お会計をやり直し',
        subtotal: 6100,
        discountAmount: 600,
        taxAmount: 550,
        totalAmount: 6050,
        details: [shampoo, fee({ sortOrder: 3 })],
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect((await read(entered.id)).body.data).toEqual(response.body.data)
    })

    it('empties what a request names as null', async () => {
      const entered = await created({
        pointsUsed: 100,
        pointsEarned: 66,
        notes: 'レジ2',
      })

      const response = await update(entered.id, {
        staffId: null,
        pointsUsed: null,
        pointsEarned: null,
        notes: null,
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...entered,
        staffId: null,
        pointsUsed: null,
        pointsEarned: null,
        notes: null,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
    })

    it('takes the customer and the booking off a sale together with its points', async () => {
      const bookingId = await insertBooking()
      const entered = await created({ bookingId, pointsUsed: 5 })

      const response = await update(entered.id, {
        customerId: null,
        bookingId: null,
        pointsUsed: null,
      })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        customerId: null,
        bookingId: null,
        pointsUsed: null,
        pointsEarned: null,
      })
    })

    it('puts the lines a request names in the place of every line the sale has', async () => {
      const entered = await created({
        details: [line(), fee({ sortOrder: 1 }), fee({ sortOrder: 2 })],
      })
      const other = await created({ details: [line(), fee({ sortOrder: 1 })] })
      const before = await everythingOf(entered.id)
      const otherBefore = await everythingOf(other.id)

      const response = await update(entered.id, {
        details: [fee({ sortOrder: 7, itemName: '延長料' })],
      })
      const after = await everythingOf(entered.id)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...entered,
        subtotal: 500,
        discountAmount: 0,
        taxAmount: 50,
        totalAmount: 550,
        details: [fee({ sortOrder: 7, itemName: '延長料' })],
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(before.details).toHaveLength(3)
      expect(after.details).toMatchObject([
        { saleId: entered.id, itemName: '延長料', sortOrder: 7 },
      ])
      expect(before.details.map((row) => row.id)).not.toContain(
        after.details[0]?.id,
      )
      expect(otherBefore.details).toHaveLength(2)
      expect(await everythingOf(other.id)).toEqual(otherBefore)
    })

    it('returns new lines by their places, in whatever order the request states them', async () => {
      const entered = await created()

      const response = await update(entered.id, {
        details: [
          fee({ sortOrder: 9, itemName: 'c' }),
          fee({ sortOrder: 0, itemName: 'a' }),
          fee({ sortOrder: 4, itemName: 'b' }),
        ],
      })

      expect(response.status).toBe(200)
      expect(
        response.body.data.details.map(
          ({ itemName }: { itemName: string }) => itemName,
        ),
      ).toEqual(['a', 'b', 'c'])
    })

    it('takes a line again that the sale has: the places of the old lines are free', async () => {
      const entered = await created({
        details: [line(), fee({ sortOrder: 1 })],
      })

      const response = await update(entered.id, {
        details: [fee({ sortOrder: 0 }), line({ sortOrder: 1 })],
      })

      expect(response.status).toBe(200)
      expect(response.body.data.details).toEqual([
        fee({ sortOrder: 0 }),
        line({ sortOrder: 1 }),
      ])
      expect(response.body.data.totalAmount).toBe(entered.totalAmount)
    })

    it('leaves the lines and what they come to alone when the request names no lines', async () => {
      const entered = await created({
        details: [line(), fee({ sortOrder: 1 })],
      })
      const before = await everythingOf(entered.id)

      const response = await update(entered.id, { staffId: null })
      const after = await everythingOf(entered.id)

      expect(response.status).toBe(200)
      expect(after.details).toEqual(before.details)
      expect(after.sale).toMatchObject([
        {
          subtotal: 6500,
          discountAmount: 0,
          taxAmount: 650,
          totalAmount: 7150,
        },
      ])
    })

    it('takes up to 100 lines, and lines that come to what an integer column holds', async () => {
      const entered = await created()
      const hundred = Array.from({ length: 100 }, (_value, sortOrder) =>
        fee({ sortOrder }),
      )

      const full = await update(entered.id, { details: hundred })
      const most = await update(entered.id, {
        details: [
          fee({
            unitPrice: MAX_INTEGER,
            taxAmount: 0,
            totalAmount: MAX_INTEGER,
          }),
        ],
      })

      expect(full.status).toBe(200)
      expect(full.body.data.details).toHaveLength(100)
      expect(full.body.data.totalAmount).toBe(55_000)
      expect(most.status).toBe(200)
      expect(most.body.data).toMatchObject({
        subtotal: MAX_INTEGER,
        totalAmount: MAX_INTEGER,
      })
    })

    describe('the day of a sale', () => {
      it.each([
        ['the last minute of a day in Tokyo', '14:59', '2026-11-20'],
        ['midnight in Tokyo', '15:00', '2026-11-21'],
      ])('follows a new time: %s', async (_case, time, saleDate) => {
        const entered = await created()

        const response = await update(entered.id, { saleTime: at(time) })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          saleTime: written(time),
          saleDate,
        })
      })

      it('stays as it is without a new time, whatever the time zone of the salon is by now', async () => {
        const entered = await created()
        await db
          .update(salons)
          .set({ timezone: 'America/Los_Angeles' })
          .where(eq(salons.id, salonId))

        const noted = await update(entered.id, { notes: 'レジ2' })
        const timed = await update(entered.id, { saleTime: at('03:40') })

        expect(entered.saleDate).toBe('2026-11-20')
        expect(noted.body.data.saleDate).toBe('2026-11-20')
        // Twenty to eight in the evening of the day before in Los Angeles.
        expect(timed.body.data).toMatchObject({
          saleTime: written('03:40'),
          saleDate: '2026-11-19',
        })
      })

      it('cannot be told in a time zone that is not known, which only a new time asks for', async () => {
        const entered = await created()
        await db
          .update(salons)
          .set({ timezone: 'Mars/Olympus' })
          .where(eq(salons.id, salonId))
        const before = await everythingOf(entered.id)

        const timed = await update(entered.id, {
          saleTime: at('05:00'),
          notes: 'レジ2',
        })
        const unchanged = await everythingOf(entered.id)
        const noted = await update(entered.id, {
          notes: 'レジ2',
          details: [fee()],
        })

        expectProblem(timed, notAllowed)
        expect(timed.body.detail).toBe(TIME_ZONE_UNKNOWN)
        expect(unchanged).toEqual(before)
        expect(noted.status).toBe(200)
      })
    })

    it('writes the time of the change, and not the time of the entry, also for a request that changes no value', async () => {
      const entered = await created()
      const before = await databaseClock()

      const response = await update(entered.id, { notes: null })
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...entered,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expectBetween(response.body.data.updatedAt, before, after)
      expect(response.body.data.createdAt).toBe(entered.createdAt)
    })

    it('corrects a sale whose customer, staff member and salon are gone, as long as it does not name them', async () => {
      const entered = await created({ pointsUsed: 5 })
      await db
        .update(customers)
        .set(deleted)
        .where(eq(customers.id, customerId))
      await db.update(staff).set(deleted).where(eq(staff.id, staffId))
      await db.update(services).set(deleted).where(eq(services.id, cutId))
      await db.update(salons).set(deleted).where(eq(salons.id, salonId))

      const noted = await update(entered.id, {
        notes: '閉店後の訂正',
        saleTime: at('16:00'),
        pointsEarned: 3,
      })
      const named = await update(entered.id, { customerId, staffId })
      const relined = await update(entered.id, { details: [line()] })

      expect(noted.status).toBe(200)
      expect(noted.body.data).toMatchObject({
        customerId,
        staffId,
        notes: '閉店後の訂正',
        saleDate: '2026-11-21',
        pointsUsed: 5,
        pointsEarned: 3,
      })
      expectProblem(named, badRequest)
      expect(brokenRules(named)).toEqual([
        'customerId:not_found',
        'staffId:not_found',
      ])
      expectProblem(relined, badRequest)
      expect(brokenRules(relined)).toEqual([
        'details.0.staffId:not_found',
        'details.0.itemId:not_found',
      ])
    })

    it('accepts the ID in upper case and answers with the one in lower case', async () => {
      const entered = await created()

      const response = await update(entered.id.toUpperCase(), {
        notes: 'レジ2',
      })

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(entered.id)
      expect(response.body.links.self).toBe(`${SALES}/${entered.id}`)
    })

    describe('what a request must be', () => {
      it('refuses a request that names nothing', async () => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, {})

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(response.body.errors).toEqual([
          issue('', 'custom', 'At least one property must be specified'),
        ])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it.each<[string, string, unknown]>([
        ['the salon: a sale does not move', 'salonId', UNKNOWN_ID],
        ['the number of the sale', 'saleNumber', 'SL-0000-0001'],
        ['the day, which follows from the time', 'saleDate', '2026-11-21'],
        ['the subtotal', 'subtotal', 1],
        ['the discount', 'discountAmount', 1],
        ['the tax', 'taxAmount', 1],
        ['the total', 'totalAmount', 1],
        ['the payment status', 'paymentStatus', 'completed'],
        ['whether the sale is void', 'isVoid', true],
        ['the time of a void', 'voidedAt', at('05:00')],
        ['the reason of a void', 'voidReason', '二重登録'],
        ['the payments', 'payments', []],
        ['the ID', 'id', UNKNOWN_ID],
        ['the time of the entry', 'createdAt', at('05:00')],
      ])('refuses %s and changes nothing', async (_case, property, value) => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, {
          notes: 'レジ2',
          [property]: value,
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([`${property}:unrecognized_keys`])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it.each<[string, object, string[]]>([
        [
          'a customer that is no ID',
          { customerId: 'c-1' },
          ['customerId:invalid_format'],
        ],
        [
          'a staff member that is no ID',
          { staffId: 1 },
          ['staffId:invalid_type'],
        ],
        [
          'a booking that is no ID',
          { bookingId: 'BK-0000-0001' },
          ['bookingId:invalid_format'],
        ],
        [
          'a time in another zone',
          { saleTime: '2026-11-20T12:40:00+09:00' },
          ['saleTime:invalid_format'],
        ],
        ['null for the time', { saleTime: null }, ['saleTime:invalid_type']],
        ['points below 0', { pointsUsed: -1 }, ['pointsUsed:too_small']],
        [
          'more points than the column holds',
          { pointsEarned: MAX_INTEGER + 1 },
          ['pointsEarned:too_big'],
        ],
        ['half a point', { pointsEarned: 0.5 }, ['pointsEarned:invalid_type']],
        ['notes that say nothing', { notes: ' ' }, ['notes:invalid_format']],
        ['null for the lines', { details: null }, ['details:invalid_type']],
        ['no line', { details: [] }, ['details:too_small']],
      ])('refuses %s', async (_case, body, rules) => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(brokenRules(response)).toEqual(rules)
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('holds every new line to the rules of a line, and takes no more than 100', async () => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const broken = await update(entered.id, {
          details: [
            fee({ totalAmount: 500 }),
            fee({ sortOrder: 1, itemName: '' }),
            fee({ sortOrder: 2, itemId: cutId }),
            fee({ sortOrder: 3, salonId }),
            fee({ sortOrder: 3 }),
          ],
        })
        const tooMany = await update(entered.id, {
          details: Array.from({ length: 101 }, (_value, sortOrder) =>
            fee({ sortOrder }),
          ),
        })

        expectProblem(broken, badRequest)
        expect(brokenRules(broken).toSorted()).toEqual([
          'details.0.totalAmount:custom',
          'details.1.itemName:invalid_format',
          'details.2.itemId:custom',
          'details.3.salonId:unrecognized_keys',
          'details.4.sortOrder:custom',
        ])
        expectProblem(tooMany, badRequest)
        expect(brokenRules(tooMany)).toEqual(['details:too_big'])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('refuses lines that come to more than an integer column holds', async () => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, {
          details: [
            fee({
              unitPrice: MAX_INTEGER,
              taxAmount: 0,
              totalAmount: MAX_INTEGER,
            }),
            fee({ sortOrder: 1, unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
          ],
        })

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'details',
            'too_big',
            `The amounts of a sale must not exceed ${MAX_INTEGER}`,
          ),
        ])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('refuses a request that is a list, and a body that is neither an object nor a list as one it cannot read', async () => {
        const entered = await created()
        const send = (body: string): Test =>
          authorized(request(app).patch(`${SALES}/${entered.id}`), asAdmin)
            .set('Content-Type', 'application/json')
            .send(body)

        const responses = [
          await send('[]'),
          await send('null'),
          await send('"notes"'),
          await send('{"notes": '),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '400 2001',
          '400 2002',
          '400 2002',
          '400 2002',
        ])
        expect(brokenRules(responses[0] ?? (await send('[]')))).toEqual([
          ':invalid_type',
        ])
      })

      it.each([
        ['a text that is no ID', 'not-an-id'],
        ['a sale number', 'SL-7Z3K-0QXM'],
        ['an ID with a character too many', `${UNKNOWN_ID}0`],
      ])('refuses %s for the sale', async (_case, id) => {
        const response = await update(id, { notes: 'レジ2' })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_ID)
        expect(brokenRules(response)).toHaveLength(1)
        expect(brokenRules(response)[0]).toMatch(/^id:/)
      })
    })

    describe('what a request refers to', () => {
      it.each<[string, () => Promise<string>]>([
        ['an ID that no customer has', async () => UNKNOWN_ID],
        ['a deleted customer', deletedCustomer],
        ['the ID of a staff member', async () => staffId],
      ])('refuses %s for the customer', async (_case, customerOf) => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, {
          customerId: await customerOf(),
        })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(response.body.errors).toEqual([
          issue('customerId', 'not_found', 'Must name a customer'),
        ])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      const notStaffOfTheSalon: [string, () => Promise<string>][] = [
        ['an ID that no staff member has', async () => UNKNOWN_ID],
        ['a deleted staff member', () => staffMember(deleted)],
        [
          'a staff member of another salon',
          async () => staffMember({}, await salon()),
        ],
        ['the ID of a customer', async () => customerId],
      ]

      it.each(notStaffOfTheSalon)(
        'refuses %s for the staff member in charge, and for the staff member of a line under the line',
        async (_case, staffOf) => {
          const entered = await created()
          const before = await everythingOf(entered.id)
          const other = await staffOf()

          const inCharge = await update(entered.id, { staffId: other })
          const ofLine = await update(entered.id, {
            details: [line(), fee({ sortOrder: 1, staffId: other })],
          })

          expectProblem(inCharge, badRequest)
          expect(inCharge.body.errors).toEqual([
            issue('staffId', 'not_found', NOT_STAFF),
          ])
          expectProblem(ofLine, badRequest)
          expect(ofLine.body.errors).toEqual([
            issue('details.1.staffId', 'not_found', NOT_STAFF),
          ])
          expect(await everythingOf(entered.id)).toEqual(before)
        },
      )

      it.each<[string, string, () => Promise<string>, string]>([
        [
          'an ID that no service has',
          'service',
          async () => UNKNOWN_ID,
          'a service',
        ],
        [
          'a deleted service',
          'service',
          () => insertService(deleted),
          'a service',
        ],
        [
          'a service of another salon',
          'service',
          async () => insertService({}, await salon()),
          'a service',
        ],
        [
          'a product for a service',
          'service',
          async () => shampooId,
          'a service',
        ],
        [
          'an ID that no product has',
          'product',
          async () => UNKNOWN_ID,
          'a product',
        ],
        [
          'a deleted product',
          'product',
          () => insertProduct(deleted),
          'a product',
        ],
        [
          'a product of another salon',
          'product',
          async () => insertProduct({}, await salon()),
          'a product',
        ],
        ['a service for a product', 'product', async () => cutId, 'a product'],
      ])(
        'refuses %s for what a new line sells',
        async (_case, itemType, itemOf, what) => {
          const entered = await created()
          const before = await everythingOf(entered.id)

          const response = await update(entered.id, {
            details: [line({ itemType, itemId: await itemOf() })],
          })

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue(
              'details.0.itemId',
              'not_found',
              `Must name ${what} of the salon`,
            ),
          ])
          expect(await everythingOf(entered.id)).toEqual(before)
        },
      )

      it('takes a staff member, a service and a product of the salon', async () => {
        const entered = await created()
        const otherStaffId = await staffMember()

        const response = await update(entered.id, {
          staffId: otherStaffId,
          details: [
            line({ staffId: otherStaffId }),
            line({
              itemType: 'product',
              itemId: shampooId,
              itemName: 'シャンプー',
              sortOrder: 1,
            }),
          ],
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          staffId: otherStaffId,
          details: [{ staffId: otherStaffId }, { itemId: shampooId }],
        })
      })

      it('reports everything that is not there at once, in the order of a sale that is entered', async () => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, {
          customerId: UNKNOWN_ID,
          staffId: UNKNOWN_ID,
          bookingId: UNKNOWN_ID,
          details: [line({ itemId: UNKNOWN_ID, staffId: UNKNOWN_ID })],
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'customerId:not_found',
          'staffId:not_found',
          'bookingId:not_found',
          'details.0.staffId:not_found',
          'details.0.itemId:not_found',
        ])
        expect(await everythingOf(entered.id)).toEqual(before)
      })
    })

    describe('the booking of a sale', () => {
      it('takes a booking of the customer the sale has', async () => {
        const entered = await created()
        const bookingId = await insertBooking()

        const response = await update(entered.id, { bookingId })

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual({
          ...entered,
          bookingId,
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
      })

      it.each<[string, () => Promise<string>]>([
        ['an ID that no booking has', async () => UNKNOWN_ID],
        [
          'a booking of another salon',
          async () => {
            const elsewhere = await salon()
            return insertBooking({
              salonId: elsewhere,
              staffId: await staffMember({}, elsewhere),
            })
          },
        ],
        [
          'the booking of another customer',
          async () => insertBooking({ customerId: await insertCustomer(db) }),
        ],
        ['the ID of a sale', () => insertSale()],
      ])('refuses %s for the booking', async (_case, bookingOf) => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, {
          bookingId: await bookingOf(),
        })

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('bookingId', 'not_found', NOT_THE_BOOKING),
        ])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('refuses a booking for a sale to nobody: a booking is a customer’s', async () => {
        const entered = await created({ customerId: null })

        const response = await update(entered.id, {
          bookingId: await insertBooking(),
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['bookingId:not_found'])
      })

      it('holds a named booking to the customer the request names with it', async () => {
        const entered = await created()
        const otherCustomerId = await insertCustomer(db)
        const theirs = await insertBooking({ customerId: otherCustomerId })
        const own = await insertBooking()

        const mismatched = await update(entered.id, {
          customerId: otherCustomerId,
          bookingId: own,
        })
        const matched = await update(entered.id, {
          customerId: otherCustomerId,
          bookingId: theirs,
        })

        expectProblem(mismatched, badRequest)
        expect(brokenRules(mismatched)).toEqual(['bookingId:not_found'])
        expect(matched.status).toBe(200)
        expect(matched.body.data).toMatchObject({
          customerId: otherCustomerId,
          bookingId: theirs,
        })
      })

      it('refuses another customer, and nobody, for a sale that keeps its booking, and says so of the customer', async () => {
        const bookingId = await insertBooking()
        const entered = await created({ bookingId, pointsUsed: 5 })
        const before = await everythingOf(entered.id)

        const another = await update(entered.id, {
          customerId: await insertCustomer(db),
        })
        const nobody = await update(entered.id, { customerId: null })
        const unknown = await update(entered.id, { customerId: UNKNOWN_ID })

        expectProblem(another, badRequest)
        expect(another.body.errors).toEqual([
          issue('customerId', 'not_found', NOT_THE_CUSTOMER),
        ])
        expectProblem(nobody, badRequest)
        expect(nobody.body.errors).toEqual([
          issue('customerId', 'not_found', NOT_THE_CUSTOMER),
          issue('pointsUsed', 'custom', NOBODYS_POINTS),
        ])
        expectProblem(unknown, badRequest)
        expect(unknown.body.errors).toEqual([
          issue('customerId', 'not_found', 'Must name a customer'),
        ])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('lets the customer of a sale change when its booking is taken off, or changes with them', async () => {
        const entered = await created({ bookingId: await insertBooking() })
        const otherCustomerId = await insertCustomer(db)

        const response = await update(entered.id, {
          customerId: otherCustomerId,
          bookingId: null,
        })
        const same = await update(entered.id, { customerId: otherCustomerId })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          customerId: otherCustomerId,
          bookingId: null,
        })
        expect(same.status).toBe(200)
      })

      it('bills a booking once: a booking that another sale bills is not taken', async () => {
        const bookingId = await insertBooking()
        const billing = await created({ bookingId })
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await update(entered.id, { bookingId })

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(BOOKING_IS_BILLED)
        expect(await everythingOf(entered.id)).toEqual(before)
        expect((await storedSale(billing.id)).bookingId).toBe(bookingId)
      })

      it('takes a booking whose only sales are void, and one that the other sale let go of', async () => {
        const voidOnly = await insertBooking()
        await insertSale({ bookingId: voidOnly, ...voided })
        await insertSale({ bookingId: voidOnly, ...voided })
        const letGo = await insertBooking()
        const other = await created({ bookingId: letGo })
        const entered = await created()

        const first = await update(entered.id, { bookingId: voidOnly })
        const released = await update(other.id, { bookingId: null })
        const second = await update(entered.id, { bookingId: letGo })

        expect([first, released, second].map(statusAndCode)).toEqual([
          '200',
          '200',
          '200',
        ])
        expect(second.body.data.bookingId).toBe(letGo)
      })

      it('does not stand in its own way: a sale names the booking it bills again', async () => {
        const bookingId = await insertBooking()
        const entered = await created({ bookingId })

        const response = await update(entered.id, {
          bookingId,
          customerId,
          notes: 'レジ2',
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({ bookingId, notes: 'レジ2' })
      })

      it('takes the customer the sale has again for a sale that keeps its booking', async () => {
        const bookingId = await insertBooking()
        const entered = await created({ bookingId })

        const response = await update(entered.id, { customerId })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({ customerId, bookingId })
      })
    })

    describe('the points of a sale', () => {
      it.each(['pointsUsed', 'pointsEarned'])(
        'refuses %s for a sale to nobody, be it 0',
        async (property) => {
          const entered = await created({ customerId: null })

          const response = await update(entered.id, { [property]: 0 })

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue(property, 'custom', NOBODYS_POINTS),
          ])
        },
      )

      it('refuses to take the customer off a sale that keeps points, and names the points that stay', async () => {
        const entered = await created({ pointsUsed: 100, pointsEarned: 66 })
        const before = await everythingOf(entered.id)

        const both = await update(entered.id, { customerId: null })
        const one = await update(entered.id, {
          customerId: null,
          pointsUsed: null,
        })

        expectProblem(both, badRequest)
        expect(both.body.errors).toEqual([
          issue('pointsUsed', 'custom', NOBODYS_POINTS),
          issue('pointsEarned', 'custom', NOBODYS_POINTS),
        ])
        expectProblem(one, badRequest)
        expect(brokenRules(one)).toEqual(['pointsEarned:custom'])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('gives a sale to nobody its customer together with points, and keeps the points when the customer changes', async () => {
        const entered = await created({ customerId: null })
        const otherCustomerId = await insertCustomer(db)

        const given = await update(entered.id, {
          customerId,
          pointsUsed: 10,
          pointsEarned: 20,
        })
        const changed = await update(entered.id, {
          customerId: otherCustomerId,
        })

        expect(given.status).toBe(200)
        expect(changed.status).toBe(200)
        expect(changed.body.data).toMatchObject({
          customerId: otherCustomerId,
          pointsUsed: 10,
          pointsEarned: 20,
        })
      })
    })

    describe('a sale that is void or paid', () => {
      it('refuses every correction of a void sale', async () => {
        const id = await insertSale(voided)
        const before = await everythingOf(id)

        const responses = [
          await update(id, { notes: 'レジ2' }),
          await update(id, { details: [fee()] }),
          await update(id, { bookingId: null, customerId: null }),
        ]

        for (const response of responses) {
          expectProblem(response, notAllowed)
          expect(response.body.detail).toBe(SALE_IS_VOID)
        }
        expect(await everythingOf(id)).toEqual(before)
      })

      it.each(PAYMENT_STATUSES.filter((status) => status !== 'pending'))(
        'refuses new lines for a sale whose payment status is %s, and corrects what is not a line',
        async (paymentStatus) => {
          const id = await insertSale({ paymentStatus })
          const before = await everythingOf(id)

          const relined = await update(id, { details: [fee()] })
          const unchanged = await everythingOf(id)
          const noted = await update(id, {
            staffId,
            saleTime: at('16:00'),
            pointsEarned: 66,
            notes: 'レジ2',
          })

          expectProblem(relined, notAllowed)
          expect(relined.body.detail).toBe(PAYMENT_HAS_BEGUN)
          expect(unchanged).toEqual(before)
          expect(noted.status).toBe(200)
          expect(noted.body.data).toMatchObject({
            paymentStatus,
            staffId,
            saleDate: '2026-11-21',
            pointsEarned: 66,
            notes: 'レジ2',
          })
        },
      )

      it('replaces the lines of a sale that has payments as long as its payment status is pending', async () => {
        const entered = await created()
        await insertPayment(entered.id, await insertPaymentMethod(), {
          status: 'failed',
        })

        const response = await update(entered.id, { details: [fee()] })

        expect(response.status).toBe(200)
        expect(response.body.data.totalAmount).toBe(550)
        expect(response.body.data.payments).toMatchObject([
          { saleId: entered.id, status: 'failed' },
        ])
      })
    })

    describe('what is not there', () => {
      it('answers a sale that does not exist with 404', async () => {
        const response = await update(UNKNOWN_ID, { notes: 'レジ2' })

        expectProblem(response, notFound)
        expect(response.body.detail).toContain(UNKNOWN_ID)
      })

      it.each(membersOfAnotherSalon)(
        'answers %s as if the sale did not exist, also when the sale is void',
        async (_case, signInAs) => {
          const entered = await created()
          const voidId = await insertSale(voided)
          const before = await everythingOf(entered.id)
          const authorization = await signInAs()

          const responses = [
            await update(entered.id, { notes: 'レジ2' }, authorization),
            await update(entered.id, { details: [fee()] }, authorization),
            await update(voidId, { notes: 'レジ2' }, authorization),
          ]

          for (const response of responses) {
            expectProblem(response, notFound)
          }
          expect(await everythingOf(entered.id)).toEqual(before)
        },
      )

      it('lets an administrator correct a sale of any salon', async () => {
        const elsewhere = await salon()
        const id = await insertSale({ salonId: elsewhere })

        const response = await update(id, {
          staffId: await staffMember({}, elsewhere),
        })
        const ofThisSalon = await update(id, { staffId })

        expect(response.status).toBe(200)
        // The staff member of a sale is one of the salon of the sale.
        expectProblem(ofThisSalon, badRequest)
        expect(brokenRules(ofThisSalon)).toEqual(['staffId:not_found'])
      })
    })

    it('checks a correction in order: the token, the account, the ID, the request, the sale, the void, the payment, what the request refers to, the sums, the day, the booking', async () => {
      const bookingId = await insertBooking()
      await created({ bookingId })
      const entered = await created()
      const voidId = await insertSale({ ...voided, paymentStatus: 'completed' })
      const paidId = await insertSale({ paymentStatus: 'completed' })
      const asCustomer = (await signedInUser(app, db)).authorization
      const tooBig = [
        fee({ unitPrice: MAX_INTEGER, taxAmount: 0, totalAmount: MAX_INTEGER }),
        fee({ sortOrder: 1, unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
      ]
      await db
        .update(salons)
        .set({ timezone: 'Mars/Olympus' })
        .where(eq(salons.id, salonId))

      const responses = [
        // No token, and everything else wrong as well.
        await update('not-an-id', {}, null),
        // An account that does not keep the ledger.
        await update('not-an-id', {}, asCustomer),
        // An ID that is none, and a request that names nothing.
        await update('not-an-id', {}),
        // A request that breaks a rule, for a sale that is not there.
        await update(UNKNOWN_ID, { notes: '' }),
        // A sale that is not there.
        await update(UNKNOWN_ID, { details: tooBig, staffId: UNKNOWN_ID }),
        // A void sale whose payment has begun.
        await update(voidId, { details: tooBig, staffId: UNKNOWN_ID }),
        // A sale whose payment has begun.
        await update(paidId, { details: tooBig, staffId: UNKNOWN_ID }),
        // A staff member who is not there.
        await update(entered.id, {
          details: tooBig,
          staffId: UNKNOWN_ID,
          saleTime: at('05:00'),
          bookingId,
        }),
        // Lines that come to too much.
        await update(entered.id, {
          details: tooBig,
          saleTime: at('05:00'),
          bookingId,
        }),
        // A time zone that is not known.
        await update(entered.id, { saleTime: at('05:00'), bookingId }),
        // A booking that is billed.
        await update(entered.id, { bookingId }),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '400 2001',
        '404 3001',
        '409 3003',
        '409 3003',
        '400 2001',
        '400 2001',
        '409 3003',
        '409 3003',
      ])
      expect(responses[2]?.body.detail).toBe(INVALID_ID)
      expect(responses[3]?.body.detail).toBe(INVALID_UPDATE)
      expect(responses[5]?.body.detail).toBe(SALE_IS_VOID)
      expect(responses[6]?.body.detail).toBe(PAYMENT_HAS_BEGUN)
      expect(responses[7]?.body.errors).toEqual([
        issue('staffId', 'not_found', NOT_STAFF),
      ])
      expect(responses[8]?.body.errors).toMatchObject([
        { field: 'details', rule: 'too_big' },
      ])
      expect(responses[9]?.body.detail).toBe(TIME_ZONE_UNKNOWN)
      expect(responses[10]?.body.detail).toBe(BOOKING_IS_BILLED)
    })
  })

  describe('POST /api/v1/sales/:id/void', () => {
    it('voids the sale with the reason and the time, and returns it as it is then', async () => {
      const entered = await created({
        pointsUsed: 5,
        details: [line(), fee({ sortOrder: 1 })],
      })
      const other = await created()
      const otherBefore = await everythingOf(other.id)
      const before = await databaseClock()

      const response = await voidSale(entered.id, { voidReason: '二重登録' })
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          ...entered,
          isVoid: true,
          voidedAt: expect.stringMatching(ISO_TIMESTAMP),
          voidReason: '二重登録',
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${SALES}/${entered.id}`, list: SALES },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expectBetween(response.body.data.voidedAt, before, after)
      expectBetween(response.body.data.updatedAt, before, after)
      expect((await read(entered.id)).body.data).toEqual(response.body.data)
      expect(await everythingOf(other.id)).toEqual(otherBefore)
    })

    it('voids a sale of which no reason is kept, and keeps a reason as it was written', async () => {
      const first = await created()
      const second = await created()

      const withoutReason = await voidSale(first.id, { voidReason: null })
      const withReason = await voidSale(second.id, {
        voidReason: ' 金額の打ち間違い\n再登録済み ',
      })

      expect(withoutReason.status).toBe(200)
      expect(withoutReason.body.data).toMatchObject({
        isVoid: true,
        voidReason: null,
      })
      expect(withReason.body.data.voidReason).toBe(
        ' 金額の打ち間違い\n再登録済み ',
      )
    })

    it('keeps the sale in the ledger, with its lines, what they come to and its payment status', async () => {
      const entered = await created({
        details: [line(), fee({ sortOrder: 1 })],
      })
      const before = await everythingOf(entered.id)

      await voidSale(entered.id, { voidReason: '二重登録' })
      const after = await everythingOf(entered.id)
      const listed = await authorized(request(app).get(SALES), asAdmin)

      expect(after.details).toEqual(before.details)
      expect(after.sale).toMatchObject([
        {
          subtotal: 6500,
          taxAmount: 650,
          totalAmount: 7150,
          paymentStatus: 'pending',
          isVoid: true,
          voidReason: '二重登録',
        },
      ])
      expect(listed.body.data).toMatchObject([{ id: entered.id, isVoid: true }])
    })

    it('frees the booking of the sale for another sale, and keeps referring to it', async () => {
      const bookingId = await insertBooking()
      const entered = await created({ bookingId })

      const refused = await create(sale({ bookingId }))
      const response = await voidSale(entered.id)
      const again = await create(sale({ bookingId }))
      const removal = await removeBooking(bookingId)

      expectProblem(refused, notAllowed)
      expect(response.status).toBe(200)
      expect(response.body.data.bookingId).toBe(bookingId)
      expect(again.status).toBe(201)
      expectProblem(removal, notAllowed)
      expect(removal.body.detail).toBe(
        'The booking cannot be deleted: a sale refers to it',
      )
    })

    it.each(PAYMENT_STATUSES.filter((status) => !HOLDING.includes(status)))(
      'voids a sale whose payment is %s: it holds no money',
      async (status) => {
        const entered = await created()
        const paymentId = await insertPayment(
          entered.id,
          await insertPaymentMethod(),
          { status },
        )

        const response = await voidSale(entered.id)

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          isVoid: true,
          payments: [{ id: paymentId, status }],
        })
      },
    )

    it.each(HOLDING)(
      'refuses a sale with a payment that is %s, wherever it stands among the payments',
      async (status) => {
        const entered = await created()
        const methodId = await insertPaymentMethod()
        await insertPayment(entered.id, methodId, { status: 'failed' })
        await insertPayment(entered.id, methodId, { status })
        await insertPayment(entered.id, methodId, { status: 'refunded' })
        const before = await everythingOf(entered.id)

        const response = await voidSale(entered.id, { voidReason: '二重登録' })

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(NOT_REFUNDED)
        expect(await everythingOf(entered.id)).toEqual(before)
      },
    )

    it('goes by the payments of the sale itself, and not by its payment status', async () => {
      const methodId = await insertPaymentMethod()
      const paidElsewhere = await created()
      const other = await created()
      await insertPayment(other.id, methodId)
      const refunded = await insertSale({ paymentStatus: 'completed' })
      await insertPayment(refunded, methodId, { status: 'refunded' })

      const responses = [
        await voidSale(paidElsewhere.id),
        await voidSale(refunded),
        await voidSale(other.id),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '409 3003'])
    })

    it('refuses a sale that is void already, and leaves the first void as it is', async () => {
      const entered = await created()
      const first = await voidSale(entered.id, { voidReason: '二重登録' })
      const before = await everythingOf(entered.id)

      const second = await voidSale(entered.id, { voidReason: 'やり直し' })
      const written = await insertSale(voided)
      const third = await voidSale(written)

      expect(first.status).toBe(200)
      expectProblem(second, notAllowed)
      expect(second.body.detail).toBe(VOID_ALREADY)
      expect(await everythingOf(entered.id)).toEqual(before)
      expectProblem(third, notAllowed)
    })

    it('voids a sale of a deleted salon, and one whose customer and staff member are gone', async () => {
      const entered = await created()
      await db
        .update(customers)
        .set(deleted)
        .where(eq(customers.id, customerId))
      await db.update(staff).set(deleted).where(eq(staff.id, staffId))
      await db.update(salons).set(deleted).where(eq(salons.id, salonId))

      const response = await voidSale(entered.id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ isVoid: true, customerId })
    })

    describe('what a request must be', () => {
      it.each<[string, object, string[]]>([
        ['a request without the reason', {}, ['voidReason:invalid_type']],
        ['an empty reason', { voidReason: '' }, ['voidReason:invalid_format']],
        [
          'a reason of spaces',
          { voidReason: ' \n' },
          ['voidReason:invalid_format'],
        ],
        [
          'a number for the reason',
          { voidReason: 1 },
          ['voidReason:invalid_type'],
        ],
        [
          'whether the sale is void',
          { voidReason: null, isVoid: true },
          ['isVoid:unrecognized_keys'],
        ],
        [
          'the time of the void',
          { voidReason: null, voidedAt: at('05:00') },
          ['voidedAt:unrecognized_keys'],
        ],
        ['a list', [{ voidReason: null }], [':invalid_type']],
      ])('refuses %s and voids nothing', async (_case, body, rules) => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const response = await voidSale(entered.id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_VOID)
        expect(brokenRules(response)).toEqual(rules)
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('refuses a request without a body, and a body it cannot read', async () => {
        const entered = await created()
        const address = `${SALES}/${entered.id}/void`

        const responses = [
          await authorized(request(app).post(address), asAdmin),
          await authorized(request(app).post(address), asAdmin)
            .set('Content-Type', 'application/json')
            .send('{"voidReason": '),
          await authorized(request(app).post(address), asAdmin)
            .set('Content-Type', 'application/json')
            .send('null'),
          await authorized(request(app).post(address), asAdmin)
            .set('Content-Type', 'text/plain')
            .send('二重登録'),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '400 2001',
          '400 2002',
          '400 2002',
          '415 2002',
        ])
        expect((await storedSale(entered.id)).isVoid).toBe(false)
      })

      it.each([
        ['a text that is no ID', 'not-an-id'],
        ['a sale number', 'SL-7Z3K-0QXM'],
      ])('refuses %s for the sale', async (_case, id) => {
        const response = await voidSale(id)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_ID)
        expect(brokenRules(response)).toHaveLength(1)
        expect(brokenRules(response)[0]).toMatch(/^id:/)
      })
    })

    describe('what is not there', () => {
      it('answers a sale that does not exist with 404', async () => {
        const response = await voidSale(UNKNOWN_ID)

        expectProblem(response, notFound)
        expect(response.body.detail).toContain(UNKNOWN_ID)
      })

      it.each(membersOfAnotherSalon.slice(0, 2))(
        'answers %s as if the sale did not exist, also when the sale is void',
        async (_case, signInAs) => {
          const entered = await created()
          const voidId = await insertSale(voided)
          const authorization = await signInAs()

          const responses = [
            await voidSale(entered.id, { voidReason: null }, authorization),
            await voidSale(voidId, { voidReason: null }, authorization),
          ]

          for (const response of responses) {
            expectProblem(response, notFound)
          }
          expect((await storedSale(entered.id)).isVoid).toBe(false)
        },
      )

      it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
        ['GET on the void of a sale', 'get', '/:id/void'],
        ['PUT on the void of a sale', 'put', '/:id/void'],
        ['PATCH on the void of a sale', 'patch', '/:id/void'],
        ['DELETE on the void of a sale', 'delete', '/:id/void'],
        ['POST below the void of a sale', 'post', '/:id/void/undo'],
        ['PATCH on the ledger', 'patch', ''],
      ])(
        'answers %s with 404, whatever is sent',
        async (_case, method, path) => {
          const entered = await created()
          const before = await everythingOf(entered.id)
          const address = `${SALES}${path.replace(':id', entered.id)}`

          const responses = [
            await authorized(request(app)[method](address), asAdmin),
            await authorized(request(app)[method](address), asAdmin).send({
              voidReason: null,
            }),
          ]

          expect(responses.map(statusAndCode)).toEqual(['404 3001', '404 3001'])
          expect(await everythingOf(entered.id)).toEqual(before)
        },
      )
    })

    it('checks a void in order: the token, the account, the ID, the request, the sale, the void, the payments', async () => {
      const entered = await created()
      const methodId = await insertPaymentMethod()
      await insertPayment(entered.id, methodId)
      const voidId = await insertSale(voided)
      await insertPayment(voidId, methodId)
      const asStaff = await member('staff')()

      const responses = [
        // No token, and everything else wrong as well.
        await voidSale('not-an-id', {}, null),
        // A staff member of the salon, who voids no sale.
        await voidSale('not-an-id', {}, asStaff),
        // An ID that is none, and a request without the reason.
        await voidSale('not-an-id', {}),
        // A request without the reason, for a sale that is not there.
        await voidSale(UNKNOWN_ID, {}),
        // A sale that is not there.
        await voidSale(UNKNOWN_ID),
        // A void sale with a payment that holds money.
        await voidSale(voidId),
        // A sale with a payment that holds money.
        await voidSale(entered.id),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '400 2001',
        '404 3001',
        '409 3003',
        '409 3003',
      ])
      expect(responses[2]?.body.detail).toBe(INVALID_ID)
      expect(responses[3]?.body.detail).toBe(INVALID_VOID)
      expect(responses[5]?.body.detail).toBe(VOID_ALREADY)
      expect(responses[6]?.body.detail).toBe(NOT_REFUNDED)
    })
  })

  describe('who corrects and who voids a sale', () => {
    it.each(unauthenticated)(
      'answers %s with 401 before looking at anything else, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const entered = await created()
        const before = await everythingOf(entered.id)
        const authorization = await tokenOf()

        const responses = [
          await update(entered.id, { notes: 'レジ2' }, authorization),
          await update('not-an-id', {}, authorization),
          await voidSale(entered.id, { voidReason: null }, authorization),
          await voidSale('not-an-id', {}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everythingOf(entered.id)).toEqual(before)
      },
    )

    it.each(keepers)(
      'lets %s correct a sale of the salon',
      async (_case, signInAs) => {
        const entered = await created()
        const authorization = await signInAs()

        const noted = await update(
          entered.id,
          { notes: 'レジ2' },
          authorization,
        )
        const relined = await update(
          entered.id,
          { details: [fee()] },
          authorization,
        )

        expect([noted, relined].map(statusAndCode)).toEqual(['200', '200'])
        expect(relined.body.data).toMatchObject({
          notes: 'レジ2',
          totalAmount: 550,
        })
      },
    )

    it.each(voiders)(
      'lets %s void a sale of the salon',
      async (_case, signInAs) => {
        const entered = await created()

        const response = await voidSale(
          entered.id,
          { voidReason: '二重登録' },
          await signInAs(),
        )

        expect(response.status).toBe(200)
        expect(response.body.data.isVoid).toBe(true)
      },
    )

    it('forbids a staff member of the salon the void, before looking at the ID or the request, and lets them correct the sale', async () => {
      const entered = await created()
      const asStaff = await member('staff')()

      const responses = [
        await voidSale(entered.id, { voidReason: '二重登録' }, asStaff),
        await voidSale(UNKNOWN_ID, { voidReason: null }, asStaff),
        await voidSale('not-an-id', { voidReason: null }, asStaff),
        await voidSale(entered.id, {}, asStaff),
      ]
      const corrected = await update(entered.id, { notes: 'レジ2' }, asStaff)

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(corrected.status).toBe(200)
      expect((await storedSale(entered.id)).isVoid).toBe(false)
    })

    it('forbids a staff member of another salon the void', async () => {
      const entered = await created()
      const authorization = await member('staff', salon)()

      const response = await voidSale(
        entered.id,
        { voidReason: null },
        authorization,
      )

      expectProblem(response, forbidden)
    })

    it.each(notKeepers)(
      'forbids %s both, before looking at the ID or the request',
      async (_case, signInAs) => {
        const entered = await created()
        const before = await everythingOf(entered.id)
        const authorization = await signInAs()

        const responses = [
          await update(entered.id, { notes: 'レジ2' }, authorization),
          await update(UNKNOWN_ID, { notes: 'レジ2' }, authorization),
          await update('not-an-id', {}, authorization),
          await voidSale(entered.id, { voidReason: null }, authorization),
          await voidSale(UNKNOWN_ID, { voidReason: null }, authorization),
          await voidSale('not-an-id', {}, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await everythingOf(entered.id)).toEqual(before)
      },
    )

    it('forbids a customer both also for what they paid themself', async () => {
      const ownCustomerId = await insertCustomer(db)
      const { authorization } = await signedInUser(app, db, {
        customerId: ownCustomerId,
      })
      const own = await created({ customerId: ownCustomerId })

      const responses = [
        await update(own.id, { notes: 'ありがとう' }, authorization),
        await voidSale(own.id, { voidReason: null }, authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const entered = await created()
      const notJson = (call: Test, authorization: string | null): Test =>
        authorized(call, authorization)
          .set('Content-Type', 'application/json')
          .send('{"notes": ')

      const responses = [
        await notJson(request(app).patch(`${SALES}/${entered.id}`), null),
        await notJson(request(app).post(`${SALES}/${entered.id}/void`), null),
        await notJson(request(app).patch(`${SALES}/${entered.id}`), asAdmin),
        await authorized(request(app).patch(`${SALES}/${entered.id}`), null)
          .set('Content-Type', 'text/plain')
          .send('a note'),
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

    const holdBooking = (tx: Transaction, id: string) =>
      tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, id))
        .for('update')

    /**
     * The response of a request that is sent while the test holds rows it
     * must not wait for; null when it waits for them after all.
     */
    const unlessItWaits = (call: Test): Promise<Response | null> =>
      Promise.race([
        call.then((response) => response),
        pause(2_000).then(() => null),
      ])

    it('voids a sale once when six requests arrive together', async () => {
      const entered = await created()

      const responses = await Promise.all(
        Array.from({ length: 6 }, (_value, index) =>
          voidSale(entered.id, { voidReason: `取消 ${index}` }),
        ),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      const done = responses.find((response) => response.status === 200)
      expect((await storedSale(entered.id)).voidReason).toBe(
        done?.body.data.voidReason,
      )
    })

    it('lets one of six sales take a booking that all of them are corrected to at the same moment', async () => {
      const bookingId = await insertBooking()
      const entered = await Promise.all(
        Array.from({ length: 6 }, () => created()),
      )

      const responses = await Promise.all(
        entered.map(({ id }) => update(id, { bookingId })),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(
        await db.$count(
          sales,
          and(eq(sales.bookingId, bookingId), not(sales.isVoid)),
        ),
      ).toBe(1)
    })

    it('bills a booking once when a sale is corrected to it while another is entered for it', async () => {
      const bookingId = await insertBooking()
      const entered = await created()

      const responses = await Promise.all([
        update(entered.id, { bookingId }),
        create(sale({ bookingId })),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual(
        expect.arrayContaining(['409 3003']),
      )
      expect(
        responses.filter((response) => response.status < 300),
      ).toHaveLength(1)
      expect(
        await db.$count(
          sales,
          and(eq(sales.bookingId, bookingId), not(sales.isVoid)),
        ),
      ).toBe(1)
    })

    it('writes every one of the corrections of one sale that arrive together, one after the other', async () => {
      const entered = await created({ notes: 'レジ1' })
      const otherStaffId = await staffMember()

      const responses = await Promise.all([
        update(entered.id, { notes: 'レジ2' }),
        update(entered.id, { staffId: otherStaffId }),
        update(entered.id, { pointsEarned: 66 }),
        update(entered.id, { saleTime: at('16:00') }),
      ])

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200', '200'])
      expect(await storedSale(entered.id)).toMatchObject({
        notes: 'レジ2',
        staffId: otherStaffId,
        pointsEarned: 66,
        saleDate: '2026-11-21',
      })
    })

    it('leaves the lines of one request, with what they come to, when six requests replace the lines together', async () => {
      const entered = await created()
      /** That many fees of 500 yen and 50 of tax. */
      const fees = (count: number) =>
        Array.from({ length: count }, (_value, sortOrder) => fee({ sortOrder }))

      const responses = await Promise.all(
        [1, 2, 3, 4, 5, 6].map((count) =>
          update(entered.id, { details: fees(count) }),
        ),
      )
      const stored = await everythingOf(entered.id)

      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200, 200, 200, 200,
      ])
      expect(stored.details.map((row) => row.sortOrder)).toEqual(
        stored.details.map((_row, index) => index),
      )
      expect(stored.sale).toMatchObject([
        {
          subtotal: stored.details.length * 500,
          taxAmount: stored.details.length * 50,
          totalAmount: stored.details.length * 550,
        },
      ])
    })

    it('ends with a void sale whose lines are those of one request when a correction and a void arrive together', async () => {
      const entered = await created()

      const [corrected, voidedNow] = await Promise.all([
        update(entered.id, { details: [fee(), fee({ sortOrder: 1 })] }),
        voidSale(entered.id),
      ])
      const stored = await everythingOf(entered.id)

      expect(voidedNow.status).toBe(200)
      // The correction came first, or it met a void sale.
      expect(['200', '409 3003']).toContain(statusAndCode(corrected))
      expect(stored.sale).toMatchObject([{ isVoid: true }])
      expect(stored.details).toHaveLength(corrected.status === 200 ? 2 : 1)
      expect(stored.sale[0]?.totalAmount).toBe(
        corrected.status === 200 ? 1100 : 6600,
      )
    })

    it('makes a correction wait for whoever holds the sale, and meet what they left', async () => {
      const entered = await created()

      const { pending, until } = await db.transaction(async (tx) => {
        await holdSale(tx, entered.id)
        const underWay = update(entered.id, { notes: 'レジ2' }).then(
          (response) => response,
        )
        await pause(300)
        await tx.update(sales).set(voided).where(eq(sales.id, entered.id))

        return { pending: underWay, until: await databaseClock() }
      })
      const response = await pending

      expect(until).toBeGreaterThan(0)
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(SALE_IS_VOID)
      expect((await storedSale(entered.id)).notes).toBeNull()
    })

    it('writes the time of a change that waited as the time after the wait', async () => {
      const toCorrect = await created()
      const toVoid = await created()

      const { pending, until } = await db.transaction(async (tx) => {
        await holdSale(tx, toCorrect.id)
        await holdSale(tx, toVoid.id)
        const underWay = Promise.all([
          update(toCorrect.id, { notes: 'レジ2' }),
          voidSale(toVoid.id),
        ])
        await pause(300)

        return { pending: underWay, until: await databaseClock() }
      })
      const [corrected, voidedNow] = await pending
      const after = await databaseClock()

      expect([corrected, voidedNow].map(statusAndCode)).toEqual(['200', '200'])
      expectBetween(corrected.body.data.updatedAt, until, after)
      expectBetween(voidedNow.body.data.voidedAt, until, after)
      expectBetween(voidedNow.body.data.updatedAt, until, after)
    })

    it('makes a void wait for a payment that is being written, and meet it', async () => {
      const entered = await created()
      const methodId = await insertPaymentMethod()

      const { pending, voidWhileWaiting } = await db.transaction(async (tx) => {
        // The foreign key of the payment holds the sale it is of.
        await insertPayment(entered.id, methodId, {}, tx)
        const underWay = voidSale(entered.id).then((response) => response)
        await pause(300)

        return {
          pending: underWay,
          voidWhileWaiting: (await storedSale(entered.id)).isVoid,
        }
      })
      const response = await pending

      expect(voidWhileWaiting).toBe(false)
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(NOT_REFUNDED)
      expect((await storedSale(entered.id)).isVoid).toBe(false)
    })

    it('voids a sale whose payment was not written after all', async () => {
      const entered = await created()
      const methodId = await insertPaymentMethod()
      const abandoned = new Error('The payment is not written')

      let pending: Promise<Response> | undefined
      await db
        .transaction(async (tx) => {
          await insertPayment(entered.id, methodId, {}, tx)
          pending = voidSale(entered.id).then((response) => response)
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
      expect(await db.$count(paymentTransactions)).toBe(0)
    })

    it('holds the sale before the booking: a correction that waits for a booking has hold of its sale', async () => {
      const bookingId = await insertBooking()
      const entered = await created()

      const { pending, saleWasFree } = await db.transaction(async (tx) => {
        await holdBooking(tx, bookingId)
        const underWay = update(entered.id, { bookingId }).then(
          (response) => response,
        )
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

    it('holds no booking for a correction that names neither the booking nor the customer', async () => {
      const bookingId = await insertBooking()
      const entered = await created({ bookingId })

      const response = await db.transaction(async (tx) => {
        await holdBooking(tx, bookingId)

        return unlessItWaits(
          update(entered.id, { notes: 'レジ2', details: [fee()] }),
        )
      })

      expect(response?.status).toBe(200)
    })

    // A delete of a salon, of a customer or of a staff member holds the row
    // like this. A change that waited for one of them would hold a sale and
    // wait for a row that the entry of a sale holds before it.
    it('holds neither the salon of the sale nor a customer or a staff member that the request does not name', async () => {
      const toCorrect = await created()
      const toVoid = await created()

      const responses = await db.transaction(async (tx) => {
        await tx
          .select({ id: salons.id })
          .from(salons)
          .where(eq(salons.id, salonId))
          .for('update')
        await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, customerId))
          .for('update')
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, staffId))
          .for('update')

        return [
          await unlessItWaits(
            update(toCorrect.id, {
              notes: 'レジ2',
              saleTime: at('16:00'),
              details: [fee()],
            }),
          ),
          await unlessItWaits(voidSale(toVoid.id)),
        ]
      })

      expect(responses.map((response) => response?.status)).toEqual([200, 200])
    })

    it('holds the booking the sale keeps for a correction that names the customer only', async () => {
      const bookingId = await insertBooking()
      const entered = await created({ bookingId })

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdBooking(tx, bookingId)
          const underWay = update(entered.id, { customerId }).then(
            (response) => response,
          )

          return {
            pending: underWay,
            answeredWhileHeld: await Promise.race([
              underWay.then(() => true),
              pause(300).then(() => false),
            ]),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
    })

    it('meets the sale that was entered for the booking while it waited for the booking', async () => {
      const bookingId = await insertBooking()
      const entered = await created()

      const { pending } = await db.transaction(async (tx) => {
        await holdBooking(tx, bookingId)
        const underWay = update(entered.id, { bookingId }).then(
          (response) => response,
        )
        await pause(300)
        await insertSale({ bookingId }, tx)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(BOOKING_IS_BILLED)
      expect((await storedSale(entered.id)).bookingId).toBeNull()
    })

    it('does not find a booking that was deleted while it waited for it', async () => {
      const bookingId = await insertBooking()
      const entered = await created()

      const { pending } = await db.transaction(async (tx) => {
        await holdBooking(tx, bookingId)
        const underWay = update(entered.id, { bookingId }).then(
          (response) => response,
        )
        await pause(300)
        await tx.delete(bookings).where(eq(bookings.id, bookingId))

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        issue('bookingId', 'not_found', NOT_THE_BOOKING),
      ])
    })

    it('does not find a customer or a staff member who was deleted while it waited for them', async () => {
      const entered = await created()
      const otherCustomerId = await insertCustomer(db)
      const otherStaffId = await staffMember()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, otherCustomerId))
          .for('update')
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, otherStaffId))
          .for('update')
        const underWay = Promise.all([
          update(entered.id, { customerId: otherCustomerId }),
          update((await created()).id, { staffId: otherStaffId }),
        ])
        await pause(300)
        await tx
          .update(customers)
          .set(deleted)
          .where(eq(customers.id, otherCustomerId))
        await tx.update(staff).set(deleted).where(eq(staff.id, otherStaffId))

        return { pending: underWay }
      })
      const [ofCustomer, ofStaff] = await pending

      expectProblem(ofCustomer, badRequest)
      expect(brokenRules(ofCustomer)).toEqual(['customerId:not_found'])
      expectProblem(ofStaff, badRequest)
      expect(brokenRules(ofStaff)).toEqual(['staffId:not_found'])
    })

    // An entry of a sale and a booking hold their staff members in the
    // order of their IDs; so does a correction.
    it('takes hold of its staff members in the order of their IDs, as an entry does', async () => {
      const later = staffId
      const earlier = await staffMember({ id: FIRST_ID })
      const entered = await created()

      const { pending, laterWasFree } = await db.transaction(async (tx) => {
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, earlier))
          .for('update')
        const underWay = update(entered.id, {
          staffId: later,
          details: [line({ staffId: earlier })],
        }).then((response) => response)
        await pause(300)
        // Nobody holds the later one: the correction waits for the earlier one first.
        const free = await isFree(tx, (nested) =>
          nested
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, later))
            .for('update', { noWait: true }),
        )

        return { pending: underWay, laterWasFree: free }
      })
      const response = await pending

      expect(laterWasFree).toBe(true)
      expect(response.status).toBe(200)
    })

    it('answers every one of six corrections to a booking and six deletes of those bookings, and neither waits for the other for ever', async () => {
      const pairs = await Promise.all(
        Array.from({ length: 6 }, async () => ({
          bookingId: await insertBooking(),
          saleId: (await created()).id,
        })),
      )

      const responses = await Promise.all(
        pairs.flatMap(({ bookingId, saleId }) => [
          update(saleId, { bookingId }),
          removeBooking(bookingId),
        ]),
      )

      for (const [index, { bookingId, saleId }] of pairs.entries()) {
        const outcome = [
          statusAndCode(responses[index * 2] ?? (await read(UNKNOWN_ID))),
          statusAndCode(responses[index * 2 + 1] ?? (await read(UNKNOWN_ID))),
        ]
        // The sale took the booking and the delete met the sale, or the
        // booking was gone when the sale asked for it.
        expect([
          ['200', '409 3003'],
          ['400 2001', '204'],
        ]).toContainEqual(outcome)
        expect((await storedSale(saleId)).bookingId).toBe(
          outcome[0] === '200' ? bookingId : null,
        )
      }
    })
  })

  describe('SaleRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new SaleRepository(db)
    const everySalon: LedgerReach = { type: 'everySalon' }
    const salonOnly = (id: string): LedgerReach => ({
      type: 'salon',
      salonId: salonIdSchema.parse(id),
    })
    type Line = NonNullable<RequestedSaleChange['details']>[number]
    /** A line as the use case hands it on: a fee of 500 yen and 50 of tax. */
    const feeOf = (): Line => ({
      itemType: 'fee',
      itemId: null,
      itemName: '指名料',
      quantity: 1,
      unitPrice: 500,
      discountAmount: 0,
      taxAmount: 50,
      totalAmount: 550,
      staffId: null,
      commissionRate: null,
      commissionAmount: null,
      notes: null,
      sortOrder: 0,
    })

    describe('update', () => {
      it('corrects a sale within the reach and returns it with its lines and payments', async () => {
        const entered = await created()
        const paymentId = await insertPayment(
          entered.id,
          await insertPaymentMethod(),
          { status: 'failed' },
        )

        const outcome = dataOf(
          await repository().update(
            saleIdSchema.parse(entered.id),
            salonOnly(salonId),
            { notes: 'レジ2', details: [feeOf()] },
          ),
        )

        expect(outcome).toMatchObject({
          type: 'updated',
          sale: {
            sale: { id: entered.id, notes: 'レジ2', totalAmount: 550 },
            details: [{ itemName: '指名料' }],
            payments: [{ id: paymentId }],
          },
        })
      })

      it('finds no sale outside the reach, and changes nothing', async () => {
        const entered = await created()
        const before = await everythingOf(entered.id)

        const outcomes = [
          dataOf(
            await repository().update(
              saleIdSchema.parse(entered.id),
              salonOnly(await salon()),
              { notes: 'レジ2' },
            ),
          ),
          dataOf(
            await repository().update(
              saleIdSchema.parse(UNKNOWN_ID),
              everySalon,
              { notes: 'レジ2' },
            ),
          ),
        ]

        expect(outcomes).toEqual([{ type: 'notFound' }, { type: 'notFound' }])
        expect(await everythingOf(entered.id)).toEqual(before)
      })

      it('says why a sale is not corrected', async () => {
        const bookingId = await insertBooking()
        await created({ bookingId })
        const entered = await created()
        const corrected = (id: string, change: RequestedSaleChange) =>
          repository()
            .update(saleIdSchema.parse(id), everySalon, change)
            .then(dataOf)

        const outcomes = [
          await corrected(await insertSale(voided), { notes: 'レジ2' }),
          await corrected(await insertSale({ paymentStatus: 'completed' }), {
            details: [feeOf()],
          }),
          await corrected(entered.id, {
            staffId: staffIdSchema.parse(UNKNOWN_ID),
          }),
          await corrected(entered.id, {
            bookingId: bookingIdSchema.parse(bookingId),
          }),
        ]

        expect(outcomes).toEqual([
          { type: 'void' },
          { type: 'paymentBegun' },
          {
            type: 'invalid',
            issues: [
              { field: 'staffId', rule: 'not_found', message: NOT_STAFF },
            ],
          },
          { type: 'bookingBilled' },
        ])
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new SaleRepository(connection.database).update(
          saleIdSchema.parse(UNKNOWN_ID),
          everySalon,
          { notes: 'レジ2' },
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to update sale' },
        })
      })
    })

    describe('voidSale', () => {
      it('voids a sale within the reach and returns it', async () => {
        const entered = await created()

        const outcome = dataOf(
          await repository().voidSale(
            saleIdSchema.parse(entered.id),
            salonOnly(salonId),
            { voidReason: '二重登録' },
          ),
        )

        expect(outcome).toMatchObject({
          type: 'voided',
          sale: {
            sale: { id: entered.id, isVoid: true, voidReason: '二重登録' },
            details: [{ itemName: 'カット' }],
            payments: [],
          },
        })
      })

      it('finds no sale outside the reach, and says why a sale is not voided', async () => {
        const entered = await created()
        const paid = await created()
        await insertPayment(paid.id, await insertPaymentMethod())
        const voidedBy = (id: string, reach: LedgerReach) =>
          repository()
            .voidSale(saleIdSchema.parse(id), reach, { voidReason: null })
            .then(dataOf)

        const outcomes = [
          await voidedBy(entered.id, salonOnly(await salon())),
          await voidedBy(UNKNOWN_ID, everySalon),
          await voidedBy(await insertSale(voided), everySalon),
          await voidedBy(paid.id, everySalon),
        ]

        expect(outcomes).toEqual([
          { type: 'notFound' },
          { type: 'notFound' },
          { type: 'void' },
          { type: 'paid' },
        ])
        expect((await storedSale(entered.id)).isVoid).toBe(false)
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new SaleRepository(connection.database).voidSale(
          saleIdSchema.parse(UNKNOWN_ID),
          everySalon,
          { voidReason: null },
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to void sale' },
        })
      })
    })
  })
})
