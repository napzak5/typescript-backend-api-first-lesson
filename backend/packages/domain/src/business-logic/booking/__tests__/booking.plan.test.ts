import {
  bookingMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  actors,
  CUSTOMER_ID,
  USER_ID,
} from '../../../__tests__/fixtures/auth-fixtures'
import {
  BOOKING_NUMBER,
  bookingCreateRequest,
  bookingReferences,
  COLOR_ID,
  CUT_ID,
} from '../../../__tests__/fixtures/booking-fixtures'
import { SALON_ID } from '../../../__tests__/fixtures/fixtures'
import {
  OTHER_STAFF_MEMBER_ID,
  STAFF_MEMBER_ID,
} from '../../../__tests__/fixtures/staff-fixtures'
import type {
  ApiBookingCreateRequest,
  DbNewBooking,
} from '../../../models/booking'
import { bookingCreateRequestSchema } from '../../../schemas/booking.schema'
import { type BookingOrigin, type BookingReferences, planBooking } from '..'

/** A third staff member, whom the references of the fixtures do not hold. */
const UNKNOWN_STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2e09'

/** A third service, which the references of the fixtures do not hold. */
const UNKNOWN_SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2c09'

const origin = (overrides: Partial<BookingOrigin> = {}): BookingOrigin => ({
  bookingNumber: BOOKING_NUMBER,
  createdBy: actors.admin.userId,
  client: { ipAddress: '203.0.113.7', userAgent: 'SalonApp/1.0' },
  ...overrides,
})

type Line = ApiBookingCreateRequest['services'][number]

const line = (overrides: Partial<Line> = {}): Line => ({
  serviceId: CUT_ID,
  staffId: STAFF_MEMBER_ID,
  startTime: '2026-11-20T01:00:00Z',
  notes: null,
  ...overrides,
})

/** The request of the fixtures with these service lines. */
const withLines = (...services: Line[]): ApiBookingCreateRequest => ({
  ...bookingCreateRequest(),
  services,
})

type Service = BookingReferences['services'][number]

const service = (overrides: Partial<Service> = {}): Service => ({
  id: CUT_ID,
  duration: 60,
  price: 6600,
  discountPrice: null,
  taxIncluded: true,
  ...overrides,
})

const plan = (
  request: ApiBookingCreateRequest = bookingCreateRequest(),
  references: BookingReferences = bookingReferences(),
  from: BookingOrigin = origin(),
) => planBooking(bookingCreateRequestSchema.parse(request), references, from)

/** The plan of a request that is planned; anything else fails the test. */
const planned = (
  request: ApiBookingCreateRequest = bookingCreateRequest(),
  references: BookingReferences = bookingReferences(),
  from: BookingOrigin = origin(),
) => {
  const result = plan(request, references, from)
  if (result.type !== 'planned') {
    throw new Error(`The booking was not planned: ${result.type}`)
  }
  return result
}

/** The broken rules of a request that is refused, as `field:rule`. */
const rulesOf = (
  request: ApiBookingCreateRequest,
  references: BookingReferences,
): string[] => {
  const result = plan(request, references)
  return result.type === 'invalid'
    ? result.issues.map(({ field, rule }) => `${field}:${rule}`)
    : []
}

type Amounts = Pick<
  DbNewBooking,
  'subtotal' | 'discountAmount' | 'taxAmount' | 'totalAmount'
>

/** The amounts of a booking of these services, one line each, in a salon with that tax. */
const amountsOf = (
  services: Partial<Service>[],
  taxRate = '10.00',
): Amounts => {
  const { booking } = planned(
    withLines(
      ...services.map((_service, index) =>
        line({ serviceId: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2f0${index}` }),
      ),
    ),
    bookingReferences({
      salon: { timezone: 'Asia/Tokyo', taxRate },
      services: services.map((overrides, index) =>
        service({
          id: `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2f0${index}`,
          ...overrides,
        }),
      ),
    }),
  ).write

  return {
    subtotal: booking.subtotal,
    discountAmount: booking.discountAmount,
    taxAmount: booking.taxAmount,
    totalAmount: booking.totalAmount,
  }
}

describe('planBooking', () => {
  it('plans the booking, its service lines and the first entry of its history', () => {
    expect(plan().type).toBe('planned')
    expect(planned().write).toEqual({
      booking: {
        bookingNumber: BOOKING_NUMBER,
        salonId: SALON_ID,
        customerId: CUSTOMER_ID,
        staffId: STAFF_MEMBER_ID,
        bookingDate: '2026-11-20',
        startTime: '2026-11-20T01:00:00.000Z',
        endTime: '2026-11-20T03:30:00.000Z',
        duration: 150,
        status: 'pending',
        subtotal: 14600,
        discountAmount: 1000,
        taxAmount: 700,
        totalAmount: 14300,
        depositAmount: 1000,
        pointsUsed: null,
        pointsEarned: null,
        customerRequest: '前回と同じ長さで',
        internalNotes: '電話で受付',
        reminderSent: false,
        reminderSentAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        cancellationFee: null,
        completedAt: null,
        actualStartTime: null,
        actualEndTime: null,
        source: 'phone',
        ipAddress: '203.0.113.7',
        userAgent: 'SalonApp/1.0',
      },
      services: [
        {
          serviceId: CUT_ID,
          staffId: STAFF_MEMBER_ID,
          startTime: '2026-11-20T01:00:00.000Z',
          endTime: '2026-11-20T02:00:00.000Z',
          duration: 60,
          price: 6600,
          discountAmount: 0,
          finalPrice: 6600,
          taxIncluded: true,
          isCompleted: false,
          completedAt: null,
          notes: null,
          sortOrder: 0,
        },
        {
          serviceId: COLOR_ID,
          staffId: OTHER_STAFF_MEMBER_ID,
          startTime: '2026-11-20T02:00:00.000Z',
          endTime: '2026-11-20T03:30:00.000Z',
          duration: 90,
          price: 8000,
          discountAmount: 1000,
          finalPrice: 7000,
          taxIncluded: false,
          isCompleted: false,
          completedAt: null,
          notes: '明るめ',
          sortOrder: 1,
        },
      ],
      statusChange: {
        fromStatus: null,
        toStatus: 'pending',
        changedBy: USER_ID,
        reason: null,
        metadata: null,
      },
    })
  })

  it('keeps what the request leaves unset as null', () => {
    const { booking, services } = planned({
      ...bookingCreateRequest(),
      depositAmount: null,
      customerRequest: null,
      internalNotes: null,
      source: null,
      services: [line({ staffId: null, notes: null })],
    }).write

    expect(booking).toMatchObject({
      depositAmount: null,
      customerRequest: null,
      internalNotes: null,
      source: null,
    })
    expect(services).toMatchObject([{ staffId: null, notes: null }])
  })

  it('keeps where the booking was made from, also when nothing is known of it', () => {
    const from = origin({
      bookingNumber: 'BK-0000-0001',
      client: { ipAddress: null, userAgent: null },
    })

    expect(
      planned(bookingCreateRequest(), bookingReferences(), from).write.booking,
    ).toMatchObject({
      bookingNumber: 'BK-0000-0001',
      ipAddress: null,
      userAgent: null,
    })
  })

  it('names who entered the booking in the first entry of its history', () => {
    const from = origin({ createdBy: actors.ofSalon('staff').userId })

    expect(
      planned(bookingCreateRequest(), bookingReferences(), from).write
        .statusChange,
    ).toEqual({
      fromStatus: null,
      toStatus: 'pending',
      changedBy: actors.ofSalon('staff').userId,
      reason: null,
      metadata: null,
    })
  })

  describe('the service lines', () => {
    it.each([
      ['no discounted price', { price: 6600, discountPrice: null }, 0, 6600],
      ['a discounted price', { price: 6600, discountPrice: 5000 }, 1600, 5000],
      [
        'a discounted price that is the price',
        { price: 6600, discountPrice: 6600 },
        0,
        6600,
      ],
      [
        'a discounted price of nothing',
        { price: 6600, discountPrice: 0 },
        6600,
        0,
      ],
      ['a price of nothing', { price: 0, discountPrice: null }, 0, 0],
    ])(
      'take their amounts from a service with %s',
      (_case, amounts, discountAmount, finalPrice) => {
        const { services } = planned(
          withLines(line()),
          bookingReferences({ services: [service(amounts)] }),
        ).write

        expect(services).toMatchObject([
          { price: amounts.price, discountAmount, finalPrice },
        ])
      },
    )

    it.each([
      ['a minute', 1, '2026-11-20T01:01:00.000Z'],
      ['an hour and a half', 90, '2026-11-20T02:30:00.000Z'],
      ['a time that ends on the next day', 24 * 60, '2026-11-21T01:00:00.000Z'],
    ])('end when their service is over: %s', (_case, duration, endTime) => {
      const { services } = planned(
        withLines(line()),
        bookingReferences({ services: [service({ duration })] }),
      ).write

      expect(services).toMatchObject([{ duration, endTime }])
    })

    it('are numbered from 0 in the order of the request, whenever they begin', () => {
      const { services } = planned(
        withLines(
          line({ startTime: '2026-11-20T03:00:00Z', notes: 'last' }),
          line({ startTime: '2026-11-20T01:00:00Z', notes: 'first' }),
          line({ startTime: '2026-11-20T02:00:00Z', notes: 'second' }),
        ),
      ).write

      expect(
        services.map(({ sortOrder, notes }) => [sortOrder, notes]),
      ).toEqual([
        [0, 'last'],
        [1, 'first'],
        [2, 'second'],
      ])
    })

    it('are one for every line of the request, also for the same service twice', () => {
      const { services } = planned(withLines(line(), line(), line())).write

      expect(services.map(({ serviceId }) => serviceId)).toEqual([
        CUT_ID,
        CUT_ID,
        CUT_ID,
      ])
    })
  })

  describe('the time of the booking', () => {
    it('is from the earliest start to the latest end of its services', () => {
      const { booking } = planned(
        withLines(
          line({ serviceId: CUT_ID, startTime: '2026-11-20T02:00:00Z' }),
          // 90 minutes from 00:45: over before the cut is.
          line({ serviceId: COLOR_ID, startTime: '2026-11-20T00:45:00Z' }),
        ),
      ).write

      expect(booking).toMatchObject({
        startTime: '2026-11-20T00:45:00.000Z',
        endTime: '2026-11-20T03:00:00.000Z',
        duration: 135,
      })
    })

    it('ends with the service that ends last, which need not begin last', () => {
      const { booking } = planned(
        withLines(
          // 90 minutes from 01:00.
          line({ serviceId: COLOR_ID, startTime: '2026-11-20T01:00:00Z' }),
          // 60 minutes from 01:15.
          line({ serviceId: CUT_ID, startTime: '2026-11-20T01:15:00Z' }),
        ),
      ).write

      expect(booking).toMatchObject({
        startTime: '2026-11-20T01:00:00.000Z',
        endTime: '2026-11-20T02:30:00.000Z',
        duration: 90,
      })
    })

    it('includes the time between two services', () => {
      const { booking } = planned(
        withLines(
          line({ startTime: '2026-11-20T01:00:00Z' }),
          line({ startTime: '2026-11-20T05:00:00Z' }),
        ),
      ).write

      expect(booking.duration).toBe(300)
    })

    it.each([
      [
        'the morning in Tokyo',
        'Asia/Tokyo',
        '2026-11-20T01:00:00Z',
        '2026-11-20',
      ],
      [
        'the last minute of a day in Tokyo',
        'Asia/Tokyo',
        '2026-11-20T14:59:00Z',
        '2026-11-20',
      ],
      ['midnight in Tokyo', 'Asia/Tokyo', '2026-11-20T15:00:00Z', '2026-11-21'],
      [
        'the evening before in New York',
        'America/New_York',
        '2026-11-20T01:00:00Z',
        '2026-11-19',
      ],
      [
        'summer time in New York',
        'America/New_York',
        '2026-07-01T03:59:00Z',
        '2026-06-30',
      ],
      [
        'midnight of summer time in New York',
        'America/New_York',
        '2026-07-01T04:00:00Z',
        '2026-07-01',
      ],
      ['UTC', 'UTC', '2026-11-20T23:59:00Z', '2026-11-20'],
      [
        'an offset, which a salon could have before its time zone had to be a name',
        '+09:00',
        '2026-11-20T15:00:00Z',
        '2026-11-21',
      ],
    ])(
      'has the day of the visit as it is in the salon: %s',
      (_case, timezone, startTime, bookingDate) => {
        const { booking } = planned(
          withLines(line({ startTime })),
          bookingReferences({ salon: { timezone, taxRate: '10.00' } }),
        ).write

        expect(booking.bookingDate).toBe(bookingDate)
      },
    )

    it('has the day on which the first service begins, when the visit passes midnight', () => {
      const { booking } = planned(
        withLines(
          line({ startTime: '2026-11-20T14:30:00Z' }),
          line({ startTime: '2026-11-20T15:30:00Z' }),
        ),
      ).write

      expect(booking.bookingDate).toBe('2026-11-20')
    })

    it.each(['Mars/Olympus', '', ' ', '0'])(
      'cannot tell the day in a time zone that is not known: "%s"',
      (timezone) => {
        expect(
          plan(
            bookingCreateRequest(),
            bookingReferences({ salon: { timezone, taxRate: '10.00' } }),
          ),
        ).toEqual({ type: 'timeZoneUnknown' })
      },
    )
  })

  describe('the amounts of the booking', () => {
    it('are the sums of the service lines', () => {
      expect(
        amountsOf([
          { price: 6600, discountPrice: null },
          { price: 8000, discountPrice: 7000 },
          { price: 3000, discountPrice: 0 },
        ]),
      ).toEqual({
        subtotal: 17600,
        discountAmount: 4000,
        taxAmount: 0,
        totalAmount: 13600,
      })
    })

    it('add the tax to the services whose price is without it, on what is left after the discount', () => {
      expect(
        amountsOf([
          { price: 6600, taxIncluded: true },
          { price: 8000, discountPrice: 7000, taxIncluded: false },
        ]),
      ).toEqual({
        subtotal: 14600,
        discountAmount: 1000,
        taxAmount: 700,
        totalAmount: 14300,
      })
    })

    it('add no tax when every price has it', () => {
      expect(amountsOf([{ price: 6600 }, { price: 8000 }]).taxAmount).toBe(0)
    })

    it.each([
      ['999 yen at 10%', 999, '10.00', 99],
      ['9 yen at 10%', 9, '10.00', 0],
      ['10 yen at 10%', 10, '10.00', 1],
      ['1,000 yen at 8%', 1000, '8.00', 80],
      ['1,234 yen at 8%', 1234, '8.00', 98],
      ['1,000 yen at 0%', 1000, '0.00', 0],
      ['1,000 yen at 10.5%', 1000, '10.50', 105],
      ['199 yen at 0.01%', 199, '0.01', 0],
      ['10,000 yen at 0.01%', 10000, '0.01', 1],
      ['1,000 yen at 100%', 1000, '100.00', 1000],
      ['3 yen at 33.33%', 3, '33.33', 0],
      ['7 yen at 14.29%', 7, '14.29', 1],
      // 1.15 and 9.95 times 100 are a little less than 115 and 995 as floats.
      ['10,000 yen at 1.15%', 10000, '1.15', 115],
      ['10,000 yen at 9.95%', 10000, '9.95', 995],
    ])(
      'drop the fraction of a yen of the tax: %s',
      (_case, price, taxRate, taxAmount) => {
        expect(amountsOf([{ price, taxIncluded: false }], taxRate)).toEqual({
          subtotal: price,
          discountAmount: 0,
          taxAmount,
          totalAmount: price + taxAmount,
        })
      },
    )

    it('round the tax once for the booking and not for every line', () => {
      // 10% of 15 yen is 1.5 yen: 1 yen for each line, 3 yen for the two.
      expect(
        amountsOf([
          { price: 15, taxIncluded: false },
          { price: 15, taxIncluded: false },
        ]).taxAmount,
      ).toBe(3)
    })

    it('compute the tax of large amounts exactly', () => {
      // 1,900,000,001 × 10.01% = 190,190,000.1001
      expect(
        amountsOf([{ price: 1_900_000_001, taxIncluded: false }], '10.01'),
      ).toEqual({
        subtotal: 1_900_000_001,
        discountAmount: 0,
        taxAmount: 190_190_000,
        totalAmount: 2_090_190_001,
      })
    })

    it('may be as much as the columns hold', () => {
      expect(
        amountsOf([{ price: 2_000_000_000 }, { price: 147_483_647 }])
          .totalAmount,
      ).toBe(2_147_483_647)
    })

    it('are refused when the prices are more than the columns hold together', () => {
      const request = withLines(line(), line({ serviceId: COLOR_ID }))
      const references = bookingReferences({
        services: [
          service({ id: CUT_ID, price: 2_000_000_000 }),
          service({ id: COLOR_ID, price: 147_483_648 }),
        ],
      })

      expect(plan(request, references)).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'services',
            rule: 'too_big',
            message: bookingMessages.amountsWithinLimit(2147483647),
          },
        ],
      })
    })

    it('are refused when the prices are more than the columns hold, also when the discounts bring the total below that', () => {
      const references = bookingReferences({
        services: [
          service({ id: CUT_ID, price: 2_000_000_000, discountPrice: 0 }),
          service({ id: COLOR_ID, price: 147_483_648, discountPrice: 0 }),
        ],
      })

      expect(
        rulesOf(withLines(line(), line({ serviceId: COLOR_ID })), references),
      ).toEqual(['services:too_big'])
    })

    it('are refused when the tax takes the total over what the column holds', () => {
      const references = bookingReferences({
        services: [
          service({ id: CUT_ID, price: 2_000_000_000, taxIncluded: false }),
        ],
      })

      expect(rulesOf(withLines(line()), references)).toEqual([
        'services:too_big',
      ])
    })
  })

  describe('what the request refers to', () => {
    it('reports a salon that is not there, and nothing of what would belong to it', () => {
      expect(
        rulesOf(
          {
            ...bookingCreateRequest(),
            staffId: UNKNOWN_STAFF_ID,
            services: [
              line({
                serviceId: UNKNOWN_SERVICE_ID,
                staffId: UNKNOWN_STAFF_ID,
              }),
            ],
          },
          bookingReferences({ salon: null, staff: [], services: [] }),
        ),
      ).toEqual(['salonId:not_found'])
    })

    it('reports the customer next to the salon: a customer belongs to no salon', () => {
      expect(
        rulesOf(
          bookingCreateRequest(),
          bookingReferences({ salon: null, customerExists: false }),
        ),
      ).toEqual(['salonId:not_found', 'customerId:not_found'])
    })

    it('reports a customer who is not there', () => {
      expect(
        rulesOf(
          bookingCreateRequest(),
          bookingReferences({ customerExists: false }),
        ),
      ).toEqual(['customerId:not_found'])
    })

    it('reports a staff member in charge who is not of the salon', () => {
      expect(
        rulesOf(
          { ...bookingCreateRequest(), staffId: UNKNOWN_STAFF_ID },
          bookingReferences(),
        ),
      ).toEqual(['staffId:not_found'])
    })

    it('reports a service that is not of the salon under its line', () => {
      expect(
        rulesOf(
          withLines(
            line(),
            line({ serviceId: UNKNOWN_SERVICE_ID }),
            line({ serviceId: COLOR_ID }),
            line({ serviceId: UNKNOWN_SERVICE_ID }),
          ),
          bookingReferences(),
        ),
      ).toEqual([
        'services.1.serviceId:not_found',
        'services.3.serviceId:not_found',
      ])
    })

    it('reports a staff member of a service who is not of the salon under its line', () => {
      expect(
        rulesOf(
          withLines(
            line(),
            line({ staffId: UNKNOWN_STAFF_ID }),
            line({ staffId: null }),
          ),
          bookingReferences(),
        ),
      ).toEqual(['services.1.staffId:not_found'])
    })

    it('reports everything that is not there at once, in the order of the request', () => {
      const result = plan(
        {
          ...bookingCreateRequest(),
          staffId: UNKNOWN_STAFF_ID,
          services: [
            line({ serviceId: UNKNOWN_SERVICE_ID, staffId: UNKNOWN_STAFF_ID }),
            line(),
          ],
        },
        bookingReferences({ customerExists: false }),
      )

      expect(result).toEqual({
        type: 'invalid',
        issues: [
          {
            field: 'customerId',
            rule: 'not_found',
            message: ruleMessages.aCustomer,
          },
          {
            field: 'staffId',
            rule: 'not_found',
            message: ruleMessages.aStaffMemberOfSalon,
          },
          {
            field: 'services.0.serviceId',
            rule: 'not_found',
            message: ruleMessages.aServiceOfSalon,
          },
          {
            field: 'services.0.staffId',
            rule: 'not_found',
            message: ruleMessages.aStaffMemberOfSalon,
          },
        ],
      })
    })

    it('says that it is a salon that the request must name', () => {
      expect(
        plan(bookingCreateRequest(), bookingReferences({ salon: null })),
      ).toEqual({
        type: 'invalid',
        issues: [
          { field: 'salonId', rule: 'not_found', message: ruleMessages.aSalon },
        ],
      })
    })

    it('is looked at before the time zone and the amounts', () => {
      expect(
        rulesOf(
          withLines(line({ serviceId: UNKNOWN_SERVICE_ID })),
          bookingReferences({
            salon: { timezone: 'Mars/Olympus', taxRate: '10.00' },
          }),
        ),
      ).toEqual(['services.0.serviceId:not_found'])
    })
  })

  describe('whom the booking occupies', () => {
    it('is the staff member of each service line, for the time of the line', () => {
      expect(planned().demands).toEqual([
        {
          staff: {
            id: STAFF_MEMBER_ID,
            bufferTimeBefore: 10,
            bufferTimeAfter: 15,
            maxConcurrentBookings: 1,
          },
          times: [
            {
              startTime: new Date('2026-11-20T01:00:00.000Z'),
              endTime: new Date('2026-11-20T02:00:00.000Z'),
            },
          ],
        },
        {
          staff: {
            id: OTHER_STAFF_MEMBER_ID,
            bufferTimeBefore: 10,
            bufferTimeAfter: 15,
            maxConcurrentBookings: 1,
          },
          times: [
            {
              startTime: new Date('2026-11-20T02:00:00.000Z'),
              endTime: new Date('2026-11-20T03:30:00.000Z'),
            },
          ],
        },
      ])
    })

    it('is not the staff member in charge while no line is theirs', () => {
      const { demands } = planned(
        withLines(line({ staffId: OTHER_STAFF_MEMBER_ID })),
      )

      expect(demands.map(({ staff }) => staff.id)).toEqual([
        OTHER_STAFF_MEMBER_ID,
      ])
    })

    it('is nobody for a line without a staff member', () => {
      expect(planned(withLines(line({ staffId: null }))).demands).toEqual([])
    })

    it('is a staff member once, with the times of all their lines', () => {
      const { demands } = planned(
        withLines(
          line({ startTime: '2026-11-20T01:00:00Z' }),
          line({ staffId: null, startTime: '2026-11-20T02:00:00Z' }),
          line({ startTime: '2026-11-20T04:00:00Z' }),
        ),
      )

      expect(demands).toHaveLength(1)
      expect(demands[0]?.times).toEqual([
        {
          startTime: new Date('2026-11-20T01:00:00.000Z'),
          endTime: new Date('2026-11-20T02:00:00.000Z'),
        },
        {
          startTime: new Date('2026-11-20T04:00:00.000Z'),
          endTime: new Date('2026-11-20T05:00:00.000Z'),
        },
      ])
    })
  })
})
