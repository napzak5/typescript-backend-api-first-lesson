import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  dbUser,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiCustomerDeletionRequest,
  CUSTOMER_DELETION_REQUEST_ID,
  customerDeletionRequestDependencies,
  dbCustomerDeletionRequest,
  OTHER_CUSTOMER_DELETION_REQUEST_ID,
} from '../../../__tests__/fixtures/customer-deletion-request-fixtures'
import {
  customerCreateRequest,
  dbCustomer,
} from '../../../__tests__/fixtures/customer-fixtures'
import { brokenRules } from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type {
  CustomerDeletionRequesting,
  CustomerDeletionRequestReading,
  CustomerErasure,
  ICustomerDeletionRequestRepository,
} from '../../../repositories/customer-deletion-request.repository'
import { customerDeletionRequestCreateRequestSchema } from '../../../schemas/customer-deletion-request.schema'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CancelCustomerDeletionRequestUseCase,
  ERASED_BOOKING,
  ERASED_BOOKING_LINE,
  ERASED_TREATMENT_RECORD,
  ExecuteCustomerDeletionRequestsUseCase,
  erasedAccountOf,
  erasedLedgerOf,
  forfeitOf,
  GetCustomerDeletionRequestUseCase,
  GRACE_PERIOD_HOURS,
  RequestCustomerDeletionUseCase,
} from '..'

const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

const forbidden = Result.error(DomainErrors.forbidden())
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** Those who take, read and cancel requests. */
const takers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['an owner', actors.ofSalon('owner')],
  ['a manager', actors.ofSalon('manager')],
]
const others: [string, Actor][] = [
  ['a staff member', actors.ofSalon('staff')],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user of no scope', actors.withoutScope],
]

describe('customerDeletionRequestCreateRequestSchema', () => {
  const parsed = (input: unknown) =>
    customerDeletionRequestCreateRequestSchema.safeParse(input)

  it('takes a reason as it is written, of 1 to 1,000 characters', () => {
    expect(parsed({ reason: ' 本人から電話で依頼 ' })).toMatchObject({
      success: true,
      data: { reason: ' 本人から電話で依頼 ' },
    })
    expect(parsed({ reason: 'あ'.repeat(1000) }).success).toBe(true)
  })

  it.each<[string, unknown]>([
    ['no reason', {}],
    ['an empty reason', { reason: '' }],
    ['a blank reason', { reason: ' \n\t' }],
    ['a reason of 1,001 characters', { reason: 'あ'.repeat(1001) }],
    ['a reason that is no string', { reason: 1 }],
    ['a property of no request', { reason: '依頼', confirmed: true }],
    ['no object', '依頼'],
  ])('refuses %s', (_, input) => {
    expect(parsed(input).success).toBe(false)
  })
})

describe('the erasure', () => {
  it('falls due 14 days of 24 hours after the request', () => {
    expect(GRACE_PERIOD_HOURS).toBe(336)
  })

  /** A customer with every column that says who they are written. */
  const known = dbCustomer({
    ...customerCreateRequest(),
    userId: USER_ID,
    hairThickness: 'thick',
    scalpCondition: 'sensitive',
  })
  const said = [
    '花子',
    '山田',
    'ハナコ',
    'ヤマダ',
    'hanako.yamada@example.com',
    '090-1234-5678',
    '03-1234-5678',
    '107-0062',
    '東京都',
    '港区',
    '南青山1-2-3',
    'アオヤマビル',
    '1990-04-01',
    'female',
    'デザイナー',
    '静かな席を希望',
    '前髪は短めが好み',
    'カラー剤でかぶれた',
    'regular',
    'HANAKO2026',
    'wavy',
    'thick',
    'sensitive',
    known.referredBy,
    USER_ID,
  ]

  it('leaves nothing in the ledger that says who the customer was', () => {
    const erased = { ...known, ...erasedLedgerOf(known) }

    const written = JSON.stringify(erased)
    expect(
      said.filter((value) => value !== null && written.includes(value)),
    ).toEqual([])
    expect(erased).toMatchObject({
      firstName: '顧客',
      lastName: '消去済み',
      email: `${CUSTOMER_ID}@erased.invalid`,
      phoneNumber: '0000000000',
      tags: [],
      preferences: null,
      allowMarketing: false,
      allowSms: false,
      allowEmail: false,
      isActive: false,
      loyaltyPoints: 0,
    })
  })

  it('keeps what the bookings and the sales of the customer need of the ledger', () => {
    const erased = { ...known, ...erasedLedgerOf(known) }

    expect(erased).toMatchObject({
      id: CUSTOMER_ID,
      membershipTier: known.membershipTier,
      customerStatus: known.customerStatus,
      firstVisitDate: known.firstVisitDate,
      lastVisitDate: known.lastVisitDate,
      visitCount: known.visitCount,
      noShowCount: known.noShowCount,
      cancellationCount: known.cancellationCount,
      createdAt: known.createdAt,
    })
  })

  it('leaves nothing of an account by which it could sign in or be told', () => {
    const account = dbUser({
      role: 'customer',
      email: 'hanako@example.com',
      emailVerificationTokenHash: 'verify-hash',
      emailVerificationExpiry: '2026-11-20 10:00:00+09',
      passwordResetTokenHash: 'reset-hash',
      passwordResetExpiry: '2026-11-20 10:00:00+09',
      lastPasswordChange: '2026-11-02 10:00:00+09',
      twoFactorStatus: 'enabled',
      twoFactorSecret: 'sealed:SECRET',
      backupCodes: ['hashed:CODE'],
      twoFactorLastUsedStep: 12,
      failedLoginAttempts: 3,
      lockedUntil: '2026-11-18 10:00:00+09',
      lastLoginAt: '2026-11-17 10:00:00+09',
      lastLoginIp: '203.0.113.7',
      customerId: CUSTOMER_ID,
    })

    const erased = { ...account, ...erasedAccountOf(account) }

    const written = JSON.stringify(erased)
    expect(
      [
        'hanako@example.com',
        'hashed:',
        'verify-hash',
        'reset-hash',
        'SECRET',
        'CODE',
        '203.0.113.7',
        CUSTOMER_ID,
      ].filter((value) => written.includes(value)),
    ).toEqual([])
    expect(erased).toMatchObject({
      id: USER_ID,
      email: `${USER_ID}@erased.invalid`,
      role: 'customer',
      status: 'deleted',
      emailVerified: false,
      twoFactorStatus: 'disabled',
      failedLoginAttempts: 0,
      createdAt: account.createdAt,
    })
  })

  it('writes nothing that the customer or the staff wrote of a booking or a treatment', () => {
    expect(Object.values(ERASED_BOOKING)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ])
    expect(ERASED_BOOKING_LINE).toEqual({ notes: null })
    expect(ERASED_TREATMENT_RECORD).toMatchObject({
      consultationNotes: null,
      colorFormula: null,
      nextRecommendedServices: [],
    })
    expect(
      Object.values(ERASED_TREATMENT_RECORD).filter(
        (value) => value !== null && !Array.isArray(value),
      ),
    ).toEqual([])
  })

  it('forfeits the balance of the customer to 0', () => {
    expect(forfeitOf(dbCustomer({ loyaltyPoints: 120 }))).toEqual({
      customerId: CUSTOMER_ID,
      transactionType: 'expired',
      points: -120,
      balance: 0,
      description: 'データの消去による失効',
      referenceType: null,
      referenceId: null,
      expiryDate: null,
    })
  })

  it('forfeits nothing of a customer without points', () => {
    expect(forfeitOf(dbCustomer({ loyaltyPoints: 0 }))).toBeNull()
  })
})

describe('RequestCustomerDeletionUseCase', () => {
  const reason = { reason: '退会したため、本人から電話で依頼' }
  const take = (
    dependencies = customerDeletionRequestDependencies(),
    actor: Actor = actors.admin,
    id: unknown = CUSTOMER_ID,
    input: unknown = reason,
  ) =>
    new RequestCustomerDeletionUseCase(dependencies).execute(actor, id, input)
  const requestOf = (
    dependencies: ReturnType<typeof customerDeletionRequestDependencies>,
  ) => vi.mocked(dependencies.customerDeletionRequestRepository.request)

  it.each(takers)(
    'lets %s take a request, by the user who takes it',
    async (_, actor) => {
      const dependencies = customerDeletionRequestDependencies()

      expect(await take(dependencies, actor)).toEqual(
        Result.success(apiCustomerDeletionRequest()),
      )
      expect(requestOf(dependencies)).toHaveBeenCalledWith(
        CUSTOMER_ID,
        reason.reason,
        USER_ID,
      )
    },
  )

  it('reads a customer ID in upper case as the same customer', async () => {
    const dependencies = customerDeletionRequestDependencies()

    await take(dependencies, actors.admin, CUSTOMER_ID.toUpperCase())

    expect(requestOf(dependencies)).toHaveBeenCalledWith(
      CUSTOMER_ID,
      reason.reason,
      USER_ID,
    )
  })

  it.each(others)(
    'refuses %s before the ID and the request are read',
    async (_, actor) => {
      const dependencies = customerDeletionRequestDependencies()

      expect(await take(dependencies, actor, 'customer-1', null)).toEqual(
        forbidden,
      )
      expect(requestOf(dependencies)).not.toHaveBeenCalled()
    },
  )

  it('refuses a customer ID that is no UUID before the request', async () => {
    const dependencies = customerDeletionRequestDependencies()

    const result = await take(dependencies, actors.admin, 'customer-1', null)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid customer ID' },
    })
    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(requestOf(dependencies)).not.toHaveBeenCalled()
  })

  it('refuses a blank reason, and takes nothing', async () => {
    const dependencies = customerDeletionRequestDependencies()

    const result = await take(dependencies, actors.admin, CUSTOMER_ID, {
      reason: ' ',
    })

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: 'Invalid customer deletion request',
      },
    })
    expect(rulesOf(result)).toEqual(['reason:invalid_format'])
    expect(requestOf(dependencies)).not.toHaveBeenCalled()
  })

  it('answers a customer who is not there as not found', async () => {
    const dependencies = customerDeletionRequestDependencies({
      request: vi.fn(async () =>
        Result.success<CustomerDeletionRequesting>({
          type: 'customerNotFound',
        }),
      ),
    })

    expect(await take(dependencies)).toEqual(
      Result.error(DomainErrors.notFound('Customer', CUSTOMER_ID)),
    )
  })

  it('refuses a second request while one is pending, naming the pending one', async () => {
    const dependencies = customerDeletionRequestDependencies({
      request: vi.fn(async () =>
        Result.success<CustomerDeletionRequesting>({
          type: 'alreadyRequested',
          request: dbCustomerDeletionRequest(),
        }),
      ),
    })

    expect(await take(dependencies)).toEqual(
      Result.error(
        DomainErrors.conflict(
          `Customer ${CUSTOMER_ID} has a pending deletion request, ${CUSTOMER_DELETION_REQUEST_ID}`,
        ),
      ),
    )
  })

  it('passes on a failure of the database', async () => {
    const dependencies = customerDeletionRequestDependencies({
      request: vi.fn(async () => databaseDown),
    })

    expect(await take(dependencies)).toEqual(databaseDown)
  })

  it('fails as the database when the stored request does not match the API model', async () => {
    const dependencies = customerDeletionRequestDependencies({
      request: vi.fn(async () =>
        Result.success<CustomerDeletionRequesting>({
          type: 'requested',
          request: dbCustomerDeletionRequest({ scheduledAt: 'tomorrow' }),
        }),
      ),
    })

    expect(await take(dependencies)).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored customer deletion request ${CUSTOMER_DELETION_REQUEST_ID} does not match the API model`,
      },
    })
  })
})

describe('GetCustomerDeletionRequestUseCase', () => {
  const read = (
    dependencies = customerDeletionRequestDependencies(),
    actor: Actor = actors.admin,
    id: unknown = CUSTOMER_ID,
  ) => new GetCustomerDeletionRequestUseCase(dependencies).execute(actor, id)
  const latestOf = (
    dependencies: ReturnType<typeof customerDeletionRequestDependencies>,
  ) => vi.mocked(dependencies.customerDeletionRequestRepository.latestOf)

  it.each(takers)('lets %s read the latest request', async (_, actor) => {
    const dependencies = customerDeletionRequestDependencies()

    expect(await read(dependencies, actor, CUSTOMER_ID.toUpperCase())).toEqual(
      Result.success(apiCustomerDeletionRequest()),
    )
    expect(latestOf(dependencies)).toHaveBeenCalledWith(CUSTOMER_ID)
  })

  it('shows a request carried out, with who carried it out and when', async () => {
    const dependencies = customerDeletionRequestDependencies({
      latestOf: vi.fn(async () =>
        Result.success<CustomerDeletionRequestReading>({
          type: 'found',
          request: dbCustomerDeletionRequest({
            status: 'completed',
            completedBy: USER_ID,
            completedAt: '2026-12-02 12:00:00+09',
          }),
        }),
      ),
    })

    expect(await read(dependencies)).toEqual(
      Result.success(
        apiCustomerDeletionRequest({
          status: 'completed',
          completedBy: USER_ID,
          completedAt: '2026-12-02T03:00:00.000Z',
        }),
      ),
    )
  })

  it.each(others)('refuses %s before the ID is read', async (_, actor) => {
    const dependencies = customerDeletionRequestDependencies()

    expect(await read(dependencies, actor, 'customer-1')).toEqual(forbidden)
    expect(latestOf(dependencies)).not.toHaveBeenCalled()
  })

  it('refuses a customer ID that is no UUID', async () => {
    const dependencies = customerDeletionRequestDependencies()

    const result = await read(dependencies, actors.admin, 'customer-1')

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(latestOf(dependencies)).not.toHaveBeenCalled()
  })

  it.each<[string, 'customerNotFound' | 'noRequest', DomainError]>([
    [
      'a customer who is not there',
      'customerNotFound',
      DomainErrors.notFound('Customer', CUSTOMER_ID),
    ],
    [
      'a customer without a request',
      'noRequest',
      DomainErrors.notFound('Deletion request of customer', CUSTOMER_ID),
    ],
  ])('answers %s as not found', async (_, type, error) => {
    const dependencies = customerDeletionRequestDependencies({
      latestOf: vi.fn(async () => Result.success({ type })),
    })

    expect(await read(dependencies)).toEqual(Result.error(error))
  })

  it('passes on a failure of the database', async () => {
    const dependencies = customerDeletionRequestDependencies({
      latestOf: vi.fn(async () => databaseDown),
    })

    expect(await read(dependencies)).toEqual(databaseDown)
  })
})

describe('CancelCustomerDeletionRequestUseCase', () => {
  const cancel = (
    dependencies = customerDeletionRequestDependencies(),
    actor: Actor = actors.admin,
    id: unknown = CUSTOMER_ID,
  ) => new CancelCustomerDeletionRequestUseCase(dependencies).execute(actor, id)
  const cancelOf = (
    dependencies: ReturnType<typeof customerDeletionRequestDependencies>,
  ) => vi.mocked(dependencies.customerDeletionRequestRepository.cancel)

  it.each(takers)(
    'lets %s cancel the pending request, by the user who cancels it',
    async (_, actor) => {
      const dependencies = customerDeletionRequestDependencies()

      expect(await cancel(dependencies, actor)).toEqual(
        Result.success(
          apiCustomerDeletionRequest({
            status: 'cancelled',
            cancelledBy: USER_ID,
            cancelledAt: '2026-11-19T01:00:00.000Z',
          }),
        ),
      )
      expect(cancelOf(dependencies)).toHaveBeenCalledWith(CUSTOMER_ID, USER_ID)
    },
  )

  it.each(others)('refuses %s before the ID is read', async (_, actor) => {
    const dependencies = customerDeletionRequestDependencies()

    expect(await cancel(dependencies, actor, 'customer-1')).toEqual(forbidden)
    expect(cancelOf(dependencies)).not.toHaveBeenCalled()
  })

  it('refuses a customer ID that is no UUID, and cancels nothing', async () => {
    const dependencies = customerDeletionRequestDependencies()

    const result = await cancel(dependencies, actors.admin, 'customer-1')

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
    expect(cancelOf(dependencies)).not.toHaveBeenCalled()
  })

  it.each<[string, 'customerNotFound' | 'noPendingRequest', DomainError]>([
    [
      'a customer who is not there',
      'customerNotFound',
      DomainErrors.notFound('Customer', CUSTOMER_ID),
    ],
    [
      'a customer without a pending request',
      'noPendingRequest',
      DomainErrors.notFound(
        'Pending deletion request of customer',
        CUSTOMER_ID,
      ),
    ],
  ])('answers %s as not found', async (_, type, error) => {
    const dependencies = customerDeletionRequestDependencies({
      cancel: vi.fn(async () => Result.success({ type })),
    })

    expect(await cancel(dependencies)).toEqual(Result.error(error))
  })

  it('passes on a failure of the database', async () => {
    const dependencies = customerDeletionRequestDependencies({
      cancel: vi.fn(async () => databaseDown),
    })

    expect(await cancel(dependencies)).toEqual(databaseDown)
  })
})

describe('ExecuteCustomerDeletionRequestsUseCase', () => {
  const run = (
    dependencies = customerDeletionRequestDependencies(),
    actor: Actor = actors.admin,
  ) => new ExecuteCustomerDeletionRequestsUseCase(dependencies).execute(actor)
  const eraseOf = (
    dependencies: ReturnType<typeof customerDeletionRequestDependencies>,
  ) => vi.mocked(dependencies.customerDeletionRequestRepository.erase)

  const done = (id: string): Result<CustomerErasure, DomainError> =>
    Result.success({
      type: 'erased',
      request: dbCustomerDeletionRequest({
        id,
        status: 'completed',
        completedBy: USER_ID,
        completedAt: '2026-12-02 12:00:00+09',
      }),
    })
  const shown = (id: string) =>
    apiCustomerDeletionRequest({
      id,
      status: 'completed',
      completedBy: USER_ID,
      completedAt: '2026-12-02T03:00:00.000Z',
    })
  const THIRD = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f6f03'
  /** Three requests due, in the order they fell due. */
  const due = () =>
    vi.fn<ICustomerDeletionRequestRepository['dueRequests']>(async () =>
      Result.success([
        CUSTOMER_DELETION_REQUEST_ID,
        OTHER_CUSTOMER_DELETION_REQUEST_ID,
        THIRD,
      ]),
    )
  const erasing = () => vi.fn<ICustomerDeletionRequestRepository['erase']>()

  it('carries out the requests due in the order given, and answers with those it carried out', async () => {
    const dependencies = customerDeletionRequestDependencies({
      dueRequests: due(),
      erase: erasing()
        .mockResolvedValueOnce(done(CUSTOMER_DELETION_REQUEST_ID))
        .mockResolvedValueOnce(Result.success({ type: 'notDue' }))
        .mockResolvedValueOnce(done(THIRD)),
    })

    expect(await run(dependencies)).toEqual(
      Result.success([shown(CUSTOMER_DELETION_REQUEST_ID), shown(THIRD)]),
    )
    expect(eraseOf(dependencies).mock.calls).toEqual([
      [CUSTOMER_DELETION_REQUEST_ID, USER_ID],
      [OTHER_CUSTOMER_DELETION_REQUEST_ID, USER_ID],
      [THIRD, USER_ID],
    ])
  })

  it('answers with none when none is due', async () => {
    const dependencies = customerDeletionRequestDependencies()

    expect(await run(dependencies)).toEqual(Result.success([]))
    expect(eraseOf(dependencies)).not.toHaveBeenCalled()
  })

  it('stops at the first failure, and carries out none after it', async () => {
    const dependencies = customerDeletionRequestDependencies({
      dueRequests: due(),
      erase: erasing()
        .mockResolvedValueOnce(done(CUSTOMER_DELETION_REQUEST_ID))
        .mockResolvedValueOnce(databaseDown),
    })

    expect(await run(dependencies)).toEqual(databaseDown)
    expect(eraseOf(dependencies)).toHaveBeenCalledTimes(2)
  })

  it('passes on a failure to find the requests due', async () => {
    const dependencies = customerDeletionRequestDependencies({
      dueRequests: vi.fn(async () => databaseDown),
    })

    expect(await run(dependencies)).toEqual(databaseDown)
    expect(eraseOf(dependencies)).not.toHaveBeenCalled()
  })

  it.each<[string, Actor]>([
    ['an owner', actors.ofSalon('owner')],
    ['a manager', actors.ofSalon('manager')],
    ...others,
  ])('refuses %s, and looks for nothing', async (_, actor) => {
    const looking = due()
    const dependencies = customerDeletionRequestDependencies({
      dueRequests: looking,
    })

    expect(await run(dependencies, actor)).toEqual(forbidden)
    expect(looking).not.toHaveBeenCalled()
  })
})
