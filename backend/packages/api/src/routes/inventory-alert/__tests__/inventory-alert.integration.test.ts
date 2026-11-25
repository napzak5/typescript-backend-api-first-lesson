import {
  inventory,
  inventoryAlertAcknowledgements,
  inventoryTransactions,
  products,
} from '@beauty-salon-backend/database'
import { type DomainError, salonIdSchema } from '@beauty-salon-backend/domain'
import { InventoryAlertRepository } from '@beauty-salon-backend/infrastructure'
import type { Result } from '@beauty-salon-backend/utility'
import { asc, eq, sql } from 'drizzle-orm'
import type { PgInsertValue } from 'drizzle-orm/pg-core'
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
  databaseProblem,
  type ExpectedProblem,
  expectProblem,
  forbidden,
  getTestDb,
  ISO_TIMESTAMP,
  invalidToken,
  notAllowed,
  notFound,
  request,
  tokenExpired,
  UUID,
} from '../../../__tests__/_shared/test-helpers'

/** A UUID that nothing has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

const CHALLENGE = 'Bearer realm="beauty-salon-api"'
const INVALID_TOKEN_CHALLENGE =
  'Bearer realm="beauty-salon-api", error="invalid_token"'

const INVALID_SEARCH = 'Invalid inventory alert search'
const INVALID_SUMMARY = 'Invalid inventory alert summary request'
const INVALID_ACKNOWLEDGEMENT = 'Invalid inventory alert acknowledgement'
const TOKYO = 'Asia/Tokyo'

/** The properties of an InventoryAlertResponse. */
const ALERT_PROPERTIES = [
  'acknowledgement',
  'alert',
  'currentStock',
  'expiryDate',
  'inventoryId',
  'lotNumber',
  'productCode',
  'productId',
  'productName',
  'salonId',
  'severity',
  'threshold',
  'unit',
]

/** The properties of an InventoryAlertAcknowledgementResponse. */
const ACKNOWLEDGEMENT_PROPERTIES = [
  'acknowledgedAt',
  'acknowledgedBy',
  'alert',
  'expiryDate',
  'id',
  'inventoryId',
  'notes',
  'productId',
  'salonId',
  'severity',
  'threshold',
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

/** Today at a salon, `YYYY-MM-DD`, as its clocks tell it. */
const dateIn = (timeZone: string, moment: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(moment)

/** The date some days after a date, `YYYY-MM-DD`. */
const daysAfter = (date: string, days: number): string => {
  const moment = new Date(`${date}T00:00:00Z`)
  moment.setUTCDate(moment.getUTCDate() + days)
  return moment.toISOString().slice(0, 10)
}

/** An alert as `type:subject`, the subject being its stock row or its product. */
const keyOf = ({
  alert,
  productId,
  inventoryId,
}: {
  alert: string
  productId: string
  inventoryId: string | null
}): string => `${alert}:${inventoryId ?? productId}`

/** The alerts of a page, as `type:subject`. */
const keysOf = (response: Response): string[] => {
  expect(response.status).toBe(200)
  return response.body.data.map(keyOf)
}

describe('Inventory alert API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  /** The salon of most tests. */
  let salonId: string
  /** A product of the salon that keeps 5 to 20 bottles. */
  let productId: string
  /** Today at the salon of the tests. */
  let today: string

  type NewProduct = typeof products.$inferInsert
  type NewStock = typeof inventory.$inferInsert
  type NewMovement = PgInsertValue<typeof inventoryTransactions>
  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

  let rows = 0

  /** A number no other row of the tests has. */
  const nextRow = (): string => {
    rows += 1
    return String(rows).padStart(4, '0')
  }

  /** A product that keeps 5 to 20; of the salon of the tests unless the overrides say otherwise. */
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
        minimumStock: '5',
        maximumStock: '20',
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
   * of its own, with 3 in stock and no expiry date unless the overrides say
   * otherwise.
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
        ...stock('3'),
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
    today = dateIn(TOKYO)
  })

  const PATH = '/api/v1/inventory-alerts'

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  const list = (
    query: Record<string, unknown> = { salonId },
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(PATH).query(query), as)

  const summary = (
    query: Record<string, unknown> = { salonId },
    as: string | null = asAdmin,
  ): Test => authorized(request(app).get(`${PATH}/summary`).query(query), as)

  const acknowledge = (
    body: object | undefined,
    as: string | null = asAdmin,
  ): Test => {
    const call = authorized(request(app).post(`${PATH}/acknowledge`), as)
    return body === undefined ? call : call.send(body)
  }

  /** An acknowledgement of an alert of a product, of the product of the tests unless another is given. */
  const ofProduct = (
    alert: 'low_stock' | 'overstock',
    product: string = productId,
    notes: string | null = null,
  ) => ({ alert, productId: product, inventoryId: null, notes })

  /** An acknowledgement of an alert of a stock row of the product of the tests unless another is given. */
  const ofRow = (
    alert: 'expiring' | 'expired',
    inventoryId: string,
    product: string = productId,
    notes: string | null = null,
  ) => ({ alert, productId: product, inventoryId, notes })

  /** Moves the stock of a row through the API, as an administrator. */
  const move = async (inventoryId: string, quantity: number): Promise<void> => {
    const response = await request(app)
      .post('/api/v1/inventory/movement')
      .set('Authorization', asAdmin)
      .send({
        inventoryId,
        transactionType: quantity > 0 ? 'purchase' : 'sale',
        quantity,
        unitCost: null,
        referenceType: null,
        referenceId: null,
        reason: null,
      })
    expect(statusAndCode(response)).toBe('200')
  }

  /** Acknowledges an alert and expects it to be acknowledged. */
  const acknowledged = async (body: object): Promise<Response> => {
    const response = await acknowledge(body)
    expect(statusAndCode(response)).toBe('200')
    return response
  }

  /** The alert of the list with the key, or undefined when there is none. */
  const listed = async (key: string, ofSalon: string = salonId) => {
    const response = await list({ salonId: ofSalon, limit: 100 })
    expect(response.status).toBe(200)
    return response.body.data.find(
      (alert: Parameters<typeof keyOf>[0]) => keyOf(alert) === key,
    )
  }

  /** Every acknowledgement, in the order they were written. */
  const storedAcknowledgements = () =>
    db
      .select()
      .from(inventoryAlertAcknowledgements)
      .orderBy(
        asc(inventoryAlertAcknowledgements.acknowledgedAt),
        asc(inventoryAlertAcknowledgements.id),
      )

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

  /** A member of the salon of the tests, with the ID of their staff record. */
  const memberWithStaff = async (
    role: 'owner' | 'manager' | 'staff',
  ): Promise<{ authorization: string; staffId: string }> => {
    const { email, staffId } = await insertMember(db, role, salonId)
    return { authorization: (await signIn(app, email)).authorization, staffId }
  }

  /** Everyone who reads, and acknowledges, the alerts of the salon of the tests. */
  const readers: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of the salon', member('owner')],
    ['a manager of the salon', member('manager')],
    ['a staff member of the salon', member('staff')],
  ]

  /** Accounts that read no stock at all. */
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

  describe('GET /api/v1/inventory-alerts', () => {
    it('lists the alerts of the salon as they are now, and answers 200 with them as the contract has them', async () => {
      await db
        .update(products)
        .set({ productCode: 'SHMP001', name: 'モイストシャンプー' })
        .where(eq(products.id, productId))
      const expired = await insertStock({
        lotNumber: 'L-OLD',
        expiryDate: daysAfter(today, -1),
        ...stock('2'),
      })
      const expiring = await insertStock({
        lotNumber: null,
        expiryDate: daysAfter(today, 10),
        ...stock('1.25'),
      })

      const response = await list()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: [
          {
            alert: 'low_stock',
            severity: 'warning',
            salonId,
            productId,
            productCode: 'SHMP001',
            productName: 'モイストシャンプー',
            unit: '本',
            inventoryId: null,
            lotNumber: null,
            expiryDate: null,
            currentStock: 3.25,
            threshold: 5,
            acknowledgement: null,
          },
          {
            alert: 'expired',
            severity: 'critical',
            salonId,
            productId,
            productCode: 'SHMP001',
            productName: 'モイストシャンプー',
            unit: '本',
            inventoryId: expired,
            lotNumber: 'L-OLD',
            expiryDate: daysAfter(today, -1),
            currentStock: 2,
            threshold: null,
            acknowledgement: null,
          },
          {
            alert: 'expiring',
            severity: 'warning',
            salonId,
            productId,
            productCode: 'SHMP001',
            productName: 'モイストシャンプー',
            unit: '本',
            inventoryId: expiring,
            lotNumber: null,
            expiryDate: daysAfter(today, 10),
            currentStock: 1.25,
            threshold: null,
            acknowledgement: null,
          },
        ],
        meta: {
          total: 3,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
        links: {
          self: `${PATH}?salonId=${salonId}`,
          first: `${PATH}?salonId=${salonId}`,
          last: null,
          next: null,
          prev: null,
        },
      })
      for (const alert of response.body.data) {
        expect(Object.keys(alert).toSorted()).toEqual(ALERT_PROPERTIES)
      }
    })

    it.each(readers)('lists them for %s', async (_who, signInAs) => {
      await insertStock({ expiryDate: daysAfter(today, -1) })

      const response = await list({ salonId }, await signInAs())

      expect(keysOf(response)).toEqual([
        `low_stock:${productId}`,
        expect.stringMatching(/^expired:/),
      ])
    })

    it('tells each alert by the rules of the stock and of the expiry dates', async () => {
      const code = (n: number) => `A${String(n).padStart(2, '0')}`
      const productWith = async (
        n: number,
        amounts: string[],
        overrides: Partial<NewProduct> = {},
      ): Promise<string> => {
        const id = await insertProduct({ productCode: code(n), ...overrides })
        for (const amount of amounts) {
          await insertStock({ productId: id, ...stock(amount) })
        }
        return id
      }
      await db
        .update(products)
        .set({ productCode: code(0) })
        .where(eq(products.id, productId))
      await insertStock(stock('10'))
      const atMinimum = await productWith(1, ['2', '3'])
      await productWith(2, ['2', '3.01'])
      const without = await productWith(3, ['0', '0'])
      await productWith(4, ['20'])
      const aboveMaximum = await productWith(5, ['10', '10.01'])
      await productWith(6, ['999'], { maximumStock: null })
      await productWith(7, [])
      const noMinimum = await productWith(8, ['0'], {
        minimumStock: '0',
        maximumStock: null,
      })
      const inactive = await productWith(9, ['0'], { isActive: false })
      const expiredOfInactive = await insertStock({
        productId: inactive,
        expiryDate: daysAfter(today, -400),
        ...stock('0.01'),
      })
      const expiresToday = await insertStock({ expiryDate: today })
      const lastDay = await insertStock({ expiryDate: daysAfter(today, 30) })
      await insertStock({ expiryDate: daysAfter(today, 31) })
      await insertStock({ expiryDate: daysAfter(today, -1), ...stock('0') })
      const yesterday = await insertStock({
        expiryDate: daysAfter(today, -1),
        ...stock('0.01'),
      })

      const response = await list({ salonId, limit: 100 })

      expect(keysOf(response)).toEqual([
        `expired:${yesterday}`,
        `expiring:${expiresToday}`,
        `expiring:${lastDay}`,
        `low_stock:${atMinimum}`,
        `low_stock:${without}`,
        `overstock:${aboveMaximum}`,
        `low_stock:${noMinimum}`,
        `expired:${expiredOfInactive}`,
      ])
      expect(
        response.body.data.map(
          ({
            severity,
            currentStock,
            threshold,
          }: {
            severity: string
            currentStock: number
            threshold: number | null
          }) => `${severity} ${currentStock} ${threshold}`,
        ),
      ).toEqual([
        'critical 0.01 null',
        'warning 3 null',
        'warning 3 null',
        'warning 5 5',
        'critical 0 5',
        'info 20.01 20',
        'critical 0 0',
        'critical 0.01 null',
      ])
    })

    it('counts the stock of a product over its rows at the salon, and shows nothing of another salon', async () => {
      await insertStock(stock('2.5'))
      await insertStock(stock('2.5'))
      const otherSalon = await insertSalon(db)
      const ofOtherSalon = await insertProduct({ salonId: otherSalon })
      await insertStock({
        salonId: otherSalon,
        productId: ofOtherSalon,
        expiryDate: daysAfter(today, -1),
        ...stock('1'),
      })

      expect(keysOf(await list())).toEqual([`low_stock:${productId}`])
      expect(keysOf(await list({ salonId: otherSalon }))).toEqual([
        `low_stock:${ofOtherSalon}`,
        expect.stringMatching(/^expired:/),
      ])
      await insertStock(stock('0.01'))
      expect(keysOf(await list())).toEqual([])
    })

    it('puts the products in the order the database sorts their codes in', async () => {
      await db
        .update(products)
        .set({ productCode: 'C-1' })
        .where(eq(products.id, productId))
      await insertStock()
      for (const productCode of ['b-1', 'a-10', 'a-9', 'B-1', 'ｂ-1']) {
        await insertStock({ productId: await insertProduct({ productCode }) })
      }
      const sorted = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.salonId, salonId))
        .orderBy(asc(products.productCode), asc(products.id))

      expect(keysOf(await list())).toEqual(
        sorted.map(({ id }) => `low_stock:${id}`),
      )
    })

    it('narrows the alerts by type, severity and whether they are acknowledged, and counts those it keeps', async () => {
      const expired = await insertStock({
        expiryDate: daysAfter(today, -1),
        ...stock('1'),
      })
      const expiring = await insertStock({
        expiryDate: daysAfter(today, 1),
        ...stock('1'),
      })
      await acknowledged(ofRow('expiring', expiring))

      const page = (query: Record<string, unknown>) =>
        list({ salonId, ...query })

      expect(keysOf(await page({ alert: 'expired' }))).toEqual([
        `expired:${expired}`,
      ])
      expect(keysOf(await page({ severity: 'warning' }))).toEqual([
        `low_stock:${productId}`,
        `expiring:${expiring}`,
      ])
      expect(keysOf(await page({ acknowledged: true }))).toEqual([
        `expiring:${expiring}`,
      ])
      expect(
        keysOf(await page({ acknowledged: false, severity: 'warning' })),
      ).toEqual([`low_stock:${productId}`])
      const narrowed = await page({ acknowledged: false, limit: 1 })
      expect(narrowed.body.meta).toMatchObject({
        total: 2,
        hasMore: true,
        nextCursor: productId,
      })
      expect(narrowed.body.links.next).toBe(
        `${PATH}?salonId=${salonId}&acknowledged=false&limit=1&cursor=${productId}`,
      )
    })

    it('shows the acknowledgement that holds for an alert as the contract has it', async () => {
      const { authorization, staffId } = await memberWithStaff('staff')
      await insertStock()
      await acknowledge(
        ofProduct('low_stock', productId, '発注済み'),
        authorization,
      )
      const [stored] = await storedAcknowledgements()

      const alert = await listed(`low_stock:${productId}`)

      expect(alert.acknowledgement).toEqual({
        id: stored?.id,
        salonId,
        productId,
        inventoryId: null,
        alert: 'low_stock',
        severity: 'warning',
        threshold: 5,
        expiryDate: null,
        notes: '発注済み',
        acknowledgedBy: staffId,
        acknowledgedAt: expect.stringMatching(ISO_TIMESTAMP),
      })
      expect(Object.keys(alert.acknowledgement).toSorted()).toEqual(
        ACKNOWLEDGEMENT_PROPERTIES,
      )
    })

    it('pages through the alerts, the cursor being what the last alert of a page is about', async () => {
      const second = await insertProduct({ productCode: 'Z-2' })
      const third = await insertProduct({ productCode: 'Z-3' })
      await db
        .update(products)
        .set({ productCode: 'Z-1' })
        .where(eq(products.id, productId))
      const row = await insertStock({ expiryDate: daysAfter(today, -1) })
      await insertStock({ productId: second })
      await insertStock({ productId: third })
      const everything = keysOf(await list({ salonId, limit: 100 }))

      const pages: string[][] = []
      let cursor: string | undefined
      for (let page = 0; page < 5; page += 1) {
        const response = await list({
          salonId,
          limit: 2,
          ...(cursor === undefined ? {} : { cursor }),
        })
        pages.push(keysOf(response))
        expect(response.body.meta).toMatchObject({
          total: 4,
          limit: 2,
          cursor: cursor ?? null,
        })
        cursor = response.body.meta.nextCursor ?? undefined
        if (cursor === undefined) {
          expect(response.body.meta.hasMore).toBe(false)
          break
        }
      }

      expect(everything).toEqual([
        `low_stock:${productId}`,
        `expired:${row}`,
        `low_stock:${second}`,
        `low_stock:${third}`,
      ])
      expect(pages).toEqual([everything.slice(0, 2), everything.slice(2)])
    })

    it('goes on after where an alert stood when it is gone', async () => {
      const second = await insertProduct({ productCode: 'Z-2' })
      await db
        .update(products)
        .set({ productCode: 'Z-1' })
        .where(eq(products.id, productId))
      const row = await insertStock()
      await insertStock({ productId: second })
      const first = await list({ salonId, limit: 1 })
      expect(first.body.meta.nextCursor).toBe(productId)

      await move(row, 10)
      const next = await list({ salonId, limit: 1, cursor: productId })

      expect(keysOf(next)).toEqual([`low_stock:${second}`])
      expect(next.body.meta).toMatchObject({ total: 1, hasMore: false })
    })

    it('goes on after a stock row named as the cursor', async () => {
      const expired = await insertStock({ expiryDate: daysAfter(today, -2) })
      const expiring = await insertStock({ expiryDate: daysAfter(today, 2) })

      expect(keysOf(await list({ salonId, cursor: expired }))).toEqual([
        `expiring:${expiring}`,
      ])
      expect(
        keysOf(await list({ salonId, cursor: expired.toUpperCase() })),
      ).toEqual([`expiring:${expiring}`])
      expect(keysOf(await list({ salonId, cursor: expiring }))).toEqual([])
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_case, tokenOf, problem, challenge) => {
        const response = await list({ salonId }, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it.each(outsiders)('refuses %s', async (_who, signInAs) => {
      expectProblem(await list({ salonId }, await signInAs()), forbidden)
    })

    it('refuses a member of another salon, and one who names a salon that is not there', async () => {
      const outsider = await member('owner', () => insertSalon(db))()

      expectProblem(await list({ salonId }, outsider), forbidden)
      expectProblem(await list({ salonId: UNKNOWN_ID }, outsider), forbidden)
    })

    // What the query has besides the salon of the tests; the salon is left
    // out where the value is null.
    it.each<[string, Record<string, unknown> | null, string[]]>([
      ['no salon', null, ['salonId:invalid_type']],
      [
        'values that are no values',
        { alert: 'soon', severity: 'high', cursor: 'next' },
        [
          'cursor:invalid_format',
          'alert:invalid_value',
          'severity:invalid_value',
        ],
      ],
      [
        'an acknowledgement that is neither true nor false',
        { acknowledged: 'maybe' },
        ['acknowledged:invalid_value'],
      ],
      ['a limit of none', { limit: 0 }, ['limit:too_small']],
      ['a limit that is no number', { limit: 'ten' }, ['limit:invalid_format']],
      [
        'a parameter it does not know',
        { type: 'expired' },
        ['type:unrecognized_keys'],
      ],
    ])('refuses a query with %s', async (_case, query, rules) => {
      const response = await list(query === null ? {} : { salonId, ...query })

      expectRefused(response, INVALID_SEARCH)
      expect(brokenRules(response).toSorted()).toEqual(rules.toSorted())
    })

    it.each([
      ['that is not there', async () => UNKNOWN_ID],
      [
        'that is deleted',
        () => insertSalon(db, { deletedAt: '2026-11-01T00:00:00.000Z' }),
      ],
    ])('tells an administrator of a salon %s', async (_case, salonOf) => {
      expectRefused(await list({ salonId: await salonOf() }), INVALID_SEARCH, [
        issue('salonId', 'not_found', 'Must name a salon'),
      ])
    })

    it.each([
      ['nothing', async () => UNKNOWN_ID],
      [
        'a product of another salon',
        async () => insertProduct({ salonId: await insertSalon(db) }),
      ],
      [
        'a stock row of another salon',
        async () => {
          const otherSalon = await insertSalon(db)
          return insertStock({
            salonId: otherSalon,
            productId: await insertProduct({ salonId: otherSalon }),
          })
        },
      ],
    ])('refuses a cursor that names %s', async (_case, cursorOf) => {
      expectRefused(
        await list({ salonId, cursor: await cursorOf() }),
        INVALID_SEARCH,
        [
          issue(
            'cursor',
            'not_found',
            'Must name a product or a stock row of the salon',
          ),
        ],
      )
    })

    it('fails on a salon whose time zone the runtime does not know', async () => {
      const unknownZone = await insertSalon(db, {
        timezone: 'Mars/Olympus_Mons',
      })

      expectProblem(await list({ salonId: unknownZone }), databaseProblem)
    })
  })

  describe('GET /api/v1/inventory-alerts/summary', () => {
    it('counts the alerts of the salon as they are now, and answers 200 as the contract has it', async () => {
      await insertStock({ expiryDate: daysAfter(today, -1), ...stock('1') })
      const expiring = await insertStock({
        expiryDate: daysAfter(today, 3),
        ...stock('1'),
      })
      const over = await insertProduct()
      await insertStock({ productId: over, ...stock('21') })
      const out = await insertProduct()
      await insertStock({ productId: out, ...stock('0') })
      await acknowledged(ofRow('expiring', expiring))

      const response = await summary()

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        data: {
          totalAlerts: 5,
          criticalAlerts: 2,
          warningAlerts: 2,
          infoAlerts: 1,
          unacknowledged: 4,
        },
        meta: expect.objectContaining({
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
        }),
        links: { self: `${PATH}/summary?salonId=${salonId}` },
      })
      expect(response.body.data.totalAlerts).toBe(
        (await list({ salonId, limit: 100 })).body.meta.total,
      )
    })

    it.each(readers)('counts them for %s', async (_who, signInAs) => {
      await insertStock()

      const response = await summary({ salonId }, await signInAs())

      expect(response.status).toBe(200)
      expect(response.body.data).toMatchObject({ totalAlerts: 1 })
    })

    it('counts nothing of a salon without alerts', async () => {
      expect((await summary()).body.data).toEqual({
        totalAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        infoAlerts: 0,
        unacknowledged: 0,
      })
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_case, tokenOf, problem, challenge) => {
        const response = await summary({ salonId }, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it.each(outsiders)('refuses %s', async (_who, signInAs) => {
      expectProblem(await summary({ salonId }, await signInAs()), forbidden)
    })

    it('refuses a member of another salon', async () => {
      const outsider = await member('manager', () => insertSalon(db))()

      expectProblem(await summary({ salonId }, outsider), forbidden)
    })

    it.each<[string, (salon: string) => Record<string, unknown>, string[]]>([
      ['no salon', () => ({}), ['salonId:invalid_type']],
      [
        'a salon that is no ID',
        () => ({ salonId: 'aoyama' }),
        ['salonId:invalid_format'],
      ],
      [
        'a filter, which only the list takes',
        (salon) => ({ salonId: salon, alert: 'expired' }),
        ['alert:unrecognized_keys'],
      ],
    ])('refuses a query with %s', async (_case, queryOf, rules) => {
      const response = await summary(queryOf(salonId))

      expectRefused(response, INVALID_SUMMARY)
      expect(brokenRules(response)).toEqual(rules)
    })

    it('tells an administrator of a salon that is not there', async () => {
      expectRefused(await summary({ salonId: UNKNOWN_ID }), INVALID_SUMMARY, [
        issue('salonId', 'not_found', 'Must name a salon'),
      ])
    })

    it('fails on a salon whose time zone the runtime does not know', async () => {
      const unknownZone = await insertSalon(db, {
        timezone: 'Mars/Olympus_Mons',
      })

      expectProblem(await summary({ salonId: unknownZone }), databaseProblem)
    })
  })

  describe('POST /api/v1/inventory-alerts/acknowledge', () => {
    it('acknowledges an alert of a product as it is now, and answers 200 with it as the contract has it', async () => {
      const { authorization, staffId } = await memberWithStaff('manager')
      await insertStock()

      const response = await acknowledge(
        ofProduct('low_stock', productId, '発注済み'),
        authorization,
      )

      expect(response.status).toBe(200)
      const [stored] = await storedAcknowledgements()
      expect(stored).toEqual({
        id: expect.stringMatching(UUID),
        salonId,
        productId,
        inventoryId: null,
        alert: 'low_stock',
        severity: 'warning',
        threshold: '5.00',
        expiryDate: null,
        notes: '発注済み',
        acknowledgedBy: staffId,
        acknowledgedAt: expect.any(String),
      })
      expect(response.body).toEqual({
        data: {
          alert: 'low_stock',
          severity: 'warning',
          salonId,
          productId,
          productCode: expect.any(String),
          productName: 'シャンプー',
          unit: '本',
          inventoryId: null,
          lotNumber: null,
          expiryDate: null,
          currentStock: 3,
          threshold: 5,
          acknowledgement: {
            id: stored?.id,
            salonId,
            productId,
            inventoryId: null,
            alert: 'low_stock',
            severity: 'warning',
            threshold: 5,
            expiryDate: null,
            notes: '発注済み',
            acknowledgedBy: staffId,
            acknowledgedAt: expect.stringMatching(ISO_TIMESTAMP),
          },
        },
        meta: expect.objectContaining({
          timestamp: expect.stringMatching(ISO_TIMESTAMP),
        }),
        links: {
          list: `${PATH}?salonId=${salonId}`,
          summary: `${PATH}/summary?salonId=${salonId}`,
        },
      })
      expect((await listed(`low_stock:${productId}`)).acknowledgement).toEqual(
        response.body.data.acknowledgement,
      )
    })

    it.each(readers)('acknowledges for %s', async (_who, signInAs) => {
      await insertStock()

      const response = await acknowledge(
        ofProduct('low_stock'),
        await signInAs(),
      )

      expect(response.status).toBe(200)
      expect(await storedAcknowledgements()).toHaveLength(1)
    })

    it('records an administrator as nobody of the salon', async () => {
      await insertStock()

      const response = await acknowledged(ofProduct('low_stock'))

      expect(response.body.data.acknowledgement.acknowledgedBy).toBeNull()
    })

    it('acknowledges the alerts of stock rows with the expiry date they have', async () => {
      const expired = await insertStock({ expiryDate: daysAfter(today, -3) })
      const expiring = await insertStock({ expiryDate: daysAfter(today, 3) })

      const first = await acknowledged(
        ofRow('expired', expired, productId, '廃棄予定'),
      )
      const second = await acknowledged(ofRow('expiring', expiring))

      expect(first.body.data.acknowledgement).toMatchObject({
        inventoryId: expired,
        alert: 'expired',
        severity: 'critical',
        threshold: null,
        expiryDate: daysAfter(today, -3),
        notes: '廃棄予定',
      })
      expect(second.body.data.acknowledgement).toMatchObject({
        inventoryId: expiring,
        alert: 'expiring',
        severity: 'warning',
        expiryDate: daysAfter(today, 3),
      })
      expect((await summary()).body.data).toMatchObject({
        totalAlerts: 2,
        unacknowledged: 0,
      })
    })

    it('acknowledges too much stock at the maximum it has', async () => {
      await insertStock(stock('25'))

      const response = await acknowledged(ofProduct('overstock'))

      expect(response.body.data.acknowledgement).toMatchObject({
        alert: 'overstock',
        severity: 'info',
        threshold: 20,
      })
    })

    it('refuses an alert an acknowledgement still holds for, as a conflict', async () => {
      const row = await insertStock()
      await acknowledged(ofProduct('low_stock'))
      await move(row, -1)
      await move(row, 1.5)

      const response = await acknowledge(ofProduct('low_stock'))

      expectProblem(response, notAllowed)
      expect(response.body.detail).toBe(
        `Inventory alert low_stock:${productId} is acknowledged already: an acknowledgement holds while what it was given for lasts`,
      )
      expect(await storedAcknowledgements()).toHaveLength(1)
      expect(
        (await listed(`low_stock:${productId}`)).acknowledgement,
      ).not.toBeNull()
    })

    describe('how long an acknowledgement holds', () => {
      it('no longer holds for a low stock that ran out since it was acknowledged as a warning', async () => {
        const row = await insertStock()
        await acknowledged(ofProduct('low_stock'))

        await move(row, -3)

        const alert = await listed(`low_stock:${productId}`)
        expect(alert).toMatchObject({
          severity: 'critical',
          acknowledgement: null,
        })
        const again = await acknowledged(ofProduct('low_stock'))
        expect(again.body.data.acknowledgement.severity).toBe('critical')
        await move(row, 2)
        expect(
          (await listed(`low_stock:${productId}`)).acknowledgement,
        ).toMatchObject({ severity: 'critical' })
      })

      it('no longer holds once the stock went above the minimum, even when it came back below', async () => {
        const row = await insertStock()
        await acknowledged(ofProduct('low_stock'))

        await move(row, 2.01)
        await move(row, -0.02)

        expect(
          (await listed(`low_stock:${productId}`)).acknowledgement,
        ).toBeNull()
        await acknowledged(ofProduct('low_stock'))
      })

      it('holds while the stock went up to the minimum and no further', async () => {
        const row = await insertStock()
        await acknowledged(ofProduct('low_stock'))

        await move(row, 2)
        await move(row, -4.5)

        expect(
          (await listed(`low_stock:${productId}`)).acknowledgement,
        ).not.toBeNull()
      })

      it('no longer holds once the minimum of the product changed', async () => {
        await insertStock()
        await acknowledged(ofProduct('low_stock'))

        const changed = await request(app)
          .patch(`/api/v1/salons/${salonId}/products/${productId}`)
          .set('Authorization', asAdmin)
          .send({ minimumStock: 4 })
        expect(changed.status).toBe(200)

        expect(await listed(`low_stock:${productId}`)).toMatchObject({
          threshold: 4,
          acknowledgement: null,
        })
      })

      it('still holds once a product that was not carried for a while is carried again', async () => {
        await insertStock()
        await acknowledged(ofProduct('low_stock'))
        const carried = (isActive: boolean) =>
          request(app)
            .patch(`/api/v1/salons/${salonId}/products/${productId}`)
            .set('Authorization', asAdmin)
            .send({ isActive })

        expect((await carried(false)).status).toBe(200)
        expect(await listed(`low_stock:${productId}`)).toBeUndefined()
        expect((await carried(true)).status).toBe(200)

        expect(
          (await listed(`low_stock:${productId}`)).acknowledgement,
        ).not.toBeNull()
      })

      it('no longer holds for too much stock that came down to the maximum since', async () => {
        const row = await insertStock(stock('25'))
        await acknowledged(ofProduct('overstock'))

        await move(row, -5)
        expect(await listed(`overstock:${productId}`)).toBeUndefined()
        await move(row, 1)

        expect(
          (await listed(`overstock:${productId}`)).acknowledgement,
        ).toBeNull()
      })

      it('holds for a stock row while it keeps its expiry date and some stock', async () => {
        const row = await insertStock({ expiryDate: daysAfter(today, 5) })
        await acknowledged(ofRow('expiring', row))

        await move(row, -2.99)
        await move(row, 5)

        expect((await listed(`expiring:${row}`)).acknowledgement).not.toBeNull()
      })

      it('no longer holds for a stock row whose stock ran out since, though it was stocked again', async () => {
        const row = await insertStock({ expiryDate: daysAfter(today, 5) })
        await acknowledged(ofRow('expiring', row))

        await move(row, -3)
        expect(await listed(`expiring:${row}`)).toBeUndefined()
        await move(row, 1)

        expect((await listed(`expiring:${row}`)).acknowledgement).toBeNull()
      })

      it('no longer holds for a stock row whose expiry date changed', async () => {
        const row = await insertStock({ expiryDate: daysAfter(today, 5) })
        await acknowledged(ofRow('expiring', row))

        const changed = await request(app)
          .patch(`/api/v1/inventory/${row}`)
          .set('Authorization', asAdmin)
          .send({ expiryDate: daysAfter(today, 6) })
        expect(changed.status).toBe(200)

        expect((await listed(`expiring:${row}`)).acknowledgement).toBeNull()
      })

      it('holds for one alert, not for another of the same product or row', async () => {
        const row = await insertStock({ expiryDate: daysAfter(today, -1) })
        await acknowledged(ofProduct('low_stock'))

        await move(row, 30)

        expect(await listed(`overstock:${productId}`)).toMatchObject({
          acknowledgement: null,
        })
        expect((await listed(`expired:${row}`)).acknowledgement).toBeNull()
      })
    })

    it.each(unauthenticated)(
      'refuses %s',
      async (_case, tokenOf, problem, challenge) => {
        await insertStock()

        const response = await acknowledge(
          ofProduct('low_stock'),
          await tokenOf(),
        )

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
        expect(await storedAcknowledgements()).toEqual([])
      },
    )

    it.each(outsiders)('refuses %s', async (_who, signInAs) => {
      await insertStock()

      expectProblem(
        await acknowledge(ofProduct('low_stock'), await signInAs()),
        forbidden,
      )
      expect(await storedAcknowledgements()).toEqual([])
    })

    it.each<[string, (product: string) => object | undefined, string[]]>([
      ['no body', () => undefined, [':invalid_type']],
      [
        'nothing it needs',
        () => ({}),
        [
          'alert:invalid_value',
          'productId:invalid_type',
          'inventoryId:invalid_type',
          'notes:invalid_type',
        ],
      ],
      [
        'IDs that are no IDs',
        () => ({
          alert: 'expired',
          productId: 'p',
          inventoryId: 'r',
          notes: null,
        }),
        ['productId:invalid_format', 'inventoryId:invalid_format'],
      ],
      [
        'a severity, which is the alert’s',
        (product) => ({ ...ofProduct('low_stock', product), severity: 'info' }),
        ['severity:unrecognized_keys'],
      ],
      [
        'blank notes',
        (product) => ({ ...ofProduct('low_stock', product), notes: '\t' }),
        ['notes:invalid_format'],
      ],
    ])('refuses a request with %s', async (_case, bodyOf, rules) => {
      await insertStock()

      const response = await acknowledge(bodyOf(productId))

      expectRefused(response, INVALID_ACKNOWLEDGEMENT)
      expect(brokenRules(response)).toEqual(rules)
      expect(await storedAcknowledgements()).toEqual([])
    })

    it('refuses a stock row named for an alert of a product, and none for an alert of a row', async () => {
      const row = await insertStock({ expiryDate: daysAfter(today, -1) })

      expectRefused(
        await acknowledge({ ...ofProduct('low_stock'), inventoryId: row }),
        INVALID_ACKNOWLEDGEMENT,
        [
          issue(
            'inventoryId',
            'custom',
            'Must be null for an alert of a product (low_stock)',
          ),
        ],
      )
      expectRefused(
        await acknowledge({ ...ofRow('expired', row), inventoryId: null }),
        INVALID_ACKNOWLEDGEMENT,
        [
          issue(
            'inventoryId',
            'custom',
            'Must name a stock row for an alert of a stock row (expired)',
          ),
        ],
      )
    })

    it.each<
      [string, () => Promise<ReturnType<typeof ofProduct | typeof ofRow>>]
    >([
      [
        'a product that is not there',
        async () => ofProduct('low_stock', UNKNOWN_ID),
      ],
      [
        'a low stock of a product with enough',
        async () => {
          const enough = await insertProduct()
          await insertStock({ productId: enough, ...stock('6') })
          return ofProduct('low_stock', enough)
        },
      ],
      [
        'too much stock of a product with little',
        async () => ofProduct('overstock'),
      ],
      [
        'a low stock of a product without stock rows at the salon',
        async () => ofProduct('low_stock', await insertProduct()),
      ],
      [
        'a low stock of an inactive product',
        async () => {
          const inactive = await insertProduct({ isActive: false })
          await insertStock({ productId: inactive })
          return ofProduct('low_stock', inactive)
        },
      ],
      [
        'a stock row that is not there',
        async () => ofRow('expired', UNKNOWN_ID),
      ],
      [
        'a stock row of another product',
        async () =>
          ofRow(
            'expired',
            await insertStock({
              productId: await insertProduct(),
              expiryDate: daysAfter(today, -1),
            }),
          ),
      ],
      [
        'a stock row that expires later',
        async () =>
          ofRow(
            'expiring',
            await insertStock({ expiryDate: daysAfter(today, 31) }),
          ),
      ],
      [
        'a stock row that expires soon, as expired',
        async () =>
          ofRow(
            'expired',
            await insertStock({ expiryDate: daysAfter(today, 1) }),
          ),
      ],
      [
        'a stock row without stock',
        async () =>
          ofRow(
            'expired',
            await insertStock({
              expiryDate: daysAfter(today, -1),
              ...stock('0'),
            }),
          ),
      ],
    ])('does not find %s', async (_case, bodyOf) => {
      await insertStock()
      const body = await bodyOf()

      const response = await acknowledge(body)

      expectProblem(response, notFound)
      expect(response.body.detail).toBe(
        `InventoryAlert ${body.alert}:${body.inventoryId ?? body.productId} was not found`,
      )
      expect(await storedAcknowledgements()).toEqual([])
    })

    it('does not find for a member the alerts of another salon, which an administrator acknowledges', async () => {
      const otherSalon = await insertSalon(db)
      const ofOtherSalon = await insertProduct({ salonId: otherSalon })
      await insertStock({ salonId: otherSalon, productId: ofOtherSalon })
      const owner = await member('owner')()

      expectProblem(
        await acknowledge(ofProduct('low_stock', ofOtherSalon), owner),
        notFound,
      )
      const response = await acknowledged(ofProduct('low_stock', ofOtherSalon))
      expect(response.body.data.salonId).toBe(otherSalon)
    })

    it('fails on a salon whose time zone the runtime does not know', async () => {
      const unknownZone = await insertSalon(db, {
        timezone: 'Mars/Olympus_Mons',
      })
      const product = await insertProduct({ salonId: unknownZone })
      await insertStock({ salonId: unknownZone, productId: product })

      expectProblem(
        await acknowledge(ofProduct('low_stock', product)),
        databaseProblem,
      )
      expect(await storedAcknowledgements()).toEqual([])
    })
  })

  it.each<[string, 'get' | 'post' | 'patch' | 'delete', string]>([
    ['an acknowledgement read', 'get', '/acknowledge'],
    ['a list written to', 'post', ''],
    ['a summary written to', 'post', '/summary'],
    ['an alert of its own', 'get', `/${UNKNOWN_ID}`],
    ['an alert changed', 'patch', `/${UNKNOWN_ID}`],
    ['an alert deleted', 'delete', `/${UNKNOWN_ID}`],
  ])('has no route for %s', async (_case, method, path) => {
    const response = await request(app)
      [method](`${PATH}${path}`)
      .set('Authorization', asAdmin)
      .send({})

    expectProblem(response, {
      status: 404,
      code: '3001',
      type: 'route-not-found',
    })
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

    it('acknowledges an alert once when it is acknowledged several times at the same moment', async () => {
      await insertStock()

      const responses = await Promise.all(
        Array.from({ length: 5 }, () => acknowledge(ofProduct('low_stock'))),
      )

      expect(responses.map(statusAndCode).toSorted()).toEqual([
        '200',
        '409 3003',
        '409 3003',
        '409 3003',
        '409 3003',
      ])
      expect(await storedAcknowledgements()).toHaveLength(1)
    })

    it('makes an acknowledgement wait for a movement of a row of the product, and decides on the stock it leaves', async () => {
      const row = await insertStock()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, row)
          await tx
            .update(inventory)
            .set(stock('0'))
            .where(eq(inventory.id, row))
          await tx.insert(inventoryTransactions).values({
            salonId,
            productId,
            inventoryId: row,
            transactionType: 'sale',
            quantity: '-3',
            balanceBefore: '3',
            balanceAfter: '0',
            createdAt: sql`clock_timestamp()`,
          })
          const underWay = acknowledge(ofProduct('low_stock')).then(
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
      expect(response.status).toBe(200)
      expect(response.body.data.acknowledgement).toMatchObject({
        severity: 'critical',
      })
      expect(
        (await listed(`low_stock:${productId}`)).acknowledgement,
      ).not.toBeNull()
    })

    it('times an acknowledgement that waited for a movement after the movement, so that it holds on the stock the movement left', async () => {
      const row = await insertStock(stock('8'))

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await holdRow(tx, row)
          const underWay = acknowledge(ofProduct('low_stock')).then(
            (response) => response,
          )
          const answered = await answersWithin(underWay, 300)
          // The movement is written while the acknowledgement waits for it.
          await tx
            .update(inventory)
            .set(stock('3'))
            .where(eq(inventory.id, row))
          await tx.insert(inventoryTransactions).values({
            salonId,
            productId,
            inventoryId: row,
            transactionType: 'sale',
            quantity: '-5',
            balanceBefore: '8',
            balanceAfter: '3',
            createdAt: sql`clock_timestamp()`,
          })

          return { pending: underWay, answeredWhileHeld: answered }
        },
      )
      const response = await pending

      expect(answeredWhileHeld).toBe(false)
      expect(response.status).toBe(200)
      expect(response.body.data.acknowledgement).toMatchObject({
        severity: 'warning',
        threshold: 5,
      })
      expect(
        (await listed(`low_stock:${productId}`)).acknowledgement,
      ).toMatchObject({ id: response.body.data.acknowledgement.id })
    })

    it('reads the alerts and their acknowledgements at one moment', async () => {
      await insertStock()
      /** Whether a request came to wait for the table of the acknowledgements. */
      const waitedFor = async (): Promise<boolean> => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
          const [locks] = await db.execute(
            sql`SELECT count(*)::int AS "waiting" FROM pg_locks WHERE NOT granted AND relation = 'inventory_alert_acknowledgements'::regclass`,
          )
          if (Number(locks?.['waiting']) > 0) {
            return true
          }
          await pause(20)
        }
        return false
      }

      const { pending, waited } = await db.transaction(async (tx) => {
        await tx.execute(
          sql`LOCK TABLE ${inventoryAlertAcknowledgements} IN ACCESS EXCLUSIVE MODE`,
        )
        const underWay = list().then((response) => response)
        // The list has read the alert and waits to read its acknowledgements;
        // one is written meanwhile.
        const blocked = await waitedFor()
        await tx.insert(inventoryAlertAcknowledgements).values({
          salonId,
          productId,
          inventoryId: null,
          alert: 'low_stock',
          severity: 'warning',
          threshold: '5',
          expiryDate: null,
          notes: null,
          acknowledgedBy: null,
          acknowledgedAt: sql`clock_timestamp()`,
        })

        return { pending: underWay, waited: blocked }
      })
      const response = await pending

      expect(waited).toBe(true)
      expect(response.status).toBe(200)
      expect(response.body.data).toEqual([
        expect.objectContaining({ alert: 'low_stock', acknowledgement: null }),
      ])
      expect(
        (await listed(`low_stock:${productId}`)).acknowledgement,
      ).not.toBeNull()
    })

    it('makes an acknowledgement wait for a change of the product, and decides on its new minimum', async () => {
      await insertStock()

      const { pending, answeredWhileHeld } = await db.transaction(
        async (tx) => {
          await tx
            .update(products)
            .set({ minimumStock: '2' })
            .where(eq(products.id, productId))
          const underWay = acknowledge(ofProduct('low_stock')).then(
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
      expectProblem(response, notFound)
    })

    it('lets a stock row of the product be added while the product is held as an acknowledgement holds it', async () => {
      const answered = await db.transaction(async (tx) => {
        await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId))
          .for('no key update')
        return answersWithin(
          request(app)
            .post('/api/v1/inventory')
            .set('Authorization', asAdmin)
            .send({
              salonId,
              productId,
              lotNumber: 'LOT-NEW',
              expiryDate: null,
              location: null,
              shelf: null,
              notes: null,
            })
            .then((response) => response),
          2_000,
        )
      })

      expect(answered).toBe(true)
    })

    it('reads the alerts while the rows of the salon are held', async () => {
      const row = await insertStock()

      const answered = await db.transaction(async (tx) => {
        await holdRow(tx, row)
        return answersWithin(
          Promise.all([list(), summary()]).then(([listing]) => listing),
          2_000,
        )
      })

      expect(answered).toBe(true)
    })
  })

  describe('InventoryAlertRepository', () => {
    const dataOf = <T>(result: Result<T, DomainError>): T => {
      if (result.type === 'error') {
        throw new Error(`Expected success, got ${JSON.stringify(result.error)}`)
      }
      return result.data
    }

    const repository = () => new InventoryAlertRepository(db)
    const criteria = () => ({
      salonId: salonIdSchema.parse(salonId),
      lastExpiringDay: daysAfter(today, 30),
    })

    /**
     * A movement of a stock row of the product of the tests, or of another
     * product, some seconds after an acknowledgement; before it when the
     * seconds are negative.
     */
    const movedAfter =
      (acknowledgedAt: string | undefined, product: string = productId) =>
      (
        inventoryId: string,
        seconds: number,
        [balanceBefore, quantity, balanceAfter]: [string, string, string],
      ): NewMovement => ({
        salonId,
        productId: product,
        inventoryId,
        transactionType: 'adjustment',
        quantity,
        balanceBefore,
        balanceAfter,
        reason: '再計算の確認',
        createdAt: sql`${acknowledgedAt}::timestamptz + make_interval(secs => ${seconds})`,
      })

    it('works out the lowest and the highest stock since an acknowledgement exactly, moment by moment', async () => {
      const first = await insertStock()
      const second = await insertStock(stock('1'))
      await acknowledged(ofProduct('low_stock'))
      const [stored] = await storedAcknowledgements()
      const moved = movedAfter(stored?.acknowledgedAt)
      // The stock of the product: 4.00 at the acknowledgement; still 4.00
      // after a moment that moves 0.10 from one row to the other; 4.90,
      // 4.00 and 3.95 after the moments that follow.
      await db
        .insert(inventoryTransactions)
        .values([
          moved(first, 1, ['3.00', '0.10', '3.10']),
          moved(second, 1, ['1.00', '-0.10', '0.90']),
          moved(first, 2, ['3.10', '0.90', '4.00']),
          moved(second, 3, ['0.90', '-0.90', '0.00']),
          moved(first, 4, ['4.00', '-0.05', '3.95']),
        ])
      await db
        .update(inventory)
        .set(stock('3.95'))
        .where(eq(inventory.id, first))
      await db.update(inventory).set(stock('0')).where(eq(inventory.id, second))

      const facts = dataOf(await repository().listFacts(criteria()))

      expect(facts.acknowledgements).toEqual([
        {
          type: 'product',
          acknowledgement: expect.objectContaining({ id: stored?.id }),
          lowestStock: '3.95',
          highestStock: '4.90',
        },
      ])
      expect(
        (await listed(`low_stock:${productId}`)).acknowledgement,
      ).toMatchObject({
        id: stored?.id,
      })
    })

    it.each<[string, [string, string, string][], string, string]>([
      [
        'when the stock was at its lowest then',
        [
          ['3.00', '0.50', '3.50'],
          ['3.50', '0.50', '4.00'],
        ],
        '3.00',
        '4.00',
      ],
      [
        'when the stock was at its highest then',
        [
          ['3.00', '-0.50', '2.50'],
          ['2.50', '-0.50', '2.00'],
        ],
        '2.00',
        '3.00',
      ],
    ])(
      'counts the stock at the acknowledgement itself %s, and only the movements of its product after it',
      async (_case, after, lowestStock, highestStock) => {
        const row = await insertStock()
        const other = await insertProduct()
        const otherRow = await insertStock({ productId: other })
        await acknowledged(ofProduct('low_stock'))
        const [stored] = await storedAcknowledgements()
        const moved = movedAfter(stored?.acknowledgedAt)
        await db.insert(inventoryTransactions).values([
          // How the stock of the product came to be 3 before.
          moved(row, -10, ['1.00', '2.00', '3.00']),
          ...after.map((balances, index) => moved(row, index + 1, balances)),
          // Another product of the salon, at the moment of the first.
          movedAfter(stored?.acknowledgedAt, other)(otherRow, 1, [
            '3.00',
            '-3.00',
            '0.00',
          ]),
        ])
        await db
          .update(inventory)
          .set(stock(after.at(-1)?.[2] ?? '3.00'))
          .where(eq(inventory.id, row))
        await db
          .update(inventory)
          .set(stock('0'))
          .where(eq(inventory.id, otherRow))

        const facts = dataOf(await repository().listFacts(criteria()))

        expect(facts.acknowledgements).toEqual([
          {
            type: 'product',
            acknowledgement: expect.objectContaining({ id: stored?.id }),
            lowestStock,
            highestStock,
          },
        ])
      },
    )

    it('tells the place of a product among every product of the salon, deleted ones included', async () => {
      await db
        .update(products)
        .set({ productCode: 'B' })
        .where(eq(products.id, productId))
      await insertProduct({
        productCode: 'A',
        deletedAt: '2026-11-01T00:00:00.000Z',
      })
      await insertStock()

      const facts = dataOf(await repository().listFacts(criteria()))
      const after = dataOf(
        await repository().listFactsAfter(criteria(), productId),
      )

      expect(facts.products).toEqual([
        expect.objectContaining({ productId, stock: '3.00', place: 2 }),
      ])
      expect(after).toMatchObject({
        type: 'listed',
        after: { place: 2, inventoryId: null, expiryDate: null },
      })
    })

    it('fails when the database does not answer', async () => {
      const connection = connectUnreachableDatabase()
      const unreachable = new InventoryAlertRepository(connection.database)

      const results = [
        await unreachable.listFacts(criteria()),
        await unreachable.listFactsAfter(criteria(), UNKNOWN_ID),
        await unreachable.acknowledge(
          { type: 'everySalon' },
          {
            alert: 'low_stock',
            productId,
            inventoryId: null,
            notes: null,
            acknowledgedBy: null,
          },
          new Date(),
        ),
      ]
      await connection.close()

      expect(
        results.map((result) => result.type === 'error' && result.error.type),
      ).toEqual(['database', 'database', 'database'])
    })
  })
})
