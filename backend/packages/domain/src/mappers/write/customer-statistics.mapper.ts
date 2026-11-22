import type { CustomerStatisticsPeriod } from '../../repositories/customer-statistics.repository'
import type { CustomerStatisticsGetRequest } from '../../schemas/customer-statistics.schema'

/**
 * API request → what the statistics of a customer are counted over: a
 * salon and the days of a period, as the query names them.
 */
export const CustomerStatisticsWriteMapper = {
  fromGetRequest(
    request: CustomerStatisticsGetRequest,
  ): CustomerStatisticsPeriod {
    return {
      salonId: request.salonId,
      startDate: request.startDate,
      endDate: request.endDate,
    }
  },
}
