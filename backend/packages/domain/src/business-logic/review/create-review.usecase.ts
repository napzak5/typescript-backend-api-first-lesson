import { Result } from '@beauty-salon-backend/utility'
import { reviewMessages } from '@beauty-salon-shared/i18n/messages/api'
import { match } from 'ts-pattern'
import { ReviewReadMapper } from '../../mappers/read/review.mapper'
import { ReviewWriteMapper } from '../../mappers/write/review.mapper'
import type { Actor } from '../../models/auth'
import type { ApiReviewResponse } from '../../models/review'
import { reviewCreateRequestSchema } from '../../schemas/review.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { reviewerOf } from './_shared/authorization'
import type { ReviewUseCaseDependencies } from './_shared/dependencies'
import { toReviewRefusalError } from './_shared/refusals'

const MESSAGE = reviewMessages.invalidReview

export class CreateReviewUseCase {
  constructor(private readonly dependencies: ReviewUseCaseDependencies) {}

  /**
   * Writes the review of a visit of the signed-in customer, and counts the
   * rating and the review count of the salon again. Whether the actor
   * writes reviews is decided before the request is read; a request that
   * names another customer is refused as a review written for someone
   * else, and an account whose customer was deleted as one without a
   * profile.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiReviewResponse, DomainError>> {
    const reviewer = reviewerOf(actor)
    if (reviewer.type === 'error') {
      return reviewer
    }

    const request = parseWith(reviewCreateRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const requested = ReviewWriteMapper.fromCreateRequest(request.data)
    if (requested.customerId !== reviewer.data) {
      return Result.error(DomainErrors.forbidden())
    }

    const created = await this.dependencies.reviewRepository.create(
      reviewer.data,
      requested,
    )
    if (created.type === 'error') {
      return created
    }

    return (
      match(created.data)
        .returnType<Result<ApiReviewResponse, DomainError>>()
        .with({ type: 'created' }, ({ review }) =>
          ReviewReadMapper.toApiReview(review),
        )
        // Answered as an account without a profile is.
        .with({ type: 'reviewerNotFound' }, () =>
          Result.error(DomainErrors.forbidden()),
        )
        .with({ type: 'invalid' }, ({ issues }) =>
          Result.error(DomainErrors.validation(MESSAGE, issues)),
        )
        .with(
          { type: 'bookingNotCompleted' },
          { type: 'bookingReviewed' },
          (refusal) => Result.error(toReviewRefusalError(refusal)),
        )
        .exhaustive()
    )
  }
}
