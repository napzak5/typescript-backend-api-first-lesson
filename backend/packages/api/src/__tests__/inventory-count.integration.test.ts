import {
  inventory,
  inventoryTransactions,
  products,
} from '@beauty-salon-backend/database'
import {
  type DomainError,
  inventoryIdSchema,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { InventoryRepository } from '@beauty-salon-backend/infrastructure'
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

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
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

const INVALID_COUNT = 'Invalid stock count'
const INVALID_REPORT = 'Invalid inventory value report'
const INVALID_ID = 'Invalid inventory ID'
const NO_SUCH_ROW = 'Must name a stock row of the salon'
const NO_SUCH_SALON = 'Must name a salon'
const COUNT_REASON = '棚卸しの差異'

/** The properties of an InventoryTransactionResponse. */
const MOVEMENT_PROPERTIES = [
  'balanceAfter',
  'balanceBefore',
  'createdAt',
  'expiryDate',
  'id',
  'inventoryId',
  'lotNumber',
  'performedBy',
  'productId',
  'quantity',
  'reason',
  'referenceId',
  'referenceType',
  'salonId',
  'totalCost',
  'transactionType',
  'unitCost',
]

/** A broken rule as a problem reports it. */
const issue = (field: string, rule: string, message: string) => ({
  field,
  rule,
  message,
  value: null,
  constraint: null,
})

/** Checks a refusal of the request: its message and, when given, what it broke. */
const expectRefused = (
  response: Response,
  detail: string,
  errors?: unknown[],
): void => {
  expectProblem(response, badRequest)
  expect(response.body.detail).toBe(detail)
  if (errors !== undefined) {
    expect(response.body.errors).toEqual(errors)
  }
}

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('Inventory stock count and value report API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** A product of the salon, without a category or a purchase price. */
  let productId: string

  type NewProduct = typeof products.$inferInsert
  type NewStock = typeof inventory.$inferInsert
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A product of the salon of the tests unless the overrides say otherwise. */
  const insertProduct = async (
    overrides: Partial<NewProduct> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(products)
      .values({
        salonId,
        productCode: `P${nextRow()}`,
        name: 'シャンプー',
        unit: '本',
        ...overrides,
      })
      .returning({ id: products.id })
    if (row === undefined) {
      throw new Error('No product was inserted')
    }
    return row.id
  }

  /** Stock figures that keep the rule of the table: nothing reserved. */
  const stock = (
    amount: string,
  ): { currentStock: string; availableStock: string } => ({
    currentStock: amount,
    availableStock: amount,
  })

  /**
   * A stock row written directly: of the product of the tests, with a lot
   * of its own, with 10 in stock unless the overrides say otherwise.
   */
  const insertStock = async (
    overrides: Partial<NewStock> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(inventory)
      .values({
        salonId,
        productId,
        lotNumber: `LOT-${nextRow()}`,
        ...stock('10'),
        ...overrides,
      })
      .returning({ id: inventory.id })
    if (row === undefined) {
      throw new Error('No stock row was inserted')
    }
    return row.id
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db)
    productId = await insertProduct()
  })

  const PATH = '/api/v1/inventory'

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A count of the rows of the salon of the tests, without a reason. */
  const countOf = (
    items: { inventoryId: string; countedQuantity: number }[],
    overrides: Record<string, unknown> = {},
  ) => ({ salonId, items, reason: null, ...overrides })

  const count = (body: object, as: string | null = asAdmin): Test =>
    authorized(request(app).post(`${PATH}/stock-count`), as).send(body)

  const valueReport = (
    query: Record<string, unknown> = { salonId },
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).get(`${PATH}/value-report`).query(query), as)

  /** The stock row, or undefined when there is none. */
  const stored = async (id: string) => {
    const [row] = await db.select().from(inventory).where(eq(inventory.id, id))
    return row
  }

  /** The stock figures of a row, as `current/available/reserved`. */
  const figuresOf = async (id: string): Promise<string> => {
    const row = await stored(id)
    return row === undefined
      ? 'none'
      : `${row.currentStock}/${row.availableStock}/${row.reservedStock}`
  }

  /** Every movement, in the order they were written. */
  const movements = () =>
    db
      .select()
      .from(inventoryTransactions)
      .orderBy(
        asc(inventoryTransactions.createdAt),
        asc(inventoryTransactions.id),
      )

  /** Every stock row and every movement, to tell that nothing was written. */
  const everything = async () => ({
    rows: await db.select().from(inventory).orderBy(asc(inventory.id)),
    movements: await movements(),
  })

  /** The moment of the clock that a count writes by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
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

  /** Everyone who keeps the stock of the salon of the tests. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
  ]

  /** Accounts that keep no stock at all. */
  const outsiders: [string, SignInAs][] = [
    ['a staff member of the salon', member('staff')],
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

  /** Both operations, as requests that would succeed for an administrator. */
  const operations: [string, (as: string | null, id: string) => Test][] = [
    [
      'a stock count',
      (as, id) => count(countOf([{ inventoryId: id, countedQuantity: 7 }]), as),
    ],
    ['the value report', (as) => valueReport({ salonId }, as)],
  ]

  describe('POST /api/v1/inventory/stock-count', () => {
    it('sets each row to what was counted, records an adjustment of each difference, and answers 200 with them as the contract has them', async () => {
      const short = await insertStock({ expiryDate: '2027-03-31' })
      const even = await insertStock()
      const over = await insertStock(stock('2.50'))

      const response = await count(
        countOf([
          { inventoryId: short, countedQuantity: 7 },
          { inventoryId: even, countedQuantity: 10 },
          { inventoryId: over, countedQuantity: 4 },
        ]),
      )

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          adjustments: [
            expect.objectContaining({
              inventoryId: short,
              transactionType: 'adjustment',
              quantity: -3,
              balanceBefore: 10,
              balanceAfter: 7,
            }),
            expect.objectContaining({
              inventoryId: over,
              transactionType: 'adjustment',
              quantity: 1.5,
              balanceBefore: 2.5,
              balanceAfter: 4,
            }),
          ],
          discrepancies: [
            { inventoryId: short, expected: 10, counted: 7, difference: -3 },
            { inventoryId: over, expected: 2.5, counted: 4, difference: 1.5 },
          ],
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
        links: null,
      })
      const [first] = response.body.data.adjustments
      expect(Object.keys(first).toSorted()).toEqual(MOVEMENT_PROPERTIES)
      expect(first).toEqual({
        id: expect.stringMatching(UUID),
        salonId,
        productId,
        inventoryId: short,
        transactionType: 'adjustment',
        quantity: -3,
        balanceBefore: 10,
        balanceAfter: 7,
        unitCost: null,
        totalCost: null,
        referenceType: null,
        referenceId: null,
        lotNumber: (await stored(short))?.lotNumber,
        expiryDate: '2027-03-31',
        reason: COUNT_REASON,
        performedBy: null,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect([
        await figuresOf(short),
        await figuresOf(even),
        await figuresOf(over),
      ]).toEqual(['7.00/7.00/0.00', '10.00/10.00/0.00', '4.00/4.00/0.00'])
    })

    it('writes the adjustments as it answers them', async () => {
      const id = await insertStock()

      const response = await count(
        countOf([{ inventoryId: id, countedQuantity: 8.25 }]),
      )

      const written = await movements()
      expect(written).toHaveLength(1)
      expect(written[0]).toMatchObject({
        id: response.body.data.adjustments[0].id,
        salonId,
        productId,
        inventoryId: id,
        transactionType: 'adjustment',
        quantity: '-1.75',
        balanceBefore: '10.00',
        balanceAfter: '8.25',
        reason: COUNT_REASON,
        performedBy: null,
      })
    })

    it('writes the count on every row it counted, and the count, its rows and its adjustments at one moment', async () => {
      const differs = await insertStock()
      const even = await insertStock()
      const uncounted = await insertStock()
      const before = await databaseClock()

      await count(
        countOf([
          { inventoryId: differs, countedQuantity: 9 },
          { inventoryId: even, countedQuantity: 10 },
        ]),
      )

      const after = await databaseClock()
      const [differed, kept, left] = [
        await stored(differs),
        await stored(even),
        await stored(uncounted),
      ]
      const countedAt = differed?.lastCountedAt
      expect(countedAt).toEqual(expect.any(String))
      expect(differed).toMatchObject({
        lastCountedAt: countedAt,
        lastCountedBy: null,
        updatedAt: countedAt,
      })
      expect(kept).toMatchObject({
        lastCountedAt: countedAt,
        lastCountedBy: null,
        updatedAt: countedAt,
      })
      expect(left).toMatchObject({ lastCountedAt: null, lastCountedBy: null })
      expect(left?.updatedAt).not.toBe(countedAt)
      const written = await movements()
      expect(written.map(({ createdAt }) => createdAt)).toEqual([countedAt])
      const moment = Date.parse(String(countedAt))
      expect(moment).toBeGreaterThanOrEqual(Math.floor(before))
      expect(moment).toBeLessThanOrEqual(Math.ceil(after))
    })

    it.each<[string, 'owner' | 'manager']>([
      ['the owner', 'owner'],
      ['a manager', 'manager'],
    ])(
      'writes %s who counts on the rows and the adjustments, with the reason given',
      async (_who, role) => {
        const differs = await insertStock()
        const even = await insertStock()
        const { email, staffId } = await insertMember(db, role, salonId)
        const as = (await signIn(app, email)).authorization

        const response = await count(
          countOf(
            [
              { inventoryId: differs, countedQuantity: 11 },
              { inventoryId: even, countedQuantity: 10 },
            ],
            { reason: '月末の棚卸し' },
          ),
          as,
        )

        expect(response.status).toBe(200)
        expect(response.body.data.adjustments).toEqual([
          expect.objectContaining({
            performedBy: staffId,
            reason: '月末の棚卸し',
          }),
        ])
        expect((await stored(differs))?.lastCountedBy).toBe(staffId)
        expect((await stored(even))?.lastCountedBy).toBe(staffId)
      },
    )

    it('answers a count that finds every row as it was with two empty lists, and still writes the count', async () => {
      const id = await insertStock(stock('3.50'))

      const response = await count(
        countOf([{ inventoryId: id, countedQuantity: 3.5 }]),
      )

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({ adjustments: [], discrepancies: [] })
      expect(await movements()).toEqual([])
      expect((await stored(id))?.lastCountedAt).toEqual(expect.any(String))
      expect(await figuresOf(id)).toBe('3.50/3.50/0.00')
    })

    it('counts a row again, from the stock the count before left', async () => {
      const id = await insertStock()

      await count(countOf([{ inventoryId: id, countedQuantity: 6 }]))
      const response = await count(
        countOf([{ inventoryId: id, countedQuantity: 6.5 }]),
      )

      expect(response.body.data.discrepancies).toEqual([
        { inventoryId: id, expected: 6, counted: 6.5, difference: 0.5 },
      ])
      expect(
        (await movements()).map(({ balanceBefore, balanceAfter }) =>
          [balanceBefore, balanceAfter].join('→'),
        ),
      ).toEqual(['10.00→6.00', '6.00→6.50'])
    })

    it('keeps what is reserved, and takes the stock down to it', async () => {
      const id = await insertStock({
        currentStock: '10',
        reservedStock: '4',
        availableStock: '6',
      })

      const response = await count(
        countOf([{ inventoryId: id, countedQuantity: 4 }]),
      )

      expect(response.status).toBe(200)
      expect(await figuresOf(id)).toBe('4.00/0.00/4.00')
    })

    it('refuses a count below what is reserved of any row, and writes nothing of the count', async () => {
      const fine = await insertStock()
      const reserved = await insertStock({
        currentStock: '10',
        reservedStock: '4',
        availableStock: '6',
      })
      const before = await everything()

      const response = await count(
        countOf([
          { inventoryId: fine, countedQuantity: 8 },
          { inventoryId: reserved, countedQuantity: 3.99 },
        ]),
      )

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        `What was counted of stock row ${reserved} is below its reserved stock`,
      )
      expect(await everything()).toEqual(before)
    })

    it('takes the most stock a row holds, and nothing', async () => {
      const full = await insertStock()
      const empty = await insertStock()

      const response = await count(
        countOf([
          { inventoryId: full, countedQuantity: 99_999_999.99 },
          { inventoryId: empty, countedQuantity: 0 },
        ]),
      )

      expect(response.status).toBe(200)
      expect(response.body.data.discrepancies).toEqual([
        {
          inventoryId: full,
          expected: 10,
          counted: 99_999_999.99,
          difference: 99_999_989.99,
        },
        { inventoryId: empty, expected: 10, counted: 0, difference: -10 },
      ])
      expect([await figuresOf(full), await figuresOf(empty)]).toEqual([
        '99999999.99/99999999.99/0.00',
        '0.00/0.00/0.00',
      ])
    })

    it('refuses every row that is not of the salon where the count names it, and writes nothing', async () => {
      const ours = await insertStock()
      const otherSalon = await insertSalon(db)
      const theirs = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({ salonId: otherSalon }),
      })
      const before = await everything()

      const response = await count(
        countOf([
          { inventoryId: ours, countedQuantity: 1 },
          { inventoryId: theirs, countedQuantity: 1 },
          { inventoryId: UNKNOWN_ID, countedQuantity: 1 },
        ]),
      )

      expectRefused(response, INVALID_COUNT, [
        issue('items.1.inventoryId', 'not_found', NO_SUCH_ROW),
        issue('items.2.inventoryId', 'not_found', NO_SUCH_ROW),
      ])
      expect(await everything()).toEqual(before)
    })

    it('takes IDs in upper case, and tells a row named again in other letters', async () => {
      const id = await insertStock()

      const upper = await count({
        salonId: salonId.toUpperCase(),
        items: [{ inventoryId: id.toUpperCase(), countedQuantity: 9 }],
        reason: null,
      })
      const twice = await count(
        countOf([
          { inventoryId: id, countedQuantity: 9 },
          { inventoryId: id.toUpperCase(), countedQuantity: 9 },
        ]),
      )

      expect(upper.status).toBe(200)
      expect(upper.body.data.discrepancies).toEqual([
        { inventoryId: id, expected: 10, counted: 9, difference: -1 },
      ])
      expectRefused(twice, INVALID_COUNT)
      expect(brokenRules(twice)).toEqual(['items.1.inventoryId:custom'])
    })

    it.each<[string, () => Promise<string>]>([
      ['a salon that is not there', async () => UNKNOWN_ID],
      [
        'a salon that is deleted',
        async () => insertSalon(db, { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ])(
      'tells an administrator of %s, and writes nothing',
      async (_case, salonOf) => {
        const id = await insertStock()
        const before = await everything()

        const response = await count(
          countOf([{ inventoryId: id, countedQuantity: 1 }], {
            salonId: await salonOf(),
          }),
        )

        expectRefused(response, INVALID_COUNT, [
          issue('salonId', 'not_found', NO_SUCH_SALON),
        ])
        expect(await everything()).toEqual(before)
      },
    )

    describe('what a request must be', () => {
      it.each<[string, (id: string) => object, string[]]>([
        ['no rows', () => countOf([]), ['items:too_small']],
        [
          'more rows than a count takes',
          () =>
            countOf(
              Array.from({ length: 501 }, (_, n) => ({
                inventoryId: `0193a5b8-7c2e-7d4f-8a1b-${n.toString(16).padStart(12, '0')}`,
                countedQuantity: 1,
              })),
            ),
          ['items:too_big'],
        ],
        [
          'a count below nothing',
          (id) => countOf([{ inventoryId: id, countedQuantity: -1 }]),
          ['items.0.countedQuantity:too_small'],
        ],
        [
          'a count above what a row holds',
          (id) => countOf([{ inventoryId: id, countedQuantity: 100_000_000 }]),
          ['items.0.countedQuantity:too_big'],
        ],
        [
          'a count of three decimals',
          (id) => countOf([{ inventoryId: id, countedQuantity: 1.005 }]),
          ['items.0.countedQuantity:not_multiple_of'],
        ],
        [
          'a count as text',
          (id) => ({
            salonId,
            items: [{ inventoryId: id, countedQuantity: '7' }],
            reason: null,
          }),
          ['items.0.countedQuantity:invalid_type'],
        ],
        [
          'a row that is no UUID',
          () => countOf([{ inventoryId: 'shelf-1', countedQuantity: 1 }]),
          ['items.0.inventoryId:invalid_format'],
        ],
        [
          'a row counted twice',
          (id) =>
            countOf([
              { inventoryId: id, countedQuantity: 1 },
              { inventoryId: id, countedQuantity: 2 },
            ]),
          ['items.1.inventoryId:custom'],
        ],
        [
          'a blank reason',
          (id) =>
            countOf([{ inventoryId: id, countedQuantity: 1 }], {
              reason: '  ',
            }),
          ['reason:invalid_format'],
        ],
        [
          'no reason key',
          (id) => ({
            salonId,
            items: [{ inventoryId: id, countedQuantity: 1 }],
          }),
          ['reason:invalid_type'],
        ],
        [
          'a property of no count',
          (id) =>
            countOf([{ inventoryId: id, countedQuantity: 1 }], {
              performedBy: UNKNOWN_ID,
            }),
          ['performedBy:unrecognized_keys'],
        ],
        [
          'a row with a property of no count',
          (id) => ({
            salonId,
            items: [{ inventoryId: id, countedQuantity: 1, reservedStock: 0 }],
            reason: null,
          }),
          ['items.0.reservedStock:unrecognized_keys'],
        ],
        ['a list for a body', (id) => [id], [':invalid_type']],
      ])('refuses %s, and writes nothing', async (_case, bodyOf, broken) => {
        const id = await insertStock()
        const before = await everything()

        const response = await count(bodyOf(id))

        expectRefused(response, INVALID_COUNT)
        expect(brokenRules(response)).toEqual(broken)
        expect(await everything()).toEqual(before)
      })
    })
  })

  describe('GET /api/v1/inventory/value-report', () => {
    it('sums stock times purchase price by category, rounds each to the yen, and counts the products with stock', async () => {
      const hairCare = await insertProduct({
        category: 'ヘアケア',
        purchasePrice: 1200,
      })
      await insertStock({ productId: hairCare, ...stock('3') })
      await insertStock({ productId: hairCare, ...stock('2.50') })
      const treatment = await insertProduct({
        category: 'ヘアケア',
        purchasePrice: 333,
      })
      await insertStock({ productId: treatment, ...stock('0.25') })
      const unpriced = await insertProduct({
        category: 'カラー剤',
        purchasePrice: null,
      })
      await insertStock({ productId: unpriced, ...stock('5') })
      const retired = await insertProduct({
        category: 'カラー剤',
        purchasePrice: 1000,
        isActive: false,
      })
      await insertStock({ productId: retired, ...stock('1') })
      const loose = await insertProduct({ category: null, purchasePrice: 100 })
      await insertStock({ productId: loose, ...stock('1.50') })
      const sold = await insertProduct({
        category: 'スタイリング',
        purchasePrice: 500,
      })
      await insertStock({ productId: sold, ...stock('0') })
      await insertProduct({ category: 'ネイル', purchasePrice: 800 })

      const response = await valueReport()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          totalValue: 7833,
          totalItems: 5,
          categories: [
            { category: 'ヘアケア', value: 6683, itemCount: 2 },
            { category: 'カラー剤', value: 1000, itemCount: 2 },
            { category: null, value: 150, itemCount: 1 },
          ],
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
        links: { self: `${PATH}/value-report?salonId=${salonId}` },
      })
    })

    it('rounds half up once a category is summed', async () => {
      const half = await insertProduct({ category: 'A', purchasePrice: 333 })
      await insertStock({ productId: half, ...stock('0.50') })
      const halves = await insertProduct({ category: 'B', purchasePrice: 1 })
      await insertStock({ productId: halves, ...stock('0.50') })
      await insertStock({ productId: halves, ...stock('0.50') })
      const under = await insertProduct({ category: 'C', purchasePrice: 1 })
      await insertStock({ productId: under, ...stock('0.49') })

      const response = await valueReport()

      expect(response.body.data).toEqual({
        totalValue: 168,
        totalItems: 3,
        categories: [
          { category: 'A', value: 167, itemCount: 1 },
          { category: 'B', value: 1, itemCount: 1 },
          { category: 'C', value: 0, itemCount: 1 },
        ],
      })
    })

    it('orders categories of one value by their names, without a category last', async () => {
      const amounts: [string | null, string][] = [
        [null, '1'],
        ['B', '1'],
        ['C', '2'],
        ['A', '1'],
      ]
      for (const [category, amount] of amounts) {
        await insertStock({
          productId: await insertProduct({ category, purchasePrice: 100 }),
          ...stock(amount),
        })
      }

      const response = await valueReport()

      expect(
        response.body.data.categories.map(
          ({ category }: { category: string | null }) => category,
        ),
      ).toEqual(['C', 'A', 'B', null])
    })

    it('reads the stock of the salon asked alone', async () => {
      const ours = await insertProduct({
        category: 'ヘアケア',
        purchasePrice: 10,
      })
      await insertStock({ productId: ours, ...stock('2') })
      const otherSalon = await insertSalon(db)
      await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({
          salonId: otherSalon,
          category: 'ヘアケア',
          purchasePrice: 1000,
        }),
        ...stock('5'),
      })

      const [response, theirs] = [
        await valueReport(),
        await valueReport({ salonId: otherSalon }),
      ]

      expect(response.body.data).toEqual({
        totalValue: 20,
        totalItems: 1,
        categories: [{ category: 'ヘアケア', value: 20, itemCount: 1 }],
      })
      expect(theirs.body.data.totalValue).toBe(5000)
    })

    it('reads the category asked alone, by the very name', async () => {
      const hairCare = await insertProduct({
        category: 'ヘアケア',
        purchasePrice: 100,
      })
      await insertStock({ productId: hairCare, ...stock('2') })
      const color = await insertProduct({
        category: 'Color',
        purchasePrice: 10,
      })
      await insertStock({ productId: color, ...stock('3') })
      await insertStock({
        productId: await insertProduct({ category: null, purchasePrice: 1 }),
        ...stock('4'),
      })

      const responses = [
        await valueReport({ salonId, category: 'ヘアケア' }),
        await valueReport({ salonId, category: 'color' }),
        await valueReport({ salonId, category: 'ヘアケア ' }),
      ]

      expect(responses.map(({ body }) => body.data)).toEqual([
        {
          totalValue: 200,
          totalItems: 1,
          categories: [{ category: 'ヘアケア', value: 200, itemCount: 1 }],
        },
        { totalValue: 0, totalItems: 0, categories: [] },
        { totalValue: 0, totalItems: 0, categories: [] },
      ])
    })

    it('reports a salon without stock as nothing', async () => {
      await insertStock(stock('0'))

      const response = await valueReport()

      expect(response.body.data).toEqual({
        totalValue: 0,
        totalItems: 0,
        categories: [],
      })
    })

    it('reports a value up to what a number holds exactly, and fails beyond it', async () => {
      const large = await insertProduct({
        category: 'A',
        purchasePrice: 90_000_000,
      })
      await insertStock({ productId: large, ...stock('99999999.99') })

      const exact = await valueReport()
      await insertStock({
        productId: await insertProduct({
          category: 'B',
          purchasePrice: 2_147_483_647,
        }),
        ...stock('99999999.99'),
      })
      const beyond = await valueReport()

      expect(exact.body.data.totalValue).toBe(8_999_999_999_100_000)
      expectProblem(beyond, databaseProblem)
    })

    it.each<[string, (salon: string) => Record<string, unknown>, string[]]>([
      ['no salon', () => ({}), ['salonId:invalid_type']],
      [
        'a salon that is no UUID',
        () => ({ salonId: 'tokyo' }),
        ['salonId:invalid_format'],
      ],
      [
        'a blank category',
        (salon) => ({ salonId: salon, category: '  ' }),
        ['category:invalid_format'],
      ],
      [
        'a category of a character too many',
        (salon) => ({ salonId: salon, category: 'あ'.repeat(101) }),
        ['category:too_big'],
      ],
      [
        'a parameter of no report',
        (salon) => ({ salonId: salon, limit: 10 }),
        ['limit:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, queryOf, broken) => {
      const response = await valueReport(queryOf(salonId))

      expectRefused(response, INVALID_REPORT)
      expect(brokenRules(response)).toEqual(broken)
    })

    it('refuses a salon named twice', async () => {
      const response = await request(app)
        .get(`${PATH}/value-report?salonId=${salonId}&salonId=${salonId}`)
        .set('Authorization', asAdmin)

      expectRefused(response, INVALID_REPORT)
      expect(brokenRules(response)).toEqual(['salonId:invalid_type'])
    })

    it.each<[string, () => Promise<string>]>([
      ['a salon that is not there', async () => UNKNOWN_ID],
      [
        'a salon that is deleted',
        async () => insertSalon(db, { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ])('tells an administrator of %s', async (_case, salonOf) => {
      const response = await valueReport({ salonId: await salonOf() })

      expectRefused(response, INVALID_REPORT, [
        issue('salonId', 'not_found', NO_SUCH_SALON),
      ])
    })
  })

  describe('who counts the stock of a salon and reads its value', () => {
    it.each(keepers)('lets %s do both', async (_who, signInAs) => {
      const id = await insertStock()
      const as = await signInAs()

      const responses = [
        await count(countOf([{ inventoryId: id, countedQuantity: 9 }]), as),
        await valueReport({ salonId }, as),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(await figuresOf(id)).toBe('9.00/9.00/0.00')
    })

    it.each(outsiders)(
      'refuses %s both, before anything of the request is looked at, and writes nothing',
      async (_who, signInAs) => {
        const id = await insertStock()
        const before = await everything()
        const as = await signInAs()

        for (const [, call] of operations) {
          expectProblem(await call(as, id), forbidden)
        }
        expectProblem(await count({ items: 'all' }, as), forbidden)
        expectProblem(await valueReport({ limit: 0 }, as), forbidden)
        expect(await everything()).toEqual(before)
      },
    )

    it.each<[string, 'owner' | 'manager']>([
      ['the owner', 'owner'],
      ['a manager', 'manager'],
    ])(
      'refuses %s of another salon the stock of this one, once the request is known to be one',
      async (_who, role) => {
        const id = await insertStock()
        const before = await everything()
        const as = await member(role, () => insertSalon(db))()

        const responses = [
          await count(countOf([{ inventoryId: id, countedQuantity: 1 }]), as),
          await valueReport({ salonId }, as),
          await count(countOf([{ inventoryId: id, countedQuantity: -1 }]), as),
          await valueReport({ salonId, category: '' }, as),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '403 1005',
          '403 1005',
          '400 2001',
          '400 2001',
        ])
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses the owner a count of the rows of another salon in theirs, as rows that are not there', async () => {
      const otherSalon = await insertSalon(db)
      const theirs = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({ salonId: otherSalon }),
      })
      const before = await everything()
      const as = await member('owner')()

      const response = await count(
        countOf([{ inventoryId: theirs, countedQuantity: 1 }]),
        as,
      )

      expectRefused(response, INVALID_COUNT, [
        issue('items.0.inventoryId', 'not_found', NO_SUCH_ROW),
      ])
      expect(await everything()).toEqual(before)
    })

    it.each(unauthenticated)(
      'refuses %s on both operations',
      async (_case, tokenOf, problem, challenge) => {
        const id = await insertStock()
        const token = await tokenOf()

        for (const [, call] of operations) {
          const response = await call(token, id)
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['PUT on the stock count', 'put', '/stock-count'],
      ['POST below the stock count', 'post', '/stock-count/ID'],
      ['POST on the value report', 'post', '/value-report'],
      ['PUT on the value report', 'put', '/value-report'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertStock()
        const before = await everything()

        const response = await request(app)
          [method](`${PATH}${suffix.replace('ID', id)}`)
          .set('Authorization', asAdmin)
          .send(countOf([{ inventoryId: id, countedQuantity: 1 }]))

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )

    it.each<[string, 'get' | 'patch' | 'delete']>([
      ['GET', 'get'],
      ['PATCH', 'patch'],
      ['DELETE', 'delete'],
    ])(
      'takes the stock count for the ID of a row on %s',
      async (_case, method) => {
        const before = await everything()

        const response = await request(app)
          [method](`${PATH}/stock-count`)
          .set('Authorization', asAdmin)
          .send({ shelf: 'S' })

        expectRefused(response, INVALID_ID)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
        expect(await everything()).toEqual(before)
      },
    )

    it.each<[string, 'patch' | 'delete']>([
      ['PATCH', 'patch'],
      ['DELETE', 'delete'],
    ])(
      'takes the value report for the ID of a row on %s',
      async (_case, method) => {
        const response = await request(app)
          [method](`${PATH}/value-report`)
          .set('Authorization', asAdmin)
          .send({ shelf: 'S' })

        expectRefused(response, INVALID_ID)
      },
    )
  })

  describe('requests at the same moment', () => {
    /** Holds a stock row as a movement, a change, a delete or a count of it does. */
    const holdRow = (tx: Transaction, id: string) =>
      tx
        .select({ id: inventory.id })
        .from(inventory)
        .where(eq(inventory.id, id))
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

    it('makes a count wait for a change of one of its rows, and counts the row as changed', async () => {
      const held = await insertStock()
      const free = await insertStock()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, held)
          await tx
            .update(inventory)
            .set(stock('5'))
            .where(eq(inventory.id, held))
          const underWay = count(
            countOf([
              { inventoryId: free, countedQuantity: 3 },
              { inventoryId: held, countedQuantity: 5 },
            ]),
          ).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
      expect(response.body.data.discrepancies).toEqual([
        { inventoryId: free, expected: 10, counted: 3, difference: -7 },
      ])
      expect([await figuresOf(free), await figuresOf(held)]).toEqual([
        '3.00/3.00/0.00',
        '5.00/5.00/0.00',
      ])
    })

    it('makes a count wait for a delete of one of its rows, and refuses it as a row that is not there', async () => {
      const deleted = await insertStock(stock('0'))
      const free = await insertStock()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, deleted)
          await tx.delete(inventory).where(eq(inventory.id, deleted))
          const underWay = count(
            countOf([
              { inventoryId: free, countedQuantity: 3 },
              { inventoryId: deleted, countedQuantity: 0 },
            ]),
          ).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectRefused(response, INVALID_COUNT, [
        issue('items.1.inventoryId', 'not_found', NO_SUCH_ROW),
      ])
      expect(await figuresOf(free)).toBe('10.00/10.00/0.00')
      expect(await movements()).toEqual([])
    })

    it('times a count that waited by when it got its rows', async () => {
      const id = await insertStock()

      const { pending, released } = await db.transaction(async (tx) => {
        await holdRow(tx, id)
        const underWay = count(
          countOf([{ inventoryId: id, countedQuantity: 9 }]),
        ).then((response) => response)
        await pause(300)
        return { pending: underWay, released: await databaseClock() }
      })
      const response = await pending

      expect(
        Date.parse(response.body.data.adjustments[0].createdAt),
      ).toBeGreaterThanOrEqual(Math.floor(released))
      expect(
        Date.parse(String((await stored(id))?.lastCountedAt)),
      ).toBeGreaterThanOrEqual(Math.floor(released))
    })

    it('takes counts that share rows, named in other orders, one after the other', async () => {
      const first = await insertStock()
      const second = await insertStock()

      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, n) =>
          count(
            countOf(
              n % 2 === 0
                ? [
                    { inventoryId: first, countedQuantity: n },
                    { inventoryId: second, countedQuantity: n },
                  ]
                : [
                    { inventoryId: second, countedQuantity: n },
                    { inventoryId: first, countedQuantity: n },
                  ],
            ),
          ),
        ),
      )

      expect(responses.map(statusAndCode)).toEqual(
        Array.from({ length: 6 }, () => '200'),
      )
      for (const id of [first, second]) {
        const ofRow = (await movements()).filter(
          ({ inventoryId }) => inventoryId === id,
        )
        const row = await stored(id)
        expect(ofRow.at(-1)?.balanceAfter).toBe(row?.currentStock)
        ofRow.slice(1).forEach((movement, index) => {
          expect(movement.balanceBefore).toBe(ofRow[index]?.balanceAfter)
        })
      }
    })

    it('takes a count among movements of its row in turns, each from the stock the one before left', async () => {
      const id = await insertStock()

      const responses = await Promise.all([
        ...Array.from({ length: 4 }, () =>
          request(app)
            .post(`${PATH}/movement`)
            .set('Authorization', asAdmin)
            .send({
              inventoryId: id,
              transactionType: 'sale',
              quantity: -1,
              unitCost: null,
              referenceType: null,
              referenceId: null,
              reason: null,
            }),
        ),
        count(countOf([{ inventoryId: id, countedQuantity: 20 }])),
      ])

      expect(responses.map(statusAndCode)).toEqual(
        Array.from({ length: 5 }, () => '200'),
      )
      const written = await movements()
      expect(written).toHaveLength(5)
      written.slice(1).forEach((movement, index) => {
        expect(movement.balanceBefore).toBe(written[index]?.balanceAfter)
      })
      expect(written.at(-1)?.balanceAfter).toBe(
        (await stored(id))?.currentStock,
      )
    })

    it('reads the value of the stock while its rows are held', async () => {
      const id = await insertStock()

      const answered = await db.transaction(async (tx) => {
        await holdRow(tx, id)
        return answersWithin(
          valueReport().then((response) => response),
          2_000,
        )
      })

      expect(answered).toBe(true)
    })
  })

  describe('InventoryRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new InventoryRepository(db)
    const idOf = (id: string) => inventoryIdSchema.parse(id)
    const salonOf = (id: string = salonId) => salonIdSchema.parse(id)

    /** A count as the use case hands it on, by no one. */
    const criteria = (
      items: { inventoryId: string; countedQuantity: string }[],
    ) => ({
      salonId: salonOf(),
      items: items.map(({ inventoryId, countedQuantity }) => ({
        inventoryId: idOf(inventoryId),
        countedQuantity,
      })),
      reason: COUNT_REASON,
      performedBy: null,
    })

    it('returns the adjustments and the differences in the order of the count, not of the rows', async () => {
      const ids = (
        await Promise.all([insertStock(), insertStock(), insertStock()])
      ).toSorted()
      const [low, middle, high] = ids
      if (low === undefined || middle === undefined || high === undefined) {
        throw new Error('No rows were inserted')
      }

      const counted = dataOf(
        await repository().performStockCount(
          criteria([
            { inventoryId: high, countedQuantity: '1.00' },
            { inventoryId: middle, countedQuantity: '10.00' },
            { inventoryId: low, countedQuantity: '2.00' },
          ]),
        ),
      )

      expect(counted).toMatchObject({
        type: 'counted',
        adjustments: [
          { inventoryId: high, quantity: '-9.00' },
          { inventoryId: low, quantity: '-8.00' },
        ],
        discrepancies: [
          {
            inventoryId: high,
            expected: '10.00',
            counted: '1.00',
            difference: '-9.00',
          },
          {
            inventoryId: low,
            expected: '10.00',
            counted: '2.00',
            difference: '-8.00',
          },
        ],
      })
    })

    it('says which rows of the count are not of the salon, and which row the count would take below what is reserved', async () => {
      const ours = await insertStock()
      const reserved = (): Promise<string> =>
        insertStock({
          currentStock: '5',
          reservedStock: '5',
          availableStock: '0',
        })
      const [lower, higher] = (
        await Promise.all([reserved(), reserved()])
      ).toSorted()
      if (lower === undefined || higher === undefined) {
        throw new Error('No rows were inserted')
      }
      const otherSalon = await insertSalon(db)
      const theirs = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({ salonId: otherSalon }),
      })

      expect(
        dataOf(
          await repository().performStockCount(
            criteria([
              { inventoryId: UNKNOWN_ID, countedQuantity: '1.00' },
              { inventoryId: ours, countedQuantity: '1.00' },
              { inventoryId: theirs, countedQuantity: '1.00' },
            ]),
          ),
        ),
      ).toEqual({ type: 'rowsNotFound', indexes: [0, 2] })
      expect(
        dataOf(
          await repository().performStockCount(
            criteria([
              { inventoryId: ours, countedQuantity: '1.00' },
              { inventoryId: higher, countedQuantity: '4.99' },
              { inventoryId: lower, countedQuantity: '4.99' },
            ]),
          ),
        ),
      ).toEqual({ type: 'belowReserved', inventoryId: higher })
    })

    it('returns the value of each category as text of whole yen', async () => {
      await insertStock({
        productId: await insertProduct({ category: 'A', purchasePrice: 3 }),
        ...stock('0.50'),
      })

      expect(dataOf(await repository().valueReport(salonOf(), null))).toEqual([
        { category: 'A', value: '2', itemCount: 1 },
      ])
      expect(dataOf(await repository().valueReport(salonOf(), 'B'))).toEqual([])
    })

    it('fails when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()
      const unreachable = new InventoryRepository(connection.database)

      const results = [
        await unreachable.performStockCount(
          criteria([{ inventoryId: UNKNOWN_ID, countedQuantity: '1.00' }]),
        ),
        await unreachable.valueReport(salonOf(), null),
      ]
      await connection.close()

      expect(results).toEqual([
        {
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to perform stock count',
          }),
        },
        {
          type: 'error',
          error: expect.objectContaining({
            type: 'database',
            message: 'Failed to read the value of the stock',
          }),
        },
      ])
    })
  })
})
