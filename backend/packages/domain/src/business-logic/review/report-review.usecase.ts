import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { ReviewReportReadMapper } from '../../mappers/read/review-report.mapper'
import type { Actor } from '../../models/auth'
import { parseReviewId } from '../../models/review'
import type { ApiReviewReportResponse } from '../../models/review-report'
import { reviewReportRequestSchema } from '../../schemas/review-report.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { reviewReporterOf } from './_shared/authorization'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'
import { toUnreportedReviewError } from './_shared/refusals'

const MESSAGE = 'Invalid review report'

export class ReportReviewUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Reports a review to the administrators for the signed-in account,
   * once, and counts the pending reports of the review again. The review
   * stays as it is: the administrators decide whether it is removed.
   * Whether the actor reports reviews is decided before the request is
   * read.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiReviewReportResponse, DomainError>> {
    const reporter = reviewReporterOf(actor)
    if (reporter.type === 'error') {
      return reporter
    }
    const reviewId = parseReviewId(id)
    if (reviewId.type === 'error') {
      return reviewId
    }
    const request = parseWith(reviewReportRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const reported = await this.dependencies.reviewRepository.report(
      reviewId.data,
      reporter.data,
      request.data,
    )
    if (reported.type === 'error') {
      return reported
    }

    return match(reported.data)
      .returnType<Result<ApiReviewReportResponse, DomainError>>()
      .with({ type: 'reported' }, ({ report }) =>
        ReviewReportReadMapper.toApiReviewReport(report),
      )
      .with({ type: 'reportedAlready' }, () =>
        Result.error(
          DomainErrors.conflict(
            'The account has reported the review already; an account reports a review once',
          ),
        ),
      )
      .with(
        { type: 'reviewNotFound' },
        { type: 'reporterNotFound' },
        { type: 'ownReview' },
        { type: 'otherSalon' },
        (unreported) =>
          Result.error(toUnreportedReviewError(unreported, reviewId.data)),
      )
      .exhaustive()
  }
}
