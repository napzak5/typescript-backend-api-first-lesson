import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiPage, Paging } from '../../models/page'
import type {
  ApiReviewHelpfulResponse,
  ApiReviewResponse,
  ApiReviewSummaryResponse,
  DbReview,
  ReviewId,
  ReviewTally,
} from '../../models/review'
import type { ReviewList } from '../../repositories/review.repository'
import { type DomainError, parseStored } from '../../shared'
import { numericSchema, timestampSchema } from './columns'
import { toApiPage } from './page'

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
}) satisfies z.ZodType<
  Pick<
    ApiReviewResponse,
    'imageUrls' | 'ownerRespondedAt' | 'createdAt' | 'updatedAt'
  >
>

const toApiReview = (
  review: DbReview,
): Result<ApiReviewResponse, DomainError> =>
  Result.map(
    parseStored(
      convertedColumnsSchema,
      review,
      `Stored review ${review.id} does not match the API model`,
    ),
    (converted) => ({ ...review, ...converted }),
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

  /** The reviews a list found as a page of it. */
  toApiReviewPage(
    { reviews, total, hasMore }: ReviewList,
    paging: Paging<ReviewId>,
  ): Result<ApiPage<ApiReviewResponse>, DomainError> {
    return Result.map(ReviewReadMapper.toApiReviews(reviews), (data) =>
      toApiPage(data, { total, hasMore }, paging),
    )
  },

  /** How many customers found a review helpful, the mark that was just made among them. */
  toApiReviewHelpful(helpfulCount: number): ApiReviewHelpfulResponse {
    return { helpfulCount }
  },

  /** The distribution has every rating from 1 to 5, those of no review at 0. */
  toApiReviewSummary(
    tally: ReviewTally,
  ): Result<ApiReviewSummaryResponse, DomainError> {
    return Result.map(
      parseStored(
        numericSchema.nullable(),
        tally.averageRating,
        'The average rating of the reviews does not match the API model',
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
    )
  },
}
