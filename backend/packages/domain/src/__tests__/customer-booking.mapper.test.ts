import { describe, expect, it } from 'vitest'
import { CustomerBookingReadMapper } from '../mappers/read/customer-booking.mapper'
import type { ApiCustomerBookingResponse, DbBooking } from '../models/booking'
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
} from './customer-booking-fixtures'

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
