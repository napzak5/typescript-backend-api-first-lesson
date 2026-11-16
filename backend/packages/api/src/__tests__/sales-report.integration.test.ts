import {
  paymentMethods,
  paymentTransactions,
  sales,
  salesDetails,
  salons,
  serviceCategories,
  services,
  staff,
} from '@beauty-salon-backend/database'
import { salonIdSchema } from '@beauty-salon-backend/domain'
import { SalesReportRepository } from '@beauty-salon-backend/infrastructure'
import { count, eq } from 'drizzle-orm'
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
import { type NewPayment, paymentColumns } from './_shared/payment-helpers'
import {
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  type ExpectedProblem,
  expectProblem,
  getTestDb,
  ISO_TIMESTAMP,
  request,
} from './_shared/test-helpers'

const REPORTS = '/api/v1/sales-reports'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const JSON_UTF8 = 'application/json; charset=utf-8'
const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

/** November 2026, the period of most tests. */
const NOVEMBER = { startDate: '2026-11-01', endDate: '2026-11-30' }

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

describe('Sales reports API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The owner, the manager and a staff member of the salon, signed in. */
  let asOwner: string
  let asManager: string
  let asStaff: string
  /** The owner of another salon, signed in. */
  let asOwnerOfAnotherSalon: string
  /** A customer, signed in. */
  let asCustomer: string
  /** The salon of the tests, in Tokyo. */
  let salonId: string
  let otherSalonId: string
  let customerId: string
  /** The staff members whose sales the tests count. */
  let aoiId: string
  let renId: string
  let cutId: string
  let colorId: string
  /** A service of the salon without a category. */
  let massageId: string
  let cashId: string
  let cardId: string

  type NewSale = typeof sales.$inferInsert
  type NewLine = typeof salesDetails.$inferInsert

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A category of a salon of a kind; returns its ID. */
  const insertCategory = async (
    category: 'cut' | 'color' | 'other',
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [row] = await db
      .insert(serviceCategories)
      .values({ salonId: ofSalon, name: category, category })
      .returning({ id: serviceCategories.id })
    if (row === undefined) {
      throw new Error('No category was inserted')
    }
    return row.id
  }

  /** A service of the salon in a category, or in none; returns its ID. */
  const insertService = async (
    name: string,
    categoryId: string | null,
  ): Promise<string> => {
    const [row] = await db
      .insert(services)
      .values({
        salonId,
        categoryId,
        name,
        duration: 60,
        price: 6000,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
      })
      .returning({ id: services.id })
    if (row === undefined) {
      throw new Error('No service was inserted')
    }
    return row.id
  }

  /** A way of paying at a salon; returns its ID. */
  const insertMethod = async (
    method: 'cash' | 'credit_card',
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [row] = await db
      .insert(paymentMethods)
      .values({ salonId: ofSalon, method, displayName: method })
      .returning({ id: paymentMethods.id })
    if (row === undefined) {
      throw new Error('No payment method was inserted')
    }
    return row.id
  }

  /**
   * A line of a sale: one service of 6,000 yen with 600 of tax, unless the
   * test says otherwise.
   */
  const line = (overrides: Partial<NewLine> = {}): Omit<NewLine, 'saleId'> => ({
    itemType: 'service',
    itemId: cutId,
    itemName: 'カット',
    quantity: 1,
    unitPrice: 6000,
    discountAmount: 0,
    taxAmount: 600,
    totalAmount: 6600,
    staffId: null,
    ...overrides,
  })

  /**
   * A sale of the salon with its lines, written directly. Its amounts are
   * those of its lines: what they cost, less their discounts, with their
   * tax. Returns its ID.
   */
  const insertSale = async (
    lines: Omit<NewLine, 'saleId'>[],
    overrides: Partial<NewSale> = {},
  ): Promise<string> => {
    const subtotal = lines.reduce(
      (sum, { quantity, unitPrice }) => sum + quantity * unitPrice,
      0,
    )
    const discountAmount = lines.reduce(
      (sum, item) => sum + (item.discountAmount ?? 0),
      0,
    )
    const taxAmount = lines.reduce((sum, item) => sum + item.taxAmount, 0)
    const [row] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-TEST-${nextRow()}`,
        salonId,
        customerId,
        saleDate: '2026-11-20',
        saleTime: '2026-11-20T03:40:00Z',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount: subtotal - discountAmount + taxAmount,
        ...overrides,
      })
      .returning({ id: sales.id })
    if (row === undefined) {
      throw new Error('No sale was inserted')
    }
    for (const [sortOrder, item] of lines.entries()) {
      await db
        .insert(salesDetails)
        .values({ ...item, saleId: row.id, sortOrder })
    }
    return row.id
  }

  /** A payment of a sale, written directly: received in full in cash, unless said otherwise. */
  const insertPayment = async (
    saleId: string,
    overrides: Partial<NewPayment> = {},
  ): Promise<void> => {
    await db.insert(paymentTransactions).values({
      saleId,
      paymentMethodId: cashId,
      transactionNumber: `TX-${nextRow()}`,
      ...paymentColumns(overrides),
    })
  }

  /** What makes a row of `sales` a void one. */
  const voided: Partial<NewSale> = {
    isVoid: true,
    voidedAt: '2026-11-20T05:00:00Z',
    voidReason: '二重登録',
  }

  /**
   * The sales of November at the salon:
   *
   * - 20th: a cut that Aoi sold (6,600 yen), paid in cash;
   * - 20th: a color by Ren (11,000 yen) with two products he sold
   *   (2,200 yen), paid by card, of which 3,000 yen were refunded;
   * - 21st: two massages, a service without a category, by nobody
   *   (6,000 yen less 1,000 with 500 of tax), not paid;
   * - 21st: a service line that names no service, by Aoi (2,200 yen),
   *   refunded in full in cash, with a payment that was never received.
   *
   * And those the reports leave out: a void sale, sales of the days just
   * before and after November, and a sale of another salon. Returns the
   * ID of the cut.
   */
  const insertNovember = async (): Promise<string> => {
    const cut = await insertSale([line()], { staffId: aoiId })
    await insertPayment(cut, { amount: 6600 })

    const color = await insertSale([
      line({
        itemId: colorId,
        itemName: 'カラー',
        unitPrice: 10000,
        taxAmount: 1000,
        totalAmount: 11000,
        staffId: renId,
      }),
      line({
        itemType: 'product',
        itemId: null,
        itemName: 'シャンプー',
        quantity: 2,
        unitPrice: 1000,
        taxAmount: 200,
        totalAmount: 2200,
        staffId: renId,
      }),
    ])
    await insertPayment(color, {
      paymentMethodId: cardId,
      amount: 13200,
      status: 'partial_refund',
      refundAmount: 3000,
    })

    await insertSale(
      [
        line({
          itemId: massageId,
          itemName: 'マッサージ',
          quantity: 2,
          unitPrice: 3000,
          discountAmount: 1000,
          taxAmount: 500,
          totalAmount: 5500,
        }),
      ],
      { saleDate: '2026-11-21', saleTime: '2026-11-21T03:40:00Z' },
    )

    const custom = await insertSale(
      [
        line({
          itemId: null,
          itemName: '特別メニュー',
          unitPrice: 2000,
          taxAmount: 200,
          totalAmount: 2200,
          staffId: aoiId,
        }),
      ],
      { saleDate: '2026-11-21', saleTime: '2026-11-21T03:40:00Z' },
    )
    await insertPayment(custom, { amount: 2200, status: 'refunded' })
    await insertPayment(custom, { amount: 2200, status: 'failed' })

    const left = [
      { ...voided },
      { saleDate: '2026-10-31', saleTime: '2026-10-31T03:40:00Z' },
      { saleDate: '2026-12-01', saleTime: '2026-12-01T03:40:00Z' },
    ]
    for (const overrides of left) {
      const id = await insertSale([line({ staffId: aoiId })], {
        staffId: aoiId,
        ...overrides,
      })
      await insertPayment(id, { amount: 6600 })
    }
    await insertSale([line({ itemId: null })], { salonId: otherSalonId })

    return cut
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    otherSalonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    customerId = await insertCustomer(db)
    const signedInMember = async (
      role: 'owner' | 'manager' | 'staff',
      ofSalon: string = salonId,
    ) =>
      (await signIn(app, (await insertMember(db, role, ofSalon)).email))
        .authorization
    asOwner = await signedInMember('owner')
    asManager = await signedInMember('manager')
    asStaff = await signedInMember('staff')
    asOwnerOfAnotherSalon = await signedInMember('owner', otherSalonId)
    asCustomer = (await signedInUser(app, db)).authorization
    aoiId = await insertStaff(db, salonId, { displayName: 'Aoi' })
    renId = await insertStaff(db, salonId, { displayName: 'Ren' })
    cutId = await insertService('カット', await insertCategory('cut'))
    colorId = await insertService('カラー', await insertCategory('color'))
    massageId = await insertService('マッサージ', null)
    cashId = await insertMethod('cash')
    cardId = await insertMethod('credit_card')
  })

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** Asks for a report with a query; as the admin unless said otherwise. */
  const report = (
    path: string,
    query: Record<string, string>,
    as: string | null = asAdmin,
  ) => authorized(request(app).get(`${REPORTS}${path}`).query(query), as)

  /** What every report names, for November at the salon. */
  const november = (overrides: Record<string, string> = {}) => ({
    salonId,
    ...NOVEMBER,
    ...overrides,
  })

  /** The rows a report could write to, counted. */
  const counts = async () => ({
    sales: (await db.select({ n: count() }).from(sales))[0]?.n,
    payments: (await db.select({ n: count() }).from(paymentTransactions))[0]?.n,
    salons: (await db.select({ n: count() }).from(salons))[0]?.n,
  })

  describe('GET /api/v1/sales-reports', () => {
    it('reports November: the sales that are not void, what the refunds leave, and how the sales divide; and writes nothing', async () => {
      await insertNovember()
      const before = await counts()

      const response = await report('', november(), asOwner)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(JSON_UTF8)
      expect(response.body).toEqual({
        data: {
          salonId,
          startDate: '2026-11-01',
          endDate: '2026-11-30',
          totalSales: 27500,
          totalTax: 2500,
          totalDiscounts: 1000,
          totalRefunds: 5200,
          netSales: 22300,
          transactionCount: 4,
          averageTransactionValue: 6875,
          salesByMethod: [
            {
              method: 'credit_card',
              amount: 10200,
              count: 1,
              percentage: 60.7,
            },
            { method: 'cash', amount: 6600, count: 2, percentage: 39.3 },
          ],
          salesByCategory: [
            { category: 'color', amount: 11000, count: 1, percentage: 43.5 },
            { category: 'other', amount: 7700, count: 3, percentage: 30.4 },
            { category: 'cut', amount: 6600, count: 1, percentage: 26.1 },
          ],
          topStaff: [
            {
              staffId: renId,
              displayName: 'Ren',
              totalSales: 13200,
              serviceCount: 1,
              averageServiceValue: 11000,
            },
            {
              staffId: aoiId,
              displayName: 'Aoi',
              totalSales: 8800,
              serviceCount: 2,
              averageServiceValue: 4400,
            },
          ],
        },
        meta: {
          correlationId: expect.any(String),
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
          version: 'v1',
        },
        links: {
          self: `${REPORTS}?salonId=${salonId}&startDate=2026-11-01&endDate=2026-11-30`,
        },
      })
      expect(await counts()).toEqual(before)
    })

    it('reports the same figures to the admin, the owner and the manager', async () => {
      await insertNovember()

      const answers = [
        await report('', november(), asAdmin),
        await report('', november(), asOwner),
        await report('', november(), asManager),
      ]

      expect(answers.map(({ status }) => status)).toEqual([200, 200, 200])
      expect(
        new Set(answers.map(({ body }) => JSON.stringify(body.data))).size,
      ).toBe(1)
    })

    it('reports a period without a sale in zeros', async () => {
      await insertNovember()

      const response = await report(
        '',
        november({ startDate: '2026-11-22', endDate: '2026-11-30' }),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        salonId,
        startDate: '2026-11-22',
        endDate: '2026-11-30',
        totalSales: 0,
        totalTax: 0,
        totalDiscounts: 0,
        totalRefunds: 0,
        netSales: 0,
        transactionCount: 0,
        averageTransactionValue: 0,
        salesByMethod: [],
        salesByCategory: [],
        topStaff: [],
      })
    })

    it('counts the sales of the first and the last day of the period', async () => {
      await insertNovember()

      const response = await report(
        '',
        november({ startDate: '2026-10-31', endDate: '2026-12-01' }),
      )

      expect(response.body.data).toMatchObject({
        totalSales: 27500 + 6600 + 6600,
        transactionCount: 6,
      })
    })

    it('counts a sale that was voided after it was reported no more', async () => {
      const cut = await insertNovember()
      const before = await report('', november())
      await db.update(sales).set(voided).where(eq(sales.id, cut))

      const after = await report('', november())

      expect(before.body.data.transactionCount).toBe(4)
      expect(after.body.data).toMatchObject({
        totalSales: 27500 - 6600,
        transactionCount: 3,
      })
    })
  })

  describe('GET /api/v1/sales-reports/daily', () => {
    it('reports the sales of a day and what the refunds leave of them', async () => {
      await insertNovember()

      const response = await report(
        '/daily',
        { salonId, date: '2026-11-20' },
        asManager,
      )

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        data: {
          date: '2026-11-20',
          sales: 19800,
          transactions: 2,
          refunds: 3000,
          net: 16800,
        },
        links: { self: `${REPORTS}/daily?salonId=${salonId}&date=2026-11-20` },
      })
    })

    it('reports a day without a sale in zeros', async () => {
      await insertNovember()

      const response = await report('/daily', { salonId, date: '2026-11-22' })

      expect(response.body.data).toEqual({
        date: '2026-11-22',
        sales: 0,
        transactions: 0,
        refunds: 0,
        net: 0,
      })
    })
  })

  describe('GET /api/v1/sales-reports/by-staff', () => {
    it('lists every staff member of the period: the staff member of the line, or else of the sale', async () => {
      await insertNovember()

      const response = await report('/by-staff', november(), asOwner)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([
        {
          staffId: renId,
          displayName: 'Ren',
          totalSales: 13200,
          serviceCount: 1,
          averageServiceValue: 11000,
        },
        {
          staffId: aoiId,
          displayName: 'Aoi',
          totalSales: 8800,
          serviceCount: 2,
          averageServiceValue: 4400,
        },
      ])
    })

    it('counts a line for its own staff member before the staff member of its sale', async () => {
      await insertSale(
        [
          line({
            itemId: colorId,
            itemName: 'カラー',
            unitPrice: 10000,
            taxAmount: 1000,
            totalAmount: 11000,
            staffId: renId,
          }),
          line(),
        ],
        { staffId: aoiId },
      )

      const response = await report('/by-staff', november())

      expect(response.body.data).toEqual([
        {
          staffId: renId,
          displayName: 'Ren',
          totalSales: 11000,
          serviceCount: 1,
          averageServiceValue: 11000,
        },
        {
          staffId: aoiId,
          displayName: 'Aoi',
          totalSales: 6600,
          serviceCount: 1,
          averageServiceValue: 6600,
        },
      ])
    })

    it('names a staff member who left the salon, by the name they have now', async () => {
      await insertNovember()
      await db
        .update(staff)
        .set({
          displayName: 'Aoi S.',
          deletedAt: '2026-11-25T00:00:00Z',
          isActive: false,
        })
        .where(eq(staff.id, aoiId))

      const response = await report('/by-staff', november())

      expect(response.body.data).toContainEqual(
        expect.objectContaining({
          staffId: aoiId,
          displayName: 'Aoi S.',
          totalSales: 8800,
        }),
      )
    })

    it('lists more staff members than the report of the period names', async () => {
      const members = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          insertStaff(db, salonId, { displayName: `Staff ${index}` }),
        ),
      )
      for (const [index, member] of members.entries()) {
        await insertSale([
          line({
            unitPrice: 1000 * (index + 1),
            taxAmount: 0,
            totalAmount: 1000 * (index + 1),
            staffId: member,
          }),
        ])
      }

      const [byStaff, ofPeriod] = [
        await report('/by-staff', november()),
        await report('', november()),
      ]

      expect(byStaff.body.data).toHaveLength(6)
      expect(
        ofPeriod.body.data.topStaff.map(
          ({ displayName }: { displayName: string }) => displayName,
        ),
      ).toEqual(['Staff 5', 'Staff 4', 'Staff 3', 'Staff 2', 'Staff 1'])
    })
  })

  describe('GET /api/v1/sales-reports/by-category', () => {
    it('divides the service lines by the kind of the category of their service; other for a service without one', async () => {
      await insertNovember()

      const response = await report('/by-category', november(), asManager)

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([
        { category: 'color', amount: 11000, count: 1, percentage: 43.5 },
        { category: 'other', amount: 7700, count: 3, percentage: 30.4 },
        { category: 'cut', amount: 6600, count: 1, percentage: 26.1 },
      ])
    })

    it('counts a service under the category it is in now, and adds kinds of more than one category up', async () => {
      await insertNovember()
      const secondCut = await insertCategory('cut')
      await db
        .update(services)
        .set({ categoryId: secondCut })
        .where(eq(services.id, colorId))

      const response = await report('/by-category', november())

      expect(response.body.data).toEqual([
        { category: 'cut', amount: 17600, count: 2, percentage: 69.6 },
        { category: 'other', amount: 7700, count: 3, percentage: 30.4 },
      ])
    })

    it('counts a service of a category of the kind other with the lines that have no category', async () => {
      await insertNovember()
      const scalp = await insertService(
        'ヘッドスパ',
        await insertCategory('other'),
      )
      await insertSale([
        line({
          itemId: scalp,
          itemName: 'ヘッドスパ',
          unitPrice: 2000,
          taxAmount: 200,
          totalAmount: 2200,
        }),
      ])

      const response = await report('/by-category', november())

      expect(response.body.data).toEqual([
        { category: 'color', amount: 11000, count: 1, percentage: 40 },
        { category: 'other', amount: 9900, count: 4, percentage: 36 },
        { category: 'cut', amount: 6600, count: 1, percentage: 24 },
      ])
    })
  })

  describe('GET /api/v1/sales-reports/trends', () => {
    it('cuts November into weeks beginning on a Monday, under their Monday', async () => {
      await insertNovember()

      const response = await report(
        '/trends',
        november({ period: 'weekly' }),
        asOwner,
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        labels: [
          '2026-10-26',
          '2026-11-02',
          '2026-11-09',
          '2026-11-16',
          '2026-11-23',
          '2026-11-30',
        ],
        sales: [0, 0, 0, 27500, 0, 0],
        transactions: [0, 0, 0, 4, 0, 0],
        average: [0, 0, 0, 6875, 0, 0],
      })
    })

    it('cuts a period into days, each day of it there', async () => {
      await insertNovember()

      const response = await report(
        '/trends',
        november({
          startDate: '2026-11-19',
          endDate: '2026-11-22',
          period: 'daily',
        }),
      )

      expect(response.body.data).toEqual({
        labels: ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'],
        sales: [0, 19800, 7700, 0],
        transactions: [0, 2, 2, 0],
        average: [0, 9900, 3850, 0],
      })
    })

    it('cuts a period into months, the first and the last counting only the days of the period', async () => {
      await insertNovember()

      const response = await report(
        '/trends',
        november({
          startDate: '2026-10-31',
          endDate: '2026-12-01',
          period: 'monthly',
        }),
      )

      expect(response.body.data).toEqual({
        labels: ['2026-10', '2026-11', '2026-12'],
        sales: [6600, 27500, 6600],
        transactions: [1, 4, 1],
        average: [6600, 6875, 6600],
      })
    })
  })

  /** Each report with a query it takes, for the salon of the tests. */
  const operations: [string, string, () => Record<string, string>, string][] = [
    ['GET /sales-reports', '', () => november(), 'Invalid sales report'],
    [
      'GET /sales-reports/daily',
      '/daily',
      () => ({ salonId, date: '2026-11-20' }),
      'Invalid daily sales',
    ],
    [
      'GET /sales-reports/by-staff',
      '/by-staff',
      () => november(),
      'Invalid sales report',
    ],
    [
      'GET /sales-reports/by-category',
      '/by-category',
      () => november(),
      'Invalid sales report',
    ],
    [
      'GET /sales-reports/trends',
      '/trends',
      () => november({ period: 'monthly' }),
      'Invalid sales trends',
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

  describe.each(operations)('%s', (_name, path, queryOf, message) => {
    it.each(unauthenticated)(
      'answers %s with 401 before looking at the query',
      async (_case, tokenOf, problem, challenge) => {
        const authorization = await tokenOf()

        for (const query of [queryOf(), {}]) {
          const response = await report(path, query, authorization)

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
      },
    )

    it('refuses a staff member of the salon and a customer with 403, before the query is read', async () => {
      const responses = [
        await report(path, queryOf(), asStaff),
        await report(path, {}, asStaff),
        await report(path, queryOf(), asCustomer),
        await report(path, { anything: 'x' }, asCustomer),
      ]

      for (const response of responses) {
        expectProblem(response, forbidden)
      }
    })

    it('refuses the owner of another salon with 403 for this salon, and answers them for theirs', async () => {
      const ofThisSalon = await report(path, queryOf(), asOwnerOfAnotherSalon)
      const ofTheirs = await report(
        path,
        { ...queryOf(), salonId: otherSalonId },
        asOwnerOfAnotherSalon,
      )

      expectProblem(ofThisSalon, forbidden)
      expect(ofTheirs.status).toBe(200)
    })

    it('refuses a query without a parameter with 400, under its own message', async () => {
      const response = await report(path, { salonId })

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(message)
      expect(brokenRules(response).length).toBeGreaterThan(0)
      expect(
        brokenRules(response).every(
          (rule) =>
            rule.endsWith(':invalid_type') || rule.endsWith(':invalid_value'),
        ),
      ).toBe(true)
    })

    it('refuses a parameter it does not have, and one given twice, with 400', async () => {
      const unknown = await report(path, { ...queryOf(), limit: '10' })
      const twice = await authorized(
        request(app).get(
          `${REPORTS}${path}?${new URLSearchParams(queryOf())}&salonId=${salonId}`,
        ),
        asAdmin,
      )

      expectProblem(unknown, badRequest)
      expect(brokenRules(unknown)).toEqual(['limit:unrecognized_keys'])
      expectProblem(twice, badRequest)
      expect(brokenRules(twice)).toEqual(['salonId:invalid_type'])
    })

    it('refuses a salon that is no ID with 400, even to the owner of another salon', async () => {
      const response = await report(
        path,
        { ...queryOf(), salonId: 'not-an-id' },
        asOwnerOfAnotherSalon,
      )

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['salonId:invalid_format'])
    })

    it('tells the admin that a salon is not there, or was deleted, with 400', async () => {
      const deleted = await insertSalon(db, {
        deletedAt: '2026-11-01T00:00:00Z',
      })

      for (const id of [UNKNOWN_ID, deleted]) {
        const response = await report(path, { ...queryOf(), salonId: id })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(message)
        expect(response.body.errors).toEqual([
          issue('salonId', 'not_found', 'Must name a salon'),
        ])
      }
    })

    it('tells the owner of another salon nothing of a salon that is not there: 403', async () => {
      const response = await report(
        path,
        { ...queryOf(), salonId: UNKNOWN_ID },
        asOwnerOfAnotherSalon,
      )

      expectProblem(response, forbidden)
    })
  })

  describe.each(operations.filter(([, path]) => path !== '/daily'))(
    'the period of %s',
    (_name, path, queryOf, message) => {
      it('refuses a last day before the first one with 400', async () => {
        const response = await report(path, {
          ...queryOf(),
          startDate: '2026-11-20',
          endDate: '2026-11-19',
        })

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(message)
        expect(response.body.errors).toEqual([
          issue('endDate', 'custom', 'Must not be earlier than startDate'),
        ])
      })

      it('takes 366 days, and refuses one more with 400', async () => {
        const longest = await report(path, {
          ...queryOf(),
          startDate: '2025-11-17',
          endDate: '2026-11-17',
        })
        const tooLong = await report(path, {
          ...queryOf(),
          startDate: '2025-11-17',
          endDate: '2026-11-18',
        })

        expect(longest.status).toBe(200)
        expectProblem(tooLong, badRequest)
        expect(tooLong.body.errors).toEqual([
          issue(
            'endDate',
            'custom',
            'Must be within 366 days of startDate, both included',
          ),
        ])
      })

      it('refuses a day that does not exist with 400', async () => {
        const response = await report(path, {
          ...queryOf(),
          startDate: '2026-02-29',
        })

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['startDate:invalid_format'])
      })
    },
  )

  it('answers each report the same way, whatever order the parameters come in', async () => {
    await insertNovember()

    const ordered = await request(app)
      .get(
        `${REPORTS}?salonId=${salonId}&startDate=2026-11-01&endDate=2026-11-30`,
      )
      .set('Authorization', asAdmin)
    const reversed = await request(app)
      .get(
        `${REPORTS}?endDate=2026-11-30&startDate=2026-11-01&salonId=${salonId}`,
      )
      .set('Authorization', asAdmin)

    expect(statusAndCode(ordered)).toBe('200')
    expect(reversed.body.data).toEqual(ordered.body.data)
  })

  it('takes a salon written in capitals as the same salon, and answers it in small letters', async () => {
    await insertNovember()

    const response = await report(
      '',
      november({ salonId: salonId.toUpperCase() }),
      asOwner,
    )

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      salonId,
      totalSales: 27500,
    })
  })

  describe('SalesReportRepository', () => {
    it('resolves to null for a salon that is not there', async () => {
      const result = await new SalesReportRepository(db).findFigures({
        salonId: salonIdSchema.parse(UNKNOWN_ID),
        ...NOVEMBER,
      })

      expect(result).toEqual({ type: 'success', data: null })
    })

    it('resolves to a database error when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()

      const result = await new SalesReportRepository(
        connection.database,
      ).findFigures({
        salonId: salonIdSchema.parse(salonId),
        ...NOVEMBER,
      })
      await connection.close()

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: 'Failed to read the figures of a sales report',
        },
      })
    })
  })
})
