import { inventory, products, salons } from '@beauty-salon-backend/database'
import {
  type DbNewProduct,
  type DomainError,
  productIdSchema,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { ProductRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { entityMessages } from '@beauty-salon-shared/i18n/messages/api'
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

const MAX_INTEGER = 2_147_483_647

/** The largest stock level a `numeric(10, 2)` column holds. */
const MAX_LEVEL = 99_999_999.99

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

const INVALID = 'Invalid product'
const INVALID_UPDATE = 'Invalid product update'
const INVALID_SEARCH = 'Invalid product search'
const INVALID_ID = 'Invalid product ID'
const IN_STOCK =
  'The product cannot be deleted: it has stock; delete its stock first or set isActive to false'
const NO_SUCH_CURSOR = 'Must name a product of the salon'
const BELOW_THE_MINIMUM = 'Must not be less than minimumStock'
const BELOW_THE_REORDER_POINT = 'Must not be less than reorderPoint'
const ABOVE_THE_REORDER_POINT = 'Must not be more than reorderPoint'
const ABOVE_THE_MAXIMUM = 'Must not be more than maximumStock'

/** What a product code that another product of the salon has is told. */
const codeTaken = (code: string): string =>
  `Product with productCode ${code} already exists`

/** The properties of a ProductResponse. */
const PROPERTIES = [
  'barcode',
  'brand',
  'category',
  'createdAt',
  'description',
  'expiryMonths',
  'id',
  'imageUrl',
  'isActive',
  'isForSale',
  'isForTreatment',
  'leadTimeDays',
  'maximumStock',
  'minimumStock',
  'name',
  'productCode',
  'purchasePrice',
  'reorderPoint',
  'requiresLotTracking',
  'retailPrice',
  'safetyDataSheet',
  'salonId',
  'salonPrice',
  'storageConditions',
  'supplier',
  'supplierProductCode',
  'unit',
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

const idsOf = (response: Response): string[] =>
  response.body.data.map(({ id }: { id: string }) => id)

describe('Products API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string

  type NewSalon = typeof salons.$inferInsert
  type NewProduct = typeof products.$inferInsert
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

  /** Where the products of a salon are. */
  const pathOf = (ofSalon: string = salonId): string =>
    `/api/v1/salons/${ofSalon}/products`

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** A request that keeps every rule: a shampoo that is sold and used, with every level set. */
  const product = (overrides: Record<string, unknown> = {}) => ({
    productCode: 'SHMP001',
    name: 'プロフェッショナル シャンプー 500ml',
    description: '全ての髪質に使える保湿シャンプー',
    category: 'Hair Care',
    brand: 'Salon Pro',
    purchasePrice: 1500,
    retailPrice: 3500,
    salonPrice: 3000,
    unit: '本',
    minimumStock: 5,
    maximumStock: 50,
    reorderPoint: 10.5,
    supplier: 'Tokyo Beauty Supply',
    supplierProductCode: 'TBS-SHMP-500',
    leadTimeDays: 7,
    imageUrl: 'https://example.com/images/products/shampoo-001.jpg',
    barcode: '4901234567890',
    isForSale: true,
    isForTreatment: true,
    requiresLotTracking: true,
    expiryMonths: 36,
    storageConditions: '直射日光を避けて保管',
    safetyDataSheet: 'https://example.com/docs/sds/shampoo-001.pdf',
    isActive: true,
    ...overrides,
  })

  const create = (
    body: object = product(),
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

  /**
   * A product of a salon as a row: a code of its own and what must be
   * written, nothing that may be unset. Returns its ID.
   */
  const insertProduct = async (
    overrides: Partial<NewProduct> = {},
    ofSalon: string = salonId,
    executor: Executor = db,
  ): Promise<string> => {
    const [row] = await executor
      .insert(products)
      .values({
        salonId: ofSalon,
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

  /** A stock record of a product, of no stock, written directly; returns its ID. */
  const insertStock = async (
    productId: string,
    executor: Executor = db,
  ): Promise<string> => {
    const [row] = await executor
      .insert(inventory)
      .values({
        salonId,
        productId,
        currentStock: '0',
        availableStock: '0',
      })
      .returning({ id: inventory.id })
    if (row === undefined) {
      throw new Error('No stock was inserted')
    }
    return row.id
  }

  /** The row of a product, or undefined when there is none. */
  const stored = async (id: string) => {
    const [row] = await db.select().from(products).where(eq(products.id, id))
    return row
  }

  /** Every product that is stored, deleted or not, in the order of the IDs. */
  const everything = () => db.select().from(products).orderBy(asc(products.id))

  /** The moment of the clock that a change of a product writes by. */
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

  /** Everyone who reads the products of the salon of the tests. */
  const readers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Those of them who keep the products. */
  const keepers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
  ]

  /** Accounts the products of the salon of the tests are closed to. */
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

  /** Who does not keep them: a staff member of the salon reads them and no more. */
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
    ['a create', (as) => create(product(), as)],
    ['a get', (as, id) => read(id, as)],
    ['an update', (as, id) => update(id, { isActive: false }, as)],
    ['a delete', (as, id) => remove(id, as)],
  ]

  /** The operations that keep products. */
  const writes = operations.filter(([name]) =>
    ['a create', 'an update', 'a delete'].includes(name),
  )

  const deleted = { deletedAt: '2026-11-01T00:00:00.000Z' }

  /** IDs in a path that are not UUIDs. */
  const malformedIds = ['latest', '42', `${UNKNOWN_ID}0`]

  describe('POST /api/v1/salons/:salonId/products', () => {
    it('adds the product to the salon and answers 201 with it, where it is, and what the system set', async () => {
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
        ...product(),
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
    })

    it('stores what the request states, the stock levels to two decimals, and no time it was deleted', async () => {
      const response = await create()

      expect(await everything()).toEqual([
        {
          ...product(),
          id: response.body.data.id,
          salonId,
          minimumStock: '5.00',
          maximumStock: '50.00',
          reorderPoint: '10.50',
          deletedAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ])
    })

    it('keeps null for everything that may be unset: a price that is not noted is not a price of 0', async () => {
      const unset = {
        description: null,
        category: null,
        brand: null,
        purchasePrice: null,
        retailPrice: null,
        salonPrice: null,
        maximumStock: null,
        reorderPoint: null,
        supplier: null,
        supplierProductCode: null,
        leadTimeDays: null,
        imageUrl: null,
        barcode: null,
        expiryMonths: null,
        storageConditions: null,
        safetyDataSheet: null,
      }

      const response = await create(product(unset))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(unset)
      expect(await stored(response.body.data.id)).toMatchObject(unset)
    })

    it.each([
      ['prices of 0', { purchasePrice: 0, retailPrice: 0, salonPrice: 0 }],
      ['the largest price', { retailPrice: MAX_INTEGER }],
      [
        'a price for the salon above the price for customers',
        { retailPrice: 1000, salonPrice: 2000 },
      ],
      [
        'stock levels of 0',
        { minimumStock: 0, reorderPoint: 0, maximumStock: 0 },
      ],
      [
        'equal stock levels',
        { minimumStock: 12.34, reorderPoint: 12.34, maximumStock: 12.34 },
      ],
      [
        'the largest stock levels',
        {
          minimumStock: MAX_LEVEL,
          reorderPoint: MAX_LEVEL,
          maximumStock: MAX_LEVEL,
        },
      ],
      [
        'a minimum alone',
        { minimumStock: 3, reorderPoint: null, maximumStock: null },
      ],
      [
        'a reorder point above a maximum that is not set',
        { minimumStock: 0, reorderPoint: 80, maximumStock: null },
      ],
      ['a lead time of 0 days', { leadTimeDays: 0 }],
      ['a month to expiry', { expiryMonths: 1 }],
      ['a product code of 100 characters', { productCode: '𠮷'.repeat(100) }],
      ['a name of 255 characters', { name: '𠮷'.repeat(255) }],
      ['a unit of 20 characters', { unit: 'ｍ'.repeat(20) }],
      ['a supplier of 255 characters', { supplier: 'あ'.repeat(255) }],
      [
        'addresses of 500 characters, over http',
        {
          imageUrl: `http://example.com/${'a'.repeat(481)}`,
          safetyDataSheet: `https://example.com/${'b'.repeat(480)}`,
        },
      ],
      [
        'a product that is neither sold nor used, not tracked by lot, not active',
        {
          isForSale: false,
          isForTreatment: false,
          requiresLotTracking: false,
          isActive: false,
        },
      ],
    ])('takes %s and returns it as it was stated', async (_case, stated) => {
      const response = await create(product(stated))

      expect(response.status).toBe(201)
      expect(response.body.data).toMatchObject(stated)
      expect((await read(response.body.data.id)).body.data).toEqual(
        response.body.data,
      )
    })

    it('adds to the salon of the path and to no other', async () => {
      const otherSalon = await salon()
      await insertProduct()

      const response = await create(product(), asAdmin, otherSalon)

      expect(response.status).toBe(201)
      expect(response.body.data.salonId).toBe(otherSalon)
      expect(response.headers['location']).toBe(
        `${pathOf(otherSalon)}/${response.body.data.id}`,
      )
      expect((await list()).body.meta.total).toBe(1)
      expect((await list({}, asAdmin, otherSalon)).body.meta.total).toBe(1)
    })

    it('says where the product is by the path the request came on, without its query', async () => {
      const path = pathOf().replace('salons', 'SALONS')

      const response = await request(app)
        .post(`${path}?verbose=1`)
        .set('Authorization', asAdmin)
        .send(product())

      expect(response.status).toBe(201)
      expect(response.headers['location']).toBe(
        `${path}/${response.body.data.id}`,
      )
      expect(response.body.links).toEqual({
        self: `${path}/${response.body.data.id}`,
        list: path,
      })
    })

    describe('the product code', () => {
      it('refuses a code that another product of the salon has, and stores nothing', async () => {
        const existing = await insertProduct({ productCode: 'SHMP001' })

        const response = await create()

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(codeTaken('SHMP001'))
        expect((await everything()).map(({ id }) => id)).toEqual([existing])
      })

      it('refuses the code of a product that is not active', async () => {
        await insertProduct({ productCode: 'SHMP001', isActive: false })

        expectProblem(await create(), alreadyExists)
      })

      it('takes the code of a product of another salon', async () => {
        await insertProduct({ productCode: 'SHMP001' }, await salon())

        expect((await create()).status).toBe(201)
      })

      it('takes the code of a product that is deleted, and keeps the deleted one', async () => {
        const gone = await insertProduct({ productCode: 'SHMP001', ...deleted })

        const response = await create()

        expect(response.status).toBe(201)
        expect(await stored(gone)).toMatchObject({
          productCode: 'SHMP001',
          deletedAt: expect.any(String),
        })
      })

      it.each([
        ['in another case', 'shmp001'],
        ['with a space after it', 'SHMP001 '],
      ])(
        'tells a code %s from the code: codes are compared as they are written',
        async (_case, productCode) => {
          await insertProduct({ productCode: 'SHMP001' })

          const response = await create(product({ productCode }))

          expect(response.status).toBe(201)
          expect(response.body.data.productCode).toBe(productCode)
        },
      )
    })

    describe('what a request must be', () => {
      it.each([
        [
          'an empty product code',
          { productCode: '' },
          ['productCode:invalid_format'],
        ],
        [
          'a product code of 101 characters',
          { productCode: 'C'.repeat(101) },
          ['productCode:too_big'],
        ],
        ['a blank name', { name: ' ' }, ['name:invalid_format']],
        [
          'a name of 256 characters',
          { name: 'あ'.repeat(256) },
          ['name:too_big'],
        ],
        ['a blank unit', { unit: '　' }, ['unit:invalid_format']],
        ['a unit of 21 characters', { unit: 'u'.repeat(21) }, ['unit:too_big']],
        [
          'an empty description',
          { description: '' },
          ['description:invalid_format'],
        ],
        ['a blank category', { category: ' ' }, ['category:invalid_format']],
        [
          'a supplier of 256 characters',
          { supplier: 's'.repeat(256) },
          ['supplier:too_big'],
        ],
        [
          'a barcode of 101 characters',
          { barcode: '1'.repeat(101) },
          ['barcode:too_big'],
        ],
        [
          'negative prices',
          { purchasePrice: -1, retailPrice: -1, salonPrice: -1 },
          [
            'purchasePrice:too_small',
            'retailPrice:too_small',
            'salonPrice:too_small',
          ],
        ],
        [
          'a price with a fraction of a yen',
          { retailPrice: 3500.5 },
          ['retailPrice:invalid_type'],
        ],
        [
          'a price above what the column holds',
          { salonPrice: MAX_INTEGER + 1 },
          ['salonPrice:too_big'],
        ],
        [
          'a negative minimum',
          { minimumStock: -0.01 },
          ['minimumStock:too_small'],
        ],
        [
          'a reorder point with three decimals',
          { reorderPoint: 10.005 },
          ['reorderPoint:not_multiple_of'],
        ],
        [
          'a maximum above what the column holds',
          { maximumStock: 100_000_000 },
          ['maximumStock:too_big'],
        ],
        [
          'a minimum that is text',
          { minimumStock: '5' },
          ['minimumStock:invalid_type'],
        ],
        [
          'a minimum that is null',
          { minimumStock: null },
          ['minimumStock:invalid_type'],
        ],
        [
          'a negative lead time',
          { leadTimeDays: -1 },
          ['leadTimeDays:too_small'],
        ],
        [
          'no months to expiry',
          { expiryMonths: 0 },
          ['expiryMonths:too_small'],
        ],
        [
          'an image that is a path',
          { imageUrl: '/images/products/shampoo-001.jpg' },
          ['imageUrl:invalid_format'],
        ],
        [
          'a sheet that is a script',
          { safetyDataSheet: 'javascript:alert(1)' },
          ['safetyDataSheet:invalid_format'],
        ],
        [
          'an address of 501 characters',
          { imageUrl: `https://example.com/${'a'.repeat(481)}` },
          ['imageUrl:too_big'],
        ],
        [
          'text for the flags',
          { isForSale: 'true', isForTreatment: 1, isActive: 'yes' },
          [
            'isForSale:invalid_type',
            'isForTreatment:invalid_type',
            'isActive:invalid_type',
          ],
        ],
        [
          'a salon, an ID, times and a supplier ID',
          {
            salonId: UNKNOWN_ID,
            id: UNKNOWN_ID,
            deletedAt: null,
            createdAt: '2026-11-14T09:00:00.000Z',
            supplierId: UNKNOWN_ID,
          },
          [
            'salonId:unrecognized_keys',
            'id:unrecognized_keys',
            'deletedAt:unrecognized_keys',
            'createdAt:unrecognized_keys',
            'supplierId:unrecognized_keys',
          ],
        ],
      ])('refuses %s and stores nothing', async (_case, change, expected) => {
        const response = await create(product(change))

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID)
        expect(brokenRules(response)).toEqual(expected)
        expect(await everything()).toEqual([])
      })

      it.each(Object.keys(product()))(
        'refuses a request without %s: every key has to be there',
        async (property) => {
          const body = Object.fromEntries(
            Object.entries(product()).filter(([name]) => name !== property),
          )

          const response = await create(body)

          expectProblem(response, badRequest)
          expect(
            brokenRules(response).map((rule) => rule.replace(/:.*$/, '')),
          ).toEqual([property])
          expect(await everything()).toEqual([])
        },
      )

      it.each([
        [
          'a reorder point below the minimum',
          { minimumStock: 5, reorderPoint: 4.99, maximumStock: 50 },
          [issue('reorderPoint', 'custom', BELOW_THE_MINIMUM)],
        ],
        [
          'a maximum below the minimum',
          { minimumStock: 5, reorderPoint: null, maximumStock: 4 },
          [issue('maximumStock', 'custom', BELOW_THE_MINIMUM)],
        ],
        [
          'a maximum below the reorder point',
          { minimumStock: 5, reorderPoint: 10, maximumStock: 9 },
          [issue('maximumStock', 'custom', BELOW_THE_REORDER_POINT)],
        ],
        [
          'three falling levels',
          { minimumStock: 30, reorderPoint: 20, maximumStock: 10 },
          [
            issue('reorderPoint', 'custom', BELOW_THE_MINIMUM),
            issue('maximumStock', 'custom', BELOW_THE_MINIMUM),
            issue('maximumStock', 'custom', BELOW_THE_REORDER_POINT),
          ],
        ],
      ])(
        'refuses %s, and says so of the upper level',
        async (_case, levels, expected) => {
          const response = await create(product(levels))

          expectProblem(response, badRequest)
          expect(response.body.detail).toBe(INVALID)
          expect(response.body.errors).toEqual(expected)
          expect(await everything()).toEqual([])
        },
      )

      it('reports everything that is wrong at once, the order of the levels with the rest', async () => {
        const response = await create(
          product({
            name: '',
            purchasePrice: -1,
            minimumStock: 9,
            reorderPoint: null,
            maximumStock: 8,
          }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([
          'name:invalid_format',
          'purchasePrice:too_small',
          'maximumStock:custom',
        ])
      })

      it('does not compare levels when one of them is refused for what it is', async () => {
        const response = await create(
          product({ minimumStock: 9, reorderPoint: -1, maximumStock: 8 }),
        )

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual(['reorderPoint:too_small'])
      })

      it('looks at the request before it looks at the codes of the salon', async () => {
        await insertProduct({ productCode: 'SHMP001' })

        const response = await create(product({ name: '' }))

        expectProblem(response, badRequest)
      })

      it.each([
        ['a list of requests', [product()]],
        ['an empty list', []],
      ])('refuses %s in place of the request', async (_case, body) => {
        const response = await create(body)

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([':invalid_type'])
      })

      it.each([
        ['a body that is not JSON', '{"productCode":'],
        ['a body that is null', 'null'],
        ['a body that is text', '"SHMP001"'],
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
          .send('productCode=SHMP001')

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

          const response = await create(product(), asAdmin, ofSalon)

          expectProblem(response, notFound)
          expect(response.body.detail).toContain('Salon')
          expect(await everything()).toEqual([])
        },
      )

      it.each(malformedIds)(
        'refuses %s as the salon, to whoever asks',
        async (salonOfPath) => {
          const responses = [
            await create(product(), asAdmin, salonOfPath),
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
      const response = await create(product({ name: '' }), asAdmin, UNKNOWN_ID)

      expectProblem(response, badRequest)
    })
  })

  describe('GET /api/v1/salons/:salonId/products', () => {
    it('lists the products of the salon as the contract has them, with how many there are and where the list is', async () => {
      const id = await insertProduct({
        productCode: 'COL-6N',
        name: 'カラー剤 6N',
        description: 'アルカリカラー',
        category: 'Hair Color',
        brand: 'ColorTech',
        purchasePrice: 800,
        retailPrice: null,
        salonPrice: 1200,
        unit: 'g',
        minimumStock: '500.00',
        maximumStock: '3000.00',
        reorderPoint: '1000.50',
        supplier: 'ColorTech Japan',
        supplierProductCode: 'CT-6N',
        leadTimeDays: 14,
        imageUrl: 'https://example.com/6n.jpg',
        barcode: '4901234567891',
        isForSale: false,
        isForTreatment: true,
        requiresLotTracking: true,
        expiryMonths: 24,
        storageConditions: '冷暗所',
        safetyDataSheet: 'https://example.com/6n.pdf',
        isActive: false,
      })

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [
          {
            id,
            salonId,
            productCode: 'COL-6N',
            name: 'カラー剤 6N',
            description: 'アルカリカラー',
            category: 'Hair Color',
            brand: 'ColorTech',
            purchasePrice: 800,
            retailPrice: null,
            salonPrice: 1200,
            unit: 'g',
            minimumStock: 500,
            maximumStock: 3000,
            reorderPoint: 1000.5,
            supplier: 'ColorTech Japan',
            supplierProductCode: 'CT-6N',
            leadTimeDays: 14,
            imageUrl: 'https://example.com/6n.jpg',
            barcode: '4901234567891',
            isForSale: false,
            isForTreatment: true,
            requiresLotTracking: true,
            expiryMonths: 24,
            storageConditions: '冷暗所',
            safetyDataSheet: 'https://example.com/6n.pdf',
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
      await insertProduct({ productCode: 'MIN-1' })

      const response = await list()

      expect(response.body.data).toEqual([
        expect.objectContaining({
          productCode: 'MIN-1',
          name: 'シャンプー',
          unit: '本',
          description: null,
          category: null,
          brand: null,
          purchasePrice: null,
          retailPrice: null,
          salonPrice: null,
          minimumStock: 0,
          maximumStock: null,
          reorderPoint: null,
          supplier: null,
          supplierProductCode: null,
          leadTimeDays: null,
          imageUrl: null,
          barcode: null,
          isForSale: false,
          isForTreatment: true,
          requiresLotTracking: false,
          expiryMonths: null,
          storageConditions: null,
          safetyDataSheet: null,
          isActive: true,
        }),
      ])
    })

    it('answers with an empty list for a salon without products', async () => {
      await insertProduct({}, await salon())

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([])
      expect(response.body.meta).toMatchObject({ total: 0, hasMore: false })
    })

    it('lists in the order of the product code, whatever the order they were written in', async () => {
      const c = await insertProduct({ productCode: 'C001' })
      const a2 = await insertProduct({ productCode: 'A002' })
      const b = await insertProduct({ productCode: 'B001' })
      const a1 = await insertProduct({ productCode: 'A001' })

      const response = await list()

      expect(idsOf(response)).toEqual([a1, a2, b, c])
    })

    it('lists the products of the salon of the path only, and none that is deleted', async () => {
      const otherSalon = await salon()
      const mine = await insertProduct()
      await insertProduct(deleted)
      const theirs = await insertProduct({}, otherSalon)

      const here = await list()
      const there = await list({}, asAdmin, otherSalon)

      expect(idsOf(here)).toEqual([mine])
      expect(here.body.meta.total).toBe(1)
      expect(idsOf(there)).toEqual([theirs])
    })

    describe('filters', () => {
      let shampoo: string
      let color: string
      let oil: string

      beforeEach(async () => {
        shampoo = await insertProduct({
          productCode: 'H001',
          name: 'シャンプー 500ml',
          brand: 'Salon Pro',
          category: 'Hair Care',
          barcode: '4901234567890',
          isForSale: true,
          isForTreatment: true,
        })
        color = await insertProduct({
          productCode: 'H002',
          name: 'カラー剤 6N',
          brand: 'ColorTech',
          category: 'Hair Color',
          barcode: '4901234567891',
          isForSale: false,
          isForTreatment: true,
        })
        oil = await insertProduct({
          productCode: 'S001',
          name: 'Massage Oil 50%',
          category: 'Spa',
          isForSale: true,
          isForTreatment: false,
          isActive: false,
        })
        await insertProduct({
          productCode: 'H003',
          name: 'シャンプー 1000ml',
          category: 'Hair Care',
          barcode: '4901234567892',
          ...deleted,
        })
        await insertProduct(
          { productCode: 'H004', name: 'シャンプー', category: 'Hair Care' },
          await salon(),
        )
      })

      it('returns all of them, active or not, without a filter', async () => {
        const response = await list()

        expect(idsOf(response)).toEqual([shampoo, color, oil])
        expect(response.body.meta.total).toBe(3)
      })

      it.each<[string, Record<string, unknown>, () => string[]]>([
        ['a keyword in the name', { keyword: 'シャンプー' }, () => [shampoo]],
        [
          'a keyword in the code, in another case',
          { keyword: 'h00' },
          () => [shampoo, color],
        ],
        [
          'a keyword in the brand, in another case',
          { keyword: 'colortech' },
          () => [color],
        ],
        [
          'a keyword with a per cent sign, as it is',
          { keyword: '50%' },
          () => [oil],
        ],
        [
          'a keyword that is a per cent sign alone',
          { keyword: '%' },
          () => [oil],
        ],
        ['a keyword that is an underscore', { keyword: '_' }, () => []],
        ['a keyword of a deleted product', { keyword: 'H003' }, () => []],
        ['the category', { category: 'Hair Care' }, () => [shampoo]],
        ['the category in another case', { category: 'hair care' }, () => []],
        ['the barcode', { barcode: '4901234567891' }, () => [color]],
        [
          'the barcode of a deleted product',
          { barcode: '4901234567892' },
          () => [],
        ],
        ['the active ones', { isActive: true }, () => [shampoo, color]],
        ['those that are not active', { isActive: false }, () => [oil]],
        ['those for sale', { isForSale: true }, () => [shampoo, oil]],
        ['those not for sale', { isForSale: false }, () => [color]],
        [
          'those for treatments',
          { isForTreatment: true },
          () => [shampoo, color],
        ],
        ['those not for treatments', { isForTreatment: false }, () => [oil]],
        [
          'the active ones for sale',
          { isActive: true, isForSale: true },
          () => [shampoo],
        ],
        [
          'a keyword and a flag',
          { keyword: 'h0', isForSale: false },
          () => [color],
        ],
      ])('returns those of %s', async (_case, query, expected) => {
        const response = await list(query)

        expect(idsOf(response)).toEqual(expected())
        expect(response.body.meta.total).toBe(expected().length)
      })

      it('counts what the filters match, not what the page holds, and keeps the filters in the link to the next page', async () => {
        const response = await list({ isForTreatment: true, limit: 1 })

        expect(idsOf(response)).toEqual([shampoo])
        expect(response.body.meta).toMatchObject({
          total: 2,
          limit: 1,
          hasMore: true,
          nextCursor: shampoo,
        })
        expect(response.body.links.next).toBe(
          `${pathOf()}?isForTreatment=true&limit=1&cursor=${shampoo}`,
        )
      })

      it('pages within the filters', async () => {
        const response = await list({
          isForSale: true,
          limit: 1,
          cursor: shampoo,
        })

        expect(idsOf(response)).toEqual([oil])
        expect(response.body.meta).toMatchObject({ total: 2, hasMore: false })
      })
    })

    describe('pages', () => {
      /** Seven products, written out of the order of their codes. */
      const seven = async (): Promise<string[]> => {
        const ids: Record<string, string> = {}
        for (const code of ['C4', 'C7', 'C1', 'C5', 'C3', 'C6', 'C2']) {
          ids[code] = await insertProduct({ productCode: code })
        }
        return ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map(
          (code) => ids[code] ?? '',
        )
      }

      it('returns 20 products unless the request says how many, and says that more follow', async () => {
        for (let count = 0; count < 21; count += 1) {
          await insertProduct()
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
        await insertProduct()
        await insertProduct()

        const response = await list({ limit: 2 })

        expect(response.body.data).toHaveLength(2)
        expect(response.body.meta).toMatchObject({
          total: 2,
          hasMore: false,
          nextCursor: null,
        })
        expect(response.body.links.next).toBeNull()
      })

      it('walks every product once, in order, along the links to the next page', async () => {
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
          walked.push(...idsOf(response))
          sizes.push(response.body.data.length)
          next = response.body.links.next
        }

        expect(walked).toEqual(ordered)
        expect(sizes).toEqual([2, 2, 2, 1])
      })

      it('starts a page after the product the cursor names, and names the cursor it was given', async () => {
        const ordered = await seven()

        const response = await list({ limit: 3, cursor: ordered[1] })

        expect(idsOf(response)).toEqual(ordered.slice(2, 5))
        expect(response.body.meta).toMatchObject({
          cursor: ordered[1],
          nextCursor: ordered[4],
          hasMore: true,
          prevCursor: null,
        })
      })

      it('starts a page after where the product of the cursor is now, when its code was changed', async () => {
        const ordered = await seven()
        await db
          .update(products)
          .set({ productCode: 'C55' })
          .where(eq(products.id, ordered[1] ?? ''))

        const response = await list({ limit: 2, cursor: ordered[1] })

        expect(idsOf(response)).toEqual([ordered[5], ordered[6]])
      })

      it('takes a limit of 100 and of 1', async () => {
        await insertProduct()

        expect((await list({ limit: 100 })).body.meta.limit).toBe(100)
        expect((await list({ limit: 1 })).body.meta.limit).toBe(1)
      })

      it.each([
        ['names nothing', async () => UNKNOWN_ID],
        [
          'names a product of another salon',
          async () => insertProduct({}, await salon()),
        ],
        ['names a product that is deleted', async () => insertProduct(deleted)],
      ])('refuses a cursor that %s', async (_case, cursorOf) => {
        await insertProduct()

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
      ['an empty keyword', { keyword: '' }, ['keyword:invalid_format']],
      [
        'a keyword of 101 characters',
        { keyword: 'k'.repeat(101) },
        ['keyword:too_big'],
      ],
      ['a blank category', { category: ' ' }, ['category:invalid_format']],
      ['an empty barcode', { barcode: '' }, ['barcode:invalid_format']],
      [
        'flags that are neither true nor false',
        { isActive: 'yes', isForSale: '1', isForTreatment: 'TRUE' },
        [
          'isActive:invalid_value',
          'isForSale:invalid_value',
          'isForTreatment:invalid_value',
        ],
      ],
      [
        'a filter the list does not have',
        { supplier: 'Tokyo Beauty Supply' },
        ['supplier:unrecognized_keys'],
      ],
      [
        'several of them',
        { limit: 0, keyword: '', salonId: UNKNOWN_ID },
        [
          'limit:too_small',
          'keyword:invalid_format',
          'salonId:unrecognized_keys',
        ],
      ],
    ])('refuses %s', async (_case, query, expected) => {
      const response = await list(query)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(expected)
    })

    it('refuses a keyword that is given twice', async () => {
      const response = await request(app)
        .get(`${pathOf()}?keyword=a&keyword=b`)
        .set('Authorization', asAdmin)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['keyword:invalid_type'])
    })

    it.each([
      ['does not exist', async () => UNKNOWN_ID],
      ['is deleted', () => salon(deleted)],
    ])('answers 404 for a salon that %s', async (_case, salonOf) => {
      const ofSalon = await salonOf()
      await insertProduct()

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

  describe('GET /api/v1/salons/:salonId/products/:id', () => {
    it('returns the product, where it is and where the list is', async () => {
      const id = await insertProduct({
        productCode: 'OIL-1',
        name: 'ヘアオイル',
        minimumStock: '2.50',
        maximumStock: '20.00',
        isForSale: true,
      })

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expect(response.body.data).toMatchObject({
        id,
        salonId,
        productCode: 'OIL-1',
        name: 'ヘアオイル',
        minimumStock: 2.5,
        maximumStock: 20,
        reorderPoint: null,
        isForSale: true,
      })
      expect(response.body.links).toEqual({
        self: `${pathOf()}/${id}`,
        list: pathOf(),
      })
    })

    it('returns the one that was asked for, not another one of the salon', async () => {
      await insertProduct({ productCode: 'A' })
      const id = await insertProduct({ productCode: 'B', name: 'これ' })
      await insertProduct({ productCode: 'C' })

      const response = await read(id)

      expect(response.body.data).toMatchObject({ id, name: 'これ' })
    })

    it('returns a product that is not active', async () => {
      const id = await insertProduct({ isActive: false })

      const response = await read(id)

      expect(response.status).toBe(200)
      expect(response.body.data.isActive).toBe(false)
    })

    it('takes an ID in upper case, and says where the product is by the path the request came on', async () => {
      const id = await insertProduct()
      const path = pathOf().replace('products', 'Products')

      const response = await request(app)
        .get(`${path}/${id.toUpperCase()}?verbose=1`)
        .set('Authorization', asAdmin)

      expect(response.status).toBe(200)
      expect(response.body.data.id).toBe(id)
      expect(response.body.links).toEqual({ self: `${path}/${id}`, list: path })
    })

    it.each([
      ['does not exist', async () => UNKNOWN_ID],
      ['is of another salon', async () => insertProduct({}, await salon())],
      ['is deleted', async () => insertProduct(deleted)],
    ])('answers 404 for a product that %s', async (_case, idOf) => {
      await insertProduct()
      const id = await idOf()

      const response = await read(id)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Product')
      expect(response.body.detail).toContain(id)
    })

    it('answers 404, of the salon, for a product of a salon that is deleted', async () => {
      const gone = await salon(deleted)
      const id = await insertProduct({}, gone)

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

  describe('PATCH /api/v1/salons/:salonId/products/:id', () => {
    it('writes the one property a request names and the time of the change, and leaves the rest and every other product', async () => {
      const id = await insertProduct({
        productCode: 'SHMP001',
        brand: 'Salon Pro',
        purchasePrice: 1500,
        minimumStock: '5.00',
        maximumStock: '50.00',
        supplier: 'Tokyo Beauty Supply',
      })
      const other = await insertProduct()
      const elsewhere = await insertProduct({}, await salon())
      const before = await everything()
      const until = await databaseClock()

      const response = await update(id, { name: 'シャンプー 1000ml' })
      const after = await databaseClock()

      expect(response.status).toBe(200)
      expect(Object.keys(response.body.data).toSorted()).toEqual(PROPERTIES)
      expect(response.body.data).toMatchObject({
        id,
        salonId,
        productCode: 'SHMP001',
        name: 'シャンプー 1000ml',
        brand: 'Salon Pro',
        purchasePrice: 1500,
        minimumStock: 5,
        maximumStock: 50,
        supplier: 'Tokyo Beauty Supply',
      })
      expectBetween(response.body.data.updatedAt, until, after)
      expect(response.body.links).toEqual({
        self: `${pathOf()}/${id}`,
        list: pathOf(),
      })
      const rowOf = (rowId: string) => before.find((row) => row.id === rowId)
      expect(await stored(id)).toEqual({
        ...rowOf(id),
        name: 'シャンプー 1000ml',
        updatedAt: expect.any(String),
      })
      expect(await stored(other)).toEqual(rowOf(other))
      expect(await stored(elsewhere)).toEqual(rowOf(elsewhere))
      expect((await read(id)).body.data).toEqual(response.body.data)
    })

    it('writes everything a request can name at once', async () => {
      const id = await insertProduct()

      const response = await update(id, product())

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject(product())
      expect(await stored(id)).toMatchObject({
        ...product(),
        minimumStock: '5.00',
        maximumStock: '50.00',
        reorderPoint: '10.50',
      })
    })

    it.each(
      Object.entries(product()).filter(
        ([property]) =>
          !['minimumStock', 'maximumStock', 'reorderPoint'].includes(property),
      ),
    )('writes %s alone', async (property, value) => {
      const id = await insertProduct()
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
      const id = await insertProduct({
        description: '説明',
        brand: 'Salon Pro',
        retailPrice: 3500,
        maximumStock: '50.00',
        reorderPoint: '10.00',
        supplier: 'Tokyo Beauty Supply',
        imageUrl: 'https://example.com/a.jpg',
        expiryMonths: 36,
      })
      const unset = {
        description: null,
        brand: null,
        retailPrice: null,
        maximumStock: null,
        reorderPoint: null,
        supplier: null,
        imageUrl: null,
        expiryMonths: null,
      }

      const response = await update(id, unset)

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject(unset)
      expect(await stored(id)).toMatchObject(unset)
    })

    it('writes the time of the change for a request that changes no value, and leaves the time the product was added', async () => {
      const id = await insertProduct({ name: 'シャンプー' })
      const before = (await read(id)).body.data
      await pause(5)

      const response = await update(id, { name: 'シャンプー' })

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual({
        ...before,
        updatedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThan(
        Date.parse(before.updatedAt),
      )
    })

    it('changes a product that is not active, and one that has stock', async () => {
      const id = await insertProduct({ isActive: false })
      await insertStock(id)

      const response = await update(id, { isActive: true, retailPrice: 4000 })

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({
        isActive: true,
        retailPrice: 4000,
      })
    })

    describe('the product code', () => {
      it('takes the code the product has', async () => {
        const id = await insertProduct({ productCode: 'SHMP001' })

        const response = await update(id, { productCode: 'SHMP001' })

        expect(response.status).toBe(200)
      })

      it('refuses the code of another product of the salon, and writes nothing', async () => {
        await insertProduct({ productCode: 'SHMP001' })
        const id = await insertProduct({ productCode: 'SHMP002' })
        const before = await stored(id)

        const response = await update(id, {
          productCode: 'SHMP001',
          name: '別の名前',
        })

        expectProblem(response, alreadyExists)
        expect(response.body.detail).toBe(codeTaken('SHMP001'))
        expect(await stored(id)).toEqual(before)
      })

      it.each([
        [
          'of another salon',
          async () => insertProduct({ productCode: 'SHMP001' }, await salon()),
        ],
        [
          'that is deleted',
          async () => insertProduct({ productCode: 'SHMP001', ...deleted }),
        ],
      ])('takes the code of a product %s', async (_case, other) => {
        await other()
        const id = await insertProduct({ productCode: 'SHMP002' })

        const response = await update(id, { productCode: 'SHMP001' })

        expect(response.status).toBe(200)
        expect(response.body.data.productCode).toBe('SHMP001')
      })

      it('compares the levels before it writes the code', async () => {
        await insertProduct({ productCode: 'SHMP001' })
        const id = await insertProduct({
          productCode: 'SHMP002',
          minimumStock: '5.00',
        })

        const response = await update(id, {
          productCode: 'SHMP001',
          maximumStock: 1,
        })

        expectProblem(response, badRequest)
        expect(response.body.errors).toEqual([
          issue('maximumStock', 'custom', BELOW_THE_MINIMUM),
        ])
      })
    })

    describe('the stock levels', () => {
      /** A product whose minimum is 5, reorder point 10 and maximum 50. */
      const withLevels = () =>
        insertProduct({
          minimumStock: '5.00',
          reorderPoint: '10.00',
          maximumStock: '50.00',
        })

      it.each([
        [
          'a minimum above the reorder point that is stored',
          { minimumStock: 11 },
          [issue('minimumStock', 'custom', ABOVE_THE_REORDER_POINT)],
        ],
        [
          'a minimum above the reorder point and the maximum that are stored',
          { minimumStock: 60 },
          [
            issue('minimumStock', 'custom', ABOVE_THE_REORDER_POINT),
            issue('minimumStock', 'custom', ABOVE_THE_MAXIMUM),
          ],
        ],
        [
          'a reorder point below the minimum that is stored',
          { reorderPoint: 4 },
          [issue('reorderPoint', 'custom', BELOW_THE_MINIMUM)],
        ],
        [
          'a reorder point above the maximum that is stored',
          { reorderPoint: 51 },
          [issue('reorderPoint', 'custom', ABOVE_THE_MAXIMUM)],
        ],
        [
          'a maximum below the reorder point that is stored',
          { maximumStock: 9.99 },
          [issue('maximumStock', 'custom', BELOW_THE_REORDER_POINT)],
        ],
        [
          'a maximum below the minimum and the reorder point that are stored',
          { maximumStock: 4, name: '別の名前' },
          [
            issue('maximumStock', 'custom', BELOW_THE_MINIMUM),
            issue('maximumStock', 'custom', BELOW_THE_REORDER_POINT),
          ],
        ],
        [
          'a minimum and a maximum around the reorder point that is stored',
          { minimumStock: 20, maximumStock: 30 },
          [issue('minimumStock', 'custom', ABOVE_THE_REORDER_POINT)],
        ],
        [
          'a minimum and a maximum out of order',
          { minimumStock: 20, maximumStock: 15 },
          [issue('maximumStock', 'custom', BELOW_THE_MINIMUM)],
        ],
      ])('refuses %s, and writes nothing', async (_case, body, expected) => {
        const id = await withLevels()
        const before = await stored(id)

        const response = await update(id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(response.body.errors).toEqual(expected)
        expect(await stored(id)).toEqual(before)
      })

      it.each([
        ['a minimum equal to the reorder point', { minimumStock: 10 }],
        ['a maximum equal to the reorder point', { maximumStock: 10 }],
        ['a reorder point equal to the minimum', { reorderPoint: 5 }],
        ['a reorder point equal to the maximum', { reorderPoint: 50 }],
        [
          'three new levels above the old maximum',
          { minimumStock: 60, reorderPoint: 70, maximumStock: 80 },
        ],
        [
          'a minimum above the old levels, with them taken away',
          { minimumStock: 60, reorderPoint: null, maximumStock: null },
        ],
        [
          'a minimum above the old reorder point, with that taken away',
          { minimumStock: 11, reorderPoint: null },
        ],
        [
          'three new levels below the old minimum',
          { minimumStock: 0, reorderPoint: 2, maximumStock: 3 },
        ],
        ['the reorder point taken away', { reorderPoint: null }],
        ['the maximum taken away', { maximumStock: null }],
      ])('takes %s', async (_case, body) => {
        const id = await withLevels()

        const response = await update(id, body)

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject(body)
        expect((await read(id)).body.data).toMatchObject(body)
      })

      it.each([
        ['any minimum', { minimumStock: MAX_LEVEL }],
        ['any maximum', { maximumStock: 0 }],
        ['any reorder point', { reorderPoint: 0 }],
      ])(
        'takes %s for a product whose minimum is 0 and that has no other level',
        async (_case, body) => {
          const id = await insertProduct()

          const response = await update(id, body)

          expect(response.status).toBe(200)
          expect(response.body.data).toMatchObject(body)
        },
      )

      it('holds a change that names no level to nothing: the levels stay', async () => {
        const id = await withLevels()

        const response = await update(id, { isActive: false })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          minimumStock: 5,
          reorderPoint: 10,
          maximumStock: 50,
          isActive: false,
        })
      })
    })

    describe('what a request must be', () => {
      it.each([
        ['a request that names nothing', {}, [':custom']],
        [
          'a salon and the time it was deleted',
          { salonId: UNKNOWN_ID, deletedAt: null },
          ['salonId:unrecognized_keys', 'deletedAt:unrecognized_keys'],
        ],
        [
          'null for what must be set',
          {
            productCode: null,
            name: null,
            unit: null,
            minimumStock: null,
            isActive: null,
          },
          [
            'productCode:invalid_type',
            'name:invalid_type',
            'unit:invalid_type',
            'minimumStock:invalid_type',
            'isActive:invalid_type',
          ],
        ],
        [
          'an empty product code',
          { productCode: '' },
          ['productCode:invalid_format'],
        ],
        [
          'a negative minimum',
          { minimumStock: -1 },
          ['minimumStock:too_small'],
        ],
        [
          'a reorder point with three decimals',
          { reorderPoint: 1.005 },
          ['reorderPoint:not_multiple_of'],
        ],
        [
          'an image of a script',
          { imageUrl: 'javascript:alert(1)' },
          ['imageUrl:invalid_format'],
        ],
        [
          'several of them',
          { name: '', purchasePrice: -1, isActive: 'no' },
          [
            'name:invalid_format',
            'purchasePrice:too_small',
            'isActive:invalid_type',
          ],
        ],
      ])('refuses %s and writes nothing', async (_case, body, expected) => {
        const id = await insertProduct()
        const before = await stored(id)

        const response = await update(id, body)

        expectProblem(response, badRequest)
        expect(response.body.detail).toBe(INVALID_UPDATE)
        expect(brokenRules(response)).toEqual(expected)
        expect(await stored(id)).toEqual(before)
      })

      it('says of a request that names nothing what is missing', async () => {
        const response = await update(await insertProduct(), {})

        expect(response.body.errors).toEqual([
          issue('', 'custom', 'At least one property must be specified'),
        ])
      })

      it('refuses a list in place of the request', async () => {
        const response = await update(await insertProduct(), [
          { isActive: false },
        ])

        expectProblem(response, badRequest)
        expect(brokenRules(response)).toEqual([':invalid_type'])
      })

      it.each([
        ['a body that is not JSON', '{"name":'],
        ['a body that is null', 'null'],
      ])('refuses %s as a body that cannot be read', async (_case, body) => {
        const id = await insertProduct()

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
        ['is of another salon', async () => insertProduct({}, await salon())],
        ['is deleted', async () => insertProduct(deleted)],
      ])(
        'answers 404 for a product that %s, and changes nothing',
        async (_case, idOf) => {
          await insertProduct()
          const id = await idOf()
          const before = await everything()

          const response = await update(id, { isActive: false })

          expectProblem(response, notFound)
          expect(response.body.detail).toContain('Product')
          expect(await everything()).toEqual(before)
        },
      )

      it('answers 404, of the salon, for a product of a salon that is deleted, and changes nothing', async () => {
        const gone = await salon(deleted)
        const id = await insertProduct({}, gone)

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

      it('looks for the salon before it looks for the product', async () => {
        const response = await update(
          UNKNOWN_ID,
          { isActive: false },
          asAdmin,
          UNKNOWN_ID,
        )

        expectProblem(response, notFound)
        expect(response.body.detail).toContain('Salon')
      })

      it('looks for the product before it compares the levels', async () => {
        const response = await update(UNKNOWN_ID, { reorderPoint: 0 })

        expectProblem(response, notFound)
      })
    })
  })

  describe('DELETE /api/v1/salons/:salonId/products/:id', () => {
    it('marks the product deleted at the time of the database, answers 204 without a body, and leaves every other product', async () => {
      const id = await insertProduct()
      const other = await insertProduct()
      const elsewhere = await insertProduct({}, await salon())
      const before = await everything()
      const until = await databaseClock()

      const response = await remove(id)
      const after = await databaseClock()

      expect(response.status).toBe(204)
      expect(response.text).toBe('')
      const row = await stored(id)
      expect(row).toEqual({
        ...before.find(({ id: rowId }) => rowId === id),
        deletedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
      expectBetween(row?.deletedAt, until, after)
      expectBetween(row?.updatedAt, until, after)
      for (const kept of [other, elsewhere]) {
        expect(await stored(kept)).toEqual(
          before.find(({ id: rowId }) => rowId === kept),
        )
      }
    })

    it('leaves a product that is deleted: it is not read, changed, listed or deleted again', async () => {
      const id = await insertProduct()
      await remove(id)

      expectProblem(await read(id), notFound)
      expectProblem(await update(id, { isActive: false }), notFound)
      expectProblem(await remove(id), notFound)
      expect((await list()).body).toMatchObject({
        data: [],
        meta: { total: 0 },
      })
    })

    it('frees the code of the product for another product of the salon', async () => {
      const id = await insertProduct({ productCode: 'SHMP001' })
      await remove(id)

      const response = await create()

      expect(response.status).toBe(201)
      expect(response.body.data.id).not.toBe(id)
    })

    it('deletes a product that is not active', async () => {
      const id = await insertProduct({ isActive: false })

      expect((await remove(id)).status).toBe(204)
    })

    it('does not delete a product that has a stock record, even one of no stock', async () => {
      const id = await insertProduct()
      await insertStock(id)
      const before = await stored(id)

      const response = await remove(id)

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(IN_STOCK)
      expect(await stored(id)).toEqual(before)
    })

    it('looks only at the stock of the product itself', async () => {
      const id = await insertProduct()
      await insertStock(await insertProduct())

      expect((await remove(id)).status).toBe(204)
    })

    it('deletes a product once its stock records are gone', async () => {
      const id = await insertProduct()
      const stockId = await insertStock(id)
      expectProblem(await remove(id), notAllowed)
      await db.delete(inventory).where(eq(inventory.id, stockId))

      expect((await remove(id)).status).toBe(204)
    })

    it('lets a product that has stock be set to not active instead', async () => {
      const id = await insertProduct()
      await insertStock(id)

      const response = await update(id, { isActive: false })

      expect(response.status).toBe(200)
      expect((await list({ isActive: true })).body.data).toEqual([])
    })

    it.each([
      ['does not exist', async () => UNKNOWN_ID],
      ['is of another salon', async () => insertProduct({}, await salon())],
    ])(
      'answers 404 for a product that %s, and deletes nothing',
      async (_case, idOf) => {
        await insertProduct()
        const id = await idOf()
        const before = await everything()

        const response = await remove(id)

        expectProblem(response, notFound)
        expect(response.body.detail).toContain('Product')
        expect(await everything()).toEqual(before)
      },
    )

    it('answers 404, of the salon, for a product of a salon that is deleted, and deletes nothing', async () => {
      const gone = await salon(deleted)
      const id = await insertProduct({}, gone)

      const response = await remove(id, asAdmin, gone)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Salon')
      expect((await stored(id))?.deletedAt).toBeNull()
    })

    it.each(malformedIds)('refuses %s as the ID', async (id) => {
      const response = await remove(id)

      expectProblem(response, badRequest)
      expect(response.body.detail).toBe(INVALID_ID)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('looks at the ID before it looks for the salon, and for the salon before the product', async () => {
      expectProblem(await remove('latest', asAdmin, UNKNOWN_ID), badRequest)
      const response = await remove(UNKNOWN_ID, asAdmin, UNKNOWN_ID)

      expectProblem(response, notFound)
      expect(response.body.detail).toContain('Salon')
    })

    it('says that the product is not there before it says that it has stock', async () => {
      const otherSalon = await salon()
      const id = await insertProduct()
      await insertStock(id)

      const response = await remove(id, asAdmin, otherSalon)

      expectProblem(response, notFound)
    })
  })

  describe('who reads and who keeps the products of a salon', () => {
    it.each(readers)('lets %s list and read them', async (_who, signInAs) => {
      const id = await insertProduct()
      const as = await signInAs()

      const listed = await list({}, as)
      const one = await read(id, as)

      expect(listed.status).toBe(200)
      expect(listed.body.data).toHaveLength(1)
      expect(one.status).toBe(200)
      expect(one.body.data).toEqual(listed.body.data[0])
    })

    it.each(keepers)(
      'lets %s add, change and delete one',
      async (_who, signInAs) => {
        const as = await signInAs()

        const added = await create(product(), as)
        const changed = await update(
          added.body.data.id,
          { isActive: false },
          as,
        )
        const removed = await remove(added.body.data.id, as)

        expect([added.status, changed.status, removed.status]).toEqual([
          201, 200, 204,
        ])
        expect(await stored(added.body.data.id)).toMatchObject({
          isActive: false,
          deletedAt: expect.any(String),
        })
      },
    )

    it.each(strangers)('refuses %s every operation', async (_who, signInAs) => {
      const id = await insertProduct()
      const before = await everything()
      const as = await signInAs()

      for (const [, call] of operations) {
        expectProblem(await call(as, id), forbidden)
      }
      expect(await everything()).toEqual(before)
    })

    it('lets a staff member of the salon read and refuses them every change, before anything of the request is looked at', async () => {
      const id = await insertProduct()
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
      'refuses %s a change of a product that is not there as well: nothing tells them what is there',
      async (_who, signInAs) => {
        const as = await signInAs()

        expectProblem(
          await update(UNKNOWN_ID, { isActive: false }, as),
          forbidden,
        )
        expectProblem(await remove(UNKNOWN_ID, as), forbidden)
      },
    )

    it('refuses the members of a salon the products of another salon, whether that salon exists or not', async () => {
      const otherSalon = await salon()
      const id = await insertProduct({}, otherSalon)

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
          expectProblem(await create(product(), as, ofSalon), forbidden)
          expectProblem(
            await update(id, { isActive: false }, as, ofSalon),
            forbidden,
          )
          expectProblem(await remove(id, as, ofSalon), forbidden)
        }
      }
      expect(await stored(id)).toMatchObject({
        isActive: true,
        deletedAt: null,
      })
    })

    it('does not show the owner of a salon a product of another salon under their own', async () => {
      const id = await insertProduct({}, await salon())
      const as = await member('owner')()

      expectProblem(await read(id, as), notFound)
      expectProblem(await update(id, { isActive: false }, as), notFound)
      expectProblem(await remove(id, as), notFound)
      expect(await stored(id)).toMatchObject({
        isActive: true,
        deletedAt: null,
      })
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
          const id = await insertProduct()
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
      ['PUT on a product', 'put', '/ID'],
      ['POST on a product', 'post', '/ID'],
      ['PATCH on the list', 'patch', ''],
      ['PUT on the list', 'put', ''],
      ['DELETE on the list', 'delete', ''],
      ['GET below a product', 'get', '/ID/stock'],
      ['POST below a product', 'post', '/ID/restore'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertProduct()
        const before = await everything()

        const response = await request(app)
          [method](`${pathOf()}${suffix.replace('ID', id)}`)
          .set('Authorization', asAdmin)
          .send(product())

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )

    it('has no list of the products of every salon', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', asAdmin)

      expectProblem(response, routeNotFound)
    })
  })

  describe('requests at the same moment', () => {
    /** Holds a product as a change of it does. */
    const hold = (tx: Transaction, id: string) =>
      tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, id))
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

    it('holds a maximum that waited for a change of the minimum to that minimum', async () => {
      const id = await insertProduct()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await tx
            .update(products)
            .set({ minimumStock: '20' })
            .where(eq(products.id, id))
          const underWay = update(id, { maximumStock: 15 }).then(
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
        issue('maximumStock', 'custom', BELOW_THE_MINIMUM),
      ])
      expect(await stored(id)).toMatchObject({
        minimumStock: '20.00',
        maximumStock: null,
      })
    })

    it('holds a minimum that waited for a change of the reorder point to that reorder point', async () => {
      const id = await insertProduct()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(products)
          .set({ reorderPoint: '10' })
          .where(eq(products.id, id))
        const underWay = update(id, { minimumStock: 20 }).then(
          (response) => response,
        )
        await pause(300)

        return { pending: underWay }
      })
      const response = await pending

      expectProblem(response, badRequest)
      expect(response.body.errors).toEqual([
        issue('minimumStock', 'custom', ABOVE_THE_REORDER_POINT),
      ])
      expect(await stored(id)).toMatchObject({
        minimumStock: '0.00',
        reorderPoint: '10.00',
      })
    })

    it('takes a level that waited for a change that was not written after all', async () => {
      const id = await insertProduct()
      let pending: Promise<Response> | undefined

      await db
        .transaction(async (tx) => {
          await tx
            .update(products)
            .set({ minimumStock: '20' })
            .where(eq(products.id, id))
          pending = update(id, { maximumStock: 15 }).then(
            (response) => response,
          )
          await pause(300)
          tx.rollback()
        })
        .catch(() => undefined)
      const response = await pending

      expect(response?.status).toBe(200)
      expect(await stored(id)).toMatchObject({
        minimumStock: '0.00',
        maximumStock: '15.00',
      })
    })

    it('never leaves the levels out of order, whichever of two changes comes first', async () => {
      const id = await insertProduct()

      for (let round = 0; round < 5; round += 1) {
        await update(id, {
          minimumStock: 0,
          reorderPoint: null,
          maximumStock: null,
        })

        const responses = await Promise.all([
          update(id, { minimumStock: 20 }),
          update(id, { maximumStock: 15 }),
        ])

        expect(responses.map(statusAndCode).toSorted()).toEqual([
          '200',
          '400 2001',
        ])
        const row = await stored(id)
        expect([
          { minimumStock: '20.00', maximumStock: null },
          { minimumStock: '0.00', maximumStock: '15.00' },
        ]).toContainEqual({
          minimumStock: row?.minimumStock,
          maximumStock: row?.maximumStock,
        })
      }
    })

    it('writes every one of several changes of one product', async () => {
      const id = await insertProduct()

      const responses = await Promise.all([
        update(id, { name: 'シャンプー 1000ml' }),
        update(id, { retailPrice: 4000 }),
        update(id, { minimumStock: 3 }),
        update(id, { supplier: 'Tokyo Beauty Supply' }),
        update(id, { isForSale: true }),
        update(id, { reorderPoint: 8 }),
      ])

      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200, 200, 200, 200,
      ])
      expect(await stored(id)).toMatchObject({
        name: 'シャンプー 1000ml',
        retailPrice: 4000,
        minimumStock: '3.00',
        supplier: 'Tokyo Beauty Supply',
        isForSale: true,
        reorderPoint: '8.00',
      })
    })

    it('writes the time of a change that waited as the time after the wait', async () => {
      const id = await insertProduct()

      const { pending, until } = await db.transaction(async (tx) => {
        await hold(tx, id)
        const underWay = update(id, { retailPrice: 4000 }).then(
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

    it('makes a product whose code is being written for another product wait, and meet it', async () => {
      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await insertProduct({ productCode: 'SHMP001' }, salonId, tx)
          const underWay = create().then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectProblem(response, alreadyExists)
      expect(response.body.detail).toBe(codeTaken('SHMP001'))
      expect(await everything()).toHaveLength(1)
    })

    it('adds a product once the code that was being written for another product was not written after all', async () => {
      let pending: Promise<Response> | undefined

      await db
        .transaction(async (tx) => {
          await insertProduct({ productCode: 'SHMP001' }, salonId, tx)
          pending = create().then((response) => response)
          await pause(300)
          tx.rollback()
        })
        .catch(() => undefined)
      const response = await pending

      expect(response?.status).toBe(201)
      expect(await everything()).toHaveLength(1)
    })

    it('gives a code to one product of several that are added with it at the same moment', async () => {
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => create()),
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

    it('gives a code to one of two products that are changed to it at the same moment', async () => {
      const first = await insertProduct()
      const second = await insertProduct()

      const responses = await Promise.all([
        update(first, { productCode: 'SHMP001' }),
        update(second, { productCode: 'SHMP001' }),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3002',
      ])
      expect(
        (await everything()).filter(
          ({ productCode }) => productCode === 'SHMP001',
        ),
      ).toHaveLength(1)
    })

    it('adds several products of different codes at the same moment', async () => {
      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, index) =>
          create(product({ productCode: `SHMP00${index}` })),
        ),
      )

      expect(responses.map((response) => response.status)).toEqual([
        201, 201, 201, 201, 201, 201,
      ])
      expect(await everything()).toHaveLength(6)
    })

    it('holds neither the salon nor another product for a change or a delete', async () => {
      const toChange = await insertProduct()
      const toRemove = await insertProduct()
      const other = await insertProduct()

      const responses = await db.transaction(async (tx) => {
        await tx
          .select({ id: salons.id })
          .from(salons)
          .where(eq(salons.id, salonId))
          .for('update')
        await hold(tx, other)

        return [
          await unlessItWaits(update(toChange, { retailPrice: 4000 })),
          await unlessItWaits(remove(toRemove)),
        ]
      })

      expect(responses.map((response) => response?.status)).toEqual([200, 204])
    })

    it('makes a delete wait for stock that is being written for the product, and meet it', async () => {
      const id = await insertProduct()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await insertStock(id, tx)
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
      expect((await stored(id))?.deletedAt).toBeNull()
    })

    it('deletes a product once stock that was being written for it was not written after all', async () => {
      const id = await insertProduct()
      let pending: Promise<Response> | undefined

      await db
        .transaction(async (tx) => {
          await insertStock(id, tx)
          pending = remove(id).then((response) => response)
          await pause(300)
          tx.rollback()
        })
        .catch(() => undefined)
      const response = await pending

      expect(response?.status).toBe(204)
      expect((await stored(id))?.deletedAt).not.toBeNull()
    })

    it('makes a delete wait for a change of the product', async () => {
      const id = await insertProduct()

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

    it('deletes a product once for several deletes', async () => {
      const id = await insertProduct()

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

    it('answers a change that waited for a delete with 404, and writes nothing', async () => {
      const id = await insertProduct()

      const { pending } = await db.transaction(async (tx) => {
        await tx
          .update(products)
          .set({ deletedAt: '2026-11-17T03:00:00.000Z' })
          .where(eq(products.id, id))
        const underWay = update(id, { retailPrice: 4000 }).then(
          (response) => response,
        )
        await pause(300)

        return { pending: underWay }
      })

      expectProblem(await pending, notFound)
      expect((await stored(id))?.retailPrice).toBeNull()
    })

    it('reads and lists a product while it is held', async () => {
      const id = await insertProduct()

      const responses = await db.transaction(async (tx) => {
        await hold(tx, id)

        return [await unlessItWaits(read(id)), await unlessItWaits(list())]
      })

      expect(responses.map((response) => response?.status)).toEqual([200, 200])
    })
  })

  describe('ProductRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new ProductRepository(db)
    const ofSalon = (id: string = salonId) => salonIdSchema.parse(id)
    const idOf = (id: string) => productIdSchema.parse(id)

    /** A product as the use case hands it on. */
    const newProduct = (): DbNewProduct => ({
      productCode: 'TRT-01',
      name: 'トリートメント',
      description: null,
      category: 'Hair Care',
      brand: null,
      purchasePrice: 900,
      retailPrice: null,
      salonPrice: null,
      unit: '本',
      minimumStock: '2',
      maximumStock: null,
      reorderPoint: '4.5',
      supplier: null,
      supplierProductCode: null,
      leadTimeDays: null,
      imageUrl: null,
      barcode: null,
      isForSale: false,
      isForTreatment: true,
      requiresLotTracking: false,
      expiryMonths: null,
      storageConditions: null,
      safetyDataSheet: null,
      isActive: true,
    })

    /** The criteria of a list without filters. */
    const unfiltered = () => ({
      salonId: ofSalon(),
      limit: 20,
      after: null,
      keyword: null,
      category: null,
      barcode: null,
      isActive: null,
      isForSale: null,
      isForTreatment: null,
    })

    /** What every method resolves to when the database does not answer. */
    const unanswered = async (
      call: (
        repositoryOf: ProductRepository,
      ) => Promise<Result<unknown, DomainError>>,
    ): Promise<Result<unknown, DomainError>> => {
      const connection = connectUnreachableDatabase()
      const result = await call(new ProductRepository(connection.database))
      await connection.close()
      return result
    }

    it('creates a product in the salon it is given and returns the row', async () => {
      const created = dataOf(await repository().create(ofSalon(), newProduct()))

      expect(created).toEqual({
        ...newProduct(),
        id: expect.stringMatching(UUID),
        salonId,
        minimumStock: '2.00',
        reorderPoint: '4.50',
        deletedAt: null,
        createdAt: expect.any(String),
        updatedAt: created.createdAt,
      })
      expect(await stored(created.id)).toEqual(created)
    })

    it('answers a code that a product of the salon has as already there, and one of a product of another salon as free', async () => {
      await insertProduct({ productCode: 'TRT-01' })

      const taken = await repository().create(ofSalon(), newProduct())
      const elsewhere = await repository().create(
        ofSalon(await salon()),
        newProduct(),
      )

      expect(taken).toEqual({
        type: 'error',
        error: {
          type: 'alreadyExists',
          entity: entityMessages.product,
          field: 'productCode',
          value: 'TRT-01',
        },
      })
      expect(elsewhere.type).toBe('success')
    })

    it('finds a product of the salon, and none of another salon or that is deleted', async () => {
      const id = await insertProduct()
      const gone = await insertProduct(deleted)

      const found = dataOf(await repository().findById(ofSalon(), idOf(id)))
      const elsewhere = dataOf(
        await repository().findById(ofSalon(await salon()), idOf(id)),
      )
      const deletedOne = dataOf(
        await repository().findById(ofSalon(), idOf(gone)),
      )

      expect(found).toEqual(await stored(id))
      expect(elsewhere).toBeNull()
      expect(deletedOne).toBeNull()
    })

    it('lists a page with how many match and whether more follow, and null for a cursor of another salon or of a deleted product', async () => {
      const first = await insertProduct({ productCode: 'A' })
      const second = await insertProduct({ productCode: 'B' })
      await insertProduct({ productCode: 'C', isActive: false })
      const gone = await insertProduct({ productCode: 'D', ...deleted })
      const elsewhere = await insertProduct({}, await salon())
      const criteria = { ...unfiltered(), limit: 1, isActive: true }

      const page = dataOf(await repository().list(criteria))
      const next = dataOf(
        await repository().list({ ...criteria, after: idOf(first) }),
      )
      const lost = dataOf(
        await repository().list({ ...criteria, after: idOf(elsewhere) }),
      )
      const afterDeleted = dataOf(
        await repository().list({ ...criteria, after: idOf(gone) }),
      )

      expect(page).toMatchObject({
        products: [{ id: first }],
        total: 2,
        hasMore: true,
      })
      expect(next).toMatchObject({
        products: [{ id: second }],
        total: 2,
        hasMore: false,
      })
      expect(lost).toBeNull()
      expect(afterDeleted).toBeNull()
    })

    it('updates a product of the salon, and says of one of another salon that it is not found', async () => {
      const id = await insertProduct()

      const updated = dataOf(
        await repository().update(ofSalon(), idOf(id), { minimumStock: '1.5' }),
      )
      const elsewhere = dataOf(
        await repository().update(ofSalon(await salon()), idOf(id), {
          minimumStock: '9',
        }),
      )

      expect(updated).toMatchObject({
        type: 'updated',
        product: { id, minimumStock: '1.50' },
      })
      expect(elsewhere).toEqual({ type: 'notFound' })
      expect((await stored(id))?.minimumStock).toBe('1.50')
    })

    it('does not write levels that would be out of order, and says which orders they break', async () => {
      const id = await insertProduct({
        minimumStock: '5',
        reorderPoint: '10',
      })

      const outcome = dataOf(
        await repository().update(ofSalon(), idOf(id), {
          maximumStock: '4',
          name: '別の名前',
        }),
      )

      expect(outcome).toEqual({
        type: 'stockLevelsOutOfOrder',
        broken: [
          ['minimumStock', 'maximumStock'],
          ['reorderPoint', 'maximumStock'],
        ],
      })
      expect(await stored(id)).toMatchObject({
        maximumStock: null,
        name: 'シャンプー',
      })
    })

    it('answers a code that another product of the salon has as already there when it updates', async () => {
      await insertProduct({ productCode: 'TAKEN' })
      const id = await insertProduct()

      const result = await repository().update(ofSalon(), idOf(id), {
        productCode: 'TAKEN',
      })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'alreadyExists', value: 'TAKEN' },
      })
    })

    it('deletes a product of the salon, not one of another salon and not one that has stock', async () => {
      const free = await insertProduct()
      const stocked = await insertProduct()
      await insertStock(stocked)

      const elsewhere = dataOf(
        await repository().delete(ofSalon(await salon()), idOf(free)),
      )
      const inStock = dataOf(
        await repository().delete(ofSalon(), idOf(stocked)),
      )
      const removed = dataOf(await repository().delete(ofSalon(), idOf(free)))
      const again = dataOf(await repository().delete(ofSalon(), idOf(free)))

      expect(elsewhere).toEqual({ type: 'notFound' })
      expect(inStock).toEqual({ type: 'inStock' })
      expect(removed).toEqual({ type: 'deleted' })
      expect(again).toEqual({ type: 'notFound' })
      expect((await stored(free))?.deletedAt).not.toBeNull()
      expect((await stored(stocked))?.deletedAt).toBeNull()
    })

    it.each([
      [
        'create',
        'Failed to create product',
        (repositoryOf: ProductRepository) =>
          repositoryOf.create(ofSalon(), newProduct()),
      ],
      [
        'findById',
        'Failed to find product',
        (repositoryOf: ProductRepository) =>
          repositoryOf.findById(ofSalon(), idOf(UNKNOWN_ID)),
      ],
      [
        'list',
        'Failed to list products',
        (repositoryOf: ProductRepository) => repositoryOf.list(unfiltered()),
      ],
      [
        'update',
        'Failed to update product',
        (repositoryOf: ProductRepository) =>
          repositoryOf.update(ofSalon(), idOf(UNKNOWN_ID), {
            productCode: 'X',
          }),
      ],
      [
        'delete',
        'Failed to delete product',
        (repositoryOf: ProductRepository) =>
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

  describe('what the database holds a product to', () => {
    /** What a write that the database refuses failed of. */
    const failureOf = (write: Promise<unknown>): Promise<unknown> =>
      write.then(
        () => null,
        (error: unknown) => error,
      )

    it.each([
      [
        'a negative purchase price',
        { purchasePrice: -1 },
        'products_prices_not_negative',
      ],
      [
        'a negative price for customers',
        { retailPrice: -1 },
        'products_prices_not_negative',
      ],
      [
        'a negative price for the salon',
        { salonPrice: -1 },
        'products_prices_not_negative',
      ],
      [
        'a negative minimum',
        { minimumStock: '-0.01' },
        'products_stock_levels',
      ],
      [
        'a reorder point below the minimum',
        { minimumStock: '5', reorderPoint: '4.99' },
        'products_stock_levels',
      ],
      [
        'a maximum below the minimum',
        { minimumStock: '5', maximumStock: '4' },
        'products_stock_levels',
      ],
      [
        'a maximum below the reorder point',
        { reorderPoint: '10', maximumStock: '9' },
        'products_stock_levels',
      ],
      [
        'a negative lead time',
        { leadTimeDays: -1 },
        'products_lead_time_not_negative',
      ],
      [
        'no months to expiry',
        { expiryMonths: 0 },
        'products_expiry_months_positive',
      ],
    ])('refuses %s', async (_case, overrides, constraint) => {
      const failure = await failureOf(insertProduct(overrides))

      expect(failure).toMatchObject({
        cause: { code: '23514', constraint_name: constraint },
      })
      expect(await everything()).toEqual([])
    })

    it('refuses a code that a product of the salon that is not deleted has', async () => {
      await insertProduct({ productCode: 'SHMP001' })

      const failure = await failureOf(insertProduct({ productCode: 'SHMP001' }))

      expect(failure).toMatchObject({
        cause: { code: '23505', constraint_name: 'products_code_salon_unique' },
      })
    })

    it('refuses a product without a minimum', async () => {
      const failure = await failureOf(
        getTestDbClient()`
          INSERT INTO products ("salonId", "productCode", name, unit, "minimumStock")
          VALUES (${salonId}, 'NULL-MIN', 'シャンプー', '本', NULL)
        `,
      )

      expect(failure).toMatchObject({
        code: '23502',
        column_name: 'minimumStock',
      })
    })

    it.each([
      [
        'prices, a lead time and levels of 0',
        [
          {
            purchasePrice: 0,
            retailPrice: 0,
            salonPrice: 0,
            leadTimeDays: 0,
            minimumStock: '0',
            reorderPoint: '0',
            maximumStock: '0',
          },
        ],
      ],
      [
        'equal levels, and levels that are not set',
        [
          { minimumStock: '5', reorderPoint: '5', maximumStock: '5' },
          { minimumStock: '5', reorderPoint: null, maximumStock: '5' },
          { minimumStock: '5', reorderPoint: '99', maximumStock: null },
        ],
      ],
      ['a month to expiry', [{ expiryMonths: 1 }]],
    ])('takes %s', async (_case, rowsOf) => {
      for (const overrides of rowsOf) {
        await insertProduct(overrides)
      }

      expect(await everything()).toHaveLength(rowsOf.length)
    })

    it('takes one code in two salons, and the code of a product that is deleted', async () => {
      await insertProduct({ productCode: 'SHMP001', ...deleted })
      await insertProduct({ productCode: 'SHMP001' })
      await insertProduct({ productCode: 'SHMP001' }, await salon())

      expect(await everything()).toHaveLength(3)
    })

    it('has a minimum of 0 for a product whose minimum is not written', async () => {
      const id = await insertProduct()

      expect((await stored(id))?.minimumStock).toBe('0.00')
    })
  })
})
