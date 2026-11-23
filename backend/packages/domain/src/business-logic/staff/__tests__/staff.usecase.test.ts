import { Result } from '@beauty-salon-backend/utility'
import {
  ruleMessages,
  staffMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { actors, STAFF_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
  saidOfBrokenRules,
} from '../../../__tests__/fixtures/fixtures'
import {
  apiStaff,
  dbStaff,
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
  staffCreateRequest,
  staffDependencies,
} from '../../../__tests__/fixtures/staff-fixtures'
import type { Actor } from '../../../models/auth'
import type { DbStaff } from '../../../models/staff'
import type { StaffDeletion } from '../../../repositories/staff.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CreateStaffUseCase,
  DeleteStaffUseCase,
  GetStaffUseCase,
  ListStaffUseCase,
  type StaffUseCaseDependencies,
  UpdateStaffUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
}
const staffNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Staff member', id: STAFF_MEMBER_ID },
}
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
}

/** A row whose timestamp cannot be read: it cannot be turned into a response. */
const corruptStaff = dbStaff({ createdAt: 'yesterday' })

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * The methods of the two repositories that were called, in the order of the
 * calls: `salons.exists`, `staff.create`, …
 */
const repositoryCalls = ({
  salonRepository,
  staffRepository,
}: StaffUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(staffRepository).map(([name, method]) => ({
      name: `staff.${name}`,
      orders: callOrdersOf(method),
    })),
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Dependencies in which there is no such salon. */
const withoutSalon = (): StaffUseCaseDependencies =>
  staffDependencies({}, { exists: vi.fn(async () => Result.success(false)) })

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): StaffUseCaseDependencies =>
  staffDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Who keeps the staff ledger of the salon of the fixtures. */
const allowed: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
]

/** Who does not. */
const refused: [string, Actor][] = [
  ['a manager of the salon', actors.ofSalon('manager')],
  ['a staff member of the salon', actors.ofSalon('staff')],
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
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

describe('ListStaffUseCase', () => {
  const list = (
    dependencies: StaffUseCaseDependencies,
    query: unknown = {},
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) =>
    new ListStaffUseCase(dependencies).execute(
      actor,
      salon,
      Result.success(query),
    )

  it('returns the staff members of the salon with the meta of a first page', async () => {
    const dependencies = staffDependencies()

    const result = await list(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiStaff()],
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
    expect(dependencies.staffRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 20,
      after: null,
    })
  })

  it('passes the limit and the cursor on, and names the last staff member as the next cursor', async () => {
    const dependencies = staffDependencies({
      list: vi.fn(async () =>
        Result.success({
          staff: [dbStaff(), dbStaff({ id: OTHER_STAFF_MEMBER_ID })],
          total: 7,
          hasMore: true,
        }),
      ),
    })

    const result = await list(dependencies, {
      limit: 2,
      cursor: STAFF_ID.toUpperCase(),
    })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: STAFF_ID,
          nextCursor: OTHER_STAFF_MEMBER_ID,
          prevCursor: null,
        },
      },
    })
    expect(dependencies.staffRepository.list).toHaveBeenCalledWith({
      salonId: SALON_ID,
      limit: 2,
      after: STAFF_ID,
    })
  })

  it('names no next cursor on the last page', async () => {
    const result = await list(staffDependencies(), { cursor: STAFF_ID })

    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { hasMore: false, nextCursor: null } },
    })
  })

  it('returns an empty page for a salon without staff', async () => {
    const dependencies = staffDependencies({
      list: vi.fn(async () =>
        Result.success({ staff: [], total: 0, hasMore: false }),
      ),
    })

    const result = await list(dependencies)

    expect(result).toMatchObject({
      type: 'success',
      data: { data: [], meta: { total: 0, nextCursor: null } },
    })
  })

  it.each(allowed)('lets %s read the ledger', async (_who, actor) => {
    const result = await list(staffDependencies(), {}, actor)

    expect(result).toMatchObject({ type: 'success' })
  })

  it.each(refused)(
    'refuses %s without looking anything up',
    async (_who, actor) => {
      const dependencies = staffDependencies()

      const result = await list(dependencies, {}, actor)

      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the salon before deciding who may',
    async (_case, salon) => {
      const dependencies = staffDependencies()

      const result = await list(
        dependencies,
        {},
        actors.ofSalon('manager'),
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('tells an actor who may not read the ledger nothing about the query', async () => {
    const dependencies = staffDependencies()

    const result = await list(
      dependencies,
      { limit: 0, cursor: 'abc' },
      actors.ofSalon('manager'),
    )

    expect(result).toEqual(forbidden)
  })

  it('answers a query that could not be decoded with its error, to an actor who may', async () => {
    const dependencies = staffDependencies()
    const undecodable = Result.error(
      DomainErrors.validation(staffMessages.invalidStaffSearch, [
        { field: 'limit', rule: 'invalid_format', message: MADE_UP_MESSAGE },
      ]),
    )

    const result = await new ListStaffUseCase(dependencies).execute(
      actors.admin,
      SALON_ID,
      undecodable,
    )

    expect(result).toEqual(undecodable)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers a query that could not be decoded with 403, to an actor who may not', async () => {
    const result = await new ListStaffUseCase(staffDependencies()).execute(
      actors.ofSalon('staff'),
      SALON_ID,
      Result.error(
        DomainErrors.validation(staffMessages.invalidStaffSearch, []),
      ),
    )

    expect(result).toEqual(forbidden)
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    [
      'a cursor that is not a UUID',
      { cursor: 'abc' },
      ['cursor:invalid_format'],
    ],
    [
      'an unknown parameter',
      { isActive: true },
      ['isActive:unrecognized_keys'],
    ],
  ])(
    'rejects %s without looking anything up',
    async (_case, query, expected) => {
      const dependencies = staffDependencies()

      const result = await list(dependencies, query)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: staffMessages.invalidStaffSearch },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('looks for the salon before it lists', async () => {
    const dependencies = staffDependencies()

    await list(dependencies)

    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'staff.list',
    ])
  })

  it('answers 404 for a salon that does not exist, without listing', async () => {
    const dependencies = withoutSalon()

    const result = await list(dependencies)

    expect(result).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('rejects a cursor that names no staff member of the salon', async () => {
    const dependencies = staffDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, { cursor: STAFF_ID })

    expect(rulesOf(result)).toEqual(['cursor:not_found'])
    expect(saidOfBrokenRules(result)).toEqual([
      ruleMessages.aStaffMemberOfSalon,
    ])
  })

  it('returns the error of a failed salon lookup', async () => {
    expect(await list(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('returns the error of a failed list', async () => {
    const dependencies = staffDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('fails with a database error when a stored staff member cannot be presented', async () => {
    const dependencies = staffDependencies({
      list: vi.fn(async () =>
        Result.success({
          staff: [dbStaff(), corruptStaff],
          total: 2,
          hasMore: false,
        }),
      ),
    })

    expect(await list(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('GetStaffUseCase', () => {
  const get = (
    dependencies: StaffUseCaseDependencies,
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
    id: unknown = STAFF_MEMBER_ID,
  ) => new GetStaffUseCase(dependencies).execute(actor, salon, id)

  it('returns the staff member as the API presents it', async () => {
    const dependencies = staffDependencies()

    const result = await get(dependencies)

    expect(result).toEqual({ type: 'success', data: apiStaff() })
    expect(dependencies.staffRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
    )
  })

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = staffDependencies()

    await get(
      dependencies,
      actors.admin,
      SALON_ID.toUpperCase(),
      STAFF_MEMBER_ID.toUpperCase(),
    )

    expect(dependencies.staffRepository.findById).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
    )
  })

  it.each(allowed)('lets %s read a staff member', async (_who, actor) => {
    expect(await get(staffDependencies(), actor)).toMatchObject({
      type: 'success',
    })
  })

  it.each(refused)(
    'refuses %s without looking anything up',
    async (_who, actor) => {
      const dependencies = staffDependencies()

      const result = await get(dependencies, actor)

      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('refuses a staff member of the salon their own record', async () => {
    const result = await get(
      staffDependencies(),
      actors.ofSalon('staff'),
      SALON_ID,
      STAFF_ID,
    )

    expect(result).toEqual(forbidden)
  })

  it('refuses before it reads the ID of the staff member', async () => {
    const result = await get(
      staffDependencies(),
      actors.ofSalon('manager'),
      SALON_ID,
      'abc',
    )

    expect(result).toEqual(forbidden)
  })

  it.each(malformedIds)(
    'rejects %s as the salon before deciding who may',
    async (_case, salon) => {
      const result = await get(
        staffDependencies(),
        actors.ofSalon('manager'),
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the staff member without looking anything up',
    async (_case, id) => {
      const dependencies = staffDependencies()

      const result = await get(dependencies, actors.admin, SALON_ID, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(result).toMatchObject({
        error: { message: staffMessages.invalidStaffId },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('looks for the salon before the staff member', async () => {
    const dependencies = staffDependencies()

    await get(dependencies)

    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'staff.findById',
    ])
  })

  it('answers 404 for a salon that does not exist', async () => {
    const dependencies = withoutSalon()

    expect(await get(dependencies)).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('answers 404 for a staff member the salon does not have', async () => {
    const dependencies = staffDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    expect(await get(dependencies)).toEqual(staffNotFound)
  })

  it('returns the error of a failed salon lookup', async () => {
    expect(await get(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('returns the error of a failed lookup', async () => {
    const dependencies = staffDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('fails with a database error when the stored staff member cannot be presented', async () => {
    const dependencies = staffDependencies({
      findById: vi.fn(async () => Result.success(corruptStaff)),
    })

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('CreateStaffUseCase', () => {
  const create = (
    dependencies: StaffUseCaseDependencies,
    input: unknown = staffCreateRequest(),
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) => new CreateStaffUseCase(dependencies).execute(actor, salon, input)

  it('stores the request as a row of the salon and returns the stored staff member', async () => {
    const dependencies = staffDependencies()

    const result = await create(dependencies)

    expect(result).toEqual({ type: 'success', data: apiStaff() })
    expect(dependencies.staffRepository.create).toHaveBeenCalledWith(SALON_ID, {
      ...staffCreateRequest(),
      commissionRate: '12.5',
    })
  })

  it('stores the email in lower case', async () => {
    const dependencies = staffDependencies()

    await create(dependencies, {
      ...staffCreateRequest(),
      email: 'Hanako@Aoyama.Example.COM',
    })

    expect(dependencies.staffRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      expect.objectContaining({ email: 'hanako@aoyama.example.com' }),
    )
  })

  it('stores the staff member under the salon of the path, written in lower case', async () => {
    const dependencies = staffDependencies()

    await create(
      dependencies,
      staffCreateRequest(),
      actors.admin,
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.staffRepository.create).toHaveBeenCalledWith(
      SALON_ID,
      expect.anything(),
    )
  })

  it.each(allowed)('lets %s register a staff member', async (_who, actor) => {
    const result = await create(
      staffDependencies(),
      staffCreateRequest(),
      actor,
    )

    expect(result).toMatchObject({ type: 'success' })
  })

  it.each(refused)(
    'refuses %s without looking anything up',
    async (_who, actor) => {
      const dependencies = staffDependencies()

      const result = await create(dependencies, staffCreateRequest(), actor)

      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('refuses before it reads the request', async () => {
    const result = await create(
      staffDependencies(),
      { firstName: '' },
      actors.ofSalon('manager'),
    )

    expect(result).toEqual(forbidden)
  })

  it('refuses the owner of another salon, also when the salon of the path does not exist', async () => {
    const dependencies = withoutSalon()

    const result = await create(
      dependencies,
      staffCreateRequest(),
      actors.ofSalon('owner', OTHER_SALON_ID),
    )

    expect(result).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each(malformedIds)(
    'rejects %s as the salon before deciding who may',
    async (_case, salon) => {
      const result = await create(
        staffDependencies(),
        staffCreateRequest(),
        actors.ofSalon('manager'),
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
    },
  )

  it.each([
    ['a blank first name', { firstName: ' ' }, ['firstName:invalid_format']],
    ['an invalid email', { email: 'hanako' }, ['email:invalid_format']],
    [
      'a commission rate above 100',
      { commissionRate: 100.01 },
      ['commissionRate:too_big'],
    ],
    [
      'a specialty given twice',
      { specialties: ['cut', 'cut'] },
      ['specialties.1:custom'],
    ],
    ['a login account', { userId: null }, ['userId:unrecognized_keys']],
    ['a salon', { salonId: OTHER_SALON_ID }, ['salonId:unrecognized_keys']],
  ])(
    'rejects %s without looking anything up',
    async (_case, change, expected) => {
      const dependencies = staffDependencies()

      const result = await create(dependencies, {
        ...staffCreateRequest(),
        ...change,
      })

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: staffMessages.invalidStaffMember },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('looks for the salon before it stores', async () => {
    const dependencies = staffDependencies()

    await create(dependencies)

    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'staff.create',
    ])
  })

  it('answers 404 for a salon that does not exist, without storing', async () => {
    const dependencies = withoutSalon()

    expect(await create(dependencies)).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it.each([
    ['email', 'hanako@aoyama.example.com'],
    ['staffCode', 'STF-001'],
  ])('returns the refusal of a %s that is taken', async (field, value) => {
    const taken = Result.error(
      DomainErrors.alreadyExists('Staff member', field, value),
    )
    const dependencies = staffDependencies({ create: vi.fn(async () => taken) })

    expect(await create(dependencies)).toEqual(taken)
  })

  it('returns the error of a failed salon lookup', async () => {
    expect(await create(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('returns the error of a failed write', async () => {
    const dependencies = staffDependencies({
      create: vi.fn(async () => databaseDown),
    })

    expect(await create(dependencies)).toEqual(databaseDown)
  })

  it('fails with a database error when the stored staff member cannot be presented', async () => {
    const dependencies = staffDependencies({
      create: vi.fn(async () => Result.success(corruptStaff)),
    })

    expect(await create(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('UpdateStaffUseCase', () => {
  const update = (
    dependencies: StaffUseCaseDependencies,
    input: unknown = { position: 'Director' },
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
    salon: unknown = SALON_ID,
  ) => new UpdateStaffUseCase(dependencies).execute(actor, salon, id, input)

  const ownRecordStaysActive = Result.error(
    DomainErrors.conflict('You cannot deactivate your own staff record'),
  )

  it('changes the properties of the request and returns the staff member', async () => {
    const dependencies = staffDependencies({
      update: vi.fn(async () =>
        Result.success<DbStaff | null>(dbStaff({ position: 'Director' })),
      ),
    })

    const result = await update(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: apiStaff({ position: 'Director' }),
    })
    expect(dependencies.staffRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      { position: 'Director' },
    )
  })

  it('writes the commission rate as the text of a numeric column and the email in lower case', async () => {
    const dependencies = staffDependencies()

    await update(dependencies, {
      commissionRate: 7.25,
      email: 'Hanako@Aoyama.Example.COM',
    })

    expect(dependencies.staffRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      { commissionRate: '7.25', email: 'hanako@aoyama.example.com' },
    )
  })

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = staffDependencies()

    await update(
      dependencies,
      { position: null },
      actors.admin,
      STAFF_MEMBER_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.staffRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      { position: null },
    )
  })

  it.each(allowed)('lets %s change a staff member', async (_who, actor) => {
    const result = await update(staffDependencies(), { position: null }, actor)

    expect(result).toMatchObject({ type: 'success' })
  })

  it.each(refused)(
    'refuses %s without looking anything up',
    async (_who, actor) => {
      const dependencies = staffDependencies()

      const result = await update(dependencies, { position: null }, actor)

      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('refuses before it reads the ID and the request', async () => {
    const result = await update(
      staffDependencies(),
      {},
      actors.ofSalon('manager'),
      'abc',
    )

    expect(result).toEqual(forbidden)
  })

  it('refuses a staff member of the salon their own record', async () => {
    const result = await update(
      staffDependencies(),
      { bio: 'About me' },
      actors.ofSalon('staff'),
      STAFF_ID,
    )

    expect(result).toEqual(forbidden)
  })

  it.each(malformedIds)(
    'rejects %s as the salon before deciding who may',
    async (_case, salon) => {
      const result = await update(
        staffDependencies(),
        { position: null },
        actors.ofSalon('manager'),
        STAFF_MEMBER_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the staff member before it reads the request',
    async (_case, id) => {
      const dependencies = staffDependencies()

      const result = await update(dependencies, {}, actors.admin, id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['an empty request', {}, [':custom']],
    [
      'a blank display name',
      { displayName: ' ' },
      ['displayName:invalid_format'],
    ],
    [
      'specialties of null',
      { specialties: null },
      ['specialties:invalid_type'],
    ],
    ['a login account', { userId: null }, ['userId:unrecognized_keys']],
    ['a salon', { salonId: OTHER_SALON_ID }, ['salonId:unrecognized_keys']],
  ])(
    'rejects %s without looking anything up',
    async (_case, input, expected) => {
      const dependencies = staffDependencies()

      const result = await update(dependencies, input)

      expect(rulesOf(result)).toEqual(expected)
      expect(result).toMatchObject({
        error: { message: staffMessages.invalidStaffUpdate },
      })
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not let an owner deactivate the staff member their own account belongs to', async () => {
    const dependencies = staffDependencies()

    const result = await update(
      dependencies,
      { isActive: false },
      actors.ofSalon('owner'),
      STAFF_ID,
    )

    expect(result).toEqual(ownRecordStaysActive)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('does not let an owner deactivate their own record among other changes', async () => {
    const dependencies = staffDependencies()

    const result = await update(
      dependencies,
      { position: 'Owner', isActive: false },
      actors.ofSalon('owner'),
      STAFF_ID.toUpperCase(),
    )

    expect(result).toEqual(ownRecordStaysActive)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers an invalid request for the own record with its errors, not with the conflict', async () => {
    const result = await update(
      staffDependencies(),
      { isActive: false, displayName: ' ' },
      actors.ofSalon('owner'),
      STAFF_ID,
    )

    expect(rulesOf(result)).toEqual(['displayName:invalid_format'])
  })

  it.each([
    ['states that their own record is active', { isActive: true }],
    ['changes another property of their own record', { position: 'Owner' }],
  ])('lets an owner who %s', async (_case, input) => {
    const dependencies = staffDependencies()

    const result = await update(
      dependencies,
      input,
      actors.ofSalon('owner'),
      STAFF_ID,
    )

    expect(result).toMatchObject({ type: 'success' })
    expect(dependencies.staffRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_ID,
      input,
    )
  })

  it('lets an owner deactivate another staff member of the salon', async () => {
    const dependencies = staffDependencies()

    const result = await update(
      dependencies,
      { isActive: false },
      actors.ofSalon('owner'),
    )

    expect(result).toMatchObject({ type: 'success' })
    expect(dependencies.staffRepository.update).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      { isActive: false },
    )
  })

  it('lets an administrator deactivate any staff member, the one of an owner included', async () => {
    const dependencies = staffDependencies()

    const result = await update(
      dependencies,
      { isActive: false },
      actors.admin,
      STAFF_ID,
    )

    expect(result).toMatchObject({ type: 'success' })
  })

  it('looks for the salon before it writes', async () => {
    const dependencies = staffDependencies()

    await update(dependencies)

    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'staff.update',
    ])
  })

  it('answers 404 for a salon that does not exist, without writing', async () => {
    const dependencies = withoutSalon()

    expect(await update(dependencies)).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('answers 404 for a staff member the salon does not have', async () => {
    const dependencies = staffDependencies({
      update: vi.fn(async () => Result.success(null)),
    })

    expect(await update(dependencies)).toEqual(staffNotFound)
  })

  it.each([
    ['email', 'taken@aoyama.example.com'],
    ['staffCode', 'STF-002'],
  ])('returns the refusal of a %s that is taken', async (field, value) => {
    const taken = Result.error(
      DomainErrors.alreadyExists('Staff member', field, value),
    )
    const dependencies = staffDependencies({ update: vi.fn(async () => taken) })

    expect(await update(dependencies, { [field]: value })).toEqual(taken)
  })

  it('returns the error of a failed salon lookup', async () => {
    expect(await update(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('returns the error of a failed write', async () => {
    const dependencies = staffDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies)).toEqual(databaseDown)
  })

  it('fails with a database error when the stored staff member cannot be presented', async () => {
    const dependencies = staffDependencies({
      update: vi.fn(async () => Result.success(corruptStaff)),
    })

    expect(await update(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('DeleteStaffUseCase', () => {
  const remove = (
    dependencies: StaffUseCaseDependencies,
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
    salon: unknown = SALON_ID,
  ) => new DeleteStaffUseCase(dependencies).execute(actor, salon, id)

  const ownRecordStays = Result.error(
    DomainErrors.conflict('You cannot delete your own staff record'),
  )

  it('deletes the staff member of the salon and returns the ID', async () => {
    const dependencies = staffDependencies()

    const result = await remove(dependencies)

    expect(result).toEqual({ type: 'success', data: STAFF_MEMBER_ID })
    expect(dependencies.staffRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
    )
  })

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = staffDependencies()

    const result = await remove(
      dependencies,
      actors.admin,
      STAFF_MEMBER_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(result).toEqual({ type: 'success', data: STAFF_MEMBER_ID })
    expect(dependencies.staffRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
    )
  })

  it.each(allowed)('lets %s delete a staff member', async (_who, actor) => {
    expect(await remove(staffDependencies(), actor)).toMatchObject({
      type: 'success',
    })
  })

  it.each(refused)(
    'refuses %s without looking anything up',
    async (_who, actor) => {
      const dependencies = staffDependencies()

      const result = await remove(dependencies, actor)

      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('refuses before it reads the ID of the staff member', async () => {
    const result = await remove(
      staffDependencies(),
      actors.ofSalon('manager'),
      'abc',
    )

    expect(result).toEqual(forbidden)
  })

  it('refuses a manager their own record with 403, not with the conflict', async () => {
    const result = await remove(
      staffDependencies(),
      actors.ofSalon('manager'),
      STAFF_ID,
    )

    expect(result).toEqual(forbidden)
  })

  it.each(malformedIds)(
    'rejects %s as the salon before deciding who may',
    async (_case, salon) => {
      const result = await remove(
        staffDependencies(),
        actors.ofSalon('manager'),
        STAFF_MEMBER_ID,
        salon,
      )

      expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
    },
  )

  it.each(malformedIds)(
    'rejects %s as the staff member without looking anything up',
    async (_case, id) => {
      const dependencies = staffDependencies()

      const result = await remove(dependencies, actors.ofSalon('owner'), id)

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not let an owner delete the staff member their own account belongs to', async () => {
    const dependencies = staffDependencies()

    const result = await remove(
      dependencies,
      actors.ofSalon('owner'),
      STAFF_ID.toUpperCase(),
    )

    expect(result).toEqual(ownRecordStays)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('lets an owner delete another staff member of the salon', async () => {
    const dependencies = staffDependencies()

    const result = await remove(dependencies, actors.ofSalon('owner'))

    expect(result).toEqual({ type: 'success', data: STAFF_MEMBER_ID })
  })

  it('lets an administrator delete any staff member, the one of an owner included', async () => {
    const dependencies = staffDependencies()

    const result = await remove(dependencies, actors.admin, STAFF_ID)

    expect(result).toEqual({ type: 'success', data: STAFF_ID })
    expect(dependencies.staffRepository.delete).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_ID,
    )
  })

  it('looks for the salon before it deletes', async () => {
    const dependencies = staffDependencies()

    await remove(dependencies)

    expect(repositoryCalls(dependencies)).toEqual([
      'salons.exists',
      'staff.delete',
    ])
  })

  it('answers 404 for a salon that does not exist, without deleting', async () => {
    const dependencies = withoutSalon()

    expect(await remove(dependencies)).toEqual(salonNotFound)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('answers 404 for a staff member the salon does not have', async () => {
    const dependencies = staffDependencies({
      delete: vi.fn(async () =>
        Result.success<StaffDeletion>({ type: 'notFound' }),
      ),
    })

    expect(await remove(dependencies)).toEqual(staffNotFound)
  })

  it('answers 409 for a staff member who is on bookings that are not finished', async () => {
    const dependencies = staffDependencies({
      delete: vi.fn(async () =>
        Result.success<StaffDeletion>({ type: 'bookingsUnfinished' }),
      ),
    })

    expect(await remove(dependencies)).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The staff member cannot be deleted: bookings that are not finished refer to it',
      },
    })
  })

  it('returns the error of a failed salon lookup', async () => {
    expect(await remove(withFailingSalonLookup())).toEqual(databaseDown)
  })

  it('returns the error of a failed delete', async () => {
    const dependencies = staffDependencies({
      delete: vi.fn(async () => databaseDown),
    })

    expect(await remove(dependencies)).toEqual(databaseDown)
  })
})
