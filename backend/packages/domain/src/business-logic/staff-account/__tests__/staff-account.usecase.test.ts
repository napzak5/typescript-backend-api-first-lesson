import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  staffAccountMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, STAFF_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiStaffAccount,
  dbStaffAccount,
  staffAccountDependencies,
} from '../../../__tests__/fixtures/staff-account-fixtures'
import { STAFF_MEMBER_ID } from '../../../__tests__/fixtures/staff-fixtures'
import type { Actor } from '../../../models/auth'
import type { SalonRole } from '../../../models/staff-invitation'
import type {
  FoundStaffAccount,
  IStaffAccountRepository,
  UnlinkedStaffAccount,
  UpdatedStaffAccount,
} from '../../../repositories/staff-account.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  DeleteStaffAccountUseCase,
  GetStaffAccountUseCase,
  type StaffAccountUseCaseDependencies,
  UpdateStaffAccountUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: entityMessages.salon, id: SALON_ID },
}
const staffNotFound = {
  type: 'error',
  error: {
    type: 'notFound',
    entity: entityMessages.staffMember,
    id: STAFF_MEMBER_ID,
  },
}
const accountNotFound = {
  type: 'error',
  error: {
    type: 'notFound',
    entity: entityMessages.accountOfStaffMember,
    id: STAFF_MEMBER_ID,
  },
}
const ownRoleStays = Result.error(
  DomainErrors.conflict('You cannot change the role of your own account'),
)
const ownAccountStaysLinked = Result.error(
  DomainErrors.conflict('You cannot unlink your own account'),
)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * The methods of the two repositories that were called, in the order of
 * the calls: `salons.exists`, `accounts.update`, …
 */
const calls = ({
  salonRepository,
  staffAccountRepository,
}: StaffAccountUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(staffAccountRepository).map(([name, method]) => ({
      name: `accounts.${name}`,
      orders: callOrdersOf(method),
    })),
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Dependencies in which there is no such salon. */
const withoutSalon = (): StaffAccountUseCaseDependencies =>
  staffAccountDependencies(
    {},
    { exists: vi.fn(async () => Result.success(false)) },
  )

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): StaffAccountUseCaseDependencies =>
  staffAccountDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Who keeps the accounts of the staff of the salon of the fixtures. */
const keepers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
]

/** Who has no say about them. */
const others: [string, Actor][] = [
  ['a manager of the salon', actors.ofSalon('manager')],
  ['a staff member of the salon', actors.ofSalon('staff')],
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ['a staff member of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user without a scope', actors.withoutScope],
]

/** Salon and staff IDs in a path that are not UUIDs. */
const malformedIds: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['an empty ID', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
]

/** A use case, given a salon and a staff member; the update is given a role too. */
type OfStaffMember = (
  dependencies: StaffAccountUseCaseDependencies,
  actor: Actor,
  id: unknown,
  salon: unknown,
) => Promise<Result<unknown, DomainError>>

/** What the three use cases share. */
describe.each<[string, keyof IStaffAccountRepository, OfStaffMember]>([
  [
    'GetStaffAccountUseCase',
    'findByStaff',
    (dependencies, actor, id, salon) =>
      new GetStaffAccountUseCase(dependencies).execute(actor, salon, id),
  ],
  [
    'UpdateStaffAccountUseCase',
    'update',
    (dependencies, actor, id, salon) =>
      new UpdateStaffAccountUseCase(dependencies).execute(actor, salon, id, {
        role: 'manager',
      }),
  ],
  [
    'DeleteStaffAccountUseCase',
    'unlink',
    (dependencies, actor, id, salon) =>
      new DeleteStaffAccountUseCase(dependencies).execute(actor, salon, id),
  ],
])('%s', (_name, method, run) => {
  const execute = (
    dependencies: StaffAccountUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
    salon: unknown = SALON_ID,
  ) => run(dependencies, actor, id, salon)

  it.each(keepers)(
    'looks the salon up and then asks the repository, for %s',
    async (_who, actor) => {
      const dependencies = staffAccountDependencies()

      const result = await execute(dependencies, actor)

      expect(result.type).toBe('success')
      expect(calls(dependencies)).toEqual([
        'salons.exists',
        `accounts.${method}`,
      ])
      expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
      expect(
        vi
          .mocked(dependencies.staffAccountRepository[method])
          .mock.calls[0]?.slice(0, 2),
      ).toEqual([SALON_ID, STAFF_MEMBER_ID])
    },
  )

  it.each(others)(
    'refuses %s before anything is looked up',
    async (_who, actor) => {
      const dependencies = staffAccountDependencies()

      const result = await execute(dependencies, actor)

      expect(result).toEqual(forbidden)
      expect(calls(dependencies)).toEqual([])
    },
  )

  it.each(others)(
    'refuses %s also when the ID of the staff member is no UUID',
    async (_who, actor) => {
      expect(
        await execute(staffAccountDependencies(), actor, 'latest'),
      ).toEqual(forbidden)
    },
  )

  it('refuses a staff member of the salon the account that is their own', async () => {
    expect(
      await execute(
        staffAccountDependencies(),
        actors.ofSalon('staff'),
        STAFF_ID,
      ),
    ).toEqual(forbidden)
  })

  it('refuses whoever may not, also when there is no such salon', async () => {
    const dependencies = withoutSalon()

    expect(await execute(dependencies, actors.ofSalon('manager'))).toEqual(
      forbidden,
    )
    expect(calls(dependencies)).toEqual([])
  })

  it.each(malformedIds)(
    'rejects %s as the salon, whoever asks',
    async (_case, salon) => {
      const dependencies = staffAccountDependencies()

      const result = await execute(
        dependencies,
        actors.customer,
        STAFF_MEMBER_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(calls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the staff member before anything is looked up',
    async (_case, id) => {
      const dependencies = staffAccountDependencies()

      const result = await execute(dependencies, actors.admin, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('takes the IDs of the path in upper case for the same salon and staff member', async () => {
    const dependencies = staffAccountDependencies()

    const result = await execute(
      dependencies,
      actors.ofSalon('owner'),
      STAFF_MEMBER_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(result.type).toBe('success')
    expect(
      vi
        .mocked(dependencies.staffAccountRepository[method])
        .mock.calls[0]?.slice(0, 2),
    ).toEqual([SALON_ID, STAFF_MEMBER_ID])
  })

  it('answers that the salon was not found, without asking for the account', async () => {
    const dependencies = withoutSalon()

    expect(await execute(dependencies)).toEqual(salonNotFound)
    expect(calls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on a failure of the salon lookup', async () => {
    const dependencies = withFailingSalonLookup()

    expect(await execute(dependencies)).toEqual(databaseDown)
    expect(calls(dependencies)).toEqual(['salons.exists'])
  })

  it('answers that the staff member was not found when the salon has none of that ID', async () => {
    const dependencies = staffAccountDependencies({
      [method]: vi.fn(async () => Result.success({ type: 'staffNotFound' })),
    })

    expect(await execute(dependencies)).toEqual(staffNotFound)
  })

  it('answers that the account was not found when the staff member has none', async () => {
    const dependencies = staffAccountDependencies({
      [method]: vi.fn(async () => Result.success({ type: 'none' })),
    })

    expect(await execute(dependencies)).toEqual(accountNotFound)
  })

  it('passes on a failure of the repository', async () => {
    const dependencies = staffAccountDependencies({
      [method]: vi.fn(async () => databaseDown),
    })

    expect(await execute(dependencies)).toEqual(databaseDown)
  })
})

describe('GetStaffAccountUseCase', () => {
  const get = (
    dependencies: StaffAccountUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
  ) => new GetStaffAccountUseCase(dependencies).execute(actor, SALON_ID, id)

  it('returns the account as the API shows it', async () => {
    expect(await get(staffAccountDependencies())).toEqual({
      type: 'success',
      data: apiStaffAccount(),
    })
  })

  it('lets the owner of the salon read the account that is their own', async () => {
    const result = await get(
      staffAccountDependencies(),
      actors.ofSalon('owner'),
      STAFF_ID,
    )

    expect(result).toEqual({ type: 'success', data: apiStaffAccount() })
  })

  it('reports a stored account that does not fit the API as a database error', async () => {
    const dependencies = staffAccountDependencies({
      findByStaff: vi.fn(async () =>
        Result.success<FoundStaffAccount>({
          type: 'found',
          account: dbStaffAccount({ role: 'customer' }),
        }),
      ),
    })

    expect(await get(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })

  it('writes nothing', async () => {
    const dependencies = staffAccountDependencies()

    await get(dependencies)

    expect(dependencies.staffAccountRepository.update).not.toHaveBeenCalled()
    expect(dependencies.staffAccountRepository.unlink).not.toHaveBeenCalled()
  })
})

describe('UpdateStaffAccountUseCase', () => {
  const update = (
    dependencies: StaffAccountUseCaseDependencies,
    input: unknown = { role: 'manager' },
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
  ) =>
    new UpdateStaffAccountUseCase(dependencies).execute(
      actor,
      SALON_ID,
      id,
      input,
    )

  it('changes the role and returns the account as it is stored then', async () => {
    const dependencies = staffAccountDependencies()

    const result = await update(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: apiStaffAccount({ role: 'manager' }),
    })
    expect(dependencies.staffAccountRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      { role: 'manager' },
    )
  })

  it.each<SalonRole>(['owner', 'manager', 'staff'])(
    'lets an administrator give the role %s',
    async (role) => {
      const dependencies = staffAccountDependencies()

      const result = await update(dependencies, { role })

      expect(result).toEqual({
        type: 'success',
        data: apiStaffAccount({ role }),
      })
    },
  )

  it.each<SalonRole>(['manager', 'staff'])(
    'lets the owner of the salon give the role %s',
    async (role) => {
      const dependencies = staffAccountDependencies()

      const result = await update(
        dependencies,
        { role },
        actors.ofSalon('owner'),
      )

      expect(result).toEqual({
        type: 'success',
        data: apiStaffAccount({ role }),
      })
    },
  )

  it('does not let the owner of the salon make another owner, and looks nothing up', async () => {
    const dependencies = staffAccountDependencies()

    const result = await update(
      dependencies,
      { role: 'owner' },
      actors.ofSalon('owner'),
    )

    expect(result).toEqual(forbidden)
    expect(calls(dependencies)).toEqual([])
  })

  it('refuses the owner the role of an owner also when there is no such salon', async () => {
    expect(
      await update(withoutSalon(), { role: 'owner' }, actors.ofSalon('owner')),
    ).toEqual(forbidden)
  })

  it('reads the request before it decides about the role: a request of an owner that is no update is rejected', async () => {
    const result = await update(
      staffAccountDependencies(),
      { role: 'owner', email: 'owner@example.com' },
      actors.ofSalon('owner'),
    )

    expect(rulesOf(result)).toEqual(['email:unrecognized_keys'])
  })

  it.each<SalonRole>(['manager', 'staff'])(
    'does not let an owner give their own account the role %s, and looks nothing up',
    async (role) => {
      const dependencies = staffAccountDependencies()

      const result = await update(
        dependencies,
        { role },
        actors.ofSalon('owner'),
        STAFF_ID,
      )

      expect(result).toEqual(ownRoleStays)
      expect(calls(dependencies)).toEqual([])
    },
  )

  it('tells an owner who asks for the role of an owner for their own account that they may not give it: that comes first', async () => {
    const result = await update(
      staffAccountDependencies(),
      { role: 'owner' },
      actors.ofSalon('owner'),
      STAFF_ID,
    )

    expect(result).toEqual(forbidden)
  })

  it('tells an owner about their own account also when there is no such salon', async () => {
    expect(
      await update(
        withoutSalon(),
        { role: 'staff' },
        actors.ofSalon('owner'),
        STAFF_ID,
      ),
    ).toEqual(ownRoleStays)
  })

  it('reads the request before it tells an owner about their own account', async () => {
    const result = await update(
      staffAccountDependencies(),
      {},
      actors.ofSalon('owner'),
      STAFF_ID,
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: staffAccountMessages.invalidStaffAccountUpdate,
      },
    })
  })

  it('lets the owner change the role of another owner of the salon', async () => {
    const dependencies = staffAccountDependencies({
      update: vi.fn(async () =>
        Result.success<UpdatedStaffAccount>({
          type: 'updated',
          account: dbStaffAccount({ role: 'manager' }),
        }),
      ),
    })

    const result = await update(
      dependencies,
      { role: 'manager' },
      actors.ofSalon('owner'),
    )

    expect(result).toEqual({
      type: 'success',
      data: apiStaffAccount({ role: 'manager' }),
    })
  })

  it.each([
    ['a request without a property', {}, ['']],
    ['the role of a customer', { role: 'customer' }, ['role']],
    ['the role of an administrator', { role: 'admin' }, ['role']],
    ['a role that is null', { role: null }, ['role']],
    [
      'a status next to the role',
      { role: 'staff', status: 'suspended' },
      ['status'],
    ],
    ['no request', undefined, ['']],
  ])(
    'rejects %s before anything is looked up',
    async (_case, input, fields) => {
      const dependencies = staffAccountDependencies()

      const result = await new UpdateStaffAccountUseCase(dependencies).execute(
        actors.admin,
        SALON_ID,
        STAFF_MEMBER_ID,
        input,
      )

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'validation',
          message: staffAccountMessages.invalidStaffAccountUpdate,
          issues: fields.map((field) => ({ field })),
        },
      })
      expect(calls(dependencies)).toEqual([])
    },
  )

  it.each(others)(
    'refuses %s also when the request is no update',
    async (_who, actor) => {
      expect(
        await update(staffAccountDependencies(), { role: 'admin' }, actor),
      ).toEqual(forbidden)
    },
  )

  it('rejects an ID of the staff member that is no UUID before it reads the request', async () => {
    const result = await update(
      staffAccountDependencies(),
      {},
      actors.admin,
      'latest',
    )

    expect(rulesOf(result)).toEqual(['id:invalid_format'])
  })

  it('reports a stored account that does not fit the API as a database error', async () => {
    const dependencies = staffAccountDependencies({
      update: vi.fn(async () =>
        Result.success<UpdatedStaffAccount>({
          type: 'updated',
          account: dbStaffAccount({ createdAt: 'next week' }),
        }),
      ),
    })

    expect(await update(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
  })

  it('unlinks nobody: the role is all it changes', async () => {
    const dependencies = staffAccountDependencies()

    await update(dependencies)

    expect(dependencies.staffAccountRepository.unlink).not.toHaveBeenCalled()
  })
})

describe('DeleteStaffAccountUseCase', () => {
  const unlink = (
    dependencies: StaffAccountUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
  ) => new DeleteStaffAccountUseCase(dependencies).execute(actor, SALON_ID, id)

  it('resolves to the ID of the staff member whose account was unlinked', async () => {
    expect(await unlink(staffAccountDependencies())).toEqual({
      type: 'success',
      data: STAFF_MEMBER_ID,
    })
  })

  it('resolves to the ID in lower case when the path has it in upper case', async () => {
    expect(
      await unlink(
        staffAccountDependencies(),
        actors.admin,
        STAFF_MEMBER_ID.toUpperCase(),
      ),
    ).toEqual({ type: 'success', data: STAFF_MEMBER_ID })
  })

  it('does not let an owner unlink their own account, and looks nothing up', async () => {
    const dependencies = staffAccountDependencies()

    const result = await unlink(dependencies, actors.ofSalon('owner'), STAFF_ID)

    expect(result).toEqual(ownAccountStaysLinked)
    expect(calls(dependencies)).toEqual([])
  })

  it('tells an owner about their own account also when there is no such salon', async () => {
    expect(
      await unlink(withoutSalon(), actors.ofSalon('owner'), STAFF_ID),
    ).toEqual(ownAccountStaysLinked)
  })

  it('takes the own account by its ID, in upper case too', async () => {
    expect(
      await unlink(
        staffAccountDependencies(),
        actors.ofSalon('owner'),
        STAFF_ID.toUpperCase(),
      ),
    ).toEqual(ownAccountStaysLinked)
  })

  it('lets the owner unlink the account of another owner of the salon', async () => {
    expect(
      await unlink(staffAccountDependencies(), actors.ofSalon('owner')),
    ).toEqual({ type: 'success', data: STAFF_MEMBER_ID })
  })

  it('changes no role', async () => {
    const dependencies = staffAccountDependencies()

    await unlink(dependencies)

    expect(dependencies.staffAccountRepository.update).not.toHaveBeenCalled()
  })
})

describe('what a result of the repository cannot be mistaken for', () => {
  it.each<[string, UnlinkedStaffAccount]>([
    ['no staff member', { type: 'staffNotFound' }],
    ['no account', { type: 'none' }],
  ])('does not report %s as an unlinked account', async (_case, outcome) => {
    const dependencies = staffAccountDependencies({
      unlink: vi.fn(async () => Result.success(outcome)),
    })

    const result = await new DeleteStaffAccountUseCase(dependencies).execute(
      actors.admin,
      SALON_ID,
      STAFF_MEMBER_ID,
    )

    expect(result.type).toBe('error')
  })
})
