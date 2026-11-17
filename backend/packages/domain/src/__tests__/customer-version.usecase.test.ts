import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  type CustomerVersionUseCaseDependencies,
  GetCustomerHistoryUseCase,
  GetCustomerVersionUseCase,
} from '../business-logic/customer-version'
import type { Actor } from '../models/auth'
import type {
  ApiCustomerVersionResponse,
  DbCustomerVersion,
} from '../models/customer-version'
import type {
  CustomerVersionListing,
  CustomerVersionLookup,
  CustomerVersionWithPrevious,
  ICustomerVersionRepository,
} from '../repositories/customer-version.repository'
import { type DomainError, DomainErrors } from '../shared'
import { actors, CUSTOMER_ID, USER_ID } from './auth-fixtures'
import { REFERRER_ID } from './customer-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'

const VERSION_ID = (n: number): string =>
  `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f8a0${n}`

const forbidden = Result.error(DomainErrors.forbidden())
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** A version of the customer of the fixtures, as the driver returns it. */
const dbVersion = (
  overrides: Partial<DbCustomerVersion> = {},
): DbCustomerVersion => ({
  id: VERSION_ID(1),
  customerId: CUSTOMER_ID,
  version: 1,
  operation: 'create',
  changedBy: USER_ID,
  changedAt: '2026-11-14 18:00:00.123456+09',
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: null,
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: null,
  building: null,
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: null,
  membershipTier: 'gold',
  preferences: { preferredServices: ['cut'], notes: null },
  notes: null,
  internalNotes: null,
  tags: ['regular'],
  referredBy: REFERRER_ID,
  referralCode: 'HANAKO2026',
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  ...overrides,
})

/** The version of `dbVersion()` as the API presents it. */
const apiVersion = (
  overrides: Partial<ApiCustomerVersionResponse> = {},
): ApiCustomerVersionResponse => ({
  id: VERSION_ID(1),
  customerId: CUSTOMER_ID,
  version: 1,
  operation: 'create',
  changedBy: USER_ID,
  changedAt: '2026-11-14T09:00:00.123Z',
  firstName: '花子',
  lastName: '山田',
  firstNameKana: 'ハナコ',
  lastNameKana: null,
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  postalCode: '107-0062',
  prefecture: '東京都',
  city: '港区',
  address: null,
  building: null,
  birthDate: '1990-04-01',
  gender: 'female',
  occupation: null,
  membershipTier: 'gold',
  preferences: { preferredServices: ['cut'], notes: null },
  notes: null,
  internalNotes: null,
  tags: ['regular'],
  referredBy: REFERRER_ID,
  referralCode: 'HANAKO2026',
  allowMarketing: true,
  allowSms: false,
  allowEmail: true,
  isActive: true,
  hairType: 'wavy',
  hairThickness: null,
  scalpCondition: null,
  customerStatus: 'active',
  ...overrides,
})

/** The second version: an update of the first. */
const updated = (
  overrides: Partial<DbCustomerVersion> = {},
): CustomerVersionWithPrevious => ({
  version: dbVersion({
    id: VERSION_ID(2),
    version: 2,
    operation: 'update',
    changedAt: '2026-11-15 10:00:00+00',
    ...overrides,
  }),
  previous: dbVersion(),
})

const listed = (
  versions: CustomerVersionWithPrevious[],
  more: Partial<{ total: number; hasMore: boolean }> = {},
): CustomerVersionListing => ({
  type: 'listed',
  versions,
  total: versions.length,
  hasMore: false,
  ...more,
})

const dependenciesWith = (
  overrides: Partial<ICustomerVersionRepository> = {},
): CustomerVersionUseCaseDependencies => ({
  customerVersionRepository: {
    list: vi.fn(async () => Result.success(listed([updated()]))),
    find: vi.fn(async () =>
      Result.success<CustomerVersionLookup>({
        type: 'found',
        version: dbVersion(),
      }),
    ),
    ...overrides,
  },
})

/** Those who may delete a customer: they read the history and the versions. */
const mayRead: [string, Actor][] = [
  ['an admin', actors.admin],
  ['the owner of a salon', actors.ofSalon('owner', SALON_ID)],
  ['a manager of a salon', actors.ofSalon('manager', SALON_ID)],
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
]

const mayNotRead: [string, Actor][] = [
  ['a staff member of a salon', actors.ofSalon('staff', SALON_ID)],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user without a scope', actors.withoutScope],
]

describe('GetCustomerHistoryUseCase', () => {
  const history = (
    dependencies: CustomerVersionUseCaseDependencies,
    query: Result<unknown, DomainError> = Result.success({}),
    actor: Actor = actors.admin,
    id: unknown = CUSTOMER_ID,
  ) => new GetCustomerHistoryUseCase(dependencies).execute(actor, id, query)

  describe('who reads it', () => {
    it.each(mayRead)('lets %s read it', async (_who, actor) => {
      const dependencies = dependenciesWith()

      const result = await history(dependencies, undefined, actor)

      expect(result.type).toBe('success')
    })

    it.each(mayNotRead)(
      'refuses %s before the ID and the query are read',
      async (_who, actor) => {
        const dependencies = dependenciesWith()

        const result = await history(
          dependencies,
          Result.success({ limit: 0 }),
          actor,
          'not-an-id',
        )

        expect(result).toEqual(forbidden)
        expect(
          dependencies.customerVersionRepository.list,
        ).not.toHaveBeenCalled()
      },
    )
  })

  describe('the ID and the query', () => {
    it('refuses an ID that is not one, before the query', async () => {
      const dependencies = dependenciesWith()

      const result = await history(
        dependencies,
        Result.success({ limit: 0 }),
        actors.admin,
        'latest',
      )

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(dependencies.customerVersionRepository.list).not.toHaveBeenCalled()
    })

    it('passes on a query the caller could not decode', async () => {
      const undecoded = Result.error(
        DomainErrors.validation('Invalid customer history search', [
          {
            field: 'limit',
            rule: 'invalid_format',
            message: 'Must be a number',
          },
        ]),
      )

      const result = await history(dependenciesWith(), undecoded)

      expect(result).toEqual(undecoded)
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      ['a limit of 0', { limit: 0 }, ['limit:too_small']],
      ['a limit of 101', { limit: 101 }, ['limit:too_big']],
      ['a limit that is not whole', { limit: 1.5 }, ['limit:invalid_type']],
      [
        'a cursor that is not an ID',
        { cursor: 'next' },
        ['cursor:invalid_format'],
      ],
      ['a parameter it does not know', { page: 2 }, ['page:unrecognized_keys']],
    ])('refuses %s', async (_case, query, rules) => {
      const dependencies = dependenciesWith()

      const result = await history(dependencies, Result.success(query))

      expect(rulesOf(result)).toEqual(rules)
      expect(dependencies.customerVersionRepository.list).not.toHaveBeenCalled()
    })

    it('reads 20 versions from the newest when the query names no page', async () => {
      const dependencies = dependenciesWith()

      await history(
        dependencies,
        Result.success({}),
        actors.admin,
        CUSTOMER_ID.toUpperCase(),
      )

      expect(dependencies.customerVersionRepository.list).toHaveBeenCalledWith({
        customerId: CUSTOMER_ID,
        limit: 20,
        after: null,
      })
    })

    it('reads the page the query names, after the version of the cursor', async () => {
      const dependencies = dependenciesWith()

      await history(
        dependencies,
        Result.success({ limit: 100, cursor: VERSION_ID(5).toUpperCase() }),
      )

      expect(dependencies.customerVersionRepository.list).toHaveBeenCalledWith({
        customerId: CUSTOMER_ID,
        limit: 100,
        after: VERSION_ID(5),
      })
    })
  })

  describe('what the repository finds', () => {
    it('answers a customer that is not there as not found', async () => {
      const result = await history(
        dependenciesWith({
          list: vi.fn(async () =>
            Result.success<CustomerVersionListing>({
              type: 'customerNotFound',
            }),
          ),
        }),
      )

      expect(result).toEqual(
        Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
      )
    })

    it('refuses a cursor that is not a version of the customer', async () => {
      const result = await history(
        dependenciesWith({
          list: vi.fn(async () =>
            Result.success<CustomerVersionListing>({ type: 'cursorNotFound' }),
          ),
        }),
        Result.success({ cursor: VERSION_ID(9) }),
      )

      expect(rulesOf(result)).toEqual(['cursor:not_found'])
    })

    it('passes a failure of the database on', async () => {
      const result = await history(
        dependenciesWith({ list: vi.fn(async () => databaseDown) }),
      )

      expect(result).toEqual(databaseDown)
    })

    it('answers a stored version that does not match the API model as a fault of the database', async () => {
      const results = await Promise.all(
        [
          updated({ changedAt: 'yesterday' }),
          { ...updated(), previous: dbVersion({ gender: 'unknown' }) },
        ].map((entry) =>
          history(
            dependenciesWith({
              list: vi.fn(async () => Result.success(listed([entry]))),
            }),
          ),
        ),
      )

      expect(
        results.map((result) => result.type === 'error' && result.error.type),
      ).toEqual(['database', 'database'])
    })
  })

  describe('the entries', () => {
    it('tells of an update the values of the ledger that differ from the version before, in the order of the response', async () => {
      const result = await history(
        dependenciesWith({
          list: vi.fn(async () =>
            Result.success(
              listed([
                updated({
                  email: 'hanako@example.com',
                  birthDate: null,
                  preferences: {
                    preferredServices: ['cut', 'color'],
                    notes: null,
                  },
                  tags: ['regular', 'vip'],
                  customerStatus: 'vip',
                }),
              ]),
            ),
          ),
        }),
      )

      expect(result.type === 'success' && result.data.data).toEqual([
        {
          id: VERSION_ID(2),
          customerId: CUSTOMER_ID,
          version: 2,
          operation: 'update',
          changedBy: USER_ID,
          changedAt: '2026-11-15T10:00:00.000Z',
          changes: [
            {
              field: 'email',
              oldValue: 'hanako.yamada@example.com',
              newValue: 'hanako@example.com',
            },
            { field: 'birthDate', oldValue: '1990-04-01', newValue: null },
            {
              field: 'preferences',
              oldValue: { preferredServices: ['cut'], notes: null },
              newValue: { preferredServices: ['cut', 'color'], notes: null },
            },
            {
              field: 'tags',
              oldValue: ['regular'],
              newValue: ['regular', 'vip'],
            },
            { field: 'customerStatus', oldValue: 'active', newValue: 'vip' },
          ],
        },
      ])
    })

    it('tells of a merge the values it changed, as of an update', async () => {
      const merge = updated({ email: 'hanako@example.com', notes: null })
      const result = await history(
        dependenciesWith({
          list: vi.fn(async () =>
            Result.success(
              listed([
                { ...merge, version: { ...merge.version, operation: 'merge' } },
              ]),
            ),
          ),
        }),
      )

      expect(result.type === 'success' && result.data.data[0]).toMatchObject({
        operation: 'merge',
        changes: [
          {
            field: 'email',
            oldValue: 'hanako.yamada@example.com',
            newValue: 'hanako@example.com',
          },
        ],
      })
    })

    it('tells of an update that wrote the values it found that nothing changed', async () => {
      const result = await history(dependenciesWith())

      expect(result.type === 'success' && result.data.data[0]?.changes).toEqual(
        [],
      )
    })

    it.each<[string, CustomerVersionWithPrevious]>([
      ['the first version', { version: dbVersion(), previous: null }],
      [
        'a baseline',
        {
          version: dbVersion({ operation: 'baseline', changedBy: null }),
          previous: null,
        },
      ],
      [
        'an update whose predecessor is not kept',
        { ...updated({ notes: 'changed' }), previous: null },
      ],
      [
        'a delete',
        {
          ...updated(),
          version: { ...updated().version, operation: 'delete' },
        },
      ],
      [
        'a restore',
        {
          ...updated(),
          version: { ...updated().version, operation: 'restore', notes: 'x' },
        },
      ],
    ])('tells no changes of %s', async (_case, entry) => {
      const result = await history(
        dependenciesWith({
          list: vi.fn(async () => Result.success(listed([entry]))),
        }),
      )

      expect(
        result.type === 'success' && result.data.data[0]?.changes,
      ).toBeNull()
      expect(result.type === 'success' && result.data.data[0]?.changedBy).toBe(
        entry.version.changedBy,
      )
    })

    it('pages forwards: the next cursor is the last version of a page that has more after it', async () => {
      const page = [
        {
          ...updated(),
          version: { ...updated().version, id: VERSION_ID(3), version: 3 },
        },
        updated(),
      ]

      const [more, last] = await Promise.all(
        [true, false].map((hasMore) =>
          history(
            dependenciesWith({
              list: vi.fn(async () =>
                Result.success(listed(page, { total: 7, hasMore })),
              ),
            }),
            Result.success({ limit: 2, cursor: VERSION_ID(4) }),
          ),
        ),
      )

      expect(more?.type === 'success' && more.data.meta).toEqual({
        total: 7,
        limit: 2,
        hasMore: true,
        cursor: VERSION_ID(4),
        nextCursor: VERSION_ID(2),
        prevCursor: null,
      })
      expect(last?.type === 'success' && last.data.meta.nextCursor).toBeNull()
      expect(
        more?.type === 'success' && more.data.data.map(({ id }) => id),
      ).toEqual([VERSION_ID(3), VERSION_ID(2)])
    })
  })
})

describe('GetCustomerVersionUseCase', () => {
  const get = (
    dependencies: CustomerVersionUseCaseDependencies,
    version: unknown = '1',
    actor: Actor = actors.admin,
    id: unknown = CUSTOMER_ID,
  ) => new GetCustomerVersionUseCase(dependencies).execute(actor, id, version)

  it.each(mayRead)('lets %s read a version', async (_who, actor) => {
    const result = await get(dependenciesWith(), '1', actor)

    expect(result).toEqual(Result.success(apiVersion()))
  })

  it.each(mayNotRead)(
    'refuses %s before the ID and the number are read',
    async (_who, actor) => {
      const dependencies = dependenciesWith()

      const result = await get(dependencies, 'first', actor, 'not-an-id')

      expect(result).toEqual(forbidden)
      expect(dependencies.customerVersionRepository.find).not.toHaveBeenCalled()
    },
  )

  it('reads the version of the number in the path, of the customer in lower case', async () => {
    const dependencies = dependenciesWith()

    await get(dependencies, '12', actors.admin, CUSTOMER_ID.toUpperCase())

    expect(dependencies.customerVersionRepository.find).toHaveBeenCalledWith(
      CUSTOMER_ID,
      12,
    )
  })

  it('takes the largest number an int32 holds', async () => {
    const dependencies = dependenciesWith()

    await get(dependencies, '2147483647')

    expect(dependencies.customerVersionRepository.find).toHaveBeenCalledWith(
      CUSTOMER_ID,
      2_147_483_647,
    )
  })

  it.each<[string, string, string[]]>([
    ['a word', 'first', ['version:invalid_format']],
    ['a negative number', '-1', ['version:invalid_format']],
    ['a fraction', '1.5', ['version:invalid_format']],
    ['0', '0', ['version:too_small']],
    ['a number beyond an int32', '2147483648', ['version:too_big']],
  ])('refuses %s as the number', async (_case, version, rules) => {
    const dependencies = dependenciesWith()

    const result = await get(dependencies, version)

    expect(rulesOf(result)).toEqual(rules)
    expect(dependencies.customerVersionRepository.find).not.toHaveBeenCalled()
  })

  it('refuses an ID that is not one before the number', async () => {
    const result = await get(
      dependenciesWith(),
      'first',
      actors.admin,
      'latest',
    )

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
  })

  it('answers a customer that is not there as not found', async () => {
    const result = await get(
      dependenciesWith({
        find: vi.fn(async () =>
          Result.success<CustomerVersionLookup>({ type: 'customerNotFound' }),
        ),
      }),
    )

    expect(result).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('answers a number the customer has no version of as not found, naming the version', async () => {
    const result = await get(
      dependenciesWith({
        find: vi.fn(async () =>
          Result.success<CustomerVersionLookup>({ type: 'versionNotFound' }),
        ),
      }),
      '3',
    )

    expect(result).toEqual(
      Result.error(DomainErrors.notFound('Version 3 of customer', CUSTOMER_ID)),
    )
  })

  it('passes a failure of the database on, and answers a stored version that does not match the API model as one', async () => {
    const down = await get(
      dependenciesWith({ find: vi.fn(async () => databaseDown) }),
    )
    const corrupt = await get(
      dependenciesWith({
        find: vi.fn(async () =>
          Result.success<CustomerVersionLookup>({
            type: 'found',
            version: dbVersion({ preferences: { preferredServices: 'cut' } }),
          }),
        ),
      }),
    )

    expect(down).toEqual(databaseDown)
    expect(corrupt.type === 'error' && corrupt.error.type).toBe('database')
  })
})
