import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiReviewReportResponse,
  DbReviewReport,
} from '../../models/review-report'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

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
}
