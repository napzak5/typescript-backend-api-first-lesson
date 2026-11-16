import type { ISalesReportRepository } from '../../../repositories/sales-report.repository'

/** Everything the sales report use cases need from the outside. */
export interface SalesReportUseCaseDependencies {
  salesReportRepository: ISalesReportRepository
}
