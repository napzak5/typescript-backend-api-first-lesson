import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID, STAFF_ID } from '../../__tests__/fixtures/auth-fixtures'
import { CUT_ID } from '../../__tests__/fixtures/booking-fixtures'
import { customerStatisticsFigures } from '../../__tests__/fixtures/customer-statistics-fixtures'
import { SALON_ID } from '../../__tests__/fixtures/fixtures'
import { customerIdSchema } from '../../models/customer'
import { salonIdSchema } from '../../models/salon'
import type { CustomerStatisticsFigures } from '../../repositories/customer-statistics.repository'
import { CustomerStatisticsReadMapper } from '../read/customer-statistics.mapper'
import { CustomerStatisticsWriteMapper } from '../write/customer-statistics.mapper'

const customerId = customerIdSchema.parse(CUSTOMER_ID)

/** November 2026 at the salon of the fixtures. */
const period = {
  salonId: salonIdSchema.parse(SALON_ID),
  startDate: '2026-11-01',
  endDate: '2026-11-30',
}

describe('CustomerStatisticsWriteMapper.fromGetRequest', () => {
  it('counts over the salon and the days the query names', () => {
    expect(CustomerStatisticsWriteMapper.fromGetRequest(period)).toStrictEqual({
      salonId: SALON_ID,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    })
  })
})

describe('CustomerStatisticsReadMapper.toApiStatistics', () => {
  it('names the customer, the salon and the period, and writes what was counted, the moments in ISO 8601 UTC', () => {
    const result = CustomerStatisticsReadMapper.toApiStatistics(
      customerId,
      period,
      customerStatisticsFigures({
        bookings: 8,
        cancelled: 1,
        noShows: 2,
        spent: 30_000,
        bookingSpent: 25_000,
        bookingSales: 3,
        lastVisit: '2026-11-20 15:00:00+09',
        services: [{ serviceId: CUT_ID, name: 'カット', bookingCount: 3 }],
        staff: [{ staffId: STAFF_ID, displayName: '佐藤', bookingCount: 2 }],
      }),
    )

    expect(result).toStrictEqual({
      type: 'success',
      data: {
        customerId: CUSTOMER_ID,
        salonId: SALON_ID,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        totalBookings: 8,
        totalSpent: 30_000,
        averageBookingValue: 8333,
        lastVisit: '2026-11-20T06:00:00.000Z',
        favoriteServices: [
          { serviceId: CUT_ID, name: 'カット', bookingCount: 3 },
        ],
        favoriteStaff: [
          { staffId: STAFF_ID, displayName: '佐藤', bookingCount: 2 },
        ],
        loyaltyPoints: 120,
        customerSince: '2025-04-01T00:30:00.123Z',
        cancellationRate: 12.5,
        noShowRate: 25,
      },
    })
  })

  it('shows of a favorite what the response names, and nothing else a row carries', () => {
    const service = {
      serviceId: CUT_ID,
      name: 'カット',
      bookingCount: 1,
      price: 4000,
    }
    const staffMember = {
      staffId: STAFF_ID,
      displayName: '佐藤',
      bookingCount: 1,
      email: 'sato@example.com',
    }

    const result = CustomerStatisticsReadMapper.toApiStatistics(
      customerId,
      period,
      customerStatisticsFigures({ services: [service], staff: [staffMember] }),
    )

    expect(result).toMatchObject({ type: 'success' })
    expect(
      result.type === 'success' ? result.data.favoriteServices : [],
    ).toStrictEqual([{ serviceId: CUT_ID, name: 'カット', bookingCount: 1 }])
    expect(
      result.type === 'success' ? result.data.favoriteStaff : [],
    ).toStrictEqual([
      { staffId: STAFF_ID, displayName: '佐藤', bookingCount: 1 },
    ])
  })

  it.each<[string, Partial<CustomerStatisticsFigures>]>([
    ['a last visit', { lastVisit: 'yesterday' }],
    ['a registration', { customerSince: 'long ago' }],
  ])(
    'reports %s that is not a time as a database error, naming the customer',
    (_case, stored) => {
      const result = CustomerStatisticsReadMapper.toApiStatistics(
        customerId,
        period,
        customerStatisticsFigures(stored),
      )

      expect(result).toMatchObject({
        type: 'error',
        error: {
          type: 'database',
          message: `Stored times of customer ${CUSTOMER_ID} do not match the API model`,
        },
      })
    },
  )
})
