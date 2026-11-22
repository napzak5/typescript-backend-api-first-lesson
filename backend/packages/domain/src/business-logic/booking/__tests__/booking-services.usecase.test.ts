import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import { actors } from '../../../__tests__/fixtures/auth-fixtures'
import {
  apiBookingServices,
  BOOKING_ID,
  BOOKING_NUMBER,
  BOOKING_SERVICE_ID,
  bookingDependencies,
  COLOR_ID,
  dbBookingServices,
  bookingRepositoryCalls as repositoryCalls,
} from '../../../__tests__/fixtures/booking-fixtures'
import {
  brokenRules,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import type { Actor } from '../../../models/auth'
import type {
  BookingServiceAddition,
  BookingServiceRemoval,
  IBookingRepository,
} from '../../../repositories/booking.repository'
import { type DomainError, DomainErrors, toldIn } from '../../../shared'
import {
  type BookingUseCaseDependencies,
  CreateBookingServiceUseCase,
  DeleteBookingServiceUseCase,
  GetBookingServiceUseCase,
} from '..'

const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const forbidden = Result.error(DomainErrors.forbidden())
const bookingNotFound = Result.error(
  DomainErrors.notFound('Booking', BOOKING_ID),
)
const lineNotFound = Result.error(
  DomainErrors.notFound('Booking service', BOOKING_SERVICE_ID),
)

const INVALID_LINE = 'Invalid booking service'
const TIME_ZONE_UNKNOWN =
  'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first'
const AMOUNTS_TOO_BIG = 'The amounts of a booking must not exceed 2147483647'

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

type Reach = { type: string; salonId?: string }

const ofSalon: Reach = { type: 'salon', salonId: SALON_ID }
const ofOtherSalon: Reach = { type: 'salon', salonId: OTHER_SALON_ID }

/** Those who keep the ledger of a salon, its staff among them. */
const keepers: [string, Actor, Reach][] = [
  ['an admin', actors.admin, { type: 'everySalon' }],
  ['the owner of the salon', actors.ofSalon('owner'), ofSalon],
  ['the manager of the salon', actors.ofSalon('manager'), ofSalon],
  ['the staff of the salon', actors.ofSalon('staff'), ofSalon],
  [
    'the owner of another salon',
    actors.ofSalon('owner', OTHER_SALON_ID),
    ofOtherSalon,
  ],
  [
    'the staff of another salon',
    actors.ofSalon('staff', OTHER_SALON_ID),
    ofOtherSalon,
  ],
]

/** Those the ledger is closed to. */
const notKeepers: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['an account of a salon that reaches no salon', actors.withoutScope],
]

const staff = actors.ofSalon('staff')

type Take = (
  dependencies: BookingUseCaseDependencies,
  actor: Actor,
  bookingId: unknown,
  lineId: unknown,
  input: unknown,
) => Promise<Result<unknown, DomainError>>

const add: Take = (dependencies, actor, bookingId, _lineId, input) =>
  new CreateBookingServiceUseCase(dependencies).execute(actor, bookingId, input)
const get: Take = (dependencies, actor, bookingId, lineId) =>
  new GetBookingServiceUseCase(dependencies).execute(actor, bookingId, lineId)
const remove: Take = (dependencies, actor, bookingId, lineId) =>
  new DeleteBookingServiceUseCase(dependencies).execute(
    actor,
    bookingId,
    lineId,
  )

/** A colouring by the other staff member, right after the lines of the booking. */
const lineRequest = {
  serviceId: COLOR_ID,
  staffId: OTHER_STAFF_MEMBER_ID,
  startTime: '2026-11-20T03:30:00Z',
  notes: '明るめ',
}

/** The request above as the repository is asked for it: the time in one spelling. */
const askedLine = { ...lineRequest, startTime: '2026-11-20T03:30:00.000Z' }

/** A repository that answers an addition with this outcome. */
const adding = (
  outcome: BookingServiceAddition,
): Partial<IBookingRepository> => ({
  addService: vi.fn(async () => Result.success(outcome)),
})

/** A repository that answers a removal with this outcome. */
const removing = (
  outcome: BookingServiceRemoval,
): Partial<IBookingRepository> => ({
  removeService: vi.fn(async () => Result.success(outcome)),
})

/** A stored line that cannot be presented. */
const corruptLine = () => {
  const [first] = dbBookingServices()
  if (first === undefined) {
    throw new Error('The booking of the fixtures has service lines')
  }
  return { ...first, startTime: 'tomorrow' }
}

const storedLineIsCorrupt = {
  type: 'error',
  error: {
    type: 'database',
    message: `Stored booking service ${BOOKING_SERVICE_ID} does not match the API model`,
    cause: expect.objectContaining({ type: 'validation' }),
  },
}

/**
 * Each operation on the lines of a booking: the method of the repository it
 * asks, how it is asked for, a repository that finds nothing, and what it
 * then says is not there.
 */
const OPERATIONS: [
  'addService' | 'findService' | 'removeService',
  Take,
  Partial<IBookingRepository>,
  Result<never, DomainError>,
][] = [
  ['addService', add, adding({ type: 'notFound' }), bookingNotFound],
  [
    'findService',
    get,
    { findService: vi.fn(async () => Result.success(null)) },
    lineNotFound,
  ],
  ['removeService', remove, removing({ type: 'notFound' }), bookingNotFound],
]

describe.each(OPERATIONS)(
  'the use case that asks for %s',
  (name, take, findingNone, notThere) => {
    it.each(notKeepers)(
      'refuses %s without reading the IDs or the request',
      async (_case, actor) => {
        const dependencies = bookingDependencies()

        const results = [
          await take(
            dependencies,
            actor,
            BOOKING_ID,
            BOOKING_SERVICE_ID,
            lineRequest,
          ),
          await take(
            dependencies,
            actor,
            'not-an-id',
            'not-an-id',
            lineRequest,
          ),
          await take(dependencies, actor, BOOKING_ID, BOOKING_SERVICE_ID, {
            x: 1,
          }),
        ]

        expect(results).toEqual([forbidden, forbidden, forbidden])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each([
      ['a text that is no ID', 'not-an-id'],
      ['an empty text', ''],
      ['a booking number', BOOKING_NUMBER],
      ['nothing', undefined],
    ])(
      'refuses %s for the ID of the booking, before anything else of the request, without asking the repository',
      async (_case, id) => {
        const dependencies = bookingDependencies()

        const results = [
          await take(
            dependencies,
            actors.admin,
            id,
            BOOKING_SERVICE_ID,
            lineRequest,
          ),
          await take(dependencies, actors.admin, id, 'not-an-id', { x: 1 }),
        ]

        for (const result of results) {
          expect(validationMessageOf(result)).toBe('Invalid booking ID')
          expect(rulesOf(result)).toHaveLength(1)
          expect(rulesOf(result)[0]).toMatch(/^bookingId:/)
        }
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it('names what is not there by its ID in lower case', async () => {
      const dependencies = bookingDependencies(findingNone)

      expect(
        await take(
          dependencies,
          actors.admin,
          BOOKING_ID.toUpperCase(),
          BOOKING_SERVICE_ID.toUpperCase(),
          lineRequest,
        ),
      ).toEqual(notThere)
      expect(repositoryCalls(dependencies)).toEqual([name])
    })

    it('reports a booking the actor does not reach as something that does not exist', async () => {
      const dependencies = bookingDependencies(findingNone)

      expect(
        await take(
          dependencies,
          actors.ofSalon('owner', OTHER_SALON_ID),
          BOOKING_ID,
          BOOKING_SERVICE_ID,
          lineRequest,
        ),
      ).toEqual(notThere)
    })

    it('reports a failure of the database', async () => {
      const dependencies = bookingDependencies({
        [name]: vi.fn(async () => databaseDown),
      })

      expect(
        await take(
          dependencies,
          staff,
          BOOKING_ID,
          BOOKING_SERVICE_ID,
          lineRequest,
        ),
      ).toEqual(databaseDown)
    })
  },
)

/** The operations on one line, which is named in the path. */
const ON_A_LINE: ['findService' | 'removeService', Take][] = [
  ['findService', get],
  ['removeService', remove],
]

describe.each(ON_A_LINE)('the line of %s', (name, take) => {
  it.each([
    ['a text that is no ID', 'not-an-id'],
    ['an empty text', ''],
    ['nothing', undefined],
    ['a number of the order', 0],
  ])(
    'is refused when its ID is %s, without asking the repository',
    async (_case, id) => {
      const dependencies = bookingDependencies()

      const result = await take(
        dependencies,
        actors.admin,
        BOOKING_ID,
        id,
        undefined,
      )

      expect(validationMessageOf(result)).toBe('Invalid booking service ID')
      expect(rulesOf(result)).toHaveLength(1)
      expect(rulesOf(result)[0]).toMatch(/^id:/)
      expect(repositoryCalls(dependencies)).toEqual([])
    },
  )

  it.each(keepers)(
    'is asked of the repository for %s by both IDs in lower case, among the bookings they reach',
    async (_case, actor, reach) => {
      const dependencies = bookingDependencies()

      await take(
        dependencies,
        actor,
        BOOKING_ID.toUpperCase(),
        BOOKING_SERVICE_ID.toUpperCase(),
        undefined,
      )

      expect(
        vi.mocked(dependencies.bookingRepository[name]).mock.calls,
      ).toStrictEqual([[BOOKING_ID, BOOKING_SERVICE_ID, reach]])
      expect(repositoryCalls(dependencies)).toEqual([name])
    },
  )
})

describe('CreateBookingServiceUseCase', () => {
  it('adds the line and returns it as the API presents it', async () => {
    const dependencies = bookingDependencies()

    expect(
      await add(dependencies, staff, BOOKING_ID, undefined, lineRequest),
    ).toEqual(Result.success(apiBookingServices()[0]))
    expect(repositoryCalls(dependencies)).toEqual(['addService'])
  })

  it.each(keepers)(
    'asks the repository for %s to add the line as it passed the rules, among the bookings they reach',
    async (_case, actor, reach) => {
      const dependencies = bookingDependencies()

      await add(dependencies, actor, BOOKING_ID.toUpperCase(), undefined, {
        ...lineRequest,
        serviceId: COLOR_ID.toUpperCase(),
        staffId: OTHER_STAFF_MEMBER_ID.toUpperCase(),
      })

      expect(
        vi.mocked(dependencies.bookingRepository.addService).mock.calls,
      ).toStrictEqual([[BOOKING_ID, reach, askedLine]])
    },
  )

  it('takes a line nobody is named for and that notes nothing', async () => {
    const dependencies = bookingDependencies()

    await add(dependencies, staff, BOOKING_ID, undefined, {
      ...lineRequest,
      staffId: null,
      notes: null,
    })

    expect(
      vi.mocked(dependencies.bookingRepository.addService).mock.calls,
    ).toStrictEqual([
      [BOOKING_ID, ofSalon, { ...askedLine, staffId: null, notes: null }],
    ])
  })

  describe('the request', () => {
    it('is read after the ID: a request that breaks a rule is not reported for an ID that is none', async () => {
      const dependencies = bookingDependencies()

      const result = await add(
        dependencies,
        actors.admin,
        'not-an-id',
        undefined,
        { x: 1 },
      )

      expect(validationMessageOf(result)).toBe('Invalid booking ID')
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it.each<[string, Record<string, unknown>, string[]]>([
      [
        'a service that is no ID',
        { serviceId: 'cut' },
        ['serviceId:invalid_format'],
      ],
      [
        'a staff member that is no ID',
        { staffId: 'hanako' },
        ['staffId:invalid_format'],
      ],
      [
        'a time with an offset',
        { startTime: '2026-11-20T12:30:00+09:00' },
        ['startTime:invalid_format'],
      ],
      [
        'a time on half a minute',
        { startTime: '2026-11-20T03:30:30Z' },
        ['startTime:custom'],
      ],
      ['notes that say nothing', { notes: '  ' }, ['notes:invalid_format']],
      ['a price', { price: 0 }, ['price:unrecognized_keys']],
      [
        'an end',
        { endTime: '2026-11-20T05:00:00Z' },
        ['endTime:unrecognized_keys'],
      ],
      ['a duration', { duration: 90 }, ['duration:unrecognized_keys']],
      [
        'whether the price includes the tax',
        { taxIncluded: true },
        ['taxIncluded:unrecognized_keys'],
      ],
      ['a place', { sortOrder: 0 }, ['sortOrder:unrecognized_keys']],
      ['a booking', { bookingId: BOOKING_ID }, ['bookingId:unrecognized_keys']],
      [
        'several broken rules',
        { serviceId: 'cut', notes: '', price: 0 },
        [
          'notes:invalid_format',
          'price:unrecognized_keys',
          'serviceId:invalid_format',
        ],
      ],
    ])(
      'is refused with %s, before the booking is looked at',
      async (_case, change, rules) => {
        const dependencies = bookingDependencies()

        const result = await add(dependencies, staff, BOOKING_ID, undefined, {
          ...lineRequest,
          ...change,
        })

        expect(validationMessageOf(result)).toBe(INVALID_LINE)
        expect(rulesOf(result).toSorted()).toEqual(rules)
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each(['serviceId', 'staffId', 'startTime', 'notes'])(
      'is refused without %s: nothing of a new line is optional',
      async (property) => {
        const dependencies = bookingDependencies()
        const { [property]: _omitted, ...input }: Record<string, unknown> =
          lineRequest

        const result = await add(
          dependencies,
          staff,
          BOOKING_ID,
          undefined,
          input,
        )

        expect(validationMessageOf(result)).toBe(INVALID_LINE)
        expect(rulesOf(result)).toEqual([`${property}:invalid_type`])
        expect(repositoryCalls(dependencies)).toEqual([])
      },
    )

    it.each([
      ['nothing', undefined],
      ['null', null],
      ['a list', [lineRequest]],
      ['a text', 'colour'],
    ])('is refused when it is %s', async (_case, input) => {
      const dependencies = bookingDependencies()

      const result = await add(
        dependencies,
        actors.admin,
        BOOKING_ID,
        undefined,
        input,
      )

      expect(validationMessageOf(result)).toBe(INVALID_LINE)
      expect(rulesOf(result)).toEqual([':invalid_type'])
      expect(repositoryCalls(dependencies)).toEqual([])
    })

    it('is refused for a member of another salon like for anyone: what is wrong with it is said before the booking is not found', async () => {
      const dependencies = bookingDependencies(adding({ type: 'notFound' }))

      const result = await add(
        dependencies,
        actors.ofSalon('owner', OTHER_SALON_ID),
        BOOKING_ID,
        undefined,
        {},
      )

      expect(validationMessageOf(result)).toBe(INVALID_LINE)
      expect(repositoryCalls(dependencies)).toEqual([])
    })
  })

  it.each<[BookingServiceAddition, string]>([
    [
      {
        type: 'statusDoesNotAllow',
        status: 'completed',
        allowed: ['draft', 'pending', 'confirmed', 'in_progress'],
      },
      'The services of a booking that is completed cannot be changed; its status has to be draft or pending or confirmed or in_progress',
    ],
    [
      { type: 'statusDoesNotAllow', status: 'cancelled', allowed: ['pending'] },
      'The services of a booking that is cancelled cannot be changed; its status has to be pending',
    ],
    [
      { type: 'tooManyServices', limit: 20 },
      'A booking has at most 20 services',
    ],
    [{ type: 'tooManyServices', limit: 3 }, 'A booking has at most 3 services'],
    [
      { type: 'visitTooLong', hours: 24 },
      'Every service of a booking begins within 24 hours of the earliest one',
    ],
    [
      { type: 'visitTooLong', hours: 8 },
      'Every service of a booking begins within 8 hours of the earliest one',
    ],
    [{ type: 'timeZoneUnknown' }, TIME_ZONE_UNKNOWN],
    [{ type: 'amountsTooBig' }, AMOUNTS_TOO_BIG],
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
      const dependencies = bookingDependencies(adding(refusal))

      expect(
        await add(dependencies, staff, BOOKING_ID, undefined, lineRequest),
      ).toEqual(Result.error(DomainErrors.conflict(message)))
    },
  )

  it('reports a service or a staff member that is not of the salon as a fault of the request', async () => {
    const issues = [
      {
        field: 'serviceId',
        rule: 'not_found',
        message: 'Must name a service of the salon',
      },
      {
        field: 'staffId',
        rule: 'not_found',
        message: 'Must name a staff member of the salon',
      },
    ]
    const dependencies = bookingDependencies(
      adding({ type: 'invalid', issues }),
    )

    expect(
      await add(dependencies, staff, BOOKING_ID, undefined, lineRequest),
    ).toEqual(Result.error(DomainErrors.validation(INVALID_LINE, issues)))
  })

  it('reports a line that was added and cannot be presented as a fault of the database', async () => {
    const dependencies = bookingDependencies(
      adding({ type: 'added', service: corruptLine() }),
    )

    expect(
      await add(dependencies, staff, BOOKING_ID, undefined, lineRequest),
    ).toEqual(storedLineIsCorrupt)
  })
})

describe('GetBookingServiceUseCase', () => {
  it('returns the line as the API presents it', async () => {
    const dependencies = bookingDependencies()

    expect(
      await get(dependencies, staff, BOOKING_ID, BOOKING_SERVICE_ID, undefined),
    ).toEqual(Result.success(apiBookingServices()[0]))
    expect(repositoryCalls(dependencies)).toEqual(['findService'])
  })

  it('reports a line the booking does not have as one that does not exist, by the ID of the line', async () => {
    const dependencies = bookingDependencies({
      findService: vi.fn(async () => Result.success(null)),
    })

    expect(
      await get(dependencies, staff, BOOKING_ID, BOOKING_SERVICE_ID, undefined),
    ).toEqual(lineNotFound)
  })

  it('reports a line that cannot be presented as a fault of the database', async () => {
    const dependencies = bookingDependencies({
      findService: vi.fn(async () => Result.success(corruptLine())),
    })

    expect(
      await get(dependencies, staff, BOOKING_ID, BOOKING_SERVICE_ID, undefined),
    ).toEqual(storedLineIsCorrupt)
  })
})

describe('DeleteBookingServiceUseCase', () => {
  it('removes the line and resolves to its ID', async () => {
    const dependencies = bookingDependencies()

    expect(
      await remove(
        dependencies,
        staff,
        BOOKING_ID,
        BOOKING_SERVICE_ID.toUpperCase(),
        undefined,
      ),
    ).toEqual(Result.success(BOOKING_SERVICE_ID))
    expect(repositoryCalls(dependencies)).toEqual(['removeService'])
  })

  it('reports a line the booking does not have as one that does not exist, by the ID of the line', async () => {
    const dependencies = bookingDependencies(
      removing({ type: 'serviceNotFound' }),
    )

    expect(
      await remove(
        dependencies,
        staff,
        BOOKING_ID,
        BOOKING_SERVICE_ID,
        undefined,
      ),
    ).toEqual(lineNotFound)
  })

  it.each<[BookingServiceRemoval, string]>([
    [
      {
        type: 'statusDoesNotAllow',
        status: 'no_show',
        allowed: ['draft', 'pending', 'confirmed', 'in_progress'],
      },
      'The services of a booking that is no_show cannot be changed; its status has to be draft or pending or confirmed or in_progress',
    ],
    [
      { type: 'lastService' },
      'A booking keeps at least one service; cancel a booking that will not take place',
    ],
    [{ type: 'timeZoneUnknown' }, TIME_ZONE_UNKNOWN],
    [{ type: 'amountsTooBig' }, AMOUNTS_TOO_BIG],
  ])(
    'reports %j as a conflict that says what stands in the way',
    async (refusal, message) => {
      const dependencies = bookingDependencies(removing(refusal))

      expect(
        await remove(
          dependencies,
          staff,
          BOOKING_ID,
          BOOKING_SERVICE_ID,
          undefined,
        ),
      ).toEqual(Result.error(DomainErrors.conflict(message)))
    },
  )
})
