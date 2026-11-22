import {
  ReviewReportReasonTypeSchema,
  ReviewReportStatusTypeSchema,
} from '@beauty-salon-backend/generated'
import { z } from 'zod'
import { reviewIdSchema } from '../models/review'
import {
  type ApiReviewReportRequest,
  type ApiReviewReportSearchRequest,
  reviewReportIdSchema,
} from '../models/review-report'
import { salonIdSchema } from '../models/salon'
import { nonBlankText } from './rules'

/**
 * Validation of the requests of the reports of reviews. The limits are
 * those of the database columns and of its CHECK constraints.
 *
 * Who reports, whose the review is and whether the account reported it
 * already are looked at where the report is written
 * (`planReviewReport`).
 */

/**
 * A report for a reason the list does not name says what it is about: the
 * administrators would not know what to look for.
 */
const otherNeedsDetails = (
  context: z.core.ParsePayload<{
    reason: string
    details: string | null
  }>,
): void => {
  const { reason, details } = context.value
  if (reason === 'other' && details === null) {
    context.issues.push({
      code: 'custom',
      path: ['details'],
      message: 'Must be given when reason is other',
      input: details,
    })
  }
}

export const reviewReportRequestSchema = z
  .strictObject({
    reason: ReviewReportReasonTypeSchema,
    details: nonBlankText.max(2000).nullable(),
  })
  .check(otherNeedsDetails) satisfies z.ZodType<ApiReviewReportRequest>

export const reviewReportSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: reviewReportIdSchema.exactOptional(),
  status: ReviewReportStatusTypeSchema.exactOptional(),
  reviewId: reviewIdSchema.exactOptional(),
  salonId: salonIdSchema.exactOptional(),
}) satisfies z.ZodType<ApiReviewReportSearchRequest>

/** A search of review reports that passed the rules of its own. */
export type ReviewReportSearchRequest = z.infer<
  typeof reviewReportSearchRequestSchema
>
