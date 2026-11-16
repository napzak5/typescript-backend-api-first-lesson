import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiReviewResponse,
  ApiReviewSummaryResponse,
  DbReview,
  ReviewTally,
} from '../../models/review'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { numericSchema, timestampSchema } from './columns'

/**
 * Database row → API response. Property names are the column names; what
 * changes is the representation of some columns:
 * - `timestamptz` is read in PostgreSQL's text format and returned as ISO 8601
 * - `imageUrls` is a JSON array in the database and a list of text in the API
 * - an average is a `numeric`, read as text and returned as a number
 */

const convertedColumnsSchema = z.object({
  imageUrls: z.array(z.string()),
  ownerRespondedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

const toApiReview = (
  review: DbReview,
): Result<ApiReviewResponse, DomainError> =>
  Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, review, 'Invalid stored review'),
      (converted) => ({ ...review, ...converted }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored review ${review.id} does not match the API model`,
        error,
      ),
  )

export const ReviewReadMapper = {
  toApiReview,

  toApiReviews(reviews: DbReview[]): Result<ApiReviewResponse[], DomainError> {
    const apiReviews: ApiReviewResponse[] = []
    for (const review of reviews) {
      const mapped = toApiReview(review)
      if (mapped.type === 'error') {
        return mapped
      }
      apiReviews.push(mapped.data)
    }
    return Result.success(apiReviews)
  },

  /** The distribution has every rating from 1 to 5, those of no review at 0. */
  toApiReviewSummary(
    tally: ReviewTally,
  ): Result<ApiReviewSummaryResponse, DomainError> {
    return Result.mapError(
      Result.map(
        parseWith(
          numericSchema.nullable(),
          tally.averageRating,
          'Invalid average rating',
        ),
        (averageRating) => ({
          averageRating,
          totalReviews: tally.totalReviews,
          ratingDistribution: Object.fromEntries(
            tally.ratingCounts.map((reviews, index) => [
              String(index + 1),
              reviews,
            ]),
          ),
        }),
      ),
      (error) =>
        DomainErrors.database(
          'The average rating of the reviews does not match the API model',
          error,
        ),
    )
  },
}
