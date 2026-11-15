import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  GetOwnStaffProfileUseCase,
  type StaffProfileUseCaseDependencies,
  UpdateOwnStaffProfileUseCase,
} from '../business-logic/staff-profile'
import { ownProfileOf } from '../business-logic/staff-profile/_shared/own-profile'
import type { Actor } from '../models/auth'
import type { DbStaffProfile } from '../models/staff-profile'
import { type DomainError, DomainErrors } from '../shared'
import { actors, STAFF_ID } from './auth-fixtures'
import { brokenRules } from './fixtures'
import {
  apiStaffProfile,
  dbStaffProfile,
  staffProfileRepositoryCalls as repositoryCalls,
  staffProfileDependencies,
} from './staff-profile-fixtures'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const notFound = Result.error(DomainErrors.notFound('Staff member', STAFF_ID))

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

const ROLES: ['owner' | 'manager' | 'staff'][] = [
  ['owner'],
  ['manager'],
  ['staff'],
]

/** Accounts that are not the account of a staff member who works at a salon. */
const others: [string, Actor][] = [
  ['an admin', actors.admin],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

describe('ownProfileOf', () => {
  it.each(ROLES)(
    'gives the %s of a salon the profile of the staff member of the account',
    (role) => {
      expect(ownProfileOf(actors.ofSalon(role))).toEqual({
        type: 'ownProfile',
        staffId: STAFF_ID,
      })
    },
  )

  it.each(others)('gives %s no profile', (_case, actor) => {
    expect(ownProfileOf(actor)).toEqual({ type: 'notAStaffMember' })
  })
})

describe('GetOwnStaffProfileUseCase', () => {
  const get = (
    dependencies: StaffProfileUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
  ) => new GetOwnStaffProfileUseCase(dependencies).execute(actor)

  it('returns what customers are shown of the staff member of the account', async () => {
    const dependencies = staffProfileDependencies({
      findById: vi.fn(async () =>
        Result.success<DbStaffProfile | null>(dbStaffProfile({ id: STAFF_ID })),
      ),
    })

    const result = await get(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: apiStaffProfile({ id: STAFF_ID }),
    })
    expect(dependencies.staffProfileRepository.findById).toHaveBeenCalledWith(
      STAFF_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['findById'])
  })

  it.each(ROLES)('reads the profile of the %s of a salon', async (role) => {
    const dependencies = staffProfileDependencies()

    const result = await get(dependencies, actors.ofSalon(role))

    expect(result.type).toBe('success')
    expect(dependencies.staffProfileRepository.findById).toHaveBeenCalledWith(
      STAFF_ID,
    )
  })

  it.each(others)(
    'refuses %s without looking anything up',
    async (_case, actor) => {
      const dependencies = staffProfileDependencies()

      const result = await get(dependencies, actor)

      expect(result).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not find the profile of a staff member who stopped being shown after the actor was authenticated', async () => {
    const dependencies = staffProfileDependencies({
      findById: vi.fn(async () => Result.success<DbStaffProfile | null>(null)),
    })

    expect(await get(dependencies)).toEqual(notFound)
  })

  it('shows of the row only the profile', async () => {
    const dependencies = staffProfileDependencies({
      findById: vi.fn(async () =>
        Result.success<DbStaffProfile | null>({
          ...dbStaffProfile(),
          ...{ email: 'hanako@aoyama.example.com', baseSalary: 300000 },
        }),
      ),
    })

    const result = await get(dependencies)

    expect(result).toEqual({ type: 'success', data: apiStaffProfile() })
  })

  it('returns the error of the repository as it is', async () => {
    const dependencies = staffProfileDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })
})

describe('UpdateOwnStaffProfileUseCase', () => {
  const update = (
    dependencies: StaffProfileUseCaseDependencies,
    input: unknown,
    actor: Actor = actors.ofSalon('staff'),
  ) => new UpdateOwnStaffProfileUseCase(dependencies).execute(actor, input)

  const everything = {
    specialties: ['cut', 'perm'],
    bio: 'Fifteen years of cutting.',
    imageUrl: 'https://aoyama.example.com/staff/hanako-2.jpg',
    yearsOfExperience: 15,
    certifications: ['美容師免許', '管理美容師'],
  }

  it('changes the given properties of the staff member of the account and returns the profile as it is stored then', async () => {
    const dependencies = staffProfileDependencies()

    const result = await update(dependencies, everything)

    expect(result).toEqual({
      type: 'success',
      data: apiStaffProfile(everything),
    })
    expect(dependencies.staffProfileRepository.update).toHaveBeenCalledWith(
      STAFF_ID,
      everything,
    )
    expect(repositoryCalls(dependencies)).toEqual(['update'])
  })

  it.each(Object.entries(everything))(
    'passes %s alone on and names no other property',
    async (property, value) => {
      const dependencies = staffProfileDependencies()

      const result = await update(dependencies, { [property]: value })

      expect(result).toEqual({
        type: 'success',
        data: apiStaffProfile({ [property]: value }),
      })
      expect(dependencies.staffProfileRepository.update).toHaveBeenCalledWith(
        STAFF_ID,
        { [property]: value },
      )
    },
  )

  it('clears what can be cleared', async () => {
    const cleared = { bio: null, imageUrl: null, yearsOfExperience: null }
    const dependencies = staffProfileDependencies()

    const result = await update(dependencies, cleared)

    expect(result).toEqual({ type: 'success', data: apiStaffProfile(cleared) })
    expect(dependencies.staffProfileRepository.update).toHaveBeenCalledWith(
      STAFF_ID,
      cleared,
    )
  })

  it.each(ROLES)(
    'lets the %s of a salon write their own profile',
    async (role) => {
      const dependencies = staffProfileDependencies()

      const result = await update(
        dependencies,
        { bio: null },
        actors.ofSalon(role),
      )

      expect(result.type).toBe('success')
      expect(dependencies.staffProfileRepository.update).toHaveBeenCalledWith(
        STAFF_ID,
        { bio: null },
      )
    },
  )

  it.each(others)(
    'refuses %s before the request is read, and writes nothing',
    async (_case, actor) => {
      const dependencies = staffProfileDependencies()

      const refused = [
        await update(dependencies, everything, actor),
        await update(dependencies, { bio: ' ' }, actor),
        await update(dependencies, undefined, actor),
      ]

      expect(refused).toEqual([forbidden, forbidden, forbidden])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a blank biography', { bio: ' ' }, ['bio:invalid_format']],
    [
      'an image that is no URL',
      { imageUrl: 'hanako.jpg' },
      ['imageUrl:invalid_format'],
    ],
    [
      'a specialty twice',
      { specialties: ['cut', 'cut'] },
      ['specialties.1:custom'],
    ],
    [
      'more experience than a person has',
      { yearsOfExperience: 101 },
      ['yearsOfExperience:too_big'],
    ],
    [
      'the name customers are shown, which the salon decides',
      { displayName: 'Hana' },
      ['displayName:unrecognized_keys'],
    ],
    [
      'the level, which the salon decides',
      { level: 'master' },
      ['level:unrecognized_keys'],
    ],
    [
      'whether the staff member takes bookings, which the salon decides',
      { canReceiveBookings: false },
      ['canReceiveBookings:unrecognized_keys'],
    ],
    ['a request that names no property', {}, [':custom']],
    ['nothing in place of a request', undefined, [':invalid_type']],
  ])('rejects %s and writes nothing', async (_case, input, expected) => {
    const dependencies = staffProfileDependencies()

    const result = await update(dependencies, input)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: 'Invalid staff profile update' },
    })
    expect(rulesOf(result)).toEqual(expected)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('does not find the profile of a staff member who stopped being shown after the actor was authenticated', async () => {
    const dependencies = staffProfileDependencies({
      update: vi.fn(async () => Result.success<DbStaffProfile | null>(null)),
    })

    expect(await update(dependencies, everything)).toEqual(notFound)
  })

  it('shows of the row it wrote only the profile', async () => {
    const dependencies = staffProfileDependencies({
      update: vi.fn(async () =>
        Result.success<DbStaffProfile | null>({
          ...dbStaffProfile(),
          ...{ email: 'hanako@aoyama.example.com', baseSalary: 300000 },
        }),
      ),
    })

    const result = await update(dependencies, { bio: 'x' })

    expect(result).toEqual({ type: 'success', data: apiStaffProfile() })
  })

  it('returns the error of the repository as it is', async () => {
    const dependencies = staffProfileDependencies({
      update: vi.fn(async () => databaseDown),
    })

    expect(await update(dependencies, everything)).toEqual(databaseDown)
  })
})
