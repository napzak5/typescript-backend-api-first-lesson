import { describe, expect, it } from 'vitest'
import { BookingReadMapper } from '../mappers/read/booking.mapper'
import type { DbBooking, DbBookingService } from '../models/booking'
import { USER_ID } from './auth-fixtures'
import {
  apiBooking,
  apiBookingServices,
  BOOKING_ID,
  bookingWithServices,
  dbBookingServices,
  OTHER_BOOKING_ID,
} from './booking-fixtures'

/** The properties of a BookingResponse. */
const RESPONSE_PROPERTIES = [
  'actualEndTime',
  'actualStartTime',
  'bookingDate',
  'bookingNumber',
  'cancellationFee',
  'cancellationReason',
  'cancelledAt',
  'cancelledBy',
  'completedAt',
  'createdAt',
  'customerId',
  'customerRequest',
  'depositAmount',
  'discountAmount',
  'duration',
  'endTime',
  'id',
  'internalNotes',
  'pointsEarned',
  'pointsUsed',
  'reminderSent',
  'reminderSentAt',
  'salonId',
  'services',
  'source',
  'staffId',
  'startTime',
  'status',
  'subtotal',
  'taxAmount',
  'totalAmount',
  'updatedAt',
]

/** The properties of a BookingServiceResponse. */
const SERVICE_PROPERTIES = [
  'completedAt',
  'discountAmount',
  'duration',
  'endTime',
  'finalPrice',
  'id',
  'isCompleted',
  'notes',
  'price',
  'serviceId',
  'sortOrder',
  'staffId',
  'startTime',
  'taxIncluded',
]

/** The first service line of the fixtures with these columns changed. */
const serviceWith = (
  overrides: Partial<DbBookingService>,
): DbBookingService[] =>
  dbBookingServices().map((service, index) =>
    index === 0 ? { ...service, ...overrides } : service,
  )

const toApi = (
  booking: Partial<DbBooking> = {},
  services: DbBookingService[] = dbBookingServices(),
) => BookingReadMapper.toApiBooking(bookingWithServices(booking, services))

const storedRowIsCorrupt = (id: string = BOOKING_ID) => ({
  type: 'error',
  error: {
    type: 'database',
    message: `Stored booking ${id} does not match the API model`,
    cause: expect.objectContaining({ type: 'validation' }),
  },
})

describe('BookingReadMapper.toApiBooking', () => {
  it('returns every column under its own name, with the timestamps in ISO 8601 UTC', () => {
    expect(toApi()).toEqual({ type: 'success', data: apiBooking() })
  })

  it('has exactly the properties of BookingResponse: where the booking was made from stays in the ledger', () => {
    const result = toApi()

    expect(
      Object.keys(result.type === 'success' ? result.data : {}).toSorted(),
    ).toEqual(RESPONSE_PROPERTIES)
  })

  it('has exactly the properties of BookingServiceResponse for every service line', () => {
    const result = toApi()
    const services = result.type === 'success' ? result.data.services : []

    expect(services).toHaveLength(2)
    expect(services.map((service) => Object.keys(service).toSorted())).toEqual([
      SERVICE_PROPERTIES,
      SERVICE_PROPERTIES,
    ])
  })

  it('keeps null as null', () => {
    const withoutOptionalValues = {
      depositAmount: null,
      customerRequest: null,
      internalNotes: null,
      source: null,
    }

    expect(
      toApi(
        { ...withoutOptionalValues, ipAddress: null, userAgent: null },
        serviceWith({ staffId: null }),
      ),
    ).toEqual({
      type: 'success',
      data: apiBooking({
        ...withoutOptionalValues,
        services: apiBookingServices().map((service, index) =>
          index === 0 ? { ...service, staffId: null } : service,
        ),
      }),
    })
  })

  it('returns what a booking gets later in its life', () => {
    const result = toApi(
      {
        status: 'cancelled',
        pointsUsed: 100,
        pointsEarned: 0,
        reminderSent: true,
        reminderSentAt: '2026-11-19 10:00:00+09',
        cancelledAt: '2026-11-19 21:30:00.5+09',
        cancelledBy: USER_ID,
        cancellationReason: '体調不良',
        cancellationFee: 0,
        completedAt: '2026-11-20 12:40:00+09',
        actualStartTime: '2026-11-20 10:05:00+09',
        actualEndTime: '2026-11-20 12:35:00+09',
      },
      serviceWith({
        isCompleted: true,
        completedAt: '2026-11-20 11:02:00+09',
      }),
    )

    expect(result).toEqual({
      type: 'success',
      data: apiBooking({
        status: 'cancelled',
        pointsUsed: 100,
        pointsEarned: 0,
        reminderSent: true,
        reminderSentAt: '2026-11-19T01:00:00.000Z',
        cancelledAt: '2026-11-19T12:30:00.500Z',
        cancelledBy: USER_ID,
        cancellationReason: '体調不良',
        cancellationFee: 0,
        completedAt: '2026-11-20T03:40:00.000Z',
        actualStartTime: '2026-11-20T01:05:00.000Z',
        actualEndTime: '2026-11-20T03:35:00.000Z',
        services: apiBookingServices().map((service, index) =>
          index === 0
            ? {
                ...service,
                isCompleted: true,
                completedAt: '2026-11-20T02:02:00.000Z',
              }
            : service,
        ),
      }),
    })
  })

  const statuses: DbBooking['status'][] = [
    'draft',
    'pending',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
  ]

  it.each(statuses)('returns the status %s', (status) => {
    expect(toApi({ status })).toMatchObject({
      type: 'success',
      data: { status },
    })
  })

  it('keeps the service lines in the order they are given', () => {
    const [first, second] = dbBookingServices()
    const result = toApi(
      {},
      [second, first].flatMap((service) =>
        service === undefined ? [] : [service],
      ),
    )

    expect(
      result.type === 'success'
        ? result.data.services.map(({ sortOrder }) => sortOrder)
        : [],
    ).toEqual([1, 0])
  })

  it('returns a booking without service lines with an empty list', () => {
    expect(toApi({}, [])).toEqual({
      type: 'success',
      data: apiBooking({ services: [] }),
    })
  })

  it.each([
    [
      'a timestamp with microseconds in another time zone',
      '2026-11-15 08:59:59.999999+09',
      '2026-11-14T23:59:59.999Z',
    ],
    [
      'a timestamp without a fraction',
      '2026-01-01 00:00:00+00',
      '2026-01-01T00:00:00.000Z',
    ],
  ])('writes %s in ISO 8601 UTC', (_case, stored, expected) => {
    expect(
      toApi(
        { startTime: stored, endTime: stored, createdAt: stored },
        serviceWith({ startTime: stored, endTime: stored }),
      ),
    ).toMatchObject({
      type: 'success',
      data: {
        startTime: expected,
        endTime: expected,
        createdAt: expected,
        services: [{ startTime: expected, endTime: expected }, {}],
      },
    })
  })

  it.each<[string, Partial<DbBooking>]>([
    ['a start that is not a timestamp', { startTime: 'tomorrow' }],
    ['an end that is not a timestamp', { endTime: '' }],
    ['a creation time that is not a timestamp', { createdAt: 'yesterday' }],
    ['an update time that is not a timestamp', { updatedAt: '' }],
    ['a time of the reminder that is not a timestamp', { reminderSentAt: '' }],
    ['a time of cancellation that is not a timestamp', { cancelledAt: 'x' }],
    ['a time of completion that is not a timestamp', { completedAt: 'x' }],
    ['an actual start that is not a timestamp', { actualStartTime: 'x' }],
    ['an actual end that is not a timestamp', { actualEndTime: 'x' }],
  ])('reports %s as a fault of the stored row', (_case, stored) => {
    expect(toApi(stored)).toEqual(storedRowIsCorrupt())
  })

  it.each<[string, Partial<DbBookingService>]>([
    ['a start that is not a timestamp', { startTime: 'tomorrow' }],
    ['an end that is not a timestamp', { endTime: '' }],
    ['a time of completion that is not a timestamp', { completedAt: 'x' }],
  ])(
    'reports a service line with %s as a fault of the stored booking',
    (_case, stored) => {
      expect(toApi({}, serviceWith(stored))).toEqual(storedRowIsCorrupt())
    },
  )
})

describe('BookingReadMapper.toApiBookingService', () => {
  const serviceRows = (): DbBookingService[] => dbBookingServices()

  it('returns a service line as its booking shows it', () => {
    expect(serviceRows().map(BookingReadMapper.toApiBookingService)).toEqual(
      apiBookingServices().map((data) => ({ type: 'success', data })),
    )
  })

  it('has exactly the properties of BookingServiceResponse: the booking of the line is in its address', () => {
    const [result] = serviceRows().map(BookingReadMapper.toApiBookingService)

    expect(
      result?.type === 'success' ? Object.keys(result.data).toSorted() : [],
    ).toEqual(SERVICE_PROPERTIES)
  })

  it('returns what a line gets later in its life', () => {
    const [row] = serviceWith({
      isCompleted: true,
      completedAt: '2026-11-20 11:04:00.654321+09',
      notes: '前髪のみ',
      sortOrder: 7,
    })

    expect(
      row === undefined ? null : BookingReadMapper.toApiBookingService(row),
    ).toEqual({
      type: 'success',
      data: {
        ...apiBookingServices()[0],
        isCompleted: true,
        completedAt: '2026-11-20T02:04:00.654Z',
        notes: '前髪のみ',
        sortOrder: 7,
      },
    })
  })

  it.each<[string, Partial<DbBookingService>]>([
    ['a start that is not a timestamp', { startTime: 'tomorrow' }],
    ['an end that is not a timestamp', { endTime: '' }],
    ['a time of completion that is not a timestamp', { completedAt: 'x' }],
  ])('reports %s as a fault of the stored row of the line', (_case, stored) => {
    const [row] = serviceWith(stored)

    expect(
      row === undefined ? null : BookingReadMapper.toApiBookingService(row),
    ).toEqual({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored booking service ${row?.id} does not match the API model`,
        cause: expect.objectContaining({ type: 'validation' }),
      },
    })
  })
})

describe('BookingReadMapper.toApiBookings', () => {
  it('returns the bookings in the order they are given', () => {
    const result = BookingReadMapper.toApiBookings([
      bookingWithServices({ id: OTHER_BOOKING_ID }),
      bookingWithServices(),
    ])

    expect(result).toEqual({
      type: 'success',
      data: [apiBooking({ id: OTHER_BOOKING_ID }), apiBooking()],
    })
  })

  it('returns no bookings for none', () => {
    expect(BookingReadMapper.toApiBookings([])).toEqual({
      type: 'success',
      data: [],
    })
  })

  it('reports the first booking whose stored row is at fault', () => {
    const result = BookingReadMapper.toApiBookings([
      bookingWithServices(),
      bookingWithServices({ id: OTHER_BOOKING_ID, startTime: 'tomorrow' }),
    ])

    expect(result).toEqual(storedRowIsCorrupt(OTHER_BOOKING_ID))
  })
})
