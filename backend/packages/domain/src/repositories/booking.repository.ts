import type { Result } from '@beauty-salon-backend/utility'
import type { BookingOrigin } from '../business-logic/booking/_shared/plan'
import type { BookingMove } from '../business-logic/booking/_shared/reschedule'
import type {
  ServiceAdditionPlan,
  ServiceRemovalPlan,
} from '../business-logic/booking/_shared/service-lines'
import type {
  BookingAction,
  StatusChangeRefusal,
} from '../business-logic/booking/_shared/status'
import type { UserId } from '../models/auth'
import type {
  BookingId,
  BookingReach,
  BookingServiceId,
  BookingWithServices,
  DbBooking,
  DbBookingNotes,
  DbBookingService,
} from '../models/booking'
import type { CustomerId } from '../models/customer'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type {
  BookingCreateRequest,
  BookingRescheduleRequest,
  BookingServiceCreateRequest,
} from '../schemas/booking.schema'
import type { DomainError, ValidationIssue } from '../shared'

/**
 * Why a booking was not created:
 * - `invalid`: the request refers to something that is not there, or the
 *   amounts are more than a booking can hold
 * - `timeZoneUnknown`: the salon has a time zone the runtime does not know
 * - `staffOccupied`: these staff members have, at a time of the booking, as
 *   many other bookings as they take at once
 * - `bookingNumberTaken`: another booking has the number
 */
export type BookingCreationRefusal =
  | { type: 'invalid'; issues: ValidationIssue[] }
  | { type: 'timeZoneUnknown' }
  | { type: 'staffOccupied'; staffIds: string[] }
  | { type: 'bookingNumberTaken' }

export type BookingCreation =
  | { type: 'created'; booking: BookingWithServices }
  | BookingCreationRefusal

/**
 * What became of a change of the status of a booking:
 * - `changed`: the booking as it is now
 * - `notFound`: no booking within the reach has the ID
 * - otherwise why the status was not changed (`planStatusChange`)
 */
export type BookingStatusChange =
  | { type: 'changed'; booking: BookingWithServices }
  | { type: 'notFound' }
  | StatusChangeRefusal

/**
 * What became of a reschedule:
 * - `rescheduled`: the booking as it is now
 * - `notFound`: no booking within the reach has the ID
 * - `statusDoesNotAllow`: the visit is under way or the booking is closed
 * - otherwise what stands in the way of the move, as of a booking that is
 *   entered: the staff member is not one of the salon, the salon has a
 *   time zone that is not known, staff members are occupied
 */
export type BookingReschedule =
  | { type: 'rescheduled'; booking: BookingWithServices }
  | { type: 'notFound' }
  | Exclude<BookingMove, { type: 'moved' }>
  | Exclude<BookingCreationRefusal, { type: 'bookingNumberTaken' }>

/** A record that refers to a booking and keeps it from being deleted. */
export type BookingReference = 'sale' | 'treatmentRecord'

/**
 * What became of the deletion of a booking:
 * - `deleted`: the booking is gone, with its lines, its history and its review
 * - `notFound`: no booking within the reach has the ID
 * - `referredTo`: these records of what took place refer to the booking
 */
export type BookingDeletion =
  | { type: 'deleted' }
  | { type: 'notFound' }
  | { type: 'referredTo'; by: BookingReference[] }

/**
 * What became of a service line that was to be added to a booking:
 * - `added`: the line as it is stored
 * - `notFound`: no booking within the reach has the ID
 * - `staffOccupied`: the staff member of the line has, at its time, as many
 *   other bookings as they take at once
 * - otherwise why the line was not planned (`planServiceAddition`)
 */
export type BookingServiceAddition =
  | { type: 'added'; service: DbBookingService }
  | { type: 'notFound' }
  | { type: 'staffOccupied'; staffIds: string[] }
  | Exclude<ServiceAdditionPlan, { type: 'planned' }>

/**
 * What became of a service line that was to be removed from a booking:
 * - `removed`: the line is gone
 * - `notFound`: no booking within the reach has the ID
 * - otherwise why the line stays (`planServiceRemoval`)
 */
export type BookingServiceRemoval =
  | { type: 'removed' }
  | { type: 'notFound' }
  | Exclude<ServiceRemovalPlan, { type: 'planned' }>

export type BookingListCriteria = {
  /** The bookings the list is taken from. */
  reach: BookingReach
  limit: number
  /** The booking after which the page starts; null for the first page. */
  after: BookingId | null
  salonId: SalonId | null
  customerId: CustomerId | null
  /** The staff member in charge of a booking or of one of its services. */
  staffId: StaffId | null
  status: DbBooking['status'] | null
  /** The first day of the visits that are listed, `YYYY-MM-DD`. */
  bookingDateFrom: string | null
  /** The last day of the visits that are listed, `YYYY-MM-DD`. */
  bookingDateTo: string | null
}

export type BookingList = {
  bookings: BookingWithServices[]
  /** How many bookings match the criteria, on every page together. */
  total: number
  hasMore: boolean
}

/**
 * Persistence of the bookings. A booking is read with its service lines,
 * in their order. A reader names the bookings it reaches, and a booking
 * outside of them is one that does not exist.
 */
export interface IBookingRepository {
  /**
   * Plans the booking from what the request refers to (`planBooking`) and
   * writes it with its service lines and the first entry of its status
   * history. The rows the plan is made from are held until the booking is
   * written, and the staff members of its service lines are booked one
   * request after the other, so no two bookings are each written because
   * the other was not there yet.
   */
  create(
    request: BookingCreateRequest,
    origin: BookingOrigin,
  ): Promise<Result<BookingCreation, DomainError>>

  findById(
    id: BookingId,
    reach: BookingReach,
  ): Promise<Result<BookingWithServices | null, DomainError>>

  /**
   * Takes an action on the status of a booking within the reach
   * (`planStatusChange`) and writes what it changes: the booking, its
   * service lines when the visit is completed, an entry of the status
   * history, and what the customer has of visits, cancellations and
   * no-shows, counted from their bookings. The booking is held from the
   * moment its status is read, so of two actions on one booking the second
   * meets what the first made of it.
   */
  changeStatus(
    id: BookingId,
    reach: BookingReach,
    action: BookingAction,
    changedBy: UserId,
  ): Promise<Result<BookingStatusChange, DomainError>>

  /**
   * Writes what the salon notes of a booking within the reach: the
   * properties that are named, and no others. Resolves to the booking as
   * it is then, or to `null` when no booking within the reach has the ID.
   */
  update(
    id: BookingId,
    reach: BookingReach,
    notes: DbBookingNotes,
  ): Promise<Result<BookingWithServices | null, DomainError>>

  /**
   * Moves a booking within the reach to another time and another staff
   * member in charge (`moveBooking`, `planReschedule`) and writes the
   * booking and its service lines. The booking is held from the moment its
   * status is read, and the staff members of its lines are booked one
   * request after the other, as when a booking is created. The lines the
   * booking had before the move do not stand in its own way.
   */
  reschedule(
    id: BookingId,
    reach: BookingReach,
    request: BookingRescheduleRequest,
  ): Promise<Result<BookingReschedule, DomainError>>

  /**
   * Removes a booking within the reach with its service lines, its status
   * history and its review, unless a sale or a treatment record refers to
   * it, and counts again what the customer has of visits, cancellations
   * and no-shows when the booking was counted among them.
   */
  delete(
    id: BookingId,
    reach: BookingReach,
  ): Promise<Result<BookingDeletion, DomainError>>

  /**
   * Adds a service line to a booking within the reach
   * (`planServiceAddition`) and writes what the booking says of its lines
   * again. The booking is held from the moment its lines are read, the
   * service and the staff member of the line are held like those of a
   * booking that is entered, and the lines the booking has already do not
   * stand in the way of the new one.
   */
  addService(
    id: BookingId,
    reach: BookingReach,
    request: BookingServiceCreateRequest,
  ): Promise<Result<BookingServiceAddition, DomainError>>

  /**
   * A service line of a booking within the reach. Resolves to `null` when
   * no such booking has the line.
   */
  findService(
    id: BookingId,
    serviceId: BookingServiceId,
    reach: BookingReach,
  ): Promise<Result<DbBookingService | null, DomainError>>

  /**
   * Removes a service line from a booking within the reach
   * (`planServiceRemoval`) and writes what the booking says of the lines
   * that stay.
   */
  removeService(
    id: BookingId,
    serviceId: BookingServiceId,
    reach: BookingReach,
  ): Promise<Result<BookingServiceRemoval, DomainError>>

  /**
   * A page of the bookings that match, by the time they begin, earliest
   * first. Resolves to `null` when `after` names no booking within the
   * reach.
   */
  list(
    criteria: BookingListCriteria,
  ): Promise<Result<BookingList | null, DomainError>>
}
