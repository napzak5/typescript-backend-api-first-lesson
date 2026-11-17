import {
  inventory,
  products,
  purchaseOrderItems,
  purchaseOrders,
} from '@beauty-salon-backend/database'
import {
  type DomainError,
  inventoryIdSchema,
  type LedgerReach,
  type PurchaseOrderCreateCriteria,
  purchaseOrderIdSchema,
  salonIdSchema,
} from '@beauty-salon-backend/domain'
import { PurchaseOrderRepository } from '@beauty-salon-backend/infrastructure'
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

const INVALID_ORDER = 'Invalid purchase order'
const INVALID_SEARCH = 'Invalid purchase order search'
const INVALID_CANCELLATION = 'Invalid purchase order cancellation'
const INVALID_ID = 'Invalid purchase order ID'
const NO_SUCH_ROW = 'Must name a stock row of the salon'
const NO_SUCH_SALON = 'Must name a salon'
const NO_SUCH_CURSOR = 'Must name a purchase order of the list'
const CLOSED = 'a delivered or cancelled order does not change'
const UPDATE_STEPS =
  'an update moves a draft to pending, an approved order to ordered and an ordered one to shipped'
const ONLY_PENDING = 'only a pending order is approved'

const ORDER_NUMBER = /^PO-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/

/** The properties of a PurchaseOrderResponse. */
const ORDER_PROPERTIES = [
  'actualDelivery',
  'approvedAt',
  'approvedBy',
  'cancellationReason',
  'cancelledAt',
  'createdAt',
  'createdBy',
  'deliveryNotes',
  'expectedDelivery',
  'id',
  'items',
  'notes',
  'orderDate',
  'orderNumber',
  'paymentTerms',
  'salonId',
  'shippingCost',
  'status',
  'subtotal',
  'supplier',
  'taxAmount',
  'totalAmount',
  'updatedAt',
]

/** The properties of a PurchaseOrderItem. */
const ITEM_PROPERTIES = [
  'inventoryId',
  'notes',
  'productCode',
  'productName',
  'quantity',
  'totalPrice',
  'unit',
  'unitPrice',
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

/** Checks a conflict with where the order stands. */
const expectConflict = (response: Response, detail: string): void => {
  expectProblem(response, notAllowed)
  expect(response.body.detail).toBe(detail)
}

const statusAndCode = (response: Response): string =>
  response.status < 400
    ? String(response.status)
    : `${response.status} ${response.body.code}`

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('Purchase order API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** Two products of the salon: a shampoo and a colour. */
  let shampooId: string
  let colourId: string

  type NewOrder = typeof purchaseOrders.$inferInsert
  type OrderStatus = NonNullable<NewOrder['status']>
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  const insertProduct = async (
    overrides: Partial<typeof products.$inferInsert> = {},
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

  /** A stock row of the shampoo of the salon, with a lot of its own, unless the overrides say otherwise. */
  const insertStock = async (
    overrides: Partial<typeof inventory.$inferInsert> = {},
  ): Promise<string> => {
    const [row] = await db
      .insert(inventory)
      .values({
        salonId,
        productId: shampooId,
        lotNumber: `LOT-${nextRow()}`,
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

  /**
   * An order of the salon written directly in the status, with one item,
   * and with what the constraints of the status ask for.
   */
  const insertOrder = async (
    status: OrderStatus = 'draft',
    overrides: Partial<NewOrder> = {},
  ): Promise<string> => {
    const now = new Date().toISOString()
    const approved = ['approved', 'ordered', 'shipped', 'delivered'].includes(
      status,
    )
    const [order] = await db
      .insert(purchaseOrders)
      .values({
        salonId,
        orderNumber: `PO-TEST-${nextRow()}`,
        supplier: 'Beauty Supply Tokyo',
        status,
        subtotal: 1500,
        taxAmount: 150,
        shippingCost: null,
        totalAmount: 1650,
        approvedAt: approved ? now : null,
        cancelledAt: status === 'cancelled' ? now : null,
        cancellationReason: status === 'cancelled' ? '取りやめ' : null,
        actualDelivery: status === 'delivered' ? now : null,
        ...overrides,
      })
      .returning({ id: purchaseOrders.id, salonId: purchaseOrders.salonId })
    if (order === undefined) {
      throw new Error('No order was inserted')
    }
    await db.insert(purchaseOrderItems).values({
      purchaseOrderId: order.id,
      inventoryId: await insertStock({ salonId: order.salonId }),
      productCode: 'P',
      productName: 'シャンプー',
      quantity: '1.00',
      unit: '本',
      unitPrice: 1500,
      totalPrice: 1500,
      sortOrder: 0,
    })
    return order.id
  }

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db)
    shampooId = await insertProduct({
      productCode: 'SHMP001',
      name: 'Moisture Shampoo 500ml',
      unit: 'bottle',
    })
    colourId = await insertProduct({
      productCode: 'COL001',
      name: 'Color Cream 1L',
      unit: 'litre',
    })
  })

  const PATH = '/api/v1/purchase-orders'

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** An item of a stock row: one of it at 1,000 yen, without notes. */
  const itemOf = (
    inventoryId: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    inventoryId,
    quantity: 1,
    unitPrice: 1000,
    notes: null,
    ...overrides,
  })

  /** An order of the salon of the tests of the items, with nothing else set. */
  const orderOf = (
    items: object[],
    overrides: Record<string, unknown> = {},
  ) => ({
    salonId,
    supplier: 'Beauty Supply Tokyo',
    items,
    taxAmount: 0,
    shippingCost: null,
    expectedDelivery: null,
    paymentTerms: null,
    notes: null,
    ...overrides,
  })

  const create = (body: object, as: string | null = asAdmin): Test =>
    authorized(request(app).post(PATH), as).send(body)

  const get = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).get(`${PATH}/${id}`), as)

  const list = (
    query: Record<string, unknown> = {},
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(PATH).query(query), as)

  const update = (
    id: string,
    body: object,
    as: string | null = asAdmin,
  ): Test => authorized(request(app).patch(`${PATH}/${id}`), as).send(body)

  const approve = (id: string, as: string | null = asAdmin): Test =>
    authorized(request(app).post(`${PATH}/${id}/approve`), as)

  const cancel = (
    id: string,
    body: object = { cancellationReason: '仕入先の在庫切れ' },
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).post(`${PATH}/${id}/cancel`), as).send(body)

  /** The order as stored, or undefined when there is none. */
  const storedOrder = async (id: string) => {
    const [row] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
    return row
  }

  /** Every order and every item, to tell that nothing was written. */
  const everything = async () => ({
    orders: await db
      .select()
      .from(purchaseOrders)
      .orderBy(asc(purchaseOrders.id)),
    items: await db
      .select()
      .from(purchaseOrderItems)
      .orderBy(asc(purchaseOrderItems.id)),
  })

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

  /** A member of the salon of the tests, with the staff record they act as. */
  const signedInMember = async (
    role: 'owner' | 'manager' | 'staff',
  ): Promise<{ authorization: string; staffId: string }> => {
    const { email, staffId } = await insertMember(db, role, salonId)
    return { authorization: (await signIn(app, email)).authorization, staffId }
  }

  /** Everyone who orders for the salon of the tests. */
  const orderers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Accounts that reach no orders at all. */
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

  /** Every operation, as a request that would succeed for an administrator. */
  const operations: ((as: string | null, id: string) => Promise<Response>)[] = [
    async (as) => list({}, as),
    async (as, id) => get(id, as),
    async (as) => create(orderOf([itemOf(await insertStock())]), as),
    async (as, id) => update(id, { status: 'pending' }, as),
    async (as, id) => approve(id, as),
    async (as, id) => cancel(id, undefined, as),
  ]

  describe('POST /api/v1/purchase-orders', () => {
    it('drafts the order under a number, copies the products of the stock rows into the items in the order of the request, works out the amounts, and answers 201 as the contract has it', async () => {
      const colour = await insertStock({ productId: colourId })
      const shampoo = await insertStock()

      const response = await create(
        orderOf(
          [
            itemOf(shampoo, { quantity: 10, unitPrice: 1500 }),
            itemOf(colour, { quantity: 2.5, unitPrice: 2999, notes: '至急' }),
          ],
          {
            taxAmount: 2250,
            shippingCost: 800,
            expectedDelivery: '2026-11-21T01:00:00Z',
            paymentTerms: '月末締め翌月末払い',
            notes: '定期補充',
          },
        ),
      )

      expect(response.status).toBe(201)
      const { data } = response.body
      expect(Object.keys(data).toSorted()).toEqual(ORDER_PROPERTIES)
      expect(Object.keys(data.items[0]).toSorted()).toEqual(ITEM_PROPERTIES)
      expect(response.body).toEqual({
        data: {
          id: expect.stringMatching(UUID),
          salonId,
          orderNumber: expect.stringMatching(ORDER_NUMBER),
          supplier: 'Beauty Supply Tokyo',
          status: 'draft',
          items: [
            {
              inventoryId: shampoo,
              productCode: 'SHMP001',
              productName: 'Moisture Shampoo 500ml',
              quantity: 10,
              unit: 'bottle',
              unitPrice: 1500,
              totalPrice: 15000,
              notes: null,
            },
            {
              inventoryId: colour,
              productCode: 'COL001',
              productName: 'Color Cream 1L',
              quantity: 2.5,
              unit: 'litre',
              unitPrice: 2999,
              // 2.5 × 2999 = 7497.5, rounded half up.
              totalPrice: 7498,
              notes: '至急',
            },
          ],
          subtotal: 22498,
          taxAmount: 2250,
          shippingCost: 800,
          totalAmount: 25548,
          orderDate: expect.stringMatching(ISO_TIMESTAMP),
          expectedDelivery: '2026-11-21T01:00:00.000Z',
          actualDelivery: null,
          deliveryNotes: null,
          paymentTerms: '月末締め翌月末払い',
          notes: '定期補充',
          approvedBy: null,
          approvedAt: null,
          cancelledAt: null,
          cancellationReason: null,
          createdBy: null,
          createdAt: data.orderDate,
          updatedAt: data.orderDate,
        },
        meta: expect.objectContaining({ timestamp: expect.any(String) }),
        links: { self: `${PATH}/${data.id}`, list: PATH },
      })
      expect(response.headers['location']).toBe(`${PATH}/${data.id}`)
      expect((await get(data.id)).body.data).toEqual(data)
    })

    it.each<['owner' | 'manager' | 'staff']>([
      ['owner'],
      ['manager'],
      ['staff'],
    ])(
      'drafts an order of the salon for its %s, as the staff member they are',
      async (role) => {
        const { authorization, staffId } = await signedInMember(role)

        const response = await create(
          orderOf([itemOf(await insertStock())]),
          authorization,
        )

        expect(response.status).toBe(201)
        expect(response.body.data.createdBy).toBe(staffId)
      },
    )

    it('keeps what was ordered as it was when the product changes, and the order without the stock row once it is removed', async () => {
      const id = await insertStock()
      const created = await create(orderOf([itemOf(id, { quantity: 3 })]))
      await db
        .update(products)
        .set({ name: '新しい名前', productCode: 'SHMP999', unit: '個' })
        .where(eq(products.id, shampooId))
      await db.delete(inventory).where(eq(inventory.id, id))

      const response = await get(created.body.data.id)

      expect(response.body.data.items).toEqual([
        {
          inventoryId: null,
          productCode: 'SHMP001',
          productName: 'Moisture Shampoo 500ml',
          quantity: 3,
          unit: 'bottle',
          unitPrice: 1000,
          totalPrice: 3000,
          notes: null,
        },
      ])
    })

    it('numbers each order with a number of its own', async () => {
      const numbers = new Set<string>()
      for (let n = 0; n < 5; n += 1) {
        const response = await create(orderOf([itemOf(await insertStock())]))
        numbers.add(response.body.data.orderNumber)
      }

      expect(numbers.size).toBe(5)
    })

    it('takes 100 items and amounts up to what an integer holds', async () => {
      const ids = await Promise.all(
        Array.from({ length: 100 }, () => insertStock()),
      )
      const items = ids.map((id) => itemOf(id, { unitPrice: 0 }))
      const last = ids.at(-1) ?? ''
      items[99] = itemOf(last, { unitPrice: 2_147_483_647 })

      const response = await create(orderOf(items))

      expect(response.status).toBe(201)
      expect(response.body.data.items).toHaveLength(100)
      expect(response.body.data.totalAmount).toBe(2_147_483_647)
    })

    it('refuses the items whose stock rows are not of the salon, each of them, and writes nothing', async () => {
      const own = await insertStock()
      const otherSalon = await insertSalon(db)
      const ofOther = await insertStock({ salonId: otherSalon })
      const removed = await insertStock()
      await db.delete(inventory).where(eq(inventory.id, removed))
      const before = await everything()

      const response = await create(
        orderOf([
          itemOf(ofOther),
          itemOf(own),
          itemOf(removed),
          itemOf(UNKNOWN_ID),
        ]),
      )

      expectRefused(response, INVALID_ORDER, [
        issue('items.0.inventoryId', 'not_found', NO_SUCH_ROW),
        issue('items.2.inventoryId', 'not_found', NO_SUCH_ROW),
        issue('items.3.inventoryId', 'not_found', NO_SUCH_ROW),
      ])
      expect(await everything()).toEqual(before)
    })

    it('refuses a salon that is not there as a property of the request', async () => {
      const response = await create(
        orderOf([itemOf(await insertStock())], { salonId: UNKNOWN_ID }),
      )

      expectRefused(response, INVALID_ORDER, [
        issue('salonId', 'not_found', NO_SUCH_SALON),
      ])
    })

    it.each<[string, (id: string) => object, string[]]>([
      [
        'a blank supplier',
        (id) => orderOf([itemOf(id)], { supplier: ' ' }),
        ['supplier:invalid_format'],
      ],
      ['no items', () => orderOf([]), ['items:too_small']],
      [
        'a stock row named twice',
        (id) => orderOf([itemOf(id), itemOf(id.toUpperCase())]),
        ['items.1.inventoryId:custom'],
      ],
      [
        'a quantity of nothing',
        (id) => orderOf([itemOf(id, { quantity: 0 })]),
        ['items.0.quantity:too_small'],
      ],
      [
        'a quantity in thousandths',
        (id) => orderOf([itemOf(id, { quantity: 0.005 })]),
        ['items.0.quantity:not_multiple_of'],
      ],
      [
        'an item that comes to more than an integer',
        (id) =>
          orderOf([itemOf(id, { quantity: 1.5, unitPrice: 1_431_655_765 })]),
        ['items.0.unitPrice:too_big'],
      ],
      [
        'a total above an integer',
        (id) =>
          orderOf([itemOf(id, { unitPrice: 2_147_483_647 })], { taxAmount: 1 }),
        ['items:custom'],
      ],
      [
        'what the server copies of the product',
        (id) => orderOf([itemOf(id, { productName: '名前' })]),
        ['items.0.productName:unrecognized_keys'],
      ],
      [
        'a status',
        (id) => orderOf([itemOf(id)], { status: 'approved' }),
        ['status:unrecognized_keys'],
      ],
      [
        'no tax',
        (id) => ({ ...orderOf([itemOf(id)]), taxAmount: undefined }),
        ['taxAmount:invalid_type'],
      ],
    ])('refuses %s, and writes nothing', async (_case, body, expected) => {
      const id = await insertStock()
      const before = await everything()

      const response = await create(body(id))

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(expected)
      expect(await everything()).toEqual(before)
    })

    it('refuses a member of a salon who orders for another salon, before the salon is looked up', async () => {
      const { authorization } = await signedInMember('staff')

      const response = await create(
        orderOf([itemOf(UNKNOWN_ID)], { salonId: UNKNOWN_ID }),
        authorization,
      )

      expectProblem(response, forbidden)
    })
  })

  describe('GET /api/v1/purchase-orders/:id', () => {
    it.each(orderers)(
      'finds an order of the salon for %s',
      async (_who, signInAs) => {
        const id = await insertOrder('pending')

        const response = await get(id, await signInAs())

        expect(response.status).toBe(200)
        expect(response.body).toMatchObject({
          data: { id, status: 'pending', items: [{ quantity: 1 }] },
          links: { self: `${PATH}/${id}`, list: PATH },
        })
      },
    )

    it('answers 404 for an order of another salon to its members, for one that is not there, and for one whose salon was removed', async () => {
      const otherSalon = await insertSalon(db)
      const ofOther = await insertOrder('draft', { salonId: otherSalon })
      const { authorization } = await signedInMember('owner')

      expectProblem(await get(ofOther, authorization), notFound)
      expectProblem(await get(UNKNOWN_ID), notFound)
      expect((await get(UNKNOWN_ID)).body.detail).toBe(
        `PurchaseOrder ${UNKNOWN_ID} was not found`,
      )
    })

    it('refuses an ID that is no UUID', async () => {
      expectRefused(await get('PO-0000-0000'), INVALID_ID)
    })

    it('takes an ID in upper case', async () => {
      const id = await insertOrder()

      expect((await get(id.toUpperCase())).body.data.id).toBe(id)
    })
  })

  describe('GET /api/v1/purchase-orders', () => {
    it('lists the latest orders first, and pages forwards with a cursor', async () => {
      const first = await insertOrder('draft', {
        orderDate: '2026-11-01T00:00:00.000Z',
      })
      const second = await insertOrder('pending', {
        orderDate: '2026-11-02T00:00:00.000Z',
      })
      const third = await insertOrder('ordered', {
        orderDate: '2026-11-03T00:00:00.000Z',
      })

      const page = await list({ limit: 2 })
      const next = await list({ limit: 2, cursor: page.body.meta.nextCursor })

      expect(page.body.data.map(({ id }: { id: string }) => id)).toEqual([
        third,
        second,
      ])
      expect(page.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: second,
        prevCursor: null,
      })
      expect(page.body.links).toEqual({
        self: `${PATH}?limit=2`,
        first: `${PATH}?limit=2`,
        last: null,
        next: `${PATH}?limit=2&cursor=${second}`,
        prev: null,
      })
      expect(next.body.data.map(({ id }: { id: string }) => id)).toEqual([
        first,
      ])
      expect(next.body.meta).toMatchObject({ hasMore: false, nextCursor: null })
    })

    it('orders the orders of one moment by their IDs, downwards, across pages', async () => {
      const at = '2026-11-01T00:00:00.000Z'
      const ids = (
        await Promise.all(
          Array.from({ length: 3 }, () =>
            insertOrder('draft', { orderDate: at }),
          ),
        )
      ).toSorted()

      const page = await list({ limit: 2 })
      const next = await list({ limit: 2, cursor: page.body.meta.nextCursor })

      expect(
        [...page.body.data, ...next.body.data].map(
          ({ id }: { id: string }) => id,
        ),
      ).toEqual(ids.toReversed())
    })

    it('filters by the salon, the status, the supplier and the dates of the orders, both dates in, to the millisecond', async () => {
      const otherSalon = await insertSalon(db)
      await insertOrder('pending', { salonId: otherSalon })
      const early = await insertOrder('pending', {
        orderDate: '2026-11-01T00:00:00.123456Z',
      })
      const late = await insertOrder('pending', {
        orderDate: '2026-11-02T00:00:00.123Z',
      })
      await insertOrder('draft', { orderDate: '2026-11-01T12:00:00Z' })
      await insertOrder('pending', {
        supplier: 'Another Supplier',
        orderDate: '2026-11-01T12:00:00Z',
      })

      const response = await list({
        salonId,
        status: 'pending',
        supplier: 'Beauty Supply Tokyo',
        startDate: '2026-11-01T00:00:00.123Z',
        endDate: '2026-11-02T00:00:00.123Z',
      })

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        late,
        early,
      ])
      expect(response.body.meta.total).toBe(2)
      expect(
        (
          await list({ startDate: '2026-11-01T00:00:00.124Z', salonId })
        ).body.data.map(({ id }: { id: string }) => id),
      ).not.toContain(early)
    })

    it('lists a member of a salon the orders of the salon only, and refuses one who names another', async () => {
      const otherSalon = await insertSalon(db)
      await insertOrder('draft', { salonId: otherSalon })
      const own = await insertOrder()
      const { authorization } = await signedInMember('staff')

      const response = await list({}, authorization)

      expect(response.body.data.map(({ id }: { id: string }) => id)).toEqual([
        own,
      ])
      expectProblem(
        await list({ salonId: otherSalon }, authorization),
        forbidden,
      )
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      [
        'a cursor that names no order',
        { cursor: UNKNOWN_ID },
        ['cursor:not_found'],
      ],
      ['a limit of none', { limit: 0 }, ['limit:too_small']],
      ['a limit that is no number', { limit: 'all' }, ['limit:invalid_format']],
      [
        'an end before the start',
        { startDate: '2026-11-02T00:00:00Z', endDate: '2026-11-01T00:00:00Z' },
        ['endDate:custom'],
      ],
      [
        'a status that is not one',
        { status: 'lost' },
        ['status:invalid_value'],
      ],
      [
        'a filter it does not know',
        { productId: UNKNOWN_ID },
        ['productId:unrecognized_keys'],
      ],
    ])('refuses %s', async (_case, query, expected) => {
      const response = await list(query)

      expectRefused(response, INVALID_SEARCH)
      expect(brokenRules(response)).toEqual(expected)
    })

    it('refuses a cursor that names an order of another salon to its members', async () => {
      const otherSalon = await insertSalon(db)
      const ofOther = await insertOrder('draft', { salonId: otherSalon })
      const { authorization } = await signedInMember('manager')

      expectRefused(
        await list({ cursor: ofOther }, authorization),
        INVALID_SEARCH,
        [issue('cursor', 'not_found', NO_SUCH_CURSOR)],
      )
    })
  })

  describe('PATCH /api/v1/purchase-orders/:id', () => {
    it.each<[OrderStatus, OrderStatus]>([
      ['draft', 'pending'],
      ['approved', 'ordered'],
      ['ordered', 'shipped'],
    ])('moves an order from %s to %s for a staff member', async (from, to) => {
      const id = await insertOrder(from)
      const before = await storedOrder(id)
      const { authorization } = await signedInMember('staff')

      const response = await update(id, { status: to }, authorization)

      expect(response.status).toBe(200)
      expect(response.body.data.status).toBe(to)
      expect(Date.parse(response.body.data.updatedAt)).toBeGreaterThan(
        Date.parse(String(before?.updatedAt)),
      )
      // A step of the staff leaves the approval as it was.
      expect((await storedOrder(id))?.approvedAt).toBe(before?.approvedAt)
    })

    it('writes the expected delivery and the notes, and takes the status the order has', async () => {
      const id = await insertOrder('ordered')

      const response = await update(id, {
        status: 'ordered',
        expectedDelivery: '2026-11-25T00:00:00Z',
        deliveryNotes: '午前着',
        notes: null,
      })

      expect(response.body.data).toMatchObject({
        status: 'ordered',
        expectedDelivery: '2026-11-25T00:00:00.000Z',
        deliveryNotes: '午前着',
        notes: null,
      })
    })

    it.each<[OrderStatus, OrderStatus]>([
      ['draft', 'approved'],
      ['draft', 'ordered'],
      ['pending', 'approved'],
      ['pending', 'draft'],
      ['approved', 'pending'],
      ['shipped', 'delivered'],
      ['ordered', 'cancelled'],
    ])(
      'refuses to move an order from %s to %s, and changes nothing',
      async (from, to) => {
        const id = await insertOrder(from)
        const before = await everything()

        const response = await update(id, { status: to, notes: 'メモ' })

        expectConflict(
          response,
          `Purchase order ${id} is ${from}: ${UPDATE_STEPS}`,
        )
        expect(await everything()).toEqual(before)
      },
    )

    it.each<[OrderStatus]>([['delivered'], ['cancelled']])(
      'changes nothing of a %s order, not even its notes',
      async (status) => {
        const id = await insertOrder(status)
        const before = await everything()

        const response = await update(id, { notes: 'メモ' })

        expectConflict(response, `Purchase order ${id} is ${status}: ${CLOSED}`)
        expect(await everything()).toEqual(before)
      },
    )

    it.each<[string, object, string[]]>([
      ['nothing', {}, [':custom']],
      [
        'the delivery',
        { actualDelivery: '2026-11-21T00:00:00Z' },
        ['actualDelivery:unrecognized_keys'],
      ],
      ['the items', { items: [] }, ['items:unrecognized_keys']],
      [
        'a status that is not one',
        { status: 'lost' },
        ['status:invalid_value'],
      ],
      [
        'blank delivery notes',
        { deliveryNotes: ' ' },
        ['deliveryNotes:invalid_format'],
      ],
    ])('refuses an update of %s', async (_case, body, expected) => {
      const id = await insertOrder()

      const response = await update(id, body)

      expectRefused(response, INVALID_ORDER)
      expect(brokenRules(response)).toEqual(expected)
    })

    it('answers 404 for an order of another salon to its members, and for one that is not there', async () => {
      const ofOther = await insertOrder('draft', {
        salonId: await insertSalon(db),
      })
      const { authorization } = await signedInMember('staff')

      expectProblem(
        await update(ofOther, { status: 'pending' }, authorization),
        notFound,
      )
      expectProblem(await update(UNKNOWN_ID, { status: 'pending' }), notFound)
    })

    it('refuses an ID that is no UUID before the request', async () => {
      expectRefused(await update('x', {}), INVALID_ID)
    })
  })

  describe('POST /api/v1/purchase-orders/:id/approve', () => {
    it.each<['owner' | 'manager']>([['owner'], ['manager']])(
      'approves a pending order for the %s, as the staff member they are, at the time of the change, and reads no body',
      async (role) => {
        const id = await insertOrder('pending')
        const { authorization, staffId } = await signedInMember(role)

        const response = await approve(id, authorization).send({
          approvedBy: UNKNOWN_ID,
        })

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          status: 'approved',
          approvedBy: staffId,
          approvedAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        expect(response.body.data.approvedAt).toBe(response.body.data.updatedAt)
      },
    )

    it('approves for an administrator by no staff member', async () => {
      const id = await insertOrder('pending')

      const response = await approve(id)

      expect(response.body.data).toMatchObject({
        status: 'approved',
        approvedBy: null,
      })
    })

    it.each<[OrderStatus, string]>([
      ['draft', ONLY_PENDING],
      ['approved', ONLY_PENDING],
      ['shipped', ONLY_PENDING],
      ['delivered', CLOSED],
      ['cancelled', CLOSED],
    ])(
      'refuses to approve a %s order, and changes nothing',
      async (status, why) => {
        const id = await insertOrder(status)
        const before = await everything()

        expectConflict(
          await approve(id),
          `Purchase order ${id} is ${status}: ${why}`,
        )
        expect(await everything()).toEqual(before)
      },
    )

    it('refuses a staff member, who orders but does not approve', async () => {
      const id = await insertOrder('pending')
      const before = await everything()

      expectProblem(await approve(id, await member('staff')()), forbidden)
      expect(await everything()).toEqual(before)
    })

    it('answers 404 for an order of another salon and for one that is not there, and refuses an ID that is no UUID', async () => {
      const ofOther = await insertOrder('pending', {
        salonId: await insertSalon(db),
      })

      expectProblem(await approve(ofOther, await member('owner')()), notFound)
      expectProblem(await approve(UNKNOWN_ID), notFound)
      expectRefused(await approve('x'), INVALID_ID)
    })
  })

  describe('POST /api/v1/purchase-orders/:id/cancel', () => {
    it.each<[OrderStatus]>([
      ['draft'],
      ['pending'],
      ['approved'],
      ['ordered'],
      ['shipped'],
    ])(
      'cancels a %s order for a manager, for the reason, at the time of the change',
      async (status) => {
        const id = await insertOrder(status)

        const response = await cancel(
          id,
          { cancellationReason: '仕入先の在庫切れ' },
          await member('manager')(),
        )

        expect(response.status).toBe(200)
        expect(response.body.data).toMatchObject({
          status: 'cancelled',
          cancellationReason: '仕入先の在庫切れ',
          cancelledAt: expect.stringMatching(ISO_TIMESTAMP),
        })
        expect(response.body.data.cancelledAt).toBe(
          response.body.data.updatedAt,
        )
      },
    )

    it.each<[OrderStatus]>([['delivered'], ['cancelled']])(
      'refuses to cancel a %s order, and changes nothing',
      async (status) => {
        const id = await insertOrder(status)
        const before = await everything()

        expectConflict(
          await cancel(id),
          `Purchase order ${id} is ${status}: ${CLOSED}`,
        )
        expect(await everything()).toEqual(before)
      },
    )

    it.each<[string, object, string[]]>([
      ['no reason', {}, ['cancellationReason:invalid_type']],
      [
        'a blank reason',
        { cancellationReason: ' ' },
        ['cancellationReason:invalid_format'],
      ],
      [
        'the reason by the name it had',
        { reason: '在庫切れ' },
        ['cancellationReason:invalid_type', 'reason:unrecognized_keys'],
      ],
    ])('refuses a cancellation with %s', async (_case, body, expected) => {
      const id = await insertOrder()

      const response = await cancel(id, body)

      expectRefused(response, INVALID_CANCELLATION)
      expect(brokenRules(response)).toEqual(expected)
    })

    it('refuses a staff member, and answers 404 for an order that is not there', async () => {
      const id = await insertOrder()

      expectProblem(
        await cancel(id, undefined, await member('staff')()),
        forbidden,
      )
      expectProblem(await cancel(UNKNOWN_ID), notFound)
    })
  })

  describe('who may', () => {
    it.each(outsiders)(
      'refuses %s every operation, and changes nothing',
      async (_who, signInAs) => {
        const id = await insertOrder('pending')
        const authorization = await signInAs()
        const before = await everything()

        const responses: Response[] = []
        for (const call of operations) {
          responses.push(await call(authorization, id))
        }

        expect(responses.map(statusAndCode)).toEqual(
          Array.from({ length: 6 }, () => '403 1005'),
        )
        expect(await everything()).toEqual(before)
      },
    )

    it.each(unauthenticated)(
      'refuses %s every operation with 401, and changes nothing',
      async (_case, tokenOf, problem, challenge) => {
        const id = await insertOrder('pending')
        const token = await tokenOf()
        const before = await everything()

        for (const call of operations) {
          const response = await call(token, id)
          expectProblem(response, problem)
          expect(response.headers['www-authenticate']).toBe(challenge)
        }
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('what the routes do not serve', () => {
    it.each<[string, 'get' | 'put' | 'patch' | 'delete' | 'post', string]>([
      ['the suggestions of what to order', 'get', '/reorder-suggestions'],
      ['the receipt of the goods', 'post', '/ID/receive'],
      ['PUT on an order', 'put', '/ID'],
      ['DELETE on an order', 'delete', '/ID'],
      ['PATCH on the list', 'patch', ''],
      ['GET on an approval', 'get', '/ID/approve'],
    ])(
      'answers 404 to %s, and changes nothing',
      async (_case, method, suffix) => {
        const id = await insertOrder('shipped')
        const before = await everything()

        const response = await request(app)
          [method](`${PATH}${suffix.replace('ID', id)}`)
          .set('Authorization', asAdmin)
          .send({ status: 'delivered' })

        expectProblem(response, routeNotFound)
        expect(await everything()).toEqual(before)
      },
    )
  })

  describe('requests at the same moment', () => {
    /** Holds a stock row as a removal of it does. */
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

    it('approves an order once when two approvals arrive together', async () => {
      const id = await insertOrder('pending')
      const owner = await member('owner')()

      const responses = await Promise.all([approve(id, owner), approve(id)])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
      ])
    })

    it('takes an approval and a cancellation of one order in turns, the second on what the first left', async () => {
      const id = await insertOrder('pending')

      const [approval, cancellation] = await Promise.all([
        approve(id),
        cancel(id),
      ])
      const order = await storedOrder(id)

      // The cancellation is taken either way; the approval only before it.
      expect(statusAndCode(cancellation)).toBe('200')
      expect(order?.status).toBe('cancelled')
      expect(
        statusAndCode(approval) === '200'
          ? order?.approvedAt !== null
          : statusAndCode(approval) === '409 3003' &&
              order?.approvedAt === null,
      ).toBe(true)
    })

    it('makes a creation wait for the removal of one of its stock rows, and refuses it as a row that is not there', async () => {
      const removed = await insertStock()
      const kept = await insertStock()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, removed)
          await tx.delete(inventory).where(eq(inventory.id, removed))
          const underWay = create(
            orderOf([itemOf(kept), itemOf(removed)]),
          ).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expectRefused(response, INVALID_ORDER, [
        issue('items.1.inventoryId', 'not_found', NO_SUCH_ROW),
      ])
      expect((await everything()).orders).toEqual([])
    })

    it('makes a creation wait for a change of the product of one of its stock rows, and copies the product as changed', async () => {
      const id = await insertStock()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, shampooId))
            .for('update')
          await tx
            .update(products)
            .set({ name: '改名したシャンプー' })
            .where(eq(products.id, shampooId))
          const underWay = create(orderOf([itemOf(id)])).then(
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
      expect(response.body.data.items[0].productName).toBe('改名したシャンプー')
    })
  })

  describe('PurchaseOrderRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new PurchaseOrderRepository(db)
    const orderIdOf = (id: string) => purchaseOrderIdSchema.parse(id)

    /** An order of the salon of the tests of one stock row, by no one. */
    const criteria = (
      inventoryId: string,
      orderNumber: string,
    ): PurchaseOrderCreateCriteria => ({
      order: {
        salonId: salonIdSchema.parse(salonId),
        supplier: 'Beauty Supply Tokyo',
        subtotal: 1000,
        taxAmount: 0,
        shippingCost: null,
        totalAmount: 1000,
        expectedDelivery: null,
        paymentTerms: null,
        notes: null,
        createdBy: null,
      },
      items: [
        {
          inventoryId: inventoryIdSchema.parse(inventoryId),
          quantity: '1.00',
          unitPrice: 1000,
          totalPrice: 1000,
          notes: null,
        },
      ],
      orderNumber,
    })

    it('writes nothing when another order has the number', async () => {
      const id = await insertStock()
      dataOf(await repository().create(criteria(id, 'PO-SAME-0001')))
      const before = await everything()

      const created = dataOf(
        await repository().create(criteria(id, 'PO-SAME-0001')),
      )

      expect(created).toEqual({ type: 'orderNumberTaken' })
      expect(await everything()).toEqual(before)
    })

    it('lets the database refuse amounts that do not add up', async () => {
      const id = await insertStock()
      const wrong = criteria(id, 'PO-WRONG-0001')

      const result = await repository().create({
        ...wrong,
        order: { ...wrong.order, totalAmount: 999 },
      })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'database', message: 'Failed to create purchase order' },
      })
      expect(await everything()).toEqual({ orders: [], items: [] })
    })

    it('tells the database could not be reached, for every method', async () => {
      const connection = connectUnreachableDatabase()
      const unreachable = new PurchaseOrderRepository(connection.database)
      const reach: LedgerReach = { type: 'everySalon' }
      const id = orderIdOf(UNKNOWN_ID)

      const results = [
        await unreachable.create(criteria(UNKNOWN_ID, 'PO-DOWN-0001')),
        await unreachable.findById(reach, id),
        await unreachable.list({
          reach,
          limit: 1,
          after: null,
          salonId: null,
          status: null,
          supplier: null,
          startDate: null,
          endDate: null,
        }),
        await unreachable.update(reach, id, { notes: null }),
        await unreachable.approve(reach, id, null),
        await unreachable.cancel(reach, id, '理由'),
      ]
      await connection.close()

      expect(
        results.map((result) =>
          result.type === 'error' && result.error.type === 'database'
            ? result.error.message
            : 'not an error',
        ),
      ).toEqual([
        'Failed to create purchase order',
        'Failed to find purchase order',
        'Failed to list purchase orders',
        'Failed to update purchase order',
        'Failed to approve purchase order',
        'Failed to cancel purchase order',
      ])
    })
  })
})
