import { describe, expect, it } from 'vitest'
import { BookingReadMapper } from '../mappers/read/booking.mapper'
import { BookingWriteMapper } from '../mappers/write/booking.mapper'
import {
  bookingIdSchema,
  type DbBooking,
  type DbBookingService,
  type LedgerReach,
} from '../models/booking'
import { salonIdSchema } from '../models/salon'
import {
  bookingCreateRequestSchema,
  bookingRescheduleRequestSchema,
  bookingSearchRequestSchema,
  bookingServiceCreateRequestSchema,
} from '../schemas/booking.schema'
import { CUSTOMER_ID, USER_ID } from './auth-fixtures'
import {
  apiBooking,
  apiBookingServices,
  BOOKING_ID,
  bookingCreateRequest,
  bookingWithServices,
  CUT_ID,
  dbBookingServices,
  OTHER_BOOKING_ID,
} from './booking-fixtures'
import { SALON_ID } from './fixtures'
import { STAFF_MEMBER_ID } from './staff-fixtures'

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

describe('BookingReadMapper.toApiBookingPage', () => {
  const paging = { limit: 2, after: bookingIdSchema.parse(BOOKING_ID) }

  it('answers with the bookings, the counts of the list and the place of the page', () => {
    expect(
      BookingReadMapper.toApiBookingPage(
        {
          bookings: [
            bookingWithServices({ id: OTHER_BOOKING_ID }),
            bookingWithServices(),
          ],
          total: 5,
          hasMore: true,
        },
        paging,
      ),
    ).toEqual({
      type: 'success',
      data: {
        data: [apiBooking({ id: OTHER_BOOKING_ID }), apiBooking()],
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
      BookingReadMapper.toApiBookingPage(
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

  it('reports the first booking whose stored row is at fault', () => {
    expect(
      BookingReadMapper.toApiBookingPage(
        {
          bookings: [
            bookingWithServices(),
            bookingWithServices({
              id: OTHER_BOOKING_ID,
              startTime: 'tomorrow',
            }),
          ],
          total: 2,
          hasMore: false,
        },
        paging,
      ),
    ).toEqual(storedRowIsCorrupt(OTHER_BOOKING_ID))
  })
})

describe('BookingWriteMapper', () => {
  it('returns a create request as the booking that is asked for, its lines among it', () => {
    const request = bookingCreateRequestSchema.parse(bookingCreateRequest())

    expect(BookingWriteMapper.fromCreateRequest(request)).toStrictEqual(request)
  })

  it('returns an update request as the notes it names, and no others', () => {
    expect(
      BookingWriteMapper.fromUpdateRequest({
        internalNotes: null,
        depositAmount: 0,
      }),
    ).toStrictEqual({ internalNotes: null, depositAmount: 0 })
  })

  it('returns a reschedule request as the time and the staff member the booking is moved to', () => {
    const request = bookingRescheduleRequestSchema.parse({
      startTime: '2026-11-20T01:00:00Z',
      staffId: STAFF_MEMBER_ID,
    })

    expect(BookingWriteMapper.fromRescheduleRequest(request)).toStrictEqual({
      startTime: '2026-11-20T01:00:00.000Z',
      staffId: STAFF_MEMBER_ID,
    })
  })

  it.each<[string, string | null]>([
    ['the reason the request gives', 'The customer is ill'],
    ['no reason', null],
  ])(
    'makes a cancel request the cancellation by the ledger, with %s',
    (_named, cancellationReason) => {
      expect(
        BookingWriteMapper.fromCancelRequest({ cancellationReason }),
      ).toStrictEqual({ type: 'cancel', cancellationReason })
    },
  )

  it.each<[string, string | null, string | null]>([
    ['both times', '2026-11-20T01:05:00.000Z', '2026-11-20T02:10:00.000Z'],
    ['the end alone', null, '2026-11-20T02:10:00.000Z'],
    ['the start alone', '2026-11-20T01:05:00.000Z', null],
    ['neither time', null, null],
  ])(
    'makes a complete request the completion of the visit, with %s',
    (_named, actualStartTime, actualEndTime) => {
      expect(
        BookingWriteMapper.fromCompleteRequest({
          actualStartTime,
          actualEndTime,
        }),
      ).toStrictEqual({ type: 'complete', actualStartTime, actualEndTime })
    },
  )

  it('returns the request of a service line as the line that is asked for', () => {
    const request = bookingServiceCreateRequestSchema.parse({
      serviceId: CUT_ID,
      staffId: null,
      startTime: '2026-11-20T03:30:00Z',
      notes: 'After the colouring',
    })

    expect(BookingWriteMapper.fromServiceCreateRequest(request)).toStrictEqual({
      serviceId: CUT_ID,
      staffId: null,
      startTime: '2026-11-20T03:30:00.000Z',
      notes: 'After the colouring',
    })
  })
})

describe('BookingWriteMapper.fromSearchRequest', () => {
  const ofTheSalon: LedgerReach = {
    type: 'salon',
    salonId: salonIdSchema.parse(SALON_ID),
  }
  const unfiltered = {
    salonId: null,
    customerId: null,
    staffId: null,
    status: null,
    bookingDateFrom: null,
    bookingDateTo: null,
  }

  it('lists the first 20 bookings within the reach when the request names nothing', () => {
    expect(
      BookingWriteMapper.fromSearchRequest(
        bookingSearchRequestSchema.parse({}),
        ofTheSalon,
      ),
    ).toStrictEqual({
      reach: ofTheSalon,
      limit: 20,
      after: null,
      ...unfiltered,
    })
  })

  it('takes the place of the page and every filter the request names', () => {
    expect(
      BookingWriteMapper.fromSearchRequest(
        bookingSearchRequestSchema.parse({
          limit: 5,
          cursor: BOOKING_ID,
          salonId: SALON_ID,
          customerId: CUSTOMER_ID,
          staffId: STAFF_MEMBER_ID,
          status: 'confirmed',
          bookingDateFrom: '2026-11-01',
          bookingDateTo: '2026-11-30',
        }),
        { type: 'everySalon' },
      ),
    ).toStrictEqual({
      reach: { type: 'everySalon' },
      limit: 5,
      after: BOOKING_ID,
      salonId: SALON_ID,
      customerId: CUSTOMER_ID,
      staffId: STAFF_MEMBER_ID,
      status: 'confirmed',
      bookingDateFrom: '2026-11-01',
      bookingDateTo: '2026-11-30',
    })
  })

  it.each<[string, Record<string, string>]>([
    ['the salon', { salonId: SALON_ID }],
    ['the customer', { customerId: CUSTOMER_ID }],
    ['the staff member', { staffId: STAFF_MEMBER_ID }],
    ['the status', { status: 'cancelled' }],
    ['the first day', { bookingDateFrom: '2026-11-01' }],
    ['the last day', { bookingDateTo: '2026-11-30' }],
  ])('narrows the list by %s alone', (_named, filter) => {
    expect(
      BookingWriteMapper.fromSearchRequest(
        bookingSearchRequestSchema.parse(filter),
        ofTheSalon,
      ),
    ).toStrictEqual({
      reach: ofTheSalon,
      limit: 20,
      after: null,
      ...unfiltered,
      ...filter,
    })
  })
})
