import type { BookingAction } from '../../business-logic/booking/_shared/status'
import type {
  ApiBookingCancelRequest,
  ApiBookingCompleteRequest,
  ApiBookingUpdateRequest,
  DbBookingNotes,
  LedgerReach,
  RequestedBooking,
  RequestedBookingMove,
  RequestedBookingService,
} from '../../models/booking'
import type { BookingListCriteria } from '../../repositories/booking.repository'
import type {
  BookingCreateRequest,
  BookingRescheduleRequest,
  BookingSearchRequest,
  BookingServiceCreateRequest,
} from '../../schemas/booking.schema'
import { toPaging } from './page'

/**
 * API request → what the booking ledger is asked with. Nothing is
 * converted. A request holds few of the columns of the rows it leads to:
 * the others come from the rows it refers to, so a pure function plans
 * the rows (`planBooking`, `planReschedule`, `planServiceAddition`), and
 * this mapper returns what such a plan is made from. It is where the
 * compiler checks that a request holds what the plan reads.
 */
export const BookingWriteMapper = {
  /** The booking a salon asks to enter. */
  fromCreateRequest(request: BookingCreateRequest): RequestedBooking {
    return request
  },

  /** What the salon notes of a booking: the properties the request names, and no others. */
  fromUpdateRequest(request: ApiBookingUpdateRequest): DbBookingNotes {
    return request
  },

  /** The time and the staff member a booking is asked to move to. */
  fromRescheduleRequest(
    request: BookingRescheduleRequest,
  ): RequestedBookingMove {
    return request
  },

  /** The cancellation by a keeper of the ledger, with the reason the request gives. */
  fromCancelRequest({
    cancellationReason,
  }: ApiBookingCancelRequest): BookingAction {
    return { type: 'cancel', cancellationReason }
  },

  /** The completion of the visit, with the actual times the request states. */
  fromCompleteRequest({
    actualStartTime,
    actualEndTime,
  }: ApiBookingCompleteRequest): BookingAction {
    return { type: 'complete', actualStartTime, actualEndTime }
  },

  /** The service line a request adds to a booking. */
  fromServiceCreateRequest(
    request: BookingServiceCreateRequest,
  ): RequestedBookingService {
    return request
  },

  /**
   * The criteria of the list within the reach of the reader: a filter the
   * request does not name is none.
   */
  fromSearchRequest(
    request: BookingSearchRequest,
    reach: LedgerReach,
  ): BookingListCriteria {
    return {
      reach,
      ...toPaging(request),
      salonId: request.salonId ?? null,
      customerId: request.customerId ?? null,
      staffId: request.staffId ?? null,
      status: request.status ?? null,
      bookingDateFrom: request.bookingDateFrom ?? null,
      bookingDateTo: request.bookingDateTo ?? null,
    }
  },
}
