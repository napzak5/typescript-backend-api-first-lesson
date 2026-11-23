import { Result } from '@beauty-salon-backend/utility'
import {
  ruleMessages,
  staffMessages,
  staffProfileMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import { brokenRules, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import {
  apiStaffProfile,
  dbStaffProfile,
  staffProfileRepositoryCalls as repositoryCalls,
  staffProfileDependencies,
} from '../../../__tests__/fixtures/staff-profile-fixtures'
import type { DbStaffProfile } from '../../../models/staff-profile'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  GetStaffProfileUseCase,
  ListStaffProfilesUseCase,
  type StaffProfileUseCaseDependencies,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

describe('ListStaffProfilesUseCase', () => {
  const list = (
    dependencies: StaffProfileUseCaseDependencies,
    query: unknown = {},
  ) => new ListStaffProfilesUseCase(dependencies).execute(query)

  it('returns the staff members customers are shown with the meta of a first page', async () => {
    const dependencies = staffProfileDependencies()

    const result = await list(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiStaffProfile()],
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

  it('asks for 20 staff members of all salons from the beginning when the request names nothing', async () => {
    const dependencies = staffProfileDependencies()

    await list(dependencies)

    expect(dependencies.staffProfileRepository.list).toHaveBeenCalledWith({
      limit: 20,
      after: null,
      salonId: null,
      specialty: null,
      city: null,
    })
    expect(repositoryCalls(dependencies)).toEqual(['list'])
  })

  it('passes the limit, the cursor and every filter on', async () => {
    const dependencies = staffProfileDependencies()

    await list(dependencies, {
      limit: 2,
      cursor: OTHER_STAFF_MEMBER_ID,
      salonId: SALON_ID,
      specialty: 'color',
      city: '渋谷区',
    })

    expect(dependencies.staffProfileRepository.list).toHaveBeenCalledWith({
      limit: 2,
      after: OTHER_STAFF_MEMBER_ID,
      salonId: SALON_ID,
      specialty: 'color',
      city: '渋谷区',
    })
  })

  it.each([
    ['a salon', { salonId: SALON_ID }, { salonId: SALON_ID }],
    ['a specialty', { specialty: 'color' }, { specialty: 'color' }],
    ['a city', { city: '渋谷区' }, { city: '渋谷区' }],
  ])(
    'filters by %s alone when the request names nothing else',
    async (_case, query, filter) => {
      const dependencies = staffProfileDependencies()

      await list(dependencies, query)

      expect(dependencies.staffProfileRepository.list).toHaveBeenCalledWith({
        limit: 20,
        after: null,
        salonId: null,
        specialty: null,
        city: null,
        ...filter,
      })
    },
  )

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = staffProfileDependencies()

    const result = await list(dependencies, {
      cursor: OTHER_STAFF_MEMBER_ID.toUpperCase(),
      salonId: SALON_ID.toUpperCase(),
    })

    expect(dependencies.staffProfileRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        after: OTHER_STAFF_MEMBER_ID,
        salonId: SALON_ID,
      }),
    )
    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { cursor: OTHER_STAFF_MEMBER_ID } },
    })
  })

  it('names the last staff member of the page as the next cursor when more follow', async () => {
    const dependencies = staffProfileDependencies({
      list: vi.fn(async () =>
        Result.success({
          profiles: [
            dbStaffProfile(),
            dbStaffProfile({ id: OTHER_STAFF_MEMBER_ID }),
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
        data: [
          apiStaffProfile(),
          apiStaffProfile({ id: OTHER_STAFF_MEMBER_ID }),
        ],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: OTHER_STAFF_MEMBER_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor on the last page', async () => {
    const result = await list(staffProfileDependencies(), {
      cursor: OTHER_STAFF_MEMBER_ID,
    })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          hasMore: false,
          cursor: OTHER_STAFF_MEMBER_ID,
          nextCursor: null,
        },
      },
    })
  })

  it('returns an empty page when the filters leave no staff member', async () => {
    const dependencies = staffProfileDependencies({
      list: vi.fn(async () =>
        Result.success({ profiles: [], total: 0, hasMore: false }),
      ),
    })

    const result = await list(dependencies, { salonId: SALON_ID })

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

  it('never names a previous cursor: pages are only walked forwards', async () => {
    const result = await list(staffProfileDependencies(), {
      cursor: OTHER_STAFF_MEMBER_ID,
    })

    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { prevCursor: null } },
    })
  })

  it('shows of every staff member only the profile', async () => {
    const result = await list(staffProfileDependencies())

    expect(
      result.type === 'success'
        ? result.data.data.map((profile) => Object.keys(profile).toSorted())
        : [],
    ).toEqual([Object.keys(apiStaffProfile()).toSorted()])
  })

  it('refuses a cursor that names no staff member', async () => {
    const dependencies = staffProfileDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, { cursor: OTHER_STAFF_MEMBER_ID })

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: staffProfileMessages.invalidStaffProfileSearch,
        issues: [
          {
            field: 'cursor',
            rule: 'not_found',
            message: ruleMessages.aStaffMember,
          },
        ],
      },
    })
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
      'a salon that is not a UUID',
      { salonId: 'abc' },
      ['salonId:invalid_format'],
    ],
    ['an empty specialty', { specialty: '' }, ['specialty:invalid_format']],
    ['an empty city', { city: '' }, ['city:invalid_format']],
    [
      'a parameter the list does not have',
      { keyword: 'Hanako' },
      ['keyword:unrecognized_keys'],
    ],
    ['a request that is not an object', 'color', [':invalid_type']],
    ['no request', null, [':invalid_type']],
  ])(
    'rejects %s without looking anything up',
    async (_case, query, expected) => {
      const dependencies = staffProfileDependencies()

      const result = await list(dependencies, query)

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'validation',
          message: staffProfileMessages.invalidStaffProfileSearch,
        },
      })
      expect(rulesOf(result)).toEqual(expected)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('returns the error of the repository as it is', async () => {
    const dependencies = staffProfileDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })
})

describe('GetStaffProfileUseCase', () => {
  const get = (
    dependencies: StaffProfileUseCaseDependencies,
    id: unknown = STAFF_MEMBER_ID,
  ) => new GetStaffProfileUseCase(dependencies).execute(id)

  it('returns what customers are shown of the staff member', async () => {
    const dependencies = staffProfileDependencies()

    const result = await get(dependencies)

    expect(result).toEqual({ type: 'success', data: apiStaffProfile() })
    expect(dependencies.staffProfileRepository.findById).toHaveBeenCalledWith(
      STAFF_MEMBER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['findById'])
  })

  it('reads an ID written in upper case as the lower-case ID', async () => {
    const dependencies = staffProfileDependencies()

    await get(dependencies, STAFF_MEMBER_ID.toUpperCase())

    expect(dependencies.staffProfileRepository.findById).toHaveBeenCalledWith(
      STAFF_MEMBER_ID,
    )
  })

  it('shows a staff member who takes no bookings', async () => {
    const dependencies = staffProfileDependencies({
      findById: vi.fn(async () =>
        Result.success<DbStaffProfile | null>(
          dbStaffProfile({ canReceiveBookings: false }),
        ),
      ),
    })

    expect(await get(dependencies)).toEqual({
      type: 'success',
      data: apiStaffProfile({ canReceiveBookings: false }),
    })
  })

  it('does not find a staff member the repository does not show', async () => {
    const dependencies = staffProfileDependencies({
      findById: vi.fn(async () => Result.success<DbStaffProfile | null>(null)),
    })

    expect(await get(dependencies)).toEqual({
      type: 'error',
      error: { type: 'notFound', entity: 'Staff member', id: STAFF_MEMBER_ID },
    })
  })

  it.each([
    ['a word', 'latest'],
    ['a number', '42'],
    ['a number that is not text', 42],
    ['an empty ID', ''],
    ['no ID', null],
    ['a UUID with a character too many', `${STAFF_MEMBER_ID}0`],
    ['a UUID with a space in front', ` ${STAFF_MEMBER_ID}`],
    ['a UUID without its hyphens', STAFF_MEMBER_ID.replaceAll('-', '')],
  ])('rejects %s as the ID without looking anything up', async (_case, id) => {
    const dependencies = staffProfileDependencies()

    const result = await get(dependencies, id)

    expect(result).toMatchObject({
      type: 'error',
      error: { type: 'validation', message: staffMessages.invalidStaffId },
    })
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result).at(0)).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('returns the error of the repository as it is', async () => {
    const dependencies = staffProfileDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })
})
