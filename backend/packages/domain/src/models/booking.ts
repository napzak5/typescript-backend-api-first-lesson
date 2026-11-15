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
 * The bookings an actor reaches: those of every salon, or those of one. A
 * booking outside the reach is, to that actor, a booking that does not
 * exist.
 */
export type BookingReach =
  | { type: 'everySalon' }
  | { type: 'salon'; salonId: SalonId }
