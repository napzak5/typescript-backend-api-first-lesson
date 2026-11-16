import type {
  bookingServices,
  bookingStatusHistories,
  bookings,
} from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import type { CustomerId } from './customer'
import type { SalonId } from './salon'

// ID: a UUID that has been checked.
export const bookingIdSchema = uuidSchema.brand<'BookingId'>()
export type BookingId = z.infer<typeof bookingIdSchema>

const bookingIdParameterSchema = z.object({ id: bookingIdSchema })

export const parseBookingId = (id: unknown): Result<BookingId, DomainError> =>
  Result.map(
    parseWith(bookingIdParameterSchema, { id }, 'Invalid booking ID'),
    (parameters) => parameters.id,
  )

const bookingIdOfPathSchema = z.object({ bookingId: bookingIdSchema })

/**
 * The booking in the path of a route below a booking
 * (`/bookings/{bookingId}/...`); a failure is reported under `bookingId`.
 */
export const parseBookingIdOfPath = (
  bookingId: unknown,
): Result<BookingId, DomainError> =>
  Result.map(
    parseWith(bookingIdOfPathSchema, { bookingId }, 'Invalid booking ID'),
    (parameters) => parameters.bookingId,
  )

export const bookingServiceIdSchema = uuidSchema.brand<'BookingServiceId'>()
export type BookingServiceId = z.infer<typeof bookingServiceIdSchema>

const bookingServiceIdParameterSchema = z.object({ id: bookingServiceIdSchema })

export const parseBookingServiceId = (
  id: unknown,
): Result<BookingServiceId, DomainError> =>
  Result.map(
    parseWith(
      bookingServiceIdParameterSchema,
      { id },
      'Invalid booking service ID',
    ),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiBookingResponse = components['schemas']['Models.BookingResponse']
export type ApiBookingServiceResponse =
  components['schemas']['Models.BookingServiceResponse']
export type ApiBookingCreateRequest =
  components['schemas']['Models.BookingCreateRequest']
export type ApiBookingServiceCreateRequest =
  components['schemas']['Models.BookingServiceCreateRequest']
export type ApiBookingUpdateRequest =
  components['schemas']['Models.BookingUpdateRequest']
export type ApiBookingRescheduleRequest =
  components['schemas']['Models.BookingRescheduleRequest']
export type ApiBookingCancelRequest =
  components['schemas']['Models.BookingCancelRequest']
export type ApiBookingCompleteRequest =
  components['schemas']['Models.BookingCompleteRequest']
export type ApiBookingSearchRequest = NonNullable<
  operations['BookingCrud_list']['parameters']['query']
>
export type ApiCustomerBookingResponse =
  components['schemas']['Models.CustomerBookingResponse']
export type ApiCustomerBookingServiceResponse =
  components['schemas']['Models.CustomerBookingServiceResponse']
export type ApiCustomerBookingCreateRequest =
  components['schemas']['Models.CustomerBookingCreateRequest']
export type ApiCustomerBookingSearchRequest = NonNullable<
  operations['CustomerBookings_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbBooking = DeepRequired<typeof bookings.$inferSelect>
export type DbBookingService = DeepRequired<typeof bookingServices.$inferSelect>

/**
 * A new booking: every column but the ones the database assigns. Nothing is
 * left to a default, so whoever writes a booking states all of it.
 */
export type DbNewBooking = DeepRequired<
  Omit<typeof bookings.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
>

/**
 * A new service line. Its booking is missing: the lines are written with
 * their booking, which has no ID before that. `selectedOptions` is a jsonb
 * column without a defined structure, which nothing writes.
 */
export type DbNewBookingService = DeepRequired<
  Omit<
    typeof bookingServices.$inferInsert,
    'id' | 'bookingId' | 'selectedOptions' | 'createdAt' | 'updatedAt'
  >
>

/** A new entry of the status history, without the booking it belongs to. */
export type DbNewBookingStatusChange = DeepRequired<
  Omit<
    typeof bookingStatusHistories.$inferInsert,
    'id' | 'bookingId' | 'createdAt'
  >
>

/** A booking and its service lines, in their order. */
export type BookingWithServices = {
  booking: DbBooking
  services: DbBookingService[]
}

/** What the creation of a booking writes. */
export type BookingWrite = {
  booking: DbNewBooking
  services: DbNewBookingService[]
  statusChange: DbNewBookingStatusChange
}

/**
 * What a booking says of its service lines taken together: when the visit
 * is and what it costs. It is written with the booking, and again whenever
 * a line is added or removed.
 */
export type DbBookingSummary = Pick<
  DbBooking,
  | 'bookingDate'
  | 'startTime'
  | 'endTime'
  | 'duration'
  | 'subtotal'
  | 'discountAmount'
  | 'taxAmount'
  | 'totalAmount'
>

/**
 * What a change of the status writes to a booking besides the status: only
 * the columns that go with the new status are named.
 */
export type DbBookingChanges = Partial<
  Pick<
    DbBooking,
    | 'cancelledAt'
    | 'cancelledBy'
    | 'cancellationReason'
    | 'cancellationFee'
    | 'completedAt'
    | 'actualStartTime'
    | 'actualEndTime'
  >
>

/**
 * What an update writes to a booking: what the salon notes of it, and of
 * that only what the request names.
 */
export type DbBookingNotes = Partial<
  Pick<
    DbBooking,
    'depositAmount' | 'customerRequest' | 'internalNotes' | 'source'
  >
>

/**
 * What a reschedule writes: the staff member in charge, the day and the
 * times of the booking, and the staff member and the times of each of its
 * service lines.
 */
export type BookingRescheduleWrite = {
  booking: Pick<DbBooking, 'staffId' | 'bookingDate' | 'startTime' | 'endTime'>
  services: Pick<DbBookingService, 'id' | 'staffId' | 'startTime' | 'endTime'>[]
}

/**
 * What the move of a booking by its customer writes: what a reschedule
 * writes, the status the booking has from then on, and the entry of the
 * status history when that is another one than it had.
 */
export type CustomerBookingMoveWrite = {
  booking: BookingRescheduleWrite['booking'] & Pick<DbBooking, 'status'>
  services: BookingRescheduleWrite['services']
  /** Null when the status stays what it is. */
  statusChange: DbNewBookingStatusChange | null
}

/** What a change of the status of a booking writes. */
export type BookingStatusWrite = {
  booking: DbBookingChanges & Pick<DbBooking, 'status'>
  /** The time at which its service lines are completed; null when they stay as they are. */
  servicesCompletedAt: string | null
  statusChange: DbNewBookingStatusChange
  /** Whether what the customer has of visits, cancellations and no-shows is counted again. */
  countsCustomer: boolean
}

/**
 * The bookings a keeper of a ledger reaches: those of every salon, or
 * those of one.
 */
export type LedgerReach =
  | { type: 'everySalon' }
  | { type: 'salon'; salonId: SalonId }

/** The bookings a customer reaches: their own, at whatever salon. */
export type CustomerReach = { type: 'customer'; customerId: CustomerId }

/**
 * The bookings a reader reaches. A booking outside the reach is, to that
 * reader, a booking that does not exist.
 */
export type BookingReach = LedgerReach | CustomerReach
