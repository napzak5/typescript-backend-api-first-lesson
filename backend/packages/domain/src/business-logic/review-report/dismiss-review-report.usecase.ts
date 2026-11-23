import { Result } from '@beauty-salon-backend/utility'
import {
  entityMessages,
  reviewReportMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { ReviewReportReadMapper } from '../../mappers/read/review-report.mapper'
import type { Actor } from '../../models/auth'
import {
  type ApiReviewReportResponse,
  parseReviewReportId,
} from '../../models/review-report'
import { type DomainError, DomainErrors } from '../../shared'
import { mayHandleReviewReports } from './_shared/authorization'
import type { ReviewReportUseCaseDependencies } from './_shared/dependencies'

export class DismissReviewReportUseCase {
  constructor(private readonly dependencies: ReviewReportUseCaseDependencies) {}

  /**
   * Dismisses a pending report, for an administrator who found nothing
   * wrong with the review, and counts the pending reports of the review
   * again. It is the administrators' alone; anybody else is refused before
   * the ID is read. A review that breaks the rules is removed instead,
   * with its reports.
   */
  async execute(
    actor: Actor,
    id: unknown,
  ): Promise<Result<ApiReviewReportResponse, DomainError>> {
    if (!mayHandleReviewReports(actor)) {
      return Result.error(DomainErrors.forbidden())
    }
    const reportId = parseReviewReportId(id)
    if (reportId.type === 'error') {
      return reportId
    }

    const dismissed = await this.dependencies.reviewReportRepository.dismiss(
      reportId.data,
      actor.userId,
    )
    if (dismissed.type === 'error') {
      return dismissed
    }

    return match(dismissed.data)
      .returnType<Result<ApiReviewReportResponse, DomainError>>()
      .with({ type: 'dismissed' }, ({ report }) =>
        ReviewReportReadMapper.toApiReviewReport(report),
      )
      .with({ type: 'reportNotFound' }, () =>
        Result.error(
          DomainErrors.notFound(entityMessages.reviewReport, reportId.data),
        ),
      )
      .with({ type: 'dismissedAlready' }, () =>
        Result.error(
          DomainErrors.conflict(reviewReportMessages.alreadyDismissed),
        ),
      )
      .exhaustive()
  }
}
