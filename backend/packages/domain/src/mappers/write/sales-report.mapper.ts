import type { SalesTrendPeriodType } from '@beauty-salon-backend/generated'
import type { SalesPeriod } from '../../repositories/sales-report.repository'
import type {
  DailySalesGetRequest,
  SalesReportGetRequest,
  SalesTrendsGetRequest,
} from '../../schemas/sales-report.schema'

/**
 * API request → what a report is counted over: a salon and the days of a
 * period, as the query names them.
 */
export const SalesReportWriteMapper = {
  /** The salon and the days of a report, of its rows and of its file. */
  fromGetRequest(request: SalesReportGetRequest): SalesPeriod {
    return {
      salonId: request.salonId,
      startDate: request.startDate,
      endDate: request.endDate,
    }
  },

  /** The sales of one day: a period of that day alone. */
  fromDailyGetRequest({ salonId, date }: DailySalesGetRequest): SalesPeriod {
    return { salonId, startDate: date, endDate: date }
  },

  /**
   * The days of the trends, and what they are cut into. The query calls
   * that unit `period`; here a period is the days.
   */
  fromTrendsGetRequest(request: SalesTrendsGetRequest): {
    period: SalesPeriod
    unit: SalesTrendPeriodType
  } {
    return {
      period: {
        salonId: request.salonId,
        startDate: request.startDate,
        endDate: request.endDate,
      },
      unit: request.period,
    }
  },
}
