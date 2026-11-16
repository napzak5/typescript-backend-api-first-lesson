import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  CreatePaymentMethodUseCase,
  DeletePaymentMethodUseCase,
  GetPaymentMethodUseCase,
  ListPaymentMethodsUseCase,
  type PaymentMethodUseCaseDependencies,
  UpdatePaymentMethodUseCase,
} from '../business-logic/payment-method'
import type { Actor } from '../models/auth'
import type {
  IPaymentMethodRepository,
  PaymentMethodRemoval,
  PaymentMethodUpdate,
} from '../repositories/payment-method.repository'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import {
  dbPaymentMethod,
  OTHER_PAYMENT_METHOD_ID,
  PAYMENT_METHOD_ID,
  paymentMethodCreateRequest,
  paymentMethodDependencies,
} from './payment-method-fixtures'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
}
const paymentMethodNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Payment method', id: PAYMENT_METHOD_ID },
}
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** The payment method of the fixtures as the API presents it. */
const apiPaymentMethod = {
  id: PAYMENT_METHOD_ID,
  salonId: SALON_ID,
  method: 'credit_card',
  displayName: 'クレジットカード',
  description: null,
  processorName: 'Stripe',
  fee: 3.6,
  minimumAmount: 1000,
  maximumAmount: null,
  isOnlineEnabled: false,
  isOfflineEnabled: true,
  sortOrder: 2,
  isActive: true,
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
}

/** The request of the fixtures as the repository is given it. */
const newPaymentMethod = { ...paymentMethodCreateRequest(), fee: '3.6' }

/** A row whose timestamp cannot be read: it cannot be turned into a response. */
const corruptPaymentMethod = dbPaymentMethod({ createdAt: 'yesterday' })

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** What a refused request is told, by `field`. */
const messagesOf = (
  result: Result<unknown, DomainError>,
): Record<string, string> =>
  result.type === 'error' && result.error.type === 'validation'
    ? Object.fromEntries(
        result.error.issues.map(({ field, message }) => [field, message]),
      )
    : {}

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * The methods of the two repositories that were called, in the order of the
 * calls: `salons.exists`, `paymentMethods.create`, …
 */
const repositoryCalls = ({
  salonRepository,
  paymentMethodRepository,
}: PaymentMethodUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(paymentMethodRepository).map(([name, method]) => ({
      name: `paymentMethods.${name}`,
      orders: callOrdersOf(method),
    })),
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Dependencies in which there is no such salon. */
const withoutSalon = (): PaymentMethodUseCaseDependencies =>
  paymentMethodDependencies(
    {},
    { exists: vi.fn(async () => Result.success(false)) },
  )

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): PaymentMethodUseCaseDependencies =>
  paymentMethodDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Salon and payment method IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
]

/** Who reads the payment methods of the salon of the fixtures. */
const readers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['a manager of the salon', actors.ofSalon('manager')],
  ['a staff member of the salon', actors.ofSalon('staff')],
]

/** Who does not. */
const notReaders: [string, Actor][] = [
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ['a staff member of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account without a scope', actors.withoutScope],
]

/** Who sets the payment methods of the salon of the fixtures up. */
const keepers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['a manager of the salon', actors.ofSalon('manager')],
]

/** Who does not: a staff member of the salon reads them and no more. */
const notKeepers: [string, Actor][] = [
  ['a staff member of the salon', actors.ofSalon('staff')],
  ...notReaders,
]

const updating = (
  outcome: PaymentMethodUpdate,
): Partial<IPaymentMethodRepository> => ({
  update: vi.fn(async () => Result.success(outcome)),
})

const removing = (
  outcome: PaymentMethodRemoval,
): Partial<IPaymentMethodRepository> => ({
  delete: vi.fn(async () => Result.success(outcome)),
})

describe('ListPaymentMethodsUseCase', () => {
  const list = (
    dependencies: PaymentMethodUseCaseDependencies,
    query: unknown = {},
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) =>
    new ListPaymentMethodsUseCase(dependencies).execute(
      actor,
      salon,
      Result.success(query),
    )

  it('lists the payment methods of the salon of the path, 20 to a page and unfiltered unless the query says otherwise, once the salon is known to exist', async () => {
    const dependencies = paymentMethodDependencies()

    const result = await list(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.paymentMethodRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 20,
      after: null,
      method: null,
      isActive: null,
    })
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'paymentMethods.list',
    ])
    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiPaymentMethod],
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

  it('hands the limit, the cursor and the filters of the query on', async () => {
    const dependencies = paymentMethodDependencies()

    const result = await list(dependencies, {
      limit: 5,
      cursor: OTHER_PAYMENT_METHOD_ID,
      method: 'cash',
      isActive: false,
    })

    expect(dependencies.paymentMethodRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 5,
      after: OTHER_PAYMENT_METHOD_ID,
      method: 'cash',
      isActive: false,
    })
    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { limit: 5, cursor: OTHER_PAYMENT_METHOD_ID } },
    })
  })

  it('hands on a filter for the active ones as that, not as no filter', async () => {
    const dependencies = paymentMethodDependencies()

    await list(dependencies, { isActive: true })

    expect(dependencies.paymentMethodRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    )
  })

  it('names the last payment method of a page as the cursor of the next one when more follow', async () => {
    const dependencies = paymentMethodDependencies({
      list: vi.fn(async () =>
        Result.success({
          paymentMethods: [
            dbPaymentMethod(),
            dbPaymentMethod({ id: OTHER_PAYMENT_METHOD_ID }),
          ],
          total: 7,
          hasMore: true,
        }),
      ),
    })

    const result = await list(dependencies, { limit: 2 })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: PAYMENT_METHOD_ID }, { id: OTHER_PAYMENT_METHOD_ID }],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: OTHER_PAYMENT_METHOD_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor for the last page, although it has payment methods', async () => {
    const result = await list(paymentMethodDependencies(), { limit: 1 })

    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { hasMore: false, nextCursor: null } },
    })
  })

  it('returns an empty page for a salon without payment methods', async () => {
    const dependencies = paymentMethodDependencies({
      list: vi.fn(async () =>
        Result.success({ paymentMethods: [], total: 0, hasMore: false }),
      ),
    })

    const result = await list(dependencies)

    expect(result).toMatchObject({
      type: 'success',
      data: { data: [], meta: { total: 0, hasMore: false, nextCursor: null } },
    })
  })

  it.each(readers)('lets %s read them', async (_who, actor) => {
    const result = await list(paymentMethodDependencies(), {}, actor)

    expect(result.type).toBe('success')
  })

  it.each(notReaders)(
    'refuses %s, whatever the query is, without reading anything',
    async (_who, actor) => {
      const dependencies = paymentMethodDependencies()

      const refused = await list(dependencies, { limit: 0 }, actor)
      const undecodable = await new ListPaymentMethodsUseCase(
        dependencies,
      ).execute(
        actor,
        SALON_ID,
        Result.error(DomainErrors.validation('Invalid', [])),
      )

      expect(refused).toEqual(forbidden)
      expect(undecodable).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('lets the owner of another salon read the payment methods of that salon', async () => {
    const dependencies = paymentMethodDependencies()

    const result = await list(
      dependencies,
      {},
      actors.ofSalon('owner', OTHER_SALON_ID),
      OTHER_SALON_ID,
    )

    expect(result.type).toBe('success')
    expect(dependencies.paymentMethodRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: OTHER_SALON_ID }),
    )
  })

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = paymentMethodDependencies()

      const result = await list(dependencies, {}, actors.customer, salon)

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('passes on a query that could not be decoded to an actor who may read', async () => {
    const dependencies = paymentMethodDependencies()
    const undecodable = Result.error(
      DomainErrors.validation('Invalid payment method search', [
        { field: 'limit', rule: 'invalid_type', message: 'Must be a number' },
      ]),
    )

    const result = await new ListPaymentMethodsUseCase(dependencies).execute(
      actors.admin,
      SALON_ID,
      undecodable,
    )

    expect(result).toEqual(undecodable)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a cursor that is not an ID', { cursor: 'x' }, ['cursor:invalid_format']],
    ['a method that is none', { method: 'paypal' }, ['method:invalid_value']],
    ['a parameter that is not known', { page: 2 }, ['page:unrecognized_keys']],
  ])(
    'rejects %s without looking the salon up',
    async (_case, query, expected) => {
      const dependencies = paymentMethodDependencies()

      const result = await list(dependencies, query)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: 'Invalid payment method search' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and lists nothing', async () => {
    const dependencies = withoutSalon()

    const result = await list(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('refuses a cursor that names no payment method of the salon as a broken rule of the cursor', async () => {
    const dependencies = paymentMethodDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, {
      cursor: OTHER_PAYMENT_METHOD_ID,
    })

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: 'Invalid payment method search',
        issues: [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a payment method of the salon',
          },
        ],
      },
    })
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = paymentMethodDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored payment method that cannot be presented as a database error', async () => {
    const dependencies = paymentMethodDependencies({
      list: vi.fn(async () =>
        Result.success({
          paymentMethods: [dbPaymentMethod(), corruptPaymentMethod],
          total: 2,
          hasMore: false,
        }),
      ),
    })

    expect(await list(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('CreatePaymentMethodUseCase', () => {
  const create = (
    dependencies: PaymentMethodUseCaseDependencies,
    input: unknown,
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) => new CreatePaymentMethodUseCase(dependencies).execute(actor, salon, input)

  it('stores the request in the salon of the path, the fee as text, once the salon is known to exist, and returns the stored payment method as the API presents it', async () => {
    const dependencies = paymentMethodDependencies()

    const result = await create(dependencies, paymentMethodCreateRequest())

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.paymentMethodRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      newPaymentMethod,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'paymentMethods.create',
    ])
    expect(result).toEqual({ type: 'success', data: apiPaymentMethod })
  })

  it('hands null on as null for the properties that may be unset', async () => {
    const dependencies = paymentMethodDependencies()
    const request = {
      ...paymentMethodCreateRequest(),
      description: null,
      processorName: null,
      fee: null,
      minimumAmount: null,
      maximumAmount: null,
    }

    await create(dependencies, request)

    expect(dependencies.paymentMethodRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      request,
    )
  })

  it('stores the payment method in the salon of the path, whichever salon that is', async () => {
    const dependencies = paymentMethodDependencies()

    await create(
      dependencies,
      paymentMethodCreateRequest(),
      actors.admin,
      OTHER_SALON_ID,
    )

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(
      OTHER_SALON_ID,
    )
    expect(dependencies.paymentMethodRepository.create).toHaveBeenCalledWith(
      OTHER_SALON_ID,
      newPaymentMethod,
    )
  })

  it.each(keepers)('lets %s add one', async (_who, actor) => {
    const result = await create(
      paymentMethodDependencies(),
      paymentMethodCreateRequest(),
      actor,
    )

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s, whatever the request is, without reading or writing anything',
    async (_who, actor) => {
      const dependencies = paymentMethodDependencies()

      const refused = await create(
        dependencies,
        paymentMethodCreateRequest(),
        actor,
      )
      const withoutBody = await create(dependencies, undefined, actor)

      expect(refused).toEqual(forbidden)
      expect(withoutBody).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = paymentMethodDependencies()

      const result = await create(
        dependencies,
        paymentMethodCreateRequest(),
        actors.customer,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a blank name', { displayName: ' ' }, ['displayName:invalid_format']],
    ['a method that is none', { method: 'paypal' }, ['method:invalid_value']],
    [
      'limits out of order',
      { minimumAmount: 2000, maximumAmount: 1999 },
      ['maximumAmount:custom'],
    ],
    [
      'a salon in the body',
      { salonId: OTHER_SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'the settings of a processor',
      { processorConfig: {} },
      ['processorConfig:unrecognized_keys'],
    ],
    [
      'several broken rules',
      { fee: 101, sortOrder: -1, isActive: 'yes' },
      ['fee:too_big', 'sortOrder:too_small', 'isActive:invalid_type'],
    ],
  ])(
    'rejects %s without looking the salon up or storing anything',
    async (_case, change, expected) => {
      const dependencies = paymentMethodDependencies()

      const result = await create(dependencies, {
        ...paymentMethodCreateRequest(),
        ...change,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: 'Invalid payment method' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a body that is not an object', 'method=cash'],
    ['a list of requests', [paymentMethodCreateRequest()]],
    ['a missing body', undefined],
  ])('rejects %s', async (_case, input) => {
    const dependencies = paymentMethodDependencies()

    const result = await create(dependencies, input)

    expect(rulesOf(result)).toEqual([':invalid_type'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a salon that does not exist, or is deleted, as not found and stores nothing', async () => {
    const dependencies = withoutSalon()

    const result = await create(dependencies, paymentMethodCreateRequest())

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon and stores nothing', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await create(dependencies, paymentMethodCreateRequest())

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = paymentMethodDependencies({
      create: vi.fn(async () => databaseDown),
    })

    expect(await create(dependencies, paymentMethodCreateRequest())).toEqual(
      databaseDown,
    )
  })

  it('reports a stored payment method that cannot be presented as a database error', async () => {
    const dependencies = paymentMethodDependencies({
      create: vi.fn(async () => Result.success(corruptPaymentMethod)),
    })

    expect(await create(dependencies, paymentMethodCreateRequest())).toEqual(
      storedRowIsCorrupt,
    )
  })
})

describe('GetPaymentMethodUseCase', () => {
  const get = (
    dependencies: PaymentMethodUseCaseDependencies,
    id: unknown = PAYMENT_METHOD_ID,
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) => new GetPaymentMethodUseCase(dependencies).execute(actor, salon, id)

  it('returns the payment method of the salon as the API presents it, once the salon is known to exist', async () => {
    const dependencies = paymentMethodDependencies()

    const result = await get(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.paymentMethodRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      PAYMENT_METHOD_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'paymentMethods.findById',
    ])
    expect(result).toEqual({ type: 'success', data: apiPaymentMethod })
  })

  it('returns one that is not active as well', async () => {
    const dependencies = paymentMethodDependencies({
      findById: vi.fn(async () =>
        Result.success(dbPaymentMethod({ isActive: false })),
      ),
    })

    expect(await get(dependencies)).toMatchObject({
      type: 'success',
      data: { isActive: false },
    })
  })

  it('reads an ID written in upper case as the lower-case ID', async () => {
    const dependencies = paymentMethodDependencies()

    await get(dependencies, PAYMENT_METHOD_ID.toUpperCase())

    expect(dependencies.paymentMethodRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      PAYMENT_METHOD_ID,
    )
  })

  it.each(readers)('lets %s read one', async (_who, actor) => {
    const result = await get(
      paymentMethodDependencies(),
      PAYMENT_METHOD_ID,
      actor,
    )

    expect(result.type).toBe('success')
  })

  it.each(notReaders)(
    'refuses %s, whatever the ID is, without reading anything',
    async (_who, actor) => {
      const dependencies = paymentMethodDependencies()

      const refused = await get(dependencies, PAYMENT_METHOD_ID, actor)
      const malformed = await get(dependencies, 'latest', actor)

      expect(refused).toEqual(forbidden)
      expect(malformed).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = paymentMethodDependencies()

      const result = await get(
        dependencies,
        PAYMENT_METHOD_ID,
        actors.customer,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the ID without looking anything up',
    async (_case, id) => {
      const dependencies = paymentMethodDependencies()

      const result = await get(dependencies, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(result).toMatchObject({
        error: { message: 'Invalid payment method ID' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found without looking for the payment method', async () => {
    const dependencies = withoutSalon()

    const result = await get(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    expect(await get(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('reports a payment method that the salon does not have as not found', async () => {
    const dependencies = paymentMethodDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    expect(await get(dependencies)).toEqual(paymentMethodNotFound)
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = paymentMethodDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored payment method that cannot be presented as a database error', async () => {
    const dependencies = paymentMethodDependencies({
      findById: vi.fn(async () => Result.success(corruptPaymentMethod)),
    })

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdatePaymentMethodUseCase', () => {
  const update = (
    dependencies: PaymentMethodUseCaseDependencies,
    input: unknown = { displayName: 'カード' },
    actor: Actor = actors.admin,
    id: unknown = PAYMENT_METHOD_ID,
    salon: unknown = SALON_ID,
  ) =>
    new UpdatePaymentMethodUseCase(dependencies).execute(
      actor,
      salon,
      id,
      input,
    )

  it('writes the properties of the request to the payment method of the salon, once the salon is known to exist, and returns it as the API presents it', async () => {
    const dependencies = paymentMethodDependencies()

    const result = await update(dependencies, {
      displayName: 'カード',
      isActive: false,
    })

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.paymentMethodRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      PAYMENT_METHOD_ID,
      { displayName: 'カード', isActive: false },
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'paymentMethods.update',
    ])
    expect(result).toEqual({ type: 'success', data: apiPaymentMethod })
  })

  it('writes the fee as text, and a fee that is taken away as null', async () => {
    const dependencies = paymentMethodDependencies()

    await update(dependencies, { fee: 2.95 })
    await update(dependencies, { fee: null })

    expect(
      vi
        .mocked(dependencies.paymentMethodRepository.update)
        .mock.calls.map(([, , changes]) => changes),
    ).toEqual([{ fee: '2.95' }, { fee: null }])
  })

  it('writes everything a request can name', async () => {
    const dependencies = paymentMethodDependencies()
    const { method: _method, ...everything } = paymentMethodCreateRequest()

    await update(dependencies, everything)

    expect(dependencies.paymentMethodRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      PAYMENT_METHOD_ID,
      { ...everything, fee: '3.6' },
    )
  })

  it.each(keepers)('lets %s change one', async (_who, actor) => {
    const result = await update(
      paymentMethodDependencies(),
      { isActive: false },
      actor,
    )

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s, whatever the ID and the request are, without reading or writing anything',
    async (_who, actor) => {
      const dependencies = paymentMethodDependencies()

      const refused = await update(dependencies, { isActive: false }, actor)
      const malformed = await update(dependencies, {}, actor, 'latest')

      expect(refused).toEqual(forbidden)
      expect(malformed).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = paymentMethodDependencies()

      const result = await update(
        dependencies,
        { isActive: false },
        actors.customer,
        PAYMENT_METHOD_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the ID before it reads the request',
    async (_case, id) => {
      const dependencies = paymentMethodDependencies()

      const result = await update(dependencies, {}, actors.admin, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a request that names nothing', {}, [':custom']],
    ['a blank name', { displayName: ' ' }, ['displayName:invalid_format']],
    ['the method', { method: 'cash' }, ['method:unrecognized_keys']],
    ['the salon', { salonId: OTHER_SALON_ID }, ['salonId:unrecognized_keys']],
    [
      'both limits out of order',
      { minimumAmount: 2000, maximumAmount: 1999 },
      ['maximumAmount:custom'],
    ],
    [
      'several broken rules',
      { fee: 101, sortOrder: -1 },
      ['fee:too_big', 'sortOrder:too_small'],
    ],
  ])(
    'rejects %s without looking the salon up or writing anything',
    async (_case, input, expected) => {
      const dependencies = paymentMethodDependencies()

      const result = await update(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: 'Invalid payment method update' },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and writes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await update(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    expect(await update(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('reports a payment method that the salon does not have as not found', async () => {
    const dependencies = paymentMethodDependencies(
      updating({ type: 'notFound' }),
    )

    expect(await update(dependencies)).toEqual(paymentMethodNotFound)
  })

  it.each([
    [
      'the lower limit',
      { minimumAmount: 9000 },
      { minimumAmount: 'Must not be more than maximumAmount' },
    ],
    [
      'the upper limit',
      { maximumAmount: 500 },
      { maximumAmount: 'Must not be less than minimumAmount' },
    ],
    [
      'the upper limit, with something else',
      { displayName: 'カード', maximumAmount: 500 },
      { maximumAmount: 'Must not be less than minimumAmount' },
    ],
    [
      'the lower limit, with something else',
      { minimumAmount: 9000, isActive: false },
      { minimumAmount: 'Must not be more than maximumAmount' },
    ],
  ])(
    'tells a request that names %s that it does not go with the limit that is stored',
    async (_case, input, expected) => {
      const dependencies = paymentMethodDependencies(
        updating({ type: 'limitsOutOfOrder' }),
      )

      const result = await update(dependencies, input)

      expect(messagesOf(result)).toEqual(expected)
      expect(rulesOf(result)).toEqual([`${Object.keys(expected)[0]}:custom`])
      expect(result).toMatchObject({
        error: { message: 'Invalid payment method update' },
      })
    },
  )

  it('passes on a database error of the repository', async () => {
    const dependencies = paymentMethodDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored payment method that cannot be presented as a database error', async () => {
    const dependencies = paymentMethodDependencies(
      updating({ type: 'updated', paymentMethod: corruptPaymentMethod }),
    )

    expect(await update(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('DeletePaymentMethodUseCase', () => {
  const remove = (
    dependencies: PaymentMethodUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = PAYMENT_METHOD_ID,
    salon: unknown = SALON_ID,
  ) => new DeletePaymentMethodUseCase(dependencies).execute(actor, salon, id)

  it('removes the payment method of the salon, once the salon is known to exist, and returns its ID', async () => {
    const dependencies = paymentMethodDependencies()

    const result = await remove(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(dependencies.paymentMethodRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      PAYMENT_METHOD_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'paymentMethods.delete',
    ])
    expect(result).toEqual({ type: 'success', data: PAYMENT_METHOD_ID })
  })

  it.each(keepers)('lets %s remove one', async (_who, actor) => {
    const result = await remove(paymentMethodDependencies(), actor)

    expect(result.type).toBe('success')
  })

  it.each(notKeepers)(
    'refuses %s, whatever the ID is, without reading or writing anything',
    async (_who, actor) => {
      const dependencies = paymentMethodDependencies()

      const refused = await remove(dependencies, actor)
      const malformed = await remove(dependencies, actor, 'latest')

      expect(refused).toEqual(forbidden)
      expect(malformed).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon ID before it asks who the actor is',
    async (_case, salon) => {
      const dependencies = paymentMethodDependencies()

      const result = await remove(
        dependencies,
        actors.customer,
        PAYMENT_METHOD_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the ID without looking anything up',
    async (_case, id) => {
      const dependencies = paymentMethodDependencies()

      const result = await remove(dependencies, actors.admin, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('reports a salon that does not exist, or is deleted, as not found and removes nothing', async () => {
    const dependencies = withoutSalon()

    const result = await remove(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure to look for the salon', async () => {
    expect(await remove(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('reports a payment method that the salon does not have as not found', async () => {
    const dependencies = paymentMethodDependencies(
      removing({ type: 'notFound' }),
    )

    expect(await remove(dependencies)).toEqual(paymentMethodNotFound)
  })

  it('refuses to remove a payment method that a payment refers to, as a conflict that says what to do instead', async () => {
    const dependencies = paymentMethodDependencies(removing({ type: 'inUse' }))

    expect(await remove(dependencies)).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The payment method cannot be deleted: a payment refers to it; set isActive to false instead',
      },
    })
  })

  it('passes on a database error of the repository', async () => {
    const dependencies = paymentMethodDependencies({
      delete: vi.fn(async () => databaseDown),
    })

    expect(await remove(dependencies)).toEqual(databaseDown)
  })
})
