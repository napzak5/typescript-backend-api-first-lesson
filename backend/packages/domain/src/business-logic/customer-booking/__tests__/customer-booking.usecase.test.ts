import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  NOW,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import { jst } from '../../../__tests__/fixtures/available-slot-fixtures'
import {
  BOOKING_ID,
  BOOKING_NUMBER,
  bookingWithServices,
  CUT_ID,
  OTHER_BOOKING_ID,
  bookingRepositoryCalls as repositoryCalls,
} from '../../../__tests__/fixtures/booking-fixtures'
import {
  apiCustomerBooking,
  databaseDown,
  customerBookingDependencies as dependenciesWith,
} from '../../../__tests__/fixtures/customer-booking-fixtures'
import { brokenRules, SALON_ID } from '../../../__tests__/fixtures/fixtures'
import { STAFF_MEMBER_ID } from '../../../__tests__/fixtures/staff-fixtures'
import type { Actor, ClientInfo } from '../../../models/auth'
import type {
  BookingStatusChange,
  CustomerBookingCreation,
  CustomerBookingReschedule,
  IBookingRepository,
} from '../../../repositories/booking.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CancelCustomerBookingUseCase,
  CreateCustomerBookingUseCase,
  type CustomerBookingUseCaseDependencies,
  GetCustomerBookingUseCase,
  ListCustomerBookingsUseCase,
  RescheduleCustomerBookingUseCase,
} from '..'

const forbidden = Result.error(DomainErrors.forbidden())
const profileNotFound = Result.error(
  DomainErrors.notFound('Customer profile of user', USER_ID),
)
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
    ? result.error.message
    : null

/** The message of a conflict; null for anything else. */
const conflictOf = (result: Result<unknown, DomainError>): string | null =>
  result.type === 'error' && result.error.type === 'conflict'
    ? result.error.message
    : null

const client: ClientInfo = {
  ipAddress: '203.0.113.7',
  userAgent: 'SalonApp/1.0',
}

/** Those who keep a ledger, and an account that reaches nothing. */
const notCustomers: [string, Actor][] = [
  ['an admin', actors.admin],
  ['the owner of a salon', actors.ofSalon('owner')],
  ['the manager of a salon', actors.ofSalon('manager')],
  ['the staff of a salon', actors.ofSalon('staff')],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

const ownBookings = { type: 'customer', customerId: CUSTOMER_ID }

/** A body that satisfies every rule: the cut at ten in Tokyo on the 16th. */
const wanting = (overrides: Record<string, unknown> = {}) => ({
  salonId: SALON_ID,
  serviceId: CUT_ID,
  staffId: STAFF_MEMBER_ID,
  startTime: '2026-11-16T01:00:00Z',
  customerRequest: '前回と同じ長さで',
  ...overrides,
})

/** Runs every use case as an actor with a request nothing is right about. */
const everyUseCaseAs = async (
  actor: Actor,
  dependencies: CustomerBookingUseCaseDependencies,
) => [
  await new ListCustomerBookingsUseCase(dependencies).execute(
    actor,
    Result.success({ limit: 0 }),
  ),
  await new CreateCustomerBookingUseCase(dependencies).execute(
    actor,
    { nothing: 'right' },
    client,
  ),
  await new GetCustomerBookingUseCase(dependencies).execute(actor, 'haircut'),
  await new CancelCustomerBookingUseCase(dependencies).execute(
    actor,
    'haircut',
    { nothing: 'right' },
  ),
  await new RescheduleCustomerBookingUseCase(dependencies).execute(
    actor,
    'haircut',
    { nothing: 'right' },
  ),
]

describe('who has bookings of their own', () => {
  it.each(notCustomers)(
    'refuses %s before anything is looked at, whatever they ask for',
    async (_name, actor) => {
      const dependencies = dependenciesWith()

      const results = await everyUseCaseAs(actor, dependencies)

      expect(results).toEqual([
        forbidden,
        forbidden,
        forbidden,
        forbidden,
        forbidden,
      ])
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('answers a customer account without a profile as its profile is answered, before anything is looked at', async () => {
    const dependencies = dependenciesWith()

    const results = await everyUseCaseAs(
      actors.customerWithoutProfile,
      dependencies,
    )

    expect(results).toEqual([
      profileNotFound,
      profileNotFound,
      profileNotFound,
      profileNotFound,
      profileNotFound,
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('looks at what a customer with a profile asks for', async () => {
    const dependencies = dependenciesWith()

    const results = await everyUseCaseAs(actors.customer, dependencies)

    expect(results.map(rulesOf)).toEqual([
      ['limit:too_small'],
      expect.arrayContaining(['salonId:invalid_type']),
      [expect.stringMatching(/^id:/)],
      [expect.stringMatching(/^id:/)],
      [expect.stringMatching(/^id:/)],
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })
})

describe('ListCustomerBookingsUseCase', () => {
  const list = (
    query: unknown = {},
    overrides: Partial<IBookingRepository> = {},
  ) => {
    const dependencies = dependenciesWith(overrides)
    return {
      dependencies,
      result: new ListCustomerBookingsUseCase(dependencies).execute(
        actors.customer,
        Result.success(query),
      ),
    }
  }

  it('lists the bookings of the customer as they are shown them, with the page', async () => {
    const { result, dependencies } = list()

    expect(await result).toStrictEqual({
      type: 'success',
      data: {
        data: [apiCustomerBooking()],
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
    expect(dependencies.bookingRepository.list).toHaveBeenCalledExactlyOnceWith(
      {
        reach: ownBookings,
        limit: 20,
        after: null,
        salonId: null,
        customerId: null,
        staffId: null,
        status: null,
        bookingDateFrom: null,
        bookingDateTo: null,
      },
    )
  })

  it('hands the conditions of the search to the repository', async () => {
    const { result, dependencies } = list({
      limit: 5,
      cursor: OTHER_BOOKING_ID,
      status: 'confirmed',
      bookingDateFrom: '2026-11-01',
      bookingDateTo: '2026-11-30',
    })

    await result

    expect(dependencies.bookingRepository.list).toHaveBeenCalledExactlyOnceWith(
      {
        reach: ownBookings,
        limit: 5,
        after: OTHER_BOOKING_ID,
        salonId: null,
        customerId: null,
        staffId: null,
        status: 'confirmed',
        bookingDateFrom: '2026-11-01',
        bookingDateTo: '2026-11-30',
      },
    )
  })

  it('names the last booking of a page that another follows as the cursor of the next', async () => {
    const page = {
      bookings: [
        bookingWithServices({ id: OTHER_BOOKING_ID }),
        bookingWithServices(),
      ],
      total: 7,
      hasMore: true,
    }
    const { result } = list(
      { limit: 2, cursor: OTHER_BOOKING_ID },
      { list: vi.fn(async () => Result.success(page)) },
    )

    expect(await result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: OTHER_BOOKING_ID }, { id: BOOKING_ID }],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: OTHER_BOOKING_ID,
          nextCursor: BOOKING_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next cursor on the last page, and none on an empty one', async () => {
    const last = list(
      {},
      {
        list: vi.fn(async () =>
          Result.success({
            bookings: [bookingWithServices()],
            total: 1,
            hasMore: false,
          }),
        ),
      },
    )
    const empty = list(
      {},
      {
        list: vi.fn(async () =>
          Result.success({ bookings: [], total: 0, hasMore: false }),
        ),
      },
    )

    expect(await last.result).toMatchObject({
      data: { meta: { nextCursor: null } },
    })
    expect(await empty.result).toMatchObject({
      data: { data: [], meta: { total: 0, nextCursor: null } },
    })
  })

  it.each<[string, Record<string, unknown>, string[]]>([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a cursor that is no ID', { cursor: 'first' }, ['cursor:invalid_format']],
    ['a status there is not', { status: 'waiting' }, ['status:invalid_value']],
    [
      'a last day before the first',
      { bookingDateFrom: '2026-11-02', bookingDateTo: '2026-11-01' },
      ['bookingDateTo:custom'],
    ],
    ['a salon', { salonId: SALON_ID }, ['salonId:unrecognized_keys']],
    [
      'a customer',
      { customerId: CUSTOMER_ID },
      ['customerId:unrecognized_keys'],
    ],
    [
      'a staff member',
      { staffId: STAFF_MEMBER_ID },
      ['staffId:unrecognized_keys'],
    ],
  ])(
    'refuses a search with %s, and does not ask the repository',
    async (_case, query, rules) => {
      const { result, dependencies } = list(query)

      expect(rulesOf(await result)).toEqual(rules)
      expect(validationMessageOf(await result)).toBe('Invalid booking search')
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('answers with the error of a query the caller could not decode, once the account is known to have bookings', async () => {
    const undecodable = Result.error(
      DomainErrors.validation('Invalid booking search', [
        { field: 'limit', rule: 'invalid_format', message: 'Must be a number' },
      ]),
    )
    const dependencies = dependenciesWith()
    const useCase = new ListCustomerBookingsUseCase(dependencies)

    expect(await useCase.execute(actors.customer, undecodable)).toEqual(
      undecodable,
    )
    expect(await useCase.execute(actors.admin, undecodable)).toEqual(forbidden)
    expect(
      await useCase.execute(actors.customerWithoutProfile, undecodable),
    ).toEqual(profileNotFound)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a cursor that names no booking of the customer', async () => {
    const { result } = list(
      { cursor: OTHER_BOOKING_ID },
      { list: vi.fn(async () => Result.success(null)) },
    )

    expect(await result).toEqual(
      Result.error(
        DomainErrors.validation('Invalid booking search', [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'Must name a booking',
          },
        ]),
      ),
    )
  })

  it('answers with the error of the repository', async () => {
    const { result } = list({}, { list: vi.fn(async () => databaseDown) })

    expect(await result).toEqual(databaseDown)
  })

  it('answers a stored booking that does not match the model with a database error', async () => {
    const { result } = list(
      {},
      {
        list: vi.fn(async () =>
          Result.success({
            bookings: [bookingWithServices({ startTime: 'tomorrow' })],
            total: 1,
            hasMore: false,
          }),
        ),
      },
    )

    expect(await result).toEqual(storedRowIsCorrupt)
  })
})

describe('GetCustomerBookingUseCase', () => {
  const get = (id: unknown, overrides: Partial<IBookingRepository> = {}) => {
    const dependencies = dependenciesWith(overrides)
    return {
      dependencies,
      result: new GetCustomerBookingUseCase(dependencies).execute(
        actors.customer,
        id,
      ),
    }
  }

  it('returns the booking as the customer is shown it, looked for among their own', async () => {
    const { result, dependencies } = get(BOOKING_ID)

    expect(await result).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking(),
    })
    expect(
      dependencies.bookingRepository.findById,
    ).toHaveBeenCalledExactlyOnceWith(BOOKING_ID, ownBookings)
  })

  it.each([
    ['a word', 'haircut'],
    ['a number', 42],
    ['nothing', undefined],
  ])(
    'refuses %s for an ID, and does not ask the repository',
    async (_case, id) => {
      const { result, dependencies } = get(id)

      expect(rulesOf(await result)).toEqual([expect.stringMatching(/^id:/)])
      expect(validationMessageOf(await result)).toBe('Invalid booking ID')
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it('answers a booking that is not among those of the customer as one that was not found', async () => {
    const { result } = get(BOOKING_ID, {
      findById: vi.fn(async () => Result.success(null)),
    })

    expect(await result).toEqual(
      Result.error(DomainErrors.notFound('Booking', BOOKING_ID)),
    )
  })

  it('answers with the error of the repository', async () => {
    const { result } = get(BOOKING_ID, {
      findById: vi.fn(async () => databaseDown),
    })

    expect(await result).toEqual(databaseDown)
  })

  it('answers a stored booking that does not match the model with a database error', async () => {
    const { result } = get(BOOKING_ID, {
      findById: vi.fn(async () =>
        Result.success(bookingWithServices({ startTime: 'tomorrow' })),
      ),
    })

    expect(await result).toEqual(storedRowIsCorrupt)
  })
})

describe('CreateCustomerBookingUseCase', () => {
  const book = (
    body: unknown = wanting(),
    overrides: Partial<IBookingRepository> = {},
    numbers: string[] = [],
    now: () => Date = () => NOW,
  ) => {
    const dependencies = dependenciesWith(overrides, numbers, now)
    return {
      dependencies,
      result: new CreateCustomerBookingUseCase(dependencies).execute(
        actors.customer,
        body,
        client,
      ),
    }
  }

  const answering = (creation: CustomerBookingCreation) => ({
    book: vi.fn(async () => Result.success(creation)),
  })

  it('books for the customer of the account at the moment the clock shows, and returns the booking as they are shown it', async () => {
    const { result, dependencies } = book()

    expect(await result).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking(),
    })
    expect(dependencies.bookingRepository.book).toHaveBeenCalledExactlyOnceWith(
      {
        salonId: SALON_ID,
        serviceId: CUT_ID,
        staffId: STAFF_MEMBER_ID,
        startTime: '2026-11-16T01:00:00.000Z',
        customerRequest: '前回と同じ長さで',
      },
      { customerId: CUSTOMER_ID, now: NOW },
      { bookingNumber: BOOKING_NUMBER, createdBy: USER_ID, client },
    )
    expect(repositoryCalls(dependencies)).toEqual(['book'])
  })

  it.each<[string, unknown, string[]]>([
    [
      'without a salon',
      wanting({ salonId: undefined }),
      ['salonId:invalid_type'],
    ],
    [
      'with a time that is no time',
      wanting({ startTime: 'ten' }),
      ['startTime:invalid_format'],
    ],
    [
      'with a time with seconds',
      wanting({ startTime: '2026-11-16T01:00:30Z' }),
      ['startTime:custom'],
    ],
    [
      'with a blank request',
      wanting({ customerRequest: ' ' }),
      ['customerRequest:invalid_format'],
    ],
    [
      'with a customer',
      wanting({ customerId: CUSTOMER_ID }),
      ['customerId:unrecognized_keys'],
    ],
    [
      'with what the salon notes',
      wanting({ internalNotes: 'VIP' }),
      ['internalNotes:unrecognized_keys'],
    ],
    ['that is null', null, [':invalid_type']],
  ])(
    'refuses a request %s, and does not ask the repository',
    async (_case, body, rules) => {
      const { result, dependencies } = book(body)

      expect(rulesOf(await result)).toEqual(rules)
      expect(validationMessageOf(await result)).toBe('Invalid booking')
      expect(repositoryCalls(dependencies)).toEqual([])
      expect(dependencies.bookingNumberIssuer.issue).not.toHaveBeenCalled()
    },
  )

  it('answers a customer who is not there any more as an account without a profile', async () => {
    const { result } = book(wanting(), answering({ type: 'profileNotFound' }))

    expect(await result).toEqual(profileNotFound)
  })

  it('reports what the request refers to and is not there', async () => {
    const issues = [
      {
        field: 'serviceId',
        rule: 'not_found',
        message: 'Must name a service of the salon',
      },
    ]
    const { result } = book(wanting(), answering({ type: 'invalid', issues }))

    expect(await result).toEqual(
      Result.error(DomainErrors.validation('Invalid booking', issues)),
    )
  })

  it.each<[CustomerBookingCreation, string]>([
    [
      { type: 'timeZoneUnknown' },
      'The time zone of the salon is not one that is known, so the times of its hours cannot be told; correct the time zone of the salon first',
    ],
    [
      { type: 'customerNotAccepted' },
      'This customer profile does not take bookings online; contact the salon to book',
    ],
    [
      { type: 'notASlot' },
      'The staff member has no available slot for the service at that time; choose one of the available slots of the salon',
    ],
    [
      { type: 'customerOccupied' },
      'The customer has another booking at that time; cancel it first or choose another time',
    ],
  ])(
    'answers $type with a conflict that says what stands in the way',
    async (creation, message) => {
      const { result } = book(wanting(), answering(creation))

      expect(conflictOf(await result)).toBe(message)
    },
  )

  it('does not tell the customer what the salons noted of them', async () => {
    const { result } = book(
      wanting(),
      answering({ type: 'customerNotAccepted' }),
    )

    expect(JSON.stringify(await result)).not.toMatch(
      /blacklist|inactive|status/i,
    )
  })

  it('answers hours of the salon that cannot be read with the error they were read with', async () => {
    const error = DomainErrors.database('Stored salon does not match', null)
    const { result } = book(
      wanting(),
      answering({ type: 'hoursUnreadable', error }),
    )

    expect(await result).toEqual(Result.error(error))
  })

  it('tries another number when a booking has the one it issued, at the moment the clock shows then', async () => {
    const later = new Date(NOW.getTime() + 1000)
    const moments = [NOW, later]
    const taken = vi
      .fn<IBookingRepository['book']>()
      .mockResolvedValueOnce(Result.success({ type: 'bookingNumberTaken' }))
      .mockResolvedValueOnce(
        Result.success({ type: 'created', booking: bookingWithServices() }),
      )

    const { result, dependencies } = book(
      wanting(),
      { book: taken },
      ['BK-0000-0001', 'BK-0000-0002'],
      () => moments.shift() ?? later,
    )

    expect((await result).type).toBe('success')
    expect(
      taken.mock.calls.map(([, booker, origin]) => [
        origin.bookingNumber,
        booker.now,
      ]),
    ).toEqual([
      ['BK-0000-0001', NOW],
      ['BK-0000-0002', later],
    ])
    expect(dependencies.bookingNumberIssuer.issue).toHaveBeenCalledTimes(2)
  })

  it('gives up after three numbers that are taken', async () => {
    const { result, dependencies } = book(
      wanting(),
      answering({ type: 'bookingNumberTaken' }),
    )

    expect(await result).toEqual(
      Result.error(
        DomainErrors.database(
          'No booking number that is free was found in 3 attempts',
          null,
        ),
      ),
    )
    expect(dependencies.bookingRepository.book).toHaveBeenCalledTimes(3)
  })

  it('does not try another number after a refusal or an error', async () => {
    const refused = book(wanting(), answering({ type: 'notASlot' }))
    const failed = book(wanting(), { book: vi.fn(async () => databaseDown) })

    expect((await refused.result).type).toBe('error')
    expect(await failed.result).toEqual(databaseDown)
    expect(refused.dependencies.bookingRepository.book).toHaveBeenCalledTimes(1)
    expect(failed.dependencies.bookingRepository.book).toHaveBeenCalledTimes(1)
  })

  it('answers a stored booking that does not match the model with a database error', async () => {
    const { result } = book(
      wanting(),
      answering({
        type: 'created',
        booking: bookingWithServices({ startTime: 'tomorrow' }),
      }),
    )

    expect(await result).toEqual(storedRowIsCorrupt)
  })

  it('takes the time in whatever spelling of the moment and hands it on in one', async () => {
    const { result, dependencies } = book(
      wanting({ startTime: jst('13:30').toISOString().replace('.000Z', 'Z') }),
    )

    await result

    expect(dependencies.bookingRepository.book).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: '2026-11-16T04:30:00.000Z' }),
      expect.anything(),
      expect.anything(),
    )
  })
})

describe('CancelCustomerBookingUseCase', () => {
  const cancel = (
    id: unknown = BOOKING_ID,
    body: unknown = { cancellationReason: '都合が悪くなった' },
    overrides: Partial<IBookingRepository> = {},
  ) => {
    const dependencies = dependenciesWith(overrides)
    return {
      dependencies,
      result: new CancelCustomerBookingUseCase(dependencies).execute(
        actors.customer,
        id,
        body,
      ),
    }
  }

  const answering = (change: BookingStatusChange) => ({
    changeStatus: vi.fn(async () => Result.success(change)),
  })

  it('cancels the booking as the customer among their own, and returns it as they are shown it', async () => {
    const { result, dependencies } = cancel()

    expect(await result).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking(),
    })
    expect(
      dependencies.bookingRepository.changeStatus,
    ).toHaveBeenCalledExactlyOnceWith(
      BOOKING_ID,
      ownBookings,
      { type: 'cancelAsCustomer', cancellationReason: '都合が悪くなった' },
      USER_ID,
    )
    expect(repositoryCalls(dependencies)).toEqual(['changeStatus'])
  })

  it('takes no reason', async () => {
    const { result, dependencies } = cancel(BOOKING_ID, {
      cancellationReason: null,
    })

    expect((await result).type).toBe('success')
    expect(dependencies.bookingRepository.changeStatus).toHaveBeenCalledWith(
      BOOKING_ID,
      ownBookings,
      { type: 'cancelAsCustomer', cancellationReason: null },
      USER_ID,
    )
  })

  it('looks at the ID before the request, and at both before it asks the repository', async () => {
    const both = cancel('haircut', { reason: 'none' })
    const request = cancel(BOOKING_ID, { reason: 'none' })

    expect(rulesOf(await both.result)).toEqual([expect.stringMatching(/^id:/)])
    expect(validationMessageOf(await both.result)).toBe('Invalid booking ID')
    expect(rulesOf(await request.result)).toEqual([
      'cancellationReason:invalid_type',
      'reason:unrecognized_keys',
    ])
    expect(validationMessageOf(await request.result)).toBe(
      'Invalid booking cancellation',
    )
    expect(repositoryCalls(both.dependencies)).toEqual([])
    expect(repositoryCalls(request.dependencies)).toEqual([])
  })

  it.each<[string, unknown, string[]]>([
    [
      'a blank reason',
      { cancellationReason: '  ' },
      ['cancellationReason:invalid_format'],
    ],
    [
      'a fee',
      { cancellationReason: null, cancellationFee: 0 },
      ['cancellationFee:unrecognized_keys'],
    ],
    ['null for a body', null, [':invalid_type']],
  ])('refuses a request with %s', async (_case, body, rules) => {
    const { result, dependencies } = cancel(BOOKING_ID, body)

    expect(rulesOf(await result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers a booking that is not among those of the customer as one that was not found', async () => {
    const { result } = cancel(
      BOOKING_ID,
      { cancellationReason: null },
      answering({ type: 'notFound' }),
    )

    expect(await result).toEqual(
      Result.error(DomainErrors.notFound('Booking', BOOKING_ID)),
    )
  })

  it.each<[BookingStatusChange, string]>([
    [
      {
        type: 'statusDoesNotAllow',
        action: 'cancelAsCustomer',
        status: 'completed',
        allowed: ['draft', 'pending', 'confirmed'],
      },
      'A booking that is completed cannot be cancelled; its status has to be draft or pending or confirmed',
    ],
    [
      { type: 'alreadyBegun' },
      'The time of the booking has come, so the customer cannot cancel it any more; the salon notes what became of the visit',
    ],
    [
      { type: 'notBegunYet' },
      'The booking has not begun yet, so nobody failed to come to it; a booking that will not take place is cancelled',
    ],
    [
      { type: 'actualTimesOutOfOrder' },
      'The actual end has to be after the actual start, and one of the two is a time the booking already has; send both times',
    ],
  ])('answers $type with a conflict that says why', async (change, message) => {
    const { result } = cancel(
      BOOKING_ID,
      { cancellationReason: null },
      answering(change),
    )

    expect(conflictOf(await result)).toBe(message)
  })

  it('answers with the error of the repository', async () => {
    const { result } = cancel(
      BOOKING_ID,
      { cancellationReason: null },
      { changeStatus: vi.fn(async () => databaseDown) },
    )

    expect(await result).toEqual(databaseDown)
  })

  it('answers a stored booking that does not match the model with a database error', async () => {
    const { result } = cancel(
      BOOKING_ID,
      { cancellationReason: null },
      answering({
        type: 'changed',
        booking: bookingWithServices({ startTime: 'tomorrow' }),
      }),
    )

    expect(await result).toEqual(storedRowIsCorrupt)
  })
})

describe('RescheduleCustomerBookingUseCase', () => {
  /** A body that satisfies every rule: two in the afternoon in Tokyo on the 16th. */
  const to = (overrides: Record<string, unknown> = {}) => ({
    startTime: '2026-11-16T05:00:00Z',
    staffId: STAFF_MEMBER_ID,
    ...overrides,
  })

  const reschedule = (
    id: unknown = BOOKING_ID,
    body: unknown = to(),
    overrides: Partial<IBookingRepository> = {},
    now: () => Date = () => NOW,
  ) => {
    const dependencies = dependenciesWith(overrides, [], now)
    return {
      dependencies,
      result: new RescheduleCustomerBookingUseCase(dependencies).execute(
        actors.customer,
        id,
        body,
      ),
    }
  }

  const answering = (rebooked: CustomerBookingReschedule) => ({
    rebook: vi.fn(async () => Result.success(rebooked)),
  })

  it('moves the booking as the customer among their own, at the moment the clock shows, and returns it as they are shown it', async () => {
    const moment = jst('09:15')
    const { result, dependencies } = reschedule(
      BOOKING_ID,
      to(),
      {},
      () => moment,
    )

    expect(await result).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking(),
    })
    expect(
      dependencies.bookingRepository.rebook,
    ).toHaveBeenCalledExactlyOnceWith(
      BOOKING_ID,
      ownBookings,
      { startTime: '2026-11-16T05:00:00.000Z', staffId: STAFF_MEMBER_ID },
      { changedBy: USER_ID, now: moment },
    )
    expect(repositoryCalls(dependencies)).toEqual(['rebook'])
  })

  it('returns a booking that is where the request wants it already, as it is', async () => {
    const booking = bookingWithServices({ status: 'confirmed' })
    const { result } = reschedule(
      BOOKING_ID,
      to(),
      answering({ type: 'unchanged', booking }),
    )

    expect(await result).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking({ status: 'confirmed' }),
    })
  })

  it('looks at the ID before the request, and at both before it asks the repository', async () => {
    const both = reschedule('haircut', { time: 'later' })
    const request = reschedule(BOOKING_ID, { time: 'later' })

    expect(rulesOf(await both.result)).toEqual([expect.stringMatching(/^id:/)])
    expect(validationMessageOf(await both.result)).toBe('Invalid booking ID')
    expect(rulesOf(await request.result)).toEqual([
      'startTime:invalid_type',
      'staffId:invalid_type',
      'time:unrecognized_keys',
    ])
    expect(validationMessageOf(await request.result)).toBe(
      'Invalid booking reschedule',
    )
    expect(repositoryCalls(both.dependencies)).toEqual([])
    expect(repositoryCalls(request.dependencies)).toEqual([])
    expect(both.dependencies.clock).not.toHaveBeenCalled()
  })

  it.each<[string, unknown, string[]]>([
    [
      'a time with seconds',
      to({ startTime: '2026-11-16T05:00:30Z' }),
      ['startTime:custom'],
    ],
    [
      'a time that is not in UTC',
      to({ startTime: '2026-11-16T14:00:00+09:00' }),
      ['startTime:invalid_format'],
    ],
    [
      'a staff member that is no ID',
      to({ staffId: 'the usual one' }),
      ['staffId:invalid_format'],
    ],
    ['a service', to({ serviceId: CUT_ID }), ['serviceId:unrecognized_keys']],
    ['null for a body', null, [':invalid_type']],
  ])('refuses a request with %s', async (_case, body, rules) => {
    const { result, dependencies } = reschedule(BOOKING_ID, body)

    expect(rulesOf(await result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('answers a booking that is not among those of the customer as one that was not found', async () => {
    const { result } = reschedule(
      BOOKING_ID,
      to(),
      answering({ type: 'notFound' }),
    )

    expect(await result).toEqual(
      Result.error(DomainErrors.notFound('Booking', BOOKING_ID)),
    )
  })

  it.each<[CustomerBookingReschedule, string]>([
    [
      {
        type: 'statusDoesNotAllow',
        status: 'in_progress',
        allowed: ['draft', 'pending', 'confirmed'],
      },
      'A booking that is in_progress cannot be rescheduled; its status has to be draft or pending or confirmed',
    ],
    [
      { type: 'alreadyBegun' },
      'The time of the booking has come, so the customer cannot move it any more; the salon notes what became of the visit',
    ],
    [
      { type: 'notOneSlot' },
      'The booking has several services, or a service with another staff member than the one in charge, so the customer cannot move it; contact the salon to move it',
    ],
    [
      { type: 'timeZoneUnknown' },
      'The time zone of the salon is not one that is known, so the times of its hours cannot be told; correct the time zone of the salon first',
    ],
    [
      { type: 'customerNotAccepted' },
      'This customer profile does not take bookings online; contact the salon to book',
    ],
    [
      { type: 'notASlot' },
      'The staff member has no available slot for the service at that time; choose one of the available slots of the salon',
    ],
    [
      { type: 'customerOccupied' },
      'The customer has another booking at that time; cancel it first or choose another time',
    ],
  ])(
    'answers $type with a conflict that says what stands in the way',
    async (rebooked, message) => {
      const { result } = reschedule(BOOKING_ID, to(), answering(rebooked))

      expect(conflictOf(await result)).toBe(message)
    },
  )

  it('reports a staff member who is not one of the salon as a rule of the request', async () => {
    const { result } = reschedule(
      BOOKING_ID,
      to(),
      answering({
        type: 'invalid',
        issues: [
          {
            field: 'staffId',
            rule: 'not_found',
            message: 'Must name a staff member of the salon',
          },
        ],
      }),
    )

    expect(rulesOf(await result)).toEqual(['staffId:not_found'])
    expect(validationMessageOf(await result)).toBe('Invalid booking reschedule')
  })

  it('answers a customer who was deleted as an account without a profile', async () => {
    const { result } = reschedule(
      BOOKING_ID,
      to(),
      answering({ type: 'profileNotFound' }),
    )

    expect(await result).toEqual(profileNotFound)
  })

  it('answers hours of the salon that cannot be read with the error they were read with', async () => {
    const error = DomainErrors.database('Stored salon does not match', null)
    const { result } = reschedule(
      BOOKING_ID,
      to(),
      answering({ type: 'hoursUnreadable', error }),
    )

    expect(await result).toEqual(Result.error(error))
  })

  it('answers with the error of the repository', async () => {
    const { result } = reschedule(BOOKING_ID, to(), {
      rebook: vi.fn(async () => databaseDown),
    })

    expect(await result).toEqual(databaseDown)
  })

  it('answers a stored booking that does not match the model with a database error', async () => {
    const { result } = reschedule(
      BOOKING_ID,
      to(),
      answering({
        type: 'rescheduled',
        booking: bookingWithServices({ startTime: 'tomorrow' }),
      }),
    )

    expect(await result).toEqual(storedRowIsCorrupt)
  })
})
