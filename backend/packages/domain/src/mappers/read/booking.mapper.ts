import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiBookingResponse,
  ApiBookingServiceResponse,
  BookingId,
  BookingWithServices,
  DbBookingService,
} from '../../models/booking'
import type { ApiPage, Paging } from '../../models/page'
import type { BookingList } from '../../repositories/booking.repository'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * Database rows → API response. Property names are the column names; what
 * changes is the representation of the `timestamptz` columns, which are
 * read in PostgreSQL's text format and returned as ISO 8601.
 *
 * Every property is named: a booking keeps where it was made from
 * (`ipAddress`, `userAgent`), which no response shows, and a column added
 * to either table is not shown by itself.
 */

const convertedServiceColumnsSchema = z.object({
  startTime: timestampSchema,
  endTime: timestampSchema,
  completedAt: timestampSchema.nullable(),
}) satisfies z.ZodType<
  Pick<ApiBookingServiceResponse, 'startTime' | 'endTime' | 'completedAt'>
>

const convertedBookingColumnsSchema = z.object({
  startTime: timestampSchema,
  endTime: timestampSchema,
  reminderSentAt: timestampSchema.nullable(),
  cancelledAt: timestampSchema.nullable(),
  completedAt: timestampSchema.nullable(),
  actualStartTime: timestampSchema.nullable(),
  actualEndTime: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiBookingResponse,
    | 'startTime'
    | 'endTime'
    | 'reminderSentAt'
    | 'cancelledAt'
    | 'completedAt'
    | 'actualStartTime'
    | 'actualEndTime'
    | 'createdAt'
    | 'updatedAt'
  >
>

const toApiBookingService = (
  service: DbBookingService,
): Result<ApiBookingServiceResponse, DomainError> =>
  Result.map(
    parseWith(
      convertedServiceColumnsSchema,
      service,
      'Invalid stored booking service',
    ),
    (converted) => ({
      id: service.id,
      serviceId: service.serviceId,
      staffId: service.staffId,
      startTime: converted.startTime,
      endTime: converted.endTime,
      duration: service.duration,
      price: service.price,
      discountAmount: service.discountAmount,
      finalPrice: service.finalPrice,
      taxIncluded: service.taxIncluded,
      isCompleted: service.isCompleted,
      completedAt: converted.completedAt,
      notes: service.notes,
      sortOrder: service.sortOrder,
    }),
  )

const toApiBookingServices = (
  services: DbBookingService[],
): Result<ApiBookingServiceResponse[], DomainError> => {
  const apiServices: ApiBookingServiceResponse[] = []
  for (const service of services) {
    const mapped = toApiBookingService(service)
    if (mapped.type === 'error') {
      return mapped
    }
    apiServices.push(mapped.data)
  }
  return Result.success(apiServices)
}

const toApiBooking = ({
  booking,
  services,
}: BookingWithServices): Result<ApiBookingResponse, DomainError> =>
  Result.mapError(
    Result.flatMap(
      parseWith(
        convertedBookingColumnsSchema,
        booking,
        'Invalid stored booking',
      ),
      (converted) =>
        Result.map(toApiBookingServices(services), (apiServices) => ({
          id: booking.id,
          bookingNumber: booking.bookingNumber,
          salonId: booking.salonId,
          customerId: booking.customerId,
          staffId: booking.staffId,
          bookingDate: booking.bookingDate,
          startTime: converted.startTime,
          endTime: converted.endTime,
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
          internalNotes: booking.internalNotes,
          reminderSent: booking.reminderSent,
          reminderSentAt: converted.reminderSentAt,
          cancelledAt: converted.cancelledAt,
          cancelledBy: booking.cancelledBy,
          cancellationReason: booking.cancellationReason,
          cancellationFee: booking.cancellationFee,
          completedAt: converted.completedAt,
          actualStartTime: converted.actualStartTime,
          actualEndTime: converted.actualEndTime,
          source: booking.source,
          services: apiServices,
          createdAt: converted.createdAt,
          updatedAt: converted.updatedAt,
        })),
    ),
    // The request was fine; the stored rows are not.
    (error) =>
      DomainErrors.database(
        `Stored booking ${booking.id} does not match the API model`,
        error,
      ),
  )

export const BookingReadMapper = {
  toApiBooking,

  toApiBookingService(
    service: DbBookingService,
  ): Result<ApiBookingServiceResponse, DomainError> {
    return Result.mapError(toApiBookingService(service), (error) =>
      // The request was fine; the stored row is not.
      DomainErrors.database(
        `Stored booking service ${service.id} does not match the API model`,
        error,
      ),
    )
  },

  toApiBookings(
    bookings: BookingWithServices[],
  ): Result<ApiBookingResponse[], DomainError> {
    const apiBookings: ApiBookingResponse[] = []
    for (const booking of bookings) {
      const mapped = toApiBooking(booking)
      if (mapped.type === 'error') {
        return mapped
      }
      apiBookings.push(mapped.data)
    }
    return Result.success(apiBookings)
  },

  /** The bookings a list found as a page of it. */
  toApiBookingPage(
    { bookings, total, hasMore }: BookingList,
    paging: Paging<BookingId>,
  ): Result<ApiPage<ApiBookingResponse>, DomainError> {
    return Result.map(BookingReadMapper.toApiBookings(bookings), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },
}
