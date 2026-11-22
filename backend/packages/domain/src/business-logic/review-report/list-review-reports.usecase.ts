import { Result } from '@beauty-salon-backend/utility'
import { ReviewReportReadMapper } from '../../mappers/read/review-report.mapper'
import { ReviewReportWriteMapper } from '../../mappers/write/review-report.mapper'
import type { Actor } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import type { ApiReviewReportResponse } from '../../models/review-report'
import { reviewReportSearchRequestSchema } from '../../schemas/review-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { notFound } from '../booking/_shared/plan'
import { mayHandleReviewReports } from './_shared/authorization'
import type { ReviewReportUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = 'Invalid review report search'

export class ListReviewReportsUseCase {
  constructor(private readonly dependencies: ReviewReportUseCaseDependencies) {}

  /**
   * Lists the reports of the reviews of the salons that are not deleted,
   * those the filters leave, oldest first: the reports are handled in the
   * order they came in. It is the administrators' alone; anybody else is
   * refused before the query is looked at, even one that could not be
   * decoded. The cursor of a page is the ID of its last report; one that
   * names no report that is listed is refused.
   */
  async execute(
    actor: Actor,
    query: Result<unknown, DomainError>,
  ): Promise<Result<ApiPage<ApiReviewReportResponse>, DomainError>> {
    if (!mayHandleReviewReports(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    if (query.type === 'error') {
      return query
    }
    const request = parseWith(
      reviewReportSearchRequestSchema,
      query.data,
      MESSAGE,
    )
    if (request.type === 'error') {
      return request
    }
    const criteria = ReviewReportWriteMapper.fromSearchRequest(request.data)

    const listed = await this.dependencies.reviewReportRepository.list(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          notFound('cursor', 'a review report that is listed'),
        ]),
      )
    }

    return ReviewReportReadMapper.toApiReviewReportPage(listed.data, criteria)
  }
}
