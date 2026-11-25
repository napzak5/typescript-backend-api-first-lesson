import {
  inventory,
  inventoryTransactions,
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
} from '../../../__tests__/_shared/auth-helpers'
import {
  authenticationRequired,
  badRequest,
  brokenRules,
  connectUnreachableDatabase,
  createTestApp,
  databaseMoment,
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
  UUID,
} from '../../../__tests__/_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

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
const INVALID_RECEIPT = 'Invalid purchase order receipt'
const INVALID_SUGGESTION_SEARCH = 'Invalid reorder suggestion search'
const ONLY_PLACED = 'the goods of an ordered or shipped order are received'
const NOT_AN_ITEM = 'Must name a stock row of an item of the order'

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

  const receive = (
    id: string,
    body: object,
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).post(`${PATH}/${id}/receive`), as).send(body)

  const suggestions = (
    query: Record<string, unknown> = { salonId },
    as: string | null = asAdmin,
  ): Test =>
    authorized(request(app).get(`${PATH}/reorder-suggestions`).query(query), as)

  /**
   * An order of the salon written directly in the status, with an item of
   * each stock row at the quantity and the unit price, in that order.
   */
  const insertOrderOf = async (
    status: OrderStatus,
    items: { inventoryId: string; quantity: string; unitPrice: number }[],
    overrides: Partial<NewOrder> = {},
  ): Promise<string> => {
    const totals = items.map(({ quantity, unitPrice }) =>
      Math.round(Number(quantity) * unitPrice),
    )
    const subtotal = totals.reduce((sum, total) => sum + total, 0)
    const id = await insertOrder(status, {
      subtotal,
      taxAmount: 0,
      shippingCost: null,
      totalAmount: subtotal,
      ...overrides,
    })
    await db
      .delete(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, id))
    await db.insert(purchaseOrderItems).values(
      items.map(({ inventoryId, quantity, unitPrice }, sortOrder) => ({
        purchaseOrderId: id,
        inventoryId,
        productCode: 'P',
        productName: 'シャンプー',
        quantity,
        unit: '本',
        unitPrice,
        totalPrice: totals[sortOrder] ?? 0,
        sortOrder,
      })),
    )
    return id
  }

  /** The stock row as stored. */
  const storedRow = async (id: string) => {
    const [row] = await db.select().from(inventory).where(eq(inventory.id, id))
    return row
  }

  /** Every movement of every row, to tell what a receipt recorded. */
  const movements = () =>
    db
      .select()
      .from(inventoryTransactions)
      .orderBy(
        asc(inventoryTransactions.createdAt),
        asc(inventoryTransactions.id),
      )

  /** Every order, item, stock row and movement, to tell that a receipt wrote nothing. */
  const everythingOfStock = async () => ({
    ...(await everything()),
    rows: await db.select().from(inventory).orderBy(asc(inventory.id)),
    movements: await movements(),
  })

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
    async (as, id) =>
      receive(
        id,
        {
          items: [{ inventoryId: UNKNOWN_ID, quantity: 1 }],
          deliveryNotes: null,
        },
        as,
      ),
    async (as) => suggestions({ salonId }, as),
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

    it('keeps the items in the order of the request, not in that of their stock rows', async () => {
      const ids = (
        await Promise.all(Array.from({ length: 4 }, () => insertStock()))
      )
        .toSorted()
        .toReversed()

      const created = await create(
        orderOf(ids.map((id, n) => itemOf(id, { quantity: n + 1 }))),
      )
      const read = await get(created.body.data.id)

      for (const response of [created, read]) {
        expect(
          response.body.data.items.map(
            ({
              inventoryId,
              quantity,
            }: {
              inventoryId: string
              quantity: number
            }) => [inventoryId, quantity],
          ),
        ).toEqual(ids.map((id, n) => [id, n + 1]))
      }
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
        orderDate: '2026-11-02T00:00:00.123456Z',
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

    it('lists an administrator the orders of the salon named, and of every salon without one', async () => {
      const otherSalon = await insertSalon(db)
      const ofOther = await insertOrder('pending', { salonId: otherSalon })
      const own = await insertOrder('pending')

      const named = await list({ salonId })
      const every = await list()

      expect(named.body.data.map(({ id }: { id: string }) => id)).toEqual([own])
      expect(named.body.meta.total).toBe(1)
      expect(
        every.body.data.map(({ id }: { id: string }) => id).toSorted(),
      ).toEqual([own, ofOther].toSorted())
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

    it('answers 404 for an order of another salon to its members, and for one that is not there, and changes nothing', async () => {
      const ofOther = await insertOrder('draft', {
        salonId: await insertSalon(db),
      })
      const { authorization } = await signedInMember('staff')
      const before = await everything()

      expectProblem(
        await update(ofOther, { status: 'pending' }, authorization),
        notFound,
      )
      expectProblem(await update(UNKNOWN_ID, { status: 'pending' }), notFound)
      expect(await everything()).toEqual(before)
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

    it('answers 404 for an order of another salon and for one that is not there, and refuses an ID that is no UUID, changing nothing', async () => {
      const ofOther = await insertOrder('pending', {
        salonId: await insertSalon(db),
      })
      const owner = await member('owner')()
      const before = await everything()

      expectProblem(await approve(ofOther, owner), notFound)
      expect(await everything()).toEqual(before)
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

    it('refuses a staff member, and answers 404 for an order of another salon and for one that is not there, changing nothing', async () => {
      const id = await insertOrder()
      const ofOther = await insertOrder('pending', {
        salonId: await insertSalon(db),
      })
      const staff = await member('staff')()
      const manager = await member('manager')()
      const before = await everything()

      expectProblem(await cancel(id, undefined, staff), forbidden)
      expectProblem(await cancel(ofOther, undefined, manager), notFound)
      expectProblem(await cancel(UNKNOWN_ID), notFound)
      expect(await everything()).toEqual(before)
    })
  })

  describe('POST /api/v1/purchase-orders/:id/receive', () => {
    it('receives the goods of a shipped order into their stock rows as purchases at the unit prices, at one moment, and delivers it', async () => {
      const kept = await insertStock({
        currentStock: '5.00',
        availableStock: '3.00',
        reservedStock: '2.00',
        expiryDate: '2027-06-30',
      })
      const empty = await insertStock({ productId: colourId })
      const id = await insertOrderOf('shipped', [
        { inventoryId: kept, quantity: '10.00', unitPrice: 1500 },
        { inventoryId: empty, quantity: '2.50', unitPrice: 2999 },
      ])
      // Another order of the same rows, which the receipt leaves as it is.
      const other = await insertOrderOf('ordered', [
        { inventoryId: kept, quantity: '1.00', unitPrice: 1500 },
      ])
      const otherBefore = await storedOrder(other)
      const { authorization, staffId } = await signedInMember('staff')
      const item = (await everything()).items

      const response = await receive(
        id,
        {
          items: [
            { inventoryId: empty, quantity: 1.25 },
            { inventoryId: kept, quantity: 10 },
          ],
          deliveryNotes: '段ボール 2 箱',
        },
        authorization,
      )

      expect(response.status).toBe(200)
      const { data } = response.body
      expect(Object.keys(data).toSorted()).toEqual(ORDER_PROPERTIES)
      expect(data).toMatchObject({
        id,
        status: 'delivered',
        deliveryNotes: '段ボール 2 箱',
        actualDelivery: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(data.actualDelivery).toBe(data.updatedAt)
      expect(response.body.links).toEqual({
        self: `${PATH}/${id}`,
        list: PATH,
      })
      expect((await everything()).items).toEqual(item)
      expect(await storedOrder(other)).toEqual(otherBefore)

      const at = new Date(data.actualDelivery).getTime()
      const keptRow = await storedRow(kept)
      const emptyRow = await storedRow(empty)
      expect(keptRow).toMatchObject({
        currentStock: '15.00',
        availableStock: '13.00',
        reservedStock: '2.00',
      })
      expect(emptyRow).toMatchObject({
        currentStock: '1.25',
        availableStock: '1.25',
      })
      expect(new Date(keptRow?.updatedAt ?? '').getTime()).toBe(at)
      expect(new Date(emptyRow?.updatedAt ?? '').getTime()).toBe(at)

      const recorded = await movements()
      expect(
        [empty, kept].map((row) => {
          const movement = recorded.find(
            ({ inventoryId }) => inventoryId === row,
          )
          return movement === undefined
            ? undefined
            : {
                ...movement,
                createdAt: new Date(movement.createdAt).getTime(),
              }
        }),
      ).toEqual([
        expect.objectContaining({
          inventoryId: empty,
          productId: colourId,
          salonId,
          transactionType: 'purchase',
          quantity: '1.25',
          balanceBefore: '0.00',
          balanceAfter: '1.25',
          // 1.25 × 2999 = 3748.75
          unitCost: 2999,
          totalCost: 3749,
          referenceType: 'purchase_order',
          referenceId: id,
          reason: null,
          performedBy: staffId,
          lotNumber: emptyRow?.lotNumber,
          expiryDate: null,
          createdAt: at,
        }),
        expect.objectContaining({
          inventoryId: kept,
          productId: shampooId,
          quantity: '10.00',
          balanceBefore: '5.00',
          balanceAfter: '15.00',
          unitCost: 1500,
          totalCost: 15000,
          referenceId: id,
          performedBy: staffId,
          lotNumber: keptRow?.lotNumber,
          expiryDate: '2027-06-30',
          createdAt: at,
        }),
      ])
      expect(recorded.map(({ inventoryId }) => inventoryId).toSorted()).toEqual(
        [empty, kept].toSorted(),
      )
    })

    it.each(orderers)(
      'receives the goods of an ordered order for %s, as the staff member they are',
      async (_who, signInAs) => {
        const row = await insertStock()
        const id = await insertOrderOf('ordered', [
          { inventoryId: row, quantity: '3.00', unitPrice: 100 },
        ])
        const authorization = await signInAs()

        const response = await receive(
          id,
          { items: [{ inventoryId: row, quantity: 3 }], deliveryNotes: null },
          authorization,
        )

        expect(response.status).toBe(200)
        expect(await movements()).toEqual([
          expect.objectContaining({
            quantity: '3.00',
            performedBy:
              authorization === asAdmin ? null : expect.stringMatching(UUID),
          }),
        ])
      },
    )

    it('keeps the delivery notes the order has when the receipt states none, and receives only the items named', async () => {
      const named = await insertStock()
      const unnamed = await insertStock({
        currentStock: '4.00',
        availableStock: '4.00',
      })
      const id = await insertOrderOf(
        'shipped',
        [
          { inventoryId: unnamed, quantity: '1.00', unitPrice: 100 },
          { inventoryId: named, quantity: '6.00', unitPrice: 100 },
        ],
        { deliveryNotes: '午前に配達' },
      )
      const before = await storedRow(unnamed)

      const response = await receive(id, {
        items: [{ inventoryId: named, quantity: 4 }],
        deliveryNotes: null,
      })

      expect(response.body.data.deliveryNotes).toBe('午前に配達')
      expect(await storedRow(unnamed)).toEqual(before)
      expect((await storedRow(named))?.currentStock).toBe('4.00')
      expect(
        (await movements()).map(({ inventoryId, quantity }) => [
          inventoryId,
          quantity,
        ]),
      ).toEqual([[named, '4.00']])
    })

    it.each<[OrderStatus, string]>([
      ['draft', ONLY_PLACED],
      ['pending', ONLY_PLACED],
      ['approved', ONLY_PLACED],
      ['delivered', CLOSED],
      ['cancelled', CLOSED],
    ])(
      'refuses the goods of a %s order, and changes nothing',
      async (status, takes) => {
        const row = await insertStock()
        const id = await insertOrderOf(status, [
          { inventoryId: row, quantity: '1.00', unitPrice: 100 },
        ])
        const before = await everythingOfStock()

        expectConflict(
          await receive(id, {
            items: [{ inventoryId: row, quantity: 1 }],
            deliveryNotes: '届いた',
          }),
          `Purchase order ${id} is ${status}: ${takes}`,
        )
        expect(await everythingOfStock()).toEqual(before)
      },
    )

    it('refuses every row that no item of the order is for, and every item over what it orders, and changes nothing', async () => {
      const ordered = await insertStock()
      const other = await insertStock()
      const removed = await insertStock()
      const id = await insertOrderOf('shipped', [
        { inventoryId: ordered, quantity: '2.50', unitPrice: 100 },
        { inventoryId: removed, quantity: '1.00', unitPrice: 100 },
      ])
      // The row is an item of another order, not of this one.
      await insertOrderOf('shipped', [
        { inventoryId: other, quantity: '5.00', unitPrice: 100 },
      ])
      await db.delete(inventory).where(eq(inventory.id, removed))
      const before = await everythingOfStock()

      const response = await receive(id, {
        items: [
          { inventoryId: other, quantity: 1 },
          { inventoryId: ordered, quantity: 2.51 },
          { inventoryId: removed, quantity: 1 },
        ],
        deliveryNotes: null,
      })

      expectRefused(response, INVALID_RECEIPT, [
        issue('items.0.inventoryId', 'not_found', NOT_AN_ITEM),
        issue(
          'items.1.quantity',
          'too_big',
          'Must be at most 2.5, the quantity the item orders',
        ),
        issue('items.2.inventoryId', 'not_found', NOT_AN_ITEM),
      ])
      expect(await everythingOfStock()).toEqual(before)
    })

    it('refuses the goods when a stock row would hold more than it can, and changes nothing', async () => {
      const room = await insertStock()
      const full = await insertStock({
        currentStock: '99999999.00',
        availableStock: '99999999.00',
      })
      const id = await insertOrderOf('shipped', [
        { inventoryId: room, quantity: '1.00', unitPrice: 100 },
        { inventoryId: full, quantity: '1.00', unitPrice: 100 },
      ])
      const before = await everythingOfStock()

      expectConflict(
        await receive(id, {
          items: [
            { inventoryId: room, quantity: 1 },
            { inventoryId: full, quantity: 1 },
          ],
          deliveryNotes: null,
        }),
        `The stock of row ${full} would go above 99999999.99`,
      )
      expect(await everythingOfStock()).toEqual(before)
    })

    it('takes the goods that bring a row up to what it can hold', async () => {
      const full = await insertStock({
        currentStock: '99999998.99',
        availableStock: '99999998.99',
      })
      const id = await insertOrderOf('shipped', [
        { inventoryId: full, quantity: '1.00', unitPrice: 100 },
      ])

      const response = await receive(id, {
        items: [{ inventoryId: full, quantity: 1 }],
        deliveryNotes: null,
      })

      expect(response.status).toBe(200)
      expect((await storedRow(full))?.currentStock).toBe('99999999.99')
    })

    it.each<[string, object, string[]]>([
      ['no items', { items: [], deliveryNotes: null }, ['items:too_small']],
      [
        'the names the contract had',
        {
          receivedItems: [{ inventoryId: UNKNOWN_ID, receivedQuantity: 1 }],
          deliveryNotes: null,
        },
        ['items:invalid_type', 'receivedItems:unrecognized_keys'],
      ],
      [
        'a quantity of none',
        {
          items: [{ inventoryId: UNKNOWN_ID, quantity: 0 }],
          deliveryNotes: null,
        },
        ['items.0.quantity:too_small'],
      ],
      [
        'a row named twice',
        {
          items: [
            { inventoryId: UNKNOWN_ID, quantity: 1 },
            { inventoryId: UNKNOWN_ID.toUpperCase(), quantity: 1 },
          ],
          deliveryNotes: null,
        },
        ['items.1.inventoryId:custom'],
      ],
      [
        'blank delivery notes',
        {
          items: [{ inventoryId: UNKNOWN_ID, quantity: 1 }],
          deliveryNotes: ' ',
        },
        ['deliveryNotes:invalid_format'],
      ],
      [
        'no delivery notes at all',
        { items: [{ inventoryId: UNKNOWN_ID, quantity: 1 }] },
        ['deliveryNotes:invalid_type'],
      ],
    ])('refuses a receipt with %s', async (_case, body, expected) => {
      const id = await insertOrder('shipped')
      const before = await everythingOfStock()

      const response = await receive(id, body)

      expectRefused(response, INVALID_RECEIPT)
      expect(brokenRules(response)).toEqual(expected)
      expect(await everythingOfStock()).toEqual(before)
    })

    it('answers 404 for an order of another salon to its members, and for one that is not there, and refuses an ID that is no UUID, changing nothing', async () => {
      const otherSalon = await insertSalon(db)
      const row = await insertStock({ salonId: otherSalon })
      const ofOther = await insertOrderOf(
        'shipped',
        [{ inventoryId: row, quantity: '1.00', unitPrice: 100 }],
        { salonId: otherSalon },
      )
      const { authorization } = await signedInMember('staff')
      const body = {
        items: [{ inventoryId: row, quantity: 1 }],
        deliveryNotes: null,
      }
      const before = await everythingOfStock()

      expectProblem(await receive(ofOther, body, authorization), notFound)
      expectProblem(await receive(UNKNOWN_ID, body), notFound)
      expectRefused(await receive('x', {}), INVALID_ID)
      expect(await everythingOfStock()).toEqual(before)
    })
  })

  describe('GET /api/v1/purchase-orders/reorder-suggestions', () => {
    /** A product of the salon with the stock levels, and stock rows that hold the quantities. */
    const productWith = async (
      code: string,
      levels: Partial<typeof products.$inferInsert>,
      stocks: string[],
    ): Promise<{ productId: string; rows: string[] }> => {
      const productId = await insertProduct({
        productCode: code,
        name: `商品 ${code}`,
        unit: '個',
        supplier: `仕入先 ${code}`,
        ...levels,
      })
      const rows: string[] = []
      for (const stock of stocks) {
        rows.push(
          await insertStock({
            productId,
            currentStock: stock,
            availableStock: stock,
          }),
        )
      }
      return { productId, rows }
    }

    it('suggests each product whose stock and what is on order come to its reorder point or less, up to its maximum, by its code', async () => {
      // Below its reorder point over two lots, with 2 on order: 24 - (3 + 2).
      const lots = await productWith(
        'A-LOTS',
        { minimumStock: '5', reorderPoint: '10', maximumStock: '24' },
        ['2.00', '1.00'],
      )
      // No reorder point and no maximum: up to the minimum stock.
      const minimum = await productWith('B-MIN', { minimumStock: '4' }, [
        '1.50',
      ])
      // At its reorder point exactly.
      const atPoint = await productWith(
        'C-AT',
        { reorderPoint: '10', maximumStock: '20' },
        ['10.00'],
      )
      // Above its reorder point.
      await productWith('D-ABOVE', { reorderPoint: '10', maximumStock: '20' }, [
        '10.01',
      ])
      // Below it, but no longer handled.
      await productWith('E-INACTIVE', { reorderPoint: '10', isActive: false }, [
        '0.00',
      ])
      // Below it, but deleted.
      await productWith(
        'F-DELETED',
        { reorderPoint: '10', deletedAt: '2026-11-01T00:00:00.000Z' },
        ['0.00'],
      )
      // Below it, without a stock row.
      await productWith('G-NOROW', { reorderPoint: '10' }, [])
      // Below it, but what is on order brings it above.
      const covered = await productWith(
        'H-COVERED',
        { reorderPoint: '10', maximumStock: '20' },
        ['3.00'],
      )
      // At its reorder point with no maximum: nothing to order.
      await productWith('I-NOTHING', { minimumStock: '4' }, ['4.00'])

      const lastOfLots = '2026-11-10T00:00:00.123Z'
      await insertOrderOf(
        'pending',
        [{ inventoryId: lots.rows[0] ?? '', quantity: '1.50', unitPrice: 100 }],
        { orderDate: '2026-11-01T00:00:00.000Z' },
      )
      await insertOrderOf(
        'draft',
        [{ inventoryId: lots.rows[1] ?? '', quantity: '0.50', unitPrice: 100 }],
        { orderDate: '2026-11-02T00:00:00.000Z' },
      )
      // Closed: on order no more; the delivered one is the latest order.
      await insertOrderOf(
        'delivered',
        [
          {
            inventoryId: lots.rows[0] ?? '',
            quantity: '50.00',
            unitPrice: 100,
          },
        ],
        { orderDate: lastOfLots },
      )
      await insertOrderOf(
        'cancelled',
        [
          {
            inventoryId: lots.rows[1] ?? '',
            quantity: '50.00',
            unitPrice: 100,
          },
        ],
        { orderDate: '2026-11-15T00:00:00.000Z' },
      )
      await insertOrderOf('ordered', [
        {
          inventoryId: covered.rows[0] ?? '',
          quantity: '8.00',
          unitPrice: 100,
        },
      ])
      // An item whose stock row was deleted is of no product.
      const gone = await insertStock({ productId: minimum.productId })
      await insertOrderOf('shipped', [
        { inventoryId: gone, quantity: '9.00', unitPrice: 100 },
      ])
      await db.delete(inventory).where(eq(inventory.id, gone))

      const response = await suggestions()

      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([
        {
          productId: lots.productId,
          productCode: 'A-LOTS',
          productName: '商品 A-LOTS',
          unit: '個',
          supplier: '仕入先 A-LOTS',
          currentStock: 3,
          onOrderQuantity: 2,
          reorderPoint: 10,
          maximumStock: 24,
          suggestedQuantity: 19,
          lastOrderDate: lastOfLots,
        },
        {
          productId: minimum.productId,
          productCode: 'B-MIN',
          productName: '商品 B-MIN',
          unit: '個',
          supplier: '仕入先 B-MIN',
          currentStock: 1.5,
          onOrderQuantity: 0,
          reorderPoint: 4,
          maximumStock: null,
          suggestedQuantity: 2.5,
          lastOrderDate: null,
        },
        {
          productId: atPoint.productId,
          productCode: 'C-AT',
          productName: '商品 C-AT',
          unit: '個',
          supplier: '仕入先 C-AT',
          currentStock: 10,
          onOrderQuantity: 0,
          reorderPoint: 10,
          maximumStock: 20,
          suggestedQuantity: 10,
          lastOrderDate: null,
        },
      ])
      expect(response.body.meta).toEqual({
        total: 3,
        limit: 20,
        hasMore: false,
        cursor: null,
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('leaves out the stock, the products and the orders of other salons', async () => {
      const own = await productWith('A-OWN', { reorderPoint: '10' }, ['1.00'])
      const otherSalon = await insertSalon(db)
      const foreign = await insertProduct({
        salonId: otherSalon,
        productCode: 'A-OTHER',
        reorderPoint: '10',
      })
      await insertStock({ salonId: otherSalon, productId: foreign })
      // Rows and an order that cross the salons, which only a direct write
      // makes: a row of the salon's product at the other salon, a row of the
      // other salon's product here, and an order of the other salon of a
      // row of the salon.
      await insertStock({
        salonId: otherSalon,
        productId: own.productId,
        currentStock: '50.00',
        availableStock: '50.00',
      })
      await insertStock({ productId: foreign })
      await insertOrderOf(
        'ordered',
        [{ inventoryId: own.rows[0] ?? '', quantity: '3.00', unitPrice: 100 }],
        { salonId: otherSalon },
      )

      const response = await suggestions()

      expect(
        response.body.data.map(
          ({
            productId,
            currentStock,
            onOrderQuantity,
            lastOrderDate,
          }: {
            productId: string
            currentStock: number
            onOrderQuantity: number
            lastOrderDate: string | null
          }) => [productId, currentStock, onOrderQuantity, lastOrderDate],
        ),
      ).toEqual([[own.productId, 1, 0, null]])
    })

    it('pages forwards by the codes of the products, not by their IDs, under the path of the suggestions', async () => {
      // IDs in the other order than the codes.
      const ids = [
        '00000000-0000-4000-8000-00000000000c',
        '00000000-0000-4000-8000-00000000000b',
        '00000000-0000-4000-8000-00000000000a',
      ]
      for (const [index, id] of ids.entries()) {
        await productWith(`S-${index + 1}`, { id, reorderPoint: '5' }, ['0.00'])
      }

      const page = await suggestions({ salonId, limit: 2 })
      const next = await suggestions({
        salonId,
        limit: 2,
        cursor: page.body.meta.nextCursor,
      })

      const base = `${PATH}/reorder-suggestions?salonId=${salonId}&limit=2`
      expect(
        page.body.data.map(({ productId }: { productId: string }) => productId),
      ).toEqual(ids.slice(0, 2))
      expect(page.body.meta).toEqual({
        total: 3,
        limit: 2,
        hasMore: true,
        cursor: null,
        nextCursor: ids[1],
        prevCursor: null,
      })
      expect(page.body.links).toEqual({
        self: base,
        first: base,
        last: null,
        next: `${base}&cursor=${ids[1]}`,
        prev: null,
      })
      expect(
        next.body.data.map(({ productId }: { productId: string }) => productId),
      ).toEqual(ids.slice(2))
      expect(next.body.meta).toMatchObject({
        total: 3,
        hasMore: false,
        cursor: ids[1],
        nextCursor: null,
      })
      expect(
        (await suggestions({ salonId, limit: 3 })).body.meta,
      ).toMatchObject({ total: 3, hasMore: false, nextCursor: null })
    })

    it('pages on from a product the salon deleted, by its code and then its ID', async () => {
      const deleted = await insertProduct({
        id: '00000000-0000-4000-8000-00000000000b',
        productCode: 'S-2',
        reorderPoint: '5',
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await productWith('S-1', { reorderPoint: '5' }, ['0.00'])
      // The same code as the deleted product, and a later ID.
      const same = await productWith(
        'S-2',
        { id: '00000000-0000-4000-8000-00000000000c', reorderPoint: '5' },
        ['0.00'],
      )
      const after = await productWith(
        'S-3',
        { id: '00000000-0000-4000-8000-00000000000a', reorderPoint: '5' },
        ['0.00'],
      )

      const response = await suggestions({ salonId, cursor: deleted })

      expect(
        response.body.data.map(
          ({ productId }: { productId: string }) => productId,
        ),
      ).toEqual([same.productId, after.productId])
    })

    it.each(orderers)(
      'lists the suggestions of the salon for %s',
      async (_who, signInAs) => {
        const { productId } = await productWith('A', { reorderPoint: '5' }, [
          '0.00',
        ])

        const response = await suggestions({ salonId }, await signInAs())

        expect(
          response.body.data.map(
            ({ productId }: { productId: string }) => productId,
          ),
        ).toEqual([productId])
      },
    )

    it('refuses a member of a salon who names another salon, and a salon that is not there', async () => {
      const otherSalon = await insertSalon(db)

      expectProblem(
        await suggestions({ salonId: otherSalon }, await member('staff')()),
        forbidden,
      )
      expectRefused(
        await suggestions({ salonId: UNKNOWN_ID }),
        INVALID_SUGGESTION_SEARCH,
        [issue('salonId', 'not_found', NO_SUCH_SALON)],
      )
    })

    it('refuses a cursor that names no product of the salon', async () => {
      const otherSalon = await insertSalon(db)
      const foreign = await insertProduct({ salonId: otherSalon })

      for (const cursor of [UNKNOWN_ID, foreign]) {
        expectRefused(
          await suggestions({ salonId, cursor }),
          INVALID_SUGGESTION_SEARCH,
          [issue('cursor', 'not_found', 'Must name a product of the salon')],
        )
      }
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['no salon', {}, ['salonId:invalid_type']],
      ['a limit of none', { limit: 0 }, ['limit:too_small']],
      ['a limit that is no number', { limit: 'all' }, ['limit:invalid_format']],
      ['a cursor that is no UUID', { cursor: 'x' }, ['cursor:invalid_format']],
      ['a threshold', { threshold: 1 }, ['threshold:unrecognized_keys']],
    ])('refuses %s', async (name, query, expected) => {
      const response = await suggestions(
        name === 'no salon' ? query : { salonId, ...query },
      )

      expectRefused(response, INVALID_SUGGESTION_SEARCH)
      expect(brokenRules(response)).toEqual(expected)
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
          Array.from({ length: 8 }, () => '403 1005'),
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
      ['POST on the suggestions', 'post', '/reorder-suggestions'],
      ['GET below the suggestions', 'get', '/reorder-suggestions/ID'],
      ['GET on a receipt', 'get', '/ID/receive'],
      ['PUT on a receipt', 'put', '/ID/receive'],
      ['a receipt by another name', 'post', '/ID/deliver'],
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

    it('receives the goods of an order once when two receipts arrive together', async () => {
      const row = await insertStock()
      const id = await insertOrderOf('shipped', [
        { inventoryId: row, quantity: '4.00', unitPrice: 100 },
      ])
      const body = {
        items: [{ inventoryId: row, quantity: 4 }],
        deliveryNotes: null,
      }

      const responses = await Promise.all([
        receive(id, body),
        receive(id, body, await member('staff')()),
      ])

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
      ])
      expect((await storedRow(row))?.currentStock).toBe('4.00')
      expect(await movements()).toHaveLength(1)
    })

    it('makes a receipt wait for a cancellation in progress, and refuses the cancelled order', async () => {
      const row = await insertStock()
      const id = await insertOrderOf('shipped', [
        { inventoryId: row, quantity: '1.00', unitPrice: 100 },
      ])

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await tx
            .select({ id: purchaseOrders.id })
            .from(purchaseOrders)
            .where(eq(purchaseOrders.id, id))
            .for('update')
          await tx
            .update(purchaseOrders)
            .set({
              status: 'cancelled',
              cancelledAt: new Date().toISOString(),
              cancellationReason: '取りやめ',
            })
            .where(eq(purchaseOrders.id, id))
          const underWay = receive(id, {
            items: [{ inventoryId: row, quantity: 1 }],
            deliveryNotes: null,
          }).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectConflict(
        await pending,
        `Purchase order ${id} is cancelled: ${CLOSED}`,
      )
      expect(await movements()).toEqual([])
    })

    it('takes two receipts of one row at once one after the other, each from the stock the other left', async () => {
      const row = await insertStock()
      const first = await insertOrderOf('shipped', [
        { inventoryId: row, quantity: '2.00', unitPrice: 100 },
      ])
      const second = await insertOrderOf('shipped', [
        { inventoryId: row, quantity: '3.00', unitPrice: 100 },
      ])

      // Both wait for the row, and go on together once it is let go.
      const { pending } = await db.transaction(async (tx) => {
        await holdRow(tx, row)
        const underWay = Promise.all([
          receive(first, {
            items: [{ inventoryId: row, quantity: 2 }],
            deliveryNotes: null,
          }),
          receive(second, {
            items: [{ inventoryId: row, quantity: 3 }],
            deliveryNotes: null,
          }),
        ]).then((responses) => responses)
        await pause(300)
        return { pending: underWay }
      })
      const responses = await pending

      expect(responses.map(statusAndCode)).toEqual(['200', '200'])
      expect((await storedRow(row))?.currentStock).toBe('5.00')
      const [earlier, later] = (await movements()).toSorted(
        (a, b) => Number(a.balanceAfter) - Number(b.balanceAfter),
      )
      expect(earlier?.balanceBefore).toBe('0.00')
      expect(later?.balanceBefore).toBe(earlier?.balanceAfter)
      expect(later?.balanceAfter).toBe('5.00')
    })

    it('makes a receipt hold none of its rows while it waits for the first of them by ID', async () => {
      const low = '00000000-0000-4000-8000-0000000000a1'
      const high = '00000000-0000-4000-8000-0000000000a2'
      // Stored in the other order than their IDs.
      await insertStock({ id: high })
      await insertStock({ id: low })
      const id = await insertOrderOf('shipped', [
        { inventoryId: high, quantity: '1.00', unitPrice: 100 },
        { inventoryId: low, quantity: '1.00', unitPrice: 100 },
      ])

      const { pending, highWasFree } = await db.transaction(async (tx) => {
        await holdRow(tx, low)
        const underWay = receive(id, {
          items: [
            { inventoryId: high, quantity: 1 },
            { inventoryId: low, quantity: 1 },
          ],
          deliveryNotes: null,
        }).then((response) => response)
        await pause(300)
        const free = await tx
          .transaction((savepoint) =>
            savepoint
              .select({ id: inventory.id })
              .from(inventory)
              .where(eq(inventory.id, high))
              .for('update', { noWait: true }),
          )
          .then(
            () => true,
            () => false,
          )
        return { pending: underWay, highWasFree: free }
      })

      expect(highWasFree).toBe(true)
      expect((await pending).status).toBe(200)
    })

    it('makes a receipt wait for a movement of one of its rows, and moves the row from the stock the movement left', async () => {
      const row = await insertStock({
        currentStock: '1.00',
        availableStock: '1.00',
      })
      const id = await insertOrderOf('shipped', [
        { inventoryId: row, quantity: '2.00', unitPrice: 100 },
      ])

      const { pending, answeredWhileHeld, releasedAt } = await db.transaction(
        async (tx) => {
          await holdRow(tx, row)
          await tx
            .update(inventory)
            .set({ currentStock: '6.00', availableStock: '6.00' })
            .where(eq(inventory.id, row))
          const underWay = receive(id, {
            items: [{ inventoryId: row, quantity: 2 }],
            deliveryNotes: null,
          }).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
            releasedAt: await databaseMoment(tx),
          }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
      // Written when the wait was over, not when the receipt began.
      expect(
        new Date(response.body.data.actualDelivery).getTime(),
      ).toBeGreaterThanOrEqual(releasedAt)
      expect(await movements()).toEqual([
        expect.objectContaining({
          balanceBefore: '6.00',
          balanceAfter: '8.00',
        }),
      ])
    })

    it('makes a receipt wait for the removal of one of its rows, and refuses the row as one no item is for any more', async () => {
      const kept = await insertStock()
      const removed = await insertStock()
      const id = await insertOrderOf('shipped', [
        { inventoryId: kept, quantity: '1.00', unitPrice: 100 },
        { inventoryId: removed, quantity: '1.00', unitPrice: 100 },
      ])

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, removed)
          await tx.delete(inventory).where(eq(inventory.id, removed))
          const underWay = receive(id, {
            items: [
              { inventoryId: kept, quantity: 1 },
              { inventoryId: removed, quantity: 1 },
            ],
            deliveryNotes: null,
          }).then((response) => response)

          return {
            pending: underWay,
            answeredWhileHeld: await answersWithin(underWay, 300),
          }
        },
      )

      expect(answeredWhileHeld).toBe(false)
      expectRefused(await pending, INVALID_RECEIPT, [
        issue('items.1.inventoryId', 'not_found', NOT_AN_ITEM),
      ])
      expect((await storedOrder(id))?.status).toBe('shipped')
      expect((await storedRow(kept))?.currentStock).toBe('0.00')
      expect(await movements()).toEqual([])
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
        await unreachable.receive(reach, id, {
          items: [
            { inventoryId: inventoryIdSchema.parse(UNKNOWN_ID), quantity: 1 },
          ],
          deliveryNotes: null,
          performedBy: null,
        }),
        await unreachable.listReorderSuggestions({
          salonId: salonIdSchema.parse(UNKNOWN_ID),
          limit: 1,
          after: null,
        }),
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
        'Failed to receive purchase order',
        'Failed to list reorder suggestions',
      ])
    })
  })
})
