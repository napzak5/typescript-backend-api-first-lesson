import { Result } from '@beauty-salon-backend/utility'
import {
  customerMessages,
  entityMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiCustomerProfile,
  customerDependencies,
  customerProfileCreateRequest,
  dbCustomer,
  REFERRER_ID,
} from '../../../__tests__/fixtures/customer-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type {
  CustomerProfileCreation,
  CustomerUpdate,
  ICustomerRepository,
} from '../../../repositories/customer.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CreateCustomerProfileUseCase,
  type CustomerUseCaseDependencies,
  GetCustomerProfileUseCase,
  UpdateCustomerProfileUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const profileNotFound = Result.error(
  DomainErrors.notFound(entityMessages.customerProfileOfUser, USER_ID),
)
const alreadyHasProfile = Result.error(
  DomainErrors.conflict(customerMessages.alreadyHasProfile),
)
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

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

const creatingProfile = (
  outcome: CustomerProfileCreation,
): Partial<ICustomerRepository> => ({
  createProfile: vi.fn(async () => Result.success(outcome)),
})

const updating = (outcome: CustomerUpdate): Partial<ICustomerRepository> => ({
  update: vi.fn(async () => Result.success(outcome)),
})

const failing = (
  method: keyof ICustomerRepository,
  error: Result<never, DomainError>,
): Partial<ICustomerRepository> => ({ [method]: vi.fn(async () => error) })

/** Everyone who is signed in and is not a customer. */
const notCustomers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['an owner of a salon', actors.ofSalon('owner')],
  ['a manager of a salon', actors.ofSalon('manager')],
  ['a staff member of a salon', actors.ofSalon('staff')],
  ['a staff user without a staff member', actors.withoutScope],
]

/** Requests that break a rule of the shape. */
const malformed: [string, unknown, string[]][] = [
  ['null', null, [':invalid_type']],
  ['a list', [], [':invalid_type']],
  [
    'a first name that is blank',
    { ...customerProfileCreateRequest(), firstName: ' ' },
    ['firstName:invalid_format'],
  ],
]

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
]

describe('GetCustomerProfileUseCase', () => {
  const get = (
    dependencies: CustomerUseCaseDependencies,
    actor: Actor = actors.customer,
  ) => new GetCustomerProfileUseCase(dependencies).execute(actor)

  it('returns the customer record of the account as the customer sees it', async () => {
    const dependencies = customerDependencies()

    const result = await get(dependencies)

    expect(dependencies.customerRepository.findById).toHaveBeenCalledWith(
      CUSTOMER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['findById'])
    expect(result).toEqual({ type: 'success', data: apiCustomerProfile() })
  })

  it('answers an account without a customer record with not found, without reading anything', async () => {
    const dependencies = customerDependencies()

    const result = await get(dependencies, actors.customerWithoutProfile)

    expect(result).toEqual(profileNotFound)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers an account whose customer record is gone like one that never had a record', async () => {
    const dependencies = customerDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await get(dependencies)

    expect(result).toEqual(profileNotFound)
  })

  it.each(notCustomers)(
    'forbids %s, who has no profile to ask for, without reading anything',
    async (_case, actor) => {
      const dependencies = customerDependencies()

      const result = await get(dependencies, actor)

      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('passes on a database error of the repository', async () => {
    const dependencies = customerDependencies(failing('findById', databaseDown))

    const result = await get(dependencies)

    expect(result).toEqual(databaseDown)
  })

  it('reports a stored row that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies({
      findById: vi.fn(async () => Result.success(corruptCustomer)),
    })

    const result = await get(dependencies)

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('CreateCustomerProfileUseCase', () => {
  const create = (
    dependencies: CustomerUseCaseDependencies,
    input: unknown,
    actor: Actor = actors.customerWithoutProfile,
  ) => new CreateCustomerProfileUseCase(dependencies).execute(actor, input)

  it('hands the account, the new entry and the claim to the repository and returns the stored customer as the customer sees it', async () => {
    const dependencies = customerDependencies()

    const result = await create(dependencies, customerProfileCreateRequest())

    expect(dependencies.customerRepository.createProfile).toHaveBeenCalledWith(
      USER_ID,
      {
        newEntry: {
          ...customerProfileCreateRequest(),
          membershipTier: 'regular',
          notes: null,
          internalNotes: null,
          tags: [],
          referredBy: null,
          referralCode: null,
          isActive: true,
          hairType: null,
          hairThickness: null,
          scalpCondition: null,
          customerStatus: 'active',
        },
        claim: customerProfileCreateRequest(),
      },
    )
    expect(repositoryCalls(dependencies)).toEqual(['createProfile'])
    expect(result).toEqual({ type: 'success', data: apiCustomerProfile() })
  })

  it('claims with the stated properties alone: a null of the request is in the new entry and not in the claim', async () => {
    const dependencies = customerDependencies()

    await create(dependencies, {
      ...customerProfileCreateRequest(),
      birthDate: null,
      preferences: null,
    })

    const [[, write] = []] = vi.mocked(
      dependencies.customerRepository.createProfile,
    ).mock.calls
    expect(write?.newEntry).toMatchObject({
      birthDate: null,
      preferences: null,
    })
    expect(Object.keys(write?.claim ?? {})).not.toContain('birthDate')
    expect(Object.keys(write?.claim ?? {})).not.toContain('preferences')
  })

  it.each(malformed)(
    'rejects %s without writing anything',
    async (_case, input, expected) => {
      const dependencies = customerDependencies()

      const result = await create(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['the email, which is the one of the account', { email: 'a@example.com' }],
    ['a membership tier', { membershipTier: 'vip' }],
    ['a referrer', { referredBy: REFERRER_ID }],
    ['points', { loyaltyPoints: 100_000 }],
    ['the account', { userId: USER_ID }],
  ])(
    'rejects a request that states %s, without writing anything',
    async (_case, extra) => {
      const dependencies = customerDependencies()

      const result = await create(dependencies, {
        ...customerProfileCreateRequest(),
        ...extra,
      })

      expect(rulesOf(result)).toEqual(
        Object.keys(extra).map((property) => `${property}:unrecognized_keys`),
      )
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(birthDateBoundaries)(
    'checks the birth date against the clock: %s',
    async (_case, now, birthDate, expected) => {
      const dependencies = customerDependencies({}, new Date(now))

      const result = await create(dependencies, {
        ...customerProfileCreateRequest(),
        birthDate,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual(
        expected.length === 0 ? ['createProfile'] : [],
      )
    },
  )

  it.each([
    ['a request that is fine', customerProfileCreateRequest()],
    ['a request that is not', { firstName: '' }],
  ])(
    'answers an account that has a profile with a conflict, given %s, without writing anything',
    async (_case, input) => {
      const dependencies = customerDependencies()

      const result = await create(dependencies, input, actors.customer)

      expect(result).toEqual(alreadyHasProfile)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(
    notCustomers.flatMap(([name, actor]): [string, Actor, unknown][] => [
      [
        `${name} with a request that is fine`,
        actor,
        customerProfileCreateRequest(),
      ],
      [`${name} with a request that is not`, actor, { firstName: '' }],
    ]),
  )('forbids %s, without writing anything', async (_case, actor, input) => {
    const dependencies = customerDependencies()

    const result = await create(dependencies, input, actor)

    expect(result).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('forbids when the account turns out not to be a customer account by the time it is written', async () => {
    const dependencies = customerDependencies(
      creatingProfile({ type: 'notACustomerAccount' }),
    )

    const result = await create(dependencies, customerProfileCreateRequest())

    expect(result).toEqual(forbidden)
  })

  it('answers with a conflict when the account got a profile by the time it is written', async () => {
    const dependencies = customerDependencies(
      creatingProfile({ type: 'alreadyHasProfile' }),
    )

    const result = await create(dependencies, customerProfileCreateRequest())

    expect(result).toEqual(alreadyHasProfile)
  })

  it('answers an account that has not confirmed its email address with a conflict that says so', async () => {
    const dependencies = customerDependencies(
      creatingProfile({ type: 'emailNotVerified' }),
    )

    const result = await create(dependencies, customerProfileCreateRequest())

    expect(result).toEqual(
      Result.error(DomainErrors.conflict(customerMessages.confirmEmailFirst)),
    )
  })

  it('answers with a conflict when the ledger entry with the email of the account belongs to another account', async () => {
    const dependencies = customerDependencies(
      creatingProfile({ type: 'entryOfAnotherAccount' }),
    )

    const result = await create(dependencies, customerProfileCreateRequest())

    expect(result).toEqual(
      Result.error(
        DomainErrors.conflict(customerMessages.entryOfAnotherAccount),
      ),
    )
  })

  it.each([
    ['a database error', databaseDown],
    [
      'a conflict',
      Result.error(
        DomainErrors.conflict(customerMessages.registeredAtSameMoment),
      ),
    ],
  ])('passes on %s of the repository', async (_case, error) => {
    const dependencies = customerDependencies(failing('createProfile', error))

    const result = await create(dependencies, customerProfileCreateRequest())

    expect(result).toEqual(error)
  })

  it('reports a stored row that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies(
      creatingProfile({ type: 'created', customer: corruptCustomer }),
    )

    const result = await create(dependencies, customerProfileCreateRequest())

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateCustomerProfileUseCase', () => {
  const update = (
    dependencies: CustomerUseCaseDependencies,
    input: unknown,
    actor: Actor = actors.customer,
  ) => new UpdateCustomerProfileUseCase(dependencies).execute(actor, input)

  it('changes the present properties of the customer record of the account and returns the record as the customer sees it', async () => {
    const dependencies = customerDependencies()

    const result = await update(dependencies, {
      lastName: '佐藤',
      building: null,
      allowSms: true,
    })

    expect(dependencies.customerRepository.update).toHaveBeenCalledWith(
      CUSTOMER_ID,
      { lastName: '佐藤', building: null, allowSms: true },
      USER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['update'])
    expect(result).toEqual({ type: 'success', data: apiCustomerProfile() })
  })

  it.each([
    ['a request that changes nothing', {}, [':custom']],
    ['null', null, [':invalid_type']],
    ['a blank first name', { firstName: ' ' }, ['firstName:invalid_format']],
    [
      'a first name that is unset',
      { firstName: null },
      ['firstName:invalid_type'],
    ],
    [
      'the email, which is the one of the account',
      { email: 'a@example.com' },
      ['email:unrecognized_keys'],
    ],
    [
      'a membership tier',
      { lastName: '佐藤', membershipTier: 'vip' },
      ['membershipTier:unrecognized_keys'],
    ],
    [
      'a status',
      { customerStatus: 'active' },
      ['customerStatus:unrecognized_keys'],
    ],
    [
      'internal notes',
      { internalNotes: '' },
      ['internalNotes:unrecognized_keys'],
    ],
    ['points', { loyaltyPoints: 100_000 }, ['loyaltyPoints:unrecognized_keys']],
  ])('rejects %s without writing anything', async (_case, input, expected) => {
    const dependencies = customerDependencies()

    const result = await update(dependencies, input)

    expect(rulesOf(result)).toEqual(expected)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each(birthDateBoundaries)(
    'checks a new birth date against the clock: %s',
    async (_case, now, birthDate, expected) => {
      const dependencies = customerDependencies({}, new Date(now))

      const result = await update(dependencies, { birthDate })

      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual(
        expected.length === 0 ? ['update'] : [],
      )
    },
  )

  it.each([
    ['a request that is fine', { lastName: '佐藤' }],
    ['a request that is not', { firstName: '' }],
  ])(
    'answers an account without a customer record with not found, given %s, without writing anything',
    async (_case, input) => {
      const dependencies = customerDependencies()

      const result = await update(
        dependencies,
        input,
        actors.customerWithoutProfile,
      )

      expect(result).toEqual(profileNotFound)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('answers an account whose customer record is gone like one that never had a record', async () => {
    const dependencies = customerDependencies(updating({ type: 'notFound' }))

    const result = await update(dependencies, { lastName: '佐藤' })

    expect(result).toEqual(profileNotFound)
  })

  it.each(
    notCustomers.flatMap(([name, actor]): [string, Actor, unknown][] => [
      [`${name} with a request that is fine`, actor, { lastName: '佐藤' }],
      [`${name} with a request that is not`, actor, { firstName: '' }],
    ]),
  )('forbids %s, without writing anything', async (_case, actor, input) => {
    const dependencies = customerDependencies()

    const result = await update(dependencies, input, actor)

    expect(result).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a referrer the repository misses as the ledger does, though a profile names none', async () => {
    const dependencies = customerDependencies(
      updating({ type: 'referrerNotFound' }),
    )

    const result = await update(dependencies, { lastName: '佐藤' })

    expect(rulesOf(result)).toEqual(['referredBy:not_found'])
  })

  it.each([['a database error', databaseDown]])(
    'passes on %s of the repository',
    async (_case, error) => {
      const dependencies = customerDependencies(failing('update', error))

      const result = await update(dependencies, { lastName: '佐藤' })

      expect(result).toEqual(error)
    },
  )

  it('reports a stored row that cannot be presented as a database error', async () => {
    const dependencies = customerDependencies(
      updating({ type: 'updated', customer: corruptCustomer }),
    )

    const result = await update(dependencies, { lastName: '佐藤' })

    expect(result).toEqual(storedRowIsCorrupt)
  })
})
