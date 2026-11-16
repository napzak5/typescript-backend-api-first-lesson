import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type {
  CustomerBookingReferences,
  CustomerBookingUseCaseDependencies,
} from '../business-logic/customer-booking'
import type {
  ApiCustomerBookingResponse,
  ApiCustomerBookingServiceResponse,
} from '../models/booking'
import type { IBookingRepository } from '../repositories/booking.repository'
import {
  type CustomerBookingCreateRequest,
  customerBookingCreateRequestSchema,
} from '../schemas/booking.schema'
import { DomainErrors } from '../shared'
import { NOW } from './auth-fixtures'
import {
  jst,
  serviceOfSlots,
  staffOfDay,
  weeklyHours,
} from './available-slot-fixtures'
import {
  BOOKING_ID,
  BOOKING_NUMBER,
  bookingDependencies,
  COLOR_ID,
  CUT_ID,
} from './booking-fixtures'
import { SALON_ID } from './fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

/**
 * What a customer sends to book the cut with the staff member of the slot
 * fixtures at a time of `DATE` in Tokyo: at ten unless stated otherwise.
 */
export const customerBookingRequest = (
  time = '10:00',
  overrides: Record<string, unknown> = {},
): CustomerBookingCreateRequest =>
  customerBookingCreateRequestSchema.parse({
    salonId: SALON_ID,
    serviceId: CUT_ID,
    staffId: STAFF_MEMBER_ID,
    startTime: jst(time).toISOString(),
    customerRequest: null,
    ...overrides,
  })

/**
 * What the request above meets: a customer the salons take bookings from,
 * the salon, the cut and the staff member of the slot fixtures, a calendar
 * without a row, and nothing booked.
 */
export const customerBookingReferences = (
  overrides: Partial<CustomerBookingReferences> = {},
): CustomerBookingReferences => ({
  customer: { isActive: true, customerStatus: 'active' },
  salon: {
    id: SALON_ID,
    isActive: true,
    timezone: 'Asia/Tokyo',
    businessHours: [weeklyHours()],
    taxRate: '10.00',
  },
  service: {
    id: CUT_ID,
    price: 6600,
    discountPrice: null,
    taxIncluded: true,
    ...serviceOfSlots(),
  },
  staff: staffOfDay(),
  calendarDays: [],
  serviceLineStarts: [],
  customerTimes: [],
  ...overrides,
})

/** The service lines of the booking fixtures as their customer is shown them. */
export const apiCustomerBookingServices =
  (): ApiCustomerBookingServiceResponse[] => [
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
      sortOrder: 1,
    },
  ]

/** The booking of the booking fixtures as its customer is shown it. */
export const apiCustomerBooking = (
  overrides: Partial<ApiCustomerBookingResponse> = {},
): ApiCustomerBookingResponse => ({
  id: BOOKING_ID,
  bookingNumber: BOOKING_NUMBER,
  salonId: SALON_ID,
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
  cancelledAt: null,
  cancellationFee: null,
  completedAt: null,
  services: apiCustomerBookingServices(),
  createdAt: '2026-11-14T09:00:00.123Z',
  updatedAt: '2026-11-14T09:30:00.000Z',
  ...overrides,
})

/**
 * Everything the use cases of a customer's own bookings need: the
 * repository and the issuer of the booking fixtures, and a clock that
 * shows `NOW`; a test overrides what it needs.
 */
export const customerBookingDependencies = (
  overrides: Partial<IBookingRepository> = {},
  numbers: string[] = [],
  now: () => Date = () => NOW,
): CustomerBookingUseCaseDependencies => ({
  ...bookingDependencies(overrides, numbers),
  clock: vi.fn(now),
})

export const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
