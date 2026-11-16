import { ReviewSortTypeSchema } from '@beauty-salon-backend/generated'
import { z } from 'zod'
import { bookingIdSchema } from '../models/booking'
import { customerIdSchema } from '../models/customer'
import {
  type ApiReviewCreateRequest,
  type ApiReviewSearchRequest,
  reviewIdSchema,
} from '../models/review'
import { salonIdSchema } from '../models/salon'
import { staffIdSchema } from '../models/staff'
import { nonBlankText, noRepeatedEntries } from './rules'

/**
 * Validation of the requests of the reviews. The shapes are checked
 * against the generated API types, the limits are those of the database
 * columns and of its CHECK constraints, and the remaining rules are
 * business rules.
 *
 * Whose the booking is, which salon and which staff member it is of,
 * whether it was completed and whether it has a review already are looked
 * at where the review is written (`planReview`).
 */

/** A rating of a review: a whole number of stars, from 1 to 5. */
const rating = z.number().int().min(1).max(5)

/**
 * A staff member is rated only when the review names one: a rating of no
 * one is refused.
 */
const staffRatingNeedsStaff = (
  context: z.core.ParsePayload<{
    staffId: string | null
    staffRating: number | null
  }>,
): void => {
  const { staffId, staffRating } = context.value
  if (staffId === null && staffRating !== null) {
    context.issues.push({
      code: 'custom',
      path: ['staffRating'],
      message: 'Must be null when staffId is null',
      input: staffRating,
      continue: true,
    })
  }
}

export const reviewCreateRequestSchema = z
  .strictObject({
    salonId: salonIdSchema,
    customerId: customerIdSchema,
    bookingId: bookingIdSchema,
    staffId: staffIdSchema.nullable(),
    overallRating: rating,
    serviceRating: rating.nullable(),
    staffRating: rating.nullable(),
    atmosphereRating: rating.nullable(),
    cleanlinessRating: rating.nullable(),
    valueRating: rating.nullable(),
    title: nonBlankText.max(255).nullable(),
    comment: nonBlankText.nullable(),
    imageUrls: z.array(z.httpUrl().max(500)).max(10).check(noRepeatedEntries),
  })
  .check(staffRatingNeedsStaff) satisfies z.ZodType<ApiReviewCreateRequest>

/** A review that passed the rules of its own. */
export type ReviewCreateRequest = z.infer<typeof reviewCreateRequestSchema>

export const reviewSearchRequestSchema = z
  .strictObject({
    limit: z.number().int().min(1).max(100).exactOptional(),
    cursor: reviewIdSchema.exactOptional(),
    salonId: salonIdSchema.exactOptional(),
    staffId: staffIdSchema.exactOptional(),
    customerId: customerIdSchema.exactOptional(),
    bookingId: bookingIdSchema.exactOptional(),
    isVerified: z.boolean().exactOptional(),
    minRating: rating.exactOptional(),
    maxRating: rating.exactOptional(),
    sortBy: ReviewSortTypeSchema.exactOptional(),
  })
  .refine(
    ({ minRating, maxRating }) =>
      minRating === undefined ||
      maxRating === undefined ||
      minRating <= maxRating,
    { path: ['minRating'], message: 'Must not be greater than maxRating' },
  ) satisfies z.ZodType<ApiReviewSearchRequest>
