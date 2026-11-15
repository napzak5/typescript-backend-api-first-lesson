import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  type BookingUseCaseDependencies,
  DeleteBookingUseCase,
  RescheduleBookingUseCase,
  UpdateBookingUseCase,
} from '../business-logic/booking'
import type { Actor } from '../models/auth'
import type {
  BookingDeletion,
  BookingReschedule,
  IBookingRepository,
} from '../repositories/booking.repository'
import { type DomainError, DomainErrors } from '../shared'
import { actors } from './auth-fixtures'
import {
  apiBooking,
  BOOKING_ID,
  BOOKING_NUMBER,
  bookingDependencies,
  bookingWithServices,
  bookingRepositoryCalls as repositoryCalls,
} from './booking-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const notFound = Result.error(DomainErrors.notFound('Booking', BOOKING_ID))
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

type Reach = { type: string; salonId?: string }

const ofSalon: Reach = { type: 'salon', salonId: SALON_ID }
const ofOtherSalon: Reach = { type: 'salon', salonId: OTHER_SALON_ID }

/** Those who remove bookings from the ledger of a salon. */
const removers: [string, Actor, Reach][] = [
  ['an admin', actors.admin, { type: 'everySalon' }],
  ['the owner of the salon', actors.ofSalon('owner'), ofSalon],
  ['the manager of the salon', actors.ofSalon('manager'), ofSalon],
  [
    'the owner of another salon',
    actors.ofSalon('owner', OTHER_SALON_ID),
    ofOtherSalon,
  ],
  [
    'the manager of another salon',
    actors.ofSalon('manager', OTHER_SALON_ID),
    ofOtherSalon,
  ],
]

/** The staff of a salon keep its ledger, and remove nothing from it. */
const staffOfSalons: [string, Actor, Reach][] = [
  ['the staff of the salon', actors.ofSalon('staff'), ofSalon],
  [
    'the staff of another salon',
    actors.ofSalon('staff', OTHER_SALON_ID),
    ofOtherSalon,
  ],
]

/** Those who keep the ledger of a salon. */
const keepers = [...removers, ...staffOfSalons]

/** Those the ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

const notRemovers: [string, Actor][] = [
  ...notKeepers,
  ...staffOfSalons.map(([name, actor]): [string, Actor] => [name, actor]),
]

type Take = (
  dependencies: BookingUseCaseDependencies,
  actor: Actor,
  id: unknown,
  input: unknown,
) => Promise<Result<unknown, DomainError>>

const update: Take = (dependencies, actor, id, input) =>
  new UpdateBookingUseCase(dependencies).execute(actor, id, input)
const reschedule: Take = (dependencies, actor, id, input) =>
  new RescheduleBookingUseCase(dependencies).execute(actor, id, input)
const remove: Take = (dependencies, actor, id) =>
  new DeleteBookingUseCase(dependencies).execute(actor, id)

const updateRequest = {
  depositAmount: 3000,
  customerRequest: '短めに',
  internalNotes: 'お子様連れ',
  source: 'web',
}
const rescheduleRequest = {
  startTime: '2026-11-21T05:00:00Z',
  staffId: OTHER_STAFF_MEMBER_ID,
}

/** A repository that answers a reschedule with this outcome. */
const rescheduling = (
  outcome: BookingReschedule,
): Partial<IBookingRepository> => ({
  reschedule: vi.fn(async () => Result.success(outcome)),
})

/** A repository that answers a deletion with this outcome. */
const deleting = (outcome: BookingDeletion): Partial<IBookingRepository> => ({
  delete: vi.fn(async () => Result.success(outcome)),
})

const staff = actors.ofSalon('staff')
const owner = actors.ofSalon('owner')

/**
 * Each change: how it is asked for, a request that keeps its rules, who asks
 * for it, who does not, and a repository that does not find the booking.
 */
const CHANGES: [
  string,
  Take,
  unknown,
  [string, Actor][],
  Partial<IBookingRepository>,
][] = [
  [
    'update',
    update,
    updateRequest,
    notKeepers,
    { update: vi.fn(async () => Result.success(null)) },
  ],
  [
    'reschedule',
    reschedule,
    rescheduleRequest,
    notKeepers,
    rescheduling({ type: 'notFound' }),
  ],
  ['delete', remove, undefined, notRemovers, deleting({ type: 'notFound' })],
]

describe.each(CHANGES)(
  'the use case of %s',
  (name, take, request, refused, findingNone) => {
    it.each(refused)(
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

    it('names the booking that is not there by the ID in lower case', async () => {
      const dependencies = bookingDependencies(findingNone)

      expect(
        await take(
          dependencies,
          actors.admin,
          BOOKING_ID.toUpperCase(),
          request,
        ),
      ).toEqual(notFound)
      expect(repositoryCalls(dependencies)).toEqual([name])
    })

    it('reports a booking the actor does not reach as one that does not exist', async () => {
      const dependencies = bookingDependencies(findingNone)

      expect(
        await take(
          dependencies,
          actors.ofSalon('owner', OTHER_SALON_ID),
          BOOKING_ID,
          request,
        ),
      ).toEqual(notFound)
    })

    it('reports a failure of the database', async () => {
      const dependencies = bookingDependencies({
        [name]: vi.fn(async () => databaseDown),
      })

      expect(await take(dependencies, owner, BOOKING_ID, request)).toEqual(
        databaseDown,
      )
    })
  },
)

/** The changes that read a request, with what a failed validation is called. */
const WITH_A_REQUEST: [string, Take, Record<string, unknown>, string][] = [
  ['update', update, updateRequest, 'Invalid booking update'],
  ['reschedule', reschedule, rescheduleRequest, 'Invalid booking reschedule'],
]

describe.each(WITH_A_REQUEST)(
  'the request of %s',
  (name, take, request, message) => {
    it('is read after the ID: a request that breaks a rule is not reported for an ID that is none', async () => {
      const dependencies = bookingDependencies()

      const result = await take(dependencies, actors.admin, 'not-an-id', {
        x: 1,
      })

      expect(validationMessageOf(result)).toBe('Invalid booking ID')
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it.each([
      ['the status', 'status', 'confirmed'],
      ['the end', 'endTime', '2026-11-21T07:30:00Z'],
      ['the day', 'bookingDate', '2026-11-21'],
      ['the salon', 'salonId', OTHER_SALON_ID],
      ['the service lines', 'services', []],
      ['the total', 'totalAmount', 0],
    ])(
      'is refused when it names %s, before the booking is looked at',
      async (_case, property, value) => {
        const dependencies = bookingDependencies()

        const result = await take(dependencies, staff, BOOKING_ID, {
          ...request,
          [property]: value,
        })

        expect(validationMessageOf(result)).toBe(message)
        expect(rulesOf(result)).toEqual([`${property}:unrecognized_keys`])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

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
      const dependencies = bookingDependencies()

      const result = await take(
        dependencies,
        actors.ofSalon('owner', OTHER_SALON_ID),
        BOOKING_ID,
        {},
      )

      expect(validationMessageOf(result)).toBe(message)
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('reports a booking that was changed and cannot be presented as a fault of the database', async () => {
      const corrupt = bookingWithServices({ startTime: 'tomorrow' })
      const dependencies = bookingDependencies({
        update: vi.fn(async () => Result.success(corrupt)),
        ...rescheduling({ type: 'rescheduled', booking: corrupt }),
      })

      expect(await take(dependencies, staff, BOOKING_ID, request)).toEqual(
        storedRowIsCorrupt,
      )
      expect(repositoryCalls(dependencies)).toEqual([name])
    })
  },
)

describe('UpdateBookingUseCase', () => {
  it('writes what the request states and returns the booking as it is then', async () => {
    const dependencies = bookingDependencies({
      update: vi.fn(async () =>
        Result.success(bookingWithServices({ internalNotes: 'お子様連れ' })),
      ),
    })

    const result = await update(dependencies, staff, BOOKING_ID, updateRequest)

    expect(result).toEqual({
      type: 'success',
      data: apiBooking({ internalNotes: 'お子様連れ' }),
    })
    expect(repositoryCalls(dependencies)).toEqual(['update'])
  })

  it.each(keepers)(
    'says for %s which booking, among which bookings, and what to write',
    async (_case, actor, reach) => {
      const dependencies = bookingDependencies()

      await update(dependencies, actor, BOOKING_ID.toUpperCase(), updateRequest)

      expect(dependencies.bookingRepository.update).toHaveBeenCalledWith(
        BOOKING_ID,
        reach,
        updateRequest,
      )
    },
  )

  it.each([
    ['the deposit', { depositAmount: 0 }],
    ['what the customer asked for', { customerRequest: '  前髪は長めに  ' }],
    ['what the salon notes', { internalNotes: '遅れるとの連絡あり' }],
    ['where the booking came from', { source: 'walk_in' }],
    ['a property that is emptied', { internalNotes: null }],
    [
      'every property emptied',
      {
        depositAmount: null,
        customerRequest: null,
        internalNotes: null,
        source: null,
      },
    ],
  ])(
    'hands on %s and no property the request does not state',
    async (_case, change) => {
      const dependencies = bookingDependencies()

      await update(dependencies, staff, BOOKING_ID, change)

      expect(
        vi.mocked(dependencies.bookingRepository.update).mock.calls,
      ).toStrictEqual([[BOOKING_ID, ofSalon, change]])
    },
  )

  it('refuses a request that states nothing', async () => {
    const dependencies = bookingDependencies()

    const result = await update(dependencies, staff, BOOKING_ID, {})

    expect(validationMessageOf(result)).toBe('Invalid booking update')
    expect(rulesOf(result)).toEqual([':custom'])
    expect(repositoryCalls(dependencies)).toEqual([])
  })

  it.each([
    ['a deposit below zero', { depositAmount: -1 }, 'depositAmount:too_small'],
    [
      'a note that says nothing',
      { internalNotes: '  ' },
      'internalNotes:invalid_format',
    ],
    ['a source of 51 characters', { source: 'x'.repeat(51) }, 'source:too_big'],
    [
      'the time, which a reschedule changes',
      { startTime: '2026-11-21T05:00:00Z' },
      'startTime:unrecognized_keys',
    ],
    [
      'the staff member, whom a reschedule changes',
      { staffId: OTHER_STAFF_MEMBER_ID },
      'staffId:unrecognized_keys',
    ],
  ])('refuses %s without writing anything', async (_case, change, rule) => {
    const dependencies = bookingDependencies()

    const result = await update(dependencies, staff, BOOKING_ID, change)

    expect(validationMessageOf(result)).toBe('Invalid booking update')
    expect(rulesOf(result)).toEqual([rule])
    expect(repositoryCalls(dependencies)).toEqual([])
  })
})

describe('RescheduleBookingUseCase', () => {
  it('moves the booking and returns it as it is then', async () => {
    const dependencies = bookingDependencies(
      rescheduling({
        type: 'rescheduled',
        booking: bookingWithServices({ staffId: OTHER_STAFF_MEMBER_ID }),
      }),
    )

    const result = await reschedule(
      dependencies,
      staff,
      BOOKING_ID,
      rescheduleRequest,
    )

    expect(result).toEqual({
      type: 'success',
      data: apiBooking({ staffId: OTHER_STAFF_MEMBER_ID }),
    })
    expect(repositoryCalls(dependencies)).toEqual(['reschedule'])
  })

  it.each(keepers)(
    'says for %s which booking, among which bookings, and where to move it, in the one spelling of a time and of an ID',
    async (_case, actor, reach) => {
      const dependencies = bookingDependencies()

      await reschedule(dependencies, actor, BOOKING_ID.toUpperCase(), {
        startTime: '2026-11-21T05:00:00Z',
        staffId: OTHER_STAFF_MEMBER_ID.toUpperCase(),
      })

      expect(
        vi.mocked(dependencies.bookingRepository.reschedule).mock.calls,
      ).toStrictEqual([
        [
          BOOKING_ID,
          reach,
          {
            startTime: '2026-11-21T05:00:00.000Z',
            staffId: OTHER_STAFF_MEMBER_ID,
          },
        ],
      ])
    },
  )

  it.each<[string, unknown, string[]]>([
    ['no time', { staffId: STAFF_MEMBER_ID }, ['startTime:invalid_type']],
    [
      'no staff member',
      { startTime: '2026-11-21T05:00:00Z' },
      ['staffId:invalid_type'],
    ],
    ['neither', {}, ['staffId:invalid_type', 'startTime:invalid_type']],
    [
      'nobody for the staff member: a booking has one in charge',
      { ...rescheduleRequest, staffId: null },
      ['staffId:invalid_type'],
    ],
    [
      'a time that is not on a whole minute',
      { ...rescheduleRequest, startTime: '2026-11-21T05:00:30Z' },
      ['startTime:custom'],
    ],
    [
      'a time that is not in UTC',
      { ...rescheduleRequest, startTime: '2026-11-21T14:00:00+09:00' },
      ['startTime:invalid_format'],
    ],
    [
      'a day without a time',
      { ...rescheduleRequest, startTime: '2026-11-21' },
      ['startTime:invalid_format'],
    ],
    [
      'a staff member that is no ID',
      { ...rescheduleRequest, staffId: 'somebody' },
      ['staffId:invalid_format'],
    ],
  ])(
    'refuses a request with %s, before the booking is looked at',
    async (_case, input, rules) => {
      const dependencies = bookingDependencies(
        rescheduling({ type: 'notFound' }),
      )

      const result = await reschedule(dependencies, staff, BOOKING_ID, input)

      expect(validationMessageOf(result)).toBe('Invalid booking reschedule')
      expect(rulesOf(result).toSorted()).toEqual(rules)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each<[BookingReschedule, string]>([
    [
      {
        type: 'statusDoesNotAllow',
        status: 'in_progress',
        allowed: ['draft', 'pending', 'confirmed'],
      },
      'A booking that is in_progress cannot be rescheduled; its status has to be draft or pending or confirmed',
    ],
    [
      { type: 'statusDoesNotAllow', status: 'cancelled', allowed: ['pending'] },
      'A booking that is cancelled cannot be rescheduled; its status has to be pending',
    ],
    [
      { type: 'timeZoneUnknown' },
      'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first',
    ],
    [
      { type: 'staffOccupied', staffIds: [STAFF_MEMBER_ID] },
      `Other bookings occupy staff member ${STAFF_MEMBER_ID} at a time of this booking`,
    ],
    [
      {
        type: 'staffOccupied',
        staffIds: [STAFF_MEMBER_ID, OTHER_STAFF_MEMBER_ID],
      },
      `Other bookings occupy staff members ${STAFF_MEMBER_ID}, ${OTHER_STAFF_MEMBER_ID} at a time of this booking`,
    ],
  ])(
    'reports %j as a conflict that says what stands in the way',
    async (refusal, message) => {
      const dependencies = bookingDependencies(rescheduling(refusal))

      expect(
        await reschedule(dependencies, staff, BOOKING_ID, rescheduleRequest),
      ).toEqual(Result.error(DomainErrors.conflict(message)))
    },
  )

  it('reports a staff member who is not one of the salon as a fault of the request', async () => {
    const issues = [
      {
        field: 'staffId',
        rule: 'not_found',
        message: 'Must name a staff member of the salon',
      },
    ]
    const dependencies = bookingDependencies(
      rescheduling({ type: 'invalid', issues }),
    )

    expect(
      await reschedule(dependencies, staff, BOOKING_ID, rescheduleRequest),
    ).toEqual(
      Result.error(
        DomainErrors.validation('Invalid booking reschedule', issues),
      ),
    )
  })
})

describe('DeleteBookingUseCase', () => {
  it('removes the booking and resolves to its ID', async () => {
    const dependencies = bookingDependencies()

    expect(await remove(dependencies, owner, BOOKING_ID, undefined)).toEqual(
      Result.success(BOOKING_ID),
    )
    expect(repositoryCalls(dependencies)).toEqual(['delete'])
  })

  it.each(removers)(
    'says for %s which booking, among which bookings',
    async (_case, actor, reach) => {
      const dependencies = bookingDependencies()

      const result = await remove(
        dependencies,
        actor,
        BOOKING_ID.toUpperCase(),
        undefined,
      )

      expect(result).toEqual(Result.success(BOOKING_ID))
      expect(
        vi.mocked(dependencies.bookingRepository.delete).mock.calls,
      ).toStrictEqual([[BOOKING_ID, reach]])
    },
  )

  it.each<[BookingDeletion, string]>([
    [
      { type: 'referredTo', by: ['sale'] },
      'The booking cannot be deleted: a sale refers to it',
    ],
    [
      { type: 'referredTo', by: ['treatmentRecord'] },
      'The booking cannot be deleted: a treatment record refers to it',
    ],
    [
      { type: 'referredTo', by: ['sale', 'treatmentRecord'] },
      'The booking cannot be deleted: a sale and a treatment record refer to it',
    ],
  ])(
    'reports %j as a conflict that says what refers to the booking',
    async (refusal, message) => {
      const dependencies = bookingDependencies(deleting(refusal))

      expect(await remove(dependencies, owner, BOOKING_ID, undefined)).toEqual(
        Result.error(DomainErrors.conflict(message)),
      )
    },
  )
})
