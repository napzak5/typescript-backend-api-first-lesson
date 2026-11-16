import {
  bookings,
  customerPoints,
  customers,
  inventoryTransactions,
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
  customerIdSchema,
  type DomainError,
  type LedgerReach,
  type SaleCreateRequest,
  saleIdSchema,
  salonIdSchema,
  staffIdSchema,
} from '@beauty-salon-backend/domain'
import { SaleRepository } from '@beauty-salon-backend/infrastructure'
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

const SALES = '/api/v1/sales'
const BOOKINGS = '/api/v1/bookings'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

/**
 * A UUID that comes before every one the database makes up: a row that is
 * given it is the first of its table by ID, and not by where it lies.
 */
const FIRST_ID = '00000000-0000-4000-8000-000000000001'

/** `SL-XXXX-XXXX` in the symbols of Crockford's Base32. */
const SALE_NUMBER = /^SL-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

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

const INVALID_SALE = 'Invalid sale'
const INVALID_SEARCH = 'Invalid sale search'
const BOOKING_IS_BILLED =
  'The booking has a sale that is not void; a booking is billed once'
const TIME_ZONE_UNKNOWN =
  'The time zone of the salon is not one that is known, so the day of the sale cannot be told; correct the time zone of the salon first'
const NOT_THE_BOOKING =
  'Must name a booking of the salon that is of the customer of the sale'

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

/** The properties of a SalesDetail. */
const DETAIL_PROPERTIES = [
  'commissionAmount',
  'commissionRate',
  'discountAmount',
  'itemId',
  'itemName',
  'itemType',
  'notes',
  'quantity',
  'sortOrder',
  'staffId',
  'taxAmount',
  'totalAmount',
  'unitPrice',
]

/** The properties of a PaymentResponse. */
const PAYMENT_PROPERTIES = [
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

describe('Sales API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** A signed-in admin. */
  let admin: { id: string; authorization: string }
  /** The Authorization header of the admin. */
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
  type NewSalesDetail = typeof salesDetails.$inferInsert
  type NewPayment = typeof paymentTransactions.$inferInsert
  type Executor = Pick<typeof db, 'insert'>

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
    admin = await signedInUser(app, db, { role: 'admin' })
    asAdmin = admin.authorization
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

  /** Lists sales; as the admin unless said otherwise. */
  const list = (
    query: Record<string, string> = {},
    as: string | null = asAdmin,
  ) => authorized(request(app).get(SALES).query(query), as)

  /** The sale a request created; anything but 201 fails the test. */
  const created = async (
    overrides: Record<string, unknown> = {},
    as: string = asAdmin,
  ) => {
    const response = await create(sale(overrides), as)
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** A sale of one cut at that time. */
  const soldAt = (time: string, overrides: Record<string, unknown> = {}) =>
    created({ saleTime: at(time), ...overrides })

  const storedSales = () =>
    db.select().from(sales).orderBy(asc(sales.saleTime), asc(sales.id))

  const storedDetails = () =>
    db
      .select()
      .from(salesDetails)
      .orderBy(asc(salesDetails.saleId), asc(salesDetails.sortOrder))

  /** Checks that nothing of a sale is stored. */
  const expectNothingStored = async (): Promise<void> => {
    expect(await db.$count(sales)).toBe(0)
    expect(await db.$count(salesDetails)).toBe(0)
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

  /** A row of `sales_details` that keeps every constraint: the cut of the row above. */
  const detailRow = (
    saleId: string,
    overrides: Partial<NewSalesDetail> = {},
  ): NewSalesDetail => ({
    saleId,
    itemType: 'service',
    itemId: cutId,
    itemName: 'カット',
    quantity: 1,
    unitPrice: 6000,
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
  ): Promise<string> => {
    const [payment] = await db
      .insert(paymentTransactions)
      .values({
        saleId,
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

  /** Signs in as a new member of a salon; of the salon of the tests unless another is given. */
  const signedInMember = (
    role: 'owner' | 'manager' | 'staff',
    salonOf: () => Promise<string> = async () => salonId,
  ): Promise<string> => member(role, salonOf)()

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

  /** A signed-in customer with a profile. */
  const customerAccount = async (): Promise<{
    authorization: string
    customerId: string
  }> => {
    const ownCustomerId = await insertCustomer(db)
    const { authorization } = await signedInUser(app, db, {
      customerId: ownCustomerId,
    })
    return { authorization, customerId: ownCustomerId }
  }

  /** Accounts the ledger is closed to. */
  const notKeepers: [string, SignInAs][] = [
    [
      'a customer with a profile',
      async () => (await customerAccount()).authorization,
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

  describe('POST /api/v1/sales', () => {
    it('enters a sale and returns it with its lines, what the system set, and where it is', async () => {
      const other = await staffMember()
      const bookingId = await insertBooking()

      const response = await create(
        sale({
          bookingId,
          pointsUsed: 100,
          pointsEarned: 126,
          notes: '現金でお支払い',
          details: [
            line({ commissionRate: 40, commissionAmount: 2400 }),
            line({
              itemType: 'product',
              itemId: shampooId,
              itemName: 'シャンプー',
              quantity: 2,
              unitPrice: 2800,
              discountAmount: 600,
              taxAmount: 500,
              totalAmount: 5500,
              staffId: other,
              commissionRate: 12.5,
              commissionAmount: 625,
              notes: 'セット割引',
              sortOrder: 1,
            }),
            fee({ sortOrder: 2 }),
          ],
        }),
      )

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      const { id } = response.body.data
      expect(response.headers['location']).toBe(`${SALES}/${id}`)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          saleNumber: expect.stringMatching(SALE_NUMBER),
          salonId,
          customerId,
          staffId,
          bookingId,
          saleDate: '2026-11-20',
          saleTime: written('03:40'),
          subtotal: 12100,
          discountAmount: 600,
          taxAmount: 1150,
          totalAmount: 12650,
          pointsUsed: 100,
          pointsEarned: 126,
          paymentStatus: 'pending',
          isVoid: false,
          voidedAt: null,
          voidReason: null,
          notes: '現金でお支払い',
          details: [
            {
              itemType: 'service',
              itemId: cutId,
              itemName: 'カット',
              quantity: 1,
              unitPrice: 6000,
              discountAmount: 0,
              taxAmount: 600,
              totalAmount: 6600,
              staffId,
              commissionRate: 40,
              commissionAmount: 2400,
              notes: null,
              sortOrder: 0,
            },
            {
              itemType: 'product',
              itemId: shampooId,
              itemName: 'シャンプー',
              quantity: 2,
              unitPrice: 2800,
              discountAmount: 600,
              taxAmount: 500,
              totalAmount: 5500,
              staffId: other,
              commissionRate: 12.5,
              commissionAmount: 625,
              notes: 'セット割引',
              sortOrder: 1,
            },
            {
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
              sortOrder: 2,
            },
          ],
          payments: [],
          createdAt: expect.stringMatching(ISO_TIMESTAMP),
          updatedAt: expect.stringMatching(ISO_TIMESTAMP),
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${SALES}/${id}`, list: SALES },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
    })

    it('stores the sale and its lines', async () => {
      const { id, saleNumber } = await created({
        details: [
          line({ commissionRate: 33.33, commissionAmount: 1999 }),
          fee({ sortOrder: 1 }),
        ],
      })

      expect(await storedSales()).toEqual([
        expect.objectContaining({
          id,
          saleNumber,
          salonId,
          customerId,
          staffId,
          bookingId: null,
          saleDate: '2026-11-20',
          subtotal: 6500,
          discountAmount: 0,
          taxAmount: 650,
          totalAmount: 7150,
          pointsUsed: null,
          pointsEarned: null,
          paymentStatus: 'pending',
          isVoid: false,
          voidedAt: null,
          voidReason: null,
          notes: null,
        }),
      ])
      expect(await storedDetails()).toEqual([
        expect.objectContaining({
          saleId: id,
          itemType: 'service',
          itemId: cutId,
          itemName: 'カット',
          quantity: 1,
          unitPrice: 6000,
          discountAmount: 0,
          taxAmount: 600,
          totalAmount: 6600,
          staffId,
          commissionRate: '33.33',
          commissionAmount: 1999,
          notes: null,
          sortOrder: 0,
        }),
        expect.objectContaining({
          saleId: id,
          itemType: 'fee',
          itemId: null,
          staffId: null,
          commissionRate: null,
          commissionAmount: null,
          sortOrder: 1,
        }),
      ])
    })

    it('says where the sale is by the path alone, and takes nothing from a query', async () => {
      const response = await authorized(
        request(app).post(`${SALES}?notes=from-the-query`),
        asAdmin,
      ).send(sale())

      expect(response.status).toBe(201)
      const { id } = response.body.data
      expect(response.headers['location']).toBe(`${SALES}/${id}`)
      expect(response.body.links).toEqual({
        self: `${SALES}/${id}`,
        list: SALES,
      })
      expect(response.body.data.notes).toBeNull()
    })

    it('gives every sale a number of its own', async () => {
      const numbers = [
        (await soldAt('01:00')).saleNumber,
        (await soldAt('01:00')).saleNumber,
        (await soldAt('05:00')).saleNumber,
      ]

      expect(new Set(numbers).size).toBe(3)
      for (const number of numbers) {
        expect(number).toMatch(SALE_NUMBER)
      }
    })

    describe('what the system sets', () => {
      it('sums the sale up from its lines, every piece of a line counted', async () => {
        const data = await created({
          details: [
            line({
              quantity: 3,
              unitPrice: 1200,
              discountAmount: 600,
              taxAmount: 300,
              totalAmount: 3300,
            }),
            fee({ sortOrder: 1 }),
            fee({
              sortOrder: 2,
              unitPrice: 0,
              taxAmount: 0,
              totalAmount: 0,
            }),
          ],
        })

        expect(data).toMatchObject({
          subtotal: 4100,
          discountAmount: 600,
          taxAmount: 350,
          totalAmount: 3850,
        })
      })

      it.each([
        [
          'the last moment of a day in Tokyo',
          '2026-11-19T14:59:59.999Z',
          'Asia/Tokyo',
          '2026-11-19',
        ],
        [
          'midnight in Tokyo',
          '2026-11-19T15:00:00Z',
          'Asia/Tokyo',
          '2026-11-20',
        ],
        [
          'the evening before in Los Angeles',
          '2026-11-20T03:40:00Z',
          'America/Los_Angeles',
          '2026-11-19',
        ],
        ['the same moment in UTC', '2026-11-20T03:40:00Z', 'UTC', '2026-11-20'],
      ])(
        'takes the day of the sale from the time zone of the salon: %s',
        async (_case, saleTime, timezone, saleDate) => {
          const there = await salon({ timezone })

          const data = await created({
            salonId: there,
            staffId: null,
            saleTime,
            details: [fee()],
          })

          expect(data.saleDate).toBe(saleDate)
          expect(new Date(data.saleTime).getTime()).toBe(
            new Date(saleTime).getTime(),
          )
        },
      )

      it('begins every sale unpaid, not void and without a payment', async () => {
        expect(await created()).toMatchObject({
          paymentStatus: 'pending',
          isVoid: false,
          voidedAt: null,
          voidReason: null,
          payments: [],
        })
      })

      it('returns the lines by their places, in whatever order the request states them, in the list as well', async () => {
        const data = await created({
          details: [
            fee({ sortOrder: 7, itemName: 'third' }),
            fee({ sortOrder: 0, itemName: 'first' }),
            fee({ sortOrder: 3, itemName: 'second' }),
          ],
        })
        const got = await read(data.id)
        const listed = await list()

        for (const { details } of [data, got.body.data, listed.body.data[0]]) {
          expect(
            details.map(({ itemName, sortOrder }: Record<string, unknown>) => [
              itemName,
              sortOrder,
            ]),
          ).toEqual([
            ['first', 0],
            ['second', 3],
            ['third', 7],
          ])
        }
      })
    })

    describe('what a request may be', () => {
      it('accepts a sale to nobody, of nobody, with a line of no record', async () => {
        const data = await created({
          customerId: null,
          staffId: null,
          details: [fee()],
        })

        expect(data).toMatchObject({
          customerId: null,
          staffId: null,
          bookingId: null,
          pointsUsed: null,
          pointsEarned: null,
          notes: null,
          details: [
            {
              itemId: null,
              staffId: null,
              commissionRate: null,
              commissionAmount: null,
              notes: null,
            },
          ],
        })
      })

      it('accepts a line of a service or a product without the record it is of', async () => {
        const data = await created({
          details: [
            line({ itemId: null }),
            line({ itemType: 'product', itemId: null, sortOrder: 1 }),
          ],
        })

        expect(
          data.details.map(({ itemId }: { itemId: unknown }) => itemId),
        ).toEqual([null, null])
      })

      it('accepts a time long past and a time to come: the ledger is the salon’s to keep', async () => {
        const past = await created({ saleTime: '2019-01-06T01:00:00Z' })
        const toCome = await created({ saleTime: '2031-12-31T23:59:59Z' })

        expect(past).toMatchObject({
          saleDate: '2019-01-06',
          saleTime: '2019-01-06T01:00:00.000Z',
        })
        expect(toCome).toMatchObject({
          saleDate: '2032-01-01',
          saleTime: '2031-12-31T23:59:59.000Z',
        })
      })

      it('accepts points of 0 for a customer, and keeps them apart from none', async () => {
        const data = await created({ pointsUsed: 0, pointsEarned: 0 })

        expect(data).toMatchObject({ pointsUsed: 0, pointsEarned: 0 })
        expect(await storedSales()).toEqual([
          expect.objectContaining({ pointsUsed: 0, pointsEarned: 0 }),
        ])
      })

      it('accepts a discount of the whole price, and a line that costs nothing', async () => {
        const data = await created({
          details: [
            line({ discountAmount: 6000, taxAmount: 0, totalAmount: 0 }),
          ],
        })

        expect(data).toMatchObject({
          subtotal: 6000,
          discountAmount: 6000,
          taxAmount: 0,
          totalAmount: 0,
        })
      })

      it('reads the IDs of a request in capitals as the IDs they are', async () => {
        const bookingId = await insertBooking()

        const data = await created({
          salonId: salonId.toUpperCase(),
          customerId: customerId.toUpperCase(),
          staffId: staffId.toUpperCase(),
          bookingId: bookingId.toUpperCase(),
          details: [
            line({
              itemId: cutId.toUpperCase(),
              staffId: staffId.toUpperCase(),
            }),
            line({
              itemType: 'product',
              itemId: shampooId.toUpperCase(),
              sortOrder: 1,
            }),
          ],
        })

        expect(data).toMatchObject({
          salonId,
          customerId,
          staffId,
          bookingId,
          details: [{ itemId: cutId, staffId }, { itemId: shampooId }],
        })
      })

      it('accepts a hundred lines and a sale that comes to what an integer column holds', async () => {
        const hundred = await create(
          sale({
            details: Array.from({ length: 100 }, (_value, sortOrder) =>
              fee({ sortOrder }),
            ),
          }),
        )
        const largest = await created({
          details: [
            fee({
              unitPrice: MAX_INTEGER - 1,
              taxAmount: 0,
              totalAmount: MAX_INTEGER - 1,
            }),
            fee({ sortOrder: 1, unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
          ],
        })

        expect(hundred.status).toBe(201)
        expect(hundred.body.data.details).toHaveLength(100)
        expect(hundred.body.data.totalAmount).toBe(55_000)
        expect(largest).toMatchObject({
          subtotal: MAX_INTEGER,
          totalAmount: MAX_INTEGER,
        })
      })

      // What the salon enters is held to what keeps the ledger sound, and
      // not to what is offered or who works now.
      it.each<[string, () => Promise<Record<string, unknown>>]>([
        [
          'a staff member who does not work at the salon now',
          async () => {
            const id = await staffMember({ isActive: false })
            return { staffId: id, details: [line({ staffId: id })] }
          },
        ],
        [
          'a service that is not offered now',
          async () => ({
            details: [
              line({
                itemId: await insertService({
                  isActive: false,
                  serviceStatus: 'inactive',
                  allowOnlineBooking: false,
                }),
              }),
            ],
          }),
        ],
        [
          'a product that is not for sale now',
          async () => ({
            details: [
              line({
                itemType: 'product',
                itemId: await insertProduct({
                  isForSale: false,
                  isActive: false,
                }),
              }),
            ],
          }),
        ],
        [
          'a customer who is not active',
          async () => {
            const id = await insertCustomer(db)
            await db
              .update(customers)
              .set({ isActive: false })
              .where(eq(customers.id, id))
            return { customerId: id }
          },
        ],
        [
          'a price that is not the price of the service',
          async () => ({
            details: [line({ unitPrice: 1, taxAmount: 0, totalAmount: 1 })],
          }),
        ],
        [
          'a tax that is not the rate of the salon',
          async () => ({
            details: [line({ taxAmount: 1, totalAmount: 6001 })],
          }),
        ],
      ])('accepts %s', async (_case, overridesOf) => {
        const response = await create(sale(await overridesOf()))

        expect(response.status).toBe(201)
      })
    })

    describe('what a request must be', () => {
      it.each(Object.keys(sale({ details: [] })))(
        'requires %s: nothing of a new sale is optional',
        async (property) => {
          const {
            [property]: _omitted,
            ...incomplete
          }: Record<string, unknown> = sale()

          const response = await create(incomplete)

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_SALE)
          expect(brokenRules(response)).toEqual([`${property}:invalid_type`])
          await expectNothingStored()
        },
      )

      it.each<[string, () => Record<string, unknown>, string[]]>([
        [
          'a sale number of the client',
          () => ({ saleNumber: 'SL-0000-0001' }),
          ['saleNumber:unrecognized_keys'],
        ],
        [
          'sums of the client',
          () => ({ subtotal: 1, totalAmount: 1 }),
          ['subtotal:unrecognized_keys', 'totalAmount:unrecognized_keys'],
        ],
        [
          'a payment status',
          () => ({ paymentStatus: 'completed' }),
          ['paymentStatus:unrecognized_keys'],
        ],
        ['a void sale', () => ({ isVoid: true }), ['isVoid:unrecognized_keys']],
        [
          'a day of the sale',
          () => ({ saleDate: '2026-11-21' }),
          ['saleDate:unrecognized_keys'],
        ],
        ['no line', () => ({ details: [] }), ['details:too_small']],
        [
          'a hundred and one lines',
          () => ({
            details: Array.from({ length: 101 }, (_value, sortOrder) =>
              fee({ sortOrder }),
            ),
          }),
          ['details:too_big'],
        ],
        [
          'a line with an ID of its own',
          () => ({ details: [line({ id: UNKNOWN_ID })] }),
          ['details.0.id:unrecognized_keys'],
        ],
        [
          'a quantity of none',
          () => ({ details: [line({ quantity: 0 })] }),
          ['details.0.quantity:too_small', 'details.0.totalAmount:custom'],
        ],
        [
          'a negative price',
          () => ({ details: [line({ unitPrice: -1 })] }),
          ['details.0.unitPrice:too_small'],
        ],
        [
          'a price with a fraction',
          () => ({ details: [line({ unitPrice: 6000.5 })] }),
          ['details.0.unitPrice:invalid_type'],
        ],
        [
          'a discount of more than the price',
          () => ({
            details: [
              line({ discountAmount: 6001, taxAmount: 1, totalAmount: 0 }),
            ],
          }),
          ['details.0.discountAmount:custom'],
        ],
        [
          'a total that is not what the line comes to',
          () => ({ details: [line({ totalAmount: 6601 })] }),
          ['details.0.totalAmount:custom'],
        ],
        [
          'a commission rate of more than a hundred',
          () => ({ details: [line({ commissionRate: 100.01 })] }),
          ['details.0.commissionRate:too_big'],
        ],
        [
          'a commission rate with three decimal places',
          () => ({ details: [line({ commissionRate: 12.345 })] }),
          ['details.0.commissionRate:not_multiple_of'],
        ],
        [
          'two lines at one place',
          () => ({ details: [line(), fee(), fee({ sortOrder: 1 })] }),
          ['details.1.sortOrder:custom'],
        ],
        [
          'an ID for a line that is neither of a service nor of a product',
          () => ({ details: [fee({ itemId: UNKNOWN_ID })] }),
          ['details.0.itemId:custom'],
        ],
        [
          'a line without a name',
          () => ({ details: [line({ itemName: ' ' })] }),
          ['details.0.itemName:invalid_format'],
        ],
        [
          'points for a sale to nobody',
          () => ({ customerId: null, pointsUsed: 0, pointsEarned: 10 }),
          ['pointsUsed:custom', 'pointsEarned:custom'],
        ],
        [
          'notes that say nothing',
          () => ({ notes: '  ' }),
          ['notes:invalid_format'],
        ],
        [
          'a time in another zone than UTC',
          () => ({ saleTime: '2026-11-20T12:40:00+09:00' }),
          ['saleTime:invalid_format'],
        ],
        [
          'a salon that is no ID',
          () => ({ salonId: 'aoyama' }),
          ['salonId:invalid_format'],
        ],
      ])('refuses %s', async (_case, overridesOf, rules) => {
        const response = await create(sale(overridesOf()))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SALE)
        expect(brokenRules(response)).toEqual(rules)
        await expectNothingStored()
      })

      it('says what is wrong with a line in words', async () => {
        const response = await create(
          sale({
            details: [
              line({ discountAmount: 6001, taxAmount: 0, totalAmount: 1 }),
              fee({ itemId: UNKNOWN_ID }),
            ],
          }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'details.0.discountAmount',
            'custom',
            'Must not be more than quantity times unitPrice',
          ),
          issue(
            'details.0.totalAmount',
            'custom',
            'Must be quantity times unitPrice, less discountAmount, plus taxAmount',
          ),
          issue(
            'details.1.itemId',
            'custom',
            'Must be null unless itemType is service or product',
          ),
          issue(
            'details.1.sortOrder',
            'custom',
            'Must not repeat the sortOrder of an earlier line',
          ),
        ])
      })

      it('refuses a request that is a list, and a body that is neither an object nor a list as one it cannot read', async () => {
        const send = (body: string): Test =>
          authorized(request(app).post(SALES), asAdmin)
            .set('Content-Type', 'application/json')
            .send(body)

        const responses = [
          await send('[]'),
          await send('null'),
          await send('"sale"'),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '400 2001',
          '400 2002',
          '400 2002',
        ])
        await expectNothingStored()
      })

      it('refuses a sale whose lines come to more than an integer column holds', async () => {
        const response = await create(
          sale({
            details: [
              fee({
                unitPrice: MAX_INTEGER,
                taxAmount: 0,
                totalAmount: MAX_INTEGER,
              }),
              fee({ sortOrder: 1, unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
            ],
          }),
        )

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SALE)
        expect(response.body.errors).toEqual([
          issue(
            'details',
            'too_big',
            'The amounts of a sale must not exceed 2147483647',
          ),
        ])
        await expectNothingStored()
      })
    })

    describe('what a request refers to', () => {
      it.each<[string, () => Promise<string>]>([
        ['an ID that no salon has', async () => UNKNOWN_ID],
        ['a deleted salon', () => salon(deleted)],
        ['the ID of a customer', () => insertCustomer(db)],
      ])(
        'refuses %s for the salon, and says nothing of what would belong to it',
        async (_case, salonOf) => {
          const response = await create(sale({ salonId: await salonOf() }))

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID_SALE)
          expect(response.body.errors).toEqual([
            issue('salonId', 'not_found', 'Must name a salon'),
          ])
          await expectNothingStored()
        },
      )

      it('reports the customer next to a salon that is not there', async () => {
        const response = await create(
          sale({ salonId: UNKNOWN_ID, customerId: UNKNOWN_ID }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'salonId:not_found',
          'customerId:not_found',
        ])
      })

      it.each<[string, () => Promise<string>]>([
        ['an ID that no customer has', async () => UNKNOWN_ID],
        [
          'a deleted customer',
          async () => {
            const id = await insertCustomer(db)
            await db.update(customers).set(deleted).where(eq(customers.id, id))
            return id
          },
        ],
        ['the ID of a staff member', async () => staffId],
      ])('refuses %s for the customer', async (_case, customerOf) => {
        const response = await create(sale({ customerId: await customerOf() }))

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('customerId', 'not_found', 'Must name a customer'),
        ])
        await expectNothingStored()
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
        'refuses %s for the staff member in charge',
        async (_case, staffOf) => {
          const response = await create(sale({ staffId: await staffOf() }))

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue(
              'staffId',
              'not_found',
              'Must name a staff member of the salon',
            ),
          ])
          await expectNothingStored()
        },
      )

      it.each(notStaffOfTheSalon)(
        'refuses %s for the staff member of a line, under the line',
        async (_case, staffOf) => {
          const response = await create(
            sale({
              details: [
                line(),
                fee({ sortOrder: 1, staffId: await staffOf() }),
              ],
            }),
          )

          expectProblem(response, badRequest)
          expect(response.body.errors).toEqual([
            issue(
              'details.1.staffId',
              'not_found',
              'Must name a staff member of the salon',
            ),
          ])
          await expectNothingStored()
        },
      )

      it.each<[string, () => Promise<string>]>([
        ['an ID that no service has', async () => UNKNOWN_ID],
        ['a deleted service', () => insertService(deleted)],
        [
          'a service of another salon',
          async () => insertService({}, await salon()),
        ],
        ['the ID of a product of the salon', async () => shampooId],
      ])('refuses %s for the service of a line', async (_case, serviceOf) => {
        const response = await create(
          sale({ details: [line({ itemId: await serviceOf() })] }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'details.0.itemId',
            'not_found',
            'Must name a service of the salon',
          ),
        ])
        await expectNothingStored()
      })

      it.each<[string, () => Promise<string>]>([
        ['an ID that no product has', async () => UNKNOWN_ID],
        ['a deleted product', () => insertProduct(deleted)],
        [
          'a product of another salon',
          async () => insertProduct({}, await salon()),
        ],
        ['the ID of a service of the salon', async () => cutId],
      ])('refuses %s for the product of a line', async (_case, productOf) => {
        const response = await create(
          sale({
            details: [line({ itemType: 'product', itemId: await productOf() })],
          }),
        )

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue(
            'details.0.itemId',
            'not_found',
            'Must name a product of the salon',
          ),
        ])
        await expectNothingStored()
      })

      it.each<[string, () => Promise<Record<string, unknown>>]>([
        ['an ID that no booking has', async () => ({ bookingId: UNKNOWN_ID })],
        [
          'a booking of another salon',
          async () => {
            const elsewhere = await salon()
            return {
              bookingId: await insertBooking({
                salonId: elsewhere,
                staffId: await staffMember({}, elsewhere),
              }),
            }
          },
        ],
        [
          'the booking of another customer',
          async () => ({
            bookingId: await insertBooking({
              customerId: await insertCustomer(db),
            }),
          }),
        ],
        [
          'a booking for a sale to nobody',
          async () => ({
            customerId: null,
            bookingId: await insertBooking(),
          }),
        ],
        ['the ID of a customer', async () => ({ bookingId: customerId })],
      ])('refuses %s for the booking', async (_case, overridesOf) => {
        const response = await create(sale(await overridesOf()))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SALE)
        expect(response.body.errors).toEqual([
          issue('bookingId', 'not_found', NOT_THE_BOOKING),
        ])
        await expectNothingStored()
      })

      it('reports everything that is not there at once, the sale before its lines', async () => {
        const response = await create(
          sale({
            customerId: UNKNOWN_ID,
            staffId: UNKNOWN_ID,
            bookingId: UNKNOWN_ID,
            details: [
              line({ itemId: UNKNOWN_ID, staffId: UNKNOWN_ID }),
              line({
                itemType: 'product',
                itemId: UNKNOWN_ID,
                staffId: null,
                sortOrder: 1,
              }),
              line({ sortOrder: 2 }),
            ],
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'customerId:not_found',
          'staffId:not_found',
          'bookingId:not_found',
          'details.0.staffId:not_found',
          'details.0.itemId:not_found',
          'details.1.itemId:not_found',
        ])
        await expectNothingStored()
      })

      it.each<[string, Partial<NewBooking>]>([
        ['is pending', {}],
        ['is completed', { status: 'completed', completedAt: at('02:00') }],
        ['was cancelled', { status: 'cancelled', cancelledAt: at('00:30') }],
        ['the customer did not come to', { status: 'no_show' }],
      ])('enters the sale of a booking that %s', async (_case, booking) => {
        const bookingId = await insertBooking(booking)

        const data = await created({ bookingId })

        expect(data.bookingId).toBe(bookingId)
      })
    })

    it('writes the sale and nothing else: the booking, the customer, the product and the others are as they were', async () => {
      const bookingId = await insertBooking()
      const theRest = async () => ({
        salons: await db.select().from(salons),
        bookings: await db.select().from(bookings),
        customers: await db.select().from(customers),
        staff: await db.select().from(staff),
        services: await db.select().from(services),
        products: await db.select().from(products),
        pointsOfCustomers: await db.$count(customerPoints),
        movementsOfStock: await db.$count(inventoryTransactions),
        payments: await db.$count(paymentTransactions),
      })
      const before = await theRest()

      await created({
        bookingId,
        pointsUsed: 100,
        pointsEarned: 121,
        details: [
          line(),
          line({
            itemType: 'product',
            itemId: shampooId,
            itemName: 'Shampoo',
            quantity: 2,
            unitPrice: 2800,
            taxAmount: 560,
            totalAmount: 6160,
            sortOrder: 1,
          }),
        ],
      })

      expect(await theRest()).toEqual(before)
      expect(before).toMatchObject({
        pointsOfCustomers: 0,
        movementsOfStock: 0,
        payments: 0,
      })
    })

    describe('a booking that is billed', () => {
      it('enters one sale for a booking, and refuses a second', async () => {
        const bookingId = await insertBooking()
        const first = await created({ bookingId })

        const second = await create(sale({ bookingId, saleTime: at('04:00') }))

        expectProblem(second, notAllowed)
        expect(second.body.detail).toBe(BOOKING_IS_BILLED)
        expect((await storedSales()).map(({ id }) => id)).toEqual([first.id])
      })

      it('does not count a sale that is void', async () => {
        const bookingId = await insertBooking()
        await insertSale({ bookingId, ...voided })
        await insertSale({ bookingId, ...voided })

        const response = await create(sale({ bookingId }))

        expect(response.status).toBe(201)
        expect(await db.$count(sales)).toBe(3)
      })

      it('enters the sales of two bookings of one customer, and sales without a booking beside them', async () => {
        const responses = [
          await create(sale({ bookingId: await insertBooking() })),
          await create(sale({ bookingId: await insertBooking() })),
          await create(sale()),
          await create(sale()),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '201',
          '201',
          '201',
          '201',
        ])
      })
    })

    describe('a salon whose time zone is not known', () => {
      const lost = () => salon({ timezone: 'Mars/Olympus' })

      it('refuses the sale as a conflict: the request is not at fault', async () => {
        const response = await create(
          sale({ salonId: await lost(), staffId: null, details: [fee()] }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(TIME_ZONE_UNKNOWN)
        await expectNothingStored()
      })

      it('says what the request refers to and what it comes to before that', async () => {
        const there = await lost()
        const tooBig = [
          fee({
            unitPrice: MAX_INTEGER,
            taxAmount: 0,
            totalAmount: MAX_INTEGER,
          }),
          fee({ sortOrder: 1, unitPrice: 1, taxAmount: 0, totalAmount: 1 }),
        ]

        const unknownStaff = await create(
          sale({ salonId: there, staffId: UNKNOWN_ID, details: tooBig }),
        )
        const comesToTooMuch = await create(
          sale({ salonId: there, staffId: null, details: tooBig }),
        )

        expectProblem(unknownStaff, badRequest)
        expect(brokenRules(unknownStaff)).toEqual(['staffId:not_found'])
        expectProblem(comesToTooMuch, badRequest)
        expect(brokenRules(comesToTooMuch)).toEqual(['details:too_big'])
      })

      it('says that before it says that the booking is billed', async () => {
        const there = await lost()
        const bookingId = await insertBooking({
          salonId: there,
          staffId: await staffMember({}, there),
        })
        await insertSale({ salonId: there, bookingId })

        const response = await create(
          sale({
            salonId: there,
            staffId: null,
            bookingId,
            details: [fee()],
          }),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(TIME_ZONE_UNKNOWN)
      })
    })
  })

  /** The IDs of the sales of a page. */
  const idsOfSales = (response: Response): string[] =>
    response.body.data.map(({ id }: { id: string }) => id)

  describe('GET /api/v1/sales/:id', () => {
    it('returns the sale with its lines in their order, and where it is', async () => {
      const entered = await created({
        notes: 'レジ2',
        details: [
          fee({ sortOrder: 4 }),
          line({ sortOrder: 2, commissionRate: 40, commissionAmount: 2400 }),
        ],
      })

      const response = await read(entered.id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: entered,
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: { self: `${SALES}/${entered.id}`, list: SALES },
      })
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expect(
        response.body.data.details.map((detail: object) =>
          Object.keys(detail).toSorted(),
        ),
      ).toEqual([DETAIL_PROPERTIES, DETAIL_PROPERTIES])
      expect(
        response.body.data.details.map(
          ({ sortOrder }: { sortOrder: number }) => sortOrder,
        ),
      ).toEqual([2, 4])
    })

    it('returns a sale that was written with microseconds and values of later in its life', async () => {
      const id = await insertSale({
        saleTime: '2026-11-20 12:40:00.123456+09',
        paymentStatus: 'refunded',
        pointsUsed: 100,
        pointsEarned: 66,
        isVoid: true,
        voidedAt: '2026-11-21 10:15:00.5+09',
        voidReason: '二重登録',
        notes: '返金済み',
      })

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id,
        saleTime: '2026-11-20T03:40:00.123Z',
        paymentStatus: 'refunded',
        pointsUsed: 100,
        pointsEarned: 66,
        isVoid: true,
        voidedAt: '2026-11-21T01:15:00.500Z',
        voidReason: '二重登録',
        notes: '返金済み',
        details: [],
        payments: [],
      })
    })

    it('returns the payments of the sale in the order they were made, without what the processor answered', async () => {
      const id = await insertSale()
      const other = await insertSale()
      const methodId = await insertPaymentMethod()
      const second = await insertPayment(id, methodId, {
        amount: 600,
        createdAt: '2026-11-20 12:45:00+09',
      })
      const first = await insertPayment(id, methodId, {
        amount: 6000,
        status: 'failed',
        errorCode: 'card_declined',
        errorMessage: 'The card was declined',
        failedAt: '2026-11-20 12:42:11.25+09',
        processorResponse: { declined: true },
        metadata: { terminal: 'front' },
        createdAt: '2026-11-20 12:42:00+09',
        updatedAt: '2026-11-20 12:42:11.25+09',
      })
      await insertPayment(other, methodId)

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data.payments).toEqual([
        {
          id: first,
          saleId: id,
          paymentMethodId: methodId,
          transactionNumber: expect.stringMatching(/^TX-\d{4}$/),
          amount: 6000,
          status: 'failed',
          processorTransactionId: null,
          cardLastFour: null,
          cardBrand: null,
          errorCode: 'card_declined',
          errorMessage: 'The card was declined',
          processedAt: null,
          failedAt: '2026-11-20T03:42:11.250Z',
          refundedAt: null,
          refundAmount: null,
          refundReason: null,
          createdAt: '2026-11-20T03:42:00.000Z',
          updatedAt: '2026-11-20T03:42:11.250Z',
        },
        expect.objectContaining({ id: second, amount: 600 }),
      ])
      expect(
        response.body.data.payments.map((payment: object) =>
          Object.keys(payment).toSorted(),
        ),
      ).toEqual([PAYMENT_PROPERTIES, PAYMENT_PROPERTIES])
    })

    it('returns the payments that were made at one moment by their IDs', async () => {
      const id = await insertSale()
      const methodId = await insertPaymentMethod()
      const atOneMoment = { createdAt: '2026-11-20 12:45:00+09' }
      const later = await insertPayment(id, methodId, atOneMoment)
      const earlier = await insertPayment(id, methodId, {
        ...atOneMoment,
        id: FIRST_ID,
      })

      const { payments } = (await read(id)).body.data

      expect(payments.map((payment: { id: string }) => payment.id)).toEqual([
        earlier,
        later,
      ])
    })

    it('returns a sale whose customer, staff member, service and salon were deleted afterwards, and is not in the way of their deletion', async () => {
      const { id } = await created()
      const remove = (path: string) =>
        authorized(request(app).delete(`/api/v1${path}`), asAdmin)

      const deletions = [
        await remove(`/customers/${customerId}`),
        await remove(`/salons/${salonId}/staff/${staffId}`),
        await remove(`/salons/${salonId}/services/${cutId}`),
        await remove(`/salons/${salonId}`),
      ]
      const got = await read(id)

      expect(deletions.map(statusAndCode)).toEqual(['204', '204', '204', '204'])
      expect(got.status).toBe(200)
      expect(got.body.data).toMatchObject({
        salonId,
        customerId,
        staffId,
        details: [{ itemId: cutId, staffId }],
      })
      expect(idsOfSales(await list({ salonId }))).toEqual([id])
    })

    it('keeps the day of a sale when the time zone of the salon changes afterwards', async () => {
      // Half past midnight on the 20th in Tokyo, and the 19th in UTC.
      const { id } = await created({ saleTime: '2026-11-19T15:30:00Z' })

      await db
        .update(salons)
        .set({ timezone: 'UTC' })
        .where(eq(salons.id, salonId))

      expect((await read(id)).body.data.saleDate).toBe('2026-11-20')
    })

    it('finds a sale by its ID in capitals', async () => {
      const { id } = await created()

      const response = await read(id.toUpperCase())

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
    })

    it.each([
      ['a text that is no ID', 'not-an-id'],
      ['a sale number', 'SL-7Z3K-0QXM'],
      ['an ID without its hyphens', UNKNOWN_ID.replaceAll('-', '')],
    ])('refuses %s', async (_case, id) => {
      const response = await read(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe('Invalid sale ID')
      expect(brokenRules(response)).toHaveLength(1)
      expect(brokenRules(response)[0]).toMatch(/^id:/)
    })

    it('answers 404 for an ID that no sale has, be it the ID of a booking', async () => {
      await created()
      const bookingId = await insertBooking()

      const unknown = await read(UNKNOWN_ID)
      const ofBooking = await read(bookingId)

      expectProblem(unknown, notFound)
      expect(unknown.body.detail).toBe(`Sale ${UNKNOWN_ID} was not found`)
      expectProblem(ofBooking, notFound)
    })
  })

  describe('what is not there', () => {
    /** A method and a path below the ledger, `:id` standing for a sale that is there. */
    const outside: [string, 'put' | 'delete' | 'post' | 'get', string][] = [
      ['PUT on the ledger', 'put', ''],
      ['DELETE on the ledger', 'delete', ''],
      ['POST on a sale', 'post', '/:id'],
      ['PUT on a sale', 'put', '/:id'],
      ['DELETE on a sale', 'delete', '/:id'],
      ['GET below a sale', 'get', '/:id/details'],
    ]

    it.each(outside)(
      'answers %s with 404, whatever is sent',
      async (_case, method, path) => {
        const { id } = await created()
        const address = `${SALES}${path.replace(':id', id)}`

        const responses = [
          await authorized(request(app)[method](address), asAdmin),
          await authorized(request(app)[method](address), asAdmin).send(
            sale({ saleTime: at('05:00') }),
          ),
        ]

        expect(responses.map(statusAndCode)).toEqual(['404 3001', '404 3001'])
        expect((await storedSales()).map((row) => row.id)).toEqual([id])
      },
    )
  })

  describe('GET /api/v1/sales', () => {
    const idsOf = idsOfSales

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

    it('returns an empty page when there is no sale', async () => {
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
          self: SALES,
          first: SALES,
          last: null,
          next: null,
          prev: null,
        },
      })
    })

    it('lists the sales by the time of the sale, latest first, each as a GET of it returns it', async () => {
      const three = await soldAt('03:00')
      const five = await soldAt('05:00')
      const one = await soldAt('01:00')

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([five, three, one])
      expect(response.body.data[0]).toEqual((await read(five.id)).body.data)
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('lists sales of the same moment by their IDs, downwards', async () => {
      const ids = [
        (await created()).id,
        (await created()).id,
        (await created()).id,
        (await created()).id,
      ]

      const response = await list()

      expect(idsOf(response)).toEqual(ids.toSorted().toReversed())
    })

    it('walks the pages through sales of one moment, by their IDs downwards', async () => {
      const ids = [
        (await created()).id,
        (await created()).id,
        (await created()).id,
        (await created()).id,
        (await created()).id,
      ]
      const inOrder = ids.toSorted().toReversed()

      const pages = await walk(`${SALES}?limit=2`)

      expect(pages.map((page) => idsOf(page))).toEqual([
        inOrder.slice(0, 2),
        inOrder.slice(2, 4),
        inOrder.slice(4),
      ])
    })

    it('lists sales that are void with the others, and each with its lines and payments', async () => {
      const live = await created({ details: [line(), fee({ sortOrder: 1 })] })
      const void_ = await insertSale({ saleTime: at('02:00'), ...voided })
      const methodId = await insertPaymentMethod()
      const paymentId = await insertPayment(live.id, methodId)

      const response = await list()

      expect(idsOf(response)).toEqual([live.id, void_])
      expect(response.body.data[0].details).toHaveLength(2)
      expect(response.body.data[0].payments).toEqual([
        expect.objectContaining({ id: paymentId, saleId: live.id }),
      ])
      expect(response.body.data[1]).toMatchObject({
        isVoid: true,
        details: [],
        payments: [],
      })
    })

    it('walks the pages from the first to the last without leaving out or repeating a sale', async () => {
      const entered = []
      for (const time of ['09:00', '01:00', '07:00', '03:00', '05:00']) {
        entered.push(await soldAt(time))
      }
      // Two more at the moment of another.
      entered.push(await soldAt('03:00'), await soldAt('03:00'))
      // The order of the list: the time, then the ID, each as its text, downwards.
      const inOrder = entered
        .map(({ saleTime, id }) => ({ key: `${saleTime} ${id}`, id }))
        .toSorted((a, b) => (a.key < b.key ? 1 : -1))
        .map(({ id }) => id)

      const pages = await walk(`${SALES}?limit=3`)

      expect(pages.map((page) => idsOf(page))).toEqual([
        inOrder.slice(0, 3),
        inOrder.slice(3, 6),
        inOrder.slice(6),
      ])
      expect(pages.map((page) => page.body.meta)).toEqual([
        {
          total: 7,
          limit: 3,
          hasMore: true,
          cursor: null,
          nextCursor: inOrder[2],
          prevCursor: null,
        },
        {
          total: 7,
          limit: 3,
          hasMore: true,
          cursor: inOrder[2],
          nextCursor: inOrder[5],
          prevCursor: null,
        },
        {
          total: 7,
          limit: 3,
          hasMore: false,
          cursor: inOrder[5],
          nextCursor: null,
          prevCursor: null,
        },
      ])
      expect(pages[0]?.body.links).toEqual({
        self: `${SALES}?limit=3`,
        first: `${SALES}?limit=3`,
        last: null,
        next: `${SALES}?limit=3&cursor=${inOrder[2]}`,
        prev: null,
      })
    })

    // A sale with two lines is two rows of the query and one of the page.
    it('says that no page follows a page that is exactly full of sales with several lines', async () => {
      await soldAt('01:00', { details: [line(), fee({ sortOrder: 1 })] })
      await soldAt('05:00', { details: [line(), fee({ sortOrder: 1 })] })

      const response = await list({ limit: '2' })

      expect(idsOf(response)).toHaveLength(2)
      expect(response.body.meta).toMatchObject({
        total: 2,
        hasMore: false,
        nextCursor: null,
      })
    })

    it('keeps the conditions of a search in the links of its pages', async () => {
      await soldAt('01:00')
      await soldAt('03:00')

      const response = await list({
        limit: '1',
        paymentStatus: 'pending',
        startDate: '2026-11-20',
      })

      expect(response.body.meta.total).toBe(2)
      expect(response.body.links.next).toBe(
        `${SALES}?limit=1&paymentStatus=pending&startDate=2026-11-20&cursor=${response.body.data[0].id}`,
      )
    })

    describe('the conditions of a search', () => {
      it('lists the sales of one salon', async () => {
        const elsewhere = await salon()
        const here = await created()
        const there = await created({
          salonId: elsewhere,
          staffId: null,
          details: [fee()],
        })

        expect(idsOf(await list({ salonId }))).toEqual([here.id])
        expect(idsOf(await list({ salonId: elsewhere }))).toEqual([there.id])
        expect(idsOf(await list()).toSorted()).toEqual(
          [here.id, there.id].toSorted(),
        )
        expect((await list({ salonId: UNKNOWN_ID })).body.data).toEqual([])
      })

      it('lists what one customer paid, and nothing of a sale to nobody', async () => {
        const other = await insertCustomer(db)
        const ofOne = await soldAt('01:00')
        const ofOther = await soldAt('03:00', { customerId: other })
        await soldAt('05:00', { customerId: null })

        expect(idsOf(await list({ customerId }))).toEqual([ofOne.id])
        expect(idsOf(await list({ customerId: other }))).toEqual([ofOther.id])
        expect((await list({ customerId: other })).body.meta.total).toBe(1)
      })

      it('lists the sales of one booking, the void ones among them', async () => {
        const bookingId = await insertBooking()
        const other = await insertBooking()
        const withdrawn = await insertSale({
          bookingId,
          saleTime: at('02:00'),
          ...voided,
        })
        const live = await created({ bookingId })
        await created({ bookingId: other })
        await created()

        expect(idsOf(await list({ bookingId }))).toEqual([live.id, withdrawn])
        expect((await list({ bookingId: UNKNOWN_ID })).body.data).toEqual([])
      })

      it('lists the sales in one payment status', async () => {
        const pending = await created()
        const completed = await insertSale({ paymentStatus: 'completed' })
        const refunded = await insertSale({ paymentStatus: 'partial_refund' })

        expect(idsOf(await list({ paymentStatus: 'pending' }))).toEqual([
          pending.id,
        ])
        expect(idsOf(await list({ paymentStatus: 'completed' }))).toEqual([
          completed,
        ])
        expect(idsOf(await list({ paymentStatus: 'partial_refund' }))).toEqual([
          refunded,
        ])
        expect((await list({ paymentStatus: 'failed' })).body.data).toEqual([])
      })

      it('lists the sales of the days from the first to the last, each included, by the day of the salon', async () => {
        // In Tokyo: 23:30 on the 19th, 00:30 and 23:30 on the 20th, 00:30 on the 21st.
        const lateOn19 = await created({ saleTime: '2026-11-19T14:30:00Z' })
        const earlyOn20 = await created({ saleTime: '2026-11-19T15:30:00Z' })
        const lateOn20 = await created({ saleTime: '2026-11-20T14:30:00Z' })
        const earlyOn21 = await created({ saleTime: '2026-11-20T15:30:00Z' })

        expect(
          idsOf(await list({ startDate: '2026-11-20', endDate: '2026-11-20' })),
        ).toEqual([lateOn20.id, earlyOn20.id])
        expect(idsOf(await list({ startDate: '2026-11-20' }))).toEqual([
          earlyOn21.id,
          lateOn20.id,
          earlyOn20.id,
        ])
        expect(idsOf(await list({ endDate: '2026-11-20' }))).toEqual([
          lateOn20.id,
          earlyOn20.id,
          lateOn19.id,
        ])
        expect(
          idsOf(await list({ startDate: '2026-11-19', endDate: '2026-11-21' })),
        ).toHaveLength(4)
        expect(
          (await list({ startDate: '2026-11-22' })).body.meta,
        ).toMatchObject({ total: 0 })
      })

      it('reads the IDs of a search in capitals as the IDs they are', async () => {
        const bookingId = await insertBooking()
        const later = await soldAt('05:00')
        const earlier = await soldAt('03:00', { bookingId })

        const response = await list({
          salonId: salonId.toUpperCase(),
          customerId: customerId.toUpperCase(),
          cursor: later.id.toUpperCase(),
        })
        const ofTheBooking = await list({ bookingId: bookingId.toUpperCase() })

        expect(idsOf(response)).toEqual([earlier.id])
        expect(idsOf(ofTheBooking)).toEqual([earlier.id])
      })

      it('lists the sales that meet every condition', async () => {
        const other = await insertCustomer(db)
        const wanted = await soldAt('03:00')
        await soldAt('04:00', { customerId: other })
        await insertSale({ paymentStatus: 'completed' })
        await created({ saleTime: '2026-11-21T03:00:00Z' })

        const response = await list({
          salonId,
          customerId,
          paymentStatus: 'pending',
          startDate: '2026-11-20',
          endDate: '2026-11-20',
        })

        expect(idsOf(response)).toEqual([wanted.id])
        expect(response.body.meta.total).toBe(1)
      })

      it.each<[string, Record<string, string>, string[]]>([
        ['a limit of none', { limit: '0' }, ['limit:too_small']],
        ['a limit of more than 100', { limit: '101' }, ['limit:too_big']],
        ['a limit with a fraction', { limit: '1.5' }, ['limit:invalid_type']],
        ['a limit that is a word', { limit: 'ten' }, ['limit:invalid_format']],
        [
          'a cursor that is no ID',
          { cursor: 'next' },
          ['cursor:invalid_format'],
        ],
        [
          'a salon that is no ID',
          { salonId: 'aoyama' },
          ['salonId:invalid_format'],
        ],
        [
          'a customer that is no ID',
          { customerId: 'taro' },
          ['customerId:invalid_format'],
        ],
        [
          'a booking that is no ID',
          { bookingId: 'BK-7Z3K-0QXM' },
          ['bookingId:invalid_format'],
        ],
        [
          'a payment status that does not exist',
          { paymentStatus: 'paid' },
          ['paymentStatus:invalid_value'],
        ],
        [
          'a first day that is no date',
          { startDate: '2026-02-30' },
          ['startDate:invalid_format'],
        ],
        [
          'a last day with a time',
          { endDate: '2026-11-20T00:00:00Z' },
          ['endDate:invalid_format'],
        ],
        [
          'a last day before the first one',
          { startDate: '2026-11-20', endDate: '2026-11-19' },
          ['endDate:custom'],
        ],
        [
          'a staff member, whom the search does not have',
          { staffId: UNKNOWN_ID },
          ['staffId:unrecognized_keys'],
        ],
        ['a page number', { page: '2' }, ['page:unrecognized_keys']],
      ])('refuses %s', async (_case, query, rules) => {
        const response = await list(query)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(brokenRules(response)).toEqual(rules)
      })

      it('accepts limits of 1 and of 100', async () => {
        await soldAt('01:00')
        await soldAt('03:00')

        const one = await list({ limit: '1' })
        const hundred = await list({ limit: '100' })

        expect(one.body.data).toHaveLength(1)
        expect(one.body.meta).toMatchObject({ limit: 1, hasMore: true })
        expect(hundred.body.data).toHaveLength(2)
        expect(hundred.body.meta).toMatchObject({ limit: 100, hasMore: false })
      })

      it('refuses a cursor that names no sale', async () => {
        await soldAt('01:00')

        const response = await list({ cursor: UNKNOWN_ID })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_SEARCH)
        expect(response.body.errors).toEqual([
          issue('cursor', 'not_found', 'Must name a sale'),
        ])
      })

      it('starts after the sale of the cursor also when the search does not list that sale', async () => {
        const later = await insertSale({
          saleTime: at('05:00'),
          paymentStatus: 'completed',
        })
        const earlier = await soldAt('03:00')

        const response = await list({ paymentStatus: 'pending', cursor: later })

        expect(idsOf(response)).toEqual([earlier.id])
      })
    })
  })

  describe('who keeps the sales ledger', () => {
    it.each(unauthenticated)(
      'answers %s with 401 in every operation before looking at anything else, and stores nothing',
      async (_case, tokenOf, problem, challenge) => {
        const authorization = await tokenOf()

        const responses = [
          await create(sale(), authorization),
          await create({}, authorization),
          await read(UNKNOWN_ID, authorization),
          await read('not-an-id', authorization),
          await list({}, authorization),
          await list({ limit: '0' }, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        await expectNothingStored()
      },
    )

    it.each(keepers)(
      'lets %s enter, read and list the sales of the salon',
      async (_case, signInAs) => {
        const authorization = await signInAs()

        const entered = await create(sale(), authorization)
        const got = await read(entered.body.data?.id, authorization)
        const listed = await list({}, authorization)
        const named = await list({ salonId }, authorization)

        expect([entered, got, listed, named].map(statusAndCode)).toEqual([
          '201',
          '200',
          '200',
          '200',
        ])
        expect(got.body.data).toEqual(entered.body.data)
        expect(listed.body.data).toEqual([entered.body.data])
        expect(named.body.data).toEqual([entered.body.data])
      },
    )

    it.each(notKeepers)(
      'forbids %s every operation, before looking at the ID, the search or the body',
      async (_case, signInAs) => {
        const { id } = await created()
        const authorization = await signInAs()

        const responses = [
          await create(sale(), authorization),
          await create(sale({ customerId: null }), authorization),
          await create({}, authorization),
          await read(id, authorization),
          await read(UNKNOWN_ID, authorization),
          await read('not-an-id', authorization),
          await list({}, authorization),
          await list({ limit: '0' }, authorization),
          await list({ limit: 'ten' }, authorization),
        ]

        for (const response of responses) {
          expectProblem(response, forbidden)
        }
        expect(await db.$count(sales)).toBe(1)
      },
    )

    it('forbids a customer the ledger also for what they paid themself', async () => {
      const self = await customerAccount()
      const own = await created({ customerId: self.customerId })

      const responses = [
        await read(own.id, self.authorization),
        await list({ customerId: self.customerId }, self.authorization),
        await create(sale({ customerId: self.customerId }), self.authorization),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
      expect(await db.$count(sales)).toBe(1)
    })

    describe.each(membersOfAnotherSalon)('%s', (_case, signInAs) => {
      it('may not enter a sale of the salon', async () => {
        const response = await create(sale(), await signInAs())

        expectProblem(response, forbidden)
        await expectNothingStored()
      })

      it('is answered as if a sale of the salon did not exist', async () => {
        const { id } = await created()
        const authorization = await signInAs()

        const existing = await read(id, authorization)
        const missing = await read(UNKNOWN_ID, authorization)

        expectProblem(existing, notFound)
        expect(existing.body.detail).toBe(`Sale ${id} was not found`)
        expectProblem(missing, notFound)
      })

      it('is listed no sale of the salon, and may not ask for them', async () => {
        const { id } = await created()
        const authorization = await signInAs()

        const own = await list({}, authorization)
        const others = await list({ salonId }, authorization)
        const afterOthers = await list({ cursor: id }, authorization)

        expect(own.status).toBe(200)
        expect(own.body.data).toEqual([])
        expect(own.body.meta.total).toBe(0)
        expectProblem(others, forbidden)
        expectProblem(afterOthers, badRequest)
        expect(afterOthers.body.errors).toEqual([
          issue('cursor', 'not_found', 'Must name a sale'),
        ])
      })
    })

    it('lists a member of a salon the sales of their salon only, whatever else the search says', async () => {
      const elsewhere = await salon()
      const there = await created({
        salonId: elsewhere,
        staffId: null,
        details: [fee()],
      })
      const here = await created()
      const ofHere = await signedInMember('owner')
      const ofThere = await signedInMember('staff', async () => elsewhere)

      const listedHere = await list({ customerId }, ofHere)
      const listedThere = await list({ customerId }, ofThere)
      const readThere = await read(there.id, ofThere)
      const readHere = await read(here.id, ofThere)

      expect(listedHere.body.data).toEqual([here])
      expect(listedThere.body.data).toEqual([there])
      expect(readThere.status).toBe(200)
      expectProblem(readHere, notFound)
    })

    it('lets a member of a salon enter sales of their salon only, be the other salon one that does not exist', async () => {
      const authorization = await signedInMember('manager')
      const elsewhere = await salon()

      const own = await create(sale(), authorization)
      const others = await create(
        sale({ salonId: elsewhere, staffId: null, details: [fee()] }),
        authorization,
      )
      const unknown = await create(sale({ salonId: UNKNOWN_ID }), authorization)

      expect(own.status).toBe(201)
      expectProblem(others, forbidden)
      // A salon that does not exist is not theirs either.
      expectProblem(unknown, forbidden)
      expect(await db.$count(sales)).toBe(1)
    })

    it('answers a body it cannot read before it looks at the token or the account, as every route does', async () => {
      const self = await customerAccount()
      const notJson = (authorization: string | null): Test =>
        authorized(request(app).post(SALES), authorization)
          .set('Content-Type', 'application/json')
          .send('{"salonId": "0193a5b8"')

      const responses = [
        await notJson(null),
        await notJson(self.authorization),
        await notJson(asAdmin),
        await authorized(request(app).post(SALES), null)
          .set('Content-Type', 'text/plain')
          .send('a cut for 6,600 yen'),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '400 2002',
        '400 2002',
        '400 2002',
        '415 2002',
      ])
      await expectNothingStored()
    })

    it('checks a new sale in order: the token, the account, the request, the salon of the account, what the request refers to, the booking', async () => {
      const self = await customerAccount()
      const elsewhere = await signedInMember('owner', salon)
      const bookingId = await insertBooking()
      await created({ bookingId })
      const invalid = sale({ pointsUsed: -1, customerId: UNKNOWN_ID })
      const unknownCustomer = sale({ customerId: UNKNOWN_ID, bookingId })

      const ofAnotherSalon = await create(invalid, elsewhere)
      const ofUnknownCustomer = await create(unknownCustomer)
      const responses = [
        await create(invalid, null),
        await create(invalid, self.authorization),
        ofAnotherSalon,
        await create(unknownCustomer, elsewhere),
        ofUnknownCustomer,
        await create(sale({ bookingId })),
        await create(sale()),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '403 1005',
        '400 2001',
        '409 3003',
        '201',
      ])
      expect(brokenRules(ofAnotherSalon)).toEqual(['pointsUsed:too_small'])
      expect(brokenRules(ofUnknownCustomer)).toEqual([
        'customerId:not_found',
        'bookingId:not_found',
      ])
    })

    it('checks a search in order: the token, the account, the search, the salon of the account, the cursor', async () => {
      const self = await customerAccount()
      const ofTheSalon = await signedInMember('manager')

      const responses = [
        await list({ limit: '0' }, null),
        await list({ limit: '0' }, self.authorization),
        await list({ limit: '0', salonId: UNKNOWN_ID }, ofTheSalon),
        await list({ salonId: UNKNOWN_ID, cursor: UNKNOWN_ID }, ofTheSalon),
        await list({ salonId, cursor: UNKNOWN_ID }, ofTheSalon),
        await list({ salonId }, ofTheSalon),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '403 1005',
        '400 2001',
        '200',
      ])
    })

    it('checks a read in order: the token, the account, the ID, the sale', async () => {
      const self = await customerAccount()
      const { id } = await created()

      const responses = [
        await read('not-an-id', null),
        await read('not-an-id', self.authorization),
        await read('not-an-id'),
        await read(UNKNOWN_ID),
        await read(id),
      ]

      expect(responses.map(statusAndCode)).toEqual([
        '401 1001',
        '403 1005',
        '400 2001',
        '404 3001',
        '200',
      ])
    })
  })

  describe('requests at the same moment', () => {
    // A sale holds its booking before it looks for a sale of the booking,
    // so the sales of a booking are written one after the other and each
    // sees the ones before it.
    it('enters one of six sales that bill the same booking', async () => {
      const bookingId = await insertBooking()

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => create(sale({ bookingId }))),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(await db.$count(sales)).toBe(1)
      expect(await db.$count(salesDetails)).toBe(1)
    })

    it('enters every one of six sales that bill six bookings of one customer', async () => {
      const bookingIds = []
      for (let index = 0; index < 6; index += 1) {
        bookingIds.push(await insertBooking())
      }

      const responses = await Promise.all(
        bookingIds.map((bookingId) => create(sale({ bookingId }))),
      )

      expect(responses.map(statusAndCode)).toEqual([
        '201',
        '201',
        '201',
        '201',
        '201',
        '201',
      ])
      expect(
        new Set(responses.map(({ body }) => body.data.saleNumber)).size,
      ).toBe(6)
    })

    it('enters every one of six sales without a booking, of one customer and one staff member', async () => {
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => create(sale())),
      )

      expect(responses.map(statusAndCode)).toEqual([
        '201',
        '201',
        '201',
        '201',
        '201',
        '201',
      ])
      expect(await db.$count(sales)).toBe(6)
    })

    type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

    /**
     * The answer to a sale that was sent while a transaction held a row of
     * what the sale names, as a delete holds it, and then deleted it.
     */
    const answeredAfter = async (
      hold: (tx: Transaction) => Promise<unknown>,
      remove: (tx: Transaction) => Promise<unknown>,
    ): Promise<Response> => {
      const { pending } = await db.transaction(async (tx) => {
        await hold(tx)
        const underWay = create(sale()).then((response) => response)
        await pause(300)
        await remove(tx)

        return { pending: underWay }
      })

      return pending
    }

    it('does not find a salon that was deleted while it waited for it', async () => {
      const response = await answeredAfter(
        (tx) =>
          tx
            .select({ id: salons.id })
            .from(salons)
            .where(eq(salons.id, salonId))
            .for('update'),
        (tx) => tx.update(salons).set(deleted).where(eq(salons.id, salonId)),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['salonId:not_found'])
      await expectNothingStored()
    })

    it('does not find a customer who was deleted while it waited for them', async () => {
      const response = await answeredAfter(
        (tx) =>
          tx
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.id, customerId))
            .for('update'),
        (tx) =>
          tx.update(customers).set(deleted).where(eq(customers.id, customerId)),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['customerId:not_found'])
      await expectNothingStored()
    })

    it('does not find a staff member who was deleted while it waited for them', async () => {
      const response = await answeredAfter(
        (tx) =>
          tx
            .select({ id: staff.id })
            .from(staff)
            .where(eq(staff.id, staffId))
            .for('update'),
        (tx) => tx.update(staff).set(deleted).where(eq(staff.id, staffId)),
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual([
        'staffId:not_found',
        'details.0.staffId:not_found',
      ])
      await expectNothingStored()
    })

    it('reads and lists a sale without waiting for whoever holds it', async () => {
      const { id } = await created()

      const responses = await db.transaction(async (tx) => {
        await tx
          .select({ id: sales.id })
          .from(sales)
          .where(eq(sales.id, id))
          .for('update')

        return [await read(id), await list()]
      })

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
    })

    it('meets the sale that was entered while it waited for the booking', async () => {
      const bookingId = await insertBooking()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.id, bookingId))
          .for('update')
        const underWay = create(sale({ bookingId })).then(
          (response) => response,
        )
        await pause(300)
        await insertSale({ bookingId }, tx)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(BOOKING_IS_BILLED)
      expect(await db.$count(sales)).toBe(1)
    })

    it('does not find a booking that was deleted while it waited for it', async () => {
      const bookingId = await insertBooking()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(eq(bookings.id, bookingId))
          .for('update')
        const underWay = create(sale({ bookingId })).then(
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
      await expectNothingStored()
    })

    // A booking holds its staff members in the order of their IDs. A sale
    // that took hold of them as its rows are written, the staff member in
    // charge before those of the lines, would hold the later one and wait
    // for the earlier one, and the two would wait for each other.
    it('takes hold of its staff members in the order of their IDs, as a booking does', async () => {
      const later = staffId
      const earlier = await staffMember({ id: FIRST_ID })

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, earlier))
          .for('update')
        const underWay = create(
          sale({ staffId: later, details: [line({ staffId: earlier })] }),
        ).then((response) => response)
        await pause(300)
        // Nobody holds the later one: the sale waits for the earlier one first.
        await tx
          .select({ id: staff.id })
          .from(staff)
          .where(eq(staff.id, later))
          .for('update', { noWait: true })

        return { pending: underWay }
      })
      const response = await pending

      expect(response.status).toBe(201)
    })

    it('enters a sale and a booking that name the same two staff members, and neither waits for the other for ever', async () => {
      const later = staffId
      const earlier = await staffMember({ id: FIRST_ID })
      const book = (time: string) =>
        authorized(request(app).post(BOOKINGS), asAdmin).send({
          salonId,
          customerId,
          staffId: earlier,
          depositAmount: null,
          customerRequest: null,
          internalNotes: null,
          source: null,
          services: [
            {
              serviceId: cutId,
              staffId: earlier,
              startTime: at(time),
              notes: null,
            },
            {
              serviceId: cutId,
              staffId: later,
              startTime: at(time),
              notes: null,
            },
          ],
        })

      const rounds = await Promise.all(
        ['01:00', '04:00', '07:00', '10:00'].map((time) =>
          Promise.all([
            create(
              sale({ staffId: later, details: [line({ staffId: earlier })] }),
            ),
            book(time),
          ]),
        ),
      )

      for (const round of rounds) {
        expect(round.map(statusAndCode)).toEqual(['201', '201'])
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
    type Line = SaleCreateRequest['details'][number]
    const lineOf = (overrides: Partial<Line> = {}): Line => ({
      itemType: 'service',
      itemId: cutId,
      itemName: 'カット',
      quantity: 1,
      unitPrice: 6000,
      discountAmount: 0,
      taxAmount: 600,
      totalAmount: 6600,
      staffId: staffIdSchema.parse(staffId),
      commissionRate: null,
      commissionAmount: null,
      notes: null,
      sortOrder: 0,
      ...overrides,
    })
    /** A request as the use case hands it on: a cut for the customer, without a booking. */
    const requestOf = (
      overrides: Partial<SaleCreateRequest> = {},
    ): SaleCreateRequest => ({
      salonId: salonIdSchema.parse(salonId),
      customerId: customerIdSchema.parse(customerId),
      staffId: staffIdSchema.parse(staffId),
      bookingId: null,
      saleTime: written('03:40'),
      pointsUsed: null,
      pointsEarned: null,
      notes: null,
      details: [lineOf()],
      ...overrides,
    })
    const noConditions = {
      limit: 20,
      after: null,
      salonId: null,
      customerId: null,
      bookingId: null,
      paymentStatus: null,
      startDate: null,
      endDate: null,
    }

    describe('create', () => {
      it('writes the sale with the number it is given and returns the rows', async () => {
        const result = dataOf(
          await repository().create(
            requestOf({
              details: [
                lineOf({ sortOrder: 5, itemName: 'second' }),
                lineOf({ sortOrder: 1, itemName: 'first' }),
              ],
            }),
            { saleNumber: 'SL-0000-0001' },
          ),
        )

        expect(result).toEqual({
          type: 'created',
          sale: {
            sale: (await storedSales())[0],
            details: (await storedDetails()).toSorted(
              (a, b) => a.sortOrder - b.sortOrder,
            ),
            payments: [],
          },
        })
        expect(result.type === 'created' && result.sale.sale).toMatchObject({
          saleNumber: 'SL-0000-0001',
          subtotal: 12000,
          taxAmount: 1200,
          totalAmount: 13200,
        })
        expect(
          result.type === 'created'
            ? result.sale.details.map(({ itemName }) => itemName)
            : [],
        ).toEqual(['first', 'second'])
      })

      it('writes nothing when another sale has the number, and says so', async () => {
        const first = dataOf(
          await repository().create(requestOf(), {
            saleNumber: 'SL-0000-0001',
          }),
        )

        const second = dataOf(
          await repository().create(requestOf({ saleTime: written('05:00') }), {
            saleNumber: 'SL-0000-0001',
          }),
        )

        expect(first.type).toBe('created')
        expect(second).toEqual({ type: 'saleNumberTaken' })
        expect(await db.$count(sales)).toBe(1)
        expect(await db.$count(salesDetails)).toBe(1)
      })

      it.each<[string, () => Promise<Partial<SaleCreateRequest>>, string]>([
        [
          'a customer that is not there',
          async () => ({ customerId: customerIdSchema.parse(UNKNOWN_ID) }),
          'invalid',
        ],
        [
          'a booking that is billed',
          async () => {
            const bookingId = await insertBooking()
            await insertSale({ bookingId })
            return { bookingId: bookingIdSchema.parse(bookingId) }
          },
          'bookingBilled',
        ],
        [
          'a salon whose time zone is not known',
          async () => ({
            salonId: salonIdSchema.parse(
              await salon({ timezone: 'Mars/Olympus' }),
            ),
            staffId: null,
            details: [lineOf({ itemId: null, staffId: null })],
          }),
          'timeZoneUnknown',
        ],
      ])(
        'writes nothing for %s, and says why',
        async (_case, overridesOf, type) => {
          const overrides = await overridesOf()
          const before = await db.$count(sales)

          const result = dataOf(
            await repository().create(requestOf(overrides), {
              saleNumber: 'SL-0000-0001',
            }),
          )

          expect(result.type).toBe(type)
          expect(await db.$count(sales)).toBe(before)
          expect(await db.$count(salesDetails)).toBe(0)
        },
      )

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new SaleRepository(connection.database).create(
          requestOf(),
          { saleNumber: 'SL-0000-0001' },
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to create sale' },
        })
      })
    })

    describe('findById', () => {
      it('finds a sale within the reach, with its lines in their order and its payments', async () => {
        const { id } = await created({
          details: [fee({ sortOrder: 2 }), line(), fee({ sortOrder: 1 })],
        })
        const paymentId = await insertPayment(id, await insertPaymentMethod())
        const saleId = saleIdSchema.parse(id)

        const ofEverySalon = dataOf(
          await repository().findById(saleId, everySalon),
        )
        const ofTheSalon = dataOf(
          await repository().findById(saleId, salonOnly(salonId)),
        )

        expect(ofEverySalon?.sale.id).toBe(id)
        expect(ofEverySalon?.details.map(({ sortOrder }) => sortOrder)).toEqual(
          [0, 1, 2],
        )
        expect(ofEverySalon?.payments.map((payment) => payment.id)).toEqual([
          paymentId,
        ])
        expect(ofTheSalon).toEqual(ofEverySalon)
      })

      it('finds no sale outside the reach, and none that is not there', async () => {
        const { id } = await created()
        const elsewhere = await salon()

        expect(
          dataOf(
            await repository().findById(
              saleIdSchema.parse(id),
              salonOnly(elsewhere),
            ),
          ),
        ).toBeNull()
        expect(
          dataOf(
            await repository().findById(
              saleIdSchema.parse(UNKNOWN_ID),
              everySalon,
            ),
          ),
        ).toBeNull()
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new SaleRepository(connection.database).findById(
          saleIdSchema.parse(UNKNOWN_ID),
          everySalon,
        )
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to find sale' },
        })
      })
    })

    describe('list', () => {
      it('lists the sales within the reach, latest first, and counts them', async () => {
        const elsewhere = await salon()
        const early = await soldAt('01:00')
        const late = await soldAt('05:00')
        await created({ salonId: elsewhere, staffId: null, details: [fee()] })

        const ofTheSalon = dataOf(
          await repository().list({
            reach: salonOnly(salonId),
            ...noConditions,
          }),
        )
        const ofEverySalon = dataOf(
          await repository().list({ reach: everySalon, ...noConditions }),
        )

        expect(ofTheSalon?.sales.map(({ sale }) => sale.id)).toEqual([
          late.id,
          early.id,
        ])
        expect(ofTheSalon).toMatchObject({ total: 2, hasMore: false })
        expect(ofEverySalon).toMatchObject({ total: 3, hasMore: false })
      })

      it('resolves to null for a cursor that names a sale outside the reach', async () => {
        const { id } = await created()
        const elsewhere = await salon()

        const result = dataOf(
          await repository().list({
            reach: salonOnly(elsewhere),
            ...noConditions,
            after: saleIdSchema.parse(id),
          }),
        )

        expect(result).toBeNull()
      })

      it('resolves to a database error when the database does not answer', async () => {
        const connection = connectUnreachableDatabase()

        const result = await new SaleRepository(connection.database).list({
          reach: everySalon,
          ...noConditions,
        })
        await connection.close()

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database', message: 'Failed to list sales' },
        })
      })
    })
  })

  describe('the constraints of the database', () => {
    const violationOf = (code: string, constraint: string) => ({
      cause: expect.objectContaining({ code, constraint_name: constraint }),
    })
    const CHECK = '23514'
    const UNIQUE = '23505'

    it.each<[string, Partial<NewSale>, string]>([
      [
        'a negative subtotal',
        { subtotal: -1, taxAmount: 1, totalAmount: 0 },
        'sales_amounts_not_negative',
      ],
      [
        'a negative discount',
        { discountAmount: -1, totalAmount: 6601 },
        'sales_amounts_not_negative',
      ],
      [
        'a negative tax',
        { taxAmount: -1, totalAmount: 5999 },
        'sales_amounts_not_negative',
      ],
      [
        'negative points used',
        { pointsUsed: -1 },
        'sales_amounts_not_negative',
      ],
      [
        'negative points earned',
        { pointsEarned: -1 },
        'sales_amounts_not_negative',
      ],
      [
        'a discount that is more than the subtotal',
        { discountAmount: 6001, taxAmount: 1, totalAmount: 0 },
        'sales_discount_within_subtotal',
      ],
      [
        'a total that is not the subtotal less the discount plus the tax',
        { totalAmount: 6601 },
        'sales_total_is_the_sum',
      ],
      [
        'a void sale without the time it was voided at',
        { isVoid: true },
        'sales_void_has_time',
      ],
      [
        'a sale that was voided at a time and is not void',
        { voidedAt: at('05:00') },
        'sales_void_has_time',
      ],
      [
        'a reason of a sale that is not void',
        { voidReason: '二重登録' },
        'sales_void_reason_of_void',
      ],
      [
        'points used of a sale to nobody',
        { customerId: null, pointsUsed: 0 },
        'sales_points_need_customer',
      ],
      [
        'points earned of a sale to nobody',
        { customerId: null, pointsEarned: 10 },
        'sales_points_need_customer',
      ],
    ])('refuses %s', async (_case, overrides, constraint) => {
      await expect(
        db.insert(sales).values(saleRow(overrides)),
      ).rejects.toMatchObject(violationOf(CHECK, constraint))
    })

    it.each<[string, Partial<NewSalesDetail>, string]>([
      [
        'a quantity of none',
        { quantity: 0, totalAmount: 600 },
        'sales_details_quantity_positive',
      ],
      [
        'a negative price',
        { unitPrice: -1, taxAmount: 1, totalAmount: 0 },
        'sales_details_amounts_not_negative',
      ],
      [
        'a negative discount',
        { discountAmount: -1, totalAmount: 6601 },
        'sales_details_amounts_not_negative',
      ],
      [
        'a negative tax',
        { taxAmount: -1, totalAmount: 5999 },
        'sales_details_amounts_not_negative',
      ],
      [
        'a negative commission',
        { commissionAmount: -1 },
        'sales_details_amounts_not_negative',
      ],
      [
        'a discount that is more than the price of all pieces',
        { quantity: 2, discountAmount: 12001, taxAmount: 1, totalAmount: 0 },
        'sales_details_discount_within_price',
      ],
      [
        'a total that is not what the line comes to',
        { quantity: 2, totalAmount: 6600 },
        'sales_details_total_is_the_sum',
      ],
      [
        'a commission rate below 0',
        { commissionRate: '-0.01' },
        'sales_details_commission_rate_is_a_percentage',
      ],
      [
        'a commission rate above 100',
        { commissionRate: '100.01' },
        'sales_details_commission_rate_is_a_percentage',
      ],
      [
        'an ID of a line that is neither of a service nor of a product',
        { itemType: 'fee' },
        'sales_details_item_of_a_known_type',
      ],
      [
        'a negative place',
        { sortOrder: -1 },
        'sales_details_sort_order_not_negative',
      ],
    ])('refuses a line with %s', async (_case, overrides, constraint) => {
      const saleId = await insertSale()

      await expect(
        db.insert(salesDetails).values(detailRow(saleId, overrides)),
      ).rejects.toMatchObject(violationOf(CHECK, constraint))
    })

    it('accepts what the rules allow at their edges', async () => {
      const saleId = await insertSale({
        subtotal: 6000,
        discountAmount: 6000,
        taxAmount: 0,
        totalAmount: 0,
        pointsUsed: 0,
        pointsEarned: 0,
      })
      await insertSale({ customerId: null })
      await insertSale(voided)

      await db.insert(salesDetails).values([
        detailRow(saleId, {
          quantity: 46_341,
          unitPrice: 46_341,
          discountAmount: 2_147_483_647,
          taxAmount: 0,
          totalAmount: 4_634,
          commissionRate: '100.00',
          commissionAmount: 0,
          sortOrder: 0,
        }),
        detailRow(saleId, {
          itemType: 'fee',
          itemId: null,
          commissionRate: '0.00',
          sortOrder: 1,
        }),
        detailRow(saleId, { itemType: 'product', sortOrder: 2 }),
      ])

      expect(await db.$count(sales)).toBe(3)
      expect(await db.$count(salesDetails)).toBe(3)
    })

    it('refuses two lines of a sale at one place, and takes the same place in two sales', async () => {
      const saleId = await insertSale()
      const other = await insertSale()
      await db.insert(salesDetails).values(detailRow(saleId))
      await db.insert(salesDetails).values(detailRow(other))

      await expect(
        db.insert(salesDetails).values(detailRow(saleId)),
      ).rejects.toMatchObject(violationOf(UNIQUE, 'sales_details_order_unique'))
    })

    it('refuses a second sale of a booking that is not void, and takes as many void ones as there are', async () => {
      const bookingId = await insertBooking()
      await insertSale({ bookingId, ...voided })
      await insertSale({ bookingId, ...voided })
      await insertSale({ bookingId })

      await expect(insertSale({ bookingId })).rejects.toMatchObject(
        violationOf(UNIQUE, 'sales_booking_live_unique'),
      )
      expect(await db.$count(sales)).toBe(3)
    })

    it('takes any number of sales without a booking', async () => {
      await insertSale()
      await insertSale()

      expect(await db.$count(sales)).toBe(2)
    })

    it('leaves points that were not set null: no column of the two tables that may be unset has a default', async () => {
      const columns = await getTestDbClient()<
        {
          table_name: string
          column_name: string
          column_default: string | null
        }[]
      >`
        SELECT table_name, column_name, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name IN ('sales', 'sales_details')
          AND is_nullable = 'YES'
          AND column_default IS NOT NULL
      `
      const id = await insertSale()

      expect(columns.map((column) => ({ ...column }))).toEqual([])
      expect(await storedSales()).toEqual([
        expect.objectContaining({ id, pointsUsed: null, pointsEarned: null }),
      ])
    })

    it('has the index the ledger is read by, in place of the one on the salon alone', async () => {
      const indexes = await getTestDbClient()<{ indexname: string }[]>`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'sales'
      `
      const names = indexes.map(({ indexname }) => indexname)

      expect(names).toEqual(
        expect.arrayContaining([
          'idx_sales_salon_time',
          'sales_booking_live_unique',
        ]),
      )
      expect(names).not.toContain('idx_sales_salon_id')
    })
  })
})
