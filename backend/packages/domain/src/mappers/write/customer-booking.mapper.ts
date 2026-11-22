import type { BookingAction } from '../../business-logic/booking/_shared/status'
import type {
  ApiBookingCancelRequest,
  CustomerReach,
  RequestedBookingMove,
  RequestedCustomerBooking,
} from '../../models/booking'
import type { BookingListCriteria } from '../../repositories/booking.repository'
import type {
  BookingRescheduleRequest,
  CustomerBookingCreateRequest,
  CustomerBookingSearchRequest,
} from '../../schemas/booking.schema'
import { toPaging } from './page'

/**
 * API request → what a customer asks the booking ledger for. Nothing is
 * converted: the rows are planned from the slot the customer asks for and
 * from what it refers to (`planCustomerBooking`, `planCustomerMove`).
 */
export const CustomerBookingWriteMapper = {
  /** The slot a customer asks to book. */
  fromCreateRequest(
    request: CustomerBookingCreateRequest,
  ): RequestedCustomerBooking {
    return request
  },

  /** The slot a customer asks to move their booking to. */
  fromRescheduleRequest(
    request: BookingRescheduleRequest,
  ): RequestedBookingMove {
    return request
  },

  /** The cancellation by the customer whose booking it is, with the reason they give. */
  fromCancelRequest({
    cancellationReason,
  }: ApiBookingCancelRequest): BookingAction {
    return { type: 'cancelAsCustomer', cancellationReason }
  },

  /**
   * The criteria of the list of a customer's own bookings. No salon,
   * customer or staff member narrows it: the reach is the customer.
   */
  fromSearchRequest(
    request: CustomerBookingSearchRequest,
    reach: CustomerReach,
  ): BookingListCriteria {
    return {
      reach,
      ...toPaging(request),
      salonId: null,
      customerId: null,
      staffId: null,
      status: request.status ?? null,
      bookingDateFrom: request.bookingDateFrom ?? null,
      bookingDateTo: request.bookingDateTo ?? null,
    }
  },
}
