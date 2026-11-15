import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  ListStaffSchedulesUseCase,
  type StaffScheduleUseCaseDependencies,
  UpdateStaffSchedulesUseCase,
} from '../business-logic/staff-schedule'
import type { Actor } from '../models/auth'
import type { DbStaffSchedule } from '../models/staff-schedule'
import { type DomainError, DomainErrors } from '../shared'
import { actors, STAFF_ID } from './auth-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'
import {
  dayOffEntry,
  dbStaffSchedule,
  singleDayEntry,
  staffScheduleDependencies,
  weeklyEntry,
} from './staff-schedule-fixtures'

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

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** When each call of a stubbed method came, among all calls of all stubs. */
const callOrdersOf = (method: (...args: never[]) => unknown): number[] =>
  vi.mocked(method).mock.invocationCallOrder

/**
 * The methods of the two repositories that were called, in the order of the
 * calls: `salons.exists`, `schedules.replace`, …
 */
const repositoryCalls = ({
  salonRepository,
  staffScheduleRepository,
}: StaffScheduleUseCaseDependencies): string[] =>
  [
    ...Object.entries(salonRepository).map(([name, method]) => ({
      name: `salons.${name}`,
      orders: callOrdersOf(method),
    })),
    ...Object.entries(staffScheduleRepository).map(([name, method]) => ({
      name: `schedules.${name}`,
      orders: callOrdersOf(method),
    })),
  ]
    .flatMap(({ name, orders }) => orders.map((order) => ({ name, order })))
    .sort((left, right) => left.order - right.order)
    .map(({ name }) => name)

/** Dependencies in which there is no such salon. */
const withoutSalon = (): StaffScheduleUseCaseDependencies =>
  staffScheduleDependencies(
    {},
    { exists: vi.fn(async () => Result.success(false)) },
  )

/** Dependencies in which looking for the salon fails. */
const withFailingSalonLookup = (): StaffScheduleUseCaseDependencies =>
  staffScheduleDependencies({}, { exists: vi.fn(async () => databaseDown) })

/** Who plans the schedules of the salon of the fixtures. */
const planners: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['a manager of the salon', actors.ofSalon('manager')],
]

/** Who has nothing to do with the schedules of the salon. */
const outsiders: [string, Actor][] = [
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

// 2026-12-28 is a Monday, 2026-12-29 a Tuesday, 2026-12-31 a Thursday.
const monday = dbStaffSchedule({ id: 'monday' })
const thursday = dbStaffSchedule({ id: 'thursday', ...singleDayEntry() })
const mondayOff = dbStaffSchedule({
  id: 'monday-off',
  ...dayOffEntry({ date: '2026-12-28' }),
})

/** Dependencies in which the staff member has the given rows. */
const withSchedules = (
  ...rows: DbStaffSchedule[]
): StaffScheduleUseCaseDependencies =>
  staffScheduleDependencies({
    findByStaff: vi.fn(async () =>
      Result.success<DbStaffSchedule[] | null>(rows),
    ),
  })

describe('ListStaffSchedulesUseCase', () => {
  const list = (
    dependencies: StaffScheduleUseCaseDependencies,
    query: unknown = {},
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
    salon: unknown = SALON_ID,
  ) =>
    new ListStaffSchedulesUseCase(dependencies).execute(actor, salon, id, query)

  it('returns the rows of the staff member as entries, in the order of the repository', async () => {
    const dependencies = withSchedules(monday, thursday, mondayOff)

    const result = await list(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: [
        weeklyEntry(),
        singleDayEntry(),
        dayOffEntry({ date: '2026-12-28' }),
      ],
    })
    expect(
      dependencies.staffScheduleRepository.findByStaff,
    ).toHaveBeenCalledWith(SALON_ID, STAFF_MEMBER_ID)
  })

  it('returns an empty list for a staff member without a schedule', async () => {
    expect(await list(withSchedules())).toEqual({ type: 'success', data: [] })
  })

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = staffScheduleDependencies()

    await list(
      dependencies,
      {},
      actors.admin,
      STAFF_MEMBER_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(
      dependencies.staffScheduleRepository.findByStaff,
    ).toHaveBeenCalledWith(SALON_ID, STAFF_MEMBER_ID)
    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
  })

  describe('for a date', () => {
    it.each([
      [
        'the weekly entry of its day of the week',
        '2026-12-21',
        [weeklyEntry()],
      ],
      ['the entry of that single day', '2026-12-31', [singleDayEntry()]],
      [
        'the entry of that single day in place of the weekly one',
        '2026-12-28',
        [dayOffEntry({ date: '2026-12-28' })],
      ],
      ['nothing on a day without an entry', '2026-12-29', []],
    ])('returns %s', async (_case, date, entries) => {
      const result = await list(withSchedules(monday, thursday, mondayOff), {
        date,
      })

      expect(result).toEqual({ type: 'success', data: entries })
    })

    it('returns nothing for a staff member without a schedule', async () => {
      const result = await list(withSchedules(), { date: '2026-12-28' })

      expect(result).toEqual({ type: 'success', data: [] })
    })

    it('reads all rows of the staff member, as without a date', async () => {
      const dependencies = withSchedules(monday)

      await list(dependencies, { date: '2026-12-28' })

      expect(repositoryCalls(dependencies)).toEqual([
        'salons.exists',
        'schedules.findByStaff',
      ])
      expect(
        dependencies.staffScheduleRepository.findByStaff,
      ).toHaveBeenCalledWith(SALON_ID, STAFF_MEMBER_ID)
    })
  })

  describe('who may read', () => {
    it.each(planners)(
      'lets %s read the schedule of any staff member of the salon',
      async (_who, actor) => {
        const results = [
          await list(staffScheduleDependencies(), {}, actor),
          await list(staffScheduleDependencies(), {}, actor, STAFF_ID),
          await list(
            staffScheduleDependencies(),
            {},
            actor,
            OTHER_STAFF_MEMBER_ID,
          ),
        ]

        for (const result of results) {
          expect(result).toMatchObject({ type: 'success' })
        }
      },
    )

    it('lets a staff member of the salon read their own schedule', async () => {
      const dependencies = staffScheduleDependencies()

      const result = await list(
        dependencies,
        {},
        actors.ofSalon('staff'),
        STAFF_ID,
      )

      expect(result).toEqual({ type: 'success', data: [weeklyEntry()] })
      expect(
        dependencies.staffScheduleRepository.findByStaff,
      ).toHaveBeenCalledWith(SALON_ID, STAFF_ID)
    })

    it('lets a staff member read their own schedule under an ID written in upper case', async () => {
      const result = await list(
        staffScheduleDependencies(),
        {},
        actors.ofSalon('staff'),
        STAFF_ID.toUpperCase(),
      )

      expect(result).toMatchObject({ type: 'success' })
    })

    it.each([
      ['a colleague', STAFF_MEMBER_ID],
      ['another colleague', OTHER_STAFF_MEMBER_ID],
    ])(
      'refuses a staff member of the salon the schedule of %s, without looking anything up',
      async (_whose, id) => {
        const dependencies = staffScheduleDependencies()

        const result = await list(dependencies, {}, actors.ofSalon('staff'), id)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(outsiders)(
      'refuses %s without looking anything up, whoever the staff member is',
      async (_who, actor) => {
        const dependencies = staffScheduleDependencies()

        const results = [
          await list(dependencies, {}, actor),
          await list(dependencies, {}, actor, STAFF_ID),
        ]

        expect(results).toEqual([forbidden, forbidden])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('refuses a staff member of another salon even their own ID in this salon', async () => {
      const result = await list(
        staffScheduleDependencies(),
        {},
        actors.ofSalon('staff', OTHER_SALON_ID),
        STAFF_ID,
      )

      expect(result).toEqual(forbidden)
    })
  })

  describe('the order of the checks', () => {
    it.each(malformedIds)(
      'rejects %s as the salon before deciding who may',
      async (_case, salon) => {
        const dependencies = staffScheduleDependencies()

        const result = await list(
          dependencies,
          {},
          actors.customer,
          STAFF_MEMBER_ID,
          salon,
        )

        expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(malformedIds)(
      'tells an actor from outside the salon nothing about %s as the staff member',
      async (_case, id) => {
        const result = await list(
          staffScheduleDependencies(),
          {},
          actors.customer,
          id,
        )

        expect(result).toEqual(forbidden)
      },
    )

    it.each(malformedIds)(
      'rejects %s as the staff member for an actor of the salon, a staff member too, without looking anything up',
      async (_case, id) => {
        const dependencies = staffScheduleDependencies()

        const results = [
          await list(dependencies, {}, actors.ofSalon('manager'), id),
          await list(dependencies, {}, actors.ofSalon('staff'), id),
        ]

        expect(results.map(rulesOf)).toEqual([
          ['id:invalid_format'],
          ['id:invalid_format'],
        ])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('tells an actor who may not read the schedule nothing about the query', async () => {
      const results = [
        await list(
          staffScheduleDependencies(),
          { date: 'abc' },
          actors.customer,
        ),
        await list(
          staffScheduleDependencies(),
          { date: 'abc', limit: 5 },
          actors.ofSalon('staff'),
        ),
      ]

      expect(results).toEqual([forbidden, forbidden])
    })

    it.each([
      ['a date that is not one', { date: 'abc' }, ['date:invalid_format']],
      [
        'a date that does not exist',
        { date: '2026-02-30' },
        ['date:invalid_format'],
      ],
      ['an unknown parameter', { limit: 5 }, ['limit:unrecognized_keys']],
    ])(
      'rejects %s without looking anything up',
      async (_case, query, expected) => {
        const dependencies = staffScheduleDependencies()

        const result = await list(dependencies, query)

        expect(rulesOf(result)).toEqual(expected)
        expect(result).toMatchObject({
          error: { message: 'Invalid staff schedule search' },
        })
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('rejects the query of a staff member who reads their own schedule', async () => {
      const result = await list(
        staffScheduleDependencies(),
        { date: 'abc' },
        actors.ofSalon('staff'),
        STAFF_ID,
      )

      expect(rulesOf(result)).toEqual(['date:invalid_format'])
    })

    it('looks for the salon before it reads the schedule', async () => {
      const dependencies = staffScheduleDependencies()

      await list(dependencies)

      expect(repositoryCalls(dependencies)).toEqual([
        'salons.exists',
        'schedules.findByStaff',
      ])
    })

    it('answers 404 for a salon that does not exist, without reading the schedule', async () => {
      const dependencies = withoutSalon()

      const result = await list(dependencies)

      expect(result).toEqual(salonNotFound)
      expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
    })

    it('answers 404 for a staff member the salon does not have', async () => {
      const dependencies = staffScheduleDependencies({
        findByStaff: vi.fn(async () =>
          Result.success<DbStaffSchedule[] | null>(null),
        ),
      })

      const results = [
        await list(dependencies),
        await list(dependencies, { date: '2026-12-28' }),
      ]

      expect(results).toEqual([staffNotFound, staffNotFound])
    })
  })

  it('passes on the failure of looking for the salon', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await list(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on the failure of reading the schedule', async () => {
    const result = await list(
      staffScheduleDependencies({
        findByStaff: vi.fn(async () => databaseDown),
      }),
    )

    expect(result).toEqual(databaseDown)
  })
})

describe('UpdateStaffSchedulesUseCase', () => {
  const update = (
    dependencies: StaffScheduleUseCaseDependencies,
    input: unknown = [weeklyEntry()],
    actor: Actor = actors.admin,
    id: unknown = STAFF_MEMBER_ID,
    salon: unknown = SALON_ID,
  ) =>
    new UpdateStaffSchedulesUseCase(dependencies).execute(
      actor,
      salon,
      id,
      input,
    )

  it('replaces the schedule by the entries of the request and returns the rows that are stored, not the request', async () => {
    const dependencies = staffScheduleDependencies({
      replace: vi.fn(async () =>
        Result.success<DbStaffSchedule[] | null>([monday, thursday]),
      ),
    })
    const request = [
      singleDayEntry(),
      weeklyEntry({ startTime: '09:00', endTime: '18:00' }),
    ]

    const result = await update(dependencies, request)

    expect(result).toEqual({
      type: 'success',
      data: [weeklyEntry(), singleDayEntry()],
    })
    expect(dependencies.staffScheduleRepository.replace).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      request,
    )
  })

  it('replaces the schedule by nothing for an empty list', async () => {
    const dependencies = staffScheduleDependencies({
      replace: vi.fn(async () => Result.success<DbStaffSchedule[] | null>([])),
    })

    const result = await update(dependencies, [])

    expect(result).toEqual({ type: 'success', data: [] })
    expect(dependencies.staffScheduleRepository.replace).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      [],
    )
  })

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = staffScheduleDependencies()

    await update(
      dependencies,
      [],
      actors.admin,
      STAFF_MEMBER_ID.toUpperCase(),
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.staffScheduleRepository.replace).toHaveBeenCalledWith(
      SALON_ID,
      STAFF_MEMBER_ID,
      [],
    )
  })

  describe('who may replace', () => {
    it.each(planners)(
      'lets %s replace the schedule of any staff member of the salon, their own too',
      async (_who, actor) => {
        const results = [
          await update(staffScheduleDependencies(), [], actor),
          await update(staffScheduleDependencies(), [], actor, STAFF_ID),
        ]

        for (const result of results) {
          expect(result).toMatchObject({ type: 'success' })
        }
      },
    )

    it.each([
      ['their own schedule', STAFF_ID],
      ['the schedule of a colleague', STAFF_MEMBER_ID],
    ])(
      'refuses a staff member of the salon %s, without looking anything up',
      async (_whose, id) => {
        const dependencies = staffScheduleDependencies()

        const result = await update(
          dependencies,
          [],
          actors.ofSalon('staff'),
          id,
        )

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(outsiders)(
      'refuses %s without looking anything up',
      async (_who, actor) => {
        const dependencies = staffScheduleDependencies()

        const result = await update(dependencies, [], actor)

        expect(result).toEqual(forbidden)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )
  })

  describe('the order of the checks', () => {
    it.each(malformedIds)(
      'rejects %s as the salon before deciding who may',
      async (_case, salon) => {
        const dependencies = staffScheduleDependencies()

        const result = await update(
          dependencies,
          [],
          actors.customer,
          STAFF_MEMBER_ID,
          salon,
        )

        expect(rulesOf(result)).toEqual(['salonId:invalid_format'])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('tells an actor who may not replace the schedule nothing about the staff member or the request', async () => {
      const results = [
        await update(
          staffScheduleDependencies(),
          [],
          actors.ofSalon('staff'),
          'latest',
        ),
        await update(
          staffScheduleDependencies(),
          { schedules: [] },
          actors.ofSalon('staff'),
          STAFF_ID,
        ),
        await update(
          staffScheduleDependencies(),
          [weeklyEntry({ endTime: '08:00' })],
          actors.customer,
        ),
      ]

      expect(results).toEqual([forbidden, forbidden, forbidden])
    })

    it.each(malformedIds)(
      'rejects %s as the staff member before it reads the request',
      async (_case, id) => {
        const dependencies = staffScheduleDependencies()

        const result = await update(
          dependencies,
          { schedules: [] },
          actors.ofSalon('manager'),
          id,
        )

        expect(rulesOf(result)).toEqual(['id:invalid_format'])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each([
      ['a body that is not a list', { schedules: [] }, [':invalid_type']],
      ['a body of null', null, [':invalid_type']],
      [
        'an entry that breaks a rule',
        [
          weeklyEntry(),
          weeklyEntry({ dayOfWeek: 'tuesday', endTime: '08:00' }),
        ],
        ['1.endTime:custom', '1.breakEndTime:custom'],
      ],
      [
        'two entries for one day',
        [weeklyEntry(), weeklyEntry()],
        ['1.dayOfWeek:custom'],
      ],
      [
        'an entry with an unknown property',
        [{ ...weeklyEntry(), staffId: STAFF_MEMBER_ID }],
        ['0.staffId:unrecognized_keys'],
      ],
    ])(
      'rejects %s without looking anything up or writing anything',
      async (_case, input, expected) => {
        const dependencies = staffScheduleDependencies()

        const result = await update(dependencies, input)

        expect(rulesOf(result)).toEqual(expected)
        expect(result).toMatchObject({
          error: { message: 'Invalid staff schedule update' },
        })
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('looks for the salon before it replaces', async () => {
      const dependencies = staffScheduleDependencies()

      await update(dependencies)

      expect(repositoryCalls(dependencies)).toEqual([
        'salons.exists',
        'schedules.replace',
      ])
    })

    it('answers 404 for a salon that does not exist, without writing', async () => {
      const dependencies = withoutSalon()

      const result = await update(dependencies)

      expect(result).toEqual(salonNotFound)
      expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
    })

    it('answers 404 for a staff member the salon does not have', async () => {
      const result = await update(
        staffScheduleDependencies({
          replace: vi.fn(async () =>
            Result.success<DbStaffSchedule[] | null>(null),
          ),
        }),
      )

      expect(result).toEqual(staffNotFound)
    })
  })

  it('does not read the schedule: the rows of the response are those the replacement returns', async () => {
    const dependencies = staffScheduleDependencies()

    await update(dependencies)

    expect(
      dependencies.staffScheduleRepository.findByStaff,
    ).not.toHaveBeenCalled()
  })

  it('passes on the failure of looking for the salon', async () => {
    const dependencies = withFailingSalonLookup()

    const result = await update(dependencies)

    expect(result).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['salons.exists'])
  })

  it('passes on the failure of the replacement', async () => {
    const result = await update(
      staffScheduleDependencies({ replace: vi.fn(async () => databaseDown) }),
    )

    expect(result).toEqual(databaseDown)
  })
})
