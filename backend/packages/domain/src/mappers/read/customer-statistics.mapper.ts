import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { favorites } from '../../business-logic/customer-statistics/_shared/statistics'
import {
  averageOf,
  percentageOf,
} from '../../business-logic/sales-report/_shared/report'
import type { CustomerId } from '../../models/customer'
import type {
  ApiCustomerStatisticsResponse,
  ApiCustomerStatisticsServiceResponse,
  ApiCustomerStatisticsStaffResponse,
} from '../../models/customer-statistics'
import type {
  CustomerStatisticsFigures,
  CustomerStatisticsPeriod,
} from '../../repositories/customer-statistics.repository'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

const storedTimesSchema = z.object({
  lastVisit: timestampSchema.nullable(),
  customerSince: timestampSchema,
})

/**
 * What was counted of a customer → API response. The two moments are read
 * in PostgreSQL's text format and returned as ISO 8601. Every property of
 * a favorite is named: what a row of the figures carries besides is not
 * shown.
 */
export const CustomerStatisticsReadMapper = {
  /**
   * The statistics of a customer at a salon in a period, from what its
   * bookings and its sales come to. The rates are per cent of the bookings
   * and the average is of the sales of a booking, both rounded as in a
   * sales report.
   */
  toApiStatistics(
    customerId: CustomerId,
    { salonId, startDate, endDate }: CustomerStatisticsPeriod,
    figures: CustomerStatisticsFigures,
  ): Result<ApiCustomerStatisticsResponse, DomainError> {
    return Result.mapError(
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
  },
}
