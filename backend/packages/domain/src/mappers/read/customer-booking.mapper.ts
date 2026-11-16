import { Result } from '@beauty-salon-backend/utility'
import type {
  ApiBookingServiceResponse,
  ApiCustomerBookingResponse,
  ApiCustomerBookingServiceResponse,
  BookingWithServices,
} from '../../models/booking'
import type { DomainError } from '../../shared'
import { BookingReadMapper } from './booking.mapper'

/**
 * Database rows → what a customer is shown of their booking. The values
 * are those the ledger shows; fewer of them are shown.
 *
 * Every property is named: what the salon notes for itself, what it
 * records of the visit, and who cancelled and why are not the customer's
 * to read, and a property added to the booking of the ledger is not shown
 * by itself.
 */

const toApiCustomerBookingService = (
  service: ApiBookingServiceResponse,
): ApiCustomerBookingServiceResponse => ({
  id: service.id,
  serviceId: service.serviceId,
  staffId: service.staffId,
  startTime: service.startTime,
  endTime: service.endTime,
  duration: service.duration,
  price: service.price,
  discountAmount: service.discountAmount,
  finalPrice: service.finalPrice,
  taxIncluded: service.taxIncluded,
  sortOrder: service.sortOrder,
})

const toApiCustomerBooking = (
  stored: BookingWithServices,
): Result<ApiCustomerBookingResponse, DomainError> =>
  Result.map(BookingReadMapper.toApiBooking(stored), (booking) => ({
    id: booking.id,
    bookingNumber: booking.bookingNumber,
    salonId: booking.salonId,
    staffId: booking.staffId,
    bookingDate: booking.bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    duration: booking.duration,
    status: booking.status,
    subtotal: booking.subtotal,
    discountAmount: booking.discountAmount,
    taxAmount: booking.taxAmount,
    totalAmount: booking.totalAmount,
    depositAmount: booking.depositAmount,
    pointsUsed: booking.pointsUsed,
    pointsEarned: booking.pointsEarned,
    customerRequest: booking.customerRequest,
    cancelledAt: booking.cancelledAt,
    cancellationFee: booking.cancellationFee,
    completedAt: booking.completedAt,
    services: booking.services.map(toApiCustomerBookingService),
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }))

export const CustomerBookingReadMapper = {
  toApiCustomerBooking,

  toApiCustomerBookings(
    bookings: BookingWithServices[],
  ): Result<ApiCustomerBookingResponse[], DomainError> {
    const apiBookings: ApiCustomerBookingResponse[] = []
    for (const booking of bookings) {
      const mapped = toApiCustomerBooking(booking)
      if (mapped.type === 'error') {
        return mapped
      }
      apiBookings.push(mapped.data)
    }
    return Result.success(apiBookings)
  },
}
