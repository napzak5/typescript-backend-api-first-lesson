import { Result } from '@beauty-salon-backend/utility'
import { vi } from 'vitest'
import type { SalesReportUseCaseDependencies } from '../../business-logic/sales-report'
import { salonIdSchema } from '../../models/salon'
import type {
  DayFigures,
  SalesFigures,
  SalesPeriod,
  StaffFigures,
} from '../../repositories/sales-report.repository'
import type { DomainError } from '../../shared'
import { SALON_ID } from './fixtures'
import { OTHER_STAFF_MEMBER_ID, STAFF_MEMBER_ID } from './staff-fixtures'

/** November 2026 at the salon of the fixtures. */
export const salesPeriod = (
  overrides: Partial<Omit<SalesPeriod, 'salonId'>> = {},
): SalesPeriod => ({
  salonId: salonIdSchema.parse(SALON_ID),
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  ...overrides,
})

/** The query of the report of `salesPeriod`, as it comes in. */
export const periodQuery = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  salonId: SALON_ID,
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  ...overrides,
})

/** One sale of 11,000 yen with 1,000 of tax on 20 November 2026. */
export const dayFigures = (
  overrides: Partial<DayFigures> = {},
): DayFigures => ({
  saleDate: '2026-11-20',
  sales: 11000,
  tax: 1000,
  discounts: 0,
  transactions: 1,
  refunds: 0,
  ...overrides,
})

export const staffFigures = (
  overrides: Partial<StaffFigures> = {},
): StaffFigures => ({
  staffId: STAFF_MEMBER_ID,
  displayName: 'Aoi',
  totalSales: 11000,
  serviceSales: 11000,
  serviceCount: 1,
  ...overrides,
})

/**
 * Two days of November 2026: on the 20th two sales of 33,000 yen (3,000
 * of tax, 1,000 of discounts), one of which was refunded 2,000 yen; on the
 * 21st one of 11,000 yen. Two staff members and two kinds of payment.
 */
export const salesFigures = (
  overrides: Partial<SalesFigures> = {},
): SalesFigures => ({
  days: [
    dayFigures({
      sales: 33000,
      tax: 3000,
      discounts: 1000,
      transactions: 2,
      refunds: 2000,
    }),
    dayFigures({ saleDate: '2026-11-21' }),
  ],
  methods: [
    { method: 'cash', amount: 11000, count: 1 },
    { method: 'credit_card', amount: 31000, count: 2 },
  ],
  categories: [
    { category: 'cut', amount: 22000, count: 2 },
    { category: 'color', amount: 22000, count: 1 },
  ],
  staff: [
    staffFigures(),
    staffFigures({
      staffId: OTHER_STAFF_MEMBER_ID,
      displayName: 'Ren',
      totalSales: 33000,
      serviceSales: 30000,
      serviceCount: 4,
    }),
  ],
  ...overrides,
})

/** A repository that answers with these figures, or with this error. */
export const salesReportDependencies = (
  answer: Result<SalesFigures | null, DomainError> = Result.success(
    salesFigures(),
  ),
): SalesReportUseCaseDependencies => ({
  salesReportRepository: { findFigures: vi.fn(async () => answer) },
})
