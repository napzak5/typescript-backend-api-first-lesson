import {
  inventory,
  inventoryTransactions,
  products,
} from '@beauty-salon-backend/database'
import {
  type DbNewInventoryMovement,
  type DomainError,
  inventoryIdSchema,
  inventoryTransactionIdSchema,
  type LedgerReach,
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

const INVALID = 'Invalid stock movement'
const INVALID_SEARCH = 'Invalid stock movement search'
const INVALID_ID = 'Invalid inventory ID'
const BELOW_RESERVED =
  'The stock of the row would fall below its reserved stock'
const OVER_LIMIT = 'The stock of the row would go above 99999999.99'
const NO_SUCH_ROW = 'Must name a stock row'
const NO_SUCH_CURSOR = 'Must name a stock movement of the stock row'

/** The properties of an InventoryTransactionResponse. */
const PROPERTIES = [
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

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: { id: string }) => id)

describe('Inventory movements API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** A product of the salon that is not kept by lots. */
  let productId: string

  type NewStock = typeof inventory.$inferInsert
  type NewMovement = typeof inventoryTransactions.$inferInsert
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A product of the salon, not kept by lots unless said so. */
  const insertProduct = async (
    requiresLotTracking = false,
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [row] = await db
      .insert(products)
      .values({
        salonId: ofSalon,
        productCode: `P${nextRow()}`,
        name: 'シャンプー',
        unit: '本',
        requiresLotTracking,
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
   * A stock row written directly: of the product of the tests, without a
   * lot, with 10 in stock unless the overrides say otherwise.
   */
  const insertStock = async (
    overrides: Partial<NewStock> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(inventory)
      .values({ salonId, productId, ...stock('10'), ...overrides })
      .returning({ id: inventory.id })
    if (row === undefined) {
      throw new Error('No stock row was inserted')
    }
    return row.id
  }

  /** A movement written directly: an adjustment of 1, from 0 to 1. */
  const insertMovement = async (
    inventoryId: string,
    overrides: Partial<NewMovement> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(inventoryTransactions)
      .values({
        salonId,
        productId,
        inventoryId,
        transactionType: 'adjustment',
        quantity: '1',
        balanceBefore: '0',
        balanceAfter: '1',
        reason: '棚卸の差異',
        ...overrides,
      })
      .returning({ id: inventoryTransactions.id })
    if (row === undefined) {
      throw new Error('No movement was inserted')
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

  /** A request that keeps every rule: three bought in, at a cost. */
  const purchase = (
    inventoryId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    inventoryId,
    transactionType: 'purchase',
    quantity: 3,
    unitCost: 1200,
    referenceType: 'purchase_order',
    referenceId: UNKNOWN_ID,
    reason: null,
    ...overrides,
  })

  /** A request of the kind, without a cost or a reference. */
  const ofKind = (
    inventoryId: string,
    transactionType: string,
    quantity: number,
    reason: string | null = null,
  ) =>
    purchase(inventoryId, {
      transactionType,
      quantity,
      unitCost: null,
      referenceType: null,
      referenceId: null,
      reason,
    })

  const move = (body: object, as: string | null = asAdmin): Test =>
    authorized(request(app).post(`${PATH}/movement`), as).send(body)

  const history = (
    id: string,
    query: Record<string, unknown> = {},
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).get(`${PATH}/${id}/movements`).query(query), as)

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

  /** The moment of the clock that a movement writes by. */
  const databaseClock = async (): Promise<number> => {
    const [row] = await getTestDbClient()<{ now: number }[]>`
      SELECT (extract(epoch from clock_timestamp()) * 1000)::float8 AS now
    `
    if (row === undefined) {
      throw new Error('The database did not tell the time')
    }
    return row.now
  }

  /** Checks that a time is of the milliseconds between two moments. */
  const expectBetween = (
    time: unknown,
    before: number,
    after: number,
  ): void => {
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

  /** Everyone who reads the stock of the salon of the tests. */
  const readers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Those of them who keep it. */
  const keepers: [string, SignInAs][] = readers.slice(0, 3)

  /** Accounts that reach no stock at all. */
  const outsiders: [string, SignInAs][] = [
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
    ['a movement', (as, id) => move(purchase(id), as)],
    ['the history', (as, id) => history(id, {}, as)],
  ]

  describe('POST /api/v1/inventory/movement', () => {
    it('moves the stock, and answers 200 with the movement as the contract has it and where to read it', async () => {
      const lotProduct = await insertProduct(true)
      const id = await insertStock({
        productId: lotProduct,
        lotNumber: 'LOT-2026-001',
        expiryDate: '2027-03-31',
      })
      const before = await databaseClock()

      const response = await move(purchase(id))
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(Object.keys(response.body).toSorted()).toEqual([
        'data',
        'links',
        'meta',
      ])
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expect(response.body.data).toEqual({
        id: expect.stringMatching(UUID),
        salonId,
        productId: lotProduct,
        inventoryId: id,
        transactionType: 'purchase',
        quantity: 3,
        balanceBefore: 10,
        balanceAfter: 13,
        unitCost: 1200,
        totalCost: 3600,
        referenceType: 'purchase_order',
        referenceId: UNKNOWN_ID,
        lotNumber: 'LOT-2026-001',
        expiryDate: '2027-03-31',
        reason: null,
        performedBy: null,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expectBetween(response.body.data.createdAt, before, after)
      expect(response.body.links).toEqual({
        inventory: `${PATH}/${id}`,
        movements: `${PATH}/${id}/movements`,
      })
      expect(await figuresOf(id)).toBe('13.00/13.00/0.00')
      const row = await stored(id)
      expectBetween(row?.updatedAt, before, after)
    })

    it('writes the movement as it answers it', async () => {
      const id = await insertStock()

      const response = await move(purchase(id))

      const [written] = await movements()
      expect(written).toMatchObject({
        id: response.body.data.id,
        inventoryId: id,
        quantity: '3.00',
        balanceBefore: '10.00',
        balanceAfter: '13.00',
        unitCost: 1200,
        totalCost: 3600,
        performedBy: null,
      })
      expect(Date.parse(String(written?.createdAt))).toBe(
        Date.parse(response.body.data.createdAt),
      )
    })

    it('takes stock out of what is available, and leaves what is reserved', async () => {
      const id = await insertStock({
        currentStock: '10',
        availableStock: '6',
        reservedStock: '4',
      })

      const response = await move(ofKind(id, 'sale', -6))

      expect(response.body.data).toMatchObject({
        quantity: -6,
        balanceBefore: 10,
        balanceAfter: 4,
      })
      expect(await figuresOf(id)).toBe('4.00/0.00/4.00')
    })

    it('writes the staff member who records it', async () => {
      const id = await insertStock()
      const { email, staffId } = await insertMember(db, 'staff', salonId)
      const as = (await signIn(app, email)).authorization

      const response = await move(ofKind(id, 'use', -0.25), as)

      expect(response.body.data).toMatchObject({
        performedBy: staffId,
        quantity: -0.25,
        balanceAfter: 9.75,
      })
      expect(await figuresOf(id)).toBe('9.75/9.75/0.00')
    })

    it.each<[string, number, string | null, string]>([
      ['purchase', 0.01, null, '10.01'],
      ['sale', -1, null, '9.00'],
      ['use', -9.99, null, '0.01'],
      ['return', 2, null, '12.00'],
      ['return', -2, null, '8.00'],
      ['adjustment', 0.5, '棚卸の差異', '10.50'],
      ['adjustment', -10, '棚卸の差異', '0.00'],
      ['disposal', -3, '期限切れ', '7.00'],
      ['transfer', -4, null, '6.00'],
      ['transfer', 4, null, '14.00'],
    ])(
      'records a %s of %d and moves the stock to what it says',
      async (transactionType, quantity, reason, current) => {
        const id = await insertStock()

        const response = await move(
          ofKind(id, transactionType, quantity, reason),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          transactionType,
          quantity,
          reason,
          unitCost: null,
          totalCost: null,
        })
        expect(await figuresOf(id)).toBe(`${current}/${current}/0.00`)
      },
    )

    it.each<[number, number, number]>([
      [0.5, 3, 2],
      [-0.5, 3, 2],
      [0.29, 3, 1],
      [-2.25, 0, 0],
      [3.07, 699_506_074, 2_147_483_647],
    ])(
      'costs a quantity of %d at %d yen as %d, rounded half up',
      async (quantity, unitCost, totalCost) => {
        const id = await insertStock()

        const response = await move({
          ...ofKind(id, 'adjustment', quantity, '棚卸の差異'),
          unitCost,
        })

        expect(response.body.data).toMatchObject({ unitCost, totalCost })
      },
    )

    it('takes the stock to what is reserved, and to the most a row holds', async () => {
      const reserved = await insertStock({
        currentStock: '5',
        availableStock: '3',
        reservedStock: '2',
      })
      const full = await insertStock({
        productId: await insertProduct(),
        ...stock('99999999.00'),
      })

      const responses = [
        await move(ofKind(reserved, 'sale', -3)),
        await move(ofKind(full, 'purchase', 0.99)),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect(await figuresOf(reserved)).toBe('2.00/0.00/2.00')
      expect(await figuresOf(full)).toBe('99999999.99/99999999.99/0.00')
    })

    it.each<[string, Partial<NewStock>, string, number, string]>([
      [
        'below what is reserved',
        { currentStock: '5', availableStock: '3', reservedStock: '2' },
        'sale',
        -3.01,
        BELOW_RESERVED,
      ],
      ['below none', stock('2'), 'use', -2.01, BELOW_RESERVED],
      [
        'below none by an adjustment',
        stock('0'),
        'adjustment',
        -1,
        BELOW_RESERVED,
      ],
      [
        'above the most a row holds',
        stock('99999999.99'),
        'return',
        0.01,
        OVER_LIMIT,
      ],
      [
        'above the most by the largest movement',
        stock('1'),
        'purchase',
        99_999_999.99,
        OVER_LIMIT,
      ],
    ])(
      'refuses with 409 a movement that takes the stock %s, and writes nothing',
      async (_case, figures, transactionType, quantity, detail) => {
        const id = await insertStock(figures)
        const before = await everything()

        const response = await move(
          ofKind(id, transactionType, quantity, '棚卸の差異'),
        )

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(detail)
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses a row that is not there as a property of the request, and writes nothing', async () => {
      const id = await insertStock()
      await db.delete(inventory).where(eq(inventory.id, id))

      for (const missing of [id, UNKNOWN_ID]) {
        const response = await move(purchase(missing))

        expectRefused(response, INVALID, [
          issue('inventoryId', 'not_found', NO_SUCH_ROW),
        ])
      }
      expect(await movements()).toEqual([])
    })

    describe('what a request must be', () => {
      it.each<[string, Record<string, unknown>, [string, string][]]>([
        [
          'a movement of nothing',
          { transactionType: 'return', quantity: 0 },
          [['quantity', 'custom']],
        ],
        ['a purchase of nothing', { quantity: 0 }, [['quantity', 'custom']]],
        ['a purchase out', { quantity: -3 }, [['quantity', 'custom']]],
        [
          'a sale in',
          { transactionType: 'sale', quantity: 1 },
          [['quantity', 'custom']],
        ],
        [
          'a disposal in',
          { transactionType: 'disposal', quantity: 1, reason: '破損' },
          [['quantity', 'custom']],
        ],
        [
          'an adjustment without a reason',
          { transactionType: 'adjustment', reason: null },
          [['reason', 'custom']],
        ],
        [
          'a disposal without a reason',
          { transactionType: 'disposal', quantity: -1, reason: null },
          [['reason', 'custom']],
        ],
        [
          'a kind of reference without an ID',
          { referenceId: null },
          [['referenceId', 'custom']],
        ],
        [
          'an ID of a reference without its kind',
          { referenceType: null },
          [['referenceType', 'custom']],
        ],
        [
          'a total cost above an integer',
          { quantity: 2, unitCost: 1_073_741_824 },
          [['unitCost', 'too_big']],
        ],
        [
          'a unit cost above an integer, which is not looked at again for its total',
          { unitCost: 2_147_483_648 },
          [['unitCost', 'too_big']],
        ],
        [
          'a purchase out at a total cost above an integer',
          { quantity: -2, unitCost: 1_073_741_824 },
          [
            ['unitCost', 'too_big'],
            ['quantity', 'custom'],
          ],
        ],
        [
          'a quantity of three decimals',
          { quantity: 1.005 },
          [['quantity', 'not_multiple_of']],
        ],
        [
          'a quantity above the most',
          { quantity: 100_000_000 },
          [['quantity', 'too_big']],
        ],
        [
          'a quantity below the least',
          {
            transactionType: 'adjustment',
            quantity: -100_000_000,
            reason: '数え直し',
          },
          [['quantity', 'too_small']],
        ],
        [
          'a quantity that is text',
          { quantity: '3' },
          [['quantity', 'invalid_type']],
        ],
        [
          'a unit cost with a fraction',
          { unitCost: 1.5 },
          [['unitCost', 'invalid_type']],
        ],
        ['a negative unit cost', { unitCost: -1 }, [['unitCost', 'too_small']]],
        [
          'an unknown kind',
          { transactionType: 'loss' },
          [['transactionType', 'invalid_value']],
        ],
        [
          'a stock row that is no UUID',
          { inventoryId: 'latest' },
          [['inventoryId', 'invalid_format']],
        ],
        [
          'a reference ID that is no UUID',
          { referenceId: 'PO-1' },
          [['referenceId', 'invalid_format']],
        ],
        [
          'a blank kind of reference',
          { referenceType: ' ' },
          [['referenceType', 'invalid_format']],
        ],
        [
          'a kind of reference of 51 characters',
          { referenceType: 'r'.repeat(51) },
          [['referenceType', 'too_big']],
        ],
        ['a blank reason', { reason: '' }, [['reason', 'invalid_format']]],
      ])('refuses %s, and writes nothing', async (_case, overrides, broken) => {
        const id = await insertStock()
        const before = await everything()

        const response = await move(purchase(id, overrides))

        expectRefused(response, INVALID)
        expect(
          response.body.errors.map(
            ({ field, rule }: { field: string; rule: string }) => [field, rule],
          ),
        ).toEqual(broken)
        expect(await everything()).toEqual(before)
      })

      it('names the largest unit cost that the quantity takes, and takes it', async () => {
        const id = await insertStock()

        const refused = await move(
          purchase(id, { quantity: 1.01, unitCost: 2_126_221_434 }),
        )
        const taken = await move(
          purchase(id, { quantity: 1.01, unitCost: 2_126_221_433 }),
        )

        expectRefused(refused, INVALID, [
          issue(
            'unitCost',
            'too_big',
            'Must be at most 2126221433: the total cost, unitCost × |quantity| rounded, has to be at most 2147483647',
          ),
        ])
        expect(taken.status).toBe(200)
        expect(taken.body.data.totalCost).toBe(2_147_483_647)
      })

      it.each([
        'salonId',
        'productId',
        'balanceBefore',
        'balanceAfter',
        'totalCost',
        'performedBy',
        'lotNumber',
        'createdAt',
      ])(
        'refuses a request that states %s: the server sets it',
        async (key) => {
          const id = await insertStock()

          const response = await move({ ...purchase(id), [key]: null })

          expectRefused(response, INVALID, [
            issue(key, 'unrecognized_keys', expect.any(String)),
          ])
          expect(await movements()).toEqual([])
        },
      )

      it.each(['unitCost', 'referenceType', 'referenceId', 'reason'])(
        'refuses a request without %s',
        async (key) => {
          const id = await insertStock()
          const without = Object.fromEntries(
            Object.entries(purchase(id)).filter(([name]) => name !== key),
          )

          const response = await move(without)

          expectRefused(response, INVALID)
          expect(brokenRules(response)).toEqual([`${key}:invalid_type`])
        },
      )

      it('reports everything that is wrong at once', async () => {
        const id = await insertStock()

        const response = await move(
          purchase(id, {
            transactionType: 'disposal',
            quantity: 3,
            reason: null,
            referenceId: null,
          }),
        )

        expect(brokenRules(response)).toEqual([
          'quantity:custom',
          'reason:custom',
          'referenceId:custom',
        ])
      })

      it.each([
        ['a list of requests', [purchase(UNKNOWN_ID)]],
        ['an empty list', []],
      ])('refuses %s in place of the request', async (_case, body) => {
        const response = await move(body)

        expectRefused(response, INVALID, [
          issue('', 'invalid_type', expect.any(String)),
        ])
      })

      it.each([
        ['a body that is not JSON', '{"inventoryId":'],
        ['a body that is null', 'null'],
        ['a body that is text', '"purchase"'],
      ])('refuses %s as a body that cannot be read', async (_case, body) => {
        const response = await request(app)
          .post(`${PATH}/movement`)
          .set('Authorization', asAdmin)
          .set('Content-Type', 'application/json')
          .send(body)

        expectProblem(response, unreadable)
        expect(await movements()).toEqual([])
      })

      it('looks at the request before the row, and at the row before the stock', async () => {
        const id = await insertStock(stock('0'))

        const responses = [
          await move(ofKind(UNKNOWN_ID, 'sale', 1)),
          await move(ofKind(UNKNOWN_ID, 'sale', -100)),
          await move(ofKind(id, 'sale', -100)),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '400 2001',
          '400 2001',
          '409 3003',
        ])
        expect(responses.slice(0, 2).map(brokenRules)).toEqual([
          ['quantity:custom'],
          ['inventoryId:not_found'],
        ])
      })
    })
  })

  describe('GET /api/v1/inventory/:id/movements', () => {
    it('lists the movements of the row latest first, as the contract has them, with how many there are and where the list is', async () => {
      const id = await insertStock()
      const other = await insertStock({ productId: await insertProduct() })
      const recorded = [
        await move(purchase(id)),
        await move(ofKind(id, 'sale', -2)),
        await move(ofKind(other, 'sale', -1)),
        await move(ofKind(id, 'use', -0.5)),
      ]

      const response = await history(id)

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual(
        [recorded[3], recorded[1], recorded[0]].map(
          (movement) => movement?.body.data.id,
        ),
      )
      expect(response.body.data[0]).toEqual(recorded[3]?.body.data)
      expect(
        response.body.data.map(
          ({ balanceBefore, balanceAfter }: Record<string, number>) =>
            `${balanceBefore}→${balanceAfter}`,
        ),
      ).toEqual(['11→10.5', '13→11', '10→13'])
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
      expect(response.body.links).toEqual({
        self: `${PATH}/${id}/movements`,
        first: `${PATH}/${id}/movements`,
        last: null,
        next: null,
        prev: null,
      })
    })

    it('answers with an empty list for a row without movements', async () => {
      const id = await insertStock()

      const response = await history(id)

      expect(response.body.data).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    it('has no next page after a page that holds the last movements', async () => {
      const id = await insertStock()
      await insertMovement(id, { createdAt: '2026-11-01T00:00:00Z' })
      await insertMovement(id, { createdAt: '2026-11-02T00:00:00Z' })

      const response = await history(id, { limit: 2 })

      expect(response.body.data).toHaveLength(2)
      expect(response.body.meta).toMatchObject({
        total: 2,
        hasMore: false,
        nextCursor: null,
      })
      expect(response.body.links.next).toBeNull()
    })

    it('orders the movements of one moment by their IDs, downwards', async () => {
      const id = await insertStock()
      const createdAt = '2026-11-10T00:00:00.123456Z'
      const ids = [
        await insertMovement(id, {
          id: '00000000-0000-4000-8000-000000000002',
          createdAt,
        }),
        await insertMovement(id, {
          id: '00000000-0000-4000-8000-000000000003',
          createdAt,
        }),
        await insertMovement(id, {
          id: '00000000-0000-4000-8000-000000000001',
          createdAt,
        }),
      ]

      const response = await history(id)

      expect(idsOf(response)).toEqual([ids[1], ids[0], ids[2]])
    })

    it('pages through the movements, keeping the filters of the query in the links', async () => {
      const id = await insertStock()
      const ids: string[] = []
      for (const day of ['01', '02', '03', '04', '05']) {
        ids.push(
          await insertMovement(id, { createdAt: `2026-11-${day}T00:00:00Z` }),
        )
      }
      await insertMovement(id, {
        transactionType: 'return',
        reason: null,
        createdAt: '2026-11-06T00:00:00Z',
      })

      const first = await history(id, {
        limit: 2,
        transactionType: 'adjustment',
      })
      const second = await request(app)
        .get(first.body.links.next)
        .set('Authorization', asAdmin)
      const third = await request(app)
        .get(second.body.links.next)
        .set('Authorization', asAdmin)

      expect([idsOf(first), idsOf(second), idsOf(third)]).toEqual([
        [ids[4], ids[3]],
        [ids[2], ids[1]],
        [ids[0]],
      ])
      expect(first.body.meta).toEqual({
        total: 5,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: ids[3],
        prevCursor: null,
      })
      expect(first.body.links).toEqual({
        self: `${PATH}/${id}/movements?limit=2&transactionType=adjustment`,
        first: `${PATH}/${id}/movements?limit=2&transactionType=adjustment`,
        last: null,
        next: `${PATH}/${id}/movements?limit=2&transactionType=adjustment&cursor=${ids[3]}`,
        prev: null,
      })
      expect(second.body.meta).toMatchObject({ cursor: ids[3], hasMore: true })
      expect(third.body.meta).toMatchObject({
        cursor: ids[1],
        hasMore: false,
        nextCursor: null,
      })
      expect(third.body.links.next).toBeNull()
    })

    it('starts a page after a movement of the row the filters no longer match', async () => {
      const id = await insertStock()
      const older = await insertMovement(id, {
        createdAt: '2026-11-01T00:00:00Z',
      })
      const returned = await insertMovement(id, {
        transactionType: 'return',
        reason: null,
        createdAt: '2026-11-02T00:00:00Z',
      })

      const response = await history(id, {
        cursor: returned,
        transactionType: 'adjustment',
      })

      expect(idsOf(response)).toEqual([older])
    })

    describe('filters', () => {
      let id: string
      let ids: Record<string, string>

      beforeEach(async () => {
        id = await insertStock()
        ids = {
          early: await insertMovement(id, {
            createdAt: '2026-11-10T00:00:00.122999Z',
          }),
          edge: await insertMovement(id, {
            transactionType: 'purchase',
            reason: null,
            createdAt: '2026-11-10T00:00:00.123456Z',
          }),
          late: await insertMovement(id, {
            transactionType: 'use',
            quantity: '-1',
            balanceBefore: '1',
            balanceAfter: '0',
            reason: null,
            createdAt: '2026-11-10T00:00:00.124Z',
          }),
        }
      })

      it.each<[string, Record<string, unknown>, string[]]>([
        ['a kind', { transactionType: 'purchase' }, ['edge']],
        [
          'a start, at the millisecond a movement is shown with',
          { startDate: '2026-11-10T00:00:00.123Z' },
          ['late', 'edge'],
        ],
        [
          'an end, at the millisecond a movement is shown with',
          { endDate: '2026-11-10T00:00:00.123Z' },
          ['edge', 'early'],
        ],
        [
          'a start and an end of one millisecond',
          {
            startDate: '2026-11-10T00:00:00.123Z',
            endDate: '2026-11-10T00:00:00.123Z',
          },
          ['edge'],
        ],
        [
          'a kind and a period',
          { transactionType: 'use', startDate: '2026-11-10T00:00:00Z' },
          ['late'],
        ],
        [
          'a period without movements',
          {
            startDate: '2026-11-11T00:00:00Z',
            endDate: '2026-11-12T00:00:00Z',
          },
          [],
        ],
      ])('lists the movements of %s', async (_case, query, expected) => {
        const response = await history(id, query)

        expect(response.status).toBe(200)
        expect(idsOf(response)).toEqual(expected.map((name) => ids[name]))
        expect(response.body.meta.total).toBe(expected.length)
      })
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['a limit of 0', { limit: 0 }, ['limit:too_small']],
      ['a limit of 101', { limit: 101 }, ['limit:too_big']],
      ['a limit that is no number', { limit: 'all' }, ['limit:invalid_format']],
      [
        'a cursor that is no UUID',
        { cursor: 'next' },
        ['cursor:invalid_format'],
      ],
      [
        'an unknown kind',
        { transactionType: 'loss' },
        ['transactionType:invalid_value'],
      ],
      [
        'a start that is a date',
        { startDate: '2026-11-10' },
        ['startDate:invalid_format'],
      ],
      [
        'an end before the start',
        {
          startDate: '2026-11-10T00:00:00.001Z',
          endDate: '2026-11-10T00:00:00Z',
        },
        ['endDate:custom'],
      ],
      [
        'a filter it does not know',
        { salonId: UNKNOWN_ID },
        ['salonId:unrecognized_keys'],
      ],
      [
        'a kind given twice',
        { transactionType: ['sale', 'use'] },
        ['transactionType:invalid_value'],
      ],
    ])('refuses %s', async (_case, query, rules) => {
      const id = await insertStock()

      const response = await history(id, query)

      expectRefused(response, INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(rules)
    })

    it('refuses a cursor that names no movement of the row', async () => {
      const id = await insertStock()
      const other = await insertStock({ productId: await insertProduct() })
      const ofOther = await insertMovement(other)

      for (const cursor of [ofOther, UNKNOWN_ID]) {
        const response = await history(id, { cursor })

        expectRefused(response, INVALID_SEARCH, [
          issue('cursor', 'not_found', NO_SUCH_CURSOR),
        ])
      }
    })

    it('answers 404 for a row that is not there, or that was deleted', async () => {
      const id = await insertStock(stock('0'))
      await db.delete(inventory).where(eq(inventory.id, id))

      for (const missing of [id, UNKNOWN_ID]) {
        expectProblem(await history(missing), notFound)
      }
    })

    it('takes an ID in upper case, and names the history as it was asked for', async () => {
      const id = await insertStock()
      await move(purchase(id))

      const response = await history(id.toUpperCase())

      expect(response.body.data).toHaveLength(1)
      expect(response.body.links.self).toBe(
        `${PATH}/${id.toUpperCase()}/movements`,
      )
    })

    it.each(['latest', '42', `${UNKNOWN_ID}0`])(
      'refuses %s as the ID',
      async (id) => {
        const response = await history(id)

        expectRefused(response, INVALID_ID)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
      },
    )

    it('looks at the ID before the query, and at the query before the row', async () => {
      const responses = [
        await history('latest', { limit: 0 }),
        await history(UNKNOWN_ID, { limit: 0 }),
      ]

      expect(responses.map(brokenRules)).toEqual([
        ['id:invalid_format'],
        ['limit:too_small'],
      ])
    })
  })

  describe('who records and who reads the movements of a salon', () => {
    it.each(readers)(
      'lets %s record a purchase, a sale, a use and a return, and read them',
      async (_who, signInAs) => {
        const id = await insertStock()
        const as = await signInAs()

        const responses = [
          await move(ofKind(id, 'purchase', 2), as),
          await move(ofKind(id, 'sale', -1), as),
          await move(ofKind(id, 'use', -1), as),
          await move(ofKind(id, 'return', 1), as),
          await history(id, {}, as),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '200',
          '200',
          '200',
          '200',
          '200',
        ])
        expect(responses[4]?.body.data).toHaveLength(4)
        expect(await figuresOf(id)).toBe('11.00/11.00/0.00')
      },
    )

    it.each(keepers)(
      'lets %s record an adjustment, a disposal and a transfer',
      async (_who, signInAs) => {
        const id = await insertStock()
        const as = await signInAs()

        const responses = [
          await move(ofKind(id, 'adjustment', 1, '棚卸の差異'), as),
          await move(ofKind(id, 'disposal', -2, '破損'), as),
          await move(ofKind(id, 'transfer', -3), as),
        ]

        expect(responses.map(statusAndCode)).toEqual(['200', '200', '200'])
        expect(await figuresOf(id)).toBe('6.00/6.00/0.00')
      },
    )

    it.each([
      ['an adjustment', 'adjustment', 1, '棚卸の差異'],
      ['a disposal', 'disposal', -1, '破損'],
      ['a transfer', 'transfer', -1, null],
    ])(
      'refuses a staff member %s, once the request is known to be one, and writes nothing',
      async (_case, transactionType, quantity, reason) => {
        const id = await insertStock()
        const before = await everything()
        const as = await member('staff')()

        const responses = [
          await move(ofKind(id, transactionType, quantity, reason), as),
          await move(ofKind(UNKNOWN_ID, transactionType, quantity, reason), as),
          await move(ofKind(id, transactionType, 0, reason), as),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '403 1005',
          '403 1005',
          '400 2001',
        ])
        expect(await everything()).toEqual(before)
      },
    )

    it.each(outsiders)(
      'refuses %s both operations, before anything of the request is looked at',
      async (_who, signInAs) => {
        const id = await insertStock()
        const before = await everything()
        const as = await signInAs()

        for (const [, call] of operations) {
          expectProblem(await call(as, id), forbidden)
        }
        expectProblem(await move({}, as), forbidden)
        expectProblem(await history('latest', { limit: 0 }, as), forbidden)
        expect(await everything()).toEqual(before)
      },
    )

    it('answers a member a row of another salon as one that is not there', async () => {
      const otherSalon = await insertSalon(db)
      const theirs = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct(false, otherSalon),
      })
      const before = await everything()

      for (const signInAs of [member('owner'), member('staff')]) {
        const as = await signInAs()

        expectRefused(await move(purchase(theirs), as), INVALID, [
          issue('inventoryId', 'not_found', NO_SUCH_ROW),
        ])
        expectProblem(await history(theirs, {}, as), notFound)
      }
      expect(await everything()).toEqual(before)
    })

    describe.each(operations)('%s', (_name, call) => {
      it.each(unauthenticated)(
        'answers 401 to %s, before it looks at anything else',
        async (_case, tokenOf, problem, challenge) => {
          const id = await insertStock()
          const before = await everything()

          const response = await call(await tokenOf(), id)

          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
          expect(await everything()).toEqual(before)
        },
      )
    })
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['PUT on the history', 'put', '/ID/movements'],
      ['PATCH on the history', 'patch', '/ID/movements'],
      ['DELETE on the history', 'delete', '/ID/movements'],
      ['POST below a movement', 'post', '/movement/ID'],
      ['PUT on the movements', 'put', '/movement'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertStock()
        const before = await everything()

        const response = await request(app)
          [method](`${PATH}${suffix.replace('ID', id)}`)
          .set('Authorization', asAdmin)
          .send(purchase(id))

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )

    it.each<[string, 'get' | 'patch' | 'delete']>([
      ['GET', 'get'],
      ['PATCH', 'patch'],
      ['DELETE', 'delete'],
    ])(
      'takes the movements for the ID of a row on %s',
      async (_case, method) => {
        const before = await everything()

        const response = await request(app)
          [method](`${PATH}/movement`)
          .set('Authorization', asAdmin)
          .send({ shelf: 'S' })

        expectRefused(response, INVALID_ID)
        expect(brokenRules(response)).toEqual(['id:invalid_format'])
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('requests at the same moment', () => {
    /** Holds a stock row as a movement, a change or a delete of it does. */
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

    it('takes several movements of one row in turns, each from the stock the one before left, and refuses what the stock cannot take', async () => {
      const id = await insertStock(stock('5'))

      const responses = await Promise.all(
        Array.from({ length: 8 }, () => move(ofKind(id, 'sale', -1))),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '200',
        '200',
        '200',
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(await figuresOf(id)).toBe('0.00/0.00/0.00')
      const written = await movements()
      expect(
        written.map(({ balanceBefore, balanceAfter }) =>
          [balanceBefore, balanceAfter].join('→'),
        ),
      ).toEqual([
        '5.00→4.00',
        '4.00→3.00',
        '3.00→2.00',
        '2.00→1.00',
        '1.00→0.00',
      ])
    })

    it('makes a movement wait for a change of the stock, and decides on the stock as changed', async () => {
      const id = await insertStock(stock('5'))

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, id)
          await tx.update(inventory).set(stock('1')).where(eq(inventory.id, id))
          const underWay = move(ofKind(id, 'sale', -3)).then(
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
      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(BELOW_RESERVED)
      expect(await figuresOf(id)).toBe('1.00/1.00/0.00')
    })

    it('makes a movement wait for a delete of the row, and answers that the row is not there', async () => {
      const id = await insertStock(stock('0'))

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, id)
          await tx.delete(inventory).where(eq(inventory.id, id))
          const underWay = move(purchase(id)).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectRefused(response, INVALID, [
        issue('inventoryId', 'not_found', NO_SUCH_ROW),
      ])
      expect(await movements()).toEqual([])
    })

    it('times a movement that waited by when it got the row', async () => {
      const id = await insertStock()

      const { pending, released } = await db.transaction(async (tx) => {
        await holdRow(tx, id)
        const underWay = move(purchase(id)).then((response) => response)
        await pause(300)
        return { pending: underWay, released: await databaseClock() }
      })
      const response = await pending

      expect(Date.parse(response.body.data.createdAt)).toBeGreaterThanOrEqual(
        Math.floor(released),
      )
    })

    it('reads the history of a row while it is held', async () => {
      const id = await insertStock()
      await move(purchase(id))

      const answered = await db.transaction(async (tx) => {
        await holdRow(tx, id)
        return answersWithin(
          history(id).then((response) => response),
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
    const everySalon: LedgerReach = { type: 'everySalon' }
    const salonReach = (id: string = salonId): LedgerReach => ({
      type: 'salon',
      salonId: salonIdSchema.parse(id),
    })

    /** A movement as the use case hands it on: two bought in, by no one. */
    const newMovement = (
      overrides: Partial<DbNewInventoryMovement> = {},
    ): DbNewInventoryMovement => ({
      transactionType: 'purchase',
      quantity: '2.00',
      unitCost: null,
      totalCost: null,
      referenceType: null,
      referenceId: null,
      reason: null,
      performedBy: null,
      ...overrides,
    })

    const criteria = (inventoryId: string) => ({
      inventoryId: idOf(inventoryId),
      limit: 20,
      after: null,
      transactionType: null,
      startDate: null,
      endDate: null,
    })

    /** What every method resolves to when the database does not answer. */
    const unanswered = async (
      call: (
        repositoryOf: InventoryRepository,
      ) => Promise<Result<unknown, DomainError>>,
    ): Promise<Result<unknown, DomainError>> => {
      const connection = connectUnreachableDatabase()
      const result = await call(new InventoryRepository(connection.database))
      await connection.close()
      return result
    }

    it('records a movement of a row within the reach, and says of one outside it that it is not found', async () => {
      const id = await insertStock()
      const otherSalon = await insertSalon(db)

      const outside = dataOf(
        await repository().recordMovement(
          salonReach(otherSalon),
          idOf(id),
          newMovement(),
        ),
      )
      const inside = dataOf(
        await repository().recordMovement(
          salonReach(),
          idOf(id),
          newMovement(),
        ),
      )

      expect(outside).toEqual({ type: 'notFound' })
      expect(inside).toMatchObject({
        type: 'recorded',
        transaction: { balanceBefore: '10.00', balanceAfter: '12.00' },
      })
    })

    it('says why it does not move the stock', async () => {
      const low = await insertStock(stock('1'))
      const full = await insertStock({
        productId: await insertProduct(),
        ...stock('99999999.99'),
      })

      expect(
        dataOf(
          await repository().recordMovement(
            everySalon,
            idOf(low),
            newMovement({ transactionType: 'sale', quantity: '-1.01' }),
          ),
        ),
      ).toEqual({ type: 'belowReserved' })
      expect(
        dataOf(
          await repository().recordMovement(
            everySalon,
            idOf(full),
            newMovement({ quantity: '0.01' }),
          ),
        ),
      ).toEqual({ type: 'overLimit' })
    })

    it('lists the movements of a row within the reach, and says of one outside it that it is not found', async () => {
      const id = await insertStock()
      const movement = await insertMovement(id)
      const otherSalon = await insertSalon(db)

      expect(
        dataOf(
          await repository().listMovements(
            salonReach(otherSalon),
            criteria(id),
          ),
        ),
      ).toEqual({ type: 'inventoryNotFound' })
      expect(
        dataOf(await repository().listMovements(salonReach(), criteria(id))),
      ).toMatchObject({
        type: 'listed',
        transactions: [{ id: movement }],
        total: 1,
        hasMore: false,
      })
      expect(
        dataOf(
          await repository().listMovements(everySalon, {
            ...criteria(id),
            after: inventoryTransactionIdSchema.parse(UNKNOWN_ID),
          }),
        ),
      ).toEqual({ type: 'cursorNotFound' })
    })

    it.each([
      [
        'recordMovement',
        'Failed to record stock movement',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.recordMovement(
            everySalon,
            idOf(UNKNOWN_ID),
            newMovement(),
          ),
      ],
      [
        'listMovements',
        'Failed to list stock movements',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.listMovements(everySalon, criteria(UNKNOWN_ID)),
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
})
