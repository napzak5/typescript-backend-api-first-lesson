import { describe, expect, it } from 'vitest'
import {
  type BookingRescheduleRequest,
  type BookingToMove,
  moveBooking,
  planReschedule,
  type RescheduleReferences,
  staffOfMoved,
} from '../business-logic/booking'
import type { DbBooking } from '../models/booking'
import { bookingRescheduleRequestSchema } from '../schemas/booking.schema'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

type Status = DbBooking['status']

/** A third staff member of the salon. */
const THIRD_STAFF_MEMBER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0e03'

const CUT_LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d01'
const COLOR_LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d02'
const HEAD_SPA_LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d03'

/** A time of a day of November 2026 in UTC, `HH:MM`; ten in the morning in Tokyo is 01:00. */
const at = (time: string, day = '20'): Date =>
  new Date(`2026-11-${day}T${time}:00.000Z`)

/**
 * The booking of the fixtures as a move looks at it: a cut by the staff
 * member in charge from 10:00 in Tokyo, a colouring by another right after
 * it, and a head spa nobody is named for yet.
 */
const booking = (overrides: Partial<BookingToMove> = {}): BookingToMove => ({
  status: 'pending',
  staffId: STAFF_MEMBER_ID,
  startTime: at('01:00'),
  endTime: at('04:00'),
  services: [
    {
      id: CUT_LINE_ID,
      staffId: STAFF_MEMBER_ID,
      startTime: at('01:00'),
      endTime: at('02:00'),
    },
    {
      id: COLOR_LINE_ID,
      staffId: OTHER_STAFF_MEMBER_ID,
      startTime: at('02:00'),
      endTime: at('03:30'),
    },
    {
      id: HEAD_SPA_LINE_ID,
      staffId: null,
      startTime: at('03:30'),
      endTime: at('04:00'),
    },
  ],
  ...overrides,
})

const request = (
  startTime = '2026-11-20T01:00:00Z',
  staffId = STAFF_MEMBER_ID,
): BookingRescheduleRequest =>
  bookingRescheduleRequestSchema.parse({ startTime, staffId })

/** The booking as it is once it is moved; anything else fails the test. */
const moved = (from: BookingToMove, to: BookingRescheduleRequest) => {
  const move = moveBooking(from, to)
  if (move.type !== 'moved') {
    throw new Error(`The booking was not moved: ${move.type}`)
  }
  return move.booking
}

type Member = RescheduleReferences['staff'][number]

const member = (id: string, overrides: Partial<Member> = {}): Member => ({
  id,
  bufferTimeBefore: 10,
  bufferTimeAfter: 15,
  maxConcurrentBookings: 1,
  isDeleted: false,
  ...overrides,
})

/** The salon in Tokyo with the three staff members, none deleted. */
const references = (
  overrides: Partial<RescheduleReferences> = {},
): RescheduleReferences => ({
  timezone: 'Asia/Tokyo',
  staff: [
    member(STAFF_MEMBER_ID),
    member(OTHER_STAFF_MEMBER_ID),
    member(THIRD_STAFF_MEMBER_ID),
  ],
  ...overrides,
})

/** The plan of a move that is planned; anything else fails the test. */
const planned = (
  from: BookingToMove,
  to: BookingRescheduleRequest,
  refersTo: RescheduleReferences = references(),
) => {
  const plan = planReschedule(moved(from, to), refersTo)
  if (plan.type !== 'planned') {
    throw new Error(`The move was not planned: ${plan.type}`)
  }
  return plan
}

describe('moveBooking', () => {
  it.each<Status>(['draft', 'pending', 'confirmed'])(
    'moves a booking that is %s',
    (status) => {
      expect(moveBooking(booking({ status }), request()).type).toBe('moved')
    },
  )

  it.each<Status>(['in_progress', 'completed', 'cancelled', 'no_show'])(
    'does not move a booking that is %s, and says which are moved',
    (status) => {
      expect(
        moveBooking(
          booking({ status }),
          request('2026-11-21T05:00:00Z', THIRD_STAFF_MEMBER_ID),
        ),
      ).toEqual({
        type: 'statusDoesNotAllow',
        status,
        allowed: ['draft', 'pending', 'confirmed'],
      })
    },
  )

  it('begins the booking at the time of the request and moves its end and every line by as much', () => {
    // An hour and a half later.
    expect(moved(booking(), request('2026-11-20T02:30:00Z'))).toEqual({
      staffId: STAFF_MEMBER_ID,
      startTime: at('02:30'),
      endTime: at('05:30'),
      services: [
        {
          id: CUT_LINE_ID,
          staffId: STAFF_MEMBER_ID,
          startTime: at('02:30'),
          endTime: at('03:30'),
        },
        {
          id: COLOR_LINE_ID,
          staffId: OTHER_STAFF_MEMBER_ID,
          startTime: at('03:30'),
          endTime: at('05:00'),
        },
        {
          id: HEAD_SPA_LINE_ID,
          staffId: null,
          startTime: at('05:00'),
          endTime: at('05:30'),
        },
      ],
    })
  })

  it('moves a booking to an earlier time, over the end of a day', () => {
    const earlier = moved(booking(), request('2026-11-19T22:45:00Z'))

    expect(earlier.startTime).toEqual(at('22:45', '19'))
    expect(earlier.endTime).toEqual(at('01:45'))
    expect(
      earlier.services.map(({ startTime, endTime }) => [startTime, endTime]),
    ).toEqual([
      [at('22:45', '19'), at('23:45', '19')],
      [at('23:45', '19'), at('01:15')],
      [at('01:15'), at('01:45')],
    ])
  })

  it('moves the lines by as much as the booking, whenever the first of them begins', () => {
    // The booking is said to begin before its first line does.
    const from = booking({ startTime: at('00:30') })

    const later = moved(from, request('2026-11-20T01:00:00Z'))

    expect(later.startTime).toEqual(at('01:00'))
    expect(later.endTime).toEqual(at('04:30'))
    expect(later.services.map(({ startTime }) => startTime)).toEqual([
      at('01:30'),
      at('02:30'),
      at('04:00'),
    ])
  })

  it('gives the lines of the staff member who was in charge to the one who is, and leaves the others', () => {
    const handedOver = moved(
      booking(),
      request('2026-11-20T01:00:00Z', THIRD_STAFF_MEMBER_ID),
    )

    expect(handedOver.staffId).toBe(THIRD_STAFF_MEMBER_ID)
    expect(handedOver.services.map(({ staffId }) => staffId)).toEqual([
      THIRD_STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
      null,
    ])
  })

  it('gives the lines to a staff member who has other lines of the booking already', () => {
    const handedOver = moved(
      booking(),
      request('2026-11-20T01:00:00Z', OTHER_STAFF_MEMBER_ID),
    )

    expect(handedOver.staffId).toBe(OTHER_STAFF_MEMBER_ID)
    expect(handedOver.services.map(({ staffId }) => staffId)).toEqual([
      OTHER_STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
      null,
    ])
  })

  it('leaves every line with whom it was when the staff member in charge had none', () => {
    const from = booking({ staffId: THIRD_STAFF_MEMBER_ID })

    const handedOver = moved(from, request())

    expect(handedOver.staffId).toBe(STAFF_MEMBER_ID)
    expect(handedOver.services.map(({ staffId }) => staffId)).toEqual([
      STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
      null,
    ])
  })

  it('leaves a booking that is moved to where it is as it is', () => {
    const { status: _status, ...same } = booking()

    expect(moved(booking(), request())).toEqual(same)
  })

  it('moves a booking without lines', () => {
    expect(
      moved(booking({ services: [] }), request('2026-11-20T05:00:00Z')),
    ).toEqual({
      staffId: STAFF_MEMBER_ID,
      startTime: at('05:00'),
      endTime: at('08:00'),
      services: [],
    })
  })
})

describe('staffOfMoved', () => {
  it('names the staff member in charge and those of the lines, each once', () => {
    expect(
      staffOfMoved(
        moved(
          booking(),
          request('2026-11-20T01:00:00Z', OTHER_STAFF_MEMBER_ID),
        ),
      ),
    ).toEqual([OTHER_STAFF_MEMBER_ID])
    expect(staffOfMoved(moved(booking(), request())).toSorted()).toEqual([
      STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
    ])
  })

  it('names the staff member in charge who has no line', () => {
    expect(
      staffOfMoved(
        moved(booking({ staffId: THIRD_STAFF_MEMBER_ID }), {
          ...request(),
          staffId: request(undefined, THIRD_STAFF_MEMBER_ID).staffId,
        }),
      ).toSorted(),
    ).toEqual([STAFF_MEMBER_ID, OTHER_STAFF_MEMBER_ID, THIRD_STAFF_MEMBER_ID])
  })

  it('does not name the staff member who was in charge and has no line any more', () => {
    expect(
      staffOfMoved(
        moved(booking(), request(undefined, THIRD_STAFF_MEMBER_ID)),
      ).toSorted(),
    ).toEqual([OTHER_STAFF_MEMBER_ID, THIRD_STAFF_MEMBER_ID])
  })
})

describe('planReschedule', () => {
  it('writes the booking and its lines at their new times, as the texts a booking is created with', () => {
    const { write } = planned(
      booking(),
      request('2026-11-20T02:30:00Z', THIRD_STAFF_MEMBER_ID),
    )

    expect(write).toEqual({
      booking: {
        staffId: THIRD_STAFF_MEMBER_ID,
        bookingDate: '2026-11-20',
        startTime: '2026-11-20T02:30:00.000Z',
        endTime: '2026-11-20T05:30:00.000Z',
      },
      services: [
        {
          id: CUT_LINE_ID,
          staffId: THIRD_STAFF_MEMBER_ID,
          startTime: '2026-11-20T02:30:00.000Z',
          endTime: '2026-11-20T03:30:00.000Z',
        },
        {
          id: COLOR_LINE_ID,
          staffId: OTHER_STAFF_MEMBER_ID,
          startTime: '2026-11-20T03:30:00.000Z',
          endTime: '2026-11-20T05:00:00.000Z',
        },
        {
          id: HEAD_SPA_LINE_ID,
          staffId: null,
          startTime: '2026-11-20T05:00:00.000Z',
          endTime: '2026-11-20T05:30:00.000Z',
        },
      ],
    })
  })

  it.each([
    ['Asia/Tokyo', '2026-11-20T14:59:00Z', '2026-11-20'],
    ['Asia/Tokyo', '2026-11-20T15:00:00Z', '2026-11-21'],
    ['America/New_York', '2026-11-20T04:59:00Z', '2026-11-19'],
    ['America/New_York', '2026-11-20T05:00:00Z', '2026-11-20'],
    ['UTC', '2026-11-20T23:59:00Z', '2026-11-20'],
    ['+09:00', '2026-11-20T15:00:00Z', '2026-11-21'],
  ])(
    'tells the day of the visit in the time zone of the salon: in %s, %s is %s',
    (timezone, startTime, bookingDate) => {
      const { write } = planned(
        booking(),
        request(startTime),
        references({ timezone }),
      )

      expect(write.booking.bookingDate).toBe(bookingDate)
    },
  )

  it.each(['Tokyo', '', 'JST+9'])(
    'does not plan a move in a salon whose time zone, %j, is not known',
    (timezone) => {
      expect(
        planReschedule(moved(booking(), request()), references({ timezone })),
      ).toEqual({ type: 'timeZoneUnknown' })
    },
  )

  it('says whom the booking occupies when: each staff member with the times of their lines', () => {
    const { demands } = planned(booking(), request('2026-11-20T02:30:00Z'))

    expect(demands).toEqual([
      {
        staff: member(STAFF_MEMBER_ID),
        times: [{ startTime: at('02:30'), endTime: at('03:30') }],
      },
      {
        staff: member(OTHER_STAFF_MEMBER_ID),
        times: [{ startTime: at('03:30'), endTime: at('05:00') }],
      },
    ])
  })

  it('demands the staff member who takes over for every line they have then', () => {
    const { demands } = planned(
      booking(),
      request('2026-11-20T01:00:00Z', OTHER_STAFF_MEMBER_ID),
    )

    expect(demands).toEqual([
      {
        staff: member(OTHER_STAFF_MEMBER_ID),
        times: [
          { startTime: at('01:00'), endTime: at('02:00') },
          { startTime: at('02:00'), endTime: at('03:30') },
        ],
      },
    ])
  })

  it('demands nobody for a staff member in charge who has no line', () => {
    const { demands } = planned(
      booking({ staffId: THIRD_STAFF_MEMBER_ID }),
      request(undefined, THIRD_STAFF_MEMBER_ID),
    )

    expect(demands.map(({ staff }) => staff.id)).toEqual([
      STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
    ])
  })

  it.each([
    [
      'is not among the staff members of the salon',
      references({ staff: [member(OTHER_STAFF_MEMBER_ID)] }),
    ],
    [
      'was deleted',
      references({
        staff: [
          member(STAFF_MEMBER_ID, { isDeleted: true }),
          member(OTHER_STAFF_MEMBER_ID),
        ],
      }),
    ],
  ])('does not plan a move to a staff member who %s', (_case, refersTo) => {
    expect(planReschedule(moved(booking(), request()), refersTo)).toEqual({
      type: 'invalid',
      issues: [
        {
          field: 'staffId',
          rule: 'not_found',
          message: 'Must name a staff member of the salon',
        },
      ],
    })
  })

  it('reports the staff member before the time zone', () => {
    expect(
      planReschedule(
        moved(booking(), request()),
        references({ timezone: 'Tokyo', staff: [] }),
      ).type,
    ).toBe('invalid')
  })

  it('plans a move that leaves a line with a staff member who was deleted, and demands them', () => {
    const { demands, write } = planned(
      booking(),
      request(),
      references({
        staff: [
          member(STAFF_MEMBER_ID),
          member(OTHER_STAFF_MEMBER_ID, { isDeleted: true }),
        ],
      }),
    )

    expect(write.services.map(({ staffId }) => staffId)).toEqual([
      STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
      null,
    ])
    expect(demands.map(({ staff }) => staff.id)).toEqual([
      STAFF_MEMBER_ID,
      OTHER_STAFF_MEMBER_ID,
    ])
  })

  it('demands nobody for a line whose staff member is not of the salon', () => {
    const { demands } = planned(
      booking(),
      request(),
      references({ staff: [member(STAFF_MEMBER_ID)] }),
    )

    expect(demands.map(({ staff }) => staff.id)).toEqual([STAFF_MEMBER_ID])
  })
})
