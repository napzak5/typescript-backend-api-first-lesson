import type { IReviewReportRepository } from '../../../repositories/review-report.repository'

/** Everything the use cases of the reports of reviews need from the outside. */
export interface ReviewReportUseCaseDependencies {
  reviewReportRepository: IReviewReportRepository
}
