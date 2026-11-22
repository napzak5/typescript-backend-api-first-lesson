import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  type CustomerStatisticsUseCaseDependencies,
  GetCustomerStatisticsUseCase,
} from '../business-logic/customer-statistics'
import { FAVORITES } from '../business-logic/customer-statistics/_shared/statistics'
import type { Actor } from '../models/auth'
import type {
  CustomerStatisticsFigures,
  CustomerStatisticsLookup,
  FavoriteServiceFigures,
  FavoriteStaffFigures,
} from '../repositories/customer-statistics.repository'
import { type DomainError, DomainErrors } from '../shared'
import { actors, dataOf } from './auth-fixtures'
import { customerStatisticsFigures } from './customer-statistics-fixtures'
import { brokenRules, OTHER_SALON_ID, SALON_ID } from './fixtures'

const CUSTOMER = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7a01'
const SERVICE = (n: number): string => `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7b0${n}`
const STAFF = (n: number): string => `0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7c0${n}`

const forbidden = Result.error(DomainErrors.forbidden())
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

/** The query of November 2026 at the salon of the fixtures, as it comes in. */
const query = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  salonId: SALON_ID,
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  ...overrides,
})

const service = (n: number, bookingCount: number): FavoriteServiceFigures => ({
  serviceId: SERVICE(n),
  name: `Service ${n}`,
  bookingCount,
})

const staffMember = (
  n: number,
  bookingCount: number,
): FavoriteStaffFigures => ({
  staffId: STAFF(n),
  displayName: `Staff ${n}`,
  bookingCount,
})

const dependenciesFinding = (
  found: Result<CustomerStatisticsLookup, DomainError>,
): CustomerStatisticsUseCaseDependencies => ({
  customerStatisticsRepository: {
    findStatistics: vi.fn(async () => found),
  },
})

const found = (
  overrides: Partial<CustomerStatisticsFigures> = {},
): CustomerStatisticsUseCaseDependencies =>
  dependenciesFinding(
    Result.success({
      type: 'found',
      figures: customerStatisticsFigures(overrides),
    }),
  )

const findStatisticsOf = ({
  customerStatisticsRepository,
}: CustomerStatisticsUseCaseDependencies) =>
  vi.mocked(customerStatisticsRepository.findStatistics)

const statistics = (
  dependencies: CustomerStatisticsUseCaseDependencies,
  actor: Actor = actors.admin,
  id: unknown = CUSTOMER,
  asked: unknown = query(),
) => new GetCustomerStatisticsUseCase(dependencies).execute(actor, id, asked)

/** The statistics the admin reads; anything else fails the test. */
const statisticsData = async (
  dependencies: CustomerStatisticsUseCaseDependencies,
) => dataOf(await statistics(dependencies))

describe('GetCustomerStatisticsUseCase', () => {
  describe('who reads them', () => {
    it.each<[string, Actor]>([
      ['an admin', actors.admin],
      ['the owner of the salon', actors.ofSalon('owner')],
      ['a manager of the salon', actors.ofSalon('manager')],
      ['a staff member of the salon', actors.ofSalon('staff')],
    ])('lets %s read them', async (_who, actor) => {
      const dependencies = found()

      const result = await statistics(dependencies, actor)

      expect(result.type).toBe('success')
      expect(findStatisticsOf(dependencies)).toHaveBeenCalledWith(CUSTOMER, {
        salonId: SALON_ID,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      })
    })

    it.each<[string, Actor]>([
      ['a customer', actors.customer],
      ['a customer without a profile', actors.customerWithoutProfile],
      ['a user without a scope', actors.withoutScope],
    ])(
      'refuses %s before reading the ID and the query',
      async (_who, actor) => {
        const dependencies = found()

        const result = await statistics(dependencies, actor, 'abc', {
          salonId: 'mine',
        })

        expect(result).toEqual(forbidden)
        expect(findStatisticsOf(dependencies)).not.toHaveBeenCalled()
      },
    )

    it.each<[string, Actor]>([
      ['the owner', actors.ofSalon('owner', OTHER_SALON_ID)],
      ['a staff member', actors.ofSalon('staff', OTHER_SALON_ID)],
    ])(
      'refuses %s of another salon before looking the salon up',
      async (_who, actor) => {
        const dependencies = found()

        const result = await statistics(dependencies, actor)

        expect(result).toEqual(forbidden)
        expect(findStatisticsOf(dependencies)).not.toHaveBeenCalled()
      },
    )

    it('tells a member of another salon that the query is wrong before that it is not theirs', async () => {
      const result = await statistics(
        found(),
        actors.ofSalon('owner', OTHER_SALON_ID),
        CUSTOMER,
        query({ endDate: '2026-10-31' }),
      )

      expect(rulesOf(result)).toEqual(['endDate:custom'])
    })
  })

  describe('the ID and the query', () => {
    it('refuses an ID that is not one, before the query', async () => {
      const dependencies = found()

      const result = await statistics(dependencies, actors.admin, 'abc', {
        salonId: 'mine',
      })

      expect(rulesOf(result)).toEqual(['id:invalid_format'])
      expect(findStatisticsOf(dependencies)).not.toHaveBeenCalled()
    })

    it.each<[string, Record<string, unknown>, string]>([
      ['no salon', query({ salonId: undefined }), 'salonId:invalid_type'],
      [
        'a salon that is not an ID',
        query({ salonId: 'mine' }),
        'salonId:invalid_format',
      ],
      [
        'no first day',
        query({ startDate: undefined }),
        'startDate:invalid_type',
      ],
      ['no last day', query({ endDate: undefined }), 'endDate:invalid_type'],
      [
        'a day that does not exist',
        query({ endDate: '2026-11-31' }),
        'endDate:invalid_format',
      ],
      [
        'an end before the start',
        query({ endDate: '2026-10-31' }),
        'endDate:custom',
      ],
      [
        'a period of 367 days',
        query({ startDate: '2025-11-01', endDate: '2026-11-02' }),
        'endDate:custom',
      ],
      [
        'a parameter of the old contract',
        query({ period: '1y' }),
        'period:unrecognized_keys',
      ],
    ])('refuses a query with %s', async (_case, asked, rule) => {
      const dependencies = found()

      const result = await statistics(
        dependencies,
        actors.admin,
        CUSTOMER,
        asked,
      )

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation', message: 'Invalid customer statistics' },
      })
      expect(rulesOf(result)).toEqual([rule])
      expect(findStatisticsOf(dependencies)).not.toHaveBeenCalled()
    })

    it('takes a period of 366 days, both ends included', async () => {
      const result = await statistics(
        found(),
        actors.admin,
        CUSTOMER,
        query({ startDate: '2025-11-02', endDate: '2026-11-02' }),
      )

      expect(result.type).toBe('success')
    })

    it('reads the IDs in lower case', async () => {
      const dependencies = found()

      const result = await statistics(
        dependencies,
        actors.ofSalon('staff'),
        CUSTOMER.toUpperCase(),
        query({ salonId: SALON_ID.toUpperCase() }),
      )

      expect(result).toMatchObject({
        type: 'success',
        data: { customerId: CUSTOMER, salonId: SALON_ID },
      })
    })
  })

  describe('what the repository finds', () => {
    it('refuses a salon that is not there as a fault of the query', async () => {
      const result = await statistics(
        dependenciesFinding(Result.success({ type: 'salonNotFound' })),
      )

      expect(result).toMatchObject({
        type: 'error',
        error: { type: 'validation', message: 'Invalid customer statistics' },
      })
      expect(rulesOf(result)).toEqual(['salonId:not_found'])
    })

    it('answers a customer that is not there as not found', async () => {
      const result = await statistics(
        dependenciesFinding(Result.success({ type: 'customerNotFound' })),
      )

      expect(result).toEqual(
        Result.error(DomainErrors.notFound('Customer', CUSTOMER)),
      )
    })

    it('passes a failure of the database on', async () => {
      const result = await statistics(dependenciesFinding(databaseDown))

      expect(result).toEqual(databaseDown)
    })

    it.each<[string, Partial<CustomerStatisticsFigures>]>([
      ['a last visit', { lastVisit: 'yesterday' }],
      ['a registration', { customerSince: 'long ago' }],
    ])(
      'reports %s that is not a time as a database error',
      async (_case, overrides) => {
        const result = await statistics(found(overrides))

        expect(result).toMatchObject({
          type: 'error',
          error: {
            type: 'database',
            message: `Stored times of customer ${CUSTOMER} do not match the API model`,
          },
        })
      },
    )
  })

  describe('the values', () => {
    it('gives a customer without bookings or sales zeros, no visit and no favorites', async () => {
      expect(await statisticsData(found())).toEqual({
        customerId: CUSTOMER,
        salonId: SALON_ID,
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        totalBookings: 0,
        totalSpent: 0,
        averageBookingValue: 0,
        lastVisit: null,
        favoriteServices: [],
        favoriteStaff: [],
        loyaltyPoints: 120,
        customerSince: '2025-04-01T00:30:00.123Z',
        cancellationRate: 0,
        noShowRate: 0,
      })
    })

    it('gives the rates in per cent of the bookings, to one decimal place', async () => {
      const data = await statisticsData(
        found({ bookings: 3, cancelled: 1, noShows: 2 }),
      )

      expect(data).toMatchObject({
        totalBookings: 3,
        cancellationRate: 33.3,
        noShowRate: 66.7,
      })
    })

    it('gives the amount spent, and the average of a sale of a booking without the fraction of a yen', async () => {
      const data = await statisticsData(
        found({ spent: 30_000, bookingSpent: 20_000, bookingSales: 3 }),
      )

      expect(data).toMatchObject({
        totalSpent: 30_000,
        averageBookingValue: 6_666,
      })
    })

    it('gives an average of 0 without a sale of a booking', async () => {
      const data = await statisticsData(
        found({ spent: 5_000, bookingSpent: 0, bookingSales: 0 }),
      )

      expect(data).toMatchObject({ totalSpent: 5_000, averageBookingValue: 0 })
    })

    it('gives the last visit in the representation of the API', async () => {
      const data = await statisticsData(
        found({ lastVisit: '2026-11-20 10:00:00.123456+09' }),
      )

      expect(data.lastVisit).toBe('2026-11-20T01:00:00.123Z')
    })

    it(`names the ${FAVORITES} most booked services and staff members, by ID when they are booked as often`, async () => {
      const data = await statisticsData(
        found({
          services: [
            service(1, 1),
            service(6, 3),
            service(2, 5),
            service(5, 3),
            service(3, 1),
            service(4, 2),
          ],
          staff: [
            staffMember(3, 2),
            staffMember(1, 2),
            staffMember(2, 4),
            staffMember(4, 1),
            staffMember(5, 1),
            staffMember(6, 1),
          ],
        }),
      )

      expect(data.favoriteServices).toEqual([
        { serviceId: SERVICE(2), name: 'Service 2', bookingCount: 5 },
        { serviceId: SERVICE(5), name: 'Service 5', bookingCount: 3 },
        { serviceId: SERVICE(6), name: 'Service 6', bookingCount: 3 },
        { serviceId: SERVICE(4), name: 'Service 4', bookingCount: 2 },
        { serviceId: SERVICE(1), name: 'Service 1', bookingCount: 1 },
      ])
      expect(data.favoriteStaff).toEqual([
        { staffId: STAFF(2), displayName: 'Staff 2', bookingCount: 4 },
        { staffId: STAFF(1), displayName: 'Staff 1', bookingCount: 2 },
        { staffId: STAFF(3), displayName: 'Staff 3', bookingCount: 2 },
        { staffId: STAFF(4), displayName: 'Staff 4', bookingCount: 1 },
        { staffId: STAFF(5), displayName: 'Staff 5', bookingCount: 1 },
      ])
    })
  })
})
