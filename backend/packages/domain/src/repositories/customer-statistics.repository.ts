import type { Result } from '@beauty-salon-backend/utility'
import type { CustomerId } from '../models/customer'
import type { SalonId } from '../models/salon'
import type { DomainError } from '../shared'

/** A salon and the days of a period, both ends included. */
export type CustomerStatisticsPeriod = {
  salonId: SalonId
  /** The first day (`YYYY-MM-DD`). */
  startDate: string
  /** The last day (`YYYY-MM-DD`). */
  endDate: string
}

/** A service of the completed bookings of the period. */
export type FavoriteServiceFigures = {
  serviceId: string
  /** `name` of the service as it is now. */
  name: string
  /** How many of the completed bookings have a line of the service. */
  bookingCount: number
}

/** A staff member in charge (`bookings.staffId`) of the completed bookings of the period. */
export type FavoriteStaffFigures = {
  staffId: string
  /** `displayName` of the staff member as it is now. */
  displayName: string
  /** How many of the completed bookings the staff member was in charge of. */
  bookingCount: number
}

/**
 * What the bookings and the sales of a customer at a salon in a period
 * come to. The bookings are those whose `bookingDate` is in the period,
 * the sales those that are not void whose `saleDate` is in it.
 */
export type CustomerStatisticsFigures = {
  /** How many bookings there are, whatever their status. */
  bookings: number
  /** How many of them are `cancelled`. */
  cancelled: number
  /** How many of them are `no_show`. */
  noShows: number
  /** The sum of `totalAmount` of the sales less the sum of `refundAmount` of their payments. */
  spent: number
  /** The same, of the sales that have a booking. */
  bookingSpent: number
  /** How many sales have a booking. */
  bookingSales: number
  /** `startTime` of the last completed booking, as PostgreSQL writes it; null without one. */
  lastVisit: string | null
  /** Every service of the completed bookings, in no order. */
  services: readonly FavoriteServiceFigures[]
  /** Every staff member in charge of the completed bookings, in no order. */
  staff: readonly FavoriteStaffFigures[]
  /** `loyaltyPoints` of the customer. */
  loyaltyPoints: number
  /** `createdAt` of the customer, as PostgreSQL writes it. */
  customerSince: string
}

/** What the repository finds for the statistics of a customer. */
export type CustomerStatisticsLookup =
  | { type: 'found'; figures: CustomerStatisticsFigures }
  | { type: 'salonNotFound' }
  | { type: 'customerNotFound' }

export interface ICustomerStatisticsRepository {
  /**
   * The figures of a customer at a salon in a period, read at one moment.
   * A salon that was deleted is not found, nor is a customer that was.
   * The salon is looked for first.
   */
  findStatistics(
    customerId: CustomerId,
    period: CustomerStatisticsPeriod,
  ): Promise<Result<CustomerStatisticsLookup, DomainError>>
}
