import { Result } from '@beauty-salon-backend/utility'
import { match } from 'ts-pattern'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import { ReviewWriteMapper } from '../../mappers/write/review.mapper'
import type { Actor } from '../../models/auth'
import { type ApiReviewResponse, parseReviewId } from '../../models/review'
import { reviewUpdateRequestSchema } from '../../schemas/review.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { reviewerOf } from './_shared/authorization'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'
import { toUnreachedReviewError } from './_shared/refusals'

const MESSAGE = 'Invalid review update'

export class UpdateReviewUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Changes what the request names of a review the signed-in customer
   * wrote, and counts the rating of the salon again. Whether the actor
   * changes reviews is decided before the request is read.
   */
  async execute(
    actor: Actor,
    id: unknown,
    input: unknown,
  ): Promise<Result<ApiReviewResponse, DomainError>> {
    const reviewer = reviewerOf(actor)
    if (reviewer.type === 'error') {
      return reviewer
    }
    const reviewId = parseReviewId(id)
    if (reviewId.type === 'error') {
      return reviewId
    }
    const request = parseWith(reviewUpdateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const changed = await this.dependencies.reviewRepository.update(
      reviewId.data,
      reviewer.data,
      ReviewWriteMapper.fromUpdateRequest(request.data),
    )
    if (changed.type === 'error') {
      return changed
    }

    return match(changed.data)
      .returnType<Result<ApiReviewResponse, DomainError>>()
      .with({ type: 'updated' }, ({ review }) =>
        ReviewReadMapper.toApiReview(review),
      )
      .with({ type: 'invalid' }, ({ issues }) =>
        Result.error(DomainErrors.validation(MESSAGE, issues)),
      )
      .with(
        { type: 'reviewNotFound' },
        { type: 'reviewerNotFound' },
        { type: 'notTheAuthor' },
        (unreached) =>
          Result.error(toUnreachedReviewError(unreached, reviewId.data)),
      )
      .exhaustive()
  }
}
