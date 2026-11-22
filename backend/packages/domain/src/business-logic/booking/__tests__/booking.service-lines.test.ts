import { describe, expect, it } from 'vitest'
import { COLOR_ID, CUT_ID } from '../../../__tests__/fixtures/booking-fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import type { DbBooking } from '../../../models/booking'
import {
  type BookingServiceCreateRequest,
  bookingServiceCreateRequestSchema,
} from '../../../schemas/booking.schema'
import {
  type BookingOfLines,
  planServiceAddition,
  planServiceRemoval,
  type ServiceLineReferences,
} from '..'

type Status = DbBooking['status']
type Line = BookingOfLines['services'][number]
type Salon = ServiceLineReferences['salon']

const CUT_LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d01'
const COLOR_LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d02'
const UNKNOWN_LINE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d09'

const UNFINISHED: Status[] = ['draft', 'pending', 'confirmed', 'in_progress']
const FINISHED: Status[] = ['completed', 'cancelled', 'no_show']

/** A time of a day of November 2026 in UTC, `HH:MM`; ten in the morning in Tokyo is 01:00. */
const at = (time: string, day = '20'): Date =>
  new Date(`2026-11-${day}T${time}:00.000Z`)

/** The same time as a request writes it. */
const asked = (time: string, day = '20'): string => `2026-11-${day}T${time}:00Z`

/** The same time as a row is written with it. */
const written = (time: string, day = '20'): string =>
  `2026-11-${day}T${time}:00.000Z`

/** The cut of the booking: from ten in Tokyo, 6,600 yen with the tax in it. */
const cutLine = (overrides: Partial<Line> = {}): Line => ({
  id: CUT_LINE_ID,
  sortOrder: 0,
  startTime: at('01:00'),
  endTime: at('02:00'),
  price: 6600,
  discountAmount: 0,
  finalPrice: 6600,
  taxIncluded: true,
  ...overrides,
})

/** The colouring of the booking: right after the cut, 8,000 yen discounted to 7,000, the tax not in it. */
const colorLine = (overrides: Partial<Line> = {}): Line => ({
  id: COLOR_LINE_ID,
  sortOrder: 1,
  startTime: at('02:00'),
  endTime: at('03:30'),
  price: 8000,
  discountAmount: 1000,
  finalPrice: 7000,
  taxIncluded: false,
  ...overrides,
})

/** The booking of the fixtures as a change of its lines looks at it. */
const booking = (overrides: Partial<BookingOfLines> = {}): BookingOfLines => ({
  status: 'pending',
  services: [cutLine(), colorLine()],
  ...overrides,
})

/** A request that keeps every rule: another cut by the staff member, right after the colouring. */
const request = (
  overrides: Record<string, unknown> = {},
): BookingServiceCreateRequest =>
  bookingServiceCreateRequestSchema.parse({
    serviceId: CUT_ID,
    staffId: STAFF_MEMBER_ID,
    startTime: asked('03:30'),
    notes: null,
    ...overrides,
  })

const tokyo: Salon = { timezone: 'Asia/Tokyo', taxRate: '10.00' }

const cut = {
  id: CUT_ID,
  duration: 60,
  price: 6600,
  discountPrice: null,
  taxIncluded: true,
}

const color = {
  id: COLOR_ID,
  duration: 90,
  price: 8000,
  discountPrice: 7000,
  taxIncluded: false,
}

const member = {
  id: STAFF_MEMBER_ID,
  bufferTimeBefore: 10,
  bufferTimeAfter: 15,
  maxConcurrentBookings: 1,
}

/** What the request above refers to: the salon in Tokyo with a tax of 10%, the cut and the staff member. */
const references = (
  overrides: Partial<ServiceLineReferences> = {},
): ServiceLineReferences => ({
  salon: tokyo,
  service: cut,
  staff: member,
  ...overrides,
})

/** The plan of an addition that is planned; anything else fails the test. */
const added = (
  to: BookingOfLines = booking(),
  line: BookingServiceCreateRequest = request(),
  refersTo: ServiceLineReferences = references(),
) => {
  const plan = planServiceAddition(to, line, refersTo)
  if (plan.type !== 'planned') {
    throw new Error(`The addition was not planned: ${plan.type}`)
  }
  return plan
}

/** The plan of a removal that is planned; anything else fails the test. */
const removed = (
  from: BookingOfLines,
  lineId: string,
  salon: Salon = tokyo,
) => {
  const plan = planServiceRemoval(from, lineId, salon)
  if (plan.type !== 'planned') {
    throw new Error(`The removal was not planned: ${plan.type}`)
  }
  return plan
}

/** As many lines nobody is named for as a booking is to have, an hour each from ten in Tokyo. */
const lines = (count: number): Line[] =>
  Array.from({ length: count }, (_unused, index) =>
    cutLine({
      id: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2e${String(index).padStart(2, '0')}`,
      sortOrder: index,
    }),
  )

describe('planServiceAddition', () => {
  it('plans the row of the line, a copy of its service, after the lines the booking has', () => {
    const plan = added(
      booking(),
      request({
        serviceId: COLOR_ID,
        staffId: OTHER_STAFF_MEMBER_ID,
        notes: '明るめ',
      }),
      references({
        service: color,
        staff: { ...member, id: OTHER_STAFF_MEMBER_ID },
      }),
    )

    expect(plan.service).toEqual({
      serviceId: COLOR_ID,
      staffId: OTHER_STAFF_MEMBER_ID,
      startTime: written('03:30'),
      endTime: written('05:00'),
      duration: 90,
      price: 8000,
      discountAmount: 1000,
      finalPrice: 7000,
      taxIncluded: false,
      isCompleted: false,
      completedAt: null,
      notes: '明るめ',
      sortOrder: 2,
    })
  })

  it('says of the booking what its lines say together with the new one', () => {
    expect(added().booking).toEqual({
      bookingDate: '2026-11-20',
      startTime: written('01:00'),
      endTime: written('04:30'),
      duration: 210,
      subtotal: 21200,
      discountAmount: 1000,
      taxAmount: 700,
      totalAmount: 20900,
    })
  })

  it('occupies the staff member of the line for the time of the line, and no one for the lines the booking has', () => {
    expect(added().demands).toEqual([
      {
        staff: member,
        times: [{ startTime: at('03:30'), endTime: at('04:30') }],
      },
    ])
  })

  it('occupies no one for a line nobody is named for', () => {
    const plan = added(
      booking(),
      request({ staffId: null }),
      references({ staff: null }),
    )

    expect(plan.service.staffId).toBeNull()
    expect(plan.demands).toEqual([])
  })

  it.each([
    ['after the last line', [0, 1], 2],
    ['after the last line, whatever order the lines come in', [5, 2], 6],
    ['after the last line, not in a place a removed line left', [0, 3], 4],
  ])('puts the line %s', (_case, places, next) => {
    const [first = 0, second = 0] = places

    const plan = added(
      booking({
        services: [
          cutLine({ sortOrder: first }),
          colorLine({ sortOrder: second }),
        ],
      }),
    )

    expect(plan.service.sortOrder).toBe(next)
  })

  it('puts the line first in a booking that has none, and sums the booking up from it alone', () => {
    const plan = added(booking({ services: [] }))

    expect(plan.service.sortOrder).toBe(0)
    expect(plan.booking).toEqual({
      bookingDate: '2026-11-20',
      startTime: written('03:30'),
      endTime: written('04:30'),
      duration: 60,
      subtotal: 6600,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 6600,
    })
  })

  describe('the time of the visit', () => {
    it('begins with the line when it is before the others, on the day that is then in the time zone of the salon', () => {
      // Half past eleven in the evening of the 19th in Tokyo.
      const plan = added(
        booking(),
        request({ startTime: asked('14:30', '19') }),
      )

      expect(plan.booking).toMatchObject({
        bookingDate: '2026-11-19',
        startTime: written('14:30', '19'),
        endTime: written('03:30'),
        duration: 780,
      })
    })

    it('is as it was when the line is within it', () => {
      const plan = added(booking(), request({ startTime: asked('01:30') }))

      expect(plan.booking).toMatchObject({
        startTime: written('01:00'),
        endTime: written('03:30'),
        duration: 150,
      })
    })

    it('is told by the time zone the salon has', () => {
      const plan = added(
        booking(),
        request(),
        references({
          salon: { timezone: 'America/New_York', taxRate: '10.00' },
        }),
      )

      // Ten in the morning in Tokyo is eight in the evening before in New York.
      expect(plan.booking.bookingDate).toBe('2026-11-19')
    })
  })

  describe('the amounts of the booking', () => {
    it('add the tax once to the lines that do not include it, the fraction of a yen dropped', () => {
      const treatment = { ...cut, price: 995, taxIncluded: false }
      const one = added(
        booking({ services: [cutLine()] }),
        request(),
        references({ service: treatment }),
      )
      const two = added(
        booking({
          services: [
            cutLine(),
            cutLine({
              id: COLOR_LINE_ID,
              sortOrder: 1,
              price: 995,
              finalPrice: 995,
              taxIncluded: false,
            }),
          ],
        }),
        request(),
        references({ service: treatment }),
      )

      // A tenth of 995 yen is 99.5 yen; a tenth of 1,990 yen is 199 yen, not twice 99.
      expect(one.booking).toMatchObject({ taxAmount: 99, totalAmount: 7694 })
      expect(two.booking).toMatchObject({
        subtotal: 8590,
        taxAmount: 199,
        totalAmount: 8789,
      })
    })

    it('tax the lines the booking has by the rate the salon has now', () => {
      const plan = added(
        booking(),
        request(),
        references({ salon: { timezone: 'Asia/Tokyo', taxRate: '8.00' } }),
      )

      // 8% of the 7,000 yen of the colouring.
      expect(plan.booking).toMatchObject({ taxAmount: 560, totalAmount: 20760 })
    })

    it('add the tax to what is left of a price after its discount', () => {
      const plan = added(
        booking({ services: [cutLine()] }),
        request(),
        references({ service: color }),
      )

      expect(plan.booking).toMatchObject({
        subtotal: 14600,
        discountAmount: 1000,
        taxAmount: 700,
        totalAmount: 14300,
      })
    })
  })

  describe('what rules a line out', () => {
    it.each(UNFINISHED)(
      'is not the status of a booking that is %s',
      (status) => {
        expect(
          planServiceAddition(booking({ status }), request(), references())
            .type,
        ).toBe('planned')
      },
    )

    it.each(FINISHED)('is the status of a booking that is %s', (status) => {
      expect(
        planServiceAddition(booking({ status }), request(), references()),
      ).toEqual({ type: 'statusDoesNotAllow', status, allowed: UNFINISHED })
    })

    it('is a twenty-first line, and not a twentieth', () => {
      const twentieth = planServiceAddition(
        booking({ services: lines(19) }),
        request(),
        references(),
      )
      const twentyFirst = planServiceAddition(
        booking({ services: lines(20) }),
        request(),
        references(),
      )

      expect(twentieth.type).toBe('planned')
      expect(twentyFirst).toEqual({ type: 'tooManyServices', limit: 20 })
    })

    // The booking has lines from 01:00 and from 02:00 of the 20th.
    it.each([
      ['24 hours after the earliest', asked('01:00', '21'), 'planned'],
      [
        'a minute more than 24 hours after the earliest',
        asked('01:01', '21'),
        'visitTooLong',
      ],
      ['24 hours before the latest', asked('02:00', '19'), 'planned'],
      [
        'a minute more than 24 hours before the latest',
        asked('01:59', '19'),
        'visitTooLong',
      ],
    ])('is a line that begins %s, or is not', (_case, startTime, type) => {
      const plan = planServiceAddition(
        booking(),
        request({ startTime }),
        references(),
      )

      expect(plan.type).toBe(type)
    })

    it('says how long a visit may be', () => {
      expect(
        planServiceAddition(
          booking(),
          request({ startTime: asked('01:01', '21') }),
          references(),
        ),
      ).toEqual({ type: 'visitTooLong', hours: 24 })
    })

    it('measures the visit by where the lines begin, not by where they end', () => {
      const plan = planServiceAddition(
        booking({
          services: [cutLine({ endTime: at('01:00', '21') })],
        }),
        request({ startTime: asked('01:00', '21') }),
        references(),
      )

      expect(plan.type).toBe('planned')
    })

    it('is a service that is not one of the salon', () => {
      expect(
        planServiceAddition(
          booking(),
          request(),
          references({ service: null }),
        ),
      ).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'serviceId',
            rule: 'not_found',
            message: 'Must name a service of the salon',
          },
        ],
      })
    })

    it('is a staff member who is named and is not one of the salon', () => {
      expect(
        planServiceAddition(booking(), request(), references({ staff: null })),
      ).toEqual({
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

    it('is both at once, the service first', () => {
      const plan = planServiceAddition(
        booking(),
        request(),
        references({ service: null, staff: null }),
      )

      expect(
        plan.type === 'invalid'
          ? plan.issues.map(({ field, rule }) => `${field}:${rule}`)
          : [],
      ).toEqual(['serviceId:not_found', 'staffId:not_found'])
    })

    it.each(['Mars/Olympus', '', ' ', '0'])(
      'is a time zone of the salon that is not known: %j',
      (timezone) => {
        expect(
          planServiceAddition(
            booking(),
            request(),
            references({ salon: { timezone, taxRate: '10.00' } }),
          ),
        ).toEqual({ type: 'timeZoneUnknown' })
      },
    )

    // With the 6,600 yen of the cut and the 8,000 yen of the colouring, of
    // which 1,000 yen are taken off and to which 700 yen of tax are added.
    it.each([
      [
        'is prices that are a yen more than a booking holds',
        2_147_469_048,
        true,
        'amountsTooBig',
      ],
      [
        'is not prices that are as much as a booking holds',
        2_147_469_047,
        true,
        'planned',
      ],
      [
        'is a tax that takes the total over what a booking holds',
        1_952_255_000,
        false,
        'amountsTooBig',
      ],
    ])('%s', (_case, price, taxIncluded, type) => {
      const plan = planServiceAddition(
        booking(),
        request(),
        references({ service: { ...cut, price, taxIncluded } }),
      )

      expect(plan.type).toBe(type)
    })
  })

  describe('what is looked at first', () => {
    const full = lines(20)
    const tooLate = request({ startTime: asked('01:01', '21') })
    const nothing = references({
      salon: { timezone: 'Mars/Olympus', taxRate: '10.00' },
      service: null,
      staff: null,
    })
    const tooDear = { ...cut, price: 2_147_480_000 }

    it('is the status, before the number of the lines', () => {
      expect(
        planServiceAddition(
          booking({ status: 'completed', services: full }),
          tooLate,
          nothing,
        ).type,
      ).toBe('statusDoesNotAllow')
    })

    it('then the number of the lines, before the time of the visit', () => {
      expect(
        planServiceAddition(booking({ services: full }), tooLate, nothing).type,
      ).toBe('tooManyServices')
    })

    it('then the time of the visit, before what the line refers to', () => {
      expect(planServiceAddition(booking(), tooLate, nothing).type).toBe(
        'visitTooLong',
      )
    })

    it('then what the line refers to, before the time zone', () => {
      expect(planServiceAddition(booking(), request(), nothing).type).toBe(
        'invalid',
      )
    })

    it('then the time zone, before the amounts', () => {
      expect(
        planServiceAddition(
          booking(),
          request(),
          references({
            salon: { timezone: 'Mars/Olympus', taxRate: '10.00' },
            service: tooDear,
          }),
        ).type,
      ).toBe('timeZoneUnknown')
    })
  })
})

describe('planServiceRemoval', () => {
  it('says of the booking what the lines that stay say together', () => {
    const third = cutLine({
      id: UNKNOWN_LINE_ID,
      sortOrder: 2,
      startTime: at('03:30'),
      endTime: at('04:30'),
    })
    const visit = booking({ services: [cutLine(), colorLine(), third] })

    expect(removed(visit, COLOR_LINE_ID).booking).toEqual({
      bookingDate: '2026-11-20',
      startTime: written('01:00'),
      endTime: written('04:30'),
      duration: 210,
      subtotal: 13200,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 13200,
    })
    expect(removed(visit, CUT_LINE_ID).booking).toEqual({
      bookingDate: '2026-11-20',
      startTime: written('02:00'),
      endTime: written('04:30'),
      duration: 150,
      subtotal: 14600,
      discountAmount: 1000,
      taxAmount: 700,
      totalAmount: 14300,
    })
    expect(removed(visit, UNKNOWN_LINE_ID).booking).toEqual({
      bookingDate: '2026-11-20',
      startTime: written('01:00'),
      endTime: written('03:30'),
      duration: 150,
      subtotal: 14600,
      discountAmount: 1000,
      taxAmount: 700,
      totalAmount: 14300,
    })
  })

  it('tells the day of the visit again by the line it then begins with', () => {
    const visit = booking({
      services: [
        // Half past eleven in the evening of the 19th in Tokyo.
        cutLine({ startTime: at('14:30', '19'), endTime: at('15:30', '19') }),
        colorLine(),
      ],
    })

    expect(removed(visit, CUT_LINE_ID).booking).toMatchObject({
      bookingDate: '2026-11-20',
      startTime: written('02:00'),
    })
    expect(removed(visit, COLOR_LINE_ID).booking).toMatchObject({
      bookingDate: '2026-11-19',
      startTime: written('14:30', '19'),
    })
  })

  it('taxes the lines that stay by the rate the salon has now', () => {
    const plan = removed(booking(), CUT_LINE_ID, {
      timezone: 'Asia/Tokyo',
      taxRate: '8.00',
    })

    expect(plan.booking).toMatchObject({ taxAmount: 560, totalAmount: 7560 })
  })

  it.each(UNFINISHED)('removes a line from a booking that is %s', (status) => {
    expect(
      planServiceRemoval(booking({ status }), COLOR_LINE_ID, tokyo).type,
    ).toBe('planned')
  })

  describe('what keeps a line', () => {
    it('is that the booking has no such line', () => {
      expect(planServiceRemoval(booking(), UNKNOWN_LINE_ID, tokyo)).toEqual({
        type: 'serviceNotFound',
      })
    })

    it.each(FINISHED)('is the status of a booking that is %s', (status) => {
      expect(
        planServiceRemoval(booking({ status }), COLOR_LINE_ID, tokyo),
      ).toEqual({ type: 'statusDoesNotAllow', status, allowed: UNFINISHED })
    })

    it('is that it is the last line of the booking', () => {
      expect(
        planServiceRemoval(
          booking({ services: [colorLine()] }),
          COLOR_LINE_ID,
          tokyo,
        ),
      ).toEqual({ type: 'lastService' })
    })

    it('is a time zone of the salon that is not known', () => {
      expect(
        planServiceRemoval(booking(), COLOR_LINE_ID, {
          timezone: 'Mars/Olympus',
          taxRate: '10.00',
        }),
      ).toEqual({ type: 'timeZoneUnknown' })
    })

    it('is a tax that has become more than a booking holds', () => {
      const dear = colorLine({
        price: 1_900_000_000,
        discountAmount: 0,
        finalPrice: 1_900_000_000,
      })
      const visit = booking({ services: [cutLine(), dear] })

      expect(removed(visit, CUT_LINE_ID).booking.totalAmount).toBe(
        2_090_000_000,
      )
      expect(
        planServiceRemoval(visit, CUT_LINE_ID, {
          timezone: 'Asia/Tokyo',
          taxRate: '20.00',
        }),
      ).toEqual({ type: 'amountsTooBig' })
    })
  })

  describe('what is looked at first', () => {
    const lost: Salon = { timezone: 'Mars/Olympus', taxRate: '10.00' }

    it('is the line, before the status', () => {
      expect(
        planServiceRemoval(
          booking({ status: 'completed' }),
          UNKNOWN_LINE_ID,
          lost,
        ).type,
      ).toBe('serviceNotFound')
    })

    it('then the status, before the last line', () => {
      expect(
        planServiceRemoval(
          booking({ status: 'completed', services: [colorLine()] }),
          COLOR_LINE_ID,
          lost,
        ).type,
      ).toBe('statusDoesNotAllow')
    })

    it('then the last line, before the time zone', () => {
      expect(
        planServiceRemoval(
          booking({ services: [colorLine()] }),
          COLOR_LINE_ID,
          lost,
        ).type,
      ).toBe('lastService')
    })
  })
})
