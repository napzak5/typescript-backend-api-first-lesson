import type {
  PaymentMethodType,
  ServiceCategoryType,
} from '@beauty-salon-backend/generated'
import type { Result } from '@beauty-salon-backend/utility'
import type { SalonId } from '../models/salon'
import type { DomainError } from '../shared'

/** The sales a report counts: those of a salon whose day is in a period, both ends included. */
export type SalesPeriod = {
  salonId: SalonId
  /** The first day of the sales (`YYYY-MM-DD`). */
  startDate: string
  /** The last day of the sales (`YYYY-MM-DD`). */
  endDate: string
}

/**
 * What the sales of one day that are not void come to. A day without such
 * a sale has no figures.
 */
export type DayFigures = {
  saleDate: string
  /** The sum of `totalAmount`. */
  sales: number
  /** The sum of `taxAmount`. */
  tax: number
  /** The sum of `discountAmount`. */
  discounts: number
  /** How many sales there are. */
  transactions: number
  /** The sum of `refundAmount` of the payments of the sales, whenever they were refunded. */
  refunds: number
}

/**
 * What the payments of the sales that were received (completed,
 * partial_refund, refunded) come to, by the kind of their payment method.
 */
export type MethodFigures = {
  method: PaymentMethodType
  /** The sum of `amount` less `refundAmount`. */
  amount: number
  /** How many payments there are. */
  count: number
}

/**
 * What the service lines of the sales come to, by the kind of the category
 * of their service as it is now: `other` for a service without a category
 * and for a line without `itemId`.
 */
export type CategoryFigures = {
  category: ServiceCategoryType
  /** The sum of `totalAmount`. */
  amount: number
  /** The sum of `quantity`. */
  count: number
}

/**
 * What the lines of the sales come to, by the staff member of the line,
 * or of the sale when the line names none. A line of neither is left out.
 */
export type StaffFigures = {
  staffId: string
  /** `displayName` of the staff member as it is now. */
  displayName: string
  /** The sum of `totalAmount` of every line. */
  totalSales: number
  /** The sum of `totalAmount` of the lines whose `itemType` is `service`. */
  serviceSales: number
  /** The sum of `quantity` of the lines whose `itemType` is `service`. */
  serviceCount: number
}

/** What the sales of a period that are not void come to, in every way a report divides them. */
export type SalesFigures = {
  /** In the order of the days. */
  days: readonly DayFigures[]
  methods: readonly MethodFigures[]
  categories: readonly CategoryFigures[]
  staff: readonly StaffFigures[]
}

export interface ISalesReportRepository {
  /**
   * What the sales of a salon in a period come to, read at one moment;
   * null when the salon is not there or was deleted.
   */
  findFigures(
    period: SalesPeriod,
  ): Promise<Result<SalesFigures | null, DomainError>>
}
