import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type {
  BookingReferences,
  BookingUseCaseDependencies,
} from '../business-logic/booking'
import type {
  ApiBookingCreateRequest,
  ApiBookingResponse,
  ApiBookingServiceResponse,
  BookingWithServices,
  DbBooking,
  DbBookingService,
} from '../models/booking'
import type {
  BookingCreation,
  BookingDeletion,
  BookingReschedule,
  BookingServiceAddition,
  BookingServiceRemoval,
  BookingStatusChange,
  CustomerBookingCreation,
  CustomerBookingReschedule,
  IBookingRepository,
} from '../repositories/booking.repository'
import { CUSTOMER_ID } from './auth-fixtures'
import { SALON_ID } from './fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

export const BOOKING_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2b01'
export const OTHER_BOOKING_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2b02'

/** A cut: 60 minutes, 6,600 yen with the tax in it. */
export const CUT_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2c01'

/** A colouring: 90 minutes, 8,000 yen discounted to 7,000, the tax not in it. */
export const COLOR_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2c02'

export const BOOKING_NUMBER = 'BK-7Z3K-0QXM'

/**
 * A request that satisfies every rule: a cut by one staff member from 10:00
 * in Tokyo and a colouring by another right after it.
 */
export const bookingCreateRequest = (): ApiBookingCreateRequest => ({
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  staffId: STAFF_MEMBER_ID,
  depositAmount: 1000,
  customerRequest: '前回と同じ長さで',
  internalNotes: '電話で受付',
  source: 'phone',
  services: [
    {
      serviceId: CUT_ID,
      staffId: STAFF_MEMBER_ID,
      startTime: '2026-11-20T01:00:00Z',
      notes: null,
    },
    {
      serviceId: COLOR_ID,
      staffId: OTHER_STAFF_MEMBER_ID,
      startTime: '2026-11-20T02:00:00Z',
      notes: '明るめ',
    },
  ],
})

/**
 * What the request above refers to: a salon in Tokyo with a tax of 10%, and
 * two staff members who take one booking at a time and keep ten minutes free
 * before and fifteen after it.
 */
export const bookingReferences = (
  overrides: Partial<BookingReferences> = {},
): BookingReferences => ({
  salon: { timezone: 'Asia/Tokyo', taxRate: '10.00' },
  customerExists: true,
  staff: [STAFF_MEMBER_ID, OTHER_STAFF_MEMBER_ID].map((id) => ({
    id,
    bufferTimeBefore: 10,
    bufferTimeAfter: 15,
    maxConcurrentBookings: 1,
  })),
  services: [
    {
      id: CUT_ID,
      duration: 60,
      price: 6600,
      discountPrice: null,
      taxIncluded: true,
    },
    {
      id: COLOR_ID,
      duration: 90,
      price: 8000,
      discountPrice: 7000,
      taxIncluded: false,
    },
  ],
  ...overrides,
})

/** The service lines of the booking below as the driver returns the rows. */
export const dbBookingServices = (): DbBookingService[] => [
  {
    id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d01',
    bookingId: BOOKING_ID,
    serviceId: CUT_ID,
    staffId: STAFF_MEMBER_ID,
    startTime: '2026-11-20 10:00:00+09',
    endTime: '2026-11-20 11:00:00+09',
    duration: 60,
    price: 6600,
    discountAmount: 0,
    finalPrice: 6600,
    taxIncluded: true,
    isCompleted: false,
    completedAt: null,
    notes: null,
    sortOrder: 0,
    createdAt: '2026-11-14 18:00:00.123456+09',
    updatedAt: '2026-11-14 18:00:00.123456+09',
  },
  {
    id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d02',
    bookingId: BOOKING_ID,
    serviceId: COLOR_ID,
    staffId: OTHER_STAFF_MEMBER_ID,
    startTime: '2026-11-20 11:00:00+09',
    endTime: '2026-11-20 12:30:00+09',
    duration: 90,
    price: 8000,
    discountAmount: 1000,
    finalPrice: 7000,
    taxIncluded: false,
    isCompleted: false,
    completedAt: null,
    notes: '明るめ',
    sortOrder: 1,
    createdAt: '2026-11-14 18:00:00.123456+09',
    updatedAt: '2026-11-14 18:00:00.123456+09',
  },
]

export const BOOKING_SERVICE_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d01'

/** The cut of the booking: the first of its lines. */
const firstBookingService = (): DbBookingService => {
  const [first] = dbBookingServices()
  if (first === undefined) {
    throw new Error('The booking of the fixtures has service lines')
  }
  return first
}

/** A row of `bookings` as the driver returns it: the booking of the request above. */
const dbBooking = (overrides: Partial<DbBooking> = {}): DbBooking => ({
  id: BOOKING_ID,
  bookingNumber: BOOKING_NUMBER,
  salonId: SALON_ID,
  customerId: CUSTOMER_ID,
  staffId: STAFF_MEMBER_ID,
  bookingDate: '2026-11-20',
  startTime: '2026-11-20 10:00:00+09',
  endTime: '2026-11-20 12:30:00+09',
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
  createdAt: '2026-11-14 18:00:00.123456+09',
  updatedAt: '2026-11-14 09:30:00+00',
  ...overrides,
})

export const bookingWithServices = (
  overrides: Partial<DbBooking> = {},
  services: DbBookingService[] = dbBookingServices(),
): BookingWithServices => ({ booking: dbBooking(overrides), services })

/** The service lines above as the API presents them. */
export const apiBookingServices = (): ApiBookingServiceResponse[] => [
  {
    id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d01',
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
    id: '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f2d02',
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
]

/** The booking above as the API presents it. */
export const apiBooking = (
  overrides: Partial<ApiBookingResponse> = {},
): ApiBookingResponse => ({
  id: BOOKING_ID,
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
  services: apiBookingServices(),
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
  ...overrides,
})

/**
 * Everything the booking use cases need: a repository that holds the one
 * booking above and writes it for every request, and an issuer that always
 * issues the same number; a test overrides what it needs.
 */
export const bookingDependencies = (
  overrides: Partial<IBookingRepository> = {},
  numbers: string[] = [],
): BookingUseCaseDependencies => {
  const upcoming = [...numbers]

  return {
    bookingRepository: {
      create: vi.fn(async () =>
        Result.success<BookingCreation>({
          type: 'created',
          booking: bookingWithServices(),
        }),
      ),
      book: vi.fn(async () =>
        Result.success<CustomerBookingCreation>({
          type: 'created',
          booking: bookingWithServices(),
        }),
      ),
      findById: vi.fn(async () =>
        Result.success<BookingWithServices | null>(bookingWithServices()),
      ),
      changeStatus: vi.fn(async () =>
        Result.success<BookingStatusChange>({
          type: 'changed',
          booking: bookingWithServices(),
        }),
      ),
      update: vi.fn(async () =>
        Result.success<BookingWithServices | null>(bookingWithServices()),
      ),
      reschedule: vi.fn(async () =>
        Result.success<BookingReschedule>({
          type: 'rescheduled',
          booking: bookingWithServices(),
        }),
      ),
      rebook: vi.fn(async () =>
        Result.success<CustomerBookingReschedule>({
          type: 'rescheduled',
          booking: bookingWithServices(),
        }),
      ),
      delete: vi.fn(async () =>
        Result.success<BookingDeletion>({ type: 'deleted' }),
      ),
      addService: vi.fn(async () =>
        Result.success<BookingServiceAddition>({
          type: 'added',
          service: firstBookingService(),
        }),
      ),
      findService: vi.fn(async () =>
        Result.success<DbBookingService | null>(firstBookingService()),
      ),
      removeService: vi.fn(async () =>
        Result.success<BookingServiceRemoval>({ type: 'removed' }),
      ),
      list: vi.fn(async () =>
        Result.success({
          bookings: [bookingWithServices()],
          total: 1,
          hasMore: false,
        }),
      ),
      ...overrides,
    },
    bookingNumberIssuer: {
      issue: vi.fn(() => upcoming.shift() ?? BOOKING_NUMBER),
    },
  }
}

const REPOSITORY_METHODS: (keyof IBookingRepository)[] = [
  'create',
  'book',
  'findById',
  'changeStatus',
  'update',
  'reschedule',
  'rebook',
  'delete',
  'addService',
  'findService',
  'removeService',
  'list',
]

/** The methods of the repository that were called, in the order of the calls. */
export const bookingRepositoryCalls = ({
  bookingRepository,
}: BookingUseCaseDependencies): string[] =>
  REPOSITORY_METHODS.flatMap((name) =>
    vi
      .mocked(bookingRepository[name])
      .mock.invocationCallOrder.map((order) => ({ order, name })),
  )
    .toSorted((a, b) => a.order - b.order)
    .map(({ name }) => name)
