import type {
  ApiReviewReportRequest,
  RequestedReviewReport,
} from '../../models/review-report'
import type { ReviewReportListCriteria } from '../../repositories/review-report.repository'
import type { ReviewReportSearchRequest } from '../../schemas/review-report.schema'
import { toPaging } from './page'

/**
 * API request → what the reports of reviews are asked with. Nothing is
 * converted: a report states its reason and its details as the columns
 * hold them. Who reports is the actor and which review is the path;
 * whether the report is written is decided where it is written
 * (`planReviewReport`).
 */
export const ReviewReportWriteMapper = {
  /** The report of a review, with the reason and the details the request gives. */
  fromReportRequest(request: ApiReviewReportRequest): RequestedReviewReport {
    return request
  },

  /** The criteria of the list: a filter the request does not name is none. */
  fromSearchRequest(
    request: ReviewReportSearchRequest,
  ): ReviewReportListCriteria {
    return {
      ...toPaging(request),
      status: request.status ?? null,
      reviewId: request.reviewId ?? null,
      salonId: request.salonId ?? null,
    }
  },
}
