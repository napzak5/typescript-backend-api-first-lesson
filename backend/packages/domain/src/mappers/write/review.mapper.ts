import type {
  ApiReviewRespondRequest,
  ApiReviewUpdateRequest,
  RequestedReview,
  RequestedReviewChange,
  RequestedReviewResponse,
} from '../../models/review'
import type { ReviewListCriteria } from '../../repositories/review.repository'
import type {
  ReviewCreateRequest,
  ReviewSearchRequest,
} from '../../schemas/review.schema'
import { toPaging } from './page'

/**
 * API request → what the reviews are asked with. Nothing is converted and
 * no row is made: whether a review is written follows from the booking it
 * names, and the row holds what the API decides as well (`isVerified`),
 * so a pure function plans it (`planReview`, `planReviewChange`), and this
 * mapper returns what such a plan is made from. It is where the compiler
 * checks that a request holds what the plan reads.
 */
export const ReviewWriteMapper = {
  /** The review a customer asks to write. */
  fromCreateRequest(request: ReviewCreateRequest): RequestedReview {
    return request
  },

  /** What a customer says anew in a review: the properties the request names, and no others. */
  fromUpdateRequest(request: ApiReviewUpdateRequest): RequestedReviewChange {
    return request
  },

  /** The response a salon asks to write to a review, or null to take it down. */
  fromRespondRequest(
    request: ApiReviewRespondRequest,
  ): RequestedReviewResponse {
    return request
  },

  /**
   * The criteria of the list: a filter the request does not name is none,
   * and the latest reviews come first unless the request says otherwise.
   */
  fromSearchRequest(request: ReviewSearchRequest): ReviewListCriteria {
    return {
      ...toPaging(request),
      sortBy: request.sortBy ?? 'recent',
      salonId: request.salonId ?? null,
      staffId: request.staffId ?? null,
      customerId: request.customerId ?? null,
      bookingId: request.bookingId ?? null,
      isVerified: request.isVerified ?? null,
      minRating: request.minRating ?? null,
      maxRating: request.maxRating ?? null,
    }
  },
}
