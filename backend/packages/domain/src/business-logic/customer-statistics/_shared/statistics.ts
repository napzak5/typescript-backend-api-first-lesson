import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { timestampSchema } from '../../../mappers/read/columns'
import type { CustomerId } from '../../../models/customer'
import type {
  ApiCustomerStatisticsResponse,
  ApiCustomerStatisticsServiceResponse,
  ApiCustomerStatisticsStaffResponse,
} from '../../../models/customer-statistics'
import type {
  CustomerStatisticsFigures,
  CustomerStatisticsPeriod,
} from '../../../repositories/customer-statistics.repository'
import { type DomainError, DomainErrors, parseWith } from '../../../shared'
import {
  averageOf,
  compareText,
  percentageOf,
} from '../../sales-report/_shared/report'

/** How many services and staff members the statistics name. */
export const FAVORITES = 5

const storedTimesSchema = z.object({
  lastVisit: timestampSchema.nullable(),
  customerSince: timestampSchema,
})

/** The most booked first, then by ID; the first `FAVORITES`. */
const favorites = <T extends { bookingCount: number }>(
  rows: readonly T[],
  idOf: (row: T) => string,
): T[] =>
  [...rows]
    .sort(
      (first, second) =>
        second.bookingCount - first.bookingCount ||
        compareText(idOf(first), idOf(second)),
    )
    .slice(0, FAVORITES)

/**
 * The statistics of a customer at a salon in a period, from what its
 * bookings and its sales come to. The rates are per cent of the bookings
 * and the average is of the sales of a booking, both rounded as in a
 * sales report.
 */
export const statisticsOf = (
  customerId: CustomerId,
  { salonId, startDate, endDate }: CustomerStatisticsPeriod,
  figures: CustomerStatisticsFigures,
): Result<ApiCustomerStatisticsResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(storedTimesSchema, figures, 'Invalid stored statistics'),
      ({ lastVisit, customerSince }) => ({
        customerId,
        salonId,
        startDate,
        endDate,
        totalBookings: figures.bookings,
        totalSpent: figures.spent,
        averageBookingValue: averageOf(
          figures.bookingSpent,
          figures.bookingSales,
        ),
        lastVisit,
        favoriteServices: favorites(
          figures.services,
          ({ serviceId }) => serviceId,
        ).map(
          ({
            serviceId,
            name,
            bookingCount,
          }): ApiCustomerStatisticsServiceResponse => ({
            serviceId,
            name,
            bookingCount,
          }),
        ),
        favoriteStaff: favorites(figures.staff, ({ staffId }) => staffId).map(
          ({
            staffId,
            displayName,
            bookingCount,
          }): ApiCustomerStatisticsStaffResponse => ({
            staffId,
            displayName,
            bookingCount,
          }),
        ),
        loyaltyPoints: figures.loyaltyPoints,
        customerSince,
        cancellationRate: percentageOf(figures.cancelled, figures.bookings),
        noShowRate: percentageOf(figures.noShows, figures.bookings),
      }),
    ),
    // The request was fine; what was stored is not.
    (error) =>
      DomainErrors.database(
        `Stored times of customer ${customerId} do not match the API model`,
        error,
      ),
  )
