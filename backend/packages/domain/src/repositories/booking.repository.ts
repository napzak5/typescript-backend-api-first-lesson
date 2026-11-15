import type { Result } from '@beauty-salon-backend/utility'
import type { BookingOrigin } from '../business-logic/booking/_shared/plan'
import type {
  BookingId,
  BookingReach,
  BookingWithServices,
  DbBooking,
} from '../models/booking'
import type { CustomerId } from '../models/customer'
import type { SalonId } from '../models/salon'
import type { StaffId } from '../models/staff'
import type { BookingCreateRequest } from '../schemas/booking.schema'
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
   * A page of the bookings that match, by the time they begin, earliest
   * first. Resolves to `null` when `after` names no booking within the
   * reach.
   */
  list(
    criteria: BookingListCriteria,
  ): Promise<Result<BookingList | null, DomainError>>
}
