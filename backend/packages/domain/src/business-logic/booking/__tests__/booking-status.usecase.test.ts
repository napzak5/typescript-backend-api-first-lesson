import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import { actors, USER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiBooking,
  BOOKING_ID,
  BOOKING_NUMBER,
  bookingDependencies,
  bookingWithServices,
  bookingRepositoryCalls as repositoryCalls,
} from '../../../__tests__/fixtures/booking-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import type { Actor } from '../../../models/auth'
import type { ApiBookingResponse } from '../../../models/booking'
import type {
  BookingStatusChange,
  IBookingRepository,
} from '../../../repositories/booking.repository'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  type BookingAction,
  type BookingUseCaseDependencies,
  CancelBookingUseCase,
  CompleteBookingUseCase,
  ConfirmBookingUseCase,
  NoShowBookingUseCase,
  StartBookingUseCase,
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
    ? result.error.message
    : null

/** Those who keep the ledger of the salon of the fixtures. */
const keepers: [string, Actor, { type: string; salonId?: string }][] = [
  ['an admin', actors.admin, { type: 'everySalon' }],
  [
    'the owner of the salon',
    actors.ofSalon('owner'),
    { type: 'salon', salonId: SALON_ID },
  ],
  [
    'the manager of the salon',
    actors.ofSalon('manager'),
    { type: 'salon', salonId: SALON_ID },
  ],
  [
    'the staff of the salon',
    actors.ofSalon('staff'),
    { type: 'salon', salonId: SALON_ID },
  ],
  [
    'the owner of another salon',
    actors.ofSalon('owner', OTHER_SALON_ID),
    { type: 'salon', salonId: OTHER_SALON_ID },
  ],
  [
    'the manager of another salon',
    actors.ofSalon('manager', OTHER_SALON_ID),
    { type: 'salon', salonId: OTHER_SALON_ID },
  ],
  [
    'the staff of another salon',
    actors.ofSalon('staff', OTHER_SALON_ID),
    { type: 'salon', salonId: OTHER_SALON_ID },
  ],
]

/** Those the ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

type Take = (
  dependencies: BookingUseCaseDependencies,
  actor: Actor,
  id: unknown,
  input: unknown,
) => Promise<Result<ApiBookingResponse, DomainError>>

const confirm: Take = (dependencies, actor, id) =>
  new ConfirmBookingUseCase(dependencies).execute(actor, id)
const cancel: Take = (dependencies, actor, id, input) =>
  new CancelBookingUseCase(dependencies).execute(actor, id, input)
const start: Take = (dependencies, actor, id) =>
  new StartBookingUseCase(dependencies).execute(actor, id)
const complete: Take = (dependencies, actor, id, input) =>
  new CompleteBookingUseCase(dependencies).execute(actor, id, input)
const noShow: Take = (dependencies, actor, id) =>
  new NoShowBookingUseCase(dependencies).execute(actor, id)

const cancelRequest = { cancellationReason: 'お客様のご都合' }
const completeRequest = {
  actualStartTime: '2026-11-20T01:05:00Z',
  actualEndTime: '2026-11-20T03:20:30Z',
}

/**
 * Each action: how it is taken, a request that keeps its rules, and what the
 * repository is asked to do for that request.
 */
const ACTIONS: [string, Take, unknown, BookingAction][] = [
  ['confirm', confirm, undefined, { type: 'confirm' }],
  ['cancel', cancel, cancelRequest, { type: 'cancel', ...cancelRequest }],
  ['start', start, undefined, { type: 'start' }],
  [
    'complete',
    complete,
    completeRequest,
    {
      type: 'complete',
      actualStartTime: '2026-11-20T01:05:00.000Z',
      actualEndTime: '2026-11-20T03:20:30.000Z',
    },
  ],
  ['noShow', noShow, undefined, { type: 'noShow' }],
]

/** The actions that read a request, with what a failed validation is called. */
const WITH_A_REQUEST: [string, Take, Record<string, unknown>, string][] = [
  ['cancel', cancel, cancelRequest, 'Invalid booking cancellation'],
  ['complete', complete, completeRequest, 'Invalid booking completion'],
]

/** A repository that answers every action with this outcome. */
const answering = (
  outcome: BookingStatusChange,
): Partial<IBookingRepository> => ({
  changeStatus: vi.fn(async () => Result.success(outcome)),
})

const staff = actors.ofSalon('staff')

describe.each(ACTIONS)('the use case of %s', (_name, take, request, action) => {
  it('changes the status and returns the booking as it is then', async () => {
    const dependencies = bookingDependencies(
      answering({
        type: 'changed',
        booking: bookingWithServices({ status: 'confirmed' }),
      }),
    )

    const result = await take(dependencies, staff, BOOKING_ID, request)

    expect(result).toEqual({
      type: 'success',
      data: apiBooking({ status: 'confirmed' }),
    })
    expect(repositoryCalls(dependencies)).toEqual(['changeStatus'])
  })

  it.each(keepers)(
    'says for %s which booking, among which bookings, what to do and who does it',
    async (_case, actor, reach) => {
      const dependencies = bookingDependencies()

      await take(dependencies, actor, BOOKING_ID, request)

      expect(dependencies.bookingRepository.changeStatus).toHaveBeenCalledWith(
        BOOKING_ID,
        reach,
        action,
        USER_ID,
      )
    },
  )

  it.each(notKeepers)(
    'refuses %s without reading the ID or the request',
    async (_case, actor) => {
      const dependencies = bookingDependencies()

      expect(await take(dependencies, actor, BOOKING_ID, request)).toEqual(
        forbidden,
      )
      expect(await take(dependencies, actor, 'not-an-id', request)).toEqual(
        forbidden,
      )
      expect(await take(dependencies, actor, BOOKING_ID, { x: 1 })).toEqual(
        forbidden,
      )
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['a booking number', BOOKING_NUMBER],
    ['nothing', undefined],
  ])('refuses %s for the ID without changing anything', async (_case, id) => {
    const dependencies = bookingDependencies()

    const result = await take(dependencies, actors.admin, id, request)

    expect(validationMessageOf(result)).toBe('Invalid booking ID')
    expect(rulesOf(result)).toHaveLength(1)
    expect(rulesOf(result)[0]).toMatch(/^id:/)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('finds the booking, and names the one that is not there, by the ID in lower case', async () => {
    const dependencies = bookingDependencies(answering({ type: 'notFound' }))

    const result = await take(
      dependencies,
      actors.admin,
      BOOKING_ID.toUpperCase(),
      request,
    )

    expect(dependencies.bookingRepository.changeStatus).toHaveBeenCalledWith(
      BOOKING_ID,
      { type: 'everySalon' },
      action,
      USER_ID,
    )
    expect(result).toEqual(
      Result.error(DomainErrors.notFound('Booking', BOOKING_ID)),
    )
  })

  it('reports a booking the actor does not reach as one that does not exist', async () => {
    const dependencies = bookingDependencies(answering({ type: 'notFound' }))

    expect(await take(dependencies, staff, BOOKING_ID, request)).toEqual(
      Result.error(DomainErrors.notFound('Booking', BOOKING_ID)),
    )
  })

  it('reports a booking that has not begun as a conflict that says what to do instead', async () => {
    const dependencies = bookingDependencies(answering({ type: 'notBegunYet' }))

    expect(await take(dependencies, staff, BOOKING_ID, request)).toEqual(
      Result.error(
        DomainErrors.conflict(
          'The booking has not begun yet, so nobody failed to come to it; a booking that will not take place is cancelled',
        ),
      ),
    )
  })

  it('reports actual times that are out of order with those the booking has as a conflict', async () => {
    const dependencies = bookingDependencies(
      answering({ type: 'actualTimesOutOfOrder' }),
    )

    expect(await take(dependencies, staff, BOOKING_ID, request)).toEqual(
      Result.error(
        DomainErrors.conflict(
          'The actual end has to be after the actual start, and one of the two is a time the booking already has; send both times',
        ),
      ),
    )
  })

  it('reports a failure of the database', async () => {
    const dependencies = bookingDependencies({
      changeStatus: vi.fn(async () => databaseDown),
    })

    expect(await take(dependencies, staff, BOOKING_ID, request)).toEqual(
      databaseDown,
    )
  })

  it('reports a booking that was changed and cannot be presented as a fault of the database', async () => {
    const dependencies = bookingDependencies(
      answering({
        type: 'changed',
        booking: bookingWithServices({ startTime: 'tomorrow' }),
      }),
    )

    expect(await take(dependencies, staff, BOOKING_ID, request)).toEqual(
      storedRowIsCorrupt,
    )
  })
})

describe('a status that does not allow the action', () => {
  it.each<[string, Take, unknown, BookingStatusChange, string]>([
    [
      'confirm',
      confirm,
      undefined,
      {
        type: 'statusDoesNotAllow',
        action: 'confirm',
        status: 'completed',
        allowed: ['draft', 'pending'],
      },
      'A booking that is completed cannot be confirmed; its status has to be draft or pending',
    ],
    [
      'cancel',
      cancel,
      cancelRequest,
      {
        type: 'statusDoesNotAllow',
        action: 'cancel',
        status: 'in_progress',
        allowed: ['draft', 'pending', 'confirmed'],
      },
      'A booking that is in_progress cannot be cancelled; its status has to be draft or pending or confirmed',
    ],
    [
      'start',
      start,
      undefined,
      {
        type: 'statusDoesNotAllow',
        action: 'start',
        status: 'pending',
        allowed: ['confirmed'],
      },
      'A booking that is pending cannot be started; its status has to be confirmed',
    ],
    [
      'complete',
      complete,
      completeRequest,
      {
        type: 'statusDoesNotAllow',
        action: 'complete',
        status: 'cancelled',
        allowed: ['confirmed', 'in_progress'],
      },
      'A booking that is cancelled cannot be completed; its status has to be confirmed or in_progress',
    ],
    [
      'noShow',
      noShow,
      undefined,
      {
        type: 'statusDoesNotAllow',
        action: 'noShow',
        status: 'no_show',
        allowed: ['pending', 'confirmed'],
      },
      'A booking that is no_show cannot be noted as one the customer did not come to; its status has to be pending or confirmed',
    ],
  ])(
    'is reported for %s as a conflict that names the status and those the action leads on from',
    async (_name, take, request, refusal, message) => {
      const dependencies = bookingDependencies(answering(refusal))

      expect(await take(dependencies, staff, BOOKING_ID, request)).toEqual(
        Result.error(DomainErrors.conflict(message)),
      )
    },
  )

  it('is said of the action the repository refused, whichever use case asked', async () => {
    const dependencies = bookingDependencies(
      answering({
        type: 'statusDoesNotAllow',
        action: 'start',
        status: 'draft',
        allowed: ['confirmed'],
      }),
    )

    expect(await confirm(dependencies, staff, BOOKING_ID, undefined)).toEqual(
      Result.error(
        DomainErrors.conflict(
          'A booking that is draft cannot be started; its status has to be confirmed',
        ),
      ),
    )
  })
})

describe.each(WITH_A_REQUEST)(
  'the request of %s',
  (_name, take, request, message) => {
    it('is read after the ID: a request that breaks a rule is not reported for an ID that is none', async () => {
      const dependencies = bookingDependencies()

      const result = await take(dependencies, actors.admin, 'not-an-id', {
        x: 1,
      })

      expect(validationMessageOf(result)).toBe('Invalid booking ID')
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('is refused when it breaks a rule, before the booking is looked at', async () => {
      const dependencies = bookingDependencies(answering({ type: 'notFound' }))

      const result = await take(dependencies, staff, BOOKING_ID, {
        ...request,
        status: 'completed',
      })

      expect(validationMessageOf(result)).toBe(message)
      expect(rulesOf(result)).toEqual(['status:unrecognized_keys'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it.each([
      ['nothing', undefined],
      ['null', null],
      ['a list', []],
      ['a text', 'booking'],
    ])('is refused when it is %s', async (_case, input) => {
      const dependencies = bookingDependencies()

      const result = await take(dependencies, actors.admin, BOOKING_ID, input)

      expect(validationMessageOf(result)).toBe(message)
      expect(rulesOf(result)).toEqual([':invalid_type'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('is refused for a member of another salon like for anyone: what is wrong with it is said before the booking is not found', async () => {
      const dependencies = bookingDependencies(answering({ type: 'notFound' }))

      const result = await take(
        dependencies,
        actors.ofSalon('owner', OTHER_SALON_ID),
        BOOKING_ID,
        {},
      )

      expect(validationMessageOf(result)).toBe(message)
      expect(repositoryCalls(dependencies)).toEqual([])
    })
  },
)

describe('CancelBookingUseCase', () => {
  it('hands on that no reason was given', async () => {
    const dependencies = bookingDependencies()

    await cancel(dependencies, staff, BOOKING_ID, { cancellationReason: null })

    expect(dependencies.bookingRepository.changeStatus).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.anything(),
      { type: 'cancel', cancellationReason: null },
      USER_ID,
    )
  })

  it.each([
    ['is not there', {}, ['cancellationReason:invalid_type']],
    [
      'says nothing',
      { cancellationReason: '  ' },
      ['cancellationReason:invalid_format'],
    ],
    [
      'is a number',
      { cancellationReason: 1 },
      ['cancellationReason:invalid_type'],
    ],
  ])('refuses a reason that %s', async (_case, input, rules) => {
    const dependencies = bookingDependencies()

    const result = await cancel(dependencies, staff, BOOKING_ID, input)

    expect(rulesOf(result)).toEqual(rules)
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('does not take who cancelled, when, or for what fee from the request', async () => {
    const dependencies = bookingDependencies()

    const result = await cancel(dependencies, staff, BOOKING_ID, {
      ...cancelRequest,
      cancelledBy: USER_ID,
      cancelledAt: '2026-11-20T01:00:00Z',
      cancellationFee: 500,
    })

    expect(rulesOf(result).toSorted()).toEqual([
      'cancellationFee:unrecognized_keys',
      'cancelledAt:unrecognized_keys',
      'cancelledBy:unrecognized_keys',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })
})

describe('CompleteBookingUseCase', () => {
  it.each([
    ['neither time', { actualStartTime: null, actualEndTime: null }],
    [
      'the start alone',
      { actualStartTime: '2026-11-20T01:05:00.000Z', actualEndTime: null },
    ],
    [
      'the end alone',
      { actualStartTime: null, actualEndTime: '2026-11-20T03:20:30.000Z' },
    ],
  ])('hands on %s as the request states it', async (_case, times) => {
    const dependencies = bookingDependencies()

    await complete(dependencies, staff, BOOKING_ID, times)

    expect(dependencies.bookingRepository.changeStatus).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.anything(),
      { type: 'complete', ...times },
      USER_ID,
    )
  })

  it('refuses an end that is not after the start of the same request, as the request is at fault', async () => {
    const dependencies = bookingDependencies()

    const result = await complete(dependencies, staff, BOOKING_ID, {
      actualStartTime: '2026-11-20T03:20:30Z',
      actualEndTime: '2026-11-20T03:20:30.000Z',
    })

    expect(validationMessageOf(result)).toBe('Invalid booking completion')
    expect(rulesOf(result)).toEqual(['actualEndTime:custom'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('refuses a request that leaves a time out: a time that is not stated is null', async () => {
    const dependencies = bookingDependencies()

    const result = await complete(dependencies, staff, BOOKING_ID, {})

    expect(rulesOf(result).toSorted()).toEqual([
      'actualEndTime:invalid_type',
      'actualStartTime:invalid_type',
    ])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it('does not take when the booking was completed from the request', async () => {
    const dependencies = bookingDependencies()

    const result = await complete(dependencies, staff, BOOKING_ID, {
      ...completeRequest,
      completedAt: '2026-11-20T03:30:00Z',
    })

    expect(rulesOf(result)).toEqual(['completedAt:unrecognized_keys'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })
})
