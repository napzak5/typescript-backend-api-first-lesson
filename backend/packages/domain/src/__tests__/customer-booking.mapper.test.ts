import { describe, expect, it } from 'vitest'
import { CustomerBookingReadMapper } from '../mappers/read/customer-booking.mapper'
import { CustomerBookingWriteMapper } from '../mappers/write/customer-booking.mapper'
import {
  type ApiCustomerBookingResponse,
  bookingIdSchema,
  type CustomerReach,
  type DbBooking,
} from '../models/booking'
import { customerIdSchema } from '../models/customer'
import {
  bookingRescheduleRequestSchema,
  customerBookingSearchRequestSchema,
} from '../schemas/booking.schema'
import { CUSTOMER_ID } from './auth-fixtures'
import {
  apiBooking,
  BOOKING_ID,
  bookingWithServices,
  dbBookingServices,
  OTHER_BOOKING_ID,
} from './booking-fixtures'
import {
  apiCustomerBooking,
  apiCustomerBookingServices,
  customerBookingRequest,
} from './customer-booking-fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

const { toApiCustomerBooking, toApiCustomerBookings } =
  CustomerBookingReadMapper

/** What the ledger shows of a booking and its customer is not shown. */
const OF_THE_SALON = [
  'customerId',
  'internalNotes',
  'source',
  'reminderSent',
  'reminderSentAt',
  'actualStartTime',
  'actualEndTime',
  'cancelledBy',
  'cancellationReason',
]

/** What the ledger shows of a service line and the customer is not shown. */
const OF_THE_SALON_IN_A_LINE = ['notes', 'isCompleted', 'completedAt']

describe('CustomerBookingReadMapper.toApiCustomerBooking', () => {
  it('returns the booking as its customer is shown it, with its lines in their order', () => {
    expect(toApiCustomerBooking(bookingWithServices())).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking(),
    })
  })

  it('shows what the ledger shows, without what is the salon’s', () => {
    const ledger = apiBooking()
    const shown = apiCustomerBooking()

    expect(Object.keys(shown).toSorted()).toEqual(
      Object.keys(ledger)
        .filter((key) => !OF_THE_SALON.includes(key))
        .toSorted(),
    )
    expect(Object.keys(shown.services[0] ?? {}).toSorted()).toEqual(
      Object.keys(ledger.services[0] ?? {})
        .filter((key) => !OF_THE_SALON_IN_A_LINE.includes(key))
        .toSorted(),
    )
  })

  it('does not show what the salon noted, recorded and wrote of a cancellation, whatever it is', () => {
    const result = toApiCustomerBooking(
      bookingWithServices(
        {
          status: 'cancelled',
          internalNotes: '遅刻が多い',
          source: 'phone',
          reminderSent: true,
          reminderSentAt: '2026-11-19 10:00:00+09',
          actualStartTime: '2026-11-20 10:05:00+09',
          actualEndTime: '2026-11-20 12:40:00+09',
          cancelledAt: '2026-11-19 18:00:00+09',
          cancelledBy: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c09',
          cancellationReason: 'スタッフの都合',
          cancellationFee: 0,
        },
        dbBookingServices().map((line) => ({
          ...line,
          notes: 'ブリーチあり',
          isCompleted: true,
          completedAt: '2026-11-20 12:40:00+09',
        })),
      ),
    )

    expect(result).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking({
        status: 'cancelled',
        cancelledAt: '2026-11-19T09:00:00.000Z',
        cancellationFee: 0,
      }),
    })
  })

  it.each<[string, Partial<DbBooking>, Partial<ApiCustomerBookingResponse>]>([
    ['the deposit', { depositAmount: null }, { depositAmount: null }],
    [
      'the points',
      { pointsUsed: 300, pointsEarned: 60 },
      { pointsUsed: 300, pointsEarned: 60 },
    ],
    [
      'the request of the customer',
      { customerRequest: null },
      { customerRequest: null },
    ],
    [
      'the completion',
      { status: 'completed', completedAt: '2026-11-20 12:30:00+09' },
      { status: 'completed', completedAt: '2026-11-20T03:30:00.000Z' },
    ],
    [
      'the fee of a cancellation',
      { cancellationFee: 1100 },
      { cancellationFee: 1100 },
    ],
  ])('shows %s as the booking has it', (_case, stored, shown) => {
    expect(toApiCustomerBooking(bookingWithServices(stored))).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking(shown),
    })
  })

  it('shows a line without a staff member as that', () => {
    const [first] = dbBookingServices()
    const [shownFirst] = apiCustomerBookingServices()

    const result = toApiCustomerBooking(
      bookingWithServices(
        {},
        first === undefined ? [] : [{ ...first, staffId: null }],
      ),
    )

    expect(result).toStrictEqual({
      type: 'success',
      data: apiCustomerBooking({
        services:
          shownFirst === undefined ? [] : [{ ...shownFirst, staffId: null }],
      }),
    })
  })

  it('answers a stored booking that does not match the model with the database error of the ledger', () => {
    const result = toApiCustomerBooking(
      bookingWithServices({ startTime: 'tomorrow' }),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored booking ${BOOKING_ID} does not match the API model`,
      },
    })
  })
})

describe('CustomerBookingReadMapper.toApiCustomerBookings', () => {
  it('returns the bookings in the order they are given', () => {
    const result = toApiCustomerBookings([
      bookingWithServices({ id: OTHER_BOOKING_ID }),
      bookingWithServices(),
    ])

    expect(result).toStrictEqual({
      type: 'success',
      data: [
        apiCustomerBooking({ id: OTHER_BOOKING_ID }),
        apiCustomerBooking(),
      ],
    })
  })

  it('returns no bookings for none', () => {
    expect(toApiCustomerBookings([])).toStrictEqual({
      type: 'success',
      data: [],
    })
  })

  it('answers with the error of the first booking that does not match the model', () => {
    const result = toApiCustomerBookings([
      bookingWithServices(),
      bookingWithServices({ id: OTHER_BOOKING_ID, endTime: 'later' }),
      bookingWithServices({ startTime: 'tomorrow' }),
    ])

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored booking ${OTHER_BOOKING_ID} does not match the API model`,
      },
    })
  })
})

describe('CustomerBookingReadMapper.toApiCustomerBookingPage', () => {
  it('answers with the bookings as their customer is shown them, the counts of the list and the place of the page', () => {
    expect(
      CustomerBookingReadMapper.toApiCustomerBookingPage(
        {
          bookings: [
            bookingWithServices({ id: OTHER_BOOKING_ID }),
            bookingWithServices(),
          ],
          total: 5,
          hasMore: true,
        },
        { limit: 2, after: bookingIdSchema.parse(BOOKING_ID) },
      ),
    ).toStrictEqual({
      type: 'success',
      data: {
        data: [
          apiCustomerBooking({ id: OTHER_BOOKING_ID }),
          apiCustomerBooking(),
        ],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: BOOKING_ID,
          nextCursor: BOOKING_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('names no next page when the list ends with this one', () => {
    expect(
      CustomerBookingReadMapper.toApiCustomerBookingPage(
        { bookings: [bookingWithServices()], total: 1, hasMore: false },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        meta: { total: 1, limit: 20, hasMore: false, nextCursor: null },
      },
    })
  })

  it('answers with the error of the first booking that does not match the model', () => {
    expect(
      CustomerBookingReadMapper.toApiCustomerBookingPage(
        {
          bookings: [
            bookingWithServices(),
            bookingWithServices({ id: OTHER_BOOKING_ID, endTime: 'later' }),
          ],
          total: 2,
          hasMore: false,
        },
        { limit: 20, after: null },
      ),
    ).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored booking ${OTHER_BOOKING_ID} does not match the API model`,
      },
    })
  })
})

describe('CustomerBookingWriteMapper', () => {
  const own: CustomerReach = {
    type: 'customer',
    customerId: customerIdSchema.parse(CUSTOMER_ID),
  }

  it('returns a create request as the slot the customer asks for', () => {
    const request = customerBookingRequest('10:00', {
      customerRequest: 'A quiet seat, please',
    })

    expect(CustomerBookingWriteMapper.fromCreateRequest(request)).toStrictEqual(
      request,
    )
  })

  it('returns a reschedule request as the slot the booking is moved to', () => {
    const request = bookingRescheduleRequestSchema.parse({
      startTime: '2026-11-20T01:00:00Z',
      staffId: STAFF_MEMBER_ID,
    })

    expect(
      CustomerBookingWriteMapper.fromRescheduleRequest(request),
    ).toStrictEqual({
      startTime: '2026-11-20T01:00:00.000Z',
      staffId: STAFF_MEMBER_ID,
    })
  })

  it.each<[string, string | null]>([
    ['the reason they give', 'I cannot come'],
    ['no reason', null],
  ])(
    'makes a cancel request the cancellation by the customer, with %s',
    (_named, cancellationReason) => {
      expect(
        CustomerBookingWriteMapper.fromCancelRequest({ cancellationReason }),
      ).toStrictEqual({ type: 'cancelAsCustomer', cancellationReason })
    },
  )

  it('lists the first 20 of the customer’s own bookings when the request names nothing', () => {
    expect(
      CustomerBookingWriteMapper.fromSearchRequest(
        customerBookingSearchRequestSchema.parse({}),
        own,
      ),
    ).toStrictEqual({
      reach: own,
      limit: 20,
      after: null,
      salonId: null,
      customerId: null,
      staffId: null,
      status: null,
      bookingDateFrom: null,
      bookingDateTo: null,
    })
  })

  it('takes the place of the page, the status and the days the request names, and narrows by nothing else', () => {
    expect(
      CustomerBookingWriteMapper.fromSearchRequest(
        customerBookingSearchRequestSchema.parse({
          limit: 5,
          cursor: BOOKING_ID,
          status: 'completed',
          bookingDateFrom: '2026-11-01',
          bookingDateTo: '2026-11-30',
        }),
        own,
      ),
    ).toStrictEqual({
      reach: own,
      limit: 5,
      after: BOOKING_ID,
      salonId: null,
      customerId: null,
      staffId: null,
      status: 'completed',
      bookingDateFrom: '2026-11-01',
      bookingDateTo: '2026-11-30',
    })
  })
})
