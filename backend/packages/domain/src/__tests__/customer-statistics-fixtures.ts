import type { CustomerStatisticsFigures } from '../repositories/customer-statistics.repository'

/** What was counted of a customer without a booking or a sale in the period. */
export const customerStatisticsFigures = (
  overrides: Partial<CustomerStatisticsFigures> = {},
): CustomerStatisticsFigures => ({
  bookings: 0,
  cancelled: 0,
  noShows: 0,
  spent: 0,
  bookingSpent: 0,
  bookingSales: 0,
  lastVisit: null,
  services: [],
  staff: [],
  loyaltyPoints: 120,
  customerSince: '2025-04-01 09:30:00.123456+09',
  ...overrides,
})
