import { randomUUID } from 'node:crypto'
import {
  bookingServices,
  bookings,
  customerAllergies,
  customerPoints,
  customerPreferences,
  customers,
  medicalCharts,
  paymentMethods,
  paymentTransactions,
  products,
  reviewHelpfulVotes,
  reviews,
  sales,
  salesDetails,
  services,
  treatmentMaterials,
  treatmentPhotos,
  treatmentRecords,
} from '@beauty-salon-backend/database'
import { customerIdSchema } from '@beauty-salon-backend/domain'
import { CustomerRepository } from '@beauty-salon-backend/infrastructure'
import { eq } from 'drizzle-orm'
import type { Express } from 'express'
import type { Test } from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  insertMember,
  insertSalon,
  insertSession,
  insertStaff,
  insertUser,
  minutesFromNow,
  signedInUser,
  signIn,
} from './_shared/auth-helpers'
import { paymentColumns } from './_shared/payment-helpers'
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

const CUSTOMERS = '/api/v1/customers'
const EXPORT = `${CUSTOMERS}/export`

/** A UUID that no customer has. */
const UNKNOWN_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

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

/** The columns of the CSV file, in the order of the contract. */
const COLUMNS = [
  'id',
  'userId',
  'firstName',
  'lastName',
  'firstNameKana',
  'lastNameKana',
  'email',
  'phoneNumber',
  'alternativePhone',
  'postalCode',
  'prefecture',
  'city',
  'address',
  'building',
  'birthDate',
  'gender',
  'occupation',
  'membershipTier',
  'loyaltyPoints',
  'preferences',
  'notes',
  'internalNotes',
  'tags',
  'referredBy',
  'referralCode',
  'allowMarketing',
  'allowSms',
  'allowEmail',
  'firstVisitDate',
  'lastVisitDate',
  'visitCount',
  'noShowCount',
  'cancellationCount',
  'isActive',
  'hairType',
  'hairThickness',
  'scalpCondition',
  'customerStatus',
  'createdAt',
  'updatedAt',
]

/** A request that satisfies every rule, with a value for every property. */
const customerRequest = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Hanako',
  lastName: 'Yamada',
  firstNameKana: 'ハナコ',
  lastNameKana: 'ヤマダ',
  email: `customer-${randomUUID()}@example.com`,
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: '南青山1-2-3',
  building: null,
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: 'Designer',
  membershipTier: 'gold',
  preferences: { preferredServices: ['cut'], notes: null },
  notes: 'Likes to talk about films',
  internalNotes: null,
  tags: [],
  referredBy: null,
  referralCode: null,
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: 'medium',
  scalpCondition: 'sensitive',
  customerStatus: 'active',
  ...overrides,
})

/**
 * The body of a response as the bytes that were sent; a problem, which is
 * JSON, as its object.
 */
const asBytes = (call: Test): Test =>
  call.buffer(true).parse((response, done) => {
    const chunks: Buffer[] = []
    response.on('data', (chunk: Buffer) => chunks.push(chunk))
    response.on('end', () => {
      const bytes = Buffer.concat(chunks)
      done(
        null,
        String(response.headers['content-type']).includes('json')
          ? JSON.parse(bytes.toString('utf8'))
          : bytes,
      )
    })
  })

/** The rows of a CSV text, as RFC 4180 reads them: quoted fields may hold anything. */
const rowsOf = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index)
    if (quoted) {
      if (char === '"' && text.charAt(index + 1) === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\r' && text.charAt(index + 1) === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      index += 1
    } else {
      cell += char
    }
  }
  if (cell !== '' || row.length > 0) {
    throw new Error(`The file does not end with CRLF: ${JSON.stringify(cell)}`)
  }
  return rows
}

/** A value of a customer response as its cell: what the contract states. */
const cellOf = (value: unknown): string =>
  value === null
    ? ''
    : typeof value === 'string'
      ? /^[=+\-@\t\r]/.test(value)
        ? `'${value}`
        : value
      : JSON.stringify(value)

const pause = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

/** Waits until as many statements as `count` wait for a lock. */
const untilWaiting = async (
  client: ReturnType<typeof getTestDbClient>,
  count = 1,
): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const [activity] = await client<{ waiting: number }[]>`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `
    if ((activity?.waiting ?? 0) >= count) {
      return
    }
    await pause(10)
  }
  throw new Error(`Fewer than ${count} statements waited for a lock`)
}

/** Today in UTC, as the name of an export spells it. */
const todayInUtc = (): string => new Date().toISOString().slice(0, 10)

describe('Customer export API', () => {
  let app: Express
  let db: ReturnType<typeof getTestDb>
  /** The Authorization header of a signed-in admin. */
  let asAdmin: string
  let salonId: string
  let staffId: string
  /** A number no other row of a test has. */
  let rows = 0

  beforeEach(async () => {
    app = createTestApp()
    db = getTestDb()
    asAdmin = (await signedInUser(app, db, { role: 'admin' })).authorization
    salonId = await insertSalon(db, { timezone: 'Asia/Tokyo' })
    staffId = await insertStaff(db, salonId)
  })

  const nextRow = (): number => {
    rows += 1
    return rows
  }

  const authorized = (call: Test, authorization: string | null): Test =>
    authorization === null ? call : call.set('Authorization', authorization)

  /** The CSV export of the query, as bytes. */
  const exportCsv = (
    query: Record<string, string | string[]> = {},
    as: string | null = asAdmin,
  ) => asBytes(authorized(request(app).get(EXPORT).query(query), as))

  /** The data export of a customer. */
  const exportData = (id: string, as: string | null = asAdmin) =>
    authorized(request(app).get(`${CUSTOMERS}/${id}/export`), as)

  /** What the API answers to a read, as the admin; the data of a 200. */
  const read = async (path: string, as: string = asAdmin) => {
    const response = await request(app)
      .get(`/api/v1${path}`)
      .set('Authorization', as)
    if (response.status !== 200) {
      throw new Error(
        `Expected 200 from ${path}, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** A customer created through the API, by the admin; returns it as the API does. */
  const created = async (
    overrides: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> & { id: string }> => {
    const response = await request(app)
      .post(CUSTOMERS)
      .set('Authorization', asAdmin)
      .send(customerRequest(overrides))
    if (response.status !== 201) {
      throw new Error(
        `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
      )
    }
    return response.body.data
  }

  /** Deletes a customer through the API, as the admin. */
  const deleted = async (id: string): Promise<void> => {
    const response = await request(app)
      .delete(`${CUSTOMERS}/${id}`)
      .set('Authorization', asAdmin)
    expect(response.status).toBe(204)
  }

  /** The lines of a CSV export after the names of the columns. */
  const exported = async (
    query: Record<string, string | string[]> = {},
  ): Promise<string[][]> => {
    const response = await exportCsv(query)
    if (response.status !== 200) {
      throw new Error(
        `Expected 200, got ${response.status}: ${response.body.toString('utf8')}`,
      )
    }
    const [header, ...lines] = rowsOf(
      response.body.toString('utf8').replace(/^\uFEFF/, ''),
    )
    expect(header).toEqual(COLUMNS)
    return lines
  }

  /** Signs in and returns the Authorization header to send. */
  type SignInAs = () => Promise<string>

  const member =
    (role: 'owner' | 'manager' | 'staff'): SignInAs =>
    async () => {
      const { email } = await insertMember(db, role, salonId)
      return (await signIn(app, email)).authorization
    }

  const exporters: [string, SignInAs][] = [
    ['an administrator', async () => asAdmin],
    ['the owner of a salon', member('owner')],
    ['a manager of a salon', member('manager')],
  ]

  const strangers: [string, SignInAs][] = [
    ['a staff member of a salon', member('staff')],
    ['a customer', async () => (await signedInUser(app, db)).authorization],
  ]

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

  describe('GET /api/v1/customers/export', () => {
    it('writes every customer who is not deleted, newest first, each as the API shows them', async () => {
      const first = await created({
        notes: '朝の予約を希望, "いつもの"で通じる\r\n駐車場あり',
        tags: ['vip', 'regular'],
      })
      const second = await created({ notes: '=1+1', internalNotes: '@home' })
      const third = await created({ phoneNumber: '+81-90-1111-2222' })
      const gone = await created()
      await deleted(gone.id)
      const before = todayInUtc()

      const response = await exportCsv()

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8')
      expect([
        `attachment; filename=customers-${before}.csv`,
        `attachment; filename=customers-${todayInUtc()}.csv`,
      ]).toContain(response.headers['content-disposition'])
      const bytes: Buffer = response.body
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
      const text = bytes.toString('utf8').slice(1)
      expect(text.split('\r\n')[0]).toBe(COLUMNS.join(','))
      const [header, ...lines] = rowsOf(text)
      expect(header).toEqual(COLUMNS)
      const shown = [
        await read(`/customers/${third.id}`),
        await read(`/customers/${second.id}`),
        await read(`/customers/${first.id}`),
      ]
      expect(lines).toEqual(
        shown.map((customer) =>
          COLUMNS.map((column) => cellOf(customer[column])),
        ),
      )
      expect(lines[1]?.[COLUMNS.indexOf('notes')]).toBe("'=1+1")
      expect(lines[1]?.[COLUMNS.indexOf('internalNotes')]).toBe("'@home")
      expect(lines[0]?.[COLUMNS.indexOf('phoneNumber')]).toBe(
        "'+81-90-1111-2222",
      )
      expect(lines[2]?.[COLUMNS.indexOf('notes')]).toBe(
        '朝の予約を希望, "いつもの"で通じる\r\n駐車場あり',
      )
      expect(lines[2]?.[COLUMNS.indexOf('tags')]).toBe('["vip","regular"]')
      expect(lines[2]?.[COLUMNS.indexOf('lastNameKana')]).toBe('ヤマダ')
      expect(lines[2]?.[COLUMNS.indexOf('alternativePhone')]).toBe('')
    })

    it('writes only the names of the columns when no customer matches', async () => {
      const response = await exportCsv({ search: 'nobody' })

      expect(response.status).toBe(200)
      expect(response.body.toString('utf8')).toBe(
        `\uFEFF${COLUMNS.join(',')}\r\n`,
      )
    })

    it('exports the customers the list finds for the same filters', async () => {
      await db.insert(customers).values([
        {
          firstName: 'Hanako',
          lastName: 'Yamada',
          email: `a-${randomUUID()}@example.com`,
          phoneNumber: '090-1234-5678',
          tags: ['vip', 'regular'],
          customerStatus: 'vip',
          membershipTier: 'gold',
          createdAt: '2026-11-01T00:00:00Z',
        },
        {
          firstName: 'Taro',
          lastName: 'Suzuki',
          email: `b-${randomUUID()}@example.com`,
          phoneNumber: '03-9876-5432',
          tags: ['regular'],
          customerStatus: 'active',
          membershipTier: 'silver',
          createdAt: '2026-11-10T00:00:00Z',
        },
        {
          firstName: 'Jiro',
          lastName: 'Yamada',
          email: `c-${randomUUID()}@example.com`,
          phoneNumber: '080-1111-2222',
          tags: [],
          customerStatus: 'inactive',
          membershipTier: 'gold',
          createdAt: '2026-11-20T00:00:00Z',
        },
      ])
      const queries: Record<string, string | string[]>[] = [
        {},
        { search: 'yamada' },
        { search: '1234' },
        { search: '9876-5432' },
        { tags: 'regular' },
        { tags: ['vip', 'regular'] },
        { customerStatus: 'vip' },
        { membershipTier: 'gold' },
        { registeredFrom: '2026-11-05T00:00:00Z' },
        { registeredTo: '2026-11-10T00:00:00.000Z' },
        { search: 'yamada', membershipTier: 'gold', tags: 'vip' },
      ]

      for (const query of queries) {
        const listed = await request(app)
          .get(CUSTOMERS)
          .query({ ...query, limit: '100' })
          .set('Authorization', asAdmin)
        expect(listed.status).toBe(200)

        expect((await exported(query)).map(([id]) => id)).toEqual(
          listed.body.data.map(({ id }: { id: string }) => id),
        )
      }
    })

    it.each(exporters)('lets %s export the ledger', async (_who, signInAs) => {
      const customer = await created()

      const response = await exportCsv({}, await signInAs())

      expect(response.status).toBe(200)
      expect(response.body.toString('utf8')).toContain(customer.id)
    })

    it.each(strangers)(
      'refuses %s with 403, before the query is read',
      async (_who, signInAs) => {
        const as = await signInAs()

        for (const query of [
          {},
          { limit: '10' },
          { customerStatus: 'deleted' },
        ]) {
          expectProblem(await exportCsv(query, as), forbidden)
        }
      },
    )

    it.each(unauthenticated)(
      'refuses %s with 401',
      async (_why, tokenOf, problem, challenge) => {
        const response = await exportCsv({}, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it.each<[string, Record<string, string | string[]>, string[]]>([
      [
        'a page size, which an export has not',
        { limit: '10' },
        ['limit:unrecognized_keys'],
      ],
      [
        'a cursor, which an export has not',
        { cursor: UNKNOWN_ID },
        ['cursor:unrecognized_keys'],
      ],
      ['a blank keyword', { search: ' ' }, ['search:invalid_format']],
      ['a blank tag', { tags: ['vip', ''] }, ['tags.1:invalid_format']],
      [
        'a keyword of 101 characters',
        { search: 'あ'.repeat(101) },
        ['search:too_big'],
      ],
      [
        'a start of the registration after its end',
        {
          registeredFrom: '2026-11-14T00:00:00.500Z',
          registeredTo: '2026-11-14T00:00:00Z',
        },
        ['registeredTo:custom'],
      ],
      [
        'an unknown status',
        { customerStatus: 'deleted' },
        ['customerStatus:invalid_value'],
      ],
      [
        'a parameter that does not exist',
        { page: '2' },
        ['page:unrecognized_keys'],
      ],
    ])('refuses %s with 400', async (_case, query, rules) => {
      const response = await exportCsv(query)

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(rules)
    })

    it('exports 10,000 customers, and refuses one more with 409 that tells how many match', async () => {
      const many = (count: number, from: number) =>
        Array.from({ length: count }, (_, index) => ({
          firstName: 'Many',
          lastName: `Customer ${from + index}`,
          email: `many-${from + index}@example.com`,
          phoneNumber: '090-0000-0000',
          tags: [],
        }))
      await db.insert(customers).values(many(5_000, 0))
      await db.insert(customers).values(many(5_000, 5_000))

      const all = await exportCsv()
      expect(all.status).toBe(200)
      expect(rowsOf(all.body.toString('utf8').slice(1))).toHaveLength(10_001)

      await db.insert(customers).values({
        firstName: 'One',
        lastName: 'More',
        email: 'one-more@example.com',
        phoneNumber: '090-0000-0000',
        tags: [],
        customerStatus: 'vip',
      })
      const tooMany = await exportCsv()

      expectProblem(tooMany, notAllowed)
      expect(tooMany.body.detail).toBe(
        '10001 customers match; a file holds 10000 at most, so narrow the filters',
      )
      const narrowed = await exported({ customerStatus: 'vip' })
      expect(narrowed.map((line) => line[COLUMNS.indexOf('email')])).toEqual([
        'one-more@example.com',
      ])
    })
  })

  /** A booking of a customer with one service line, written directly; returns its ID. */
  const insertBooking = async (
    customerId: string,
    createdAt = '2026-11-01T00:00:00Z',
  ): Promise<string> => {
    const row = nextRow()
    const [service] = await db
      .insert(services)
      .values({
        salonId,
        name: `Cut ${row}`,
        duration: 30,
        price: 6600,
        imageUrls: [],
        tags: [],
        packageServiceIds: [],
        bookingRequirements: [],
      })
      .returning({ id: services.id })
    const [booking] = await db
      .insert(bookings)
      .values({
        bookingNumber: `BK-EXPORT-${row}`,
        salonId,
        customerId,
        staffId,
        bookingDate: '2026-11-20',
        startTime: '2026-11-20T01:00:00Z',
        endTime: '2026-11-20T01:30:00Z',
        duration: 30,
        subtotal: 6600,
        totalAmount: 6600,
        status: 'completed',
        completedAt: '2026-11-20T01:30:00Z',
        actualStartTime: '2026-11-20T01:00:00Z',
        createdAt,
      })
      .returning({ id: bookings.id })
    if (service === undefined || booking === undefined) {
      throw new Error('No booking was inserted')
    }
    await db.insert(bookingServices).values({
      bookingId: booking.id,
      serviceId: service.id,
      staffId,
      startTime: '2026-11-20T01:00:00Z',
      endTime: '2026-11-20T01:30:00Z',
      duration: 30,
      price: 6600,
      finalPrice: 6600,
      taxIncluded: true,
    })
    return booking.id
  }

  /** A sale of a booking with one line and a payment, written directly; returns its ID. */
  const insertSale = async (
    customerId: string,
    bookingId: string,
  ): Promise<string> => {
    const [sale] = await db
      .insert(sales)
      .values({
        saleNumber: `SL-EXPORT-${nextRow()}`,
        salonId,
        customerId,
        bookingId,
        saleDate: '2026-11-20',
        saleTime: '2026-11-20T02:00:00Z',
        subtotal: 6000,
        taxAmount: 600,
        totalAmount: 6600,
      })
      .returning({ id: sales.id })
    const [method] = await db
      .insert(paymentMethods)
      .values({ salonId, method: 'cash', displayName: '現金' })
      .returning({ id: paymentMethods.id })
    if (sale === undefined || method === undefined) {
      throw new Error('No sale was inserted')
    }
    await db.insert(salesDetails).values({
      saleId: sale.id,
      itemType: 'service',
      itemName: 'カット',
      quantity: 1,
      unitPrice: 6000,
      taxAmount: 600,
      totalAmount: 6600,
      sortOrder: 0,
    })
    await db.insert(paymentTransactions).values({
      saleId: sale.id,
      paymentMethodId: method.id,
      transactionNumber: `TX-EXPORT-${nextRow()}`,
      ...paymentColumns(),
    })
    return sale.id
  }

  /** A treatment record of a booking with a material and a photo, written directly; returns its ID. */
  const insertRecord = async (
    customerId: string,
    bookingId: string,
  ): Promise<string> => {
    const [record] = await db
      .insert(treatmentRecords)
      .values({ bookingId, customerId, staffId, services: [randomUUID()] })
      .returning({ id: treatmentRecords.id })
    const [product] = await db
      .insert(products)
      .values({
        salonId,
        productCode: `P${nextRow()}`,
        name: 'カラー剤',
        unit: 'g',
        requiresLotTracking: false,
      })
      .returning({ id: products.id })
    if (record === undefined || product === undefined) {
      throw new Error('No record was inserted')
    }
    await db.insert(treatmentMaterials).values({
      treatmentRecordId: record.id,
      productId: product.id,
      quantity: '30',
      unit: 'g',
      sortOrder: 0,
    })
    await db.insert(treatmentPhotos).values({
      treatmentRecordId: record.id,
      photoType: 'before',
      photoUrl: 'https://images.example.com/before.jpg',
      sortOrder: 0,
    })
    return record.id
  }

  /** A review of a booking, written directly; returns its ID. */
  const insertReview = async (
    customerId: string,
    bookingId: string,
  ): Promise<string> => {
    const [review] = await db
      .insert(reviews)
      .values({ salonId, customerId, bookingId, overallRating: 5 })
      .returning({ id: reviews.id })
    if (review === undefined) {
      throw new Error('No review was inserted')
    }
    return review.id
  }

  /** Links an account to a customer, both ways, as a profile claim does. */
  const linkAccount = async (customerId: string) => {
    const user = await insertUser(db, { customerId })
    await db
      .update(customers)
      .set({ userId: user.id })
      .where(eq(customers.id, customerId))
    return user
  }

  describe('GET /api/v1/customers/:id/export', () => {
    it('writes everything held of the customer, each part as its own API shows it', async () => {
      const customer = await created()
      const account = await linkAccount(customer.id)
      const changed = await request(app)
        .patch(`${CUSTOMERS}/${customer.id}`)
        .set('Authorization', asAdmin)
        .send({ notes: 'Prefers the morning' })
      expect(changed.status).toBe(200)
      await db.insert(customerPreferences).values({
        customerId: customer.id,
        preferredStaffId: staffId,
        preferredTimeSlots: [],
        avoidStaffIds: [],
        specialRequests: '静かに過ごしたい',
      })
      await db.insert(medicalCharts).values({
        customerId: customer.id,
        previousTreatments: [],
        medicalConditions: '金属アレルギーの疑い',
        preferredProducts: [],
        avoidProducts: [],
        notes: null,
      })
      await db.insert(customerAllergies).values([
        {
          customerId: customer.id,
          allergyType: 'chemical',
          allergenName: 'PPD',
          severityType: 'severe',
          createdAt: '2026-11-02T00:00:00Z',
        },
        {
          customerId: customer.id,
          allergyType: 'chemical',
          allergenName: 'ニッケル',
          severityType: 'mild',
          createdAt: '2026-11-01T00:00:00Z',
        },
      ])
      const bookingId = await insertBooking(customer.id)
      const saleId = await insertSale(customer.id, bookingId)
      const recordId = await insertRecord(customer.id, bookingId)
      const reviewId = await insertReview(customer.id, bookingId)
      const other = await created()
      const othersBooking = await insertBooking(other.id)
      const othersReview = await insertReview(other.id, othersBooking)
      await db
        .insert(reviewHelpfulVotes)
        .values({ reviewId: othersReview, customerId: customer.id })
      await db.insert(customerPoints).values([
        {
          customerId: customer.id,
          transactionType: 'earned',
          points: 100,
          balance: 100,
          expiryDate: '2027-11-30',
          createdAt: '2026-11-01T00:00:00Z',
        },
        {
          customerId: customer.id,
          transactionType: 'used',
          points: -30,
          balance: 70,
          expiryDate: null,
          createdAt: '2026-11-02T00:00:00Z',
        },
      ])
      await db
        .update(customers)
        .set({ loyaltyPoints: 70 })
        .where(eq(customers.id, customer.id))
      // A sign-in writes the time of the last login on the account, so the
      // customer signs in before the export, to be compared with after it.
      const asCustomer = (await signIn(app, account.email)).authorization
      const before = new Date()

      const response = await exportData(customer.id)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      )
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename=customer-${customer.id}.json`,
      )
      expect(response.text.startsWith('{\n  "exportedAt": "')).toBe(true)
      const file = response.body
      expect(file.exportedAt).toMatch(ISO_TIMESTAMP)
      expect(new Date(file.exportedAt).getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      )
      expect(new Date(file.exportedAt).getTime()).toBeLessThanOrEqual(
        Date.now(),
      )
      const transactions = await read(
        `/points/customer/${customer.id}/transactions?limit=100`,
      )
      const allergies = await read(
        `/medical-charts/customer/${customer.id}/allergies`,
      )
      expect(file).toEqual({
        exportedAt: file.exportedAt,
        customer: await read(`/customers/${customer.id}`),
        account: await read('/auth/me', asCustomer),
        preferences: await read(`/customers/${customer.id}/preferences`),
        medicalChart: await read(`/medical-charts/customer/${customer.id}`),
        allergies: [...allergies].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
        bookings: [await read(`/bookings/${bookingId}`)],
        sales: [await read(`/sales/${saleId}`)],
        pointTransactions: [...transactions].sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        ),
        reviews: [await read(`/reviews/${reviewId}`)],
        helpfulReviewIds: [othersReview],
        treatmentRecords: [await read(`/treatments/${recordId}`)],
        versions: [
          await read(`/customers/${customer.id}/versions/1`),
          await read(`/customers/${customer.id}/versions/2`),
        ],
      })
      expect(
        file.allergies.map(
          ({ allergenName }: { allergenName: string }) => allergenName,
        ),
      ).toEqual(['ニッケル', 'PPD'])
      expect(file.bookings[0].services).toHaveLength(1)
      expect(file.sales[0].details).toHaveLength(1)
      expect(file.sales[0].payments).toHaveLength(1)
      expect(file.treatmentRecords[0].materials).toHaveLength(1)
      expect(file.treatmentRecords[0].photos).toHaveLength(1)
      expect(response.text).not.toMatch(/passwordHash|\$argon2|\$scrypt/)
    })

    it('reads everything at one moment: what commits while the export reads is not in the file', async () => {
      const customer = await created({ notes: 'はじめ' })
      const client = getTestDbClient()
      const held = Promise.withResolvers<void>()
      const mayChange = Promise.withResolvers<void>()
      // The versions are read last: a lock on their table stops the export
      // after it has read the customer, until the holder has changed both
      // the customer and the version and committed.
      const holder = client.begin(async (tx) => {
        await tx`LOCK TABLE customer_versions IN ACCESS EXCLUSIVE MODE`
        held.resolve()
        await mayChange.promise
        await tx`UPDATE customers SET notes = 'あとから' WHERE id = ${customer.id}`
        await tx`UPDATE customer_versions SET notes = 'あとから' WHERE "customerId" = ${customer.id}`
      })
      await held.promise

      const pending = exportData(customer.id).then((response) => response)
      await untilWaiting(client)
      mayChange.resolve()
      await holder
      const response = await pending

      expect(response.status).toBe(200)
      expect(response.body.customer.notes).toBe('はじめ')
      expect(
        response.body.versions.map(({ notes }: { notes: string }) => notes),
      ).toEqual(['はじめ'])
      expect((await exportData(customer.id)).body.versions).toMatchObject([
        { notes: 'あとから' },
      ])
    })

    it('writes null for what the customer has not, and an empty list for what they have none of', async () => {
      const customer = await created()

      const response = await exportData(customer.id)

      expect(response.status).toBe(200)
      expect(response.body).toMatchObject({
        customer: { id: customer.id },
        account: null,
        preferences: null,
        medicalChart: null,
        allergies: [],
        bookings: [],
        sales: [],
        pointTransactions: [],
        reviews: [],
        helpfulReviewIds: [],
        treatmentRecords: [],
        versions: [{ version: 1, operation: 'create' }],
      })
    })

    it('lists the rows in the order they were written, which is not the order of their IDs', async () => {
      const customer = await created()
      const later = await insertBooking(customer.id, '2026-11-03T00:00:00Z')
      const earlier = await insertBooking(customer.id, '2026-11-02T00:00:00Z')
      const first = await insertBooking(customer.id, '2026-11-01T00:00:00Z')

      const response = await exportData(customer.id)

      expect(
        response.body.bookings.map(({ id }: { id: string }) => id),
      ).toEqual([first, earlier, later])
    })

    it.each(exporters)(
      'lets %s export the data of a customer',
      async (_who, signInAs) => {
        const customer = await created()

        const response = await exportData(customer.id, await signInAs())

        expect(response.status).toBe(200)
        expect(response.body.customer.id).toBe(customer.id)
      },
    )

    it.each(strangers)(
      'refuses %s with 403, before the ID is read',
      async (_who, signInAs) => {
        const customer = await created()
        const as = await signInAs()

        for (const id of [customer.id, 'not-an-id', UNKNOWN_ID]) {
          expectProblem(await exportData(id, as), forbidden)
        }
      },
    )

    it('refuses the customer themselves with 403', async () => {
      const customer = await created()
      const account = await linkAccount(customer.id)

      const response = await exportData(
        customer.id,
        (await signIn(app, account.email)).authorization,
      )

      expectProblem(response, forbidden)
    })

    it.each(unauthenticated)(
      'refuses %s with 401',
      async (_why, tokenOf, problem, challenge) => {
        const customer = await created()

        const response = await exportData(customer.id, await tokenOf())

        expectProblem(response, problem)
        expect(response.headers['www-authenticate']).toBe(challenge)
      },
    )

    it('refuses an ID that is not one with 400', async () => {
      const response = await exportData('not-an-id')

      expectProblem(response, badRequest)
      expect(brokenRules(response)).toEqual(['id:invalid_format'])
    })

    it('answers a customer that is not there with 404', async () => {
      expectProblem(await exportData(UNKNOWN_ID), notFound)
    })

    it('answers a deleted customer with 404, as every other read of the ledger', async () => {
      const customer = await created()
      await deleted(customer.id)

      expectProblem(await exportData(customer.id), notFound)
    })
  })

  describe('a database that cannot be reached', () => {
    it('is a database error to either export, not an empty file', async () => {
      const connection = connectUnreachableDatabase()
      const ledger = new CustomerRepository(connection.database)

      const results = [
        await ledger.exportMatching(
          {
            search: null,
            phoneDigits: null,
            tags: [],
            registeredFrom: null,
            registeredTo: null,
            customerStatus: null,
            membershipTier: null,
          },
          10_000,
        ),
        await ledger.dataOf(customerIdSchema.parse(UNKNOWN_ID)),
      ]
      await connection.close()

      for (const result of results) {
        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database' },
        })
      }
    })
  })
})
