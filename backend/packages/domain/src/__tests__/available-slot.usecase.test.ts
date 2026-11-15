import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  type AvailableSlotUseCaseDependencies,
  CheckAvailableSlotUseCase,
  ListAvailableSlotsUseCase,
} from '../business-logic/available-slot'
import type { Actor } from '../models/auth'
import type {
  SlotDay,
  SlotOccupancy,
} from '../repositories/available-slot.repository'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import {
  availableSlotDependencies,
  DATE,
  jst,
  STARTS_OF_DAY,
  serviceOfSlots,
  slotDay,
  slotOccupancy,
  staffOfDay,
  weeklyHours,
} from './available-slot-fixtures'
import { BOOKING_ID, CUT_ID, OTHER_BOOKING_ID } from './booking-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'
import { dbStaffSchedule } from './staff-schedule-fixtures'

const forbidden = Result.error(DomainErrors.forbidden())
const salonNotFound = {
  type: 'error',
  error: { type: 'notFound', entity: 'Salon', id: SALON_ID },
}
const databaseError = Result.error(
  DomainErrors.database('Failed to read', 'connection refused'),
)

/** Dependencies in which the repository reads this day. */
const withDay = (
  day: SlotDay | null,
  now?: Date,
): AvailableSlotUseCaseDependencies =>
  availableSlotDependencies(
    { findDay: vi.fn(async () => Result.success(day)) },
    {},
    now,
  )

/** Dependencies in which the repository reads this occupancy. */
const withOccupancy = (
  occupancy: Partial<SlotOccupancy>,
): AvailableSlotUseCaseDependencies =>
  availableSlotDependencies({
    findOccupancy: vi.fn(async () => Result.success(slotOccupancy(occupancy))),
  })

/** The rules a validation error reports, with its message. */
const refusalOf = (
  result: Result<unknown, DomainError>,
): { message: string; rules: string[] } | string =>
  result.type === 'error' && result.error.type === 'validation'
    ? { message: result.error.message, rules: brokenRules(result.error) }
    : result.type

const MILLISECONDS_OF_NINE_HOURS = 9 * 60 * 60 * 1000

/** The time the clocks of Tokyo show at a moment written in UTC (HH:mm). */
const inTokyo = (moment: string): string =>
  new Date(new Date(moment).getTime() + MILLISECONDS_OF_NINE_HOURS)
    .toISOString()
    .slice(11, 16)

const cursorAt = (time: string, staffId: string = STAFF_MEMBER_ID): string =>
  `${jst(time).toISOString()}_${staffId}`

describe('ListAvailableSlotsUseCase', () => {
  const searching = (more: Record<string, unknown> = {}) => ({
    serviceId: CUT_ID,
    date: DATE,
    ...more,
  })

  const list = (
    dependencies: AvailableSlotUseCaseDependencies,
    query: unknown = searching(),
    salon: unknown = SALON_ID,
  ) =>
    new ListAvailableSlotsUseCase(dependencies).execute(
      salon,
      Result.success(query),
    )

  /** When the slots of a page begin, as the clocks of Tokyo show it. */
  const startsOf = (
    result: Awaited<ReturnType<typeof list>>,
  ): string[] | string =>
    result.type === 'success'
      ? result.data.data.map(({ startTime }) => inTokyo(startTime))
      : result.type

  const metaOf = (result: Awaited<ReturnType<typeof list>>) =>
    result.type === 'success' ? result.data.meta : result.type

  it('returns the slots of the day with their times in UTC, on one page when they fit', async () => {
    const result = await list(availableSlotDependencies())

    expect(result).toEqual({
      type: 'success',
      data: {
        data: STARTS_OF_DAY.map((start) => ({
          staffId: STAFF_MEMBER_ID,
          startTime: jst(start).toISOString(),
          endTime: new Date(jst(start).getTime() + 3_600_000).toISOString(),
        })),
        meta: {
          total: 12,
          limit: 20,
          hasMore: false,
          cursor: null,
          nextCursor: null,
          prevCursor: null,
        },
      },
    })
  })

  it('asks the repository for the day of the salon, the service and every staff member', async () => {
    const dependencies = availableSlotDependencies()

    await list(dependencies)

    expect(dependencies.availableSlotRepository.findDay).toHaveBeenCalledWith({
      salonId: SALON_ID,
      serviceId: CUT_ID,
      staffId: null,
      date: DATE,
    })
    expect(dependencies.availableSlotRepository.findDay).toHaveBeenCalledTimes(
      1,
    )
    expect(dependencies.salonRepository.exists).not.toHaveBeenCalled()
  })

  it('asks the repository for the one staff member the search names', async () => {
    const dependencies = availableSlotDependencies()

    await list(dependencies, searching({ staffId: OTHER_STAFF_MEMBER_ID }))

    expect(dependencies.availableSlotRepository.findDay).toHaveBeenCalledWith({
      salonId: SALON_ID,
      serviceId: CUT_ID,
      staffId: OTHER_STAFF_MEMBER_ID,
      date: DATE,
    })
  })

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = availableSlotDependencies()

    await list(
      dependencies,
      searching({
        serviceId: CUT_ID.toUpperCase(),
        staffId: STAFF_MEMBER_ID.toUpperCase(),
      }),
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.availableSlotRepository.findDay).toHaveBeenCalledWith({
      salonId: SALON_ID,
      serviceId: CUT_ID,
      staffId: STAFF_MEMBER_ID,
      date: DATE,
    })
  })

  describe('the length of the treatment', () => {
    it('is the duration of the service when the search names none', async () => {
      const result = await list(
        withDay(slotDay({ service: serviceOfSlots({ duration: 120 }) })),
      )

      expect(startsOf(result)).toEqual([
        ...['10:00', '13:00', '13:30', '14:00'],
        ...['14:30', '15:00', '15:30', '16:00'],
      ])
      expect(result.type === 'success' ? result.data.data.at(0) : null).toEqual(
        {
          staffId: STAFF_MEMBER_ID,
          startTime: '2026-11-16T01:00:00.000Z',
          endTime: '2026-11-16T03:00:00.000Z',
        },
      )
    })

    it('is the duration the search names, whatever the service takes', async () => {
      const result = await list(
        withDay(slotDay({ service: serviceOfSlots({ duration: 120 }) })),
        searching({ duration: 300 }),
      )

      expect(result).toMatchObject({
        data: {
          data: [
            {
              startTime: '2026-11-16T04:00:00.000Z',
              endTime: '2026-11-16T09:00:00.000Z',
            },
          ],
          meta: { total: 1 },
        },
      })
    })
  })

  describe('what the day is read from', () => {
    it('reads the hours of the salon, its calendar, the bookings of the service and of the staff from the repository', async () => {
      const result = await list(
        withDay(
          slotDay({
            calendarDay: { openTime: '13:00:00', closeTime: '17:00:00' },
            staff: [
              staffOfDay({
                taken: [
                  {
                    bookingId: BOOKING_ID,
                    startTime: jst('14:00'),
                    endTime: jst('15:00'),
                  },
                ],
              }),
            ],
          }),
        ),
      )

      expect(startsOf(result)).toEqual(['13:00', '15:00', '15:30', '16:00'])
    })

    it('returns an empty page on a day the service is booked as often as it may be', async () => {
      const result = await list(
        withDay(
          slotDay({
            service: serviceOfSlots({ maxBookingsPerDay: 1 }),
            serviceLineStarts: [jst('15:00')],
          }),
        ),
      )

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

    it('returns an empty page in a salon that is not active: what a salon does not take is no error', async () => {
      const day = slotDay()
      const result = await list(
        withDay({ ...day, salon: { ...day.salon, isActive: false } }),
      )

      expect(startsOf(result)).toEqual([])
    })

    it('returns an empty page in a salon without staff, when the search names nobody', async () => {
      expect(startsOf(await list(withDay(slotDay({ staff: [] }))))).toEqual([])
    })

    it('returns an empty page in a salon that has said no hours', async () => {
      const day = slotDay()
      const result = await list(
        withDay({ ...day, salon: { ...day.salon, businessHours: null } }),
      )

      expect(startsOf(result)).toEqual([])
    })

    it('leaves out the slots that have begun by the clock', async () => {
      const result = await list(withDay(slotDay(), jst('15:45')))

      expect(startsOf(result)).toEqual(['16:00', '16:30', '17:00'])
    })

    it('reads the clock once for a search', async () => {
      const dependencies = availableSlotDependencies()
      const clock = vi.spyOn(dependencies, 'clock')

      await list(dependencies)

      expect(clock).toHaveBeenCalledTimes(1)
    })
  })

  describe('pages', () => {
    it('returns as many slots as the limit and the cursor of the last one', async () => {
      const result = await list(
        availableSlotDependencies(),
        searching({ limit: 5 }),
      )

      expect(startsOf(result)).toEqual([
        '10:00',
        '10:30',
        '11:00',
        '13:00',
        '13:30',
      ])
      expect(metaOf(result)).toEqual({
        total: 12,
        limit: 5,
        hasMore: true,
        cursor: null,
        nextCursor: `2026-11-16T04:30:00.000Z_${STAFF_MEMBER_ID}`,
        prevCursor: null,
      })
    })

    it('goes on after the slot of the cursor', async () => {
      const result = await list(
        availableSlotDependencies(),
        searching({ limit: 5, cursor: cursorAt('13:30') }),
      )

      expect(startsOf(result)).toEqual([
        '14:00',
        '14:30',
        '15:00',
        '15:30',
        '16:00',
      ])
      expect(metaOf(result)).toEqual({
        total: 12,
        limit: 5,
        hasMore: true,
        cursor: cursorAt('13:30'),
        nextCursor: cursorAt('16:00'),
        prevCursor: null,
      })
    })

    it('ends with the page that holds the last slot', async () => {
      const result = await list(
        availableSlotDependencies(),
        searching({ limit: 5, cursor: cursorAt('16:00') }),
      )

      expect(startsOf(result)).toEqual(['16:30', '17:00'])
      expect(metaOf(result)).toEqual({
        total: 12,
        limit: 5,
        hasMore: false,
        cursor: cursorAt('16:00'),
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('has no next page when the slots are exactly as many as the limit', async () => {
      const result = await list(
        availableSlotDependencies(),
        searching({ limit: 12 }),
      )

      expect(startsOf(result)).toHaveLength(12)
      expect(metaOf(result)).toMatchObject({ hasMore: false, nextCursor: null })
    })

    it('has a next page when the slots are one more than the limit', async () => {
      const result = await list(
        availableSlotDependencies(),
        searching({ limit: 11 }),
      )

      expect(startsOf(result)).toHaveLength(11)
      expect(metaOf(result)).toMatchObject({
        hasMore: true,
        nextCursor: cursorAt('16:30'),
      })
    })

    it('goes on after a cursor whose slot is no longer free', async () => {
      const result = await list(
        availableSlotDependencies(),
        searching({ cursor: cursorAt('12:15') }),
      )

      expect(startsOf(result)).toEqual(STARTS_OF_DAY.slice(3))
    })

    it('returns an empty page after the last slot, and still counts them all', async () => {
      const result = await list(
        availableSlotDependencies(),
        searching({ cursor: cursorAt('17:00') }),
      )

      expect(startsOf(result)).toEqual([])
      expect(metaOf(result)).toEqual({
        total: 12,
        limit: 20,
        hasMore: false,
        cursor: cursorAt('17:00'),
        nextCursor: null,
        prevCursor: null,
      })
    })

    it('goes on, among the slots that begin with the cursor, with the staff members after its own', async () => {
      const both = slotDay({
        staff: [
          staffOfDay(),
          staffOfDay({
            id: OTHER_STAFF_MEMBER_ID,
            schedules: [dbStaffSchedule({ staffId: OTHER_STAFF_MEMBER_ID })],
          }),
        ],
      })

      const afterFirst = await list(
        withDay(both),
        searching({ limit: 2, cursor: cursorAt('10:00') }),
      )
      const afterSecond = await list(
        withDay(both),
        searching({
          limit: 2,
          cursor: cursorAt('10:00', OTHER_STAFF_MEMBER_ID),
        }),
      )

      expect(afterFirst).toMatchObject({
        data: {
          data: [
            {
              staffId: OTHER_STAFF_MEMBER_ID,
              startTime: jst('10:00').toISOString(),
            },
            { staffId: STAFF_MEMBER_ID, startTime: jst('10:30').toISOString() },
          ],
          meta: { total: 24, nextCursor: cursorAt('10:30') },
        },
      })
      expect(afterSecond).toMatchObject({
        data: {
          data: [
            { staffId: STAFF_MEMBER_ID, startTime: jst('10:30').toISOString() },
            {
              staffId: OTHER_STAFF_MEMBER_ID,
              startTime: jst('10:30').toISOString(),
            },
          ],
          meta: { nextCursor: cursorAt('10:30', OTHER_STAFF_MEMBER_ID) },
        },
      })
    })
  })

  describe('what is refused', () => {
    it.each([
      ['a word', 'aoyama', 'salonId:invalid_format'],
      [
        'a UUID without its hyphens',
        SALON_ID.replaceAll('-', ''),
        'salonId:invalid_format',
      ],
      ['null', null, 'salonId:invalid_type'],
    ])(
      'refuses %s in place of the ID of the salon, before anything is read',
      async (_case, salon, rule) => {
        const dependencies = availableSlotDependencies()

        const result = await list(dependencies, searching(), salon)

        expect(refusalOf(result)).toMatchObject({ rules: [rule] })
        expect(
          dependencies.availableSlotRepository.findDay,
        ).not.toHaveBeenCalled()
      },
    )

    it('returns the refusal of the caller that decoded the query', async () => {
      const dependencies = availableSlotDependencies()
      const undecoded = Result.error(
        DomainErrors.validation('Invalid available slot search', [
          {
            field: 'limit',
            rule: 'invalid_format',
            message: 'Must be a number',
          },
        ]),
      )

      const result = await new ListAvailableSlotsUseCase(dependencies).execute(
        SALON_ID,
        undecoded,
      )

      expect(result).toEqual(undecoded)
      expect(
        dependencies.availableSlotRepository.findDay,
      ).not.toHaveBeenCalled()
    })

    it('looks at the path before the query', async () => {
      const result = await new ListAvailableSlotsUseCase(
        availableSlotDependencies(),
      ).execute(
        'aoyama',
        Result.error(
          DomainErrors.validation('Invalid available slot search', []),
        ),
      )

      expect(refusalOf(result)).toMatchObject({
        rules: ['salonId:invalid_format'],
      })
    })

    it('refuses a search that breaks the rules of the request, with every broken rule, before anything is read', async () => {
      const dependencies = availableSlotDependencies()

      const result = await list(dependencies, {
        date: '2026-02-30',
        limit: 0,
        sortBy: 'startTime',
      })

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot search',
        rules: [
          'limit:too_small',
          'serviceId:invalid_type',
          'date:invalid_format',
          'sortBy:unrecognized_keys',
        ],
      })
      expect(
        dependencies.availableSlotRepository.findDay,
      ).not.toHaveBeenCalled()
    })

    it('answers that the salon is not found when the repository finds none', async () => {
      expect(await list(withDay(null))).toEqual(salonNotFound)
    })

    it('refuses a service that is not the salon’s', async () => {
      const result = await list(withDay(slotDay({ service: null })))

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot search',
        rules: ['serviceId:not_found'],
      })
    })

    it('refuses a staff member that is not the salon’s', async () => {
      const result = await list(
        withDay(slotDay({ staff: [] })),
        searching({ staffId: STAFF_MEMBER_ID }),
      )

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot search',
        rules: ['staffId:not_found'],
      })
      expect(result).toMatchObject({
        error: {
          issues: [{ message: 'Must name a staff member of the salon' }],
        },
      })
    })

    it('refuses both at once', async () => {
      const result = await list(
        withDay(slotDay({ service: null, staff: [] })),
        searching({ staffId: STAFF_MEMBER_ID }),
      )

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot search',
        rules: ['staffId:not_found', 'serviceId:not_found'],
      })
      expect(result).toMatchObject({
        error: {
          issues: [
            { message: 'Must name a staff member of the salon' },
            { message: 'Must name a service of the salon' },
          ],
        },
      })
    })

    it('answers with a conflict for a salon whose time zone the runtime does not know', async () => {
      const day = slotDay()
      const result = await list(
        withDay({ ...day, salon: { ...day.salon, timezone: 'Mars/Olympus' } }),
      )

      expect(result).toEqual({
        type: 'error',
        error: {
          type: 'conflict',
          message:
            'The time zone of the salon is not one that is known, so the times of its hours cannot be told; correct the time zone of the salon first',
        },
      })
    })

    it('refuses what the search names wrongly before it says that the time zone is unknown', async () => {
      const day = slotDay({ service: null })
      const result = await list(
        withDay({ ...day, salon: { ...day.salon, timezone: 'Mars/Olympus' } }),
      )

      expect(refusalOf(result)).toMatchObject({
        rules: ['serviceId:not_found'],
      })
    })

    it.each([
      ['an entry of another shape', [{ dayOfWeek: 'monday' }]],
      [
        'an entry with a property the model does not have',
        [{ ...weeklyHours(), timezone: 'Asia/Tokyo' }],
      ],
      ['a value that is no list', { monday: '10:00-19:00' }],
    ])(
      'answers with a database error for stored weekly hours with %s',
      async (_case, businessHours) => {
        const day = slotDay()
        const result = await list(
          withDay({ ...day, salon: { ...day.salon, businessHours } }),
        )

        expect(result).toMatchObject({
          type: 'error',
          error: { type: 'database' },
        })
      },
    )

    it('returns the error of the repository', async () => {
      const result = await list(
        availableSlotDependencies({
          findDay: vi.fn(async () => databaseError),
        }),
      )

      expect(result).toEqual(databaseError)
    })
  })
})

describe('CheckAvailableSlotUseCase', () => {
  const asking = (more: Record<string, unknown> = {}) => ({
    staffId: STAFF_MEMBER_ID,
    serviceId: CUT_ID,
    startTime: jst('10:00').toISOString(),
    ...more,
  })

  const check = (
    dependencies: AvailableSlotUseCaseDependencies,
    body: unknown = asking(),
    actor: Actor = actors.admin,
    salon: unknown = SALON_ID,
  ) => new CheckAvailableSlotUseCase(dependencies).execute(actor, salon, body)

  const line = (bookingId: string, from: string, until: string) => ({
    bookingId,
    startTime: jst(from),
    endTime: jst(until),
  })

  it('says that a staff member nothing is booked for is free', async () => {
    expect(await check(availableSlotDependencies())).toEqual({
      type: 'success',
      data: { isAvailable: true, conflicts: [] },
    })
  })

  it('asks whether the salon exists and then for the occupancy of the staff member at the time', async () => {
    const dependencies = availableSlotDependencies()

    await check(dependencies)

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(
      dependencies.availableSlotRepository.findOccupancy,
    ).toHaveBeenCalledWith({
      salonId: SALON_ID,
      serviceId: CUT_ID,
      staffId: STAFF_MEMBER_ID,
      startTime: jst('10:00'),
    })
    expect(dependencies.availableSlotRepository.findDay).not.toHaveBeenCalled()
  })

  it('reads IDs written in upper case as the lower-case IDs', async () => {
    const dependencies = availableSlotDependencies()

    await check(
      dependencies,
      asking({
        staffId: STAFF_MEMBER_ID.toUpperCase(),
        serviceId: CUT_ID.toUpperCase(),
      }),
      actors.admin,
      SALON_ID.toUpperCase(),
    )

    expect(dependencies.salonRepository.exists).toHaveBeenCalledWith(SALON_ID)
    expect(
      dependencies.availableSlotRepository.findOccupancy,
    ).toHaveBeenCalledWith({
      salonId: SALON_ID,
      serviceId: CUT_ID,
      staffId: STAFF_MEMBER_ID,
      startTime: jst('10:00'),
    })
  })

  it('says that the staff member is not free during another booking, and names it', async () => {
    const result = await check(
      withOccupancy({ taken: [line(BOOKING_ID, '10:30', '11:30')] }),
    )

    expect(result).toEqual({
      type: 'success',
      data: { isAvailable: false, conflicts: [BOOKING_ID] },
    })
  })

  it('takes the time of the service for the wanted time', async () => {
    const taken = [line(BOOKING_ID, '10:30', '11:30')]

    expect(
      await check(withOccupancy({ service: { duration: 30 }, taken })),
    ).toEqual({ type: 'success', data: { isAvailable: true, conflicts: [] } })
    expect(
      await check(withOccupancy({ service: { duration: 31 }, taken })),
    ).toEqual({
      type: 'success',
      data: { isAvailable: false, conflicts: [BOOKING_ID] },
    })
  })

  it('counts the time the staff member keeps free around a booking', async () => {
    const staff = {
      bufferTimeBefore: 10,
      bufferTimeAfter: 20,
      maxConcurrentBookings: 1,
    }

    expect(
      await check(
        withOccupancy({ staff, taken: [line(BOOKING_ID, '11:30', '12:30')] }),
      ),
    ).toEqual({ type: 'success', data: { isAvailable: true, conflicts: [] } })
    expect(
      await check(
        withOccupancy({ staff, taken: [line(BOOKING_ID, '11:29', '12:30')] }),
      ),
    ).toEqual({
      type: 'success',
      data: { isAvailable: false, conflicts: [BOOKING_ID] },
    })
  })

  it('says that a staff member who takes two bookings at once is free beside one, and still names it', async () => {
    const result = await check(
      withOccupancy({
        staff: {
          bufferTimeBefore: 0,
          bufferTimeAfter: 0,
          maxConcurrentBookings: 2,
        },
        taken: [line(BOOKING_ID, '10:30', '11:30')],
      }),
    )

    expect(result).toEqual({
      type: 'success',
      data: { isAvailable: true, conflicts: [BOOKING_ID] },
    })
  })

  it('names the bookings in the way by when their lines begin, each once', async () => {
    const result = await check(
      withOccupancy({
        taken: [
          line(OTHER_BOOKING_ID, '10:45', '11:15'),
          line(BOOKING_ID, '10:15', '10:45'),
          line(OTHER_BOOKING_ID, '09:30', '10:15'),
        ],
      }),
    )

    expect(result).toEqual({
      type: 'success',
      data: { isAvailable: false, conflicts: [OTHER_BOOKING_ID, BOOKING_ID] },
    })
  })

  it('answers for a time that has passed: the ledger takes what is entered afterwards', async () => {
    const result = await check(
      availableSlotDependencies(),
      asking({ startTime: '2020-01-01T01:00:00.000Z' }),
    )

    expect(result).toEqual({
      type: 'success',
      data: { isAvailable: true, conflicts: [] },
    })
  })

  describe('who may ask', () => {
    const keepers: [string, Actor][] = [
      ['an administrator', actors.admin],
      ['the owner of the salon', actors.ofSalon('owner')],
      ['a manager of the salon', actors.ofSalon('manager')],
      ['a staff member of the salon', actors.ofSalon('staff')],
    ]
    it.each(keepers)('lets %s ask', async (_who, actor) => {
      const result = await check(availableSlotDependencies(), asking(), actor)

      expect(result.type).toBe('success')
    })

    const others: [string, Actor][] = [
      ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
      ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
      [
        'a staff member of another salon',
        actors.ofSalon('staff', OTHER_SALON_ID),
      ],
      ['a customer', actors.customer],
      ['a customer without a profile', actors.customerWithoutProfile],
      ['a user without a scope', actors.withoutScope],
    ]
    it.each(others)(
      'does not let %s ask, and reads nothing for them',
      async (_who, actor) => {
        const dependencies = availableSlotDependencies()

        const result = await check(dependencies, asking(), actor)

        expect(result).toEqual(forbidden)
        expect(dependencies.salonRepository.exists).not.toHaveBeenCalled()
        expect(
          dependencies.availableSlotRepository.findOccupancy,
        ).not.toHaveBeenCalled()
      },
    )

    it('refuses them before it reads the body', async () => {
      const result = await check(
        availableSlotDependencies(),
        { startTime: 'now' },
        actors.customer,
      )

      expect(result).toEqual(forbidden)
    })

    it('looks at the path before it asks who the actor is', async () => {
      const result = await check(
        availableSlotDependencies(),
        asking(),
        actors.customer,
        'aoyama',
      )

      expect(refusalOf(result)).toMatchObject({
        rules: ['salonId:invalid_format'],
      })
    })
  })

  describe('what is refused', () => {
    it('refuses a body that breaks the rules of the request, with every broken rule, before anything is read', async () => {
      const dependencies = availableSlotDependencies()

      const result = await check(dependencies, {
        staffId: 'hanako',
        startTime: '2026-11-16T01:00:30Z',
        duration: 60,
      })

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot check',
        rules: [
          'staffId:invalid_format',
          'serviceId:invalid_type',
          'startTime:custom',
          'duration:unrecognized_keys',
        ],
      })
      expect(dependencies.salonRepository.exists).not.toHaveBeenCalled()
      expect(
        dependencies.availableSlotRepository.findOccupancy,
      ).not.toHaveBeenCalled()
    })

    it('answers that the salon is not found, and does not read its ledger', async () => {
      const dependencies = availableSlotDependencies(
        {},
        { exists: vi.fn(async () => Result.success(false)) },
      )

      const result = await check(dependencies)

      expect(result).toEqual(salonNotFound)
      expect(
        dependencies.availableSlotRepository.findOccupancy,
      ).not.toHaveBeenCalled()
    })

    it('refuses a service that is not the salon’s', async () => {
      const result = await check(withOccupancy({ service: null }))

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot check',
        rules: ['serviceId:not_found'],
      })
    })

    it('refuses a staff member that is not the salon’s', async () => {
      const result = await check(withOccupancy({ staff: null }))

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot check',
        rules: ['staffId:not_found'],
      })
    })

    it('refuses both at once', async () => {
      const result = await check(withOccupancy({ staff: null, service: null }))

      expect(refusalOf(result)).toEqual({
        message: 'Invalid available slot check',
        rules: ['staffId:not_found', 'serviceId:not_found'],
      })
      expect(result).toMatchObject({
        error: {
          issues: [
            { message: 'Must name a staff member of the salon' },
            { message: 'Must name a service of the salon' },
          ],
        },
      })
    })

    it('returns the error of the salon repository', async () => {
      const result = await check(
        availableSlotDependencies(
          {},
          { exists: vi.fn(async () => databaseError) },
        ),
      )

      expect(result).toEqual(databaseError)
    })

    it('returns the error of the repository', async () => {
      const result = await check(
        availableSlotDependencies({
          findOccupancy: vi.fn(async () => databaseError),
        }),
      )

      expect(result).toEqual(databaseError)
    })
  })
})
