import { Result } from '@beauty-salon-backend/utility'
import {
  customerMessages,
  entityMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiCustomer,
  customerCreateRequest,
  customerDependencies,
  dbCustomer,
  OTHER_CUSTOMER_ID,
  REFERRER_ID,
} from '../../../__tests__/fixtures/customer-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
  saidOfBrokenRules,
} from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type {
  CustomerCreation,
  CustomerDeletion,
  CustomerRestoration,
  CustomerUpdate,
  ICustomerRepository,
} from '../../../repositories/customer.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CreateCustomerUseCase,
  type CustomerUseCaseDependencies,
  DeleteCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  RestoreCustomerUseCase,
  UpdateCustomerUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const customerNotFound = (id: string) =>
  Result.error(DomainErrors.notFound(entityMessages.customer, id))
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}
const emailTaken = Result.error(
  DomainErrors.alreadyExists(
    entityMessages.customer,
    'email',
    'hanako.yamada@example.com',
  ),
)
const referralCodeTaken = Result.error(
  DomainErrors.alreadyExists(
    entityMessages.customer,
    'referralCode',
    'HANAKO2026',
  ),
)

/** A row whose update time cannot be read: it cannot be turned into a response. */
const corruptCustomer = dbCustomer({ updatedAt: 'yesterday' })

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/** The methods of the repository that were called, in the order of the calls. */
const repositoryCalls = ({
  customerRepository,
}: CustomerUseCaseDependencies): string[] =>
  Object.entries(customerRepository)
    .flatMap(([name, method]) =>
      callOrdersOf(method).map((order) => ({ name, order })),
    )
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Customer IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${CUSTOMER_ID}0`],
  ['a UUID with a space in front', ` ${CUSTOMER_ID}`],
  ['a UUID without its hyphens', CUSTOMER_ID.replaceAll('-', '')],
]

const creating = (outcome: CustomerCreation): Partial<ICustomerRepository> => ({
  create: vi.fn(async () => Result.success(outcome)),
})

const updating = (outcome: CustomerUpdate): Partial<ICustomerRepository> => ({
  update: vi.fn(async () => Result.success(outcome)),
})

const failing = (
  method: keyof ICustomerRepository,
  error: Result<never, DomainError>,
): Partial<ICustomerRepository> => ({ [method]: vi.fn(async () => error) })

/** Repositories in which no customer is there and no write would succeed. */
const nothingThere = (): CustomerUseCaseDependencies =>
  customerDependencies({
    ...creating({ type: 'referrerNotFound' }),
    ...updating({ type: 'notFound' }),
    findById: vi.fn(async () => Result.success(null)),
    list: vi.fn(async () => Result.success(null)),
    delete: vi.fn(async () =>
      Result.success<CustomerDeletion>({ type: 'notFound' }),
    ),
    restore: vi.fn(async () =>
      Result.success<CustomerRestoration>({ type: 'notFound' }),
    ),
  })

/** The time of the clock, and the birth dates it accepts and refuses. */
const birthDateBoundaries: [string, string, string, string[]][] = [
  [
    'the first day there is a rule for',
    '2026-11-14T09:00:00.000Z',
    '1900-01-01',
    [],
  ],
  [
    'the day before 1900',
    '2026-11-14T09:00:00.000Z',
    '1899-12-31',
    ['birthDate:too_small'],
  ],
  [
    'the day after the UTC date, at the last moment of a UTC day',
    '2026-11-15T23:59:59.999Z',
    '2026-11-16',
    [],
  ],
  [
    'two days after the UTC date, at the last moment of a UTC day',
    '2026-11-15T23:59:59.999Z',
    '2026-11-17',
    ['birthDate:too_big'],
  ],
  [
    'the day after the UTC date, at the first moment of a UTC day',
    '2026-11-16T00:00:00.000Z',
    '2026-11-17',
    [],
  ],
]

describe('CreateCustomerUseCase', () => {
  const create = (
    dependencies: CustomerUseCaseDependencies,
    input: unknown,
    actor: Actor = actors.admin,
  ) => new CreateCustomerUseCase(dependencies).execute(actor, input)

  it('stores the customer with the properties of the request as its columns and returns the stored customer as the API presents it', async () => {
    const dependencies = customerDependencies()

    const result = await create(dependencies, customerCreateRequest())

    expect(dependencies.customerRepository.create).toHaveBeenCalledWith(
      customerCreateRequest(),
      USER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['create'])
    expect(result).toEqual({ type: 'success', data: apiCustomer() })
  })

  it('hands the email on in lower case and a referrer written in upper case as the lower-case ID', async () => {
    const dependencies = customerDependencies()

    await create(dependencies, {
      ...customerCreateRequest(),
      email: 'Hanako.Yamada@Example.COM',
      referredBy: REFERRER_ID.toUpperCase(),
    })

    expect(dependencies.customerRepository.create).toHaveBeenCalledWith(
      customerCreateRequest(),
      USER_ID,
    )
  })

  it('hands null on as null for the properties that may be unset, and no tags as none', async () => {
    const dependencies = customerDependencies()
    const request = {
      ...customerCreateRequest(),
      firstNameKana: null,
      lastNameKana: null,
      alternativePhone: null,
      postalCode: null,
      prefecture: null,
      city: null,
      address: null,
      building: null,
      birthDate: null,
      gender: null,
      occupation: null,
      preferences: null,
      notes: null,
      internalNotes: null,
      tags: [],
      referredBy: null,
      referralCode: null,
      hairType: null,
      hairThickness: null,
      scalpCondition: null,
    }

    await create(dependencies, request)

    expect(dependencies.customerRepository.create).toHaveBeenCalledWith(
      request,
      USER_ID,
    )
  })

  it.each(
    [true, false].flatMap((isActive) =>
      ['active', 'inactive', 'vip', 'blacklisted'].map(
        (customerStatus): [boolean, string] => [isActive, customerStatus],
      ),
    ),
  )(
    'hands isActive %s and the status %s on as they are sent',
    async (isActive, customerStatus) => {
      const dependencies = customerDependencies()

      await create(dependencies, {
        ...customerCreateRequest(),
        isActive,
        customerStatus,
      })

      expect(dependencies.customerRepository.create).toHaveBeenCalledWith(
        {
          ...customerCreateRequest(),
          isActive,
          customerStatus,
        },
        USER_ID,
      )
    },
  )

  it.each(birthDateBoundaries)(
    'judges %s against the clock (%s): %s breaks %j',
    async (_case, now, birthDate, expected) => {
      const dependencies = customerDependencies({}, new Date(now))

      const result = await create(dependencies, {
        ...customerCreateRequest(),
        birthDate,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual(
        expected.length === 0 ? ['create'] : [],
      )
    },
  )

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a blank name', { firstName: ' ' }, ['firstName:invalid_format']],
    [
      'a name that is too long',
      { lastName: 'a'.repeat(101) },
      ['lastName:too_big'],
    ],
    [
      'an unknown status',
      { customerStatus: 'deleted' },
      ['customerStatus:invalid_value'],
    ],
    [
      'a property the server manages',
      { visitCount: 3 },
      ['visitCount:unrecognized_keys'],
    ],
    ['null as the tags', { tags: null }, ['tags:invalid_type']],
    ['a tag named twice', { tags: ['vip', 'vip'] }, ['tags.1:custom']],
    [
      'preferences of another shape',
      { preferences: {} },
      [
        'preferences.preferredServices:invalid_type',
        'preferences.notes:invalid_type',
      ],
    ],
    [
      'a referrer that is not a UUID',
      { referredBy: 'abc' },
      ['referredBy:invalid_format'],
    ],
  ])(
    'rejects a request with %s and stores nothing',
    async (_case, change, expected) => {
      const dependencies = customerDependencies()

      const result = await create(dependencies, {
        ...customerCreateRequest(),
        ...change,
      })

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation' },
      })
      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('rejects a request that leaves a property out and stores nothing', async () => {
    const dependencies = customerDependencies()
    const { email: _email, ...withoutEmail } = customerCreateRequest()

    const result = await create(dependencies, withoutEmail)

    expect(rulesOf(result)).toEqual(['email:invalid_type'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports several broken rules together', async () => {
    const dependencies = customerDependencies()

    const result = await create(dependencies, {
      ...customerCreateRequest(),
      firstName: '',
      email: 'hanako',
      gender: 'unknown',
    })

    expect(rulesOf(result)).toEqual([
      'firstName:invalid_format',
      'email:invalid_format',
      'gender:invalid_value',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each([
    ['nothing', undefined],
    ['an empty object', {}],
    ['a list', [customerCreateRequest()]],
  ])('rejects %s as the body and stores nothing', async (_case, input) => {
    const dependencies = customerDependencies()

    const result = await create(dependencies, input)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a referrer that does not exist or is deleted as a broken rule of the referrer', async () => {
    const dependencies = customerDependencies(
      creating({ type: 'referrerNotFound' }),
    )

    const result = await create(dependencies, customerCreateRequest())

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: customerMessages.invalidCustomer,
        issues: [
          {
            field: 'referredBy',
            rule: 'not_found',
            message: ruleMessages.aCustomer,
          },
        ],
      },
    })
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })

  it.each([
    ['an email that is taken', emailTaken],
    ['a referral code that is taken', referralCodeTaken],
    ['a database error', databaseDown],
  ])('passes on %s unchanged', async (_case, error) => {
    const dependencies = customerDependencies(failing('create', error))

    const result = await create(dependencies, customerCreateRequest())

    expect(result).toEqual(error)
  })

  it('reports a stored customer that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies(
      creating({ type: 'created', customer: corruptCustomer }),
    )

    const result = await create(dependencies, customerCreateRequest())

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('GetCustomerUseCase', () => {
  const get = (dependencies: CustomerUseCaseDependencies, id: unknown) =>
    new GetCustomerUseCase(dependencies).execute(actors.admin, id)

  it('returns the customer as the API presents it', async () => {
    const dependencies = customerDependencies()

    const result = await get(dependencies, CUSTOMER_ID)

    expect(dependencies.customerRepository.findById).toHaveBeenCalledWith(
      CUSTOMER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['findById'])
    expect(result).toEqual({ type: 'success', data: apiCustomer() })
  })

  it('looks the ID up in lower case when the path writes it in upper case', async () => {
    const dependencies = customerDependencies()

    await get(dependencies, CUSTOMER_ID.toUpperCase())

    expect(dependencies.customerRepository.findById).toHaveBeenCalledWith(
      CUSTOMER_ID,
    )
  })

  it.each(malformedIds)(
    'rejects %s as the ID without reading anything',
    async (_case, id) => {
      const dependencies = customerDependencies()

      const result = await get(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a customer that does not exist, or is deleted, as not found with its lower-case ID', async () => {
    const dependencies = customerDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await get(dependencies, OTHER_CUSTOMER_ID.toUpperCase())

    expect(result).toEqual(customerNotFound(OTHER_CUSTOMER_ID))
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = customerDependencies(failing('findById', databaseDown))

    const result = await get(dependencies, CUSTOMER_ID)

    expect(result).toEqual(databaseDown)
  })

  it('reports a stored customer that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies({
      findById: vi.fn(async () => Result.success(corruptCustomer)),
    })

    const result = await get(dependencies, CUSTOMER_ID)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('ListCustomersUseCase', () => {
  const list = (
    dependencies: CustomerUseCaseDependencies,
    query: unknown = {},
    actor: Actor = actors.admin,
  ) =>
    new ListCustomersUseCase(dependencies).execute(actor, Result.success(query))

  const listing = (
    customers = [dbCustomer()],
    total = customers.length,
    hasMore = false,
  ): Partial<ICustomerRepository> => ({
    list: vi.fn(async () => Result.success({ customers, total, hasMore })),
  })

  /** What the repository is asked for when the query names nothing. */
  const everyone = {
    limit: 20,
    after: null,
    search: null,
    phoneDigits: null,
    tags: [],
    registeredFrom: null,
    registeredTo: null,
    customerStatus: null,
    membershipTier: null,
  }

  /** A query that could not be decoded, as the HTTP layer reports it. */
  const undecodable = Result.error(
    DomainErrors.validation(customerMessages.invalidCustomerSearch, [
      { field: 'limit', rule: 'invalid_format', message: MADE_UP_MESSAGE },
    ]),
  )

  it('lists the first 20 customers, of every status and tier, without a keyword or a tag, by default', async () => {
    const dependencies = customerDependencies()

    const result = await list(dependencies)

    expect(dependencies.customerRepository.list).toHaveBeenCalledWith(everyone)
    expect(repositoryCalls(dependencies)).toEqual(['list'])
    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiCustomer()],
        meta: {
          total: 1,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('hands every parameter of the query on to the repository', async () => {
    const dependencies = customerDependencies()

    await list(dependencies, {
      limit: 5,
      cursor: OTHER_CUSTOMER_ID,
      search: '山田',
      tags: ['vip', 'color'],
      registeredFrom: '2026-11-01T00:00:00Z',
      registeredTo: '2026-11-14T09:00:00.123Z',
      customerStatus: 'vip',
      membershipTier: 'gold',
    })

    expect(dependencies.customerRepository.list).toHaveBeenCalledWith({
      limit: 5,
      after: OTHER_CUSTOMER_ID,
      search: '山田',
      phoneDigits: null,
      tags: ['vip', 'color'],
      registeredFrom: '2026-11-01T00:00:00Z',
      registeredTo: '2026-11-14T09:00:00.123Z',
      customerStatus: 'vip',
      membershipTier: 'gold',
    })
  })

  it.each([
    ['090-1234', '0901234'],
    ['090 1234 5678', '09012345678'],
    ['09012345678', '09012345678'],
    ['(090)1234', '0901234'],
    ['+81 90-1234-5678', '819012345678'],
  ])(
    'compares the keyword %s, written like a phone number, with the phone numbers as the digits %s, and with the text as it is',
    async (search, phoneDigits) => {
      const dependencies = customerDependencies()

      await list(dependencies, { search })

      expect(dependencies.customerRepository.list).toHaveBeenCalledWith({
        ...everyone,
        search,
        phoneDigits,
      })
    },
  )

  it.each([
    ['a name', 'Hanako'],
    ['an email that contains digits', 'hanako090@example.com'],
    ['digits with a letter', '090-1234-567x'],
    ['separators without a digit', '+-()'],
  ])(
    'compares a keyword that is %s with the text only, not with the phone numbers',
    async (_case, search) => {
      const dependencies = customerDependencies()

      await list(dependencies, { search })

      expect(dependencies.customerRepository.list).toHaveBeenCalledWith({
        ...everyone,
        search,
        phoneDigits: null,
      })
    },
  )

  it('hands a cursor written in upper case on in lower case, and repeats it in lower case', async () => {
    const dependencies = customerDependencies()

    const result = await list(dependencies, {
      cursor: OTHER_CUSTOMER_ID.toUpperCase(),
    })

    expect(dependencies.customerRepository.list).toHaveBeenCalledWith({
      ...everyone,
      after: OTHER_CUSTOMER_ID,
    })
    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { cursor: OTHER_CUSTOMER_ID } },
    })
  })

  it('returns the customers in the order of the repository and names the last one as the next cursor when more follow', async () => {
    const dependencies = customerDependencies(
      listing(
        [dbCustomer({ id: OTHER_CUSTOMER_ID, lastName: '佐藤' }), dbCustomer()],
        7,
        true,
      ),
    )

    const result = await list(dependencies, {
      limit: 2,
      cursor: REFERRER_ID,
    })

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [
          apiCustomer({ id: OTHER_CUSTOMER_ID, lastName: '佐藤' }),
          apiCustomer(),
        ],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: REFERRER_ID,
          nextCursor: CUSTOMER_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor for the last page, and repeats the cursor of the request', async () => {
    const dependencies = customerDependencies(listing(undefined, 3))

    const result = await list(dependencies, { cursor: OTHER_CUSTOMER_ID })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 3,
          hasMore: false,
          cursor: OTHER_CUSTOMER_ID,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('returns an empty page when no customer matches', async () => {
    const dependencies = customerDependencies(listing([]))

    const result = await list(dependencies, { membershipTier: 'vip' })

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [],
        meta: {
          total: 0,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('refuses a cursor that the repository finds to name no customer as a broken rule of the cursor', async () => {
    const dependencies = customerDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, { cursor: OTHER_CUSTOMER_ID })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(rulesOf(result)).toEqual(['cursor:not_found'])
    expect(saidOfBrokenRules(result)).toEqual([ruleMessages.aCustomer])
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    [
      'a limit that is not a whole number',
      { limit: 1.5 },
      ['limit:invalid_type'],
    ],
    [
      'a cursor that is not an ID',
      { cursor: 'page-2' },
      ['cursor:invalid_format'],
    ],
    ['a blank keyword', { search: ' ' }, ['search:invalid_format']],
    ['a blank tag', { tags: ['vip', ''] }, ['tags.1:invalid_format']],
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
      { page: 2 },
      ['page:unrecognized_keys'],
    ],
  ])('rejects %s without reading anything', async (_case, query, expected) => {
    const dependencies = customerDependencies()

    const result = await list(dependencies, query)

    expect(rulesOf(result)).toEqual(expected)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('returns a query that could not be decoded as the error it is, without reading anything', async () => {
    const dependencies = customerDependencies()

    const result = await new ListCustomersUseCase(dependencies).execute(
      actors.admin,
      undecodable,
    )

    expect(result).toEqual(undecodable)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each([
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ])(
    'forbids %s to list, whether the query could be decoded or not',
    async (_case, actor) => {
      const dependencies = customerDependencies()
      const useCase = new ListCustomersUseCase(dependencies)

      const decoded = await useCase.execute(actor, Result.success({}))
      const notDecoded = await useCase.execute(actor, undecodable)

      expect(decoded).toEqual(forbidden)
      expect(notDecoded).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('passes on a database error of the repository', async () => {
    const dependencies = customerDependencies(failing('list', databaseDown))

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
  })

  it('reports a page with a stored customer that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies(
      listing([dbCustomer({ id: OTHER_CUSTOMER_ID }), corruptCustomer]),
    )

    const result = await list(dependencies)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateCustomerUseCase', () => {
  const update = (
    dependencies: CustomerUseCaseDependencies,
    id: unknown,
    input: unknown,
  ) => new UpdateCustomerUseCase(dependencies).execute(actors.admin, id, input)

  it('hands only the properties of the request on as changes of the customer of the path, and returns the customer as stored', async () => {
    const dependencies = customerDependencies(
      updating({
        type: 'updated',
        customer: dbCustomer({ lastName: '佐藤' }),
      }),
    )

    const result = await update(dependencies, CUSTOMER_ID, {
      lastName: '佐藤',
    })

    expect(dependencies.customerRepository.update).toHaveBeenCalledWith(
      CUSTOMER_ID,
      { lastName: '佐藤' },
      USER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['update'])
    expect(result).toEqual({
      type: 'success',
      data: apiCustomer({ lastName: '佐藤' }),
    })
  })

  it('hands the ID of the path, the email and the referrer on in lower case', async () => {
    const dependencies = customerDependencies()

    await update(dependencies, CUSTOMER_ID.toUpperCase(), {
      email: 'Hanako.Sato@Example.COM',
      referredBy: OTHER_CUSTOMER_ID.toUpperCase(),
    })

    expect(dependencies.customerRepository.update).toHaveBeenCalledWith(
      CUSTOMER_ID,
      { email: 'hanako.sato@example.com', referredBy: OTHER_CUSTOMER_ID },
      USER_ID,
    )
  })

  it('hands null on as null, which clears the column, and an empty list of tags as empty', async () => {
    const dependencies = customerDependencies()
    const changes = {
      referredBy: null,
      preferences: null,
      birthDate: null,
      tags: [],
    }

    await update(dependencies, CUSTOMER_ID, changes)

    expect(dependencies.customerRepository.update).toHaveBeenCalledWith(
      CUSTOMER_ID,
      changes,
      USER_ID,
    )
  })

  it('hands every property on when the request names every property', async () => {
    const dependencies = customerDependencies()

    await update(dependencies, CUSTOMER_ID, customerCreateRequest())

    expect(dependencies.customerRepository.update).toHaveBeenCalledWith(
      CUSTOMER_ID,
      customerCreateRequest(),
      USER_ID,
    )
  })

  it('rejects an empty request with one error for the request as a whole and changes nothing', async () => {
    const dependencies = customerDependencies()

    const result = await update(dependencies, CUSTOMER_ID, {})

    expect(rulesOf(result)).toEqual([':custom'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a blank name', { firstName: '' }, ['firstName:invalid_format']],
    ['null as the tags', { tags: null }, ['tags:invalid_type']],
    [
      'null as the status',
      { customerStatus: null },
      ['customerStatus:invalid_value'],
    ],
    [
      'a property the server manages',
      { createdAt: '2026-11-14T09:00:00.000Z' },
      ['createdAt:unrecognized_keys'],
    ],
    [
      'a property that does not exist',
      { salonId: SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'a preferred service named twice',
      { preferences: { preferredServices: ['cut', 'cut'], notes: null } },
      ['preferences.preferredServices.1:custom'],
    ],
  ])(
    'rejects a request with %s and changes nothing',
    async (_case, input, expected) => {
      const dependencies = customerDependencies()

      const result = await update(dependencies, CUSTOMER_ID, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the ID without changing anything',
    async (_case, id) => {
      const dependencies = customerDependencies()

      const result = await update(dependencies, id, { lastName: '佐藤' })

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['in lower case', CUSTOMER_ID, CUSTOMER_ID],
    ['in upper case in the path', CUSTOMER_ID.toUpperCase(), CUSTOMER_ID],
    ['in upper case in the body', CUSTOMER_ID, CUSTOMER_ID.toUpperCase()],
  ])(
    'refuses the customer itself as its referrer, written %s, as circular without looking for the customer',
    async (_case, id, referredBy) => {
      const dependencies = customerDependencies()

      const result = await update(dependencies, id, { referredBy })

      expect(rulesOf(result)).toEqual(['referredBy:circular'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('refuses the customer itself as its referrer also for an ID that no customer has', async () => {
    const dependencies = nothingThere()

    const result = await update(dependencies, OTHER_CUSTOMER_ID, {
      referredBy: OTHER_CUSTOMER_ID,
    })

    expect(rulesOf(result)).toEqual(['referredBy:circular'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a birth date in the future and the customer itself as its referrer together', async () => {
    const dependencies = customerDependencies()

    const result = await update(dependencies, CUSTOMER_ID, {
      birthDate: '2999-01-01',
      referredBy: CUSTOMER_ID,
    })

    expect(rulesOf(result).toSorted()).toEqual([
      'birthDate:too_big',
      'referredBy:circular',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each(birthDateBoundaries)(
    'judges %s against the clock (%s): %s breaks %j',
    async (_case, now, birthDate, expected) => {
      const dependencies = customerDependencies({}, new Date(now))

      const result = await update(dependencies, CUSTOMER_ID, { birthDate })

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual(
        expected.length === 0 ? ['update'] : [],
      )
    },
  )

  it('reports a customer that does not exist, or is deleted, as not found with its lower-case ID', async () => {
    const dependencies = customerDependencies(updating({ type: 'notFound' }))

    const result = await update(dependencies, OTHER_CUSTOMER_ID.toUpperCase(), {
      lastName: '佐藤',
    })

    expect(result).toEqual(customerNotFound(OTHER_CUSTOMER_ID))
  })

  it('reports a referrer that does not exist or is deleted as a broken rule of the referrer', async () => {
    const dependencies = customerDependencies(
      updating({ type: 'referrerNotFound' }),
    )

    const result = await update(dependencies, CUSTOMER_ID, {
      referredBy: OTHER_CUSTOMER_ID,
    })

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation' },
    })
    expect(rulesOf(result)).toEqual(['referredBy:not_found'])
  })

  it.each([
    ['an email that is taken', emailTaken],
    ['a referral code that is taken', referralCodeTaken],
    ['a database error', databaseDown],
  ])('passes on %s unchanged', async (_case, error) => {
    const dependencies = customerDependencies(failing('update', error))

    const result = await update(dependencies, CUSTOMER_ID, {
      email: 'hanako.yamada@example.com',
      referralCode: 'HANAKO2026',
    })

    expect(result).toEqual(error)
  })

  it('reports a stored customer that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies(
      updating({ type: 'updated', customer: corruptCustomer }),
    )

    const result = await update(dependencies, CUSTOMER_ID, {
      lastName: '佐藤',
    })

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('DeleteCustomerUseCase', () => {
  const remove = (dependencies: CustomerUseCaseDependencies, id: unknown) =>
    new DeleteCustomerUseCase(dependencies).execute(actors.admin, id)

  it('deletes the customer of the path and resolves to its ID', async () => {
    const dependencies = customerDependencies()

    const result = await remove(dependencies, CUSTOMER_ID)

    expect(dependencies.customerRepository.delete).toHaveBeenCalledWith(
      CUSTOMER_ID,
      USER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['delete'])
    expect(result).toEqual({ type: 'success', data: CUSTOMER_ID })
  })

  it('deletes the customer by its lower-case ID when the path writes it in upper case, and resolves to the lower-case ID', async () => {
    const dependencies = customerDependencies()

    const result = await remove(dependencies, CUSTOMER_ID.toUpperCase())

    expect(dependencies.customerRepository.delete).toHaveBeenCalledWith(
      CUSTOMER_ID,
      USER_ID,
    )
    expect(result).toEqual({ type: 'success', data: CUSTOMER_ID })
  })

  it.each(malformedIds)(
    'rejects %s as the ID without deleting anything',
    async (_case, id) => {
      const dependencies = customerDependencies()

      const result = await remove(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a customer that does not exist, or is already deleted, as not found with its lower-case ID', async () => {
    const dependencies = customerDependencies({
      delete: vi.fn(async () =>
        Result.success<CustomerDeletion>({ type: 'notFound' }),
      ),
    })

    const result = await remove(dependencies, OTHER_CUSTOMER_ID.toUpperCase())

    expect(result).toEqual(customerNotFound(OTHER_CUSTOMER_ID))
  })

  it('refuses to delete a customer who has bookings that are not finished as a conflict', async () => {
    const dependencies = customerDependencies({
      delete: vi.fn(async () =>
        Result.success<CustomerDeletion>({ type: 'bookingsUnfinished' }),
      ),
    })

    const result = await remove(dependencies, CUSTOMER_ID)

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The customer cannot be deleted: bookings that are not finished refer to it',
      },
    })
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = customerDependencies(failing('delete', databaseDown))

    const result = await remove(dependencies, CUSTOMER_ID)

    expect(result).toEqual(databaseDown)
  })
})

describe('RestoreCustomerUseCase', () => {
  const restore = (dependencies: CustomerUseCaseDependencies, id: unknown) =>
    new RestoreCustomerUseCase(dependencies).execute(actors.admin, id)

  const restoring = (
    outcome: CustomerRestoration,
  ): Partial<ICustomerRepository> => ({
    restore: vi.fn(async () => Result.success(outcome)),
  })

  it('restores the customer of the path as the actor, and returns it as the API presents it', async () => {
    const dependencies = customerDependencies(
      restoring({ type: 'restored', customer: dbCustomer({ userId: null }) }),
    )

    const result = await restore(dependencies, CUSTOMER_ID)

    expect(dependencies.customerRepository.restore).toHaveBeenCalledWith(
      CUSTOMER_ID,
      USER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['restore'])
    expect(result).toEqual(Result.success(apiCustomer({ userId: null })))
  })

  it('restores the customer by its lower-case ID when the path writes it in upper case', async () => {
    const dependencies = customerDependencies()

    await restore(dependencies, CUSTOMER_ID.toUpperCase())

    expect(dependencies.customerRepository.restore).toHaveBeenCalledWith(
      CUSTOMER_ID,
      USER_ID,
    )
  })

  it.each(malformedIds)(
    'rejects %s as the ID without restoring anything',
    async (_case, id) => {
      const dependencies = customerDependencies()

      const result = await restore(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a customer that does not exist as not found with its lower-case ID', async () => {
    const dependencies = customerDependencies(restoring({ type: 'notFound' }))

    const result = await restore(dependencies, OTHER_CUSTOMER_ID.toUpperCase())

    expect(result).toEqual(customerNotFound(OTHER_CUSTOMER_ID))
  })

  it('refuses to restore a customer who is not deleted as a conflict', async () => {
    const dependencies = customerDependencies(restoring({ type: 'notDeleted' }))

    const result = await restore(dependencies, CUSTOMER_ID)

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: `Customer ${CUSTOMER_ID} is not deleted, so there is nothing to restore`,
      },
    })
  })

  it('passes on the email another customer has taken since, and a database error, of the repository', async () => {
    const taken = await restore(
      customerDependencies(failing('restore', emailTaken)),
      CUSTOMER_ID,
    )
    const down = await restore(
      customerDependencies(failing('restore', databaseDown)),
      CUSTOMER_ID,
    )

    expect(taken).toEqual(emailTaken)
    expect(down).toEqual(databaseDown)
  })

  it('reports a restored row that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies(
      restoring({ type: 'restored', customer: corruptCustomer }),
    )

    const result = await restore(dependencies, CUSTOMER_ID)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('who may keep the customer ledger', () => {
  /** What a request says; whatever a test leaves out is valid. */
  type Request = {
    id?: unknown
    input?: unknown
    query?: Result<unknown, DomainError>
  }

  type Operation = (
    dependencies: CustomerUseCaseDependencies,
    actor: Actor,
    request?: Request,
  ) => Promise<Result<unknown, DomainError>>

  const listCustomers: Operation = (
    dependencies,
    actor,
    { query = Result.success({}) } = {},
  ) => new ListCustomersUseCase(dependencies).execute(actor, query)

  const createCustomer: Operation = (
    dependencies,
    actor,
    { input = customerCreateRequest() } = {},
  ) => new CreateCustomerUseCase(dependencies).execute(actor, input)

  const getCustomer: Operation = (
    dependencies,
    actor,
    { id = CUSTOMER_ID } = {},
  ) => new GetCustomerUseCase(dependencies).execute(actor, id)

  const updateCustomer: Operation = (
    dependencies,
    actor,
    { id = CUSTOMER_ID, input = { lastName: '佐藤' } } = {},
  ) => new UpdateCustomerUseCase(dependencies).execute(actor, id, input)

  const deleteCustomer: Operation = (
    dependencies,
    actor,
    { id = CUSTOMER_ID } = {},
  ) => new DeleteCustomerUseCase(dependencies).execute(actor, id)

  const restoreCustomer: Operation = (
    dependencies,
    actor,
    { id = CUSTOMER_ID } = {},
  ) => new RestoreCustomerUseCase(dependencies).execute(actor, id)

  /** Requests that are wrong in every way an operation can look at. */
  const wrongRequests: [string, Request][] = [
    ['an ID that is not a UUID', { id: 'latest' }],
    ['an invalid body', { input: { firstName: '', birthDate: '1899-12-31' } }],
    ['an empty body', { input: {} }],
    ['no body', { input: null }],
    [
      'a query that could not be decoded',
      {
        query: Result.error(
          DomainErrors.validation(customerMessages.invalidCustomerSearch, [
            {
              field: 'limit',
              rule: 'invalid_format',
              message: MADE_UP_MESSAGE,
            },
          ]),
        ),
      },
    ],
    [
      'a query with a parameter that does not exist',
      { query: Result.success({ page: '2' }) },
    ],
    [
      'the customer itself as its referrer',
      { input: { referredBy: CUSTOMER_ID } },
    ],
  ]

  /** Everyone who works for the platform or for a salon, whichever salon. */
  const staffOfAnySalon: [string, Actor][] = [
    ['an admin', actors.admin],
    ['the owner of a salon', actors.ofSalon('owner', SALON_ID)],
    ['a manager of a salon', actors.ofSalon('manager', SALON_ID)],
    ['a staff member of a salon', actors.ofSalon('staff', SALON_ID)],
    ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
    [
      'a staff member of another salon',
      actors.ofSalon('staff', OTHER_SALON_ID),
    ],
  ]

  /** Who may not read or keep the ledger. */
  const outsiders: [string, Actor][] = [
    ['a customer', actors.customer],
    ['a user without a scope', actors.withoutScope],
  ]

  const mayDelete: [string, Actor][] = [
    ['an admin', actors.admin],
    ['the owner of a salon', actors.ofSalon('owner', SALON_ID)],
    ['a manager of a salon', actors.ofSalon('manager', SALON_ID)],
    ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ]

  const mayNotDelete: [string, Actor][] = [
    ['a staff member of a salon', actors.ofSalon('staff', SALON_ID)],
    [
      'a staff member of another salon',
      actors.ofSalon('staff', OTHER_SALON_ID),
    ],
    ...outsiders,
  ]

  describe.each<
    [string, Operation, string, [string, Actor][], [string, Actor][]]
  >([
    ['list the customers', listCustomers, 'list', staffOfAnySalon, outsiders],
    ['add a customer', createCustomer, 'create', staffOfAnySalon, outsiders],
    ['read a customer', getCustomer, 'findById', staffOfAnySalon, outsiders],
    ['change a customer', updateCustomer, 'update', staffOfAnySalon, outsiders],
    ['delete a customer', deleteCustomer, 'delete', mayDelete, mayNotDelete],
    ['restore a customer', restoreCustomer, 'restore', mayDelete, mayNotDelete],
  ])('to %s', (_operation, execute, method, allowed, refused) => {
    it.each(allowed)('lets %s do it', async (_case, actor) => {
      const dependencies = customerDependencies()

      const result = await execute(dependencies, actor)

      expect(result.type).toBe('success')
      expect(repositoryCalls(dependencies)).toEqual([method])
    })

    it.each(refused)(
      'forbids %s, and reads and writes nothing',
      async (_case, actor) => {
        const dependencies = customerDependencies()

        const result = await execute(dependencies, actor)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(refused)(
      'forbids %s before looking at the ID, the query or the body',
      async (_case, actor) => {
        const dependencies = customerDependencies()

        const results = await Promise.all(
          wrongRequests.map(([, request]) =>
            execute(dependencies, actor, request),
          ),
        )

        expect(results).toEqual(wrongRequests.map(() => forbidden))
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(refused)(
      'forbids %s also where the customer does not exist',
      async (_case, actor) => {
        const dependencies = nothingThere()

        const result = await execute(dependencies, actor, {
          id: OTHER_CUSTOMER_ID,
          query: Result.success({ cursor: OTHER_CUSTOMER_ID }),
        })

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(allowed)(
      'tells %s what is wrong with the request, and only then what is stored',
      async (_case, actor) => {
        const invalid = nothingThere()
        const valid = nothingThere()

        const withInvalidRequest = await execute(invalid, actor, {
          id: 'latest',
          input: { firstName: '' },
          query: Result.success({ limit: 0 }),
        })
        const withValidRequest = await execute(valid, actor, {
          id: OTHER_CUSTOMER_ID,
          query: Result.success({ cursor: OTHER_CUSTOMER_ID }),
        })

        expect(withInvalidRequest).toMatchObject({
          type: 'error',
          error: { type: 'validation' },
        })
        expect(repositoryCalls(invalid)).toEqual([])
        expect(withValidRequest.type).toBe('error')
        expect(repositoryCalls(valid)).toEqual([method])
      },
    )
  })

  it.each<[string, Operation]>([
    ['read', getCustomer],
    ['change', updateCustomer],
    ['delete', deleteCustomer],
  ])(
    'forbids a customer to %s even the customer record their own account is linked to',
    async (_case, execute) => {
      const dependencies = customerDependencies()

      const result = await execute(dependencies, actors.customer, {
        id: CUSTOMER_ID,
      })

      expect(actors.customer.scope).toEqual({
        type: 'customer',
        customerId: CUSTOMER_ID,
      })
      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )
})

describe('the order of the checks', () => {
  it('looks at the ID of an update before the body', async () => {
    const dependencies = nothingThere()

    const result = await new UpdateCustomerUseCase(dependencies).execute(
      actors.admin,
      'latest',
      { firstName: '' },
    )

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('looks at the body of an update before the birth date and the referrer', async () => {
    const dependencies = nothingThere()

    const result = await new UpdateCustomerUseCase(dependencies).execute(
      actors.admin,
      CUSTOMER_ID,
      { lastName: '', birthDate: '2999-01-01', referredBy: CUSTOMER_ID },
    )

    expect(rulesOf(result)).toEqual(['lastName:invalid_format'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('looks at the birth date of an update before the customer and the referrer are looked for', async () => {
    const dependencies = nothingThere()

    const result = await new UpdateCustomerUseCase(dependencies).execute(
      actors.admin,
      OTHER_CUSTOMER_ID,
      { birthDate: '2999-01-01', referredBy: REFERRER_ID },
    )

    expect(rulesOf(result)).toEqual(['birthDate:too_big'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('looks at the body of a creation before the birth date, and the birth date before the referrer is looked for', async () => {
    const invalidBody = nothingThere()
    const brokenRule = nothingThere()

    const withInvalidBody = await new CreateCustomerUseCase(
      invalidBody,
    ).execute(actors.admin, {
      ...customerCreateRequest(),
      firstName: '',
      birthDate: '2999-01-01',
    })
    const withBrokenRule = await new CreateCustomerUseCase(brokenRule).execute(
      actors.admin,
      { ...customerCreateRequest(), birthDate: '2999-01-01' },
    )

    expect(rulesOf(withInvalidBody)).toEqual(['firstName:invalid_format'])
    expect(repositoryCalls(invalidBody)).toEqual([])
    expect(rulesOf(withBrokenRule)).toEqual(['birthDate:too_big'])
    expect(repositoryCalls(brokenRule)).toEqual([])
  })

  it('looks at the ID of a read or a deletion before looking for the customer', async () => {
    const dependencies = nothingThere()

    const read = await new GetCustomerUseCase(dependencies).execute(
      actors.admin,
      '42',
    )
    const deletion = await new DeleteCustomerUseCase(dependencies).execute(
      actors.admin,
      '42',
    )

    expect(rulesOf(read)).toEqual(['id:invalid_format'])
    expect(rulesOf(deletion)).toEqual(['id:invalid_format'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('looks at the query of a list before looking for the customer of the cursor', async () => {
    const dependencies = nothingThere()

    const result = await new ListCustomersUseCase(dependencies).execute(
      actors.admin,
      Result.success({ cursor: OTHER_CUSTOMER_ID, limit: 101 }),
    )

    expect(rulesOf(result)).toEqual(['limit:too_big'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })
})
