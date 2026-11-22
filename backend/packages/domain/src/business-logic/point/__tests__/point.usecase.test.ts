import { Result } from '@beauty-salon-backend/utility'
import { pointMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, CUSTOMER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiPointTransaction,
  dbPointTransaction,
  OTHER_POINT_TRANSACTION_ID,
  POINT_TRANSACTION_ID,
  pointAdjustRequest,
  pointDependencies,
  pointEarnRequest,
  pointUseRequest,
} from '../../../__tests__/fixtures/point-fixtures'
import { SALE_ID } from '../../../__tests__/fixtures/sale-fixtures'
import type { Actor } from '../../../models/auth'
import type { DbPointTransaction } from '../../../models/point'
import type {
  PointExpiryOutcome,
  PointListing,
  PointRecording,
} from '../../../repositories/point.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  AdjustPointsUseCase,
  EarnPointsUseCase,
  ExpirePointsUseCase,
  GetExpiringPointsUseCase,
  GetPointBalanceUseCase,
  ListPointTransactionsUseCase,
  type PointUseCaseDependencies,
  UsePointsUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({
    type: 'database',
    message: `Stored point transaction ${POINT_TRANSACTION_ID} does not match the API model`,
  }),
}

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** The message of a failed validation; null for anything else. */
const validationMessageOf = (
  result: Result<unknown, DomainError>,
): string | null =>
  result.type === 'error' && result.error.type === 'validation'
    ? toldIn(result.error.message, 'en')
    : null

/** Those the points ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

/** Those who read, earn and use points, with what they reach. */
const keepers: [string, Actor, unknown][] = [
  ['an administrator', actors.admin, { type: 'everySalon' }],
  ['an owner', actors.ofSalon('owner'), { type: 'salon', salonId: SALON_ID }],
  [
    'a manager',
    actors.ofSalon('manager', OTHER_SALON_ID),
    { type: 'salon', salonId: OTHER_SALON_ID },
  ],
  [
    'a staff member',
    actors.ofSalon('staff'),
    { type: 'salon', salonId: SALON_ID },
  ],
]

const repositoryWasNotCalled = (dependencies: PointUseCaseDependencies) => {
  const { balanceOf, list, record, transactionsOf, expire } =
    dependencies.pointRepository
  expect(vi.mocked(balanceOf)).not.toHaveBeenCalled()
  expect(vi.mocked(list)).not.toHaveBeenCalled()
  expect(vi.mocked(record)).not.toHaveBeenCalled()
  expect(vi.mocked(transactionsOf)).not.toHaveBeenCalled()
  expect(vi.mocked(expire)).not.toHaveBeenCalled()
}

const recording = (outcome: PointRecording) => ({
  record: vi.fn(async () => Result.success(outcome)),
})

describe('GetPointBalanceUseCase', () => {
  const get = (
    dependencies: PointUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = CUSTOMER_ID,
  ) => new GetPointBalanceUseCase(dependencies).execute(actor, id)

  it.each(keepers)('answers the balance to %s', async (_, actor) => {
    const dependencies = pointDependencies()

    expect(await get(dependencies, actor)).toEqual({
      type: 'success',
      data: { customerId: CUSTOMER_ID, balance: 2620 },
    })
    expect(dependencies.pointRepository.balanceOf).toHaveBeenCalledWith(
      CUSTOMER_ID,
    )
  })

  it('answers a balance of 0', async () => {
    const dependencies = pointDependencies({
      balanceOf: vi.fn(async () => Result.success<number | null>(0)),
    })

    expect(await get(dependencies)).toEqual({
      type: 'success',
      data: { customerId: CUSTOMER_ID, balance: 0 },
    })
  })

  it.each(notKeepers)(
    'refuses %s before the ID is looked at',
    async (_, actor) => {
      const dependencies = pointDependencies()

      expect(await get(dependencies, actor, 'mine')).toEqual(forbidden)
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses an ID that is not a UUID', async () => {
    const dependencies = pointDependencies()
    const result = await get(dependencies, actors.admin, 'mine')

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(validationMessageOf(result)).toBe('Invalid customer ID')
    repositoryWasNotCalled(dependencies)
  })

  it('answers that a customer who is not there is not found', async () => {
    const dependencies = pointDependencies({
      balanceOf: vi.fn(async () => Result.success<number | null>(null)),
    })

    expect(await get(dependencies)).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('hands on a failure of the database', async () => {
    const dependencies = pointDependencies({
      balanceOf: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })
})

describe('ListPointTransactionsUseCase', () => {
  const list = (
    dependencies: PointUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = CUSTOMER_ID,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new ListPointTransactionsUseCase(dependencies).execute(actor, id, query)

  const listing = (outcome: PointListing) => ({
    list: vi.fn(async () => Result.success(outcome)),
  })

  it.each(keepers)(
    'lists the transactions of the customer to %s',
    async (_, actor) => {
      const dependencies = pointDependencies()

      expect(await list(dependencies, actor)).toEqual({
        type: 'success',
        data: {
          data: [apiPointTransaction()],
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
      expect(dependencies.pointRepository.list).toHaveBeenCalledWith({
        customerId: CUSTOMER_ID,
        limit: 20,
        after: null,
        startDate: null,
        endDate: null,
      })
    },
  )

  it('hands every parameter of the query on', async () => {
    const dependencies = pointDependencies()

    await list(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      Result.success({
        limit: 5,
        cursor: OTHER_POINT_TRANSACTION_ID,
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-11-30T15:00:00Z',
      }),
    )

    expect(dependencies.pointRepository.list).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      limit: 5,
      after: OTHER_POINT_TRANSACTION_ID,
      startDate: '2026-11-01T00:00:00.000Z',
      endDate: '2026-11-30T15:00:00.000Z',
    })
  })

  it('points to the next page with the last transaction of a full page', async () => {
    const dependencies = pointDependencies(
      listing({
        type: 'listed',
        transactions: [
          dbPointTransaction({ id: OTHER_POINT_TRANSACTION_ID }),
          dbPointTransaction(),
        ],
        total: 3,
        hasMore: true,
      }),
    )

    const result = await list(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      Result.success({ limit: 2, cursor: OTHER_POINT_TRANSACTION_ID }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 3,
          limit: 2,
          hasMore: true,
          cursor: OTHER_POINT_TRANSACTION_ID,
          nextCursor: POINT_TRANSACTION_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('answers an empty page', async () => {
    const dependencies = pointDependencies(
      listing({ type: 'listed', transactions: [], total: 0, hasMore: false }),
    )

    expect(await list(dependencies)).toMatchObject({
      type: 'success',
      data: { data: [], meta: { total: 0, nextCursor: null } },
    })
  })

  it.each(notKeepers)(
    'refuses %s before the ID and the query are looked at',
    async (_, actor) => {
      const dependencies = pointDependencies()

      expect(
        await list(
          dependencies,
          actor,
          'mine',
          Result.error(DomainErrors.validation('Invalid', [])),
        ),
      ).toEqual(forbidden)
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses an ID that is not a UUID before the query', async () => {
    const dependencies = pointDependencies()
    const result = await list(
      dependencies,
      actors.admin,
      'mine',
      Result.error(DomainErrors.validation('Invalid query', [])),
    )

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    repositoryWasNotCalled(dependencies)
  })

  it('answers a query that could not be decoded', async () => {
    const dependencies = pointDependencies()
    const undecoded = Result.error(
      DomainErrors.validation(pointMessages.invalidPointTransactionSearch, [
        { field: 'limit', rule: 'invalid_type', message: 'Must be a number' },
      ]),
    )

    expect(
      await list(dependencies, actors.admin, CUSTOMER_ID, undecoded),
    ).toEqual(undecoded)
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a query that breaks a rule', async () => {
    const dependencies = pointDependencies()
    const result = await list(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      Result.success({ limit: 0, cursor: 'next' }),
    )

    expect(rulesOf(result)).toEqual([
      'limit:too_small',
      'cursor:invalid_format',
    ])
    expect(validationMessageOf(result)).toBe('Invalid point transaction search')
    repositoryWasNotCalled(dependencies)
  })

  it('answers that a customer who is not there is not found', async () => {
    const dependencies = pointDependencies(
      listing({ type: 'customerNotFound' }),
    )

    expect(await list(dependencies)).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('refuses a cursor that names no transaction of the customer', async () => {
    const dependencies = pointDependencies(listing({ type: 'cursorNotFound' }))
    const result = await list(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      Result.success({ cursor: OTHER_POINT_TRANSACTION_ID }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(pointMessages.invalidPointTransactionSearch, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a point transaction of the customer',
          },
        ]),
      ),
    )
  })

  it('hands on a failure of the database', async () => {
    const dependencies = pointDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored transaction that does not fit the model', async () => {
    const dependencies = pointDependencies(
      listing({
        type: 'listed',
        transactions: [dbPointTransaction({ referenceType: 'payment' })],
        total: 1,
        hasMore: false,
      }),
    )

    expect(await list(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

/** Those who do not adjust points. */
const notAdjusters: [string, Actor][] = [
  ...notKeepers,
  ['a staff member of a salon', actors.ofSalon('staff')],
]

/** What each refusal is told. */
const refusals: [PointRecording, string][] = [
  [
    { type: 'referenceClosed', reference: 'sale' },
    'The sale is void; points are not earned on or used for a void sale',
  ],
  [
    { type: 'referenceClosed', reference: 'booking' },
    'The booking is a draft, cancelled or a no-show; points are not earned on or used for it',
  ],
  [
    { type: 'referenceTaken' },
    'The record has a point transaction of this kind already; a record is earned on once and used for once',
  ],
  [{ type: 'balanceShort' }, 'The balance of the customer would fall below 0'],
  [
    { type: 'balanceOverLimit' },
    'The balance of the customer would go above 2147483647',
  ],
]

/** The three movements, each with its use case, request, reach and message. */
const movements = [
  {
    name: 'EarnPointsUseCase',
    type: 'earned',
    execute: (
      dependencies: PointUseCaseDependencies,
      actor: Actor,
      input: unknown,
    ) => new EarnPointsUseCase(dependencies).execute(actor, input),
    request: pointEarnRequest,
    message: pointMessages.invalidPointEarning,
    movers: keepers,
    notMovers: notKeepers,
  },
  {
    name: 'UsePointsUseCase',
    type: 'used',
    execute: (
      dependencies: PointUseCaseDependencies,
      actor: Actor,
      input: unknown,
    ) => new UsePointsUseCase(dependencies).execute(actor, input),
    request: pointUseRequest,
    message: pointMessages.invalidPointUse,
    movers: keepers,
    notMovers: notKeepers,
  },
  {
    name: 'AdjustPointsUseCase',
    type: 'adjusted',
    execute: (
      dependencies: PointUseCaseDependencies,
      actor: Actor,
      input: unknown,
    ) => new AdjustPointsUseCase(dependencies).execute(actor, input),
    request: pointAdjustRequest,
    message: pointMessages.invalidPointAdjustment,
    movers: keepers.filter(([name]) => name !== 'a staff member'),
    notMovers: notAdjusters,
  },
]

describe.each(movements)(
  '$name',
  ({ type, execute, request, message, movers, notMovers }) => {
    it.each(movers)(
      'records the movement of %s within their reach',
      async (_, actor, reach) => {
        const dependencies = pointDependencies()

        expect(await execute(dependencies, actor, request())).toEqual({
          type: 'success',
          data: apiPointTransaction(),
        })
        expect(dependencies.pointRepository.record).toHaveBeenCalledWith(
          reach,
          {
            type,
            request: request(),
          },
        )
      },
    )

    it.each(notMovers)(
      'refuses %s before the request is looked at',
      async (_, actor) => {
        const dependencies = pointDependencies()

        expect(await execute(dependencies, actor, 'not a request')).toEqual(
          forbidden,
        )
        repositoryWasNotCalled(dependencies)
      },
    )

    it('refuses a request that breaks a rule of its own', async () => {
      const dependencies = pointDependencies()
      const result = await execute(
        dependencies,
        actors.admin,
        request({
          customerId: 'mine',
          referenceType: null,
          referenceId: SALE_ID,
        }),
      )

      expect(rulesOf(result).toSorted()).toEqual([
        'customerId:invalid_format',
        'referenceType:custom',
      ])
      expect(validationMessageOf(result)).toBe(message.en)
      repositoryWasNotCalled(dependencies)
    })

    it('answers that a customer who is not there is not one the request may name', async () => {
      const dependencies = pointDependencies(
        recording({ type: 'customerNotFound' }),
      )

      expect(await execute(dependencies, actors.admin, request())).toEqual(
        Result.error(
          DomainErrors.validation(message, [
            {
              field: 'customerId',
              rule: 'not_found',
              message: 'Must name a customer',
            },
          ]),
        ),
      )
    })

    it('answers a record that is not one of the customer', async () => {
      const issues = [
        {
          field: 'referenceId',
          rule: 'not_found',
          message: 'Must name a sale of the customer',
        },
      ]
      const dependencies = pointDependencies(
        recording({ type: 'invalid', issues }),
      )

      expect(await execute(dependencies, actors.admin, request())).toEqual(
        Result.error(DomainErrors.validation(message, issues)),
      )
    })

    it.each(refusals)('answers %o as a conflict', async (refusal, said) => {
      const dependencies = pointDependencies(recording(refusal))

      expect(await execute(dependencies, actors.admin, request())).toEqual(
        Result.error(DomainErrors.conflict(said)),
      )
    })

    it('hands on a failure of the database', async () => {
      const dependencies = pointDependencies({
        record: vi.fn(async () => databaseDown),
      })

      expect(await execute(dependencies, actors.admin, request())).toEqual(
        databaseDown,
      )
    })

    it('reports a stored transaction that does not fit the model', async () => {
      const dependencies = pointDependencies(
        recording({
          type: 'recorded',
          transaction: dbPointTransaction({ createdAt: 'then' }),
        }),
      )

      expect(await execute(dependencies, actors.admin, request())).toEqual(
        storedRowIsCorrupt,
      )
    })
  },
)

describe('EarnPointsUseCase', () => {
  const earn = (dependencies: PointUseCaseDependencies, input: unknown) =>
    new EarnPointsUseCase(dependencies).execute(actors.admin, input)

  it('takes an expiry date of yesterday in UTC, and none', async () => {
    for (const expiryDate of ['2026-11-19', null]) {
      const dependencies = pointDependencies()

      expect(
        await earn(dependencies, pointEarnRequest({ expiryDate })),
      ).toMatchObject({
        type: 'success',
      })
    }
  })

  it('refuses an expiry date that has passed everywhere, before anything is written', async () => {
    const dependencies = pointDependencies()
    const result = await earn(
      dependencies,
      pointEarnRequest({ expiryDate: '2026-11-18' }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(pointMessages.invalidPointEarning, [
          {
            field: 'expiryDate',
            rule: 'too_small',
            message: 'Must not be earlier than 2026-11-19',
          },
        ]),
      ),
    )
    repositoryWasNotCalled(dependencies)
  })

  it('looks at the clock of the moment of the request', async () => {
    const dependencies = pointDependencies(
      {},
      new Date('2026-11-21T00:00:00.000Z'),
    )

    expect(
      rulesOf(
        await earn(
          dependencies,
          pointEarnRequest({ expiryDate: '2026-11-19' }),
        ),
      ),
    ).toEqual(['expiryDate:too_small'])
  })
})

describe('GetExpiringPointsUseCase', () => {
  const get = (
    dependencies: PointUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = CUSTOMER_ID,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new GetExpiringPointsUseCase(dependencies).execute(actor, id, query)

  /** A repository that finds these transactions of the customer. */
  const finding = (transactions: DbPointTransaction[] | null) => ({
    transactionsOf: vi.fn(async () => Result.success(transactions)),
  })

  /** An earning of 120 points that expires on the day, as the only transaction. */
  const earningUntil = (expiryDate: string) =>
    finding([dbPointTransaction({ expiryDate, balance: 120 })])

  it.each(keepers)(
    'answers what is left of the earnings near their expiry date to %s',
    async (_, actor) => {
      const dependencies = pointDependencies(earningUntil('2026-12-20'))

      expect(await get(dependencies, actor)).toEqual({
        type: 'success',
        data: {
          customerId: CUSTOMER_ID,
          expiringPoints: 120,
          expirationDate: '2026-12-20',
          transactions: [
            apiPointTransaction({ expiryDate: '2026-12-20', balance: 120 }),
          ],
        },
      })
      expect(dependencies.pointRepository.transactionsOf).toHaveBeenCalledWith(
        CUSTOMER_ID,
      )
    },
  )

  it('counts 30 days from today in UTC when the query has no days', async () => {
    const after = pointDependencies(earningUntil('2026-12-21'))

    expect(await get(after)).toMatchObject({
      type: 'success',
      data: { expiringPoints: 0, expirationDate: null, transactions: [] },
    })
  })

  it('counts the days of the query', async () => {
    const onTheDay = pointDependencies(earningUntil('2026-11-27'))
    const after = pointDependencies(earningUntil('2026-11-28'))
    const week = Result.success({ days: 7 })

    expect(await get(onTheDay, actors.admin, CUSTOMER_ID, week)).toMatchObject({
      data: { expiringPoints: 120 },
    })
    expect(await get(after, actors.admin, CUSTOMER_ID, week)).toMatchObject({
      data: { expiringPoints: 0 },
    })
  })

  it('counts from the day of its clock', async () => {
    const dependencies = pointDependencies(
      earningUntil('2026-11-22'),
      new Date('2026-11-21T00:00:00.000Z'),
    )

    expect(
      await get(
        dependencies,
        actors.admin,
        CUSTOMER_ID,
        Result.success({ days: 1 }),
      ),
    ).toMatchObject({ data: { expiringPoints: 120 } })
  })

  it.each(notKeepers)(
    'refuses %s before the ID and the query are looked at',
    async (_, actor) => {
      const dependencies = pointDependencies()

      expect(
        await get(
          dependencies,
          actor,
          'mine',
          Result.error(DomainErrors.validation('Invalid', [])),
        ),
      ).toEqual(forbidden)
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses an ID that is not a UUID before the query', async () => {
    const dependencies = pointDependencies()
    const result = await get(
      dependencies,
      actors.admin,
      'mine',
      Result.error(DomainErrors.validation('Invalid query', [])),
    )

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    repositoryWasNotCalled(dependencies)
  })

  it('answers a query that could not be decoded', async () => {
    const dependencies = pointDependencies()
    const undecoded = Result.error(
      DomainErrors.validation(pointMessages.invalidExpiringPointsSearch, [
        { field: 'days', rule: 'invalid_format', message: 'Must be a number' },
      ]),
    )

    expect(
      await get(dependencies, actors.admin, CUSTOMER_ID, undecoded),
    ).toEqual(undecoded)
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a query that breaks a rule', async () => {
    const dependencies = pointDependencies()
    const result = await get(
      dependencies,
      actors.admin,
      CUSTOMER_ID,
      Result.success({ days: 366 }),
    )

    expect(rulesOf(result)).toEqual(['days:too_big'])
    expect(validationMessageOf(result)).toBe('Invalid expiring points search')
    repositoryWasNotCalled(dependencies)
  })

  it('answers that a customer who is not there is not found', async () => {
    const dependencies = pointDependencies(finding(null))

    expect(await get(dependencies)).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('hands on a failure of the database', async () => {
    const dependencies = pointDependencies({
      transactionsOf: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored earning that does not fit the model', async () => {
    const dependencies = pointDependencies(
      finding([
        dbPointTransaction({
          expiryDate: '2026-12-01',
          referenceType: 'payment',
        }),
      ]),
    )

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

/** Those who do not expire points: everybody but the administrators. */
const notExpirers: [string, Actor][] = [
  ...notKeepers,
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
  ['a staff member', actors.ofSalon('staff')],
]

describe('ExpirePointsUseCase', () => {
  const expire = (
    dependencies: PointUseCaseDependencies,
    input: unknown = { customerId: null, processBefore: null },
    actor: Actor = actors.admin,
  ) => new ExpirePointsUseCase(dependencies).execute(actor, input)

  const expiring = (outcome: PointExpiryOutcome) => ({
    expire: vi.fn(async () => Result.success(outcome)),
  })

  it('expires the points of every customer that lapsed before yesterday in UTC', async () => {
    const dependencies = pointDependencies()

    expect(await expire(dependencies)).toEqual({
      type: 'success',
      data: { processedCount: 1, totalPoints: 120 },
    })
    expect(dependencies.pointRepository.expire).toHaveBeenCalledWith(
      null,
      '2026-11-19',
    )
  })

  it('hands the customer and the day of the request on', async () => {
    const dependencies = pointDependencies()

    await expire(dependencies, {
      customerId: CUSTOMER_ID,
      processBefore: '2026-11-01',
    })

    expect(dependencies.pointRepository.expire).toHaveBeenCalledWith(
      CUSTOMER_ID,
      '2026-11-01',
    )
  })

  it('takes yesterday in UTC and refuses today', async () => {
    const dependencies = pointDependencies()

    expect(
      await expire(dependencies, {
        customerId: null,
        processBefore: '2026-11-19',
      }),
    ).toMatchObject({ type: 'success' })
    const today = await expire(dependencies, {
      customerId: CUSTOMER_ID,
      processBefore: '2026-11-20',
    })
    expect(today).toEqual(
      Result.error(
        DomainErrors.validation(pointMessages.invalidPointExpiry, [
          {
            field: 'processBefore',
            rule: 'too_big',
            message: 'Must not be later than 2026-11-19',
          },
        ]),
      ),
    )
    expect(dependencies.pointRepository.expire).toHaveBeenCalledTimes(1)
  })

  it('takes yesterday from its clock', async () => {
    const dependencies = pointDependencies(
      {},
      new Date('2026-11-21T00:00:00.000Z'),
    )

    await expire(dependencies)

    expect(dependencies.pointRepository.expire).toHaveBeenCalledWith(
      null,
      '2026-11-20',
    )
  })

  it('answers that nothing lapsed', async () => {
    const dependencies = pointDependencies(
      expiring({ type: 'expired', processedCount: 0, totalPoints: 0 }),
    )

    expect(await expire(dependencies)).toEqual({
      type: 'success',
      data: { processedCount: 0, totalPoints: 0 },
    })
  })

  it.each(notExpirers)(
    'refuses %s before the request is looked at',
    async (_, actor) => {
      const dependencies = pointDependencies()

      expect(await expire(dependencies, 'everyone', actor)).toEqual(forbidden)
      repositoryWasNotCalled(dependencies)
    },
  )

  it('refuses a request that breaks the rules', async () => {
    const dependencies = pointDependencies()
    const result = await expire(dependencies, { customerId: 'everyone' })

    expect(rulesOf(result)).toEqual([
      'customerId:invalid_format',
      'processBefore:invalid_type',
    ])
    expect(validationMessageOf(result)).toBe('Invalid point expiry')
    repositoryWasNotCalled(dependencies)
  })

  it('refuses a customer who is not there as a property of the request', async () => {
    const dependencies = pointDependencies(
      expiring({ type: 'customerNotFound' }),
    )

    expect(
      await expire(dependencies, {
        customerId: CUSTOMER_ID,
        processBefore: null,
      }),
    ).toEqual(
      Result.error(
        DomainErrors.validation(pointMessages.invalidPointExpiry, [
          {
            field: 'customerId',
            rule: 'not_found',
            message: 'Must name a customer',
          },
        ]),
      ),
    )
  })

  it('hands on a failure of the database', async () => {
    const dependencies = pointDependencies({
      expire: vi.fn(async () => databaseDown),
    })

    expect(await expire(dependencies)).toEqual(databaseDown)
  })
})
