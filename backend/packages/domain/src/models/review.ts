import type { reviews } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import { type DeepRequired, Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'

// ID: a UUID that has been checked.
export const reviewIdSchema = uuidSchema.brand<'ReviewId'>()
export type ReviewId = z.infer<typeof reviewIdSchema>

const reviewIdParameterSchema = z.object({ id: reviewIdSchema })

export const parseReviewId = (id: unknown): Result<ReviewId, DomainError> =>
  Result.map(
    parseWith(reviewIdParameterSchema, { id }, 'Invalid review ID'),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiReviewResponse = components['schemas']['Models.ReviewResponse']
export type ApiReviewCreateRequest =
  components['schemas']['Models.ReviewCreateRequest']
export type ApiReviewSearchRequest = NonNullable<
  operations['ReviewCrud_list']['parameters']['query']
>
export type ApiReviewSummaryResponse =
  components['schemas']['Models.ReviewSummaryResponse']

// Database types, inferred from the Drizzle schema
export type DbReview = DeepRequired<typeof reviews.$inferSelect>

/**
 * What a review written through the API stores. The ID and the times are
 * the database's; the helpful and the report counts start at 0, and there
 * is no response of the salon yet.
 */
export type ReviewWrite = Pick<
  DbReview,
  | 'salonId'
  | 'customerId'
  | 'bookingId'
  | 'staffId'
  | 'overallRating'
  | 'serviceRating'
  | 'staffRating'
  | 'atmosphereRating'
  | 'cleanlinessRating'
  | 'valueRating'
  | 'title'
  | 'comment'
  | 'isVerified'
> & { imageUrls: string[] }

/**
 * What the reviews of a salon or of a staff member come to, as the
 * database counts them.
 */
export type ReviewTally = {
  /**
   * The average of the overall ratings, rounded to two decimals, in the
   * text of a `numeric`; null when there are no reviews.
   */
  averageRating: string | null
  totalReviews: number
  /** How many reviews give each overall rating, from 1 to 5. */
  ratingCounts: [number, number, number, number, number]
}
