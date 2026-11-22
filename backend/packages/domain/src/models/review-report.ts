import type { reviewReports } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import { type DeepRequired, Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const reviewReportIdSchema = uuidSchema.brand<'ReviewReportId'>()
export type ReviewReportId = z.infer<typeof reviewReportIdSchema>

const reviewReportIdParameterSchema = z.object({ id: reviewReportIdSchema })

export const parseReviewReportId = (
  id: unknown,
): Result<ReviewReportId, DomainError> =>
  Result.map(
    parseWith(
      reviewReportIdParameterSchema,
      { id },
      'Invalid review report ID',
    ),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiReviewReportRequest =
  components['schemas']['Models.ReviewReportRequest']
export type ApiReviewReportResponse =
  components['schemas']['Models.ReviewReportResponse']
export type ApiReviewReportSearchRequest = NonNullable<
  operations['ReviewReportCrud_list']['parameters']['query']
>

// Database types, inferred from the Drizzle schema
export type DbReviewReport = DeepRequired<typeof reviewReports.$inferSelect>

/** The report of a review that an account asks to write: why, and what it says of it. */
export type RequestedReviewReport = Pick<DbReviewReport, 'reason' | 'details'>
