import {
  inventory,
  inventoryTransactions,
  products,
  type salons,
} from '@beauty-salon-backend/database'
import {
  type DbNewInventory,
  type DomainError,
  inventoryIdSchema,
  type LedgerReach,
  productIdSchema,
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
} from '../../../__tests__/_shared/auth-helpers'
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
} from '../../../__tests__/_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const badRequest = { status: 400, code: '2001', type: 'validation' }
const unreadable = { status: 400, code: '2002', type: 'malformed-body' }
const notFound = { status: 404, code: '3001', type: 'not-found' }
const routeNotFound = { status: 404, code: '3001', type: 'route-not-found' }
const alreadyExists = { status: 409, code: '3002', type: 'already-exists' }
const notAllowed = { status: 409, code: '3003', type: 'operation-not-allowed' }
const authenticationRequired = {
  status: 401,
  code: '1001',
  type: 'authentication-required',
}
const tokenExpired = { status: 401, code: '1003', type: 'token-expired' }
const invalidToken = { status: 401, code: '1004', type: 'invalid-token' }
const forbidden = { status: 403, code: '1005', type: 'forbidden' }

const INVALID = 'Invalid stock row'
const INVALID_SEARCH = 'Invalid inventory search'
const INVALID_LOW_STOCK = 'Invalid low-stock search'
const INVALID_EXPIRING = 'Invalid expiring search'
const INVALID_ID = 'Invalid inventory ID'
const IN_STOCK =
  'The stock row cannot be deleted: it counts stock; bring it to zero with a stock movement first'
const NO_SUCH_CURSOR = 'Must name a stock row of the list'
const LOT_REQUIRED = 'Must name the lot: the product is kept by lots'
const NO_LOT = 'Must be null: the product is not kept by lots'

/** What a lot that another row of the product has is told. */
const lotTaken = (lot: string | null): string =>
  `Inventory with lotNumber ${lot ?? 'null'} already exists`

/** The properties of an InventoryResponse. */
const PROPERTIES = [
  'availableStock',
  'createdAt',
  'currentStock',
  'expiryDate',
  'id',
  'lastCountedAt',
  'lastCountedBy',
  'location',
  'lotNumber',
  'notes',
  'productId',
  'reservedStock',
  'salonId',
  'shelf',
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

/** The date of a moment in a time zone, `YYYY-MM-DD`. */
const dateIn = (timeZone: string, moment: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(moment)

/** The date some days after a date, `YYYY-MM-DD`. */
const daysAfter = (date: string, days: number): string => {
  const moment = new Date(`${date}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + days)
  return moment.toISOString().slice(0, 10)
}

describe('Inventory API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** A product of the salon that is not kept by lots. */
  let productId: string
  /** A product of the salon that is kept by lots. */
  let lotProductId: string

  type NewSalon = typeof salons.$inferInsert
  type NewProduct = typeof products.$inferInsert
  type NewStock = typeof inventory.$inferInsert
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

  /**
   * A product of a salon as a row: a code of its own and what must be
   * written. Not kept by lots unless the overrides say so. Returns its ID.
   */
  const insertProduct = async (
    overrides: Partial<NewProduct> = {},
    ofSalon: string = salonId,
  ): Promise<string> => {
    const [row] = await db
      .insert(products)
      .values({
        salonId: ofSalon,
        productCode: `P${nextRow()}`,
        name: 'シャンプー',
        unit: '本',
        requiresLotTracking: false,
        ...overrides,
      })
      .returning({ id: products.id })
    if (row === undefined) {
      throw new Error('No product was inserted')
    }
    return row.id
  }

  /**
   * A stock row written directly: of the product of the tests without a lot
   * and without stock unless the overrides say otherwise. Returns its ID.
   */
  const insertStock = async (
    overrides: Partial<NewStock> = {},
    executor: Executor = db,
  ): Promise<string> => {
    const [row] = await executor
      .insert(inventory)
      .values({
        salonId,
        productId,
        currentStock: '0',
        availableStock: '0',
        ...overrides,
      })
      .returning({ id: inventory.id })
    if (row === undefined) {
      throw new Error('No stock row was inserted')
    }
    return row.id
  }

  /** Stock figures that keep the rule of the table: nothing reserved. */
  const stock = (amount: string): Partial<NewStock> => ({
    currentStock: amount,
    availableStock: amount,
  })

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await salon()
    productId = await insertProduct({ productCode: 'SHMP001' })
    lotProductId = await insertProduct({
      productCode: 'COLOR001',
      requiresLotTracking: true,
    })
  })

  const PATH = '/api/v1/inventory'

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A request that keeps every rule: a lot of the colour, with everything set. */
  const stockRow = (overrides: Record<string, unknown> = {}) => ({
    salonId,
    productId: lotProductId,
    lotNumber: 'LOT-2026-001',
    expiryDate: '2027-03-31',
    location: '倉庫 A',
    shelf: 'A-3',
    notes: '開封後は冷暗所',
    ...overrides,
  })

  /** A request for the product of the tests that is not kept by lots. */
  const plainRow = (overrides: Record<string, unknown> = {}) =>
    stockRow({ productId, lotNumber: null, ...overrides })

  const create = (body: object = stockRow(), as: string | null = asAdmin) =>
    authorized(request(app).post(PATH), as).send(body)

  const read = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).get(`${PATH}/${id}`), as)

  const list = (
    query: Record<string, unknown> = {},
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(PATH).query(query), as)

  const lowStock = (
    query: Record<string, unknown> = { salonId },
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(`${PATH}/low-stock`).query(query), as)

  const expiring = (
    query: Record<string, unknown> = { salonId },
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(`${PATH}/expiring`).query(query), as)

  const update = (
    id: string,
    body: object,
    as: string | null = asAdmin,
  ): Test => authorized(request(app).patch(`${PATH}/${id}`), as).send(body)

  const remove = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).delete(`${PATH}/${id}`), as)

  /** The stock row, or undefined when there is none. */
  const stored = async (id: string) => {
    const [row] = await db.select().from(inventory).where(eq(inventory.id, id))
    return row
  }

  /** Every stock row, in the order of the IDs. */
  const everything = () =>
    db.select().from(inventory).orderBy(asc(inventory.id))

  /** The moment of the clock that a change of a stock row writes by. */
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
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
  ]

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
    ['the low-stock list', (as) => lowStock({ salonId }, as)],
    ['the expiring list', (as) => expiring({ salonId }, as)],
    ['a create', (as) => create(stockRow(), as)],
    ['a get', (as, id) => read(id, as)],
    ['an update', (as, id) => update(id, { shelf: 'B-1' }, as)],
    ['a delete', (as, id) => remove(id, as)],
  ]

  /** The operations that keep stock rows. */
  const writes = operations.filter(([name]) =>
    ['a create', 'an update', 'a delete'].includes(name),
  )

  /** IDs in a path that are not UUIDs. */
  const malformedIds = ['latest', '42', `${UNKNOWN_ID}0`]

  describe('POST /api/v1/inventory', () => {
    it('adds the row without stock and answers 201 with it, where it is, and what the system set', async () => {
      const before = await databaseClock()

      const response = await create()
      const after = await databaseClock()

      expect(response.status).toBe(201)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      const { data, links } = response.body
      expect(Object.keys(response.body).toSorted()).toEqual([
        'data',
        'links',
        'meta',
      ])
      expect(Object.keys(data).toSorted()).toEqual(PROPERTIES)
      expect(data).toEqual({
        ...stockRow(),
        id: expect.stringMatching(UUID),
        currentStock: 0,
        availableStock: 0,
        reservedStock: 0,
        lastCountedAt: null,
        lastCountedBy: null,
        createdAt: expect.stringMatching(ISO_TIMESTAMP),
        updatedAt: data.createdAt,
      })
      expectBetween(data.createdAt, before, after)
      expect(links).toEqual({
        self: `${PATH}/${data.id}`,
        list: PATH,
      })
      expect(response.headers['location']).toBe(`${PATH}/${data.id}`)
    })

    it('stores what the request states, no stock and no count', async () => {
      const response = await create()

      expect(await stored(response.body.data.id)).toEqual({
        ...stockRow(),
        id: response.body.data.id,
        currentStock: '0.00',
        availableStock: '0.00',
        reservedStock: '0.00',
        lastCountedAt: null,
        lastCountedBy: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('keeps null for everything that may be unset', async () => {
      const body = plainRow({
        expiryDate: null,
        location: null,
        shelf: null,
        notes: null,
      })

      const response = await create(body)

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(body)
      expect(await stored(response.body.data.id)).toMatchObject(body)
    })

    it.each([
      ['a lot number of 100 characters', { lotNumber: 'L'.repeat(100) }],
      ['a lot number of 100 emoji', { lotNumber: '🧪'.repeat(100) }],
      ['a location of 100 characters', { location: '棚'.repeat(100) }],
      ['a shelf of 50 characters', { shelf: 'S'.repeat(50) }],
      ['text with blanks around it', { lotNumber: ' LOT-7 ', notes: ' 注意 ' }],
      ['an expiry date in the past', { expiryDate: '2020-02-29' }],
      ['the first day a request may name', { expiryDate: '1900-01-01' }],
      ['the last day a request may name', { expiryDate: '2999-12-31' }],
    ])('takes %s, as it is', async (_case, overrides) => {
      const response = await create(stockRow(overrides))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(overrides)
      expect(await stored(response.body.data.id)).toMatchObject(overrides)
    })

    it('adds a row for a product that is not active', async () => {
      const inactive = await insertProduct({ isActive: false })

      const response = await create(plainRow({ productId: inactive }))

      expect(response.status).toBe(201)
    })

    describe('the lot number', () => {
      it('takes a lot number of a product kept by lots, and none of one that is not', async () => {
        const lot = await create(stockRow())
        const plain = await create(plainRow())

        expect([lot.status, plain.status]).toEqual([201, 201])
      })

      it('refuses a product kept by lots without a lot number, and stores nothing', async () => {
        const response = await create(stockRow({ lotNumber: null }))

        expectRefused(response, INVALID, [
          issue('lotNumber', 'custom', LOT_REQUIRED),
        ])
        expect(await everything()).toEqual([])
      })

      it('refuses a lot number of a product that is not kept by lots, and stores nothing', async () => {
        const response = await create(plainRow({ lotNumber: 'LOT-1' }))

        expectRefused(response, INVALID, [issue('lotNumber', 'custom', NO_LOT)])
        expect(await everything()).toEqual([])
      })

      it('refuses a lot that another row of the product has, and stores nothing more', async () => {
        await create(stockRow())

        const response = await create(stockRow({ shelf: 'B-9' }))

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(lotTaken('LOT-2026-001'))
        expect(await everything()).toHaveLength(1)
      })

      it('refuses a second row without a lot of a product that is not kept by lots', async () => {
        await create(plainRow())

        const response = await create(plainRow({ shelf: 'B-9' }))

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(lotTaken(null))
        expect(await everything()).toHaveLength(1)
      })

      it('takes one lot number for two products, and two lots of a product', async () => {
        const otherLotProduct = await insertProduct({
          requiresLotTracking: true,
        })

        const responses = [
          await create(stockRow()),
          await create(stockRow({ productId: otherLotProduct })),
          await create(stockRow({ lotNumber: 'LOT-2026-002' })),
          await create(stockRow({ lotNumber: 'lot-2026-001' })),
        ]

        expect(responses.map(statusAndCode)).toEqual([
          '201',
          '201',
          '201',
          '201',
        ])
      })

      it('looks at the lot number before it looks for another row with it', async () => {
        await insertStock()

        const response = await create(plainRow({ lotNumber: 'LOT-1' }))

        expectRefused(response, INVALID, [issue('lotNumber', 'custom', NO_LOT)])
      })
    })

    describe('the salon and the product', () => {
      it('adds to the salon of the request and to no other', async () => {
        const otherSalon = await salon()
        const otherProduct = await insertProduct({}, otherSalon)

        const response = await create(
          plainRow({ salonId: otherSalon, productId: otherProduct }),
        )

        expect(response.status).toBe(201)
        expect(response.body.data).toMatchObject({
          salonId: otherSalon,
          productId: otherProduct,
        })
      })

      it.each<[string, () => Promise<string>]>([
        ['a product that is not there', async () => UNKNOWN_ID],
        [
          'a product of another salon',
          async () => insertProduct({}, await salon()),
        ],
        [
          'a product that is deleted',
          async () => insertProduct({ deletedAt: '2026-11-01T00:00:00.000Z' }),
        ],
      ])('refuses %s, and stores nothing', async (_case, productOf) => {
        const response = await create(
          plainRow({ productId: await productOf() }),
        )

        expectRefused(response, INVALID, [
          issue('productId', 'not_found', 'Must name a product of the salon'),
        ])
        expect(await everything()).toEqual([])
      })

      it.each<[string, () => Promise<string>]>([
        ['a salon that is not there', async () => UNKNOWN_ID],
        [
          'a salon that is deleted',
          async () => salon({ deletedAt: '2026-11-01T00:00:00.000Z' }),
        ],
      ])(
        'refuses %s before it looks for the product',
        async (_case, salonOf) => {
          const response = await create(
            plainRow({ salonId: await salonOf(), productId: UNKNOWN_ID }),
          )

          expectRefused(response, INVALID, [
            issue('salonId', 'not_found', 'Must name a salon'),
          ])
        },
      )

      it('looks at the request before it looks for the salon', async () => {
        const response = await create(
          plainRow({ salonId: UNKNOWN_ID, shelf: '' }),
        )

        expectRefused(response, INVALID, [
          issue('shelf', 'invalid_format', 'Must not be blank'),
        ])
      })
    })

    describe('what a request must be', () => {
      it.each<[string, Record<string, unknown>, [string, string][]]>([
        [
          'a salon ID that is not a UUID',
          { salonId: 'mine' },
          [['salonId', 'invalid_format']],
        ],
        [
          'a product ID that is not a UUID',
          { productId: 42 },
          [['productId', 'invalid_type']],
        ],
        [
          'a blank lot number',
          { lotNumber: '  ' },
          [['lotNumber', 'invalid_format']],
        ],
        [
          'an empty lot number',
          { lotNumber: '' },
          [['lotNumber', 'invalid_format']],
        ],
        [
          'a lot number of 101 characters',
          { lotNumber: 'L'.repeat(101) },
          [['lotNumber', 'too_big']],
        ],
        [
          'a lot number that is a number',
          { lotNumber: 7 },
          [['lotNumber', 'invalid_type']],
        ],
        [
          'an expiry date of no day',
          { expiryDate: '2026-02-30' },
          [['expiryDate', 'invalid_format']],
        ],
        [
          'an expiry date of the year 0',
          { expiryDate: '0000-12-31' },
          [['expiryDate', 'too_small']],
        ],
        [
          'an expiry date before 1900',
          { expiryDate: '1899-12-31' },
          [['expiryDate', 'too_small']],
        ],
        [
          'an expiry date after 2999',
          { expiryDate: '3000-01-01' },
          [['expiryDate', 'too_big']],
        ],
        [
          'an expiry date with a time',
          { expiryDate: '2027-03-31T00:00:00Z' },
          [['expiryDate', 'invalid_format']],
        ],
        [
          'an expiry date with slashes',
          { expiryDate: '2027/03/31' },
          [['expiryDate', 'invalid_format']],
        ],
        [
          'a blank location',
          { location: '\t' },
          [['location', 'invalid_format']],
        ],
        [
          'a location of 101 characters',
          { location: 'L'.repeat(101) },
          [['location', 'too_big']],
        ],
        [
          'a shelf of 51 characters',
          { shelf: 'S'.repeat(51) },
          [['shelf', 'too_big']],
        ],
        ['blank notes', { notes: ' ' }, [['notes', 'invalid_format']]],
        [
          'notes that are a list',
          { notes: ['a'] },
          [['notes', 'invalid_type']],
        ],
      ])('refuses %s, and stores nothing', async (_case, overrides, broken) => {
        const response = await create(stockRow(overrides))

        expectRefused(response, INVALID)
        expect(
          response.body.errors.map(
            ({ field, rule }: { field: string; rule: string }) => [field, rule],
          ),
        ).toEqual(broken)
        expect(await everything()).toEqual([])
      })

      it.each(Object.keys(stockRow()))(
        'refuses a request without %s: every key is required',
        async (key) => {
          const body = Object.fromEntries(
            Object.entries(stockRow()).filter(([name]) => name !== key),
          )

          const response = await create(body)

          expectRefused(response, INVALID, [
            issue(key, 'invalid_type', expect.any(String)),
          ])
        },
      )

      it.each([
        'id',
        'currentStock',
        'availableStock',
        'reservedStock',
        'lastCountedAt',
        'lastCountedBy',
        'createdAt',
        'updatedAt',
        'quantity',
      ])(
        'refuses a request that states %s: nothing but the request writes it, or it is not there',
        async (key) => {
          const response = await create({ ...stockRow(), [key]: 10 })

          expectRefused(response, INVALID, [
            issue(key, 'unrecognized_keys', expect.any(String)),
          ])
          expect(await everything()).toEqual([])
        },
      )

      it('reports everything that is wrong at once', async () => {
        const response = await create(
          stockRow({
            lotNumber: '',
            shelf: 'S'.repeat(51),
            expiryDate: 'soon',
          }),
        )

        expect(
          response.body.errors.map(({ field }: { field: string }) => field),
        ).toEqual(['lotNumber', 'expiryDate', 'shelf'])
      })

      it.each([
        ['a list of requests', [stockRow()]],
        ['an empty list', []],
      ])('refuses %s in place of the request', async (_case, body) => {
        const response = await create(body)

        expectRefused(response, INVALID, [
          issue('', 'invalid_type', expect.any(String)),
        ])
      })

      it.each([
        ['a body that is not JSON', '{"salonId":'],
        ['a body that is null', 'null'],
        ['a body that is text', '"LOT-1"'],
      ])('refuses %s as a body that cannot be read', async (_case, body) => {
        const response = await request(app)
          .post(PATH)
          .set('Authorization', asAdmin)
          .set('Content-Type', 'application/json')
          .send(body)

        expectProblem(response, unreadable)
        expect(await everything()).toEqual([])
      })
    })
  })

  describe('GET /api/v1/inventory', () => {
    it('lists the rows as the contract has them, with how many there are and where the list is', async () => {
      const id = await insertStock({
        ...stock('12.5'),
        expiryDate: '2027-01-31',
        location: '倉庫 A',
        shelf: 'A-1',
        notes: 'メモ',
        lastCountedAt: '2026-11-10T09:00:00.000Z',
      })

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [
          {
            id,
            salonId,
            productId,
            currentStock: 12.5,
            availableStock: 12.5,
            reservedStock: 0,
            lotNumber: null,
            expiryDate: '2027-01-31',
            location: '倉庫 A',
            shelf: 'A-1',
            lastCountedAt: '2026-11-10T09:00:00.000Z',
            lastCountedBy: null,
            notes: 'メモ',
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
          self: PATH,
          first: PATH,
          next: null,
          prev: null,
          last: null,
        },
      })
    })

    it('shows what is reserved and what is left to use', async () => {
      await insertStock({
        currentStock: '20',
        availableStock: '18',
        reservedStock: '2',
      })

      const response = await list()

      expect(response.body.data[0]).toMatchObject({
        currentStock: 20,
        availableStock: 18,
        reservedStock: 2,
      })
    })

    it('lists in the order of the product codes, a row without a lot first, whatever the order they were written in', async () => {
      const brush = await insertProduct({
        productCode: 'BRUSH01',
        requiresLotTracking: true,
      })
      const colourB = await insertStock({
        productId: lotProductId,
        lotNumber: 'B',
      })
      const shampoo = await insertStock()
      const colourA = await insertStock({
        productId: lotProductId,
        lotNumber: 'A',
      })
      const colourNone = await insertStock({ productId: lotProductId })
      const brushRow = await insertStock({ productId: brush, lotNumber: 'Z' })

      const response = await list()

      expect(idsOf(response)).toEqual([
        brushRow,
        colourNone,
        colourA,
        colourB,
        shampoo,
      ])
    })

    it('lists every salon for an administrator, and the salon of the member for a member', async () => {
      const otherSalon = await salon()
      const elsewhere = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({}, otherSalon),
      })
      const mine = await insertStock()

      const forAdmin = await list()
      const forOwner = await list({}, await member('owner')())
      const forStaff = await list({}, await member('staff')())

      expect(idsOf(forAdmin).toSorted()).toEqual([elsewhere, mine].toSorted())
      expect(idsOf(forOwner)).toEqual([mine])
      expect(idsOf(forStaff)).toEqual([mine])
      expect(forOwner.body.meta.total).toBe(1)
    })

    it('answers with an empty list where there is no stock', async () => {
      const response = await list()

      expect(response.body.data).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    describe('filters', () => {
      let otherSalon: string
      let rowsOf: Record<string, string>

      beforeEach(async () => {
        otherSalon = await salon()
        rowsOf = {
          plain: await insertStock(),
          lotA: await insertStock({ productId: lotProductId, lotNumber: 'A' }),
          lotB: await insertStock({ productId: lotProductId, lotNumber: 'B' }),
          elsewhere: await insertStock({
            salonId: otherSalon,
            productId: await insertProduct(
              { requiresLotTracking: true },
              otherSalon,
            ),
            lotNumber: 'A',
          }),
        }
      })

      it.each<[string, () => Record<string, unknown>, string[]]>([
        ['the salon', () => ({ salonId }), ['lotA', 'lotB', 'plain']],
        ['another salon', () => ({ salonId: otherSalon }), ['elsewhere']],
        ['the product', () => ({ productId: lotProductId }), ['lotA', 'lotB']],
        ['the lot number', () => ({ lotNumber: 'A' }), ['elsewhere', 'lotA']],
        [
          'the lot number in the salon',
          () => ({ lotNumber: 'A', salonId }),
          ['lotA'],
        ],
        ['a lot number in another case', () => ({ lotNumber: 'a' }), []],
        ['a salon that is not there', () => ({ salonId: UNKNOWN_ID }), []],
      ])('filters by %s', async (_case, query, expected) => {
        const response = await list(query())

        expect(response.status).toBe(200)
        expect(idsOf(response).toSorted()).toEqual(
          expected.map((name) => rowsOf[name]).toSorted(),
        )
        expect(response.body.meta.total).toBe(expected.length)
      })

      it('keeps the filters in the link to the next page', async () => {
        const response = await list({ productId: lotProductId, limit: 1 })

        expect(response.body.meta).toMatchObject({ total: 2, hasMore: true })
        expect(response.body.links.next).toBe(
          `${PATH}?productId=${lotProductId}&limit=1&cursor=${rowsOf['lotA']}`,
        )
      })
    })

    describe('pages', () => {
      const insertMany = async (count: number): Promise<string[]> => {
        const ids: string[] = []
        for (let index = 0; index < count; index += 1) {
          ids.push(
            await insertStock({
              productId: lotProductId,
              lotNumber: `L${String(index).padStart(3, '0')}`,
            }),
          )
        }
        return ids
      }

      it('returns 20 rows unless the request says how many, and says that more follow', async () => {
        const ids = await insertMany(21)

        const response = await list()

        expect(idsOf(response)).toEqual(ids.slice(0, 20))
        expect(response.body.meta).toMatchObject({
          total: 21,
          limit: 20,
          hasMore: true,
          nextCursor: ids[19],
        })
      })

      it('walks every row once, in order, along the links to the next page', async () => {
        const ids = await insertMany(7)
        const seen: string[] = []
        let path: string | null = `${PATH}?limit=3`

        while (path !== null) {
          const response: Response = await request(app)
            .get(path)
            .set('Authorization', asAdmin)
          seen.push(...idsOf(response))
          path = response.body.links.next
        }

        expect(seen).toEqual(ids)
      })

      it('starts a page after the row the cursor names, and names the cursor it was given', async () => {
        const ids = await insertMany(4)

        const response = await list({ cursor: ids[1], limit: 5 })

        expect(idsOf(response)).toEqual(ids.slice(2))
        expect(response.body.meta).toMatchObject({
          cursor: ids[1],
          nextCursor: null,
          hasMore: false,
        })
      })

      it('takes a cursor in upper case', async () => {
        const ids = await insertMany(2)

        const response = await list({ cursor: ids[0]?.toUpperCase() })

        expect(idsOf(response)).toEqual(ids.slice(1))
      })

      it.each<[string, () => Promise<string>]>([
        ['a row that is not there', async () => UNKNOWN_ID],
        [
          'a row of another salon, to a member of the salon',
          async () => {
            const otherSalon = await salon()
            return insertStock({
              salonId: otherSalon,
              productId: await insertProduct({}, otherSalon),
            })
          },
        ],
      ])('refuses a cursor of %s', async (_case, cursorOf) => {
        const as = await member('owner')()

        const response = await list({ cursor: await cursorOf() }, as)

        expectRefused(response, INVALID_SEARCH, [
          issue('cursor', 'not_found', NO_SUCH_CURSOR),
        ])
      })

      it('takes a cursor of another salon from an administrator', async () => {
        const otherSalon = await salon()
        const elsewhere = await insertStock({
          salonId: otherSalon,
          productId: await insertProduct({ productCode: 'A0' }, otherSalon),
        })
        const mine = await insertStock()

        const response = await list({ cursor: elsewhere, salonId })

        expect(idsOf(response)).toEqual([mine])
      })
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['a limit of 0', { limit: 0 }, ['limit:too_small']],
      ['a limit of 101', { limit: 101 }, ['limit:too_big']],
      [
        'a limit that is not a number',
        { limit: 'many' },
        ['limit:invalid_format'],
      ],
      ['a limit with a fraction', { limit: 1.5 }, ['limit:invalid_type']],
      [
        'a cursor that is not a UUID',
        { cursor: 'next' },
        ['cursor:invalid_format'],
      ],
      [
        'a salon that is not a UUID',
        { salonId: 'mine' },
        ['salonId:invalid_format'],
      ],
      [
        'a product that is not a UUID',
        { productId: '42' },
        ['productId:invalid_format'],
      ],
      ['a blank lot number', { lotNumber: ' ' }, ['lotNumber:invalid_format']],
      [
        'a lot number of 101 characters',
        { lotNumber: 'L'.repeat(101) },
        ['lotNumber:too_big'],
      ],
      [
        'a parameter that is not known',
        { sort: 'expiryDate' },
        ['sort:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, broken) => {
      const response = await list(query)

      expectRefused(response, INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(broken)
    })

    it('refuses a lot number that is given twice', async () => {
      const response = await request(app)
        .get(`${PATH}?lotNumber=A&lotNumber=B`)
        .set('Authorization', asAdmin)

      expectRefused(response, INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(['lotNumber:invalid_type'])
    })

    it('refuses a member of a salon the stock of another salon, whether that salon exists or not', async () => {
      const otherSalon = await salon()

      for (const signInAs of [member('owner'), member('staff')]) {
        const as = await signInAs()
        expectProblem(await list({ salonId: otherSalon }, as), forbidden)
        expectProblem(await list({ salonId: UNKNOWN_ID }, as), forbidden)
      }
    })
  })

  describe('GET /api/v1/inventory/low-stock', () => {
    /** A product with a minimum stock, and rows of it with the stock given. */
    const productWithStock = async (
      minimumStock: string,
      amounts: string[],
      overrides: Partial<NewProduct> = {},
    ): Promise<string[]> => {
      const id = await insertProduct({
        minimumStock,
        requiresLotTracking: true,
        ...overrides,
      })
      const ids: string[] = []
      for (const [index, amount] of amounts.entries()) {
        ids.push(
          await insertStock({
            productId: id,
            lotNumber: `L${index}`,
            ...stock(amount),
          }),
        )
      }
      return ids
    }

    it('lists every row of a product whose stock at the salon, over all its rows, is at or below its minimum', async () => {
      const low = await productWithStock('10', ['4', '6'], {
        productCode: 'A-LOW',
      })
      await productWithStock('10', ['4', '6.01'], { productCode: 'B-ENOUGH' })
      const below = await productWithStock('5', ['1'], { productCode: 'C' })

      const response = await lowStock()

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([...low, ...below])
      expect(response.body.meta).toMatchObject({ total: 3, hasMore: false })
      expect(Object.keys(response.body.data[0]).toSorted()).toEqual(PROPERTIES)
    })

    it('lists a product without stock whose minimum is 0, and none that has some', async () => {
      const empty = await productWithStock('0', ['0'], { productCode: 'A' })
      await productWithStock('0', ['0.01'], { productCode: 'B' })

      const response = await lowStock()

      expect(idsOf(response)).toEqual(empty)
    })

    it('compares with the threshold of the query in place of each minimum', async () => {
      const three = await productWithStock('0', ['3'], { productCode: 'A' })
      const five = await productWithStock('100', ['2.5', '2.5'], {
        productCode: 'B',
      })
      await productWithStock('100', ['5.5'], { productCode: 'C' })

      const response = await lowStock({ salonId, threshold: 5 })

      expect(idsOf(response)).toEqual([...three, ...five])
    })

    it('lists no product that is not active, and no product without a row', async () => {
      await productWithStock('10', ['1'], { isActive: false })
      await insertProduct({ minimumStock: '10' })

      const response = await lowStock()

      expect(idsOf(response)).toEqual([])
    })

    it('counts the stock of the salon only, and lists the rows of the salon only', async () => {
      const otherSalon = await salon()
      const low = await productWithStock('10', ['4'], { productCode: 'A' })
      await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({ minimumStock: '1' }, otherSalon),
      })

      const response = await lowStock()

      expect(idsOf(response)).toEqual(low)
    })

    it('pages in the order of the stock list', async () => {
      const ids = await productWithStock('10', ['1', '1', '1', '1'])

      const first = await lowStock({ salonId, limit: 3 })
      const second = await lowStock({
        salonId,
        limit: 3,
        cursor: first.body.meta.nextCursor,
      })

      expect(idsOf(first)).toEqual(ids.slice(0, 3))
      expect(first.body.meta).toMatchObject({ total: 4, hasMore: true })
      expect(idsOf(second)).toEqual(ids.slice(3))
      expect(first.body.links.next).toBe(
        `${PATH}/low-stock?salonId=${salonId}&limit=3&cursor=${ids[2]}`,
      )
    })

    it('refuses a cursor that names no row of the salon', async () => {
      const otherSalon = await salon()
      const elsewhere = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({}, otherSalon),
      })

      for (const cursor of [UNKNOWN_ID, elsewhere]) {
        const response = await lowStock({ salonId, cursor })

        expectRefused(response, INVALID_LOW_STOCK, [
          issue('cursor', 'not_found', NO_SUCH_CURSOR),
        ])
      }
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['no salon', { salonId: undefined }, ['salonId:invalid_type']],
      [
        'a salon that is not a UUID',
        { salonId: 'mine' },
        ['salonId:invalid_format'],
      ],
      ['a negative threshold', { threshold: -1 }, ['threshold:too_small']],
      [
        'a threshold above what a row holds',
        { threshold: 100_000_000 },
        ['threshold:too_big'],
      ],
      [
        'a threshold that is not a number',
        { threshold: 'low' },
        ['threshold:invalid_format'],
      ],
      ['a limit of 0', { limit: 0 }, ['limit:too_small']],
      [
        'a parameter that is not known',
        { productId: UNKNOWN_ID },
        ['productId:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, broken) => {
      const response = await lowStock({ salonId, ...query })

      expectRefused(response, INVALID_LOW_STOCK)
      expect(brokenRules(response)).toEqual(broken)
    })

    it('takes a threshold of 0 and one with a fraction', async () => {
      const responses = [
        await lowStock({ salonId, threshold: 0 }),
        await lowStock({ salonId, threshold: 2.5 }),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
    })

    it.each<[string, () => Promise<string>]>([
      ['a salon that is not there', async () => UNKNOWN_ID],
      [
        'a salon that is deleted',
        async () => salon({ deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ])('tells an administrator of %s', async (_case, salonOf) => {
      const response = await lowStock({ salonId: await salonOf() })

      expectRefused(response, INVALID_LOW_STOCK, [
        issue('salonId', 'not_found', 'Must name a salon'),
      ])
    })

    it('looks at the query before it looks for the salon', async () => {
      const response = await lowStock({ salonId: UNKNOWN_ID, threshold: -1 })

      expect(brokenRules(response)).toEqual(['threshold:too_small'])
    })
  })

  describe('GET /api/v1/inventory/expiring', () => {
    const TOKYO = 'Asia/Tokyo'

    /** A row of the colour with a lot of its own, some stock and the expiry date given. */
    const expiringOn = (
      expiryDate: string | null,
      overrides: Partial<NewStock> = {},
    ): Promise<string> =>
      insertStock({
        productId: lotProductId,
        lotNumber: `L${nextRow()}`,
        ...stock('3'),
        expiryDate,
        ...overrides,
      })

    it('lists what expires within 30 days of today at the salon, and what has expired, earliest first', async () => {
      const today = dateIn(TOKYO)
      const lastDay = await expiringOn(daysAfter(today, 30))
      await expiringOn(daysAfter(today, 31))
      const expired = await expiringOn('2025-12-31')
      const todayRow = await expiringOn(today)
      await expiringOn(null)

      const response = await expiring()

      expect(response.status).toBe(200)
      expect(idsOf(response)).toEqual([expired, todayRow, lastDay])
      expect(response.body.meta).toMatchObject({ total: 3, hasMore: false })
      expect(Object.keys(response.body.data[0]).toSorted()).toEqual(PROPERTIES)
    })

    it('counts the days of the query, today and the last day included', async () => {
      const today = dateIn(TOKYO)
      const todayRow = await expiringOn(today)
      const tomorrow = await expiringOn(daysAfter(today, 1))
      const inAYear = await expiringOn(daysAfter(today, 365))
      await expiringOn(daysAfter(today, 366))

      const none = await expiring({ salonId, days: 0 })
      const one = await expiring({ salonId, days: 1 })
      const most = await expiring({ salonId, days: 365 })

      expect(idsOf(none)).toEqual([todayRow])
      expect(idsOf(one)).toEqual([todayRow, tomorrow])
      expect(idsOf(most)).toEqual([todayRow, tomorrow, inAYear])
    })

    it('counts from today as the clocks of the salon tell it', async () => {
      const east = await salon({ timezone: 'Pacific/Kiritimati' })
      const west = await salon({ timezone: 'Pacific/Pago_Pago' })
      // Fourteen hours ahead of UTC and eleven behind: their days differ
      // by a day or by two.
      const eastToday = dateIn('Pacific/Kiritimati')
      const westToday = dateIn('Pacific/Pago_Pago')
      const rowOf = async (ofSalon: string) =>
        insertStock({
          salonId: ofSalon,
          productId: await insertProduct({}, ofSalon),
          ...stock('1'),
          expiryDate: daysAfter(eastToday, 1),
        })
      const eastRow = await rowOf(east)
      await rowOf(west)

      const fromEast = await expiring({ salonId: east, days: 1 })
      const fromWest = await expiring({ salonId: west, days: 1 })

      expect(daysAfter(westToday, 1) < daysAfter(eastToday, 1)).toBe(true)
      expect(idsOf(fromEast)).toEqual([eastRow])
      expect(idsOf(fromWest)).toEqual([])
    })

    it('lists no row without stock, and one whose stock is all reserved', async () => {
      await expiringOn('2025-12-31', stock('0'))
      const reserved = await expiringOn('2025-12-31', {
        currentStock: '2',
        availableStock: '0',
        reservedStock: '2',
      })

      const response = await expiring()

      expect(idsOf(response)).toEqual([reserved])
    })

    it('lists the rows of the salon only, of any product, active or not', async () => {
      const otherSalon = await salon()
      await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({}, otherSalon),
        ...stock('1'),
        expiryDate: '2025-12-31',
      })
      const inactive = await insertProduct({ isActive: false })
      const row = await insertStock({
        productId: inactive,
        ...stock('1'),
        expiryDate: '2025-12-31',
      })

      const response = await expiring()

      expect(idsOf(response)).toEqual([row])
    })

    it('orders rows of one expiry date by their IDs, and pages through them', async () => {
      const ids = [
        await expiringOn('2025-12-31'),
        await expiringOn('2025-12-31'),
        await expiringOn('2025-12-31'),
      ].toSorted()
      const earliest = await expiringOn('2025-01-01')

      const first = await expiring({ salonId, limit: 2 })
      const second = await expiring({
        salonId,
        limit: 2,
        cursor: first.body.meta.nextCursor,
      })

      expect(idsOf(first)).toEqual([earliest, ids[0]])
      expect(idsOf(second)).toEqual(ids.slice(1))
      expect(second.body.meta).toMatchObject({ total: 4, hasMore: false })
      expect(first.body.links).toEqual({
        self: `${PATH}/expiring?salonId=${salonId}&limit=2`,
        first: `${PATH}/expiring?salonId=${salonId}&limit=2`,
        next: `${PATH}/expiring?salonId=${salonId}&limit=2&cursor=${ids[0]}`,
        prev: null,
        last: null,
      })
    })

    it('refuses a cursor that names no row of the salon with an expiry date', async () => {
      const without = await expiringOn(null)
      const otherSalon = await salon()
      const elsewhere = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({}, otherSalon),
        expiryDate: '2025-12-31',
      })

      for (const cursor of [UNKNOWN_ID, without, elsewhere]) {
        const response = await expiring({ salonId, cursor })

        expectRefused(response, INVALID_EXPIRING, [
          issue('cursor', 'not_found', NO_SUCH_CURSOR),
        ])
      }
    })

    it('takes as a cursor a row of the salon that the list no longer holds', async () => {
      const gone = await expiringOn('2025-06-30', stock('0'))
      const later = await expiringOn('2025-12-31')

      const response = await expiring({ salonId, cursor: gone })

      expect(idsOf(response)).toEqual([later])
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['no salon', { salonId: undefined }, ['salonId:invalid_type']],
      ['days below 0', { days: -1 }, ['days:too_small']],
      ['days above 365', { days: 366 }, ['days:too_big']],
      ['days with a fraction', { days: 1.5 }, ['days:invalid_type']],
      ['days that are not a number', { days: 'soon' }, ['days:invalid_format']],
      [
        'a parameter that is not known',
        { threshold: 1 },
        ['threshold:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, broken) => {
      const response = await expiring({ salonId, ...query })

      expectRefused(response, INVALID_EXPIRING)
      expect(brokenRules(response)).toEqual(broken)
    })

    it.each<[string, () => Promise<string>]>([
      ['a salon that is not there', async () => UNKNOWN_ID],
      [
        'a salon that is deleted',
        async () => salon({ deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ])('tells an administrator of %s', async (_case, salonOf) => {
      const response = await expiring({ salonId: await salonOf() })

      expectRefused(response, INVALID_EXPIRING, [
        issue('salonId', 'not_found', 'Must name a salon'),
      ])
    })

    it('answers 500 for a salon whose time zone the runtime does not know, and says nothing of it', async () => {
      const unknownZone = await salon({ timezone: 'Mars/Olympus_Mons' })

      const response = await expiring({ salonId: unknownZone })

      expect(response.status).toBe(500)
      expect(JSON.stringify(response.body)).not.toContain('Mars')
    })
  })

  describe('GET /api/v1/inventory/:id', () => {
    it('answers with the row as the list has it, and where it is', async () => {
      const id = await insertStock({ ...stock('3'), shelf: 'C-2' })

      const response = await read(id)
      const listed = await list()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual(listed.body.data[0])
      expect(response.body.links).toEqual({
        self: `${PATH}/${id}`,
        list: PATH,
      })
    })

    it('takes an ID in upper case', async () => {
      const id = await insertStock()

      const response = await read(id.toUpperCase())

      expect(response.body.data.id).toBe(id)
    })

    it('answers 404 for a row that is not there, or that was deleted', async () => {
      const id = await insertStock()
      await remove(id)

      for (const missing of [UNKNOWN_ID, id]) {
        const response = await read(missing)

        expectProblem(response, notFound)
        expect(response.body.detail).toContain('Inventory')
      }
    })

    it.each(malformedIds)('refuses %s as the ID', async (id) => {
      const response = await read(id)

      expectRefused(response, INVALID_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })
  })

  describe('PATCH /api/v1/inventory/:id', () => {
    it('writes what the request names and the time of the change, and leaves the rest and every other row', async () => {
      const id = await insertStock({
        ...stock('4'),
        location: '倉庫 A',
        shelf: 'A-1',
        notes: 'メモ',
      })
      const other = await insertStock({
        productId: lotProductId,
        lotNumber: 'L1',
      })
      const [before, otherBefore] = [await stored(id), await stored(other)]
      const start = await databaseClock()

      const response = await update(id, { shelf: 'B-2', notes: null })
      const end = await databaseClock()

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        id,
        shelf: 'B-2',
        notes: null,
        location: '倉庫 A',
        currentStock: 4,
      })
      expect(response.body.links).toEqual({
        self: `${PATH}/${id}`,
        list: PATH,
      })
      const after = await stored(id)
      expect(after).toEqual({
        ...before,
        shelf: 'B-2',
        notes: null,
        updatedAt: expect.any(String),
      })
      expectBetween(after?.updatedAt, start, end)
      expect(await stored(other)).toEqual(otherBefore)
    })

    it.each([
      ['the expiry date', { expiryDate: '2028-01-31' }],
      ['no expiry date', { expiryDate: null }],
      ['the location', { location: '店頭' }],
      ['no location', { location: null }],
      ['the shelf', { shelf: 'Z-9' }],
      ['notes', { notes: '残りわずか' }],
    ])('writes %s', async (_case, changes) => {
      const id = await insertStock({ expiryDate: '2027-01-31' })

      const response = await update(id, changes)

      expect(response.status).toBe(200)
      expect(await stored(id)).toMatchObject(changes)
    })

    describe('the lot number', () => {
      it('changes the lot of a product kept by lots', async () => {
        const id = await insertStock({
          productId: lotProductId,
          lotNumber: 'A',
        })

        const response = await update(id, { lotNumber: 'B' })

        expect(response.body.data.lotNumber).toBe('B')
      })

      it('takes the lot a row has already', async () => {
        const id = await insertStock({
          productId: lotProductId,
          lotNumber: 'A',
        })

        const response = await update(id, { lotNumber: 'A', shelf: 'S' })

        expect(response.status).toBe(200)
      })

      it('refuses to take the lot away from a row of a product kept by lots', async () => {
        const id = await insertStock({
          productId: lotProductId,
          lotNumber: 'A',
        })

        const response = await update(id, { lotNumber: null })

        expectRefused(response, INVALID, [
          issue('lotNumber', 'custom', LOT_REQUIRED),
        ])
        expect((await stored(id))?.lotNumber).toBe('A')
      })

      it('refuses a lot for a row of a product that is not kept by lots, and writes nothing of the request', async () => {
        const id = await insertStock()

        const response = await update(id, { lotNumber: 'A', shelf: 'S' })

        expectRefused(response, INVALID, [issue('lotNumber', 'custom', NO_LOT)])
        expect(await stored(id)).toMatchObject({ lotNumber: null, shelf: null })
      })

      it('refuses the lot of another row of the product', async () => {
        await insertStock({ productId: lotProductId, lotNumber: 'A' })
        const id = await insertStock({
          productId: lotProductId,
          lotNumber: 'B',
        })

        const response = await update(id, { lotNumber: 'A' })

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(lotTaken('A'))
        expect((await stored(id))?.lotNumber).toBe('B')
      })

      it('takes the lot of a row of another product', async () => {
        await insertStock({ productId: lotProductId, lotNumber: 'A' })
        const otherProduct = await insertProduct({ requiresLotTracking: true })
        const id = await insertStock({
          productId: otherProduct,
          lotNumber: 'B',
        })

        const response = await update(id, { lotNumber: 'A' })

        expect(response.status).toBe(200)
      })

      it('keeps the lot a row has when its product changes whether it is kept by lots, and still takes other changes', async () => {
        const id = await insertStock()
        await db
          .update(products)
          .set({ requiresLotTracking: true })
          .where(eq(products.id, productId))

        const shelf = await update(id, { shelf: 'S' })
        const noLot = await update(id, { lotNumber: null })

        expect(shelf.status).toBe(200)
        expectRefused(noLot, INVALID, [
          issue('lotNumber', 'custom', LOT_REQUIRED),
        ])
        expect(await stored(id)).toMatchObject({ lotNumber: null, shelf: 'S' })
      })
    })

    describe('what a request must be', () => {
      it('says of a request that names nothing what is missing', async () => {
        const response = await update(await insertStock(), {})

        expectRefused(response, INVALID, [
          issue('', 'custom', 'At least one property must be specified'),
        ])
      })

      it.each<[string, Record<string, unknown>, string[]]>([
        ['a blank shelf', { shelf: '' }, ['shelf:invalid_format']],
        [
          'a shelf of 51 characters',
          { shelf: 'S'.repeat(51) },
          ['shelf:too_big'],
        ],
        [
          'an expiry date of no day',
          { expiryDate: '2027-02-29' },
          ['expiryDate:invalid_format'],
        ],
        [
          'an expiry date of the year 0',
          { expiryDate: '0000-01-01' },
          ['expiryDate:too_small'],
        ],
        [
          'a lot number of 101 characters',
          { lotNumber: 'L'.repeat(101) },
          ['lotNumber:too_big'],
        ],
        [
          'what a row is of: its salon and its product',
          { salonId: UNKNOWN_ID, productId: UNKNOWN_ID },
          ['salonId:unrecognized_keys', 'productId:unrecognized_keys'],
        ],
        [
          'what only stock movements and counts write',
          { currentStock: 5, availableStock: 5, lastCountedAt: null },
          [
            'currentStock:unrecognized_keys',
            'availableStock:unrecognized_keys',
            'lastCountedAt:unrecognized_keys',
          ],
        ],
      ])('refuses %s, and writes nothing', async (_case, body, broken) => {
        const id = await insertStock()
        const before = await stored(id)

        const response = await update(id, body)

        expectRefused(response, INVALID)
        expect(brokenRules(response)).toEqual(broken)
        expect(await stored(id)).toEqual(before)
      })

      it('refuses a list in place of the request', async () => {
        const response = await update(await insertStock(), [{ shelf: 'S' }])

        expectRefused(response, INVALID)
        expect(brokenRules(response)).toEqual([':invalid_type'])
      })

      it.each([
        ['a body that is not JSON', '{"shelf":'],
        ['a body that is null', 'null'],
      ])('refuses %s as a body that cannot be read', async (_case, body) => {
        const id = await insertStock()

        const response = await request(app)
          .patch(`${PATH}/${id}`)
          .set('Authorization', asAdmin)
          .set('Content-Type', 'application/json')
          .send(body)

        expectProblem(response, unreadable)
      })
    })

    it('answers 404 for a row that is not there, and writes nothing', async () => {
      const response = await update(UNKNOWN_ID, { shelf: 'S' })

      expectProblem(response, notFound)
      expect(await everything()).toEqual([])
    })

    it.each(malformedIds)('refuses %s as the ID', async (id) => {
      const response = await update(id, { shelf: 'S' })

      expectRefused(response, INVALID_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('looks at the ID before the request, and at the request before the row', async () => {
      const malformed = await update('latest', { shelf: '' })
      const missing = await update(UNKNOWN_ID, { shelf: '' })

      expect(brokenRules(malformed)).toEqual(['id:invalid_format'])
      expectRefused(missing, INVALID)
    })
  })

  describe('DELETE /api/v1/inventory/:id', () => {
    it('deletes a row without stock and answers 204 with no body', async () => {
      const id = await insertStock()
      const other = await insertStock({
        productId: lotProductId,
        lotNumber: 'A',
      })

      const response = await remove(id)

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      expect(await stored(id)).toBeUndefined()
      expect(await stored(other)).toBeDefined()
    })

    it('frees the lot of the row for another row', async () => {
      const id = await insertStock({ productId: lotProductId, lotNumber: 'A' })
      await remove(id)

      const response = await create(stockRow({ lotNumber: 'A' }))

      expect(response.status).toBe(201)
    })

    it('keeps the stock movements of the row, without it', async () => {
      const id = await insertStock()
      const [movement] = await db
        .insert(inventoryTransactions)
        .values({
          salonId,
          productId,
          inventoryId: id,
          transactionType: 'purchase',
          quantity: '3',
          balanceBefore: '0',
          balanceAfter: '3',
        })
        .returning({ id: inventoryTransactions.id })

      await remove(id)

      const [kept] = await db
        .select()
        .from(inventoryTransactions)
        .where(eq(inventoryTransactions.id, String(movement?.id)))
      expect(kept).toMatchObject({
        inventoryId: null,
        productId,
        quantity: '3.00',
      })
    })

    it.each([
      ['stock', stock('0.01')],
      [
        'stock that is all reserved',
        { currentStock: '2', availableStock: '0', reservedStock: '2' },
      ],
    ])(
      'refuses to delete a row that counts %s, and keeps it',
      async (_case, figures) => {
        const id = await insertStock(figures)

        const response = await remove(id)

        expectProblem(response, notAllowed)
        expect(response.body.detail).toBe(IN_STOCK)
        expect(await stored(id)).toBeDefined()
      },
    )

    it('answers 404 for a row that is not there, and for one it deleted', async () => {
      const id = await insertStock()
      await remove(id)

      expectProblem(await remove(id), notFound)
      expectProblem(await remove(UNKNOWN_ID), notFound)
    })

    it.each(malformedIds)('refuses %s as the ID', async (id) => {
      const response = await remove(id)

      expectRefused(response, INVALID_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })
  })

  describe('who reads and who keeps the stock of a salon', () => {
    it.each(readers)('lets %s list and read it', async (_who, signInAs) => {
      const id = await insertStock({ ...stock('1'), expiryDate: '2025-12-31' })
      await db
        .update(products)
        .set({ minimumStock: '5' })
        .where(eq(products.id, productId))
      const as = await signInAs()

      const responses = [
        await list({}, as),
        await lowStock({ salonId }, as),
        await expiring({ salonId }, as),
        await read(id, as),
      ]

      expect(responses.map(statusAndCode)).toEqual(['200', '200', '200', '200'])
      expect(responses.slice(0, 3).map(idsOf)).toEqual([[id], [id], [id]])
    })

    it.each(keepers)(
      'lets %s add, change and delete a row',
      async (_who, signInAs) => {
        const as = await signInAs()

        const added = await create(stockRow(), as)
        const changed = await update(added.body.data.id, { shelf: 'B' }, as)
        const removed = await remove(added.body.data.id, as)

        expect([added.status, changed.status, removed.status]).toEqual([
          201, 200, 204,
        ])
        expect(await everything()).toEqual([])
      },
    )

    it.each(outsiders)('refuses %s every operation', async (_who, signInAs) => {
      const id = await insertStock()
      const before = await everything()
      const as = await signInAs()

      for (const [, call] of operations) {
        expectProblem(await call(as, id), forbidden)
      }
      expect(await everything()).toEqual(before)
    })

    it('lets a staff member of the salon read and refuses them every change, before anything of the request is looked at', async () => {
      const id = await insertStock()
      const before = await everything()
      const as = await member('staff')()

      for (const [, call] of writes) {
        expectProblem(await call(as, id), forbidden)
      }
      expectProblem(await create({}, as), forbidden)
      expectProblem(await update('latest', {}, as), forbidden)
      expectProblem(await remove('latest', as), forbidden)
      expectProblem(await update(UNKNOWN_ID, { shelf: 'S' }, as), forbidden)
      expect(await everything()).toEqual(before)
    })

    it('refuses the members of a salon the stock of another salon, whether that salon exists or not', async () => {
      const otherSalon = await salon()

      for (const signInAs of [
        member('owner'),
        member('manager'),
        member('staff'),
      ]) {
        const as = await signInAs()

        for (const ofSalon of [otherSalon, UNKNOWN_ID]) {
          expectProblem(await list({ salonId: ofSalon }, as), forbidden)
          expectProblem(await lowStock({ salonId: ofSalon }, as), forbidden)
          expectProblem(await expiring({ salonId: ofSalon }, as), forbidden)
        }
      }
      for (const signInAs of [member('owner'), member('manager')]) {
        const as = await signInAs()
        for (const ofSalon of [otherSalon, UNKNOWN_ID]) {
          expectProblem(
            await create(
              plainRow({
                salonId: ofSalon,
                productId: await insertProduct({}, otherSalon),
              }),
              as,
            ),
            forbidden,
          )
        }
      }
      expect(await everything()).toEqual([])
    })

    it('refuses a member a request that is malformed as such, whichever salon it names: that says nothing of the salon', async () => {
      const otherSalon = await salon()
      const as = await member('owner')()

      const responses = [
        await list({ salonId: otherSalon, limit: 0 }, as),
        await lowStock({ salonId: otherSalon, threshold: -1 }, as),
        await expiring({ salonId: otherSalon, days: 366 }, as),
        await create(plainRow({ salonId: otherSalon, shelf: '' }), as),
      ]

      expect(responses.map(brokenRules)).toEqual([
        ['limit:too_small'],
        ['threshold:too_small'],
        ['days:too_big'],
        ['shelf:invalid_format'],
      ])
    })

    it('does not show the owner of a salon a row of another salon', async () => {
      const otherSalon = await salon()
      const id = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({}, otherSalon),
      })
      const as = await member('owner')()

      expectProblem(await read(id, as), notFound)
      expectProblem(await update(id, { shelf: 'S' }, as), notFound)
      expectProblem(await remove(id, as), notFound)
      expect(idsOf(await list({}, as))).toEqual([])
      expect((await stored(id))?.shelf).toBeNull()
    })

    it('tells an administrator that a salon does not exist, and the owner of another salon only that it is not theirs', async () => {
      const as = await member('owner')()

      expectRefused(await lowStock({ salonId: UNKNOWN_ID }), INVALID_LOW_STOCK)
      expectProblem(await lowStock({ salonId: UNKNOWN_ID }, as), forbidden)
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
      ['PUT on a row', 'put', '/ID'],
      ['POST on a row', 'post', '/ID'],
      ['PATCH on the list', 'patch', ''],
      ['PUT on the list', 'put', ''],
      ['DELETE on the list', 'delete', ''],
      ['POST on the low-stock list', 'post', '/low-stock'],
      ['POST on the expiring list', 'post', '/expiring'],
      ['POST on the history of a row', 'post', '/ID/movements'],
      ['POST below a row', 'post', '/ID/count'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertStock()
        const before = await everything()

        const response = await request(app)
          [method](`${PATH}${suffix.replace('ID', id)}`)
          .set('Authorization', asAdmin)
          .send(stockRow())

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )

    it('has no stock below a salon', async () => {
      const response = await request(app)
        .get(`/api/v1/salons/${salonId}/inventory`)
        .set('Authorization', asAdmin)

      expectProblem(response, routeNotFound)
    })
  })

  describe('requests at the same moment', () => {
    /** Holds a product as a change or a delete of it does. */
    const holdProduct = (tx: Transaction, id: string) =>
      tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, id))
        .for('update')

    /** Holds a stock row as a stock movement of it will. */
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

    /** The answer of a request, or null when it has not come within two seconds. */
    const unlessItWaits = (call: Test): Promise<Response | null> =>
      Promise.race([
        call.then((response) => response),
        pause(2_000).then(() => null),
      ])

    it.each([
      ['a lot', () => stockRow()],
      ['no lot', () => plainRow()],
    ])('adds one row for several creates of %s', async (_case, body) => {
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => create(body())),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '201',
        '409 3002',
        '409 3002',
        '409 3002',
        '409 3002',
        '409 3002',
      ])
      expect(await everything()).toHaveLength(1)
    })

    it('makes a create wait for a delete of the product, and answers that the product is not there', async () => {
      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdProduct(tx, productId)
          await tx
            .update(products)
            .set({ deletedAt: '2026-11-17T03:00:00.000Z' })
            .where(eq(products.id, productId))
          const underWay = create(plainRow()).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectRefused(await pending, INVALID, [
        issue('productId', 'not_found', 'Must name a product of the salon'),
      ])
      expect(await everything()).toEqual([])
    })

    it('makes a create wait for a change of the product, and holds it to the product as changed', async () => {
      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdProduct(tx, productId)
          await tx
            .update(products)
            .set({ requiresLotTracking: true })
            .where(eq(products.id, productId))
          const underWay = create(plainRow()).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectRefused(await pending, INVALID, [
        issue('lotNumber', 'custom', LOT_REQUIRED),
      ])
    })

    it('makes a change of the lot wait for a change of the product, and holds it to the product as changed', async () => {
      const id = await insertStock({ productId: lotProductId, lotNumber: 'A' })

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdProduct(tx, lotProductId)
          await tx
            .update(products)
            .set({ requiresLotTracking: false })
            .where(eq(products.id, lotProductId))
          const underWay = update(id, { lotNumber: 'B' }).then(
            (response) => response,
          )

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectRefused(await pending, INVALID, [
        issue('lotNumber', 'custom', NO_LOT),
      ])
      expect((await stored(id))?.lotNumber).toBe('A')
    })

    it('does not make a change of anything but the lot wait for a change of the product', async () => {
      const id = await insertStock()

      const response = await db.transaction(async (tx) => {
        await holdProduct(tx, productId)

        return unlessItWaits(update(id, { shelf: 'S' }))
      })

      expect(response?.status).toBe(200)
    })

    it('makes a delete wait for a stock movement of the row, and meet the stock it wrote', async () => {
      const id = await insertStock()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, id)
          await tx.update(inventory).set(stock('5')).where(eq(inventory.id, id))
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
      expect(response.body.detail).toBe(IN_STOCK)
      expect(await stored(id)).toBeDefined()
    })

    it('makes a change wait for a delete of the row, and answers 404', async () => {
      const id = await insertStock()

      const { pending } = await db.transaction(async (tx) => {
        await holdRow(tx, id)
        await tx.delete(inventory).where(eq(inventory.id, id))
        const underWay = update(id, { shelf: 'S' }).then((response) => response)
        await pause(300)

        return { pending: underWay }
      })

      expectProblem(await pending, notFound)
    })

    it('deletes a row once for several deletes', async () => {
      const id = await insertStock()

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

    it('takes one of two changes to the same lot, and refuses the other', async () => {
      const first = await insertStock({
        productId: lotProductId,
        lotNumber: 'A',
      })
      const second = await insertStock({
        productId: lotProductId,
        lotNumber: 'B',
      })

      const responses = await Promise.all([
        update(first, { lotNumber: 'C' }),
        update(second, { lotNumber: 'C' }),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3002',
      ])
    })

    it('reads and lists a row while it is held', async () => {
      const id = await insertStock({ ...stock('1'), expiryDate: '2025-12-31' })

      const responses = await db.transaction(async (tx) => {
        await holdRow(tx, id)

        return [
          await unlessItWaits(read(id)),
          await unlessItWaits(list()),
          await unlessItWaits(lowStock({ salonId, threshold: 5 })),
          await unlessItWaits(expiring()),
        ]
      })

      expect(responses.map((response) => response?.status)).toEqual([
        200, 200, 200, 200,
      ])
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
    const ofSalon = (id: string = salonId) => salonIdSchema.parse(id)
    const idOf = (id: string) => inventoryIdSchema.parse(id)
    const everySalon: LedgerReach = { type: 'everySalon' }
    const salonReach = (id: string = salonId): LedgerReach => ({
      type: 'salon',
      salonId: ofSalon(id),
    })

    /** A row as the use case hands it on. */
    const newRow = (
      overrides: Partial<DbNewInventory> = {},
    ): DbNewInventory => ({
      salonId: ofSalon(),
      productId: productIdSchema.parse(lotProductId),
      lotNumber: 'LOT-1',
      expiryDate: null,
      location: null,
      shelf: null,
      notes: null,
      ...overrides,
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

    it('creates a row without stock and returns it', async () => {
      const outcome = dataOf(await repository().create(newRow()))

      expect(outcome).toEqual({
        type: 'created',
        row: {
          ...newRow(),
          id: expect.stringMatching(UUID),
          currentStock: '0.00',
          availableStock: '0.00',
          reservedStock: '0.00',
          lastCountedAt: null,
          lastCountedBy: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      })
    })

    it('says which product or lot it does not create a row of', async () => {
      const elsewhere = await insertProduct({}, await salon())

      const outcomes = [
        dataOf(
          await repository().create(
            newRow({ productId: productIdSchema.parse(elsewhere) }),
          ),
        ),
        dataOf(await repository().create(newRow({ lotNumber: null }))),
        dataOf(
          await repository().create(
            newRow({ productId: productIdSchema.parse(productId) }),
          ),
        ),
      ]

      expect(outcomes).toEqual([
        { type: 'productNotFound' },
        { type: 'lotNumberRefused', message: LOT_REQUIRED },
        { type: 'lotNumberRefused', message: NO_LOT },
      ])
    })

    it('answers a lot the product has a row of, or a second row without a lot, as already there', async () => {
      await repository().create(newRow())
      await repository().create(
        newRow({
          productId: productIdSchema.parse(productId),
          lotNumber: null,
        }),
      )

      const lot = await repository().create(newRow())
      const none = await repository().create(
        newRow({
          productId: productIdSchema.parse(productId),
          lotNumber: null,
        }),
      )

      expect([lot, none]).toEqual([
        {
          type: 'error',
          error: {
            type: 'alreadyExists',
            entity: 'Inventory',
            field: 'lotNumber',
            value: 'LOT-1',
          },
        },
        {
          type: 'error',
          error: {
            type: 'alreadyExists',
            entity: 'Inventory',
            field: 'lotNumber',
            value: 'null',
          },
        },
      ])
    })

    it('finds a row within the reach, and none outside it', async () => {
      const id = await insertStock()

      const found = dataOf(await repository().findById(everySalon, idOf(id)))
      const mine = dataOf(await repository().findById(salonReach(), idOf(id)))
      const elsewhere = dataOf(
        await repository().findById(salonReach(await salon()), idOf(id)),
      )

      expect(found).toEqual(await stored(id))
      expect(mine).toEqual(found)
      expect(elsewhere).toBeNull()
    })

    it('resolves each list to null for a cursor it cannot start from', async () => {
      const otherSalon = await salon()
      const elsewhere = await insertStock({
        salonId: otherSalon,
        productId: await insertProduct({}, otherSalon),
        expiryDate: '2025-12-31',
      })
      const page = { limit: 20, after: idOf(elsewhere) }

      const results = [
        dataOf(
          await repository().list({
            ...page,
            reach: salonReach(),
            salonId: null,
            productId: null,
            lotNumber: null,
          }),
        ),
        dataOf(
          await repository().listLowStock({
            ...page,
            salonId: ofSalon(),
            threshold: null,
          }),
        ),
        dataOf(
          await repository().listExpiring({
            ...page,
            salonId: ofSalon(),
            until: '2026-12-31',
          }),
        ),
      ]

      expect(results).toEqual([null, null, null])
    })

    it('counts every row that matches, across pages', async () => {
      for (const lot of ['A', 'B', 'C']) {
        await insertStock({
          productId: lotProductId,
          lotNumber: lot,
          ...stock('1'),
          expiryDate: '2025-12-31',
        })
      }
      const page = { limit: 1, after: null, salonId: ofSalon() }

      const lists = [
        dataOf(
          await repository().list({
            ...page,
            reach: everySalon,
            productId: null,
            lotNumber: null,
          }),
        ),
        dataOf(await repository().listLowStock({ ...page, threshold: 3 })),
        dataOf(
          await repository().listExpiring({ ...page, until: '2026-01-01' }),
        ),
      ]

      expect(
        lists.map((listed) => [
          listed?.rows.length,
          listed?.total,
          listed?.hasMore,
        ]),
      ).toEqual([
        [1, 3, true],
        [1, 3, true],
        [1, 3, true],
      ])
    })

    it('updates a row within the reach, and says of one outside it that it is not found', async () => {
      const id = await insertStock()

      const updated = dataOf(
        await repository().update(salonReach(), idOf(id), { shelf: 'S' }),
      )
      const elsewhere = dataOf(
        await repository().update(salonReach(await salon()), idOf(id), {
          shelf: 'T',
        }),
      )

      expect(updated).toMatchObject({
        type: 'updated',
        row: { id, shelf: 'S' },
      })
      expect(elsewhere).toEqual({ type: 'notFound' })
      expect((await stored(id))?.shelf).toBe('S')
    })

    it('says why it does not change the lot of a row', async () => {
      const id = await insertStock()

      const outcome = dataOf(
        await repository().update(everySalon, idOf(id), { lotNumber: 'A' }),
      )

      expect(outcome).toEqual({ type: 'lotNumberRefused', message: NO_LOT })
    })

    it('deletes a row within the reach and without stock, and says why it does not delete another', async () => {
      const free = await insertStock()
      const stocked = await insertStock({
        productId: lotProductId,
        lotNumber: 'A',
        ...stock('1'),
      })

      const outcomes = [
        dataOf(
          await repository().delete(salonReach(await salon()), idOf(free)),
        ),
        dataOf(await repository().delete(salonReach(), idOf(stocked))),
        dataOf(await repository().delete(salonReach(), idOf(free))),
        dataOf(await repository().delete(everySalon, idOf(free))),
      ]

      expect(outcomes).toEqual([
        { type: 'notFound' },
        { type: 'inStock' },
        { type: 'deleted' },
        { type: 'notFound' },
      ])
    })

    it.each([
      [
        'create',
        'Failed to create stock row',
        (repositoryOf: InventoryRepository) => repositoryOf.create(newRow()),
      ],
      [
        'findById',
        'Failed to find stock row',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.findById(everySalon, idOf(UNKNOWN_ID)),
      ],
      [
        'list',
        'Failed to list stock rows',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.list({
            reach: everySalon,
            limit: 20,
            after: null,
            salonId: null,
            productId: null,
            lotNumber: null,
          }),
      ],
      [
        'listLowStock',
        'Failed to list low stock',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.listLowStock({
            salonId: ofSalon(),
            limit: 20,
            after: null,
            threshold: null,
          }),
      ],
      [
        'listExpiring',
        'Failed to list expiring stock',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.listExpiring({
            salonId: ofSalon(),
            limit: 20,
            after: null,
            until: '2026-12-31',
          }),
      ],
      [
        'update',
        'Failed to update stock row',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.update(everySalon, idOf(UNKNOWN_ID), { shelf: 'S' }),
      ],
      [
        'delete',
        'Failed to delete stock row',
        (repositoryOf: InventoryRepository) =>
          repositoryOf.delete(everySalon, idOf(UNKNOWN_ID)),
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
