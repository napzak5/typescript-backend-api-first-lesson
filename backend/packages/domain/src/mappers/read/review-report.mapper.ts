import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiReviewReportResponse,
  DbReviewReport,
  ReviewReportId,
} from '../../models/review-report'
import type { ReviewReportList } from '../../repositories/review-report.repository'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'

/**
 * Database row → API response. Property names are the column names; what
 * changes is the representation of the times: `timestamptz` is read in
 * PostgreSQL's text format and returned as ISO 8601.
 */

const convertedColumnsSchema = z.object({
  resolvedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<ApiReviewReportResponse, 'resolvedAt' | 'createdAt' | 'updatedAt'>
>

const toApiReviewReport = (
  report: DbReviewReport,
): Result<ApiReviewReportResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, report, 'Invalid stored review report'),
      (converted) => ({ ...report, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored review report ${report.id} does not match the API model`,
        error,
      ),
  )

export const ReviewReportReadMapper = {
  toApiReviewReport,

  toApiReviewReports(
    reports: DbReviewReport[],
  ): Result<ApiReviewReportResponse[], DomainError> {
    const apiReports: ApiReviewReportResponse[] = []
    for (const report of reports) {
      const mapped = toApiReviewReport(report)
      if (mapped.type === 'error') {
        return mapped
      }
      apiReports.push(mapped.data)
    }
    return Result.success(apiReports)
  },

  /** The reports a list found as a page of it. */
  toApiReviewReportPage(
    { reports, total, hasMore }: ReviewReportList,
    paging: Paging<ReviewReportId>,
  ): Result<ApiPage<ApiReviewReportResponse>, DomainError> {
    return Result.map(
      ReviewReportReadMapper.toApiReviewReports(reports),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },
}
