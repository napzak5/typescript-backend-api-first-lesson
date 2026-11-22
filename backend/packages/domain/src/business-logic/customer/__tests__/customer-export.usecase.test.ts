import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  dbUser,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import { bookingWithServices } from '../../../__tests__/fixtures/booking-fixtures'
import { dbCustomerAllergy } from '../../../__tests__/fixtures/customer-allergy-fixtures'
import {
  apiCustomer,
  customerDependencies,
  dbCustomer,
  OTHER_CUSTOMER_ID,
  REFERRER_ID,
} from '../../../__tests__/fixtures/customer-fixtures'
import { dbCustomerPreferences } from '../../../__tests__/fixtures/customer-preferences-fixtures'
import { dbCustomerVersion } from '../../../__tests__/fixtures/customer-version-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import { dbMedicalChart } from '../../../__tests__/fixtures/medical-chart-fixtures'
import { dbPointTransaction } from '../../../__tests__/fixtures/point-fixtures'
import { dbReview } from '../../../__tests__/fixtures/review-fixtures'
import { saleWithDetails } from '../../../__tests__/fixtures/sale-fixtures'
import { storedTreatmentRecord } from '../../../__tests__/fixtures/treatment-record-fixtures'
import { BookingReadMapper } from '../../../mappers/read/booking.mapper'
import { CustomerAllergyReadMapper } from '../../../mappers/read/customer-allergy.mapper'
import { CustomerPreferencesReadMapper } from '../../../mappers/read/customer-preferences.mapper'
import { CustomerVersionReadMapper } from '../../../mappers/read/customer-version.mapper'
import { MedicalChartReadMapper } from '../../../mappers/read/medical-chart.mapper'
import { PointReadMapper } from '../../../mappers/read/point.mapper'
import { ReviewReadMapper } from '../../../mappers/read/review.mapper'
import { SaleReadMapper } from '../../../mappers/read/sale.mapper'
import { TreatmentRecordReadMapper } from '../../../mappers/read/treatment-record.mapper'
import { UserReadMapper } from '../../../mappers/read/user.mapper'
import type { Actor } from '../../../models/auth'
import { customerIdSchema } from '../../../models/customer'
import type {
  CustomerData,
  CustomerExport,
  ICustomerRepository,
} from '../../../repositories/customer.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  type CustomerUseCaseDependencies,
  ExportCustomerDataUseCase,
  ExportCustomersUseCase,
  MOST_EXPORTED,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** Who may: the platform's administrators, and owners and managers. */
const exporters: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
]

/** Who may not: a staff member, and those who are no member of a salon. */
const strangers: [string, Actor][] = [
  ['a staff member', actors.ofSalon('staff')],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user of no scope', actors.withoutScope],
]

/**
 * The CSV file of an export, as its lines without their CRLF, for a file
 * in which no value holds a line break.
 */
const linesOf = (content: string): string[] => {
  expect(content.startsWith('\uFEFF')).toBe(true)
  expect(content.endsWith('\r\n')).toBe(true)
  return content.slice(1, -2).split('\r\n')
}

/** The content of a file the export made. */
const contentOf = (
  result: Result<{ fileName: string; content: string }, DomainError>,
): string => {
  if (result.type !== 'success') {
    throw new Error(`Expected a file, got ${JSON.stringify(result)}`)
  }
  return result.data.content
}

/** The names of the columns, in the order of the contract. */
const HEADER = [
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
].join(',')

/** The line of `dbCustomer()`. */
const LINE = [
  CUSTOMER_ID,
  '',
  '花子',
  '山田',
  'ハナコ',
  '',
  'hanako.yamada@example.com',
  '090-1234-5678',
  '',
  '107-0062',
  '東京都',
  '港区',
  '',
  '',
  '1990-04-01',
  'female',
  '',
  'gold',
  '120',
  '"{""preferredServices"":[""cut""],""notes"":null}"',
  '',
  'カラー剤でかぶれたことがある',
  '"[""regular""]"',
  REFERRER_ID,
  'HANAKO2026',
  'true',
  'false',
  'true',
  '2026-01-10',
  '2026-11-01',
  '7',
  '1',
  '2',
  'true',
  'wavy',
  '',
  '',
  'active',
  '2026-11-14T09:00:00.123Z',
  '2026-11-14T09:30:00.000Z',
].join(',')

describe('ExportCustomersUseCase', () => {
  const exportOf = (
    dependencies: CustomerUseCaseDependencies,
    query: unknown,
    actor: Actor = actors.admin,
  ) =>
    new ExportCustomersUseCase(dependencies).execute(
      actor,
      Result.success(query),
    )

  const exportingWith = (exported: CustomerExport, now?: Date) =>
    customerDependencies(
      { exportMatching: vi.fn(async () => Result.success(exported)) },
      now,
    )

  const callsOf = (repository: ICustomerRepository) =>
    vi.mocked(repository.exportMatching).mock.calls

  it.each(exporters)('lets %s export the ledger', async (_who, actor) => {
    const result = await exportOf(customerDependencies(), {}, actor)

    expect(result.type).toBe('success')
  })

  it.each(strangers)(
    'refuses %s, before the query and without a read',
    async (_who, actor) => {
      const dependencies = customerDependencies()

      const results = [
        await exportOf(dependencies, {}, actor),
        await exportOf(dependencies, { search: '' }, actor),
        await new ExportCustomersUseCase(dependencies).execute(
          actor,
          Result.error(DomainErrors.validation('Invalid customer export', [])),
        ),
      ]

      expect(results).toEqual([forbidden, forbidden, forbidden])
      expect(callsOf(dependencies.customerRepository)).toEqual([])
    },
  )

  it('passes on a query the caller could not decode', async () => {
    const dependencies = customerDependencies()
    const undecoded = Result.error(
      DomainErrors.validation('Invalid customer export', [
        { field: 'tags', rule: 'invalid_type', message: 'Not a list' },
      ]),
    )

    const result = await new ExportCustomersUseCase(dependencies).execute(
      actors.admin,
      undecoded,
    )

    expect(result).toEqual(undecoded)
    expect(callsOf(dependencies.customerRepository)).toEqual([])
  })

  it.each<[string, unknown, string[]]>([
    [
      'a page size, which an export has not',
      { limit: 20 },
      ['limit:unrecognized_keys'],
    ],
    [
      'a cursor, which an export has not',
      { cursor: OTHER_CUSTOMER_ID },
      ['cursor:unrecognized_keys'],
    ],
    ['a blank keyword', { search: '  ' }, ['search:invalid_format']],
    [
      'a keyword of 101 characters',
      { search: 'あ'.repeat(101) },
      ['search:too_big'],
    ],
    ['a blank tag', { tags: ['regular', ''] }, ['tags.1:invalid_format']],
    [
      'a moment without an offset',
      { registeredFrom: '2026-11-01T00:00:00' },
      ['registeredFrom:invalid_format'],
    ],
    [
      'a parameter that does not exist',
      { page: 2 },
      ['page:unrecognized_keys'],
    ],
    [
      'a period that ends before it begins',
      {
        registeredFrom: '2026-11-02T00:00:00Z',
        registeredTo: '2026-11-01T23:59:59Z',
      },
      ['registeredTo:custom'],
    ],
    [
      'a status that is none',
      { customerStatus: 'deleted' },
      ['customerStatus:invalid_value'],
    ],
    [
      'a tier that is none',
      { membershipTier: 'diamond' },
      ['membershipTier:invalid_value'],
    ],
  ])('refuses %s, without a read', async (_case, query, rules) => {
    const dependencies = customerDependencies()

    const result = await exportOf(dependencies, query)

    expect(rulesOf(result)).toEqual(rules)
    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid customer export' },
    })
    expect(callsOf(dependencies.customerRepository)).toEqual([])
  })

  it('reads every customer who matches no filter, up to the most a file holds', async () => {
    const dependencies = customerDependencies()

    await exportOf(dependencies, {})

    expect(callsOf(dependencies.customerRepository)).toEqual([
      [
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
      ],
    ])
    expect(MOST_EXPORTED).toBe(10_000)
  })

  it('reads with the filters of the list, the keyword as a phone number too', async () => {
    const dependencies = customerDependencies()

    await exportOf(dependencies, {
      search: '090-1234',
      tags: ['regular', 'vip'],
      registeredFrom: '2026-10-31T15:00:00Z',
      registeredTo: '2026-11-30T14:59:59.999Z',
      customerStatus: 'vip',
      membershipTier: 'gold',
    })

    expect(callsOf(dependencies.customerRepository)).toEqual([
      [
        {
          search: '090-1234',
          phoneDigits: '0901234',
          tags: ['regular', 'vip'],
          registeredFrom: '2026-10-31T15:00:00Z',
          registeredTo: '2026-11-30T14:59:59.999Z',
          customerStatus: 'vip',
          membershipTier: 'gold',
        },
        MOST_EXPORTED,
      ],
    ])
  })

  it('writes the names of the columns and a line for every customer, in the order read', async () => {
    const result = await exportOf(
      exportingWith({
        type: 'exported',
        customers: [
          dbCustomer(),
          dbCustomer({ id: OTHER_CUSTOMER_ID, lastName: '佐藤' }),
        ],
      }),
      {},
    )

    if (result.type !== 'success') {
      throw new Error(`Expected a file, got ${JSON.stringify(result)}`)
    }
    expect(result.data.fileName).toBe('customers-2026-11-14.csv')
    expect(linesOf(result.data.content)).toEqual([
      HEADER,
      LINE,
      LINE.replace(CUSTOMER_ID, OTHER_CUSTOMER_ID).replace('山田', '佐藤'),
    ])
  })

  it('writes only the names of the columns when no customer matches', async () => {
    const result = await exportOf(
      exportingWith({ type: 'exported', customers: [] }),
      {},
    )

    expect(result).toEqual({
      type: 'success',
      data: {
        fileName: 'customers-2026-11-14.csv',
        content: `\uFEFF${HEADER}\r\n`,
      },
    })
  })

  it('names the file by the day of the export in UTC', async () => {
    const result = await exportOf(
      exportingWith(
        { type: 'exported', customers: [] },
        new Date('2026-12-01T08:59:59.999+09:00'),
      ),
      {},
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { fileName: 'customers-2026-11-30.csv' },
    })
  })

  it('quotes a value with a comma, a double quote or a line break, and doubles its quotes', async () => {
    const result = await exportOf(
      exportingWith({
        type: 'exported',
        customers: [
          dbCustomer({
            notes: '朝の予約を希望,駐車場あり',
            internalNotes: '「"いつもの"」で通じる\r\n2行目',
            address: '1\n2',
          }),
        ],
      }),
      {},
    )

    const content = contentOf(result)
    expect(content).toContain(',"1\n2",')
    expect(content).toContain(',"朝の予約を希望,駐車場あり",')
    expect(content).toContain(',"「""いつもの""」で通じる\r\n2行目",')
  })

  it.each([
    [
      '=',
      '=HYPERLINK("http://example.com")',
      `"'=HYPERLINK(""http://example.com"")"`,
    ],
    ['+', '+81 90', "'+81 90"],
    ['-', '-1+2', "'-1+2"],
    ['@', '@SUM(A1)', "'@SUM(A1)"],
    ['a tab', '\tcmd', "'\tcmd"],
    ['a carriage return', '\rcmd', `"'\rcmd"`],
  ])(
    'puts an apostrophe before a text that begins with %s, which a spreadsheet would take for a formula',
    async (_case, notes, cell) => {
      const result = await exportOf(
        exportingWith({ type: 'exported', customers: [dbCustomer({ notes })] }),
        {},
      )

      expect(contentOf(result)).toContain(`}",${cell},カラー剤`)
    },
  )

  it('leaves a text that has a formula sign only after its start as it is, and marks a phone number that begins with +', async () => {
    const result = await exportOf(
      exportingWith({
        type: 'exported',
        customers: [
          dbCustomer({ notes: 'A=B', phoneNumber: '+81-90-1234-5678' }),
        ],
      }),
      {},
    )

    const content = contentOf(result)
    expect(content).toContain('}",A=B,カラー剤')
    expect(content).toContain(",'+81-90-1234-5678,")
  })

  it('refuses more customers than a file holds as a conflict that tells how many match', async () => {
    const result = await exportOf(
      exportingWith({ type: 'tooMany', matching: 10_001 }),
      { customerStatus: 'active' },
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.conflict(
          '10001 customers match; a file holds 10000 at most, so narrow the filters',
        ),
      ),
    )
  })

  it('reports a stored customer that is not valid as a database error', async () => {
    const result = await exportOf(
      exportingWith({
        type: 'exported',
        customers: [
          dbCustomer(),
          dbCustomer({ id: OTHER_CUSTOMER_ID, gender: 'unknown' }),
        ],
      }),
      {},
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: expect.stringContaining(OTHER_CUSTOMER_ID),
      },
    })
  })

  it('passes on a failure of the database', async () => {
    const result = await exportOf(
      customerDependencies({ exportMatching: vi.fn(async () => databaseDown) }),
      {},
    )

    expect(result).toEqual(databaseDown)
  })
})

/** Everything held of the customer of the fixtures, of every kind. */
const everything = (overrides: Partial<CustomerData> = {}): CustomerData => ({
  customer: dbCustomer({ userId: USER_ID }),
  account: dbUser(),
  preferences: dbCustomerPreferences(),
  medicalChart: dbMedicalChart(),
  allergies: [dbCustomerAllergy()],
  bookings: [bookingWithServices()],
  sales: [saleWithDetails()],
  pointTransactions: [dbPointTransaction()],
  reviews: [dbReview()],
  helpfulReviewIds: ['0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6b01'],
  treatmentRecords: [storedTreatmentRecord()],
  versions: [
    dbCustomerVersion(),
    dbCustomerVersion({ version: 2, operation: 'update' }),
  ],
  ...overrides,
})

/** What the mapper of a part gives, which a test expects to succeed. */
const mapped = <T>(result: Result<T, DomainError>): T => {
  if (result.type !== 'success') {
    throw new Error(`Expected a mapped part, got ${JSON.stringify(result)}`)
  }
  return result.data
}

describe('ExportCustomerDataUseCase', () => {
  const exportOf = (
    dependencies: CustomerUseCaseDependencies,
    id: unknown = CUSTOMER_ID,
    actor: Actor = actors.admin,
  ) => new ExportCustomerDataUseCase(dependencies).execute(actor, id)

  const holding = (data: CustomerData | null) =>
    customerDependencies({ dataOf: vi.fn(async () => Result.success(data)) })

  const callsOf = (repository: ICustomerRepository) =>
    vi.mocked(repository.dataOf).mock.calls

  /** The JSON file of a successful export, read back. */
  const fileOf = (
    result: Result<{ fileName: string; content: string }, DomainError>,
  ) => {
    if (result.type !== 'success') {
      throw new Error(`Expected a file, got ${JSON.stringify(result)}`)
    }
    return {
      fileName: result.data.fileName,
      json: JSON.parse(result.data.content),
    }
  }

  it.each(exporters)(
    'lets %s export the data of a customer',
    async (_who, actor) => {
      const result = await exportOf(holding(everything()), CUSTOMER_ID, actor)

      expect(result.type).toBe('success')
    },
  )

  it.each(strangers)(
    'refuses %s, before the ID and without a read',
    async (_who, actor) => {
      const dependencies = holding(everything())

      const results = [
        await exportOf(dependencies, CUSTOMER_ID, actor),
        await exportOf(dependencies, 'not-an-id', actor),
      ]

      expect(results).toEqual([forbidden, forbidden])
      expect(callsOf(dependencies.customerRepository)).toEqual([])
    },
  )

  it.each<[string, unknown]>([
    ['text that is no UUID', 'not-an-id'],
    ['a number', 42],
    ['null', null],
  ])('refuses an ID that is %s, without a read', async (_case, id) => {
    const dependencies = holding(everything())

    const result = await exportOf(dependencies, id)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(callsOf(dependencies.customerRepository)).toEqual([])
  })

  it('reads the customer the ID names, in its canonical form', async () => {
    const dependencies = holding(everything())

    await exportOf(dependencies, CUSTOMER_ID.toUpperCase())

    expect(callsOf(dependencies.customerRepository)).toEqual([[CUSTOMER_ID]])
  })

  it('answers a customer who is not there, or is deleted, as not found', async () => {
    const result = await exportOf(holding(null))

    expect(result).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('writes every part as its own API shows it, stamped with the time of the export', async () => {
    const data = everything()

    const { fileName, json } = fileOf(await exportOf(holding(data)))

    expect(fileName).toBe(`customer-${CUSTOMER_ID}.json`)
    expect(json).toEqual({
      exportedAt: '2026-11-14T09:00:00.000Z',
      customer: apiCustomer({ userId: USER_ID }),
      account: mapped(UserReadMapper.toApiUser(dbUser())),
      preferences: mapped(
        CustomerPreferencesReadMapper.toApiPreferences(
          customerIdSchema.parse(CUSTOMER_ID),
          dbCustomerPreferences(),
        ),
      ),
      medicalChart: mapped(
        MedicalChartReadMapper.toApiMedicalChart(dbMedicalChart()),
      ),
      allergies: mapped(
        CustomerAllergyReadMapper.toApiCustomerAllergies(data.allergies),
      ),
      bookings: mapped(BookingReadMapper.toApiBookings(data.bookings)),
      sales: mapped(SaleReadMapper.toApiSales(data.sales)),
      pointTransactions: mapped(
        PointReadMapper.toApiPointTransactions(data.pointTransactions),
      ),
      reviews: mapped(ReviewReadMapper.toApiReviews(data.reviews)),
      helpfulReviewIds: ['0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6b01'],
      treatmentRecords: mapped(
        TreatmentRecordReadMapper.toApiTreatmentRecords(data.treatmentRecords),
      ),
      versions: data.versions.map((version) =>
        mapped(CustomerVersionReadMapper.toApiCustomerVersion(version)),
      ),
    })
    expect(json.versions).toMatchObject([{ version: 1 }, { version: 2 }])
  })

  it('indents the file to be read by a person', async () => {
    const result = await exportOf(holding(everything()))

    expect(result).toMatchObject({
      type: 'success',
      data: { content: expect.stringMatching(/^\{\n {2}"exportedAt": "/) },
    })
  })

  it('writes null for what the customer has not, and an empty list for what they have none of', async () => {
    const { json } = fileOf(
      await exportOf(
        holding({
          customer: dbCustomer(),
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
          versions: [],
        }),
      ),
    )

    expect(json).toMatchObject({
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
      versions: [],
    })
  })

  it.each<[string, Partial<CustomerData>]>([
    ['the customer', { customer: dbCustomer({ gender: 'unknown' }) }],
    [
      'a version',
      {
        versions: [
          dbCustomerVersion(),
          dbCustomerVersion({ version: 2, changedAt: 'recently' }),
        ],
      },
    ],
    [
      'a point transaction',
      { pointTransactions: [dbPointTransaction({ createdAt: 'recently' })] },
    ],
  ])(
    'reports %s that is not valid as stored as a database error',
    async (_case, broken) => {
      const result = await exportOf(holding(everything(broken)))

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'database' },
      })
    },
  )

  it('passes on a failure of the database', async () => {
    const result = await exportOf(
      customerDependencies({ dataOf: vi.fn(async () => databaseDown) }),
    )

    expect(result).toEqual(databaseDown)
  })
})
