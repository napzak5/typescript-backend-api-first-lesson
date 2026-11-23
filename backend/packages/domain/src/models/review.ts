import type { reviews } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import { type DeepRequired, Result } from '@beauty-salon-backend/utility'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/api'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import type { BookingId } from './booking'
import type { CustomerId } from './customer'
import type { SalonId } from './salon'
import type { StaffId } from './staff'

// ID: a UUID that has been checked.
export const reviewIdSchema = uuidSchema.brand<'ReviewId'>()
export type ReviewId = z.infer<typeof reviewIdSchema>

const reviewIdParameterSchema = z.object({ id: reviewIdSchema })

export const parseReviewId = (id: unknown): Result<ReviewId, DomainError> =>
  Result.map(
    parseWith(reviewIdParameterSchema, { id }, reviewMessages.invalidReviewId),
    (parameters) => parameters.id,
  )

// API types, generated from TypeSpec
export type ApiReviewResponse = components['schemas']['Models.ReviewResponse']
export type ApiReviewCreateRequest =
  components['schemas']['Models.ReviewCreateRequest']
export type ApiReviewUpdateRequest =
  components['schemas']['Models.ReviewUpdateRequest']
export type ApiReviewHelpfulResponse =
  components['schemas']['Models.ReviewHelpfulResponse']
export type ApiReviewRespondRequest =
  components['schemas']['Models.ReviewRespondRequest']
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

/**
 * What a customer says in a review: the stars, the texts and the images,
 * as the row stores them.
 */
type SaidInReview = Pick<
  ReviewWrite,
  | 'overallRating'
  | 'serviceRating'
  | 'staffRating'
  | 'atmosphereRating'
  | 'cleanlinessRating'
  | 'valueRating'
  | 'title'
  | 'comment'
  | 'imageUrls'
>

/**
 * The review a customer asks to write: what they say, and what the review
 * is of. Whether it is verified is not the request's to say (`planReview`).
 */
export type RequestedReview = SaidInReview & {
  salonId: SalonId
  customerId: CustomerId
  bookingId: BookingId
  staffId: StaffId | null
}

/**
 * What a customer asks to change of a review: what they say in it, and
 * nothing of what the review is of.
 */
export type RequestedReviewChange = Partial<SaidInReview>

/** The response a salon asks to write to a review; null takes it down. */
export type RequestedReviewResponse = Pick<DbReview, 'ownerResponse'>
