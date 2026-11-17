import type { ICustomerStatisticsRepository } from '../../../repositories/customer-statistics.repository'

/** Everything the use case of the statistics of a customer needs from the outside. */
export interface CustomerStatisticsUseCaseDependencies {
  customerStatisticsRepository: ICustomerStatisticsRepository
}
