import { Result } from '@beauty-salon-backend/utility'
import {
  bookingMessages,
  entityMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiBooking,
  BOOKING_ID,
  BOOKING_NUMBER,
  bookingCreateRequest,
  bookingDependencies,
  bookingWithServices,
  OTHER_BOOKING_ID,
  bookingRepositoryCalls as repositoryCalls,
} from '../../../__tests__/fixtures/booking-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import type { Actor, ClientInfo } from '../../../models/auth'
import type {
  BookingCreation,
  IBookingRepository,
} from '../../../repositories/booking.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  type BookingUseCaseDependencies,
  CreateBookingUseCase,
  GetBookingUseCase,
  ListBookingsUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const storedRowIsCorrupt = {
  type: 'error',
  error: expect.objectContaining({ type: 'database' }),
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

/** A booking whose start cannot be turned into a response. */
const corruptBooking = bookingWithServices({ startTime: 'tomorrow' })

const client: ClientInfo = {
  ipAddress: '203.0.113.7',
  userAgent: 'SalonApp/1.0',
}

/** Those who keep the ledger of the salon of the fixtures. */
const keepers: [string, Actor][] = [
  ['an admin', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['the manager of the salon', actors.ofSalon('manager')],
  ['the staff of the salon', actors.ofSalon('staff')],
]

/** The members of another salon than the one of the fixtures. */
const membersOfAnotherSalon: [string, Actor][] = [
  ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
  ['the manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
  ['the staff of another salon', actors.ofSalon('staff', OTHER_SALON_ID)],
]

/** Those the ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

const everySalon = { type: 'everySalon' }
const ownSalon = { type: 'salon', salonId: SALON_ID }

describe('CreateBookingUseCase', () => {
  const create = (
    dependencies: BookingUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    input: unknown = bookingCreateRequest(),
    from: ClientInfo = client,
  ) => new CreateBookingUseCase(dependencies).execute(actor, input, from)

  const creating = (
    ...outcomes: BookingCreation[]
  ): Partial<IBookingRepository> => {
    const upcoming = [...outcomes]
    const last = outcomes.at(-1)

    return {
      create: vi.fn(async () =>
        Result.success<BookingCreation>(
          upcoming.shift() ??
            last ?? { type: 'created', booking: bookingWithServices() },
        ),
      ),
    }
  }

  const taken: BookingCreation = { type: 'bookingNumberTaken' }
  const created: BookingCreation = {
    type: 'created',
    booking: bookingWithServices(),
  }

  it('enters the booking and returns it', async () => {
    const dependencies = bookingDependencies()

    const result = await create(dependencies)

    expect(result).toEqual({ type: 'success', data: apiBooking() })
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })

  it('hands the request on with its times in one spelling, and how the booking came to be', async () => {
    const dependencies = bookingDependencies()
    const request = bookingCreateRequest()

    await create(dependencies)

    expect(dependencies.bookingRepository.create).toHaveBeenCalledWith(
      {
        ...request,
        services: [
          { ...request.services[0], startTime: '2026-11-20T01:00:00.000Z' },
          { ...request.services[1], startTime: '2026-11-20T02:00:00.000Z' },
        ],
      },
      { bookingNumber: BOOKING_NUMBER, createdBy: USER_ID, client },
    )
  })

  it('hands on that nothing is known of where the request came from', async () => {
    const dependencies = bookingDependencies()
    const unknown = { ipAddress: null, userAgent: null }

    await create(dependencies, actors.admin, bookingCreateRequest(), unknown)

    expect(dependencies.bookingRepository.create).toHaveBeenCalledWith(
      expect.anything(),
      { bookingNumber: BOOKING_NUMBER, createdBy: USER_ID, client: unknown },
    )
  })

  it.each(keepers)(
    'lets %s enter a booking of the salon',
    async (_case, actor) => {
      const result = await create(bookingDependencies(), actor)

      expect(result.type).toBe('success')
    },
  )

  it('lets an admin enter a booking of any salon', async () => {
    const dependencies = bookingDependencies()

    const result = await create(dependencies, actors.admin, {
      ...bookingCreateRequest(),
      salonId: OTHER_SALON_ID,
    })

    expect(result.type).toBe('success')
    expect(dependencies.bookingRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: OTHER_SALON_ID }),
      expect.anything(),
    )
  })

  it.each(notKeepers)(
    'refuses %s without reading the request',
    async (_case, actor) => {
      const dependencies = bookingDependencies()

      expect(await create(dependencies, actor)).toEqual(forbidden)
      expect(await create(dependencies, actor, { salonId: 'x' })).toEqual(
        forbidden,
      )
      expect(await create(dependencies, actor, null)).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
      expect(dependencies.bookingNumberIssuer.issue).not.toHaveBeenCalled()
    },
  )

  it('does not let a customer enter a booking of their own', async () => {
    const dependencies = bookingDependencies()

    const result = await create(dependencies, actors.customer, {
      ...bookingCreateRequest(),
      customerId: CUSTOMER_ID,
    })

    expect(result).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each(membersOfAnotherSalon)(
    'refuses %s once the request says which salon it is for',
    async (_case, actor) => {
      const dependencies = bookingDependencies()

      expect(await create(dependencies, actor)).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
      expect(dependencies.bookingNumberIssuer.issue).not.toHaveBeenCalled()
    },
  )

  it('tells a member of another salon what is wrong with a request before refusing it', async () => {
    const dependencies = bookingDependencies()

    const result = await create(
      dependencies,
      actors.ofSalon('owner', OTHER_SALON_ID),
      { ...bookingCreateRequest(), depositAmount: -1 },
    )

    expect(rulesOf(result)).toEqual(['depositAmount:too_small'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a request that breaks a rule of its own without writing anything', async () => {
    const dependencies = bookingDependencies()

    const result = await create(dependencies, actors.admin, {
      ...bookingCreateRequest(),
      services: [],
      status: 'confirmed',
    })

    expect(validationMessageOf(result)).toBe('Invalid booking')
    expect(rulesOf(result).toSorted()).toEqual([
      'services:too_small',
      'status:unrecognized_keys',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
    expect(dependencies.bookingNumberIssuer.issue).not.toHaveBeenCalled()
  })

  it.each([
    ['null', null],
    ['a list', []],
    ['a text', 'booking'],
  ])('refuses %s for a request', async (_case, input) => {
    const result = await create(bookingDependencies(), actors.admin, input)

    expect(rulesOf(result)).toEqual([':invalid_type'])
  })

  it('reports what the request refers to and is not there', async () => {
    const issues = [
      {
        field: 'customerId',
        rule: 'not_found',
        message: ruleMessages.aCustomer,
      },
      {
        field: 'services.0.serviceId',
        rule: 'not_found',
        message: ruleMessages.aServiceOfSalon,
      },
    ]
    const dependencies = bookingDependencies(
      creating({ type: 'invalid', issues }),
    )

    const result = await create(dependencies)

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: bookingMessages.invalidBooking,
        issues,
      },
    })
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })

  it('reports a staff member who is occupied as a conflict that names them', async () => {
    const result = await create(
      bookingDependencies(
        creating({ type: 'staffOccupied', staffIds: [STAFF_MEMBER_ID] }),
      ),
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: `Other bookings occupy staff member ${STAFF_MEMBER_ID} at a time of this booking`,
      },
    })
  })

  it('names every staff member who is occupied', async () => {
    const result = await create(
      bookingDependencies(
        creating({
          type: 'staffOccupied',
          staffIds: [STAFF_MEMBER_ID, OTHER_STAFF_MEMBER_ID],
        }),
      ),
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message: `Other bookings occupy staff members ${STAFF_MEMBER_ID}, ${OTHER_STAFF_MEMBER_ID} at a time of this booking`,
      },
    })
  })

  it('reports a salon whose time zone is not known as a conflict: the request is not at fault', async () => {
    const result = await create(
      bookingDependencies(creating({ type: 'timeZoneUnknown' })),
    )

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'conflict',
        message:
          'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first',
      },
    })
  })

  it('does not try again after a refusal that another number would not change', async () => {
    const refusals: BookingCreation[] = [
      { type: 'invalid', issues: [] },
      { type: 'staffOccupied', staffIds: [STAFF_MEMBER_ID] },
      { type: 'timeZoneUnknown' },
    ]

    for (const refusal of refusals) {
      const dependencies = bookingDependencies(creating(refusal))

      await create(dependencies)

      expect(repositoryCalls(dependencies)).toEqual(['create'])
      expect(dependencies.bookingNumberIssuer.issue).toHaveBeenCalledTimes(1)
    }
  })

  it('tries another number when a booking has the one that was issued', async () => {
    const dependencies = bookingDependencies(creating(taken, created), [
      'BK-0000-0001',
      'BK-0000-0002',
    ])

    const result = await create(dependencies)

    expect(result).toEqual({ type: 'success', data: apiBooking() })
    expect(
      vi
        .mocked(dependencies.bookingRepository.create)
        .mock.calls.map(([, origin]) => origin.bookingNumber),
    ).toEqual(['BK-0000-0001', 'BK-0000-0002'])
  })

  it('tries a third number', async () => {
    const dependencies = bookingDependencies(creating(taken, taken, created))

    const result = await create(dependencies)

    expect(result.type).toBe('success')
    expect(repositoryCalls(dependencies)).toEqual([
      'create',
      'create',
      'create',
    ])
    expect(dependencies.bookingNumberIssuer.issue).toHaveBeenCalledTimes(3)
  })

  it('gives up after three numbers that were all taken', async () => {
    const dependencies = bookingDependencies(creating(taken))

    const result = await create(dependencies)

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: 'No booking number that is free was found in 3 attempts',
        cause: null,
      },
    })
    expect(repositoryCalls(dependencies)).toEqual([
      'create',
      'create',
      'create',
    ])
  })

  it('reports a failure of the database and does not try again', async () => {
    const dependencies = bookingDependencies({
      create: vi.fn(async () => databaseDown),
    })

    expect(await create(dependencies)).toEqual(databaseDown)
    expect(repositoryCalls(dependencies)).toEqual(['create'])
  })

  it('reports a booking that was written and cannot be presented as a fault of the database', async () => {
    const result = await create(
      bookingDependencies(
        creating({ type: 'created', booking: corruptBooking }),
      ),
    )

    expect(result).toEqual(storedRowIsCorrupt)
  })
})

describe('GetBookingUseCase', () => {
  const get = (
    dependencies: BookingUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    id: unknown = BOOKING_ID,
  ) => new GetBookingUseCase(dependencies).execute(actor, id)

  it('returns the booking with its service lines', async () => {
    const dependencies = bookingDependencies()

    const result = await get(dependencies)

    expect(result).toEqual({ type: 'success', data: apiBooking() })
    expect(repositoryCalls(dependencies)).toEqual(['findById'])
  })

  it('looks an admin up the booking among those of every salon', async () => {
    const dependencies = bookingDependencies()

    await get(dependencies, actors.admin)

    expect(dependencies.bookingRepository.findById).toHaveBeenCalledWith(
      BOOKING_ID,
      everySalon,
    )
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])(
    'looks %s of a salon up the booking among those of that salon',
    async (_case, actor) => {
      const dependencies = bookingDependencies()

      await get(dependencies, actor)

      expect(dependencies.bookingRepository.findById).toHaveBeenCalledWith(
        BOOKING_ID,
        ownSalon,
      )
    },
  )

  it.each(membersOfAnotherSalon)(
    'looks %s up the booking among those of their own salon',
    async (_case, actor) => {
      const dependencies = bookingDependencies()

      await get(dependencies, actor)

      expect(dependencies.bookingRepository.findById).toHaveBeenCalledWith(
        BOOKING_ID,
        { type: 'salon', salonId: OTHER_SALON_ID },
      )
    },
  )

  it.each(notKeepers)(
    'refuses %s without looking anything up, whatever the ID',
    async (_case, actor) => {
      const dependencies = bookingDependencies()

      expect(await get(dependencies, actor)).toEqual(forbidden)
      expect(await get(dependencies, actor, 'not-an-id')).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a booking number', BOOKING_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without looking anything up', async (_case, id) => {
    const dependencies = bookingDependencies()

    const result = await new GetBookingUseCase(dependencies).execute(
      actors.admin,
      id,
    )

    expect(validationMessageOf(result)).toBe('Invalid booking ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result)[0]).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a booking the actor does not reach as one that does not exist', async () => {
    const dependencies = bookingDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    expect(await get(dependencies)).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.booking, BOOKING_ID)),
    )
  })

  it('looks the booking up, and names the one that is not there, by the ID in lower case', async () => {
    const dependencies = bookingDependencies({
      findById: vi.fn(async () => Result.success(null)),
    })

    const result = await get(
      dependencies,
      actors.admin,
      BOOKING_ID.toUpperCase(),
    )

    expect(dependencies.bookingRepository.findById).toHaveBeenCalledWith(
      BOOKING_ID,
      { type: 'everySalon' },
    )
    expect(result).toEqual(
      Result.error(DomainErrors.notFound(entityMessages.booking, BOOKING_ID)),
    )
  })

  it('reports a failure of the database', async () => {
    const dependencies = bookingDependencies({
      findById: vi.fn(async () => databaseDown),
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored booking that cannot be presented as a fault of the database', async () => {
    const dependencies = bookingDependencies({
      findById: vi.fn(async () => Result.success(corruptBooking)),
    })

    expect(await get(dependencies)).toEqual(storedRowIsCorrupt)
  })
})

describe('ListBookingsUseCase', () => {
  const list = (
    dependencies: BookingUseCaseDependencies,
    actor: Actor = actors.ofSalon('staff'),
    query: unknown = {},
  ) =>
    new ListBookingsUseCase(dependencies).execute(actor, Result.success(query))

  const noConditions = {
    limit: 20,
    after: null,
    salonId: null,
    customerId: null,
    staffId: null,
    status: null,
    bookingDateFrom: null,
    bookingDateTo: null,
  }

  const listing = (
    bookings = [bookingWithServices()],
    total = bookings.length,
    hasMore = false,
  ): Partial<IBookingRepository> => ({
    list: vi.fn(async () => Result.success({ bookings, total, hasMore })),
  })

  it('returns a page of bookings and where it stands', async () => {
    const dependencies = bookingDependencies()

    const result = await list(dependencies)

    expect(result).toEqual({
      type: 'success',
      data: {
        data: [apiBooking()],
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
    expect(repositoryCalls(dependencies)).toEqual(['list'])
  })

  it('lists an admin the bookings of every salon, twenty to a page', async () => {
    const dependencies = bookingDependencies()

    await list(dependencies, actors.admin)

    expect(dependencies.bookingRepository.list).toHaveBeenCalledWith({
      reach: everySalon,
      ...noConditions,
    })
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])('lists %s of a salon the bookings of that salon', async (_case, actor) => {
    const dependencies = bookingDependencies()

    await list(dependencies, actor)

    expect(dependencies.bookingRepository.list).toHaveBeenCalledWith({
      reach: ownSalon,
      ...noConditions,
    })
  })

  it('hands every condition of the search on', async () => {
    const dependencies = bookingDependencies()

    await list(dependencies, actors.admin, {
      limit: 50,
      cursor: OTHER_BOOKING_ID,
      salonId: OTHER_SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_MEMBER_ID,
      status: 'confirmed',
      bookingDateFrom: '2026-11-01',
      bookingDateTo: '2026-11-30',
    })

    expect(dependencies.bookingRepository.list).toHaveBeenCalledWith({
      reach: everySalon,
      limit: 50,
      after: OTHER_BOOKING_ID,
      salonId: OTHER_SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_MEMBER_ID,
      status: 'confirmed',
      bookingDateFrom: '2026-11-01',
      bookingDateTo: '2026-11-30',
    })
  })

  it('lets a member of a salon name their own salon', async () => {
    const dependencies = bookingDependencies()

    const result = await list(dependencies, actors.ofSalon('manager'), {
      salonId: SALON_ID,
    })

    expect(result.type).toBe('success')
    expect(dependencies.bookingRepository.list).toHaveBeenCalledWith({
      reach: ownSalon,
      ...noConditions,
      salonId: SALON_ID,
    })
  })

  it.each([
    ['the owner', actors.ofSalon('owner')],
    ['the manager', actors.ofSalon('manager')],
    ['the staff', actors.ofSalon('staff')],
  ])('refuses %s of a salon who names another salon', async (_case, actor) => {
    const dependencies = bookingDependencies()

    expect(
      await list(dependencies, actor, { salonId: OTHER_SALON_ID }),
    ).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('tells a member of a salon what is wrong with a search before refusing another salon', async () => {
    const dependencies = bookingDependencies()

    const result = await list(dependencies, actors.ofSalon('owner'), {
      salonId: OTHER_SALON_ID,
      limit: 0,
    })

    expect(rulesOf(result)).toEqual(['limit:too_small'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each(notKeepers)(
    'refuses %s without looking at the search',
    async (_case, actor) => {
      const dependencies = bookingDependencies()
      const undecodable = Result.error(
        DomainErrors.validation(bookingMessages.invalidBookingSearch, []),
      )

      expect(await list(dependencies, actor)).toEqual(forbidden)
      expect(await list(dependencies, actor, { limit: 0 })).toEqual(forbidden)
      expect(
        await new ListBookingsUseCase(dependencies).execute(actor, undecodable),
      ).toEqual(forbidden)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('does not list a customer their own bookings through the ledger', async () => {
    const dependencies = bookingDependencies()

    expect(
      await list(dependencies, actors.customer, { customerId: CUSTOMER_ID }),
    ).toEqual(forbidden)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('reports a search that could not be decoded as the caller found it', async () => {
    const dependencies = bookingDependencies()
    const undecodable = Result.error(
      DomainErrors.validation(bookingMessages.invalidBookingSearch, [
        { field: 'limit', rule: 'invalid_type', message: MADE_UP_MESSAGE },
      ]),
    )

    expect(
      await new ListBookingsUseCase(dependencies).execute(
        actors.admin,
        undecodable,
      ),
    ).toEqual(undecodable)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a search that breaks a rule without listing anything', async () => {
    const dependencies = bookingDependencies()

    const result = await list(dependencies, actors.admin, {
      status: 'done',
      search: 'yamada',
    })

    expect(validationMessageOf(result)).toBe('Invalid booking search')
    expect(rulesOf(result).toSorted()).toEqual([
      'search:unrecognized_keys',
      'status:invalid_value',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses days in the wrong order without listing anything', async () => {
    const dependencies = bookingDependencies()

    const result = await list(dependencies, actors.admin, {
      bookingDateFrom: '2026-11-20',
      bookingDateTo: '2026-11-19',
    })

    expect(rulesOf(result)).toEqual(['bookingDateTo:custom'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a cursor that names no booking the actor reaches', async () => {
    const dependencies = bookingDependencies({
      list: vi.fn(async () => Result.success(null)),
    })

    const result = await list(dependencies, actors.admin, {
      cursor: OTHER_BOOKING_ID,
    })

    expect(result).toEqual({
      type: 'error',
      error: {
        type: 'validation',
        message: bookingMessages.invalidBookingSearch,
        issues: [
          {
            field: 'cursor',
            rule: 'not_found',
            message: bookingMessages.aBooking,
          },
        ],
      },
    })
  })

  it('names the last booking of a page as the cursor of the next one', async () => {
    const dependencies = bookingDependencies(
      listing(
        [bookingWithServices(), bookingWithServices({ id: OTHER_BOOKING_ID })],
        5,
        true,
      ),
    )

    const result = await list(dependencies, actors.admin, {
      limit: 2,
      cursor: BOOKING_ID,
    })

    expect(result).toMatchObject({
      type: 'success',
      data: {
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: BOOKING_ID,
          nextCursor: OTHER_BOOKING_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor on the last page', async () => {
    const result = await list(
      bookingDependencies(listing([bookingWithServices()], 3, false)),
      actors.admin,
      { cursor: OTHER_BOOKING_ID },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { meta: { total: 3, hasMore: false, nextCursor: null } },
    })
  })

  it('returns an empty page when nothing matches', async () => {
    const result = await list(bookingDependencies(listing([])))

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

  it('reports a failure of the database', async () => {
    const dependencies = bookingDependencies({
      list: vi.fn(async () => databaseDown),
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('reports a stored booking that cannot be presented as a fault of the database', async () => {
    const result = await list(bookingDependencies(listing([corruptBooking])))

    expect(result).toEqual(storedRowIsCorrupt)
  })
})
